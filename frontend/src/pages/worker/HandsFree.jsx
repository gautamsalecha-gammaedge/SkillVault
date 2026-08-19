import { useEffect, useRef, useState } from 'react';
import { Mic, Waves } from 'lucide-react';
import MachineSelect from '../../components/MachineSelect';
import { Api } from '../../lib/api';
import { useVoiceRecorder } from '../../lib/useVoiceRecorder';
import { useToast } from '../../lib/toast';
import { useHandsFreeSession } from '../../lib/workerSession';
import { useI18n } from '../../lib/i18n';

const KEY = 'sv_handsfree_prefs';
function loadPrefs() {
  try {
    return { continuous: true, spoken: true, activation: 'wake', ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { continuous: true, spoken: true, activation: 'wake' };
  }
}
function savePrefs(p) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

const STATE = { IDLE: 'idle', LISTENING: 'listening', TRANSCRIBING: 'transcribing', THINKING: 'thinking', SPEAKING: 'speaking' };

// Fallback for the very first question in a session, before Sarvam has
// detected anything yet. After that, detectedLang tracks whatever the
// worker most recently spoke - carried across turns since a worker
// rarely switches language mid hands-free session.
const DEFAULT_LANG = 'en-IN';

/**
 * Real "wake word" detection (always-on keyword spotting for something
 * like "Hey Vault") needs a dedicated model running continuously in the
 * background — not something achievable with a record-then-send STT
 * flow. What's implemented here, honestly: tap the mic to start
 * recording, tap again to stop and send it off, get it answered and
 * (optionally) read aloud, and if "Continuous listening" is on, the mic
 * re-arms itself after the answer so you don't have to navigate back or
 * tap "start" again. "Wake word" vs "Push-to-talk" changes whether it
 * re-arms automatically or waits for your next tap to even begin -
 * neither mode removes the need to tap once to signal "I'm done
 * talking," since that's what tells the recorder to stop and send the
 * audio. True silence-triggered hands-free (no second tap at all) needs
 * a live-streaming connection with server-side voice activity detection,
 * which isn't what's wired up here.
 *
 * The live mic/audio session (recorder, WebSocket-free here, Audio
 * element) can't survive navigating to another tab — the browser tears
 * that down with the component, same as any other page. But the
 * *result* of a question asked here — busy flag, last question, last
 * answer — lives in WorkerSessionProvider (above <Outlet/>), so if you
 * switch to Ask or Settings while it's thinking, the answer still lands
 * and is there when you come back, instead of vanishing.
 */
export default function HandsFree() {
  const { t } = useI18n();
  const [prefs, setPrefs] = useState(loadPrefs);
  const [machines, setMachines] = useState([]);
  const {
    hfMachine: machine, setHfMachine: setMachine,
    hfBusy: busy, setHfBusy: setBusy,
    hfLastQuestion: lastQuestion, setHfLastQuestion: setLastQuestion,
    hfLastAnswer: lastAnswer, setHfLastAnswer: setLastAnswer,
  } = useHandsFreeSession();
  // Local-only: reflects the live mic/audio session, which cannot
  // persist across unmount. Initialized from the shared `busy` flag so
  // a request still in flight shows "Thinking…" again on return.
  const [state, setState] = useState(busy ? STATE.THINKING : STATE.IDLE);
  // Sarvam-detected language from the worker's most recent recording -
  // replaces the old getLanguage() stored-setting lookup.
  const [detectedLang, setDetectedLang] = useState(DEFAULT_LANG);
  const audioRef = useRef(null);
  const { push } = useToast();
  const { recording, start, stop } = useVoiceRecorder();

  useEffect(() => {
    Api.myMachines()
      .then((res) => {
        setMachines(res.machine_ids || []);
        if (res.machine_ids?.length && !machine) setMachine(res.machine_ids[0]);
      })
      .catch((err) => push(err.message, 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  function update(patch) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
  }

  function beginListening() {
    if (!machine) {
      push(t('noMachineAssignedYet'), 'info');
      return;
    }
    setState(STATE.LISTENING);
    start(
      ({ transcript, language_code }) => {
        if (language_code) setDetectedLang(language_code);
        setState(STATE.THINKING);
        handleQuestion(transcript, language_code || detectedLang);
      },
      (err) => { setState(STATE.IDLE); push(err || t('micErrorHandsFree'), 'error'); },
    );
  }

  function stopListening() {
    // Recording actually stopping is async (MediaRecorder.onstop ->
    // upload -> transcribe), so this just signals "I'm done talking" -
    // the TRANSCRIBING state and the eventual THINKING/error transition
    // happen inside beginListening()'s start() callbacks above.
    setState(STATE.TRANSCRIBING);
    stop();
  }

  async function handleQuestion(transcript, lang) {
    setLastQuestion(transcript);
    setLastAnswer('');
    setBusy(true);
    try {
      const res = await Api.ask(transcript, machine);
      setLastAnswer(res.answer);
      setBusy(false);
      if (prefs.spoken) {
        await speak(res.answer, lang);
      } else if (prefs.continuous && prefs.activation === 'wake') {
        beginListening();
      } else {
        setState(STATE.IDLE);
      }
    } catch (err) {
      push(err.message, 'error');
      setBusy(false);
      setState(STATE.IDLE);
    }
  }

  async function speak(text, lang) {
    setState(STATE.SPEAKING);
    try {
      const { blob } = await Api.speak(text, lang || detectedLang);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (prefs.continuous && prefs.activation === 'wake') {
          beginListening();
        } else {
          setState(STATE.IDLE);
        }
      };
      audio.onerror = () => { URL.revokeObjectURL(url); setState(STATE.IDLE); };
      await audio.play();
    } catch (err) {
      push(t('spokenAnswerError'), 'error');
      setState(STATE.IDLE);
    }
  }

  function handleMicTap() {
    if (state === STATE.LISTENING) {
      stopListening();
      return;
    }
    if (state === STATE.SPEAKING) {
      audioRef.current?.pause();
      setState(STATE.IDLE);
      return;
    }
    if (state === STATE.THINKING || state === STATE.TRANSCRIBING) return;
    beginListening();
  }

  const statusLabel = {
    [STATE.IDLE]: prefs.activation === 'wake' ? t('statusIdleWake') : t('statusIdlePtt'),
    [STATE.LISTENING]: t('statusListening'),
    [STATE.TRANSCRIBING]: t('transcribing') || t('thinking'),
    [STATE.THINKING]: t('thinking'),
    [STATE.SPEAKING]: t('statusSpeaking'),
  }[state];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, overflowY: 'auto' }}>
      <div style={{ maxWidth: 360, width: '100%' }}>
        <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 20, color: 'var(--sv-ink)', textAlign: 'center' }}>
          {t('handsFreeTitle')}
        </p>
        <p style={{ fontSize: 13, color: 'var(--sv-muted)', textAlign: 'center', marginBottom: 16 }}>
          {t('handsFreeSubtitle')}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          {machines.length > 0 ? (
            <MachineSelect value={machine} onChange={setMachine} machines={machines} />
          ) : (
            <span style={{ fontSize: 13, color: 'var(--sv-muted)' }}>{t('noMachinesAssigned')}</span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <button
            onClick={handleMicTap}
            disabled={state === STATE.THINKING || state === STATE.TRANSCRIBING || !machine}
            style={{
              width: 96, height: 96, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--sv-brass)',
              boxShadow: state === STATE.LISTENING ? '0 0 0 8px var(--sv-brass-soft)' : '0 0 0 8px transparent',
              marginBottom: 12, transition: 'box-shadow 0.2s ease',
            }}
            aria-label={state === STATE.LISTENING ? t('stopListeningAria') : t('startListeningAria')}
          >
            <Mic size={36} color="#fff" />
          </button>
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--sv-brass)' }}>
            <Waves size={14} />
            {statusLabel}
          </p>
          {state === STATE.LISTENING && (
            <p style={{ fontSize: 11, color: 'var(--sv-muted)', marginTop: 4 }}>
              {t('tapAgainToStop') || 'Tap again when done'}
            </p>
          )}
        </div>

        {(lastQuestion || lastAnswer) && (
          <div className="sv-card" style={{ marginBottom: 24 }}>
            {lastQuestion && <p style={{ fontSize: 13, color: 'var(--sv-muted)', marginBottom: 6 }}>{t('youAsked', { question: lastQuestion })}</p>}
            {lastAnswer && <p style={{ fontSize: 14, color: 'var(--sv-ink)' }}>{lastAnswer}</p>}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ToggleRow
            title={t('continuousListeningTitle')}
            note={t('continuousListeningNote')}
            value={prefs.continuous}
            onChange={(v) => update({ continuous: v })}
          />
          <ToggleRow
            title={t('speakAnswersTitle')}
            note={t('speakAnswersNote')}
            value={prefs.spoken}
            onChange={(v) => update({ spoken: v })}
          />
          {/* <div className="sv-card">
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--sv-ink)', marginBottom: 8 }}>{t('activationTitle')}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {['wake', 'ptt'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => update({ activation: mode })}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 'var(--sv-radius-full)',
                    background: prefs.activation === mode ? 'var(--sv-activation-bg)' : 'transparent',
                    color: prefs.activation === mode ? 'var(--sv-activation-text)' : 'var(--sv-muted)',
                    border: `1px solid ${prefs.activation === mode ? 'var(--sv-activation-bg)' : 'var(--sv-activation-border)'}`,
                  }}
                >
                  {mode === 'wake' ? t('activationWake') : t('activationPtt')}
                </button>
              ))}
            </div>
            {prefs.activation === 'wake' && (
              <p style={{ fontSize: 11, color: 'var(--sv-muted)', marginTop: 8 }}>
                {t('wakeWordHint')}
              </p>
            )}
          </div> */}
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ title, note, value, onChange }) {
  return (
    <div className="sv-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--sv-ink)' }}>{title}</p>
        <p style={{ fontSize: 12, color: 'var(--sv-muted)' }}>{note}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        aria-pressed={value}
        aria-label={title}
        style={{
          width: 40, height: 24, borderRadius: 'var(--sv-radius-full)', position: 'relative',
          background: value ? 'var(--sv-teal)' : 'var(--sv-border)', flexShrink: 0,
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute',
          top: 3, left: value ? 20 : 3, transition: 'left 0.15s ease',
        }} />
      </button>
    </div>
  );
}