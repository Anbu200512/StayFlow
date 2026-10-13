import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Edit3, Plus, Search, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { AvailableRoom, Reservation } from '../types';
import { adminApi } from '../lib/api';
import { EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, StatusBadge } from '../components/Ui';
import { formatDate, formatMoney } from '../lib/format';

type ReservationForm = {
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  source: 'walk_in' | 'phone' | 'admin';
  guestName: string;
  mobile: string;
  email: string;
  paymentMethod: 'cash' | 'upi' | 'card' | 'bank_transfer';
  advanceAmount: number;
};

type AvailabilityInput = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
};

type ReservationPage = {
  data: Reservation[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

type ReservationAction = 'cancel' | 'extend' | 'change-room';

const statuses = ['pending', 'confirmed', 'checked_in', 'checked_out', 'completed', 'cancelled', 'no_show'];

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

function inputDate(value: Date | string) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : dateKey(date);
}

function idOf(value: unknown) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && '_id' in value) return String((value as { _id: unknown })._id ?? '');
  return '';
}

function populatedName(value: unknown, key: string) {
  if (!value || typeof value !== 'object') return '';
  const result = (value as Record<string, unknown>)[key];
  return typeof result === 'string' ? result : '';
}

function reservationRoomLabel(reservation: Reservation) {
  const type = populatedName(reservation.roomTypeId, 'name') || 'Room type unavailable';
  const number = populatedName(reservation.roomId, 'roomNumber');
  return number ? `${type} · Room ${number}` : type;
}

