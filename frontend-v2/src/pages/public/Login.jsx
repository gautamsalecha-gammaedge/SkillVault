import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, HardHat, UserCog, Mic2, ShieldCheck, Radio, MessageCircleQuestion, BookOpenCheck } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { setWorkerSession, setAdminSession } from '../../lib/auth';
import { Input, Button } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { Brand } from '../../components/WorkerLayout';

const HIGHLIGHTS = [
  {
    icon: Mic2,
    title: 'Voice-first on the floor',
    body: 'Ask questions and share tips without typing — even with gloves on, mid-shift.',
  },
  {
    icon: ShieldCheck,
    title: 'Safety before every start',
    body: 'Step-by-step briefings with video, progress tracking, and retake when needed.',
  },
  {
    icon: Radio,
    title: 'Knowledge that stays',
    body: 'Capture tacit know-how before retirement or shift-change walks it out the door.',
  },
  {
    icon: BookOpenCheck,
    title: 'Grounded answers only',
    body: 'Ask AI replies from manuals and approved tips — never a guess on the machine.',
  },
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
      {/* Left panel */}
      <aside
        className="hidden lg:flex lg:w-[44%] xl:w-[42%] relative flex-col justify-between p-10 xl:p-14 border-r-2 border-line overflow-hidden"
        style={{
          background: 'linear-gradient(165deg, #f7f4ef 0%, #fffcf8 45%, #f0ebe3 100%)',
        }}
      >
        {/* Soft glows */}
        <div
          className="absolute -top-24 -left-16 w-[28rem] h-[28rem] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(15,157,138,0.14) 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 right-0 w-[22rem] h-[22rem] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(217,119,6,0.10) 0%, transparent 70%)' }}
        />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(180,160,140,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(180,160,140,0.22) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse 80% 70% at 40% 30%, black, transparent)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 40% 30%, black, transparent)',
          }}
        />

        <div className="relative z-10">
          <Brand />
          <p className="mt-10 inline-flex items-center gap-2 text-[12px] font-mono font-semibold uppercase tracking-[0.16em] text-[var(--color-signal)] bg-[var(--color-signal)]/10 border border-[var(--color-signal)]/25 rounded-full px-3.5 py-1.5">
            <MessageCircleQuestion size={13} /> Shop-floor knowledge
          </p>
          <h1 className="font-display font-black text-[2.75rem] xl:text-5xl leading-[1.08] tracking-tight mt-5 text-text max-w-lg">
            Knowledge that{' '}
            <span className="text-[var(--color-signal)]">actually stays</span> on the floor.
          </h1>
          <p className="text-muted text-lg xl:text-xl mt-5 max-w-md leading-relaxed">
            Sign in to ask machines by voice, share tips, complete safety briefings, and keep know-how from walking out at shift end.
          </p>
        </div>

        <div className="relative z-10 mt-12 space-y-4">
          {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex gap-4 items-start rounded-2xl border-2 border-line/80 bg-white/70 backdrop-blur-sm p-4 shadow-sm"
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--color-signal)]/10 border border-[var(--color-signal)]/25 flex items-center justify-center text-[var(--color-signal)] shrink-0">
                <Icon size={22} strokeWidth={2} />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="font-semibold text-base text-text leading-snug">{title}</p>
                <p className="text-muted text-[15px] mt-1 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="relative z-10 text-xs font-mono text-muted uppercase tracking-[0.14em] mt-10 pt-6 border-t border-line/70">
          Voice-first · works mid-shift · no typing required
        </p>
      </aside>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 sm:px-10 py-12 lg:py-16 bg-[#fffcf8]/40">
        <div className="w-full max-w-lg">
          <Link to="/" className="inline-flex items-center gap-1.5 text-[15px] text-muted hover:text-text mb-6">
            <ArrowLeft size={16} /> Back home
          </Link>

          <div className="mb-8 lg:hidden"><Brand /></div>

          <div className="flex p-1.5 rounded-full bg-surface-2 border-2 border-line mb-8">
            <button
              type="button"
              onClick={() => setMode('worker')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full text-[15px] font-semibold transition-all ${
                mode === 'worker' ? 'bg-[var(--color-signal)] text-white shadow-sm' : 'text-muted hover:text-text'
              }`}
            >
              <HardHat size={18} /> Worker
            </button>
            <button
              type="button"
              onClick={() => setMode('admin')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full text-[15px] font-semibold transition-all ${
                mode === 'admin' ? 'bg-amber text-white shadow-sm' : 'text-muted hover:text-text'
              }`}
            >
              <UserCog size={18} /> Admin
            </button>
          </div>

          <motion.div
            key={mode}
            initial={{ opacity: 0, x: mode === 'worker' ? -12 : 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className="sv-card p-8 sm:p-10"
          >
            {mode === 'worker' ? (
              <form onSubmit={submitWorker} className="space-y-5">
                <div className="mb-2">
                  <h2 className="font-display text-3xl sm:text-4xl font-bold mb-2 tracking-tight">Worker sign-in</h2>
                  <p className="text-muted text-[15px] leading-relaxed">
                    Use the Worker ID you received after registration and admin approval.
                  </p>
                </div>
                <Input label="Worker ID" placeholder="W101" value={workerId} onChange={(e) => setWorkerId(e.target.value)} required />
                <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <Button type="submit" size="lg" className="w-full mt-1" loading={loading}>Sign in</Button>
                <p className="text-center text-[15px] text-muted pt-2">
                  New here?{' '}
                  <Link to="/register" className="text-[var(--color-signal)] font-semibold hover:underline">
                    Register as a worker
                  </Link>
                </p>
              </form>
            ) : (
              <form onSubmit={submitAdmin} className="space-y-5">
                <div className="mb-2">
                  <h2 className="font-display text-3xl sm:text-4xl font-bold mb-2 tracking-tight">Supervisor sign-in</h2>
                  <p className="text-muted text-[15px] leading-relaxed">
                    Manage machines, review tips and interviews, and track the floor.
                  </p>
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