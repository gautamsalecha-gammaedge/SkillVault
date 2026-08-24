import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MessageCircleQuestion, ShieldCheck, PlusCircle, ListChecks, Mic2,
  BookOpenCheck, Ticket, Settings, LogOut, Gauge, Menu,
} from 'lucide-react';
import { useState } from 'react';
import { getWorkerName, getWorkerId, clearWorkerSession } from '../lib/auth';
import PageTransition from './PageTransition';

const NAV = [
  { to: '/worker', label: 'Overview', icon: Gauge, end: true },
  { to: '/worker/ask', label: 'Ask AI', icon: MessageCircleQuestion },
  { to: '/worker/safety', label: 'Safety', icon: ShieldCheck },
  { to: '/worker/add-tip', label: 'Add a Tip', icon: PlusCircle },
  { to: '/worker/my-tips', label: 'My Tips', icon: ListChecks },
  { to: '/worker/interview', label: 'Tacit Interview', icon: Mic2 },
  { to: '/worker/raise-ticket', label: 'Raise a Ticket', icon: Ticket },
  { to: '/worker/my-tickets', label: 'My Tickets', icon: BookOpenCheck },
  { to: '/worker/settings', label: 'Settings', icon: Settings },
];

export default function WorkerLayout() {
  const name = getWorkerName();
  const id = getWorkerId();
  const nav = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const logout = () => { clearWorkerSession(); nav('/login'); };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-line bg-surface/60 backdrop-blur-xl sticky top-0 h-screen">
        <SidebarContent name={name} id={id} logout={logout} />
      </aside>

      {/* Sidebar - mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-black/70 z-40 lg:hidden" />
            <motion.aside
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 h-screen w-72 bg-surface z-50 lg:hidden flex flex-col border-r border-line"
            >
              <SidebarContent name={name} id={id} logout={logout} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-line bg-surface/80 backdrop-blur sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="text-text"><Menu size={22} /></button>
          <span className="font-display font-bold text-lg">SkillVault</span>
          <div className="w-6" />
        </header>
        <main className="p-4 md:p-8 max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ name, id, logout, onNavigate }) {
  return (
    <>
      <div className="p-5 border-b border-line flex items-center justify-between">
        <Brand />
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 sv-scrollbar-none">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                isActive ? 'bg-signal/10 text-signal' : 'text-muted hover:text-text hover:bg-surface-2'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="worker-nav-dot" className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-signal" />}
                <item.icon size={17} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-line">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-signal/15 border border-signal/30 flex items-center justify-center font-mono text-xs text-signal font-bold">
            {(name || 'W').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{name || 'Worker'}</p>
            <p className="text-[11px] font-mono text-muted truncate">{id}</p>
          </div>
        </div>
        <button onClick={logout} className="w-full flex items-center gap-2 justify-center text-xs font-semibold text-muted hover:text-danger border border-line hover:border-danger/40 rounded-lg py-2 transition-colors">
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-signal to-signal-dim flex items-center justify-center shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-[#06110d]" />
      </div>
      <span className="font-display font-bold text-lg tracking-tight">SkillVault</span>
    </div>
  );
}
