import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, PartyPopper, CheckCircle2, Clock, BadgeCheck, Mic2, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { Input, Button, Card } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { Brand } from '../../components/WorkerLayout';

const STEPS = [
  {
    icon: BadgeCheck,
    title: 'Submit your details',
    body: 'Name and password are required. Phone and address help your supervisor reach you on the floor.',
  },
  {
    icon: Clock,
    title: 'Wait for approval',
    body: 'A supervisor reviews new registrations so only real floor workers get access to machines.',
  },
  {
    icon: CheckCircle2,
    title: 'Sign in and start',
    body: 'Once approved, use your Worker ID to ask AI, share tips, interview, and run safety briefings.',
  },
];

const PERKS = [
  { icon: Mic2, label: 'Voice ask & tips' },
  { icon: ShieldCheck, label: 'Safety briefings' },
];

export default function Register() {
  const nav = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({
    name: '',
    password: '',
    password_confirm: '',
    phone_country_code: '+91',
    phone_number: '',
    address: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const passwordsMatch =
    form.password.length > 0 &&
    form.password_confirm.length > 0 &&
    form.password === form.password_confirm;
  const showMismatch =
    form.password_confirm.length > 0 && form.password !== form.password_confirm;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.password.trim()) {
      toast.error('Enter a password.');
      return;
    }
    if (form.password !== form.password_confirm) {
      toast.error('Passwords do not match. Re-enter the same password.');
      return;
    }
    setLoading(true);
    try {
      // Frontend-only confirm field — do not send password_confirm to API
      const payload = {
        name: form.name.trim(),
        password: form.password,
        phone_country_code: form.phone_country_code,
        phone_number: form.phone_number,
        address: form.address,
      };
      const res = await api.workerRegister(payload);
      setResult(res);
      toast.success('Registered! Waiting on admin approval.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const LeftShell = ({ title, subtitle, children }) => (
    <aside
      className="hidden lg:flex lg:w-[44%] xl:w-[42%] relative flex-col justify-between p-10 xl:p-14 border-r-2 border-line overflow-hidden"
      style={{
        background: 'linear-gradient(165deg, #f7f4ef 0%, #fffcf8 45%, #f0ebe3 100%)',
      }}
    >
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
        <h1 className="font-display font-black text-[2.75rem] xl:text-5xl leading-[1.08] tracking-tight mt-10 text-text max-w-lg">
          {title}
        </h1>
        <p className="text-muted text-lg xl:text-xl mt-5 max-w-md leading-relaxed">{subtitle}</p>
      </div>
      <div className="relative z-10 mt-10">{children}</div>
    </aside>
  );

  if (result) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row">
        <LeftShell
          title={
            <>
              You&apos;re on the <span className="text-[var(--color-signal)]">list</span>.
            </>
          }
          subtitle="Save your Worker ID. A supervisor will approve your account before you can sign in."
        >
          <div className="rounded-2xl border-2 border-line/80 bg-white/70 backdrop-blur-sm p-5 space-y-3">
            <p className="text-[15px] text-muted leading-relaxed">
              While you wait, keep this ID safe. You&apos;ll use it every time you sign in on the floor.
            </p>
            <p className="text-xs font-mono uppercase tracking-[0.14em] text-muted pt-2 border-t border-line/60">
              Approval required · one account per worker
            </p>
          </div>
        </LeftShell>
        <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[#fffcf8]/40">
          <Card className="w-full max-w-lg p-8 sm:p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-signal)]/10 border-2 border-[var(--color-signal)]/30 flex items-center justify-center text-[var(--color-signal)] mx-auto mb-5">
              <PartyPopper size={28} />
            </div>
            <h2 className="font-display text-3xl font-bold mb-2 tracking-tight">
              You&apos;re registered, {result.name}.
            </h2>
            <p className="text-muted text-[15px] mb-6 leading-relaxed">
              Your Worker ID is your login. An admin must approve your account before you can sign in.
            </p>
            <div className="sv-card bg-surface-3 py-5 mb-6">
              <p className="text-xs font-mono uppercase tracking-widest text-muted mb-1">Your Worker ID</p>
              <p className="font-mono text-4xl font-bold text-[var(--color-signal)]">{result.worker_id}</p>
            </div>
            <Button onClick={() => nav('/login')} size="lg" className="w-full">
              Go to sign-in
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <LeftShell
        title={
          <>
            Join the floor{' '}
            <span className="text-[var(--color-signal)]">knowledge loop</span>.
          </>
        }
        subtitle="Create a worker account to ask, tip, interview, and run safety briefings — once a supervisor approves you."
      >
        <div className="space-y-4">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <div
              key={title}
              className="flex gap-4 items-start rounded-2xl border-2 border-line/80 bg-white/70 backdrop-blur-sm p-4 shadow-sm"
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--color-signal)]/10 border border-[var(--color-signal)]/25 flex items-center justify-center text-[var(--color-signal)] shrink-0 font-mono text-sm font-bold">
                {i + 1}
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="font-semibold text-base text-text flex items-center gap-2 leading-snug">
                  <Icon size={16} className="text-[var(--color-signal)] shrink-0" />
                  {title}
                </p>
                <p className="text-muted text-[15px] mt-1 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-6">
          {PERKS.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text bg-white/80 border border-line rounded-full px-3 py-1.5"
            >
              <Icon size={14} className="text-[var(--color-signal)]" />
              {label}
            </span>
          ))}
        </div>
        <p className="text-xs font-mono text-muted uppercase tracking-[0.14em] mt-8 pt-5 border-t border-line/70">
          Approval required · one account per worker
        </p>
      </LeftShell>

      <div className="flex-1 flex items-center justify-center px-6 sm:px-10 py-12 lg:py-16 bg-[#fffcf8]/40">
        <div className="w-full max-w-lg">
          <Link to="/" className="inline-flex items-center gap-1.5 text-[15px] text-muted hover:text-text mb-6">
            <ArrowLeft size={16} /> Back home
          </Link>
          <div className="mb-8 lg:hidden"><Brand /></div>
          <Card className="p-8 sm:p-10">
            <div className="mb-6">
              <h2 className="font-display text-3xl sm:text-4xl font-bold mb-2 tracking-tight">
                Register as a worker
              </h2>
              <p className="text-muted text-[15px] leading-relaxed">
                Your Worker ID is generated automatically after you submit this form.
              </p>
            </div>
            <form onSubmit={submit} className="space-y-5">
              <Input label="Full name" value={form.name} onChange={set('name')} required />
              <Input
                label="Password"
                type="password"
                value={form.password}
                onChange={set('password')}
                required
                autoComplete="new-password"
              />
              <div>
                <Input
                  label="Re-enter password"
                  type="password"
                  value={form.password_confirm}
                  onChange={set('password_confirm')}
                  required
                  autoComplete="new-password"
                />
                {showMismatch && (
                  <p className="mt-1.5 text-sm text-danger font-medium">
                    Passwords do not match.
                  </p>
                )}
                {passwordsMatch && (
                  <p className="mt-1.5 text-sm text-signal font-medium flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Passwords match
                  </p>
                )}
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-3">
                <Input label="Code" value={form.phone_country_code} onChange={set('phone_country_code')} />
                <Input label="Phone (optional)" value={form.phone_number} onChange={set('phone_number')} />
              </div>
              <Input label="Address (optional)" value={form.address} onChange={set('address')} />
              <Button
                type="submit"
                size="lg"
                className="w-full mt-1"
                loading={loading}
                disabled={!form.name.trim() || !form.password || !passwordsMatch}
              >
                Create my account
              </Button>
              {!passwordsMatch && form.password_confirm.length > 0 && (
                <p className="text-center text-xs text-muted">
                  Fix the password match to submit for approval.
                </p>
              )}
            </form>
            <p className="text-center text-[15px] text-muted mt-6">
              Already registered?{' '}
              <Link to="/login" className="text-[var(--color-signal)] font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}