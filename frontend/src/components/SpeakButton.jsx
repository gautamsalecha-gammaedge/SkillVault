import { useRef, useState } from 'react';
import { Volume2, Loader2, Square } from 'lucide-react';
import { Api } from '../lib/api';
import { getLanguage } from '../lib/languages';
import { useToast } from '../lib/toast';

/**
 * Plays a piece of text through the backend's /speak endpoint
 * (Api.speak — already implemented in lib/api.js, just never had
 * a UI control wired to it). Three states: idle, loading (fetching
 * audio), playing (tap again to stop).
 */
export default function SpeakButton({ text, size = 14, style }) {
  const [status, setStatus] = useState('idle'); // idle | loading | playing
  const audioRef = useRef(null);
  const urlRef = useRef(null);
  const { push } = useToast();

  function cleanup() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }

  async function handleClick() {
    if (status === 'playing' || status === 'loading') {
      cleanup();
      setStatus('idle');
      return;
    }
    if (!text?.trim()) return;
    setStatus('loading');
    try {
      const { blob } = await Api.speak(text, getLanguage());
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { cleanup(); setStatus('idle'); };
      audio.onerror = () => { cleanup(); setStatus('idle'); push("Couldn't play audio.", 'error'); };
      await audio.play();
      setStatus('playing');
    } catch (err) {
      setStatus('idle');
      push(err.message || "Couldn't generate audio.", 'error');
    }
  }

  const Icon = status === 'loading' ? Loader2 : status === 'playing' ? Square : Volume2;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={status === 'playing' ? 'Stop listening' : 'Listen'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 12, fontWeight: 600, color: 'var(--sv-teal)',
        padding: '2px 6px', borderRadius: 'var(--sv-radius-full)',
        ...style,
      }}
    >
      <Icon size={size} className={status === 'loading' ? 'sv-spin' : undefined} />
      {status === 'playing' ? 'Stop' : status === 'loading' ? '' : 'Listen'}
    </button>
  );
}
