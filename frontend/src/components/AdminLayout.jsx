import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun, Globe } from 'lucide-react';
import { useState } from 'react';
import Wordmark from './Wordmark';
import { clearAdminSession } from '../lib/auth';
import { getTheme, setTheme } from '../lib/theme';
import { useI18n } from '../lib/i18n';

export default function AdminLayout() {
  const navigate = useNavigate();
  const [theme, setThemeState] = useState(getTheme());
  const { t, lang, setLang, LANGUAGES } = useI18n();
  const [showLanguages, setShowLanguages] = useState(false);

  const NAV = [
    { to: '/admin/pending-workers', label: t('admin') + ' - Pending workers' },
    { to: '/admin/workers-machines', label: 'Workers & machines' },
    { to: '/admin/knowledge-review', label: 'Knowledge review' },
    { to: '/admin/tickets', label: 'Tickets' },          // ← add this
    { to: '/admin/analytics', label: 'Analytics' },
    { to: '/admin/manuals', label: 'Manuals' },
  ];

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    setTheme(next);
  }

  function handleLogout() {
    clearAdminSession();
    navigate('/');
  }

  return (
    <div style={{ height: '100%', display: 'flex', background: 'var(--sv-bg)' }}>
      <div
        style={{
          width: 224,
          flexShrink: 0,
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          background: 'var(--sv-surface)',
          borderRight: '1px solid var(--sv-border)',
          boxShadow: '1px 0 3px rgba(0,0,0,0.05)',
          overflowY: 'auto',
        }}
      >
        <div style={{ marginBottom: 24 }}><Wordmark size={15} /></div>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              padding: '10px 12px',
              borderRadius: 'var(--sv-radius-sm)',
              fontSize: 13,
              fontWeight: 500,
              background: isActive ? 'var(--sv-brass-soft)' : 'transparent',
              color: isActive ? 'var(--sv-brass)' : 'var(--sv-muted)',
              textDecoration: 'none',
              transition: 'all var(--sv-transition-fast)',
              cursor: 'pointer',
            })}
            onMouseEnter={(e) => {
              if (!e.currentTarget.classList.contains('active')) {
                e.currentTarget.style.background = 'var(--sv-bg-secondary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.classList.contains('active')) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {item.label}
          </NavLink>
        ))}

        <div style={{ flex: 1 }} />

        {/* Language Selector */}
        <div style={{ position: 'relative', marginBottom: 4 }}>
          <button
            className="sv-btn"
            onClick={() => setShowLanguages(!showLanguages)}
            style={{
              justifyContent: 'flex-start',
              padding: '10px 12px',
              gap: 8,
              color: 'var(--sv-muted)',
              fontSize: 13,
              fontWeight: 500,
              width: '100%',
              borderRadius: 'var(--sv-radius-sm)',
            }}
            title={t('selectLanguage')}
          >
            <Globe size={16} />
            <span>{lang.toUpperCase()}</span>
          </button>
          {showLanguages && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
                background: 'var(--sv-surface)',
                border: '1px solid var(--sv-border)',
                borderRadius: 'var(--sv-radius-md)',
                boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
                marginBottom: 4,
                zIndex: 10,
                overflow: 'hidden',
              }}
            >
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLang(l.code);
                    setShowLanguages(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: lang === l.code ? 'var(--sv-brass-soft)' : 'transparent',
                    color: lang === l.code ? 'var(--sv-brass)' : 'var(--sv-ink)',
                    border: 'none',
                    borderBottom: '1px solid var(--sv-border)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                    transition: 'all var(--sv-transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    if (lang !== l.code) {
                      e.currentTarget.style.background = 'var(--sv-bg-secondary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (lang !== l.code) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {l.native}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className="sv-btn"
          onClick={toggleTheme}
          style={{
            justifyContent: 'flex-start',
            padding: '10px 12px',
            gap: 8,
            color: 'var(--sv-muted)',
            fontSize: 13,
            fontWeight: 500,
            width: '100%',
            borderRadius: 'var(--sv-radius-sm)',
          }}
          title={theme === 'dark' ? t('light') : t('dark')}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? t('light') : t('dark')}
        </button>
        <button
          className="sv-btn"
          onClick={handleLogout}
          style={{
            justifyContent: 'flex-start',
            padding: '10px 12px',
            gap: 8,
            color: 'var(--sv-danger)',
            fontSize: 13,
            fontWeight: 500,
            width: '100%',
            borderRadius: 'var(--sv-radius-sm)',
            transition: 'all var(--sv-transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--sv-danger-soft)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
          title={t('logout')}
        >
          <LogOut size={16} /> {t('logout')}
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </div>
    </div>
  );
}
