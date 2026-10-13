import { useEffect } from 'react';
import { ArrowDown, ArrowUpRight, BedDouble, Check, Coffee, ConciergeBell, Heart, Leaf, LogIn, LogOut, MapPin, ShieldCheck, Sparkles, Sun, Tag, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';
import { hotelQuery, offersQuery, roomsQuery } from '../lib/queries';
import { SearchBar } from '../components/SearchBar';
import { RoomCard } from '../components/RoomCard';
import { roomCardImage } from '../lib/roomImages';
import { ArrowLink } from '../components/Layout';
import { ErrorState, LoadingState } from '../components/States';

const fallbackImage = 'https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=2200&q=90';
const ctaImage = 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=2200&q=85';
const fallbackRooms = [
  { _id: 'preview-1', roomNumber: '201', floor: 2, status: 'available', features: [], roomType: { _id: 'preview-type-1', name: 'Garden King', slug: 'garden-king', description: 'A calm king room opening onto a private green courtyard.', basePrice: 4200, currency: 'INR', maxAdults: 2, maxChildren: 1, maxOccupancy: 3, bedConfiguration: '1 king bed', sizeSqm: 32, amenities: ['King bed', 'Courtyard view'], images: [{ publicId: '', url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=85' }] } },
  { _id: 'preview-2', roomNumber: '302', floor: 3, status: 'available', features: [], roomType: { _id: 'preview-type-2', name: 'Alder Suite', slug: 'alder-suite', description: 'A spacious suite for slow mornings and longer stays.', basePrice: 7800, currency: 'INR', maxAdults: 2, maxChildren: 2, maxOccupancy: 4, bedConfiguration: '1 king bed and sofa bed', sizeSqm: 52, amenities: ['Separate lounge', 'King bed'], images: [{ publicId: '', url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=85' }] } },
  { _id: 'preview-3', roomNumber: '203', floor: 2, status: 'available', features: [], roomType: { _id: 'preview-type-3', name: 'Deluxe Room', slug: 'deluxe-room', description: 'A generous deluxe room with considered work and rest zones.', basePrice: 5200, currency: 'INR', maxAdults: 2, maxChildren: 2, maxOccupancy: 4, bedConfiguration: '1 queen bed', sizeSqm: 38, amenities: ['Queen bed', 'City view', 'Work desk'], images: [{ publicId: '', url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85' }] } },
  { _id: 'preview-4', roomNumber: '204', floor: 2, status: 'available', features: [], roomType: { _id: 'preview-type-4', name: 'Courtyard Twin', slug: 'courtyard-twin', description: 'A bright twin room designed for friends and family.', basePrice: 4600, currency: 'INR', maxAdults: 2, maxChildren: 2, maxOccupancy: 4, bedConfiguration: '2 twin beds', sizeSqm: 34, amenities: ['Twin beds', 'Courtyard view'], images: [{ publicId: '', url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=85' }] } },
  { _id: 'preview-5', roomNumber: '305', floor: 3, status: 'available', features: [], roomType: { _id: 'preview-type-1', name: 'Garden King', slug: 'garden-king', description: 'A calm king room opening onto a private green courtyard.', basePrice: 4200, currency: 'INR', maxAdults: 2, maxChildren: 1, maxOccupancy: 3, bedConfiguration: '1 king bed', sizeSqm: 32, amenities: ['King bed', 'Courtyard view'], images: [{ publicId: '', url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=85' }] } },
  { _id: 'preview-6', roomNumber: '306', floor: 3, status: 'available', features: [], roomType: { _id: 'preview-type-3', name: 'Deluxe Room', slug: 'deluxe-room', description: 'A generous deluxe room with considered work and rest zones.', basePrice: 5200, currency: 'INR', maxAdults: 2, maxChildren: 2, maxOccupancy: 4, bedConfiguration: '1 queen bed', sizeSqm: 38, amenities: ['Queen bed', 'City view', 'Work desk'], images: [{ publicId: '', url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85' }] } },
];

export default function HomePage() {
  const { data, isLoading, isError, refetch } = hotelQuery();
  const rooms = roomsQuery();
  const offers = offersQuery();
  const content = data?.content;
  const roomsToShow = rooms.data?.length ? rooms.data.slice(0, 6) : fallbackRooms;
  const heroImage = data?.hotel.heroImageUrl ?? fallbackImage;
  const allRooms = rooms.data ?? [];
  const lowestPrice = allRooms.length ? Math.min(...allRooms.map((room) => room.roomType.basePrice)) : 4200;
  const hotelName = data?.hotel.name ?? 'The Alder House';
  const city = data?.hotel.address.city ?? 'Bengaluru';
  const checkIn = data?.hotel.checkInTime ?? '14:00';
  const checkOut = data?.hotel.checkOutTime ?? '11:00';

  useEffect(() => { document.title = `${data?.hotel.name ?? 'The Alder House'} · A quieter kind of city stay`; }, [data?.hotel.name]);

  return <>
    <section className="relative min-h-[760px] overflow-hidden bg-ink text-white">
      <img src={heroImage} alt="Alder House hotel interior" className="absolute inset-0 h-full w-full object-cover opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/50 via-ink/15 to-ink/80" />
      <div className="relative mx-auto flex min-h-[760px] max-w-7xl flex-col justify-end px-5 pb-16 pt-40 lg:px-10 lg:pb-24"><p className="eyebrow text-sage">{content?.home?.eyebrow ?? 'A quieter kind of city stay'}</p><h1 className="mt-5 max-w-4xl font-display text-6xl leading-[0.88] tracking-tight md:text-8xl">{content?.home?.title ?? 'Luxury. Comfort. Your Stay.'}</h1><p className="mt-7 max-w-xl text-base leading-7 text-white/70 md:text-lg">{content?.home?.subtitle ?? 'Thoughtful rooms, warm service, and space to settle into the city.'}</p><div className="mt-9 flex flex-wrap gap-3"><Link to="/rooms" className="button-primary bg-white text-ink hover:bg-sand">{content?.home?.primaryCta ?? 'Check availability'}<ArrowUpRight size={16} /></Link><Link to="/about" className="button-secondary border-white/50 text-white hover:border-white hover:text-white">{content?.home?.secondaryCta ?? 'Explore the house'}</Link></div><div className="mt-20 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-white/50"><ArrowDown size={15} />Scroll to discover</div></div>
    </section>
    {isLoading && <div className="mx-auto max-w-7xl px-5 pt-8 lg:px-10"><LoadingState label="Loading the latest house details" /></div>}
    {isError && <div className="mx-auto max-w-7xl px-5 pt-8 lg:px-10"><ErrorState message="We could not load the latest house details." onRetry={() => { void refetch(); }} /></div>}
    <section className="relative z-10 mx-auto -mt-8 max-w-7xl px-5 lg:px-10"><div className="bg-white p-5 shadow-soft md:p-7"><SearchBar /></div></section>
    <section className="mx-auto max-w-7xl px-5 py-24 lg:px-10 lg:py-32"><div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="eyebrow">A place to settle into</p><h2 className="section-title mt-4 max-w-2xl">Rooms that leave room for living.</h2></div><ArrowLink to="/rooms">Explore all rooms</ArrowLink></div><div className="mt-12 grid gap-6 lg:grid-cols-3">{rooms.isLoading && roomsToShow.length === 0 ? <LoadingState label="Finding your room" /> : roomsToShow.map((room, index) => <RoomCard key={room._id} room={room} image={roomCardImage(index)} />)}</div></section>
    <section className="mx-auto max-w-7xl px-5 pb-24 lg:px-10 lg:pt-8">
      <div className="grid gap-14 border-t border-ink/10 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div>
          <p className="eyebrow">The hotel, briefly</p>
          <h2 className="section-title mt-4">Independent, unhurried, and in the middle of everything.</h2>
          <p className="mt-6 text-base leading-8 text-ink/60">{content?.about ?? `The ${hotelName} is an independent hotel built around the idea that a good stay should feel effortless — rooms with a real place to work, breakfast that does not rush you, and a team that is here whenever you need them.`}</p>
          <p className="mt-4 text-base leading-8 text-ink/60">We sit in the heart of {city}, close to the places worth crossing town for, and quiet enough to feel a long way from the traffic.</p>
          <div><dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4"><Fact icon={<MapPin size={17} />} label="Based in" value={city} /><Fact icon={<LogIn size={17} />} label="Check-in" value={`From ${checkIn}`} /><Fact icon={<LogOut size={17} />} label="Check-out" value={`By ${checkOut}`} /><Fact icon={<Tag size={17} />} label="Nightly from" value={`₹${lowestPrice.toLocaleString()}`} /></dl></div>
          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3"><ArrowLink to="/about">Read our story</ArrowLink><ArrowLink to="/facilities">Facilities & details</ArrowLink></div>
        </div>
        <div className="border border-forest/20 bg-sand p-8 md:p-10">
          <p className="eyebrow">Worth knowing</p>
          <h3 className="mt-4 font-display text-3xl">The things guests remember.</h3>
          <ul className="mt-7 space-y-5">
            {(content?.whyChooseUs?.length ? content.whyChooseUs : [
              { icon: 'map', title: `Walkable to the best of ${city}`, description: 'Restaurants, galleries, and the quiet corners.' },
              { icon: 'sparkles', title: 'Breakfast every morning', description: 'At your own pace, no rush to join.' },
              { icon: 'leaf', title: 'Considered comfort', description: 'Fast Wi-Fi, workable spaces, naturally quiet rooms.' },
              { icon: 'check', title: 'Reception around the clock', description: 'Late flights and early starts are expected here.' },
            ]).map((item) => (
              <li key={item.title} className="flex items-start gap-3 text-sm leading-6">
                <span className="mt-0.5 shrink-0 text-forest">{highlightIcon(item.icon)}</span>
                <span><span className="font-semibold text-ink">{item.title}.</span>{' '}<span className="text-ink/70">{item.description}</span></span>
              </li>
            ))}
          </ul>
          <figure className="mt-9 border-t border-forest/20 pt-7">
            <blockquote className="font-display text-2xl leading-snug text-ink">“A good stay should feel effortless — that is the whole idea, kept simple.”</blockquote>
            <figcaption className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/45">The {hotelName} team</figcaption>
          </figure>
        </div>
      </div>
    </section>
    <section className="bg-sand"><div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-10 lg:py-32"><div><p className="eyebrow">The Alder House</p><h2 className="section-title mt-4">Small details. Generous feeling.</h2><p className="mt-6 max-w-lg text-base leading-8 text-ink/60">{content?.about ?? 'We built the house around the idea that a good stay should feel effortless. Settle in, ask us what is nearby, and let the day unfold at its own pace.'}</p><div className="mt-8"><ArrowLink to="/about">Our story</ArrowLink></div></div><div className="grid gap-4 sm:grid-cols-2"><Feature icon={<Leaf size={20} />} title="Considered comfort" text="Natural textures, quiet light, and everything you need to feel at home." /><Feature icon={<Sparkles size={20} />} title="Genuine welcome" text="A team that knows the city and knows when to help, and when to leave you be." /><Feature icon={<Check size={20} />} title="Made for your pace" text="Fast Wi-Fi, thoughtful work spaces, and no rush at checkout." /><Feature icon={<MapPin size={20} />} title="Close to everything" text="A calm base for restaurants, galleries, and the places worth crossing town for." /></div></div></section>
    <section className="mx-auto max-w-7xl px-5 py-24 lg:px-10 lg:py-32"><div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-end"><div><p className="eyebrow">A little extra</p><h2 className="section-title mt-4">Good reasons to stay a little longer.</h2></div><div className="grid gap-4 sm:grid-cols-2">{offers.data?.slice(0, 2).map((offer) => <OfferCard key={offer._id} {...offer} />)}{!offers.isLoading && !offers.data?.length && <p className="text-sm text-ink/55">Ask our team about current offers when you arrive.</p>}</div></div></section>
    <section className="relative isolate overflow-hidden bg-ink text-white"><img src={data?.hotel.heroImageUrl ?? ctaImage} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-60" /><div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/35 to-ink/80" /><div className="relative mx-auto flex max-w-4xl flex-col items-center justify-center px-5 py-24 text-center lg:px-10 lg:py-36"><p className="eyebrow text-sage">Your next chapter</p><h2 className="mt-4 font-display text-5xl leading-none text-white md:text-6xl">The city is waiting. Your room is ready.</h2><Link to="/rooms" className="button-primary mt-9 w-fit bg-white text-ink hover:bg-sand">Find your room <ArrowUpRight size={16} /></Link></div></section>
  </>;
}

function highlightIcon(key?: string) {
  const normalised = key?.trim().toLowerCase() ?? '';
  if (normalised.includes('leaf')) return <Leaf size={16} />;
  if (normalised.includes('sparkle') || normalised.includes('star')) return <Sparkles size={16} />;
  if (normalised.includes('check')) return <Check size={16} />;
  if (normalised.includes('map') || normalised.includes('pin') || normalised.includes('location')) return <MapPin size={16} />;
  if (normalised.includes('heart')) return <Heart size={16} />;
  if (normalised.includes('shield')) return <ShieldCheck size={16} />;
  if (normalised.includes('coffee') || normalised.includes('breakfast')) return <Coffee size={16} />;
  if (normalised.includes('bed')) return <BedDouble size={16} />;
  if (normalised.includes('wave') || normalised.includes('pool')) return <Waves size={16} />;
  if (normalised.includes('sun') || normalised.includes('light')) return <Sun size={16} />;
  if (normalised.includes('tag') || normalised.includes('offer')) return <Tag size={16} />;
  if (normalised.includes('concierge') || normalised.includes('service')) return <ConciergeBell size={16} />;
  return <Sparkles size={16} />;
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="border-t border-forest/20 pt-5"><div className="text-forest">{icon}</div><h3 className="mt-4 font-semibold text-ink">{title}</h3><p className="mt-2 text-sm leading-6 text-ink/55">{text}</p></div>; }
function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="border-t border-ink/15 pt-4"><div className="text-forest">{icon}</div><dt className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45">{label}</dt><dd className="mt-1 font-display text-2xl leading-none text-ink">{value}</dd></div>; }
function OfferCard({ title, description, code, discountType, discountValue, minNights }: { title: string; description: string; code?: string; discountType: string; discountValue: number; minNights?: number }) { return <div className="border border-forest/20 bg-white p-6 text-ink"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-copper">{discountType === 'percentage' ? `${discountValue}% off` : `₹${discountValue} off`}</p><h3 className="mt-3 font-display text-3xl">{title}</h3><p className="mt-3 text-sm leading-6 text-ink/60">{description}</p><div className="mt-5 flex items-center justify-between border-t border-ink/10 pt-4 text-xs text-ink/50"><span>{minNights && minNights > 1 ? `${minNights}+ nights` : 'Any stay'}</span>{code && <span className="border border-dashed border-forest/40 px-2 py-1 font-semibold text-forest">{code}</span>}</div></div>; }
