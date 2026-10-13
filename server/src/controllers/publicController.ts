import { Request, Response } from 'express';
import { z } from 'zod';
import { GalleryImage, Hotel, Offer, Room, RoomType, WebsiteContent } from '../models/index.js';
import { ReservationSource, PaymentMethod } from '../types/enums.js';
import { AppError } from '../utils/error.js';
import { sendEmail } from '../utils/email.js';
import { sendSuccess } from '../utils/response.js';
import { entityId } from '../utils/common.js';
import { findAvailableRooms } from '../services/availabilityService.js';
import { createReservation, getPublicReservation, confirmRazorpayPayment } from '../services/reservationService.js';
import { createBookingNotifications, createNotification } from '../services/notificationService.js';
import { createServiceRequest, getStayByQrToken } from '../services/stayService.js';
import { serviceCatalog, calculateAuthoritativePrice } from '../services/pricingService.js';
import { summarizeRoomRate } from '../services/rateService.js';

const dateRangeBody = z.object({ checkIn: z.coerce.date(), checkOut: z.coerce.date(), adults: z.coerce.number().int().min(1).default(1), children: z.coerce.number().int().min(0).default(0), roomTypeId: z.string().optional() });
const bookingBody = z.object({
  roomId: z.string().min(1),
  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),
  adults: z.coerce.number().int().min(1),
  children: z.coerce.number().int().min(0).default(0),
  guest: z.object({ fullName: z.string().min(2).max(120), mobile: z.string().min(7).max(20), email: z.string().email().optional(), address: z.string().max(300).optional(), nationality: z.string().max(80).optional(), idType: z.string().max(40).optional(), idNumber: z.string().max(80).optional(), privacyConsent: z.boolean().default(true), marketingConsent: z.boolean().default(false) }),
  services: z.array(z.object({ code: z.string(), quantity: z.coerce.number().int().min(1).max(20).default(1), notes: z.string().max(300).optional() })).max(10).default([]),
  offerCode: z.string().max(40).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  advanceAmount: z.coerce.number().min(0).optional(),
  specialRequests: z.string().max(1000).optional(),
});
const quoteBody = z.object({ roomId: z.string().min(1), checkIn: z.coerce.date(), checkOut: z.coerce.date(), adults: z.coerce.number().int().min(1), children: z.coerce.number().int().min(0).default(0), services: z.array(z.object({ code: z.string(), quantity: z.coerce.number().int().min(1).max(20).default(1), notes: z.string().max(300).optional() })).max(10).default([]), offerCode: z.string().max(40).optional() });
const paymentConfirmationBody = z.object({ reservationId: z.string().min(1), paymentId: z.string().min(1), orderId: z.string().min(1), razorpayPaymentId: z.string().min(1), signature: z.string().min(1) });
const lookupBody = z.object({ bookingNumber: z.string().min(4), emailOrMobile: z.string().min(3) });
const contactBody = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), phone: z.string().trim().max(30).optional(), message: z.string().trim().min(10).max(2000) });

function publicRoom(room: any) {
  return { _id: room._id, id: room._id, roomNumber: room.roomNumber, floor: room.floor, status: room.status, features: room.features, roomType: room.roomTypeId };
}

function routeToken(request: Request): string {
  const value = request.params.token;
  return Array.isArray(value) ? value[0] : value;
}

async function decorateAvailability(
  hotelId: string,
  items: { room: any; roomType: any }[],
  checkIn: Date,
  checkOut: Date,
) {
  const cache = new Map<string, Awaited<ReturnType<typeof summarizeRoomRate>>>();
  return Promise.all(items.map(async (item) => {
    const roomTypeId = item.roomType._id.toString();
    let nightlyRate = cache.get(roomTypeId);
    if (!nightlyRate) {
      nightlyRate = await summarizeRoomRate(hotelId, roomTypeId, item.roomType.basePrice, checkIn, checkOut);
      cache.set(roomTypeId, nightlyRate);
    }
    return { ...publicRoom(item.room), roomType: item.roomType, nightlyRate };
  }));
}

async function activeHotel() {
  const hotel = await Hotel.findOne({ active: true });
  if (!hotel) throw new AppError('Hotel is not configured', 503, 'HOTEL_NOT_CONFIGURED');
  return hotel;
}

