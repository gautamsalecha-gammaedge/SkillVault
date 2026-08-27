import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { PageHeader, Card, Input, Button } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { setWorkerName } from '../../lib/auth';

export default function WorkerSettings() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [workerId, setWorkerId] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone_country_code: '',
    phone_number: '',
    address: '',
    email: '',
  });
  const [emailVerified, setEmailVerified] = useState(false);
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    api.myProfile()
      .then((p) => {
        setWorkerId(p.worker_id || '');
        setForm({
          name: p.name || '',
          phone_country_code: p.phone_country_code || '+91',
          phone_number: p.phone_number || '',
          address: p.address || '',
          email: p.email || '',
        });
        setEmailVerified(!!p.email_verified);
      })
      .finally(() => setLoading(false));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setPwField = (k) => (e) => setPw((f) => ({ ...f, [k]: e.target.value }));

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.updateMyProfile({
        name: form.name,
        phone_country_code: form.phone_country_code,
        phone_number: form.phone_number,
        address: form.address,
        email: form.email.trim() || null,
      });
      setWorkerName(res.name);
      setEmailVerified(!!res.email_verified);
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  const sendVerify = async () => {
    if (!form.email.trim()) return;
    setOtpLoading(true);
    setDevOtp('');
    try {
      const res = await api.sendEmailOtp({
        email: form.email.trim(),
        purpose: 'verify_email',
        worker_id: workerId || undefined,
      });
      setOtpSent(true);
      if (res.dev_otp) setDevOtp(res.dev_otp);
      toast.success(res.mailed ? 'Code sent.' : 'Dev code shown (mail off).');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not send code.');
    } finally {
      setOtpLoading(false);
    }
  };

  const confirmOtp = async () => {
    try {
      const res = await api.verifyEmailOtp({
        email: form.email.trim(),
        code: otp.trim(),
        purpose: 'verify_email',
        worker_id: workerId || undefined,
      });
      setEmailVerified(true);
      setOtpSent(false);
      toast.success('Email verified.');
      if (res.email) setForm((f) => ({ ...f, email: res.email }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Invalid code.');
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (!pw.current_password || !pw.new_password) return;
    if (pw.new_password !== pw.confirm) {
      toast.error('New passwords do not match.');
      return;
    }
    if (pw.new_password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setSavingPw(true);
    try {
      await api.updateMyProfile({
        current_password: pw.current_password,
        new_password: pw.new_password,
      });
      toast.success('Password changed.');
      setPw({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not change password.');
    } finally {
      setSavingPw(false);
    }
  };

  if (loading) return null;

  return (
    <div>
      <PageHeader eyebrow="Profile" title="Your profile" description="Keep your details current. Verify email to enable password reset by email." />
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <Card className="p-7">
          <h3 className="font-display text-xl font-bold mb-4">Profile details</h3>
          <form onSubmit={saveProfile} className="space-y-4">
            <Input label="Full name" value={form.name} onChange={set('name')} />
            <div className="grid grid-cols-[100px_1fr] gap-3">
              <Input label="Code" value={form.phone_country_code} onChange={set('phone_country_code')} />
              <Input label="Phone" value={form.phone_number} onChange={set('phone_number')} />
            </div>
            <Input label="Address" value={form.address} onChange={set('address')} />
            <div className="space-y-2">
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => {
                  setEmailVerified(false);
                  setOtpSent(false);
                  set('email')(e);
                }}
                placeholder="Optional — for password reset"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="ghost" size="sm" loading={otpLoading} disabled={!form.email.trim() || emailVerified} onClick={sendVerify}>
                  {emailVerified ? 'Verified' : 'Send verify code'}
                </Button>
                {emailVerified && <span className="text-xs font-semibold text-signal">Verified</span>}
              </div>
              {otpSent && !emailVerified && (
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[120px]">
                    <Input label="OTP code" value={otp} onChange={(e) => setOtp(e.target.value)} />
                  </div>
                  <Button type="button" size="sm" onClick={confirmOtp}>Verify</Button>
                </div>
              )}
              {devOtp && !emailVerified && (
                <p className="text-xs text-amber">Dev OTP: <strong>{devOtp}</strong></p>
              )}
            </div>
            <Button type="submit" loading={saving}>Save changes</Button>
          </form>
        </Card>
        <Card className="p-7">
          <h3 className="font-display text-xl font-bold mb-4">Change password</h3>
          <p className="text-sm text-muted mb-4">After a supervisor gives you a temporary password, log in then set a new one here.</p>
          <form onSubmit={savePassword} className="space-y-4">
            <Input label="Current password" type="password" value={pw.current_password} onChange={setPwField('current_password')} />
            <Input label="New password" type="password" value={pw.new_password} onChange={setPwField('new_password')} />
            <Input label="Re-enter new password" type="password" value={pw.confirm} onChange={setPwField('confirm')} />
            <Button type="submit" variant="ghost" loading={savingPw}>Update password</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}