import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Reservation } from '../types';
import { adminApi } from '../lib/api';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/Ui';
import { formatDate, formatMoney } from '../lib/format';

function dateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(value: Date, amount: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + amount);
  return result;
}

function monthRange(month: Date) {
  const from = new Date(month.getFullYear(), month.getMonth(), 1);
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  return { from: dateKey(from), to: dateKey(to) };
}

function populatedName(value: unknown, key: string) {
  if (!value || typeof value !== 'object') return '';
  const result = (value as Record<string, unknown>)[key];
  return typeof result === 'string' ? result : '';
}

function roomLabel(reservation: Reservation) {
  const type = populatedName(reservation.roomTypeId, 'name') || 'Room type unavailable';
  const number = populatedName(reservation.roomId, 'roomNumber');
  return number ? `${type} · Room ${number}` : type;
}

function visibleReservation(reservation: Reservation) {
  return reservation.status !== 'cancelled' && reservation.status !== 'no_show';
}

function overlapsDate(reservation: Reservation, value: Date) {
  if (!visibleReservation(reservation)) return false;
  const start = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const end = addDays(start, 1);
  const checkIn = new Date(reservation.checkIn);
  const checkOut = new Date(reservation.checkOut);
  return !Number.isNaN(checkIn.getTime()) && !Number.isNaN(checkOut.getTime()) && checkIn < end && checkOut > start;
}

async function loadCalendarReservations(from: string, to: string) {
  const reservations: Reservation[] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    const result = await adminApi.reservationsPage({ from, to, page, limit: 100 });
    const items = Array.isArray(result.data) ? (result.data as unknown as Reservation[]) : [];
    reservations.push(...items);
    hasNext = items.length > 0 && page < result.meta.pages;
    page += 1;
  }
  return reservations;
}

export default function CalendarPage() {
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const range = useMemo(() => monthRange(month), [month]);
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [month]);
  const query = useQuery({ queryKey: ['calendar-reservations', range.from, range.to], queryFn: () => loadCalendarReservations(range.from, range.to) });
  const reservations = query.data ?? [];
  const selectedReservations = reservations.filter((reservation) => overlapsDate(reservation, selected));
  const changeMonth = (amount: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + amount, 1);
    setMonth(next);
    setSelected(next);
  };

  return <>
    <PageHeader eyebrow="Planning" title="Calendar" description="See arrivals, departures, and in-house stays at a glance." action={<div className="flex items-center gap-2"><button type="button" className="dashboard-button-light px-3" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button><span className="min-w-32 text-center text-sm font-semibold">{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span><button type="button" className="dashboard-button-light px-3" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={16} /></button></div>} />
    {query.isLoading ? <LoadingState label="Loading the calendar" /> : query.isError ? <ErrorState onRetry={() => query.refetch()} /> : <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <section className="dashboard-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-ink/10 bg-sand/60">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} className="px-2 py-3 text-center text-xs font-medium text-ink/55">{day}</div>)}</div>
        <div className="grid grid-cols-7">{days.map((date) => {
          const inMonth = date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
          const isToday = dateKey(date) === dateKey(new Date());
          const isSelected = dateKey(date) === dateKey(selected);
          const count = reservations.filter((reservation) => overlapsDate(reservation, date)).length;
          return <button type="button" key={date.toISOString()} onClick={() => setSelected(date)} className={`min-h-24 border-b border-r border-ink/5 p-2 text-left transition hover:bg-sand/60 sm:min-h-28 ${!inMonth ? 'bg-ink/[0.02] text-ink/25' : ''} ${isSelected ? 'bg-forest/10 ring-2 ring-inset ring-forest' : ''}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday ? 'bg-forest font-semibold text-white' : ''}`}>{date.getDate()}</span>{count > 0 && <span className="mt-3 block text-xs font-medium text-forest">{count} {count === 1 ? 'stay' : 'stays'}</span>}</button>;
        })}</div>
      </section>
      <section className="dashboard-card p-5">
        <p className="text-xs font-medium text-ink/55">Selected day</p>
        <h3 className="mt-2 font-display text-2xl">{selected.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
        {selectedReservations.length ? <div className="mt-5 space-y-3">{selectedReservations.map((reservation) => <article key={reservation._id} className="border-b border-ink/10 pb-3 last:border-0 last:pb-0"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{reservation.guestSnapshot.fullName}</p><p className="mt-1 text-xs text-ink/50">{reservation.bookingNumber}</p></div><StatusBadge status={reservation.status} /></div><p className="mt-2 text-xs text-ink/55">{roomLabel(reservation)}</p><p className="mt-1 text-xs text-ink/45">{formatDate(reservation.checkIn)} – {formatDate(reservation.checkOut)} · {formatMoney(reservation.pricing.total)}</p></article>)}</div> : <EmptyState title="No stays" description="There are no active or completed stays on this day." />}
      </section>
    </div>}
  </>;
}
