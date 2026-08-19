import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Api } from '../../lib/api';
import { useToast } from '../../lib/toast';

export default function WorkersMachines() {
  const [workers, setWorkers] = useState([]);
  const [allMachines, setAllMachines] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [assigned, setAssigned] = useState([]);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    Api.allWorkers().then((res) => setWorkers(res.workers || [])).catch((err) => push(err.message, 'error'));
    Api.allMachines().then((res) => setAllMachines(res.machine_ids || [])).catch((err) => push(err.message, 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function selectWorker(w) {
    setSelectedWorker(w);
    Api.workerMachines(w.worker_id)
      .then((res) => setAssigned(res.machine_ids || []))
      .catch((err) => push(err.message, 'error'));
  }

  async function assign(machineId) {
    if (!selectedWorker) return;
    setBusy(true);
    try {
      await Api.assignMachine(selectedWorker.worker_id, machineId);
      setAssigned((a) => (a.includes(machineId) ? a : [...a, machineId]));
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function unassign(machineId) {
    if (!selectedWorker) return;
    setBusy(true);
    try {
      await Api.unassignMachine(selectedWorker.worker_id, machineId);
      setAssigned((a) => a.filter((m) => m !== machineId));
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const unassignedMachines = allMachines.filter((m) => !assigned.includes(m));

  return (
    <div style={{ padding: '24px 32px', display: 'flex', gap: 24 }}>
      <div style={{ width: 260, flexShrink: 0 }}>
        <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 20, color: 'var(--sv-ink)', marginBottom: 16 }}>
          Workers
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {workers.map((w) => (
            <button
              key={w.worker_id}
              onClick={() => selectWorker(w)}
              style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: 'var(--sv-radius-sm)', fontSize: 14,
                background: selectedWorker?.worker_id === w.worker_id ? 'var(--sv-brass-soft)' : 'transparent',
                color: selectedWorker?.worker_id === w.worker_id ? 'var(--sv-brass)' : 'var(--sv-ink)',
              }}
            >
              <div style={{ fontWeight: 500 }}>{w.name}</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--sv-font-mono)', color: 'var(--sv-muted)' }}>
                {w.worker_id} {!w.is_approved && '· unapproved'}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        {!selectedWorker ? (
          <p style={{ fontSize: 13, color: 'var(--sv-muted)', marginTop: 40 }}>Select a worker to manage machine access.</p>
        ) : (
          <>
            <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 18, color: 'var(--sv-ink)', marginBottom: 4 }}>
              {selectedWorker.name}'s machines
            </p>
            <p style={{ fontSize: 12, color: 'var(--sv-muted)', marginBottom: 16 }}>Assign or revoke access to specific machines.</p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {assigned.length === 0 && <p style={{ fontSize: 13, color: 'var(--sv-muted)' }}>No machines assigned yet.</p>}
              {assigned.map((m) => (
                <span key={m} style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'var(--sv-font-mono)',
                  padding: '6px 10px', borderRadius: 'var(--sv-radius-full)', background: 'var(--sv-teal-soft)', color: 'var(--sv-teal)',
                }}>
                  {m}
                  <button disabled={busy} onClick={() => unassign(m)} aria-label={`Unassign ${m}`}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>

            {unassignedMachines.length > 0 && (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 8 }}>Available machines</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {unassignedMachines.map((m) => (
                    <button
                      key={m}
                      disabled={busy}
                      onClick={() => assign(m)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'var(--sv-font-mono)',
                        padding: '6px 10px', borderRadius: 'var(--sv-radius-full)', border: '1px solid var(--sv-border)', color: 'var(--sv-ink)',
                      }}
                    >
                      <Plus size={12} /> {m}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
