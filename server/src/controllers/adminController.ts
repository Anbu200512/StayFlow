import { Request, Response } from 'express';
import { z } from 'zod';
import {
  AuditLog,
  Expense,
  Guest,
  Hotel,
  HousekeepingTask,
  Invoice,
  InventoryItem,
  InvoiceItem,
  MaintenanceRequest,
  MenuCategory,
  MenuItem,
  Notification,
  Order,
  Payment,
  Reservation,
  Room,
  RoomType,
  ServiceRequest,
  Stay,
  User,
  WebsiteContent,
} from '../models/index.js';
import { MaintenanceStatus, OrderStatus, PaymentMethod, PaymentStatus, ReservationSource, ReservationStatus, RoomStatus, ServiceStatus, TaskStatus, UserRole } from '../types/enums.js';
import { AppError } from '../utils/error.js';
import { getPagination, objectIdSchema, paginationSchema } from '../utils/validation.js';
import { sendSuccess } from '../utils/response.js';
import { findAvailableRooms } from '../services/availabilityService.js';
import { cancelReservation, changeRoom, createReservation, extendReservation, getReservationById, transitionReservationStatus } from '../services/reservationService.js';
import { getDashboardOverview, getReports } from '../services/reportsService.js';
import { recordPayment } from '../services/invoiceService.js';
import { checkIn, checkout, createServiceRequest, getCheckoutSummary, updateServiceRequest } from '../services/stayService.js';
import { clearRoomRates, createRoomRate, deleteRoomRate, listRoomRates } from '../services/rateService.js';
import { createExpense, createHousekeepingTask, createMaintenanceRequest, createRestaurantOrder, listRestaurantMenu, updateHousekeepingTask, updateMaintenanceRequest, updateRestaurantOrder, adjustInventory } from '../services/operationsService.js';
import { uploadImage } from '../utils/cloudinary.js';
import { hashPassword } from '../utils/password.js';
import { emitHotelEvent } from '../services/socketService.js';
import { writeAuditLog } from '../middleware/audit.js';

const roomTypeBody = z.object({ name: z.string().min(2), slug: z.string().min(2).regex(/^[a-z0-9-]+$/), description: z.string().min(10), basePrice: z.coerce.number().positive(), maxAdults: z.coerce.number().int().min(1).default(2), maxChildren: z.coerce.number().int().min(0).default(2), maxOccupancy: z.coerce.number().int().min(1).default(4), bedConfiguration: z.string().min(2), sizeSqm: z.coerce.number().positive().optional(), amenities: z.array(z.string()).default([]), images: z.array(z.object({ publicId: z.string(), url: z.string().url(), alt: z.string().optional() })).default([]) });
const roomBody = z.object({ roomNumber: z.string().min(1), roomTypeId: objectIdSchema, floor: z.coerce.number().int().min(0), features: z.array(z.string()).default([]) });
const guestBody = z.object({ fullName: z.string().min(2), mobile: z.string().min(7), email: z.string().email().optional(), address: z.string().max(300).optional(), nationality: z.string().max(80).optional(), idType: z.string().max(40).optional(), idNumber: z.string().max(80).optional(), dateOfBirth: z.coerce.date().optional(), emergencyContact: z.object({ name: z.string().optional(), mobile: z.string().optional(), relationship: z.string().optional() }).optional(), notes: z.string().max(2000).optional(), privacyConsent: z.boolean().default(false), marketingConsent: z.boolean().default(false) });
const reservationBody = z.object({ roomId: objectIdSchema, checkIn: z.coerce.date(), checkOut: z.coerce.date(), adults: z.coerce.number().int().min(1), children: z.coerce.number().int().min(0).default(0), source: z.nativeEnum(ReservationSource), guest: guestBody, services: z.array(z.object({ code: z.string(), quantity: z.coerce.number().int().min(1).default(1), notes: z.string().optional() })).default([]), offerCode: z.string().optional(), paymentMethod: z.nativeEnum(PaymentMethod).optional(), advanceAmount: z.coerce.number().min(0).optional(), specialRequests: z.string().max(1000).optional(), notes: z.string().max(2000).optional() });
const availabilityBody = z.object({ checkIn: z.coerce.date(), checkOut: z.coerce.date(), adults: z.coerce.number().int().min(1).default(1), children: z.coerce.number().int().min(0).default(0), roomTypeId: objectIdSchema.optional() });
const serviceRequestBody = z.object({ roomId: objectIdSchema, category: z.string().min(2), description: z.string().min(3), stayId: objectIdSchema, guestId: objectIdSchema.optional(), priority: z.string().optional() });
const websiteContentBody = z.object({
  home: z.object({ eyebrow: z.string().max(120).optional(), title: z.string().max(200).optional(), subtitle: z.string().max(500).optional(), primaryCta: z.string().max(80).optional(), secondaryCta: z.string().max(80).optional() }).optional(),
  about: z.string().max(5000).optional(),
  whyChooseUs: z.array(z.object({ title: z.string().min(2).max(120), description: z.string().min(2).max(500), icon: z.string().max(40).optional() })).max(12).optional(),
  location: z.object({ label: z.string().max(120).optional(), address: z.string().max(500).optional(), mapUrl: z.string().url().optional() }).optional(),
  contact: z.object({ phone: z.string().min(7).max(30).optional(), email: z.string().email().optional(), website: z.string().url().optional() }).optional(),
  footerText: z.string().max(300).optional(),
  socialLinks: z.record(z.string().url()).optional(),
  published: z.boolean().optional(),
}).strict();

