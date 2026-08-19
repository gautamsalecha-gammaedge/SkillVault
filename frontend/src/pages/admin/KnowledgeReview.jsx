import { useEffect, useState } from 'react';
import { Search, Pencil, Info } from 'lucide-react';
import Stamp from '../../components/Stamp';
import { Api } from '../../lib/api';
import { useToast } from '../../lib/toast';

export default function KnowledgeReview() {
  const [allMachines, setAllMachines] = useState([]);
  const [machine, setMachine] = useState('');
  const [entries, setEntries] = useState(null);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [busyId, setBusyId] = useState(null);
  const { push } = useToast();

  useEffect(() => {
    Api.allMachines()
      .then((res) => {
        setAllMachines(res.machine_ids || []);
        if (res.machine_ids?.length) setMachine(res.machine_ids[0]);
      })
      .catch((err) => push(err.message, 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!machine) return;
    setEntries(null);
    Api.pendingEntries(machine)
      .then((res) => setEntries(res.pending_entries || []))
      .catch((err) => push(err.message, 'error'));
  }, [machine]); // eslint-disable-line react-hooks/exhaustive-deps

  async function approve(id) {
    setBusyId(id);
    try {
      await Api.approveEntry(id);
      push('Entry approved.', 'success');
      setEntries((e) => e.filter((x) => x.id !== id));
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id) {
    setBusyId(id);
    try {
      await Api.deleteEntry(id);
      push('Entry deleted.', 'success');
      setEntries((e) => e.filter((x) => x.id !== id));
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  const filtered = (entries || []).filter((e) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return e.text.toLowerCase().includes(q) || e.worker_name?.toLowerCase().includes(q);
  });

  return (
    <div style={{ padding: '24px 32px', maxWidth: 780 }}>
      <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 20, color: 'var(--sv-ink)' }}>Knowledge review</p>
      <p style={{ fontSize: 13, color: 'var(--sv-muted)', marginBottom: 16 }}>
        Pending tips for one machine at a time — search narrows what's already loaded.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={machine}
          onChange={(e) => setMachine(e.target.value)}
          style={{ fontSize: 13, fontWeight: 600, borderRadius: 'var(--sv-radius-sm)', padding: '8px 12px', background: 'var(--sv-brass-soft)', color: 'var(--sv-brass)', border: '1px solid var(--sv-border)' }}
        >
          {allMachines.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200, borderRadius: 'var(--sv-radius-sm)', padding: '8px 12px', background: 'var(--sv-surface)', border: '1px solid var(--sv-border)' }}>
          <Search size={14} color="var(--sv-muted)" />
          <input
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, background: 'transparent' }}
            placeholder="Filter by text or worker..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: 'var(--sv-muted)', marginBottom: 16, padding: 10, background: 'var(--sv-brass-soft)', borderRadius: 'var(--sv-radius-sm)' }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 1, color: 'var(--sv-brass)' }} />
        <span>
          This only shows <strong>pending</strong> entries per machine — the backend doesn't yet support
          cross-status search or filters (worker, date, source type). Editing text here previews a
          change but doesn't save it — there's no endpoint to persist an edit yet, only approve or delete as-is.
        </span>
      </div>

      {entries === null && <p style={{ fontSize: 13, color: 'var(--sv-muted)' }}>Loading…</p>}
      {entries?.length === 0 && (
        <div className="sv-card" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--sv-muted)' }}>
          Nothing pending for {machine}.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((entry) => {
          const editing = editingId === entry.id;
          return (
            <div key={entry.id} className="sv-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--sv-font-mono)', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--sv-bg)', color: 'var(--sv-muted)' }}>
                  {machine}
                </span>
                <Stamp status="pending" />
              </div>

              {editing ? (
                <textarea
                  rows={3}
                  style={{ width: '100%', border: '1px solid var(--sv-brass)', borderRadius: 'var(--sv-radius-sm)', padding: 10, fontSize: 14, outline: 'none', marginBottom: 12, resize: 'vertical' }}
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                />
              ) : (
                <p style={{ fontSize: 14, color: 'var(--sv-ink)', marginBottom: 12 }}>{entry.text}</p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--sv-muted)' }}>Submitted by {entry.worker_name || entry.worker_id}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="sv-btn sv-btn--outline"
                    onClick={() => {
                      if (editing) { setEditingId(null); }
                      else { setEditingId(entry.id); setDraftText(entry.text); }
                    }}
                  >
                    <Pencil size={13} /> {editing ? 'Done editing' : 'Edit'}
                  </button>
                  <button className="sv-btn sv-btn--teal" disabled={busyId === entry.id} onClick={() => approve(entry.id)}>
                    Approve
                  </button>
                  <button className="sv-btn sv-btn--danger-text" disabled={busyId === entry.id} onClick={() => remove(entry.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