export async function getPublicHotel(_request: Request, response: Response) {
  const hotel = await activeHotel();
  const [content, offers, gallery] = await Promise.all([
    WebsiteContent.findOne({ hotelId: hotel._id, published: true }).lean(),
    Offer.find({ hotelId: hotel._id, active: true, validFrom: { $lte: new Date() }, validTo: { $gte: new Date() } }).sort({ createdAt: -1 }).lean(),
    GalleryImage.find({ hotelId: hotel._id, active: true }).sort({ sortOrder: 1 }).lean(),
  ]);
  const roomTypes = await RoomType.find({ hotelId: hotel._id, active: true }).lean();
  const amenities = [...new Set(roomTypes.flatMap((roomType) => roomType.amenities))];
  sendSuccess(response, { hotel, content, offers, gallery, amenities, serviceCatalog: serviceCatalog.map(({ code, name, unitPrice }) => ({ code, name, unitPrice })) });
}

export async function getPublicRooms(request: Request, response: Response) {
  const hotel = await activeHotel();
  const checkInValue = request.query.checkIn ? z.coerce.date().parse(request.query.checkIn) : undefined;
  const checkOutValue = request.query.checkOut ? z.coerce.date().parse(request.query.checkOut) : undefined;
  if (checkInValue && checkOutValue) {
    const available = await findAvailableRooms({ hotelId: hotel._id.toString(), checkIn: checkInValue, checkOut: checkOutValue, adults: request.query.adults ? Number(request.query.adults) : 1, children: request.query.children ? Number(request.query.children) : 0, roomTypeId: typeof request.query.roomTypeId === 'string' ? request.query.roomTypeId : undefined });
    sendSuccess(response, await decorateAvailability(hotel._id.toString(), available, checkInValue, checkOutValue));
    return;
  }
  const rooms = await Room.find({ hotelId: hotel._id, status: { $nin: ['maintenance', 'out_of_service'] } }).populate('roomTypeId').sort({ roomNumber: 1 }).limit(100).lean();
  sendSuccess(response, rooms.map((room) => publicRoom(room)));
}

export async function getPublicRoom(request: Request, response: Response) {
  const hotel = await activeHotel();
  const room = await Room.findOne({ _id: request.params.id, hotelId: hotel._id, status: { $nin: ['maintenance', 'out_of_service'] } }).populate('roomTypeId').lean();
  if (!room) throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
  const payload: Record<string, any> = { ...publicRoom(room), roomType: room.roomTypeId };
  const checkInValue = request.query.checkIn ? z.coerce.date().parse(request.query.checkIn) : undefined;
  const checkOutValue = request.query.checkOut ? z.coerce.date().parse(request.query.checkOut) : undefined;
  if (checkInValue && checkOutValue && checkOutValue > checkInValue) {
    const roomType = room.roomTypeId as any;
    const roomTypeId = (roomType?._id ?? room.roomTypeId).toString();
    payload.nightlyRate = await summarizeRoomRate(hotel._id.toString(), roomTypeId, roomType?.basePrice ?? 0, checkInValue, checkOutValue);
  }
  sendSuccess(response, payload);
}

export async function checkPublicAvailability(request: Request, response: Response) {
  const hotel = await activeHotel();
  const input = dateRangeBody.parse(request.body);
  const rooms = await findAvailableRooms({ hotelId: hotel._id.toString(), ...input });
  sendSuccess(response, await decorateAvailability(hotel._id.toString(), rooms, input.checkIn, input.checkOut));
}

export async function getPublicOffers(_request: Request, response: Response) {
  const hotel = await activeHotel();
  const offers = await Offer.find({ hotelId: hotel._id, active: true, validFrom: { $lte: new Date() }, validTo: { $gte: new Date() } }).sort({ createdAt: -1 }).lean();
  sendSuccess(response, offers);
}

export async function getPublicFacilities(_request: Request, response: Response) {
  const hotel = await activeHotel();
  const roomTypes = await RoomType.find({ hotelId: hotel._id, active: true }).lean();
  const amenities = [...new Set(roomTypes.flatMap((roomType) => roomType.amenities))];
  const content = await WebsiteContent.findOne({ hotelId: hotel._id, published: true }).lean();
  sendSuccess(response, { amenities, about: content?.about, location: content?.location, contact: content?.contact ?? hotel.contact });
}

export async function getPublicGallery(_request: Request, response: Response) {
  const hotel = await activeHotel();
  const gallery = await GalleryImage.find({ hotelId: hotel._id, active: true }).sort({ sortOrder: 1 }).lean();
  sendSuccess(response, gallery);
}

