import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Guest } from '../types';
import { adminApi } from '../lib/api';
import { EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader } from '../components/Ui';
import { formatDate } from '../lib/format';

type GuestPage = {
  data: Guest[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

type GuestForm = {
  fullName: string;
  mobile: string;
  email: string;
  nationality: string;
  address: string;
  privacyConsent: boolean;
  marketingConsent: boolean;
};

function initialGuestForm(): GuestForm {
  return { fullName: '', mobile: '', email: '', nationality: '', address: '', privacyConsent: false, marketingConsent: false };
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'userMessage' in error) {
    const message = (error as { userMessage?: unknown }).userMessage;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

async function loadGuestPage(params: { search?: string; page: number }): Promise<GuestPage> {
  const result = await adminApi.guestsPage({ search: params.search, page: params.page, limit: 100 });
  return { data: Array.isArray(result.data) ? (result.data as unknown as Guest[]) : [], meta: result.meta };
}

export default function GuestsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['guests', search, page], queryFn: () => loadGuestPage({ search: search || undefined, page }) });
  const guests = query.data?.data ?? [];
  const meta = query.data?.meta;
  const totalPages = Math.max(1, meta?.pages ?? 1);
  const currentPage = meta?.page ?? page;
  const total = meta?.total ?? guests.length;
  const saved = () => {
    setCreateOpen(false);
    setPage(1);
    void queryClient.invalidateQueries({ queryKey: ['guests'] });
  };

  return <>
    <PageHeader eyebrow="Guest directory" title="Guests" description="The people behind every stay." action={<button type="button" className="dashboard-button" onClick={() => setCreateOpen(true)}><UserPlus size={16} />Add guest</button>} />
    <div className="dashboard-card mb-6 p-4"><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" /><input className="dashboard-input pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search name, mobile, or email" /></div></div>
    {query.isLoading ? <LoadingState label="Loading guests" /> : query.isError ? <ErrorState onRetry={() => query.refetch()} /> : guests.length ? <>
      <div className="dashboard-card overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead className="border-b border-ink/10 bg-sand/60 text-xs font-medium text-ink/55"><tr><th className="px-5 py-4">Guest</th><th className="px-5 py-4">Contact</th><th className="px-5 py-4">Nationality</th><th className="px-5 py-4">Added</th><th /></tr></thead><tbody className="divide-y divide-ink/10">{guests.map((guest) => <tr key={guest._id} className="text-sm hover:bg-sand/40"><td className="px-5 py-4 font-semibold">{guest.fullName}</td><td className="px-5 py-4"><p>{guest.mobile}</p><p className="mt-1 text-xs text-ink/45">{guest.email ?? 'No email'}</p></td><td className="px-5 py-4 text-ink/60">{guest.nationality ?? '—'}</td><td className="px-5 py-4 text-ink/55">{formatDate(guest.createdAt)}</td><td className="px-5 py-4 text-right"><Link className="text-xs font-semibold text-forest" to={`/guests/${guest._id}`}>View</Link></td></tr>)}</tbody></table></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-ink/45"><span>Showing {guests.length} of {total} guests</span><div className="flex items-center gap-2"><button type="button" className="dashboard-button-light" disabled={currentPage <= 1 || query.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><span>Page {currentPage} of {totalPages}</span><button type="button" className="dashboard-button-light" disabled={currentPage >= totalPages || query.isFetching} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button></div></div>
    </> : <EmptyState title="No guests found" description="Guests appear here after their first reservation or when you add them directly." />}
    {createOpen && <CreateGuestModal onClose={() => setCreateOpen(false)} onSaved={saved} />}
  </>;
}

function CreateGuestModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<GuestForm>(initialGuestForm);
  const [error, setError] = useState('');
  const mutation = useMutation({ mutationFn: (data: Record<string, unknown>) => adminApi.createGuest(data), onSuccess: () => onSaved() });
  const update = (values: Partial<GuestForm>) => setForm((current) => ({ ...current, ...values }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const fullName = form.fullName.trim();
    const mobile = form.mobile.trim();
    const email = form.email.trim();
    if (fullName.length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (mobile.length < 7) {
      setError('Mobile number must be at least 7 characters.');
      return;
    }
    if (!form.privacyConsent) {
      setError('Privacy consent is required.');
      return;
    }
    const payload: Record<string, unknown> = {
      fullName,
      mobile,
      ...(email ? { email } : {}),
      ...(form.nationality.trim() ? { nationality: form.nationality.trim() } : {}),
      ...(form.address.trim() ? { address: form.address.trim() } : {}),
      privacyConsent: form.privacyConsent,
      marketingConsent: form.marketingConsent,
    };
    mutation.mutate(payload);
  };

  return <Modal title="Add guest" onClose={onClose}><form className="mt-7 space-y-4" onSubmit={submit}><div className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><input className="dashboard-input" value={form.fullName} minLength={2} required onChange={(event) => update({ fullName: event.target.value })} /></Field><Field label="Mobile"><input className="dashboard-input" value={form.mobile} minLength={7} required onChange={(event) => update({ mobile: event.target.value })} /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Email (optional)"><input className="dashboard-input" type="email" value={form.email} onChange={(event) => update({ email: event.target.value })} /></Field><Field label="Nationality"><input className="dashboard-input" value={form.nationality} onChange={(event) => update({ nationality: event.target.value })} /></Field></div><Field label="Address"><input className="dashboard-input" value={form.address} onChange={(event) => update({ address: event.target.value })} /></Field><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 accent-forest" checked={form.privacyConsent} required onChange={(event) => update({ privacyConsent: event.target.checked })} /><span>I have the guest's consent to store their personal information.</span></label><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 accent-forest" checked={form.marketingConsent} onChange={(event) => update({ marketingConsent: event.target.checked })} /><span>Guest has opted in to marketing communications.</span></label>{error && <p className="text-sm text-copper">{error}</p>}{mutation.isError && <p className="text-sm text-copper">{errorMessage(mutation.error, 'Guest could not be created.')}</p>}<div className="flex justify-end gap-3 border-t border-ink/10 pt-5"><button type="button" className="dashboard-button-light" onClick={onClose}>Cancel</button><button type="submit" className="dashboard-button" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save guest'}</button></div></form></Modal>;
}
