import axios, { type AxiosRequestConfig } from 'axios';
import type { AvailableRoom, CheckoutSummary, DashboardOverview, Guest, GuestDetail, HousekeepingTask, Hotel, Invoice, InvoiceItem, MaintenanceRequest, MenuCategory, MenuItem, Notification, Order, Paginated, Payment, ReportData, Reservation, Room, RoomRate, RoomType, ServiceRequest, StaffUser, Stay, User, WebsiteContent } from '../types';

interface Envelope<T> { success: boolean; data: T; message?: string; code?: string; meta?: { page: number; limit: number; total: number; pages: number } }
export type QueryParams = Record<string, string | number | boolean | undefined>;
const ACCESS_KEY = 'stayflow.accessToken';
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api', withCredentials: true, headers: { Accept: 'application/json' } });

api.interceptors.request.use((config) => { const token = localStorage.getItem(ACCESS_KEY); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
let refreshPromise: Promise<string | null> | null = null;
api.interceptors.response.use((response) => response, async (error) => {
  const original = error.config as AxiosRequestConfig & { _retried?: boolean };
  if (error.response?.status !== 401 || original?._retried || original?.url?.includes('/auth/')) return Promise.reject(Object.assign(error, { userMessage: error.response?.data?.message ?? 'Request failed' }));
  original._retried = true;
  refreshPromise ??= axios.post<Envelope<{ accessToken: string }>>(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true }).then((response) => { const token = response.data.data.accessToken; localStorage.setItem(ACCESS_KEY, token); return token; }).catch(() => { localStorage.removeItem(ACCESS_KEY); return null; }).finally(() => { refreshPromise = null; });
  const token = await refreshPromise;
  if (!token) return Promise.reject(Object.assign(error, { userMessage: 'Your session has expired' }));
  original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
  return api.request(original);
});

async function request<T>(config: AxiosRequestConfig): Promise<T> { const response = await api.request<Envelope<T>>(config); return response.data.data; }
async function requestPage<T>(config: AxiosRequestConfig): Promise<Paginated<T>> { const response = await api.request<Envelope<unknown>>(config); const data = response.data.data as T[]; return { data, meta: response.data.meta ?? { page: 1, limit: data.length, total: data.length, pages: 1 } }; }
export function getAccessToken() { return localStorage.getItem(ACCESS_KEY); }
export function setAccessToken(token: string) { localStorage.setItem(ACCESS_KEY, token); }
export function clearAccessToken() { localStorage.removeItem(ACCESS_KEY); }

export const authApi = {
  login: (email: string, password: string) => request<{ user: User; accessToken: string }>({ url: '/auth/login', method: 'POST', data: { email, password } }),
  logout: () => request<null>({ url: '/auth/logout', method: 'POST' }),
  me: () => request<{ user: User }>({ url: '/auth/me' }),
  forgotPassword: (email: string) => request<null>({ url: '/auth/forgot-password', method: 'POST', data: { email } }),
  resetPassword: (token: string, password: string) => request<null>({ url: '/auth/reset-password', method: 'POST', data: { token, password } }),
};

export const adminApi = {
  hotel: () => request<Hotel>({ url: '/admin/hotel' }),
  overview: () => request<DashboardOverview>({ url: '/admin/dashboard/overview' }),
  availability: (data: { checkIn: string; checkOut: string; adults: number; children: number; roomTypeId?: string }) => request<AvailableRoom[]>({ url: '/admin/availability', method: 'POST', data }),
  reservationsPage: (params?: QueryParams) => requestPage<Reservation>({ url: '/admin/reservations', params }),
  reservations: (params?: QueryParams) => request<Reservation[]>({ url: '/admin/reservations', params: { limit: 100, ...params } }),
  reservation: (id: string) => request<Reservation>({ url: `/admin/reservations/${id}` }),
  createReservation: (data: Record<string, unknown>) => request<{ reservationId: string; bookingNumber: string; invoiceId: string; paymentId?: string; status: string }>({ url: '/admin/reservations', method: 'POST', data }),
  cancelReservation: (id: string, reason?: string) => request<Reservation>({ url: `/admin/reservations/${id}/cancel`, method: 'POST', data: { reason } }),
  extendReservation: (id: string, newCheckOut: string) => request<Reservation>({ url: `/admin/reservations/${id}/extend`, method: 'POST', data: { newCheckOut } }),
  changeRoom: (id: string, newRoomId: string) => request<Reservation>({ url: `/admin/reservations/${id}/change-room`, method: 'POST', data: { newRoomId } }),
  rooms: (params?: QueryParams) => request<Room[]>({ url: '/admin/rooms', params }),
  roomTypes: () => request<RoomType[]>({ url: '/admin/room-types' }),
  roomRates: (roomTypeId: string) => request<RoomRate[]>({ url: '/admin/rates', params: { roomTypeId } }),
  createRoomRate: (data: { roomTypeId: string; startDate: string; endDate: string; price: number; daysOfWeek?: number[] }) => request<RoomRate>({ url: '/admin/rates', method: 'POST', data }),
  deleteRoomRate: (id: string) => request<{ id: string }>({ url: `/admin/rates/${id}`, method: 'DELETE' }),
  clearRoomRates: (data: { roomTypeId: string; startDate: string; endDate: string }) => request<{ removed: number }>({ url: '/admin/rates/clear', method: 'POST', data }),
  updateRoomStatus: (id: string, status: string, note?: string) => request<{ _id: string; roomNumber: string; status: string }>({ url: `/admin/rooms/${id}/status`, method: 'PATCH', data: { status, note } }),
  guestsPage: (params?: QueryParams) => requestPage<Guest>({ url: '/admin/guests', params }),
  guests: (params?: QueryParams) => request<Guest[]>({ url: '/admin/guests', params: { limit: 100, ...params } }),
  guest: (id: string) => request<GuestDetail>({ url: `/admin/guests/${id}` }),
  createGuest: (data: Record<string, unknown>) => request<Guest>({ url: '/admin/guests', method: 'POST', data }),
  updateGuest: (id: string, data: Record<string, unknown>) => request<Guest>({ url: `/admin/guests/${id}`, method: 'PATCH', data }),
  stays: (params?: QueryParams) => request<Stay[]>({ url: '/admin/stays', params }),
  checkoutSummary: (stayId: string) => request<CheckoutSummary>({ url: `/admin/stays/${stayId}/checkout-summary` }),
  checkIn: (data: Record<string, unknown>) => request<{ stayId: string; reservationId: string; roomId: string; qrDataUrl: string }>({ url: '/admin/check-in', method: 'POST', data }),
  checkOut: (data: Record<string, unknown>) => request<{ stayId: string; reservationId: string; invoice: Invoice }>({ url: '/admin/check-out', method: 'POST', data }),
  payments: (params?: QueryParams) => request<Payment[]>({ url: '/admin/payments', params }),
  createPayment: (data: Record<string, unknown>) => request<{ _id: string }>({ url: '/admin/payments', method: 'POST', data }),
  invoices: () => request<Invoice[]>({ url: '/admin/invoices' }),
  invoice: (id: string) => request<Invoice & { items: InvoiceItem[] }>({ url: `/admin/invoices/${id}` }),
  housekeeping: () => request<HousekeepingTask[]>({ url: '/admin/housekeeping' }),
  createHousekeeping: (data: Record<string, unknown>) => request<{ _id: string }>({ url: '/admin/housekeeping', method: 'POST', data }),
  updateHousekeeping: (id: string, data: Record<string, unknown>) => request<{ _id: string }>({ url: `/admin/housekeeping/${id}`, method: 'PATCH', data }),
  maintenance: () => request<MaintenanceRequest[]>({ url: '/admin/maintenance' }),
  createMaintenance: (data: Record<string, unknown>) => request<{ _id: string }>({ url: '/admin/maintenance', method: 'POST', data }),
  updateMaintenance: (id: string, data: Record<string, unknown>) => request<{ _id: string }>({ url: `/admin/maintenance/${id}`, method: 'PATCH', data }),
  services: () => request<ServiceRequest[]>({ url: '/admin/services' }),
  createService: (data: Record<string, unknown>) => request<{ _id: string }>({ url: '/admin/services', method: 'POST', data }),
  updateService: (id: string, data: Record<string, unknown>) => request<{ _id: string }>({ url: `/admin/services/${id}`, method: 'PATCH', data }),
  restaurantMenu: () => request<MenuCategory[]>({ url: '/admin/restaurant/menu' }),
  createMenuCategory: (data: Record<string, unknown>) => request<MenuCategory>({ url: '/admin/restaurant/categories', method: 'POST', data }),
  createMenuItem: (data: Record<string, unknown>) => request<MenuItem>({ url: '/admin/restaurant/items', method: 'POST', data }),
  orders: (params?: QueryParams) => request<Order[]>({ url: '/admin/orders', params }),
  createOrder: (data: Record<string, unknown>) => request<Order>({ url: '/admin/orders', method: 'POST', data }),
  updateOrder: (id: string, status: string) => request<Order>({ url: `/admin/orders/${id}`, method: 'PATCH', data: { status } }),
  reports: (from: string, to: string) => request<ReportData>({ url: '/admin/reports', params: { from, to } }),
  website: () => request<WebsiteContent>({ url: '/admin/website' }),
  updateWebsite: (data: Partial<WebsiteContent>) => request<WebsiteContent>({ url: '/admin/website', method: 'PUT', data }),
  notifications: () => request<Notification[]>({ url: '/admin/notifications' }),
  markNotification: (id: string) => request<Notification>({ url: `/admin/notifications/${id}/read`, method: 'PATCH' }),
  staff: () => request<StaffUser[]>({ url: '/admin/staff' }),
  uploadImage: (file: File) => { const data = new FormData(); data.append('image', file); return request<{ public_id: string; secure_url: string; width: number; height: number }>({ url: '/admin/uploads/images', method: 'POST', data }); },
};

export { api };
