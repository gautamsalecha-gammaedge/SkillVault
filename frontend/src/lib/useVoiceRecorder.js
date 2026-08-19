import { useCallback, useRef, useState } from 'react';
import { Api } from './api';

// Records mic audio via MediaRecorder, then sends the blob to the backend
// (/voice/transcribe -> Sarvam STT) for transcription + language detection.
// Replaces the old browser SpeechRecognition approach, which required a
// fixed language up front and couldn't auto-detect what was spoken.
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const start = useCallback(async (onResult, onError) => {
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

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return { recording, busy, start, stop };
}