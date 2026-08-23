import { useEffect, useState } from 'react';
import { Api } from '../../lib/api';
import { useToast } from '../../lib/toast';

const inputStyle = {
  border: '1.5px solid var(--sv-border)',
  borderRadius: 'var(--sv-radius-md)',
  padding: '10px 12px',
  fontSize: 14,
  outline: 'none',
  background: 'var(--sv-bg)',
  color: 'var(--sv-ink)',
  width: '100%',
  maxWidth: 360,
  boxSizing: 'border-box',
};

export default function AdminProfile() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    Api.adminProfile()
      .then((res) => setName(res.name || ''))
      .catch((err) => push(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await Api.updateAdminProfile(name.trim());
      setName(res.name);
      push('Admin profile updated.', 'success');
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 480 }}>
      <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 20, color: 'var(--sv-ink)' }}>
        Admin profile
      </p>
      <p style={{ fontSize: 13, color: 'var(--sv-muted)', marginBottom: 20 }}>
        Update your display name. Login username and password stay in server environment variables and cannot be changed here.
      </p>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--sv-muted)' }}>Loading…</p>
      ) : (
        <form onSubmit={handleSave} className="sv-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)' }}>Display name</span>
            <input
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            className="sv-btn sv-btn--primary"
            disabled={saving}
            style={{ alignSelf: 'flex-start', padding: '10px 18px' }}
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      )}
    </div>
  );
}