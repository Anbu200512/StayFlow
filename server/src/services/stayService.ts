import QRCode from 'qrcode';
import {
  Guest,
  HousekeepingTask,
  Hotel,
  Invoice,
  InvoiceItem,
  Order,
  Payment,
  Reservation,
  Room,
  ServiceRequest,
  Stay,
  type InvoiceDocument,
  type StayDocument,
} from '../models/index.js';
import { InvoiceStatus, PaymentMethod, ReservationStatus, RoomStatus, ServiceStatus, StayStatus, TaskStatus } from '../types/enums.js';
import { AppError } from '../utils/error.js';
import { env } from '../config/env.js';
import { entityId, roundMoney } from '../utils/common.js';
import { createOpaqueToken, hashToken } from '../utils/token.js';
import { recordPayment } from './invoiceService.js';
import { withReservationTransaction } from './reservationService.js';
import { emitHotelEvent } from './socketService.js';
import { writeAuditLog } from '../middleware/audit.js';
import { createNotification } from './notificationService.js';

export async function checkIn(input: { reservationId: string; hotelId: string; userId: string; idVerified?: boolean; idType?: string; idNumber?: string; idDocumentUrl?: string; paymentAmount?: number; paymentMethod?: PaymentMethod; request?: any }) {
  const result = await withReservationTransaction(async (session) => {
    const reservation = await Reservation.findOne({ _id: input.reservationId, hotelId: input.hotelId }).session(session ?? null);
    if (!reservation) throw new AppError('Reservation not found', 404, 'RESERVATION_NOT_FOUND');
    if (reservation.status !== ReservationStatus.CONFIRMED) throw new AppError('Only confirmed reservations can be checked in', 400, 'INVALID_STATUS_TRANSITION');
    if (input.idVerified === false) throw new AppError('Guest identity must be verified before check-in', 400, 'ID_VERIFICATION_REQUIRED');
    const idType = input.idType?.trim();
    const idNumber = input.idNumber?.trim();
    if (input.idVerified && (!idType || !idNumber)) throw new AppError('Government ID type and number are required for check-in', 400, 'GOVERNMENT_ID_REQUIRED');
    if (idType || idNumber || input.idDocumentUrl) {
      await Guest.updateOne({ _id: reservation.guestId }, { $set: { idType, idNumber, idDocumentUrl: input.idDocumentUrl } }, { session });
    }
    const room = await Room.findOne({ _id: reservation.roomId, hotelId: input.hotelId }).session(session ?? null);
    if (!room) throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    if ([RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE, RoomStatus.DIRTY, RoomStatus.CLEANING].includes(room.status)) throw new AppError('Room is not ready for check-in', 409, 'ROOM_NOT_READY');
    const existingStay = await Stay.findOne({ reservationId: reservation._id, status: StayStatus.ACTIVE }).session(session ?? null);
    if (existingStay) throw new AppError('This reservation already has an active stay', 409, 'STAY_ALREADY_ACTIVE');
    const token = createOpaqueToken(24);
    const [stay] = await Stay.create([{
      hotelId: input.hotelId,
      reservationId: reservation._id,
      guestId: reservation.guestId,
      roomId: reservation.roomId,
      checkInAt: new Date(),
      expectedCheckOut: reservation.checkOut,
      status: StayStatus.ACTIVE,
      openedBy: input.userId as any,
      qrTokenHash: hashToken(token),
    }], { session });
    reservation.status = ReservationStatus.CHECKED_IN;
    reservation.checkedInAt = new Date();
    reservation.statusHistory.push({ status: ReservationStatus.CHECKED_IN, at: new Date(), by: input.userId as any, note: 'Checked in at reception' });
    await reservation.save({ session });
    await Room.updateOne({ _id: room._id }, { $set: { status: RoomStatus.OCCUPIED, statusUpdatedAt: new Date() } }, { session });
    if (input.paymentAmount && input.paymentAmount > 0) {
      if (!input.paymentMethod) throw new AppError('Payment method is required for an advance', 400, 'PAYMENT_METHOD_REQUIRED');
      const invoice = await Invoice.findOne({ reservationId: reservation._id }).session(session ?? null);
      if (invoice) await recordPayment({ hotelId: input.hotelId, reservationId: reservation._id, stayId: stay._id, guestId: reservation.guestId, invoiceId: invoice._id, amount: input.paymentAmount, method: input.paymentMethod, recordedBy: input.userId, session });
    }
    return { reservation, stay, room, token };
  });
  const qrDataUrl = await QRCode.toDataURL(`${env.CLIENT_URL}/guest/${result.token}`);
  emitHotelEvent(input.hotelId, 'stay.checked_in', { stayId: result.stay._id, reservationId: result.reservation._id, roomId: result.room._id });
  await writeAuditLog({ hotelId: input.hotelId, userId: input.userId, action: 'stay.checked_in', entity: 'Stay', entityId: result.stay._id.toString(), newValue: { reservationId: result.reservation._id, roomId: result.room._id }, request: input.request });
  return { ...result, qrDataUrl };
}

