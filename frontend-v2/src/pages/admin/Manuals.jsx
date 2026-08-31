import { useEffect, useRef, useState } from 'react';
import { FileText, UploadCloud, Trash2, Plus, AlertTriangle } from 'lucide-react';
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
  const [deleteMachineOpen, setDeleteMachineOpen] = useState(false);
  const [deletingMachine, setDeletingMachine] = useState(false);
  const fileRef = useRef(null);

  const loadMachines = () =>
    api.allMachines().then((r) => {
      const ids = r.machine_ids || [];
      setMachines(ids);
      setMachineId((prev) => {
        if (prev && ids.includes(prev)) return prev;
        return ids[0] || '';
      });
      return ids;
    });

  useEffect(() => {
    loadMachines().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!machineId) {
      setManuals([]);
      return;
    }
    api.manuals(machineId).then((r) => setManuals(r.manuals || [])).catch(() => setManuals([]));
  }, [machineId]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !machineId) return;
    setUploading(true);
    setProgress(0);
    try {
      const res = await api.uploadManual(machineId, file, setProgress);
      toast.success(`Ingested ${res.chunks_created} chunks from ${res.filename}.`);
      // Refresh machine list (new machine becomes official) + manuals
      await loadMachines();
      const r = await api.manuals(machineId);
      setManuals(r.manuals || []);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const remove = async (filename) => {
    try {
      await api.deleteManual(machineId, filename);
      setManuals((m) => m.filter((x) => x.filename !== filename));
      toast.info('Manual removed.');
      // If last manual for this machine was removed, machine may still
      // exist via tips — list_all_machine_ids keeps it until full delete.
      await loadMachines();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete.');
    }
  };

  const createMachine = () => {
    if (!newMachineId.trim()) return;
    setMachineId(newMachineId.trim());
    setNewMachineOpen(false);
    toast.info('Upload a manual to bring this machine online.');
    setNewMachineId('');
  };

  const confirmDeleteMachine = async () => {
    if (!machineId) return;
    setDeletingMachine(true);
    try {
      const res = await api.deleteMachine(machineId);
      const s = res.summary || {};
      toast.success(
        res.message ||
          `Machine ${machineId} removed (${s.chroma_entries_removed ?? 0} knowledge entries, ${s.worker_assignments_removed ?? 0} assignments).`,
      );
      setDeleteMachineOpen(false);
      setManuals([]);
      const ids = await loadMachines();
      if (!ids.length) setMachineId('');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete machine.');
    } finally {
      setDeletingMachine(false);
    }
  };

  if (loading) return <FullPageLoader label="Loading manuals…" />;

  return (
    <div>
      <PageHeader
        eyebrow="Knowledge base"
        title="Manuals"
        description="Upload machine manuals — they're auto-chunked and embedded into the AI's knowledge base. Delete a whole machine to remove its manuals, tips, interviews, safety data, and worker assignments in one step."
        actions={
          <>
            {machines.length > 0 && (
              <Select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="min-w-[160px]">
                {machines.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            )}
            <Button variant="ghost" icon={Plus} onClick={() => setNewMachineOpen(true)}>
              New machine
            </Button>
            {machineId && (
              <Button
                variant="ghost"
                icon={Trash2}
                onClick={() => setDeleteMachineOpen(true)}
                className="text-danger hover:text-danger"
              >
                Delete machine
              </Button>
            )}
          </>
        }
      />

      {machineId && (
        <Card className="p-6 mb-6">
          <h3 className="font-display font-bold text-lg mb-3">Upload a manual for {machineId}</h3>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed border-line rounded-xl py-8 flex flex-col items-center gap-2 text-muted hover:border-signal/50 hover:text-signal transition-colors"
          >
            <UploadCloud size={22} />
            <span className="text-xs font-mono">{uploading ? 'Uploading…' : 'PDF only — click to choose a file'}</span>
          </button>
          <input ref={fileRef} type="file" accept="application/pdf" onChange={onFile} className="hidden" />
          {uploading && (
            <div className="mt-4">
              <ProgressBar value={progress * 100} />
            </div>
          )}
        </Card>
      )}

      {!machineId ? (
        <EmptyState
          icon={FileText}
          title="No machines yet"
          description="Create a machine and upload its first PDF manual to bring it online."
        />
      ) : manuals.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No manuals ingested"
          description="Upload a PDF to give the AI something to answer from — or delete this machine if it should no longer exist."
        />
      ) : (
        <div className="space-y-3">
          {manuals.map((m) => (
            <Card key={m.filename} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <FileText size={18} className="text-signal shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.filename}</p>
                  <p className="text-[11px] font-mono text-muted">
                    {m.chunk_count ?? m.chunks_created ?? '—'} chunks
                  </p>
                </div>
              </div>
              <button onClick={() => remove(m.filename)} className="text-muted hover:text-danger shrink-0" title="Delete this manual">
                <Trash2 size={16} />
              </button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={newMachineOpen} onClose={() => setNewMachineOpen(false)} title="Add a machine">
        <div className="space-y-4">
          <Input
            label="Machine ID"
            placeholder="e.g. CNC-205"
            value={newMachineId}
            onChange={(e) => setNewMachineId(e.target.value)}
          />
          <p className="text-xs text-muted">A machine appears in the system once its first manual is uploaded.</p>
          <Button onClick={createMachine} className="w-full">
            Continue to upload
          </Button>
        </div>
      </Modal>

      <Modal open={deleteMachineOpen} onClose={() => !deletingMachine && setDeleteMachineOpen(false)} title="Delete entire machine?">
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl border-2 border-amber/40 bg-amber/10 p-3">
            <AlertTriangle className="text-amber shrink-0 mt-0.5" size={20} />
            <div className="text-sm">
              <p className="font-semibold text-text mb-1">This cannot be undone</p>
              <p className="text-muted">
                Deleting <span className="font-mono font-semibold text-text">{machineId}</span> will permanently remove:
              </p>
              <ul className="mt-2 list-disc pl-5 text-muted space-y-0.5">
                <li>All manuals and AI knowledge for this machine</li>
                <li>Worker tips and interview knowledge</li>
                <li>Safety measures and completion records</li>
                <li>Worker assignments to this machine</li>
                <li>Related tickets, daily updates, and question logs</li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button variant="ghost" disabled={deletingMachine} onClick={() => setDeleteMachineOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              disabled={deletingMachine}
              onClick={confirmDeleteMachine}
              className="bg-danger text-white hover:opacity-90"
            >
              {deletingMachine ? 'Deleting…' : `Delete ${machineId}`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}