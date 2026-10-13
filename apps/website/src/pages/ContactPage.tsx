import { useEffect, useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, Mail, MapPin, Phone, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { hotelQuery } from '../lib/queries';
import { publicApi } from '../lib/api';
import { PageIntro } from '../components/States';

const heroImage = 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=2200&q=85';

interface ContactForm { name: string; email: string; phone: string; message: string }
const initialForm: ContactForm = { name: '', email: '', phone: '', message: '' };

const responseNotes = [
  'The team answers enquiries within a few hours during the day',
  'For stays starting today, call reception instead — it is faster',
  'Your note goes straight to the house, not to a call centre',
];

export default function ContactPage() {
  const { data, isLoading, isError } = hotelQuery();
  const [form, setForm] = useState<ContactForm>(initialForm);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const hotel = data?.hotel;
  const content = data?.content;
  const contact = content?.contact ?? hotel?.contact;
  const location = content?.location;
  const addressLine = location?.address ?? (hotel ? `${hotel.address.line1}, ${hotel.address.city}, ${hotel.address.country}${hotel.address.postalCode ? ` ${hotel.address.postalCode}` : ''}` : '');
  const mapHref = location?.mapUrl ?? (addressLine ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}` : undefined);
  const findUsValue = location?.label ? <>{location.label}<br />{addressLine}</> : hotel ? <>{hotel.address.line1}<br />{hotel.address.city}, {hotel.address.country}</> : isLoading ? 'Loading hotel details…' : isError ? 'Hotel details are temporarily unavailable.' : 'Contact the hotel for its address.';
  useEffect(() => { document.title = `Contact · ${hotel?.name ?? 'StayFlow'}`; }, [hotel?.name]);

  const update = (field: keyof ContactForm, value: string) => { setForm((current) => ({ ...current, [field]: value })); setSent(false); setError(''); };
  const submit = async (event: FormEvent) => { event.preventDefault(); setLoading(true); setError(''); try { await publicApi.submitContact({ ...form, phone: form.phone.trim() || undefined }); setSent(true); setForm(initialForm); } catch (requestError) { setError((requestError as { userMessage?: string }).userMessage ?? 'Your message could not be sent. Please try again.'); } finally { setLoading(false); } };

  const meta = (
    <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
      <div><dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Reception</dt><dd className="mt-2 font-display text-3xl text-white">24 hours</dd></div>
      <div><dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Replies</dt><dd className="mt-2 font-display text-3xl text-white">In hours</dd></div>
      <div><dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Phone</dt><dd className="mt-2 font-display text-3xl text-white">Direct</dd></div>
      <div><dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Walk-ins</dt><dd className="mt-2 font-display text-3xl text-white">Welcome</dd></div>
    </dl>
  );

  return <>
    <PageIntro
      eyebrow="Say hello"
      title="Let us help with the details."
      description="Questions about a stay, a table, or a late arrival? Send a note directly to the hotel team — it lands in the same room as someone who can help."
      image={heroImage}
      actions={<><a href="#enquiry" className="button-primary bg-white text-ink hover:bg-sand">Send a note <ArrowUpRight size={16} /></a><Link to="/rooms" className="button-secondary border-white/50 text-white hover:border-white hover:text-white">Browse rooms</Link></>}
      meta={meta}
    />

    <section className="mx-auto max-w-7xl px-5 py-24 lg:px-10">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><p className="eyebrow">Reach the house</p><h2 className="section-title mt-4">A small team, quick answers.</h2></div>
        <p className="max-w-sm text-sm leading-6 text-ink/55">Write, call, or walk in — whichever is easiest for you.</p>
      </div>
      <div className="mt-12 grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <div className="grid gap-6">
            <ContactItem icon={<MapPin size={18} />} label="Find us" value={findUsValue} href={mapHref} />
            <ContactItem icon={<Mail size={18} />} label="Email" value={contact?.email ?? (isLoading ? 'Loading hotel details…' : 'Available through the enquiry form')} href={contact?.email ? `mailto:${contact.email}` : undefined} />
            <ContactItem icon={<Phone size={18} />} label="Call" value={contact?.phone ?? (isLoading ? 'Loading hotel details…' : 'Available through the enquiry form')} href={contact?.phone ? `tel:${contact.phone}` : undefined} />
          </div>
          <div className="mt-8 border border-ink/10 bg-sand p-6">
            <p className="eyebrow">Before you write</p>
            <ul className="mt-5 space-y-3">
              {responseNotes.map((note) => <li key={note} className="flex items-start gap-2.5 text-sm leading-6 text-ink/70"><Check size={16} className="mt-0.5 shrink-0 text-forest" />{note}</li>)}
            </ul>
          </div>
        </div>
        <form className="border border-ink/10 bg-white p-6 md:p-10" id="enquiry" onSubmit={submit}>
          <p className="eyebrow">Send a note</p>
          <h2 className="mt-2 font-display text-3xl">What can we arrange?</h2>
          <div className="mt-7 grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <label><span className="label-text">Name</span><input className="input-field" name="name" autoComplete="name" minLength={2} maxLength={120} value={form.name} onChange={(event) => update('name', event.target.value)} required /></label>
              <label><span className="label-text">Email</span><input className="input-field" name="email" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={(event) => update('email', event.target.value)} required /></label>
            </div>
            <label><span className="label-text">Phone (optional)</span><input className="input-field" name="phone" type="tel" autoComplete="tel" maxLength={40} value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label>
            <label><span className="label-text">Message</span><textarea className="input-field min-h-32 resize-y" name="message" rows={5} maxLength={2000} value={form.message} onChange={(event) => update('message', event.target.value)} required /></label>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            {sent && <p className="text-sm text-forest" role="status">Thank you — your note is with the team. Expect an answer within a few hours.</p>}
            <button type="submit" disabled={loading} className="button-primary disabled:opacity-60">{loading ? 'Sending…' : 'Send the note'}<Send size={16} /></button>
          </div>
        </form>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-10 lg:py-24">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <p className="eyebrow">Good to know</p>
        <h2 className="mt-4 font-display text-5xl leading-none text-ink md:text-6xl">The house is easier to reach than this page.</h2>
        <p className="mt-5 max-w-xl text-sm leading-6 text-ink/60">Reception is staffed around the clock, and the best answer often comes from a short walk to the desk.</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link to="/rooms" className="button-primary">Find your room <ArrowUpRight size={16} /></Link>
          <Link to="/offers" className="button-secondary">Current offers</Link>
        </div>
      </div>
    </section>
  </>;
}

function ContactItem({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: React.ReactNode; href?: string }) {
  return <div className="flex gap-4 border-t border-ink/10 pt-5"><div className="text-forest">{icon}</div><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">{label}</p>{href ? <a className="mt-2 block text-sm text-ink transition hover:text-forest" href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined}>{value}</a> : <p className="mt-2 text-sm leading-6 text-ink/65">{value}</p>}</div></div>;
}