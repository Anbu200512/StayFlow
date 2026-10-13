import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChefHat, ClipboardList, Plus, RefreshCw, UtensilsCrossed } from 'lucide-react';
import { z } from 'zod';
import { adminApi } from '../lib/api';
import { formatDateTime, formatMoney } from '../lib/format';
import { useAuthStore } from '../store/authStore';
import type { Guest, MenuCategory, Order, Room, Stay } from '../types';
import { EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, StatCard, StatusBadge } from '../components/Ui';

/** Mirrors the transition map enforced by updateRestaurantOrder on the server. */
const orderFlow: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered'],
  delivered: [],
  cancelled: [],
};

const nextStepLabel: Record<string, string> = {
  confirmed: 'Accept order',
  preparing: 'Start preparing',
  ready: 'Mark ready',
  delivered: 'Mark delivered',
  cancelled: 'Cancel order',
};

const lanes = [
  { key: 'pending', label: 'New' },
  { key: 'confirmed', label: 'Accepted' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'delivered', label: 'Delivered' },
] as const;

const categorySchema = z.object({
  name: z.string().trim().min(2, 'Give the category a name'),
  description: z.string().trim().max(300, 'Keep the description under 300 characters'),
  sortOrder: z.string(),
});

const itemSchema = z.object({
  categoryId: z.string().min(1, 'Choose a category'),
  name: z.string().trim().min(2, 'Name the dish'),
  description: z.string().trim().max(300, 'Keep the description under 300 characters'),
  price: z.string().min(1, 'Enter a price'),
  taxRate: z.string(),
});

type CategoryForm = z.infer<typeof categorySchema>;
type ItemForm = z.infer<typeof itemSchema>;
type FieldErrors = Record<string, string>;

const emptyCategory: CategoryForm = { name: '', description: '', sortOrder: '0' };
const emptyItem: ItemForm = { categoryId: '', name: '', description: '', price: '', taxRate: '0' };

function collect(issues: z.ZodIssue[]): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || 'form';
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

function message(error: unknown, fallback: string) {
  return (error as { userMessage?: string })?.userMessage ?? fallback;
}

function roomNumber(order: Order) {
  const room = order.roomId as Room | undefined;
  return room && typeof room !== 'string' ? `Room ${room.roomNumber}` : null;
}

function guestName(order: Order) {
  const guest = order.guestId as Guest | undefined;
  return guest && typeof guest !== 'string' ? guest.fullName : null;
}

function stayRoom(stay: Stay) {
  const room = stay.roomId as Room | undefined;
  return room && typeof room !== 'string' ? room.roomNumber : '—';
}

