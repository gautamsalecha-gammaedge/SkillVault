/**
 * lib/voiceCapabilities.js
 *
 * Capability checks for the browser's own Web Speech API — SpeechSynthesis
 * for TTS, SpeechRecognition for STT. The point: run speech entirely
 * on-device (no backend round trip, no per-call cost) and get whatever
 * language the worker's browser/OS already supports "for free" — this is
 * what makes it viable for foreign clients beyond the fixed Indian-language
 * set Sarvam currently covers. Sarvam (backend /speak, /voice/transcribe)
 * stays as the fallback for anything the browser can't do — old browsers,
 * or a language with no installed voice.
 */

let cachedVoices = [];

function refreshVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const list = window.speechSynthesis.getVoices();
  if (list.length) cachedVoices = list;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  // Chrome loads voices asynchronously on first page load - this event
  // is how we find out they're ready if the first refreshVoices() call
  // below came back empty.
  window.speechSynthesis.onvoiceschanged = refreshVoices;
  refreshVoices();
}

/**
 * Returns a matching SpeechSynthesisVoice for langCode (e.g. "en-IN"),
 * preferring an exact region match, then falling back to the base
 * language ("en"), or null if the browser has nothing usable for it.
 */
export function getBrowserVoice(langCode) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  if (!cachedVoices.length) refreshVoices(); // some browsers populate synchronously
  if (!cachedVoices.length) return null;

  const wanted = (langCode || '').toLowerCase();
  const base = wanted.split('-')[0];

  return (
    cachedVoices.find((v) => v.lang?.toLowerCase() === wanted) ||
    cachedVoices.find((v) => v.lang?.toLowerCase().startsWith(base)) ||
    null
  );
}

/** Whether this browser has SpeechRecognition at all (support, not language). */
export function hasBrowserSTT() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/** The SpeechRecognition constructor to `new`, or null if unsupported. */
export function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}