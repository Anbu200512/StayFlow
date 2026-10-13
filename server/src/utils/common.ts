export function success<T>(data: T, message?: string, meta?: Record<string, unknown>) {
  return { success: true as const, data, message, meta };
}

export function failure(message: string, code = 'BAD_REQUEST', meta?: Record<string, unknown>) {
  return { success: false as const, message, code, meta };
}

export function calculateNights(checkIn: Date, checkOut: Date): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / millisecondsPerDay));
}

export function entityId(value: unknown): string {
  if (value && typeof value === 'object' && '_id' in value) {
    const id = (value as { _id?: unknown })._id;
    if (id !== undefined && id !== null) return String(id);
  }
  if (value === undefined || value === null) throw new Error('Expected an entity id but received an empty value');
  return String(value);
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function startOfDay(value: Date): Date {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(value: Date): Date {
  const result = new Date(value);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

export function isValidDateRange(checkIn: Date, checkOut: Date): boolean {
  return Number.isFinite(checkIn.getTime()) && Number.isFinite(checkOut.getTime()) && checkOut > checkIn;
}

export function overlapExists(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date,
): boolean {
  return firstStart < secondEnd && secondStart < firstEnd;
}