async function recalculateStayInvoice(stay: StayDocument, session?: any): Promise<InvoiceDocument> {
  const invoice = await Invoice.findOne({ stayId: stay._id, status: { $ne: InvoiceStatus.VOID } }).sort({ createdAt: -1 }).session(session ?? null);
  if (!invoice) throw new AppError('Stay invoice not found', 404, 'INVOICE_NOT_FOUND');
  const populatedReservation = stay.reservationId as any;
  const reservationReference = invoice.reservationId ?? populatedReservation?._id ?? stay.reservationId;
  const [orders, services, hotel, reservation] = await Promise.all([
    Order.find({ stayId: stay._id, status: { $ne: 'cancelled' } }).session(session ?? null).lean(),
    ServiceRequest.find({ stayId: stay._id, status: ServiceStatus.COMPLETED }).session(session ?? null).lean(),
    Hotel.findById(stay.hotelId).session(session ?? null).lean(),
    populatedReservation?.pricing ? Promise.resolve(populatedReservation) : reservationReference ? Reservation.findById(reservationReference).session(session ?? null).lean() : Promise.resolve(null),
  ]);
  const taxRate = Math.max(0, hotel?.taxRate ?? 0);
  const orderSubtotal = roundMoney(orders.reduce((sum, order) => sum + (order.subtotal ?? 0), 0));
  const orderTax = roundMoney(orders.reduce((sum, order) => sum + (order.tax ?? 0), 0));
  const serviceSubtotal = roundMoney(services.reduce((sum, service) => sum + (service.chargeAmount ?? 0), 0));
  const serviceTaxById = new Map<string, number>();
  let serviceTax = 0;
  for (const service of services) {
    const taxAmount = roundMoney(Math.max(0, service.chargeAmount ?? 0) * taxRate / 100);
    serviceTaxById.set(String(service._id), taxAmount);
    serviceTax = roundMoney(serviceTax + taxAmount);
  }
  const basePricing = reservation?.pricing;
  const baseRoomSubtotal = basePricing?.roomSubtotal ?? invoice.roomSubtotal;
  const baseServicesSubtotal = basePricing?.servicesSubtotal ?? invoice.servicesSubtotal;
  const baseSubtotal = basePricing?.subtotal ?? Math.max(0, invoice.subtotal - baseServicesSubtotal);
  const baseTax = basePricing?.tax ?? Math.max(0, invoice.tax - baseServicesSubtotal * taxRate / 100);
  const baseDiscount = basePricing?.discount ?? invoice.discount;
  const addedSubtotal = roundMoney(orderSubtotal + serviceSubtotal);
  invoice.roomSubtotal = roundMoney(baseRoomSubtotal);
  invoice.servicesSubtotal = roundMoney(baseServicesSubtotal + addedSubtotal);
  invoice.subtotal = roundMoney(baseSubtotal + addedSubtotal);
  invoice.tax = roundMoney(baseTax + orderTax + serviceTax);
  invoice.discount = roundMoney(baseDiscount);
  invoice.total = roundMoney(invoice.subtotal + invoice.tax);
  invoice.balance = roundMoney(Math.max(0, invoice.total - invoice.amountPaid));
  invoice.status = invoice.balance === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

  const existingItems = await InvoiceItem.find({ invoiceId: invoice._id }).session(session ?? null);
  const orderItems = new Map<string, any>();
  const serviceItems = new Map<string, any>();
  for (const item of existingItems) {
    const orderId = item.metadata?.orderId as any;
    const serviceRequestId = item.metadata?.serviceRequestId as any;
    if (orderId !== undefined && orderId !== null && !orderItems.has(String(orderId))) orderItems.set(String(orderId), item);
    if (serviceRequestId !== undefined && serviceRequestId !== null && !serviceItems.has(String(serviceRequestId))) serviceItems.set(String(serviceRequestId), item);
  }
  for (const order of orders) {
    const key = String(order._id);
    const values = { hotelId: stay.hotelId, invoiceId: invoice._id, reservationId: invoice.reservationId, stayId: stay._id, type: 'restaurant', description: `Restaurant order ${order.orderNumber}`, quantity: 1, unitPrice: order.total, amount: order.total, taxAmount: order.tax, metadata: { orderId: order._id } };
    const existing = orderItems.get(key);
    if (existing) {
      Object.assign(existing, values);
      await existing.save({ session });
    } else {
      const [created] = await InvoiceItem.create([values], { session });
      orderItems.set(key, created);
    }
  }
  for (const service of services) {
    const key = String(service._id);
    const values = { hotelId: stay.hotelId, invoiceId: invoice._id, reservationId: invoice.reservationId, stayId: stay._id, type: 'service', description: service.description, quantity: 1, unitPrice: service.chargeAmount, amount: service.chargeAmount, taxAmount: serviceTaxById.get(key) ?? 0, metadata: { serviceRequestId: service._id } };
    const existing = serviceItems.get(key);
    if (existing) {
      Object.assign(existing, values);
      await existing.save({ session });
    } else {
      const [created] = await InvoiceItem.create([values], { session });
      serviceItems.set(key, created);
    }
  }
  const folioItems = await InvoiceItem.find({ invoiceId: invoice._id }).session(session ?? null).select('_id');
  const uniqueItems = new Map<string, any>();
  for (const item of folioItems) uniqueItems.set(String(item._id), item._id);
  invoice.items = [...uniqueItems.values()];
  await invoice.save({ session });
  return invoice;
}

