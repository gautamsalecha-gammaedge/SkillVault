// Matches the legacy frontend's supported set (en-IN / hi-IN / mr-IN / ta-IN / ur-IN).
// Used as the language_code sent to /speak and /Knowledge/add-knowledge.
// NOTE: this only affects spoken confirmations and how the AI phrases a
// clarifying question — it does NOT translate this app's own UI text yet.
// A full i18n string system (like legacy js/i18n.js) is a separate,
// larger effort not included in this pass.
export const LANGUAGES = [
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)' },
  { code: 'mr-IN', label: 'मराठी (Marathi)' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)' },
  { code: 'ur-IN', label: 'اردو (Urdu)' },
];

const KEY = 'sv_language';

export function getLanguage() {
  return localStorage.getItem(KEY) || 'en-IN';
}

export function setLanguage(code) {
  localStorage.setItem(KEY, code);
}
