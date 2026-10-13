import { useEffect, useMemo } from 'react';
import { ArrowUpRight, BedDouble, Car, Check, Clock3, Coffee, ConciergeBell, Droplets, Leaf, Mail, MapPin, Phone, Shirt, Utensils, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';
import { facilitiesQuery, hotelQuery } from '../lib/queries';
import { PageIntro } from '../components/States';

const heroImage = 'https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=2200&q=85';
const bandImage = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2200&q=85';

const fallbackAmenities = ['High-speed Wi-Fi', '24-hour reception', 'Housekeeping', 'Laundry service', 'Airport transfers', 'Breakfast', 'Concierge', 'Secure parking'];
const fallbackServices = ['Breakfast', 'Airport transfers', 'Extra bed', 'Late checkout', 'Laundry', 'Bottled water'];
const extraAmenities = ['High-speed Wi-Fi', 'Fresh breakfast daily'];

const groups = [
  { key: 'room', label: 'In your room', icon: BedDouble, match: /wi-?fi|\btv\b|television|safe|desk|work|minibar|kettle|refrigerator|\bfridge\b|coffee|tea|air ?condition|heating|iron|bathrobe|slippers|blackout|reading|pillow|mattress|soundproof|\bview\b/i },
  { key: 'table', label: 'Food & drink', icon: Utensils, match: /breakfast|restaurant|\bbar\b|dining|buffet|kitchen|snack|meal|caf[eé]|lounge/i },
  { key: 'wellness', label: 'Wellness & leisure', icon: Waves, match: /pool|gym|fitness|spa|sauna|yoga|wellness|massage|garden|terrace|library/i },
  { key: 'service', label: 'Services', icon: ConciergeBell, match: /reception|concierge|laundry|housekeeping|transfer|airport|parking|shuttle|security|luggage|room service|valet|bell|driver|doctor|babysitt|currency|front desk|\bcar\b/i },
  { key: 'house', label: 'Around the house', icon: Leaf, match: /.*/ },
];

const serviceIcons: Record<string, React.ReactNode> = {
  breakfast: <Coffee size={17} />,
  airport_transfer: <Car size={17} />,
  extra_bed: <BedDouble size={17} />,
  late_checkout: <Clock3 size={17} />,
  laundry: <Shirt size={17} />,
  water: <Droplets size={17} />,
};

const gettingHere = [
  'Airport transfers arranged at the desk, any hour',
  'Station and metro within an easy ride',
  'Secure parking for guests who drive in',
];

export default function FacilitiesPage() {
  const facilities = facilitiesQuery();
  const hotel = hotelQuery();
  const amenities = useMemo(() => {
    const list = facilities.data?.amenities?.length ? facilities.data.amenities : (hotel.data?.amenities?.length ? hotel.data.amenities : fallbackAmenities);
    const unique = [...new Set([...list.map((item) => item.trim()).filter(Boolean), ...extraAmenities])];
    const bucket = new Map<string, string[]>(groups.map((group) => [group.key, []]));
    for (const item of unique) {
      const target = groups.find((group) => group.match.test(item)) ?? groups[groups.length - 1];
      bucket.get(target.key)?.push(item);
    }
    return groups
      .map((group) => ({ ...group, items: bucket.get(group.key) ?? [] }))
      .filter((group) => group.items.length > 0);
  }, [facilities.data?.amenities, hotel.data?.amenities]);

  const services = hotel.data?.serviceCatalog?.length ? hotel.data.serviceCatalog : null;
  const checkIn = hotel.data?.hotel.checkInTime ?? '14:00';
  const checkOut = hotel.data?.hotel.checkOutTime ?? '11:00';
  const location = facilities.data?.location;
  const address = location?.address ?? [hotel.data?.hotel.address.line1, hotel.data?.hotel.address.city, hotel.data?.hotel.address.postalCode].filter(Boolean).join(', ');
  const mapHref = location?.mapUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const contact = facilities.data?.contact ?? hotel.data?.hotel.contact;

  useEffect(() => { document.title = 'Facilities · Alder House'; }, []);

  const hours = [
    { label: 'Check-in', value: `From ${checkIn}` },
    { label: 'Check-out', value: `By ${checkOut}` },
    { label: 'Reception', value: '24 hours' },
    { label: 'Housekeeping', value: 'Every day' },
  ];

  return <>
    <PageIntro
      eyebrow="The details"
      title="Everything you need, nothing you do not."
      description="A stay should feel easy. These are the things we take care of quietly, behind the scenes."
      image={heroImage}
      actions={<><Link to="/rooms" className="button-primary bg-white text-ink hover:bg-sand">Check availability <ArrowUpRight size={16} /></Link><Link to="/contact" className="button-secondary border-white/50 text-white hover:border-white hover:text-white">Talk to the house</Link></>}
      meta={<dl className="grid grid-cols-2 gap-6 md:grid-cols-4">{hours.map((hour) => <div key={hour.label}><dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">{hour.label}</dt><dd className="mt-2 font-display text-3xl text-white">{hour.value}</dd></div>)}</dl>}
    />

    <section className="mx-auto max-w-7xl px-5 py-24 lg:px-10">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><p className="eyebrow">Around the house</p><h2 className="section-title mt-4">Comforts, grouped the way you will use them.</h2></div>
        <p className="max-w-sm text-sm leading-6 text-ink/55">{amenities.reduce((total, group) => total + group.items.length, 0)} considered details — most included in every stay, the rest on request.</p>
      </div>
      <div className="mt-12 grid gap-10 md:grid-cols-2 lg:grid-cols-3">
        {amenities.map((group) => { const Icon = group.icon; return (
          <div key={group.key} className="border-t border-ink/15 pt-5">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-sand text-forest"><Icon size={18} strokeWidth={1.5} /></span><h3 className="font-display text-2xl">{group.label}</h3><span className="ml-auto text-xs text-ink/40">{group.items.length}</span></div>
            <ul className="mt-5 grid gap-2.5">
              {group.items.map((item) => <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-ink/65"><Check size={15} className="mt-1 shrink-0 text-forest" />{item}</li>)}
            </ul>
          </div>
        ); })}
      </div>
    </section>

    <section className="relative isolate overflow-hidden bg-ink text-white">
      <img src={bandImage} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-55" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/60 via-ink/30 to-ink/75" />
      <div className="relative mx-auto max-w-4xl px-5 py-24 text-center md:py-32 lg:px-10">
        <p className="eyebrow text-sage">Stay & unwind</p>
        <h2 className="mt-4 font-display text-5xl leading-none text-white md:text-6xl">Bright rooms, honest breakfast, and the city right outside.</h2>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-white/70">Everything you need is either in the room, at the desk, or a short conversation away.</p>
        <div className="mt-9"><Link to="/rooms" className="button-primary w-fit bg-white text-ink hover:bg-sand">See the rooms <ArrowUpRight size={16} /></Link></div>
      </div>
    </section>

    <section className="bg-forest text-white">
      <div className="mx-auto max-w-7xl px-5 py-20 lg:px-10">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="eyebrow text-sage">At the house</p>
            <h2 className="mt-4 max-w-md font-display text-4xl leading-none md:text-5xl">A little more than a room.</h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/65">Make the most of the city, or make yourself at home. Reception is around the clock, and our favourite places are only a short conversation away.</p>
            <Link to="/contact" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-sage transition hover:text-white">Talk to the house <ArrowUpRight size={16} /></Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <ServiceCard icon={<Waves size={19} />} title="Wellness, on request" text="Yoga mats, quiet-hour rooms, and garden time whenever the day allows." />
            <ServiceCard icon={<ConciergeBell size={19} />} title="Services, priced plainly" text="From laundry to transfers — the price you are shown is the price you pay." />
            <ServiceCard icon={<Clock3 size={19} />} title="Around the clock" text="Late arrivals and early flights are expected here, never a bother." />
            <ServiceCard icon={<Leaf size={19} />} title="Naturally considered" text="Honest materials, natural light, and a building that keeps its cool." />
          </div>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-5 py-24 lg:px-10">
      <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-start">
        <div>
          <p className="eyebrow">On request</p>
          <h2 className="section-title mt-4">Everything else you might ask for.</h2>
          <p className="mt-5 max-w-md text-sm leading-6 text-ink/55">A short list of what guests ask for most. Add it to your booking or ask when you arrive — our team will arrange it.</p>
          <ul className="mt-9 divide-y divide-ink/10 border-t border-b border-ink/10">
            {(services ?? fallbackServices).map((service) => {
              const name = typeof service === 'string' ? service : service.name;
              const price = typeof service === 'string' ? null : service.unitPrice;
              const code = typeof service === 'string' ? undefined : service.code;
              return <li key={name} className="flex items-center gap-4 py-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand text-forest">{code ? serviceIcons[code] ?? <ConciergeBell size={17} /> : <ConciergeBell size={17} />}</span><span className="text-sm font-medium text-ink/75">{name}</span><span className="ml-auto text-sm text-ink/45">{price ? `₹${price.toLocaleString()}` : 'On request'}</span></li>;
            })}
          </ul>
          <p className="mt-4 text-xs text-ink/40">Prices are indicative and confirmed before you book.</p>
        </div>
        <div className="flex flex-col gap-6">
          <div className="border border-ink/10 bg-sand p-8 md:p-10">
            <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-forest"><MapPin size={19} /></span><p className="eyebrow">Find us</p></div>
            <h3 className="mt-6 font-display text-3xl leading-none">Easy to reach, harder to leave.</h3>
            <p className="mt-4 text-sm leading-7 text-ink/60">{location?.label ?? hotel.data?.hotel.name}<br />{address}{hotel.data?.hotel.address.country && `, ${hotel.data.hotel.address.country}`}</p>
            <div className="mt-7 flex flex-col gap-3 text-sm">
              {contact?.phone && <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-2.5 text-ink/70 transition hover:text-forest"><Phone size={15} />{contact.phone}</a>}
              {contact?.email && <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2.5 text-ink/70 transition hover:text-forest"><Mail size={15} />{contact.email}</a>}
            </div>
            <div className="mt-8"><a href={mapHref} target="_blank" rel="noreferrer" className="button-primary">Open in maps <ArrowUpRight size={16} /></a></div>
          </div>
          <div className="border border-ink/10 bg-white p-8">
            <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-sand text-forest"><Car size={19} /></span><p className="eyebrow">Getting here</p></div>
            <h3 className="mt-6 font-display text-3xl leading-none">The last mile is the easy part.</h3>
            <ul className="mt-6 space-y-4">
              {gettingHere.map((note) => <li key={note} className="flex items-start gap-3 text-sm leading-6 text-ink/70"><Check size={16} className="mt-0.5 shrink-0 text-forest" />{note}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-10 lg:py-28">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <p className="eyebrow">Your room, ready</p>
        <h2 className="mt-4 font-display text-5xl leading-none text-ink md:text-6xl">Comfort checked. Details handled.</h2>
        <p className="mt-5 max-w-xl text-sm leading-6 text-ink/60">The house takes care of the small things so the day stays yours.</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link to="/rooms" className="button-primary">Find your room <ArrowUpRight size={16} /></Link>
          <Link to="/about" className="button-secondary">The house</Link>
        </div>
      </div>
    </section>
  </>;
}

function ServiceCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="border-t border-white/20 pt-5"><div className="text-sage">{icon}</div><h3 className="mt-4 font-display text-2xl">{title}</h3><p className="mt-2 text-sm leading-6 text-white/60">{text}</p></div>;
}