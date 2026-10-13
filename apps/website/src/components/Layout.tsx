import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowUp, ArrowUpRight, Facebook, Globe, Instagram, Mail, Menu, Phone, Send, X } from 'lucide-react';
import { hotelQuery } from '../lib/queries';

const navigation = [
  { label: 'Stay', to: '/rooms' },
  { label: 'The house', to: '/about' },
  { label: 'Offers', to: '/offers' },
  { label: 'Facilities', to: '/facilities' },
  { label: 'Gallery', to: '/gallery' },
];

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { data } = hotelQuery();
  const hotel = data?.hotel;
  const content = data?.content;
  const location = useLocation();
  const navSolid = !['/', '/rooms', '/about', '/offers', '/facilities', '/gallery', '/contact'].includes(location.pathname);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    html.style.scrollBehavior = previous;
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-cream text-ink">
      <a href="#main-content" className="button-secondary sr-only left-5 top-5 z-50 focus:not-sr-only focus:absolute">Skip to main content</a>
      <header className={`fixed inset-x-0 top-0 z-40 text-white transition ${scrolled || navSolid ? 'border-b border-white/10 bg-ink/85 shadow-soft backdrop-blur' : 'bg-transparent'}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 lg:px-10">
          <Link to="/" className="group flex items-center gap-3" onClick={() => setMenuOpen(false)}>
            <span className="flex h-10 w-10 items-center justify-center border border-white/60 font-display text-2xl leading-none transition group-hover:bg-white group-hover:text-ink">A</span>
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.26em] sm:block">{hotel?.name ?? 'The Alder House'}</span>
          </Link>
          <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary navigation">
            {navigation.map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => `text-xs font-medium uppercase tracking-[0.16em] transition hover:text-sage ${isActive ? 'text-sage' : 'text-white/80'}`}>{item.label}</NavLink>)}
            <Link to="/contact" className="button-secondary border-white/50 text-white hover:border-white hover:text-white">Contact</Link>
          </nav>
          <button type="button" className="rounded-full border border-white/50 p-2 lg:hidden" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        {menuOpen && <div className="border-t border-white/20 bg-ink/95 px-5 py-6 backdrop-blur lg:hidden">
          <nav className="flex flex-col gap-5" aria-label="Mobile navigation">
            {navigation.map((item) => <NavLink key={item.to} to={item.to} onClick={() => setMenuOpen(false)} className="text-sm uppercase tracking-[0.18em] text-white/80">{item.label}</NavLink>)}
            <Link to="/contact" onClick={() => setMenuOpen(false)} className="text-sm uppercase tracking-[0.18em] text-sage">Contact</Link>
          </nav>
        </div>}
      </header>
      <main id="main-content" tabIndex={-1} key={location.pathname} className="min-h-[60vh] outline-none"><Outlet /></main>
      <Footer hotel={hotel} content={content} />
    </div>
  );
}

function Footer({ hotel, content }: { hotel?: import('../types').Hotel; content?: import('../types').WebsiteContent }) {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const subscribe = (event: React.FormEvent) => { event.preventDefault(); if (email.trim()) setSubscribed(true); };
  const brandText = content?.footerText ?? 'A quieter kind of city stay. Come for the room, stay for the feeling.';
  const contactEmail = content?.contact?.email ?? hotel?.contact.email ?? 'hello@stayflow.example';
  const contactPhone = content?.contact?.phone ?? hotel?.contact.phone ?? '+91 98765 43210';
  const socialEntries = Object.entries(content?.socialLinks ?? {});
  const platformIcon = (platform: string) => {
    const key = platform.toLowerCase();
    if (key === 'instagram') return <Instagram size={16} />;
    if (key === 'facebook') return <Facebook size={16} />;
    return <Globe size={16} />;
  };

  return <footer className="bg-forest text-white">
    <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 md:grid-cols-2 lg:grid-cols-[1.3fr_0.6fr_0.6fr_1fr] lg:px-10">
      <div>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center border border-white/60 font-display text-2xl leading-none">A</span>
          <span className="font-display text-3xl">Alder House</span>
        </div>
        <p className="mt-5 max-w-sm text-sm leading-6 text-white/60">{brandText}</p>
        <a href={`mailto:${contactEmail}`} className="mt-7 inline-flex items-center gap-2 text-sm text-white/70 transition hover:text-white"><Mail size={15} />{contactEmail}</a>
        <a href={`tel:${contactPhone}`} className="mt-2 flex items-center gap-2 text-sm text-white/70 transition hover:text-white"><Phone size={15} />{contactPhone}</a>
        <div className="mt-7 flex items-center gap-3">
          {socialEntries.length ? socialEntries.map(([platform, url]) => (
            <a key={platform} href={url} rel="noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white/70 transition hover:border-sage hover:text-sage" aria-label={platform}>{platformIcon(platform)}</a>
          )) : (
            <>
              <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white/70 transition hover:border-sage hover:text-sage" aria-label="Instagram"><Instagram size={16} /></a>
              <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white/70 transition hover:border-sage hover:text-sage" aria-label="Facebook"><Facebook size={16} /></a>
            </>
          )}
        </div>
      </div>
      <div>
        <p className="eyebrow text-sage">Explore</p>
        <nav className="mt-5 flex flex-col gap-3 text-sm text-white/65" aria-label="Footer navigation">
          {navigation.slice(0, 2).map((item) => <Link key={item.to} to={item.to} className="transition hover:text-white">{item.label}</Link>)}
          <Link to="/contact" className="transition hover:text-white">Contact</Link>
        </nav>
      </div>
      <div>
        <p className="eyebrow text-sage">Plan your stay</p>
        <nav className="mt-5 flex flex-col gap-3 text-sm text-white/65" aria-label="Footer stay links">
          {navigation.slice(2, 4).map((item) => <Link key={item.to} to={item.to} className="transition hover:text-white">{item.label}</Link>)}
          <Link to="/gallery" className="transition hover:text-white">Gallery</Link>
          <Link to="/offers" className="transition hover:text-white">Current offers</Link>
        </nav>
      </div>
      <div>
        <p className="eyebrow text-sage">Notes from the house</p>
        <p className="mt-5 text-sm leading-6 text-white/60">Occasional notes about rooms, seasons and slow Sundays. No noise.</p>
        {subscribed ? (
          <p className="mt-6 flex items-center gap-2.5 text-sm text-sage" role="status"><Send size={15} />You are on the list. See you in the post.</p>
        ) : (
          <form className="mt-6 flex" onSubmit={subscribe}>
            <label className="sr-only" htmlFor="footer-newsletter">Email address</label>
            <input id="footer-newsletter" type="email" required autoComplete="email" maxLength={254} placeholder="Your email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full border border-white/25 bg-transparent px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-sage focus:outline-none" />
            <button type="submit" aria-label="Subscribe" className="shrink-0 border border-white/25 bg-white/10 px-4 text-white transition hover:border-sage hover:text-sage"><Send size={15} /></button>
          </form>
        )}
        <p className="mt-4 text-[11px] text-white/40">Sent a few times a year. Unsubscribe anytime.</p>
      </div>
    </div>
    <div className="border-t border-white/10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-5 text-[11px] uppercase tracking-[0.16em] text-white/40 md:flex-row lg:px-10">
        <p>© {new Date().getFullYear()} Alder House · A StayFlow original</p>
        <div className="flex items-center gap-6">
          <a href="#" className="transition hover:text-white">Privacy</a>
          <a href="#" className="transition hover:text-white">Terms</a>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="inline-flex items-center gap-1.5 transition hover:text-white">Back to top<ArrowUp size={13} /></button>
        </div>
      </div>
    </div>
  </footer>;
}

export function ArrowLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className="group inline-flex items-center gap-2 text-sm font-semibold text-forest">{children}<ArrowUpRight size={16} className="transition group-hover:translate-x-1 group-hover:-translate-y-1" /></Link>;
}
