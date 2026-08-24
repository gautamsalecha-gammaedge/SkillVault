import { Navigate } from 'react-router-dom';
import { getWorkerToken, getAdminToken } from './auth';

export function RequireWorker({ children }) {
  return getWorkerToken() ? children : <Navigate to="/login" replace />;
}
export function RequireAdmin({ children }) {
  return getAdminToken() ? children : <Navigate to="/login" replace />;
}
