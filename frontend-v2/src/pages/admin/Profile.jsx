import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { PageHeader, Card, Input, Button } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { setAdminName } from '../../lib/auth';
import { KeyRound, User } from 'lucide-react';

export default function AdminProfile() {
  const toast = useToast();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    api
      .adminProfile()
      .then((p) => {
        setName(p.name || '');
        setUsername(p.username || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.updateAdminProfile(name);
      setAdminName(res.name);
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update.');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }
    setPwSaving(true);
    try {
      await api.changeAdminPassword(currentPassword, newPassword, confirmPassword);
      toast.success('Password updated. Use it next time you sign in.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not change password.');
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Admin profile"
        description="Display name and password live in the database — not only in the server .env file."
      />
      <div className="grid lg:grid-cols-2 gap-6 items-start max-w-4xl">
        <Card className="p-7">
          <div className="flex items-center gap-2 mb-5">
            <User size={20} className="text-amber" />
            <h2 className="font-display text-lg font-bold text-text">Display name</h2>
          </div>
          <form onSubmit={save} className="space-y-4">
            <Input label="Username (login ID)" value={username} disabled className="opacity-60" />
            <Input
              label="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="How you appear in the app"
            />
            <Button type="submit" variant="amber" loading={saving}>
              Save name
            </Button>
          </form>
        </Card>

        <Card className="p-7">
          <div className="flex items-center gap-2 mb-5">
            <KeyRound size={20} className="text-amber" />
            <h2 className="font-display text-lg font-bold text-text">Change password</h2>
          </div>
          <form onSubmit={changePassword} className="space-y-4">
            <Input
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <Input
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <Input
              label="Confirm new password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <Button type="submit" variant="amber" loading={pwSaving}>
              Update password
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted leading-relaxed">
            After the first admin was created, changing <code className="text-xs">ADMIN_PASSWORD</code> in
            .env does not change this account. Use this form instead.
          </p>
        </Card>
      </div>
    </div>
  );
}