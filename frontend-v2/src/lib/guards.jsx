import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getWorkerToken, getAdminToken, clearWorkerSession, clearAdminSession } from './auth';
import { api } from './api';

/** Max wait for session verify — never hang on "Checking session…" */
const SESSION_CHECK_MS = 5000;

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('session_check_timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Worker routes: verify token quickly (5s max), then ok or login.
 * Never leaves the UI stuck on "Checking session…".
 */
export function RequireWorker({ children }) {
  const hasToken = !!getWorkerToken();
  const [status, setStatus] = useState(hasToken ? 'checking' : 'deny');

  useEffect(() => {
    if (!hasToken) {
      setStatus('deny');
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        await withTimeout(api.myProfile(), SESSION_CHECK_MS);
        if (!cancelled) setStatus('ok');
      } catch (_) {
        clearWorkerSession();
        if (!cancelled) setStatus('deny');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasToken]);

  if (status === 'deny') {
    return <Navigate to="/login" replace />;
  }
  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f3ec] text-sm text-stone-500">
        Checking session…
      </div>
    );
  }
  return children;
}

/** Admin routes — same fast verify via GET /admin/profile. */
export function RequireAdmin({ children }) {
  const hasToken = !!getAdminToken();
  const [status, setStatus] = useState(hasToken ? 'checking' : 'deny');

  useEffect(() => {
    if (!hasToken) {
      setStatus('deny');
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        await withTimeout(api.adminProfile(), SESSION_CHECK_MS);
        if (!cancelled) setStatus('ok');
      } catch (_) {
        clearAdminSession();
        if (!cancelled) setStatus('deny');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasToken]);

  if (status === 'deny') {
    return <Navigate to="/login" replace />;
  }
  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f3ec] text-sm text-stone-500">
        Checking session…
      </div>
    );
  }
  return children;
}