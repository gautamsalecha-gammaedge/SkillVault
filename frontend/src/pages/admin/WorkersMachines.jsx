import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Api } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { useI18n } from '../../lib/i18n';
import { COUNTRY_CODES } from '../../lib/countryCodes';

const fieldLabel = { fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 6, display: 'block' };
const fieldInput = {
  width: '100%', border: '1.5px solid var(--sv-border)', borderRadius: 'var(--sv-radius-md)',
  padding: '10px 12px', fontSize: 14, outline: 'none', background: 'var(--sv-bg)',
  color: 'var(--sv-ink)', fontFamily: 'var(--sv-font-body)', boxSizing: 'border-box',
};

export default function WorkersMachines() {
  const { t } = useI18n();
  const [workers, setWorkers] = useState([]);
  const [allMachines, setAllMachines] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [assigned, setAssigned] = useState([]);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  function loadWorkers() {
    return Api.allWorkers().then((res) => setWorkers(res.workers || [])).catch((err) => push(err.message, 'error'));
  }

  useEffect(() => {
    loadWorkers();
    Api.allMachines().then((res) => setAllMachines(res.machine_ids || [])).catch((err) => push(err.message, 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function selectWorker(w) {
    setSelectedWorker(w);
    Api.workerMachines(w.worker_id)
      .then((res) => setAssigned(res.machine_ids || []))
      .catch((err) => push(err.message, 'error'));
  }

  /** Called after a successful profile save (including a worker_id rename) -
   * refreshes the list and keeps the (possibly renamed) worker selected. */
  async function handleProfileSaved(updatedWorker) {
    await loadWorkers();
    setSelectedWorker(updatedWorker);
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
            <WorkerProfileEditor
              key={selectedWorker.worker_id}
              worker={selectedWorker}
              t={t}
              push={push}
              onSaved={handleProfileSaved}
            />

            <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 18, color: 'var(--sv-ink)', marginBottom: 4, marginTop: 24 }}>
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

function WorkerProfileEditor({ worker, t, push, onSaved }) {
  const [name, setName] = useState(worker.name || '');
  const [workerId, setWorkerId] = useState(worker.worker_id || '');
  const [countryCode, setCountryCode] = useState(worker.phone_country_code || '+91');
  const [phoneNumber, setPhoneNumber] = useState(worker.phone_number || '');
  const [address, setAddress] = useState(worker.address || '');
  const [busy, setBusy] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const fields = {
        name,
        phone_country_code: countryCode,
        phone_number: phoneNumber || null,
        address: address || null,
      };
      if (workerId !== worker.worker_id) fields.new_worker_id = workerId;

      const res = await Api.updateWorkerByAdmin(worker.worker_id, fields);
      push(t('profileUpdated'), 'success');
      onSaved({
        worker_id: res.worker_id,
        name: res.name,
        is_approved: worker.is_approved,
        phone_country_code: res.phone_country_code,
        phone_number: res.phone_number,
        address: res.address,
      });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sv-card" style={{ marginBottom: 8 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 14 }}>
        {t('editWorkerProfileTitle').replace('{name}', worker.name)}
      </p>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={fieldLabel}>{t('nameLabel')}</label>
          <input style={fieldInput} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div>
          <label style={fieldLabel}>{t('workerIdRenameLabel')}</label>
          <input style={fieldInput} value={workerId} onChange={(e) => setWorkerId(e.target.value)} required />
          {workerId !== worker.worker_id && (
            <p style={{ fontSize: 11, color: 'var(--sv-danger)', marginTop: 4 }}>{t('workerIdRenameHint')}</p>
          )}
        </div>

        <div>
          <label style={fieldLabel}>{t('phoneNumberLabel')}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select style={{ ...fieldInput, flex: '0 0 130px' }} value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
            <input style={{ ...fieldInput, flex: 1 }} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
          </div>
        </div>

        <div>
          <label style={fieldLabel}>{t('addressLabel')}</label>
          <input style={fieldInput} placeholder={t('addressPlaceholder')} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>

        <button
          className="sv-btn sv-btn--primary"
          style={{ alignSelf: 'flex-start', padding: '10px 16px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--sv-radius-md)' }}
          disabled={busy}
          type="submit"
        >
          {busy ? t('savingBtn') : t('saveProfileBtn')}
        </button>
      </form>
    </div>
  );
}