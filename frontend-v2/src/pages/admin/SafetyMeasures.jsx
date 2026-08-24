import { useEffect, useRef, useState } from 'react';
import { Reorder } from 'framer-motion';
import { GripVertical, Plus, Trash2, Video, X, Users } from 'lucide-react';
import { api, mediaUrl, ApiError } from '../../lib/api';
import { PageHeader, Select, Card, Button, Input, Textarea, Modal, FullPageLoader, EmptyState, Badge } from '../../components/ui';
import { useToast } from '../../components/Toast';

export default function SafetyMeasures() {
  const toast = useToast();
  const [machines, setMachines] = useState([]);
  const [machineId, setMachineId] = useState('');
  const [loading, setLoading] = useState(true);
  const [measures, setMeasures] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [completionsOpen, setCompletionsOpen] = useState(false);
  const [completions, setCompletions] = useState([]);

  useEffect(() => {
    api.allMachines().then((r) => { setMachines(r.machine_ids || []); if (r.machine_ids?.length) setMachineId(r.machine_ids[0]); }).finally(() => setLoading(false));
  }, []);

  const load = () => machineId && api.adminSafetyMeasures(machineId).then((r) => setMeasures((r.measures || []).sort((a, b) => a.sort_order - b.sort_order)));
  useEffect(() => { load(); }, [machineId]);

  const reorder = async (newOrder) => {
    setMeasures(newOrder);
    const items = newOrder.map((m, i) => ({ id: m.id, sort_order: i + 1 }));
    try { await api.reorderSafetyMeasures(items); } catch (err) { toast.error('Could not save order.'); }
  };

  const remove = async (id) => {
    try { await api.deleteSafetyMeasure(id); setMeasures((m) => m.filter((x) => x.id !== id)); toast.info('Deactivated.'); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : 'Could not delete.'); }
  };

  const openCompletions = async () => {
    setCompletionsOpen(true);
    const r = await api.safetyCompletions(machineId);
    setCompletions(r.completions || []);
  };

  if (loading) return <FullPageLoader label="Loading safety measures…" />;

  return (
    <div>
      <PageHeader
        eyebrow="Safety"
        title="Safety measures"
        description="Ordered steps every worker sees before starting on a machine. Drag to reorder."
        actions={
          <>
            {machines.length > 0 && (
              <Select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="min-w-[160px]">
                {machines.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            )}
            <Button variant="ghost" icon={Users} onClick={openCompletions}>Completions</Button>
            <Button icon={Plus} onClick={() => setCreateOpen(true)}>New step</Button>
          </>
        }
      />

      {measures.length === 0 ? (
        <EmptyState icon={Plus} title="No steps yet" description="Add the first safety step for this machine." />
      ) : (
        <Reorder.Group axis="y" values={measures} onReorder={reorder} className="space-y-3">
          {measures.map((m) => (
            <Reorder.Item key={m.id} value={m} className="sv-card p-5 flex items-start gap-4 cursor-grab active:cursor-grabbing">
              <GripVertical size={18} className="text-muted mt-1 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-display font-bold">{m.title}</p>
                  {!m.is_active && <Badge tone="amber">Inactive</Badge>}
                  {m.video_url && <Video size={13} className="text-signal" />}
                </div>
                <p className="text-sm text-muted whitespace-pre-wrap">{m.content}</p>
              </div>
              <button onClick={() => remove(m.id)} className="text-muted hover:text-danger shrink-0"><Trash2 size={16} /></button>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New safety step">
        <CreateMeasureForm machineId={machineId} sortOrder={measures.length + 1} onDone={() => { setCreateOpen(false); load(); }} />
      </Modal>

      <Modal open={completionsOpen} onClose={() => setCompletionsOpen(false)} title={`Completions — ${machineId}`}>
        {completions.length === 0 ? <p className="text-muted text-sm">No worker has completed this briefing yet.</p> : (
          <div className="space-y-2">
            {completions.map((c) => (
              <div key={c.worker_id} className="flex items-center justify-between sv-card bg-surface-3 p-3">
                <div>
                  <p className="text-sm font-medium">{c.worker_name}</p>
                  <p className="font-mono text-[11px] text-muted">{new Date(c.completed_at).toLocaleString()}</p>
                </div>
                <button
                  onClick={async () => { await api.requireRetake(machineId, c.worker_id); setCompletions((cs) => cs.filter((x) => x.worker_id !== c.worker_id)); }}
                  className="text-xs font-semibold text-amber hover:underline"
                >Require retake</button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function CreateMeasureForm({ machineId, sortOrder, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: '', content: '', sort_order: sortOrder });
  const [saving, setSaving] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const fileRef = useRef(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.createSafetyMeasure({ ...form, machine_id: machineId });
      if (videoFile) await api.uploadSafetyVideo(res.measure.id, videoFile);
      toast.success('Step added.');
      onDone();
    } catch (err) { toast.error(err instanceof ApiError ? err.message : 'Could not create step.'); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Title" value={form.title} onChange={set('title')} required />
      <Textarea label="Instructions" rows={5} value={form.content} onChange={set('content')} required />
      <div>
        <span className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wide">Video (optional)</span>
        <button type="button" onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-line rounded-xl py-4 text-xs font-mono text-muted hover:border-signal/50 hover:text-signal">
          {videoFile ? videoFile.name : 'Attach a short demo video'}
        </button>
        <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/x-msvideo" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} className="hidden" />
      </div>
      <Button type="submit" loading={saving} className="w-full">Add step</Button>
    </form>
  );
}
