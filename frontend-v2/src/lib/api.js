/* ============================================================
   SkillVault — API client (matches backend/routers/*.py exactly)
   ============================================================ */

import { getWorkerToken, getAdminToken, clearWorkerSession, clearAdminSession } from './auth';

const API_BASE = localStorage.getItem('sv_api_base') || 'http://127.0.0.1:8000';
export function getApiBase() { return API_BASE; }
export function setApiBase(url) { localStorage.setItem('sv_api_base', url); }

export function mediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
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
      method, headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError(0, 'Network error — check the backend is running and reachable.');
  }
  if (res.status === 401 || res.status === 403) {
    if (auth === 'admin') clearAdminSession();
    if (auth === 'worker') clearWorkerSession();
  }
  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data && data.detail) || 'Something went wrong. Please try again.';
    throw new ApiError(res.status, typeof message === 'string' ? message : JSON.stringify(message));
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
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new ApiError(0, 'Network error — check the backend is running and reachable.');
  }
  if (!res.ok) {
    let message = 'Something went wrong. Please try again.';
    try { const data = await res.json(); message = data.detail || message; } catch (_) {}
    throw new ApiError(res.status, message);
  }
  const blob = await res.blob();
  return { blob, cache: res.headers.get('X-Cache') };
}

function xhr(path, form, { method = 'POST', authKind = 'worker', onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();
    req.open(method, `${API_BASE}${path}`);
    const token = authKind === 'admin' ? getAdminToken() : authKind === 'worker' ? getWorkerToken() : null;
    if (token) req.setRequestHeader('Authorization', `Bearer ${token}`);
    if (req.upload) req.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    req.onload = () => {
      let data = null;
      try { data = JSON.parse(req.responseText); } catch (_) {}
      if (req.status >= 200 && req.status < 300) resolve(data);
      else {
        if (req.status === 401 || req.status === 403) {
          if (authKind === 'admin') clearAdminSession(); else clearWorkerSession();
        }
        reject(new ApiError(req.status, (data && data.detail) || 'Something went wrong. Please try again.'));
      }
    };
    req.onerror = () => reject(new ApiError(0, 'Network error — check your connection and try again.'));
    req.send(form);
  });
}

function uploadManualXhr(machine_id, file, onProgress) {
  const form = new FormData();
  form.append('machine_id', machine_id);
  form.append('file', file);
  return xhr('/admin/upload-manual/', form, { authKind: 'admin', onProgress });
}

function transcribeXhr(audioBlob, filename = 'audio.webm') {
  const form = new FormData();
  form.append('file', audioBlob, filename);
  return xhr('/transcribe', form, { authKind: 'worker' });
}

function addKnowledgeXhr(text, machine_id, language_code, videoFile, onProgress) {
  const form = new FormData();
  form.append('text', text);
  form.append('machine_id', machine_id);
  form.append('language_code', language_code);
  if (videoFile) form.append('video', videoFile);
  return xhr('/Knowledge/add-knowledge', form, { authKind: 'worker', onProgress });
}

function submitInterviewAnswerXhr(session_id, answer_text, language_code, audioBlob, onProgress) {
  const form = new FormData();
  form.append('answer_text', answer_text);
  form.append('language_code', language_code);
  if (audioBlob) form.append('audio', audioBlob, 'answer.webm');
  return xhr(`/interview/${encodeURIComponent(session_id)}/answer`, form, { authKind: 'worker', onProgress });
}

function safetyVideoXhr(measureId, videoFile, onProgress) {
  const form = new FormData();
  form.append('video', videoFile);
  return xhr(`/admin/safety/${encodeURIComponent(measureId)}/video`, form, { authKind: 'admin', onProgress });
}

