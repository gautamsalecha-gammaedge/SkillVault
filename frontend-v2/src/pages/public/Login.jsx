import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, HardHat, UserCog, Loader2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { setWorkerSession, setAdminSession } from '../../lib/auth';
import { Input, Button } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { Brand } from '../../components/WorkerLayout';

export default function Login() {
  const [mode, setMode] = useState('worker');
  const nav = useNavigate();
  const toast = useToast();

  const [workerId, setWorkerId] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submitWorker = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.workerLogin(workerId.trim(), password);
      setWorkerSession(res.token, res.name, workerId.trim());
      toast.success(`Welcome back, ${res.name}.`);
      nav('/worker');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const submitAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.adminLogin(username.trim(), adminPassword);
      setAdminSession(res.token, res.name);
      toast.success('Welcome back.');
      nav('/admin');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text mb-8">
          <ArrowLeft size={15} /> Back home
        </Link>

        <div className="mb-8"><Brand /></div>

        <div className="flex p-1 rounded-full bg-surface-2 border border-line mb-7">
          <button
            onClick={() => setMode('worker')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold transition-all ${mode === 'worker' ? 'bg-signal text-[#06110d]' : 'text-muted'}`}
          >
            <HardHat size={15} /> Worker
          </button>
          <button
            onClick={() => setMode('admin')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold transition-all ${mode === 'admin' ? 'bg-amber text-[#221400]' : 'text-muted'}`}
          >
            <UserCog size={15} /> Admin
          </button>
        </div>

        <motion.div key={mode} initial={{ opacity: 0, x: mode === 'worker' ? -14 : 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.28 }} className="sv-card p-7">
          {mode === 'worker' ? (
            <form onSubmit={submitWorker} className="space-y-4">
              <h2 className="font-display text-2xl font-bold mb-1">Worker sign-in</h2>
              <p className="text-muted text-sm mb-5">Use the Worker ID you were given after registration.</p>
              <Input label="Worker ID" placeholder="W101" value={workerId} onChange={(e) => setWorkerId(e.target.value)} required />
              <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <Button type="submit" className="w-full" loading={loading}>Sign in</Button>
              <p className="text-center text-sm text-muted">
                New here? <Link to="/register" className="text-signal font-semibold hover:underline">Register as a worker</Link>
              </p>
            </form>
          ) : (
            <form onSubmit={submitAdmin} className="space-y-4">
              <h2 className="font-display text-2xl font-bold mb-1">Supervisor sign-in</h2>
              <p className="text-muted text-sm mb-5">Manage machines, review knowledge, and track the floor.</p>
              <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
              <Input label="Password" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required />
              <Button type="submit" variant="amber" className="w-full" loading={loading}>Sign in</Button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
