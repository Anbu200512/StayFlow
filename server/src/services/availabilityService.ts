import { Types } from 'mongoose';
import { Reservation, Room, RoomType, type RoomDocument, type RoomTypeDocument } from '../models/index.js';
import { ReservationStatus, RoomStatus } from '../types/enums.js';
import { AppError } from '../utils/error.js';
import { calculateNights, isValidDateRange } from '../utils/common.js';

export interface AvailabilityQuery {
  hotelId: string;
  checkIn: Date;
  checkOut: Date;
  adults?: number;
  children?: number;
  roomTypeId?: string;
}

export interface AvailableRoom {
  room: RoomDocument;
  roomType: RoomTypeDocument;
}

const blockedForBooking = [RoomStatus.OUT_OF_SERVICE, RoomStatus.MAINTENANCE, RoomStatus.DIRTY, RoomStatus.CLEANING];

export function validateStayDates(checkIn: Date, checkOut: Date): void {
  if (!isValidDateRange(checkIn, checkOut)) {
    throw new AppError('Check-out must be after check-in', 400, 'INVALID_DATE_RANGE');
  }
  if (checkIn < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
    throw new AppError('Check-in cannot be in the past', 400, 'PAST_CHECK_IN');
  }
  if (calculateNights(checkIn, checkOut) > 365) {
    throw new AppError('A reservation cannot exceed 365 nights', 400, 'STAY_TOO_LONG');
  }
}

function intervalOverlapQuery(checkIn: Date, checkOut: Date) {
  return {
    $nor: [
      {
        reservedIntervals: {
          $elemMatch: { checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } },
        },
      },
    ],
  };
}

export async function findAvailableRooms(query: AvailabilityQuery): Promise<AvailableRoom[]> {
  validateStayDates(query.checkIn, query.checkOut);
  const adults = query.adults ?? 1;
  const children = query.children ?? 0;
  const roomTypes = await RoomType.find({
    hotelId: query.hotelId,
    active: true,
    ...(query.roomTypeId ? { _id: query.roomTypeId } : {}),
    maxAdults: { $gte: adults },
    $expr: { $gte: [{ $add: ['$maxAdults', '$maxChildren'] }, adults + children] },
  }).lean();
  const roomTypeIds = roomTypes.map((roomType) => roomType._id);
  if (roomTypeIds.length === 0) return [];
  const rooms = await Room.find({
    hotelId: query.hotelId,
    roomTypeId: { $in: roomTypeIds },
    status: { $nin: blockedForBooking },
    ...intervalOverlapQuery(query.checkIn, query.checkOut),
  }).populate('roomTypeId').lean();
  const reservations = await Reservation.find({
    hotelId: query.hotelId,
    roomId: { $in: rooms.map((room) => room._id) },
    status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
    checkIn: { $lt: query.checkOut },
    checkOut: { $gt: query.checkIn },
  }).select('roomId').lean();
  const reservedRoomIds = new Set(reservations.map((reservation) => reservation.roomId.toString()));
  const typeMap = new Map(roomTypes.map((roomType) => [roomType._id.toString(), roomType]));
  return rooms
    .filter((room) => !reservedRoomIds.has(room._id.toString()))
    .map((room) => {
      const populatedRoomType = room.roomTypeId as unknown as RoomTypeDocument;
      const roomType = typeMap.get(populatedRoomType._id.toString()) ?? populatedRoomType;
      return { room: room as unknown as RoomDocument, roomType };
    });
}

export async function assertRoomAvailable(roomId: string, hotelId: string, checkIn: Date, checkOut: Date, session?: any): Promise<RoomDocument> {
  validateStayDates(checkIn, checkOut);
  const room = await Room.findOne({ _id: roomId, hotelId }, undefined, { session }).populate('roomTypeId');
  if (!room) throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
  if (blockedForBooking.includes(room.status)) {
    throw new AppError('Room is not available for booking', 409, 'ROOM_NOT_AVAILABLE');
  }
  const overlap = room.reservedIntervals.some((interval) => interval.checkIn < checkOut && interval.checkOut > checkIn);
  const reservationOverlap = await Reservation.exists({
    roomId,
    hotelId,
    status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  }).session(session ?? null);
  if (overlap || reservationOverlap) {
    throw new AppError('Room is no longer available', 409, 'ROOM_NOT_AVAILABLE');
  }
  return room;
}

export function hasIntervalOverlap(checkIn: Date, checkOut: Date, intervals: { checkIn: Date; checkOut: Date }[]): boolean {
  return intervals.some((interval) => interval.checkIn < checkOut && interval.checkOut > checkIn);
}

export function isValidObjectId(value: string): boolean {
  return Types.ObjectId.isValid(value);
}
