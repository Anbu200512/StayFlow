import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { AuthenticatedUser } from '../types/domain.js';

export interface AccessTokenPayload {
  sub: string;
  hotelId: string;
  role: AuthenticatedUser['role'];
  name: string;
  email: string;
  sessionVersion: number;
  type: 'access';
}

export function signAccessToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      sub: user.id,
      hotelId: user.hotelId,
      role: user.role,
      name: user.name,
      email: user.email,
      sessionVersion: user.sessionVersion,
      type: 'access',
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_TTL } as SignOptions,
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return payload;
}