export default function RestaurantPage() {
  const [view, setView] = useState<'orders' | 'menu'>('orders');
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const client = useQueryClient();
  const { user } = useAuthStore();
  const canEditMenu = user?.role === 'owner' || user?.role === 'manager' || user?.role === 'restaurant';

  const orders = useQuery({ queryKey: ['orders'], queryFn: () => adminApi.orders(), refetchInterval: 30_000 });
  const menu = useQuery({ queryKey: ['restaurant-menu'], queryFn: adminApi.restaurantMenu });

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['orders'] });
    void client.invalidateQueries({ queryKey: ['restaurant-menu'] });
  };

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminApi.updateOrder(id, status),
    onSuccess: refresh,
  });

  const orderList = useMemo(() => orders.data ?? [], [orders.data]);
  const byLane = useMemo(() => {
    const grouped: Record<string, Order[]> = { pending: [], confirmed: [], preparing: [], ready: [], delivered: [] };
    for (const order of orderList) if (grouped[order.status]) grouped[order.status].push(order);
    return grouped;
  }, [orderList]);

  const openCount = byLane.pending.length + byLane.confirmed.length + byLane.preparing.length + byLane.ready.length;
  const openValue = useMemo(
    () => ['pending', 'confirmed', 'preparing', 'ready'].flatMap((lane) => byLane[lane]).reduce((sum, order) => sum + (order.total ?? 0), 0),
    [byLane],
  );
  const servedToday = useMemo(() => {
    const today = new Date().toDateString();
    return orderList.filter((order) => order.status === 'delivered' && new Date(order.placedAt).toDateString() === today);
  }, [orderList]);

  return (
    <>
      <PageHeader
        eyebrow="Restaurant & room service"
        title="Kitchen"
        description="Accept orders, move them through the kitchen, and keep the menu current. Orders placed against an in-house room land on the guest folio at checkout."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="dashboard-button-light" onClick={refresh}>
              <RefreshCw size={15} aria-hidden="true" /> Refresh
            </button>
            {view === 'orders' ? (
              <button type="button" className="dashboard-button" onClick={() => setCreatingOrder(true)}>
                <Plus size={15} aria-hidden="true" /> New order
              </button>
            ) : (
              canEditMenu && (
                <>
                  <button type="button" className="dashboard-button-light" onClick={() => setCreatingCategory(true)}>
                    <Plus size={15} aria-hidden="true" /> Category
                  </button>
                  <button
                    type="button"
                    className="dashboard-button"
                    onClick={() => setCreatingItem(true)}
                    disabled={!menu.data?.length}
                    title={menu.data?.length ? undefined : 'Add a category first'}
                  >
                    <Plus size={15} aria-hidden="true" /> Dish
                  </button>
                </>
              )
            )}
          </div>
        }
      />

      <div className="mb-6 inline-flex border border-ink/10 bg-white p-1" role="tablist" aria-label="Restaurant workspace">
        {(
          [
            { key: 'orders', label: 'Order board', icon: ClipboardList },
            { key: 'menu', label: 'Menu', icon: UtensilsCrossed },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition ${view === key ? 'bg-forest text-white' : 'text-ink/55 hover:text-ink'}`}
          >
            <Icon size={15} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {view === 'orders' ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Live orders" value={openCount} detail="Accepted but not yet delivered" icon={<ChefHat size={18} />} tone="green" />
            <StatCard label="Awaiting kitchen" value={byLane.preparing.length} detail="Currently being prepared" />
            <StatCard label="Ready to serve" value={byLane.ready.length} detail="Waiting to go out" />
            <StatCard label="Delivered today" value={servedToday.length} detail={formatMoney(servedToday.reduce((sum, order) => sum + (order.total ?? 0), 0))} />
          </div>

          {openValue > 0 && (
            <p className="mb-6 border border-copper/20 bg-copper/5 px-4 py-3 text-sm text-ink/70">
              <strong className="font-semibold text-ink">{formatMoney(openValue)}</strong> of food and beverage value is still open
              across {openCount} order{openCount === 1 ? '' : 's'}.
            </p>
          )}

          {orders.isLoading ? (
            <LoadingState label="Loading the order board" />
          ) : orders.isError ? (
            <ErrorState message={message(orders.error, 'The order board could not be loaded.')} onRetry={() => orders.refetch()} />
          ) : orderList.length === 0 ? (
            <EmptyState
              title="No orders yet"
              description="Orders raised from the guest portal and from this screen both appear here, newest first."
              action={
                <button type="button" className="dashboard-button" onClick={() => setCreatingOrder(true)}>
                  <Plus size={15} aria-hidden="true" /> Take the first order
                </button>
              }
            />
          ) : (
            <div className="space-y-8">
              {lanes.map(({ key, label }) => {
                const lane = byLane[key];
                if (!lane.length) return null;
                return (
                  <section key={key} aria-labelledby={`lane-${key}`}>
                    <div className="mb-3 flex items-baseline gap-3">
                      <h3 id={`lane-${key}`} className="font-display text-2xl">
                        {label}
                      </h3>
                      <span className="text-xs font-medium text-ink/55">
                        {lane.length} order{lane.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {lane.map((order) => (
                        <OrderTicket
                          key={order._id}
                          order={order}
                          pending={advance.isPending && advance.variables?.id === order._id}
                          error={advance.isError ? advance.error : undefined}
                          onAdvance={(status) => advance.mutate({ id: order._id, status })}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
              {orderList.some((order) => order.status === 'cancelled') && (
                <section aria-labelledby="lane-cancelled">
                  <h3 id="lane-cancelled" className="mb-3 font-display text-2xl text-ink/50">
                    Cancelled
                  </h3>
                  <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {orderList
                      .filter((order) => order.status === 'cancelled')
                      .map((order) => (
                        <li key={order._id}>
                          <article className="dashboard-card p-5 opacity-70">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-mono text-xs text-ink/45">{order.orderNumber}</p>
                                <p className="mt-1 text-sm font-semibold">{order.type === 'room_service' ? 'Room service' : 'Restaurant'}</p>
                              </div>
                              <StatusBadge status={order.status} />
                            </div>
                            <p className="mt-3 text-xs text-ink/45">Placed {formatDateTime(order.placedAt)}</p>
                          </article>
                        </li>
                      ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </>
      ) : menu.isLoading ? (
        <LoadingState label="Loading the menu" />
      ) : menu.isError ? (
        <ErrorState message={message(menu.error, 'The menu could not be loaded.')} onRetry={() => menu.refetch()} />
      ) : !menu.data?.length ? (
        <EmptyState
          title="The menu is empty"
          description="Add a category first, then dishes inside it. Categories and dishes are what guests see when they order from their room."
          action={
            canEditMenu && (
              <button type="button" className="dashboard-button" onClick={() => setCreatingCategory(true)}>
                <Plus size={15} aria-hidden="true" /> Add the first category
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-8">
          {menu.data.map((category) => (
            <MenuCategoryCard key={category._id} category={category} />
          ))}
        </div>
      )}

      {creatingOrder && (
        <NewOrderModal
          onClose={() => setCreatingOrder(false)}
          onCreated={() => {
            setCreatingOrder(false);
            refresh();
          }}
        />
      )}
      {creatingCategory && (
        <CategoryModal
          onClose={() => setCreatingCategory(false)}
          onCreated={() => {
            setCreatingCategory(false);
            refresh();
          }}
        />
      )}
      {creatingItem && (
        <ItemModal
          categories={menu.data ?? []}
          onClose={() => setCreatingItem(false)}
          onCreated={() => {
            setCreatingItem(false);
            refresh();
          }}
        />
      )}
    </>
  );
}

function OrderTicket({ order, pending, error, onAdvance }: { order: Order; pending: boolean; error?: unknown; onAdvance: (status: string) => void }) {
  const allowed = orderFlow[order.status] ?? [];
  const primary = allowed.find((status) => status !== 'cancelled');
  const cancellable = allowed.includes('cancelled');
  const where = roomNumber(order) ?? (order.tableId ? 'Dining table' : 'Walk-in');
  const who = guestName(order);

  return (
    <li>
      <article className="dashboard-card flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-ink/45">{order.orderNumber}</p>
            <h4 className="mt-1 truncate font-display text-2xl leading-tight">{order.type === 'room_service' ? 'Room service' : 'Restaurant'}</h4>
            <p className="mt-1 text-xs text-ink/50">
              {where}
              {who ? ` · ${who}` : ''}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <ul className="mt-4 flex-1 space-y-1.5 border-t border-ink/10 pt-4 text-sm">
          {order.items?.map((line, index) => (
            <li key={`${order._id}-${index}`} className="flex items-baseline justify-between gap-3">
              <span className="text-ink/70">
                <span className="font-semibold text-ink">{line.quantity}×</span> {line.name}
                {line.notes && <span className="block text-xs text-ink/40">{line.notes}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-ink/55">{formatMoney(line.amount)}</span>
            </li>
          ))}
        </ul>

        {order.notes && <p className="mt-3 border-l-2 border-copper/40 pl-3 text-xs italic text-ink/55">{order.notes}</p>}

        <div className="mt-4 flex items-center justify-between border-t border-ink/10 pt-4">
          <div>
            <p className="text-xs font-medium text-ink/40">Total</p>
            <p className="font-display text-2xl">{formatMoney(order.total)}</p>
          </div>
          {primary && (
            <button type="button" className="dashboard-button" onClick={() => onAdvance(primary)} disabled={pending}>
              {pending ? 'Saving…' : nextStepLabel[primary]}
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-ink/50">Placed {formatDateTime(order.placedAt)}</p>
        {cancellable && (
          <button type="button" className="mt-3 self-start text-xs font-semibold text-copper underline underline-offset-2 disabled:opacity-50" onClick={() => onAdvance('cancelled')} disabled={pending}>
            Cancel this order
          </button>
        )}
        {Boolean(error) && <p role="alert" className="mt-2 text-xs text-copper">{message(error, 'That update was rejected.')}</p>}
      </article>
    </li>
  );
}

function MenuCategoryCard({ category }: { category: MenuCategory }) {
  return (
    <section aria-labelledby={`category-${category._id}`} className="dashboard-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`category-${category._id}`} className="font-display text-3xl">
          {category.name}
        </h3>
        <span className="text-xs text-ink/40">
          {category.items.length} item{category.items.length === 1 ? '' : 's'}
        </span>
      </div>
      {category.description && <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/55">{category.description}</p>}
      {category.items.length === 0 ? (
        <p className="mt-5 border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink/40">No dishes in this category yet.</p>
      ) : (
        <ul className="mt-5 grid gap-x-8 gap-y-3 md:grid-cols-2">
          {category.items.map((item) => (
            <li key={item._id} className="flex items-baseline justify-between gap-4 border-b border-ink/5 pb-3">
              <span className="min-w-0">
                <span className="text-sm font-semibold">{item.name}</span>
                {item.description && <span className="block text-xs leading-5 text-ink/45">{item.description}</span>}
                {item.taxRate > 0 && <span className="text-xs text-ink/50">+{item.taxRate}% tax</span>}
              </span>
              <span className="shrink-0 font-display text-xl">{formatMoney(item.price)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NewOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<'room_service' | 'restaurant'>('room_service');
  const [stayId, setStayId] = useState('');
  const [items, setItems] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const menu = useQuery({ queryKey: ['restaurant-menu'], queryFn: adminApi.restaurantMenu });
  const stays = useQuery({ queryKey: ['stays', 'active'], queryFn: () => adminApi.stays({ status: 'active' }) });

  const dishes = useMemo(() => (menu.data ?? []).flatMap((category) => category.items), [menu.data]);
  const selected = useMemo(() => Object.entries(items).filter(([, quantity]) => quantity > 0), [items]);
  const estimated = useMemo(
    () => selected.reduce((sum, [id, quantity]) => {
      const dish = dishes.find((item) => item._id === id);
      if (!dish) return sum;
      const base = dish.price * quantity;
      return sum + base + (base * dish.taxRate) / 100;
    }, 0),
    [selected, dishes],
  );

  const create = useMutation({
    mutationFn: () => {
      const stay = stays.data?.find((entry) => entry._id === stayId);
      const roomId = stay && typeof stay.roomId !== 'string' ? stay.roomId._id : undefined;
      return adminApi.createOrder({
        type,
        ...(type === 'room_service' ? { stayId, roomId } : {}),
        items: selected.map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
        notes: notes || undefined,
      });
    },
    onSuccess: onCreated,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: FieldErrors = {};
    if (type === 'room_service' && !stayId) next.stayId = 'Choose the room this order is for';
    if (!selected.length) next.items = 'Add at least one dish';
    setErrors(next);
    if (Object.keys(next).length) return;
    create.mutate();
  };

  const bump = (id: string, delta: number) => setItems((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + delta) }));

  return (
    <Modal
      title="New order"
      description="Room service orders are added to the guest folio and settle at checkout."
      onClose={onClose}
      wide
      footer={
        <>
          <span className="mr-auto self-center text-sm text-ink/55">
            Estimate <strong className="font-display text-xl text-ink">{formatMoney(estimated)}</strong>
          </span>
          <button type="button" className="dashboard-button-light" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="new-order-form" className="dashboard-button" disabled={create.isPending}>
            {create.isPending ? 'Placing…' : 'Place order'}
          </button>
        </>
      }
    >
      <form id="new-order-form" className="mt-6 space-y-5" onSubmit={submit} noValidate>
        <fieldset>
          <legend className="dashboard-label">Order type</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { key: 'room_service', label: 'Room service', help: 'Charged to an in-house guest folio' },
                { key: 'restaurant', label: 'Restaurant', help: 'Walk-in or takeaway, no folio' },
              ] as const
            ).map((option) => (
              <label
                key={option.key}
                className={`flex cursor-pointer items-start gap-3 border p-3 transition ${type === option.key ? 'border-forest bg-forest/5' : 'border-ink/10 hover:border-ink/25'}`}
              >
                <input
                  type="radio"
                  name="order-type"
                  value={option.key}
                  checked={type === option.key}
                  onChange={() => setType(option.key)}
                  className="mt-1 accent-[#2563eb]"
                />
                <span>
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className="block text-xs text-ink/45">{option.help}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {type === 'room_service' && (
          <Field label="Guest and room" required error={errors.stayId} hint="Only guests currently checked in can be served.">
            <select className="dashboard-input" value={stayId} onChange={(event) => setStayId(event.target.value)} required>
              <option value="">Select an in-house guest</option>
              {(stays.data ?? []).map((stay) => (
                <option key={stay._id} value={stay._id}>
                  Room {stayRoom(stay)} · since {formatDateTime(stay.checkInAt)}
                </option>
              ))}
            </select>
          </Field>
        )}

        <fieldset>
          <legend className="dashboard-label">
            Dishes
            <span className="ml-1 normal-case tracking-normal text-copper">*</span>
          </legend>
          {menu.isLoading ? (
            <LoadingState label="Loading dishes" />
          ) : dishes.length === 0 ? (
            <p className="border border-dashed border-ink/15 px-4 py-6 text-sm text-ink/45">
              No dishes are on the menu yet. Add them from the Menu tab first.
            </p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {dishes.map((dish) => {
                const category = (menu.data ?? []).find((entry) => entry.items.some((item) => item._id === dish._id));
                const quantity = items[dish._id] ?? 0;
                return (
                  <li key={dish._id} className={`flex items-center gap-3 border p-2.5 transition ${quantity ? 'border-forest bg-forest/5' : 'border-ink/10'}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{dish.name}</span>
                      <span className="block text-xs text-ink/45">
                        {category?.name} · {formatMoney(dish.price)}
                        {dish.taxRate > 0 ? ` +${dish.taxRate}%` : ''}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <button type="button" className="dashboard-button-light h-8 w-8 px-0" onClick={() => bump(dish._id, -1)} disabled={quantity === 0} aria-label={`Remove one ${dish.name}`}>
                        −
                      </button>
                      <output className="w-7 text-center text-sm font-semibold tabular-nums" aria-label={`${dish.name} quantity`}>
                        {quantity}
                      </output>
                      <button type="button" className="dashboard-button-light h-8 w-8 px-0" onClick={() => bump(dish._id, 1)} aria-label={`Add one ${dish.name}`}>
                        +
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {errors.items && (
            <p className="mt-1 text-xs text-copper" role="alert">
              {errors.items}
            </p>
          )}
        </fieldset>

        <Field label="Kitchen note" hint="Allergies, timing, or where to serve. Visible to the kitchen only.">
          <textarea className="dashboard-input min-h-20" rows={2} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>

        {create.isError && (
          <p role="alert" className="border border-copper/20 bg-copper/5 p-3 text-sm text-copper">
            {message(create.error, 'The order could not be placed.')}
          </p>
        )}
      </form>
    </Modal>
  );
}

function CategoryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CategoryForm>(emptyCategory);
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useMutation({ mutationFn: (data: Record<string, unknown>) => adminApi.createMenuCategory(data), onSuccess: onCreated });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = categorySchema.safeParse(form);
    if (!parsed.success) return setErrors(collect(parsed.error.issues));
    setErrors({});
    create.mutate({ name: parsed.data.name, description: parsed.data.description || undefined, sortOrder: Number(parsed.data.sortOrder) || 0 });
  };
  return (
    <Modal
      title="New menu category"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="dashboard-button-light" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="category-form" className="dashboard-button" disabled={create.isPending}>
            {create.isPending ? 'Saving…' : 'Add category'}
          </button>
        </>
      }
    >
      <form id="category-form" className="mt-6 space-y-4" onSubmit={submit} noValidate>
        <Field label="Category name" required error={errors.name}>
          <input className="dashboard-input" maxLength={60} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Starters" required />
        </Field>
        <Field label="Description" error={errors.description}>
          <textarea className="dashboard-input min-h-20" rows={2} maxLength={300} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
        <Field label="Sort order" hint="Lower numbers appear first on the guest menu." error={errors.sortOrder}>
          <input className="dashboard-input" type="number" min="0" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
        </Field>
        {create.isError && (
          <p role="alert" className="border border-copper/20 bg-copper/5 p-3 text-sm text-copper">
            {message(create.error, 'The category could not be created.')}
          </p>
        )}
      </form>
    </Modal>
  );
}

