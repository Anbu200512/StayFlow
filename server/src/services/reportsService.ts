import { Types } from 'mongoose';
import { Expense, HousekeepingTask, Invoice, MaintenanceRequest, Order, Payment, Reservation, Room } from '../models/index.js';
import { InvoiceStatus, MaintenanceStatus, OrderStatus, PaymentStatus, ReservationStatus, RoomStatus, TaskStatus } from '../types/enums.js';
import { roundMoney } from '../utils/common.js';

function toObjectId(value: string) {
  return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value;
}

function dayRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function getDashboardOverview(hotelId: string) {
  const hotelObjectId = toObjectId(hotelId);
  const { start, end } = dayRange();
  const [revenue, roomCount, occupiedRooms, availableRooms, checkIns, checkOuts, pendingPayments, pendingHousekeeping, maintenanceIssues, sourceBreakdown, revenueTrend, occupancyTrend] = await Promise.all([
    Payment.aggregate([{ $match: { hotelId: hotelObjectId, status: PaymentStatus.PAID, paidAt: { $gte: start, $lt: end } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Room.countDocuments({ hotelId, status: { $ne: RoomStatus.OUT_OF_SERVICE } }),
    Room.countDocuments({ hotelId, status: 'occupied' }),
    Room.countDocuments({ hotelId, status: 'available' }),
    Reservation.countDocuments({ hotelId, checkIn: { $gte: start, $lt: end }, status: { $in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN, ReservationStatus.COMPLETED, ReservationStatus.CHECKED_OUT] } }),
    Reservation.countDocuments({ hotelId, checkOut: { $gte: start, $lt: end }, status: { $in: [ReservationStatus.CHECKED_IN, ReservationStatus.CHECKED_OUT, ReservationStatus.COMPLETED] } }),
    Invoice.aggregate([{ $match: { hotelId: hotelObjectId, balance: { $gt: 0 }, status: { $ne: InvoiceStatus.VOID } } }, { $group: { _id: null, total: { $sum: '$balance' }, count: { $sum: 1 } } }]),
    HousekeepingTask.countDocuments({ hotelId, status: { $nin: [TaskStatus.COMPLETED, TaskStatus.INSPECTED, TaskStatus.CANCELLED] } }),
    MaintenanceRequest.countDocuments({ hotelId, status: { $nin: [MaintenanceStatus.RESOLVED, MaintenanceStatus.CLOSED] } }),
    Reservation.aggregate([{ $match: { hotelId: hotelObjectId, createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } }, { $group: { _id: '$source', count: { $sum: 1 }, revenue: { $sum: '$pricing.total' } } }, { $project: { _id: 0, source: '$_id', count: 1, revenue: 1 } }]),
    Payment.aggregate([{ $match: { hotelId: hotelObjectId, status: PaymentStatus.PAID, paidAt: { $gte: new Date(Date.now() - 6 * 86400000) } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } }, revenue: { $sum: '$amount' } } }, { $sort: { _id: 1 } }, { $project: { _id: 0, date: '$_id', revenue: 1 } }]),
    Room.aggregate([{ $match: { hotelId: hotelObjectId } }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $project: { _id: 0, status: '$_id', count: 1 } }]),
  ]);
  const revenueValue = revenue[0]?.total ?? 0;
  const occupancy = roomCount ? Math.round((occupiedRooms / roomCount) * 1000) / 10 : 0;
  return {
    kpis: { todaysRevenue: revenueValue, occupancy, totalRooms: roomCount, availableRooms, occupiedRooms, todaysCheckIns: checkIns, todaysCheckOuts: checkOuts, pendingPayments: pendingPayments[0]?.total ?? 0, pendingPaymentsCount: pendingPayments[0]?.count ?? 0, pendingHousekeeping, maintenanceIssues },
    bookingSources: sourceBreakdown,
    revenueTrend,
    roomStatus: occupancyTrend,
    generatedAt: new Date().toISOString(),
  };
}

