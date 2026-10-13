import { createHmac } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('./paymentGatewayService.js', () => ({
  createRazorpayOrder: vi.fn(async () => ({ id: 'order_test' })),
  verifyRazorpaySignature: vi.fn(async () => true),
}));

const replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = replicaSet.getUri('stayflow-test');
process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-sixteen';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-sixteen';
process.env.RAZORPAY_KEY_ID = 'test_key';
process.env.RAZORPAY_KEY_SECRET = 'test_razorpay_secret';

const { connectDatabase, disconnectDatabase } = await import('../config/db.js');
const { Hotel, Guest, InventoryItem, InventoryTransaction, Invoice, InvoiceItem, Offer, Order, Payment, Reservation, Room, RoomRate, RoomType, ServiceRequest, Stay } = await import('../models/index.js');
const { OrderStatus, PaymentMethod, PaymentStatus, ReservationSource, ReservationStatus, RoomStatus, StayStatus } = await import('../types/enums.js');
const { createOpaqueToken, hashToken } = await import('../utils/token.js');
const { getGuestPortal, createGuestPortalServiceRequest } = await import('../controllers/publicController.js');
const { hasIntervalOverlap, validateStayDates, findAvailableRooms } = await import('./availabilityService.js');
const { calculateAuthoritativePrice } = await import('./pricingService.js');
const { createInvoiceForReservation, recordPayment } = await import('./invoiceService.js');
const { confirmRazorpayPayment, createReservation } = await import('./reservationService.js');
const { checkIn, checkout, getCheckoutSummary } = await import('./stayService.js');
const { createRoomRate, deleteRoomRate, summarizeRoomRate } = await import('./rateService.js');
const { adjustInventory } = await import('./operationsService.js');
const { getReports } = await import('./reportsService.js');

let fixtureNumber = 0;

function atUtcDate(daysFromNow: number) {
  const value = new Date();
  value.setUTCHours(14, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + daysFromNow);
  return value;
}

async function createFixture() {
  fixtureNumber += 1;
  const hotel = await Hotel.create({
    name: `Test Hotel ${fixtureNumber}`,
    slug: `test-hotel-${fixtureNumber}`,
    contact: { phone: '+919876500000', email: `hotel${fixtureNumber}@example.com` },
    address: { line1: '1 Test Street', city: 'Bengaluru', country: 'India' },
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    taxRate: 10,
    active: true,
  });
  const roomType = await RoomType.create({
    hotelId: hotel._id,
    name: 'Test King',
    slug: `test-king-${fixtureNumber}`,
    description: 'A test room with a reliable bed and workspace.',
    basePrice: 5000,
    currency: 'INR',
    maxAdults: 2,
    maxChildren: 1,
    maxOccupancy: 3,
    bedConfiguration: '1 king bed',
    amenities: ['King bed'],
    images: [],
    totalRooms: 1,
    active: true,
  });
  const room = await Room.create({
    hotelId: hotel._id,
    roomTypeId: roomType._id,
    roomNumber: `${100 + fixtureNumber}`,
    floor: 1,
    status: RoomStatus.AVAILABLE,
    statusUpdatedAt: new Date(),
    features: ['King bed'],
    reservedIntervals: [],
  });
  return { hotel, roomType, room };
}

function reservationInput(fixture: Awaited<ReturnType<typeof createFixture>>, guestNumber: number, paymentMethod = PaymentMethod.CASH) {
  return {
    hotelId: fixture.hotel._id.toString(),
    roomId: fixture.room._id.toString(),
    checkIn: atUtcDate(20),
    checkOut: atUtcDate(22),
    adults: 2,
    children: 0,
    source: guestNumber % 2 === 0 ? ReservationSource.WEBSITE : ReservationSource.PHONE,
    guest: { fullName: `Test Guest ${guestNumber}`, mobile: `9198765000${guestNumber}`.slice(0, 11), email: `guest${guestNumber}@example.com`, privacyConsent: true },
    paymentMethod,
  };
}

beforeAll(async () => {
  await connectDatabase();
  await Promise.all([Hotel.init(), RoomType.init(), Room.init(), RoomRate.init(), Offer.init(), Reservation.init(), Guest.init(), Stay.init(), ServiceRequest.init(), Invoice.init(), InvoiceItem.init(), Payment.init(), InventoryItem.init(), InventoryTransaction.init(), Order.init()]);
}, 180_000);

afterEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await disconnectDatabase();
  await replicaSet.stop();
});

describe('availability rules', () => {
  it('uses half-open stay intervals so adjacent bookings do not overlap', () => {
    const checkIn = atUtcDate(30);
    const checkOut = atUtcDate(32);
    expect(hasIntervalOverlap(checkOut, atUtcDate(34), [{ checkIn, checkOut }])).toBe(false);
    expect(hasIntervalOverlap(atUtcDate(31), atUtcDate(33), [{ checkIn, checkOut }])).toBe(true);
  });

  it('rejects invalid, past, and excessively long stays', () => {
    expect(() => validateStayDates(atUtcDate(2), atUtcDate(2))).toThrowError(/after check-in/i);
    expect(() => validateStayDates(atUtcDate(-2), atUtcDate(2))).toThrowError(/past/i);
    expect(() => validateStayDates(atUtcDate(1), atUtcDate(368))).toThrowError(/365 nights/i);
  });

  it('returns a room for an adjacent date range and excludes an overlapping range', async () => {
    const fixture = await createFixture();
    await createReservation(reservationInput(fixture, 1));
    const adjacent = await findAvailableRooms({ hotelId: fixture.hotel._id.toString(), checkIn: atUtcDate(22), checkOut: atUtcDate(24), adults: 2 });
    const overlapping = await findAvailableRooms({ hotelId: fixture.hotel._id.toString(), checkIn: atUtcDate(21), checkOut: atUtcDate(23), adults: 2 });
    expect(adjacent.some(({ room }) => room._id.toString() === fixture.room._id.toString())).toBe(true);
    expect(overlapping.some(({ room }) => room._id.toString() === fixture.room._id.toString())).toBe(false);
  });
});

describe('authoritative pricing', () => {
  it('calculates room, service, discount, and tax values on the server', async () => {
    const fixture = await createFixture();
    const checkIn = atUtcDate(20);
    const checkOut = atUtcDate(22);
    await Offer.create({ hotelId: fixture.hotel._id, title: 'Direct saving', description: 'A fixed direct-booking saving.', code: 'DIRECT500', discountType: 'fixed', discountValue: 500, minNights: 1, validFrom: atUtcDate(1), validTo: atUtcDate(40), active: true });
    const result = await calculateAuthoritativePrice({ hotelId: fixture.hotel._id.toString(), roomTypeId: fixture.roomType._id.toString(), checkIn, checkOut, services: [{ code: 'breakfast', quantity: 2 }], offerCode: 'DIRECT500' });
    expect(result.pricing).toMatchObject({ roomSubtotal: 10000, servicesSubtotal: 900, discount: 500, subtotal: 10400, tax: 1040, total: 11440, currency: 'INR' });
  });

  it('rejects services outside the server catalog', async () => {
    const fixture = await createFixture();
    await expect(calculateAuthoritativePrice({ hotelId: fixture.hotel._id.toString(), roomTypeId: fixture.roomType._id.toString(), checkIn: atUtcDate(20), checkOut: atUtcDate(22), services: [{ code: 'invented_service' }] })).rejects.toMatchObject({ code: 'INVALID_SERVICE' });
  });
});

