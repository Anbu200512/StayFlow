import { Notification } from '../models/index.js';
import { NotificationChannel, NotificationStatus } from '../types/enums.js';
import { sendEmail } from '../utils/email.js';
import { emitHotelEvent, emitUserEvent } from './socketService.js';

export interface NotificationInput {
  hotelId: string;
  userId?: string;
  guestId?: string;
  guestEmail?: string;
  channel?: NotificationChannel;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(input: NotificationInput) {
  const channel = input.channel ?? NotificationChannel.IN_APP;
  const [notification] = await Notification.create([{
    hotelId: input.hotelId,
    userId: input.userId,
    guestId: input.guestId,
    channel,
    type: input.type,
    title: input.title,
    message: input.message,
    metadata: input.metadata,
    status: NotificationStatus.PENDING,
  }]);
  if (channel === NotificationChannel.IN_APP) {
    notification.status = NotificationStatus.SENT;
    notification.sentAt = new Date();
    await notification.save();
    if (input.userId) emitUserEvent(input.userId, 'notification.created', notification.toObject());
    else emitHotelEvent(input.hotelId, 'notification.created', notification.toObject());
  }
  if (channel === NotificationChannel.EMAIL && input.guestEmail) {
    try {
      await sendEmail({ to: input.guestEmail, subject: input.title, text: input.message });
      notification.status = NotificationStatus.SENT;
      notification.sentAt = new Date();
      await notification.save();
    } catch (error) {
      notification.status = NotificationStatus.FAILED;
      await notification.save();
      console.error('Notification delivery failed', error);
    }
  }
  return notification;
}

export async function createBookingNotifications(input: { hotelId: string; reservationId: string; bookingNumber: string; guestId: string; guestEmail?: string; checkIn: Date; roomName?: string }) {
  await Promise.allSettled([
    createNotification({ hotelId: input.hotelId, type: 'reservation.created', title: 'New reservation', message: `${input.bookingNumber} received for ${input.roomName ?? 'a room'}.` }),
    createNotification({ hotelId: input.hotelId, guestId: input.guestId, guestEmail: input.guestEmail, channel: NotificationChannel.EMAIL, type: 'booking.confirmation', title: 'Booking received', message: `Your StayFlow booking ${input.bookingNumber} is confirmed.` }),
  ]);
}
