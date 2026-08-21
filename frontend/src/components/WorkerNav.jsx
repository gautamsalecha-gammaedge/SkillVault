import { NavLink } from 'react-router-dom';
import { MessageCircle, PlusCircle, ListChecks, Radio, Settings, Ticket, Sparkles, ShieldCheck } from 'lucide-react';
import { useI18n } from '../lib/i18n';

/**
 * Persistent bottom tab bar with multilingual support.
 * Every worker screen renders inside WorkerLayout below this,
 * so there is always a way back to Ask (or any other section).
 */
export default function WorkerNav() {
  const { t } = useI18n();

  const TABS = [
    { to: '/worker/ask', label: t('askAbout'), icon: MessageCircle },
    { to: '/worker/safety', label: t('safetyTitle'), icon: ShieldCheck },
    { to: '/worker/add-tip', label: t('addTipFor'), icon: PlusCircle },
    { to: '/worker/my-tips', label: t('myTipsTitle'), icon: ListChecks },
    { to: '/worker/raise-ticket', label: 'Raise Ticket', icon: Ticket },
    { to: '/worker/my-tickets', label: 'My Tickets', icon: ListChecks },
    { to: '/worker/hands-free', label: t('handsFreeTitle'), icon: Radio },
    { to: '/worker/interview', label: 'Share Knowledge', icon: Sparkles },
    { to: '/worker/settings', label: t('settingsTitle'), icon: Settings },
  ];

  return (
    <nav className="sv-worker-nav" aria-label="Primary navigation">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `sv-worker-nav__tab${isActive ? ' sv-worker-nav__tab--active' : ''}`}
          title={label}
        >
          <Icon size={20} strokeWidth={2} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}