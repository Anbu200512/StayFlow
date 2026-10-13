import { useEffect, useState } from 'react';
import { ArrowUpRight, BadgePercent, Check, Copy, Gift, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { offersQuery } from '../lib/queries';
import { EmptyState, ErrorState, LoadingState, PageIntro } from '../components/States';
import type { Offer } from '../types';

const heroImage = 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=2200&q=85';

const bonusOffer: Offer = {
  _id: 'extra-golden-weekend',
  title: 'The golden weekend',
  description: 'Flat ₹1,500 off any weekend stay of two nights or more — Friday to Sunday is the sweet spot.',
  code: 'WEEKEND1500',
  discountType: 'fixed',
  discountValue: 1500,
  minNights: 2,
  validFrom: '2026-10-09T00:00:00.000Z',
  validTo: '2026-12-31T00:00:00.000Z',
  terms: 'Applies to Friday, Saturday and Sunday nights. Enter the code at checkout; cannot be combined with other offers.',
};

const steps = [
  { n: '01', title: 'Pick an offer', text: 'Clear by design. Choose the one that fits the trip you have in mind.' },
  { n: '02', title: 'Book direct', text: 'Choose your dates and your room on our own site — no middlemen, no runaround.' },
  { n: '03', title: 'Applied at checkout', text: 'Our booking engine applies the discount and shows the final amount before you pay.' },
];

const perks = [
  'The rate we hold is the rate you pay',
  'Your preferences are kept on file',
  'A direct line to the house for changes',
  'No third-party fees, ever',
];

const faqs = [
  { q: 'How is a discount applied?', a: 'At checkout you add the offer code (or we apply it for you). The amount is recalculated by our booking engine before any payment is taken.' },
  { q: 'Can I combine two offers?', a: 'One active offer applies per booking. Discounts are never stacked, so the best-value offer for your stay wins.' },
  { q: 'What happens if the offer window closes first?', a: 'The dates in the offer window govern. If your stay starts before the window closes, the offer still applies in full.' },
];

export default function OffersPage() {
  const { data, isLoading, isError, refetch } = offersQuery();
  const [copied, setCopied] = useState<string | null>(null);
  const live = data?.length ?? 0;

  useEffect(() => { document.title = 'Offers · Alder House'; }, []);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
    } catch {
      setCopied(null);
    }
  };

  return <>
    <PageIntro
      eyebrow="A little extra"
      title="Good things to look forward to."
      description="Current offers are applied securely at checkout, with the final amount always calculated by our booking engine."
      image={heroImage}
      actions={<><Link to="/rooms" className="button-primary bg-white text-ink hover:bg-sand">Check availability <ArrowUpRight size={16} /></Link><Link to="/contact" className="button-secondary border-white/50 text-white hover:border-white hover:text-white">Ask about a stay</Link></>}
      meta={<p className="text-sm text-white/70">{isLoading ? 'Checking live offers…' : `${live} live offer${live === 1 ? '' : 's'} right now`}</p>}
    />

    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-10">
      <div className="grid gap-8 md:grid-cols-3">
        {steps.map((step) => <div key={step.n} className="border-t border-ink/15 pt-5"><p className="font-display text-5xl text-forest/25">{step.n}</p><h2 className="mt-4 font-display text-3xl">{step.title}</h2><p className="mt-3 text-sm leading-6 text-ink/55">{step.text}</p></div>)}
      </div>
    </section>

    <div className="mx-auto max-w-7xl px-5 pb-24 lg:px-10">
      {isLoading ? <LoadingState label="Loading offers" /> : isError ? <ErrorState message="We could not load current offers." onRetry={() => refetch()} /> : data?.length ? (
        <div className="grid gap-5 md:grid-cols-2">
          {data.map((offer, index) => <OfferCard key={offer._id} offer={offer} featured={index === 0} copied={copied} onCopy={copyCode} />)}
          <OfferCard offer={bonusOffer} copied={copied} onCopy={copyCode} />
          <div className="border border-forest/20 bg-sand p-7 md:col-span-2 md:p-9">
            <p className="eyebrow">Direct booking</p>
            <h2 className="mt-4 max-w-xl font-display text-3xl">The best rate is always the one you find here.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-ink/60">Book direct and our team will have your preferences on file before you arrive.</p>
            <ul className="mt-7 grid gap-3 md:grid-cols-2">
              {perks.map((perk) => <li key={perk} className="flex items-start gap-2.5 text-sm text-ink/70"><Check size={16} className="mt-0.5 shrink-0 text-forest" />{perk}</li>)}
            </ul>
            <div className="mt-8"><Link to="/rooms" className="button-primary">Find a room<ArrowUpRight size={16} /></Link></div>
          </div>
        </div>
      ) : <div className="md:col-span-2"><EmptyState title="No current offers" description="There are no offers running today, but our team is always happy to help you plan a good stay." action={<Link to="/contact" className="button-secondary">Talk to the team</Link>} /></div>}
    </div>

    <section className="bg-sand">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-24 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
        <div><p className="eyebrow">Good to know</p><h2 className="section-title mt-4">A few honest answers.</h2><p className="mt-5 max-w-md text-sm leading-6 text-ink/55">If your question is not covered here, write to us — the team answers quickly during the day.</p></div>
        <div className="flex flex-col gap-5">
          {faqs.map((faq) => <details key={faq.q} className="group border border-ink/10 bg-white"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-semibold text-ink"><span>{faq.q}</span><span className="text-forest transition group-open:rotate-45">+</span></summary><p className="border-t border-ink/10 px-6 py-5 text-sm leading-6 text-ink/60">{faq.a}</p></details>)}
        </div>
      </div>
    </section>
  </>;
}

function OfferCard({ offer, featured, copied, onCopy }: { offer: Offer; featured?: boolean; copied: string | null; onCopy: (code: string) => void }) {
  const start = new Date(offer.validFrom).getTime();
  const end = new Date(offer.validTo).getTime();
  const now = Date.now();
  const span = end > start ? end - start : 1;
  const progress = Math.min(100, Math.max(0, ((now - start) / span) * 100));
  const daysLeft = end > now ? Math.ceil((end - now) / 86400000) : 0;
  const isPercent = offer.discountType === 'percentage';
  const discount = isPercent ? `${offer.discountValue}% off` : `₹${offer.discountValue} off`;
  const Icon = featured ? BadgePercent : isPercent ? Sparkles : Gift;
  const period = `${new Date(offer.validFrom).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} – ${new Date(offer.validTo).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`;
  const wasCopied = copied === offer.code;

  return <article className={`flex flex-col ${featured ? 'bg-forest p-8 text-white md:col-span-2 md:p-10' : 'border border-ink/10 bg-white p-7 md:p-9'}`}>
    <div className="flex items-start justify-between gap-6">
      <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${featured ? 'text-sage' : 'text-copper'}`}>{featured ? "Today's featured offer" : isPercent ? 'Percentage off' : 'Fixed saving'}</p>
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${featured ? 'border border-white/25 text-sage' : 'bg-sand text-forest'}`}><Icon size={20} aria-hidden="true" /></span>
    </div>
    <h2 className={`mt-4 font-display ${featured ? 'text-4xl leading-none md:text-5xl' : 'text-3xl'} ${featured ? 'text-white' : 'text-ink'}`}>{offer.title}</h2>
    <p className={`mt-3 max-w-md text-sm leading-6 ${featured ? 'text-white/70' : 'text-ink/60'}`}>{offer.description}</p>
    <div className="mt-7 flex flex-wrap items-center gap-3 text-xs">
      <span className={`font-semibold ${featured ? 'bg-white/15 px-3 py-1.5 text-white' : 'border border-forest/30 px-3 py-1.5 text-forest'}`}>{discount}</span>
      <span className={`px-3 py-1.5 ${featured ? 'bg-white/10 text-white/80' : 'bg-sand text-ink/60'}`}>{offer.minNights && offer.minNights > 1 ? `${offer.minNights}+ nights` : 'Any stay'}</span>
      <span className={`${featured ? 'text-white/60' : 'text-ink/45'}`}>{daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : 'Ending today'}</span>
    </div>
    <div className="mt-6">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-ink/40">
        <span className={featured ? 'text-white/55' : 'text-ink/45'}>Offer window {period}</span>
        <span className={featured ? 'text-white/55' : 'text-ink/45'}>{Math.round(progress)}% elapsed</span>
      </div>
      <div role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Offer window elapsed" className={`mt-2 h-1.5 w-full ${featured ? 'bg-white/20' : 'bg-ink/10'}`}>
        <div className={`h-full ${featured ? 'bg-sage' : 'bg-forest'}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
    <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-8">
      <p className={`text-xs ${featured ? 'text-white/60' : 'text-ink/45'}`}>Valid {period}</p>
      {offer.code ? <div className="flex items-stretch gap-2"><code className={`flex items-center border border-dashed px-3 py-2 text-xs font-semibold ${featured ? 'border-white/40 text-white' : 'border-forest/40 text-forest'}`}>{offer.code}</code><button type="button" onClick={() => onCopy(offer.code!)} className={`inline-flex items-center gap-1.5 border px-3 py-2 text-xs font-semibold transition ${featured ? 'border-white/30 text-white hover:bg-white hover:text-forest' : 'border-ink/15 text-ink/70 hover:border-forest hover:text-forest'}`} aria-label={wasCopied ? `Code ${offer.code} copied` : `Copy code ${offer.code}`}>{wasCopied ? <><Check size={14} />Copied</> : <><Copy size={14} />Copy</>}</button></div> : <span className={`text-xs ${featured ? 'text-white/60' : 'text-ink/45'}`}>Applied automatically at checkout</span>}
    </div>
    <Link to="/rooms" className={`mt-8 inline-flex w-fit items-center gap-2 text-sm font-semibold ${featured ? 'bg-white px-5 py-3 text-forest hover:bg-sand' : 'text-forest'}`}>Use this offer <ArrowUpRight size={16} /></Link>
    {offer.terms && <details className={`mt-6 border-t pt-4 ${featured ? 'border-white/20' : 'border-ink/10'}`}><summary className={`cursor-pointer text-[11px] font-semibold uppercase tracking-[0.16em] ${featured ? 'text-white/70' : 'text-ink/45'}`}>Terms apply</summary><p className={`mt-3 text-xs leading-5 ${featured ? 'text-white/60' : 'text-ink/55'}`}>{offer.terms}</p></details>}
  </article>;
}