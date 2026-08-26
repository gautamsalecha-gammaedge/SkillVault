import { useRef, useState } from 'react';
import { Volume2, Loader2, Square, Pause, Play } from 'lucide-react';
import { speakSmart, defaultLanguage } from '../lib/voice';

/**
 * TTS: browser speechSynthesis primary → Sarvam fallback.
 * Stop cancels cleanly and never starts Sarvam after cancel.
 */
export default function SpeakButton({ text, language_code, className = '', label = 'Speak' }) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const jobRef = useRef(null);

  const stop = () => {
    try { jobRef.current?.stop?.(); } catch (_) {}
    jobRef.current = null;
    setPlaying(false);
    setPaused(false);
    setLoading(false);
  };

  const handleClick = async () => {
    if (playing) {
      stop();
      return;
    }
    if (!text?.trim()) return;
    setLoading(true);
    setPaused(false);
    try {
      const job = speakSmart(text, language_code || defaultLanguage());
      jobRef.current = job;
      setLoading(false);
      setPlaying(true);
      const outcome = await job;
      if (outcome?.status !== 'stopped') {
        setPlaying(false);
        setPaused(false);
      } else {
        setPlaying(false);
        setPaused(false);
      }
      jobRef.current = null;
    } catch (_) {
      setPlaying(false);
      setPaused(false);
      setLoading(false);
      jobRef.current = null;
    }
  };

  const handlePauseToggle = (e) => {
    e.stopPropagation();
    if (!jobRef.current) return;
    if (paused) {
      jobRef.current.resume?.();
      setPaused(false);
    } else {
      jobRef.current.pause?.();
      setPaused(true);
    }
  };

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full border transition-colors ${
          playing
            ? 'border-signal text-signal bg-signal/10'
            : 'border-line text-muted hover:text-signal hover:border-signal/50'
        }`}
      >
        {loading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : playing ? (
          <Square size={12} />
        ) : (
          <Volume2 size={13} />
        )}
        {loading ? '…' : playing ? 'Stop' : (label || 'Speak')}
      </button>
      {playing && (
        <button
          type="button"
          onClick={handlePauseToggle}
          className="inline-flex items-center gap-1 text-xs font-mono px-2.5 py-1.5 rounded-full border border-line text-muted hover:text-amber hover:border-amber"
          title={paused ? 'Resume' : 'Pause'}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
          {paused ? 'Resume' : 'Pause'}
        </button>
      )}
    </span>
  );
}