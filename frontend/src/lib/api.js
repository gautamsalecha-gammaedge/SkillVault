/* ============================================================
   SkillVault — API client

   Ported 1:1 from the legacy frontend's js/api.js. Endpoint paths,
   methods, and payload shapes are unchanged — these are the
   CONFIRMED backend contract (see handoff brief). Do not invent
   new shapes here; anything not listed below does not exist on
   the backend yet (source attribution/confidence on /ask, tip
   history, notifications, search/filters, analytics — all pending
   a backend contract that hasn't been designed).
   ============================================================ */

import { getWorkerToken, getAdminToken, clearWorkerSession, clearAdminSession } from './auth';

const API_BASE = localStorage.getItem('sv_api_base') || 'http://127.0.0.1:8000';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function apiFetch(path, opts = {}) {
  const { method = 'GET', body, auth = null, isForm = false } = opts;
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = auth === 'admin' ? getAdminToken() : getWorkerToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError(0, 'Network error — check your connection and try again.');
  }

  if (res.status === 401 || res.status === 403) {
    if (auth === 'admin') clearAdminSession();
    if (auth === 'worker') clearWorkerSession();
  }

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  }

  if (!res.ok) {
    const message = (data && data.detail) || 'Something went wrong. Please try again.';
    throw new ApiError(res.status, message);
  }

  return data;
}

async function apiFetchBinary(path, opts = {}) {
  const { method = 'POST', body, auth = null } = opts;
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = auth === 'admin' ? getAdminToken() : getWorkerToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError(0, 'Network error — check your connection and try again.');
  }
  if (!res.ok) {
    let message = 'Something went wrong. Please try again.';
    try {
      const data = await res.json();
      message = data.detail || message;
    } catch (_) {}
    throw new ApiError(res.status, message);
  }
  const blob = await res.blob();
  return { blob, cache: res.headers.get('X-Cache') };
}

/**
 * Manual upload needs multipart + progress, so it bypasses apiFetch
 * and uses XHR directly.
 */
function uploadManualXhr(machine_id, file, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('machine_id', machine_id);
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/admin/upload-manual/`);
    const token = getAdminToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };

    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch (_) {}
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        if (xhr.status === 401 || xhr.status === 403) clearAdminSession();
        reject(new ApiError(xhr.status, (data && data.detail) || 'Something went wrong. Please try again.'));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'Network error — check your connection and try again.'));
    xhr.send(form);
  });
}

/**
 * Voice recording -> transcript needs multipart file upload, similar
 * shape to uploadManualXhr but simpler (no progress tracking needed
 * for a few seconds of audio, and no admin auth - worker auth instead).
 */
function transcribeXhr(audioBlob) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', audioBlob, 'audio.webm');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/transcribe`);
    const token = getWorkerToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch (_) {}
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data); // { transcript, language_code }
      } else {
        if (xhr.status === 401 || xhr.status === 403) clearWorkerSession();
        reject(new ApiError(xhr.status, (data && data.detail) || 'Something went wrong. Please try again.'));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'Network error — check your connection and try again.'));
    xhr.send(form);
  });
}

