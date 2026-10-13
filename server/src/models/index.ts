import { model, Schema, Types } from 'mongoose';
import {
  InvoiceStatus,
  MaintenanceStatus,
  NotificationChannel,
  NotificationStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ReservationSource,
  ReservationStatus,
  RoomStatus,
  ServiceStatus,
  StayStatus,
  TaskStatus,
  UserRole,
} from '../types/enums.js';

export type Id = Types.ObjectId;

export interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

export interface ImageReference {
  publicId: string;
  url: string;
  alt?: string;
}

export interface RefreshTokenRecord {
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt?: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface UserDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string;
  active: boolean;
  lastLoginAt?: Date;
  sessionVersion: number;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  refreshTokens: RefreshTokenRecord[];
}

export interface ContactDetails {
  phone: string;
  email: string;
  website?: string;
}

export interface HotelDocument extends Timestamped {
  _id: Id;
  name: string;
  slug: string;
  description?: string;
  contact: ContactDetails;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
  };
  timezone: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  taxRate: number;
  logoUrl?: string;
  heroImageUrl?: string;
  policies?: Record<string, string>;
  socialLinks?: Record<string, string>;
  active: boolean;
}

export interface RoomTypeDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  currency: string;
  maxAdults: number;
  maxChildren: number;
  maxOccupancy: number;
  bedConfiguration: string;
  sizeSqm?: number;
  amenities: string[];
  images: ImageReference[];
  totalRooms: number;
  active: boolean;
}

export interface RoomInterval {
  reservationId: Id;
  checkIn: Date;
  checkOut: Date;
}

export interface RoomRateDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  roomTypeId: Id;
  startDate: Date;
  endDate: Date;
  price: number;
  daysOfWeek?: number[];
}

export interface RoomDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  roomTypeId: Id;
  roomNumber: string;
  floor: number;
  status: RoomStatus;
  statusUpdatedAt: Date;
  statusNote?: string;
  features: string[];
  qrTokenHash?: string;
  reservedIntervals: RoomInterval[];
}

export interface GuestDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  fullName: string;
  mobile: string;
  email?: string;
  address?: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
  idDocumentUrl?: string;
  dateOfBirth?: Date;
  emergencyContact?: { name?: string; mobile?: string; relationship?: string };
  notes?: string;
  privacyConsent: boolean;
  marketingConsent: boolean;
}

export interface GuestSnapshot {
  fullName: string;
  mobile: string;
  email?: string;
}

export interface SelectedService {
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
}

export interface PricingSnapshot {
  roomSubtotal: number;
  servicesSubtotal: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
}

export interface StatusHistoryRecord {
  status: ReservationStatus | StayStatus;
  at: Date;
  by?: Id;
  note?: string;
}

export interface ReservationDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  bookingNumber: string;
  guestId: Id;
  guestSnapshot: GuestSnapshot;
  roomId: Id;
  roomTypeId: Id;
  source: ReservationSource;
  status: ReservationStatus;
  checkIn: Date;
  checkOut: Date;
  guests: { adults: number; children: number };
  nights: number;
  pricing: PricingSnapshot;
  services: SelectedService[];
  specialRequests?: string;
  notes?: string;
  createdBy?: Id;
  confirmedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  checkedInAt?: Date;
  checkedOutAt?: Date;
  noShowAt?: Date;
  completedAt?: Date;
  statusHistory: StatusHistoryRecord[];
}

export interface StayDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  reservationId: Id;
  guestId: Id;
  roomId: Id;
  checkInAt: Date;
  expectedCheckOut: Date;
  actualCheckOut?: Date;
  status: StayStatus;
  openedBy?: Id;
  closedBy?: Id;
  qrTokenHash?: string;
  notes?: string;
}

