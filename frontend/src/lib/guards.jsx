import { Navigate } from 'react-router-dom';
import { getWorkerToken, getAdminToken } from './auth';

export function RequireWorker({ children }) {
  if (!getWorkerToken()) return <Navigate to="/" replace />;
  return children;
}

export function RequireAdmin({ children }) {
  if (!getAdminToken()) return <Navigate to="/" replace />;
  return children;
}
