import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { PageHeader, Card, Input, Button } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { setAdminName, getAdminName } from '../../lib/auth';

export default function AdminProfile() {
  const toast = useToast();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.adminProfile().then((p) => { setName(p.name || ''); setUsername(p.username); }).finally(() => setLoading(false));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.updateAdminProfile(name);
      setAdminName(res.name);
      toast.success('Profile updated.');
    } catch (err) { toast.error(err instanceof ApiError ? err.message : 'Could not update.'); }
    finally { setSaving(false); }
  };

  if (loading) return null;

  return (
    <div>
      <PageHeader eyebrow="Account" title="Admin profile" description="Your display name — login credentials are managed outside the app." />
      <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
        <Card className="p-7 max-w-xl">
          <form onSubmit={save} className="space-y-4">
            <Input label="Username" value={username} disabled className="opacity-60" />
            <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" variant="amber" loading={saving}>Save changes</Button>
          </form>
        </Card>
        <aside className="sv-card p-5 space-y-3 text-sm text-muted leading-snug">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted">Note</p>
          <p>Username and password are set in the server environment. Only your display name is editable here.</p>
        </aside>
      </div>
    </div>
  );
}