import { useEffect, useState } from 'react';
import { Api } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { useI18n } from '../../lib/i18n';
import { setAdminName } from '../../lib/auth';

const fieldLabel = { fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 6, display: 'block' };
const fieldInput = {
  width: '100%', border: '1.5px solid var(--sv-border)', borderRadius: 'var(--sv-radius-md)',
  padding: '10px 12px', fontSize: 14, outline: 'none', background: 'var(--sv-bg)',
  color: 'var(--sv-ink)', fontFamily: 'var(--sv-font-body)', boxSizing: 'border-box',
};

export default function Profile() {
  const { t } = useI18n();
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    Api.adminProfile()
      .then((res) => {
        setUsername(res.username);
        setName(res.name || '');
      })
      .catch((err) => push(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await Api.updateAdminProfile(name);
      setAdminName(res.name);
      push(t('profileUpdated'), 'success');
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 480 }}>
      <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 20, color: 'var(--sv-ink)', marginBottom: 24 }}>
        {t('adminProfileTitle')}
      </p>

      {loading ? null : (
        <div className="sv-card">
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>{t('adminUsernameLabel')}</label>
            <input style={{ ...fieldInput, opacity: 0.6 }} value={username} disabled />
          </div>
          <form onSubmit={handleSave}>
            <label style={fieldLabel}>{t('adminDisplayNameLabel')}</label>
            <input style={fieldInput} value={name} onChange={(e) => setName(e.target.value)} required />
            <button
              className="sv-btn sv-btn--primary sv-btn--full"
              style={{ marginTop: 16, padding: '12px 16px', fontSize: 14, fontWeight: 600, borderRadius: 'var(--sv-radius-md)' }}
              disabled={busy}
              type="submit"
            >
              {busy ? t('savingBtn') : t('saveProfileBtn')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}