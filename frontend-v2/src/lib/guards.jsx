import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getWorkerToken, getAdminToken, clearWorkerSession, clearAdminSession } from './auth';
import { api, ApiError } from './api';

const SESSION_CHECK_MS = 8000;

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
 * Worker routes: verify token.
 * Only clear session on 401/403. Network/timeout must not force login.
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
      } catch (err) {
        if (cancelled) return;
        const statusCode = err instanceof ApiError ? err.status : 0;
        if (statusCode === 401 || statusCode === 403) {
          clearWorkerSession();
          setStatus('deny');
        } else {
          setStatus('ok');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasToken]);

  if (status === 'deny') return <Navigate to="/login" replace />;
  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f3ec] text-sm text-stone-500">
        Checking session…
      </div>
    );
  }
  return children;
}

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
      } catch (err) {
        if (cancelled) return;
        const statusCode = err instanceof ApiError ? err.status : 0;
        if (statusCode === 401 || statusCode === 403) {
          clearAdminSession();
          setStatus('deny');
        } else {
          setStatus('ok');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasToken]);

  if (status === 'deny') return <Navigate to="/login" replace />;
  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f3ec] text-sm text-stone-500">
        Checking session…
      </div>
    );
  }
  return children;
}