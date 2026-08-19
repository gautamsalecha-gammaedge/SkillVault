import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Wraps the browser SpeechRecognition API. Deliberately keeps exactly
 * ONE recognizer instance alive per hook instance, and tears it down
 * on unmount — the legacy frontend had two competing instances wired
 * to the same mic button (one inline in worker.html, one in worker.js),
 * which caused auto-stop-on-pause and repeated permission prompts.
 * Don't reintroduce a second instance if this logic is touched again.
 */
export function useSpeechRecognition({ lang = 'en-IN' } = {}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback((onResult, onError, onInterim) => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    recognition.onresult = (e) => {
      const result = e.results[e.resultIndex];
      const transcript = result[0].transcript;
      if (result.isFinal) onResult(transcript);
      else onInterim?.(transcript);
    };
    recognition.onerror = (e) => {
      setListening(false);
      onError?.(e.error);
    };
    recognition.onend = () => setListening(false);

    try {
      recognition.start();
      setListening(true);
    } catch (e) {
      // start() throws if already started — ignore, single instance guards this in practice.
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}
