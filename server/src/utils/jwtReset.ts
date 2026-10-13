import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface PasswordResetPayload {
  userId: string;
  hotelId: string;
  jti: string;
  type: 'password_reset';
}

export function signPasswordResetToken(payload: Omit<PasswordResetPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'password_reset' }, env.JWT_REFRESH_SECRET, { expiresIn: '30m' } as SignOptions);
}

export function verifyPasswordResetToken(token: string): PasswordResetPayload {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as PasswordResetPayload;
  if (payload.type !== 'password_reset' || typeof payload.userId !== 'string' || typeof payload.hotelId !== 'string' || typeof payload.jti !== 'string') throw new Error('Invalid reset token');
  return payload;
}
