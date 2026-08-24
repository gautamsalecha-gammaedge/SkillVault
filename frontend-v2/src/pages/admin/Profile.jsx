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
    <div className="max-w-xl mx-auto">
      <PageHeader eyebrow="Account" title="Admin profile" description="Your display name — login credentials are managed outside the app." />
      <Card className="p-7">
        <form onSubmit={save} className="space-y-4">
          <Input label="Username" value={username} disabled className="opacity-60" />
          <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" variant="amber" loading={saving}>Save changes</Button>
        </form>
      </Card>
    </div>
  );
}
