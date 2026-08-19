/* ============================================================
   SkillVault — session storage & route guards
   ============================================================ */

const SESSION_KEYS = {
  workerToken: "sv_worker_token",
  workerName: "sv_worker_name",
  workerId: "sv_worker_id",
  adminToken: "sv_admin_token",
};

function getWorkerToken() { return localStorage.getItem(SESSION_KEYS.workerToken); }
function getWorkerName() { return localStorage.getItem(SESSION_KEYS.workerName); }
function getWorkerId() { return localStorage.getItem(SESSION_KEYS.workerId); }
function getAdminToken() { return localStorage.getItem(SESSION_KEYS.adminToken); }

function setWorkerSession(token, name, worker_id) {
  localStorage.setItem(SESSION_KEYS.workerToken, token);
  localStorage.setItem(SESSION_KEYS.workerName, name);
  localStorage.setItem(SESSION_KEYS.workerId, worker_id);
}

function setAdminSession(token) {
  localStorage.setItem(SESSION_KEYS.adminToken, token);
}

function clearWorkerSession() {
  localStorage.removeItem(SESSION_KEYS.workerToken);
  localStorage.removeItem(SESSION_KEYS.workerName);
  localStorage.removeItem(SESSION_KEYS.workerId);
}

function clearAdminSession() {
  localStorage.removeItem(SESSION_KEYS.adminToken);
}

function logoutWorker() {
  clearWorkerSession();
  window.location.href = "index.html";
}

function logoutAdmin() {
  clearAdminSession();
  window.location.href = "index.html";
}

/** Call at the top of worker.html — redirects to login if no token. */
function requireWorkerSession() {
  if (!getWorkerToken()) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}

/** Call at the top of admin.html — redirects to login if no token. */
function requireAdminSession() {
  if (!getAdminToken()) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}
