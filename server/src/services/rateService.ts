import { RoomRate } from '../models/index.js';
import { AppError } from '../utils/error.js';
import { roundMoney } from '../utils/common.js';

export function dateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function startOfDay(value: Date): Date {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addDaysLocal(value: Date, amount: number): Date {
  const result = new Date(value);
  result.setDate(result.getDate() + amount);
  return result;
}

export function eachCalendarDay(checkIn: Date, checkOut: Date): Date[] {
  const days: Date[] = [];
  const end = startOfDay(checkOut);
  for (let day = startOfDay(checkIn); day.getTime() < end.getTime(); day = addDaysLocal(day, 1)) days.push(day);
  return days;
}

function recordAppliesOn(record: { startDate: Date; endDate: Date; daysOfWeek?: number[] }, day: Date): boolean {
  const dayIndex = dateKey(day);
  if (dayIndex < dateKey(record.startDate) || dayIndex > dateKey(record.endDate)) return false;
  if (record.daysOfWeek?.length && !record.daysOfWeek.includes(day.getDay())) return false;
  return true;
}

// Most specific rule wins: exact single-day beats a range; a weekday rule beats an
// every-day rule of the same span; otherwise the most recently created rule wins.
function pickBestRule<T extends { startDate: Date; endDate: Date; daysOfWeek?: number[]; createdAt?: Date }>(candidates: T[], day: Date): T | undefined {
  const dayIndex = Number(dateKey(day).replaceAll('-', ''));
  return candidates
    .filter((record) => recordAppliesOn(record, day))
    .sort((a, b) => {
      const aSpan = Number(dateKey(a.endDate).replaceAll('-', '')) - Number(dateKey(a.startDate).replaceAll('-', '')) + (a.daysOfWeek?.length ? -1 : 0) + (dayIndex === Number(dateKey(a.endDate).replaceAll('-', '')) && dateKey(a.startDate) === dateKey(a.endDate) ? -1000 : 0);
      const bSpan = Number(dateKey(b.endDate).replaceAll('-', '')) - Number(dateKey(b.startDate).replaceAll('-', '')) + (b.daysOfWeek?.length ? -1 : 0) + (dayIndex === Number(dateKey(b.endDate).replaceAll('-', '')) && dateKey(b.startDate) === dateKey(b.endDate) ? -1000 : 0);
      return aSpan - bSpan;
    })[0];
}

export async function resolveNightlyRate(hotelId: string, roomTypeId: string, day: Date): Promise<number | null> {
  const candidates = await RoomRate.find({ hotelId, roomTypeId, startDate: { $lte: day }, endDate: { $gte: day } }).sort({ createdAt: -1 }).lean();
  const best = pickBestRule(candidates, day);
  return best ? roundMoney(best.price) : null;
}

export interface RangeRateSummary {
  nights: number;
  total: number;
  min: number;
  max: number;
  average: number;
}

export async function summarizeRoomRate(hotelId: string, roomTypeId: string, basePrice: number, checkIn: Date, checkOut: Date): Promise<RangeRateSummary> {
  const days = eachCalendarDay(checkIn, checkOut);
  if (days.length === 0) return { nights: 0, total: 0, min: basePrice, max: basePrice, average: basePrice };
  const records = await RoomRate.find({ hotelId, roomTypeId, startDate: { $lte: days[days.length - 1] }, endDate: { $gte: days[0] } }).sort({ createdAt: -1 }).lean();
  const nightly = days.map((day) => {
    const best = pickBestRule(records, day);
    return best ? roundMoney(best.price) : basePrice;
  });
  const total = roundMoney(nightly.reduce((sum, value) => sum + value, 0));
  return { nights: nightly.length, total, min: Math.min(...nightly), max: Math.max(...nightly), average: roundMoney(total / nightly.length) };
}

export async function listRoomRates(hotelId: string, roomTypeId: string) {
  return RoomRate.find({ hotelId, roomTypeId }).sort({ startDate: 1, endDate: 1, createdAt: 1 }).lean();
}

export async function createRoomRate(input: {
  hotelId: string;
  roomTypeId: string;
  startDate: Date;
  endDate: Date;
  price: number;
  daysOfWeek?: number[];
}) {
  const startDate = startOfDay(input.startDate);
  const endDate = startOfDay(input.endDate);
  if (startDate > endDate) throw new AppError('Rate start date must be on or before the end date', 400, 'INVALID_DATE_RANGE');
  if (input.price < 0) throw new AppError('Rate price cannot be negative', 400, 'INVALID_PRICE');
  const daysOfWeek = input.daysOfWeek?.length ? [...new Set(input.daysOfWeek)].sort((a, b) => a - b) : undefined;
  const existing = await RoomRate.findOne({ hotelId: input.hotelId, roomTypeId: input.roomTypeId, startDate, endDate, ...(daysOfWeek ? { daysOfWeek } : { daysOfWeek: { $exists: false } }) });
  if (existing) {
    existing.price = roundMoney(input.price);
    await existing.save();
    return existing;
  }
  const [rate] = await RoomRate.create([{
    hotelId: input.hotelId,
    roomTypeId: input.roomTypeId,
    startDate,
    endDate,
    price: roundMoney(input.price),
    daysOfWeek,
  }]);
  return rate;
}

export async function deleteRoomRate(hotelId: string, rateId: string) {
  const rate = await RoomRate.findOneAndDelete({ _id: rateId, hotelId });
  if (!rate) throw new AppError('Rate not found', 404, 'RATE_NOT_FOUND');
  return rate;
}

export async function clearRoomRates(hotelId: string, roomTypeId: string, startDate: Date, endDate: Date) {
  const from = startOfDay(startDate);
  const to = startOfDay(endDate);
  return RoomRate.deleteMany({ hotelId, roomTypeId, startDate: { $gte: from }, endDate: { $lte: to } });
}