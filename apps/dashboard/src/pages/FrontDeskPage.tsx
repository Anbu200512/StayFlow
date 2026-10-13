import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, LogIn, LogOut, QrCode, Search, X } from 'lucide-react';
import type { PaymentMethod, Reservation, Stay } from '../types';
import { adminApi } from '../lib/api';
import { EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, StatusBadge } from '../components/Ui';
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

function inputDate(value: string | Date) {
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

function roomLabel(reservation: Reservation) {
  const type = populatedName(reservation.roomTypeId, 'name') || 'Room type unavailable';
  const number = populatedName(reservation.roomId, 'roomNumber');
  return number ? `${type} · Room ${number}` : type;
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'userMessage' in error) {
    const message = (error as { userMessage?: unknown }).userMessage;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

function isValidActiveStay(stay: Stay) {
  return stay.status === 'active' && Boolean(idOf(stay._id)) && Boolean(idOf(stay.guestId)) && Boolean(idOf(stay.roomId));
}

export default function FrontDeskPage() {
  const [tab, setTab] = useState<'arrivals' | 'in-house'>('arrivals');
  const [search, setSearch] = useState('');
  const [checkoutStay, setCheckoutStay] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const client = useQueryClient();
  const now = new Date();
  const today = dateKey(now);
  const tomorrow = dateKey(addDays(now, 1));
  const reservations = useQuery({ queryKey: ['front-desk-arrivals', today, tomorrow, search], queryFn: () => adminApi.reservations({ status: 'confirmed', from: today, to: tomorrow, search: search || undefined, limit: 100 }) });
  const stays = useQuery({ queryKey: ['front-desk-stays'], queryFn: () => adminApi.stays({ status: 'active', limit: 100 }), refetchInterval: 30_000 });
  const arrivals = (reservations.data ?? []).filter((reservation) => reservation.status === 'confirmed' && inputDate(reservation.checkIn) === today);
  const activeStays = (stays.data ?? []).filter(isValidActiveStay);
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['front-desk-arrivals'] });
    void client.invalidateQueries({ queryKey: ['front-desk-stays'] });
    void client.invalidateQueries({ queryKey: ['overview'] });
    void client.invalidateQueries({ queryKey: ['reservations'] });
  };
  const checkedIn = (value: string) => {
    setQr(value);
    invalidate();
  };
  const checkedOut = () => {
    setCheckoutStay(null);
    invalidate();
  };

  return <>
    <PageHeader eyebrow="Front desk" title="Arrivals & departures" description="A calm, complete handoff for every guest." />
    <div className="mb-6 flex gap-2 border-b border-ink/10"><button type="button" onClick={() => setTab('arrivals')} className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === 'arrivals' ? 'border-forest text-forest' : 'border-transparent text-ink/45'}`}>Arrivals <span className="ml-2 rounded-full bg-forest/10 px-2 py-0.5 text-xs">{arrivals.length}</span></button><button type="button" onClick={() => setTab('in-house')} className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === 'in-house' ? 'border-forest text-forest' : 'border-transparent text-ink/45'}`}>In-house <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{activeStays.length}</span></button></div>
    {tab === 'arrivals' ? <><div className="dashboard-card mb-6 p-4"><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" /><input className="dashboard-input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search arriving guest or booking" /><button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/35" aria-label="Clear search" onClick={() => setSearch('')}><X size={15} /></button></div></div>{reservations.isLoading ? <LoadingState label="Loading arrivals" /> : reservations.isError ? <ErrorState onRetry={() => reservations.refetch()} /> : arrivals.length ? <div className="grid gap-4">{arrivals.map((reservation) => <ArrivalCard key={reservation._id} reservation={reservation} onCheckedIn={checkedIn} />)}</div> : <EmptyState title="No arrivals waiting" description="Confirmed reservations for today will appear here when they are ready for check-in." />}</> : <>{stays.isLoading ? <LoadingState label="Loading in-house stays" /> : stays.isError ? <ErrorState onRetry={() => stays.refetch()} /> : activeStays.length ? <div className="grid gap-4">{activeStays.map((stay) => <InHouseCard key={stay._id} stay={stay} onCheckout={() => setCheckoutStay(idOf(stay._id))} />)}</div> : <EmptyState title="No active stays" description="Checked-in guests will appear here until checkout." />}</>}
    {checkoutStay && <CheckoutModal stayId={checkoutStay} onClose={() => setCheckoutStay(null)} onSaved={checkedOut} />}
    {qr && <Modal title="Guest check-in QR" onClose={() => setQr(null)}><div className="mt-6 flex flex-col items-center gap-4"><div className="rounded-lg border border-ink/10 bg-white p-4"><img src={qr} alt="Generated guest check-in QR code" className="h-64 w-64 object-contain" /></div><div className="flex items-center gap-2 text-sm text-forest"><QrCode size={16} />Present this code to the guest</div></div></Modal>}
  </>;
}

