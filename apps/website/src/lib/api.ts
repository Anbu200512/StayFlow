import axios, { type AxiosRequestConfig } from 'axios';
import type { AvailabilityQuery, BookingGuest, ContactDetails, GalleryImage, GuestPortal, Hotel, Offer, Room, Reservation, Pricing } from '../types';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  code?: string;
  meta?: Record<string, unknown>;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message ?? 'Something went wrong. Please try again.';
    return Promise.reject(Object.assign(error, { userMessage: message }));
  },
);

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await api.request<ApiEnvelope<T>>(config);
  return response.data.data;
}

export const publicApi = {
  hotel: () => request<{ hotel: Hotel; content?: import('../types').WebsiteContent; offers: Offer[]; gallery: GalleryImage[]; amenities: string[]; serviceCatalog: { code: string; name: string; unitPrice: number }[] }>({ url: '/public/hotel' }),
  rooms: (params?: Record<string, string | number | undefined>) => request<Room[]>({ url: '/public/rooms', params }),
  room: (id: string, params?: Record<string, string | undefined>) => request<Room>({ url: `/public/rooms/${id}`, params }),
  availability: (data: AvailabilityQuery) => request<Room[]>({ url: '/public/availability', method: 'POST', data }),
  quote: (data: QuotePayload) => request<{ pricing: Pricing; services: { code: string; name: string; quantity: number; unitPrice: number; total: number }[] }>({ url: '/public/quote', method: 'POST', data }),
  offers: () => request<Offer[]>({ url: '/public/offers' }),
  facilities: () => request<{ amenities: string[]; about?: string; location?: WebsiteLocation; contact?: ContactDetails }>({ url: '/public/facilities' }),
  gallery: () => request<GalleryImage[]>({ url: '/public/gallery' }),
  submitContact: (data: ContactPayload) => request<{ received: true }>({ url: '/public/contact', method: 'POST', data }),
  createBooking: (data: BookingPayload) => request<{ reservation: Reservation; paymentId?: string; paymentOrder?: { id?: string; amount?: number; currency?: string } | null }>({ url: '/public/bookings', method: 'POST', data }),
  confirmPayment: (data: { reservationId: string; paymentId: string; orderId: string; razorpayPaymentId: string; signature: string }) => request({ url: '/public/payments/confirm', method: 'POST', data }),
  lookupBooking: (data: { bookingNumber: string; emailOrMobile: string }) => request<Reservation>({ url: '/public/bookings/lookup', method: 'POST', data }),
  guestPortal: (token: string) => request<GuestPortal>({ url: `/public/guest-portal/${token}` }),
  guestService: (token: string, data: { category: string; description: string; priority?: string }) => request({ url: `/public/guest-portal/${token}/services`, method: 'POST', data }),
};

export interface QuotePayload {
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  services: { code: string; quantity: number; notes?: string }[];
  offerCode?: string;
}

interface WebsiteLocation { label?: string; address?: string; mapUrl?: string }
export interface ContactPayload { name: string; email: string; phone?: string; message: string }
export interface BookingPayload {
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  guest: BookingGuest;
  services: { code: string; quantity: number; notes?: string }[];
  offerCode?: string;
  paymentMethod: 'cash' | 'upi' | 'card' | 'razorpay' | 'bank_transfer';
  advanceAmount?: number;
  specialRequests?: string;
}

export { api };
