import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import AboutPage from './pages/AboutPage';
import BookingPage from './pages/BookingPage';
import ConfirmationPage from './pages/ConfirmationPage';
import ContactPage from './pages/ContactPage';
import FacilitiesPage from './pages/FacilitiesPage';
import GalleryPage from './pages/GalleryPage';
import GuestPortalPage from './pages/GuestPortalPage';
import HomePage from './pages/HomePage';
import MyBookingPage from './pages/MyBookingPage';
import NotFoundPage from './pages/NotFoundPage';
import OffersPage from './pages/OffersPage';
import RoomDetailPage from './pages/RoomDetailPage';
import RoomsPage from './pages/RoomsPage';

export default function App() { return <Routes><Route element={<Layout />}><Route path="/" element={<HomePage />} /><Route path="/rooms" element={<RoomsPage />} /><Route path="/rooms/:id" element={<RoomDetailPage />} /><Route path="/booking" element={<BookingPage />} /><Route path="/confirmation/:bookingNumber" element={<ConfirmationPage />} /><Route path="/offers" element={<OffersPage />} /><Route path="/facilities" element={<FacilitiesPage />} /><Route path="/gallery" element={<GalleryPage />} /><Route path="/about" element={<AboutPage />} /><Route path="/contact" element={<ContactPage />} /><Route path="/my-booking" element={<MyBookingPage />} /><Route path="*" element={<NotFoundPage />} /></Route><Route path="/guest/:token" element={<GuestPortalPage />} /></Routes>; }