function ArrivalCard({ reservation, onCheckedIn }: { reservation: Reservation; onCheckedIn: (qr: string) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="dashboard-card flex flex-col justify-between gap-5 p-5 md:flex-row md:items-center"><div className="flex items-start gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-forest/10 text-forest"><LogIn size={18} /></div><div><p className="text-xs font-medium text-ink/55">{reservation.bookingNumber} · {reservation.source.replaceAll('_', ' ')}</p><h2 className="mt-1 font-display text-2xl">{reservation.guestSnapshot.fullName}</h2><p className="mt-1 text-xs text-ink/50">{formatDate(reservation.checkIn)} – {formatDate(reservation.checkOut)} · {roomLabel(reservation)}</p><p className="mt-1 text-xs text-ink/45">{reservation.guestSnapshot.mobile} · {formatMoney(reservation.pricing.total)}</p></div></div><div className="flex items-center gap-3"><StatusBadge status={reservation.status} />{reservation.status === 'confirmed' && <button type="button" className="dashboard-button" onClick={() => setOpen(true)}><LogIn size={15} />Check in</button>}</div>{open && <CheckInModal reservation={reservation} onClose={() => setOpen(false)} onSaved={(value) => { setOpen(false); onCheckedIn(value); }} />}</div>;
}

function InHouseCard({ stay, onCheckout }: { stay: Stay; onCheckout: () => void }) {
  const roomNumber = populatedName(stay.roomId, 'roomNumber') || 'Room unavailable';
  const guestName = populatedName(stay.guestId, 'fullName') || 'Guest unavailable';
  return <div className="dashboard-card flex flex-col justify-between gap-5 p-5 md:flex-row md:items-center"><div className="flex items-start gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700"><CheckCircle2 size={18} /></div><div><p className="text-xs font-medium text-ink/55">Room {roomNumber} · in-house</p><h2 className="mt-1 font-display text-2xl">{guestName}</h2><p className="mt-1 text-xs text-ink/50">Expected out {formatDate(stay.expectedCheckOut)}</p></div></div><button type="button" className="dashboard-button" onClick={onCheckout}><LogOut size={15} />Check out</button></div>;
}

function CheckInModal({ reservation, onClose, onSaved }: { reservation: Reservation; onClose: () => void; onSaved: (qr: string) => void }) {
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idDocumentUrl, setIdDocumentUrl] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const uploadMutation = useMutation({ mutationFn: (file: File) => adminApi.uploadImage(file), onSuccess: (result) => setIdDocumentUrl(result.secure_url) });
  const mutation = useMutation({ mutationFn: () => adminApi.checkIn({ reservationId: reservation._id, idVerified: true, idType, idNumber, idDocumentUrl: idDocumentUrl ?? undefined, paymentAmount: amount, paymentMethod: method }), onSuccess: (result) => onSaved(result.qrDataUrl) });
  const idComplete = Boolean(idType.trim()) && Boolean(idNumber.trim());
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!idComplete || amount < 0) return;
    mutation.mutate();
  };
  return <Modal title="Check in guest" onClose={onClose}><form className="mt-7 space-y-5" onSubmit={submit}><div className="border border-ink/10 bg-sand/50 p-4"><p className="text-sm font-semibold">{reservation.guestSnapshot.fullName}</p><p className="mt-1 text-xs text-ink/50">{reservation.bookingNumber} · {roomLabel(reservation)}</p></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Government ID type" error={idType ? undefined : 'Required'}>
    <select className="dashboard-input" value={idType} onChange={(event) => setIdType(event.target.value)} required><option value="" disabled>Select ID type</option><option value="passport">Passport</option><option value="aadhaar">Aadhaar card</option><option value="driving_license">Driving licence</option><option value="voter_id">Voter ID</option><option value="pan">PAN card</option><option value="other">Other</option></select>
  </Field><Field label="Government ID number" error={idNumber ? undefined : 'Required'}><input className="dashboard-input" value={idNumber} onChange={(event) => setIdNumber(event.target.value)} placeholder="e.g. ABN7196SL" required /></Field></div><Field label="ID photo (optional)"><div className="flex items-center gap-3"><input type="file" accept="image/*" className="text-sm" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadMutation.mutate(file); }} />{uploadMutation.isPending ? <span className="text-xs text-ink/50">Uploading…</span> : idDocumentUrl ? <span className="text-xs text-forest">Photo captured</span> : null}</div></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Collect advance"><input className="dashboard-input" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></Field><Field label="Payment method"><select className="dashboard-input" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option></select></Field></div>{!idComplete && <p className="text-sm text-copper">Government ID is required before check-in.</p>}{uploadMutation.isError || mutation.isError ? <p className="text-sm text-copper">{errorMessage(mutation.error ?? uploadMutation.error, 'Check-in failed.')}</p> : null}<div className="flex justify-end gap-3 border-t border-ink/10 pt-5"><button type="button" className="dashboard-button-light" onClick={onClose}>Cancel</button><button type="submit" className="dashboard-button" disabled={mutation.isPending || uploadMutation.isPending || !idComplete}>{mutation.isPending ? 'Checking in…' : 'Complete check-in'}</button></div></form></Modal>;
}

