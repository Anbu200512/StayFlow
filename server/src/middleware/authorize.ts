import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/error.js';
import { UserRole } from '../types/enums.js';

export function authorize(...roles: UserRole[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.user) {
      next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
      return;
    }
    if (roles.length > 0 && !roles.includes(request.user.role)) {
      next(new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN'));
      return;
    }
    next();
  };
}
