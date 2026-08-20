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
  const mimeTypeRef = useRef('video/webm');

  const start = useCallback(async (onError) => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);

      // Safari (iOS/macOS) can record but cannot *play back* video/webm in
      // a <video> tag, so the in-app preview after stopping would appear
      // blank there. Prefer mp4 when the browser supports recording it;
      // fall back through webm variants for Chrome/Firefox/Android.
      const mimeType = ['video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      ) || '';
      mimeTypeRef.current = mimeType;
      const recorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
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
        const type = mimeTypeRef.current || 'video/webm';
        const ext = type.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunksRef.current, { type });
        const file = new File([blob], `tip-video-${Date.now()}.${ext}`, { type });
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