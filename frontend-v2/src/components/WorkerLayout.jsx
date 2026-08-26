import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MessageCircleQuestion, ShieldCheck, ListChecks, Mic2,
  Ticket, Settings, LogOut, Gauge, Menu,
} from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { getWorkerName, getWorkerId, clearWorkerSession } from '../lib/auth';
import PageTransition from './PageTransition';

const NAV = [
  { to: '/worker', label: 'Overview', icon: Gauge, end: true },
  { to: '/worker/ask', label: 'Ask AI', icon: MessageCircleQuestion },
  { to: '/worker/safety', label: 'Safety', icon: ShieldCheck },
  { to: '/worker/my-tips', label: 'Tips', icon: ListChecks },
  { to: '/worker/interview', label: 'Interview', icon: Mic2 },
  { to: '/worker/my-tickets', label: 'Tickets', icon: Ticket },
  { to: '/worker/settings', label: 'Profile', icon: Settings },
];

const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 220;

function maxSidebarWidth() {
  if (typeof window === 'undefined') return 400;
  return Math.max(MIN_WIDTH, Math.floor(window.innerWidth / 4));
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll('main').forEach((el) => { el.scrollTop = 0; });
  }, [pathname]);
  return null;
}

export default function WorkerLayout() {
  const name = getWorkerName();
  const id = getWorkerId();
  const nav = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Resets on remount (logout → login). Not persisted.
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(false);

  const logout = () => {
    clearWorkerSession();
    // replace so Forward cannot return to a protected page after sign-out
    nav('/login', { replace: true });
  };

  const onResizeStart = useCallback((e) => {
    e.preventDefault();
    dragRef.current = true;
    setDragging(true);
    const onMove = (ev) => {
      if (!dragRef.current) return;
      const next = Math.min(maxSidebarWidth(), Math.max(MIN_WIDTH, ev.clientX));
      setSidebarWidth(next);
    };
    const onUp = () => {
      dragRef.current = false;
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  useEffect(() => {
    const onResize = () => {
      setSidebarWidth((w) => Math.min(w, maxSidebarWidth()));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className={`min-h-screen flex ${dragging ? 'select-none cursor-col-resize' : ''}`}>
      <ScrollToTop />
      <aside
        className="hidden lg:flex shrink-0 flex-col sticky top-0 h-screen border-r-2 border-line relative"
        style={{
          width: sidebarWidth,
          background: 'linear-gradient(180deg, #ebe4d8 0%, #e5ddd0 50%, #dfd6c8 100%)',
        }}
      >
        <SidebarContent name={name} id={id} logout={logout} />
        {/* Resize handle */}
        <div
          onMouseDown={onResizeStart}
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-20 group hover:bg-signal/40 active:bg-signal/50 transition-colors"
          title="Drag to resize"
        >
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1 h-12 rounded-full bg-line group-hover:bg-signal opacity-60" />
        </div>
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 h-screen w-[300px] z-50 lg:hidden flex flex-col border-r-2 border-line"
              style={{ background: 'linear-gradient(180deg, #ebe4d8 0%, #e5ddd0 100%)' }}
            >
              <SidebarContent name={name} id={id} logout={logout} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b-2 border-line bg-[#ebe4d8] sticky top-0 z-30">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="w-11 h-11 rounded-xl border-2 border-line bg-surface flex items-center justify-center text-text"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <Brand />
          <div className="w-11" />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ name, id, logout, onNavigate }) {
  return (
    <>
      <div className="px-6 py-7 border-b-2 border-line/80">
        <Brand />
        <p className="mt-2 text-xs text-muted font-medium">Worker floor app</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 sv-scrollbar-none">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-4 px-5 py-4 rounded-xl text-base font-semibold transition-all relative ${
                isActive
                  ? 'bg-surface text-signal shadow-sm border-2 border-line'
                  : 'text-text/75 hover:text-text hover:bg-surface/70 border-2 border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="worker-nav-dot"
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-signal"
                  />
                )}
                <item.icon size={24} strokeWidth={isActive ? 2.25 : 1.75} className="shrink-0" />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-5 border-t-2 border-line/80">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-11 h-11 rounded-full bg-signal/20 border-2 border-signal/35 flex items-center justify-center text-sm text-signal font-bold shrink-0">
            {(name || 'W').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold truncate text-text">{name || 'Worker'}</p>
            <p className="text-xs text-muted truncate font-mono">{id}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-2 justify-center text-sm font-semibold text-muted hover:text-danger border-2 border-line hover:border-danger/40 rounded-xl py-3 transition-colors bg-surface/50"
        >
          <LogOut size={18} /> Sign out
        </button>
      </div>
    </>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-signal to-signal-dim flex items-center justify-center shrink-0 shadow-sm">
        <div className="w-3 h-3 rounded-full bg-white" />
      </div>
      <span className="font-semibold text-xl tracking-tight text-text">SkillVault</span>
    </div>
  );
}