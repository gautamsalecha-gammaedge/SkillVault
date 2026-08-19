import { useEffect, useState } from 'react';
import { Inbox, Clock, CheckCircle2 } from 'lucide-react';
import { Api } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { useI18n } from '../../lib/i18n';

function StatusBadge({ status }) {
  const { t } = useI18n();
  const isApproved = status === 'approved';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600,
      padding: '3px 10px', borderRadius: 'var(--sv-radius-full)',
      background: isApproved ? 'var(--sv-brass-soft)' : 'var(--sv-bg)',
      color: isApproved ? 'var(--sv-brass)' : 'var(--sv-muted)',
      border: `1px solid ${isApproved ? 'var(--sv-brass)' : 'var(--sv-border)'}`,
    }}>
      {isApproved ? <CheckCircle2 size={11} /> : <Clock size={11} />}
      {isApproved ? (t('tipStatusApproved') || 'Approved') : (t('tipStatusPending') || 'Pending review')}
    </span>
  );
}

export default function MyTips() {
  const { t } = useI18n();
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();

  useEffect(() => {
    Api.myTips()
      .then((res) => setTips(res.tips || []))
      .catch((err) => push(err.message, 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 20, color: 'var(--sv-ink)' }}>
        {t('myTipsTitle')}
      </p>
      <p style={{ fontSize: 13, color: 'var(--sv-muted)', marginBottom: 24 }}>
        {t('myTipsSubtitle')}
      </p>

      {loading ? (
        <div className="sv-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--sv-muted)' }}>
          <p style={{ fontSize: 13 }}>{t('loading') || 'Loading…'}</p>
        </div>
      ) : tips.length === 0 ? (
        <div className="sv-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--sv-muted)' }}>
          <Inbox size={28} style={{ marginBottom: 12, opacity: 0.6 }} />
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--sv-ink)', marginBottom: 6 }}>
            {t('myTipsEmptyTitle') || "You haven't submitted any tips yet"}
          </p>
          <p style={{ fontSize: 13, maxWidth: 360, margin: '0 auto' }}>
            {t('myTipsEmptyBody') || 'Tips you add from the Add Tip page will show up here once submitted.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tips.map((tip) => (
            <div key={tip.id} className="sv-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {tip.machine_id}
                </span>
                <StatusBadge status={tip.status} />
              </div>
              <p style={{ fontSize: 14, color: 'var(--sv-ink)', lineHeight: 1.5, margin: 0 }}>
                {tip.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}