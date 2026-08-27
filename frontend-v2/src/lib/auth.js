/* SkillVault — session helpers (localStorage keys shared with legacy UI) */

const W_TOKEN = 'sv_worker_token';
const W_NAME = 'sv_worker_name';
const W_ID = 'sv_worker_id';
const A_TOKEN = 'sv_admin_token';
const A_NAME = 'sv_admin_name';

export function getWorkerToken() {
  try { return localStorage.getItem(W_TOKEN); } catch { return null; }
}
export function getWorkerName() {
  try { return localStorage.getItem(W_NAME); } catch { return null; }
}
export function getWorkerId() {
  try { return localStorage.getItem(W_ID); } catch { return null; }
}
export function setWorkerName(name) {
  try {
    if (name != null) localStorage.setItem(W_NAME, name);
  } catch (_) {}
}
export function setWorkerId(id) {
  try {
    if (id != null) localStorage.setItem(W_ID, id);
  } catch (_) {}
}

/** setWorkerSession(token, name, workerId) or setWorkerSession({ token, name, worker_id }) */
export function setWorkerSession(tokenOrObj, name, workerId) {
  let token = tokenOrObj;
  let n = name;
  let id = workerId;
  if (tokenOrObj && typeof tokenOrObj === 'object') {
    token = tokenOrObj.token;
    n = tokenOrObj.name;
    id = tokenOrObj.worker_id ?? tokenOrObj.workerId;
  }
  try {
    if (token) localStorage.setItem(W_TOKEN, token);
    if (n != null) localStorage.setItem(W_NAME, n);
    if (id != null) localStorage.setItem(W_ID, id);
  } catch (_) {}
}

export function getAdminToken() {
  try { return localStorage.getItem(A_TOKEN); } catch { return null; }
}
export function getAdminName() {
  try { return localStorage.getItem(A_NAME); } catch { return null; }
}
export function setAdminName(name) {
  try {
    if (name != null) localStorage.setItem(A_NAME, name);
  } catch (_) {}
}

/** setAdminSession(token, name) or setAdminSession({ token, name }) */
export function setAdminSession(tokenOrObj, name) {
  let token = tokenOrObj;
  let n = name;
  if (tokenOrObj && typeof tokenOrObj === 'object') {
    token = tokenOrObj.token;
    n = tokenOrObj.name;
  }
  try {
    if (token) localStorage.setItem(A_TOKEN, token);
    if (n != null) localStorage.setItem(A_NAME, n);
  } catch (_) {}
}

/** Wipe Ask chat cache (all workers / legacy keys). */
export function clearAskChatStorage() {
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (
        k &&
        (k.startsWith('sv_ask_') ||
          k === 'sv_ask_thread' ||
          k === 'sv_ask_machine' ||
          k === 'sv_ask_auto_speak' ||
          k === 'sv_ask_threads_by_machine' ||
          k === 'sv_ask_owner')
      ) {
        keys.push(k);
      }
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch (_) {}
}

export function clearWorkerSession() {
  try {
    localStorage.removeItem(W_TOKEN);
    localStorage.removeItem(W_NAME);
    localStorage.removeItem(W_ID);
  } catch (_) {}
  clearAskChatStorage();
}

export function clearAdminSession() {
  try {
    localStorage.removeItem(A_TOKEN);
    localStorage.removeItem(A_NAME);
  } catch (_) {}
}
/**
 * Server rejected the token (expired / invalid) or session check failed.
 * Clear storage and leave protected UI immediately so a dead session
 * cannot keep the shell open after reload.
 */
export function forceWorkerLogout() {
  clearWorkerSession();
  try {
    const path = window.location.pathname || '';
    if (path.startsWith('/worker')) {
      window.location.replace('/login');
    }
  } catch (_) {}
}

export function forceAdminLogout() {
  clearAdminSession();
  try {
    const path = window.location.pathname || '';
    if (path.startsWith('/admin')) {
      window.location.replace('/login');
    }
  } catch (_) {}
}