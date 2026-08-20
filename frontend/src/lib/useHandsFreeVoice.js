import { useCallback, useEffect, useRef, useState } from 'react';
import { Api } from './api';

// Tunables for voice-activity detection. Levels are 0-100 (RMS of the
// time-domain waveform, scaled). Worked out for a phone/laptop mic held
// or sitting a couple feet away on a shop floor — noisier than an office,
// so the threshold sits well above typical background hum/machinery
// rather than office-quiet levels.
const SPEECH_LEVEL = 10; // above this = "someone is talking"
const SILENCE_MS = 1100; // stop recording after this much continuous quiet
const MIN_SPEECH_MS = 350; // ignore blips shorter than this (throat clear, bump)
const MAX_RECORD_MS = 25000; // hard safety cap per turn

// Barge-in needs a HIGHER bar than normal speech detection and a longer
// sustain window. Without this, on a device without headphones, the
// TTS answer itself bleeding out of the speaker and back into the mic
// would look exactly like the worker interrupting — cutting the answer
// off after half a word, every single time. getUserMedia's echoCancellation
// constraint (requested below) handles most of this at the OS/browser
// level, but it isn't guaranteed on every device, so this is a second,
// cheap line of defense: require a clearly louder, clearly sustained
// signal before treating it as a real interruption.
const BARGE_IN_LEVEL = 22;
const BARGE_IN_SUSTAIN_MS = 380;

/**
 * Real hands-free voice I/O: opens ONE mic stream for the whole session
 * (instead of re-requesting getUserMedia every turn, which both re-prompts
 * permission-adjacent UI on some browsers and adds a beat of latency to
 * every turn) and runs a lightweight Web Audio analyser on it to detect
 * speech vs silence. That powers two things a tap-to-stop flow can't do:
 *
 *  1. Auto-stop: recording ends itself ~1.1s after the worker stops
 *     talking — no second tap needed, which matters when their hands are
 *     on a tool or full of parts.
 *  2. Barge-in: while an answer is being read aloud, the same analyser
 *     keeps listening (at a stricter threshold — see BARGE_IN_LEVEL
 *     above). If the worker starts talking over it, playback is cut and
 *     a new recording starts immediately, like interrupting a person
 *     mid-sentence instead of waiting them out.
 *
 * This is NOT wake-word detection — there's no keyword spotting model
 * here, just amplitude-based voice activity detection. It requires one
 * initial tap (browsers won't grant mic access without a user gesture),
 * after which the whole conversation loop runs without further taps as
 * long as "Auto" activation is selected.
 *
 * Real-world hardening in this version:
 *  - Requests echoCancellation/noiseSuppression/autoGainControl so a
 *    played-back answer doesn't re-trigger the mic as if it were the
 *    worker talking (the single biggest failure mode without a headset).
 *  - Records using whatever mimeType the browser actually supports
 *    (Safari/iOS records audio/mp4, not webm) and reports that type back
 *    so the upload isn't mislabeled.
 *  - Guards against double-opening a session (rapid double-tap), against
 *    driving an already-closed session, and against state updates after
 *    the component unmounts mid-request.
 *  - Auto-suspends the mic if the tab is hidden/backgrounded, and does
 *    not auto-resume — a mic left silently hot while a worker has
 *    switched apps is both a battery drain and a privacy problem.
 */
