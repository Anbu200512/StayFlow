import crypto from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import {
  Guest,
  Hotel,
  Invoice,
  InvoiceItem,
  Payment,
  Reservation,
  Room,
  Stay,
} from '../models/index.js';
import { InvoiceStatus, PaymentMethod, PaymentStatus, ReservationSource, ReservationStatus, RoomStatus, StayStatus } from '../types/enums.js';
import { AppError } from '../utils/error.js';
import { calculateNights, roundMoney } from '../utils/common.js';
import { calculateAuthoritativePrice, type ServiceSelectionInput } from './pricingService.js';
import { createInvoiceForReservation, recordPayment, updateInvoicePayment } from './invoiceService.js';
import { createRazorpayOrder } from './paymentGatewayService.js';
import { emitHotelEvent } from './socketService.js';
import { writeAuditLog } from '../middleware/audit.js';
import { validateStayDates } from './availabilityService.js';

export interface ReservationGuestInput {
  guestId?: string;
  fullName: string;
  mobile: string;
  email?: string;
  address?: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
  dateOfBirth?: Date;
  emergencyContact?: { name?: string; mobile?: string; relationship?: string };
  privacyConsent?: boolean;
  marketingConsent?: boolean;
}

export interface CreateReservationInput {
  hotelId: string;
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  source: ReservationSource;
  guest: ReservationGuestInput;
  services?: ServiceSelectionInput[];
  offerCode?: string;
  paymentMethod?: PaymentMethod;
  advanceAmount?: number;
  specialRequests?: string;
  notes?: string;
  createdBy?: string;
  request?: any;
}

