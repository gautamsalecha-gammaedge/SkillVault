/* ============================================================
   SkillVault — API client
   Single source of truth for the backend base URL and every
   endpoint call. Every function returns parsed JSON or throws
   an ApiError with { status, message }.
   ============================================================ */

const API_BASE = localStorage.getItem("sv_api_base") || "http://127.0.0.1:8000";

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Core fetch wrapper.
 * @param {string} path
 * @param {object} opts - { method, body, auth: 'worker'|'admin'|null, isForm }
 */
async function apiFetch(path, opts = {}) {
  const { method = "GET", body, auth = null, isForm = false } = opts;
  const headers = {};
  if (!isForm) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = auth === "admin" ? getAdminToken() : getWorkerToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError(0, t("errorNetwork"));
  }

  if (res.status === 401 || res.status === 403) {
    // Session invalid/expired — clear and let caller redirect.
    if (auth === "admin") clearAdminSession();
    if (auth === "worker") clearWorkerSession();
  }

  const contentType = res.headers.get("content-type") || "";
  let data = null;
  if (contentType.includes("application/json")) {
    data = await res.json().catch(() => null);
  }

  if (!res.ok) {
    const message = (data && data.detail) || t("errorGeneric");
    throw new ApiError(res.status, message);
  }

  return data;
}

async function apiFetchBinary(path, opts = {}) {
  const { method = "POST", body, auth = null } = opts;
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = auth === "admin" ? getAdminToken() : getWorkerToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError(0, t("errorNetwork"));
  }
  if (!res.ok) {
    let message = t("errorGeneric");
    try {
      const data = await res.json();
      message = data.detail || message;
    } catch (_) {}
    throw new ApiError(res.status, message);
  }
  const blob = await res.blob();
  return { blob, cache: res.headers.get("X-Cache") };
}

/* ---------------- Worker ---------------- */
const Api = {
  workerRegister: (worker_id, password, name) =>
    apiFetch("/worker/register", { method: "POST", body: { worker_id, password, name } }),

  workerLogin: (worker_id, password) =>
    apiFetch("/worker/login", { method: "POST", body: { worker_id, password } }),

  myMachines: () => apiFetch("/worker/my-machines", { auth: "worker" }),

  /* ---------------- Admin ---------------- */
  adminLogin: (username, password) =>
    apiFetch("/admin/login", { method: "POST", body: { username, password } }),

  pendingWorkers: () => apiFetch("/admin/pending-workers", { auth: "admin" }),
  approveWorker: (worker_id) =>
    apiFetch(`/admin/approve-worker/${encodeURIComponent(worker_id)}`, { method: "POST", auth: "admin" }),
  rejectWorker: (worker_id) =>
    apiFetch(`/admin/reject-worker/${encodeURIComponent(worker_id)}`, { method: "DELETE", auth: "admin" }),

  allWorkers: () => apiFetch("/admin/workers", { auth: "admin" }),
  allMachines: () => apiFetch("/admin/all-machines", { auth: "admin" }),
  assignMachine: (worker_id, machine_id) =>
    apiFetch("/admin/assign-machine", { method: "POST", auth: "admin", body: { worker_id, machine_id } }),
  unassignMachine: (worker_id, machine_id) =>
    apiFetch(
      `/admin/unassign-machine?worker_id=${encodeURIComponent(worker_id)}&machine_id=${encodeURIComponent(machine_id)}`,
      { method: "DELETE", auth: "admin" }
    ),
  workerMachines: (worker_id) =>
    apiFetch(`/admin/worker-machines/${encodeURIComponent(worker_id)}`, { auth: "admin" }),

  pendingEntries: (machine_id) =>
    apiFetch(`/admin/pending?machine_id=${encodeURIComponent(machine_id)}`, { auth: "admin" }),
  approveEntry: (entry_id) =>
    apiFetch(`/admin/approve/${encodeURIComponent(entry_id)}`, { method: "POST", auth: "admin" }),
  deleteEntry: (entry_id) =>
    apiFetch(`/admin/delete/${encodeURIComponent(entry_id)}`, { method: "DELETE", auth: "admin" }),

  uploadManual: (machine_id, file, onProgress) =>
    uploadManualXhr(machine_id, file, onProgress),
  manuals: (machine_id) =>
    apiFetch(`/admin/manuals?machine_id=${encodeURIComponent(machine_id)}`, { auth: "admin" }),
  deleteManual: (machine_id, filename) =>
    apiFetch(
      `/admin/manual?machine_id=${encodeURIComponent(machine_id)}&filename=${encodeURIComponent(filename)}`,
      { method: "DELETE", auth: "admin" }
    ),

  /* ---------------- Ask / Knowledge / Voice ---------------- */
  ask: (question, machine_id) => apiFetch("/ask", { method: "POST", body: { question, machine_id } }),

  checkKnowledge: (text, machine_id, round) =>
    apiFetch("/Knowledge/add-knowledge/check", { method: "POST", auth: "worker", body: { text, machine_id, round } }),

  addKnowledge: (text, machine_id, language_code) =>
    apiFetch("/Knowledge/add-knowledge", { method: "POST", auth: "worker", body: { text, machine_id, language_code } }),

  speak: (text, language_code) => apiFetchBinary("/speak", { body: { text, language_code } }),
};

/**
 * Upload manual needs progress + multipart form, so it bypasses the
 * JSON apiFetch wrapper and uses XHR directly for the progress event.
 */
function uploadManualXhr(machine_id, file, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("machine_id", machine_id);
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/admin/upload-manual/`);
    const token = getAdminToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

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
        reject(new ApiError(xhr.status, (data && data.detail) || t("errorGeneric")));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, t("errorNetwork")));
    xhr.send(form);
  });
}
