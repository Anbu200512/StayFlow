import { lazy, Suspense } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './components/Layout';
import { ProtectedRoute, RequireRole } from './components/ProtectedRoute';
import { useAuthStore } from './store/authStore';
import type { UserRole } from './types';

const BillingPage = lazy(() => import('./pages/BillingPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const FrontDeskPage = lazy(() => import('./pages/FrontDeskPage'));
const GuestDetailPage = lazy(() => import('./pages/GuestDetailPage'));
const GuestsPage = lazy(() => import('./pages/GuestsPage'));
const HousekeepingPage = lazy(() => import('./pages/OperationsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const OverviewPage = lazy(() => import('./pages/OverviewPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const ReservationsPage = lazy(() => import('./pages/ReservationsPage'));
const RatesPage = lazy(() => import('./pages/RatesPage'));
const RestaurantPage = lazy(() => import('./pages/RestaurantPage'));
const RoomsPage = lazy(() => import('./pages/RoomsPage'));
const WebsitePage = lazy(() => import('./pages/WebsitePage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));

const frontDesk: UserRole[] = ['owner', 'manager', 'receptionist', 'accountant'];
const management: UserRole[] = ['owner', 'manager'];
const kitchen: UserRole[] = ['owner', 'manager', 'receptionist', 'restaurant'];
const allRoles: UserRole[] = ['owner', 'manager', 'receptionist', 'accountant', 'housekeeping', 'maintenance', 'restaurant'];

function RoleHome() {
  const user = useAuthStore((state) => state.user);
  if (!user) return null;
  if (user.role === 'restaurant') return <Navigate to="/restaurant" replace />;
  if (user.role === 'housekeeping' || user.role === 'maintenance') return <Navigate to="/housekeeping" replace />;
  return <OverviewPage />;
}

function NotFoundPage() {
  return <div className="flex min-h-[70vh] flex-col items-center justify-center text-center"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest/60">404</p><h1 className="mt-3 font-display text-5xl">That page is elsewhere.</h1><p className="mt-3 max-w-md text-sm leading-6 text-ink/50">The address may have changed, or your role may not have access to it.</p><a href="/" className="dashboard-button mt-6">Back to dashboard</a></div>;
}

function RouteFallback() {
  return <div className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-ink/50"><LoaderCircle size={19} className="animate-spin text-forest" />Loading workspace</div>;
}

export default function App() {
  return <Suspense fallback={<RouteFallback />}><Routes><Route path="/login" element={<LoginPage />} /><Route path="/forgot-password" element={<ForgotPasswordPage />} /><Route path="/reset-password" element={<ResetPasswordPage />} /><Route element={<ProtectedRoute />}><Route element={<DashboardLayout />}><Route index element={<RoleHome />} /><Route path="reservations" element={<RequireRole roles={frontDesk}><ReservationsPage /></RequireRole>} /><Route path="calendar" element={<RequireRole roles={frontDesk}><CalendarPage /></RequireRole>} /><Route path="rooms" element={<RequireRole roles={[...frontDesk, 'housekeeping', 'maintenance']}><RoomsPage /></RequireRole>} /><Route path="guests" element={<RequireRole roles={frontDesk}><GuestsPage /></RequireRole>} /><Route path="guests/:id" element={<RequireRole roles={frontDesk}><GuestDetailPage /></RequireRole>} /><Route path="check-in" element={<RequireRole roles={frontDesk}><FrontDeskPage /></RequireRole>} /><Route path="housekeeping" element={<RequireRole roles={[...management, 'receptionist', 'housekeeping', 'maintenance', 'restaurant']}><HousekeepingPage /></RequireRole>} /><Route path="restaurant" element={<RequireRole roles={kitchen}><RestaurantPage /></RequireRole>} /><Route path="billing" element={<RequireRole roles={frontDesk}><BillingPage /></RequireRole>} /><Route path="reports" element={<RequireRole roles={[...management, 'accountant']}><ReportsPage /></RequireRole>} /><Route path="rates" element={<RequireRole roles={management}><RatesPage /></RequireRole>} /><Route path="website" element={<RequireRole roles={management}><WebsitePage /></RequireRole>} /><Route path="notifications" element={<RequireRole roles={allRoles}><NotificationsPage /></RequireRole>} /><Route path="*" element={<NotFoundPage />} /></Route></Route></Routes></Suspense>;
}
