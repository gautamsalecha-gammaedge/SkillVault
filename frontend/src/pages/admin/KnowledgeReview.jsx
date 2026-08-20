import { useEffect, useState } from 'react';
import { Search, Pencil, Check, X, Film, ChevronDown } from 'lucide-react';
import Stamp from '../../components/Stamp';
import { Api, mediaUrl } from '../../lib/api';
import { useToast } from '../../lib/toast';

/**
 * The backend embeds+stores the worker's tip text with the Gemini video
 * understanding appended (see routers/knowledge.py: "\n\n[Video
 * Understanding]: ..." / "\n\n[Transcript]: ..."), so entry.text for a
 * video tip includes that appendix. Strip it back off for display here —
 * the video player + a separate expandable transcript cover that same
 * information without repeating raw appended text in the main tip body.
 */
function tipTextOnly(text) {
  const idx = text.indexOf('\n\n[Video Understanding]:');
  return idx === -1 ? text : text.slice(0, idx).trim();
}

function VideoBlock({ entry, open, onToggle }) {
  const hasDetails = entry.video_description || entry.transcript;
  return (
    <div style={{ marginBottom: 12 }}>
      <video
        src={mediaUrl(entry.video_url)}
        controls
        style={{ width: '100%', maxHeight: 200, borderRadius: 'var(--sv-radius-sm)', background: '#000', display: 'block' }}
      />
      {hasDetails && (
        <div style={{ marginTop: 6 }}>
          <button
            type="button"
            onClick={onToggle}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
              color: 'var(--sv-brass)', background: 'none', border: 'none', padding: 0,
            }}
          >
            <Film size={12} />
            {open ? 'Hide' : 'Show'} AI video summary
            <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
          </button>
          {open && (
            <div style={{ marginTop: 8, padding: 10, background: 'var(--sv-bg)', borderRadius: 'var(--sv-radius-sm)', fontSize: 12.5, color: 'var(--sv-muted)', lineHeight: 1.5 }}>
              {entry.video_description && (
                <p style={{ marginBottom: entry.transcript ? 8 : 0 }}>
                  <strong style={{ color: 'var(--sv-ink)' }}>What the video shows: </strong>{entry.video_description}
                </p>
              )}
              {entry.transcript && (
                <p style={{ margin: 0 }}>
                  <strong style={{ color: 'var(--sv-ink)' }}>Transcript: </strong>{entry.transcript}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function KnowledgeReview() {
  const [allMachines, setAllMachines] = useState([]);
  const [machine, setMachine] = useState('');
  const [entries, setEntries] = useState(null);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [openVideoId, setOpenVideoId] = useState(null); // entry.id whose transcript/description is expanded
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

  function startEdit(entry) {
    setEditingId(entry.id);
    setDraftText(tipTextOnly(entry.text));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftText('');
  }

  async function saveEdit(entry) {
    const trimmed = draftText.trim();
    if (!trimmed) {
      push('Tip text cannot be empty.', 'error');
      return;
    }
    // Re-append the video understanding/transcript (if any) so editing the
    // worker's own wording doesn't silently drop the video context from
    // what's actually stored and searched (see tipTextOnly's note above).
    let fullText = trimmed;
    if (entry.video_description) fullText += `\n\n[Video Understanding]: ${entry.video_description}`;
    if (entry.transcript) fullText += `\n\n[Transcript]: ${entry.transcript}`;

    setSavingId(entry.id);
    try {
      await Api.editEntry(entry.id, fullText);
      push('Entry updated.', 'success');
      setEntries((e) => e.map((x) => (x.id === entry.id ? { ...x, text: fullText } : x)));
      setEditingId(null);
      setDraftText('');
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSavingId(null);
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

      {/* <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: 'var(--sv-muted)', marginBottom: 16, padding: 10, background: 'var(--sv-brass-soft)', borderRadius: 'var(--sv-radius-sm)' }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 1, color: 'var(--sv-brass)' }} />
        <span>
          This only shows <strong>pending</strong> entries per machine — the backend doesn't yet support
          cross-status search or filters (worker, date, source type).
        </span>
      </div> */}
      

      {entries === null && <p style={{ fontSize: 13, color: 'var(--sv-muted)' }}>Loading…</p>}
      {entries?.length === 0 && (
        <div className="sv-card" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--sv-muted)' }}>
          Nothing pending for {machine}.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((entry) => {
          const editing = editingId === entry.id;
          const saving = savingId === entry.id;
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
                  autoFocus
                  disabled={saving}
                  style={{ width: '100%', border: '1px solid var(--sv-brass)', borderRadius: 'var(--sv-radius-sm)', padding: 10, fontSize: 14, outline: 'none', marginBottom: 12, resize: 'vertical' }}
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                />
              ) : (
                <p style={{ fontSize: 14, color: 'var(--sv-ink)', marginBottom: 12 }}>{tipTextOnly(entry.text)}</p>
              )}

              {!editing && entry.video_url && (
                <VideoBlock entry={entry} open={openVideoId === entry.id} onToggle={() => setOpenVideoId((id) => (id === entry.id ? null : entry.id))} />
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--sv-muted)' }}>Submitted by {entry.worker_name || entry.worker_id}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {editing ? (
                    <>
                      <button className="sv-btn sv-btn--outline" disabled={saving} onClick={cancelEdit}>
                        <X size={13} /> Cancel
                      </button>
                      <button className="sv-btn sv-btn--teal" disabled={saving} onClick={() => saveEdit(entry)}>
                        <Check size={13} /> {saving ? 'Saving…' : 'Save'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="sv-btn sv-btn--outline" onClick={() => startEdit(entry)}>
                        <Pencil size={13} /> Edit
                      </button>
                      <button className="sv-btn sv-btn--teal" disabled={busyId === entry.id} onClick={() => approve(entry.id)}>
                        Approve
                      </button>
                      <button className="sv-btn sv-btn--danger-text" disabled={busyId === entry.id} onClick={() => remove(entry.id)}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}