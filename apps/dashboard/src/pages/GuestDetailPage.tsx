import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, CreditCard, Globe, IdCard, Mail, MapPin, Pencil, Phone, Receipt, ShieldCheck, Wallet } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { adminApi } from '../lib/api';
import type { Invoice, Payment, Reservation, Stay } from '../types';
import { EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, StatCard, StatusBadge } from '../components/Ui';
import { formatDate, formatDateTime, formatMoney } from '../lib/format';

type TabKey = 'reservations' | 'stays' | 'invoices' | 'payments';

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the guest name'),
  mobile: z.string().trim().min(7, 'Enter a valid mobile number'),
  email: z.string().trim().email('Enter a valid email address').or(z.literal('')),
  address: z.string().trim().max(300, 'Address is too long'),
  nationality: z.string().trim().max(80, 'Nationality is too long'),
  idType: z.string().trim().max(40, 'Identity type is too long'),
  idNumber: z.string().trim().max(80, 'Identity number is too long'),
  notes: z.string().trim().max(2000, 'Notes are too long'),
});

type ProfileForm = z.infer<typeof profileSchema>;

const blankProfile: ProfileForm = { fullName: '', mobile: '', email: '', address: '', nationality: '', idType: '', idNumber: '', notes: '' };

function expand<T extends object>(value: string | T | undefined) {
  return value === undefined || typeof value === 'string' ? undefined : value;
}

function toProfilePayload(values: ProfileForm) {
  const payload: Record<string, unknown> = { fullName: values.fullName, mobile: values.mobile };
  if (values.email) payload.email = values.email;
  if (values.address) payload.address = values.address;
  if (values.nationality) payload.nationality = values.nationality;
  if (values.idType) payload.idType = values.idType;
  if (values.idNumber) payload.idNumber = values.idNumber;
  if (values.notes) payload.notes = values.notes;
  return payload;
}

