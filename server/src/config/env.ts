import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/stayflow'),
  JWT_ACCESS_SECRET: z.string().min(16).default('local-development-access-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().min(16).default('local-development-refresh-secret-change-me'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_FROM: z.string().default('StayFlow <no-reply@example.com>'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  DASHBOARD_URL: z.string().url().default('http://localhost:5174'),
  WEB_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5174'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (parsed.data.NODE_ENV === 'production') {
  const accessSecret = parsed.data.JWT_ACCESS_SECRET;
  const refreshSecret = parsed.data.JWT_REFRESH_SECRET;
  const insecureAccessSecret = accessSecret === 'local-development-access-secret-change-me';
  const insecureRefreshSecret = refreshSecret === 'local-development-refresh-secret-change-me';
  if (accessSecret.length < 32 || refreshSecret.length < 32 || insecureAccessSecret || insecureRefreshSecret || accessSecret === refreshSecret || parsed.data.MONGODB_URI === 'mongodb://127.0.0.1:27017/stayflow') {
    console.error('Production environment requires unique strong JWT secrets and an explicit MongoDB URI');
    process.exit(1);
  }
}

export const env = parsed.data;
export const allowedOrigins = env.WEB_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
