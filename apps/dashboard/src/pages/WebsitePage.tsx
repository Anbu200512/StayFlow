import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, Info, Mail, MapPin, Phone, Plus, Save, Star, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { adminApi } from '../lib/api';
import type { WebsiteContent } from '../types';
import { ErrorState, Field, LoadingState, PageHeader, StatusBadge } from '../components/Ui';
import { formatDateTime } from '../lib/format';

interface Highlight {
  title: string;
  description: string;
  icon: string;
}

interface SocialLink {
  platform: string;
  url: string;
}

interface ContentForm {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  about: string;
  highlights: Highlight[];
  locationLabel: string;
  locationAddress: string;
  mapUrl: string;
  phone: string;
  email: string;
  website: string;
  footerText: string;
  socialLinks: SocialLink[];
  published: boolean;
}

type FieldErrors = Record<string, string>;

const optionalUrl = z.union([z.literal(''), z.string().trim().url('Enter a valid URL')]);

const contentSchema = z.object({
  eyebrow: z.string().trim().max(120, 'Keep the eyebrow under 120 characters'),
  title: z.string().trim().max(200, 'Keep the title under 200 characters'),
  subtitle: z.string().trim().max(500, 'Keep the subtitle under 500 characters'),
  primaryCta: z.string().trim().max(80, 'Keep the call to action under 80 characters'),
  secondaryCta: z.string().trim().max(80, 'Keep the call to action under 80 characters'),
  about: z.string().trim().max(5000, 'Keep the story under 5000 characters'),
  highlights: z.array(z.object({
    title: z.string().trim().min(2, 'A highlight needs a title').max(120, 'Keep the title under 120 characters'),
    description: z.string().trim().min(2, 'A highlight needs a description').max(500, 'Keep the description under 500 characters'),
    icon: z.string().trim().max(40, 'Icon keys are limited to 40 characters'),
  })).max(12, 'Twelve highlights is the maximum'),
  locationLabel: z.string().trim().max(120, 'Keep the label under 120 characters'),
  locationAddress: z.string().trim().max(500, 'Keep the address under 500 characters'),
  mapUrl: optionalUrl,
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(30, 'Keep the phone number under 30 characters'),
  email: z.string().trim().email('Enter a valid email address'),
  website: optionalUrl,
  footerText: z.string().trim().max(300, 'Keep the footer text under 300 characters'),
  socialLinks: z.array(z.object({
    platform: z.string().trim().min(1, 'Name the platform'),
    url: optionalUrl,
  })),
  published: z.boolean(),
});

const emptyForm: ContentForm = {
  eyebrow: '',
  title: '',
  subtitle: '',
  primaryCta: '',
  secondaryCta: '',
  about: '',
  highlights: [],
  locationLabel: '',
  locationAddress: '',
  mapUrl: '',
  phone: '',
  email: '',
  website: '',
  footerText: '',
  socialLinks: [],
  published: false,
};

function collect(issues: z.ZodIssue[]): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || 'form';
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

function toForm(content: WebsiteContent): ContentForm {
  return {
    eyebrow: content.home?.eyebrow ?? '',
    title: content.home?.title ?? '',
    subtitle: content.home?.subtitle ?? '',
    primaryCta: content.home?.primaryCta ?? '',
    secondaryCta: content.home?.secondaryCta ?? '',
    about: content.about ?? '',
    highlights: (content.whyChooseUs ?? []).map((item) => ({ title: item.title, description: item.description, icon: item.icon ?? '' })),
    locationLabel: content.location?.label ?? '',
    locationAddress: content.location?.address ?? '',
    mapUrl: content.location?.mapUrl ?? '',
    phone: content.contact?.phone ?? '',
    email: content.contact?.email ?? '',
    website: content.contact?.website ?? '',
    footerText: content.footerText ?? '',
    socialLinks: Object.entries(content.socialLinks ?? {}).map(([platform, url]) => ({ platform, url })),
    published: content.published,
  };
}