export default function GuestDetailPage() {
  const { id = '' } = useParams();
  const [tab, setTab] = useState<TabKey>('reservations');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileForm>(blankProfile);
  const [issues, setIssues] = useState<Partial<Record<keyof ProfileForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['guest', id], queryFn: () => adminApi.guest(id), enabled: Boolean(id) });

  const detail = query.data;
  const guest = detail?.guest;

  if (query.isLoading) return <LoadingState label="Loading guest profile" />;
  if (query.isError || !guest) return <ErrorState message="This guest profile could not be loaded." onRetry={() => query.refetch()} />;

  const payments = detail.payments;
  const invoices = detail.invoices;
  const stays = detail.stays;
  const reservations = detail.reservations;
  const currency = invoices[0]?.currency ?? payments[0]?.currency ?? 'INR';
  const billed = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const collected = payments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = invoices.reduce((sum, invoice) => sum + Math.max(0, invoice.balance), 0);
  const latestStay = stays[0];
  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'reservations', label: 'Reservations', count: reservations.length },
    { key: 'stays', label: 'Stays', count: stays.length },
    { key: 'invoices', label: 'Invoices', count: invoices.length },
    { key: 'payments', label: 'Payments', count: payments.length },
  ];

  const openEditor = () => {
    setForm({
      fullName: guest.fullName,
      mobile: guest.mobile,
      email: guest.email ?? '',
      address: guest.address ?? '',
      nationality: guest.nationality ?? '',
      idType: guest.idType ?? '',
      idNumber: guest.idNumber ?? '',
      notes: guest.notes ?? '',
    });
    setIssues({});
    setSaveError('');
    setEditing(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      const next: Partial<Record<keyof ProfileForm, string>> = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof ProfileForm] = issue.message;
      setIssues(next);
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await adminApi.updateGuest(guest._id, toProfilePayload(parsed.data));
      await client.invalidateQueries({ queryKey: ['guest', id] });
      await client.invalidateQueries({ queryKey: ['guests'] });
      setEditing(false);
    } catch (error) {
      setSaveError((error as { userMessage?: string }).userMessage ?? 'The guest could not be updated.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Guest profile"
        title={guest.fullName}
        description={`${guest.mobile}${guest.email ? ` · ${guest.email}` : ''} · Guest since ${formatDate(guest.createdAt)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/guests" className="dashboard-button-light">
              <ArrowLeft size={15} />
              All guests
            </Link>
            <button type="button" className="dashboard-button" onClick={openEditor}>
              <Pencil size={15} />
              Edit profile
            </button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Billed to date" value={formatMoney(billed, currency)} detail={`${invoices.length} invoices raised`} icon={<Receipt size={18} />} />
        <StatCard label="Collected" value={formatMoney(collected, currency)} detail={`${payments.filter((payment) => payment.status === 'paid').length} settled payments`} tone="green" icon={<CreditCard size={18} />} />
        <StatCard label="Outstanding" value={formatMoney(outstanding, currency)} detail="Across all open folios" tone="copper" icon={<Wallet size={18} />} />
        <StatCard
          label="Latest stay"
          value={latestStay ? formatDate(latestStay.actualCheckOut ?? latestStay.expectedCheckOut) : '—'}
          detail={latestStay ? `${stays.length} stays · ${reservations.length} reservations` : 'No stays recorded yet'}
          icon={<CalendarDays size={18} />}
        />
      </div>

      <section className="dashboard-card mt-6 p-5 md:p-6">
        <h3 className="font-display text-2xl">Profile</h3>
        <div className="mt-5 grid gap-5 border-t border-ink/10 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Detail icon={<Phone size={14} />} label="Mobile" value={guest.mobile} />
          <Detail icon={<Mail size={14} />} label="Email" value={guest.email ?? 'Not provided'} />
          <Detail icon={<MapPin size={14} />} label="Address" value={guest.address ?? 'Not provided'} />
          <Detail icon={<Globe size={14} />} label="Nationality" value={guest.nationality ?? 'Not provided'} />
          <Detail icon={<IdCard size={14} />} label="Identity" value={guest.idType ? `${guest.idType}${guest.idNumber ? ` · ${guest.idNumber}` : ''}` : 'Not provided'} />
          <Detail icon={<CalendarDays size={14} />} label="Date of birth" value={formatDate(guest.dateOfBirth)} />
          <Detail
            icon={<Phone size={14} />}
            label="Emergency contact"
            value={guest.emergencyContact?.name ? `${guest.emergencyContact.name}${guest.emergencyContact.mobile ? ` · ${guest.emergencyContact.mobile}` : ''}` : 'Not provided'}
          />
          <Detail
            icon={<ShieldCheck size={14} />}
            label="Consent"
            value={`Privacy ${guest.privacyConsent ? 'granted' : 'pending'} · Marketing ${guest.marketingConsent ? 'granted' : 'pending'}`}
          />
        </div>
        {guest.notes && (
          <div className="mt-5 border-t border-ink/10 pt-5">
            <p className="text-xs font-medium text-ink/55">Notes</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink/70">{guest.notes}</p>
          </div>
        )}
      </section>

      <div className="mb-4 mt-8 flex flex-wrap gap-2 border-b border-ink/10">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === key ? 'border-forest text-forest' : 'border-transparent text-ink/45 hover:text-ink'}`}
          >
            {label}
            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${tab === key ? 'bg-forest/10 text-forest' : 'bg-ink/5 text-ink/50'}`}>{count}</span>
          </button>
        ))}
      </div>

      {tab === 'reservations' && <ReservationsTable reservations={reservations} />}
      {tab === 'stays' && <StaysTable stays={stays} />}
      {tab === 'invoices' && <InvoicesTable invoices={invoices} />}
      {tab === 'payments' && <PaymentsTable payments={payments} />}

      {editing && (
        <Modal title="Edit guest profile" onClose={() => setEditing(false)}>
          <form className="mt-7 space-y-4" onSubmit={save} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={issues.fullName}>
                <input className="dashboard-input" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
              </Field>
              <Field label="Mobile" error={issues.mobile}>
                <input className="dashboard-input" value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} />
              </Field>
              <Field label="Email" error={issues.email}>
                <input className="dashboard-input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </Field>
              <Field label="Nationality" error={issues.nationality}>
                <input className="dashboard-input" value={form.nationality} onChange={(event) => setForm({ ...form, nationality: event.target.value })} />
              </Field>
              <Field label="Identity type" error={issues.idType}>
                <input className="dashboard-input" value={form.idType} onChange={(event) => setForm({ ...form, idType: event.target.value })} />
              </Field>
              <Field label="Identity number" error={issues.idNumber}>
                <input className="dashboard-input" value={form.idNumber} onChange={(event) => setForm({ ...form, idNumber: event.target.value })} />
              </Field>
            </div>
            <Field label="Address" error={issues.address}>
              <textarea className="dashboard-input min-h-20" rows={2} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
            </Field>
            <Field label="Notes" error={issues.notes}>
              <textarea className="dashboard-input min-h-24" rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </Field>
            {saveError && <p className="text-sm text-copper">{saveError}</p>}
            <div className="flex justify-end gap-3 border-t border-ink/10 pt-5">
              <button type="button" className="dashboard-button-light" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button type="submit" className="dashboard-button" disabled={saving}>
                {saving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-xs font-medium text-ink/55">
        <span className="text-forest">{icon}</span>
        {label}
      </p>
      <p className="mt-1.5 text-sm leading-6 text-ink/80">{value}</p>
    </div>
  );
}

function TableFrame({ children, minWidth }: { children: ReactNode; minWidth: string }) {
  return (
    <div className="dashboard-card overflow-x-auto">
      <table className="w-full text-left" style={{ minWidth }}>{children}</table>
    </div>
  );
}

function ReservationsTable({ reservations }: { reservations: Reservation[] }) {
  if (!reservations.length) return <EmptyState title="No reservations yet" description="Bookings created for this guest will appear here with their full stay history." />;
  return (
    <TableFrame minWidth="820px">
      <thead className="border-b border-ink/10 bg-sand/60 text-xs font-medium text-ink/55">
        <tr>
          <th className="px-5 py-4">Booking</th>
          <th className="px-5 py-4">Stay</th>
          <th className="px-5 py-4">Room</th>
          <th className="px-5 py-4">Guests</th>
          <th className="px-5 py-4">Total</th>
          <th className="px-5 py-4">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-ink/10">
        {reservations.map((reservation) => (
          <tr key={reservation._id} className="text-sm transition hover:bg-sand/40">
            <td className="px-5 py-4">
              <p className="font-semibold">{reservation.bookingNumber}</p>
              <p className="mt-1 text-xs text-ink/45">{reservation.source.replace('_', ' ')} · booked {formatDate(reservation.createdAt)}</p>
            </td>
            <td className="px-5 py-4">
              <p>{formatDate(reservation.checkIn)}</p>
              <p className="mt-1 text-xs text-ink/45">to {formatDate(reservation.checkOut)} · {reservation.nights} nights</p>
            </td>
            <td className="px-5 py-4">
              <p>{reservation.roomId?.roomNumber ?? '—'}</p>
              <p className="mt-1 text-xs text-ink/45">{reservation.roomTypeId?.name ?? '—'}</p>
            </td>
            <td className="px-5 py-4 text-ink/60">{reservation.guests.adults} adults{reservation.guests.children ? `, ${reservation.guests.children} children` : ''}</td>
            <td className="px-5 py-4 font-semibold">{formatMoney(reservation.pricing.total, reservation.pricing.currency)}</td>
            <td className="px-5 py-4"><StatusBadge status={reservation.status} /></td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

function StaysTable({ stays }: { stays: Stay[] }) {
  if (!stays.length) return <EmptyState title="No stays recorded" description="Checked-in and completed stays for this guest will be listed here." />;
  return (
    <TableFrame minWidth="760px">
      <thead className="border-b border-ink/10 bg-sand/60 text-xs font-medium text-ink/55">
        <tr>
          <th className="px-5 py-4">Room</th>
          <th className="px-5 py-4">Checked in</th>
          <th className="px-5 py-4">Expected out</th>
          <th className="px-5 py-4">Actual out</th>
          <th className="px-5 py-4">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-ink/10">
        {stays.map((stay) => (
          <tr key={stay._id} className="text-sm transition hover:bg-sand/40">
            <td className="px-5 py-4">
              <p className="font-semibold">Room {expand(stay.roomId)?.roomNumber ?? '—'}</p>
              <p className="mt-1 text-xs text-ink/45">Booking {expand(stay.reservationId)?.bookingNumber ?? '—'}</p>
            </td>
            <td className="px-5 py-4 text-ink/70">{formatDateTime(stay.checkInAt)}</td>
            <td className="px-5 py-4 text-ink/70">{formatDateTime(stay.expectedCheckOut)}</td>
            <td className="px-5 py-4 text-ink/70">{stay.actualCheckOut ? formatDateTime(stay.actualCheckOut) : '—'}</td>
            <td className="px-5 py-4"><StatusBadge status={stay.status} /></td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

function InvoicesTable({ invoices }: { invoices: Invoice[] }) {
  if (!invoices.length) return <EmptyState title="No invoices yet" description="Folios raised for this guest will appear here with their payment position." />;
  return (
    <TableFrame minWidth="820px">
      <thead className="border-b border-ink/10 bg-sand/60 text-xs font-medium text-ink/55">
        <tr>
          <th className="px-5 py-4">Invoice</th>
          <th className="px-5 py-4">Issued</th>
          <th className="px-5 py-4">Total</th>
          <th className="px-5 py-4">Paid</th>
          <th className="px-5 py-4">Balance</th>
          <th className="px-5 py-4">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-ink/10">
        {invoices.map((invoice) => (
          <tr key={invoice._id} className="text-sm transition hover:bg-sand/40">
            <td className="px-5 py-4 font-semibold">{invoice.invoiceNumber}</td>
            <td className="px-5 py-4 text-ink/60">{formatDate(invoice.issuedAt ?? invoice.createdAt)}</td>
            <td className="px-5 py-4 font-semibold">{formatMoney(invoice.total, invoice.currency)}</td>
            <td className="px-5 py-4 text-ink/60">{formatMoney(invoice.amountPaid, invoice.currency)}</td>
            <td className={`px-5 py-4 ${invoice.balance > 0 ? 'font-semibold text-copper' : 'text-ink/45'}`}>{formatMoney(invoice.balance, invoice.currency)}</td>
            <td className="px-5 py-4"><StatusBadge status={invoice.status} /></td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

function PaymentsTable({ payments }: { payments: Payment[] }) {
  if (!payments.length) return <EmptyState title="No payments recorded" description="Every payment collected against this guest's folios will be listed here." />;
  return (
    <TableFrame minWidth="720px">
      <thead className="border-b border-ink/10 bg-sand/60 text-xs font-medium text-ink/55">
        <tr>
          <th className="px-5 py-4">Amount</th>
          <th className="px-5 py-4">Method</th>
          <th className="px-5 py-4">Paid at</th>
          <th className="px-5 py-4">Notes</th>
          <th className="px-5 py-4">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-ink/10">
        {payments.map((payment) => (
          <tr key={payment._id} className="text-sm transition hover:bg-sand/40">
            <td className="px-5 py-4 font-semibold">{formatMoney(payment.amount, payment.currency)}</td>
            <td className="px-5 py-4 text-ink/60 capitalize">{payment.method.replace('_', ' ')}</td>
            <td className="px-5 py-4 text-ink/60">{formatDateTime(payment.paidAt ?? payment.createdAt)}</td>
            <td className="px-5 py-4 text-ink/55">{payment.notes ?? '—'}</td>
            <td className="px-5 py-4"><StatusBadge status={payment.status} /></td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}
