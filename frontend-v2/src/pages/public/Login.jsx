import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, HardHat, UserCog, Mic2, ShieldCheck, Radio } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { setWorkerSession, setAdminSession } from '../../lib/auth';
import { Input, Button } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { Brand } from '../../components/WorkerLayout';

const HIGHLIGHTS = [
  { icon: Mic2, title: 'Voice-first on the floor', body: 'Ask questions and share tips without typing — even mid-shift.' },
  { icon: ShieldCheck, title: 'Safety briefings built in', body: 'Step-by-step procedures with progress tracking for every machine.' },
  { icon: Radio, title: 'Knowledge that stays', body: 'Tacit know-how captured before it walks out the door at retirement.' },
];

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
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel — branding / value prop (desktop) */}
      <aside className="hidden lg:flex lg:w-[40%] xl:w-[38%] relative flex-col justify-between p-10 xl:p-12 border-r border-line bg-[#fffcf8]/95">
        <div className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(rgba(180,160,140,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(180,160,140,0.28) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 30% 40%, black, transparent)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 30% 40%, black, transparent)',
          }}
        />
        <div className="relative">
          <Brand />
          <h1 className="font-display font-black text-4xl xl:text-5xl leading-[1.05] tracking-tight mt-10 max-w-md">
            Knowledge that stays on the floor.
          </h1>
          <p className="text-muted text-base mt-5 max-w-sm leading-relaxed">
            Sign in to ask machines questions by voice, share tips, run safety briefings, and keep tacit know-how from walking out at shift end.
          </p>
        </div>
        <div className="relative space-y-5 mt-12">
          {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-[var(--color-signal)] shrink-0">
                <Icon size={18} />
              </div>
              <div>
                <p className="font-semibold text-sm text-text">{title}</p>
                <p className="text-muted text-sm mt-0.5 leading-snug">{body}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="relative text-[11px] font-mono text-muted uppercase tracking-widest mt-10">
          40+ machine lines · voice-first · no typing required
        </p>
      </aside>

      {/* Right panel — form (primary focus) */}
      <div className="flex-1 flex items-center justify-center px-6 sm:px-10 py-12 lg:py-16">
        <div className="w-full max-w-lg">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text mb-6">
            <ArrowLeft size={15} /> Back home
          </Link>

          {/* Mobile-only brand */}
          <div className="mb-8 lg:hidden"><Brand /></div>

          <div className="flex p-1.5 rounded-full bg-surface-2 border border-line mb-8">
            <button
              onClick={() => setMode('worker')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold transition-all ${mode === 'worker' ? 'bg-[var(--color-signal)] text-white' : 'text-muted hover:text-text'}`}
            >
              <HardHat size={16} /> Worker
            </button>
            <button
              onClick={() => setMode('admin')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold transition-all ${mode === 'admin' ? 'bg-amber text-white' : 'text-muted hover:text-text'}`}
            >
              <UserCog size={16} /> Admin
            </button>
          </div>

          <motion.div
            key={mode}
            initial={{ opacity: 0, x: mode === 'worker' ? -14 : 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28 }}
            className="sv-card p-8 sm:p-10"
          >
            {mode === 'worker' ? (
              <form onSubmit={submitWorker} className="space-y-5">
                <div className="mb-2">
                  <h2 className="font-display text-3xl font-bold mb-2">Worker sign-in</h2>
                  <p className="text-muted text-sm leading-relaxed">Use the Worker ID you were given after registration.</p>
                </div>
                <Input label="Worker ID" placeholder="W101" value={workerId} onChange={(e) => setWorkerId(e.target.value)} required />
                <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <Button type="submit" size="lg" className="w-full mt-1" loading={loading}>Sign in</Button>
                <p className="text-center text-sm text-muted pt-2">
                  New here? <Link to="/register" className="text-[var(--color-signal)] font-semibold hover:underline">Register as a worker</Link>
                </p>
              </form>
            ) : (
              <form onSubmit={submitAdmin} className="space-y-5">
                <div className="mb-2">
                  <h2 className="font-display text-3xl font-bold mb-2">Supervisor sign-in</h2>
                  <p className="text-muted text-sm leading-relaxed">Manage machines, review knowledge, and track the floor.</p>
                </div>
                <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                <Input label="Password" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required />
                <Button type="submit" variant="amber" size="lg" className="w-full mt-1" loading={loading}>Sign in</Button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}