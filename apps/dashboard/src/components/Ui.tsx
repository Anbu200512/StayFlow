import { cloneElement, useId, useRef, type ReactElement, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, X } from 'lucide-react';
import { useDialog } from '../lib/useDialog';

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) { return <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div>{eyebrow && <p className="text-xs font-medium text-forest">{eyebrow}</p>}<h1 className="mt-2 text-2xl font-semibold leading-tight text-ink md:text-3xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/55">{description}</p>}</div>{action}</div>; }
export function StatCard({ label, value, detail, icon, tone = 'default' }: { label: string; value: string | number; detail?: string; icon?: ReactNode; tone?: 'default' | 'green' | 'copper' }) { return <div className={`dashboard-card p-5 ${tone === 'green' ? 'border-emerald-200 bg-emerald-600 text-white' : tone === 'copper' ? 'border-amber-200 bg-amber-50' : ''}`}><div className="flex items-start justify-between"><p className={`text-xs font-medium ${tone === 'green' ? 'text-emerald-100' : 'text-ink/55'}`}>{label}</p>{icon && <span className={tone === 'green' ? 'text-emerald-100' : 'text-forest'}>{icon}</span>}</div><p className="mt-4 text-2xl font-semibold leading-none">{value}</p>{detail && <p className={`mt-2 text-sm ${tone === 'green' ? 'text-white/70' : 'text-ink/50'}`}>{detail}</p>}</div>; }
export type StatusTone = 'success' | 'warning' | 'attention' | 'danger' | 'neutral';
const statusTones: Record<string, StatusTone> = {
  available: 'success',
  confirmed: 'success',
  completed: 'success',
  active: 'success',
  paid: 'success',
  delivered: 'success',
  ready: 'success',
  resolved: 'success',
  published: 'success',
  sent: 'success',
  inspected: 'success',
  checked_in: 'success',
  pending: 'warning',
  accepted: 'warning',
  assigned: 'warning',
  reserved: 'warning',
  occupied: 'warning',
  draft: 'warning',
  open: 'warning',
  issued: 'warning',
  preparing: 'warning',
  maintenance: 'warning',
  in_progress: 'attention',
  cleaning: 'attention',
  dirty: 'attention',
  partially_paid: 'attention',
  cancelled: 'danger',
  no_show: 'danger',
  out_of_service: 'danger',
  failed: 'danger',
  void: 'danger',
  rejected: 'danger',
  declined: 'danger',
  checked_out: 'neutral',
  closed: 'neutral',
  read: 'neutral',
  refunded: 'neutral',
  partially_refunded: 'neutral',
};
export const toneStyles: Record<StatusTone, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-800',
  attention: 'bg-orange-50 text-orange-800',
  danger: 'bg-red-50 text-red-700',
  neutral: 'bg-slate-100 text-slate-600',
};
export function StatusBadge({ status }: { status: string }) { const normalized = status.toLowerCase().replaceAll(' ', '_'); const tone = toneStyles[statusTones[normalized] ?? 'neutral']; return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium ${tone}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status.replaceAll('_', ' ')}</span>; }
export function LoadingState({ label = 'Loading' }: { label?: string }) { return <div role="status" aria-live="polite" className="flex min-h-48 items-center justify-center gap-3 text-sm text-ink/50"><LoaderCircle size={18} className="animate-spin text-forest" />{label}</div>; }
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) { return <div role="alert" className="flex min-h-48 flex-col items-center justify-center gap-3 text-center"><AlertCircle className="text-copper" size={26} aria-hidden="true" /><p className="text-sm text-ink/55">{message ?? 'Something went wrong.'}</p>{onRetry && <button type="button" className="dashboard-button-light" onClick={onRetry}>Try again</button>}</div>; }
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <div className="dashboard-card p-12 text-center"><CheckCircle2 className="mx-auto text-forest" size={28} aria-hidden="true" /><h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/50">{description}</p>{action && <div className="mt-5">{action}</div>}</div>; }
export function Modal({ title, description, onClose, children, footer, wide = false }: { title: string; description?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialog(panelRef, onClose);
  const titleId = useId();
  const descriptionId = useId();
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className={`max-h-[90vh] w-full overflow-y-auto bg-white p-6 shadow-xl outline-none ${wide ? 'max-w-3xl' : 'max-w-xl'}`}><div className="flex items-start justify-between gap-4"><div><h3 id={titleId} className="text-xl font-semibold leading-snug">{title}</h3>{description && <p id={descriptionId} className="mt-1 text-sm text-ink/50">{description}</p>}</div><button type="button" onClick={onClose} className="shrink-0 text-ink/45 transition hover:text-ink" aria-label="Close dialog"><X size={19} /></button></div>{children}{footer && <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-ink/10 pt-4">{footer}</div>}</div></div>; }
export function Field({ label, children, error, hint, required }: { label: string; children: ReactNode; error?: string; hint?: string; required?: boolean }) {
  const generatedId = useId();
  const errorId = `${generatedId}-error`;
  const hintId = `${generatedId}-hint`;
  const describedBy = [error ? errorId : null, hint && !error ? hintId : null].filter(Boolean).join(' ') || undefined;
  const child = Array.isArray(children) ? children[0] : children;
  const control =
    typeof child === 'object' && child !== null && 'props' in child
      ? cloneElement(child as ReactElement<Record<string, unknown>>, {
          id: ((child as ReactElement<Record<string, unknown>>).props.id as string) ?? generatedId,
          'aria-describedby': describedBy,
          'aria-invalid': error ? true : undefined,
          ...(required === undefined ? {} : { required }),
        })
      : child;
  return (
    <div className="block">
      <label htmlFor={generatedId} className="dashboard-label">
        {label}
        {required && <span className="ml-1 text-copper" aria-hidden="true">*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {control}
      {hint && !error && <span id={hintId} className="mt-1 block text-xs text-ink/40">{hint}</span>}
      {error && <span id={errorId} className="mt-1 block text-xs text-copper">{error}</span>}
    </div>
  );
}