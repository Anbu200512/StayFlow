import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarRange, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { adminApi } from '../lib/api';
import type { RoomRate, RoomType } from '../types';
import { EmptyState, ErrorState, Field, LoadingState, PageHeader } from '../components/Ui';
import { formatMoney } from '../lib/format';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function parseKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function spanDays(rate: RoomRate) {
  return Math.round((parseKey(dateKey(new Date(rate.endDate))).getTime() - parseKey(dateKey(new Date(rate.startDate))).getTime()) / 86_400_000) + 1;
}

function covers(rate: RoomRate, key: string) {
  if (key < dateKey(new Date(rate.startDate)) || key > dateKey(new Date(rate.endDate))) return false;
  if (rate.daysOfWeek?.length && !rate.daysOfWeek.includes(parseKey(key).getDay())) return false;
  return true;
}

function pickRate(rates: RoomRate[], key: string) {
  return rates
    .filter((rate) => covers(rate, key))
    .sort((a, b) => spanDays(a) - (a.daysOfWeek?.length ? 0.5 : 0) - (spanDays(b) - (b.daysOfWeek?.length ? 0.5 : 0)))[0];
}

export default function RatesPage() {
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [error, setError] = useState('');
  const client = useQueryClient();

  const roomTypes = useQuery({ queryKey: ['room-types'], queryFn: adminApi.roomTypes });
  const rates = useQuery({ queryKey: ['room-rates', selectedTypeId], queryFn: () => adminApi.roomRates(selectedTypeId!), enabled: Boolean(selectedTypeId) });

  useEffect(() => {
    if (!selectedTypeId && roomTypes.data?.length) setSelectedTypeId(roomTypes.data[0]._id);
  }, [roomTypes.data, selectedTypeId]);

  const selectedType: RoomType | undefined = roomTypes.data?.find((type) => type._id === selectedTypeId);
  const rateList = useMemo(() => rates.data ?? [], [rates.data]);
  const basePrice = selectedType?.basePrice ?? 0;
  const currency = selectedType?.currency ?? 'INR';

  const cells = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    const grid: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) grid.push(new Date(anchor.getFullYear(), anchor.getMonth(), day));
    return grid;
  }, [anchor]);

  const todayKey = dateKey(new Date());
  const selectionStart = rangeStart;
  const selectionEnd = rangeEnd ?? rangeStart;
  const inSelection = (key: string) => Boolean(selectionStart && selectionEnd && key >= selectionStart && key <= selectionEnd);

  const applyRate = (key: string) => {
    setError('');
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(key);
      setRangeEnd(null);
      return;
    }
    if (key < rangeStart) {
      setRangeEnd(rangeStart);
      setRangeStart(key);
    } else {
      setRangeEnd(key);
    }
  };

  const reset = () => { setRangeStart(null); setRangeEnd(null); setPrice(''); setDays([]); };
  const invalidate = () => void client.invalidateQueries({ queryKey: ['room-rates', selectedTypeId] });

  const save = useMutation({
    mutationFn: () => adminApi.createRoomRate({ roomTypeId: selectedTypeId!, startDate: selectionStart!, endDate: selectionEnd!, price: Number(price), daysOfWeek: days.length ? days : undefined }),
    onSuccess: () => { invalidate(); reset(); },
    onError: () => setError('Could not save that rate. Check the price and try again.'),
  });
  const clear = useMutation({
    mutationFn: () => adminApi.clearRoomRates({ roomTypeId: selectedTypeId!, startDate: selectionStart!, endDate: selectionEnd! }),
    onSuccess: () => { invalidate(); reset(); },
    onError: () => setError('Could not clear those rates.'),
  });
  const remove = useMutation({ mutationFn: (id: string) => adminApi.deleteRoomRate(id), onSuccess: invalidate });

  const submit = () => {
    if (!selectedTypeId || !selectionStart) { setError('Select a room type and pick at least one date.'); return; }
    if (!price.trim() || Number(price) < 0 || Number.isNaN(Number(price))) { setError('Enter a valid nightly price.'); return; }
    save.mutate();
  };

  const monthLabel = anchor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const shift = (amount: number) => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + amount, 1));

  return <>
    <PageHeader eyebrow="Revenue" title="Rates & seasons" description="Set nightly prices for any date range. Nights without a rate fall back to the room type's base price." />
    {roomTypes.isLoading ? <LoadingState label="Loading room types" /> : roomTypes.isError ? <ErrorState onRetry={() => roomTypes.refetch()} /> : !roomTypes.data?.length ? (
      <EmptyState title="No room types yet" description="Create a room type before setting seasonal rates." />
    ) : (
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <div className="dashboard-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/40">Room types</p>
            <div className="mt-3 space-y-2">
              {roomTypes.data.map((type) => <button key={type._id} type="button" onClick={() => { setSelectedTypeId(type._id); reset(); }} className={`flex w-full flex-col items-start border px-3 py-2.5 text-left transition ${type._id === selectedTypeId ? 'border-forest bg-forest/5' : 'border-ink/10 hover:border-forest/40'}`}><span className="text-sm font-semibold">{type.name}</span><span className="mt-0.5 text-xs text-ink/45">Base {formatMoney(type.basePrice, type.currency)} / night</span></button>)}
            </div>
          </div>

          <div className="dashboard-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/40">Set a price</p>
            <p className="mt-2 text-xs leading-5 text-ink/50">{selectionStart ? `Selected ${selectionStart}${selectionEnd && selectionEnd !== selectionStart ? ` → ${selectionEnd}` : ''}` : 'Click a day, then click another to select a range.'}</p>
            <div className="mt-4 space-y-4">
              <Field label="Nightly price" required>
                <input className="dashboard-input" type="number" min="0" step="1" placeholder={String(basePrice)} value={price} onChange={(event) => setPrice(event.target.value)} />
              </Field>
              <div>
                <p className="mb-2 text-xs font-medium text-ink/55">Only on these weekdays (optional)</p>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((label, index) => <button key={label} type="button" onClick={() => setDays((current) => current.includes(index) ? current.filter((day) => day !== index) : [...current, index])} className={`px-2 py-1 text-xs font-medium transition ${days.includes(index) ? 'bg-forest text-white' : 'bg-ink/5 text-ink/55 hover:bg-ink/10'}`}>{label.slice(0, 1)}</button>)}
                </div>
              </div>
              {error && <p className="text-sm text-copper">{error}</p>}
              <div className="flex gap-2">
                <button type="button" className="dashboard-button flex-1" onClick={submit} disabled={save.isPending || !selectionStart}>{save.isPending ? 'Saving…' : 'Save rate'}</button>
                <button type="button" className="dashboard-button-light" onClick={() => clear.mutate()} disabled={clear.isPending || !selectionStart} title="Remove rates fully inside the selection"><Trash2 size={15} /></button>
              </div>
              {selectionStart && <button type="button" className="text-xs font-semibold text-ink/45 underline" onClick={reset}>Clear selection</button>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="dashboard-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><CalendarRange size={18} className="text-forest" /><h2 className="font-display text-xl">{monthLabel}</h2></div>
              <div className="flex items-center gap-2"><button type="button" className="dashboard-button-light px-2" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button><button type="button" className="dashboard-button-light px-2" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={16} /></button></div>
            </div>
            {rates.isLoading ? <LoadingState label="Loading rates" /> : rates.isError ? <ErrorState onRetry={() => rates.refetch()} /> : (
              <>
                <div className="mt-5 grid grid-cols-7 gap-px text-center text-[10px] font-semibold uppercase tracking-wide text-ink/40">{WEEKDAYS.map((label) => <div key={label} className="pb-2">{label}</div>)}</div>
                <div className="grid grid-cols-7 gap-px bg-ink/5">
                  {cells.map((date, index) => {
                    if (!date) return <div key={`blank-${index}`} className="min-h-[80px] bg-white" />;
                    const key = dateKey(date);
                    const override = pickRate(rateList, key);
                    const value = override?.price ?? basePrice;
                    return <button key={key} type="button" onClick={() => applyRate(key)} className={`flex min-h-[80px] flex-col items-start gap-1.5 p-2 text-left transition ${inSelection(key) ? 'bg-forest/10' : 'bg-white hover:bg-sand/40'} ${key === todayKey ? 'ring-1 ring-inset ring-forest' : ''}`}>
                      <span className="text-xs text-ink/40">{date.getDate()}</span>
                      <span className={`text-xs font-semibold ${override ? 'text-forest' : 'text-ink/35'}`}>{formatMoney(value, currency)}</span>
                    </button>;
                  })}
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-ink/45"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-forest" />Custom rate</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ink/20" />Base price</span></div>
              </>
            )}
          </div>

          <div className="dashboard-card p-5">
            <h2 className="font-display text-xl">Active overrides</h2>
            {!rateList.length ? <p className="mt-3 text-sm text-ink/45">No custom rates for this room type yet — all nights use the base price.</p> : (
              <div className="mt-4 divide-y divide-ink/5">
                {rateList.map((rate) => <div key={rate._id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold">{formatMoney(rate.price, currency)} / night</p>
                    <p className="mt-0.5 text-xs text-ink/45">{dateKey(new Date(rate.startDate))}{dateKey(new Date(rate.endDate)) !== dateKey(new Date(rate.startDate)) ? ` → ${dateKey(new Date(rate.endDate))}` : ''}{rate.daysOfWeek?.length ? ` · ${rate.daysOfWeek.map((day) => WEEKDAYS[day]).join(', ')}` : ''}</p>
                  </div>
                  <button type="button" className="text-ink/35 transition hover:text-copper" onClick={() => remove.mutate(rate._id)} aria-label="Remove rate"><Trash2 size={15} /></button>
                </div>)}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </>;
}