function roomTypeLabel(value: unknown) {
  return populatedName(value, 'name') || 'Room type unavailable';
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'userMessage' in error) {
    const message = (error as { userMessage?: unknown }).userMessage;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

function validStay(checkIn: string, checkOut: string, adults: number, children: number) {
  return Boolean(checkIn && checkOut && checkOut > checkIn && Number.isInteger(adults) && adults >= 1 && Number.isInteger(children) && children >= 0);
}

function canCancel(status: string) {
  return status === 'pending' || status === 'confirmed';
}

function canExtend(status: string) {
  return status === 'pending' || status === 'confirmed';
}

function canChangeRoom(status: string) {
  return status === 'pending' || status === 'confirmed' || status === 'checked_in';
}

function canManage(status: string) {
  return canCancel(status) || canExtend(status) || canChangeRoom(status);
}

function initialReservationForm(): ReservationForm {
  return {
    roomId: '',
    checkIn: inputDate(addDays(new Date(), 1)),
    checkOut: inputDate(addDays(new Date(), 2)),
    adults: 1,
    children: 0,
    source: 'walk_in',
    guestName: '',
    mobile: '',
    email: '',
    paymentMethod: 'cash',
    advanceAmount: 0,
  };
}

async function loadReservationPage(params: { search?: string; status?: string; page: number }): Promise<ReservationPage> {
  const result = await adminApi.reservationsPage({ search: params.search, status: params.status, page: params.page, limit: 100 });
  return { data: Array.isArray(result.data) ? (result.data as unknown as Reservation[]) : [], meta: result.meta };
}

export default function ReservationsPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['reservations', search, status, page],
    queryFn: () => loadReservationPage({ search: search || undefined, status: status || undefined, page }),
    refetchInterval: 30_000,
  });
  const reservations = query.data?.data ?? [];
  const meta = query.data?.meta;
  const totalPages = Math.max(1, meta?.pages ?? 1);
  const currentPage = meta?.page ?? page;
  const total = meta?.total ?? reservations.length;
  const openNew = () => {
    const next = new URLSearchParams(params);
    next.set('new', 'true');
    setParams(next);
  };
  const closeModal = () => {
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
    setEditing(null);
  };
  const saved = () => {
    closeModal();
    void queryClient.invalidateQueries({ queryKey: ['reservations'] });
    void queryClient.invalidateQueries({ queryKey: ['overview'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-availability'] });
  };

  return <>
    <PageHeader eyebrow="Front office" title="Reservations" description="Every booking, from first enquiry to checkout." action={<button type="button" className="dashboard-button" onClick={openNew}><Plus size={16} />New reservation</button>} />
    <div className="dashboard-card mb-6 flex flex-col gap-3 p-4 md:flex-row md:items-center">
      <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" /><input className="dashboard-input pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search booking number, guest, or mobile" /></div>
      <div className="flex gap-2"><select className="dashboard-input min-w-40" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select><button type="button" className="dashboard-button-light" aria-label="Clear filters" onClick={() => { setSearch(''); setStatus(''); setPage(1); }}><X size={15} /></button></div>
    </div>
    {query.isLoading ? <LoadingState label="Loading reservations" /> : query.isError ? <ErrorState onRetry={() => query.refetch()} /> : reservations.length ? <>
      <div className="dashboard-card overflow-x-auto">
        <table className="w-full min-w-[850px] text-left">
          <thead className="border-b border-ink/10 bg-sand/60 text-xs font-medium text-ink/55"><tr><th className="px-5 py-4">Booking</th><th className="px-5 py-4">Guest</th><th className="px-5 py-4">Stay</th><th className="px-5 py-4">Room</th><th className="px-5 py-4">Total</th><th className="px-5 py-4">Status</th><th className="px-5 py-4" /></tr></thead>
          <tbody className="divide-y divide-ink/10">{reservations.map((reservation) => <tr key={reservation._id} className="text-sm transition hover:bg-sand/40"><td className="px-5 py-4"><p className="font-semibold">{reservation.bookingNumber}</p><p className="mt-1 text-xs text-ink/45">{reservation.source}</p></td><td className="px-5 py-4"><p>{reservation.guestSnapshot.fullName}</p><p className="mt-1 text-xs text-ink/45">{reservation.guestSnapshot.mobile}</p></td><td className="px-5 py-4"><p>{formatDate(reservation.checkIn)}</p><p className="mt-1 text-xs text-ink/45">to {formatDate(reservation.checkOut)}</p></td><td className="px-5 py-4 text-ink/60">{reservationRoomLabel(reservation)}</td><td className="px-5 py-4 font-semibold">{formatMoney(reservation.pricing.total)}</td><td className="px-5 py-4"><StatusBadge status={reservation.status} /></td><td className="px-5 py-4 text-right">{canManage(reservation.status) && <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-forest" onClick={() => setEditing(reservation._id)}><Edit3 size={14} />Manage</button>}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-ink/45"><span>Showing {reservations.length} of {total} reservations</span><div className="flex items-center gap-2"><button type="button" className="dashboard-button-light" disabled={currentPage <= 1 || query.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={14} />Previous</button><span>Page {currentPage} of {totalPages}</span><button type="button" className="dashboard-button-light" disabled={currentPage >= totalPages || query.isFetching} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next<ChevronRight size={14} /></button></div></div>
    </> : <EmptyState title="No reservations found" description="Reservations matching these filters will appear here." />}
    {(params.get('new') === 'true' || editing) && <ReservationModal reservationId={editing} onClose={closeModal} onSaved={saved} />}
  </>;
}

function ReservationModal({ reservationId, onClose, onSaved }: { reservationId: string | null; onClose: () => void; onSaved: () => void }) {
  return reservationId ? <ReservationActionsModal reservationId={reservationId} onClose={onClose} onSaved={onSaved} /> : <NewReservationModal onClose={onClose} onSaved={onSaved} />;
}

function NewReservationModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<ReservationForm>(initialReservationForm);
  const [error, setError] = useState('');
  const availabilityInput: AvailabilityInput = { checkIn: form.checkIn, checkOut: form.checkOut, adults: form.adults, children: form.children };
  const available = useQuery({
    queryKey: ['admin-availability', availabilityInput],
    queryFn: () => adminApi.availability(availabilityInput),
    enabled: validStay(form.checkIn, form.checkOut, form.adults, form.children),
  });
  const roomOptions: AvailableRoom[] = available.data ?? [];
  const create = useMutation({
    mutationFn: (data: Record<string, unknown>) => adminApi.createReservation(data),
    onSuccess: () => onSaved(),
  });
  const update = (values: Partial<ReservationForm>) => setForm((current) => ({ ...current, ...values }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const fullName = form.guestName.trim();
    const mobile = form.mobile.trim();
    const email = form.email.trim();
    if (!validStay(form.checkIn, form.checkOut, form.adults, form.children)) {
      setError('Choose a valid stay date range and guest count.');
      return;
    }
    if (fullName.length < 2) {
      setError('Guest name must be at least 2 characters.');
      return;
    }
    if (mobile.length < 7) {
      setError('Mobile number must be at least 7 characters.');
      return;
    }
    if (available.isFetching) {
      setError('Available rooms are still loading.');
      return;
    }
    if (!roomOptions.some((room) => idOf(room._id) === form.roomId)) {
      setError('Choose one of the available rooms.');
      return;
    }
    const guest: Record<string, unknown> = { fullName, mobile, privacyConsent: true, marketingConsent: false };
    if (email) guest.email = email;
    create.mutate({ roomId: form.roomId, checkIn: form.checkIn, checkOut: form.checkOut, adults: form.adults, children: form.children, source: form.source, guest, paymentMethod: form.paymentMethod, advanceAmount: form.advanceAmount });
  };

  return <Modal title="New reservation" onClose={onClose} wide>
    <form className="mt-7 space-y-5" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Check in"><input className="dashboard-input" type="date" value={form.checkIn} onChange={(event) => update({ checkIn: event.target.value })} /></Field><Field label="Check out"><input className="dashboard-input" type="date" value={form.checkOut} onChange={(event) => update({ checkOut: event.target.value })} /></Field></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Adults"><input className="dashboard-input" type="number" min="1" step="1" value={form.adults} onChange={(event) => update({ adults: Number(event.target.value) })} /></Field><Field label="Children"><input className="dashboard-input" type="number" min="0" step="1" value={form.children} onChange={(event) => update({ children: Number(event.target.value) })} /></Field></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Available room"><select className="dashboard-input" value={form.roomId} onChange={(event) => update({ roomId: event.target.value })} disabled={available.isFetching}><option value="">{available.isFetching ? 'Finding rooms…' : roomOptions.length ? 'Select an available room' : 'No available rooms'}</option>{roomOptions.map((room) => <option key={room._id} value={room._id}>{room.roomNumber} · {roomTypeLabel(room.roomTypeId)}</option>)}</select></Field><Field label="Source"><select className="dashboard-input" value={form.source} onChange={(event) => update({ source: event.target.value as ReservationForm['source'] })}><option value="walk_in">Walk-in</option><option value="phone">Phone</option><option value="admin">Admin</option></select></Field></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Guest name"><input className="dashboard-input" value={form.guestName} minLength={2} onChange={(event) => update({ guestName: event.target.value })} /></Field><Field label="Mobile"><input className="dashboard-input" value={form.mobile} minLength={7} onChange={(event) => update({ mobile: event.target.value })} /></Field></div>
      <Field label="Email (optional)"><input className="dashboard-input" type="email" value={form.email} onChange={(event) => update({ email: event.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Payment method"><select className="dashboard-input" value={form.paymentMethod} onChange={(event) => update({ paymentMethod: event.target.value as ReservationForm['paymentMethod'] })}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option></select></Field><Field label="Advance amount"><input className="dashboard-input" type="number" min="0" step="0.01" value={form.advanceAmount} onChange={(event) => update({ advanceAmount: Number(event.target.value) })} /></Field></div>
      {available.isError && <p className="text-sm text-copper">Available rooms could not be loaded.</p>}
      {available.isLoading && <p className="text-sm text-ink/50">Checking hotel availability…</p>}
      {!available.isLoading && !available.isError && !roomOptions.length && <p className="text-sm text-ink/50">No rooms meet this stay and guest count.</p>}
      {error && <p className="text-sm text-copper">{error}</p>}
      {create.isError && <p className="text-sm text-copper">{errorMessage(create.error, 'Reservation could not be created.')}</p>}
      <div className="flex justify-end gap-3 border-t border-ink/10 pt-5"><button type="button" className="dashboard-button-light" onClick={onClose}>Cancel</button><button type="submit" className="dashboard-button" disabled={create.isPending || available.isFetching || !roomOptions.length}>{create.isPending ? 'Saving…' : 'Save reservation'}</button></div>
    </form>
  </Modal>;
}

function ReservationActionsModal({ reservationId, onClose, onSaved }: { reservationId: string; onClose: () => void; onSaved: () => void }) {
  const existing = useQuery({ queryKey: ['reservation', reservationId], queryFn: () => adminApi.reservation(reservationId) });
  const [action, setAction] = useState<ReservationAction | null>(null);
  const [reason, setReason] = useState('');
  const [newCheckOut, setNewCheckOut] = useState('');
  const [newRoomId, setNewRoomId] = useState('');
  const [actionError, setActionError] = useState('');
  const values = existing.data;
  const availabilityInput = values ? changeRoomAvailability(values) : undefined;
  const available = useQuery({
    queryKey: ['admin-availability', 'change-room', reservationId, availabilityInput],
    queryFn: () => adminApi.availability(availabilityInput as AvailabilityInput),
    enabled: Boolean(availabilityInput && action === 'change-room'),
  });
  const roomOptions: AvailableRoom[] = available.data ?? [];
  const cancel = useMutation({ mutationFn: (value?: string) => adminApi.cancelReservation(reservationId, value), onSuccess: () => onSaved() });
  const extend = useMutation({ mutationFn: (value: string) => adminApi.extendReservation(reservationId, value), onSuccess: () => onSaved() });
  const changeRoom = useMutation({ mutationFn: (value: string) => adminApi.changeRoom(reservationId, value), onSuccess: () => onSaved() });
  const pending = cancel.isPending || extend.isPending || changeRoom.isPending;
  const mutationError = cancel.error ?? extend.error ?? changeRoom.error;

  if (existing.isLoading) return <Modal title="Reservation actions" onClose={onClose}><LoadingState label="Loading reservation" /></Modal>;
  if (existing.isError || !values) return <Modal title="Reservation actions" onClose={onClose}><ErrorState onRetry={() => existing.refetch()} /></Modal>;

  const selectAction = (next: ReservationAction) => {
    setAction(next);
    setActionError('');
    cancel.reset();
    extend.reset();
    changeRoom.reset();
    if (next === 'extend') setNewCheckOut(inputDate(addDays(new Date(values.checkOut), 1)));
    if (next === 'change-room') setNewRoomId('');
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError('');
    if (action === 'cancel') {
      cancel.mutate(reason.trim() || undefined);
      return;
    }
    if (action === 'extend') {
      if (!newCheckOut || newCheckOut <= inputDate(values.checkOut)) {
        setActionError('New check-out must be after the current check-out.');
        return;
      }
      extend.mutate(newCheckOut);
      return;
    }
    if (action === 'change-room') {
      if (!newRoomId || !roomOptions.some((room) => idOf(room._id) === newRoomId)) {
        setActionError('Choose an available room.');
        return;
      }
      changeRoom.mutate(newRoomId);
    }
  };
  const minimumCheckOut = inputDate(addDays(new Date(values.checkOut), 1));

  return <Modal title="Reservation actions" onClose={onClose} wide>
    <div className="mt-6 border border-forest/20 bg-forest/5 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold text-forest">{values.bookingNumber} · {values.guestSnapshot.fullName}</p><p className="mt-1 text-sm text-ink/60">{formatDate(values.checkIn)} – {formatDate(values.checkOut)} · {reservationRoomLabel(values)}</p></div><StatusBadge status={values.status} /></div><p className="mt-3 text-sm font-semibold">{formatMoney(values.pricing.total)}</p></div>
    <div className="mt-5 flex flex-wrap gap-2">{canCancel(values.status) && <button type="button" className="dashboard-button-light" onClick={() => selectAction('cancel')}>Cancel reservation</button>}{canExtend(values.status) && <button type="button" className="dashboard-button-light" onClick={() => selectAction('extend')}>Extend stay</button>}{canChangeRoom(values.status) && <button type="button" className="dashboard-button-light" onClick={() => selectAction('change-room')}>Change room</button>}</div>
    {action && <form className="mt-5 space-y-4 border-t border-ink/10 pt-5" onSubmit={submit}>
      {action === 'cancel' && <Field label="Cancellation reason (optional)"><textarea className="dashboard-input min-h-24" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>}
      {action === 'extend' && <Field label="New check-out"><input className="dashboard-input" type="date" min={minimumCheckOut} value={newCheckOut} onChange={(event) => setNewCheckOut(event.target.value)} /></Field>}
      {action === 'change-room' && <><Field label="New room"><select className="dashboard-input" value={newRoomId} onChange={(event) => setNewRoomId(event.target.value)} disabled={available.isFetching}><option value="">{available.isFetching ? 'Finding rooms…' : roomOptions.length ? 'Select an available room' : 'No available rooms'}</option>{roomOptions.map((room) => <option key={room._id} value={room._id}>{room.roomNumber} · {roomTypeLabel(room.roomTypeId)}</option>)}</select></Field>{available.isError && <p className="text-sm text-copper">Available rooms could not be loaded.</p>}{!available.isFetching && !available.isError && !roomOptions.length && <p className="text-sm text-ink/50">No rooms are available for this stay.</p>}</>}
      {actionError && <p className="text-sm text-copper">{actionError}</p>}
      {mutationError && <p className="text-sm text-copper">{errorMessage(mutationError, 'Reservation action failed.')}</p>}
      <div className="flex justify-end gap-3 border-t border-ink/10 pt-5"><button type="button" className="dashboard-button-light" onClick={onClose}>Close</button><button type="submit" className="dashboard-button" disabled={pending}>{pending ? 'Saving…' : action === 'cancel' ? 'Confirm cancellation' : action === 'extend' ? 'Extend reservation' : 'Change room'}</button></div>
    </form>}
    {!action && <div className="mt-5 flex justify-end border-t border-ink/10 pt-5"><button type="button" className="dashboard-button-light" onClick={onClose}>Close</button></div>}
  </Modal>;
}

function changeRoomAvailability(reservation: Reservation): AvailabilityInput | undefined {
  const currentCheckIn = inputDate(reservation.checkIn);
  const checkOut = inputDate(reservation.checkOut);
  const today = dateKey(new Date());
  const checkIn = currentCheckIn < today ? today : currentCheckIn;
  if (!validStay(checkIn, checkOut, reservation.guests.adults, reservation.guests.children)) return undefined;
  return { checkIn, checkOut, adults: reservation.guests.adults, children: reservation.guests.children };
}
