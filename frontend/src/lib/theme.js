/* ============================================================
   SkillVault — theme (light/dark)
   Applies data-theme on <html> so the dark tokens already defined
   in styles/tokens.css ([data-theme='dark']) actually take effect.
   Persists choice; falls back to OS preference on first visit.
   ============================================================ */

const KEY = 'sv_theme';

export function getStoredTheme() {
  return localStorage.getItem(KEY);
}

export function getSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function getTheme() {
  return getStoredTheme() || getSystemTheme();
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function setTheme(theme) {
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

export function initTheme() {
  applyTheme(getTheme());
}
