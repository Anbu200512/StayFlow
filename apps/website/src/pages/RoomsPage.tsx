import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Clock3, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { hotelQuery, availabilityQuery, roomsQuery } from '../lib/queries';
import { SearchBar } from '../components/SearchBar';
import { RoomCard } from '../components/RoomCard';
import { roomCardImage } from '../lib/roomImages';
import { EmptyState, ErrorState, LoadingState, PageIntro } from '../components/States';
import type { AvailabilityQuery } from '../types';

const fallbackHero = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=2200&q=85';
const fallbackRoomImage = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80';

type Sort = 'recommended' | 'price-asc' | 'price-desc';

export default function RoomsPage() {
  const [params] = useSearchParams();
  const [sort, setSort] = useState<Sort>('recommended');
  const initial: AvailabilityQuery = {
    checkIn: params.get('checkIn') ?? '',
    checkOut: params.get('checkOut') ?? '',
    adults: Number(params.get('adults') ?? 2),
    children: Number(params.get('children') ?? 0),
  };
  const search = {
    ...initial,
    checkIn: initial.checkIn || new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    checkOut: initial.checkOut || new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
  };
  const available = availabilityQuery(search);
  const allRooms = roomsQuery();
  const hotel = hotelQuery();
  const hotelName = hotel.data?.hotel.name ?? 'Alder House';
  const roomTypes = useMemo(() => [...new Map((allRooms.data ?? []).map((room) => [room.roomType._id, room.roomType])).values()], [allRooms.data]);
  const type = params.get('type');
  const activeFilter = roomTypes.find((roomType) => roomType._id === type);
  const matching = useMemo(() => (available.data ?? []).filter((room) => !type || room.roomType._id === type), [available.data, type]);

  const sorted = useMemo(() => {
    const list = [...matching];
    const priceOf = (room: (typeof list)[number]) => room.nightlyRate?.average ?? room.roomType.basePrice;
    if (sort === 'price-asc') list.sort((a, b) => priceOf(a) - priceOf(b));
    if (sort === 'price-desc') list.sort((a, b) => priceOf(b) - priceOf(a));
    return list;
  }, [matching, sort]);

  const freeByType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const room of available.data ?? []) counts.set(room.roomType._id, (counts.get(room.roomType._id) ?? 0) + 1);
    return counts;
  }, [available.data]);

  const priceByType = useMemo(() => {
    const prices = new Map<string, number>();
    for (const room of available.data ?? []) {
      const price = room.nightlyRate?.min ?? room.roomType.basePrice;
      prices.set(room.roomType._id, Math.min(prices.get(room.roomType._id) ?? price, price));
    }
    return prices;
  }, [available.data]);

  const lowestPrice = useMemo(() => {
    const availablePrices = (available.data ?? []).map((room) => room.nightlyRate?.min ?? room.roomType.basePrice);
    if (availablePrices.length) return Math.min(...availablePrices);
    return roomTypes.length ? Math.min(...roomTypes.map((roomType) => roomType.basePrice)) : null;
  }, [available.data, roomTypes]);

  useEffect(() => { document.title = `Stay · ${hotelName}`; }, [hotelName]);

  const facts = [
    { label: 'Check-in', value: hotel.data?.hotel.checkInTime ?? '14:00' },
    { label: 'Check-out', value: hotel.data?.hotel.checkOutTime ?? '11:00' },
    { label: 'Rooms from', value: lowestPrice ? `₹${lowestPrice.toLocaleString()}` : 'On request' },
    { label: 'Room styles', value: roomTypes.length ? String(roomTypes.length) : 'Four to explore' },
  ];

  const filterHref = (nextType?: string) => {
    const next = new URLSearchParams(params);
    if (nextType) next.set('type', nextType);
    else next.delete('type');
    return `/rooms?${next.toString()}`;
  };

  const count = available.isLoading ? null : matching.length;
  const summary = count === null
    ? 'Checking rooms…'
    : type
      ? `${count} ${activeFilter?.name ?? ''} room${count === 1 ? '' : 's'} available for your dates`
      : `${count} room${count === 1 ? '' : 's'} available for your dates`;

  let results;
  if (available.isLoading) {
    results = <LoadingState label="Checking live availability" />;
  } else if (available.isError) {
    results = <ErrorState message="Availability is temporarily unavailable. Please try again." onRetry={() => available.refetch()} />;
  } else if (!available.data?.length) {
    results = <EmptyState title="No rooms for those dates" description="Try another date range, or ask our team about a room that is not listed online." action={<Link to="/contact" className="button-secondary">Ask the house</Link>} />;
  } else if (!matching.length) {
    results = (
      <EmptyState
        title="No rooms of that type"
        description={`${activeFilter?.name ?? 'That room type'} is fully booked for your dates. Try another room type or shift your dates.`}
        action={<Link to={filterHref()} className="button-secondary">Show all available rooms</Link>}
      />
    );
  } else {
    results = <div className="grid gap-6 md:grid-cols-2">{sorted.map((room, index) => <RoomCard key={room._id} room={room} image={roomCardImage(index)} />)}</div>;
  }

  return (
    <>
      <PageIntro
        eyebrow="Stay"
        title="Find the room that fits your days."
        description={`Rooms at ${hotelName}, with live availability for your dates. Honest prices, considered details, nothing hidden.`}
        image={hotel.data?.hotel.heroImageUrl ?? fallbackHero}
        actions={<><a href="#search" className="button-primary bg-white text-ink hover:bg-sand">Check availability <ArrowUpRight size={16} /></a><Link to="/contact" className="button-secondary border-white/50 text-white hover:border-white hover:text-white">Talk to the house</Link></>}
        meta={<dl className="grid grid-cols-2 gap-6 md:grid-cols-4">{facts.map((fact) => <div key={fact.label}><dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">{fact.label}</dt><dd className="mt-2 font-display text-3xl text-white">{fact.value}</dd></div>)}</dl>}
      />

      <section id="search" className="relative z-10 mx-auto -mt-7 max-w-7xl px-5 lg:px-10">
        <div className="bg-white p-5 shadow-soft md:p-7">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div><p className="eyebrow">Your dates</p><h2 className="mt-2 font-display text-3xl leading-none">Check availability</h2></div>
            <p className="text-xs text-ink/45">Prices update live as you search.</p>
          </div>
          <SearchBar initial={search} compact />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pt-20 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="eyebrow">Browse by style</p><h2 className="section-title mt-4">Every room, at a glance.</h2></div>
          {type && <Link to={filterHref()} className="button-secondary px-4 py-2 text-xs">Clear filter</Link>}
        </div>
        {allRooms.isLoading ? (
          <div className="mt-8"><LoadingState label="Loading room styles" /></div>
        ) : roomTypes.length > 0 ? (
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {roomTypes.map((roomType) => {
              const selected = type === roomType._id;
              const free = available.isLoading ? null : (freeByType.get(roomType._id) ?? 0);
              const from = priceByType.get(roomType._id) ?? roomType.basePrice;
              return (
                <Link key={roomType._id} to={filterHref(roomType._id)} aria-pressed={selected} className={`group flex flex-col overflow-hidden border text-left transition ${selected ? 'border-forest bg-forest text-white shadow-soft' : 'border-ink/10 bg-white hover:border-forest/50'}`}>
                  <span className="relative block aspect-[4/3] overflow-hidden bg-sand">
                    <img src={roomType.images?.[0]?.url ?? fallbackRoomImage} alt={roomType.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                    <span className={`absolute right-3 top-3 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${free === null ? 'bg-white/90 text-ink/60' : free > 0 ? 'bg-white/90 text-forest' : 'bg-copper text-white'}`}>
                      {free === null ? 'Checking…' : free > 0 ? `${free} free` : 'Fully booked'}
                    </span>
                  </span>
                  <span className="flex flex-1 flex-col p-4">
                    <span className={`font-display text-2xl leading-none ${selected ? 'text-white' : 'text-ink'}`}>{roomType.name}</span>
                    <span className={`mt-2 text-xs ${selected ? 'text-white/65' : 'text-ink/50'}`}>{[roomType.sizeSqm ? `${roomType.sizeSqm} m²` : null, `Sleeps ${roomType.maxOccupancy}`, roomType.bedConfiguration].filter(Boolean).join(' · ')}</span>
                    <span className={`mt-4 flex items-baseline justify-between border-t pt-3 text-xs ${selected ? 'border-white/20 text-white/60' : 'border-ink/10 text-ink/45'}`}>
                      <span>From</span>
                      <span className={`text-sm font-semibold ${selected ? 'text-white' : 'text-forest'}`}>₹{from.toLocaleString()}<span className="ml-1 font-normal opacity-70">/night</span></span>
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        ) : null}
      </section>

      <div className="mx-auto max-w-7xl px-5 pb-24 lg:px-10">
        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-ink/10 pt-6">
          <p role="status" aria-live="polite" className="text-sm text-ink/60">{summary}</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-ink/50">
              Sort
              <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="input-field !w-auto px-3 py-2 text-xs">
                <option value="recommended">Recommended</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
              </select>
            </label>
            <button type="button" onClick={() => available.refetch()} className="button-secondary px-4 py-2 text-xs"><RefreshCw size={14} />Refresh</button>
          </div>
        </div>
        <div className="mt-8">{results}</div>
      </div>

      <section className="bg-sand">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:grid-cols-3 lg:px-10">
          <Perk icon={<ShieldCheck size={20} />} title="Booking direct pays" text="The rate you see here is the rate we hold — no third party sitting in the middle." />
          <Perk icon={<Clock3 size={20} />} title="Plans can move" text="Dates change. Tell us early and the team will do what the calendar allows." />
          <Perk icon={<Sparkles size={20} />} title="Someone is always here" text="Reception runs around the clock, from late arrivals to early departures." />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <p className="eyebrow">Not sure yet</p>
          <h2 className="mt-4 font-display text-5xl leading-none text-ink md:text-6xl">Tell us how you travel. We will pick the room.</h2>
          <p className="mt-5 max-w-xl text-sm leading-6 text-ink/60">Working trip, family weekend, or something in between — a short conversation usually settles it.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link to="/contact" className="button-primary">Ask the house <ArrowUpRight size={16} /></Link>
            <Link to="/gallery" className="button-secondary">See the gallery</Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Perk({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="border-t border-forest/20 pt-5"><div className="text-forest">{icon}</div><h3 className="mt-4 font-semibold text-ink">{title}</h3><p className="mt-2 text-sm leading-6 text-ink/55">{text}</p></div>;
}