export interface PaymentDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  reservationId?: Id;
  stayId?: Id;
  guestId?: Id;
  invoiceId?: Id;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  currency: string;
  provider?: string;
  providerPaymentId?: string;
  providerOrderId?: string;
  paidAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  refundAmount: number;
  recordedBy?: Id;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface InvoiceDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  invoiceNumber: string;
  reservationId?: Id;
  stayId?: Id;
  guestId: Id;
  items: Id[];
  roomSubtotal: number;
  servicesSubtotal: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  amountPaid: number;
  balance: number;
  currency: string;
  status: InvoiceStatus;
  issuedAt?: Date;
  finalisedAt?: Date;
  notes?: string;
}

export interface InvoiceItemDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  invoiceId: Id;
  reservationId?: Id;
  stayId?: Id;
  type: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxAmount: number;
  serviceDate?: Date;
  metadata?: Record<string, unknown>;
}

export interface HousekeepingTaskDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  roomId: Id;
  type: string;
  status: TaskStatus;
  priority: string;
  assignedTo?: Id;
  dueAt?: Date;
  source: string;
  reservationId?: Id;
  notes?: string;
  startedAt?: Date;
  completedAt?: Date;
  inspectedAt?: Date;
  inspectedBy?: Id;
}

export interface MaintenanceRequestDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  roomId?: Id;
  issue: string;
  description: string;
  priority: string;
  status: MaintenanceStatus;
  assignedTo?: Id;
  createdBy?: Id;
  resolvedAt?: Date;
  closedAt?: Date;
  resolutionNotes?: string;
}

export interface ServiceRequestDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  stayId?: Id;
  reservationId?: Id;
  roomId: Id;
  guestId?: Id;
  category: string;
  description: string;
  status: ServiceStatus;
  priority: string;
  assignedTo?: Id;
  chargeAmount: number;
  fulfilledAt?: Date;
  notes?: string;
}

export interface RestaurantTableDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  name: string;
  capacity: number;
  status: string;
  active: boolean;
}

export interface MenuCategoryDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  name: string;
  description?: string;
  sortOrder: number;
  active: boolean;
}

export interface MenuItemDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  categoryId: Id;
  name: string;
  description?: string;
  price: number;
  taxRate: number;
  available: boolean;
  imageUrl?: string;
}

export interface OrderItem {
  menuItemId: Id;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
  notes?: string;
}

export interface OrderDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  orderNumber: string;
  type: string;
  status: OrderStatus;
  tableId?: Id;
  roomId?: Id;
  stayId?: Id;
  guestId?: Id;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentId?: Id;
  placedAt: Date;
  deliveredAt?: Date;
  notes?: string;
}

export interface InventoryItemDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  minimumStock: number;
  unit: string;
  purchasePrice: number;
  supplier?: string;
  active: boolean;
}

export interface InventoryTransactionDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  itemId: Id;
  type: string;
  quantity: number;
  balanceAfter: number;
  unitCost?: number;
  referenceType?: string;
  referenceId?: Id;
  notes?: string;
  createdBy?: Id;
}

export interface ExpenseDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  category: string;
  amount: number;
  date: Date;
  paymentMethod: PaymentMethod;
  description: string;
  receiptUrl?: string;
  createdBy?: Id;
}

export interface NotificationDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  userId?: Id;
  guestId?: Id;
  channel: NotificationChannel;
  type: string;
  title: string;
  message: string;
  status: NotificationStatus;
  readAt?: Date;
  sentAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface AuditLogDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  userId?: Id;
  action: string;
  entity: string;
  entityId?: Id;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export interface WebsiteContentDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  home: {
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    primaryCta?: string;
    secondaryCta?: string;
  };
  about?: string;
  whyChooseUs?: { title: string; description: string; icon?: string }[];
  location?: { label?: string; address?: string; mapUrl?: string };
  contact?: ContactDetails;
  footerText?: string;
  socialLinks?: Record<string, string>;
  published: boolean;
}

export interface OfferDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  title: string;
  description: string;
  code?: string;
  discountType: string;
  discountValue: number;
  minNights?: number;
  validFrom: Date;
  validTo: Date;
  active: boolean;
  terms?: string;
}