function hotelId(request: Request) {
  if (!request.user) throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
  return request.user.hotelId;
}
function userId(request: Request) {
  return request.user?.id;
}
function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function routeId(request: Request): string {
  const value = request.params.id;
  return Array.isArray(value) ? value[0] : value;
}

export async function getAdminHotel(request: Request, response: Response) {
  const hotel = await Hotel.findById(hotelId(request)).lean();
  if (!hotel) throw new AppError('Hotel not found', 404, 'HOTEL_NOT_FOUND');
  sendSuccess(response, hotel);
}

export async function dashboardOverview(request: Request, response: Response) {
  sendSuccess(response, await getDashboardOverview(hotelId(request)));
}

export async function listReservations(request: Request, response: Response) {
  const pagination = getPagination(paginationSchema.parse(request.query));
  const filter: Record<string, unknown> = { hotelId: hotelId(request) };
  if (typeof request.query.status === 'string') filter.status = request.query.status;
  if (typeof request.query.source === 'string') filter.source = request.query.source;
  if (typeof request.query.to === 'string') filter.checkIn = { $lt: new Date(request.query.to) };
  if (typeof request.query.from === 'string') filter.checkOut = { $gt: new Date(request.query.from) };
  if (typeof request.query.search === 'string' && request.query.search.trim()) {
    const search = new RegExp(escapeRegex(request.query.search.trim()), 'i');
    filter.$or = [{ bookingNumber: search }, { 'guestSnapshot.fullName': search }, { 'guestSnapshot.mobile': search }];
  }
  const [items, total] = await Promise.all([
    Reservation.find(filter).populate('roomId roomTypeId').sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    Reservation.countDocuments(filter),
  ]);
  sendSuccess(response, items, 200, undefined, { page: pagination.page, limit: pagination.limit, total, pages: Math.ceil(total / pagination.limit) });
}

export async function getReservation(request: Request, response: Response) {
  const reservation = await getReservationById(routeId(request), hotelId(request));
  if (!reservation) throw new AppError('Reservation not found', 404, 'RESERVATION_NOT_FOUND');
  sendSuccess(response, reservation);
}

export async function createAdminReservation(request: Request, response: Response) {
  const input = reservationBody.parse(request.body);
  const result = await createReservation({ ...input, hotelId: hotelId(request), createdBy: userId(request), request });
  sendSuccess(response, { reservationId: result.reservation._id, bookingNumber: result.reservation.bookingNumber, invoiceId: result.invoice._id, paymentId: result.payment?._id, status: result.reservation.status }, 201, 'Reservation created');
}

export async function cancelAdminReservation(request: Request, response: Response) {
  const input = z.object({ reason: z.string().max(500).optional() }).parse(request.body);
  const result = await cancelReservation({ reservationId: routeId(request), hotelId: hotelId(request), userId: userId(request), reason: input.reason, request });
  sendSuccess(response, result, 200, 'Reservation cancelled');
}

