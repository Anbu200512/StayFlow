import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, ConciergeBell, ListChecks, Plus, RefreshCw, Sparkles, UserCheck, Wrench, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { adminApi } from '../lib/api';
import type { Guest, Room, ServiceRequest, Stay, User } from '../types';
import { EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, StatCard, StatusBadge } from '../components/Ui';
import { formatDateTime, formatMoney } from '../lib/format';
import { useAuthStore } from '../store/authStore';

type TabKey = 'housekeeping' | 'maintenance' | 'services';
type FieldErrors = Record<string, string>;
type SubmitResult = { errors: FieldErrors } | null;

const housekeepingFlow: Record<string, string[]> = {
  pending: ['assigned', 'accepted', 'cancelled'],
  assigned: ['accepted', 'cancelled'],
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['inspected'],
  inspected: [],
  cancelled: [],
};

const maintenanceFlow: Record<string, string[]> = {
  open: ['assigned', 'in_progress', 'closed'],
  assigned: ['in_progress', 'closed'],
  in_progress: ['resolved', 'closed'],
  resolved: ['closed'],
  closed: [],
};

const serviceFlow: Record<string, string[]> = {
  pending: ['accepted', 'cancelled'],
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const housekeepingTypes = ['turnover', 'linen_change', 'deep_clean', 'arrival_clean', 'inspection', 'maintenance_check'];
const serviceCategories = ['room_service', 'housekeeping', 'maintenance', 'laundry', 'food_beverage', 'transport', 'concierge'];
const priorities = ['low', 'normal', 'high', 'urgent'];
const closedHousekeeping = ['completed', 'inspected', 'cancelled'];

const housekeepingSchema = z.object({
  roomId: z.string().min(1, 'Choose a room'),
  type: z.string().min(2, 'Choose a task type'),
  priority: z.string().min(1, 'Choose a priority'),
  assignedTo: z.string(),
  dueAt: z.string(),
  notes: z.string().max(1000, 'Notes are too long'),
});

const maintenanceSchema = z.object({
  roomId: z.string(),
  issue: z.string().trim().min(2, 'Summarise the issue'),
  description: z.string().trim().min(3, 'Add a description'),
  priority: z.string().min(1, 'Choose a priority'),
  assignedTo: z.string(),
});

const serviceSchema = z.object({
  stayId: z.string().min(1, 'Choose an active stay'),
  roomId: z.string().min(1, 'Choose an active stay first'),
  category: z.string().min(2, 'Choose a category'),
  description: z.string().trim().min(3, 'Add a description'),
  priority: z.string().min(1, 'Choose a priority'),
});

type HousekeepingForm = z.infer<typeof housekeepingSchema>;
type MaintenanceForm = z.infer<typeof maintenanceSchema>;
type ServiceForm = z.infer<typeof serviceSchema>;

const emptyHousekeeping: HousekeepingForm = { roomId: '', type: housekeepingTypes[0], priority: 'normal', assignedTo: '', dueAt: '', notes: '' };
const emptyMaintenance: MaintenanceForm = { roomId: '', issue: '', description: '', priority: 'normal', assignedTo: '' };
const emptyService: ServiceForm = { stayId: '', roomId: '', category: serviceCategories[0], description: '', priority: 'normal' };

const createLabels: Record<TabKey, string> = {
  housekeeping: 'task',
  maintenance: 'maintenance request',
  services: 'service request',
};

function collect(issues: z.ZodIssue[]): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || 'form';
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

function idOf(value: string | { _id: string } | undefined) {
  return typeof value === 'string' ? value : value?._id ?? '';
}

function roomLabel(value: string | Room | undefined) {
  return typeof value === 'string' ? '' : value?.roomNumber ?? '';
}

function guestLabel(value: string | Guest | undefined) {
  return typeof value === 'string' ? '' : value?.fullName ?? '';
}

function personName(value: string | User | undefined) {
  return typeof value === 'string' ? '' : value?.name ?? '';
}

function personId(value: string | User | undefined) {
  if (typeof value === 'string') return value;
  if (!value) return '';
  return String((value as User & { _id?: string })._id ?? value.id ?? '');
}

function MutationError({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="text-sm text-copper">{(error as { userMessage?: string }).userMessage ?? 'The request could not be completed.'}</p>;
}

export default function OperationsPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: TabKey = requested === 'maintenance' || requested === 'services' ? requested : 'housekeeping';
  const [housekeepingFilter, setHousekeepingFilter] = useState('');
  const [maintenanceFilter, setMaintenanceFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [creating, setCreating] = useState<TabKey | null>(null);
  const [resolving, setResolving] = useState<{ id: string; status: 'resolved' | 'closed' } | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [completing, setCompleting] = useState<ServiceRequest | null>(null);
  const [serviceCharge, setServiceCharge] = useState('');
  const client = useQueryClient();
  const { user } = useAuthStore();
  const canAssign = user?.role === 'owner' || user?.role === 'manager';

  const housekeeping = useQuery({ queryKey: ['housekeeping'], queryFn: adminApi.housekeeping, refetchInterval: 30_000 });
  const maintenance = useQuery({ queryKey: ['maintenance'], queryFn: adminApi.maintenance, refetchInterval: 30_000 });
  const services = useQuery({ queryKey: ['services'], queryFn: adminApi.services, refetchInterval: 30_000 });
  const rooms = useQuery({ queryKey: ['admin-rooms'], queryFn: () => adminApi.rooms() });
  const activeStays = useQuery({ queryKey: ['stays', 'active'], queryFn: () => adminApi.stays({ status: 'active' }) });
  const staff = useQuery({ queryKey: ['staff'], queryFn: adminApi.staff, enabled: canAssign });

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['housekeeping'] });
    void client.invalidateQueries({ queryKey: ['maintenance'] });
    void client.invalidateQueries({ queryKey: ['services'] });
    void client.invalidateQueries({ queryKey: ['overview'] });
    void client.invalidateQueries({ queryKey: ['admin-rooms'] });
  };

  const housekeepingUpdate = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => adminApi.updateHousekeeping(id, data),
    onSuccess: invalidate,
  });
  const maintenanceUpdate = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => adminApi.updateMaintenance(id, data),
    onSuccess: () => { invalidate(); setResolving(null); },
  });
  const serviceUpdate = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => adminApi.updateService(id, data),
    onSuccess: () => { invalidate(); setCompleting(null); },
  });
  const housekeepingCreate = useMutation({
    mutationFn: (data: Record<string, unknown>) => adminApi.createHousekeeping(data),
    onSuccess: () => { invalidate(); setCreating(null); },
  });
  const maintenanceCreate = useMutation({
    mutationFn: (data: Record<string, unknown>) => adminApi.createMaintenance(data),
    onSuccess: () => { invalidate(); setCreating(null); },
  });
  const serviceCreate = useMutation({
    mutationFn: (data: Record<string, unknown>) => adminApi.createService(data),
    onSuccess: () => { invalidate(); setCreating(null); },
  });

  const moveTab = (next: TabKey) => setParams((current) => { current.set('tab', next); return current; }, { replace: true });
  const staffOptions = staff.data ?? [];
  const roomOptions = rooms.data ?? [];
  const stayOptions = activeStays.data ?? [];
  const assignable = staffOptions.length > 0;

  const tabs = [
    { key: 'housekeeping' as const, label: 'Housekeeping', icon: Sparkles, count: housekeeping.data?.length ?? 0 },
    { key: 'maintenance' as const, label: 'Maintenance', icon: Wrench, count: maintenance.data?.length ?? 0 },
    { key: 'services' as const, label: 'Service requests', icon: ConciergeBell, count: services.data?.length ?? 0 },
  ];

  const housekeepingTasks = (housekeeping.data ?? []).filter((task) => !housekeepingFilter || task.status === housekeepingFilter);
  const maintenanceRequests = (maintenance.data ?? []).filter((request) => !maintenanceFilter || request.status === maintenanceFilter);
  const serviceRequests = (services.data ?? []).filter((request) => !serviceFilter || request.status === serviceFilter);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Housekeeping, maintenance & services"
        description="Every open job in the house, with the next valid step for each one."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="dashboard-button-light"
              onClick={() => {
                if (tab === 'housekeeping') void housekeeping.refetch();
                if (tab === 'maintenance') void maintenance.refetch();
                if (tab === 'services') void services.refetch();
              }}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
            <button type="button" className="dashboard-button" onClick={() => setCreating(tab)}>
              <Plus size={15} />
              New {createLabels[tab]}
            </button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2 border-b border-ink/10">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => moveTab(key)}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${tab === key ? 'border-forest text-forest' : 'border-transparent text-ink/45 hover:text-ink'}`}
          >
            <Icon size={16} />
            {label}
            <span className={`rounded-full px-2 py-0.5 text-xs ${tab === key ? 'bg-forest/10 text-forest' : 'bg-ink/5 text-ink/50'}`}>{count}</span>
          </button>
        ))}
      </div>

      {tab === 'housekeeping' && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Awaiting attention"
              value={(housekeeping.data ?? []).filter((task) => !closedHousekeeping.includes(task.status)).length}
              detail="Not yet inspected"
              icon={<Sparkles size={18} />}
            />
            <StatCard
              label="Urgent"
              value={(housekeeping.data ?? []).filter((task) => task.priority === 'urgent' && !closedHousekeeping.includes(task.status)).length}
              detail="Marked urgent"
              tone="copper"
              icon={<ListChecks size={18} />}
            />
            <StatCard
              label="Inspected"
              value={(housekeeping.data ?? []).filter((task) => task.status === 'inspected').length}
              detail="Rooms released to inventory"
              tone="green"
              icon={<UserCheck size={18} />}
            />
          </div>

          <FilterBar value={housekeepingFilter} options={Object.keys(housekeepingFlow)} onChange={setHousekeepingFilter} label="Filter tasks" />

          {housekeeping.isLoading ? <LoadingState label="Loading housekeeping tasks" /> : housekeeping.isError ? <ErrorState onRetry={() => housekeeping.refetch()} /> : !housekeepingTasks.length ? (
            <EmptyState title="Nothing on the housekeeping board" description="Turnover, linen and inspection tasks raised for your rooms will appear here." />
          ) : (
            <div className="dashboard-card overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left">
                <thead className="border-b border-ink/10 bg-sand/60 text-xs font-medium text-ink/55">
                  <tr>
                    <th className="px-5 py-4">Room</th>
                    <th className="px-5 py-4">Task</th>
                    <th className="px-5 py-4">Priority</th>
                    <th className="px-5 py-4">Assigned</th>
                    <th className="px-5 py-4">Due</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Next step</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {housekeepingTasks.map((task) => (
                    <tr key={task._id} className="text-sm transition hover:bg-sand/40">
                      <td className="px-5 py-4 font-semibold">{roomLabel(task.roomId) || 'Unassigned room'}</td>
                      <td className="px-5 py-4">
                        <p className="font-semibold capitalize">{task.type.replace('_', ' ')}</p>
                        {task.notes && <p className="mt-1 max-w-xs text-xs text-ink/45">{task.notes}</p>}
                      </td>
                      <td className="px-5 py-4 capitalize text-ink/60">{task.priority}</td>
                      <td className="px-5 py-4">
                        {assignable ? (
                          <select
                            className="dashboard-input w-auto py-1.5 text-xs"
                            value={personId(task.assignedTo)}
                            onChange={(event) => housekeepingUpdate.mutate({ id: task._id, data: { assignedTo: event.target.value } })}
                          >
                            <option value="">Unassigned</option>
                            {staffOptions.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}
                          </select>
                        ) : <span className="text-ink/60">{personName(task.assignedTo) || 'Unassigned'}</span>}
                      </td>
                      <td className="px-5 py-4 text-ink/60">{task.dueAt ? formatDateTime(task.dueAt) : '—'}</td>
                      <td className="px-5 py-4"><StatusBadge status={task.status} /></td>
                      <td className="px-5 py-4">
                        <StatusActions
                          options={housekeepingFlow[task.status] ?? []}
                          onSelect={(next) => housekeepingUpdate.mutate({ id: task._id, data: { status: next } })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <MutationError error={housekeepingUpdate.error} />
        </>
      )}

      {tab === 'maintenance' && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Open issues"
              value={(maintenance.data ?? []).filter((request) => !['resolved', 'closed'].includes(request.status)).length}
              detail="Awaiting a fix"
              tone="copper"
              icon={<Wrench size={18} />}
            />
            <StatCard
              label="In progress"
              value={(maintenance.data ?? []).filter((request) => request.status === 'in_progress').length}
              detail="Being worked on"
              icon={<Clock size={18} />}
            />
            <StatCard
              label="Closed"
              value={(maintenance.data ?? []).filter((request) => ['resolved', 'closed'].includes(request.status)).length}
              detail="Resolved and closed"
              tone="green"
              icon={<UserCheck size={18} />}
            />
          </div>

          <FilterBar value={maintenanceFilter} options={Object.keys(maintenanceFlow)} onChange={setMaintenanceFilter} label="Filter requests" />

          {maintenance.isLoading ? <LoadingState label="Loading maintenance requests" /> : maintenance.isError ? <ErrorState onRetry={() => maintenance.refetch()} /> : !maintenanceRequests.length ? (
            <EmptyState title="No maintenance requests" description="Report a fault from this page and it will be tracked until it is closed." />
          ) : (
            <div className="dashboard-card overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left">
                <thead className="border-b border-ink/10 bg-sand/60 text-xs font-medium text-ink/55">
                  <tr>
                    <th className="px-5 py-4">Room</th>
                    <th className="px-5 py-4">Issue</th>
                    <th className="px-5 py-4">Priority</th>
                    <th className="px-5 py-4">Assigned</th>
                    <th className="px-5 py-4">Raised</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Next step</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {maintenanceRequests.map((request) => (
                    <tr key={request._id} className="text-sm transition hover:bg-sand/40">
                      <td className="px-5 py-4 font-semibold">{roomLabel(request.roomId) || 'Property wide'}</td>
                      <td className="px-5 py-4">
                        <p className="font-semibold">{request.issue}</p>
                        <p className="mt-1 max-w-sm text-xs text-ink/45">{request.description}</p>
                        {request.resolutionNotes && <p className="mt-1 max-w-sm text-xs text-forest">Resolution: {request.resolutionNotes}</p>}
                      </td>
                      <td className="px-5 py-4 capitalize text-ink/60">{request.priority}</td>
                      <td className="px-5 py-4">
                        {assignable ? (
                          <select
                            className="dashboard-input w-auto py-1.5 text-xs"
                            value={personId(request.assignedTo)}
                            onChange={(event) => maintenanceUpdate.mutate({ id: request._id, data: { assignedTo: event.target.value } })}
                          >
                            <option value="">Unassigned</option>
                            {staffOptions.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}
                          </select>
                        ) : <span className="text-ink/60">{personName(request.assignedTo) || 'Unassigned'}</span>}
                      </td>
                      <td className="px-5 py-4 text-ink/60">{formatDateTime(request.createdAt)}</td>
                      <td className="px-5 py-4"><StatusBadge status={request.status} /></td>
                      <td className="px-5 py-4">
                        <StatusActions
                          options={maintenanceFlow[request.status] ?? []}
                          onSelect={(next) => {
                            if (next === 'resolved' || next === 'closed') {
                              setResolutionNotes('');
                              setResolving({ id: request._id, status: next });
                            } else maintenanceUpdate.mutate({ id: request._id, data: { status: next } });
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <MutationError error={maintenanceUpdate.error} />
        </>
      )}

      {tab === 'services' && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Open requests"
              value={(services.data ?? []).filter((request) => !['completed', 'cancelled'].includes(request.status)).length}
              detail="With the team now"
              icon={<ConciergeBell size={18} />}
            />
            <StatCard
              label="Charged"
              value={formatMoney((services.data ?? []).reduce((sum, request) => sum + request.chargeAmount, 0))}
              detail="Service charges recorded"
              tone="copper"
              icon={<ListChecks size={18} />}
            />
            <StatCard
              label="Completed"
              value={(services.data ?? []).filter((request) => request.status === 'completed').length}
              detail="Delivered to the guest"
              tone="green"
              icon={<UserCheck size={18} />}
            />
          </div>

          <FilterBar value={serviceFilter} options={Object.keys(serviceFlow)} onChange={setServiceFilter} label="Filter requests" />

          {services.isLoading ? <LoadingState label="Loading service requests" /> : services.isError ? <ErrorState onRetry={() => services.refetch()} /> : !serviceRequests.length ? (
            <EmptyState
              title="No service requests"
              description={stayOptions.length
                ? 'Raise a request against an in-house stay and the team will see it straight away.'
                : 'Guest service requests need an active stay. Complete a check-in on the front desk page, then raise the request here.'}
            />
          ) : (
            <div className="dashboard-card overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left">
                <thead className="border-b border-ink/10 bg-sand/60 text-xs font-medium text-ink/55">
                  <tr>
                    <th className="px-5 py-4">Guest</th>
                    <th className="px-5 py-4">Request</th>
                    <th className="px-5 py-4">Room</th>
                    <th className="px-5 py-4">Priority</th>
                    <th className="px-5 py-4">Charge</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Next step</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {serviceRequests.map((request) => (
                    <tr key={request._id} className="text-sm transition hover:bg-sand/40">
                      <td className="px-5 py-4">
                        <p className="font-semibold">{guestLabel(request.guestId) || 'In-house guest'}</p>
                        <p className="mt-1 text-xs text-ink/45">{formatDateTime(request.createdAt)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold capitalize">{request.category.replace('_', ' ')}</p>
                        <p className="mt-1 max-w-xs text-xs text-ink/45">{request.description}</p>
                      </td>
                      <td className="px-5 py-4 text-ink/60">{roomLabel(request.roomId) || '—'}</td>
                      <td className="px-5 py-4 capitalize text-ink/60">{request.priority}</td>
                      <td className="px-5 py-4 font-semibold">{formatMoney(request.chargeAmount)}</td>
                      <td className="px-5 py-4"><StatusBadge status={request.status} /></td>
                      <td className="px-5 py-4">
                        <StatusActions
                          options={serviceFlow[request.status] ?? []}
                          onSelect={(next) => {
                            if (next === 'completed') {
                              setServiceCharge(String(request.chargeAmount ?? 0));
                              setCompleting(request);
                            } else serviceUpdate.mutate({ id: request._id, data: { status: next } });
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <MutationError error={serviceUpdate.error} />
        </>
      )}

      {creating === 'housekeeping' && (
        <HousekeepingModal
          rooms={roomOptions}
          staff={staffOptions}
          assignable={assignable}
          pending={housekeepingCreate.isPending}
          error={housekeepingCreate.error}
          onClose={() => setCreating(null)}
          onSubmit={(form) => {
            const parsed = housekeepingSchema.safeParse(form);
            if (!parsed.success) return { errors: collect(parsed.error.issues) };
            const data: Record<string, unknown> = { roomId: parsed.data.roomId, type: parsed.data.type, priority: parsed.data.priority };
            if (parsed.data.assignedTo) data.assignedTo = parsed.data.assignedTo;
            if (parsed.data.dueAt) data.dueAt = parsed.data.dueAt;
            if (parsed.data.notes) data.notes = parsed.data.notes;
            housekeepingCreate.mutate(data);
            return null;
          }}
        />
      )}

      {creating === 'maintenance' && (
        <MaintenanceModal
          rooms={roomOptions}
          staff={staffOptions}
          assignable={assignable}
          pending={maintenanceCreate.isPending}
          error={maintenanceCreate.error}
          onClose={() => setCreating(null)}
          onSubmit={(form) => {
            const parsed = maintenanceSchema.safeParse(form);
            if (!parsed.success) return { errors: collect(parsed.error.issues) };
            const data: Record<string, unknown> = { issue: parsed.data.issue, description: parsed.data.description, priority: parsed.data.priority };
            if (parsed.data.roomId) data.roomId = parsed.data.roomId;
            if (parsed.data.assignedTo) data.assignedTo = parsed.data.assignedTo;
            maintenanceCreate.mutate(data);
            return null;
          }}
        />
      )}

      {creating === 'services' && (
        <ServiceModal
          stays={stayOptions}
          pending={serviceCreate.isPending}
          error={serviceCreate.error}
          onClose={() => setCreating(null)}
          onSubmit={(form) => {
            const parsed = serviceSchema.safeParse(form);
            if (!parsed.success) return { errors: collect(parsed.error.issues) };
            const stay = stayOptions.find((item) => item._id === parsed.data.stayId);
            const data: Record<string, unknown> = {
              stayId: parsed.data.stayId,
              roomId: parsed.data.roomId,
              category: parsed.data.category,
              description: parsed.data.description,
              priority: parsed.data.priority,
            };
            const guestId = idOf(stay?.guestId);
            if (guestId) data.guestId = guestId;
            serviceCreate.mutate(data);
            return null;
          }}
        />
      )}

      {resolving && (
        <ResolutionModal
          status={resolving.status}
          notes={resolutionNotes}
          onNotes={setResolutionNotes}
          pending={maintenanceUpdate.isPending}
          error={maintenanceUpdate.error}
          onClose={() => setResolving(null)}
          onSubmit={() => maintenanceUpdate.mutate({ id: resolving.id, data: { status: resolving.status, resolutionNotes: resolutionNotes.trim() } })}
        />
      )}

      {completing && (
        <CompleteServiceModal
          request={completing}
          charge={serviceCharge}
          onCharge={setServiceCharge}
          pending={serviceUpdate.isPending}
          error={serviceUpdate.error}
          onClose={() => setCompleting(null)}
          onSubmit={() => serviceUpdate.mutate({ id: completing._id, data: { status: 'completed', chargeAmount: Number(serviceCharge) } })}
        />
      )}
    </>
  );
}

function FilterBar({ value, options, onChange, label }: { value: string; options: string[]; onChange: (value: string) => void; label: string }) {
  return (
    <div className="dashboard-card my-6 flex flex-wrap items-center gap-3 p-4">
      <ListChecks size={16} className="text-ink/40" />
      <select className="dashboard-input w-auto min-w-44" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        <option value="">All statuses</option>
        {options.map((option) => <option key={option} value={option}>{option.replace('_', ' ')}</option>)}
      </select>
      {value && <button type="button" className="dashboard-button-light px-3 py-2" onClick={() => onChange('')} aria-label="Clear filter"><X size={15} /></button>}
    </div>
  );
}

function StatusActions({ options, onSelect }: { options: string[]; onSelect: (status: string) => void }) {
  if (!options.length) return <span className="text-xs font-medium text-ink/55">Final</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSelect(option)}
          className="border border-ink/10 px-2.5 py-1.5 text-xs font-medium text-ink/55 transition hover:border-forest hover:text-forest"
        >
          {option.replace('_', ' ')}
        </button>
      ))}
    </div>
  );
}

function ModalFooter({ pending, error, onClose, label }: { pending: boolean; error: unknown; onClose: () => void; label: string }) {
  return (
    <div className="space-y-3">
      <MutationError error={error} />
      <div className="flex justify-end gap-3 border-t border-ink/10 pt-5">
        <button type="button" className="dashboard-button-light" onClick={onClose}>Cancel</button>
        <button type="submit" className="dashboard-button" disabled={pending}>{pending ? 'Saving…' : label}</button>
      </div>
    </div>
  );
}

interface CreateModalProps<T> {
  rooms: { _id: string; roomNumber: string }[];
  staff: { _id: string; name: string }[];
  assignable: boolean;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (form: T) => SubmitResult;
}

function StaffSelect({ value, onChange, staff, assignable }: { value: string; onChange: (value: string) => void; staff: { _id: string; name: string }[]; assignable: boolean }) {
  if (!assignable) return <input className="dashboard-input bg-ink/[0.03] text-ink/40" value="Owner or manager only" readOnly />;
  return (
    <select className="dashboard-input" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Leave unassigned</option>
      {staff.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}
    </select>
  );
}

function HousekeepingModal({ rooms, staff, assignable, pending, error, onClose, onSubmit }: CreateModalProps<HousekeepingForm>) {
  const [form, setForm] = useState<HousekeepingForm>(emptyHousekeeping);
  const [errors, setErrors] = useState<FieldErrors>({});
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setErrors(onSubmit(form)?.errors ?? {});
  };
  return (
    <Modal title="New housekeeping task" onClose={onClose}>
      <form className="mt-7 space-y-4" onSubmit={submit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Room" error={errors.roomId}>
            <select className="dashboard-input" value={form.roomId} onChange={(event) => setForm({ ...form, roomId: event.target.value })}>
              <option value="">Select a room</option>
              {rooms.map((room) => <option key={room._id} value={room._id}>Room {room.roomNumber}</option>)}
            </select>
          </Field>
          <Field label="Task type" error={errors.type}>
            <select className="dashboard-input" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              {housekeepingTypes.map((type) => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Priority" error={errors.priority}>
            <select className="dashboard-input" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
              {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
            </select>
          </Field>
          <Field label="Assign to">
            <StaffSelect value={form.assignedTo} onChange={(assignedTo) => setForm({ ...form, assignedTo })} staff={staff} assignable={assignable} />
          </Field>
          <Field label="Due" error={errors.dueAt}>
            <input className="dashboard-input" type="datetime-local" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} />
          </Field>
        </div>
        <Field label="Notes" error={errors.notes}>
          <textarea className="dashboard-input min-h-24" rows={3} maxLength={1000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </Field>
        <ModalFooter pending={pending} error={error} onClose={onClose} label="Create task" />
      </form>
    </Modal>
  );
}

function MaintenanceModal({ rooms, staff, assignable, pending, error, onClose, onSubmit }: CreateModalProps<MaintenanceForm>) {
  const [form, setForm] = useState<MaintenanceForm>(emptyMaintenance);
  const [errors, setErrors] = useState<FieldErrors>({});
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setErrors(onSubmit(form)?.errors ?? {});
  };
  return (
    <Modal title="Report a maintenance issue" onClose={onClose}>
      <form className="mt-7 space-y-4" onSubmit={submit} noValidate>
        <Field label="Issue" error={errors.issue}>
          <input className="dashboard-input" value={form.issue} onChange={(event) => setForm({ ...form, issue: event.target.value })} />
        </Field>
        <Field label="Description" error={errors.description}>
          <textarea className="dashboard-input min-h-24" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Room" error={errors.roomId}>
            <select className="dashboard-input" value={form.roomId} onChange={(event) => setForm({ ...form, roomId: event.target.value })}>
              <option value="">Not room specific</option>
              {rooms.map((room) => <option key={room._id} value={room._id}>Room {room.roomNumber}</option>)}
            </select>
          </Field>
          <Field label="Priority" error={errors.priority}>
            <select className="dashboard-input" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
              {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Assign to">
          <StaffSelect value={form.assignedTo} onChange={(assignedTo) => setForm({ ...form, assignedTo })} staff={staff} assignable={assignable} />
        </Field>
        <ModalFooter pending={pending} error={error} onClose={onClose} label="Raise request" />
      </form>
    </Modal>
  );
}

function ServiceModal({ stays, pending, error, onClose, onSubmit }: { stays: Stay[]; pending: boolean; error: unknown; onClose: () => void; onSubmit: (form: ServiceForm) => SubmitResult }) {
  const [form, setForm] = useState<ServiceForm>(emptyService);
  const [errors, setErrors] = useState<FieldErrors>({});
  const stay = stays.find((item) => item._id === form.stayId);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setErrors(onSubmit(form)?.errors ?? {});
  };
  return (
    <Modal title="New guest service request" onClose={onClose}>
      <form className="mt-7 space-y-4" onSubmit={submit} noValidate>
        <Field label="Active stay" error={errors.stayId}>
          <select
            className="dashboard-input"
            value={form.stayId}
            onChange={(event) => {
              const selected = stays.find((item) => item._id === event.target.value);
              setForm({ ...form, stayId: event.target.value, roomId: idOf(selected?.roomId) });
            }}
          >
            <option value="">Select an in-house guest</option>
            {stays.map((item) => (
              <option key={item._id} value={item._id}>
                {guestLabel(item.guestId) || 'In-house guest'} — {roomLabel(item.roomId) || 'room pending'}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Room" error={errors.roomId}>
            <input className="dashboard-input bg-ink/[0.03] text-ink/70" readOnly value={roomLabel(stay?.roomId) || 'Select a stay first'} />
          </Field>
          <Field label="Category" error={errors.category}>
            <select className="dashboard-input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              {serviceCategories.map((category) => <option key={category} value={category}>{category.replace('_', ' ')}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Priority" error={errors.priority}>
          <select className="dashboard-input" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
            {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </Field>
        <Field label="Description" error={errors.description}>
          <textarea className="dashboard-input min-h-24" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
        <ModalFooter pending={pending} error={error} onClose={onClose} label="Create request" />
      </form>
    </Modal>
  );
}

function ResolutionModal({ status, notes, onNotes, pending, error, onClose, onSubmit }: {
  status: 'resolved' | 'closed';
  notes: string;
  onNotes: (notes: string) => void;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <Modal title={status === 'resolved' ? 'Resolve maintenance request' : 'Close maintenance request'} onClose={onClose}>
      <form className="mt-7 space-y-4" onSubmit={submit}>
        <p className="text-sm leading-6 text-ink/60">
          {status === 'resolved'
            ? 'Marking a request resolved records the fix and returns the room to available inventory.'
            : 'Closing a request permanently resolves it. Record what was done for the audit trail.'}
        </p>
        <Field label="Resolution notes">
          <textarea className="dashboard-input min-h-24" rows={3} maxLength={1000} value={notes} onChange={(event) => onNotes(event.target.value)} />
        </Field>
        <ModalFooter pending={pending} error={error} onClose={onClose} label={status === 'resolved' ? 'Mark resolved' : 'Close request'} />
      </form>
    </Modal>
  );
}

function CompleteServiceModal({ request, charge, onCharge, pending, error, onClose, onSubmit }: {
  request: ServiceRequest;
  charge: string;
  onCharge: (charge: string) => void;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const amount = Number(charge);
  const invalid = charge.trim() === '' || !Number.isFinite(amount) || amount < 0;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!invalid) onSubmit();
  };
  return (
    <Modal title="Complete service request" onClose={onClose}>
      <form className="mt-7 space-y-4" onSubmit={submit}>
        <div className="border border-ink/10 bg-sand/50 p-4">
          <p className="text-sm font-semibold capitalize">{request.category.replace('_', ' ')}</p>
          <p className="mt-1 text-xs leading-5 text-ink/50">{request.description}</p>
        </div>
        <Field label="Charge amount" error={invalid ? 'Enter a valid amount' : undefined}>
          <input className="dashboard-input" type="number" min="0" step="0.01" value={charge} onChange={(event) => onCharge(event.target.value)} />
        </Field>
        <ModalFooter pending={pending} error={error} onClose={onClose} label="Complete request" />
      </form>
    </Modal>
  );
}
