import { Request, Response } from 'express';
import { authSchemas, accessCookieOptions, forgotPassword, login, logout, refreshCookieOptions, refreshSession, resetPassword } from '../services/authService.js';
import { AppError } from '../utils/error.js';
import { sendSuccess } from '../utils/response.js';

function setSessionCookies(response: Response, accessToken: string, refreshToken: string) {
  response.cookie('accessToken', accessToken, accessCookieOptions);
  response.cookie('refreshToken', refreshToken, refreshCookieOptions);
}

export async function loginController(request: Request, response: Response) {
  const session = await login(request.body, request);
  setSessionCookies(response, session.accessToken, session.refreshToken);
  sendSuccess(response, { user: session.user, accessToken: session.accessToken }, 200, 'Signed in');
}

export async function refreshController(request: Request, response: Response) {
  const token = request.body?.refreshToken ?? request.cookies?.refreshToken;
  if (!token) throw new AppError('Refresh token is required', 401, 'REFRESH_TOKEN_REQUIRED');
  const session = await refreshSession(token, request);
  setSessionCookies(response, session.accessToken, session.refreshToken);
  sendSuccess(response, { user: session.user, accessToken: session.accessToken }, 200, 'Session refreshed');
}

export async function logoutController(request: Request, response: Response) {
  await logout(request.body?.refreshToken ?? request.cookies?.refreshToken, request.user?.id, request);
  response.clearCookie('accessToken', { path: '/' });
  response.clearCookie('refreshToken', { path: '/api/auth' });
  sendSuccess(response, null, 200, 'Signed out');
}

export async function forgotPasswordController(request: Request, response: Response) {
  const result = await forgotPassword(authSchemas.forgot.parse(request.body).email, request);
  sendSuccess(response, result, 200, result.message);
}

export async function resetPasswordController(request: Request, response: Response) {
  const input = authSchemas.reset.parse(request.body);
  await resetPassword(input.token, input.password, request);
  sendSuccess(response, null, 200, 'Password reset successfully');
}
