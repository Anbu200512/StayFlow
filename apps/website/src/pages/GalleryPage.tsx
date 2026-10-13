import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Expand, Quote, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { galleryQuery } from '../lib/queries';
import { useDialog } from '../lib/useDialog';
import { ErrorState, LoadingState, PageIntro } from '../components/States';
import type { GalleryImage } from '../types';

const heroImage = 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=2200&q=85';

const visitPoints = [
  'Tour at your pace — no pressure, no deposit',
  'The room you tour is the room you book',
  'Walk-ins welcome, any day of the week',
  'Weekend rooms go first, so ask ahead',
];

const fallbackGallery: GalleryImage[] = [
  { _id: 'fb-1', publicId: '', url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=85', alt: 'The pool at golden hour', category: 'Wellness' },
  { _id: 'fb-2', publicId: '', url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=85', alt: 'A bright guest room at the house', category: 'Rooms' },
  { _id: 'fb-3', publicId: '', url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=85', alt: 'A suite corner with soft light', category: 'Rooms' },
  { _id: 'fb-4', publicId: '', url: 'https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=1200&q=85', alt: 'The living room, open and unhurried', category: 'The house' },
  { _id: 'fb-5', publicId: '', url: 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=85', alt: 'Reception at the end of the day', category: 'The house' },
  { _id: 'fb-6', publicId: '', url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85', alt: 'The house, framed from the garden', category: 'The house' },
  { _id: 'fb-7', publicId: '', url: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=85', alt: 'Stone, water and a long mirror', category: 'Rooms' },
  { _id: 'fb-8', publicId: '', url: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1200&q=85', alt: 'A warm corner by the window', category: 'Rooms' },
  { _id: 'fb-9', publicId: '', url: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=85', alt: 'The bed, freshly made', category: 'Rooms' },
  { _id: 'fb-10', publicId: '', url: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=85', alt: 'A swim before breakfast', category: 'Wellness' },
  { _id: 'fb-11', publicId: '', url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=85', alt: 'Rest lounge beside the pool', category: 'Wellness' },
  { _id: 'fb-12', publicId: '', url: 'https://images.unsplash.com/photo-1610641818989-c2051b5e2cfd?auto=format&fit=crop&w=1200&q=85', alt: 'Slate, linen and soft light', category: 'Rooms' },
  { _id: 'fb-13', publicId: '', url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=85', alt: 'A corner made for long evenings', category: 'The house' },
  { _id: 'fb-14', publicId: '', url: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=85', alt: 'Breakfast, laid out slowly', category: 'The house' },
  { _id: 'fb-15', publicId: '', url: 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=85', alt: 'The house at dusk', category: 'The house' },
  { _id: 'fb-16', publicId: '', url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=85', alt: 'A view down the hall', category: 'The house' },
  { _id: 'fb-17', publicId: '', url: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1200&q=85', alt: 'Clean lines in the morning light', category: 'Rooms' },
  { _id: 'fb-18', publicId: '', url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85', alt: 'Feathers and daylight', category: 'Rooms' },
];

export default function GalleryPage() {
  const { data, isLoading, isError, refetch } = galleryQuery();
  const [selected, setSelected] = useState<string | null>(null);
  const [active, setActive] = useState('All');
  const lightboxRef = useRef<HTMLDivElement>(null);

  const images = useMemo(() => {
    if (isLoading || isError) return [];
    const source = data?.length ? data : fallbackGallery;
    const seen = new Set<string>();
    const unique = source.filter((image) => (seen.has(image.url) ? false : (seen.add(image.url), true)));
    const extras = fallbackGallery.filter((image) => !seen.has(image.url));
    return [...unique, ...extras];
  }, [data, isLoading, isError]);
  const visible = useMemo(() => (active === 'All' ? images : images.filter((image) => (image.category?.trim() || 'All') === active)), [images, active]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const image of images) {
      const category = image.category?.trim() || 'All';
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return [...counts.entries()].filter(([category]) => category !== 'All');
  }, [images]);

  const selectedIndex = visible.findIndex((image) => image.url === selected);
  const selectedImage = selectedIndex >= 0 ? visible[selectedIndex] : null;

  useDialog(lightboxRef, () => setSelected(null), Boolean(selected));
  useEffect(() => { document.title = 'Gallery · Alder House'; }, []);
  useEffect(() => {
    if (!selected || visible.length < 2) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const index = visible.findIndex((image) => image.url === selected);
      if (index < 0) return;
      const step = event.key === 'ArrowRight' ? 1 : -1;
      setSelected(visible[(index + step + visible.length) % visible.length].url);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selected, visible]);

  useEffect(() => { if (active !== 'All') setSelected(null); }, [active]);

  const step = (direction: 1 | -1) => {
    setSelected(visible[(selectedIndex + direction + visible.length) % visible.length].url);
  };

  return <>
    <PageIntro
      eyebrow="A glimpse inside"
      title="The house, in a few frames."
      description="Light, texture, and the details that make a room feel like yours. Click any frame to move through them."
      image={heroImage}
      actions={<><Link to="/rooms" className="button-primary bg-white text-ink hover:bg-sand">Come and see it <ArrowUpRight size={16} /></Link><Link to="/offers" className="button-secondary border-white/50 text-white hover:border-white hover:text-white">Current offers</Link></>}
      meta={<p className="text-sm text-white/70">{isLoading ? 'Gathering a few frames…' : `${images.length} photograph${images.length === 1 ? '' : 's'} from around the house`}</p>}
    />

    <div className="mx-auto max-w-7xl px-5 pb-24 lg:px-10">
      {isLoading ? <LoadingState label="Loading the gallery" /> : isError ? <ErrorState message="We could not load the gallery right now." onRetry={() => refetch()} /> : (
        <>
          {visible[0] && (
            <button type="button" onClick={() => setSelected(visible[0].url)} className="group relative mt-16 block w-full overflow-hidden bg-sand text-left" aria-label={`Open featured image: ${visible[0].alt}`}>
              <img src={visible[0].url} alt={visible[0].alt} className="aspect-[2/1] w-full object-cover transition duration-700 group-hover:scale-105" />
              <span className="absolute inset-0 flex items-end justify-between gap-6 bg-gradient-to-t from-ink/70 via-transparent to-transparent p-6 md:p-8">
                <span className="text-white"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">{visible[0].category ?? 'The house'}</span><span className="mt-1 block font-display text-3xl leading-none md:text-4xl">{visible[0].alt}</span></span>
                <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/40 text-white transition group-hover:bg-white group-hover:text-ink md:flex"><Expand size={17} /></span>
              </span>
            </button>
          )}

          {categories.length > 1 && (
            <div role="group" aria-label="Filter gallery" className="mt-12 flex flex-wrap items-center gap-2 border-y border-ink/10 py-4">
              <FilterChip label="All" count={images.length} pressed={active === 'All'} onClick={() => setActive('All')} />
              {categories.map(([category, count]) => <FilterChip key={category} label={category} count={count} pressed={active === category} onClick={() => setActive(category)} />)}
            </div>
          )}

          <div className="mt-10 columns-1 gap-4 sm:columns-2 lg:columns-3">
            {visible.map((image) => (
              <button type="button" key={image._id} onClick={() => setSelected(image.url)} className="group relative mb-4 block w-full break-inside-avoid overflow-hidden bg-sand text-left">
                <img src={image.url} alt={image.alt} className="w-full transition duration-700 group-hover:scale-105" />
                <span className="absolute inset-0 flex items-end justify-between gap-4 bg-ink/0 p-5 opacity-0 transition group-hover:bg-ink/30 group-hover:opacity-100">
                  <span className="text-sm font-medium text-white">{image.alt}</span>
                  {image.category && <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">{image.category}</span>}
                </span>
              </button>
            ))}
          </div>

          <section className="mt-20 bg-forest text-white">
            <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 md:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-10">
              <div>
                <p className="eyebrow text-sage">Better in person</p>
                <h2 className="mt-4 max-w-2xl font-display text-4xl leading-none md:text-5xl">Frames are nice. Feeling the room is better.</h2>
                <p className="mt-5 max-w-xl text-sm leading-6 text-white/65">Come in for a look — no appointment needed. If you like what you see, you can book the very room there and then.</p>
                <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                  {visitPoints.map((point) => <li key={point} className="flex items-start gap-2.5 text-sm leading-6 text-white/75"><Check size={16} className="mt-0.5 shrink-0 text-sage" />{point}</li>)}
                </ul>
                <div className="mt-9 flex flex-wrap gap-3">
                  <Link to="/rooms" className="button-primary w-fit bg-white text-forest hover:bg-sand">Find your room <ArrowUpRight size={16} /></Link>
                  <Link to="/contact" className="button-secondary border-white/50 text-white hover:border-white hover:text-white">Plan a visit</Link>
                </div>
              </div>
              <div className="border border-white/15 bg-white/5 p-8 md:p-10">
                <Quote size={26} aria-hidden="true" className="text-sage" />
                <p className="mt-5 font-display text-2xl leading-snug text-white md:text-[1.7rem]">“You can tell a house that is lived in. The light comes in at different times, and the team remembers what you asked for.”</p>
                <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-sage">From the guestbook, last season</p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>

    {selected && selectedImage && (
      <div ref={lightboxRef} tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-5 outline-none" role="dialog" aria-modal="true" aria-label="Expanded gallery image" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
        <button type="button" className="absolute right-5 top-5 z-10 p-2 text-white/70 transition hover:text-white" onClick={() => setSelected(null)} aria-label="Close image"><X aria-hidden="true" /></button>
        {visible.length > 1 && (
          <>
            <button type="button" className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/30 p-3 text-white/80 transition hover:border-white hover:text-white" onClick={() => step(-1)} aria-label="Previous image"><ChevronLeft size={20} /></button>
            <button type="button" className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/30 p-3 text-white/80 transition hover:border-white hover:text-white" onClick={() => step(1)} aria-label="Next image"><ChevronRight size={20} /></button>
          </>
        )}
        <figure className="flex max-h-full max-w-5xl flex-col items-center">
          <img src={selectedImage.url} alt={selectedImage.alt} className="max-h-[78vh] w-auto object-contain" />
          <figcaption className="mt-4 flex w-full items-center justify-between gap-6 text-sm">
            <span className="text-white/80">{selectedImage.alt}</span>
            <span className="shrink-0 text-white/45">{selectedIndex + 1} / {visible.length}</span>
          </figcaption>
        </figure>
      </div>
    )}
  </>;
}

function FilterChip({ label, count, pressed, onClick }: { label: string; count: number; pressed: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-pressed={pressed} className={`inline-flex items-center gap-2 px-4 py-2 text-xs transition ${pressed ? 'bg-forest text-white' : 'border border-ink/15 text-ink/60 hover:border-forest hover:text-forest'}`}>{label}<span className={pressed ? 'text-white/60' : 'text-ink/35'}>{count}</span></button>;
}