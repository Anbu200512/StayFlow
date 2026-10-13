import type { UserRole } from './enums.js';

export interface AuthenticatedUser {
  id: string;
  hotelId: string;
  role: UserRole;
  name: string;
  email: string;
  sessionVersion: number;
}

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  meta?: Record<string, unknown>;
}

export interface DateRange {
  checkIn: Date;
  checkOut: Date;
}

export interface MoneyBreakdown {
  roomSubtotal: number;
  servicesSubtotal: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
}

export type PricingSnapshot = MoneyBreakdown;

export interface SelectedService {
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
}
