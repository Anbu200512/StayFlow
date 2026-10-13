import { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import { User } from '../models/index.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { AppError } from '../utils/error.js';

function getToken(request: Request): string | undefined {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7);
  return request.cookies?.accessToken;
}

export async function authenticate(request: Request, _response: Response, next: NextFunction) {
  try {
    const token = getToken(request);
    if (!token) throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select('name email role hotelId active sessionVersion');
    if (!user || !user.active) throw new AppError('Account is inactive or unavailable', 401, 'ACCOUNT_UNAVAILABLE');
    if (payload.sessionVersion !== user.sessionVersion) throw new AppError('Session has been revoked', 401, 'SESSION_REVOKED');
    request.user = {
      id: user._id.toString(),
      hotelId: user.hotelId.toString(),
      role: user.role,
      name: user.name,
      email: user.email,
      sessionVersion: user.sessionVersion,
    };
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError('Invalid or expired access token', 401, 'INVALID_TOKEN'));
  }
}

export function optionalAuthenticate(request: Request, response: Response, next: NextFunction) {
  const token = getToken(request);
  if (!token) {
    next();
    return;
  }
  authenticate(request, response, next);
}

export function requestId(request: Request, response: Response, next: NextFunction) {
  const id = request.header('x-request-id') ?? crypto.randomUUID();
  request.requestId = id;
  response.setHeader('x-request-id', id);
  next();
}