export async function checkout(input: { stayId: string; hotelId: string; userId: string; paymentAmount?: number; paymentMethod?: PaymentMethod; allowOutstanding?: boolean; request?: any }) {
  const result = await withReservationTransaction(async (session) => {
    const stay = await Stay.findOne({ _id: input.stayId, hotelId: input.hotelId, status: StayStatus.ACTIVE }).populate('reservationId').session(session ?? null);
    if (!stay) throw new AppError('Active stay not found', 404, 'STAY_NOT_FOUND');
    const reservation = await Reservation.findOne({ _id: stay.reservationId, hotelId: input.hotelId }).session(session ?? null);
    if (!reservation) throw new AppError('Reservation not found', 404, 'RESERVATION_NOT_FOUND');
    await Invoice.updateOne({ reservationId: reservation._id, stayId: { $exists: false } }, { $set: { stayId: stay._id } }, { session });
    const invoice = await recalculateStayInvoice(stay, session);
    const paymentAmount = roundMoney(Math.min(input.paymentAmount ?? 0, invoice.balance));
    if (invoice.balance > 0 && paymentAmount <= 0 && !input.allowOutstanding) throw new AppError('Outstanding balance must be collected before checkout', 400, 'OUTSTANDING_BALANCE');
    if (paymentAmount > 0) {
      if (!input.paymentMethod) throw new AppError('Payment method is required', 400, 'PAYMENT_METHOD_REQUIRED');
      await recordPayment({ hotelId: input.hotelId, reservationId: reservation._id, stayId: stay._id, guestId: reservation.guestId, invoiceId: invoice._id, amount: paymentAmount, method: input.paymentMethod, recordedBy: input.userId, session });
    }
    const finalInvoice = await Invoice.findById(invoice._id).session(session ?? null);
    if (!finalInvoice) throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    if (finalInvoice.balance > 0 && !input.allowOutstanding) throw new AppError('Outstanding balance remains after payment', 400, 'OUTSTANDING_BALANCE');
    stay.status = StayStatus.COMPLETED;
    stay.actualCheckOut = new Date();
    stay.closedBy = input.userId as any;
    await stay.save({ session });
    reservation.status = ReservationStatus.CHECKED_OUT;
    reservation.checkedOutAt = new Date();
    reservation.statusHistory.push({ status: ReservationStatus.CHECKED_OUT, at: new Date(), by: input.userId as any, note: 'Checked out' });
    await reservation.save({ session });
    await Room.updateOne({ _id: stay.roomId }, { $set: { status: RoomStatus.DIRTY, statusUpdatedAt: new Date(), statusNote: 'Checkout cleaning required' }, $pull: { reservedIntervals: { reservationId: reservation._id } } }, { session });
    const task = await HousekeepingTask.findOne({ roomId: stay.roomId, type: 'checkout_cleaning', status: { $nin: [TaskStatus.COMPLETED, TaskStatus.INSPECTED, TaskStatus.CANCELLED] } }).session(session ?? null);
    if (!task) await HousekeepingTask.create([{ hotelId: input.hotelId, roomId: stay.roomId, type: 'checkout_cleaning', status: TaskStatus.PENDING, priority: 'high', source: 'checkout', reservationId: reservation._id, notes: 'Post-checkout cleaning and inspection' }], { session });
    return { stay, reservation, invoice: finalInvoice };
  });
  emitHotelEvent(input.hotelId, 'stay.checked_out', { stayId: result.stay._id, reservationId: result.reservation._id, roomId: result.stay.roomId });
  await createNotification({ hotelId: input.hotelId, type: 'stay.checked_out', title: 'Checkout complete', message: `${result.reservation.bookingNumber} has been checked out.` });
  await writeAuditLog({ hotelId: input.hotelId, userId: input.userId, action: 'stay.checked_out', entity: 'Stay', entityId: result.stay._id.toString(), newValue: { invoiceId: result.invoice._id, balance: result.invoice.balance }, request: input.request });
  return result;
}

