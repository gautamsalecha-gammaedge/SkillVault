import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, PauseCircle, X, Sparkles, Bot, Volume2, History } from 'lucide-react';
import { Api, mediaUrl } from '../../lib/api';
import { getWorkerName } from '../../lib/auth';
import { LANGUAGES, getLanguage, setLanguage } from '../../lib/languages';
import { useToast } from '../../lib/toast';
import MachineSelect from '../../components/MachineSelect';
import { getBrowserVoice } from '../../lib/voiceCapabilities';

/* How long the "take a moment to think" countdown runs before the mic
   auto-starts listening. A worker can always tap "I'm ready" to skip
   it early - this is a ceiling on thinking time, not a race. Kept as
   a constant so it's a one-line tune, not a hunt through the component. */
const THINK_SECONDS = 10;

/* Interview machine states. Every one of these maps to exactly what
   the worker sees in the orb + status label, so state name and UI
   never drift apart. */
const STAGE = {
  SETUP: 'setup',
  RESUME_CHOICE: 'resume_choice', // resumable session found - ask continue vs fresh
  AI_SPEAKING: 'ai_speaking',
  COUNTDOWN: 'countdown',
  LISTENING: 'listening',
  THINKING: 'thinking',
  DONE: 'done',
};

export default function Interview() {
  const toast = useToast();
  const workerName = getWorkerName();

  const [machines, setMachines] = useState([]);
  const [machineId, setMachineId] = useState('');
  const [language, setLang] = useState(getLanguage());
  const [loadingMachines, setLoadingMachines] = useState(true);

  const [session, setSession] = useState(null); // latest _session_state payload
  const [stage, setStage] = useState(STAGE.SETUP);
  const [thread, setThread] = useState([]); // [{speaker: 'ai'|'worker', text, muted}]
  const [countdown, setCountdown] = useState(THINK_SECONDS);
  const [micLevel, setMicLevel] = useState(0); // 0..1, drives the waveform
  const [error, setError] = useState('');
  const [insightsToast, setInsightsToast] = useState(0);
  const [resumeInfo, setResumeInfo] = useState(null); // { topic_index, total_topics, insights_captured, ... }

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null); // the Web Audio context behind the mic-level meter - closed on cleanup so contexts don't pile up across turns
  const rafRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const audioElRef = useRef(null);
  const utteranceRef = useRef(null); // browser SpeechSynthesisUtterance currently playing, if any
  const liveCaptionRef = useRef(null); // browser SpeechRecognition, display-only
  const listeningRef = useRef(false); // true only while we WANT the live caption running - lets onend know whether to auto-restart after a silence timeout vs a real stop
  const workerLineIdRef = useRef(null); // id of the single thread line for the answer currently being recorded/retried, so retries update it in place instead of stacking new lines
  const mountedRef = useRef(true); // guards async callbacks (STT/TTS/submit) from touching state or toasting after the worker has navigated away
  const activeRef = useRef(false); // true only while an interview is actually meant to be running - separate from mountedRef, because pausing/ending doesn't unmount the page, it just leaves the flow. Without this, a getUserMedia() call still in flight when "End interview now" is clicked resolves AFTER cleanup already ran, hands back a live mic stream nothing ever stops, and that's what left the browser's mic-in-use indicator on.
  const lastAiLineRef = useRef(null); // { text, langCode } for the most recent AI line, so it can be replayed manually if TTS failed or the worker just wants to hear it again

  useEffect(() => {
    Api.myMachines()
      .then((res) => {
        const list = res?.machine_ids || [];
        setMachines(list);
        if (list.length) setMachineId(list[0]);
      })
      .catch(() => setError('Could not load your assigned machines.'))
      .finally(() => setLoadingMachines(false));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupAudioLoop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function cleanupAudioLoop() {
    activeRef.current = false;
    listeningRef.current = false; // stop the SpeechRecognition onend handler from auto-restarting
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    // Stop the recorder itself (not just the tracks) so nothing is left
    // mid-recording - leaving this out is what let the browser's mic-in-use
    // indicator (and, transitively, its permission state) stay lit after
    // navigating away from an in-progress answer.
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.ondataavailable = null; recorderRef.current.onstop = null; recorderRef.current.stop(); } catch (_) {}
    }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch (_) {}
      audioCtxRef.current = null;
    }
    if (liveCaptionRef.current) {
      try { liveCaptionRef.current.onend = null; liveCaptionRef.current.onerror = null; liveCaptionRef.current.stop(); } catch (_) {}
      liveCaptionRef.current = null;
    }
    if (audioElRef.current) {
      try { audioElRef.current.pause(); audioElRef.current.src = ''; } catch (_) {}
      audioElRef.current = null;
    }
    if (utteranceRef.current) {
      try { window.speechSynthesis?.cancel(); } catch (_) {}
      utteranceRef.current = null;
    }
  }

  function pushLine(speaker, text, muted = false) {
    setThread((t) => [...t, { id: `${Date.now()}-${Math.random()}`, speaker, text, muted }]);
  }

  /* Every fresh question resets which thread line the worker's answer
     (and any retries of it) should land on - see beginWorkerLine. */
  function forgetWorkerLine() {
    workerLineIdRef.current = null;
  }

  /* Starts (or, on a retry after a failed transcription, REUSES) the one
     thread line that represents the current answer attempt. Previously
     this was a plain pushLine on every call, so each retry after a
     "Could not transcribe" left the old failed line in place AND added a
     new one underneath it, stacking up duplicate lines - see the bug
     report. Now there's exactly one line per question, updated in place. */
  function beginWorkerLine() {
    if (workerLineIdRef.current) {
      setWorkerLineText('');
      return;
    }
    const id = `${Date.now()}-${Math.random()}`;
    workerLineIdRef.current = id;
    setThread((t) => [...t, { id, speaker: 'worker', text: '' }]);
  }

  function setWorkerLineText(text) {
    setThread((t) => t.map((l) => (l.id === workerLineIdRef.current ? { ...l, text } : l)));
  }

  /* ---------------- TTS playback for AI lines ----------------
     Tries the browser's own SpeechSynthesis first when it has a voice
     for langCode - on-device, no backend round trip. Falls back to the
     backend's Sarvam-backed Api.speak when the browser has no matching
     voice, or if browser playback errors out mid-utterance. */
  async function playSpeech(text, langCode) {
    const browserVoice = getBrowserVoice(langCode);
    if (browserVoice) {
      const played = await new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = browserVoice;
        utterance.lang = langCode;
        utteranceRef.current = utterance;
        utterance.onend = () => { utteranceRef.current = null; resolve(true); };
        utterance.onerror = () => { utteranceRef.current = null; resolve(false); };
        window.speechSynthesis.speak(utterance);
      });
      if (played) return;
      // Browser voice failed mid-flight - fall through to Sarvam below.
    }

    const blob = await Api.speak(text, langCode);
    if (!mountedRef.current) return;
    const url = URL.createObjectURL(blob);
    await new Promise((resolve) => {
      const audio = new Audio(url);
      audioElRef.current = audio;
      audio.onended = resolve;
      audio.onerror = resolve;
      audio.play().catch(resolve);
    });
    URL.revokeObjectURL(url);
  }

  async function speakAndShow(text, langCode) {
    setStage(STAGE.AI_SPEAKING);
    pushLine('ai', text);
    forgetWorkerLine();
    lastAiLineRef.current = { text, langCode };
    try {
      await playSpeech(text, langCode);
    } catch (e) {
      // TTS failed - the text is already on screen, so the flow can
      // continue without audio rather than getting stuck. Surface it
      // (once, not per-turn-spam) instead of silently swallowing it, so
      // a real backend/TTS problem is visible instead of looking like
      // the AI simply doesn't talk.
      if (mountedRef.current) toast.push('Could not play audio for that question — reading it is still fine. Tap the speaker icon to retry.', 'error');
    }
  }

  /* Lets the worker manually replay the last AI line - covers both "TTS
     failed, let me retry" and "I just want to hear that again". */
  async function replayLastAiLine() {
    if (!lastAiLineRef.current) return;
    const { text, langCode } = lastAiLineRef.current;
    try {
      await playSpeech(text, langCode);
    } catch (e) {
      toast.push('Still could not play audio. Check your connection and try again.', 'error');
    }
  }

  /* ---------------- Flow: start / resume ---------------- */
  async function handleStart() {
    if (!machineId) return;
    setLanguage(language);
    setError('');
    setThread([]);
    forgetWorkerLine();
    try {
      const check = await Api.checkInterview(machineId);
      if (!mountedRef.current) return;
      if (check.resumable) {
        setResumeInfo(check);
        setStage(STAGE.RESUME_CHOICE);
        return;
      }
      await launchInterview(false);
    } catch (e) {
      // If the check itself fails, don't block the worker from starting -
      // fall through to a normal start, which still resumes server-side
      // if something's there.
      await launchInterview(false);
    }
  }

  async function launchInterview(fresh) {
    setError('');
    try {
      const res = await Api.startInterview(machineId, language, fresh);
      if (!mountedRef.current) return;
      activeRef.current = true;
      setSession(res);
      if (res.resumed) {
        toast.push(`Welcome back — picking up where you left off on ${machineId}.`, 'info');
        forgetWorkerLine();
        pushLine('ai', res.current_question ? res.current_question : 'Let\u2019s continue.');
        lastAiLineRef.current = { text: res.current_question || 'Let\u2019s continue.', langCode: res.language_code || language };
        beginThinkWindow();
      } else {
        await runNextQuestion(res, res.current_question, true);
      }
    } catch (e) {
      if (mountedRef.current) setError(e.message || 'Could not start the interview.');
    }
  }

  function handleContinue() {
    launchInterview(false);
  }

  function handleStartFresh() {
    launchInterview(true);
  }

  async function runNextQuestion(sess, questionText, isFirst = false) {
    if (sess.completed) {
      setStage(STAGE.DONE);
      return;
    }
    await speakAndShow(questionText, sess.language_code || language);
    beginThinkWindow();
  }

  /* ---------------- Countdown ("take a moment") ---------------- */
  function beginThinkWindow() {
    setStage(STAGE.COUNTDOWN);
    setCountdown(THINK_SECONDS);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownTimerRef.current);
          startListening();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  function skipCountdown() {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    startListening();
  }

  /* ---------------- Listening (record + live caption) ---------------- */
  async function startListening() {
    setStage(STAGE.LISTENING);
    beginWorkerLine();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // The worker may have paused/ended the interview (or navigated away)
      // WHILE this permission prompt/await was pending - if so, this is a
      // stale stream nobody is going to stop otherwise. Kill it immediately
      // instead of wiring it up.
      if (!mountedRef.current || !activeRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;

      // Mic level meter for the waveform, purely visual.
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setMicLevel(Math.min(1, avg / 90));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      }

      // Live, display-only caption via the browser's own speech recognition
      // (if available) - purely cosmetic so the worker sees words appear
      // as they talk. The authoritative transcript still comes from
      // Sarvam STT (Api.transcribe) once recording stops.
      //
      // Chrome (and most engines) silently end the recognition session
      // after a few seconds of silence, even with continuous=true - if
      // a worker pauses for a beat mid-answer, `onend` fires and the
      // caption just stops updating even though the mic (and the actual
      // MediaRecorder audio) is still fine. Restarting on `onend` (while
      // still in the listening stage) is what makes a mid-answer pause
      // not look broken.
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        listeningRef.current = true;
        const startRecognition = () => {
          const rec = new SpeechRec();
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = (e) => {
            let text = '';
            for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
            setWorkerLineText(text);
          };
          // 'no-speech' just means it timed out waiting - not a real
          // error, `onend` (below) handles restarting it either way.
          rec.onerror = () => {};
          rec.onend = () => {
            if (listeningRef.current) {
              try { rec.start(); } catch (_) { setTimeout(startRecognition, 300); }
            }
          };
          try { rec.start(); } catch (_) {}
          liveCaptionRef.current = rec;
        };
        startRecognition();
      }

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = handleRecordingStopped;
      recorderRef.current = recorder;
      recorder.start();
    } catch (e) {
      if (mountedRef.current) {
        setError('Microphone access is needed to answer. Please allow it and try again.');
        setStage(STAGE.COUNTDOWN);
      }
    }
  }

  function stopListening() {
    listeningRef.current = false; // tell the live-caption onend handler not to restart
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }

  async function handleRecordingStopped() {
    listeningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setMicLevel(0);
    if (liveCaptionRef.current) { try { liveCaptionRef.current.onend = null; liveCaptionRef.current.stop(); } catch (_) {} liveCaptionRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch (_) {} audioCtxRef.current = null; }
    if (!mountedRef.current || !activeRef.current) return; // worker paused/ended while this recording was wrapping up

    setStage(STAGE.THINKING);
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

    // A near-empty recording (worker tapped stop almost immediately, or
    // the mic never actually picked anything up) is worth catching
    // client-side with a clear message, rather than sending it to Sarvam
    // and getting back the more generic "couldn't hear anything".
    if (blob.size < 2000) {
      setWorkerLineText('(No speech detected — try answering again)');
      if (mountedRef.current) { setStage(STAGE.COUNTDOWN); setCountdown(THINK_SECONDS); }
      return;
    }

    let transcript = '';
    let detectedLang = session?.language_code || language;
    try {
      const sttRes = await Api.transcribe(blob);
      if (!mountedRef.current || !activeRef.current) return;
      transcript = sttRes.transcript || '';
      detectedLang = sttRes.language_code || detectedLang;
      setWorkerLineText(transcript || '(No speech detected)');
    } catch (e) {
      if (mountedRef.current) {
        setWorkerLineText('(Could not transcribe — try answering again)');
        setStage(STAGE.COUNTDOWN);
        setCountdown(THINK_SECONDS);
      }
      return;
    }

    pushLine('ai', 'Got it, thinking...', true);

    try {
      const res = await Api.submitInterviewAnswer(session.session_id, transcript, detectedLang, blob);
      if (!mountedRef.current || !activeRef.current) return;
      // Replace the "thinking" line with the real acknowledgement once resolved.
      setThread((t) => t.slice(0, -1));
      setSession(res);
      forgetWorkerLine();
      if (res.insight_captured) setInsightsToast((n) => n + 1);

      const ack = res.acknowledgement ? `${res.acknowledgement} ` : '';
      if (res.completed) {
        await speakAndShow(ack || 'That\u2019s everything for this session — thank you.', res.language_code);
        activeRef.current = false;
        if (mountedRef.current) setStage(STAGE.DONE);
      } else {
        const nextQ = res.current_question;
        await speakAndShow(`${ack}${nextQ}`.trim(), res.language_code);
        if (mountedRef.current) beginThinkWindow();
      }
    } catch (e) {
      if (mountedRef.current) {
        setThread((t) => t.slice(0, -1));
        setError(e.message || 'Could not submit your answer. Please try again.');
        setStage(STAGE.COUNTDOWN);
        setCountdown(THINK_SECONDS);
      }
    }
  }

  async function handlePause() {
    cleanupAudioLoop();
    if (audioElRef.current) audioElRef.current.pause();
    if (session?.session_id) {
      try { await Api.pauseInterview(session.session_id); } catch (_) {}
    }
    if (mountedRef.current) toast.push('Interview paused — pick up right where you left off next time.', 'info');
    setSession(null);
    setResumeInfo(null);
    forgetWorkerLine();
    if (mountedRef.current) setStage(STAGE.SETUP);
  }

  async function handleEndEarly() {
    cleanupAudioLoop();
    if (audioElRef.current) audioElRef.current.pause();
    if (session?.session_id) {
      try { await Api.endInterview(session.session_id); } catch (_) {}
    }
    setStage(STAGE.DONE);
  }

  function handleRestart() {
    setSession(null);
    setThread([]);
    setResumeInfo(null);
    setError('');
    forgetWorkerLine();
    setStage(STAGE.SETUP);
  }

  /* ---------------- Render ---------------- */
  if (stage === STAGE.SETUP) {
    return (
      <div className="sv-interview" style={{ justifyContent: 'center' }}>
        <div className="sv-interview__stage">
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(160deg, rgba(212,145,92,0.25), rgba(212,145,92,0.05))',
              border: '1px solid rgba(212,145,92,0.3)',
            }}>
              <Sparkles size={24} color="var(--iv-brass)" />
            </div>
            <h1 style={{ fontFamily: 'var(--sv-font-display)', fontSize: 24, margin: '0 0 8px' }}>
              Share what only you know
            </h1>
            <p style={{ color: 'var(--iv-muted)', fontSize: 14, lineHeight: 1.6, margin: '0 0 28px' }}>
              A short spoken interview about a machine you know well. Answer in your own words —
              the AI will ask follow-ups and capture the details so this knowledge isn't lost.
            </p>
          </div>

          <div className="sv-interview__thread" style={{ minHeight: 0, alignItems: 'center' }}>
            {loadingMachines ? (
              <span className="sv-interview__meta">Loading your machines…</span>
            ) : machines.length === 0 ? (
              <span className="sv-interview__meta" style={{ color: '#F87171' }}>
                You aren't assigned to any machines yet.
              </span>
            ) : (
              <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <MachineSelect value={machineId} onChange={setMachineId} machines={machines} />
                <select
                  value={language}
                  onChange={(e) => setLang(e.target.value)}
                  style={{
                    background: 'var(--iv-panel)', color: 'var(--iv-ink)',
                    border: '1px solid var(--iv-panel-border)', borderRadius: 10,
                    padding: '10px 14px', fontSize: 14, fontFamily: 'var(--sv-font-body)',
                  }}
                >
                  {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
                <button
                  onClick={handleStart}
                  style={{
                    marginTop: 6, background: 'var(--iv-brass)', color: '#1A120A', border: 'none',
                    borderRadius: 12, padding: '14px 20px', fontSize: 15, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <Mic size={18} /> Start interview
                </button>
                {error && <span style={{ color: '#F87171', fontSize: 13, textAlign: 'center' }}>{error}</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (stage === STAGE.RESUME_CHOICE) {
    const ri = resumeInfo || {};
    return (
      <div className="sv-interview" style={{ justifyContent: 'center' }}>
        <div className="sv-interview__stage">
          <div style={{
            width: 56, height: 56, borderRadius: '50%', margin: '0 auto 4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(160deg, rgba(212,145,92,0.25), rgba(212,145,92,0.05))',
            border: '1px solid rgba(212,145,92,0.3)',
          }}>
            <History size={24} color="var(--iv-brass)" />
          </div>
          <div style={{ textAlign: 'center', maxWidth: 380 }}>
            <h1 style={{ fontFamily: 'var(--sv-font-display)', fontSize: 22, margin: '0 0 8px' }}>
              You've already started this one
            </h1>
            <p style={{ color: 'var(--iv-muted)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              You're on topic {Math.min((ri.topic_index ?? 0) + 1, ri.total_topics ?? 1)} of {ri.total_topics ?? '?'} for{' '}
              <strong style={{ color: 'var(--iv-ink)' }}>{machineId}</strong>, with {ri.insights_captured ?? 0} insight
              {(ri.insights_captured ?? 0) === 1 ? '' : 's'} captured so far.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
            <button
              onClick={handleContinue}
              style={{
                background: 'var(--iv-brass)', color: '#1A120A', border: 'none',
                borderRadius: 12, padding: '14px 20px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Continue where I left off
            </button>
            <button
              onClick={handleStartFresh}
              style={{
                background: 'var(--iv-panel)', color: 'var(--iv-ink)', border: '1px solid var(--iv-panel-border)',
                borderRadius: 12, padding: '14px 20px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Start a fresh interview
            </button>
            <button
              onClick={() => setStage(STAGE.SETUP)}
              style={{ background: 'none', border: 'none', color: 'var(--iv-muted)', fontSize: 13, cursor: 'pointer', marginTop: 2 }}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === STAGE.DONE) {
    return (
      <div className="sv-interview" style={{ justifyContent: 'center' }}>
        <div className="sv-interview__stage">
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(160deg, rgba(79,191,160,0.25), rgba(79,191,160,0.05))',
            border: '1px solid rgba(79,191,160,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={30} color="var(--iv-teal)" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'var(--sv-font-display)', fontSize: 24, margin: '0 0 6px' }}>
              Thanks, {workerName || 'that\u2019s'} a wrap
            </h1>
            <p style={{ color: 'var(--iv-muted)', fontSize: 14, margin: 0 }}>
              {session?.insights_captured ?? 0} insight{(session?.insights_captured ?? 0) === 1 ? '' : 's'} captured
              from this session on <strong style={{ color: 'var(--iv-ink)' }}>{machineId}</strong>. They're
              queued for a quick admin review before going live.
            </p>
          </div>
          <button
            onClick={handleRestart}
            style={{
              background: 'var(--iv-panel)', color: 'var(--iv-ink)', border: '1px solid var(--iv-panel-border)',
              borderRadius: 12, padding: '12px 22px', fontSize: 14, cursor: 'pointer',
            }}
          >
            Interview about another machine
          </button>
        </div>
      </div>
    );
  }

  const orbState =
    stage === STAGE.AI_SPEAKING ? 'speaking' :
    stage === STAGE.LISTENING ? 'listening' :
    stage === STAGE.THINKING ? 'thinking' : 'idle';

  const statusLabel =
    stage === STAGE.AI_SPEAKING ? 'Speaking' :
    stage === STAGE.COUNTDOWN ? 'Take a moment' :
    stage === STAGE.LISTENING ? 'Listening' :
    stage === STAGE.THINKING ? 'Processing' : '';

  const totalTopics = session?.total_topics || 1;
  const topicIndex = session?.topic_index ?? 0;

  return (
    <div className="sv-interview">
      <div className="sv-interview__topbar">
        <div className="sv-interview__topic-track" aria-label="Topic progress">
          {Array.from({ length: totalTopics }).map((_, i) => (
            <div
              key={i}
              className={
                'sv-interview__topic-dot' +
                (i < topicIndex ? ' sv-interview__topic-dot--done' : '') +
                (i === topicIndex ? ' sv-interview__topic-dot--active' : '')
              }
            />
          ))}
        </div>
        <span className="sv-interview__meta">
          {workerName} · {machineId} · Topic {Math.min(topicIndex + 1, totalTopics)}/{totalTopics}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={replayLastAiLine}
            title="Replay the AI's last question"
            style={{ background: 'none', border: 'none', color: 'var(--iv-muted)', cursor: 'pointer', display: 'flex' }}
          >
            <Volume2 size={18} />
          </button>
          <button
            onClick={handlePause}
            title="Pause interview"
            style={{ background: 'none', border: 'none', color: 'var(--iv-muted)', cursor: 'pointer', display: 'flex' }}
          >
            <PauseCircle size={20} />
          </button>
        </div>
      </div>

      <div className="sv-interview__stage">
        <div className={`sv-interview__orb-wrap sv-interview__orb--${orbState}`}>
          <div
            className="sv-interview__orb-glow"
            style={{
              background:
                orbState === 'speaking' ? 'var(--iv-brass-glow)' :
                orbState === 'listening' ? 'var(--iv-teal-glow)' :
                orbState === 'thinking' ? 'var(--iv-brass-glow)' : 'transparent',
            }}
          />
          <div className="sv-interview__orb">
            <div className="sv-interview__orb-ring" />
            {stage === STAGE.COUNTDOWN && (
              <svg width="176" height="176" style={{ position: 'absolute', inset: 0 }} className="sv-interview__countdown-ring">
                <circle cx="88" cy="88" r="80" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                <circle
                  cx="88" cy="88" r="80" fill="none" stroke="var(--iv-brass)" strokeWidth="3"
                  strokeDasharray={2 * Math.PI * 80}
                  strokeDashoffset={2 * Math.PI * 80 * (1 - countdown / THINK_SECONDS)}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
            )}
            <div className="sv-interview__orb-core" style={{
              background: orbState === 'listening'
                ? `rgba(79,191,160,${0.15 + micLevel * 0.5})`
                : 'rgba(212,145,92,0.15)',
            }}>
              {stage === STAGE.COUNTDOWN ? (
                <span style={{ fontFamily: 'var(--sv-font-mono)', fontSize: 28, color: 'var(--iv-brass)' }}>
                  {countdown}
                </span>
              ) : orbState === 'speaking' ? (
                // The AI's avatar - previously this was the same mic icon
                // used for the worker's own turn, so there was nothing on
                // screen that actually read as "the AI", just a color change.
                <Bot size={24} color="var(--iv-brass)" />
              ) : (
                <Mic size={22} color={orbState === 'listening' ? 'var(--iv-teal)' : 'var(--iv-brass)'} />
              )}
            </div>
          </div>
        </div>

        <span className="sv-interview__status-label">{statusLabel}</span>

        <div className="sv-interview__thread" ref={undefined}>
          {thread.slice(-6).map((line) => (
            <div className="sv-interview__line" key={line.id}>
              <span className={`sv-interview__line-tag sv-interview__line-tag--${line.speaker === 'ai' ? 'ai' : 'worker'}`}>
                {line.speaker === 'ai' ? <Bot size={12} /> : null}
                {line.speaker === 'ai' ? 'AI' : (workerName || 'You')}
              </span>
              <span className={`sv-interview__line-text${!line.text ? ' sv-interview__line-text--muted' : ''}`}>
                {line.text || 'Listening…'}
                {line.muted && (
                  <span className="sv-interview__thinking-dots"><span /><span /><span /></span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="sv-interview__bottombar">
        {stage === STAGE.COUNTDOWN && (
          <button
            onClick={skipCountdown}
            style={{
              background: 'var(--iv-brass)', color: '#1A120A', border: 'none', borderRadius: 999,
              padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            I'm ready
          </button>
        )}

        {stage === STAGE.LISTENING && (
          <>
            <div className="sv-interview__waveform" aria-hidden="true">
              {Array.from({ length: 16 }).map((_, i) => {
                const jitter = Math.sin(i * 1.7 + Date.now() / 200) * 0.5 + 0.5;
                const h = 4 + micLevel * 18 * (0.4 + 0.6 * jitter);
                return <span key={i} style={{ height: `${h}px` }} />;
              })}
            </div>
            <button
              onClick={stopListening}
              style={{
                background: 'var(--iv-teal)', color: '#04201A', border: 'none', borderRadius: 999,
                padding: '12px 26px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <Square size={14} fill="#04201A" /> I'm done answering
            </button>
          </>
        )}

        {(stage === STAGE.AI_SPEAKING || stage === STAGE.THINKING) && (
          <span className="sv-interview__meta">
            {stage === STAGE.AI_SPEAKING ? 'The AI is speaking…' : 'One moment…'}
          </span>
        )}

        <button
          onClick={handleEndEarly}
          style={{
            background: 'none', border: 'none', color: 'var(--iv-muted)', fontSize: 12,
            cursor: 'pointer', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <X size={13} /> End interview now
        </button>
      </div>
    </div>
  );
}