/* ============================================================
   SkillVault — session storage
   Ported from legacy js/auth.js. Same localStorage keys, so a
   session created by one frontend build remains valid if the
   other is ever loaded against the same backend during rollout.
   ============================================================ */

const KEYS = {
  workerToken: 'sv_worker_token',
  workerName: 'sv_worker_name',
  workerId: 'sv_worker_id',
  adminToken: 'sv_admin_token',
};

export const getWorkerToken = () => localStorage.getItem(KEYS.workerToken);
export const getWorkerName = () => localStorage.getItem(KEYS.workerName);
export const getWorkerId = () => localStorage.getItem(KEYS.workerId);
export const getAdminToken = () => localStorage.getItem(KEYS.adminToken);

export function setWorkerSession(token, name, worker_id) {
  localStorage.setItem(KEYS.workerToken, token);
  localStorage.setItem(KEYS.workerName, name);
  localStorage.setItem(KEYS.workerId, worker_id);
}

export function setAdminSession(token) {
  localStorage.setItem(KEYS.adminToken, token);
}

export function clearWorkerSession() {
  localStorage.removeItem(KEYS.workerToken);
  localStorage.removeItem(KEYS.workerName);
  localStorage.removeItem(KEYS.workerId);
}

export function clearAdminSession() {
  localStorage.removeItem(KEYS.adminToken);
}
