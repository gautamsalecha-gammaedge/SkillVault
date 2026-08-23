import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireWorker, RequireAdmin } from './lib/guards';

import Login from './pages/Login';
import WorkerLayout from './components/WorkerLayout';
import AdminLayout from './components/AdminLayout';
import AdminProfile from './pages/admin/AdminProfile';

import Ask from './pages/worker/Ask';
import AddTip from './pages/worker/AddTip';
import MyTips from './pages/worker/MyTips';
import HandsFree from './pages/worker/HandsFree';
import Interview from './pages/worker/Interview';
import Notifications from './pages/worker/Notifications';
import Settings from './pages/worker/Settings';
import Safety from './pages/worker/Safety';
import SafetyBriefing from './pages/worker/SafetyBriefing';

import PendingWorkers from './pages/admin/PendingWorkers';
import WorkersMachines from './pages/admin/WorkersMachines';
import KnowledgeReview from './pages/admin/KnowledgeReview';
import Analytics from './pages/admin/Analytics';
import Manuals from './pages/admin/Manuals';
import RaiseTicket from './pages/worker/RaiseTicket';
import MyTickets from './pages/worker/MyTickets';
import Tickets from './pages/admin/Tickets';
import SafetyMeasures from './pages/admin/SafetyMeasures';
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      <Route
        path="/worker"
        element={<RequireWorker><WorkerLayout /></RequireWorker>}
      >
        <Route index element={<Navigate to="ask" replace />} />
        <Route path="ask" element={<Ask />} />
        <Route path="safety" element={<Safety />} />
        <Route path="safety/:machineId" element={<SafetyBriefing />} />
        <Route path="add-tip" element={<AddTip />} />
        <Route path="my-tips" element={<MyTips />} />
        <Route path="hands-free" element={<HandsFree />} />
        <Route path="interview" element={<Interview />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
        <Route path="raise-ticket" element={<RaiseTicket />} />
        <Route path="my-tickets" element={<MyTickets />} />
        <Route path="profile" element={<AdminProfile />} />
        
      </Route>

      <Route
        path="/admin"
        element={<RequireAdmin><AdminLayout /></RequireAdmin>}
      >
        <Route index element={<Navigate to="pending-workers" replace />} />
        <Route path="pending-workers" element={<PendingWorkers />} />
        <Route path="workers-machines" element={<WorkersMachines />} />
        <Route path="knowledge-review" element={<KnowledgeReview />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="manuals" element={<Manuals />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="safety-measures" element={<SafetyMeasures />} />
        <Route path="profile" element={<AdminProfile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}