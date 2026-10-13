import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../types';

export function ProtectedRoute() {
  const { user, ready, hydrate } = useAuthStore();
  const location = useLocation();
  useEffect(() => { if (!ready) void hydrate(); }, [ready, hydrate]);
  if (!ready) return <div className="flex min-h-screen items-center justify-center bg-forest text-sm text-white/70">Loading StayFlow…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  if (roles.includes(user.role)) return children;
  const fallback = user.role === 'housekeeping' || user.role === 'maintenance' || user.role === 'restaurant' ? '/housekeeping' : '/';
  return <Navigate to={fallback} replace />;
}
