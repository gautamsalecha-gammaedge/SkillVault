import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, X, Plus, Pencil } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { PageHeader, FullPageLoader, Card, Badge, Select, Button, Modal, Input } from '../../components/ui';
import { useToast } from '../../components/Toast';

export default function WorkersMachines() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState([]);
  const [machines, setMachines] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    const [w, m] = await Promise.all([api.allWorkers(), api.allMachines()]);
    setWorkers(w.workers || []);
    setMachines(m.machine_ids || []);
    const entries = await Promise.all((w.workers || []).map(async (wk) => {
      const r = await api.workerMachines(wk.worker_id);
      return [wk.worker_id, r.machine_ids || []];
    }));
    setAssignments(Object.fromEntries(entries));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const assign = async (workerId, machineId) => {
    if (!machineId) return;
    try {
      await api.assignMachine(workerId, machineId);
      setAssignments((a) => ({ ...a, [workerId]: [...(a[workerId] || []), machineId] }));
      toast.success(`Assigned ${machineId}.`);
    } catch (err) { toast.error(err instanceof ApiError ? err.message : 'Could not assign.'); }
  };

  const unassign = async (workerId, machineId) => {
    try {
      await api.unassignMachine(workerId, machineId);
      setAssignments((a) => ({ ...a, [workerId]: a[workerId].filter((m) => m !== machineId) }));
    } catch (err) { toast.error(err instanceof ApiError ? err.message : 'Could not unassign.'); }
  };

  if (loading) return <FullPageLoader label="Loading workers…" />;

  return (
    <div>
      <PageHeader eyebrow="People & machines" title="Workers & machines" description="Assign machines to workers — they'll only see what's assigned here." />
      <div className="space-y-4">
        {workers.map((w, i) => (
          <motion.div key={w.worker_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Card className="p-5">
              <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-display font-bold text-lg">{w.name}</p>
                    {!w.is_approved && <Badge tone="amber">Unapproved</Badge>}
                  </div>
                  <p className="font-mono text-xs text-muted">{w.worker_id} {w.phone_number ? `· ${w.phone_country_code} ${w.phone_number}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditing(w)} className="text-xs font-semibold text-muted hover:text-signal flex items-center gap-1"><Pencil size={12} /> Edit</button>
                  <AssignSelect machines={machines} assigned={assignments[w.worker_id] || []} onAssign={(m) => assign(w.worker_id, m)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(assignments[w.worker_id] || []).length === 0 && <span className="text-xs text-muted">No machines assigned.</span>}
                {(assignments[w.worker_id] || []).map((m) => (
                  <span key={m} className="font-mono text-xs px-3 py-1.5 rounded-full bg-surface-3 border border-line flex items-center gap-2">
                    {m}
                    <button onClick={() => unassign(w.worker_id, m)} className="text-muted hover:text-danger"><X size={12} /></button>
                  </span>
                ))}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit worker">
        {editing && <EditWorkerForm worker={editing} onDone={(updated) => { setEditing(null); load(); }} />}
      </Modal>
    </div>
  );
}

function AssignSelect({ machines, assigned, onAssign }) {
  const available = machines.filter((m) => !assigned.includes(m));
  return (
    <Select onChange={(e) => { onAssign(e.target.value); e.target.value = ''; }} defaultValue="" className="!py-1.5 !text-xs min-w-[140px]">
      <option value="" disabled>+ Assign machine</option>
      {available.map((m) => <option key={m} value={m}>{m}</option>)}
    </Select>
  );
}

function EditWorkerForm({ worker, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({
    new_worker_id: worker.worker_id, name: worker.name,
    phone_country_code: worker.phone_country_code || '+91', phone_number: worker.phone_number || '', address: worker.address || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.updateWorker(worker.worker_id, form);
      toast.success('Worker updated.');
      onDone(res);
    } catch (err) { toast.error(err instanceof ApiError ? err.message : 'Could not update worker.'); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <Input label="Worker ID" value={form.new_worker_id} onChange={set('new_worker_id')} hint="Renaming updates every linked record." />
      <Input label="Name" value={form.name} onChange={set('name')} />
      <div className="grid grid-cols-[100px_1fr] gap-3">
        <Input label="Code" value={form.phone_country_code} onChange={set('phone_country_code')} />
        <Input label="Phone" value={form.phone_number} onChange={set('phone_number')} />
      </div>
      <Input label="Address" value={form.address} onChange={set('address')} />
      <Button type="submit" loading={saving} className="w-full">Save</Button>
    </form>
  );
}
