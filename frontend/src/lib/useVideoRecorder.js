import { useCallback, useRef, useState } from 'react';

/**
 * Records a short demo video (camera + mic) via MediaRecorder, similar
 * shape to useVoiceRecorder but capturing video instead of audio-only.
 * Produces a File (not just a Blob) so it can be handed straight to
 * Api.addKnowledge's `video` form field.
 *
 * Live preview: while recording, `stream` is exposed so the caller can
 * bind it to a <video muted autoPlay> element for a live self-view —
 * mirrors how a phone camera app shows what it's capturing.
 */
export function useVideoRecorder() {
  const [recording, setRecording] = useState(false);
  const [stream, setStream] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const start = useCallback(async (onError) => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);

      const recorder = new MediaRecorder(mediaStream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm',
      });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      onError?.('Camera/microphone access denied.');
    }
  }, []);

  /**
   * Stops recording and resolves with a File ready to upload.
   * Returns null if nothing was ever recorded.
   */
  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setStream(null);
        setRecording(false);
        if (!chunksRef.current.length) {
          resolve(null);
          return;
        }
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const file = new File([blob], `tip-video-${Date.now()}.webm`, { type: 'video/webm' });
        resolve(file);
      };
      recorder.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setRecording(false);
    chunksRef.current = [];
  }, []);

  return { recording, stream, start, stop, cancel };
}