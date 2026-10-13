import type { Response } from 'express';
import { success } from './common.js';

export function sendSuccess<T>(response: Response, data: T, statusCode = 200, message?: string, meta?: Record<string, unknown>) {
  return response.status(statusCode).json(success(data, message, meta));
}
