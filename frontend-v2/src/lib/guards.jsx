import { Navigate } from 'react-router-dom';
import { getWorkerToken, getAdminToken } from './auth';

/** Worker routes: no token → login (replace so history stays clean). */
export function RequireWorker({ children }) {
  if (!getWorkerToken()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

/** Admin routes: no token → login (replace). */
export function RequireAdmin({ children }) {
  if (!getAdminToken()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}