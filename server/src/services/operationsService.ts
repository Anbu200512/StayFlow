import {
  Expense,
  HousekeepingTask,
  InventoryItem,
  InventoryTransaction,
  MaintenanceRequest,
  MenuCategory,
  MenuItem,
  Order,
  Room,
} from '../models/index.js';
import { MaintenanceStatus, OrderStatus, PaymentMethod, RoomStatus, TaskStatus } from '../types/enums.js';
import { AppError } from '../utils/error.js';
import { roundMoney } from '../utils/common.js';
import { emitHotelEvent } from './socketService.js';
import { createNotification } from './notificationService.js';
import { updateRoomAvailability, makeNumber } from './reservationService.js';
import { writeAuditLog } from '../middleware/audit.js';

export async function createHousekeepingTask(input: { hotelId: string; roomId: string; type: string; priority?: string; assignedTo?: string; dueAt?: Date; notes?: string; source?: string; userId?: string }) {
  const room = await Room.findOne({ _id: input.roomId, hotelId: input.hotelId });
  if (!room) throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
  const task = await HousekeepingTask.create({ hotelId: input.hotelId, roomId: input.roomId, type: input.type, priority: input.priority ?? 'normal', assignedTo: input.assignedTo, dueAt: input.dueAt, notes: input.notes, source: input.source ?? 'manual' });
  emitHotelEvent(input.hotelId, 'housekeeping.task.created', task.toObject());
  await createNotification({ hotelId: input.hotelId, type: 'housekeeping.task', title: 'Housekeeping task', message: `${input.type.replaceAll('_', ' ')} scheduled for a room.`, metadata: { taskId: task._id, roomId: input.roomId } });
  return task;
}

export async function updateHousekeepingTask(input: { taskId: string; hotelId: string; status: TaskStatus; assignedTo?: any; notes?: string; userId?: any }) {
  const task = await HousekeepingTask.findOne({ _id: input.taskId, hotelId: input.hotelId });
  if (!task) throw new AppError('Housekeeping task not found', 404, 'TASK_NOT_FOUND');
  const transitions: Record<TaskStatus, TaskStatus[]> = {
    [TaskStatus.PENDING]: [TaskStatus.ASSIGNED, TaskStatus.ACCEPTED, TaskStatus.CANCELLED],
    [TaskStatus.ASSIGNED]: [TaskStatus.ACCEPTED, TaskStatus.CANCELLED],
    [TaskStatus.ACCEPTED]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
    [TaskStatus.IN_PROGRESS]: [TaskStatus.COMPLETED, TaskStatus.CANCELLED],
    [TaskStatus.COMPLETED]: [TaskStatus.INSPECTED],
    [TaskStatus.INSPECTED]: [],
    [TaskStatus.CANCELLED]: [],
  };
  if (!transitions[task.status].includes(input.status)) throw new AppError('Invalid housekeeping transition', 400, 'INVALID_STATUS_TRANSITION');
  const previous = task.status;
  task.status = input.status;
  task.assignedTo = input.assignedTo ?? task.assignedTo;
  task.notes = input.notes ?? task.notes;
  if (input.status === TaskStatus.IN_PROGRESS) task.startedAt = new Date();
  if (input.status === TaskStatus.COMPLETED) task.completedAt = new Date();
  if (input.status === TaskStatus.INSPECTED) {
    task.inspectedAt = new Date();
    task.inspectedBy = input.userId;
    await Room.updateOne({ _id: task.roomId, hotelId: input.hotelId, status: { $in: [RoomStatus.DIRTY, RoomStatus.CLEANING] } }, { $set: { status: RoomStatus.AVAILABLE, statusUpdatedAt: new Date(), statusNote: undefined } });
  }
  await task.save();
  emitHotelEvent(input.hotelId, 'housekeeping.task.updated', { ...task.toObject(), previousStatus: previous });
  await writeAuditLog({ hotelId: input.hotelId, userId: input.userId, action: 'housekeeping.status_changed', entity: 'HousekeepingTask', entityId: task._id.toString(), oldValue: { status: previous }, newValue: { status: task.status } });
  return task;
}

