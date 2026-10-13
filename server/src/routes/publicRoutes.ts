import { Router } from 'express';
import { publicBookingLimiter, publicContactLimiter } from '../middleware/rateLimit.js';
import {
  checkPublicAvailability,
  createPublicBooking,
  submitContactEnquiry,
  getPublicFacilities,
  getPublicGallery,
  getPublicHotel,
  getPublicOffers,
  getPublicRoom,
  getPublicRooms,
  lookupPublicBooking,
  getGuestPortal,
  createGuestPortalServiceRequest,
  getPublicQuote,
  confirmPublicPayment,
} from '../controllers/publicController.js';

export const publicRouter = Router();
publicRouter.get('/hotel', getPublicHotel);
publicRouter.get('/rooms', getPublicRooms);
publicRouter.get('/rooms/:id', getPublicRoom);
publicRouter.post('/availability', checkPublicAvailability);
publicRouter.get('/offers', getPublicOffers);
publicRouter.get('/facilities', getPublicFacilities);
publicRouter.get('/gallery', getPublicGallery);
publicRouter.post('/contact', publicContactLimiter, submitContactEnquiry);
publicRouter.post('/quote', getPublicQuote);
publicRouter.post('/bookings', publicBookingLimiter, createPublicBooking);
publicRouter.post('/payments/confirm', publicBookingLimiter, confirmPublicPayment);
publicRouter.post('/bookings/lookup', publicBookingLimiter, lookupPublicBooking);
publicRouter.get('/guest-portal/:token', getGuestPortal);
publicRouter.post('/guest-portal/:token/services', publicBookingLimiter, createGuestPortalServiceRequest);
