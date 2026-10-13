import { useQuery } from '@tanstack/react-query';
import { publicApi } from './api';
import type { AvailabilityQuery } from '../types';
import type { QuotePayload } from './api';

export const hotelQuery = () => useQuery({ queryKey: ['public-hotel'], queryFn: publicApi.hotel, staleTime: 60_000 });
export const roomsQuery = (params?: Record<string, string | number | undefined>) => useQuery({ queryKey: ['public-rooms', params], queryFn: () => publicApi.rooms(params), staleTime: 15_000 });
export const roomQuery = (id: string, params?: Record<string, string | undefined>) => useQuery({ queryKey: ['public-room', id, params], queryFn: () => publicApi.room(id, params), enabled: Boolean(id) });
export const availabilityQuery = (search: AvailabilityQuery) => useQuery({ queryKey: ['availability', search], queryFn: () => publicApi.availability(search), enabled: Boolean(search.checkIn && search.checkOut), staleTime: 10_000 });
export const quoteQuery = (payload: QuotePayload | null) => useQuery({ queryKey: ['quote', payload], queryFn: () => publicApi.quote(payload as QuotePayload), enabled: Boolean(payload?.roomId && payload.checkIn && payload.checkOut) });
export const offersQuery = () => useQuery({ queryKey: ['offers'], queryFn: publicApi.offers });
export const facilitiesQuery = () => useQuery({ queryKey: ['facilities'], queryFn: publicApi.facilities });
export const galleryQuery = () => useQuery({ queryKey: ['gallery'], queryFn: publicApi.gallery });
export const guestPortalQuery = (token: string) => useQuery({ queryKey: ['guest-portal', token], queryFn: () => publicApi.guestPortal(token), enabled: Boolean(token), retry: false });
