import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, ChevronRight, Cog } from 'lucide-react';
import { Api } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { useI18n } from '../../lib/i18n';

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function MachineSafetyCard({ machine, onOpen }) {
  const { t } = useI18n();
  const { machine_id, measure_count, completed, completed_at } = machine;
  const hasMeasures = measure_count > 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(machine_id)}
      className="sv-card"
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: 16, textAlign: 'left',
        width: '100%', border: `1px solid ${completed ? 'var(--sv-teal)' : 'var(--sv-border)'}`,
        cursor: 'pointer', transition: 'transform var(--sv-transition-fast), box-shadow var(--sv-transition-fast)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--sv-shadow-md)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = ''; }}
    >
      <div style={{
        width: 44, height: 44, minWidth: 44, borderRadius: 'var(--sv-radius-md)',
        background: completed ? 'var(--sv-teal-soft)' : 'var(--sv-brass-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {completed
          ? <ShieldCheck size={22} color="var(--sv-teal)" />
          : <ShieldAlert size={22} color="var(--sv-brass)" />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--sv-ink)', margin: 0 }}>
            {machine_id}
          </p>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
            padding: '2px 8px', borderRadius: 'var(--sv-radius-full)',
            background: completed ? 'var(--sv-teal-soft)' : 'var(--sv-warning-soft)',
            color: completed ? 'var(--sv-teal)' : 'var(--sv-warning)',
          }}>
            {completed ? t('safetyCompletedBadge') : t('safetyRequiredBadge')}
          </span>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--sv-muted)', margin: '4px 0 0' }}>
          {completed
            ? t('safetyCompletedOn', { date: formatDate(completed_at) })
            : hasMeasures
              ? t(measure_count === 1 ? 'safetyMeasureCount' : 'safetyMeasureCountPlural', { count: measure_count })
              : t('safetyNoMeasuresYet')}
        </p>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600,
        color: hasMeasures ? 'var(--sv-brass)' : 'var(--sv-muted-light)', whiteSpace: 'nowrap',
      }}>
        {hasMeasures && (completed ? t('safetyReviewBtn') : t('safetyStartBtn'))}
        {hasMeasures && <ChevronRight size={16} />}
      </div>
    </button>
  );
}

export default function Safety() {
  const { t } = useI18n();
  const { push } = useToast();
  const navigate = useNavigate();
  const [machines, setMachines] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Api.mySafetyStatus()
      .then((res) => setMachines(res.machines || []))
      .catch((err) => {
        setError(true);
        push(err.message, 'error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--sv-radius-md)', background: 'var(--sv-brass-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldCheck size={18} color="var(--sv-brass)" />
        </div>
        <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 20, color: 'var(--sv-ink)', margin: 0 }}>
          {t('safetyTitle')}
        </p>
      </div>
      <p style={{ fontSize: 13, color: 'var(--sv-muted)', marginBottom: 22 }}>
        {t('safetySubtitle')}
      </p>

      {machines === null && !error && (
        <div className="sv-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--sv-muted)' }}>
          <p style={{ fontSize: 13 }}>{t('safetyLoading')}</p>
        </div>
      )}

      {machines?.length === 0 && (
        <div className="sv-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--sv-muted)' }}>
          <Cog size={26} style={{ marginBottom: 12, opacity: 0.6 }} />
          <p style={{ fontSize: 13.5, maxWidth: 320, margin: '0 auto' }}>{t('safetyNoMachines')}</p>
        </div>
      )}

      {machines && machines.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {machines.map((m) => (
            <MachineSafetyCard key={m.machine_id} machine={m} onOpen={(id) => navigate(`/worker/safety/${encodeURIComponent(id)}`)} />
          ))}
        </div>
      )}
    </div>
  );
}