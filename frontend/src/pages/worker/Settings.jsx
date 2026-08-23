import { useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun, User } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { getWorkerName, getWorkerId, clearWorkerSession, setWorkerSession, getWorkerToken } from '../../lib/auth';
import { getTheme, setTheme } from '../../lib/theme';
import { useState, useEffect } from 'react';
import { useToast } from '../../lib/toast';
import { Api } from '../../lib/api';

export default function Settings() {
  const { t, lang, setLang, LANGUAGES } = useI18n();
  const navigate = useNavigate();
  const { push } = useToast();
  const [theme, setThemeState] = useState(getTheme());

  const [name, setName] = useState(getWorkerName() || '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [workerId] = useState(getWorkerId() || '');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Api.workerMe()
      .then((res) => {
        if (cancelled) return;
        setName(res.name || '');
        setPhone(res.phone || '');
        setAddress(res.address || '');
      })
      .catch(() => {
        /* keep localStorage fallbacks */
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });
    return () => { cancelled = true; };
  }, []);

  function handleThemeChange(next) {
    setTheme(next);
    setThemeState(next);
  }

  function handleLanguageChange(code) {
    setLang(code);
  }

  function handleLogout() {
    clearWorkerSession();
    navigate('/');
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await Api.updateWorkerProfile({
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
      });
      // Keep session name in sync so TopBar / nav stay current
      const token = getWorkerToken();
      if (token) setWorkerSession(token, res.name, res.worker_id || workerId);
      push(t('profileUpdated') || 'Profile updated.', 'success');
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: '24px 16px', maxWidth: 480, margin: '0 auto' }}>
      <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 20, color: 'var(--sv-ink)', marginBottom: 4 }}>
        {t('settingsTitle')}
      </p>
      <p style={{ fontSize: 13, color: 'var(--sv-muted)', marginBottom: 20 }}>
        {t('settingsSubtitle') || 'Account, appearance, and language'}
      </p>

      {/* Profile */}
      <div className="sv-card" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <User size={14} /> {t('profileTitle') || 'Profile'}
        </p>
        {loadingProfile ? (
          <p style={{ fontSize: 13, color: 'var(--sv-muted)' }}>{t('loading')}</p>
        ) : (
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={labelStyle}>
              <span style={labelText}>{t('workerIdLabel')}</span>
              <input style={inputStyle} value={workerId} disabled readOnly />
            </label>
            <label style={labelStyle}>
              <span style={labelText}>{t('nameLabel')}</span>
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label style={labelStyle}>
              <span style={labelText}>{t('phoneLabel')}</span>
              <input
                style={inputStyle}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                inputMode="tel"
              />
            </label>
            <label style={labelStyle}>
              <span style={labelText}>{t('addressLabel')}</span>
              <textarea
                style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
              />
            </label>
            <button
              type="submit"
              className="sv-btn sv-btn--primary"
              disabled={saving}
              style={{ alignSelf: 'flex-start', padding: '10px 18px' }}
            >
              {saving ? t('loading') : (t('saveProfile') || 'Save profile')}
            </button>
          </form>
        )}
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

const labelStyle = { display: 'flex', flexDirection: 'column', gap: 4 };
const labelText = { fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)' };
const inputStyle = {
  border: '1.5px solid var(--sv-border)',
  borderRadius: 'var(--sv-radius-md)',
  padding: '10px 12px',
  fontSize: 14,
  outline: 'none',
  background: 'var(--sv-bg)',
  color: 'var(--sv-ink)',
  fontFamily: 'var(--sv-font-body)',
};