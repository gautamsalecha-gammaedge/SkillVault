import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import WorkerNav from './WorkerNav';
import { getWorkerName } from '../lib/auth';
import { WorkerSessionProvider } from '../lib/workerSession';

export default function WorkerLayout() {
  return (
    <WorkerSessionProvider>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--sv-bg)' }}>
        <TopBar workerName={getWorkerName()} />
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </div>
        <WorkerNav />
      </div>
    </WorkerSessionProvider>
  );
}