export function useHandsFreeVoice() {
  const [micLevel, setMicLevel] = useState(0); // 0-100, live, for UI meter
  const [sessionOpen, setSessionOpen] = useState(false);

  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const mimeTypeRef = useRef('');

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingRef = useRef(false);
  const speechStartedAtRef = useRef(null);
  const lastSpeechAtRef = useRef(null);
  const recordStartedAtRef = useRef(null);

  const bargeWatchRef = useRef(null); // { onSpeech } while set, barge-in watch is active
  const bargeSpeechStartRef = useRef(null);

  const openingRef = useRef(false); // guards against a rapid double-tap opening two sessions at once
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const levelLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    const level = Math.min(100, Math.round(rms * 100 * 3.2)); // scaled for mic-gain headroom
    if (mountedRef.current) setMicLevel(level);

    const now = performance.now();
    const isSpeech = level > SPEECH_LEVEL;

    // --- Barge-in watch (only active while caller registered one) ---
    if (bargeWatchRef.current) {
      const isBargeSpeech = level > BARGE_IN_LEVEL;
      if (isBargeSpeech) {
        if (!bargeSpeechStartRef.current) bargeSpeechStartRef.current = now;
        if (now - bargeSpeechStartRef.current >= BARGE_IN_SUSTAIN_MS) {
          const cb = bargeWatchRef.current.onSpeech;
          bargeWatchRef.current = null;
          bargeSpeechStartRef.current = null;
          cb?.();
        }
      } else {
        bargeSpeechStartRef.current = null;
      }
    }

    // --- Auto-stop-on-silence (only while actively recording) ---
    if (recordingRef.current) {
      if (isSpeech) {
        lastSpeechAtRef.current = now;
        if (!speechStartedAtRef.current) speechStartedAtRef.current = now;
      }
      const elapsed = now - recordStartedAtRef.current;
      const hadRealSpeech = speechStartedAtRef.current && (lastSpeechAtRef.current - speechStartedAtRef.current >= MIN_SPEECH_MS);
      const quietFor = lastSpeechAtRef.current ? now - lastSpeechAtRef.current : elapsed;

      if (elapsed >= MAX_RECORD_MS) {
        stopRecordingSegment();
      } else if (hadRealSpeech && quietFor >= SILENCE_MS) {
        stopRecordingSegment();
      }
    }

    rafRef.current = requestAnimationFrame(levelLoop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Opens the mic once for the whole hands-free session. Must be called from a user-gesture handler (tap). */
  const openSession = useCallback(async (onError) => {
    if (streamRef.current) return true;
    if (openingRef.current) return false; // already opening — ignore the double-tap
    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.('This browser does not support microphone access. Try Chrome or Safari.');
      return false;
    }
    openingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Critical for barge-in: without this, a played-back answer
          // bleeding out of the speaker and back into the mic looks
          // identical to the worker interrupting, cutting every answer
          // off almost immediately on a device without headphones.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        openingRef.current = false;
        return false;
      }
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      // iOS/Safari can create the context in a "suspended" state even
      // inside a user-gesture handler; resume() is safe to call
      // unconditionally and is a no-op if already running.
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch { /* best effort */ }
      }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      // Pick whatever the browser actually supports, in preference order.
      // Safari records audio/mp4 (no webm audio recording support at all
      // on many versions); Chrome/Firefox/Android record webm/opus.
      mimeTypeRef.current = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(
        (type) => window.MediaRecorder?.isTypeSupported?.(type),
      ) || '';

      setSessionOpen(true);
      rafRef.current = requestAnimationFrame(levelLoop);
      openingRef.current = false;
      return true;
    } catch (err) {
      openingRef.current = false;
      onError?.(err?.name === 'NotAllowedError' ? 'Microphone access was denied.' : 'Could not access the microphone.');
      return false;
    }
  }, [levelLoop]);

  const closeSession = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    bargeWatchRef.current = null;
    bargeSpeechStartRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.ondataavailable = null;
      recorderRef.current.onstop = null;
      try { recorderRef.current.stop(); } catch { /* noop */ }
    }
    recordingRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    if (mountedRef.current) {
      setSessionOpen(false);
      setMicLevel(0);
    }
  }, []);

  // If the tab is backgrounded mid-session, don't leave the mic silently
  // recording with nobody looking at the screen — end the session. The
  // worker sees "Tap to start hands-free" again when they come back,
  // which is the safer default over a mic left hot indefinitely.
  useEffect(() => {
    function onVisibility() {
      if (document.hidden && streamRef.current) closeSession();
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [closeSession]);

  function stopRecordingSegment() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    recordingRef.current = false;
    recorder.stop();
  }

  /**
   * Starts one recording segment on the already-open stream. Resolves via
   * onResult({ transcript, language_code }) once Sarvam has transcribed it,
   * or onError(message). Auto-stops itself on trailing silence — the
   * caller doesn't need to call anything to end it (though `cancelTurn`
   * is available for e.g. navigating away mid-turn).
   */
  const listenOnce = useCallback((onResult, onError) => {
    const stream = streamRef.current;
    if (!stream) { onError?.('Mic session not open.'); return; }

    chunksRef.current = [];
    const mimeType = mimeTypeRef.current;
    let recorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      // mimeType turned out unsupported after all (some browsers lie in
      // isTypeSupported edge cases) — fall back to browser default.
      recorder = new MediaRecorder(stream);
    }
    const actualType = recorder.mimeType || mimeType || 'audio/webm';
    const ext = actualType.includes('mp4') ? 'm4a' : actualType.includes('ogg') ? 'ogg' : 'webm';

    recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      if (!mountedRef.current) return;
      if (!chunksRef.current.length) { onError?.('No audio captured.'); return; }
      try {
        const blob = new Blob(chunksRef.current, { type: actualType });
        const res = await Api.transcribe(blob, `audio.${ext}`);
        if (!mountedRef.current) return;
        if (!res.transcript?.trim()) {
          onError?.('__EMPTY__'); // sentinel: caller decides how to handle "heard nothing"
          return;
        }
        onResult(res);
      } catch (err) {
        if (mountedRef.current) onError?.(err.message || 'Transcription failed.');
      }
    };
    recorder.onerror = () => {
      recordingRef.current = false;
      if (mountedRef.current) onError?.('Recording failed unexpectedly.');
    };

    recorderRef.current = recorder;
    recordStartedAtRef.current = performance.now();
    speechStartedAtRef.current = null;
    lastSpeechAtRef.current = null;
    recordingRef.current = true;
    recorder.start();
  }, []);

  /** Force-ends the current segment early (manual "done talking" tap in PTT mode). */
  const stopListening = useCallback(() => {
    stopRecordingSegment();
  }, []);

  /** Abandons the current segment with no transcription (used for exit/cancel). */
  const cancelTurn = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try { recorder.stop(); } catch { /* noop */ }
    }
    recordingRef.current = false;
  }, []);

  /** Registers a one-shot listener for barge-in speech while TTS is playing. Auto-clears once fired. */
  const watchForBargeIn = useCallback((onSpeech) => {
    bargeSpeechStartRef.current = null;
    bargeWatchRef.current = { onSpeech };
  }, []);

  const clearBargeInWatch = useCallback(() => {
    bargeWatchRef.current = null;
    bargeSpeechStartRef.current = null;
  }, []);

  return {
    sessionOpen,
    micLevel,
    openSession,
    closeSession,
    listenOnce,
    stopListening,
    cancelTurn,
    watchForBargeIn,
    clearBargeInWatch,
  };
}