export const api = {
  base: API_BASE,

  /* ---------------- Auth ---------------- */
  workerRegister: (data) => apiFetch('/worker/register', { method: 'POST', body: data }),
  workerLogin: (worker_id, password) => apiFetch('/worker/login', { method: 'POST', body: { worker_id, password } }),
  adminLogin: (username, password) => apiFetch('/admin/login', { method: 'POST', body: { username, password } }),

  myMachines: () => apiFetch('/worker/my-machines', { auth: 'worker' }),
  myTips: () => apiFetch('/worker/my-tips', { auth: 'worker' }),
  myProfile: () => apiFetch('/worker/profile', { auth: 'worker' }),
  updateMyProfile: (data) => apiFetch('/worker/profile', { method: 'PUT', auth: 'worker', body: data }),

  adminProfile: () => apiFetch('/admin/profile', { auth: 'admin' }),
  updateAdminProfile: (name) => apiFetch('/admin/profile', { method: 'PUT', auth: 'admin', body: { name } }),
  updateWorker: (worker_id, data) => apiFetch(`/admin/workers/${encodeURIComponent(worker_id)}`, { method: 'PUT', auth: 'admin', body: data }),

  /* ---------------- Admin: worker approval ---------------- */
  pendingWorkers: () => apiFetch('/admin/pending-workers', { auth: 'admin' }),
  approveWorker: (worker_id) => apiFetch(`/admin/approve-worker/${encodeURIComponent(worker_id)}`, { method: 'POST', auth: 'admin' }),
  rejectWorker: (worker_id) => apiFetch(`/admin/reject-worker/${encodeURIComponent(worker_id)}`, { method: 'DELETE', auth: 'admin' }),

  allWorkers: () => apiFetch('/admin/workers', { auth: 'admin' }),
  allMachines: () => apiFetch('/admin/all-machines', { auth: 'admin' }),
  assignMachine: (worker_id, machine_id) => apiFetch('/admin/assign-machine', { method: 'POST', auth: 'admin', body: { worker_id, machine_id } }),
  unassignMachine: (worker_id, machine_id) =>
    apiFetch(`/admin/unassign-machine?worker_id=${encodeURIComponent(worker_id)}&machine_id=${encodeURIComponent(machine_id)}`, { method: 'DELETE', auth: 'admin' }),
  workerMachines: (worker_id) => apiFetch(`/admin/worker-machines/${encodeURIComponent(worker_id)}`, { auth: 'admin' }),

  pendingEntries: (machine_id) => apiFetch(`/admin/pending?machine_id=${encodeURIComponent(machine_id)}`, { auth: 'admin' }),
  approveEntry: (entry_id) => apiFetch(`/admin/approve/${encodeURIComponent(entry_id)}`, { method: 'POST', auth: 'admin' }),
  deleteEntry: (entry_id) => apiFetch(`/admin/delete/${encodeURIComponent(entry_id)}`, { method: 'DELETE', auth: 'admin' }),
  editEntry: (entry_id, text) => apiFetch(`/admin/edit/${encodeURIComponent(entry_id)}`, { method: 'PUT', auth: 'admin', body: { text } }),

  uploadManual: (machine_id, file, onProgress) => uploadManualXhr(machine_id, file, onProgress),
  manuals: (machine_id) => apiFetch(`/admin/manuals?machine_id=${encodeURIComponent(machine_id)}`, { auth: 'admin' }),
  deleteManual: (machine_id, filename) =>
    apiFetch(`/admin/manual?machine_id=${encodeURIComponent(machine_id)}&filename=${encodeURIComponent(filename)}`, { method: 'DELETE', auth: 'admin' }),

  analytics: () => apiFetch('/admin/analytics', { auth: 'admin' }),

  /* ---------------- Ask / Knowledge / Voice ---------------- */
  ask: (question, machine_id) => apiFetch('/ask', { method: 'POST', auth: 'worker', body: { question, machine_id } }),
  checkKnowledge: (text, machine_id, round, language_code) =>
    apiFetch('/Knowledge/add-knowledge/check', { method: 'POST', auth: 'worker', body: { text, machine_id, round, language_code } }),
  addKnowledge: (text, machine_id, language_code, videoFile = null, onProgress = null) =>
    addKnowledgeXhr(text, machine_id, language_code, videoFile, onProgress),
  speak: (text, language_code) => apiFetchBinary('/speak', { body: { text, language_code } }),
  transcribe: (audioBlob, filename) => transcribeXhr(audioBlob, filename),

  /* ---------------- Tacit Knowledge Capture (Interview) ---------------- */
  startInterview: (machine_id, language_code, fresh = false) =>
    apiFetch('/interview/start', { method: 'POST', auth: 'worker', body: { machine_id, language_code, fresh } }),
  checkInterview: (machine_id) => apiFetch(`/interview/check?machine_id=${encodeURIComponent(machine_id)}`, { auth: 'worker' }),
  getInterview: (session_id) => apiFetch(`/interview/${encodeURIComponent(session_id)}`, { auth: 'worker' }),
  interviewTranscript: (session_id) => apiFetch(`/interview/${encodeURIComponent(session_id)}/transcript`, { auth: 'worker' }),
  submitInterviewAnswer: (session_id, answer_text, language_code, audioBlob, onProgress) =>
    submitInterviewAnswerXhr(session_id, answer_text, language_code, audioBlob, onProgress),
  pauseInterview: (session_id) => apiFetch(`/interview/${encodeURIComponent(session_id)}/pause`, { method: 'POST', auth: 'worker' }),
  endInterview: (session_id) => apiFetch(`/interview/${encodeURIComponent(session_id)}/end`, { method: 'POST', auth: 'worker' }),

  adminInterviewSessions: (machine_id = null, status = null) => {
    const params = new URLSearchParams();
    if (machine_id) params.set('machine_id', machine_id);
    if (status) params.set('status', status);
    const qs = params.toString();
    return apiFetch(`/admin/interview-sessions${qs ? `?${qs}` : ''}`, { auth: 'admin' });
  },
  adminInterviewTranscript: (session_id) => apiFetch(`/admin/interview-sessions/${encodeURIComponent(session_id)}`, { auth: 'admin' }),
  approveSessionPending: (session_id) => apiFetch(`/admin/interview-sessions/${encodeURIComponent(session_id)}/approve-pending`, { method: 'POST', auth: 'admin' }),
  rejectSessionPending: (session_id) => apiFetch(`/admin/interview-sessions/${encodeURIComponent(session_id)}/reject-pending`, { method: 'POST', auth: 'admin' }),

  /* ---------------- Machine Safety Measures ---------------- */
  mySafetyStatus: () => apiFetch('/safety/my-status', { auth: 'worker' }),
  safetyMeasures: (machine_id) => apiFetch(`/safety/${encodeURIComponent(machine_id)}`, { auth: 'worker' }),
  safetyStatus: (machine_id) => apiFetch(`/safety/${encodeURIComponent(machine_id)}/status`, { auth: 'worker' }),
  completeSafety: (machine_id, language_code) =>
    apiFetch(`/safety/${encodeURIComponent(machine_id)}/complete`, { method: 'POST', auth: 'worker', body: { language_code } }),

  adminSafetyMeasures: (machine_id) => apiFetch(`/admin/safety/${encodeURIComponent(machine_id)}`, { auth: 'admin' }),
  createSafetyMeasure: (data) => apiFetch('/admin/safety', { method: 'POST', auth: 'admin', body: data }),
  updateSafetyMeasure: (id, data) => apiFetch(`/admin/safety/${encodeURIComponent(id)}`, { method: 'PUT', auth: 'admin', body: data }),
  deleteSafetyMeasure: (id, hard = false) => apiFetch(`/admin/safety/${encodeURIComponent(id)}${hard ? '?hard=true' : ''}`, { method: 'DELETE', auth: 'admin' }),
  reorderSafetyMeasures: (items) => apiFetch('/admin/safety/reorder', { method: 'POST', auth: 'admin', body: { items } }),
  safetyCompletions: (machine_id) => apiFetch(`/admin/safety/${encodeURIComponent(machine_id)}/completions`, { auth: 'admin' }),
  requireRetake: (machine_id, worker_id) =>
    apiFetch(`/admin/safety/${encodeURIComponent(machine_id)}/completions/${encodeURIComponent(worker_id)}`, { method: 'DELETE', auth: 'admin' }),
  uploadSafetyVideo: (measureId, file, onProgress) => safetyVideoXhr(measureId, file, onProgress),
  removeSafetyVideo: (measureId) => apiFetch(`/admin/safety/${encodeURIComponent(measureId)}/video`, { method: 'DELETE', auth: 'admin' }),

  /* ---------------- Tickets ---------------- */
  createTicket: (data) => apiFetch('/tickets', { method: 'POST', auth: 'worker', body: data }),
  myTickets: () => apiFetch('/tickets/my', { auth: 'worker' }),
  adminTickets: (status = null) => apiFetch(status ? `/tickets/admin?status=${encodeURIComponent(status)}` : '/tickets/admin', { auth: 'admin' }),
  updateTicketStatus: (ticketId, status) => apiFetch(`/tickets/${encodeURIComponent(ticketId)}`, { method: 'PATCH', auth: 'admin', body: { status } }),
};
