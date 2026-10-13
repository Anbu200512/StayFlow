import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { allowedOrigins, env } from './config/env.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { requestId } from './middleware/auth.js';
import { AppError, errorHandler, notFound } from './utils/error.js';
import { authRouter } from './routes/authRoutes.js';
import { publicRouter } from './routes/publicRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';

export const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(requestId);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: (origin, callback) => { if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV === 'development') callback(null, true); else callback(new Error('Origin not allowed')); }, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use((request: Request, _response: Response, next: NextFunction) => {
  const rejectOperators = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    for (const [key, nested] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.')) throw new AppError('Query operator characters are not allowed', 400, 'INVALID_QUERY_OPERATORS');
      rejectOperators(nested);
    }
  };
  try {
    rejectOperators(request.body);
    rejectOperators(request.query);
    next();
  } catch (error) {
    next(error);
  }
});
app.get('/api/health', (_request, response) => response.json({ success: true, data: { status: 'ok', service: 'stayflow-api', timestamp: new Date().toISOString() } }));
app.use('/api', apiLimiter);
app.use('/api/auth', authRouter);
app.use('/api/public', publicRouter);
app.use('/api/admin', adminRouter);
app.use(notFound);
app.use(errorHandler);
