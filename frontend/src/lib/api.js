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

/**
 * video_url (from /ask and /admin/pending) comes back as a path relative
 * to the backend, e.g. "/uploads/videos/CNC-204/abc123.mp4" — the backend
 * mounts /uploads as static files (main.py), it isn't a full URL. Any
 * caller that wants to actually play the video needs it resolved
 * against API_BASE first.
 */
export function mediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

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
function transcribeXhr(audioBlob, filename = 'audio.webm') {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', audioBlob, filename);

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

/**
 * POST /Knowledge/add-knowledge now takes multipart/form-data (text,
 * machine_id, language_code, and an optional video file) instead of a
 * JSON body, so the video can be forwarded to Gemini for understanding
 * server-side. Uses XHR (like uploadManualXhr) so a video attachment
 * gets an upload progress callback — text-only submissions still work,
 * onProgress just never fires since there's nothing to upload.
 */
function addKnowledgeXhr(text, machine_id, language_code, videoFile, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('text', text);
    form.append('machine_id', machine_id);
    form.append('language_code', language_code);
    if (videoFile) form.append('video', videoFile);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/Knowledge/add-knowledge`);
    const token = getWorkerToken();
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
        if (xhr.status === 401 || xhr.status === 403) clearWorkerSession();
        reject(new ApiError(xhr.status, (data && data.detail) || 'Something went wrong. Please try again.'));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'Network error — check your connection and try again.'));
    xhr.send(form);
  });
}

/**
 * POST /interview/{id}/answer takes multipart/form-data (answer_text,
 * language_code, optional original audio recording) - same reasoning
 * as addKnowledgeXhr: keep the original recording for admin playback
 * while the text (from Sarvam STT, already run client-side via
 * Api.transcribe before this is called) drives the actual interview logic.
 */
function submitInterviewAnswerXhr(sessionId, answerText, languageCode, audioBlob, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('answer_text', answerText);
    form.append('language_code', languageCode);
    if (audioBlob) form.append('audio', audioBlob, 'answer.webm');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/interview/${encodeURIComponent(sessionId)}/answer`);
    const token = getWorkerToken();
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
  workerRegister: (password, name, phone, address) =>
    apiFetch('/worker/register', { method: 'POST', body: { password, name, phone, address } }),

  workerLogin: (worker_id, password) =>
    apiFetch('/worker/login', { method: 'POST', body: { worker_id, password } }),

  workerMe: () => apiFetch('/worker/me', { auth: 'worker' }),

  updateWorkerProfile: (payload) =>
    apiFetch('/worker/profile', { method: 'PUT', auth: 'worker', body: payload }),

  myMachines: () => apiFetch('/worker/my-machines', { auth: 'worker' }),

  myTips: () => apiFetch('/worker/my-tips', { auth: 'worker' }),

  /* ---------------- Admin auth / profile ---------------- */
  adminLogin: (username, password) =>
    apiFetch('/admin/login', { method: 'POST', body: { username, password } }),

  adminProfile: () => apiFetch('/admin/profile', { auth: 'admin' }),

  updateAdminProfile: (name) =>
    apiFetch('/admin/profile', { method: 'PUT', auth: 'admin', body: { name } }),

  updateWorkerAsAdmin: (worker_id, payload) =>
    apiFetch(`/admin/workers/${encodeURIComponent(worker_id)}`, {
      method: 'PUT',
      auth: 'admin',
      body: payload,
    }),

  /* ---------------- Workers & machines ---------------- */
  pendingWorkers: () => apiFetch('/admin/pending-workers', { auth: 'admin' }),

  approveWorker: (worker_id) =>
    apiFetch(`/admin/approve-worker/${encodeURIComponent(worker_id)}`, {
      method: 'POST',
      auth: 'admin',
    }),

  rejectWorker: (worker_id) =>
    apiFetch(`/admin/reject-worker/${encodeURIComponent(worker_id)}`, {
      method: 'DELETE',
      auth: 'admin',
    }),

  allWorkers: () => apiFetch('/admin/workers', { auth: 'admin' }),

  allMachines: () => apiFetch('/admin/all-machines', { auth: 'admin' }),

  assignMachine: (worker_id, machine_id) =>
    apiFetch('/admin/assign-machine', {
      method: 'POST',
      auth: 'admin',
      body: { worker_id, machine_id },
    }),

  unassignMachine: (worker_id, machine_id) =>
    apiFetch(
      `/admin/unassign-machine?worker_id=${encodeURIComponent(worker_id)}&machine_id=${encodeURIComponent(machine_id)}`,
      { method: 'DELETE', auth: 'admin' }
    ),

  workerMachines: (worker_id) =>
    apiFetch(`/admin/worker-machines/${encodeURIComponent(worker_id)}`, { auth: 'admin' }),

  /* ---------------- Knowledge review ---------------- */
  pendingEntries: (machine_id) =>
    apiFetch(`/admin/pending?machine_id=${encodeURIComponent(machine_id)}`, { auth: 'admin' }),

  approveEntry: (entry_id) =>
    apiFetch(`/admin/approve/${encodeURIComponent(entry_id)}`, {
      method: 'POST',
      auth: 'admin',
    }),

  deleteEntry: (entry_id) =>
    apiFetch(`/admin/delete/${encodeURIComponent(entry_id)}`, {
      method: 'DELETE',
      auth: 'admin',
    }),

  editEntry: (entry_id, text) =>
    apiFetch(`/admin/edit/${encodeURIComponent(entry_id)}`, {
      method: 'PUT',
      auth: 'admin',
      body: { text },
    }),

  /* ---------------- Manuals ---------------- */
  uploadManual: (machine_id, file, onProgress) =>
    uploadManualXhr(machine_id, file, onProgress),

  manuals: (machine_id) =>
    apiFetch(`/admin/manuals?machine_id=${encodeURIComponent(machine_id)}`, { auth: 'admin' }),

  deleteManual: (machine_id, filename) =>
    apiFetch(
      `/admin/manual?machine_id=${encodeURIComponent(machine_id)}&filename=${encodeURIComponent(filename)}`,
      { method: 'DELETE', auth: 'admin' }
    ),

  /* ---------------- Analytics ---------------- */
  analytics: () => apiFetch('/admin/analytics', { auth: 'admin' }),

  /* ---------------- Ask / Knowledge / Voice ---------------- */
  ask: (question, machine_id) =>
    apiFetch('/ask', { method: 'POST', auth: 'worker', body: { question, machine_id } }),

  checkKnowledge: (text, machine_id, round, language_code) =>
    apiFetch('/Knowledge/add-knowledge/check', {
      method: 'POST',
      auth: 'worker',
      body: { text, machine_id, round, language_code },
    }),

  addKnowledge: (text, machine_id, language_code, videoFile = null, onProgress = null) =>
    addKnowledgeXhr(text, machine_id, language_code, videoFile, onProgress),

  speak: (text, language_code) =>
    apiFetchBinary('/speak', { body: { text, language_code } }),

  transcribe: (audioBlob, filename) => transcribeXhr(audioBlob, filename),

  /* ---------------- Tacit Knowledge Capture (Interview) ---------------- */
  startInterview: (machine_id, language_code, fresh = false) =>
    apiFetch('/interview/start', {
      method: 'POST',
      auth: 'worker',
      body: { machine_id, language_code, fresh },
    }),

  checkInterview: (machine_id) =>
    apiFetch(`/interview/check?machine_id=${encodeURIComponent(machine_id)}`, {
      auth: 'worker',
    }),

  getInterview: (session_id) =>
    apiFetch(`/interview/${encodeURIComponent(session_id)}`, { auth: 'worker' }),

  interviewTranscript: (session_id) =>
    apiFetch(`/interview/${encodeURIComponent(session_id)}/transcript`, {
      auth: 'worker',
    }),

  submitInterviewAnswer: (session_id, answer_text, language_code, audioBlob, onProgress) =>
    submitInterviewAnswerXhr(session_id, answer_text, language_code, audioBlob, onProgress),

  pauseInterview: (session_id) =>
    apiFetch(`/interview/${encodeURIComponent(session_id)}/pause`, {
      method: 'POST',
      auth: 'worker',
    }),

  endInterview: (session_id) =>
    apiFetch(`/interview/${encodeURIComponent(session_id)}/end`, {
      method: 'POST',
      auth: 'worker',
    }),

  adminInterviewSessions: (machine_id = null, status = null) => {
    const params = new URLSearchParams();
    if (machine_id) params.set('machine_id', machine_id);
    if (status) params.set('status', status);
    const qs = params.toString();
    return apiFetch(`/admin/interview-sessions${qs ? `?${qs}` : ''}`, { auth: 'admin' });
  },

  adminInterviewTranscript: (session_id) =>
    apiFetch(`/admin/interview-sessions/${encodeURIComponent(session_id)}`, {
      auth: 'admin',
    }),

  approveSessionPending: (session_id) =>
    apiFetch(
      `/admin/interview-sessions/${encodeURIComponent(session_id)}/approve-pending`,
      { method: 'POST', auth: 'admin' }
    ),

  rejectSessionPending: (session_id) =>
    apiFetch(
      `/admin/interview-sessions/${encodeURIComponent(session_id)}/reject-pending`,
      { method: 'POST', auth: 'admin' }
    ),

  /* ---------------- Machine Safety Measures ---------------- */
  mySafetyStatus: () => apiFetch('/safety/my-status', { auth: 'worker' }),

  safetyMeasures: (machine_id) =>
    apiFetch(`/safety/${encodeURIComponent(machine_id)}`, { auth: 'worker' }),

  safetyStatus: (machine_id) =>
    apiFetch(`/safety/${encodeURIComponent(machine_id)}/status`, { auth: 'worker' }),

  completeSafety: (machine_id, language_code) =>
    apiFetch(`/safety/${encodeURIComponent(machine_id)}/complete`, {
      method: 'POST',
      auth: 'worker',
      body: { language_code },
    }),

  adminSafetyMeasures: (machine_id) =>
    apiFetch(`/admin/safety/${encodeURIComponent(machine_id)}`, { auth: 'admin' }),

  createSafetyMeasure: (data) =>
    apiFetch('/admin/safety', { method: 'POST', auth: 'admin', body: data }),

  updateSafetyMeasure: (id, data) =>
    apiFetch(`/admin/safety/${encodeURIComponent(id)}`, {
      method: 'PUT',
      auth: 'admin',
      body: data,
    }),

  deleteSafetyMeasure: (id, hard = false) =>
    apiFetch(`/admin/safety/${encodeURIComponent(id)}${hard ? '?hard=true' : ''}`, {
      method: 'DELETE',
      auth: 'admin',
    }),

  reorderSafetyMeasures: (items) =>
    apiFetch('/admin/safety/reorder', {
      method: 'POST',
      auth: 'admin',
      body: { items },
    }),

  safetyCompletions: (machine_id) =>
    apiFetch(`/admin/safety/${encodeURIComponent(machine_id)}/completions`, {
      auth: 'admin',
    }),

  requireSafetyRetake: (machine_id, worker_id) =>
    apiFetch(
      `/admin/safety/${encodeURIComponent(machine_id)}/completions/${encodeURIComponent(worker_id)}`,
      { method: 'DELETE', auth: 'admin' }
    ),

  uploadSafetyVideo: (measure_id, file) => {
    const form = new FormData();
    form.append('video', file);
    return apiFetch(`/admin/safety/${encodeURIComponent(measure_id)}/video`, {
      method: 'POST',
      auth: 'admin',
      isForm: true,
      body: form,
    });
  },

  deleteSafetyVideo: (measure_id) =>
    apiFetch(`/admin/safety/${encodeURIComponent(measure_id)}/video`, {
      method: 'DELETE',
      auth: 'admin',
    }),

  /* ---------------- Tickets ---------------- */
  createTicket: (data) =>
    apiFetch('/tickets', { method: 'POST', auth: 'worker', body: data }),

  myTickets: () => apiFetch('/tickets/my', { auth: 'worker' }),

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