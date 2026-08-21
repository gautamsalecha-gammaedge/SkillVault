import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, ShieldCheck, ShieldAlert, CheckCircle2 } from 'lucide-react';
import SpeakButton from '../../components/SpeakButton';
import { Api, mediaUrl } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { useI18n } from '../../lib/i18n';
import { getLanguage } from '../../lib/languages';

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function SafetyBriefing() {
  const { machineId } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [measures, setMeasures] = useState([]);
  const [priorCompletion, setPriorCompletion] = useState(null); // completed_at from server, before this session's action
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [justCompletedAt, setJustCompletedAt] = useState(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    setStep(0);
    setJustCompletedAt(null);
    Api.safetyMeasures(machineId)
      .then((res) => {
        setMeasures(res.measures || []);
        setPriorCompletion(res.completed ? res.completed_at : null);
      })
      .catch((err) => {
        setLoadError(true);
        push(err.message || t('safetyLoadError'), 'error');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId]);

  const total = measures.length;
  const current = measures[step];
  const isLastStep = step === total - 1;

  async function handleComplete() {
    setCompleting(true);
    try {
      const langCode = current?.language_code || getLanguage();
      const res = await Api.completeSafety(machineId, langCode);
      setJustCompletedAt(res.completed_at);
    } catch (err) {
      push(err.message || t('safetyCompleteError'), 'error');
    } finally {
      setCompleting(false);
    }
  }

  function goBackToMachines() {
    navigate('/worker/safety');
  }

  function restart() {
    setJustCompletedAt(null);
    setStep(0);
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 24px 32px', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Header */}
      <button
        type="button"
        onClick={goBackToMachines}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
          fontSize: 12.5, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 14, padding: '4px 2px',
        }}
      >
        <ArrowLeft size={14} /> {t('safetyBackToMachines')}
      </button>

      {loading && (
        <div className="sv-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--sv-muted)' }}>
          <p style={{ fontSize: 13 }}>{t('safetyLoading')}</p>
        </div>
      )}

      {!loading && loadError && (
        <div className="sv-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--sv-muted)' }}>
          <ShieldAlert size={26} style={{ marginBottom: 12, opacity: 0.6 }} />
          <p style={{ fontSize: 13.5 }}>{t('safetyLoadError')}</p>
        </div>
      )}

      {!loading && !loadError && total === 0 && (
        <div className="sv-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--sv-muted)' }}>
          <ShieldAlert size={26} style={{ marginBottom: 12, opacity: 0.6 }} />
          <p style={{ fontSize: 13.5, color: 'var(--sv-ink)', fontWeight: 500, marginBottom: 6 }}>{machineId}</p>
          <p style={{ fontSize: 13, maxWidth: 320, margin: '0 auto' }}>{t('safetyNoMeasuresYet')}</p>
        </div>
      )}

      {/* Completion screen */}
      {!loading && !loadError && total > 0 && justCompletedAt && (
        <div className="sv-card" style={{ textAlign: 'center', padding: '48px 28px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: 'var(--sv-teal-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <CheckCircle2 size={28} color="var(--sv-teal)" />
          </div>
          <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 18, color: 'var(--sv-ink)', marginBottom: 8 }}>
            {t('safetyDoneTitle')}
          </p>
          <p style={{ fontSize: 13.5, color: 'var(--sv-muted)', maxWidth: 380, margin: '0 auto 6px', lineHeight: 1.5 }}>
            {t('safetyDoneBody', { machine: machineId })}
          </p>
          <p style={{ fontSize: 12, color: 'var(--sv-muted-light)', marginBottom: 24 }}>
            {t('safetyDoneCompletedAt', { date: formatDate(justCompletedAt) })}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="sv-btn sv-btn--outline-brass" onClick={restart}>{t('safetyDoneRedoBtn')}</button>
            <button className="sv-btn sv-btn--primary" onClick={goBackToMachines}>{t('safetyDoneBackBtn')}</button>
          </div>
        </div>
      )}

      {/* Briefing stepper */}
      {!loading && !loadError && total > 0 && !justCompletedAt && current && (
        <>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 18, color: 'var(--sv-ink)', margin: 0 }}>
                {machineId}
              </p>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)' }}>
                {t('safetyStepOf', { current: step + 1, total })}
              </span>
            </div>

            {/* Progress bar */}
            <div style={{ height: 6, borderRadius: 'var(--sv-radius-full)', background: 'var(--sv-border)', overflow: 'hidden', marginBottom: 10 }}>
              <div style={{
                height: '100%', width: `${((step + 1) / total) * 100}%`,
                background: 'var(--sv-brass)', transition: 'width 0.2s ease',
              }} />
            </div>

            {/* Step dots — tap to jump to any earlier or current step */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {measures.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { if (i <= step) setStep(i); }}
                  disabled={i > step}
                  aria-label={t('safetyJumpToStep', { n: i + 1 })}
                  style={{
                    width: 22, height: 22, borderRadius: '50%', fontSize: 10.5, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: i < step ? 'var(--sv-teal-soft)' : i === step ? 'var(--sv-brass)' : 'var(--sv-bg)',
                    color: i < step ? 'var(--sv-teal)' : i === step ? '#fff' : 'var(--sv-muted-light)',
                    border: i === step ? 'none' : '1px solid var(--sv-border)',
                    cursor: i <= step ? 'pointer' : 'default',
                  }}
                >
                  {i < step ? <CheckCircle2 size={12} /> : i + 1}
                </button>
              ))}
            </div>

            {priorCompletion && (
              <p style={{ fontSize: 12, color: 'var(--sv-teal)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                <ShieldCheck size={13} /> {t('safetyAlreadyDoneBanner', { date: formatDate(priorCompletion) })}
              </p>
            )}
          </div>

          {/* Measure card */}
          <div
            className="sv-card sv-card--elevated"
            style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 17, color: 'var(--sv-ink)', margin: 0, lineHeight: 1.35 }}>
                {current.title}
              </p>
              <SpeakButton
                text={`${current.title}. ${current.content}`}
                lang={current.language_code}
                label={t('safetyListenBtn')}
                style={{
                  background: 'var(--sv-teal-soft)', flexShrink: 0, fontSize: 12.5,
                  padding: '6px 12px', border: '1px solid var(--sv-teal-light)',
                }}
              />
            </div>
            <p style={{ fontSize: 14.5, color: 'var(--sv-ink-secondary)', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>
              {current.content}
            </p>

            {/* Optional video for this step - text stays the source of
                truth either way, this is just illustrative. */}
            {current.video_url && (
              <video
                key={current.id}
                src={mediaUrl(current.video_url)}
                controls
                preload="metadata"
                style={{
                  width: '100%', maxHeight: 320, borderRadius: 'var(--sv-radius-md)',
                  background: '#000', display: 'block',
                }}
              />
            )}
          </div>

          {/* Nav buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="sv-btn sv-btn--outline"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 4, opacity: step === 0 ? 0.5 : 1 }}
            >
              <ChevronLeft size={16} /> {t('safetyPrevStep')}
            </button>

            {isLastStep ? (
              <button
                type="button"
                className="sv-btn sv-btn--primary"
                disabled={completing}
                onClick={handleComplete}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <ShieldCheck size={16} />
                {completing ? t('safetyCompletingBtn') : t('safetyMarkComplete')}
              </button>
            ) : (
              <button
                type="button"
                className="sv-btn sv-btn--brass"
                onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              >
                {t('safetyIUnderstand')} <ChevronRight size={16} />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}