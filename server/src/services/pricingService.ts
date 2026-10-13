import { Hotel, Offer, RoomType, type HotelDocument, type RoomTypeDocument } from '../models/index.js';
import { AppError } from '../utils/error.js';
import { calculateNights, roundMoney } from '../utils/common.js';
import { eachCalendarDay, resolveNightlyRate } from './rateService.js';
import type { MoneyBreakdown, SelectedService } from '../types/domain.js';

export const serviceCatalog = [
  { code: 'breakfast', name: 'Breakfast', unitPrice: 450 },
  { code: 'airport_transfer', name: 'Airport transfer', unitPrice: 1200 },
  { code: 'extra_bed', name: 'Extra bed', unitPrice: 1000 },
  { code: 'late_checkout', name: 'Late checkout', unitPrice: 1500 },
  { code: 'laundry', name: 'Laundry', unitPrice: 300 },
  { code: 'water', name: 'Bottled water', unitPrice: 100 },
] as const;

export interface ServiceSelectionInput {
  code: string;
  quantity?: number;
  notes?: string;
}

export async function calculateAuthoritativePrice(input: {
  hotelId: string;
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
  services?: ServiceSelectionInput[];
  offerCode?: string;
}): Promise<{ pricing: MoneyBreakdown; selectedServices: SelectedService[]; roomType: RoomTypeDocument; hotel: HotelDocument }> {
  const [roomType, hotel] = await Promise.all([
    RoomType.findOne({ _id: input.roomTypeId, hotelId: input.hotelId, active: true }),
    Hotel.findOne({ _id: input.hotelId, active: true }),
  ]);
  if (!roomType) throw new AppError('Room type not found', 404, 'ROOM_TYPE_NOT_FOUND');
  if (!hotel) throw new AppError('Hotel not found', 404, 'HOTEL_NOT_FOUND');
  const nights = calculateNights(input.checkIn, input.checkOut);
  let roomSubtotal = 0;
  for (const day of eachCalendarDay(input.checkIn, input.checkOut)) {
    const nightlyRate = await resolveNightlyRate(input.hotelId, input.roomTypeId, day);
    roomSubtotal = roundMoney(roomSubtotal + (nightlyRate ?? roomType.basePrice));
  }
  const selectedServices: SelectedService[] = (input.services ?? []).map((selection) => {
    const catalogItem = serviceCatalog.find((item) => item.code === selection.code);
    if (!catalogItem) throw new AppError(`Service ${selection.code} is not available`, 400, 'INVALID_SERVICE');
    const quantity = Math.max(1, Math.min(20, selection.quantity ?? 1));
    const unitPrice = catalogItem.unitPrice;
    return { code: catalogItem.code, name: catalogItem.name, quantity, unitPrice, total: roundMoney(unitPrice * quantity), notes: selection.notes };
  });
  const servicesSubtotal = roundMoney(selectedServices.reduce((sum, service) => sum + service.total, 0));
  let discount = 0;
  if (input.offerCode) {
    const offer = await Offer.findOne({ hotelId: input.hotelId, code: input.offerCode.toUpperCase(), active: true, validFrom: { $lte: input.checkIn }, validTo: { $gte: input.checkOut } });
    if (!offer || (offer.minNights ?? 0) > nights) throw new AppError('Offer code is not valid for this stay', 400, 'INVALID_OFFER');
    discount = offer.discountType === 'fixed' ? offer.discountValue : roundMoney((roomSubtotal + servicesSubtotal) * offer.discountValue / 100);
  }
  discount = roundMoney(Math.min(discount, roomSubtotal + servicesSubtotal));
  const subtotal = roundMoney(roomSubtotal + servicesSubtotal - discount);
  const tax = roundMoney(subtotal * hotel.taxRate / 100);
  const total = roundMoney(subtotal + tax);
  return {
    pricing: { roomSubtotal, servicesSubtotal, subtotal, tax, discount, total, currency: hotel.currency },
    selectedServices,
    roomType,
    hotel,
  };
}
