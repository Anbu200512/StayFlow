import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { hashPassword } from '../src/utils/password.js';
import {
  Expense,
  GalleryImage,
  Guest,
  Hotel,
  HousekeepingTask,
  InventoryItem,
  InventoryTransaction,
  Invoice,
  InvoiceItem,
  MaintenanceRequest,
  MenuCategory,
  MenuItem,
  Notification,
  Offer,
  Order,
  Payment,
  Reservation,
  RestaurantTable,
  Room,
  RoomType,
  ServiceRequest,
  Stay,
  User,
  WebsiteContent,
  AuditLog,
} from '../src/models/index.js';
import { UserRole, RoomStatus, PaymentMethod } from '../src/types/enums.js';
import { createReservation } from '../src/services/reservationService.js';
import { ReservationSource } from '../src/types/enums.js';

const roomImages = [
  'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1400&q=85',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1400&q=85',
  'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=85',
  'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1400&q=85',
];

async function clear() {
  await Promise.all([
    AuditLog.deleteMany({}), Notification.deleteMany({}), ServiceRequest.deleteMany({}), Order.deleteMany({}), MenuItem.deleteMany({}), MenuCategory.deleteMany({}), RestaurantTable.deleteMany({}), InventoryTransaction.deleteMany({}), InventoryItem.deleteMany({}), Expense.deleteMany({}), MaintenanceRequest.deleteMany({}), HousekeepingTask.deleteMany({}), InvoiceItem.deleteMany({}), Invoice.deleteMany({}), Payment.deleteMany({}), Stay.deleteMany({}), Reservation.deleteMany({}), Guest.deleteMany({}), Room.deleteMany({}), RoomType.deleteMany({}), GalleryImage.deleteMany({}), Offer.deleteMany({}), WebsiteContent.deleteMany({}), User.deleteMany({}), Hotel.deleteMany({}),
  ]);
}

