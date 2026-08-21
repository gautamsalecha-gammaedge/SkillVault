import { useCallback, useRef, useState } from 'react';
import { Api } from './api';
import { getLanguage } from './languages';
import { getSpeechRecognitionCtor } from './voiceCapabilities';

// Records a worker's voice input and returns { transcript, language_code }.
//
// Tries the browser's own SpeechRecognition first - runs entirely on-device,
// no backend round trip, and works for whatever language the browser/OS
// already supports (the point, for clients outside India). Falls back to
// recording the mic and sending it to the backend (/voice/transcribe ->
// Sarvam STT) when the browser doesn't have SpeechRecognition, or when it
// errors out in a way that means it genuinely can't handle this attempt
// (e.g. the browser doesn't support the current language).
//
// Unlike Sarvam, the browser can't auto-detect the spoken language - it
// needs one told to it upfront, so the browser path uses the app's current
// language setting (getLanguage()). The Sarvam fallback path is unchanged
// from before and still auto-detects.
//
// Callers get back the same shape as before: { recording, busy, start, stop }.
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const fellBackRef = useRef(false);

  const startSarvam = useCallback(async (onResult, onError) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setBusy(true);
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const res = await Api.transcribe(blob); // { transcript, language_code }
          onResult(res);
        } catch (err) {
          onError?.(err.message || 'Transcription failed.');
        } finally {
          setBusy(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      onError?.('Microphone access denied.');
    }
  }, []);

  const startBrowser = useCallback((onResult, onError) => {
    const SpeechRecognition = getSpeechRecognitionCtor();
    const recognition = new SpeechRecognition();
    const langCode = getLanguage();
    recognition.lang = langCode;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;
    fellBackRef.current = false;

    recognition.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript || '';
      recognitionRef.current = null;
      setRecording(false);
      if (transcript.trim()) {
        onResult({ transcript, language_code: langCode });
      } else {
        onError?.("Couldn't hear anything in that recording. Please try again.");
      }
    };

    recognition.onerror = (e) => {
      recognitionRef.current = null;
      // Errors that mean "the browser genuinely can't do this" -> fall
      // back to Sarvam rather than dead-ending the worker. Plain silence
      // (no-speech) or a user-cancelled recognition just surfaces as a
      // normal error instead, so tapping the mic twice doesn't trigger
      // two separate recording attempts back to back.
      const hardFailures = ['language-not-supported', 'service-not-allowed', 'network', 'audio-capture'];
      if (hardFailures.includes(e.error)) {
        fellBackRef.current = true;
        startSarvam(onResult, onError);
      } else {
        setRecording(false);
        onError?.("Couldn't hear anything in that recording. Please try again.");
      }
    };

    recognition.onend = () => {
      // If onerror already switched us to the Sarvam path, that path owns
      // `recording` state now - don't let this stale onend clear it.
      if (fellBackRef.current) return;
      setRecording(false);
    };

    try {
      recognition.start();
      setRecording(true);
    } catch (e) {
      startSarvam(onResult, onError);
    }
  }, [startSarvam]);

  const start = useCallback((onResult, onError) => {
    const SpeechRecognition = getSpeechRecognitionCtor();
    if (SpeechRecognition) {
      startBrowser(onResult, onError);
    } else {
      startSarvam(onResult, onError);
    }
  }, [startBrowser, startSarvam]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return { recording, busy, start, stop };
}