export async function submitContactEnquiry(request: Request, response: Response) {
  const hotel = await activeHotel();
  const input = contactBody.parse(request.body);
  await createNotification({
    hotelId: hotel._id.toString(),
    type: 'website.contact',
    title: `Website enquiry from ${input.name}`,
    message: input.message,
    metadata: { name: input.name, email: input.email, phone: input.phone },
  });
  try {
    await sendEmail({
      to: hotel.contact.email,
      replyTo: input.email,
      subject: 'New StayFlow website enquiry',
      text: `Name: ${input.name}\nEmail: ${input.email}\nPhone: ${input.phone ?? 'Not provided'}\n\nMessage:\n${input.message}`,
    });
  } catch (error) {
    console.error('Website enquiry email delivery failed', error);
  }
  sendSuccess(response, { received: true }, 201, 'Your message has been received');
}

export async function getPublicQuote(request: Request, response: Response) {
  const hotel = await activeHotel();
  const input = quoteBody.parse(request.body);
  const room = await Room.findOne({ _id: input.roomId, hotelId: hotel._id, status: { $nin: ['maintenance', 'out_of_service'] } }).populate('roomTypeId').lean();
  if (!room) throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
  const available = await findAvailableRooms({ hotelId: hotel._id.toString(), checkIn: input.checkIn, checkOut: input.checkOut, adults: input.adults, children: input.children });
  if (!available.some((item) => item.room._id.toString() === room._id.toString())) throw new AppError('Room is no longer available for these dates', 409, 'ROOM_NOT_AVAILABLE');
  const quote = await calculateAuthoritativePrice({ hotelId: hotel._id.toString(), roomTypeId: room.roomTypeId._id.toString(), checkIn: input.checkIn, checkOut: input.checkOut, services: input.services, offerCode: input.offerCode });
  sendSuccess(response, { pricing: quote.pricing, services: quote.selectedServices, roomType: quote.roomType });
}

export async function createPublicBooking(request: Request, response: Response) {
  const hotel = await activeHotel();
  const input = bookingBody.parse(request.body);
  const result = await createReservation({ hotelId: hotel._id.toString(), ...input, source: ReservationSource.WEBSITE, request });
  const populated = await ReservationForResponse(result.reservation._id.toString());
  await createBookingNotifications({ hotelId: hotel._id.toString(), reservationId: result.reservation._id.toString(), bookingNumber: result.reservation.bookingNumber, guestId: result.guest._id.toString(), guestEmail: input.guest.email, checkIn: input.checkIn });
  sendSuccess(response, { reservation: populated, paymentId: result.payment?._id, paymentOrder: result.paymentOrder }, 201, 'Booking created successfully');
}

async function ReservationForResponse(id: string) {
  const { Reservation } = await import('../models/index.js');
  return Reservation.findById(id).populate('roomTypeId').select('bookingNumber status checkIn checkOut guests nights pricing services source roomTypeId guestSnapshot').lean();
}

export async function confirmPublicPayment(request: Request, response: Response) {
  const hotel = await activeHotel();
  const input = paymentConfirmationBody.parse(request.body);
  const payment = await confirmRazorpayPayment({ hotelId: hotel._id.toString(), ...input, request });
  sendSuccess(response, { paymentId: payment._id, status: payment.status });
}

export async function lookupPublicBooking(request: Request, response: Response) {
  const input = lookupBody.parse(request.body);
  const reservation = await getPublicReservation(input.bookingNumber, input.emailOrMobile);
  if (!reservation) throw new AppError('Booking could not be found', 404, 'BOOKING_NOT_FOUND');
  sendSuccess(response, reservation);
}

export async function getGuestPortal(request: Request, response: Response) {
  const stay = await getStayByQrToken(routeToken(request));
  if (!stay) throw new AppError('Guest portal link is invalid or expired', 404, 'INVALID_GUEST_SESSION');
  sendSuccess(response, {
    stay: { id: stay._id, checkInAt: stay.checkInAt, expectedCheckOut: stay.expectedCheckOut, status: stay.status },
    room: stay.roomId,
    guest: { name: (stay.guestId as any)?.fullName },
  });
}

export async function createGuestPortalServiceRequest(request: Request, response: Response) {
  const input = z.object({ category: z.string().min(2), description: z.string().min(3), priority: z.string().optional() }).parse(request.body);
  const stay = await getStayByQrToken(routeToken(request));
  if (!stay) throw new AppError('Guest portal link is invalid or expired', 404, 'INVALID_GUEST_SESSION');
  const result = await createServiceRequest({ hotelId: entityId(stay.hotelId), roomId: entityId(stay.roomId), stayId: entityId(stay._id), guestId: stay.guestId ? entityId(stay.guestId) : undefined, ...input, qrToken: routeToken(request) });
  sendSuccess(response, result, 201, 'Service request received');
}
