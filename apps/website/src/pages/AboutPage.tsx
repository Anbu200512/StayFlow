import { useEffect, useMemo } from 'react';
import { ArrowUpRight, BedDouble, Check, Clock3, Coffee, ConciergeBell, DoorOpen, Heart, Key, Leaf, Moon, Sparkles, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { hotelQuery, roomsQuery } from '../lib/queries';
import { PageIntro } from '../components/States';
import { ArrowLink } from '../components/Layout';

const heroImage = 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=2200&q=85';
const storyImage = 'https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=1500&q=85';
const detailImage = 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1100&q=85';
const neighbourhoodImage = 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1400&q=85';

const rhythm = [
  { icon: <Sun size={19} />, when: 'Mornings', title: 'Breakfast never rushes you', text: 'Come down when you wake. Coffee is already on, and the table is yours for as long as you want it.' },
  { icon: <Coffee size={19} />, when: 'Afternoons', title: 'Out in the city, or not', text: 'Our team keeps a short list of the places worth the walk — and a quiet room waiting if you would rather stay in.' },
  { icon: <Moon size={19} />, when: 'Evenings', title: 'A softer landing', text: 'Lights low, keys handed over, and a recommendation for dinner that is not the nearest place on the map.' },
  { icon: <Clock3 size={19} />, when: 'Any hour', title: 'Someone is at the desk', text: 'Late flight, early car, a package to sign for. Reception runs around the clock.' },
];

export default function AboutPage() {
  const { data } = hotelQuery();
  const rooms = roomsQuery();
  const hotelName = data?.hotel.name ?? 'Alder House';
  const roomStyles = useMemo(() => [...new Set((rooms.data ?? []).map((room) => room.roomType._id))].length, [rooms.data]);
  const comforts = data?.amenities?.length ?? 0;
  const city = data?.hotel.address.city ?? 'Bengaluru';
  const checkIn = data?.hotel.checkInTime ?? '14:00';
  const checkOut = data?.hotel.checkOutTime ?? '11:00';
  const services = data?.serviceCatalog ?? [];

  useEffect(() => { document.title = `The house · ${hotelName}`; }, [hotelName]);

  const facts = [
    { label: 'Based in', value: city },
    { label: 'Check-in', value: checkIn },
    { label: 'Room styles', value: roomStyles ? String(roomStyles) : 'Four' },
    { label: 'Comforts', value: comforts ? String(comforts) : 'Plenty' },
  ];

  const houseDetails = [
    { icon: <Key size={20} />, label: 'Check-in', text: `Settle in from ${checkIn}. Arriving early? Leave your bags with us and get going.` },
    { icon: <DoorOpen size={20} />, label: 'Check-out', text: `Leave by ${checkOut}, at your own pace. Late flight? Ask about a late checkout.` },
    { icon: <Clock3 size={20} />, label: 'Reception', text: 'Open around the clock. Late arrivals and early starts are simply part of the work.' },
    { icon: <ConciergeBell size={20} />, label: 'On request', text: services.length ? `${services.length} extras — breakfast, transfers, laundry and more.` : 'Breakfast, transfers and laundry — arranged whenever you ask.' },
  ];

  return <>
    <PageIntro
      eyebrow="The house"
      title="A city stay with a softer edge."
      description={data?.content?.about ?? 'The Alder House is an independent hotel built around the idea that a good stay should feel effortless.'}
      image={heroImage}
      actions={<><Link to="/rooms" className="button-primary bg-white text-ink hover:bg-sand">Check availability <ArrowUpRight size={16} /></Link><Link to="/gallery" className="button-secondary border-white/50 text-white hover:border-white hover:text-white">See the gallery</Link></>}
      meta={<dl className="grid grid-cols-2 gap-6 md:grid-cols-4">{facts.map((fact) => <div key={fact.label}><dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">{fact.label}</dt><dd className="mt-2 font-display text-3xl text-white">{fact.value}</dd></div>)}</dl>}
    />

    <section className="mx-auto grid max-w-7xl gap-14 px-5 py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-10 lg:py-32">
      <div className="relative">
        <img src={storyImage} alt="A quiet courtyard at the house" className="aspect-[1.15] w-full object-cover" />
        <img src={detailImage} alt="A suite corner with soft afternoon light" className="absolute -bottom-10 -right-2 hidden aspect-[4/5] w-48 border-8 border-cream object-cover shadow-soft sm:block lg:w-60" />
      </div>
      <div>
        <p className="eyebrow">Our beginning</p>
        <h2 className="section-title mt-4">The best kind of hospitality is felt, not performed.</h2>
        <p className="mt-6 text-base leading-8 text-ink/60">We opened the house with a simple idea: make the practical things feel considered, and the beautiful things feel effortless. That means rooms with a real place to work, breakfast that does not rush you, and a team that knows when a guest wants a recommendation and when they want to be left alone.</p>
        <p className="mt-4 text-base leading-8 text-ink/60">Nothing here is grand for the sake of it. The materials are honest, the light is natural, and the service is the sort you notice only when you need it.</p>
        <div className="mt-8 flex flex-wrap items-center gap-6"><ArrowLink to="/contact">Come say hello</ArrowLink><ArrowLink to="/rooms">Stay with us</ArrowLink></div>
      </div>
    </section>

    <section className="bg-sand">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-10 lg:py-28">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div><p className="eyebrow">A day here</p><h2 className="section-title mt-4">The rhythm of the house.</h2></div>
          <p className="max-w-sm text-sm leading-6 text-ink/55">No schedule to keep. Just a day that is easier to spend than to plan.</p>
        </div>
        <div className="mt-14 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {rhythm.map((moment) => <div key={moment.when} className="border-t border-ink/15 pt-5"><div className="flex items-center gap-3 text-forest"><span className="text-forest">{moment.icon}</span><span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/45">{moment.when}</span></div><h3 className="mt-5 font-display text-3xl leading-none">{moment.title}</h3><p className="mt-3 text-sm leading-6 text-ink/55">{moment.text}</p></div>)}
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-5 py-24 lg:px-10 lg:py-32">
      <div><p className="eyebrow">Practical details</p><h2 className="section-title mt-4">The little things, written down.</h2><p className="mt-5 max-w-xl text-sm leading-6 text-ink/55">Everything a calm stay depends on, answered before you have to ask.</p></div>
      <div className="mt-12 grid gap-px overflow-hidden border border-ink/10 bg-ink/10 sm:grid-cols-2 lg:grid-cols-4">
        {houseDetails.map((item) => <div key={item.label} className="bg-white p-7"><span className="text-forest">{item.icon}</span><h3 className="mt-5 font-display text-2xl">{item.label}</h3><p className="mt-2 text-sm leading-6 text-ink/55">{item.text}</p></div>)}
      </div>
    </section>

    <section className="bg-forest text-white">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-10 lg:py-32">
        <p className="eyebrow text-sage">What guides us</p>
        <h2 className="section-title mt-4 max-w-3xl text-white">The things we come back to.</h2>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          <Value icon={<Leaf size={21} />} title="Care for the details" text="From the temperature of the room to the timing of a transfer, the small things are the work." />
          <Value icon={<Heart size={21} />} title="Be genuinely warm" text="Good hospitality is not a script. It is noticing what someone needs before they ask." />
          <Value icon={<Sparkles size={21} />} title="Leave room for delight" text="A stay should have a little space in it for the unexpected." />
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-5 py-24 lg:px-10 lg:py-32">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><p className="eyebrow">The people</p><h2 className="section-title mt-4">A house, not a head office.</h2></div>
        <p className="max-w-sm text-sm leading-6 text-ink/55">Small enough that faces feel familiar by the second morning.</p>
      </div>
      <div className="mt-12 grid gap-10 md:grid-cols-3">
        <Role icon={<ConciergeBell size={20} />} title="At the front" text="Arrivals, directions, transfers and honest recommendations — answered directly, no runaround." />
        <Role icon={<Coffee size={20} />} title="In the kitchen" text="Breakfast cooked from scratch each morning, and coffee meant to be lingered over." />
        <Role icon={<BedDouble size={20} />} title="Keeping the rooms" text="Rooms turned over quietly, so you come back to a space that already feels ready." />
      </div>
    </section>

    <section className="bg-sand">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-10 lg:py-28">
        <div>
          <p className="eyebrow">Around the corner</p>
          <h2 className="section-title mt-4">The city, from a considered base.</h2>
          <p className="mt-6 text-base leading-8 text-ink/60">We sit in the heart of {city} — central enough for plans, quiet enough for none. The kind of base where a day plans itself.</p>
          <ul className="mt-7 space-y-4">
            <li className="flex items-start gap-3 text-sm leading-6 text-ink/70"><Check size={16} className="mt-0.5 shrink-0 text-forest" />The best walking is out the front door — galleries, gardens, and streets worth turning down.</li>
            <li className="flex items-start gap-3 text-sm leading-6 text-ink/70"><Check size={16} className="mt-0.5 shrink-0 text-forest" />A short list of tables that is updated by whoever was out last night.</li>
            <li className="flex items-start gap-3 text-sm leading-6 text-ink/70"><Check size={16} className="mt-0.5 shrink-0 text-forest" />Airport, station and the business district, all within an easy ride.</li>
          </ul>
          <div className="mt-8"><ArrowLink to="/contact">Ask us what is nearby</ArrowLink></div>
        </div>
        <img src={neighbourhoodImage} alt="Arriving back at the house at the end of the day" className="aspect-[4/5] w-full object-cover lg:aspect-[5/6]" />
      </div>
    </section>

    <section className="mx-auto grid max-w-7xl gap-12 px-5 py-24 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:px-10 lg:py-32">
      <div><p className="eyebrow">A note from the house</p><p className="mt-6 font-display text-6xl leading-none text-forest/30">“</p></div>
      <figure>
        <blockquote className="font-display text-4xl leading-[1.15] text-ink md:text-5xl">Come for a night if you can, but leave a little room in the trip. The city is generous, and so is the house.</blockquote>
        <figcaption className="mt-7 flex items-center gap-4 text-sm text-ink/55"><span className="h-px w-10 bg-ink/20" />The Alder House team · {city}</figcaption>
      </figure>
    </section>

    <section className="bg-ink text-white">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-5 py-20 lg:grid-cols-[1fr_auto] lg:items-end lg:px-10">
        <div>
          <p className="eyebrow text-sage">Come see it</p>
          <h2 className="mt-4 max-w-2xl font-display text-5xl leading-none md:text-6xl">The house makes more sense in person.</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/rooms" className="button-primary bg-white text-ink hover:bg-sand">Find your room <ArrowUpRight size={16} /></Link>
          <Link to="/contact" className="button-secondary border-white/50 text-white hover:border-white hover:text-white">Talk to us</Link>
        </div>
      </div>
    </section>
  </>;
}

function Value({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="border-t border-white/20 pt-5"><div className="text-sage">{icon}</div><h3 className="mt-5 font-display text-3xl">{title}</h3><p className="mt-3 text-sm leading-6 text-white/60">{text}</p></div>; }
function Role({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="border-t border-ink/15 pt-6"><div className="text-forest">{icon}</div><h3 className="mt-5 font-display text-3xl">{title}</h3><p className="mt-3 text-sm leading-6 text-ink/55">{text}</p></div>; }
