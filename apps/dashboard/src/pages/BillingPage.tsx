import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Eye, Landmark, Receipt, Search, Wallet, X } from 'lucide-react';
import { adminApi } from '../lib/api';
import type { Guest, InvoiceItem, PaymentMethod, Reservation } from '../types';
import { EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, StatCard, StatusBadge } from '../components/Ui';
import { formatDate, formatDateTime, formatMoney } from '../lib/format';

type TabKey = 'invoices' | 'payments';

const paymentMethods: PaymentMethod[] = ['cash', 'upi', 'card', 'bank_transfer', 'razorpay'];
const invoiceStatuses = ['draft', 'issued', 'partially_paid', 'paid', 'void'];

function guestLabel(value: string | Guest | undefined) {
  return typeof value === 'string' ? '' : value?.fullName ?? '';
}

function bookingLabel(value: string | Reservation | undefined) {
  return typeof value === 'string' ? '' : value?.bookingNumber ?? '';
}

function MutationError({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="text-sm text-copper">{(error as { userMessage?: string }).userMessage ?? 'The request could not be completed.'}</p>;
}

export default function BillingPage() {
  const [tab, setTab] = useState<TabKey>('invoices');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const client = useQueryClient();

  const invoices = useQuery({ queryKey: ['invoices'], queryFn: adminApi.invoices, refetchInterval: 60_000 });
  const payments = useQuery({ queryKey: ['payments', paymentStatus], queryFn: () => adminApi.payments({ status: paymentStatus || undefined }), refetchInterval: 60_000 });

  const invoiceRows = (invoices.data ?? []).filter((invoice) => {
    if (invoiceStatus && invoice.status !== invoiceStatus) return false;
    if (!invoiceSearch.trim()) return true;
    const needle = invoiceSearch.trim().toLowerCase();
    return invoice.invoiceNumber.toLowerCase().includes(needle) || guestLabel(invoice.guestId).toLowerCase().includes(needle);
  });
  const paymentRows = (payments.data ?? []).filter((payment) => {
    if (!paymentSearch.trim()) return true;
    const needle = paymentSearch.trim().toLowerCase();
    return guestLabel(payment.guestId).toLowerCase().includes(needle)
      || bookingLabel(payment.reservationId).toLowerCase().includes(needle)
      || (payment.notes ?? '').toLowerCase().includes(needle);
  });

  const billed = (invoices.data ?? []).reduce((sum, invoice) => sum + invoice.total, 0);
  const settled = (invoices.data ?? []).reduce((sum, invoice) => sum + invoice.amountPaid, 0);
  const outstanding = (invoices.data ?? []).reduce((sum, invoice) => sum + Math.max(0, invoice.balance), 0);
  const invoiceCurrency = invoices.data?.[0]?.currency ?? 'INR';
  const collected = (payments.data ?? []).filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + payment.amount, 0);
  const refunded = (payments.data ?? []).reduce((sum, payment) => sum + (payment.refundAmount ?? 0), 0);
  const paymentCurrency = payments.data?.[0]?.currency ?? 'INR';
  const openInvoices = (invoices.data ?? []).filter((invoice) => invoice.balance > 0 && invoice.status !== 'void');

  return (
    <>
      <PageHeader
        eyebrow="Accounts"
        title="Billing"
        description="Every folio raised, every payment collected, and what is still owed."
      />

      <div className="mb-6 flex gap-2 border-b border-ink/10">
        {(['invoices', 'payments'] as TabKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`border-b-2 px-4 py-3 text-sm font-semibold capitalize ${tab === key ? 'border-forest text-forest' : 'border-transparent text-ink/45 hover:text-ink'}`}
          >
            {key}
            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${tab === key ? 'bg-forest/10 text-forest' : 'bg-ink/5 text-ink/50'}`}>
              {key === 'invoices' ? invoices.data?.length ?? 0 : payments.data?.length ?? 0}
            </span>
          </button>
        ))}
      </div>

      {tab === 'invoices' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Billed" value={formatMoney(billed, invoiceCurrency)} detail={`${invoices.data?.length ?? 0} invoices raised`} icon={<Receipt size={18} />} />
            <StatCard label="Collected" value={formatMoney(settled, invoiceCurrency)} detail="Payments applied to invoices" tone="green" icon={<CreditCard size={18} />} />
            <StatCard label="Outstanding" value={formatMoney(outstanding, invoiceCurrency)} detail={`${openInvoices.length} invoices need attention`} tone="copper" icon={<Wallet size={18} />} />
            <StatCard label="Settled in full" value={(invoices.data ?? []).filter((invoice) => invoice.status === 'paid').length} detail="Closed folios" icon={<Landmark size={18} />} />
          </div>

          <div className="dashboard-card my-6 flex flex-col gap-3 p-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
              <input className="dashboard-input pl-9" value={invoiceSearch} onChange={(event) => setInvoiceSearch(event.target.value)} placeholder="Search invoice number or guest" />
            </div>
            <select className="dashboard-input w-auto min-w-40" value={invoiceStatus} onChange={(event) => setInvoiceStatus(event.target.value)} aria-label="Filter by invoice status">
              <option value="">All statuses</option>
              {invoiceStatuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
            </select>
            {(invoiceSearch || invoiceStatus) && (
              <button type="button" className="dashboard-button-light px-3" aria-label="Clear filters" onClick={() => { setInvoiceSearch(''); setInvoiceStatus(''); }}>
                <X size={15} />
              </button>
            )}
          </div>

          {invoices.isLoading ? <LoadingState label="Loading invoices" /> : invoices.isError ? <ErrorState onRetry={() => invoices.refetch()} /> : !invoiceRows.length ? (
            <EmptyState title="No invoices to show" description="Folios are raised automatically when a reservation is created and again at checkout." />
          ) : (
            <div className="dashboard-card overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left">
                <thead className="border-b border-ink/10 bg-sand/60 text-xs font-medium text-ink/55">
                  <tr>
                    <th className="px-5 py-4">Invoice</th>
                    <th className="px-5 py-4">Guest</th>
                    <th className="px-5 py-4">Booking</th>
                    <th className="px-5 py-4">Issued</th>
                    <th className="px-5 py-4">Total</th>
                    <th className="px-5 py-4">Paid</th>
                    <th className="px-5 py-4">Balance</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {invoiceRows.map((invoice) => (
                    <tr key={invoice._id} className="text-sm transition hover:bg-sand/40">
                      <td className="px-5 py-4 font-semibold">{invoice.invoiceNumber}</td>
                      <td className="px-5 py-4 text-ink/70">{guestLabel(invoice.guestId) || '—'}</td>
                      <td className="px-5 py-4 text-ink/60">{bookingLabel(invoice.reservationId) || '—'}</td>
                      <td className="px-5 py-4 text-ink/60">{formatDate(invoice.issuedAt ?? invoice.createdAt)}</td>
                      <td className="px-5 py-4 font-semibold">{formatMoney(invoice.total, invoice.currency)}</td>
                      <td className="px-5 py-4 text-ink/60">{formatMoney(invoice.amountPaid, invoice.currency)}</td>
                      <td className={`px-5 py-4 ${invoice.balance > 0 ? 'font-semibold text-copper' : 'text-ink/45'}`}>{formatMoney(invoice.balance, invoice.currency)}</td>
                      <td className="px-5 py-4"><StatusBadge status={invoice.status} /></td>
                      <td className="px-5 py-4 text-right">
                        <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold text-forest" onClick={() => setOpenInvoiceId(invoice._id)}>
                          <Eye size={14} />
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'payments' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Collected" value={formatMoney(collected, paymentCurrency)} detail="Payments marked as paid" tone="green" icon={<CreditCard size={18} />} />
            <StatCard label="Payments" value={paymentRows.length} detail="Matching the current filter" icon={<Receipt size={18} />} />
            <StatCard label="Refunded" value={formatMoney(refunded, paymentCurrency)} detail="Reversals recorded against payments" tone="copper" icon={<Landmark size={18} />} />
          </div>

          <div className="dashboard-card my-6 flex flex-col gap-3 p-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
              <input className="dashboard-input pl-9" value={paymentSearch} onChange={(event) => setPaymentSearch(event.target.value)} placeholder="Search guest, booking, or note" />
            </div>
            <select className="dashboard-input w-auto min-w-40" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} aria-label="Filter by payment status">
              <option value="">All statuses</option>
              {['paid', 'pending', 'partially_paid', 'failed', 'refunded', 'partially_refunded'].map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
            </select>
            {paymentSearch && (
              <button type="button" className="dashboard-button-light px-3" aria-label="Clear search" onClick={() => setPaymentSearch('')}>
                <X size={15} />
              </button>
            )}
          </div>

          {payments.isLoading ? <LoadingState label="Loading payments" /> : payments.isError ? <ErrorState onRetry={() => payments.refetch()} /> : !paymentRows.length ? (
            <EmptyState title="No payments to show" description="Payments recorded at the front desk, at checkout, or against an invoice appear here." />
          ) : (
            <div className="dashboard-card overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="border-b border-ink/10 bg-sand/60 text-xs font-medium text-ink/55">
                  <tr>
                    <th className="px-5 py-4">Amount</th>
                    <th className="px-5 py-4">Method</th>
                    <th className="px-5 py-4">Guest</th>
                    <th className="px-5 py-4">Booking</th>
                    <th className="px-5 py-4">Paid at</th>
                    <th className="px-5 py-4">Notes</th>
                    <th className="px-5 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {paymentRows.map((payment) => (
                    <tr key={payment._id} className="text-sm transition hover:bg-sand/40">
                      <td className="px-5 py-4 font-semibold">{formatMoney(payment.amount, payment.currency)}</td>
                      <td className="px-5 py-4 capitalize text-ink/70">{payment.method.replace('_', ' ')}</td>
                      <td className="px-5 py-4 text-ink/70">{guestLabel(payment.guestId) || '—'}</td>
                      <td className="px-5 py-4 text-ink/60">{bookingLabel(payment.reservationId) || '—'}</td>
                      <td className="px-5 py-4 text-ink/60">{formatDateTime(payment.paidAt ?? payment.createdAt)}</td>
                      <td className="px-5 py-4 text-ink/55">{payment.notes ?? '—'}</td>
                      <td className="px-5 py-4"><StatusBadge status={payment.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {openInvoiceId && <InvoiceDetailModal invoiceId={openInvoiceId} onClose={() => setOpenInvoiceId(null)} onRecorded={() => client.invalidateQueries({ queryKey: ['payments'] })} />}
    </>
  );
}

function InvoiceDetailModal({ invoiceId, onClose, onRecorded }: { invoiceId: string; onClose: () => void; onRecorded: () => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [recorded, setRecorded] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['invoice', invoiceId], queryFn: () => adminApi.invoice(invoiceId) });
  const record = useMutation({
    mutationFn: (data: Record<string, unknown>) => adminApi.createPayment(data),
    onSuccess: async () => {
      setRecorded(true);
      onRecorded();
      await client.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      await client.invalidateQueries({ queryKey: ['invoices'] });
      await client.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  const invoice = query.data;
  const items = ((invoice?.items ?? []) as unknown as InvoiceItem[]);
  const value = Number(amount);
  const invalid = amount.trim() === '' || !Number.isFinite(value) || value <= 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (invalid) {
      setFieldError('Enter an amount greater than zero.');
      return;
    }
    setFieldError('');
    const data: Record<string, unknown> = { invoiceId, amount: value, method };
    if (notes.trim()) data.notes = notes.trim();
    record.mutate(data);
  };

  return (
    <Modal title={invoice ? invoice.invoiceNumber : 'Invoice'} onClose={onClose} wide>
      {query.isLoading ? <LoadingState label="Loading invoice" /> : query.isError || !invoice ? <ErrorState onRetry={() => query.refetch()} /> : (
        <div className="mt-7 space-y-6">
          <div className="grid gap-5 border-b border-ink/10 pb-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-ink/55">Guest</p>
              <p className="mt-1 text-sm text-ink/80">{guestLabel(invoice.guestId) || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink/55">Booking</p>
              <p className="mt-1 text-sm text-ink/80">{bookingLabel(invoice.reservationId) || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink/55">Issued</p>
              <p className="mt-1 text-sm text-ink/80">{formatDate(invoice.issuedAt ?? invoice.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink/55">Status</p>
              <div className="mt-1"><StatusBadge status={invoice.status} /></div>
            </div>
          </div>

          <section>
            <h4 className="font-display text-2xl">Line items</h4>
            {items.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="border-b border-ink/10 text-xs font-medium text-ink/55">
                    <tr>
                      <th className="py-3">Description</th>
                      <th className="py-3">Type</th>
                      <th className="py-3 text-right">Qty</th>
                      <th className="py-3 text-right">Unit</th>
                      <th className="py-3 text-right">Tax</th>
                      <th className="py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/10">
                    {items.map((item) => (
                      <tr key={item._id}>
                        <td className="py-3 pr-4">
                          <p className="font-semibold">{item.description}</p>
                          {item.serviceDate && <p className="mt-0.5 text-xs text-ink/45">{formatDate(item.serviceDate)}</p>}
                        </td>
                        <td className="py-3 capitalize text-ink/60">{item.type.replace('_', ' ')}</td>
                        <td className="py-3 text-right text-ink/60">{item.quantity}</td>
                        <td className="py-3 text-right text-ink/60">{formatMoney(item.unitPrice, invoice.currency)}</td>
                        <td className="py-3 text-right text-ink/60">{formatMoney(item.taxAmount, invoice.currency)}</td>
                        <td className="py-3 text-right font-semibold">{formatMoney(item.amount, invoice.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="mt-3 text-sm text-ink/50">No line items are attached to this invoice.</p>}
          </section>

          <section className="ml-auto w-full max-w-sm space-y-2 border-t border-ink/10 pt-5 text-sm">
            <Row label="Rooms" value={formatMoney(invoice.roomSubtotal, invoice.currency)} />
            <Row label="Services" value={formatMoney(invoice.servicesSubtotal, invoice.currency)} />
            <Row label="Subtotal" value={formatMoney(invoice.subtotal, invoice.currency)} />
            <Row label="Tax" value={formatMoney(invoice.tax, invoice.currency)} />
            {invoice.discount > 0 && <Row label="Discount" value={`- ${formatMoney(invoice.discount, invoice.currency)}`} />}
            <Row label="Total" value={formatMoney(invoice.total, invoice.currency)} emphasis />
            <Row label="Paid" value={formatMoney(invoice.amountPaid, invoice.currency)} />
            <Row label="Balance" value={formatMoney(invoice.balance, invoice.currency)} emphasis tone={invoice.balance > 0 ? 'copper' : 'default'} />
          </section>

          <section className="border-t border-ink/10 pt-5">
            <h4 className="font-display text-2xl">Record a payment</h4>
            {invoice.balance <= 0 || invoice.status === 'void' ? (
              <p className="mt-3 text-sm text-ink/55">
                {invoice.status === 'void' ? 'This invoice is void and cannot take payments.' : 'This invoice is fully settled. No further payment is required.'}
              </p>
            ) : recorded ? (
              <p className="mt-3 text-sm text-forest">Payment recorded. The balance above has been refreshed from the server.</p>
            ) : (
              <form className="mt-4 space-y-4" onSubmit={submit} noValidate>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={`Amount (balance ${formatMoney(invoice.balance, invoice.currency)})`} error={fieldError || undefined}>
                    <input className="dashboard-input" type="number" min="0" step="0.01" placeholder={String(invoice.balance)} value={amount} onChange={(event) => setAmount(event.target.value)} />
                  </Field>
                  <Field label="Method">
                    <select className="dashboard-input" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
                      {paymentMethods.map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
                    </select>
                  </Field>
                  <Field label="Notes">
                    <input className="dashboard-input" maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} />
                  </Field>
                </div>
                <MutationError error={record.error} />
                <div className="flex justify-end gap-3">
                  <button type="button" className="dashboard-button-light" onClick={() => { setAmount(String(invoice.balance)); setFieldError(''); }}>
                    Use full balance
                  </button>
                  <button type="submit" className="dashboard-button" disabled={record.isPending}>{record.isPending ? 'Recording…' : 'Record payment'}</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value, emphasis, tone = 'default' }: { label: string; value: string; emphasis?: boolean; tone?: 'default' | 'copper' }) {
  return (
    <div className="flex items-center justify-between">
      <span className={emphasis ? 'font-semibold text-ink' : 'text-ink/55'}>{label}</span>
      <span className={`${emphasis ? 'font-semibold' : ''} ${tone === 'copper' ? 'text-copper' : 'text-ink'}`}>{value}</span>
    </div>
  );
}