export async function extendAdminReservation(request: Request, response: Response) {
  const input = z.object({ newCheckOut: z.coerce.date() }).parse(request.body);
  const result = await extendReservation({ reservationId: routeId(request), hotelId: hotelId(request), newCheckOut: input.newCheckOut, userId: userId(request), request });
  sendSuccess(response, result, 200, 'Reservation extended');
}

export async function changeAdminRoom(request: Request, response: Response) {
  const input = z.object({ newRoomId: objectIdSchema }).parse(request.body);
  const result = await changeRoom({ reservationId: routeId(request), hotelId: hotelId(request), newRoomId: input.newRoomId, userId: userId(request), request });
  sendSuccess(response, result, 200, 'Room changed');
}

export async function changeReservationStatus(request: Request, response: Response) {
  const input = z.object({ status: z.nativeEnum(ReservationStatus), note: z.string().max(500).optional() }).parse(request.body);
  const result = await transitionReservationStatus({ reservationId: routeId(request), hotelId: hotelId(request), nextStatus: input.status, userId: userId(request), note: input.note, request });
  sendSuccess(response, result, 200, 'Reservation status updated');
}

export async function adminAvailability(request: Request, response: Response) {
  const input = availabilityBody.parse(request.body);
  const available = await findAvailableRooms({ hotelId: hotelId(request), ...input });
  sendSuccess(response, available.map(({ room, roomType }) => ({ _id: room._id, roomNumber: room.roomNumber, floor: room.floor, status: room.status, features: room.features, roomTypeId: roomType })));
}

export async function listRooms(request: Request, response: Response) {
  const filter: Record<string, unknown> = { hotelId: hotelId(request) };
  if (typeof request.query.status === 'string') filter.status = request.query.status;
  if (typeof request.query.roomTypeId === 'string') filter.roomTypeId = request.query.roomTypeId;
  if (typeof request.query.floor === 'string') filter.floor = Number(request.query.floor);
  const rooms = await Room.find(filter).populate('roomTypeId').sort({ floor: 1, roomNumber: 1 }).lean();
  sendSuccess(response, rooms.map((room) => ({ ...room, qrTokenHash: undefined })));
}

export async function createRoom(request: Request, response: Response) {
  const input = roomBody.parse(request.body);
  const roomType = await RoomType.findOne({ _id: input.roomTypeId, hotelId: hotelId(request) });
  if (!roomType) throw new AppError('Room type not found', 404, 'ROOM_TYPE_NOT_FOUND');
  const room = await Room.create({ ...input, hotelId: hotelId(request), status: RoomStatus.AVAILABLE, statusUpdatedAt: new Date() });
  await RoomType.updateOne({ _id: roomType._id }, { $inc: { totalRooms: 1 } });
  await writeAuditLog({ hotelId: hotelId(request), userId: userId(request), action: 'room.created', entity: 'Room', entityId: room._id.toString(), newValue: { roomNumber: room.roomNumber }, request });
  sendSuccess(response, room, 201, 'Room created');
}

export async function updateRoomStatus(request: Request, response: Response) {
  const input = z.object({ status: z.nativeEnum(RoomStatus), note: z.string().max(300).optional() }).parse(request.body);
  const room = await Room.findOneAndUpdate({ _id: routeId(request), hotelId: hotelId(request) }, { $set: { status: input.status, statusUpdatedAt: new Date(), statusNote: input.note } }, { new: true });
  if (!room) throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
  await writeAuditLog({ hotelId: hotelId(request), userId: userId(request), action: 'room.status_changed', entity: 'Room', entityId: room._id.toString(), newValue: { status: room.status }, request });
  emitHotelEvent(hotelId(request), 'room.status.updated', { roomId: room._id, roomNumber: room.roomNumber, status: room.status });
  sendSuccess(response, room, 200, 'Room status updated');
}

export async function listRoomTypes(request: Request, response: Response) {
  const roomTypes = await RoomType.find({ hotelId: hotelId(request), active: true }).sort({ name: 1 }).lean();
  sendSuccess(response, roomTypes);
}

export async function createRoomType(request: Request, response: Response) {
  const input = roomTypeBody.parse(request.body);
  const hotel = await Hotel.findById(hotelId(request)).select('currency').lean();
  const roomType = await RoomType.create({ ...input, hotelId: hotelId(request), currency: hotel?.currency ?? 'INR', totalRooms: 0, active: true });
  sendSuccess(response, roomType, 201, 'Room type created');
}

