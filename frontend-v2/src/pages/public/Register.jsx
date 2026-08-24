import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, PartyPopper, CheckCircle2, Clock, BadgeCheck } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { Input, Button, Card } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { Brand } from '../../components/WorkerLayout';

const STEPS = [
  { icon: BadgeCheck, title: 'Submit your details', body: 'Name and password are required. Phone and address help your supervisor reach you.' },
  { icon: Clock, title: 'Wait for approval', body: 'A supervisor reviews new registrations so only real floor workers get access.' },
  { icon: CheckCircle2, title: 'Sign in and start', body: 'Once approved, use your Worker ID to ask, tip, and run safety briefings.' },
];

export default function Register() {
  const nav = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', password: '', phone_country_code: '+91', phone_number: '', address: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.workerRegister(form);
      setResult(res);
      toast.success('Registered! Waiting on admin approval.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row">
        <aside className="hidden lg:flex lg:w-[40%] xl:w-[38%] relative flex-col justify-center p-10 xl:p-12 border-r border-line bg-surface/40">
          <Brand />
          <h1 className="font-display font-black text-4xl xl:text-5xl leading-[1.05] tracking-tight mt-10 max-w-md">
            You're on the list.
          </h1>
          <p className="text-muted text-base mt-5 max-w-sm leading-relaxed">
            Save your Worker ID. A supervisor will approve your account before you can sign in.
          </p>
        </aside>
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <Card className="w-full max-w-lg p-8 sm:p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#2bb89a]/10 border border-[#2bb89a]/30 flex items-center justify-center text-[#2bb89a] mx-auto mb-5">
              <PartyPopper size={26} />
            </div>
            <h2 className="font-display text-2xl font-bold mb-2">You're registered, {result.name}.</h2>
            <p className="text-muted text-sm mb-6">Your Worker ID is your login. Save it — an admin needs to approve your account before you can sign in.</p>
            <div className="sv-card bg-surface-3 py-4 mb-6">
              <p className="text-[11px] font-mono uppercase tracking-widest text-muted mb-1">Your Worker ID</p>
              <p className="font-mono text-3xl font-bold text-[#2bb89a]">{result.worker_id}</p>
            </div>
            <Button onClick={() => nav('/login')} className="w-full">Go to sign-in</Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel */}
      <aside className="hidden lg:flex lg:w-[40%] xl:w-[38%] relative flex-col justify-between p-10 xl:p-12 border-r border-line bg-surface/40">
        <div className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(rgba(34,50,82,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(34,50,82,0.25) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 30% 40%, black, transparent)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 30% 40%, black, transparent)',
          }}
        />
        <div className="relative">
          <Brand />
          <h1 className="font-display font-black text-4xl xl:text-5xl leading-[1.05] tracking-tight mt-10 max-w-md">
            Join the floor knowledge loop.
          </h1>
          <p className="text-muted text-base mt-5 max-w-sm leading-relaxed">
            Create a worker account to ask, tip, interview, and run safety briefings — once a supervisor approves you.
          </p>
        </div>
        <div className="relative space-y-6 mt-12">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-[#2bb89a] shrink-0 font-mono text-xs font-bold">
                {i + 1}
              </div>
              <div>
                <p className="font-semibold text-sm text-text flex items-center gap-2">
                  <Icon size={14} className="text-[#2bb89a]" /> {title}
                </p>
                <p className="text-muted text-sm mt-0.5 leading-snug">{body}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="relative text-[11px] font-mono text-muted uppercase tracking-widest mt-10">
          Approval required · one account per worker
        </p>
      </aside>

      {/* Form panel (primary focus) */}
      <div className="flex-1 flex items-center justify-center px-6 sm:px-10 py-12 lg:py-16">
        <div className="w-full max-w-lg">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text mb-6">
            <ArrowLeft size={15} /> Back home
          </Link>
          <div className="mb-8 lg:hidden"><Brand /></div>
          <Card className="p-8 sm:p-10">
            <div className="mb-6">
              <h2 className="font-display text-3xl font-bold mb-2">Register as a worker</h2>
              <p className="text-muted text-sm leading-relaxed">Your Worker ID is generated automatically once you submit this form.</p>
            </div>
            <form onSubmit={submit} className="space-y-5">
              <Input label="Full name" value={form.name} onChange={set('name')} required />
              <Input label="Password" type="password" value={form.password} onChange={set('password')} required />
              <div className="grid grid-cols-[100px_1fr] gap-3">
                <Input label="Code" value={form.phone_country_code} onChange={set('phone_country_code')} />
                <Input label="Phone (optional)" value={form.phone_number} onChange={set('phone_number')} />
              </div>
              <Input label="Address (optional)" value={form.address} onChange={set('address')} />
              <Button type="submit" size="lg" className="w-full mt-1" loading={loading}>Create my account</Button>
            </form>
            <p className="text-center text-sm text-muted mt-6">
              Already registered? <Link to="/login" className="text-[#2bb89a] font-semibold hover:underline">Sign in</Link>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}