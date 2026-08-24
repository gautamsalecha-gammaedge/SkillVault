import { useCallback, useRef, useState } from 'react';
import { api } from './api';

/* Records mic audio, stops on demand, transcribes via the backend
   (Sarvam STT — auto-detects language). Returns both the transcript
   and the raw blob, since some flows (Tacit Interview) need to keep
   the original recording for admin playback alongside the text. */
export function useVoiceCapture() {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (e) {
      setError('Microphone access denied.');
    }
  }, []);

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder) return resolve(null);
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setBusy(true);
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const res = await api.transcribe(blob);
          resolve({ ...res, blob });
        } catch (e) {
          setError(e.message || 'Transcription failed.');
          resolve(null);
        } finally {
          setBusy(false);
        }
      };
      recorder.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
  }, []);

  return { recording, busy, error, start, stop, cancel };
}