describe('dated room rates', () => {
  it('prices each night from dated overrides and falls back to the base rate otherwise', async () => {
    const fixture = await createFixture();
    const checkIn = atUtcDate(24);
    const checkOut = atUtcDate(27);
    const hotelId = fixture.hotel._id.toString();
    const roomTypeId = fixture.roomType._id.toString();
    await createRoomRate({ hotelId, roomTypeId, startDate: checkIn, endDate: checkIn, price: 8000 });
    const result = await calculateAuthoritativePrice({ hotelId, roomTypeId, checkIn, checkOut });
    expect(result.pricing.roomSubtotal).toBe(8000 + 5000 + 5000);
    expect(await RoomRate.countDocuments({ hotelId: fixture.hotel._id })).toBe(1);
  });

  it('applies one price for every night inside a date range', async () => {
    const fixture = await createFixture();
    const checkIn = atUtcDate(24);
    const checkOut = atUtcDate(26);
    const hotelId = fixture.hotel._id.toString();
    const roomTypeId = fixture.roomType._id.toString();
    await createRoomRate({ hotelId, roomTypeId, startDate: checkIn, endDate: atUtcDate(25), price: 6000 });
    const result = await calculateAuthoritativePrice({ hotelId, roomTypeId, checkIn, checkOut });
    expect(result.pricing.roomSubtotal).toBe(12000);
  });

  it('honours weekday-only rates within a range', async () => {
    const fixture = await createFixture();
    const checkIn = atUtcDate(24);
    const checkOut = atUtcDate(26);
    const hotelId = fixture.hotel._id.toString();
    const roomTypeId = fixture.roomType._id.toString();
    await createRoomRate({ hotelId, roomTypeId, startDate: checkIn, endDate: atUtcDate(25), price: 7000, daysOfWeek: [checkIn.getDay()] });
    const matched = await calculateAuthoritativePrice({ hotelId, roomTypeId, checkIn, checkOut });
    const untouched = await calculateAuthoritativePrice({ hotelId, roomTypeId, checkIn: atUtcDate(40), checkOut: atUtcDate(42) });
    expect(matched.pricing.roomSubtotal).toBe(7000 + 5000);
    expect(untouched.pricing.roomSubtotal).toBe(10000);
  });

  it('removing a rate restores the base price', async () => {
    const fixture = await createFixture();
    const checkIn = atUtcDate(24);
    const checkOut = atUtcDate(25);
    const hotelId = fixture.hotel._id.toString();
    const roomTypeId = fixture.roomType._id.toString();
    const rate = await createRoomRate({ hotelId, roomTypeId, startDate: checkIn, endDate: checkIn, price: 9000 });
    expect((await calculateAuthoritativePrice({ hotelId, roomTypeId, checkIn, checkOut })).pricing.roomSubtotal).toBe(9000);
    await deleteRoomRate(hotelId, rate._id.toString());
    expect((await calculateAuthoritativePrice({ hotelId, roomTypeId, checkIn, checkOut })).pricing.roomSubtotal).toBe(5000);
  });

  it('summarises the nightly prices for the public rate display', async () => {
    const fixture = await createFixture();
    const checkIn = atUtcDate(24);
    const checkOut = atUtcDate(27);
    const hotelId = fixture.hotel._id.toString();
    const roomTypeId = fixture.roomType._id.toString();
    await createRoomRate({ hotelId, roomTypeId, startDate: checkIn, endDate: checkIn, price: 8000 });
    const summary = await summarizeRoomRate(hotelId, roomTypeId, fixture.roomType.basePrice, checkIn, checkOut);
    expect(summary).toMatchObject({ nights: 3, min: 5000, max: 8000 });
    expect(summary.total).toBe(18000);
  });
});

