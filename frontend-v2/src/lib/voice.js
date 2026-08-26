/**
 * Shared voice policy for SkillVault (foreign + Indian clients):
 *
 * STT (mic → text)
 *   1. PRIMARY  — browser Web Speech API (FR, DE, ES, …)
 *   2. FALLBACK — Sarvam STT on the recorded blob (strong on Indian languages)
 *
 * TTS (text → audio)
 *   1. PRIMARY  — browser speechSynthesis (OS voices, non-Indian langs)
 *   2. FALLBACK — Sarvam /speak (Indian / Hinglish)
 *
 * Stop/cancel must never start Sarvam after the user cancelled browser audio.
 */

import { api } from './api';

/** @returns {string} */
export function defaultLanguage() {
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  return 'en-IN';
}

/**
 * Prefer browser transcript when usable; otherwise Sarvam on the blob.
 * @param {{ blob?: Blob|null, browserText?: string, languageCode?: string }} opts
 * @returns {Promise<{ transcript: string, language_code: string, source: 'browser'|'sarvam'|'none' }>}
 */
export async function transcribeSmart({ blob = null, browserText = '', languageCode } = {}) {
  const lang = languageCode || defaultLanguage();
  const browser = (browserText || '').trim();
  if (browser.length >= 2) {
    return { transcript: browser, language_code: lang, source: 'browser' };
  }
  if (blob && blob.size > 500) {
    try {
      const res = await api.transcribe(blob);
      if (res?.transcript?.trim()) {
        return {
          transcript: res.transcript.trim(),
          language_code: res.language_code || lang,
          source: 'sarvam',
        };
      }
    } catch (_) {
      /* fall through */
    }
  }
  return { transcript: '', language_code: lang, source: 'none' };
}

/**
 * Play text: browser TTS first, Sarvam only if browser truly fails.
 * Supports stop via returned controller; stop does not trigger Sarvam.
 *
 * @param {string} text
 * @param {string} [languageCode]
 * @returns {Promise<{ status: 'ended'|'stopped' }>}
 *   Also attaches controllers on the promise object: .stop() .pause() .resume()
 */
export function speakSmart(text, languageCode) {
  const lang = languageCode || defaultLanguage();
  const trimmed = (text || '').trim();
  if (!trimmed) return Promise.resolve({ status: 'ended' });

  let stopped = false;
  let audioEl = null;
  let objectUrl = null;
  let usingBrowser = false;

  const controller = {
    stop() {
      stopped = true;
      try {
        if (usingBrowser) window.speechSynthesis?.cancel();
        else if (audioEl) {
          audioEl.pause();
          audioEl.src = '';
        }
      } catch (_) {}
      if (objectUrl) {
        try { URL.revokeObjectURL(objectUrl); } catch (_) {}
        objectUrl = null;
      }
      audioEl = null;
    },
    pause() {
      try {
        if (usingBrowser) window.speechSynthesis?.pause();
        else audioEl?.pause();
      } catch (_) {}
    },
    resume() {
      try {
        if (usingBrowser) window.speechSynthesis?.resume();
        else audioEl?.play()?.catch(() => {});
      } catch (_) {}
    },
    get paused() {
      try {
        if (usingBrowser) return !!window.speechSynthesis?.paused;
        return !!audioEl?.paused;
      } catch (_) {
        return false;
      }
    },
  };

  const playBrowser = () =>
    new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        reject(new Error('no speechSynthesis'));
        return;
      }
      try { window.speechSynthesis.cancel(); } catch (_) {}
      usingBrowser = true;
      const u = new SpeechSynthesisUtterance(trimmed);
      u.lang = lang;
      u.onend = () => resolve({ status: stopped ? 'stopped' : 'ended' });
      u.onerror = (e) => {
        const err = (e && e.error) || '';
        if (err === 'interrupted' || err === 'canceled' || err === 'cancelled' || stopped) {
          resolve({ status: 'stopped' });
          return;
        }
        reject(new Error(err || 'tts error'));
      };
      window.speechSynthesis.speak(u);
    });

  const playSarvam = async () => {
    if (stopped) return { status: 'stopped' };
    usingBrowser = false;
    const result = await api.speak(trimmed, lang);
    if (stopped) return { status: 'stopped' };
    const blob = result?.blob || result;
    if (!blob || !(blob instanceof Blob)) throw new Error('no audio');
    objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    audioEl = audio;
    return new Promise((resolve, reject) => {
      audio.onended = () => {
        if (objectUrl) {
          try { URL.revokeObjectURL(objectUrl); } catch (_) {}
          objectUrl = null;
        }
        resolve({ status: stopped ? 'stopped' : 'ended' });
      };
      audio.onerror = () => {
        if (objectUrl) {
          try { URL.revokeObjectURL(objectUrl); } catch (_) {}
          objectUrl = null;
        }
        reject(new Error('audio error'));
      };
      audio.play().then(() => {
        if (stopped) {
          try {
            audio.pause();
            audio.src = '';
          } catch (_) {}
          resolve({ status: 'stopped' });
        }
      }).catch(reject);
    });
  };

  const run = (async () => {
    try {
      return await playBrowser();
    } catch (_) {
      if (stopped) return { status: 'stopped' };
      return await playSarvam();
    }
  })();

  run.stop = controller.stop;
  run.pause = controller.pause;
  run.resume = controller.resume;
  Object.defineProperty(run, 'paused', { get: () => controller.paused });
  return run;
}