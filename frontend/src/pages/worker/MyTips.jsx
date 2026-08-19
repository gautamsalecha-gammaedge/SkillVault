import { Inbox } from 'lucide-react';
import { useI18n } from '../../lib/i18n';

/**
 * The backend has no endpoint to list a worker's own submitted tips
 * yet (see handoff brief — "tip history / status per worker" is in
 * the "NOT yet implemented" list). Rather than fabricate tip data,
 * this is an honest empty state. Once a GET /worker/my-tips (or
 * similar) endpoint exists, wire it here the same way Ask.jsx wires
 * /worker/my-machines.
 */
export default function MyTips() {
  const { t } = useI18n();

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 20, color: 'var(--sv-ink)' }}>
        {t('myTipsTitle')}
      </p>
      <p style={{ fontSize: 13, color: 'var(--sv-muted)', marginBottom: 24 }}>
        {t('myTipsSubtitle')}
      </p>
      <div className="sv-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--sv-muted)' }}>
        <Inbox size={28} style={{ marginBottom: 12, opacity: 0.6 }} />
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--sv-ink)', marginBottom: 6 }}>
          {t('myTipsNotAvailableTitle')}
        </p>
        <p style={{ fontSize: 13, maxWidth: 360, margin: '0 auto' }}>
          {t('myTipsNotAvailableBody')}
        </p>
      </div>
    </div>
  );
}