export const Api = {
  /* ---------------- Worker ---------------- */
  workerRegister: (worker_id, password, name) =>
    apiFetch('/worker/register', { method: 'POST', body: { worker_id, password, name } }),

  workerLogin: (worker_id, password) =>
    apiFetch('/worker/login', { method: 'POST', body: { worker_id, password } }),

  myMachines: () => apiFetch('/worker/my-machines', { auth: 'worker' }),
  
  myTips: () => apiFetch('/worker/my-tips', { auth: 'worker' }),


  /* ---------------- Admin ---------------- */
  adminLogin: (username, password) =>
    apiFetch('/admin/login', { method: 'POST', body: { username, password } }),

  pendingWorkers: () => apiFetch('/admin/pending-workers', { auth: 'admin' }),
  approveWorker: (worker_id) =>
    apiFetch(`/admin/approve-worker/${encodeURIComponent(worker_id)}`, { method: 'POST', auth: 'admin' }),
  rejectWorker: (worker_id) =>
    apiFetch(`/admin/reject-worker/${encodeURIComponent(worker_id)}`, { method: 'DELETE', auth: 'admin' }),

  allWorkers: () => apiFetch('/admin/workers', { auth: 'admin' }),
  allMachines: () => apiFetch('/admin/all-machines', { auth: 'admin' }),
  assignMachine: (worker_id, machine_id) =>
    apiFetch('/admin/assign-machine', { method: 'POST', auth: 'admin', body: { worker_id, machine_id } }),
  unassignMachine: (worker_id, machine_id) =>
    apiFetch(
      `/admin/unassign-machine?worker_id=${encodeURIComponent(worker_id)}&machine_id=${encodeURIComponent(machine_id)}`,
      { method: 'DELETE', auth: 'admin' }
    ),
  workerMachines: (worker_id) =>
    apiFetch(`/admin/worker-machines/${encodeURIComponent(worker_id)}`, { auth: 'admin' }),

  pendingEntries: (machine_id) =>
    apiFetch(`/admin/pending?machine_id=${encodeURIComponent(machine_id)}`, { auth: 'admin' }),
  approveEntry: (entry_id) =>
    apiFetch(`/admin/approve/${encodeURIComponent(entry_id)}`, { method: 'POST', auth: 'admin' }),
  deleteEntry: (entry_id) =>
    apiFetch(`/admin/delete/${encodeURIComponent(entry_id)}`, { method: 'DELETE', auth: 'admin' }),
  editEntry: (entry_id, text) =>
    apiFetch(`/admin/edit/${encodeURIComponent(entry_id)}`, { method: 'PUT', auth: 'admin', body: { text } }),

  uploadManual: (machine_id, file, onProgress) => uploadManualXhr(machine_id, file, onProgress),
  manuals: (machine_id) =>
    apiFetch(`/admin/manuals?machine_id=${encodeURIComponent(machine_id)}`, { auth: 'admin' }),
  deleteManual: (machine_id, filename) =>
    apiFetch(
      `/admin/manual?machine_id=${encodeURIComponent(machine_id)}&filename=${encodeURIComponent(filename)}`,
      { method: 'DELETE', auth: 'admin' }
    ),

  /* ---------------- Ask / Knowledge / Voice ----------------
     NOTE: /ask currently returns { answer, sources_used } where
     sources_used is a count, NOT structured source data. The
     confidence bar / source-attribution chips seen in the design
     preview have no backend field to bind to yet — treat as UI
     that's ready for a contract that doesn't exist server-side yet.

     language_code on checkKnowledge/addKnowledge/speak comes from
     Sarvam STT's auto-detected language (see transcribe below), not
     from any stored app setting — each call carries whatever was just
     detected from the worker's own voice. */
  ask: (question, machine_id) =>
    apiFetch('/ask', { method: 'POST', auth: 'worker', body: { question, machine_id } }),

  checkKnowledge: (text, machine_id, round, language_code) =>
    apiFetch('/Knowledge/add-knowledge/check', {
      method: 'POST',
      auth: 'worker',
      body: { text, machine_id, round, language_code },
    }),

  addKnowledge: (text, machine_id, language_code) =>
    apiFetch('/Knowledge/add-knowledge', { method: 'POST', auth: 'worker', body: { text, machine_id, language_code } }),

  speak: (text, language_code) => apiFetchBinary('/speak', { body: { text, language_code } }),

  /* Records audio -> Sarvam STT transcribes it AND auto-detects the
     spoken language in one call. Returns { transcript, language_code }.
     No language is ever passed in here - that's the whole point,
     Sarvam figures it out from the audio itself. */
  transcribe: (audioBlob) => transcribeXhr(audioBlob),

    speak: (text, language_code) => apiFetchBinary('/speak', { body: { text, language_code } }),

  /* Records audio -> Sarvam STT transcribes it AND auto-detects the
     spoken language in one call. Returns { transcript, language_code }.
     No language is ever passed in here - that's the whole point,
     Sarvam figures it out from the audio itself. */
  transcribe: (audioBlob) => transcribeXhr(audioBlob),

  /* ---------------- Tickets ---------------- */
  createTicket: (data) =>
    apiFetch('/tickets', { method: 'POST', auth: 'worker', body: data }),

  myTickets: () =>
    apiFetch('/tickets/my', { auth: 'worker' }),

  adminTickets: (status = null) =>
    apiFetch(
      status ? `/tickets/admin?status=${encodeURIComponent(status)}` : '/tickets/admin',
      { auth: 'admin' }
    ),

  updateTicketStatus: (ticketId, status) =>
    apiFetch(`/tickets/${encodeURIComponent(ticketId)}`, {
      method: 'PATCH',
      auth: 'admin',
      body: { status },
    }),

};