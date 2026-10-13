import { useState } from 'react';
import { CalendarDays, ChevronDown, Search, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AvailabilityQuery } from '../types';
import { useBookingStore } from '../store/bookingStore';

export function SearchBar({ initial, compact = false }: { initial?: Partial<AvailabilityQuery>; compact?: boolean }) {
  const navigate = useNavigate();
  const stored = useBookingStore((state) => state.search);
  const saveSearch = useBookingStore((state) => state.setSearch);
  const [search, setLocalSearch] = useState<AvailabilityQuery>({ ...stored, ...initial });
  const [guestOpen, setGuestOpen] = useState(false);

  const update = (key: keyof AvailabilityQuery, value: string | number) => setLocalSearch((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    saveSearch(search);
    const params = new URLSearchParams({ checkIn: search.checkIn, checkOut: search.checkOut, adults: String(search.adults), children: String(search.children) });
    navigate(`/rooms?${params.toString()}`);
  };

  return <form onSubmit={submit} className={`relative grid gap-3 ${compact ? 'md:grid-cols-[1fr_1fr_0.8fr_auto]' : 'md:grid-cols-[1fr_1fr_0.9fr_auto]'}`}>
    <label className="block"><span className="label-text">Check in</span><span className="relative block"><CalendarDays size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-forest/60" /><input className="input-field pl-10" type="date" value={search.checkIn} min={new Date().toISOString().slice(0, 10)} onChange={(event) => update('checkIn', event.target.value)} required /></span></label>
    <label className="block"><span className="label-text">Check out</span><span className="relative block"><CalendarDays size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-forest/60" /><input className="input-field pl-10" type="date" value={search.checkOut} min={search.checkIn} onChange={(event) => update('checkOut', event.target.value)} required /></span></label>
    <div className="relative"><span className="label-text">Guests</span><button type="button" className="input-field flex items-center justify-between text-left" onClick={() => setGuestOpen((value) => !value)}><span className="flex items-center gap-2"><Users size={16} className="text-forest/60" />{search.adults + search.children} guests</span><ChevronDown size={15} className="text-forest/60" /></button>{guestOpen && <div className="absolute right-0 top-full z-30 mt-2 w-64 border border-ink/10 bg-white p-4 shadow-soft"><GuestStepper label="Adults" value={search.adults} min={1} onChange={(value) => update('adults', value)} /><GuestStepper label="Children" value={search.children} min={0} onChange={(value) => update('children', value)} /><button type="button" className="mt-4 w-full bg-forest px-4 py-2 text-xs font-semibold text-white" onClick={() => setGuestOpen(false)}>Done</button></div>}</div>
    <button type="submit" className="button-primary mt-auto h-[50px] px-7"><Search size={16} />{compact ? 'Search' : 'Find a room'}</button>
  </form>;
}

function GuestStepper({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (value: number) => void }) {
  return <div className="flex items-center justify-between border-b border-ink/10 py-3 last:border-0"><span className="text-sm text-ink/70">{label}</span><span className="flex items-center gap-3"><button type="button" className="h-7 w-7 border border-ink/20 text-lg leading-none" onClick={() => onChange(Math.max(min, value - 1))}>−</button><span className="w-4 text-center text-sm">{value}</span><button type="button" className="h-7 w-7 border border-ink/20 text-lg leading-none" onClick={() => onChange(value + 1)}>+</button></span></div>;
}