export interface GalleryImageDocument extends Timestamped {
  _id: Id;
  hotelId: Id;
  publicId: string;
  url: string;
  alt: string;
  category?: string;
  sortOrder: number;
  active: boolean;
}

const imageSchema = new Schema<ImageReference>({
  publicId: { type: String, required: true },
  url: { type: String, required: true },
  alt: String,
}, { _id: false });

const refreshTokenSchema = new Schema<RefreshTokenRecord>({
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, required: true },
  revokedAt: Date,
  userAgent: String,
  ipAddress: String,
}, { _id: false });

const contactSchema = new Schema<ContactDetails>({
  phone: { type: String, required: true },
  email: { type: String, required: true },
  website: String,
}, { _id: false });

const addressSchema = new Schema({
  line1: { type: String, required: true },
  line2: String,
  city: { type: String, required: true },
  state: String,
  postalCode: String,
  country: { type: String, required: true },
}, { _id: false });

const userSchema = new Schema<UserDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: Object.values(UserRole), required: true },
  phone: String,
  avatarUrl: String,
  active: { type: Boolean, default: true },
  lastLoginAt: Date,
  sessionVersion: { type: Number, default: 0 },
  passwordResetTokenHash: String,
  passwordResetExpiresAt: Date,
  refreshTokens: { type: [refreshTokenSchema], default: [] },
}, { timestamps: true });
userSchema.index({ hotelId: 1, email: 1 }, { unique: true });

const hotelSchema = new Schema<HotelDocument>({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, lowercase: true, trim: true, unique: true },
  description: String,
  contact: { type: contactSchema, required: true },
  address: { type: addressSchema, required: true },
  timezone: { type: String, default: 'Asia/Kolkata' },
  currency: { type: String, default: 'INR' },
  checkInTime: { type: String, default: '14:00' },
  checkOutTime: { type: String, default: '11:00' },
  taxRate: { type: Number, default: 10, min: 0 },
  logoUrl: String,
  heroImageUrl: String,
  policies: { type: Schema.Types.Mixed },
  socialLinks: { type: Schema.Types.Mixed },
  active: { type: Boolean, default: true },
}, { timestamps: true });

const roomTypeSchema = new Schema<RoomTypeDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, lowercase: true, trim: true },
  description: { type: String, required: true },
  basePrice: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR' },
  maxAdults: { type: Number, default: 2, min: 1 },
  maxChildren: { type: Number, default: 2, min: 0 },
  maxOccupancy: { type: Number, default: 4, min: 1 },
  bedConfiguration: { type: String, required: true },
  sizeSqm: { type: Number, min: 0 },
  amenities: { type: [String], default: [] },
  images: { type: [imageSchema], default: [] },
  totalRooms: { type: Number, default: 0, min: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });
roomTypeSchema.index({ hotelId: 1, slug: 1 }, { unique: true });

const roomRateSchema = new Schema<RoomRateDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  roomTypeId: { type: Schema.Types.ObjectId, ref: 'RoomType', required: true, index: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  price: { type: Number, required: true, min: 0 },
  daysOfWeek: { type: [Number], default: undefined },
}, { timestamps: true });
roomRateSchema.index({ hotelId: 1, roomTypeId: 1, startDate: 1, endDate: 1 });

const roomIntervalSchema = new Schema<RoomInterval>({
  reservationId: { type: Schema.Types.ObjectId, ref: 'Reservation', required: true },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
}, { _id: false });

const roomSchema = new Schema<RoomDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  roomTypeId: { type: Schema.Types.ObjectId, ref: 'RoomType', required: true, index: true },
  roomNumber: { type: String, required: true, trim: true },
  floor: { type: Number, required: true, min: 0 },
  status: { type: String, enum: Object.values(RoomStatus), default: RoomStatus.AVAILABLE, index: true },
  statusUpdatedAt: { type: Date, default: Date.now },
  statusNote: String,
  features: { type: [String], default: [] },
  qrTokenHash: { type: String, select: false },
  reservedIntervals: { type: [roomIntervalSchema], default: [] },
}, { timestamps: true });
roomSchema.index({ hotelId: 1, roomNumber: 1 }, { unique: true });
roomSchema.index({ hotelId: 1, roomTypeId: 1, status: 1 });

