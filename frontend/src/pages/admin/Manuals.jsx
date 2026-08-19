import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, Trash2 } from 'lucide-react';
import { Api } from '../../lib/api';
import { useToast } from '../../lib/toast';

export default function Manuals() {
  const [allMachines, setAllMachines] = useState([]);
  const [mode, setMode] = useState('existing'); // 'existing' | 'new'
  const [machine, setMachine] = useState('');
  const [newMachineId, setNewMachineId] = useState('');
  const [manuals, setManuals] = useState(null);
  const [progress, setProgress] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const { push } = useToast();

  useEffect(() => {
    Api.allMachines()
      .then((res) => {
        setAllMachines(res.machine_ids || []);
        if (res.machine_ids?.length) setMachine(res.machine_ids[0]);
      })
      .catch((err) => push(err.message, 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeMachineId = mode === 'existing' ? machine : newMachineId.trim();

  function loadManuals(machineId) {
    if (!machineId) return;
    setManuals(null);
    Api.manuals(machineId)
      .then((res) => setManuals(res.manuals || []))
      .catch((err) => push(err.message, 'error'));
  }

  useEffect(() => {
    if (mode === 'existing' && machine) loadManuals(machine);
  }, [machine, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFiles(files) {
    const file = files?.[0];
    if (!file) return;
    if (!activeMachineId) {
      push('Enter or select a machine ID first.', 'error');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      push('Only PDF files are supported.', 'error');
      return;
    }
    setProgress(0);
    Api.uploadManual(activeMachineId, file, (frac) => setProgress(Math.round(frac * 100)))
      .then((res) => {
        push(`Uploaded — ${res.chunks_created} chunks ingested.`, 'success');
        setProgress(null);
        if (mode === 'new') {
          setAllMachines((m) => (m.includes(activeMachineId) ? m : [...m, activeMachineId]));
          setMachine(activeMachineId);
          setMode('existing');
          setNewMachineId('');
        } else {
          loadManuals(activeMachineId);
        }
      })
      .catch((err) => {
        push(err.message, 'error');
        setProgress(null);
      });
  }

  async function deleteManual(filename) {
    try {
      await Api.deleteManual(activeMachineId, filename);
      push('Manual deleted.', 'success');
      loadManuals(activeMachineId);
    } catch (err) {
      push(err.message, 'error');
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 640 }}>
      <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 20, color: 'var(--sv-ink)' }}>Manuals</p>
      <p style={{ fontSize: 13, color: 'var(--sv-muted)', marginBottom: 20 }}>Upload and manage manuals per machine.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setMode('existing')}
          className="sv-btn"
          style={{
            fontSize: 12,
            padding: '6px 12px',
            borderRadius: 'var(--sv-radius-sm)',
            fontWeight: 600,
            background: mode === 'existing' ? 'var(--sv-brass)' : 'var(--sv-surface)',
            color: mode === 'existing' ? '#fff' : 'var(--sv-ink)',
            border: mode === 'existing' ? '1px solid var(--sv-brass)' : '1px solid var(--sv-border)',
          }}
        >
          Existing machine
        </button>
        <button
          onClick={() => setMode('new')}
          className="sv-btn"
          style={{
            fontSize: 12,
            padding: '6px 12px',
            borderRadius: 'var(--sv-radius-sm)',
            fontWeight: 600,
            background: mode === 'new' ? 'var(--sv-brass)' : 'var(--sv-surface)',
            color: mode === 'new' ? '#fff' : 'var(--sv-ink)',
            border: mode === 'new' ? '1px solid var(--sv-brass)' : '1px solid var(--sv-border)',
          }}
        >
          New machine
        </button>
      </div>

      {mode === 'existing' ? (
        <select
          value={machine}
          onChange={(e) => setMachine(e.target.value)}
          style={{ fontSize: 13, fontWeight: 600, borderRadius: 'var(--sv-radius-sm)', padding: '8px 12px', background: 'var(--sv-brass-soft)', color: 'var(--sv-brass)', border: '1px solid var(--sv-border)', marginBottom: 20 }}
        >
          {allMachines.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      ) : (
        <input
          value={newMachineId}
          onChange={(e) => setNewMachineId(e.target.value)}
          placeholder="e.g. LX-90"
          style={{ display: 'block', fontSize: 13, borderRadius: 'var(--sv-radius-sm)', padding: '8px 12px', border: '1px solid var(--sv-border)', marginBottom: 20, width: 200 }}
        />
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--sv-brass)' : 'var(--sv-border)'}`, borderRadius: 'var(--sv-radius-lg)',
          padding: 32, textAlign: 'center', cursor: 'pointer', marginBottom: 24,
          background: dragOver ? 'var(--sv-brass-soft)' : 'var(--sv-surface)',
        }}
      >
        <input ref={fileInputRef} type="file" accept="application/pdf" hidden onChange={(e) => handleFiles(e.target.files)} />
        <Upload size={24} style={{ color: 'var(--sv-brass)', marginBottom: 8 }} />
        <p style={{ fontSize: 13, color: 'var(--sv-ink)' }}>Drop a PDF here, or click to browse</p>
        {progress !== null && (
          <div style={{ marginTop: 16, height: 6, borderRadius: 'var(--sv-radius-full)', background: 'var(--sv-border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--sv-brass)', transition: 'width 0.15s ease' }} />
          </div>
        )}
      </div>

      {mode === 'existing' && (
        <>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 8 }}>Uploaded manuals</p>
          {manuals === null && <p style={{ fontSize: 13, color: 'var(--sv-muted)' }}>Loading…</p>}
          {manuals?.length === 0 && <p style={{ fontSize: 13, color: 'var(--sv-muted)' }}>No manuals uploaded for {machine} yet.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {manuals?.map((m) => (
              <div key={m.filename} className="sv-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={16} color="var(--sv-muted)" />
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--sv-ink)' }}>{m.filename}</p>
                    <p style={{ fontSize: 11, color: 'var(--sv-muted)' }}>{m.chunk_count ?? m.chunks ?? '?'} chunks</p>
                  </div>
                </div>
                <button className="sv-btn sv-btn--danger-text" onClick={() => deleteManual(m.filename)} aria-label={`Delete ${m.filename}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}