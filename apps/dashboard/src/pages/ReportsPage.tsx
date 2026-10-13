import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, BedDouble, CalendarDays, CreditCard, Landmark, ListChecks, Percent, RefreshCw, TrendingUp, Utensils, Wallet } from 'lucide-react';
import { adminApi } from '../lib/api';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatCard, StatusBadge } from '../components/Ui';
import { formatDate, formatMoney } from '../lib/format';

const roomColors: Record<string, string> = { available: '#16a34a', occupied: '#eab308', reserved: '#d97706', dirty: '#ea580c', cleaning: '#f59e0b', maintenance: '#ca8a04', out_of_service: '#dc2626' };

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDayIso(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function endOfRangeIso(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function daysAgo(count: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - count);
  return isoDate(date);
}

function presetRange(preset: string) {
  const today = new Date();
  if (preset === '7') return { from: daysAgo(6), to: isoDate(today) };
  if (preset === '30') return { from: daysAgo(29), to: isoDate(today) };
  if (preset === '90') return { from: daysAgo(89), to: isoDate(today) };
  if (preset === 'month') return { from: isoDate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))), to: isoDate(today) };
  if (preset === 'last-month') {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
    return { from: isoDate(start), to: isoDate(end) };
  }
  return { from: daysAgo(29), to: isoDate(today) };
}