export async function createMaintenanceRequest(input: { hotelId: string; roomId?: string; issue: string; description: string; priority?: string; assignedTo?: any; userId?: any }) {
  const request = await MaintenanceRequest.create({ hotelId: input.hotelId, roomId: input.roomId, issue: input.issue, description: input.description, priority: input.priority ?? 'normal', assignedTo: input.assignedTo, createdBy: input.userId, status: MaintenanceStatus.OPEN });
  if (input.roomId) await Room.updateOne({ _id: input.roomId, hotelId: input.hotelId, status: { $ne: RoomStatus.OCCUPIED } }, { $set: { status: RoomStatus.MAINTENANCE, statusUpdatedAt: new Date(), statusNote: input.issue } });
  emitHotelEvent(input.hotelId, 'maintenance.request.created', request.toObject());
  await createNotification({ hotelId: input.hotelId, type: 'maintenance.request', title: 'Maintenance request', message: `${input.issue} requires attention.` });
  return request;
}

export async function updateMaintenanceRequest(input: { requestId: string; hotelId: string; status: MaintenanceStatus; assignedTo?: any; resolutionNotes?: string; userId?: any }) {
  const request = await MaintenanceRequest.findOne({ _id: input.requestId, hotelId: input.hotelId });
  if (!request) throw new AppError('Maintenance request not found', 404, 'MAINTENANCE_REQUEST_NOT_FOUND');
  const transitions: Record<MaintenanceStatus, MaintenanceStatus[]> = {
    [MaintenanceStatus.OPEN]: [MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.CLOSED],
    [MaintenanceStatus.ASSIGNED]: [MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.CLOSED],
    [MaintenanceStatus.IN_PROGRESS]: [MaintenanceStatus.RESOLVED, MaintenanceStatus.CLOSED],
    [MaintenanceStatus.RESOLVED]: [MaintenanceStatus.CLOSED],
    [MaintenanceStatus.CLOSED]: [],
  };
  if (!transitions[request.status].includes(input.status)) throw new AppError('Invalid maintenance transition', 400, 'INVALID_STATUS_TRANSITION');
  request.status = input.status;
  request.assignedTo = input.assignedTo ?? request.assignedTo;
  request.resolutionNotes = input.resolutionNotes ?? request.resolutionNotes;
  if (input.status === MaintenanceStatus.RESOLVED) request.resolvedAt = new Date();
  if (input.status === MaintenanceStatus.CLOSED) request.closedAt = new Date();
  await request.save();
  if (request.roomId) await Room.updateOne({ _id: request.roomId, hotelId: input.hotelId, status: RoomStatus.MAINTENANCE }, { $set: { status: RoomStatus.AVAILABLE, statusUpdatedAt: new Date(), statusNote: undefined } });
  if (request.roomId) await updateRoomAvailability(request.roomId.toString(), input.hotelId);
  emitHotelEvent(input.hotelId, 'maintenance.request.updated', request.toObject());
  return request;
}

export async function listRestaurantMenu(hotelId: string) {
  const [categories, items] = await Promise.all([
    MenuCategory.find({ hotelId, active: true }).sort({ sortOrder: 1 }).lean(),
    MenuItem.find({ hotelId, available: true }).populate('categoryId', 'name').sort({ name: 1 }).lean(),
  ]);
  return categories.map((category) => ({ ...category, items: items.filter((item) => item.categoryId._id.toString() === category._id.toString()) }));
}

export async function createRestaurantOrder(input: { hotelId: string; type: 'room_service' | 'restaurant'; roomId?: string; stayId?: string; guestId?: string; tableId?: string; items: { menuItemId: string; quantity: number; notes?: string }[]; notes?: string; userId?: string }) {
  if (input.items.length === 0) throw new AppError('Order must contain at least one item', 400, 'EMPTY_ORDER');
  const menuItems = await MenuItem.find({ hotelId: input.hotelId, _id: { $in: input.items.map((item) => item.menuItemId) }, available: true });
  const menuMap = new Map(menuItems.map((item) => [item._id.toString(), item]));
  const orderItems = input.items.map((item) => {
    const menuItem = menuMap.get(item.menuItemId);
    if (!menuItem) throw new AppError('One or more menu items are unavailable', 400, 'MENU_ITEM_UNAVAILABLE');
    const quantity = Math.max(1, Math.min(50, item.quantity));
    const amount = roundMoney(menuItem.price * quantity);
    const tax = roundMoney(amount * menuItem.taxRate / 100);
    return { menuItemId: menuItem._id, name: menuItem.name, quantity, unitPrice: menuItem.price, taxRate: menuItem.taxRate, amount: roundMoney(amount + tax), notes: item.notes };
  });
  const subtotal = roundMoney(orderItems.reduce((sum, item) => sum + item.amount - item.amount * item.taxRate / (100 + item.taxRate), 0));
  const tax = roundMoney(orderItems.reduce((sum, item) => sum + item.amount - (item.amount - item.amount * item.taxRate / (100 + item.taxRate)), 0));
  const order = await Order.create({ hotelId: input.hotelId, orderNumber: makeNumber('ORD'), type: input.type, status: OrderStatus.PENDING, tableId: input.tableId, roomId: input.roomId, stayId: input.stayId, guestId: input.guestId, items: orderItems, subtotal, tax, total: roundMoney(subtotal + tax), placedAt: new Date(), notes: input.notes });
  if (input.type === 'room_service' && input.roomId) await Room.updateOne({ _id: input.roomId }, { $set: { statusNote: 'Room service order pending' } });
  emitHotelEvent(input.hotelId, 'restaurant.order.created', order.toObject());
  await createNotification({
    hotelId: input.hotelId,
    type: input.type === 'room_service' ? 'order.room_service' : 'order.restaurant',
    title: input.type === 'room_service' ? 'Room service order' : 'Kitchen order',
    message: `${order.orderNumber} · ${orderItems.length} item${orderItems.length === 1 ? '' : 's'} · ₹${order.total}`,
    metadata: { orderId: order._id, orderType: input.type, roomId: input.roomId },
  });
  return order;
}

