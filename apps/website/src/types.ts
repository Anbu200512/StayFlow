export interface ContactDetails {
  phone: string;
  email: string;
  website?: string;
}

export interface Hotel {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  contact: ContactDetails;
  address: { line1: string; line2?: string; city: string; state?: string; postalCode?: string; country: string };
  timezone: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  taxRate: number;
  logoUrl?: string;
  heroImageUrl?: string;
  policies?: Record<string, string>;
  socialLinks?: Record<string, string>;
}

export interface WebsiteContent {
  _id?: string;
  home?: { eyebrow?: string; title?: string; subtitle?: string; primaryCta?: string; secondaryCta?: string };
  about?: string;
  whyChooseUs?: { title: string; description: string; icon?: string }[];
  location?: { label?: string; address?: string; mapUrl?: string };
  contact?: ContactDetails;
  footerText?: string;
  socialLinks?: Record<string, string>;
}

export interface RoomType {
  _id: string;
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
  images: { publicId: string; url: string; alt?: string }[];
}

export interface NightlyRate {
  nights: number;
  total: number;
  min: number;
  max: number;
  average: number;
}

export interface Room {
  _id: string;
  id?: string;
  roomNumber: string;
  floor: number;
  status: string;
  features: string[];
  roomType: RoomType;
  nightlyRate?: NightlyRate;
}

export interface Offer {
  _id: string;
  title: string;
  description: string;
  code?: string;
  discountType: string;
  discountValue: number;
  minNights?: number;
  validFrom: string;
  validTo: string;
  terms?: string;
}

export interface GalleryImage {
  _id: string;
  publicId: string;
  url: string;
  alt: string;
  category?: string;
}

export interface HotelPayload {
  hotel: Hotel;
  content?: WebsiteContent;
  offers: Offer[];
  gallery: GalleryImage[];
  amenities: string[];
  serviceCatalog: { code: string; name: string; unitPrice: number }[];
}

export interface AvailabilityQuery {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomTypeId?: string;
}

export interface BookingGuest {
  fullName: string;
  mobile: string;
  email?: string;
  address?: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
  privacyConsent: boolean;
  marketingConsent: boolean;
}

export interface Pricing {
  roomSubtotal: number;
  servicesSubtotal: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
}

export interface Reservation {
  _id: string;
  bookingNumber: string;
  status: string;
  source: string;
  checkIn: string;
  checkOut: string;
  guests: { adults: number; children: number };
  nights: number;
  pricing: Pricing;
  services: { code: string; name: string; quantity: number; unitPrice: number; total: number }[];
  guestSnapshot: { fullName: string; mobile: string; email?: string };
  roomTypeId: RoomType;
}

export interface GuestPortal {
  stay: { id: string; checkInAt: string; expectedCheckOut: string; status: string };
  room: { _id: string; roomNumber: string; floor: number };
  guest: { name?: string };
}
