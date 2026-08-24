import { useRef, useState } from 'react';
import { Volume2, Loader2, Square } from 'lucide-react';
import { api } from '../lib/api';

export default function SpeakButton({ text, language_code = 'en-IN', className = '' }) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  const handleClick = async () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    if (!text?.trim()) return;
    setLoading(true);
    try {
      const { blob } = await api.speak(text, language_code);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onpause = () => setPlaying(false);
      await audio.play();
      setPlaying(true);
    } catch (e) {
      // silent — speaking is a nice-to-have, never block the flow
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full border transition-colors ${
        playing ? 'border-signal text-signal bg-signal/10' : 'border-line text-muted hover:text-signal hover:border-signal/50'
      } ${className}`}
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : playing ? <Square size={12} /> : <Volume2 size={13} />}
      {playing ? 'Stop' : 'Speak'}
    </button>
  );
}
