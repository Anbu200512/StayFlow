import { create } from 'zustand';
import type { AvailabilityQuery } from '../types';

interface BookingState {
  search: AvailabilityQuery;
  selectedRoomId?: string;
  setSearch: (search: AvailabilityQuery) => void;
  setSelectedRoom: (roomId: string) => void;
}

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const dayAfter = new Date(today);
dayAfter.setDate(today.getDate() + 2);

const toInputDate = (value: Date) => value.toISOString().slice(0, 10);

export const useBookingStore = create<BookingState>((set) => ({
  search: { checkIn: toInputDate(tomorrow), checkOut: toInputDate(dayAfter), adults: 2, children: 0 },
  setSearch: (search) => set({ search }),
  setSelectedRoom: (selectedRoomId) => set({ selectedRoomId }),
}));