export async function updateRoomType(request: Request, response: Response) {
  const input = roomTypeBody.partial().parse(request.body);
  const roomType = await RoomType.findOneAndUpdate({ _id: routeId(request), hotelId: hotelId(request) }, { $set: input }, { new: true });
  if (!roomType) throw new AppError('Room type not found', 404, 'ROOM_TYPE_NOT_FOUND');
  sendSuccess(response, roomType, 200, 'Room type updated');
}

export async function listGuests(request: Request, response: Response) {
  const pagination = getPagination(paginationSchema.parse(request.query));
  const filter: Record<string, unknown> = { hotelId: hotelId(request) };
  if (typeof request.query.search === 'string' && request.query.search.trim()) {
    const search = new RegExp(escapeRegex(request.query.search.trim()), 'i');
    filter.$or = [{ fullName: search }, { mobile: search }, { email: search }];
  }
  const [guests, total] = await Promise.all([Guest.find(filter).sort({ updatedAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(), Guest.countDocuments(filter)]);
  sendSuccess(response, guests, 200, undefined, { page: pagination.page, limit: pagination.limit, total, pages: Math.ceil(total / pagination.limit) });
}

export async function getGuest(request: Request, response: Response) {
  const guest = await Guest.findOne({ _id: routeId(request), hotelId: hotelId(request) }).lean();
  if (!guest) throw new AppError('Guest not found', 404, 'GUEST_NOT_FOUND');
  const [reservations, stays, payments, invoices] = await Promise.all([
    Reservation.find({ guestId: guest._id, hotelId: hotelId(request) }).populate('roomId roomTypeId').sort({ createdAt: -1 }).lean(),
    Stay.find({ guestId: guest._id, hotelId: hotelId(request) }).populate('roomId').sort({ createdAt: -1 }).lean(),
    Payment.find({ guestId: guest._id, hotelId: hotelId(request) }).sort({ createdAt: -1 }).lean(),
    Invoice.find({ guestId: guest._id, hotelId: hotelId(request) }).sort({ createdAt: -1 }).lean(),
  ]);
  sendSuccess(response, { guest, reservations, stays, payments, invoices });
}

export async function createGuest(request: Request, response: Response) {
  const input = guestBody.parse(request.body);
  const guest = await Guest.create({ ...input, hotelId: hotelId(request) });
  sendSuccess(response, guest, 201, 'Guest created');
}

export async function updateGuest(request: Request, response: Response) {
  const input = guestBody.partial().parse(request.body);
  const guest = await Guest.findOneAndUpdate({ _id: routeId(request), hotelId: hotelId(request) }, { $set: input }, { new: true });
  if (!guest) throw new AppError('Guest not found', 404, 'GUEST_NOT_FOUND');
  sendSuccess(response, guest, 200, 'Guest updated');
}

export async function listStays(request: Request, response: Response) {
  const filter: Record<string, unknown> = { hotelId: hotelId(request) };
  if (typeof request.query.status === 'string') filter.status = request.query.status;
  const stays = await Stay.find(filter).populate('guestId roomId reservationId').sort({ createdAt: -1 }).limit(200).lean();
  sendSuccess(response, stays);
}

export async function checkInReservation(request: Request, response: Response) {
  const input = z.object({ reservationId: objectIdSchema, idVerified: z.boolean().default(true), idType: z.string().max(40).optional(), idNumber: z.string().max(80).optional(), idDocumentUrl: z.string().url().optional().or(z.literal('').transform(() => undefined)), paymentAmount: z.coerce.number().min(0).optional(), paymentMethod: z.nativeEnum(PaymentMethod).optional() }).parse(request.body);
  const result = await checkIn({ ...input, hotelId: hotelId(request), userId: userId(request)!, request });
  sendSuccess(response, { stayId: result.stay._id, reservationId: result.reservation._id, roomId: result.room._id, qrDataUrl: result.qrDataUrl }, 201, 'Guest checked in');
}

export async function checkoutStay(request: Request, response: Response) {
  const input = z.object({ stayId: objectIdSchema, paymentAmount: z.coerce.number().min(0).default(0), paymentMethod: z.nativeEnum(PaymentMethod).optional(), allowOutstanding: z.boolean().default(false) }).parse(request.body);
  const result = await checkout({ ...input, hotelId: hotelId(request), userId: userId(request)!, request });
  sendSuccess(response, { stayId: result.stay._id, reservationId: result.reservation._id, invoice: result.invoice }, 200, 'Guest checked out');
}

export async function getCheckoutSummaryHandler(request: Request, response: Response) {
  const summary = await getCheckoutSummary({ stayId: routeId(request), hotelId: hotelId(request) });
  sendSuccess(response, summary);
}

export async function listRates(request: Request, response: Response) {
  const roomTypeId = z.string().min(1).parse(request.query.roomTypeId);
  const rates = await listRoomRates(hotelId(request), roomTypeId);
  sendSuccess(response, rates);
}

export async function createRate(request: Request, response: Response) {
  const input = z.object({
    roomTypeId: objectIdSchema,
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    price: z.coerce.number().min(0),
    daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).optional(),
  }).parse(request.body);
  const roomType = await RoomType.findOne({ _id: input.roomTypeId, hotelId: hotelId(request), active: true });
  if (!roomType) throw new AppError('Room type not found', 404, 'ROOM_TYPE_NOT_FOUND');
  const rate = await createRoomRate({ ...input, hotelId: hotelId(request), price: input.price });
  sendSuccess(response, rate, 201, 'Rate saved');
}

export async function deleteRate(request: Request, response: Response) {
  const rate = await deleteRoomRate(hotelId(request), routeId(request));
  sendSuccess(response, { id: rate._id }, 200, 'Rate removed');
}

export async function clearRates(request: Request, response: Response) {
  const input = z.object({ roomTypeId: objectIdSchema, startDate: z.coerce.date(), endDate: z.coerce.date() }).parse(request.body);
  const result = await clearRoomRates(hotelId(request), input.roomTypeId, input.startDate, input.endDate);
  sendSuccess(response, { removed: result.deletedCount ?? 0 }, 200, 'Rates cleared');
}

export async function listPayments(request: Request, response: Response) {
  const filter: Record<string, unknown> = { hotelId: hotelId(request) };
  if (typeof request.query.status === 'string') filter.status = request.query.status;
  const payments = await Payment.find(filter).populate('guestId reservationId invoiceId recordedBy').sort({ createdAt: -1 }).limit(200).lean();
  sendSuccess(response, payments);
}

export async function createPayment(request: Request, response: Response) {
  const input = z.object({ invoiceId: objectIdSchema, amount: z.coerce.number().positive(), method: z.nativeEnum(PaymentMethod), notes: z.string().max(500).optional() }).parse(request.body);
  const invoice = await Invoice.findOne({ _id: input.invoiceId, hotelId: hotelId(request) });
  if (!invoice) throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
  if (input.amount > invoice.balance) throw new AppError('Payment exceeds outstanding balance', 400, 'PAYMENT_EXCEEDS_BALANCE');
  const payment = await recordPayment({ ...input, hotelId: hotelId(request), reservationId: invoice.reservationId, guestId: invoice.guestId, recordedBy: userId(request), status: PaymentStatus.PAID });
  emitHotelEvent(hotelId(request), 'payment.updated', { paymentId: payment._id, invoiceId: invoice._id, status: payment.status });
  sendSuccess(response, payment, 201, 'Payment recorded');
}

export async function listInvoices(request: Request, response: Response) {
  const invoices = await Invoice.find({ hotelId: hotelId(request) }).populate('guestId reservationId stayId').sort({ createdAt: -1 }).limit(200).lean();
  sendSuccess(response, invoices);
}

export async function getInvoice(request: Request, response: Response) {
  const invoice = await Invoice.findOne({ _id: routeId(request), hotelId: hotelId(request) }).populate('guestId reservationId stayId').lean();
  if (!invoice) throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
  const items = await InvoiceItem.find({ invoiceId: invoice._id }).lean();
  sendSuccess(response, { ...invoice, items });
}

export async function listHousekeeping(request: Request, response: Response) {
  const tasks = await HousekeepingTask.find({ hotelId: hotelId(request) }).populate('roomId assignedTo inspectedBy').sort({ createdAt: -1 }).limit(200).lean();
  sendSuccess(response, tasks);
}

export async function createHousekeeping(request: Request, response: Response) {
  const input = z.object({ roomId: objectIdSchema, type: z.string().min(2), priority: z.string().optional(), assignedTo: objectIdSchema.optional(), dueAt: z.coerce.date().optional(), notes: z.string().max(1000).optional() }).parse(request.body);
  const task = await createHousekeepingTask({ ...input, hotelId: hotelId(request), userId: userId(request) });
  sendSuccess(response, task, 201, 'Housekeeping task created');
}

export async function updateHousekeeping(request: Request, response: Response) {
  const input = z.object({ status: z.nativeEnum(TaskStatus), assignedTo: objectIdSchema.optional(), notes: z.string().max(1000).optional() }).parse(request.body);
  const task = await updateHousekeepingTask({ taskId: routeId(request), hotelId: hotelId(request), status: input.status, assignedTo: input.assignedTo, notes: input.notes, userId: userId(request) });
  sendSuccess(response, task, 200, 'Housekeeping task updated');
}

export async function listMaintenance(request: Request, response: Response) {
  const requests = await MaintenanceRequest.find({ hotelId: hotelId(request) }).populate('roomId assignedTo createdBy').sort({ createdAt: -1 }).limit(200).lean();
  sendSuccess(response, requests);
}

export async function createMaintenance(request: Request, response: Response) {
  const input = z.object({ roomId: objectIdSchema.optional(), issue: z.string().min(2), description: z.string().min(3), priority: z.string().optional(), assignedTo: objectIdSchema.optional() }).parse(request.body);
  const result = await createMaintenanceRequest({ ...input, hotelId: hotelId(request), userId: userId(request) });
  sendSuccess(response, result, 201, 'Maintenance request created');
}

export async function updateMaintenance(request: Request, response: Response) {
  const input = z.object({ status: z.nativeEnum(MaintenanceStatus), assignedTo: objectIdSchema.optional(), resolutionNotes: z.string().max(1000).optional() }).parse(request.body);
  const result = await updateMaintenanceRequest({ requestId: routeId(request), hotelId: hotelId(request), status: input.status, assignedTo: input.assignedTo, resolutionNotes: input.resolutionNotes, userId: userId(request) });
  sendSuccess(response, result, 200, 'Maintenance request updated');
}

export async function listServices(request: Request, response: Response) {
  const requests = await ServiceRequest.find({ hotelId: hotelId(request) }).populate('roomId guestId stayId assignedTo').sort({ createdAt: -1 }).limit(200).lean();
  sendSuccess(response, requests);
}

export async function createService(request: Request, response: Response) {
  const input = serviceRequestBody.parse(request.body);
  const result = await createServiceRequest({ ...input, hotelId: hotelId(request) });
  sendSuccess(response, result, 201, 'Service request created');
}

export async function updateService(request: Request, response: Response) {
  const input = z.object({ status: z.nativeEnum(ServiceStatus), assignedTo: objectIdSchema.optional(), chargeAmount: z.coerce.number().min(0).optional() }).parse(request.body);
  const result = await updateServiceRequest({ requestId: routeId(request), hotelId: hotelId(request), status: input.status, assignedTo: input.assignedTo, chargeAmount: input.chargeAmount, userId: userId(request) });
  sendSuccess(response, result, 200, 'Service request updated');
}

export async function restaurantMenu(request: Request, response: Response) {
  sendSuccess(response, await listRestaurantMenu(hotelId(request)));
}

export async function createMenuCategory(request: Request, response: Response) {
  const input = z.object({ name: z.string().min(2), description: z.string().optional(), sortOrder: z.coerce.number().int().default(0) }).parse(request.body);
  const category = await MenuCategory.create({ ...input, hotelId: hotelId(request), active: true });
  sendSuccess(response, category, 201, 'Menu category created');
}

export async function createMenuItem(request: Request, response: Response) {
  const input = z.object({ categoryId: objectIdSchema, name: z.string().min(2), description: z.string().optional(), price: z.coerce.number().positive(), taxRate: z.coerce.number().min(0).default(0), imageUrl: z.string().url().optional() }).parse(request.body);
  const item = await MenuItem.create({ ...input, hotelId: hotelId(request), available: true });
  sendSuccess(response, item, 201, 'Menu item created');
}

export async function createOrder(request: Request, response: Response) {
  const input = z.object({ type: z.enum(['room_service', 'restaurant']), roomId: objectIdSchema.optional(), stayId: objectIdSchema.optional(), guestId: objectIdSchema.optional(), tableId: objectIdSchema.optional(), items: z.array(z.object({ menuItemId: objectIdSchema, quantity: z.coerce.number().int().min(1), notes: z.string().max(300).optional() })).min(1), notes: z.string().max(500).optional() }).parse(request.body);
  const order = await createRestaurantOrder({ ...input, hotelId: hotelId(request), userId: userId(request) });
  sendSuccess(response, order, 201, 'Order created');
}

export async function listOrders(request: Request, response: Response) {
  const filter: Record<string, unknown> = { hotelId: hotelId(request) };
  if (typeof request.query.status === 'string') filter.status = request.query.status;
  const orders = await Order.find(filter).populate('roomId tableId stayId guestId').sort({ placedAt: -1 }).limit(200).lean();
  sendSuccess(response, orders);
}

export async function updateOrder(request: Request, response: Response) {
  const input = z.object({ status: z.nativeEnum(OrderStatus) }).parse(request.body);
  const order = await updateRestaurantOrder({ orderId: routeId(request), hotelId: hotelId(request), status: input.status, userId: userId(request) });
  sendSuccess(response, order, 200, 'Order updated');
}

export async function listInventory(request: Request, response: Response) {
  const items = await InventoryItem.find({ hotelId: hotelId(request), active: true }).sort({ category: 1, name: 1 }).lean();
  sendSuccess(response, items.map((item) => ({ ...item, lowStock: item.quantity <= item.minimumStock })));
}

export async function createInventoryItem(request: Request, response: Response) {
  const input = z.object({ name: z.string().min(2), sku: z.string().min(2), category: z.string().min(2), quantity: z.coerce.number().min(0), minimumStock: z.coerce.number().min(0), unit: z.string().min(1), purchasePrice: z.coerce.number().min(0), supplier: z.string().optional() }).parse(request.body);
  const item = await InventoryItem.create({ ...input, hotelId: hotelId(request), active: true });
  sendSuccess(response, item, 201, 'Inventory item created');
}

export async function adjustInventoryItem(request: Request, response: Response) {
  const input = z.object({ type: z.enum(['purchase', 'consumption', 'adjustment']), quantity: z.coerce.number(), unitCost: z.coerce.number().min(0).optional(), notes: z.string().max(500).optional() }).parse(request.body);
  const result = await adjustInventory({ ...input, hotelId: hotelId(request), itemId: routeId(request), userId: userId(request) });
  sendSuccess(response, result, 200, 'Inventory updated');
}

export async function listExpenses(request: Request, response: Response) {
  const expenses = await Expense.find({ hotelId: hotelId(request) }).sort({ date: -1 }).limit(200).lean();
  sendSuccess(response, expenses);
}

export async function createExpenseRecord(request: Request, response: Response) {
  const input = z.object({ category: z.string().min(2), amount: z.coerce.number().positive(), date: z.coerce.date(), paymentMethod: z.nativeEnum(PaymentMethod), description: z.string().min(2), receiptUrl: z.string().url().optional() }).parse(request.body);
  const expense = await createExpense({ ...input, hotelId: hotelId(request), userId: userId(request) });
  sendSuccess(response, expense, 201, 'Expense recorded');
}

export async function reports(request: Request, response: Response) {
  const to = typeof request.query.to === 'string' ? new Date(request.query.to) : new Date();
  const from = typeof request.query.from === 'string' ? new Date(request.query.from) : new Date(to.getTime() - 30 * 86400000);
  if (from >= to) throw new AppError('Report start must be before report end', 400, 'INVALID_DATE_RANGE');
  sendSuccess(response, await getReports(hotelId(request), from, to));
}

export async function getWebsiteContent(request: Request, response: Response) {
  let content = await WebsiteContent.findOne({ hotelId: hotelId(request) }).lean();
  if (!content) {
    const hotel = await Hotel.findById(hotelId(request)).lean();
    const address = hotel ? [hotel.address.line1, hotel.address.line2, hotel.address.city, hotel.address.state, hotel.address.postalCode, hotel.address.country].filter(Boolean).join(', ') : undefined;
    content = await WebsiteContent.create({ hotelId: hotelId(request), home: { title: hotel?.name, subtitle: hotel?.description }, contact: hotel?.contact, location: { label: hotel?.name, address }, published: false }).then((item) => item.toObject());
  }
  sendSuccess(response, content);
}

export async function updateWebsiteContent(request: Request, response: Response) {
  const input = websiteContentBody.parse(request.body);
  const updates: Record<string, unknown> = { ...input };
  if (input.contact) {
    delete updates.contact;
    for (const [field, value] of Object.entries(input.contact)) {
      if (value !== undefined) updates[`contact.${field}`] = value;
    }
  }
  const content = await WebsiteContent.findOneAndUpdate({ hotelId: hotelId(request) }, { $set: updates }, { new: true, upsert: true, setDefaultsOnInsert: true });
  await writeAuditLog({ hotelId: hotelId(request), userId: userId(request), action: 'website.content_updated', entity: 'WebsiteContent', entityId: content._id.toString(), newValue: input, request });
  sendSuccess(response, content, 200, 'Website content updated');
}

export async function listNotifications(request: Request, response: Response) {
  const notifications = await Notification.find({ hotelId: hotelId(request) }).sort({ createdAt: -1 }).limit(100).lean();
  sendSuccess(response, notifications);
}

export async function markNotificationRead(request: Request, response: Response) {
  const notification = await Notification.findOneAndUpdate({ _id: routeId(request), hotelId: hotelId(request) }, { $set: { status: 'read', readAt: new Date() } }, { new: true });
  if (!notification) throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
  sendSuccess(response, notification, 200, 'Notification marked read');
}

export async function listStaff(request: Request, response: Response) {
  const users = await User.find({ hotelId: hotelId(request) }).select('name email role phone active lastLoginAt createdAt').sort({ name: 1 }).lean();
  sendSuccess(response, users);
}

export async function createStaff(request: Request, response: Response) {
  const input = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), role: z.nativeEnum(UserRole), phone: z.string().optional() }).parse(request.body);
  const user = await User.create({ name: input.name, email: input.email.toLowerCase(), passwordHash: await hashPassword(input.password), role: input.role, phone: input.phone, hotelId: hotelId(request), active: true, refreshTokens: [] });
  await writeAuditLog({ hotelId: hotelId(request), userId: userId(request), action: 'staff.created', entity: 'User', entityId: user._id.toString(), newValue: { email: user.email, role: user.role }, request });
  sendSuccess(response, { id: user._id, name: user.name, email: user.email, role: user.role }, 201, 'Staff account created');
}

