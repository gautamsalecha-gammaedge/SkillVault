import { useEffect, useState } from 'react';
import { Check, X, UserCheck } from 'lucide-react';
import { Api } from '../../lib/api';
import { useToast } from '../../lib/toast';

export default function PendingWorkers() {
  const [workers, setWorkers] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const { push } = useToast();

  function load() {
    Api.pendingWorkers()
      .then((res) => setWorkers(res.pending_workers || []))
      .catch((err) => push(err.message, 'error'));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function approve(workerId) {
    setBusyId(workerId);
    try {
      await Api.approveWorker(workerId);
      push('Worker approved.', 'success');
      setWorkers((w) => w.filter((x) => x.worker_id !== workerId));
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(workerId) {
    setBusyId(workerId);
    try {
      await Api.rejectWorker(workerId);
      push('Registration rejected and removed.', 'success');
      setWorkers((w) => w.filter((x) => x.worker_id !== workerId));
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 720 }}>
      <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 20, color: 'var(--sv-ink)' }}>Pending workers</p>
      <p style={{ fontSize: 13, color: 'var(--sv-muted)', marginBottom: 20 }}>New registrations waiting for approval.</p>

      {workers === null && <p style={{ fontSize: 13, color: 'var(--sv-muted)' }}>Loading…</p>}

      {workers?.length === 0 && (
        <div className="sv-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--sv-muted)' }}>
          <UserCheck size={28} style={{ marginBottom: 12, opacity: 0.6 }} />
          <p style={{ fontSize: 14 }}>No pending registrations right now.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {workers?.map((w) => (
          <div key={w.worker_id} className="sv-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--sv-ink)' }}>{w.name}</p>
              <p style={{ fontSize: 12, fontFamily: 'var(--sv-font-mono)', color: 'var(--sv-muted)' }}>{w.worker_id}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="sv-btn sv-btn--teal" disabled={busyId === w.worker_id} onClick={() => approve(w.worker_id)}>
                <Check size={14} /> Approve
              </button>
              <button className="sv-btn sv-btn--outline" style={{ color: 'var(--sv-danger)' }} disabled={busyId === w.worker_id} onClick={() => reject(w.worker_id)}>
                <X size={14} /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
