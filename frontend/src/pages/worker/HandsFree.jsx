import { useEffect, useRef, useState } from 'react';
import { Mic, Waves, Square, Volume2 } from 'lucide-react';
import MachineSelect from '../../components/MachineSelect';
import { Api } from '../../lib/api';
import { useHandsFreeVoice } from '../../lib/useHandsFreeVoice';
import { useToast } from '../../lib/toast';
import { useHandsFreeSession } from '../../lib/workerSession';
import { useI18n } from '../../lib/i18n';

const KEY = 'sv_handsfree_prefs';
function loadPrefs() {
  try {
    return { continuous: true, spoken: true, activation: 'auto', ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { continuous: true, spoken: true, activation: 'auto' };
  }
}
function savePrefs(p) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

const STATE = {
  OFF: 'off',           // session not started yet — needs a tap to grant mic access
  IDLE: 'idle',          // session open, nothing happening (PTT mode between turns)
  LISTENING: 'listening',
  TRANSCRIBING: 'transcribing',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
};

const DEFAULT_LANG = 'en-IN';

// Two short beeps via Web Audio oscillator — no audio asset needed, and
// they give the worker a clear non-visual cue for "go ahead" / "got it",
// since they likely aren't looking at the screen.
function beep(freq, ms) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + ms / 1000 + 0.02);
    osc.onended = () => ctx.close().catch(() => {});
  } catch { /* non-critical */ }
}

