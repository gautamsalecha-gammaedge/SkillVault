import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getWorkerToken, getAdminToken, clearWorkerSession, clearAdminSession } from './auth';
import { api } from './api';

/**
 * Worker routes:
 * - No token → login
 * - Token present → verify with GET /worker/profile
 * - Invalid/expired → clear session → login
 * Protected UI is not shown until the session is confirmed.
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
        await api.myProfile();
        if (!cancelled) setStatus('ok');
      } catch (_) {
        clearWorkerSession();
        if (!cancelled) setStatus('deny');
      }
    })();
    return () => { cancelled = true; };
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

/** Admin routes — verify via GET /admin/profile. */
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
        await api.adminProfile();
        if (!cancelled) setStatus('ok');
      } catch (_) {
        clearAdminSession();
        if (!cancelled) setStatus('deny');
      }
    })();
    return () => { cancelled = true; };
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