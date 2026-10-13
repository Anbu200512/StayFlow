import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, Check, CheckCheck, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { adminApi } from '../lib/api';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatCard, StatusBadge, toneStyles, type StatusTone } from '../components/Ui';
import { formatDateTime } from '../lib/format';

type Filter = 'all' | 'unread' | 'read';

const typeTones: Record<string, StatusTone> = {
  'reservation.created': 'success',
  'booking.confirmation': 'success',
  'service.request': 'warning',
  'order.room_service': 'warning',
  'order.restaurant': 'attention',
  'housekeeping.task': 'warning',
  'maintenance.request': 'attention',
  'inventory.low_stock': 'danger',
  'stay.checked_out': 'neutral',
  'website.contact': 'warning',
};

function typeTone(type: string): StatusTone {
  return typeTones[type] ?? 'neutral';
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === 'email') return <Mail size={15} />;
  if (channel === 'sms' || channel === 'whatsapp') return <Smartphone size={15} />;
  return <MessageSquare size={15} />;
}

function MutationError({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="text-sm text-copper">{(error as { userMessage?: string }).userMessage ?? 'The notification could not be updated.'}</p>;
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['notifications'], queryFn: adminApi.notifications, refetchInterval: 60_000 });

  const markOne = useMutation({
    mutationFn: (id: string) => adminApi.markNotification(id),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAll = useMutation({
    mutationFn: async (ids: string[]) => { for (const id of ids) await adminApi.markNotification(id); },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const all = query.data ?? [];
  const unread = all.filter((item) => item.status !== 'read');
  const failed = all.filter((item) => item.status === 'failed');
  const delivered = all.filter((item) => item.status === 'sent' || item.status === 'read');
  const rows = filter === 'all' ? all : filter === 'unread' ? unread : all.filter((item) => item.status === 'read');

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: all.length },
    { key: 'unread', label: 'Unread', count: unread.length },
    { key: 'read', label: 'Read', count: all.length - unread.length },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Operational alerts raised by the system, and the ones your team has already handled."
        action={
          <button type="button" className="dashboard-button" onClick={() => markAll.mutate(unread.map((item) => item._id))} disabled={!unread.length || markAll.isPending}>
            <CheckCheck size={15} />
            {markAll.isPending ? 'Marking…' : 'Mark all as read'}
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total" value={all.length} detail="Most recent 100 alerts" icon={<Bell size={18} />} />
        <StatCard label="Unread" value={unread.length} detail="Waiting for attention" tone="copper" icon={<Bell size={18} />} />
        <StatCard label="Delivered" value={delivered.length} detail="Sent or already read" tone="green" icon={<Check size={18} />} />
        <StatCard label="Failed" value={failed.length} detail="Delivery needs a retry" icon={<BellOff size={18} />} />
      </div>

      <div className="mb-4 mt-8 flex flex-wrap gap-2 border-b border-ink/10">
        {filters.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`border-b-2 px-4 py-3 text-sm font-semibold ${filter === key ? 'border-forest text-forest' : 'border-transparent text-ink/45 hover:text-ink'}`}
          >
            {label}
            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${filter === key ? 'bg-forest/10 text-forest' : 'bg-ink/5 text-ink/50'}`}>{count}</span>
          </button>
        ))}
      </div>

      <MutationError error={markAll.error} />
      <MutationError error={markOne.error} />

      {query.isLoading ? <LoadingState label="Loading notifications" /> : query.isError ? <ErrorState onRetry={() => query.refetch()} /> : !rows.length ? (
        <EmptyState
          title={filter === 'unread' ? 'Nothing unread' : 'No notifications yet'}
          description={filter === 'unread'
            ? 'You are completely up to date. New operational alerts will appear here.'
            : 'Alerts for housekeeping, maintenance, inventory and payments are raised by the system as work happens.'}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((notification) => {
            const isRead = notification.status === 'read';
            return (
              <article
                key={notification._id}
                className={`dashboard-card flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between ${isRead ? '' : 'border-l-2 border-l-copper'}`}
              >
                <div className="flex items-start gap-4">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isRead ? 'bg-ink/5 text-ink/45' : 'bg-forest/10 text-forest'}`}>
                    <ChannelIcon channel={notification.channel} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-2xl">{notification.title}</h2>
                      <StatusBadge status={notification.status} />
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${toneStyles[typeTone(notification.type)]}`}>{notification.type.replace(/[._]/g, ' ')}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-ink/65">{notification.message}</p>
                    {notification.type === 'website.contact' && notification.metadata?.email && <p className="mt-1 text-xs text-ink/45">From {notification.metadata.name} · {notification.metadata.email}{notification.metadata.phone ? ` · ${notification.metadata.phone}` : ''}</p>}
                    <p className="mt-2 text-xs text-ink/45">
                      {formatDateTime(notification.sentAt ?? notification.createdAt)}
                      {notification.readAt ? ` · read ${formatDateTime(notification.readAt)}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {notification.type === 'website.contact' && notification.metadata?.email && <a className="dashboard-button-light" href={`mailto:${notification.metadata.email}?subject=${encodeURIComponent(`Re: ${notification.title}`)}`}><Mail size={15} />Reply by email</a>}
                  <button
                    type="button"
                    className="dashboard-button-light"
                    disabled={isRead || markOne.isPending}
                    onClick={() => markOne.mutate(notification._id)}
                  >
                    <Check size={15} />
                    {isRead ? 'Read' : 'Mark as read'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
