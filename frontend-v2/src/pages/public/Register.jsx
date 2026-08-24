import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, PartyPopper } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { Input, Button, Card } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { Brand } from '../../components/WorkerLayout';

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
      <div className="min-h-screen flex items-center justify-center px-6 py-16">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-signal/10 border border-signal/30 flex items-center justify-center text-signal mx-auto mb-5">
            <PartyPopper size={26} />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2">You're registered, {result.name}.</h2>
          <p className="text-muted text-sm mb-6">Your Worker ID is your login. Save it — an admin needs to approve your account before you can sign in.</p>
          <div className="sv-card bg-surface-3 py-4 mb-6">
            <p className="text-[11px] font-mono uppercase tracking-widest text-muted mb-1">Your Worker ID</p>
            <p className="font-mono text-3xl font-bold text-signal">{result.worker_id}</p>
          </div>
          <Button onClick={() => nav('/login')} className="w-full">Go to sign-in</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text mb-8">
          <ArrowLeft size={15} /> Back home
        </Link>
        <div className="mb-8"><Brand /></div>
        <Card className="p-7">
          <h2 className="font-display text-2xl font-bold mb-1">Register as a worker</h2>
          <p className="text-muted text-sm mb-6">Your Worker ID is generated automatically once you submit this form.</p>
          <form onSubmit={submit} className="space-y-4">
            <Input label="Full name" value={form.name} onChange={set('name')} required />
            <Input label="Password" type="password" value={form.password} onChange={set('password')} required />
            <div className="grid grid-cols-[100px_1fr] gap-3">
              <Input label="Code" value={form.phone_country_code} onChange={set('phone_country_code')} />
              <Input label="Phone (optional)" value={form.phone_number} onChange={set('phone_number')} />
            </div>
            <Input label="Address (optional)" value={form.address} onChange={set('address')} />
            <Button type="submit" className="w-full" loading={loading}>Create my account</Button>
          </form>
          <p className="text-center text-sm text-muted mt-5">
            Already registered? <Link to="/login" className="text-signal font-semibold hover:underline">Sign in</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
