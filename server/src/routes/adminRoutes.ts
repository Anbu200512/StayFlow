import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { UserRole } from '../types/enums.js';
import {
  adjustInventoryItem,
  adminAvailability,
  cancelAdminReservation,
  changeAdminRoom,
  changeReservationStatus,
  checkInReservation,
  checkoutStay,
  clearRates,
  createAdminReservation,
  createExpenseRecord,
  createGuest,
  createHousekeeping,
  createInventoryItem,
  createMaintenance,
  createMenuCategory,
  createMenuItem,
  createOrder,
  createPayment,
  createRate,
  createRoom,
  createRoomType,
  createService,
  createStaff,
  deleteRate,
  getAdminHotel,
  dashboardOverview,
  extendAdminReservation,
  getGuest,
  getInvoice,
  getCheckoutSummaryHandler,
  getReservation,
  getWebsiteContent,
  globalSearch,
  listAuditLogs,
  listExpenses,
  listGuests,
  listHousekeeping,
  listInventory,
  listInvoices,
  listMaintenance,
  listNotifications,
  listOrders,
  listPayments,
  listReservations,
  listRooms,
  listRoomTypes,
  listRates,
  listServices,
  listStaff,
  listStays,
  markNotificationRead,
  reports,
  restaurantMenu,
  updateHousekeeping,
  updateMaintenance,
  updateOrder,
  updateRoomStatus,
  updateRoomType,
  updateService,
  updateWebsiteContent,
  upload,
  updateGuest,
} from '../controllers/adminController.js';

const management = [UserRole.OWNER, UserRole.MANAGER];
const frontDesk = [UserRole.OWNER, UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT];
const operations = [UserRole.OWNER, UserRole.MANAGER, UserRole.HOUSEKEEPING, UserRole.MAINTENANCE, UserRole.RESTAURANT];
const uploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

export const adminRouter = Router();
adminRouter.use(authenticate);
adminRouter.get('/hotel', authorize(UserRole.OWNER, UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT, UserRole.HOUSEKEEPING, UserRole.RESTAURANT, UserRole.MAINTENANCE), getAdminHotel);

adminRouter.get('/dashboard/overview', authorize(...management, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT), dashboardOverview);
adminRouter.get('/reports', authorize(...management, UserRole.ACCOUNTANT), reports);
adminRouter.post('/availability', authorize(...frontDesk), adminAvailability);

adminRouter.get('/rooms', authorize(...frontDesk, UserRole.HOUSEKEEPING, UserRole.MAINTENANCE), listRooms);
adminRouter.post('/rooms', authorize(...management, UserRole.RECEPTIONIST), createRoom);
adminRouter.patch('/rooms/:id/status', authorize(...frontDesk, UserRole.HOUSEKEEPING, UserRole.MAINTENANCE), updateRoomStatus);
adminRouter.get('/room-types', authorize(...frontDesk), listRoomTypes);
adminRouter.post('/room-types', authorize(...management), createRoomType);
adminRouter.patch('/room-types/:id', authorize(...management), updateRoomType);

adminRouter.get('/rates', authorize(...management), listRates);
adminRouter.post('/rates', authorize(...management), createRate);
adminRouter.post('/rates/clear', authorize(...management), clearRates);
adminRouter.delete('/rates/:id', authorize(...management), deleteRate);

adminRouter.get('/reservations', authorize(...frontDesk), listReservations);
adminRouter.post('/reservations', authorize(...frontDesk), createAdminReservation);
adminRouter.get('/reservations/:id', authorize(...frontDesk), getReservation);
adminRouter.post('/reservations/:id/cancel', authorize(...frontDesk), cancelAdminReservation);
adminRouter.post('/reservations/:id/extend', authorize(...frontDesk), extendAdminReservation);
adminRouter.post('/reservations/:id/change-room', authorize(...frontDesk), changeAdminRoom);
adminRouter.patch('/reservations/:id/status', authorize(...frontDesk), changeReservationStatus);