const emergencyContactSchema = new Schema({
  name: String,
  mobile: String,
  relationship: String,
}, { _id: false });

const guestSchema = new Schema<GuestDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  fullName: { type: String, required: true, trim: true, index: true },
  mobile: { type: String, required: true, trim: true, index: true },
  email: { type: String, lowercase: true, trim: true },
  address: String,
  nationality: String,
  idType: String,
  idNumber: String,
  idDocumentUrl: String,
  dateOfBirth: Date,
  emergencyContact: emergencyContactSchema,
  notes: String,
  privacyConsent: { type: Boolean, default: false },
  marketingConsent: { type: Boolean, default: false },
}, { timestamps: true });
guestSchema.index({ hotelId: 1, mobile: 1 });
guestSchema.index({ hotelId: 1, fullName: 1, mobile: 1 });

const guestSnapshotSchema = new Schema<GuestSnapshot>({
  fullName: { type: String, required: true },
  mobile: { type: String, required: true },
  email: String,
}, { _id: false });

const selectedServiceSchema = new Schema<SelectedService>({
  code: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0.01 },
  unitPrice: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  notes: String,
}, { _id: false });

const pricingSchema = new Schema<PricingSnapshot>({
  roomSubtotal: { type: Number, required: true, min: 0 },
  servicesSubtotal: { type: Number, required: true, min: 0 },
  subtotal: { type: Number, required: true, min: 0 },
  tax: { type: Number, required: true, min: 0 },
  discount: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true },
}, { _id: false });

const statusHistorySchema = new Schema<StatusHistoryRecord>({
  status: { type: String, required: true },
  at: { type: Date, required: true },
  by: { type: Schema.Types.ObjectId, ref: 'User' },
  note: String,
}, { _id: false });

const reservationSchema = new Schema<ReservationDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  bookingNumber: { type: String, required: true, unique: true, index: true },
  guestId: { type: Schema.Types.ObjectId, ref: 'Guest', required: true, index: true },
  guestSnapshot: { type: guestSnapshotSchema, required: true },
  roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  roomTypeId: { type: Schema.Types.ObjectId, ref: 'RoomType', required: true },
  source: { type: String, enum: Object.values(ReservationSource), required: true, index: true },
  status: { type: String, enum: Object.values(ReservationStatus), required: true, index: true },
  checkIn: { type: Date, required: true, index: true },
  checkOut: { type: Date, required: true, index: true },
  guests: {
    adults: { type: Number, required: true, min: 1 },
    children: { type: Number, required: true, min: 0, default: 0 },
  },
  nights: { type: Number, required: true, min: 1 },
  pricing: { type: pricingSchema, required: true },
  services: { type: [selectedServiceSchema], default: [] },
  specialRequests: String,
  notes: String,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  confirmedAt: Date,
  cancelledAt: Date,
  cancellationReason: String,
  checkedInAt: Date,
  checkedOutAt: Date,
  noShowAt: Date,
  completedAt: Date,
  statusHistory: { type: [statusHistorySchema], default: [] },
}, { timestamps: true });
reservationSchema.index({ hotelId: 1, checkIn: 1, checkOut: 1 });
reservationSchema.index({ hotelId: 1, guestId: 1, createdAt: -1 });
reservationSchema.index({ roomId: 1, checkIn: 1, checkOut: 1, status: 1 });

