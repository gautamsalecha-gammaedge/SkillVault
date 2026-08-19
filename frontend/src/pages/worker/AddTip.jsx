import { useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import MachineSelect from '../../components/MachineSelect';
import SpeakButton from '../../components/SpeakButton';
import { Api } from '../../lib/api';
import { useSpeechRecognition } from '../../lib/useSpeechRecognition';
import { getLanguage } from '../../lib/languages';
import { useToast } from '../../lib/toast';
import { useI18n } from '../../lib/i18n';

const PHASE = { WRITING: 'writing', CLARIFYING: 'clarifying', REVIEW: 'review' };

export default function AddTip() {
  const { t } = useI18n();
  const [machines, setMachines] = useState([]);
  const [machine, setMachine] = useState('');
  const [phase, setPhase] = useState(PHASE.WRITING);
  const [tipText, setTipText] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [polishedText, setPolishedText] = useState('');
  const [busy, setBusy] = useState(false);
  const { push } = useToast();
  const { listening, supported, start } = useSpeechRecognition({ lang: getLanguage() });

  useEffect(() => {
    Api.myMachines()
      .then((res) => {
        setMachines(res.machine_ids || []);
        if (res.machine_ids?.length) setMachine(res.machine_ids[0]);
      })
      .catch((err) => push(err.message, 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleMic() {
    if (!supported) {
      push(t('micNotSupported'), 'info');
      return;
    }
    start(
      (transcript) => setTipText((t) => (t ? `${t} ${transcript}` : transcript)),
      () => push(t('micError'), 'error'),
    );
  }

  async function reviewTip() {
    if (!tipText.trim() || !machine) return;
    setBusy(true);
    try {
      const res = await Api.checkKnowledge(tipText, machine, 1);
      if (!res.complete) {
        setQuestion(res.question);
        setPhase(PHASE.CLARIFYING);
      } else {
        setPolishedText(res.polished_text);
        setPhase(PHASE.REVIEW);
      }
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function answerClarification() {
    if (!answer.trim()) return;
    setBusy(true);
    try {
      const combined = `${tipText}\n${answer}`;
      const res = await Api.checkKnowledge(combined, machine, 2);
      setPolishedText(res.polished_text);
      setPhase(PHASE.REVIEW);
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function saveTip() {
    setBusy(true);
    try {
      const res = await Api.addKnowledge(polishedText, machine, getLanguage());
      push(res.spoken_confirmation || t('tipSavedSuccess'), 'success');
      reset();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setTipText('');
    setQuestion('');
    setAnswer('');
    setPolishedText('');
    setPhase(PHASE.WRITING);
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 20, color: 'var(--sv-ink)' }}>
          {t('addTipFor')}
        </p>
        {machines.length > 0 ? (
          <MachineSelect value={machine} onChange={setMachine} machines={machines} />
        ) : (
          <span style={{ fontSize: 13, color: 'var(--sv-muted)' }}>{t('noMachinesAssigned')}</span>
        )}
      </div>
      <p style={{ fontSize: 13, color: 'var(--sv-muted)', marginBottom: 20 }}>
        {t('addTipSubtitle')}
      </p>

      {phase === PHASE.WRITING && (
        <div className="sv-card">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, borderRadius: 'var(--sv-radius-full)',
            padding: '6px 6px 6px 16px', background: 'var(--sv-bg)', border: '1px solid var(--sv-border)', marginBottom: 16,
          }}>
            <textarea
              rows={2}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', resize: 'none', padding: '6px 0' }}
              placeholder={machine ? t('addTipPlaceholder', { machine }) : t('selectMachineFirst')}
              value={tipText}
              onChange={(e) => setTipText(e.target.value)}
              disabled={!machine}
            />
            <button
              type="button"
              onClick={handleMic}
              disabled={!machine}
              style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: listening ? 'var(--sv-brass)' : 'var(--sv-brass-soft)', color: listening ? '#fff' : 'var(--sv-brass)',
              }}
              aria-label={t('speakTipAria')}
            >
              <Mic size={16} />
            </button>
          </div>
          <button className="sv-btn sv-btn--primary sv-btn--full" disabled={!tipText.trim() || !machine || busy} onClick={reviewTip}>
            {busy ? t('reviewingTip') : t('reviewTipBtn')}
          </button>
        </div>
      )}

      {phase === PHASE.CLARIFYING && (
        <div className="sv-card">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
            <p style={{ fontSize: 14, color: 'var(--sv-ink)' }}>{question}</p>
            <SpeakButton text={question} style={{ flexShrink: 0 }} />
          </div>
          <textarea
            rows={2}
            style={{ width: '100%', border: '1px solid var(--sv-border)', borderRadius: 'var(--sv-radius-sm)', padding: 10, fontSize: 14, outline: 'none', marginBottom: 12, resize: 'none' }}
            placeholder={t('answerPlaceholder')}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            autoFocus
          />
          <button className="sv-btn sv-btn--primary sv-btn--full" disabled={!answer.trim() || busy} onClick={answerClarification}>
            {busy ? t('pleaseWait') : t('continueBtn')}
          </button>
        </div>
      )}

      {phase === PHASE.REVIEW && (
        <div className="sv-card">
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 6 }}>{t('reviewBeforeSaving')}</p>
          <textarea
            rows={4}
            style={{ width: '100%', border: '1px solid var(--sv-brass)', borderRadius: 'var(--sv-radius-sm)', padding: 10, fontSize: 14, outline: 'none', marginBottom: 12, resize: 'vertical' }}
            value={polishedText}
            onChange={(e) => setPolishedText(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="sv-btn sv-btn--outline" onClick={reset}>{t('startOver')}</button>
            <button className="sv-btn sv-btn--primary" style={{ flex: 1 }} disabled={!polishedText.trim() || busy} onClick={saveTip}>
              {busy ? t('savingTip') : t('saveTipBtn')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}