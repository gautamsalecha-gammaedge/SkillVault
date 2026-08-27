import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, UserCog, KeyRound } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { Input, Button, Card } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { Brand } from '../../components/WorkerLayout';

/**
 * Flow: Worker ID → options (email if verified / admin always)
 * Email path: send OTP → new password + re-enter
 * Admin path: instructions only (supervisor sets temp password)
 */
export default function ForgotPassword() {
  const toast = useToast();
  const nav = useNavigate();
  const [step, setStep] = useState('id'); // id | options | email_otp | email_reset | admin
  const [workerId, setWorkerId] = useState('');
  const [lookup, setLookup] = useState(null);
  const [code, setCode] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);

  const lookupId = async (e) => {
    e.preventDefault();
    const id = workerId.trim();
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.forgotLookup(id);
      setLookup(res);
      setStep('options');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not find that Worker ID.');
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    setLoading(true);
    setDevOtp('');
    try {
      const res = await api.forgotSendOtp(workerId.trim());
      if (res.dev_otp) setDevOtp(res.dev_otp);
      toast.success(res.mailed ? `Code sent to ${res.email_masked}` : 'Dev mode: use the code shown below.');
      setStep('email_otp');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not send code.');
    } finally {
      setLoading(false);
    }
  };

  const resetPw = async (e) => {
    e.preventDefault();
    if (pw.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (pw !== pw2) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await api.forgotReset({ worker_id: workerId.trim(), code: code.trim(), new_password: pw });
      toast.success('Password updated. You can log in now.');
      nav('/login', { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f3ec] flex flex-col">
      <div className="p-4 sm:p-6">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900">
          <ArrowLeft size={16} /> Back to sign in
        </Link>
      </div>
      <div className="flex-1 flex items-start justify-center px-4 pb-16">
        <Card className="w-full max-w-md p-6 sm:p-8 border-2 border-line">
          <div className="flex items-center gap-3 mb-6">
            <Brand />
          </div>
          <h1 className="text-2xl font-semibold text-text mb-1">Forgot password</h1>
          <p className="text-sm text-muted mb-6 leading-relaxed">
            Enter your Worker ID. If you verified an email, you can reset online. Otherwise ask your supervisor for a temporary password.
          </p>

          {step === 'id' && (
            <form onSubmit={lookupId} className="space-y-4">
              <Input label="Worker ID" value={workerId} onChange={(e) => setWorkerId(e.target.value)} placeholder="e.g. W116" required />
              <Button type="submit" loading={loading} className="w-full">Continue</Button>
            </form>
          )}

          {step === 'options' && lookup && (
            <div className="space-y-3">
              <p className="text-sm text-text mb-2">Worker ID <strong>{lookup.worker_id}</strong></p>
              <button
                type="button"
                disabled={!lookup.has_verified_email || loading}
                onClick={sendOtp}
                className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
                  lookup.has_verified_email
                    ? 'border-line bg-surface hover:border-amber'
                    : 'border-line bg-surface-2 opacity-55 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Mail size={20} className="text-amber shrink-0" />
                  <div>
                    <p className="font-semibold text-text">Reset by email</p>
                    <p className="text-xs text-muted mt-0.5">
                      {lookup.has_verified_email
                        ? `Code to ${lookup.email_masked}`
                        : 'No verified email on this ID — option disabled'}
                    </p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setStep('admin')}
                className="w-full text-left rounded-2xl border-2 border-line bg-surface hover:border-signal p-4"
              >
                <div className="flex items-center gap-3">
                  <UserCog size={20} className="text-signal shrink-0" />
                  <div>
                    <p className="font-semibold text-text">Ask supervisor</p>
                    <p className="text-xs text-muted mt-0.5">They set a temporary password and share it with you</p>
                  </div>
                </div>
              </button>
              <button type="button" className="text-sm font-semibold text-muted hover:text-text" onClick={() => { setStep('id'); setLookup(null); }}>
                Use a different Worker ID
              </button>
            </div>
          )}

          {step === 'email_otp' && (
            <form onSubmit={(e) => { e.preventDefault(); setStep('email_reset'); }} className="space-y-4">
              <Input label="Code from email" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" required />
              {devOtp && (
                <p className="text-xs rounded-xl bg-amber/10 border border-amber/30 text-amber px-3 py-2">
                  Dev OTP (mail off): <strong>{devOtp}</strong>
                </p>
              )}
              <Button type="submit" className="w-full" disabled={code.trim().length < 4}>Continue</Button>
              <button type="button" className="text-sm font-semibold text-muted" onClick={() => setStep('options')}>Back</button>
            </form>
          )}

          {step === 'email_reset' && (
            <form onSubmit={resetPw} className="space-y-4">
              <Input label="New password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
              <Input label="Re-enter password" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
              <Button type="submit" loading={loading} className="w-full" icon={KeyRound}>Update password</Button>
            </form>
          )}

          {step === 'admin' && (
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-line bg-surface-2 p-4 text-sm text-text leading-relaxed">
                <p className="font-semibold mb-2">Ask your supervisor</p>
                <p className="text-muted mb-3">
                  We will send a reset request for Worker ID <strong className="text-text">{workerId.trim()}</strong>.
                  Your supervisor will see it and can set a temporary password only after this request.
                </p>
                <ol className="list-decimal pl-5 space-y-1.5 text-muted">
                  <li>Tap <strong className="text-text">Send request</strong> below.</li>
                  <li>Tell your supervisor you requested a reset (Worker ID above).</li>
                  <li>They set a temp password and share it with you.</li>
                  <li>Sign in with that password, then change it under Profile.</li>
                </ol>
              </div>
              <Button
                className="w-full"
                loading={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await api.forgotRequestAdmin(workerId.trim());
                    toast.success(res.message || 'Request sent to supervisor.');
                    setStep('admin_done');
                  } catch (err) {
                    toast.error(err instanceof ApiError ? err.message : 'Could not send request.');
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Send request to supervisor
              </Button>
              <button type="button" className="text-sm font-semibold text-muted" onClick={() => setStep('options')}>Back</button>
            </div>
          )}

          {step === 'admin_done' && (
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-signal/30 bg-signal/10 p-4 text-sm text-text leading-relaxed">
                Request sent for <strong>{workerId.trim()}</strong>. When your supervisor sets a temporary password, use it on the sign-in page, then update your password in Profile.
              </div>
              <Button className="w-full" onClick={() => nav('/login')}>Go to sign in</Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}