import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { PageHeader, Card, Input, Button } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { setWorkerName } from '../../lib/auth';

export default function WorkerSettings() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', phone_country_code: '', phone_number: '', address: '' });
  const [pw, setPw] = useState({ current_password: '', new_password: '' });
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    api.myProfile().then((p) => setForm({ name: p.name || '', phone_country_code: p.phone_country_code || '+91', phone_number: p.phone_number || '', address: p.address || '' })).finally(() => setLoading(false));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setPwField = (k) => (e) => setPw((f) => ({ ...f, [k]: e.target.value }));

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.updateMyProfile(form);
      setWorkerName(res.name);
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update profile.');
    } finally { setSaving(false); }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (!pw.current_password || !pw.new_password) return;
    setSavingPw(true);
    try {
      await api.updateMyProfile(pw);
      toast.success('Password changed.');
      setPw({ current_password: '', new_password: '' });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not change password.');
    } finally { setSavingPw(false); }
  };

  if (loading) return null;

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Your profile" description="Keep your details current." />
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
            <Button type="submit" loading={saving}>Save changes</Button>
          </form>
        </Card>
        <Card className="p-7">
          <h3 className="font-display text-xl font-bold mb-4">Change password</h3>
          <form onSubmit={savePassword} className="space-y-4">
            <Input label="Current password" type="password" value={pw.current_password} onChange={setPwField('current_password')} />
            <Input label="New password" type="password" value={pw.new_password} onChange={setPwField('new_password')} />
            <Button type="submit" variant="ghost" loading={savingPw}>Update password</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}