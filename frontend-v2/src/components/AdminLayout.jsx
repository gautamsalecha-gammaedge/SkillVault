import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, UserCheck, Users, BookOpenText, FileStack,
  ShieldCheck, Ticket, UserCog, LogOut, Menu,
} from 'lucide-react';
import { useState } from 'react';
import { getAdminName, clearAdminSession } from '../lib/auth';
import PageTransition from './PageTransition';
import { Brand } from './WorkerLayout';

const NAV = [
  { to: '/admin', label: 'Analytics', icon: LayoutDashboard, end: true },
  { to: '/admin/pending-workers', label: 'Pending Workers', icon: UserCheck },
  { to: '/admin/workers-machines', label: 'Workers & Machines', icon: Users },
  { to: '/admin/knowledge-review', label: 'Knowledge Review', icon: BookOpenText },
  { to: '/admin/manuals', label: 'Manuals', icon: FileStack },
  { to: '/admin/safety-measures', label: 'Safety Measures', icon: ShieldCheck },
  { to: '/admin/tickets', label: 'Tickets', icon: Ticket },
  { to: '/admin/profile', label: 'Profile', icon: UserCog },
];

export default function AdminLayout() {
  const name = getAdminName();
  const nav = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const logout = () => { clearAdminSession(); nav('/login'); };

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-line bg-surface/60 backdrop-blur-xl sticky top-0 h-screen">
        <SidebarContent name={name} logout={logout} />
      </aside>

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
              <SidebarContent name={name} logout={logout} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-line bg-surface/80 backdrop-blur sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="text-text"><Menu size={22} /></button>
          <span className="font-display font-bold text-lg">SkillVault Admin</span>
          <div className="w-6" />
        </header>
        <main className="p-4 md:p-8 max-w-7xl mx-auto">
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

function SidebarContent({ name, logout, onNavigate }) {
  return (
    <>
      <div className="p-5 border-b border-line flex items-center justify-between">
        <Brand />
        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-amber/10 text-amber border border-amber/30">ADMIN</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 sv-scrollbar-none">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
                isActive ? 'bg-amber/10 text-amber' : 'text-muted hover:text-text hover:bg-surface-2'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="admin-nav-dot" className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-amber" />}
                <item.icon size={17} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-line">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-amber/15 border border-amber/30 flex items-center justify-center font-mono text-xs text-amber font-bold">
            {(name || 'A').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{name || 'Admin'}</p>
            <p className="text-[11px] font-mono text-muted truncate">Supervisor</p>
          </div>
        </div>
        <button onClick={logout} className="w-full flex items-center gap-2 justify-center text-xs font-semibold text-muted hover:text-danger border border-line hover:border-danger/40 rounded-lg py-2 transition-colors">
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </>
  );
}