describe('invoice and payment integrity', () => {
  it('creates unique room and service items and applies partial payment once', async () => {
    const fixture = await createFixture();
    const reservationId = new mongoose.Types.ObjectId();
    const guestId = new mongoose.Types.ObjectId();
    const invoice = await createInvoiceForReservation({
      hotelId: fixture.hotel._id,
      reservationId,
      guestId,
      roomId: fixture.room._id,
      pricing: { roomSubtotal: 10000, servicesSubtotal: 900, subtotal: 10900, tax: 1090, discount: 0, total: 11990, currency: 'INR' },
      services: [{ code: 'breakfast', name: 'Breakfast', quantity: 2, unitPrice: 450, total: 900 }],
      checkIn: atUtcDate(20),
      checkOut: atUtcDate(22),
      invoiceNumber: 'INV-TEST-001',
    });
    expect((await InvoiceItem.find({ invoiceId: invoice._id }).lean()).map((item) => item.type).sort()).toEqual(['room', 'service']);
    expect(new Set(invoice.items.map(String)).size).toBe(2);
    await recordPayment({ hotelId: fixture.hotel._id, reservationId, guestId, invoiceId: invoice._id, amount: 4000, method: PaymentMethod.UPI });
    await recordPayment({ hotelId: fixture.hotel._id, reservationId, guestId, invoiceId: invoice._id, amount: 7990, method: PaymentMethod.CASH });
    const paidInvoice = await Invoice.findById(invoice._id);
    expect(paidInvoice?.amountPaid).toBe(11990);
    expect(paidInvoice?.balance).toBe(0);
    expect(paidInvoice?.status).toBe('paid');
    await expect(recordPayment({ hotelId: fixture.hotel._id, reservationId, guestId, invoiceId: invoice._id, amount: 1, method: PaymentMethod.CASH })).rejects.toMatchObject({ code: 'PAYMENT_EXCEEDS_BALANCE' });
    expect(await Payment.countDocuments({ invoiceId: invoice._id })).toBe(2);
  });

  it('handles simultaneous Razorpay confirmations idempotently', async () => {
    const fixture = await createFixture();
    const created = await createReservation({ ...reservationInput(fixture, 2, PaymentMethod.RAZORPAY) });
    const signature = createHmac('sha256', 'test_razorpay_secret').update('order_test|pay_test').digest('hex');
    const input = { hotelId: fixture.hotel._id.toString(), reservationId: created.reservation._id.toString(), paymentId: created.payment!._id.toString(), orderId: 'order_test', razorpayPaymentId: 'pay_test', signature };
    const confirmations = await Promise.all([confirmRazorpayPayment(input), confirmRazorpayPayment(input)]);
    expect(confirmations[0]._id.toString()).toBe(confirmations[1]._id.toString());
    const invoice = await Invoice.findById(created.invoice._id);
    expect(invoice?.amountPaid).toBe(created.invoice.total);
    expect(invoice?.balance).toBe(0);
    expect(await Payment.countDocuments({ _id: created.payment!._id })).toBe(1);
    expect((await Reservation.findById(created.reservation._id))?.status).toBe('confirmed');
    await expect(confirmRazorpayPayment({ ...input, razorpayPaymentId: 'pay_different' })).rejects.toMatchObject({ code: 'PAYMENT_NOT_FOUND' });
  });
});

