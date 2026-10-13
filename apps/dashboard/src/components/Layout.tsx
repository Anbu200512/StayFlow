import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, BedDouble, Bell, BookOpen, CalendarDays, CalendarRange, ChevronDown, ClipboardList, CreditCard, ExternalLink, LayoutDashboard, LogOut, Menu, Settings, Sparkles, Users, UtensilsCrossed, X, type LucideIcon } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { adminApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../types';

interface NavigationItem { to: string; label: string; icon: LucideIcon; roles: UserRole[] }
const frontDesk: UserRole[] = ['owner', 'manager', 'receptionist', 'accountant'];
const management: UserRole[] = ['owner', 'manager'];
const kitchen: UserRole[] = ['owner', 'manager', 'receptionist', 'restaurant'];
const links: NavigationItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, roles: ['owner', 'manager', 'receptionist', 'accountant'] },
  { to: '/reservations', label: 'Reservations', icon: BookOpen, roles: frontDesk },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, roles: frontDesk },
  { to: '/rooms', label: 'Rooms & availability', icon: BedDouble, roles: [...frontDesk, 'housekeeping', 'maintenance'] },
  { to: '/guests', label: 'Guests', icon: Users, roles: frontDesk },
  { to: '/check-in', label: 'Front desk', icon: ClipboardList, roles: frontDesk },
  { to: '/housekeeping', label: 'Operations', icon: Sparkles, roles: [...management, 'receptionist', 'housekeeping', 'maintenance', 'restaurant'] },
  { to: '/restaurant', label: 'Kitchen', icon: UtensilsCrossed, roles: kitchen },
  { to: '/billing', label: 'Billing', icon: CreditCard, roles: frontDesk },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: [...management, 'accountant'] },
  { to: '/rates', label: 'Rates & seasons', icon: CalendarRange, roles: management },
  { to: '/website', label: 'Website', icon: Settings, roles: management },
];

export function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileTrigger = useRef<HTMLButtonElement>(null);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: adminApi.notifications, refetchInterval: 60_000 });
  const unread = notifications.data?.filter((item) => item.status !== 'read').length ?? 0;
  const visibleLinks = links.filter((item) => user && item.roles.includes(user.role));
  const logoutAndGo = async () => { await logout(); navigate('/login', { replace: true }); };
  const websiteUrl = import.meta.env.VITE_WEBSITE_URL ?? 'http://localhost:5173';

  useEffect(() => {
    if (!profileOpen) return;
    const close = (event: MouseEvent) => {
      if (event.target instanceof Node && profileTrigger.current?.contains(event.target)) return;
      setProfileOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setProfileOpen(false);
      profileTrigger.current?.focus();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  return <div className="min-h-screen bg-[#f5f7fb] text-ink">
    <a href="#main-content" className="dashboard-button sr-only left-4 top-4 z-50 focus:not-sr-only focus:absolute">Skip to main content</a>
    {mobileOpen && <button type="button" className="fixed inset-0 z-30 bg-ink/45 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" />}
    <aside aria-label="Primary" className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-forest text-white transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
        <div><p className="font-display text-3xl leading-none">StayFlow</p><p className="mt-1 text-[9px] uppercase tracking-[0.22em] text-white/75">Hotel operations</p></div>
        <button type="button" className="text-white/60 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
      </div>
      <div className="scrollbar-none flex-1 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-300">Workspace</p>
        <nav className="space-y-1">
          {visibleLinks.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 text-sm transition ${isActive || (to !== '/' && location.pathname.startsWith(to)) ? 'bg-white/12 text-white' : 'text-slate-200 hover:bg-white/8 hover:text-white'}`}><Icon size={17} strokeWidth={1.8} aria-hidden="true" />{label}</NavLink>)}
        </nav>
        <p className="mt-8 px-3 pb-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-300">Connect</p>
        <a href={websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/8 hover:text-white"><ExternalLink size={17} aria-hidden="true" />Guest website</a>
      </div>
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sage font-semibold text-forest">{user?.name.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user?.name}</p><p className="truncate text-[10px] uppercase tracking-wider text-white/70">{user?.role}</p></div>
          <button type="button" className="text-white/70 transition hover:text-white" onClick={logoutAndGo} aria-label="Sign out"><LogOut size={16} /></button>
        </div>
      </div>
    </aside>
    <div className="lg:pl-64">
      <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-ink/10 bg-[#f5f7fb]/95 px-4 backdrop-blur md:px-8">
        <div className="flex items-center gap-3">
          <button type="button" className="dashboard-button-light px-3 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={17} /></button>
          <div><p className="text-xs font-medium text-forest/60">Hotel operations</p><p className="mt-1 text-sm font-semibold">{formatLabel(location.pathname)}</p></div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="relative flex h-10 w-10 items-center justify-center border border-ink/10 bg-white text-ink/55 transition hover:border-forest hover:text-forest" onClick={() => navigate('/notifications')} aria-label={`${unread} unread notifications`}><Bell size={17} aria-hidden="true" />{unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-copper" />}</button>
          <div className="relative">
            <button ref={profileTrigger} type="button" className="flex items-center gap-2 border border-ink/10 bg-white px-2 py-1.5 text-left" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen} aria-haspopup="menu">
              <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-xs font-semibold text-white">{user?.name.slice(0, 1).toUpperCase()}</span>
              <span className="hidden text-xs font-semibold sm:block">{user?.name}</span>
              <ChevronDown size={14} aria-hidden="true" className="text-ink/40" />
            </button>
            {profileOpen && <div role="menu" aria-label="Account" className="absolute right-0 mt-2 w-52 border border-ink/10 bg-white p-2 shadow-lg"><div className="border-b border-ink/10 px-3 py-2"><p className="text-sm font-semibold">{user?.name}</p><p className="mt-1 truncate text-xs text-ink/45">{user?.email}</p></div><button type="button" role="menuitem" className="mt-1 flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-copper transition hover:bg-copper/5" onClick={logoutAndGo}><LogOut size={15} aria-hidden="true" />Sign out</button></div>}
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1600px] p-4 outline-none md:p-8"><Outlet /></main>
    </div>
  </div>;
}

function formatLabel(pathname: string) { const link = links.find((item) => item.to !== '/' && pathname.startsWith(item.to)); return link?.label ?? 'Overview'; }
