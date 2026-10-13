import { Request } from 'express';
import { z, type ZodTypeAny } from 'zod';
import { failure } from './common.js';

export function validateRequest(schema: ZodTypeAny) {
  return (request: Request, response: any, next: any) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      response.status(400).json(failure('Request validation failed', 'VALIDATION_ERROR', result.error.flatten()));
      return;
    }
    request.body = result.data;
    next();
  };
}

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}
