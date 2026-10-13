import { NextFunction, Request, Response } from 'express';
import { AuditLog } from '../models/index.js';

export async function writeAuditLog(input: {
  hotelId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  request?: Request;
}) {
  try {
    await AuditLog.create({
      hotelId: input.hotelId,
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      oldValue: input.oldValue,
      newValue: input.newValue,
      ipAddress: input.request?.ip,
      userAgent: input.request?.header('user-agent'),
      requestId: input.request?.requestId,
    });
  } catch (error) {
    console.error('Audit log write failed', error);
  }
}

export function auditMiddleware(_action: string, _entity: string) {
  return (_request: Request, _response: Response, next: NextFunction) => next();
}
