import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { failure } from '../utils/common.js';

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function notFound(request: Request, response: Response) {
  response.status(404).json(failure(`Route ${request.method} ${request.originalUrl} not found`, 'NOT_FOUND'));
}

export function errorHandler(error: unknown, request: Request, response: Response, _next: NextFunction) {
  if (error instanceof AppError) {
    response.status(error.statusCode).json(failure(error.message, error.code, error.details as Record<string, unknown> | undefined));
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json(failure('Request validation failed', 'VALIDATION_ERROR', error.flatten()));
    return;
  }
  if (error && typeof error === 'object' && 'name' in error && error.name === 'CastError') {
    response.status(404).json(failure('The requested record was not found', 'NOT_FOUND'));
    return;
  }
  if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
    response.status(409).json(failure('A record with the same unique value already exists', 'DUPLICATE_RECORD'));
    return;
  }
  console.error(`[${request.requestId ?? 'unknown'}] Unhandled error`, error);
  response.status(500).json(failure('An unexpected error occurred', 'INTERNAL_SERVER_ERROR'));
}