/**
 * Real hands-free loop, built on useHandsFreeVoice (see that file for the
 * VAD/barge-in mechanics). Once the worker taps the mic once to open the
 * session:
 *
 *   listening (auto-stops on ~1.1s silence) -> transcribing -> thinking
 *   -> speaking the answer aloud -> back to listening
 *
 * ...with zero further taps in "Auto" activation mode. If the worker talks
 * over a playing answer, it barges in: playback cuts and their new
 * question starts recording immediately. "Push-to-talk" activation keeps
 * the older tap-to-start/tap-to-stop behavior for noisy environments where
 * amplitude-based silence detection isn't reliable (e.g. right next to a
 * running machine).
 *
 * The mic stream itself can't survive navigating to another tab (browser
 * tears it down with the component), so leaving Hands-free always ends
 * the session — but the last question/answer live in
 * WorkerSessionProvider so they're still there if the worker comes back.
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

  const [state, setState] = useState(busy ? STATE.THINKING : STATE.OFF);
  const [detectedLang, setDetectedLang] = useState(DEFAULT_LANG);
  const audioRef = useRef(null);
  const { push } = useToast();
  const voice = useHandsFreeVoice();
  const stateRef = useRef(state);
  stateRef.current = state;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const machineRef = useRef(machine);
  machineRef.current = machine;

  useEffect(() => {
    Api.myMachines()
      .then((res) => {
        setMachines(res.machine_ids || []);
        if (res.machine_ids?.length && !machine) setMachine(res.machine_ids[0]);
      })
      .catch((err) => push(err.message, 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    audioRef.current?.pause();
    voice.closeSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(patch) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
  }

  async function handleEnterHandsFree() {
    if (!machine) {
      push(t('noMachineAssignedYet'), 'info');
      return;
    }
    const ok = await voice.openSession((err) => push(err || t('micErrorHandsFree'), 'error'));
    if (!ok) return;
    if (prefsRef.current.activation === 'auto') {
      startListeningTurn();
    } else {
      setState(STATE.IDLE);
    }
  }

  function handleExitHandsFree() {
    audioRef.current?.pause();
    voice.cancelTurn();
    voice.clearBargeInWatch();
    voice.closeSession();
    setState(STATE.OFF);
  }

  function startListeningTurn() {
    if (!machineRef.current) return;
    setState(STATE.LISTENING);
    beep(760, 90);
    voice.listenOnce(
      ({ transcript, language_code }) => {
        if (language_code) setDetectedLang(language_code);
        setState(STATE.THINKING);
        handleQuestion(transcript, language_code || detectedLang);
      },
      (err) => {
        if (err === '__EMPTY__') {
          // Heard silence/noise, nothing worth sending — just try again
          // rather than erroring out, since a worker mid-task may pause
          // before speaking.
          if (stateRef.current === STATE.LISTENING) startListeningTurn();
          return;
        }
        setState(STATE.IDLE);
        push(err || t('micErrorHandsFree'), 'error');
      },
    );
  }

  function stopListeningTurn() {
    // Manual "done talking" for PTT mode — VAD normally handles this itself.
    setState(STATE.TRANSCRIBING);
    voice.stopListening();
  }

  async function handleQuestion(transcript, lang) {
    setLastQuestion(transcript);
    setLastAnswer('');
    setBusy(true);
    try {
      const res = await Api.ask(transcript, machineRef.current);
      setLastAnswer(res.answer);
      setBusy(false);
      if (prefsRef.current.spoken) {
        await speak(res.answer, lang);
      } else {
        advanceAfterTurn();
      }
    } catch (err) {
      push(err.message, 'error');
      setBusy(false);
      advanceAfterTurn();
    }
  }

  function advanceAfterTurn() {
    if (prefsRef.current.continuous && prefsRef.current.activation === 'auto' && voice.sessionOpen) {
      startListeningTurn();
    } else {
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

      // Barge-in: while this plays, keep listening on the still-open mic
      // session. If the worker starts talking, cut playback immediately
      // and roll straight into a new recording — no waiting for the
      // answer to finish.
      if (prefsRef.current.activation === 'auto') {
        voice.watchForBargeIn(() => {
          audio.pause();
          URL.revokeObjectURL(url);
          startListeningTurn();
        });
      }

      audio.onended = () => {
        URL.revokeObjectURL(url);
        voice.clearBargeInWatch();
        advanceAfterTurn();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        voice.clearBargeInWatch();
        advanceAfterTurn();
      };
      await audio.play();
    } catch (err) {
      push(t('spokenAnswerError'), 'error');
      advanceAfterTurn();
    }
  }

  function handleMicTap() {
    if (state === STATE.OFF) {
      handleEnterHandsFree();
      return;
    }
    if (state === STATE.LISTENING) {
      if (prefs.activation === 'ptt') stopListeningTurn();
      return; // in auto mode, VAD ends it — tapping mid-listen does nothing surprising
    }
    if (state === STATE.SPEAKING) {
      audioRef.current?.pause();
      voice.clearBargeInWatch();
      advanceAfterTurn();
      return;
    }
    if (state === STATE.THINKING || state === STATE.TRANSCRIBING) return;
    if (state === STATE.IDLE) startListeningTurn();
  }

  const statusLabel = {
    [STATE.OFF]: t('statusTapToStart') || 'Tap to start hands-free',
    [STATE.IDLE]: prefs.activation === 'auto' ? (t('statusIdleAuto') || 'Ready — tap to ask') : t('statusIdlePtt'),
    [STATE.LISTENING]: prefs.activation === 'auto' ? (t('statusListeningAuto') || "Listening… I'll know when you're done") : t('statusListening'),
    [STATE.TRANSCRIBING]: t('transcribing') || t('thinking'),
    [STATE.THINKING]: t('thinking'),
    [STATE.SPEAKING]: prefs.activation === 'auto' ? (t('statusSpeakingBargeIn') || 'Speaking… talk anytime to interrupt') : t('statusSpeaking'),
  }[state];

  const isBusyState = state === STATE.THINKING || state === STATE.TRANSCRIBING;
  const ringLevel = state === STATE.LISTENING ? Math.max(8, voice.micLevel) : 0;

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
            <MachineSelect value={machine} onChange={setMachine} machines={machines} disabled={state !== STATE.OFF} />
          ) : (
            <span style={{ fontSize: 13, color: 'var(--sv-muted)' }}>{t('noMachinesAssigned')}</span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ position: 'relative', width: 96, height: 96, marginBottom: 12 }}>
            {/* Live level ring while actively listening — real amplitude feedback instead of a static pulse */}
            {state === STATE.LISTENING && (
              <div style={{
                position: 'absolute', inset: -Math.round(ringLevel * 0.5),
                borderRadius: '50%', border: '3px solid var(--sv-brass-soft)',
                opacity: 0.6, transition: 'inset 0.08s linear',
              }} />
            )}
            <button
              onClick={handleMicTap}
              disabled={isBusyState}
              style={{
                position: 'relative', width: 96, height: 96, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: state === STATE.SPEAKING ? 'var(--sv-teal)' : 'var(--sv-brass)',
                boxShadow: state === STATE.LISTENING ? '0 0 0 8px var(--sv-brass-soft)' : '0 0 0 8px transparent',
                transition: 'box-shadow 0.2s ease, background 0.2s ease',
                cursor: isBusyState ? 'not-allowed' : 'pointer',
              }}
              aria-label={state === STATE.LISTENING ? t('stopListeningAria') : t('startListeningAria')}
            >
              {state === STATE.SPEAKING ? <Volume2 size={36} color="#fff" /> : <Mic size={36} color="#fff" />}
            </button>
          </div>

          <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--sv-brass)', textAlign: 'center' }}>
            <Waves size={14} />
            {statusLabel}
          </p>

          {state === STATE.LISTENING && prefs.activation === 'ptt' && (
            <button
              onClick={stopListeningTurn}
              className="sv-btn sv-btn--outline"
              style={{ marginTop: 10, fontSize: 12, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Square size={12} /> {t('tapAgainToStop') || "I'm done"}
            </button>
          )}

          {state !== STATE.OFF && (
            <button
              onClick={handleExitHandsFree}
              style={{ marginTop: 14, fontSize: 12, color: 'var(--sv-muted)', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
            >
              {t('exitHandsFree') || 'Exit hands-free'}
            </button>
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
          <div className="sv-card">
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--sv-ink)', marginBottom: 2 }}>{t('activationTitle') || 'Listening mode'}</p>
            <p style={{ fontSize: 12, color: 'var(--sv-muted)', marginBottom: 8 }}>
              {t('activationNote') || 'Auto stops recording itself when you stop talking. Push-to-talk needs a tap to end each turn.'}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {['auto', 'ptt'].map((mode) => (
                <button
                  key={mode}
                  disabled={state !== STATE.OFF && state !== STATE.IDLE}
                  onClick={() => update({ activation: mode })}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 'var(--sv-radius-full)',
                    background: prefs.activation === mode ? 'var(--sv-activation-bg)' : 'transparent',
                    color: prefs.activation === mode ? 'var(--sv-activation-text)' : 'var(--sv-muted)',
                    border: `1px solid ${prefs.activation === mode ? 'var(--sv-activation-bg)' : 'var(--sv-activation-border)'}`,
                    cursor: (state !== STATE.OFF && state !== STATE.IDLE) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {mode === 'auto' ? (t('activationAuto') || 'Auto (hands-free)') : t('activationPtt')}
                </button>
              ))}
            </div>
          </div>
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