const staySchema = new Schema<StayDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  reservationId: { type: Schema.Types.ObjectId, ref: 'Reservation', required: true, unique: true },
  guestId: { type: Schema.Types.ObjectId, ref: 'Guest', required: true },
  roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
  checkInAt: { type: Date, required: true },
  expectedCheckOut: { type: Date, required: true },
  actualCheckOut: Date,
  status: { type: String, enum: Object.values(StayStatus), default: StayStatus.ACTIVE },
  openedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  qrTokenHash: String,
  notes: String,
}, { timestamps: true });
staySchema.index({ hotelId: 1, status: 1 });
staySchema.index({ hotelId: 1, roomId: 1, status: 1 });

const paymentSchema = new Schema<PaymentDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  reservationId: { type: Schema.Types.ObjectId, ref: 'Reservation', index: true },
  stayId: { type: Schema.Types.ObjectId, ref: 'Stay', index: true },
  guestId: { type: Schema.Types.ObjectId, ref: 'Guest' },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
  amount: { type: Number, required: true, min: 0 },
  method: { type: String, enum: Object.values(PaymentMethod), required: true },
  status: { type: String, enum: Object.values(PaymentStatus), required: true, index: true },
  currency: { type: String, required: true },
  provider: String,
  providerPaymentId: String,
  providerOrderId: String,
  paidAt: Date,
  failedAt: Date,
  failureReason: String,
  refundAmount: { type: Number, default: 0, min: 0 },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  notes: String,
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });
paymentSchema.index({ hotelId: 1, createdAt: -1 });
paymentSchema.index({ providerPaymentId: 1 }, { sparse: true });

const invoiceSchema = new Schema<InvoiceDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  invoiceNumber: { type: String, required: true, unique: true, index: true },
  reservationId: { type: Schema.Types.ObjectId, ref: 'Reservation', index: true },
  stayId: { type: Schema.Types.ObjectId, ref: 'Stay', index: true },
  guestId: { type: Schema.Types.ObjectId, ref: 'Guest', required: true },
  items: { type: [Schema.Types.ObjectId], ref: 'InvoiceItem', default: [] },
  roomSubtotal: { type: Number, required: true, min: 0 },
  servicesSubtotal: { type: Number, required: true, min: 0 },
  subtotal: { type: Number, required: true, min: 0 },
  tax: { type: Number, required: true, min: 0 },
  discount: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  amountPaid: { type: Number, required: true, min: 0 },
  balance: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true },
  status: { type: String, enum: Object.values(InvoiceStatus), default: InvoiceStatus.DRAFT },
  issuedAt: Date,
  finalisedAt: Date,
  notes: String,
}, { timestamps: true });
invoiceSchema.index({ hotelId: 1, createdAt: -1 });

const invoiceItemSchema = new Schema<InvoiceItemDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
  reservationId: { type: Schema.Types.ObjectId, ref: 'Reservation' },
  stayId: { type: Schema.Types.ObjectId, ref: 'Stay' },
  type: { type: String, required: true },
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0.01 },
  unitPrice: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  taxAmount: { type: Number, required: true, min: 0 },
  serviceDate: Date,
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

const housekeepingTaskSchema = new Schema<HousekeepingTaskDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  type: { type: String, required: true },
  status: { type: String, enum: Object.values(TaskStatus), default: TaskStatus.PENDING },
  priority: { type: String, default: 'normal' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  dueAt: Date,
  source: { type: String, default: 'manual' },
  reservationId: { type: Schema.Types.ObjectId, ref: 'Reservation' },
  notes: String,
  startedAt: Date,
  completedAt: Date,
  inspectedAt: Date,
  inspectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
housekeepingTaskSchema.index({ hotelId: 1, status: 1, createdAt: -1 });

const maintenanceRequestSchema = new Schema<MaintenanceRequestDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  roomId: { type: Schema.Types.ObjectId, ref: 'Room', index: true },
  issue: { type: String, required: true },
  description: { type: String, required: true },
  priority: { type: String, default: 'normal' },
  status: { type: String, enum: Object.values(MaintenanceStatus), default: MaintenanceStatus.OPEN },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: Date,
  closedAt: Date,
  resolutionNotes: String,
}, { timestamps: true });
maintenanceRequestSchema.index({ hotelId: 1, status: 1, createdAt: -1 });