export async function getCheckoutSummary(input: { stayId: string; hotelId: string }) {
  const stay = await Stay.findOne({ _id: input.stayId, hotelId: input.hotelId }).populate('reservationId roomId').lean();
  if (!stay) throw new AppError('Active stay not found', 404, 'STAY_NOT_FOUND');
  const reservation = stay.reservationId as any;
  if (!reservation || !reservation._id) throw new AppError('Reservation not found', 404, 'RESERVATION_NOT_FOUND');
  const invoice = await Invoice.findOne({ stayId: stay._id, status: { $ne: InvoiceStatus.VOID } }).sort({ createdAt: -1 }).lean()
    ?? await Invoice.findOne({ reservationId: reservation._id, status: { $ne: InvoiceStatus.VOID } }).sort({ createdAt: -1 }).lean();
  const [orders, services, hotel, payments] = await Promise.all([
    Order.find({ stayId: stay._id, status: { $ne: 'cancelled' } }).sort({ createdAt: 1 }).lean(),
    ServiceRequest.find({ stayId: stay._id, status: ServiceStatus.COMPLETED }).sort({ createdAt: 1 }).lean(),
    Hotel.findById(stay.hotelId).select('taxRate currency name').lean(),
    invoice ? Payment.find({ invoiceId: invoice._id }).sort({ createdAt: 1 }).lean() : Promise.resolve([]),
  ]);
  const taxRate = Math.max(0, hotel?.taxRate ?? 0);
  const orderSubtotal = roundMoney(orders.reduce((sum, order) => sum + (order.subtotal ?? 0), 0));
  const orderTax = roundMoney(orders.reduce((sum, order) => sum + (order.tax ?? 0), 0));
  const serviceSubtotal = roundMoney(services.reduce((sum, service) => sum + (service.chargeAmount ?? 0), 0));
  let serviceTax = 0;
  const serviceCharges = services.map((service) => {
    const taxAmount = roundMoney(Math.max(0, service.chargeAmount ?? 0) * taxRate / 100);
    serviceTax = roundMoney(serviceTax + taxAmount);
    return { id: String(service._id), description: service.description, amount: service.chargeAmount ?? 0, taxAmount };
  });
  const basePricing = reservation.pricing;
  const baseRoomSubtotal = basePricing?.roomSubtotal ?? invoice?.roomSubtotal ?? 0;
  const baseServicesSubtotal = basePricing?.servicesSubtotal ?? invoice?.servicesSubtotal ?? 0;
  const baseSubtotal = basePricing?.subtotal ?? Math.max(0, (invoice?.subtotal ?? 0) - baseServicesSubtotal);
  const baseTax = basePricing?.tax ?? Math.max(0, (invoice?.tax ?? 0) - baseServicesSubtotal * taxRate / 100);
  const baseDiscount = basePricing?.discount ?? invoice?.discount ?? 0;
  const addedSubtotal = roundMoney(orderSubtotal + serviceSubtotal);
  const roomSubtotal = roundMoney(baseRoomSubtotal);
  const servicesSubtotal = roundMoney(baseServicesSubtotal + addedSubtotal);
  const subtotal = roundMoney(baseSubtotal + addedSubtotal);
  const tax = roundMoney(baseTax + orderTax + serviceTax);
  const discount = roundMoney(baseDiscount);
  const total = roundMoney(subtotal + tax);
  const amountPaid = roundMoney(invoice?.amountPaid ?? payments.reduce((sum, payment) => sum + (payment.amount ?? 0), 0));
  const balance = roundMoney(Math.max(0, total - amountPaid));
  const extraCharges = [
    ...orders.map((order) => ({ type: 'restaurant' as const, description: `Restaurant order ${order.orderNumber}`, amount: order.total ?? 0, taxAmount: order.tax ?? 0, status: order.status })),
    ...serviceCharges.map((charge) => ({ type: 'service' as const, description: charge.description, amount: charge.amount, taxAmount: charge.taxAmount, status: ServiceStatus.COMPLETED })),
  ];
  return {
    stay: { id: String(stay._id), checkInAt: stay.checkInAt, expectedCheckOut: stay.expectedCheckOut, status: stay.status },
    guest: reservation.guestSnapshot ? { fullName: reservation.guestSnapshot.fullName, mobile: reservation.guestSnapshot.mobile, email: reservation.guestSnapshot.email } : undefined,
    room: { roomNumber: (stay.roomId as any)?.roomNumber },
    reservation: { id: String(reservation._id), bookingNumber: reservation.bookingNumber, source: reservation.source, checkIn: reservation.checkIn, checkOut: reservation.checkOut },
    folio: { roomSubtotal, servicesSubtotal, subtotal, tax, discount, total, amountPaid, balance, currency: hotel?.currency ?? invoice?.currency ?? 'INR' },
    extraCharges,
    payments: payments.length ? payments.map((payment) => ({ id: String(payment._id), amount: payment.amount, method: payment.method, paidAt: payment.paidAt })) : undefined,
  };
}

