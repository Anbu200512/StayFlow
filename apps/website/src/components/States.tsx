import type { ReactNode } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';

export function LoadingState({ label = 'Loading' }: { label?: string }) { return <div role="status" aria-live="polite" className="flex min-h-40 items-center justify-center gap-3 text-sm text-ink/55"><LoaderCircle size={18} className="animate-spin text-forest" aria-hidden="true" />{label}</div>; }
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) { return <div role="alert" className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center"><AlertCircle className="text-copper" size={28} aria-hidden="true" /><p className="text-sm text-ink/65">{message ?? 'We could not load this content right now.'}</p>{onRetry && <button type="button" onClick={onRetry} className="button-secondary">Try again</button>}</div>; }
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <div className="border border-dashed border-ink/20 px-6 py-14 text-center"><p className="font-display text-3xl text-ink">{title}</p><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink/55">{description}</p>{action && <div className="mt-6">{action}</div>}</div>; }
interface PageIntroProps {
  eyebrow: string;
  title: string;
  description?: string;
  dark?: boolean;
  image?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}

export function PageIntro({ eyebrow, title, description, dark = false, image, actions, meta }: PageIntroProps) {
  if (image) {
    return (
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <img src={image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-55" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/75 via-ink/35 to-ink/85" />
        <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-32 md:pt-44 lg:px-10 lg:pb-20">
          <p className="eyebrow text-sage">{eyebrow}</p>
          <h1 className="display-title mt-4 max-w-4xl text-white">{title}</h1>
          {description && <p className="mt-6 max-w-2xl text-base leading-7 text-white/70">{description}</p>}
          {actions && <div className="mt-9 flex flex-wrap gap-3">{actions}</div>}
          {meta && <div className="mt-12 border-t border-white/20 pt-7">{meta}</div>}
        </div>
      </section>
    );
  }
  return <div className={`mx-auto max-w-7xl px-5 py-20 md:py-28 lg:px-10 ${dark ? 'text-white' : ''}`}><p className={`eyebrow ${dark ? 'text-sage' : ''}`}>{eyebrow}</p><h1 className={`display-title mt-4 max-w-4xl ${dark ? 'text-white' : ''}`}>{title}</h1>{description && <p className={`mt-6 max-w-2xl text-base leading-7 ${dark ? 'text-white/65' : 'text-ink/60'}`}>{description}</p>}{actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}{meta && <div className="mt-10">{meta}</div>}</div>;
}
