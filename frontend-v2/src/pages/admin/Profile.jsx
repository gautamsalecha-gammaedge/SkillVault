import { useEffect, useState } from 'react';
import { User, KeyRound, UserPlus, Shield } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { setAdminName } from '../../lib/auth';
import { PageHeader, Card, Button, Input } from '../../components/ui';
import { useToast } from '../../components/Toast';

export default function AdminProfile() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const [supUser, setSupUser] = useState('');
  const [supName, setSupName] = useState('');
  const [supPass, setSupPass] = useState('');
  const [supSaving, setSupSaving] = useState(false);

  useEffect(() => {
    api
      .adminProfile()
      .then((p) => {
        setName(p.name || '');
        setUsername(p.username || '');
        setIsOwner(!!p.is_owner);
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

  const createSupervisor = async (e) => {
    e.preventDefault();
    if (supPass.trim().length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setSupSaving(true);
    try {
      const res = await api.createSupervisor(supUser.trim(), supPass.trim(), supName.trim() || null);
      toast.success(res.message || 'Supervisor created.');
      setSupUser('');
      setSupName('');
      setSupPass('');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create supervisor.');
    } finally {
      setSupSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow="Account"
        title="Admin profile"
        description="Your login identity, password, and (if you are the plant owner) tools to add supervisors."
      />

      <div className="space-y-6">
        {/* Row 1: identity + password */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-6 md:p-7">
            <div className="flex items-center gap-2 mb-1">
              <User size={18} className="text-teal" />
              <h2 className="font-display text-lg font-bold text-text">Display name</h2>
            </div>
            <p className="text-sm text-muted mb-5">Shown in the sidebar. Login ID cannot be changed here.</p>
            <form onSubmit={save} className="space-y-4">
              <Input label="Username (login ID)" value={username} disabled />
              <Input
                label="Display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <div className="flex items-center gap-2 flex-wrap">
                {isOwner && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber bg-amber/10 border border-amber/30 rounded-full px-2.5 py-1">
                    <Shield size={12} /> Plant owner
                  </span>
                )}
                <Button type="submit" variant="amber" loading={saving}>
                  Save name
                </Button>
              </div>
            </form>
          </Card>

          <Card className="p-6 md:p-7">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound size={18} className="text-amber" />
              <h2 className="font-display text-lg font-bold text-text">Change password</h2>
            </div>
            <p className="text-sm text-muted mb-5">Use a strong password. You will need it on the next sign-in.</p>
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
          </Card>
        </div>

        {/* Row 2: owner tools */}
        {isOwner ? (
          <Card className="p-6 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <UserPlus size={18} className="text-amber" />
                  <h2 className="font-display text-lg font-bold text-text">Create supervisor</h2>
                </div>
                <p className="text-sm text-muted leading-relaxed max-w-2xl">
                  Add a supervisor-only login. Share the username and temporary password offline.
                  They sign in on the <strong className="text-text">Admin</strong> tab, then change their password here.
                  To give an existing floor worker admin access, open them under{' '}
                  <strong className="text-text">Workers &amp; Machines</strong> and set the <strong className="text-text">Supervisor</strong> checkbox.
                </p>
              </div>
            </div>
            <form onSubmit={createSupervisor} className="grid sm:grid-cols-3 gap-4 items-end">
              <Input
                label="Username"
                value={supUser}
                onChange={(e) => setSupUser(e.target.value)}
                placeholder="e.g. ravi.supervisor"
                required
              />
              <Input
                label="Display name"
                value={supName}
                onChange={(e) => setSupName(e.target.value)}
                placeholder="Optional"
              />
              <Input
                label="Temporary password"
                type="password"
                value={supPass}
                onChange={(e) => setSupPass(e.target.value)}
                required
              />
              <div className="sm:col-span-3">
                <Button type="submit" variant="amber" loading={supSaving}>
                  Create supervisor
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Card className="p-5 border border-line bg-surface-2/40">
            <p className="text-sm text-muted leading-relaxed">
              Creating supervisors and changing floor worker roles is limited to the <strong className="text-text">plant owner</strong>.
              You can still manage machines, tips, tickets, daily updates, and password-reset requests.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}