export async function getStayByQrToken(token: string) {
  const tokenHash = hashToken(token);
  return Stay.findOne({ qrTokenHash: tokenHash, status: StayStatus.ACTIVE }).populate('roomId guestId reservationId').lean();
}

export async function createServiceRequest(input: { hotelId: string; roomId: string; category: string; description: string; guestId?: string; stayId?: string; reservationId?: string; qrToken?: string; priority?: string }) {
  let stayId = input.stayId;
  let guestId = input.guestId;
  if (input.qrToken) {
    const stay = await getStayByQrToken(input.qrToken);
    if (!stay || stay.hotelId.toString() !== input.hotelId) throw new AppError('Guest portal session is invalid', 401, 'INVALID_GUEST_SESSION');
    stayId = entityId(stay._id);
    guestId = stay.guestId ? entityId(stay.guestId) : undefined;
  }
  if (!stayId) throw new AppError('Active stay is required', 400, 'STAY_REQUIRED');
  const request = await ServiceRequest.create({ hotelId: input.hotelId, stayId, reservationId: input.reservationId, roomId: input.roomId, guestId, category: input.category, description: input.description, priority: input.priority ?? 'normal', status: ServiceStatus.PENDING });
  emitHotelEvent(input.hotelId, 'service.request.created', request.toObject());
  return request;
}

export async function updateServiceRequest(input: { requestId: string; hotelId: string; status: ServiceStatus; assignedTo?: string; chargeAmount?: number; userId?: string }) {
  const request = await ServiceRequest.findOne({ _id: input.requestId, hotelId: input.hotelId });
  if (!request) throw new AppError('Service request not found', 404, 'SERVICE_REQUEST_NOT_FOUND');
  const allowed: Record<ServiceStatus, ServiceStatus[]> = {
    [ServiceStatus.PENDING]: [ServiceStatus.ACCEPTED, ServiceStatus.CANCELLED],
    [ServiceStatus.ACCEPTED]: [ServiceStatus.IN_PROGRESS, ServiceStatus.CANCELLED],
    [ServiceStatus.IN_PROGRESS]: [ServiceStatus.COMPLETED, ServiceStatus.CANCELLED],
    [ServiceStatus.COMPLETED]: [],
    [ServiceStatus.CANCELLED]: [],
  };
  if (!allowed[request.status].includes(input.status)) throw new AppError('Invalid service request transition', 400, 'INVALID_STATUS_TRANSITION');
  request.status = input.status;
  request.assignedTo = input.assignedTo as any;
  if (input.chargeAmount !== undefined) request.chargeAmount = Math.max(0, input.chargeAmount);
  if (input.status === ServiceStatus.COMPLETED) request.fulfilledAt = new Date();
  await request.save();
  emitHotelEvent(input.hotelId, 'service.request.updated', request.toObject());
  return request;
}

export { recalculateStayInvoice };
