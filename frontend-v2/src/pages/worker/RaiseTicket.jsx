import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { PageHeader, Card, Input, Textarea, Select, Button } from '../../components/ui';
import { useToast } from '../../components/Toast';

export default function RaiseTicket() {
  const toast = useToast();
  const nav = useNavigate();
  const [machines, setMachines] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', machine_id: '', priority: 'Medium' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.myMachines().then((r) => {
      setMachines(r.machine_ids || []);
      if (r.machine_ids?.length) setForm((f) => ({ ...f, machine_id: r.machine_ids[0] }));
    }).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createTicket(form);
      toast.success('Ticket raised — a supervisor will follow up.');
      nav('/worker/my-tickets');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not raise ticket.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Tickets" title="Raise a ticket." description="Flag a machine issue so a supervisor can act on it." />
      <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
        <Card className="p-7">
          <form onSubmit={submit} className="space-y-4">
            <Input label="Title" value={form.title} onChange={set('title')} placeholder="e.g. Coolant leak on spindle" required />
            <Textarea label="Description" rows={5} value={form.description} onChange={set('description')} placeholder="What's happening, and since when?" required />
            <div className="grid sm:grid-cols-2 gap-4">
              <Select label="Machine (optional)" value={form.machine_id} onChange={set('machine_id')}>
                <option value="">— None —</option>
                {machines.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
              <Select label="Priority" value={form.priority} onChange={set('priority')}>
                <option>Low</option><option>Medium</option><option>High</option>
              </Select>
            </div>
            <Button type="submit" loading={loading} icon={CheckCircle2} className="w-full sm:w-auto">Raise ticket</Button>
          </form>
        </Card>
        <aside className="sv-card p-5 space-y-4 text-sm">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted">Tips</p>
          <ul className="space-y-3 text-muted leading-snug">
            <li>Be specific — machine ID and symptom help supervisors respond faster.</li>
            <li>Use High only when production or safety is at risk.</li>
            <li>You can track status under My Tickets after submitting.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}