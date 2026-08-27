import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, UserCheck, Users, BookOpenText, FileStack,
  ShieldCheck, Ticket, UserCog, LogOut, Menu, NotebookPen,
} from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { getAdminName, clearAdminSession } from '../lib/auth';
import { api } from '../lib/api';
import PageTransition from './PageTransition';
import { Brand } from './WorkerLayout';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/pending-workers', label: 'Pending Workers', icon: UserCheck },
  { to: '/admin/workers-machines', label: 'Workers & Machines', icon: Users },
  { to: '/admin/knowledge-review', label: 'Knowledge Review', icon: BookOpenText },
  { to: '/admin/manuals', label: 'Manuals', icon: FileStack },
  { to: '/admin/safety-measures', label: 'Safety Measures', icon: ShieldCheck },
  { to: '/admin/tickets', label: 'Tickets', icon: Ticket },
  { to: '/admin/daily-updates', label: 'Daily updates', icon: NotebookPen },
  { to: '/admin/profile', label: 'Profile', icon: UserCog },
];

const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 220;

/** IDs the admin has already opened on Pending Workers (this browser). */
const SEEN_PENDING_KEY = 'sv_admin_pending_workers_seen_ids';

function readSeenPendingIds() {
  try {
    const raw = localStorage.getItem(SEEN_PENDING_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeSeenPendingIds(ids) {
  try {
    localStorage.setItem(SEEN_PENDING_KEY, JSON.stringify([...ids].map(String)));
  } catch {
    /* ignore */
  }
}

/** Call when admin opens Pending Workers — clears nav alert for current queue. */
export function markPendingWorkersSeen(workerIds) {
  const set = readSeenPendingIds();
  (workerIds || []).forEach((id) => set.add(String(id)));
  writeSeenPendingIds(set);
}

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

export default function AdminLayout() {
  const name = getAdminName();
  const nav = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [passwordResetCount, setPasswordResetCount] = useState(0);
  /** Unseen pending registrations (not yet opened on Pending Workers page). */
  const [unseenPendingCount, setUnseenPendingCount] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(false);

  // Password-reset requests (stay highlighted while pending)
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      api.adminPasswordResetRequests?.('pending')
        ?.then((res) => {
          if (!cancelled) setPasswordResetCount((res.requests || []).length);
        })
        .catch(() => {
          if (!cancelled) setPasswordResetCount(0);
        });
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [location.pathname]);

  // Pending workers: amber only until admin visits that page
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      api.pendingWorkers()
        .then((res) => {
          if (cancelled) return;
          const list = res.pending_workers || res.workers || [];
          const ids = list.map((w) => String(w.worker_id ?? w.id ?? '')).filter(Boolean);
          const seen = readSeenPendingIds();
          // Drop seen IDs that are no longer pending (approved/rejected)
          const stillPendingSeen = new Set([...seen].filter((id) => ids.includes(id)));
          if (stillPendingSeen.size !== seen.size) writeSeenPendingIds(stillPendingSeen);
          const unseen = ids.filter((id) => !stillPendingSeen.has(id));
          setUnseenPendingCount(unseen.length);
        })
        .catch(() => {
          if (!cancelled) setUnseenPendingCount(0);
        });
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [location.pathname]);

  // Visiting Pending Workers marks current queue as seen → nav back to normal
  useEffect(() => {
    if (location.pathname !== '/admin/pending-workers') return;
    let cancelled = false;
    api.pendingWorkers()
      .then((res) => {
        if (cancelled) return;
        const list = res.pending_workers || res.workers || [];
        const ids = list.map((w) => String(w.worker_id ?? w.id ?? '')).filter(Boolean);
        markPendingWorkersSeen(ids);
        setUnseenPendingCount(0);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [location.pathname]);

  const logout = () => {
    clearAdminSession();
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
        <SidebarContent
          name={name}
          logout={logout}
          passwordResetCount={passwordResetCount}
          unseenPendingCount={unseenPendingCount}
        />
        <div
          onMouseDown={onResizeStart}
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-20 group hover:bg-amber/40 active:bg-amber/50 transition-colors"
          title="Drag to resize"
        >
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1 h-12 rounded-full bg-line group-hover:bg-amber opacity-60" />
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
              <SidebarContent
                name={name}
                logout={logout}
                onNavigate={() => setMobileOpen(false)}
                passwordResetCount={passwordResetCount}
                unseenPendingCount={unseenPendingCount}
              />
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
          <span className="font-semibold text-lg text-text">SkillVault Admin</span>
          <div className="w-11" />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  name,
  logout,
  onNavigate,
  passwordResetCount = 0,
  unseenPendingCount = 0,
}) {
  return (
    <>
      <div className="px-6 py-7 border-b-2 border-line/80 flex items-center justify-between gap-2">
        <Brand />
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber/20 text-amber border border-amber/35 tracking-wide">
          ADMIN
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 sv-scrollbar-none">
        {NAV.map((item) => {
          const isResetAlert = item.to === '/admin/workers-machines' && passwordResetCount > 0;
          const isPendingAlert = item.to === '/admin/pending-workers' && unseenPendingCount > 0;
          const isAlert = isResetAlert || isPendingAlert;
          const badgeCount = isResetAlert
            ? passwordResetCount
            : isPendingAlert
              ? unseenPendingCount
              : 0;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-4 px-5 py-4 rounded-xl text-base font-semibold transition-all relative ${
                  isActive
                    ? isAlert
                      ? 'bg-amber/15 text-amber shadow-sm border-2 border-amber'
                      : 'bg-surface text-amber shadow-sm border-2 border-line'
                    : isAlert
                      ? 'text-amber bg-amber/10 border-2 border-amber/50 hover:bg-amber/15'
                      : 'text-text/75 hover:text-text hover:bg-surface/70 border-2 border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="admin-nav-dot"
                      className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-amber"
                    />
                  )}
                  <item.icon
                    size={24}
                    strokeWidth={isActive || isAlert ? 2.25 : 1.75}
                    className="shrink-0"
                  />
                  <span className="leading-tight flex-1">{item.label}</span>
                  {badgeCount > 0 && (
                    <span className="min-w-[1.35rem] h-5 px-1.5 rounded-full bg-amber text-white text-[11px] font-bold flex items-center justify-center tabular-nums">
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-5 border-t-2 border-line/80">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-11 h-11 rounded-full bg-amber/20 border-2 border-amber/35 flex items-center justify-center text-sm text-amber font-bold shrink-0">
            {(name || 'A').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold truncate text-text">{name || 'Admin'}</p>
            <p className="text-xs text-muted truncate">Supervisor</p>
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