function CheckoutModal({ stayId, onClose, onSaved }: { stayId: string; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [allowOutstanding, setAllowOutstanding] = useState(false);
  const summary = useQuery({ queryKey: ['checkout-summary', stayId], queryFn: () => adminApi.checkoutSummary(stayId), refetchInterval: 20_000 });
  const balance = summary.data?.folio.balance ?? 0;
  const mutation = useMutation({ mutationFn: () => adminApi.checkOut({ stayId, paymentAmount: amount, paymentMethod: method, allowOutstanding }), onSuccess: () => onSaved() });
  useEffect(() => {
    if (summary.data && balance > 0 && amount === 0) setAmount(balance);
  }, [summary.data, balance, amount]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (amount < 0 || (balance > 0 && amount <= 0 && !allowOutstanding)) return;
    mutation.mutate();
  };
  const currency = summary.data?.folio.currency ?? 'INR';
  const extraChargeCount = summary.data?.extraCharges.length ?? 0;
  return <Modal title="Check out guest" onClose={onClose}>
    {summary.isLoading ? <LoadingState label="Preparing the final folio" /> : summary.isError || !summary.data ? <ErrorState onRetry={() => summary.refetch()} /> : (
      <form className="mt-7 space-y-5" onSubmit={submit}>
        <div className="border border-ink/10 bg-sand/50 p-4"><p className="text-sm font-semibold">{summary.data.guest?.fullName ?? 'Guest'}</p><p className="mt-1 text-xs text-ink/50">{summary.data.reservation.bookingNumber} · Room {summary.data.room.roomNumber} · Expected out {formatDate(summary.data.stay.expectedCheckOut)}</p></div>
        <div className="overflow-hidden rounded-lg border border-ink/10"><table className="w-full text-sm"><tbody className="divide-y divide-ink/10">
          <Row label="Room charges" value={formatMoney(summary.data.folio.roomSubtotal, currency)} />
          <Row label={`Services & extras${extraChargeCount ? ` (${extraChargeCount})` : ''}`} value={formatMoney(summary.data.folio.servicesSubtotal, currency)} />
          <tr><td className="px-5 py-2 text-xs leading-6 text-ink/60">{summary.data.extraCharges.length ? summary.data.extraCharges.map((charge) => `${charge.description} — ${formatMoney(charge.amount, currency)}`).join(' · ') : 'No additional charges during the stay'}</td><td /></tr>
          <Row label="Subtotal" value={formatMoney(summary.data.folio.subtotal, currency)} />
          <Row label="Tax" value={formatMoney(summary.data.folio.tax, currency)} />
          {summary.data.folio.discount > 0 && <Row label="Discount" value={`- ${formatMoney(summary.data.folio.discount, currency)}`} />}
          <Row label="Total bill" value={formatMoney(summary.data.folio.total, currency)} emphasis />
          <Row label="Already paid" value={formatMoney(summary.data.folio.amountPaid, currency)} />
          <Row label="Balance due" value={formatMoney(summary.data.folio.balance, currency)} emphasis tone={summary.data.folio.balance > 0 ? 'copper' : 'default'} />
        </tbody></table></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Collect payment (max balance)"><input className="dashboard-input" type="number" min="0" step="0.01" placeholder={String(balance)} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></Field><Field label="Payment method"><select className="dashboard-input" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option></select></Field></div>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={allowOutstanding} onChange={(event) => setAllowOutstanding(event.target.checked)} className="accent-forest" />Allow checkout with an outstanding balance</label>
        {mutation.isError && <p className="text-sm text-copper">{errorMessage(mutation.error, 'Checkout failed.')}</p>}
        <div className="flex justify-end gap-3 border-t border-ink/10 pt-5"><button type="button" className="dashboard-button-light" onClick={onClose}>Cancel</button><button type="submit" className="dashboard-button" disabled={mutation.isPending || (balance > 0 && amount <= 0 && !allowOutstanding)}>{mutation.isPending ? 'Completing…' : 'Complete checkout'}</button></div>
      </form>
    )}
  </Modal>;
}

function Row({ label, value, emphasis, tone }: { label: string; value: string; emphasis?: boolean; tone?: 'copper' | 'default' }) {
  const valueClass = emphasis ? 'font-semibold' : 'text-ink/60';
  const toneClass = tone === 'copper' ? 'text-copper' : '';
  return <tr className="bg-white"><td className={`px-5 py-2.5 text-ink/55 ${emphasis ? 'font-semibold text-ink' : ''}`}>{label}</td><td className={`px-5 py-2.5 text-right ${valueClass} ${toneClass}`}>{value}</td></tr>;
}