function makeNumber(prefix: string): string {
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `${prefix}-${datePart}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function isTransactionUnsupported(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  const code = String(error.code);
  return code === '20' || code === '251' || code === '263' || code === 'IllegalOperation';
}

async function withReservationTransaction<T>(work: (session?: any) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  let result: T | undefined;
  try {
    await session.withTransaction(async () => {
      result = await work(session);
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
    return result as T;
  } catch (error) {
    if (!isTransactionUnsupported(error)) throw error;
    console.warn(
      '[stayflow] MongoDB rejected transactions (code %s). Falling back to a non-transactional write for this operation. ' +
        'Double-booking is still prevented by the atomic room-interval claim, but reservation/guest/invoice/payment writes are no longer all-or-nothing. ' +
        'Run MongoDB as a replica set to restore full atomicity.',
      isTransactionUnsupported(error) ? String((error as { code: unknown }).code) : 'unknown',
    );
    return work(undefined);
  } finally {
    await session.endSession();
  }
}

const blockedRoomStatuses = [RoomStatus.OUT_OF_SERVICE, RoomStatus.MAINTENANCE, RoomStatus.DIRTY, RoomStatus.CLEANING];

function intervalFilter(checkIn: Date, checkOut: Date, reservationId?: string) {
  return {
    $nor: [{
      reservedIntervals: {
        $elemMatch: {
          ...(reservationId ? { reservationId: { $ne: new Types.ObjectId(reservationId) } } : {}),
          checkIn: { $lt: checkOut },
          checkOut: { $gt: checkIn },
        },
      },
    }],
  };
}

async function claimRoomInterval(input: { roomId: string; hotelId: string; reservationId: Types.ObjectId; checkIn: Date; checkOut: Date; session?: any; replaceReservationId?: string }) {
  const query: Record<string, unknown> = {
    _id: input.roomId,
    hotelId: input.hotelId,
    status: { $nin: blockedRoomStatuses },
    ...intervalFilter(input.checkIn, input.checkOut, input.replaceReservationId),
  };
  const interval = { reservationId: input.reservationId, checkIn: input.checkIn, checkOut: input.checkOut };
  const update = input.replaceReservationId
    ? [{ $set: { reservedIntervals: { $concatArrays: [{ $filter: { input: { $ifNull: ['$reservedIntervals', []] }, as: 'interval', cond: { $ne: ['$$interval.reservationId', new Types.ObjectId(input.replaceReservationId)] } } }, [interval]] }, statusUpdatedAt: new Date() } }]
    : { $push: { reservedIntervals: interval }, $set: { statusUpdatedAt: new Date() } };
  const room = await Room.findOneAndUpdate(query, update as any, { new: true, session: input.session }).populate('roomTypeId');
  if (!room) throw new AppError('Room is no longer available', 409, 'ROOM_NOT_AVAILABLE');
  return room;
}

async function upsertGuest(input: CreateReservationInput, session?: any) {
  const filter: Record<string, unknown> = { hotelId: input.hotelId, mobile: input.guest.mobile };
  if (input.guest.guestId && Types.ObjectId.isValid(input.guest.guestId)) {
    filter._id = input.guest.guestId;
  }
  const setFields: Record<string, unknown> = { fullName: input.guest.fullName, mobile: input.guest.mobile };
  if (input.guest.email) setFields.email = input.guest.email.toLowerCase();
  if (input.guest.address) setFields.address = input.guest.address;
  if (input.guest.nationality) setFields.nationality = input.guest.nationality;
  if (input.guest.idType) setFields.idType = input.guest.idType;
  if (input.guest.idNumber) setFields.idNumber = input.guest.idNumber;
  if (input.guest.dateOfBirth) setFields.dateOfBirth = input.guest.dateOfBirth;
  if (input.guest.emergencyContact) setFields.emergencyContact = input.guest.emergencyContact;
  setFields.privacyConsent = input.guest.privacyConsent ?? true;
  setFields.marketingConsent = input.guest.marketingConsent ?? false;
  const guest = await Guest.findOneAndUpdate(filter, {
    $set: setFields,
    $setOnInsert: { hotelId: input.hotelId },
  }, { new: true, upsert: true, setDefaultsOnInsert: true, session });
  return guest;
}

async function updateRoomAvailability(roomId: string, hotelId: string) {
  const room = await Room.findOne({ _id: roomId, hotelId });
  if (!room) return;
  if ([RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE, RoomStatus.DIRTY, RoomStatus.CLEANING].includes(room.status)) return;
  const activeStay = await Stay.exists({ hotelId, roomId, status: StayStatus.ACTIVE });
  if (activeStay) {
    if (room.status !== RoomStatus.OCCUPIED) await Room.updateOne({ _id: roomId }, { $set: { status: RoomStatus.OCCUPIED, statusUpdatedAt: new Date() } });
  } else {
    const now = new Date();
    const currentReservation = await Reservation.findOne({ hotelId, roomId, status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] }, checkIn: { $lte: now }, checkOut: { $gt: now } });
    const nextStatus = currentReservation ? RoomStatus.RESERVED : RoomStatus.AVAILABLE;
    if (room.status !== nextStatus) await Room.updateOne({ _id: roomId }, { $set: { status: nextStatus, statusUpdatedAt: new Date() } });
  }
  const updated = await Room.findById(roomId).select('status roomNumber');
  if (updated) emitHotelEvent(hotelId, 'room.status.updated', { roomId, roomNumber: updated.roomNumber, status: updated.status });
}

async function createReservationInTransaction(input: CreateReservationInput, reservationId: Types.ObjectId, bookingNumber: string, session?: any) {
  const hotel = await Hotel.findOne({ _id: input.hotelId, active: true }).session(session ?? null);
  if (!hotel) throw new AppError('Hotel not found', 404, 'HOTEL_NOT_FOUND');
  const room = await Room.findOne({ _id: input.roomId, hotelId: input.hotelId }).populate('roomTypeId').session(session ?? null);
  if (!room) throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
  const roomType = room.roomTypeId as any;
  if (input.adults < 1 || input.children < 0 || input.adults + input.children > roomType.maxOccupancy) {
    throw new AppError('Guest count exceeds room capacity', 400, 'ROOM_CAPACITY_EXCEEDED');
  }
  const priced = await calculateAuthoritativePrice({ hotelId: input.hotelId, roomTypeId: roomType._id.toString(), checkIn: input.checkIn, checkOut: input.checkOut, services: input.services, offerCode: input.offerCode });
  const guest = await upsertGuest(input, session);
  const claimedRoom = await claimRoomInterval({ roomId: input.roomId, hotelId: input.hotelId, reservationId, checkIn: input.checkIn, checkOut: input.checkOut, session });
  const status = input.paymentMethod === PaymentMethod.RAZORPAY ? ReservationStatus.PENDING : ReservationStatus.CONFIRMED;
  const [reservation] = await Reservation.create([{
    _id: reservationId,
    hotelId: input.hotelId,
    bookingNumber,
    guestId: guest._id,
    guestSnapshot: { fullName: guest.fullName, mobile: guest.mobile, email: guest.email },
    roomId: input.roomId,
    roomTypeId: roomType._id,
    source: input.source,
    status,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guests: { adults: input.adults, children: input.children },
    nights: calculateNights(input.checkIn, input.checkOut),
    pricing: priced.pricing,
    services: priced.selectedServices,
    specialRequests: input.specialRequests,
    notes: input.notes,
    createdBy: input.createdBy,
    confirmedAt: status === ReservationStatus.CONFIRMED ? new Date() : undefined,
    statusHistory: [{ status, at: new Date(), by: input.createdBy, note: 'Reservation created' }],
  }], { session });
  const invoice = await createInvoiceForReservation({
    hotelId: input.hotelId,
    reservationId,
    guestId: guest._id,
    roomId: input.roomId,
    pricing: priced.pricing,
    services: priced.selectedServices,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    invoiceNumber: makeNumber('INV'),
    session,
  });
  const requestedAdvance = input.advanceAmount === undefined ? 0 : roundMoney(input.advanceAmount);
  const advance = Math.min(priced.pricing.total, Math.max(0, requestedAdvance));
  let payment: any;
  if (input.paymentMethod && input.paymentMethod !== PaymentMethod.RAZORPAY && advance > 0) {
    payment = await recordPayment({ hotelId: input.hotelId, reservationId, guestId: guest._id, invoiceId: invoice._id, amount: advance, method: input.paymentMethod, status: PaymentStatus.PAID, recordedBy: input.createdBy, session });
  }
  if (input.paymentMethod === PaymentMethod.RAZORPAY) {
    payment = await recordPayment({ hotelId: input.hotelId, reservationId, guestId: guest._id, invoiceId: invoice._id, amount: priced.pricing.total, method: PaymentMethod.RAZORPAY, status: PaymentStatus.PENDING, recordedBy: input.createdBy, session });
  }
  if (claimedRoom.status === RoomStatus.AVAILABLE && input.checkIn <= new Date()) {
    await Room.updateOne({ _id: input.roomId, status: RoomStatus.AVAILABLE }, { $set: { status: RoomStatus.RESERVED, statusUpdatedAt: new Date() } }, { session });
  }
  return { reservation, invoice, payment, room: claimedRoom, guest };
}

export async function createReservation(input: CreateReservationInput) {
  validateStayDates(input.checkIn, input.checkOut);
  if (!Object.values(ReservationSource).includes(input.source)) throw new AppError('Invalid reservation source', 400, 'INVALID_SOURCE');
  const reservationId = new Types.ObjectId();
  const bookingNumber = makeNumber('HTL');
  const result = await withReservationTransaction((session) => createReservationInTransaction(input, reservationId, bookingNumber, session));
  await updateRoomAvailability(input.roomId, input.hotelId);
  let paymentOrder: { id?: string } | null = null;
  if (input.paymentMethod === PaymentMethod.RAZORPAY && result.payment) {
    paymentOrder = await createRazorpayOrder({ amount: result.invoice.total, currency: result.invoice.currency, receipt: result.reservation.bookingNumber, notes: { reservationId: result.reservation._id.toString(), bookingNumber: result.reservation.bookingNumber } }) as { id?: string } | null;
    if (paymentOrder?.id) await Payment.updateOne({ _id: result.payment._id }, { $set: { providerOrderId: paymentOrder.id } });
  }
  emitHotelEvent(input.hotelId, 'reservation.created', { reservationId: result.reservation._id, bookingNumber: result.reservation.bookingNumber, source: input.source, status: result.reservation.status });
  await writeAuditLog({ hotelId: input.hotelId, userId: input.createdBy, action: 'reservation.created', entity: 'Reservation', entityId: result.reservation._id.toString(), newValue: { bookingNumber, source: input.source, status: result.reservation.status }, request: input.request });
  return { ...result, paymentOrder };
}

export async function getReservationById(id: string, hotelId?: string) {
  const filter: Record<string, unknown> = { _id: id };
  if (hotelId) filter.hotelId = hotelId;
  return Reservation.findOne(filter).populate('guestId roomId roomTypeId').lean();
}

export async function getPublicReservation(bookingNumber: string, emailOrMobile: string) {
  const reservation = await Reservation.findOne({ bookingNumber, $or: [{ 'guestSnapshot.email': emailOrMobile.toLowerCase() }, { 'guestSnapshot.mobile': emailOrMobile }] })
    .select('-guestId.idNumber -guestId.idDocumentUrl')
    .populate('roomTypeId')
    .lean();
  return reservation;
}

export async function cancelReservation(input: { reservationId: string; hotelId: string; userId?: string; reason?: string; request?: any }) {
  const reservation = await Reservation.findOne({ _id: input.reservationId, hotelId: input.hotelId });
  if (!reservation) throw new AppError('Reservation not found', 404, 'RESERVATION_NOT_FOUND');
  if (![ReservationStatus.PENDING, ReservationStatus.CONFIRMED].includes(reservation.status)) {
    throw new AppError('Only pending or confirmed reservations can be cancelled', 400, 'INVALID_STATUS_TRANSITION');
  }
  const result = await withReservationTransaction(async (session) => {
    reservation.status = ReservationStatus.CANCELLED;
    reservation.cancelledAt = new Date();
    reservation.cancellationReason = input.reason;
    reservation.statusHistory.push({ status: ReservationStatus.CANCELLED, at: new Date(), by: input.userId ? new Types.ObjectId(input.userId) : undefined, note: input.reason });
    await reservation.save({ session });
    await Room.updateOne({ _id: reservation.roomId, hotelId: input.hotelId }, { $pull: { reservedIntervals: { reservationId: reservation._id } } }, { session });
    const paidPayments = await Payment.find({ reservationId: reservation._id, status: PaymentStatus.PAID }).session(session ?? null);
    for (const paid of paidPayments) {
      paid.status = PaymentStatus.REFUNDED;
      paid.refundAmount = paid.amount;
      paid.notes = input.reason ? `Refund approved: ${input.reason}` : 'Refund approved after cancellation';
      await paid.save({ session });
    }
    const invoice = await Invoice.findOne({ reservationId: reservation._id }).session(session ?? null);
    if (invoice) {
      invoice.amountPaid = 0;
      invoice.balance = 0;
      invoice.status = InvoiceStatus.VOID;
      invoice.notes = input.reason ? `Void after cancellation: ${input.reason}` : 'Void after cancellation';
      await invoice.save({ session });
    }
    return reservation;
  });
  await updateRoomAvailability(String(result.roomId), input.hotelId);
  emitHotelEvent(input.hotelId, 'reservation.cancelled', { reservationId: result._id, bookingNumber: result.bookingNumber });
  await writeAuditLog({ hotelId: input.hotelId, userId: input.userId, action: 'reservation.cancelled', entity: 'Reservation', entityId: result._id.toString(), oldValue: { status: ReservationStatus.CONFIRMED }, newValue: { status: result.status, reason: input.reason }, request: input.request });
  return result;
}

export async function extendReservation(input: { reservationId: string; hotelId: string; newCheckOut: Date; userId?: string; request?: any }) {
  const reservation = await Reservation.findOne({ _id: input.reservationId, hotelId: input.hotelId });
  if (!reservation) throw new AppError('Reservation not found', 404, 'RESERVATION_NOT_FOUND');
  if (![ReservationStatus.PENDING, ReservationStatus.CONFIRMED].includes(reservation.status)) throw new AppError('Only active reservations can be extended', 400, 'INVALID_STATUS_TRANSITION');
  if (input.newCheckOut <= reservation.checkOut) throw new AppError('New check-out must be after the current check-out', 400, 'INVALID_DATE_RANGE');
  validateStayDates(reservation.checkIn, input.newCheckOut);
  const oldCheckOut = reservation.checkOut;
  const updated = await withReservationTransaction(async (session) => {
    await claimRoomInterval({ roomId: reservation.roomId.toString(), hotelId: input.hotelId, reservationId: reservation._id, checkIn: reservation.checkIn, checkOut: input.newCheckOut, replaceReservationId: reservation._id.toString(), session });
    const priced = await calculateAuthoritativePrice({ hotelId: input.hotelId, roomTypeId: reservation.roomTypeId.toString(), checkIn: reservation.checkIn, checkOut: input.newCheckOut, services: reservation.services.map((service) => ({ code: service.code, quantity: service.quantity, notes: service.notes })), offerCode: undefined });
    reservation.checkOut = input.newCheckOut;
    reservation.nights = calculateNights(reservation.checkIn, input.newCheckOut);
    reservation.pricing = priced.pricing;
    await reservation.save({ session });
    const invoice = await Invoice.findOne({ reservationId: reservation._id }).session(session ?? null);
    if (invoice) {
      invoice.roomSubtotal = priced.pricing.roomSubtotal;
      invoice.servicesSubtotal = priced.pricing.servicesSubtotal;
      invoice.subtotal = priced.pricing.subtotal;
      invoice.tax = priced.pricing.tax;
      invoice.discount = priced.pricing.discount;
      invoice.total = priced.pricing.total;
      invoice.balance = Math.max(0, invoice.total - invoice.amountPaid);
      invoice.status = invoice.balance === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
      await invoice.save({ session });
      await InvoiceItem.updateOne({ invoiceId: invoice._id, type: 'room' }, { $set: { quantity: reservation.nights, unitPrice: roundMoney(priced.pricing.roomSubtotal / Math.max(1, reservation.nights)), amount: priced.pricing.roomSubtotal } }, { session });
    }
    const stay = await Stay.findOne({ reservationId: reservation._id, status: StayStatus.ACTIVE }).session(session ?? null);
    if (stay) {
      stay.expectedCheckOut = input.newCheckOut;
      await stay.save({ session });
    }
    return reservation;
  });
  await updateRoomAvailability(updated.roomId.toString(), input.hotelId);
  emitHotelEvent(input.hotelId, 'reservation.extended', { reservationId: updated._id, checkOut: updated.checkOut });
  await writeAuditLog({ hotelId: input.hotelId, userId: input.userId, action: 'reservation.extended', entity: 'Reservation', entityId: updated._id.toString(), oldValue: { checkOut: oldCheckOut }, newValue: { checkOut: updated.checkOut }, request: input.request });
  return updated;
}

export async function changeRoom(input: { reservationId: string; hotelId: string; newRoomId: string; userId?: string; request?: any }) {
  const reservation = await Reservation.findOne({ _id: input.reservationId, hotelId: input.hotelId });
  if (!reservation) throw new AppError('Reservation not found', 404, 'RESERVATION_NOT_FOUND');
  if (![ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN].includes(reservation.status)) throw new AppError('Reservation cannot change rooms in its current status', 400, 'INVALID_STATUS_TRANSITION');
  if (reservation.roomId.toString() === input.newRoomId) return reservation;
  const updated = await withReservationTransaction(async (session) => {
    const newRoom = await claimRoomInterval({ roomId: input.newRoomId, hotelId: input.hotelId, reservationId: reservation._id, checkIn: reservation.checkIn, checkOut: reservation.checkOut, session });
    const newRoomType = newRoom.roomTypeId as any;
    await Room.updateOne({ _id: reservation.roomId, hotelId: input.hotelId }, { $pull: { reservedIntervals: { reservationId: reservation._id } } }, { session });
    const oldRoomId = reservation.roomId;
    reservation.roomId = newRoom._id;
    reservation.roomTypeId = newRoomType._id;
    const priced = await calculateAuthoritativePrice({ hotelId: input.hotelId, roomTypeId: newRoomType._id.toString(), checkIn: reservation.checkIn, checkOut: reservation.checkOut, services: reservation.services.map((service) => ({ code: service.code, quantity: service.quantity, notes: service.notes })) });
    reservation.pricing = priced.pricing;
    await reservation.save({ session });
    const stay = await Stay.findOne({ reservationId: reservation._id, status: StayStatus.ACTIVE }).session(session ?? null);
    if (stay) {
      stay.roomId = newRoom._id;
      await stay.save({ session });
    }
    const invoice = await Invoice.findOne({ reservationId: reservation._id }).session(session ?? null);
    if (invoice) {
      invoice.roomSubtotal = priced.pricing.roomSubtotal;
      invoice.servicesSubtotal = priced.pricing.servicesSubtotal;
      invoice.subtotal = priced.pricing.subtotal;
      invoice.tax = priced.pricing.tax;
      invoice.discount = priced.pricing.discount;
      invoice.total = priced.pricing.total;
      invoice.balance = Math.max(0, invoice.total - invoice.amountPaid);
      invoice.status = invoice.balance === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
      await invoice.save({ session });
      await InvoiceItem.updateOne({ invoiceId: invoice._id, type: 'room' }, { $set: { quantity: reservation.nights, unitPrice: roundMoney(priced.pricing.roomSubtotal / Math.max(1, reservation.nights)), amount: priced.pricing.roomSubtotal } }, { session });
    }
    await updateRoomAvailability(oldRoomId.toString(), input.hotelId);
    return reservation;
  });
  await updateRoomAvailability(updated.roomId.toString(), input.hotelId);
  emitHotelEvent(input.hotelId, 'room.changed', { reservationId: updated._id, roomId: updated.roomId });
  await writeAuditLog({ hotelId: input.hotelId, userId: input.userId, action: 'reservation.room_changed', entity: 'Reservation', entityId: updated._id.toString(), oldValue: { roomId: reservation.roomId }, newValue: { roomId: updated.roomId }, request: input.request });
  return updated;
}

export async function confirmRazorpayPayment(input: { hotelId: string; reservationId: string; paymentId: string; orderId: string; razorpayPaymentId: string; signature: string; request?: any }) {
  const { verifyRazorpaySignature } = await import('./paymentGatewayService.js');
  const valid = await verifyRazorpaySignature({ orderId: input.orderId, paymentId: input.razorpayPaymentId, signature: input.signature });
  if (!valid) throw new AppError('Payment signature could not be verified', 400, 'INVALID_PAYMENT_SIGNATURE');
  const payment = await Payment.findOneAndUpdate(
    { _id: input.paymentId, hotelId: input.hotelId, providerOrderId: input.orderId, status: PaymentStatus.PENDING },
    { $set: { status: PaymentStatus.PAID, providerPaymentId: input.razorpayPaymentId, paidAt: new Date() } },
    { new: true },
  );
  if (!payment) {
    const existing = await Payment.findOne({ _id: input.paymentId, hotelId: input.hotelId, providerOrderId: input.orderId, status: PaymentStatus.PAID });
    if (existing?.providerPaymentId === input.razorpayPaymentId) return existing;
    throw new AppError('Payment order not found', 404, 'PAYMENT_NOT_FOUND');
  }
  await Reservation.findOneAndUpdate({ _id: input.reservationId, hotelId: input.hotelId, status: ReservationStatus.PENDING }, { $set: { status: ReservationStatus.CONFIRMED, confirmedAt: new Date() }, $push: { statusHistory: { status: ReservationStatus.CONFIRMED, at: new Date(), note: 'Payment confirmed' } } });
  if (payment.invoiceId) await updateInvoicePayment(payment.invoiceId, payment.amount);
  emitHotelEvent(input.hotelId, 'payment.updated', { reservationId: input.reservationId, status: PaymentStatus.PAID });
  return payment;
}

export async function transitionReservationStatus(input: { reservationId: string; hotelId: string; nextStatus: ReservationStatus; userId?: string; note?: string; request?: any }) {
  const allowed: Record<ReservationStatus, ReservationStatus[]> = {
    [ReservationStatus.PENDING]: [ReservationStatus.CONFIRMED, ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW],
    [ReservationStatus.CONFIRMED]: [ReservationStatus.CHECKED_IN, ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW],
    [ReservationStatus.CHECKED_IN]: [ReservationStatus.CHECKED_OUT],
    [ReservationStatus.CHECKED_OUT]: [ReservationStatus.COMPLETED],
    [ReservationStatus.CANCELLED]: [],
    [ReservationStatus.NO_SHOW]: [],
    [ReservationStatus.COMPLETED]: [],
  };
  const reservation = await Reservation.findOne({ _id: input.reservationId, hotelId: input.hotelId });
  if (!reservation) throw new AppError('Reservation not found', 404, 'RESERVATION_NOT_FOUND');
  if (!allowed[reservation.status].includes(input.nextStatus)) throw new AppError('Invalid reservation status transition', 400, 'INVALID_STATUS_TRANSITION');
  const previous = reservation.status;
  reservation.status = input.nextStatus;
  if (input.nextStatus === ReservationStatus.CONFIRMED) reservation.confirmedAt = new Date();
  if (input.nextStatus === ReservationStatus.CHECKED_IN) reservation.checkedInAt = new Date();
  if (input.nextStatus === ReservationStatus.CHECKED_OUT) reservation.checkedOutAt = new Date();
  if (input.nextStatus === ReservationStatus.NO_SHOW) reservation.noShowAt = new Date();
  if (input.nextStatus === ReservationStatus.COMPLETED) reservation.completedAt = new Date();
  reservation.statusHistory.push({ status: input.nextStatus, at: new Date(), by: input.userId ? new Types.ObjectId(input.userId) : undefined, note: input.note });
  await reservation.save();
  if ([ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW, ReservationStatus.CHECKED_OUT, ReservationStatus.COMPLETED].includes(input.nextStatus)) {
    await Room.updateOne({ _id: reservation.roomId, hotelId: input.hotelId }, { $pull: { reservedIntervals: { reservationId: reservation._id } } });
  }
  emitHotelEvent(input.hotelId, 'reservation.status.updated', { reservationId: reservation._id, status: reservation.status });
  await writeAuditLog({ hotelId: input.hotelId, userId: input.userId, action: 'reservation.status_changed', entity: 'Reservation', entityId: reservation._id.toString(), oldValue: { status: previous }, newValue: { status: reservation.status }, request: input.request });
  return reservation;
}

export { updateRoomAvailability, withReservationTransaction, makeNumber };