function toPayload(values: ContentForm): Partial<WebsiteContent> {
  const home: NonNullable<WebsiteContent['home']> = {
    eyebrow: values.eyebrow,
    title: values.title,
    subtitle: values.subtitle,
    primaryCta: values.primaryCta,
    secondaryCta: values.secondaryCta,
  };
  const highlights = values.highlights.map((item) => {
    const entry: { title: string; description: string; icon?: string } = { title: item.title, description: item.description };
    if (item.icon) entry.icon = item.icon;
    return entry;
  });
  const location: NonNullable<WebsiteContent['location']> = {
    label: values.locationLabel,
    address: values.locationAddress,
  };
  if (values.mapUrl) location.mapUrl = values.mapUrl;
  const contact: NonNullable<WebsiteContent['contact']> = {
    phone: values.phone,
    email: values.email,
  };
  if (values.website) contact.website = values.website;
  const socialLinks: Record<string, string> = {};
  for (const link of values.socialLinks) {
    const platform = link.platform.trim().toLowerCase();
    if (platform && link.url.trim()) socialLinks[platform] = link.url.trim();
  }
  return {
    home,
    about: values.about,
    whyChooseUs: highlights,
    location,
    contact,
    footerText: values.footerText,
    socialLinks,
    published: values.published,
  };
}

