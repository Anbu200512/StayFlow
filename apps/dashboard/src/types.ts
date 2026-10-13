export type UserRole = 'owner' | 'manager' | 'receptionist' | 'housekeeping' | 'restaurant' | 'maintenance' | 'accountant';
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'razorpay';
export type ReservationSource = 'website' | 'walk_in' | 'phone' | 'admin';

export interface PaginationMeta { page: number; limit: number; total: number; pages: number }
export interface Paginated<T> { data: T[]; meta: PaginationMeta }
export interface User { id: string; name: string; email: string; role: UserRole; hotelId: string; phone?: string; avatarUrl?: string }
export interface Hotel {
  _id: string;
  name: string;
  description?: string;
  contact: { phone: string; email: string; website?: string };
  address: { line1: string; line2?: string; city: string; state?: string; postalCode?: string; country: string };
  timezone: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  taxRate: number;
  logoUrl?: string;
  heroImageUrl?: string;
}
export interface RoomType {
  _id: string;
  name: string;
  description: string;
  basePrice: number;
  currency: string;
  maxAdults: number;
  maxChildren: number;
  maxOccupancy: number;
  bedConfiguration: string;
  sizeSqm?: number;
  amenities: string[];
  images: { publicId: string; url: string; alt?: string }[];
  totalRooms: number;
}
export interface Room {
  _id: string;
  roomNumber: string;
  floor: number;
  status: string;
  statusUpdatedAt?: string;
  statusNote?: string;
  features: string[];
  roomTypeId: RoomType;
  reservedIntervals?: { reservationId: string; checkIn: string; checkOut: string }[];
}
export interface RoomRate {
  _id: string;
  roomTypeId: string;
  startDate: string;
  endDate: string;
  price: number;
  daysOfWeek?: number[];
  createdAt?: string;
}
export interface AvailableRoom extends Omit<Room, 'roomTypeId'> { roomTypeId: RoomType }
export interface Guest {
  _id: string;
  fullName: string;
  mobile: string;
  email?: string;
  address?: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
  idDocumentUrl?: string;
  dateOfBirth?: string;
  emergencyContact?: { name?: string; mobile?: string; relationship?: string };
  notes?: string;
  privacyConsent?: boolean;
  marketingConsent?: boolean;
  createdAt: string;
  updatedAt?: string;
}
export interface PricingSnapshot { roomSubtotal: number; servicesSubtotal: number; subtotal: number; tax: number; discount: number; total: number; currency: string }
export interface Reservation {
  _id: string;
  bookingNumber: string;
  status: string;
  source: ReservationSource | string;
  checkIn: string;
  checkOut: string;
  guests: { adults: number; children: number };
  nights: number;
  pricing: PricingSnapshot;
  guestSnapshot: { fullName: string; mobile: string; email?: string };
  roomId: Room;
  roomTypeId: RoomType;
  services?: { code: string; name: string; quantity: number; unitPrice: number; total: number; notes?: string }[];
  specialRequests?: string;
  notes?: string;
  cancellationReason?: string;
  createdAt: string;
}
export interface Stay {
  _id: string;
  reservationId: string | Reservation;
  guestId: string | Guest;
  roomId: string | Room;
  checkInAt: string;
  expectedCheckOut: string;
  actualCheckOut?: string;
  status: string;
  createdAt: string;
}
export interface Invoice {
  _id: string;
  invoiceNumber: string;
  guestId: string | Guest;
  reservationId?: string | Reservation;
  stayId?: string | Stay;
  items?: string[];
  roomSubtotal: number;
  servicesSubtotal: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  amountPaid: number;
  balance: number;
  currency: string;
  status: string;
  issuedAt?: string;
  createdAt: string;
}
export interface InvoiceItem { _id: string; type: string; description: string; quantity: number; unitPrice: number; amount: number; taxAmount: number; serviceDate?: string }
export interface Payment {
  _id: string;
  invoiceId?: string | Invoice;
  reservationId?: string | Reservation;
  guestId?: string | Guest;
  amount: number;
  method: PaymentMethod | string;
  status: string;
  currency: string;
  provider?: string;
  paidAt?: string;
  refundAmount?: number;
  notes?: string;
  createdAt: string;
}
export interface HousekeepingTask {
  _id: string;
  roomId: string | Room;
  type: string;
  status: string;
  priority: string;
  assignedTo?: string | User;
  dueAt?: string;
  notes?: string;
  createdAt: string;
}
export interface MaintenanceRequest {
  _id: string;
  roomId?: string | Room;
  issue: string;
  description: string;
  priority: string;
  status: string;
  assignedTo?: string | User;
  createdBy?: string | User;
  resolutionNotes?: string;
  createdAt: string;
}
export interface ServiceRequest {
  _id: string;
  roomId: string | Room;
  guestId?: string | Guest;
  stayId?: string | Stay;
  category: string;
  description: string;
  status: string;
  priority: string;
  assignedTo?: string | User;
  chargeAmount: number;
  createdAt: string;
}
export interface Notification { _id: string; channel: string; type: string; title: string; message: string; status: string; metadata?: { name?: string; email?: string; phone?: string; [key: string]: unknown }; readAt?: string; sentAt?: string; createdAt: string }
export interface MenuCategory { _id: string; name: string; description?: string; sortOrder: number; items: MenuItem[] }
export interface MenuItem {
  _id: string;
  categoryId: string | { _id: string; name: string };
  name: string;
  description?: string;
  price: number;
  taxRate: number;
  imageUrl?: string;
  available: boolean;
}
export interface OrderLine { menuItemId: string; name: string; quantity: number; unitPrice: number; taxRate: number; amount: number; notes?: string }
export interface Order {
  _id: string;
  orderNumber: string;
  type: 'room_service' | 'restaurant';
  status: string;
  roomId?: string | Room;
  tableId?: string | { _id: string; name: string };
  stayId?: string | Stay;
  guestId?: string | Guest;
  items: OrderLine[];
  subtotal: number;
  tax: number;
  total: number;
  placedAt: string;
  deliveredAt?: string;
  notes?: string;
}
export interface WebsiteContent {
  _id: string;
  home: { eyebrow?: string; title?: string; subtitle?: string; primaryCta?: string; secondaryCta?: string };
  about?: string;
  whyChooseUs?: { title: string; description: string; icon?: string }[];
  location?: { label?: string; address?: string; mapUrl?: string };
  contact?: { phone: string; email: string; website?: string };
  footerText?: string;
  socialLinks?: Record<string, string>;
  published: boolean;
  updatedAt?: string;
}
export interface DashboardOverview {
  generatedAt: string;
  kpis: { todaysRevenue: number; occupancy: number; totalRooms: number; availableRooms: number; occupiedRooms: number; todaysCheckIns: number; todaysCheckOuts: number; pendingPayments: number; pendingPaymentsCount: number; pendingHousekeeping: number; maintenanceIssues: number };
  bookingSources: { source: string; count: number; revenue: number }[];
  revenueTrend: { date: string; revenue: number }[];
  roomStatus: { status: string; count: number }[];
}
export interface ReportData {
  range: { from: string; to: string };
  revenueByDay: { date: string; revenue: number }[];
  expensesByDay: { date: string; expenses: number }[];
  occupancy: { status: string; count: number }[];
  sources: { source: string; count: number; revenue: number; cancellations: number }[];
  roomPerformance: { roomNumber: string; status: string; reservations: number; revenue: number }[];
  restaurantRevenue: number;
  paymentMethods: { method: string; total: number; count: number }[];
  metrics: { occupancy: number; adr: number; revpar: number };
}
export interface CheckoutSummary {
  stay: { id: string; checkInAt: string; expectedCheckOut: string; status: string };
  guest?: { fullName: string; mobile?: string; email?: string };
  room: { roomNumber: string };
  reservation: { id: string; bookingNumber: string; source: string; checkIn: string; checkOut: string };
  folio: { roomSubtotal: number; servicesSubtotal: number; subtotal: number; tax: number; discount: number; total: number; amountPaid: number; balance: number; currency: string };
  extraCharges: { type: 'restaurant' | 'service'; description: string; amount: number; taxAmount: number; status: string }[];
  payments?: { id: string; amount: number; method: string; paidAt?: string }[];
}
export interface GuestDetail { guest: Guest; reservations: Reservation[]; stays: Stay[]; payments: Payment[]; invoices: Invoice[] }
export interface StaffUser { _id: string; name: string; email: string; role: UserRole; phone?: string; active: boolean; lastLoginAt?: string; createdAt: string }