function ItemModal({ categories, onClose, onCreated }: { categories: MenuCategory[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<ItemForm>({ ...emptyItem, categoryId: categories[0]?._id ?? '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useMutation({ mutationFn: (data: Record<string, unknown>) => adminApi.createMenuItem(data), onSuccess: onCreated });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = itemSchema.safeParse(form);
    const price = Number(parsed.success ? parsed.data.price : NaN);
    if (!parsed.success || !Number.isFinite(price) || price <= 0) return setErrors({ ...(parsed.success ? {} : collect(parsed.error.issues)), price: 'Enter a price above zero' });
    setErrors({});
    create.mutate({
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description || undefined,
      price,
      taxRate: Number(parsed.data.taxRate) || 0,
    });
  };
  return (
    <Modal
      title="New dish"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="dashboard-button-light" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="item-form" className="dashboard-button" disabled={create.isPending}>
            {create.isPending ? 'Saving…' : 'Add dish'}
          </button>
        </>
      }
    >
      <form id="item-form" className="mt-6 space-y-4" onSubmit={submit} noValidate>
        <Field label="Category" required error={errors.categoryId}>
          <select className="dashboard-input" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} required>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Dish name" required error={errors.name}>
          <input className="dashboard-input" maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Masala dosa" required />
        </Field>
        <Field label="Description" error={errors.description}>
          <textarea className="dashboard-input min-h-20" rows={2} maxLength={300} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Price" required error={errors.price}>
            <input className="dashboard-input" type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="180" required />
          </Field>
          <Field label="Tax rate (%)" hint="Applied on top of the price at checkout." error={errors.taxRate}>
            <input className="dashboard-input" type="number" min="0" step="0.01" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })} />
          </Field>
        </div>
        {create.isError && (
          <p role="alert" className="border border-copper/20 bg-copper/5 p-3 text-sm text-copper">
            {message(create.error, 'The dish could not be created.')}
          </p>
        )}
      </form>
    </Modal>
  );
}