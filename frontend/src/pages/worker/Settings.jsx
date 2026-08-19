import { useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { getWorkerName, getWorkerId, clearWorkerSession } from '../../lib/auth';
import { getTheme, setTheme } from '../../lib/theme';
import { useState } from 'react';
import { useToast } from '../../lib/toast';

export default function Settings() {
  const { t, lang, setLang, LANGUAGES } = useI18n();
  const [theme, setThemeState] = useState(getTheme());
  const navigate = useNavigate();
  const { push } = useToast();

  function handleLanguageChange(code) {
    setLang(code);
    push(t('languageUpdated'), 'success');
  }

  function handleThemeChange(next) {
    setThemeState(next);
    setTheme(next);
  }

  function handleLogout() {
    clearWorkerSession();
    navigate('/');
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 20, color: 'var(--sv-ink)', marginBottom: 24 }}>
        {t('settingsTitle')}
      </p>

      <div className="sv-card" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 4 }}>{t('signedInAs')}</p>
        <p style={{ fontSize: 14, color: 'var(--sv-ink)' }}>{getWorkerName()} · <span style={{ fontFamily: 'var(--sv-font-mono)' }}>{getWorkerId()}</span></p>
      </div>

      <div className="sv-card" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 10 }}>{t('appearance')}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="sv-btn"
            onClick={() => handleThemeChange('light')}
            style={{
              flex: 1, justifyContent: 'center', padding: '10px 14px', gap: 6,
              background: theme === 'light' ? 'var(--sv-brass-soft)' : 'transparent',
              color: theme === 'light' ? 'var(--sv-brass)' : 'var(--sv-ink)',
              border: '1px solid var(--sv-border)',
            }}
          >
            <Sun size={14} /> {t('light')}
          </button>
          <button
            className="sv-btn"
            onClick={() => handleThemeChange('dark')}
            style={{
              flex: 1, justifyContent: 'center', padding: '10px 14px', gap: 6,
              background: theme === 'dark' ? 'var(--sv-brass-soft)' : 'transparent',
              color: theme === 'dark' ? 'var(--sv-brass)' : 'var(--sv-ink)',
              border: '1px solid var(--sv-border)',
            }}
          >
            <Moon size={14} /> {t('dark')}
          </button>
        </div>
      </div>

      <div className="sv-card" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 10 }}>{t('language')}</p>
        <p style={{ fontSize: 12, color: 'var(--sv-muted)', marginBottom: 10 }}>
          {t('languageSectionHint')}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => handleLanguageChange(l.code)}
              className="sv-btn"
              style={{
                justifyContent: 'flex-start', padding: '10px 14px',
                background: lang === l.code ? 'var(--sv-brass-soft)' : 'transparent',
                color: lang === l.code ? 'var(--sv-brass)' : 'var(--sv-ink)',
                border: '1px solid var(--sv-border)',
              }}
            >
              {l.native}
            </button>
          ))}
        </div>
      </div>

      <button className="sv-btn sv-btn--outline sv-btn--full" style={{ color: 'var(--sv-danger)', borderColor: 'var(--sv-danger-soft)' }} onClick={handleLogout}>
        <LogOut size={14} /> {t('logout')}
      </button>
    </div>
  );
}