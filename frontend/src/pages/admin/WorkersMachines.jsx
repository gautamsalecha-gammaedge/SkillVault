import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Api } from '../../lib/api';
import { useToast } from '../../lib/toast';

const inputStyle = {
  border: '1.5px solid var(--sv-border)',
  borderRadius: 'var(--sv-radius-md)',
  padding: '10px 12px',
  fontSize: 14,
  outline: 'none',
  background: 'var(--sv-bg)',
  color: 'var(--sv-ink)',
  width: '100%',
  boxSizing: 'border-box',
};

export default function WorkersMachines() {
  const [workers, setWorkers] = useState([]);
  const [allMachines, setAllMachines] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [assigned, setAssigned] = useState([]);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  // Profile edit form state
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editApproved, setEditApproved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  function loadWorkers() {
    return Api.allWorkers()
      .then((res) => setWorkers(res.workers || []))
      .catch((err) => push(err.message, 'error'));
  }

  useEffect(() => {
    loadWorkers();
    Api.allMachines().then((res) => setAllMachines(res.machine_ids || [])).catch((err) => push(err.message, 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function selectWorker(w) {
    setSelectedWorker(w);
    setEditId(w.worker_id);
    setEditName(w.name || '');
    setEditPhone(w.phone || '');
    setEditAddress(w.address || '');
    setEditApproved(!!w.is_approved);
    Api.workerMachines(w.worker_id)
      .then((res) => setAssigned(res.machine_ids || []))
      .catch((err) => push(err.message, 'error'));
  }

  async function saveProfile(e) {
    e.preventDefault();
    if (!selectedWorker) return;
    setSavingProfile(true);
    try {
      const payload = {
        name: editName.trim(),
        phone: editPhone.trim() || null,
        address: editAddress.trim() || null,
        is_approved: editApproved,
      };
      if (editId.trim() && editId.trim() !== selectedWorker.worker_id) {
        payload.worker_id = editId.trim();
      }
      const res = await Api.updateWorkerAsAdmin(selectedWorker.worker_id, payload);
      push('Worker profile updated.', 'success');
      await loadWorkers();
      // Re-select with updated data
      const updated = {
        worker_id: res.worker_id,
        name: res.name,
        phone: res.phone,
        address: res.address,
        is_approved: res.is_approved,
      };
      setSelectedWorker(updated);
      setEditId(res.worker_id);
      setEditName(res.name || '');
      setEditPhone(res.phone || '');
      setEditAddress(res.address || '');
      setEditApproved(!!res.is_approved);
      // Reload machines for (possibly renamed) worker
      const machines = await Api.workerMachines(res.worker_id);
      setAssigned(machines.machine_ids || []);
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSavingProfile(false);
    }
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
                border: '1px solid var(--sv-border)',
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

      <div style={{ flex: 1, maxWidth: 560 }}>
        {!selectedWorker ? (
          <p style={{ fontSize: 13, color: 'var(--sv-muted)', marginTop: 40 }}>Select a worker to edit profile and manage machines.</p>
        ) : (
          <>
            <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 18, color: 'var(--sv-ink)', marginBottom: 4 }}>
              {selectedWorker.name}
            </p>
            <p style={{ fontSize: 12, color: 'var(--sv-muted)', marginBottom: 16 }}>
              Edit profile (password cannot be changed here) and assign machines.
            </p>

            <form onSubmit={saveProfile} className="sv-card" style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)' }}>Profile</p>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--sv-muted)' }}>Worker ID</span>
                <input style={inputStyle} value={editId} onChange={(e) => setEditId(e.target.value)} required />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--sv-muted)' }}>Full name</span>
                <input style={inputStyle} value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--sv-muted)' }}>Phone (with country code)</span>
                <input style={inputStyle} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+91 98765 43210" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--sv-muted)' }}>Address</span>
                <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} value={editAddress} onChange={(e) => setEditAddress(e.target.value)} rows={2} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={editApproved} onChange={(e) => setEditApproved(e.target.checked)} />
                Approved (can log in)
              </label>
              <button type="submit" className="sv-btn sv-btn--primary" disabled={savingProfile} style={{ alignSelf: 'flex-start', padding: '10px 18px' }}>
                {savingProfile ? 'Saving…' : 'Save profile'}
              </button>
            </form>

            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 8 }}>Assigned machines</p>
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