export default function WebsitePage() {
  const [form, setForm] = useState<ContentForm>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const client = useQueryClient();
  const content = useQuery({ queryKey: ['website'], queryFn: adminApi.website });
  const save = useMutation({
    mutationFn: (payload: Partial<WebsiteContent>) => adminApi.updateWebsite(payload),
    onSuccess: (result) => {
      setErrors({});
      setSavedAt(new Date().toISOString());
      void client.setQueryData(['website'], result);
      void client.invalidateQueries({ queryKey: ['website'] });
    },
  });

  useEffect(() => {
    if (content.data) setForm(toForm(content.data));
  }, [content.data]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = contentSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(collect(parsed.error.issues));
      setSavedAt(null);
      return;
    }
    setErrors({});
    save.mutate(toPayload(parsed.data));
  };

  const reset = () => {
    if (content.data) setForm(toForm(content.data));
    setErrors({});
    setSavedAt(null);
  };

  if (content.isLoading) return <LoadingState label="Loading website content" />;
  if (content.isError || !content.data) return <ErrorState message="Website content could not be loaded." onRetry={() => content.refetch()} />;

  const highlightError = (index: number, key: keyof Highlight) => errors[`highlights.${index}.${key}`];

  return (
    <>
      <PageHeader
        eyebrow="Guest website"
        title="Website content"
        description="Everything the public site reads is managed here. Empty optional fields are cleared when you save."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="dashboard-button-light" onClick={reset}>Discard changes</button>
            <button type="submit" form="website-content" className="dashboard-button" disabled={save.isPending}>
              <Save size={15} />
              {save.isPending ? 'Saving…' : 'Save content'}
            </button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <StatusBadge status={form.published ? 'published' : 'draft'} />
        <span className="text-xs text-ink/45">Last updated {formatDateTime(content.data.updatedAt)}</span>
        {savedAt && <span className="text-xs font-semibold text-forest">Saved just now</span>}
      </div>

      <form id="website-content" className="space-y-6" onSubmit={submit} noValidate>
        <section className="dashboard-card p-5 md:p-6">
          <h3 className="font-display text-2xl">Home hero</h3>
          <p className="mt-1 text-xs text-ink/45">The first thing a visitor reads on the landing page.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Eyebrow" error={errors.eyebrow}>
              <input className="dashboard-input" maxLength={120} value={form.eyebrow} onChange={(event) => setForm({ ...form, eyebrow: event.target.value })} />
            </Field>
            <Field label="Headline" error={errors.title}>
              <input className="dashboard-input" maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Subheadline" error={errors.subtitle}>
                <textarea className="dashboard-input min-h-24" rows={3} maxLength={500} value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} />
              </Field>
            </div>
            <Field label="Primary button" error={errors.primaryCta}>
              <input className="dashboard-input" maxLength={80} value={form.primaryCta} onChange={(event) => setForm({ ...form, primaryCta: event.target.value })} />
            </Field>
            <Field label="Secondary button" error={errors.secondaryCta}>
              <input className="dashboard-input" maxLength={80} value={form.secondaryCta} onChange={(event) => setForm({ ...form, secondaryCta: event.target.value })} />
            </Field>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="dashboard-card p-5 md:p-6">
            <h3 className="font-display text-2xl">Our story</h3>
            <p className="mt-1 text-xs text-ink/45">Shown in the about section of the public site.</p>
            <div className="mt-5">
              <Field label="About" error={errors.about}>
                <textarea className="dashboard-input min-h-56" rows={10} maxLength={5000} value={form.about} onChange={(event) => setForm({ ...form, about: event.target.value })} />
              </Field>
            </div>
          </section>

          <div className="space-y-6">
            <section className="dashboard-card p-5 md:p-6">
              <h3 className="flex items-center gap-2 font-display text-2xl"><Phone size={18} className="text-forest" />Contact</h3>
              <div className="mt-5 space-y-4">
                <Field label="Phone" error={errors.phone}>
                  <input className="dashboard-input" maxLength={30} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                </Field>
                <Field label="Email" error={errors.email}>
                  <input className="dashboard-input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                </Field>
                <Field label="Website" error={errors.website}>
                  <input className="dashboard-input" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} placeholder="https://" />
                </Field>
              </div>
            </section>

            <section className="dashboard-card p-5 md:p-6">
              <h3 className="flex items-center gap-2 font-display text-2xl"><MapPin size={18} className="text-forest" />Location</h3>
              <div className="mt-5 space-y-4">
                <Field label="Label" error={errors.locationLabel}>
                  <input className="dashboard-input" maxLength={120} value={form.locationLabel} onChange={(event) => setForm({ ...form, locationLabel: event.target.value })} />
                </Field>
                <Field label="Address" error={errors.locationAddress}>
                  <textarea className="dashboard-input min-h-20" rows={2} maxLength={500} value={form.locationAddress} onChange={(event) => setForm({ ...form, locationAddress: event.target.value })} />
                </Field>
                <Field label="Map link" error={errors.mapUrl}>
                  <input className="dashboard-input" value={form.mapUrl} onChange={(event) => setForm({ ...form, mapUrl: event.target.value })} placeholder="https://" />
                </Field>
              </div>
            </section>
          </div>
        </div>

        <section className="dashboard-card p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 font-display text-2xl"><Star size={18} className="text-copper" />Why choose us</h3>
              <p className="mt-1 text-xs text-ink/45">Short selling points for the home page. Up to twelve, and the icon key is a short label rather than an image.</p>
            </div>
            <button
              type="button"
              className="dashboard-button-light"
              disabled={form.highlights.length >= 12}
              onClick={() => setForm({ ...form, highlights: [...form.highlights, { title: '', description: '', icon: '' }] })}
            >
              <Plus size={15} />
              Add highlight
            </button>
          </div>
          {errors.highlights && <p className="mt-3 text-xs text-copper">{errors.highlights}</p>}
          <div className="mt-5 space-y-4">
            {form.highlights.map((highlight, index) => (
              <div key={index} className="border border-ink/10 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-ink/55">Highlight {index + 1}</p>
                  <button
                    type="button"
                    className="text-ink/40 transition hover:text-copper"
                    aria-label={`Remove highlight ${index + 1}`}
                    onClick={() => setForm({ ...form, highlights: form.highlights.filter((_, position) => position !== index) })}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.6fr_0.7fr]">
                  <Field label="Title" error={highlightError(index, 'title')}>
                    <input
                      className="dashboard-input"
                      maxLength={120}
                      value={highlight.title}
                      onChange={(event) => setForm({ ...form, highlights: form.highlights.map((item, position) => (position === index ? { ...item, title: event.target.value } : item)) })}
                    />
                  </Field>
                  <Field label="Description" error={highlightError(index, 'description')}>
                    <textarea
                      className="dashboard-input min-h-20"
                      rows={2}
                      maxLength={500}
                      value={highlight.description}
                      onChange={(event) => setForm({ ...form, highlights: form.highlights.map((item, position) => (position === index ? { ...item, description: event.target.value } : item)) })}
                    />
                  </Field>
                  <Field label="Icon key" error={highlightError(index, 'icon')}>
                    <input
                      className="dashboard-input"
                      maxLength={40}
                      value={highlight.icon}
                      onChange={(event) => setForm({ ...form, highlights: form.highlights.map((item, position) => (position === index ? { ...item, icon: event.target.value } : item)) })}
                    />
                  </Field>
                </div>
              </div>
            ))}
            {!form.highlights.length && <p className="py-6 text-center text-sm text-ink/45">No highlights yet. Add one to fill the reasons-to-stay section.</p>}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="dashboard-card p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 font-display text-2xl"><Globe size={18} className="text-forest" />Social links</h3>
                <p className="mt-1 text-xs text-ink/45">Profile URLs for each channel. The platform name becomes the key.</p>
              </div>
              <button
                type="button"
                className="dashboard-button-light"
                onClick={() => setForm({ ...form, socialLinks: [...form.socialLinks, { platform: '', url: '' }] })}
              >
                <Plus size={15} />
                Add link
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {form.socialLinks.map((link, index) => (
                <div key={index} className="grid gap-3 md:grid-cols-[0.8fr_1.4fr_auto]">
                  <Field label="Platform" error={errors[`socialLinks.${index}.platform`]}>
                    <input
                      className="dashboard-input"
                      value={link.platform}
                      onChange={(event) => setForm({ ...form, socialLinks: form.socialLinks.map((item, position) => (position === index ? { ...item, platform: event.target.value } : item)) })}
                    />
                  </Field>
                  <Field label="URL" error={errors[`socialLinks.${index}.url`]}>
                    <input
                      className="dashboard-input"
                      value={link.url}
                      onChange={(event) => setForm({ ...form, socialLinks: form.socialLinks.map((item, position) => (position === index ? { ...item, url: event.target.value } : item)) })}
                      placeholder="https://"
                    />
                  </Field>
                  <div className="flex items-end md:pb-0">
                    <button
                      type="button"
                      className="dashboard-button-light h-[42px] px-3"
                      aria-label={`Remove ${link.platform || 'social'} link`}
                      onClick={() => setForm({ ...form, socialLinks: form.socialLinks.filter((_, position) => position !== index) })}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
              {!form.socialLinks.length && <p className="py-4 text-center text-sm text-ink/45">No social profiles linked yet.</p>}
            </div>
          </section>

          <section className="dashboard-card p-5 md:p-6">
            <h3 className="flex items-center gap-2 font-display text-2xl"><Mail size={18} className="text-forest" />Footer & publishing</h3>
            <div className="mt-5 space-y-4">
              <Field label="Footer text" error={errors.footerText}>
                <textarea className="dashboard-input min-h-20" rows={2} maxLength={300} value={form.footerText} onChange={(event) => setForm({ ...form, footerText: event.target.value })} />
              </Field>
              <label className="flex items-start gap-3 border border-ink/10 p-4">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-forest"
                  checked={form.published}
                  onChange={(event) => setForm({ ...form, published: event.target.checked })}
                />
                <span>
                  <span className="block text-sm font-semibold">Publish this content</span>
                  <span className="mt-1 block text-xs text-ink/50">Leave it off while the copy is being reviewed. Saving always applies immediately to the live site.</span>
                </span>
              </label>
            </div>
          </section>
        </div>

        {save.isError && (
          <div className="dashboard-card border-copper/30 bg-[#eff6ff] p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-copper">
              <Info size={16} />
              {(save.error as { userMessage?: string }).userMessage ?? 'The website content could not be saved.'}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" className="dashboard-button-light" onClick={reset}>Discard changes</button>
          <button type="submit" className="dashboard-button" disabled={save.isPending}>
            <Save size={15} />
            {save.isPending ? 'Saving…' : 'Save content'}
          </button>
        </div>
      </form>
    </>
  );
}