const serviceRequestSchema = new Schema<ServiceRequestDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  stayId: { type: Schema.Types.ObjectId, ref: 'Stay', index: true },
  reservationId: { type: Schema.Types.ObjectId, ref: 'Reservation' },
  roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
  guestId: { type: Schema.Types.ObjectId, ref: 'Guest' },
  category: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: Object.values(ServiceStatus), default: ServiceStatus.PENDING },
  priority: { type: String, default: 'normal' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  chargeAmount: { type: Number, default: 0, min: 0 },
  fulfilledAt: Date,
  notes: String,
}, { timestamps: true });

const restaurantTableSchema = new Schema<RestaurantTableDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  name: { type: String, required: true },
  capacity: { type: Number, required: true, min: 1 },
  status: { type: String, default: 'available' },
  active: { type: Boolean, default: true },
}, { timestamps: true });
restaurantTableSchema.index({ hotelId: 1, name: 1 }, { unique: true });

const menuCategorySchema = new Schema<MenuCategoryDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  name: { type: String, required: true },
  description: String,
  sortOrder: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });
menuCategorySchema.index({ hotelId: 1, name: 1 }, { unique: true });

const menuItemSchema = new Schema<MenuItemDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'MenuCategory', required: true },
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true, min: 0 },
  taxRate: { type: Number, default: 0, min: 0 },
  available: { type: Boolean, default: true },
  imageUrl: String,
}, { timestamps: true });
menuItemSchema.index({ hotelId: 1, categoryId: 1, name: 1 });

const orderItemSchema = new Schema<OrderItem>({
  menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  taxRate: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  notes: String,
}, { _id: false });

const orderSchema = new Schema<OrderDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  orderNumber: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  status: { type: String, enum: Object.values(OrderStatus), default: OrderStatus.PENDING },
  tableId: { type: Schema.Types.ObjectId, ref: 'RestaurantTable' },
  roomId: { type: Schema.Types.ObjectId, ref: 'Room' },
  stayId: { type: Schema.Types.ObjectId, ref: 'Stay' },
  guestId: { type: Schema.Types.ObjectId, ref: 'Guest' },
  items: { type: [orderItemSchema], default: [] },
  subtotal: { type: Number, required: true, min: 0 },
  tax: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
  placedAt: { type: Date, default: Date.now },
  deliveredAt: Date,
  notes: String,
}, { timestamps: true });
orderSchema.index({ hotelId: 1, status: 1, placedAt: -1 });

const inventoryItemSchema = new Schema<InventoryItemDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  name: { type: String, required: true },
  sku: { type: String, required: true, uppercase: true, trim: true },
  category: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  minimumStock: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true },
  purchasePrice: { type: Number, required: true, min: 0 },
  supplier: String,
  active: { type: Boolean, default: true },
}, { timestamps: true });
inventoryItemSchema.index({ hotelId: 1, sku: 1 }, { unique: true });

const inventoryTransactionSchema = new Schema<InventoryTransactionDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  itemId: { type: Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
  type: { type: String, required: true },
  quantity: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  unitCost: { type: Number, min: 0 },
  referenceType: String,
  referenceId: { type: Schema.Types.ObjectId },
  notes: String,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const expenseSchema = new Schema<ExpenseDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true, index: true },
  paymentMethod: { type: String, enum: Object.values(PaymentMethod), required: true },
  description: { type: String, required: true },
  receiptUrl: String,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
expenseSchema.index({ hotelId: 1, date: -1 });

const notificationSchema = new Schema<NotificationDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  guestId: { type: Schema.Types.ObjectId, ref: 'Guest' },
  channel: { type: String, enum: Object.values(NotificationChannel), required: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: Object.values(NotificationStatus), default: NotificationStatus.PENDING },
  readAt: Date,
  sentAt: Date,
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });
notificationSchema.index({ hotelId: 1, createdAt: -1 });

