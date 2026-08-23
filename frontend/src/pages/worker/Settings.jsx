import { useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { getWorkerName, getWorkerId, clearWorkerSession, setWorkerName } from '../../lib/auth';
import { getTheme, setTheme } from '../../lib/theme';
import { useState, useEffect } from 'react';
import { useToast } from '../../lib/toast';
import { Api } from '../../lib/api';
import { COUNTRY_CODES } from '../../lib/countryCodes';

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

      <ProfileEditor t={t} push={push} />

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

const fieldLabel = { fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 6, display: 'block' };
const fieldInput = {
  width: '100%', border: '1.5px solid var(--sv-border)', borderRadius: 'var(--sv-radius-md)',
  padding: '10px 12px', fontSize: 14, outline: 'none', background: 'var(--sv-bg)',
  color: 'var(--sv-ink)', fontFamily: 'var(--sv-font-body)', boxSizing: 'border-box',
};

function ProfileEditor({ t, push }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    Api.myProfile()
      .then((res) => {
        setName(res.name || '');
        setCountryCode(res.phone_country_code || '+91');
        setPhoneNumber(res.phone_number || '');
        setAddress(res.address || '');
      })
      .catch((err) => push(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const fields = {
        name,
        phone_country_code: countryCode,
        phone_number: phoneNumber || null,
        address: address || null,
      };
      if (newPassword) {
        fields.current_password = currentPassword;
        fields.new_password = newPassword;
      }
      const res = await Api.updateMyProfile(fields);
      setWorkerName(res.name);
      setCurrentPassword('');
      setNewPassword('');
      push(newPassword ? t('passwordUpdated') : t('profileUpdated'), 'success');
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <div className="sv-card" style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 14 }}>{t('editProfileTitle')}</p>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={fieldLabel}>{t('nameLabel')}</label>
          <input style={fieldInput} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div>
          <label style={fieldLabel}>{t('phoneNumberLabel')}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select style={{ ...fieldInput, flex: '0 0 130px' }} value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
            <input style={{ ...fieldInput, flex: 1 }} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
          </div>
        </div>

        <div>
          <label style={fieldLabel}>{t('addressLabel')}</label>
          <input style={fieldInput} placeholder={t('addressPlaceholder')} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>

        <div style={{ borderTop: '1px solid var(--sv-border)', paddingTop: 14, marginTop: 4 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 10 }}>{t('changePasswordTitle')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={fieldLabel}>{t('currentPasswordLabel')}</label>
              <input style={fieldInput} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <label style={fieldLabel}>{t('newPasswordLabel')}</label>
              <input style={fieldInput} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('leaveBlankToKeep')} />
            </div>
          </div>
        </div>

        <button className="sv-btn sv-btn--primary sv-btn--full" style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, borderRadius: 'var(--sv-radius-md)' }} disabled={busy} type="submit">
          {busy ? t('savingBtn') : t('saveProfileBtn')}
        </button>
      </form>
    </div>
  );
}