export async function getReports(hotelId: string, from: Date, to: Date) {
  const hotelObjectId = toObjectId(hotelId);
  const realizedReservationStatuses = [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN, ReservationStatus.CHECKED_OUT, ReservationStatus.COMPLETED];
  const [revenueByDay, expensesByDay, occupancy, sources, roomPerformance, roomMetrics, restaurantRevenue, paymentMethods] = await Promise.all([
    Payment.aggregate([{ $match: { hotelId: hotelObjectId, status: PaymentStatus.PAID, paidAt: { $gte: from, $lt: to } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } }, total: { $sum: '$amount' } } }, { $sort: { _id: 1 } }, { $project: { _id: 0, date: '$_id', revenue: '$total' } }]),
    Expense.aggregate([{ $match: { hotelId: hotelObjectId, date: { $gte: from, $lt: to } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$amount' } } }, { $sort: { _id: 1 } }, { $project: { _id: 0, date: '$_id', expenses: '$total' } }]),
    Room.aggregate([{ $match: { hotelId: hotelObjectId } }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $project: { _id: 0, status: '$_id', count: 1 } }]),
    Reservation.aggregate([{ $match: { hotelId: hotelObjectId, createdAt: { $gte: from, $lt: to } } }, { $group: { _id: '$source', count: { $sum: 1 }, revenue: { $sum: '$pricing.total' }, cancellations: { $sum: { $cond: [{ $eq: ['$status', ReservationStatus.CANCELLED] }, 1, 0] } } } }, { $project: { _id: 0, source: '$_id', count: 1, revenue: 1, cancellations: 1 } }]),
    Room.aggregate([
      { $match: { hotelId: hotelObjectId } },
      { $lookup: { from: 'reservations', localField: '_id', foreignField: 'roomId', as: 'reservations' } },
      { $unwind: { path: '$reservations', preserveNullAndEmptyArrays: true } },
      { $match: { $or: [{ reservations: null }, { 'reservations.hotelId': hotelObjectId, 'reservations.status': { $in: realizedReservationStatuses }, 'reservations.checkIn': { $lt: to }, 'reservations.checkOut': { $gt: from } }] } },
      { $group: { _id: '$_id', roomNumber: { $first: '$roomNumber' }, status: { $first: '$status' }, reservations: { $sum: { $cond: [{ $eq: ['$reservations', null] }, 0, 1] } }, revenue: { $sum: { $cond: [{ $eq: ['$reservations', null] }, 0, { $ifNull: ['$reservations.pricing.total', 0] }] } } } },
      { $project: { _id: 0, roomNumber: 1, status: 1, reservations: 1, revenue: 1 } },
      { $sort: { revenue: -1, roomNumber: 1 } },
      { $limit: 20 },
    ]),
    Reservation.aggregate([
      { $match: { hotelId: hotelObjectId, status: { $in: realizedReservationStatuses }, checkIn: { $lt: to }, checkOut: { $gt: from } } },
      { $group: { _id: null, roomRevenue: { $sum: { $ifNull: ['$pricing.roomSubtotal', 0] } }, soldRoomNights: { $sum: { $ifNull: ['$nights', 0] } } } },
    ]),
    Order.aggregate([
      { $match: { hotelId: hotelObjectId, status: { $nin: [OrderStatus.CANCELLED] }, placedAt: { $gte: from, $lt: to } } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    Payment.aggregate([{ $match: { hotelId: hotelObjectId, status: PaymentStatus.PAID, paidAt: { $gte: from, $lt: to } } }, { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } }, { $project: { _id: 0, method: '$_id', total: 1, count: 1 } }]),
  ]);
  const totalRooms = occupancy.filter((item) => item.status !== RoomStatus.OUT_OF_SERVICE).reduce((sum, item) => sum + item.count, 0);
  const occupied = occupancy.find((item) => item.status === 'occupied')?.count ?? 0;
  const reportDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000));
  const fallbackRoomRevenue = roomPerformance.reduce((sum, item) => sum + Number(item.revenue ?? 0), 0);
  const fallbackSoldRoomNights = roomPerformance.reduce((sum, item) => sum + Number(item.reservations ?? 0), 0);
  const roomRevenue = Math.max(0, Number(roomMetrics[0]?.roomRevenue ?? fallbackRoomRevenue));
  const soldRoomNights = Math.max(0, Number(roomMetrics[0]?.soldRoomNights ?? fallbackSoldRoomNights));
  const availableRoomNights = totalRooms * reportDays;
  const adr = soldRoomNights > 0 ? roundMoney(roomRevenue / soldRoomNights) : 0;
  const revpar = availableRoomNights > 0 ? roundMoney(roomRevenue / availableRoomNights) : 0;
  return { range: { from, to }, revenueByDay, expensesByDay, occupancy, sources, roomPerformance, restaurantRevenue: restaurantRevenue[0]?.total ?? 0, paymentMethods, metrics: { occupancy: totalRooms ? Math.round((occupied / totalRooms) * 1000) / 10 : 0, adr, revpar } };
}
