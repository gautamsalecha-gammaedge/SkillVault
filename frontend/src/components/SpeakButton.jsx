import { useRef, useState } from 'react';
import { Volume2, Loader2, Square } from 'lucide-react';
import { Api } from '../lib/api';
import { getLanguage } from '../lib/languages';
import { useToast } from '../lib/toast';
import { getBrowserVoice } from '../lib/voiceCapabilities';

/**
 * Plays a piece of text out loud. Three states: idle, loading (fetching
 * audio), playing (tap again to stop).
 *
 * Tries the browser's own SpeechSynthesis first when it has a voice for
 * the target language - on-device, no backend round trip, and it covers
 * whatever language the worker's browser/OS supports. Falls back to the
 * backend's /speak endpoint (Api.speak -> Sarvam) when the browser has no
 * matching voice, or if browser playback errors out mid-utterance.
 *
 * `lang` lets a caller pass the detected language_code for this specific
 * piece of text (e.g. a clarifying question generated in the worker's own
 * spoken language). Falls back to getLanguage() only when no `lang` prop
 * is given, so existing callers that never pass one keep working unchanged.
 */
export default function SpeakButton({ text, lang, size = 14, style, label }) {
  const [status, setStatus] = useState('idle'); // idle | loading | playing
  const audioRef = useRef(null);
  const urlRef = useRef(null);
  const utteranceRef = useRef(null);
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
    if (utteranceRef.current) {
      window.speechSynthesis?.cancel();
      utteranceRef.current = null;
    }
  }

  async function playViaSarvam(langCode) {
    const { blob } = await Api.speak(text, langCode);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => { cleanup(); setStatus('idle'); };
    audio.onerror = () => { cleanup(); setStatus('idle'); push("Couldn't play audio.", 'error'); };
    await audio.play();
    setStatus('playing');
  }

  function playViaBrowser(voice, langCode) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = langCode;
    utterance.onend = () => { utteranceRef.current = null; setStatus('idle'); };
    utterance.onerror = () => {
      utteranceRef.current = null;
      // Browser voice failed mid-flight - fall back to Sarvam rather than
      // leaving the worker with a dead "Listen" button.
      playViaSarvam(langCode).catch(() => {
        setStatus('idle');
        push("Couldn't generate audio.", 'error');
      });
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setStatus('playing');
  }

  async function handleClick() {
    if (status === 'playing' || status === 'loading') {
      cleanup();
      setStatus('idle');
      return;
    }
    if (!text?.trim()) return;

    const langCode = lang || getLanguage();
    const voice = getBrowserVoice(langCode);
    if (voice) {
      playViaBrowser(voice, langCode);
      return;
    }

    setStatus('loading');
    try {
      await playViaSarvam(langCode);
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
      {status === 'playing' ? 'Stop' : status === 'loading' ? '' : (label || 'Listen')}
    </button>
  );
}