adminRouter.get('/guests', authorize(...frontDesk), listGuests);
adminRouter.post('/guests', authorize(...frontDesk), createGuest);
adminRouter.get('/guests/:id', authorize(...frontDesk), getGuest);
adminRouter.patch('/guests/:id', authorize(...frontDesk), updateGuest);

adminRouter.get('/stays', authorize(...frontDesk, UserRole.HOUSEKEEPING, UserRole.MAINTENANCE, UserRole.RESTAURANT), listStays);
adminRouter.get('/stays/:id/checkout-summary', authorize(...frontDesk), getCheckoutSummaryHandler);
adminRouter.post('/check-in', authorize(...frontDesk), checkInReservation);
adminRouter.post('/check-out', authorize(...frontDesk), checkoutStay);

adminRouter.get('/payments', authorize(...frontDesk), listPayments);
adminRouter.post('/payments', authorize(...frontDesk), createPayment);
adminRouter.get('/invoices', authorize(...frontDesk), listInvoices);
adminRouter.get('/invoices/:id', authorize(...frontDesk), getInvoice);

adminRouter.get('/housekeeping', authorize(...operations, UserRole.RECEPTIONIST), listHousekeeping);
adminRouter.post('/housekeeping', authorize(...operations, UserRole.RECEPTIONIST), createHousekeeping);
adminRouter.patch('/housekeeping/:id', authorize(...operations, UserRole.RECEPTIONIST), updateHousekeeping);
adminRouter.get('/maintenance', authorize(...operations, UserRole.RECEPTIONIST), listMaintenance);
adminRouter.post('/maintenance', authorize(...operations, UserRole.RECEPTIONIST), createMaintenance);
adminRouter.patch('/maintenance/:id', authorize(...operations, UserRole.RECEPTIONIST), updateMaintenance);
adminRouter.get('/services', authorize(...frontDesk, ...operations), listServices);
adminRouter.post('/services', authorize(...frontDesk, ...operations), createService);
adminRouter.patch('/services/:id', authorize(...operations, UserRole.RECEPTIONIST), updateService);

adminRouter.get('/restaurant/menu', authorize(...operations, UserRole.RECEPTIONIST), restaurantMenu);
adminRouter.post('/restaurant/categories', authorize(...management, UserRole.RESTAURANT), createMenuCategory);
adminRouter.post('/restaurant/items', authorize(...management, UserRole.RESTAURANT), createMenuItem);
adminRouter.get('/orders', authorize(...operations, UserRole.RECEPTIONIST), listOrders);
adminRouter.post('/orders', authorize(...operations, UserRole.RECEPTIONIST), createOrder);
adminRouter.patch('/orders/:id', authorize(...operations, UserRole.RECEPTIONIST), updateOrder);

adminRouter.get('/inventory', authorize(...management, UserRole.ACCOUNTANT, UserRole.HOUSEKEEPING), listInventory);
adminRouter.post('/inventory', authorize(...management, UserRole.ACCOUNTANT), createInventoryItem);
adminRouter.patch('/inventory/:id', authorize(...management, UserRole.ACCOUNTANT, UserRole.HOUSEKEEPING), adjustInventoryItem);
adminRouter.get('/expenses', authorize(...management, UserRole.ACCOUNTANT), listExpenses);
adminRouter.post('/expenses', authorize(...management, UserRole.ACCOUNTANT), createExpenseRecord);

adminRouter.get('/website', authorize(...management), getWebsiteContent);
adminRouter.put('/website', authorize(...management), updateWebsiteContent);
adminRouter.get('/notifications', authorize(...frontDesk, ...operations), listNotifications);
adminRouter.patch('/notifications/:id/read', authorize(...frontDesk, ...operations), markNotificationRead);
adminRouter.get('/staff', authorize(...management), listStaff);
adminRouter.post('/staff', authorize(...management), createStaff);
adminRouter.get('/search', authorize(...frontDesk, ...operations), globalSearch);
adminRouter.get('/audit-logs', authorize(...management), listAuditLogs);
adminRouter.post('/uploads/images', authorize(...management), uploadMiddleware.single('image'), upload);
