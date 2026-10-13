import { z } from 'zod';
import { User } from '../models/index.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { createOpaqueToken, hashToken } from '../utils/token.js';
import { signAccessToken } from '../utils/jwt.js';
import { signPasswordResetToken, verifyPasswordResetToken } from '../utils/jwtReset.js';
import { env } from '../config/env.js';
import { writeAuditLog } from '../middleware/audit.js';
import { sendEmail } from '../utils/email.js';
import { AppError } from '../utils/error.js';
import type { Request } from 'express';
import type { HydratedDocument } from 'mongoose';
import type { UserDocument } from '../models/index.js';

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth',
  maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
};

const accessCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 15 * 60 * 1000,
};

function publicUser(user: HydratedDocument<UserDocument>) {
  return { id: user._id.toString(), hotelId: user.hotelId.toString(), name: user.name, email: user.email, role: user.role, phone: user.phone, avatarUrl: user.avatarUrl };
}

async function issueSession(user: HydratedDocument<UserDocument>, request: Request) {
  const refreshToken = createOpaqueToken();
  const accessToken = signAccessToken({ id: user._id.toString(), hotelId: user.hotelId.toString(), role: user.role, name: user.name, email: user.email, sessionVersion: user.sessionVersion });
  user.refreshTokens = user.refreshTokens.filter((token) => token.expiresAt > new Date() && !token.revokedAt);
  user.refreshTokens.push({
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    userAgent: request.header('user-agent'),
    ipAddress: request.ip,
  });
  user.lastLoginAt = new Date();
  await user.save();
  return { accessToken, refreshToken, user: publicUser(user) };
}

export async function login(input: { email: string; password: string }, request: Request) {
  const user = await User.findOne({ email: input.email.toLowerCase(), active: true }).select('+passwordHash');
  if (!user || !(await comparePassword(input.password, user.passwordHash))) {
    throw new AppError('Email or password is incorrect', 401, 'INVALID_CREDENTIALS');
  }
  const session = await issueSession(user, request);
  await writeAuditLog({ hotelId: user.hotelId.toString(), userId: user._id.toString(), action: 'auth.login', entity: 'User', entityId: user._id.toString(), request });
  return session;
}

export async function refreshSession(refreshToken: string, request: Request) {
  const tokenHash = hashToken(refreshToken);
  const user = await User.findOne({ 'refreshTokens.tokenHash': tokenHash, active: true });
  if (!user) throw new AppError('Refresh session is invalid', 401, 'INVALID_REFRESH_TOKEN');
  const stored = user.refreshTokens.find((token) => token.tokenHash === tokenHash);
  if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
    throw new AppError('Refresh session has expired', 401, 'REFRESH_TOKEN_EXPIRED');
  }
  stored.revokedAt = new Date();
  const session = await issueSession(user, request);
  await writeAuditLog({ hotelId: user.hotelId.toString(), userId: user._id.toString(), action: 'auth.refresh', entity: 'User', entityId: user._id.toString(), request });
  return session;
}

export async function logout(refreshToken: string | undefined, userId: string | undefined, request: Request) {
  let resolvedUserId = userId;
  if (refreshToken) {
    const user = await User.findOne({ 'refreshTokens.tokenHash': hashToken(refreshToken) });
    const stored = user?.refreshTokens.find((token) => token.tokenHash === hashToken(refreshToken));
    if (user && stored) {
      stored.revokedAt = new Date();
      await user.save();
      resolvedUserId = user._id.toString();
    }
  }
  if (resolvedUserId) {
    const user = await User.findById(resolvedUserId).select('hotelId');
    if (user) await writeAuditLog({ hotelId: user.hotelId.toString(), userId: resolvedUserId, action: 'auth.logout', entity: 'User', entityId: resolvedUserId, request });
  }
}

export async function forgotPassword(email: string, request: Request) {
  const user = await User.findOne({ email: email.toLowerCase(), active: true });
  if (user) {
    const jti = createOpaqueToken(32);
    const token = signPasswordResetToken({ userId: user._id.toString(), hotelId: user.hotelId.toString(), jti });
    user.passwordResetTokenHash = hashToken(jti);
    user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    await sendEmail({
      to: user.email,
      subject: 'Reset your StayFlow password',
      text: `Use this link to reset your password: ${env.DASHBOARD_URL}/reset-password?token=${token}`,
    });
  }
  void request;
  return { message: 'If an account exists, a reset link has been sent' };
}

export async function resetPassword(token: string, password: string, request: Request) {
  const payload = verifyPasswordResetToken(token);
  const passwordHash = await hashPassword(password);
  const user = await User.findOneAndUpdate(
    { _id: payload.userId, active: true, passwordResetTokenHash: hashToken(payload.jti), passwordResetExpiresAt: { $gt: new Date() } },
    { $set: { passwordHash, refreshTokens: [] }, $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 }, $inc: { sessionVersion: 1 } },
    { new: true },
  );
  if (!user) throw new AppError('Reset link is invalid or has already been used', 400, 'INVALID_RESET_TOKEN');
  await writeAuditLog({ hotelId: user.hotelId.toString(), userId: user._id.toString(), action: 'auth.password_reset', entity: 'User', entityId: user._id.toString(), request });
}

export const authSchemas = {
  login: z.object({ email: z.string().email(), password: z.string().min(8).max(128) }),
  refresh: z.object({ refreshToken: z.string().min(20).optional() }),
  forgot: z.object({ email: z.string().email() }),
  reset: z.object({ token: z.string().min(20), password: z.string().min(8).max(128) }),
};

export { accessCookieOptions, refreshCookieOptions };
