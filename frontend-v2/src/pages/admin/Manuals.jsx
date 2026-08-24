import { useEffect, useRef, useState } from 'react';
import { FileText, UploadCloud, Trash2, Plus } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { PageHeader, Card, Select, Button, Input, ProgressBar, EmptyState, FullPageLoader, Modal } from '../../components/ui';
import { useToast } from '../../components/Toast';

export default function Manuals() {
  const toast = useToast();
  const [machines, setMachines] = useState([]);
  const [machineId, setMachineId] = useState('');
  const [loading, setLoading] = useState(true);
  const [manuals, setManuals] = useState([]);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [newMachineOpen, setNewMachineOpen] = useState(false);
  const [newMachineId, setNewMachineId] = useState('');
  const fileRef = useRef(null);

  const loadMachines = () => api.allMachines().then((r) => {
    setMachines(r.machine_ids || []);
    if (r.machine_ids?.length && !machineId) setMachineId(r.machine_ids[0]);
  });

  useEffect(() => { loadMachines().finally(() => setLoading(false)); }, []);

  useEffect(() => {
    if (!machineId) return;
    api.manuals(machineId).then((r) => setManuals(r.manuals || []));
  }, [machineId]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !machineId) return;
    setUploading(true); setProgress(0);
    try {
      const res = await api.uploadManual(machineId, file, setProgress);
      toast.success(`Ingested ${res.chunks_created} chunks from ${res.filename}.`);
      api.manuals(machineId).then((r) => setManuals(r.manuals || []));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Upload failed.');
    } finally { setUploading(false); e.target.value = ''; }
  };

  const remove = async (filename) => {
    try { await api.deleteManual(machineId, filename); setManuals((m) => m.filter((x) => x.filename !== filename)); toast.info('Manual removed.'); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : 'Could not delete.'); }
  };

  const createMachine = () => {
    if (!newMachineId.trim()) return;
    setMachineId(newMachineId.trim());
    setNewMachineOpen(false);
    toast.info('Upload a manual to bring this machine online.');
    setNewMachineId('');
  };

  if (loading) return <FullPageLoader label="Loading manuals…" />;

  return (
    <div>
      <PageHeader
        eyebrow="Knowledge base"
        title="Manuals"
        description="Upload machine manuals — they're auto-chunked and embedded into the AI's knowledge base."
        actions={
          <>
            {machines.length > 0 && (
              <Select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="min-w-[160px]">
                {machines.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            )}
            <Button variant="ghost" icon={Plus} onClick={() => setNewMachineOpen(true)}>New machine</Button>
          </>
        }
      />

      {machineId && (
        <Card className="p-6 mb-6">
          <h3 className="font-display font-bold text-lg mb-3">Upload a manual for {machineId}</h3>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="w-full border-2 border-dashed border-line rounded-xl py-8 flex flex-col items-center gap-2 text-muted hover:border-signal/50 hover:text-signal transition-colors">
            <UploadCloud size={22} />
            <span className="text-xs font-mono">{uploading ? 'Uploading…' : 'PDF only — click to choose a file'}</span>
          </button>
          <input ref={fileRef} type="file" accept="application/pdf" onChange={onFile} className="hidden" />
          {uploading && <div className="mt-4"><ProgressBar value={progress * 100} /></div>}
        </Card>
      )}

      {manuals.length === 0 ? (
        <EmptyState icon={FileText} title="No manuals ingested" description="Upload a PDF to give the AI something to answer from." />
      ) : (
        <div className="space-y-3">
          {manuals.map((m) => (
            <Card key={m.filename} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <FileText size={18} className="text-signal shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.filename}</p>
                  <p className="text-[11px] font-mono text-muted">{m.chunk_count ?? m.chunks_created ?? '—'} chunks</p>
                </div>
              </div>
              <button onClick={() => remove(m.filename)} className="text-muted hover:text-danger shrink-0"><Trash2 size={16} /></button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={newMachineOpen} onClose={() => setNewMachineOpen(false)} title="Add a machine">
        <div className="space-y-4">
          <Input label="Machine ID" placeholder="e.g. CNC-205" value={newMachineId} onChange={(e) => setNewMachineId(e.target.value)} />
          <p className="text-xs text-muted">A machine appears in the system once its first manual is uploaded.</p>
          <Button onClick={createMachine} className="w-full">Continue to upload</Button>
        </div>
      </Modal>
    </div>
  );
}