async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed a production database');
  await connectDatabase();
  await clear();
  const hotel = await Hotel.create({
    name: 'The Alder House',
    slug: 'the-alder-house',
    description: 'A quiet, considered stay in the heart of the city.',
    contact: { phone: '+91 98765 43210', email: 'hello@alderhouse.example', website: 'https://stayflow.example' },
    address: { line1: '18 Park Street', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001', country: 'India' },
    timezone: 'Asia/Kolkata', currency: 'INR', checkInTime: '14:00', checkOutTime: '11:00', taxRate: 10,
    heroImageUrl: roomImages[0], active: true,
  });
  const passwordHash = await hashPassword('StayFlow!2026');
  const users = await User.create([
    { hotelId: hotel._id, name: 'Aarav Mehta', email: 'owner@stayflow.local', passwordHash, role: UserRole.OWNER, active: true, refreshTokens: [] },
    { hotelId: hotel._id, name: 'Maya Iyer', email: 'manager@stayflow.local', passwordHash, role: UserRole.MANAGER, active: true, refreshTokens: [] },
    { hotelId: hotel._id, name: 'Rohan Das', email: 'reception@stayflow.local', passwordHash, role: UserRole.RECEPTIONIST, active: true, refreshTokens: [] },
    { hotelId: hotel._id, name: 'Nisha Rao', email: 'housekeeping@stayflow.local', passwordHash, role: UserRole.HOUSEKEEPING, active: true, refreshTokens: [] },
    { hotelId: hotel._id, name: 'Dev Kapoor', email: 'restaurant@stayflow.local', passwordHash, role: UserRole.RESTAURANT, active: true, refreshTokens: [] },
    { hotelId: hotel._id, name: 'Kiran Shah', email: 'maintenance@stayflow.local', passwordHash, role: UserRole.MAINTENANCE, active: true, refreshTokens: [] },
    { hotelId: hotel._id, name: 'Anita Sen', email: 'accounts@stayflow.local', passwordHash, role: UserRole.ACCOUNTANT, active: true, refreshTokens: [] },
  ]);
  const roomTypes = await RoomType.create([
    { hotelId: hotel._id, name: 'Garden King', slug: 'garden-king', description: 'A calm king room opening onto a private green courtyard.', basePrice: 4200, currency: 'INR', maxAdults: 2, maxChildren: 1, maxOccupancy: 3, bedConfiguration: '1 king bed', sizeSqm: 32, amenities: ['King bed', 'Courtyard view', 'Rain shower', 'Workspace', 'Smart TV'], images: [{ publicId: 'seed/garden-king', url: roomImages[1] }], totalRooms: 6, active: true },
    { hotelId: hotel._id, name: 'Deluxe Room', slug: 'deluxe-room', description: 'A generous deluxe room with considered work and rest zones.', basePrice: 5200, currency: 'INR', maxAdults: 2, maxChildren: 2, maxOccupancy: 4, bedConfiguration: '1 queen bed', sizeSqm: 38, amenities: ['Queen bed', 'City view', 'Rain shower', 'Work desk', 'Smart TV'], images: [{ publicId: 'seed/deluxe', url: roomImages[2] }], totalRooms: 6, active: true },
    { hotelId: hotel._id, name: 'Alder Suite', slug: 'alder-suite', description: 'A spacious suite for slow mornings and longer stays.', basePrice: 7800, currency: 'INR', maxAdults: 2, maxChildren: 2, maxOccupancy: 4, bedConfiguration: '1 king bed and sofa bed', sizeSqm: 52, amenities: ['Separate lounge', 'King bed', 'Bathtub', 'Dining for four', 'Smart TV'], images: [{ publicId: 'seed/alder-suite', url: roomImages[3] }], totalRooms: 6, active: true },
    { hotelId: hotel._id, name: 'Courtyard Twin', slug: 'courtyard-twin', description: 'A bright twin room designed for friends and family.', basePrice: 4600, currency: 'INR', maxAdults: 2, maxChildren: 2, maxOccupancy: 4, bedConfiguration: '2 twin beds', sizeSqm: 34, amenities: ['Twin beds', 'Courtyard view', 'Rain shower', 'Smart TV'], images: [{ publicId: 'seed/courtyard-twin', url: roomImages[0] }], totalRooms: 6, active: true },
  ]);
  const rooms = [];
  for (let floor = 1; floor <= 4; floor += 1) {
    for (let index = 1; index <= 6; index += 1) {
      const roomType = roomTypes[(index - 1) % roomTypes.length];
      rooms.push(await Room.create({ hotelId: hotel._id, roomTypeId: roomType._id, roomNumber: `${floor}${String(index).padStart(2, '0')}`, floor, status: RoomStatus.AVAILABLE, statusUpdatedAt: new Date(), features: roomType.amenities.slice(0, 2), reservedIntervals: [] }));
    }
  }
  await WebsiteContent.create({ hotelId: hotel._id, home: { eyebrow: 'A quieter kind of city stay', title: 'Luxury. Comfort. Your Stay.', subtitle: 'Thoughtful rooms, warm service, and space to settle into the city.', primaryCta: 'Check availability', secondaryCta: 'Explore the house' }, about: 'The Alder House is an independent city hotel built around the idea that a good stay should feel effortless.', whyChooseUs: [{ title: 'Considered comfort', description: 'Every room is designed around rest, work, and the small details that make a difference.', icon: 'sparkles' }, { title: 'Genuine welcome', description: 'Our team knows the city and shares the places worth your time.', icon: 'heart' }, { title: 'Quietly connected', description: 'Fast Wi-Fi, thoughtful work spaces, and everything you need close by.', icon: 'wifi' }], location: { label: 'Bengaluru, India', address: hotel.address.line1, mapUrl: 'https://maps.google.com/?q=Park+Street+Bengaluru' }, contact: hotel.contact, footerText: 'Stay well at The Alder House.', published: true });
  await Offer.create([{ hotelId: hotel._id, title: 'Stay a little longer', description: 'Save 15% when you reserve three nights or more.', code: 'LONGSTAY15', discountType: 'percentage', discountValue: 15, minNights: 3, validFrom: new Date(Date.now() - 86400000), validTo: new Date(Date.now() + 90 * 86400000), active: true }, { hotelId: hotel._id, title: 'A quiet arrival', description: 'Complimentary breakfast on stays booked direct.', code: 'DIRECT', discountType: 'fixed', discountValue: 450, minNights: 1, validFrom: new Date(Date.now() - 86400000), validTo: new Date(Date.now() + 90 * 86400000), active: true }]);
  await GalleryImage.create(roomImages.map((url, index) => ({ hotelId: hotel._id, publicId: `seed/gallery-${index}`, url, alt: ['A calm hotel lounge', 'A bright guest room', 'A considered bedroom', 'A spacious suite'][index], category: 'hotel', sortOrder: index, active: true })));
  const categories = await MenuCategory.create([{ hotelId: hotel._id, name: 'All-day dining', description: 'Bright plates and familiar flavours.', sortOrder: 1, active: true }, { hotelId: hotel._id, name: 'Drinks', description: 'House-made refreshments.', sortOrder: 2, active: true }]);
  const menuItems = await MenuItem.create([{ hotelId: hotel._id, categoryId: categories[0]._id, name: 'Garden breakfast', description: 'Seasonal fruit, warm bread, eggs and coffee.', price: 650, taxRate: 5, available: true }, { hotelId: hotel._id, categoryId: categories[0]._id, name: 'Coconut lentil bowl', description: 'Slow-cooked lentils, rice, greens and pickles.', price: 720, taxRate: 5, available: true }, { hotelId: hotel._id, categoryId: categories[0]._id, name: 'Tandoori chicken', description: 'Charred chicken, mint chutney and pickled onions.', price: 980, taxRate: 5, available: true }, { hotelId: hotel._id, categoryId: categories[1]._id, name: 'Filter coffee', description: 'South Indian filter coffee.', price: 220, taxRate: 5, available: true }, { hotelId: hotel._id, categoryId: categories[1]._id, name: 'Cucumber cooler', description: 'Cucumber, lime and mint.', price: 280, taxRate: 5, available: true }]);
  await RestaurantTable.create([{ hotelId: hotel._id, name: 'Table 1', capacity: 2, status: 'available', active: true }, { hotelId: hotel._id, name: 'Table 2', capacity: 4, status: 'available', active: true }, { hotelId: hotel._id, name: 'Table 3', capacity: 6, status: 'available', active: true }, { hotelId: hotel._id, name: 'Table 4', capacity: 4, status: 'available', active: true }]);
  await InventoryItem.create([{ hotelId: hotel._id, name: 'Bath towels', sku: 'LINEN-TOWEL-01', category: 'Linen', quantity: 42, minimumStock: 25, unit: 'pieces', purchasePrice: 280, supplier: 'Aster Textiles', active: true }, { hotelId: hotel._id, name: 'Bottled water', sku: 'PANTRY-WATER-500', category: 'Beverages', quantity: 18, minimumStock: 24, unit: 'bottles', purchasePrice: 20, supplier: 'Aqua Source', active: true }, { hotelId: hotel._id, name: 'Bathroom amenities', sku: 'TOILET-KIT-01', category: 'Toiletries', quantity: 65, minimumStock: 30, unit: 'kits', purchasePrice: 95, supplier: 'Aroma House', active: true }]);
  await Expense.create({ hotelId: hotel._id, category: 'Electricity', amount: 18400, date: new Date(), paymentMethod: PaymentMethod.BANK_TRANSFER, description: 'Monthly electricity bill', createdBy: users[6]._id });
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 2);
  await createReservation({ hotelId: hotel._id.toString(), roomId: rooms[0]._id.toString(), checkIn: tomorrow, checkOut: dayAfter, adults: 2, children: 0, source: ReservationSource.WEBSITE, guest: { fullName: 'Ananya Sharma', mobile: '+919812345670', email: 'ananya@example.com', privacyConsent: true }, paymentMethod: PaymentMethod.UPI, advanceAmount: 3000 });
  await createReservation({ hotelId: hotel._id.toString(), roomId: rooms[6]._id.toString(), checkIn: tomorrow, checkOut: dayAfter, adults: 1, children: 0, source: ReservationSource.PHONE, guest: { fullName: 'Vikram Joshi', mobile: '+919812345671', email: 'vikram@example.com', privacyConsent: true }, paymentMethod: PaymentMethod.CASH, advanceAmount: 2500, createdBy: users[2]._id.toString() });
  await createReservation({ hotelId: hotel._id.toString(), roomId: rooms[12]._id.toString(), checkIn: new Date(Date.now() + 3 * 86400000), checkOut: new Date(Date.now() + 6 * 86400000), adults: 2, children: 1, source: ReservationSource.WALK_IN, guest: { fullName: 'Meera Nair', mobile: '+919812345672', email: 'meera@example.com', privacyConsent: true }, paymentMethod: PaymentMethod.CARD, advanceAmount: 5000, createdBy: users[2]._id.toString() });
  console.info(`Seeded ${hotel.name}`);
  console.info('Development logins: owner@stayflow.local, manager@stayflow.local, reception@stayflow.local, housekeeping@stayflow.local, restaurant@stayflow.local, maintenance@stayflow.local, accounts@stayflow.local');
  console.info('Development password: StayFlow!2026');
  console.info(`Created ${rooms.length} rooms, ${roomTypes.length} room types, ${menuItems.length} menu items`);
}

seed().then(async () => { await disconnectDatabase(); process.exit(0); }).catch(async (error) => { console.error(error); await disconnectDatabase(); process.exit(1); });
