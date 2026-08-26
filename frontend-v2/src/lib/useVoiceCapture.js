import { useCallback, useRef, useState } from 'react';
import { transcribeSmart, defaultLanguage } from './voice';

/**
 * Records mic audio with optional live browser captions.
 * STT: browser final text primary → Sarvam STT fallback.
 */
export function useVoiceCapture() {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [liveCaption, setLiveCaption] = useState('');
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const browserFinalRef = useRef('');
  const languageRef = useRef(defaultLanguage());

  const start = useCallback(async () => {
    setError(null);
    setLiveCaption('');
    browserFinalRef.current = '';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);

      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        recognitionRef.current = rec;
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = languageRef.current || defaultLanguage();
        rec.onresult = (event) => {
          let interim = '';
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const r = event.results[i];
            if (r.isFinal) final += r[0].transcript;
            else interim += r[0].transcript;
          }
          if (final) {
            browserFinalRef.current = `${browserFinalRef.current} ${final}`.trim();
          }
          setLiveCaption(interim || final || '');
        };
        rec.onerror = () => {};
        try { rec.start(); } catch (_) {}
      }
    } catch (e) {
      setError('Microphone access denied.');
    }
  }, []);

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      try { recognitionRef.current?.stop(); } catch (_) {}
      recognitionRef.current = null;

      const finishWithBlob = async (blob) => {
        setRecording(false);
        setBusy(true);
        setLiveCaption('');
        try {
          const res = await transcribeSmart({
            blob,
            browserText: browserFinalRef.current,
            languageCode: languageRef.current,
          });
          if (res.language_code) languageRef.current = res.language_code;
          if (!res.transcript) {
            setError("Couldn't hear that — try again or type.");
            resolve(null);
            return;
          }
          resolve({ ...res, blob, language_code: res.language_code });
        } catch (e) {
          setError(e.message || 'Transcription failed.');
          resolve(null);
        } finally {
          setBusy(false);
          browserFinalRef.current = '';
        }
      };

      if (!recorder) {
        finishWithBlob(null);
        return;
      }
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await finishWithBlob(blob);
      };
      try {
        recorder.stop();
      } catch (_) {
        finishWithBlob(null);
      }
      recorderRef.current = null;
    });
  }, []);

  const cancel = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch (_) {}
    recognitionRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.onstop = null;
      try { recorderRef.current.stop(); } catch (_) {}
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
    setLiveCaption('');
    browserFinalRef.current = '';
  }, []);

  return { recording, busy, error, liveCaption, start, stop, cancel, languageRef };
}