export async function updateRestaurantOrder(input: { orderId: string; hotelId: string; status: OrderStatus; userId?: string }) {
  const order = await Order.findOne({ _id: input.orderId, hotelId: input.hotelId });
  if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  const transitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
    [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
    [OrderStatus.READY]: [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]: [],
    [OrderStatus.CANCELLED]: [],
  };
  if (!transitions[order.status].includes(input.status)) throw new AppError('Invalid order transition', 400, 'INVALID_STATUS_TRANSITION');
  order.status = input.status;
  if (input.status === OrderStatus.DELIVERED) order.deliveredAt = new Date();
  await order.save();
  emitHotelEvent(input.hotelId, 'restaurant.order.updated', order.toObject());
  return order;
}

export async function adjustInventory(input: { hotelId: string; itemId: string; type: 'purchase' | 'consumption' | 'adjustment'; quantity: number; unitCost?: number; notes?: string; userId?: string }) {
  const signedQuantity = roundMoney(input.type === 'consumption' ? -Math.abs(input.quantity) : input.type === 'purchase' ? Math.abs(input.quantity) : input.quantity);
  if (!Number.isFinite(signedQuantity)) throw new AppError('Inventory quantity must be finite', 400, 'INVALID_INVENTORY_QUANTITY');
  const update: Record<string, unknown> = { $inc: { quantity: signedQuantity } };
  if (input.unitCost !== undefined) update.$set = { purchasePrice: input.unitCost };
  const item = await InventoryItem.findOneAndUpdate(
    { _id: input.itemId, hotelId: input.hotelId, $expr: { $gt: [{ $add: ['$quantity', signedQuantity] }, 0] } },
    update,
    { new: true, runValidators: true },
  );
  if (!item) {
    const existing = await InventoryItem.findOne({ _id: input.itemId, hotelId: input.hotelId }).select('quantity').lean();
    if (!existing) throw new AppError('Inventory item not found', 404, 'INVENTORY_ITEM_NOT_FOUND');
    throw new AppError('Inventory quantity must remain positive', 400, 'INSUFFICIENT_STOCK');
  }
  const nextQuantity = item.quantity;
  const transaction = await InventoryTransaction.create({ hotelId: input.hotelId, itemId: item._id, type: input.type, quantity: signedQuantity, balanceAfter: nextQuantity, unitCost: input.unitCost, notes: input.notes, createdBy: input.userId });
  if (nextQuantity <= item.minimumStock) await createNotification({ hotelId: input.hotelId, type: 'inventory.low_stock', title: 'Low stock alert', message: `${item.name} is at ${nextQuantity} ${item.unit}; minimum is ${item.minimumStock}.` });
  emitHotelEvent(input.hotelId, 'inventory.updated', { itemId: item._id, quantity: nextQuantity, lowStock: nextQuantity <= item.minimumStock });
  return { item, transaction };
}

export async function createExpense(input: { hotelId: string; category: string; amount: number; date: Date; paymentMethod: PaymentMethod; description: string; receiptUrl?: string; userId?: string }) {
  const expense = await Expense.create({ ...input, amount: roundMoney(input.amount) });
  emitHotelEvent(input.hotelId, 'expense.created', expense.toObject());
  return expense;
}