describe('concurrent booking and stock writes', () => {
  it('allows only one reservation to claim the same room interval', async () => {
    const fixture = await createFixture();
    const attempts = await Promise.allSettled([createReservation(reservationInput(fixture, 3)), createReservation(reservationInput(fixture, 4))]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    const rejected = attempts.find((attempt) => attempt.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: 'ROOM_NOT_AVAILABLE' });
    expect(await Reservation.countDocuments({ roomId: fixture.room._id })).toBe(1);
    expect(await Invoice.countDocuments({ hotelId: fixture.hotel._id })).toBe(1);
    const room = await Room.findById(fixture.room._id);
    expect(room?.reservedIntervals).toHaveLength(1);
  });

  it('does not consume the same stock twice under concurrent requests', async () => {
    const fixture = await createFixture();
    const item = await InventoryItem.create({ hotelId: fixture.hotel._id, name: 'Test linen', sku: `TEST-${fixtureNumber}`, category: 'Linen', quantity: 10, minimumStock: 2, unit: 'pieces', purchasePrice: 10, active: true });
    const attempts = await Promise.allSettled([
      adjustInventory({ hotelId: fixture.hotel._id.toString(), itemId: item._id.toString(), type: 'consumption', quantity: 8 }),
      adjustInventory({ hotelId: fixture.hotel._id.toString(), itemId: item._id.toString(), type: 'consumption', quantity: 8 }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    expect((await InventoryItem.findById(item._id))?.quantity).toBe(2);
    expect(await InventoryTransaction.countDocuments({ itemId: item._id })).toBe(1);
  });

  it('lists a room again on the same day after an early checkout releases its interval', async () => {
    const fixture = await createFixture();
    const booking = await createReservation(reservationInput(fixture, 51));
    const userId = new mongoose.Types.ObjectId().toString();
    const hotelId = fixture.hotel._id.toString();
    const stayed = await checkIn({ reservationId: booking.reservation._id.toString(), hotelId, userId, idVerified: true, idType: 'passport', idNumber: 'P1234567' });
    const before = await findAvailableRooms({ hotelId, checkIn: booking.reservation.checkIn, checkOut: booking.reservation.checkOut, adults: 2 });
    expect(before.map((item) => item.room._id.toString())).not.toContain(fixture.room._id.toString());

    await checkout({ stayId: stayed.stay._id.toString(), hotelId, userId, allowOutstanding: true });
    await Room.updateOne({ _id: fixture.room._id }, { $set: { status: RoomStatus.AVAILABLE, statusUpdatedAt: new Date() } });

    const room = await Room.findById(fixture.room._id);
    expect(room?.reservedIntervals).toHaveLength(0);
    const after = await findAvailableRooms({ hotelId, checkIn: booking.reservation.checkIn, checkOut: booking.reservation.checkOut, adults: 2 });
    expect(after.map((item) => item.room._id.toString())).toContain(fixture.room._id.toString());
  });

  it('summarises the folio before checkout: advance paid, balance due and extra charges', async () => {
    const fixture = await createFixture();
    const booking = await createReservation(reservationInput(fixture, 52));
    const userId = new mongoose.Types.ObjectId().toString();
    const hotelId = fixture.hotel._id.toString();
    const invoice = await Invoice.findOne({ reservationId: booking.reservation._id }).lean();
    expect(invoice).not.toBeNull();
    await recordPayment({ hotelId, reservationId: booking.reservation._id, invoiceId: invoice!._id, amount: 2000, method: PaymentMethod.CASH, recordedBy: userId, status: PaymentStatus.PAID });
    const stayed = await checkIn({ reservationId: booking.reservation._id.toString(), hotelId, userId, idVerified: true, idType: 'passport', idNumber: 'P1234567' });
    await ServiceRequest.create({ hotelId: fixture.hotel._id, stayId: stayed.stay._id, reservationId: booking.reservation._id, roomId: fixture.room._id, guestId: booking.guest._id, category: 'concierge', description: 'Extra pillow and transfer', status: 'completed', chargeAmount: 500 });

    const summary = await getCheckoutSummary({ stayId: stayed.stay._id.toString(), hotelId });

    expect(summary.guest?.fullName).toBe(booking.guest.fullName);
    expect(summary.room.roomNumber).toBe(fixture.room.roomNumber);
    expect(summary.folio.amountPaid).toBe(2000);
    expect(summary.folio.balance).toBeGreaterThan(0);
    expect(summary.folio.balance).toBe(Math.max(0, summary.folio.total - summary.folio.amountPaid));
    expect(summary.extraCharges.some((charge) => charge.description === 'Extra pillow and transfer')).toBe(true);
  });

  it('refuses check-in unless a government ID is provided', async () => {
    const fixture = await createFixture();
    const booking = await createReservation(reservationInput(fixture, 53));
    const userId = new mongoose.Types.ObjectId().toString();
    const hotelId = fixture.hotel._id.toString();

    await expect(checkIn({ reservationId: booking.reservation._id.toString(), hotelId, userId, idVerified: true })).rejects.toMatchObject({ code: 'GOVERNMENT_ID_REQUIRED' });
    expect(await Reservation.findById(booking.reservation._id)).toMatchObject({ status: ReservationStatus.CONFIRMED });
  });
});

describe('reporting accuracy', () => {
  it('counts restaurant revenue once even when a stay settles across several payments', async () => {
    const fixture = await createFixture();
    const stayId = new mongoose.Types.ObjectId();
    const invoice = await createInvoiceForReservation({
      hotelId: fixture.hotel._id,
      reservationId: new mongoose.Types.ObjectId(),
      guestId: new mongoose.Types.ObjectId(),
      roomId: fixture.room._id,
      pricing: { roomSubtotal: 10000, servicesSubtotal: 0, subtotal: 10000, tax: 1000, discount: 0, total: 11000, currency: 'INR' },
      services: [],
      checkIn: atUtcDate(20),
      checkOut: atUtcDate(22),
      invoiceNumber: 'INV-TEST-REPORT',
    });
    await Order.create({
      hotelId: fixture.hotel._id,
      orderNumber: `ORD-TEST-${fixtureNumber}`,
      type: 'room_service',
      status: OrderStatus.DELIVERED,
      stayId,
      roomId: fixture.room._id,
      items: [{ menuItemId: new mongoose.Types.ObjectId(), name: 'Dinner', quantity: 1, unitPrice: 1200, taxRate: 10, amount: 1320 }],
      subtotal: 1200,
      tax: 120,
      total: 1320,
      placedAt: atUtcDate(1),
      deliveredAt: atUtcDate(1),
    });
    await recordPayment({ hotelId: fixture.hotel._id, stayId, invoiceId: invoice._id, amount: 5000, method: PaymentMethod.UPI, status: PaymentStatus.PARTIALLY_PAID });
    await recordPayment({ hotelId: fixture.hotel._id, stayId, invoiceId: invoice._id, amount: 6000, method: PaymentMethod.CASH });

    const report = await getReports(fixture.hotel._id.toString(), atUtcDate(-2), atUtcDate(2));
    expect(report.restaurantRevenue).toBe(1320);
  });

  it('excludes cancelled orders from restaurant revenue', async () => {
    const fixture = await createFixture();
    await Order.create({
      hotelId: fixture.hotel._id,
      orderNumber: `ORD-CANCELLED-${fixtureNumber}`,
      type: 'restaurant',
      status: OrderStatus.CANCELLED,
      items: [],
      subtotal: 800,
      tax: 80,
      total: 880,
      placedAt: atUtcDate(1),
    });
    const report = await getReports(fixture.hotel._id.toString(), atUtcDate(-2), atUtcDate(2));
    expect(report.restaurantRevenue).toBe(0);
  });

  it('records payments in the hotel currency rather than a hardcoded default', async () => {
    const fixture = await createFixture();
    await Hotel.updateOne({ _id: fixture.hotel._id }, { $set: { currency: 'AED' } });
    const payment = await recordPayment({ hotelId: fixture.hotel._id, reservationId: new mongoose.Types.ObjectId(), amount: 500, method: PaymentMethod.CARD });
    expect(payment.currency).toBe('AED');
  });
});

describe('guest portal service requests', () => {
  function captureResponse() {
    const captured: { statusCode?: number; body?: any } = {};
    const response: any = {
      status(code: number) {
        captured.statusCode = code;
        return response;
      },
      json(body: any) {
        captured.body = body;
        return response;
      },
    };
    return { response, captured };
  }

  async function checkedInStay(fixture: Awaited<ReturnType<typeof createFixture>>, guestNumber: number) {
    const booking = await createReservation(reservationInput(fixture, guestNumber));
    const token = createOpaqueToken(24);
    const [stay] = await Stay.create([{
      hotelId: fixture.hotel._id,
      reservationId: booking.reservation._id,
      guestId: booking.guest._id,
      roomId: fixture.room._id,
      checkInAt: new Date(),
      expectedCheckOut: booking.reservation.checkOut,
      status: StayStatus.ACTIVE,
      qrTokenHash: hashToken(token),
    }]);
    return { token, stay, guest: booking.guest };
  }

  it('serves the portal landing page from the scanned QR token', async () => {
    const fixture = await createFixture();
    const { token, guest } = await checkedInStay(fixture, 41);
    const { response, captured } = captureResponse();

    await getGuestPortal({ params: { token } } as any, response);

    expect(captured.statusCode).toBe(200);
    expect(captured.body.success).toBe(true);
    expect(captured.body.data.room.roomNumber).toBe(fixture.room.roomNumber);
    expect(captured.body.data.guest.name).toBe(guest.fullName);
  });

  it('stores valid references when a guest sends a request from the portal', async () => {
    const fixture = await createFixture();
    const { token, stay, guest } = await checkedInStay(fixture, 42);
    const { response, captured } = captureResponse();

    await createGuestPortalServiceRequest({ params: { token }, body: { category: 'room_service', description: 'I would like to have a cup of coffee' } } as any, response);

    expect(captured.statusCode).toBe(201);
    expect(captured.body.success).toBe(true);
    const stored = await ServiceRequest.findOne({ hotelId: fixture.hotel._id }).lean();
    expect(stored).not.toBeNull();
    expect(String(stored!.roomId)).toBe(fixture.room._id.toString());
    expect(String(stored!.guestId)).toBe(guest._id.toString());
    expect(String(stored!.stayId)).toBe(stay._id.toString());
    expect(String(stored!.roomId)).not.toBe('[object Object]');
  });

  it('rejects an expired QR token instead of creating an orphaned request', async () => {
    const fixture = await createFixture();
    const { response, captured } = captureResponse();

    await expect(createGuestPortalServiceRequest({ params: { token: createOpaqueToken(24) }, body: { category: 'housekeeping', description: 'Fresh towels' } } as any, response)).rejects.toMatchObject({ statusCode: 404 });
    expect(captured.statusCode).toBeUndefined();
    expect(await ServiceRequest.countDocuments({ hotelId: fixture.hotel._id })).toBe(0);
  });
});