const auditLogSchema = new Schema<AuditLogDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  action: { type: String, required: true, index: true },
  entity: { type: String, required: true },
  entityId: { type: Schema.Types.ObjectId, index: true },
  oldValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  ipAddress: String,
  userAgent: String,
  requestId: String,
}, { timestamps: true });
auditLogSchema.index({ hotelId: 1, createdAt: -1 });

const websiteContentSchema = new Schema<WebsiteContentDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, unique: true },
  home: {
    eyebrow: String,
    title: String,
    subtitle: String,
    primaryCta: String,
    secondaryCta: String,
  },
  about: String,
  whyChooseUs: [{
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: String,
  }],
  location: {
    label: String,
    address: String,
    mapUrl: String,
  },
  contact: contactSchema,
  footerText: String,
  socialLinks: { type: Schema.Types.Mixed },
  published: { type: Boolean, default: false },
}, { timestamps: true });

const offerSchema = new Schema<OfferDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  code: String,
  discountType: { type: String, default: 'percentage' },
  discountValue: { type: Number, required: true, min: 0 },
  minNights: { type: Number, min: 0 },
  validFrom: { type: Date, required: true },
  validTo: { type: Date, required: true },
  active: { type: Boolean, default: true },
  terms: String,
}, { timestamps: true });
offerSchema.index({ hotelId: 1, active: 1, validFrom: 1, validTo: 1 });

const galleryImageSchema = new Schema<GalleryImageDocument>({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  publicId: { type: String, required: true },
  url: { type: String, required: true },
  alt: { type: String, required: true },
  category: String,
  sortOrder: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export const User = model<UserDocument>('User', userSchema);
export const Hotel = model<HotelDocument>('Hotel', hotelSchema);
export const RoomType = model<RoomTypeDocument>('RoomType', roomTypeSchema);
export const RoomRate = model<RoomRateDocument>('RoomRate', roomRateSchema);
export const Room = model<RoomDocument>('Room', roomSchema);
export const Guest = model<GuestDocument>('Guest', guestSchema);
export const Reservation = model<ReservationDocument>('Reservation', reservationSchema);
export const Stay = model<StayDocument>('Stay', staySchema);
export const Payment = model<PaymentDocument>('Payment', paymentSchema);
export const Invoice = model<InvoiceDocument>('Invoice', invoiceSchema);
export const InvoiceItem = model<InvoiceItemDocument>('InvoiceItem', invoiceItemSchema);
export const HousekeepingTask = model<HousekeepingTaskDocument>('HousekeepingTask', housekeepingTaskSchema);
export const MaintenanceRequest = model<MaintenanceRequestDocument>('MaintenanceRequest', maintenanceRequestSchema);
export const ServiceRequest = model<ServiceRequestDocument>('ServiceRequest', serviceRequestSchema);
export const RestaurantTable = model<RestaurantTableDocument>('RestaurantTable', restaurantTableSchema);
export const MenuCategory = model<MenuCategoryDocument>('MenuCategory', menuCategorySchema);
export const MenuItem = model<MenuItemDocument>('MenuItem', menuItemSchema);
export const Order = model<OrderDocument>('Order', orderSchema);
export const InventoryItem = model<InventoryItemDocument>('InventoryItem', inventoryItemSchema);
export const InventoryTransaction = model<InventoryTransactionDocument>('InventoryTransaction', inventoryTransactionSchema);
export const Expense = model<ExpenseDocument>('Expense', expenseSchema);
export const Notification = model<NotificationDocument>('Notification', notificationSchema);
export const AuditLog = model<AuditLogDocument>('AuditLog', auditLogSchema);
export const WebsiteContent = model<WebsiteContentDocument>('WebsiteContent', websiteContentSchema);
export const Offer = model<OfferDocument>('Offer', offerSchema);
export const GalleryImage = model<GalleryImageDocument>('GalleryImage', galleryImageSchema);
