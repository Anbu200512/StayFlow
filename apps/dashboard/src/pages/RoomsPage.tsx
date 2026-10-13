import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Filter, RefreshCw } from 'lucide-react';
import type { Room, RoomType } from '../types';
import { adminApi } from '../lib/api';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/Ui';
import { formatMoney } from '../lib/format';

const statuses = ['all', 'available', 'reserved', 'occupied', 'dirty', 'cleaning', 'maintenance', 'out_of_service'];

function roomTypeOf(value: unknown): RoomType | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<RoomType>;
  return typeof candidate.name === 'string' ? candidate as RoomType : undefined;
}

function roomTypeIdOf(room: Room) {
  return roomTypeOf(room.roomTypeId);
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'userMessage' in error) {
    const message = (error as { userMessage?: unknown }).userMessage;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

function statusLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/^\w/, (character) => character.toUpperCase());
}

function statusOptions(current: string) {
  const options = ['available', 'reserved', 'maintenance', 'out_of_service'];
  return options.includes(current) ? options : [current, ...options];
}

export default function RoomsPage() {
  const [status, setStatus] = useState('all');
  const [floor, setFloor] = useState('');
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['admin-rooms', status, floor], queryFn: () => adminApi.rooms({ status: status === 'all' ? undefined : status, floor: floor || undefined }), refetchInterval: 30_000 });
  const floors = useQuery({ queryKey: ['admin-rooms', 'floors'], queryFn: () => adminApi.rooms({ limit: 200 }), staleTime: 300_000 });
  const floorOptions = useMemo(() => [...new Set((floors.data ?? []).map((room) => room.floor))].sort((a, b) => a - b), [floors.data]);
  useEffect(() => {
    if (floor && !floors.isLoading && !floorOptions.includes(Number(floor))) setFloor('');
  }, [floor, floors.isLoading, floorOptions]);
  const mutation = useMutation({ mutationFn: ({ id, nextStatus }: { id: string; nextStatus: string }) => adminApi.updateRoomStatus(id, nextStatus), onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin-rooms'] }); void client.invalidateQueries({ queryKey: ['overview'] }); } });
  const rooms = query.data ?? [];

  return <>
    <PageHeader eyebrow="Inventory" title="Rooms & availability" description="Live room status, readiness, and the next useful action." action={<button type="button" className="dashboard-button-light" onClick={() => query.refetch()}><RefreshCw size={15} aria-hidden="true" />Refresh</button>} />
    <div className="dashboard-card mb-6 flex flex-wrap items-center gap-3 p-4"><Filter size={16} className="text-ink/40" aria-hidden="true" /><label className="sr-only" htmlFor="room-status-filter">Filter by status</label><select id="room-status-filter" className="dashboard-input w-auto min-w-40" value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((value) => <option key={value} value={value}>{value === 'all' ? 'All statuses' : value.replaceAll('_', ' ')}</option>)}</select><label className="sr-only" htmlFor="room-floor-filter">Filter by floor</label><select id="room-floor-filter" className="dashboard-input w-auto min-w-32" value={floor} onChange={(event) => setFloor(event.target.value)}><option value="">All floors</option>{floorOptions.map((value) => <option key={value} value={value}>Floor {value}</option>)}</select><span role="status" aria-live="polite" className="ml-auto text-xs text-ink/45">{rooms.length} rooms</span></div>
    {query.isLoading ? <LoadingState label="Loading room inventory" /> : query.isError ? <ErrorState onRetry={() => query.refetch()} /> : rooms.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{rooms.map((room) => {
      const roomType = roomTypeIdOf(room);
      return <article key={room._id} className="dashboard-card overflow-hidden"><div className="flex items-start justify-between p-5"><div><p className="text-xs font-medium text-ink/55">Room {room.roomNumber} · Floor {room.floor}</p><h2 className="mt-2 font-display text-3xl">{roomType?.name ?? 'Room type unavailable'}</h2><p className="mt-1 text-xs text-ink/45">{roomType ? `${roomType.bedConfiguration} · up to ${roomType.maxOccupancy} guests` : 'Room type details unavailable'}</p></div><StatusBadge status={room.status} /></div><div className="border-t border-ink/10 px-5 py-4"><div className="flex items-center justify-between"><span className="text-xs text-ink/45">Base rate</span><span className="text-sm font-semibold">{formatMoney(roomType?.basePrice)}</span></div><div className="mt-3"><label className="sr-only" htmlFor={`room-status-${room._id}`}>Change status for room {room.roomNumber}</label><select id={`room-status-${room._id}`} className="dashboard-input w-full" value={room.status} disabled={mutation.isPending} onChange={(event) => { const nextStatus = event.target.value; if (nextStatus !== room.status) mutation.mutate({ id: room._id, nextStatus }); }}>{statusOptions(room.status).map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></div>{mutation.isError && <p className="mt-3 text-xs text-copper">{errorMessage(mutation.error, 'Room status could not be updated.')}</p>}</div></article>;
    })}</div> : <EmptyState title="No rooms found" description="Rooms matching these filters will appear here." />}
  </>;
}
