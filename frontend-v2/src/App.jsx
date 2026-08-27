import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireWorker, RequireAdmin } from './lib/guards';

import Landing from './pages/public/Landing';
import Login from './pages/public/Login';
import Register from './pages/public/Register';
import ForgotPassword from './pages/public/ForgotPassword';

import WorkerLayout from './components/WorkerLayout';
import AdminLayout from './components/AdminLayout';

import Overview from './pages/worker/Overview';
import Ask from './pages/worker/Ask';
import Safety from './pages/worker/Safety';
import SafetyBriefing from './pages/worker/SafetyBriefing';
import MyTips from './pages/worker/MyTips';
import Interview from './pages/worker/Interview';
import MyTickets from './pages/worker/MyTickets';
import DailyUpdate from './pages/worker/DailyUpdate';
import WorkerSettings from './pages/worker/Settings';

import AdminAnalytics from './pages/admin/Analytics';
import PendingWorkers from './pages/admin/PendingWorkers';
import WorkersMachines from './pages/admin/WorkersMachines';
import KnowledgeReview from './pages/admin/KnowledgeReview';
import Manuals from './pages/admin/Manuals';
import SafetyMeasures from './pages/admin/SafetyMeasures';
import AdminTickets from './pages/admin/Tickets';
import AdminDailyUpdates from './pages/admin/DailyUpdates';
import AdminProfile from './pages/admin/Profile';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route path="/worker" element={<RequireWorker><WorkerLayout /></RequireWorker>}>
        <Route index element={<Overview />} />
        <Route path="ask" element={<Ask />} />
        <Route path="safety" element={<Safety />} />
        <Route path="safety/:machineId" element={<SafetyBriefing />} />
        <Route path="add-tip" element={<Navigate to="/worker/my-tips" replace />} />
        <Route path="my-tips" element={<MyTips />} />
        <Route path="interview" element={<Interview />} />
        <Route path="raise-ticket" element={<Navigate to="/worker/my-tickets" replace />} />
        <Route path="my-tickets" element={<MyTickets />} />
        <Route path="daily-update" element={<DailyUpdate />} />
        <Route path="settings" element={<WorkerSettings />} />
      </Route>

      <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
        <Route index element={<AdminAnalytics />} />
        <Route path="pending-workers" element={<PendingWorkers />} />
        <Route path="workers-machines" element={<WorkersMachines />} />
        <Route path="knowledge-review" element={<KnowledgeReview />} />
        <Route path="manuals" element={<Manuals />} />
        <Route path="safety-measures" element={<SafetyMeasures />} />
        <Route path="tickets" element={<AdminTickets />} />
        <Route path="daily-updates" element={<AdminDailyUpdates />} />
        <Route path="profile" element={<AdminProfile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}