import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
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

function OfflineScreen({ role }) {
  const clear = () => {
    if (role === 'admin') clearAdminSession();
    else clearWorkerSession();
    window.location.replace('/login');
  };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f7f3ec] px-6 text-center">
      <p className="text-lg font-semibold text-stone-800">Cannot reach the server</p>
      <p className="text-sm text-stone-500 max-w-sm leading-relaxed">
        The backend is not responding. If it was just rebuilt, wait a few seconds and retry.
        If your session ended, sign in again.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-11 px-5 rounded-full bg-[#0f9d8a] text-white text-sm font-semibold"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={clear}
          className="h-11 px-5 rounded-full border-2 border-stone-300 text-sm font-semibold text-stone-700"
        >
          Go to sign in
        </button>
      </div>
      <Link to="/" className="text-sm font-semibold text-stone-500 hover:text-stone-800">
        Back to home
      </Link>
    </div>
  );
}

/**
 * Worker routes: verify token with the server.
 * 401/403 → login. Network/timeout → offline screen (not a fake "session ok").
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
          setStatus('offline');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasToken]);

  if (status === 'deny') return <Navigate to="/login" replace />;
  if (status === 'offline') return <OfflineScreen role="worker" />;
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
          setStatus('offline');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasToken]);

  if (status === 'deny') return <Navigate to="/login" replace />;
  if (status === 'offline') return <OfflineScreen role="admin" />;
  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f3ec] text-sm text-stone-500">
        Checking session…
      </div>
    );
  }
  return children;
}