export async function globalSearch(request: Request, response: Response) {
  const search = typeof request.query.q === 'string' ? request.query.q.trim() : '';
  if (search.length < 2) return sendSuccess(response, []);
  const expression = new RegExp(escapeRegex(search), 'i');
  const [guests, reservations, rooms, invoices] = await Promise.all([
    Guest.find({ hotelId: hotelId(request), $or: [{ fullName: expression }, { mobile: expression }, { email: expression }] }).select('fullName mobile email').limit(10).lean(),
    Reservation.find({ hotelId: hotelId(request), $or: [{ bookingNumber: expression }, { 'guestSnapshot.fullName': expression }, { 'guestSnapshot.mobile': expression }] }).populate('roomId').select('bookingNumber guestSnapshot checkIn checkOut status roomId').limit(10).lean(),
    Room.find({ hotelId: hotelId(request), roomNumber: expression }).populate('roomTypeId').select('roomNumber status roomTypeId').limit(10).lean(),
    Invoice.find({ hotelId: hotelId(request), invoiceNumber: expression }).populate('guestId').select('invoiceNumber total balance status guestId').limit(10).lean(),
  ]);
  sendSuccess(response, { guests, reservations, rooms, invoices });
}

export async function listAuditLogs(request: Request, response: Response) {
  const logs = await AuditLog.find({ hotelId: hotelId(request) }).populate('userId').sort({ createdAt: -1 }).limit(200).lean();
  sendSuccess(response, logs);
}

export async function upload(request: Request, response: Response) {
  const file = request.file;
  if (!file) throw new AppError('Image file is required', 400, 'FILE_REQUIRED');
  if (!file.mimetype.startsWith('image/')) throw new AppError('Only image files are supported', 400, 'INVALID_FILE_TYPE');
  const result = await uploadImage(file.buffer, `stayflow/${hotelId(request)}`);
  sendSuccess(response, result, 201, 'Image uploaded');
}
