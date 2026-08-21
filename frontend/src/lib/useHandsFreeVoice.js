import { useCallback, useEffect, useRef, useState } from 'react';
import { Api } from './api';
import { getLanguage } from './languages';
import { getSpeechRecognitionCtor } from './voiceCapabilities';

const SPEECH_LEVEL = 8;
const SILENCE_MS = 1200;
const MIN_SPEECH_MS = 300;
const MAX_RECORD_MS = 20000;
const NO_SPEECH_MS = 7000;

const BARGE_IN_LEVEL = 22;
const BARGE_IN_SUSTAIN_MS = 380;

/**
 * Hands-free voice I/O: one mic session + VAD auto-stop + barge-in.
 */
export function useHandsFreeVoice() {
  const [micLevel, setMicLevel] = useState(0);
  const [sessionOpen, setSessionOpen] = useState(false);

  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const mimeTypeRef = useRef('');

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null); // browser SpeechRecognition, when used in place of MediaRecorder+Sarvam
  const recordingRef = useRef(false);
  const speechStartedAtRef = useRef(null);
  const lastSpeechAtRef = useRef(null);
  const recordStartedAtRef = useRef(null);

  const bargeWatchRef = useRef(null);
  const bargeSpeechStartRef = useRef(null);

  const openingRef = useRef(false);
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
    const level = Math.min(100, Math.round(rms * 100 * 3.2));
    if (mountedRef.current) setMicLevel(level);

    const now = performance.now();
    const isSpeech = level > SPEECH_LEVEL;

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

    if (recordingRef.current) {
      if (isSpeech) {
        lastSpeechAtRef.current = now;
        if (!speechStartedAtRef.current) speechStartedAtRef.current = now;
      }
      const elapsed = now - recordStartedAtRef.current;
      const hadRealSpeech =
        speechStartedAtRef.current &&
        lastSpeechAtRef.current - speechStartedAtRef.current >= MIN_SPEECH_MS;
      const quietFor = lastSpeechAtRef.current
        ? now - lastSpeechAtRef.current
        : elapsed;

      if (!speechStartedAtRef.current && elapsed >= NO_SPEECH_MS) {
        stopRecordingSegment();
      } else if (elapsed >= MAX_RECORD_MS) {
        stopRecordingSegment();
      } else if (hadRealSpeech && quietFor >= SILENCE_MS) {
        stopRecordingSegment();
      }
    }

    rafRef.current = requestAnimationFrame(levelLoop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openSession = useCallback(async (onError) => {
    if (streamRef.current) return true;
    if (openingRef.current) return false;
    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.('This browser does not support microphone access. Try Chrome or Safari.');
      return false;
    }
    openingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
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
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch { /* best effort */ }
      }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

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
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      rec.onresult = null; rec.onerror = null; rec.onend = null;
      try { rec.stop(); } catch { /* noop */ }
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

  useEffect(() => {
    function onVisibility() {
      if (document.hidden && streamRef.current) closeSession();
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [closeSession]);

  function stopRecordingSegment() {
    // Must flip this BEFORE stopping either engine - it's what tells a
    // browser-recognition onend (below) that this is a real stop, not a
    // silence-timeout blip to transparently restart from.
    recordingRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* noop */ }
      return;
    }
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    try { recorder.stop(); } catch { /* noop */ }
  }

  /* Sarvam path (original behaviour, untouched): record raw audio with
     MediaRecorder, send the blob to the backend for STT once our own VAD
     (the level loop above) decides the turn is over. */
  const listenOnceSarvam = useCallback((onResult, onError) => {
    const stream = streamRef.current;
    if (!stream) { onError?.('Mic session not open.'); return; }

    chunksRef.current = [];
    const mimeType = mimeTypeRef.current;
    let recorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      recorder = new MediaRecorder(stream);
    }
    const actualType = recorder.mimeType || mimeType || 'audio/webm';
    const ext = actualType.includes('mp4') ? 'm4a' : actualType.includes('ogg') ? 'ogg' : 'webm';

    recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      if (!mountedRef.current) return;
      if (!chunksRef.current.length) {
        onError?.('__EMPTY__');
        return;
      }
      try {
        const blob = new Blob(chunksRef.current, { type: actualType });
        const res = await Api.transcribe(blob, `audio.${ext}`);
        if (!mountedRef.current) return;
        if (!res.transcript?.trim()) {
          onError?.('__EMPTY__');
          return;
        }
        onResult(res);
      } catch (err) {
        if (!mountedRef.current) return;
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('hear') || msg.includes('empty') || msg.includes('nothing')) {
          onError?.('__EMPTY__');
          return;
        }
        onError?.(err.message || 'Transcription failed.');
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
    try {
      recorder.start(250);
    } catch {
      try { recorder.start(); } catch {
        recordingRef.current = false;
        onError?.('Could not start recording.');
      }
    }
  }, []);

  /* Browser path: runs entirely on-device via SpeechRecognition, no
     backend round trip. Our own level-loop VAD above still owns the
     "when is this turn over" decision (same SPEECH_LEVEL/SILENCE_MS
     tuning either engine uses) - it calls stopRecordingSegment(), which
     calls recognition.stop() here instead of recorder.stop(). Chrome can
     silently end a "continuous" recognition early on a brief pause even
     mid-turn; recordingRef.current still being true is what tells onend
     that's just a blip to restart from, not our own stop. onInterim (if
     given) mirrors the live-caption behaviour the old dedicated caption
     recognizer used to provide - callers no longer need a second
     instance for that. */
  const listenOnceBrowser = useCallback((onResult, onError, onInterim) => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    const langCode = getLanguage();
    let finalText = '';
    let everGotSpeech = false;

    const attach = () => {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = langCode;
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            finalText += (finalText ? ' ' : '') + e.results[i][0].transcript;
            everGotSpeech = true;
          } else {
            interim += e.results[i][0].transcript;
          }
        }
        if (interim) onInterim?.(interim);
      };

      recognition.onerror = (e) => {
        const hardFailures = ['language-not-supported', 'service-not-allowed', 'network', 'audio-capture'];
        if (hardFailures.includes(e.error) && !everGotSpeech) {
          // Genuinely can't use the browser for this attempt - hand this
          // turn off to Sarvam instead of dead-ending it.
          recognitionRef.current = null;
          listenOnceSarvam(onResult, onError);
        }
        // Anything else (no-speech, aborted) - onend below decides what happens next.
      };

      recognition.onend = () => {
        if (recordingRef.current) {
          try { recognition.start(); } catch { /* already ended for good */ }
          return;
        }
        recognitionRef.current = null;
        if (finalText.trim()) {
          onResult({ transcript: finalText.trim(), language_code: langCode });
        } else {
          onError?.('__EMPTY__');
        }
      };

      recognitionRef.current = recognition;
      try { recognition.start(); } catch { /* noop - onend/onerror won't fire either, treated as silent no-op turn */ }
    };

    recordStartedAtRef.current = performance.now();
    speechStartedAtRef.current = null;
    lastSpeechAtRef.current = null;
    recordingRef.current = true;
    attach();
  }, [listenOnceSarvam]);

  const listenOnce = useCallback((onResult, onError, onInterim) => {
    if (getSpeechRecognitionCtor()) {
      listenOnceBrowser(onResult, onError, onInterim);
    } else {
      listenOnceSarvam(onResult, onError);
    }
  }, [listenOnceBrowser, listenOnceSarvam]);

  const stopListening = useCallback(() => {
    stopRecordingSegment();
  }, []);

  const cancelTurn = useCallback(() => {
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      rec.onresult = null; rec.onerror = null; rec.onend = null;
      try { rec.stop(); } catch { /* noop */ }
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try { recorder.stop(); } catch { /* noop */ }
    }
    recordingRef.current = false;
  }, []);

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