const presets = [
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
  { key: 'month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
];

export default function ReportsPage() {
  const initial = presetRange('30');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [applied, setApplied] = useState({ from: initial.from, to: initial.to });

  const valid = Boolean(applied.from && applied.to) && applied.from <= applied.to;
  const report = useQuery({
    queryKey: ['reports', applied.from, applied.to],
    queryFn: () => adminApi.reports(startOfDayIso(applied.from), endOfRangeIso(applied.to)),
    enabled: valid,
  });
  const hotel = useQuery({ queryKey: ['hotel'], queryFn: adminApi.hotel });
  const currency = hotel.data?.currency ?? 'INR';

  const series = useMemo(() => {
    const days = new Map<string, { date: string; revenue: number; expenses: number }>();
    for (const row of report.data?.revenueByDay ?? []) days.set(row.date, { date: row.date, revenue: row.revenue, expenses: 0 });
    for (const row of report.data?.expensesByDay ?? []) {
      const current = days.get(row.date) ?? { date: row.date, revenue: 0, expenses: 0 };
      current.expenses = row.expenses;
      days.set(row.date, current);
    }
    return [...days.values()].sort((left, right) => left.date.localeCompare(right.date));
  }, [report.data]);

  const applyPreset = (preset: string) => {
    const range = presetRange(preset);
    setFrom(range.from);
    setTo(range.to);
    setApplied(range);
  };

  const applyCustom = () => setApplied({ from, to });

  const data = report.data;
  const revenue = series.reduce((sum, day) => sum + day.revenue, 0);
  const expenses = series.reduce((sum, day) => sum + day.expenses, 0);
  const hasActivity = Boolean(data && (data.revenueByDay.length || data.expensesByDay.length || data.sources.length || data.paymentMethods.length || data.roomPerformance.length));
  const reportDays = data
    ? Math.max(1, Math.round((new Date(data.range.to).getTime() - new Date(data.range.from).getTime()) / 86400000))
    : 0;
  const paymentTotal = (data?.paymentMethods ?? []).reduce((sum, row) => sum + row.total, 0);
  const totalRooms = (data?.occupancy ?? []).filter((row) => row.status !== 'out_of_service').reduce((sum, row) => sum + row.count, 0);

  return (
    <>
      <PageHeader
        eyebrow="Performance"
        title="Reports"
        description="Revenue, expenses and occupancy for any window you choose. Dates are inclusive, and the day after your end date is what the report queries."
        action={
          <button type="button" className="dashboard-button-light" onClick={() => report.refetch()} disabled={!valid}>
            <RefreshCw size={15} />
            Refresh
          </button>
        }
      />

      <div className="dashboard-card mb-6 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="dashboard-label">From</span>
              <input className="dashboard-input" type="date" value={from} max={to} onChange={(event) => { setFrom(event.target.value); setApplied({ from: event.target.value, to }); }} />
            </label>
            <label className="block">
              <span className="dashboard-label">To</span>
              <input className="dashboard-input" type="date" value={to} min={from} onChange={(event) => { setTo(event.target.value); setApplied({ from, to: event.target.value }); }} />
            </label>
          </div>
          <button type="button" className="dashboard-button lg:mb-0" onClick={applyCustom}>
            <CalendarDays size={15} />
            Apply range
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-ink/10 pt-4">
          {presets.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset.key)}
              className={`border px-3 py-1.5 text-xs font-medium transition ${applied.from === presetRange(preset.key).from && applied.to === presetRange(preset.key).to ? 'border-forest bg-forest text-white' : 'border-ink/15 text-ink/55 hover:border-forest hover:text-forest'}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {!valid && <div className="dashboard-card mb-6 border-copper/30 bg-[#eff6ff] p-5 text-sm text-copper">Choose an end date on or after the start date to run the report.</div>}

      {valid && report.isLoading ? <LoadingState label="Building the report" /> : valid && report.isError ? <ErrorState onRetry={() => report.refetch()} /> : !data ? null : !hasActivity ? (
        <EmptyState title="No activity in this period" description="Widen the date range or pick another window to see revenue, occupancy and source performance." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Revenue" value={formatMoney(revenue, currency)} detail={`${reportDays} day window`} tone="green" icon={<TrendingUp size={18} />} />
            <StatCard label="Expenses" value={formatMoney(expenses, currency)} detail="Recorded in this period" tone="copper" icon={<Wallet size={18} />} />
            <StatCard label="Net" value={formatMoney(revenue - expenses, currency)} detail="Revenue less expenses" icon={<Landmark size={18} />} />
            <StatCard label="Restaurant" value={formatMoney(data.restaurantRevenue, currency)} detail="Food and beverage sales" icon={<Utensils size={18} />} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <StatCard label="Occupancy" value={`${data.metrics.occupancy}%`} detail={`${totalRooms} rooms in inventory`} icon={<Percent size={18} />} />
            <StatCard label="Average daily rate" value={formatMoney(data.metrics.adr, currency)} detail="Room revenue per sold night" icon={<BedDouble size={18} />} />
            <StatCard label="RevPAR" value={formatMoney(data.metrics.revpar, currency)} detail="Room revenue per available night" icon={<BarChart3 size={18} />} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <section className="dashboard-card p-5 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-2xl">Revenue and expenses</h3>
                  <p className="mt-1 text-xs text-ink/45">{formatDate(data.range.from)} to {formatDate(data.range.to)}</p>
                </div>
                <TrendingUp size={18} className="text-forest" />
              </div>
              {series.length ? (
                <div className="mt-7 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#0f172a12" />
                      <XAxis dataKey="date" tickFormatter={(value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} tick={{ fontSize: 11, fill: '#0f172a66' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11, fill: '#0f172a66' }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `₹,${Math.round(value / 1000)}k`} />
                      <Tooltip formatter={(value) => formatMoney(Number(value), currency)} labelFormatter={(value) => formatDate(`${value}T00:00:00.000Z`)} />
                      <Bar dataKey="revenue" name="Revenue" fill="#2563eb" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#93c5fd" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="py-16 text-center text-sm text-ink/45">No revenue or expenses were recorded in this window.</p>}
            </section>

            <section className="dashboard-card p-5 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-2xl">Room status</h3>
                  <p className="mt-1 text-xs text-ink/45">Inventory snapshot</p>
                </div>
                <BedDouble size={18} className="text-forest" />
              </div>
              {data.occupancy.length ? (
                <>
                  <div className="mt-5 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.occupancy} dataKey="count" nameKey="status" innerRadius={55} outerRadius={78} paddingAngle={3}>
                          {data.occupancy.map((entry) => <Cell key={entry.status} fill={roomColors[entry.status] ?? '#9ca3af'} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {data.occupancy.map((room) => (
                      <div key={room.status} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 capitalize text-ink/55">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: roomColors[room.status] ?? '#9ca3af' }} />
                          {room.status.replace('_', ' ')}
                        </span>
                        <span className="font-semibold">{room.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="py-16 text-center text-sm text-ink/45">No room inventory reported.</p>}
            </section>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="dashboard-card overflow-x-auto">
              <div className="flex items-center justify-between p-5 md:p-6">
                <div>
                  <h3 className="font-display text-2xl">Booking sources</h3>
                  <p className="mt-1 text-xs text-ink/45">Reservations created in this window</p>
                </div>
                <BarChart3 size={18} className="text-copper" />
              </div>
              {data.sources.length ? (
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="border-y border-ink/10 bg-sand/60 text-xs font-medium text-ink/55">
                    <tr>
                      <th className="px-5 py-3">Source</th>
                      <th className="px-5 py-3 text-right">Bookings</th>
                      <th className="px-5 py-3 text-right">Cancelled</th>
                      <th className="px-5 py-3 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/10">
                    {data.sources.map((row) => (
                      <tr key={row.source}>
                        <td className="px-5 py-3 font-semibold capitalize">{row.source.replace('_', ' ')}</td>
                        <td className="px-5 py-3 text-right text-ink/60">{row.count}</td>
                        <td className="px-5 py-3 text-right text-ink/60">{row.cancellations}</td>
                        <td className="px-5 py-3 text-right font-semibold">{formatMoney(row.revenue, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="p-8 pb-10 text-center text-sm text-ink/45">No bookings were created in this window.</p>}
            </section>

            <section className="dashboard-card p-5 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-2xl">Payment methods</h3>
                  <p className="mt-1 text-xs text-ink/45">Collections by tender</p>
                </div>
                <CreditCard size={18} className="text-forest" />
              </div>
              {data.paymentMethods.length ? (
                <div className="mt-5 space-y-4">
                  {data.paymentMethods.map((row) => (
                    <div key={row.method}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-semibold capitalize"><CreditCard size={14} className="text-ink/40" />{row.method.replace('_', ' ')}</span>
                        <span className="text-ink/60">{formatMoney(row.total, currency)} · {row.count}</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full bg-ink/5">
                        <div className="h-full bg-forest" style={{ width: `${paymentTotal ? Math.round((row.total / paymentTotal) * 100) : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="py-12 text-center text-sm text-ink/45">No payments were collected in this window.</p>}
            </section>
          </div>

          <section className="dashboard-card mt-6 overflow-x-auto">
            <div className="flex items-center justify-between p-5 md:p-6">
              <div>
                <h3 className="font-display text-2xl">Room performance</h3>
                <p className="mt-1 text-xs text-ink/45">Top rooms by realised room revenue</p>
              </div>
              <ListChecks size={18} className="text-copper" />
            </div>
            {data.roomPerformance.length ? (
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-y border-ink/10 bg-sand/60 text-xs font-medium text-ink/55">
                  <tr>
                    <th className="px-5 py-3">Room</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Reservations</th>
                    <th className="px-5 py-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {data.roomPerformance.map((row) => (
                    <tr key={row.roomNumber} className="transition hover:bg-sand/40">
                      <td className="px-5 py-3 font-semibold">Room {row.roomNumber}</td>
                      <td className="px-5 py-3"><StatusBadge status={row.status} /></td>
                      <td className="px-5 py-3 text-right text-ink/60">{row.reservations}</td>
                      <td className="px-5 py-3 text-right font-semibold">{formatMoney(row.revenue, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="p-8 pb-10 text-center text-sm text-ink/45">No rooms recorded revenue in this window.</p>}
          </section>
        </>
      )}
    </>
  );
}
