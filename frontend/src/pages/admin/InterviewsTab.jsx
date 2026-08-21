import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, PlayCircle, Sparkles, Search, Check, Trash2,
  Clock, CheckCircle2, PauseCircle, User, Wrench, Calendar, AlertCircle,
} from 'lucide-react';
import Stamp from '../../components/Stamp';
import { Api, mediaUrl } from '../../lib/api';
import { useToast } from '../../lib/toast';

const STATUS_META = {
  in_progress: { label: 'In progress', color: 'var(--sv-brass)', bg: 'var(--sv-brass-soft)', icon: Clock },
  paused: { label: 'Paused', color: 'var(--sv-muted)', bg: 'var(--sv-bg-secondary)', icon: PauseCircle },
  completed: { label: 'Completed', color: 'var(--sv-teal)', bg: 'var(--sv-teal-soft)', icon: CheckCircle2 },
  abandoned: { label: 'Abandoned', color: 'var(--sv-muted-light)', bg: 'var(--sv-bg-secondary)', icon: Clock },
};

function StatusChip({ status }) {
  const meta = STATUS_META[status] || STATUS_META.in_progress;
  const Icon = meta.icon;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
        color: meta.color, background: meta.bg, padding: '4px 10px', borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={12} /> {meta.label}
    </span>
  );
}

/**
 * What review state this session's insights are in, at a glance. This
 * is the badge that makes "does this need my attention" answerable
 * without opening the transcript - a completed interview with pending
 * insights reads very differently from one that's already fully
 * reviewed, and previously nothing in the list distinguished them.
 */
function InsightsChip({ pending, approved, rejected }) {
  const total = pending + approved + rejected;
  if (total === 0) {
    return <span style={{ fontSize: 12.5, color: 'var(--sv-muted-light)' }}>No insights</span>;
  }
  if (pending > 0) {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700,
          color: 'var(--sv-warning)', background: 'var(--sv-warning-soft)', padding: '4px 10px', borderRadius: 999,
        }}
      >
        <AlertCircle size={12} /> {pending} pending review
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
        color: 'var(--sv-teal)', background: 'var(--sv-teal-soft)', padding: '4px 10px', borderRadius: 999,
      }}
    >
      <CheckCircle2 size={12} /> Fully reviewed
    </span>
  );
}

function timeAgo(iso) {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * One row in the sessions table. Deliberately built as a real <table>
 * (not stacked cards) with aligned columns - worker, machine, progress,
 * insight-review state, status, recency, and the review action all
 * scannable in a single glance across many rows, the way any real
 * admin console (tickets, orders, moderation queues) is laid out.
 * Approve-all/reject-all live right on the row so a session that
 * doesn't need a turn-by-turn read doesn't require opening one.
 */
function SessionRow({ s, onOpen, onApproveAll, onRejectAll, busy, confirmingReject, onAskReject, onCancelReject }) {
  const progressPct = s.total_topics ? Math.min(100, Math.round((s.topic_index / s.total_topics) * 100)) : 0;
  const pending = s.pending_insights || 0;

  return (
    <tr
      className="sv-interviews-row"
      onClick={() => !confirmingReject && onOpen(s.session_id)}
      style={{ cursor: confirmingReject ? 'default' : 'pointer' }}
    >
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--sv-brass-soft)', color: 'var(--sv-brass)', fontWeight: 700, fontSize: 13,
            }}
          >
            {(s.worker_name || '?').trim().charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--sv-ink)' }}>{s.worker_name}</span>
        </div>
      </td>
      <td>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--sv-ink-secondary)' }}>
          <Wrench size={12} /> {s.machine_id}
        </span>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
          <span style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--sv-border)', overflow: 'hidden' }}>
            <span style={{ display: 'block', width: `${progressPct}%`, height: '100%', background: 'var(--sv-teal)', borderRadius: 3 }} />
          </span>
          <span style={{ fontSize: 12, color: 'var(--sv-muted)', fontFamily: 'var(--sv-font-mono)', whiteSpace: 'nowrap' }}>
            {Math.min(s.topic_index + 1, s.total_topics)}/{s.total_topics}
          </span>
        </div>
      </td>
      <td>
        <InsightsChip pending={s.pending_insights || 0} approved={s.approved_insights || 0} rejected={s.rejected_insights || 0} />
      </td>
      <td><StatusChip status={s.status} /></td>
      <td>
        <span style={{ fontSize: 12.5, color: 'var(--sv-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
          <Calendar size={11} /> {timeAgo(s.completed_at || s.started_at)}
        </span>
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        {confirmingReject ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 12, color: 'var(--sv-danger)' }}>Delete {pending}?</span>
            <button className="sv-btn sv-btn--sm sv-btn--outline" disabled={busy} onClick={onCancelReject}>Cancel</button>
            <button className="sv-btn sv-btn--sm sv-btn--danger" disabled={busy} onClick={onRejectAll}>Confirm</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
            {pending > 0 && (
              <>
                <button
                  className="sv-icon-btn"
                  title={`Approve all ${pending} pending insight${pending === 1 ? '' : 's'}`}
                  disabled={busy}
                  onClick={onApproveAll}
                  style={{ color: 'var(--sv-teal)' }}
                >
                  <Check size={15} />
                </button>
                <button
                  className="sv-icon-btn"
                  title={`Delete all ${pending} pending insight${pending === 1 ? '' : 's'}`}
                  disabled={busy}
                  onClick={onAskReject}
                  style={{ color: 'var(--sv-danger)' }}
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}
            <button className="sv-btn sv-btn--sm sv-btn--outline-brass" onClick={() => onOpen(s.session_id)}>
              Review <ChevronRight size={13} />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

/**
 * One conversation turn, rendered as a two-speaker exchange (AI
 * question, then the worker's answer directly under it) instead of a
 * plain paragraph block - the goal is that an admin can tell what's
 * being asked vs. answered in half a second, not by reading carefully.
 */
function TurnCard({ turn, index, total, busy, onApprove, onReject }) {
  return (
    <div className="sv-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--sv-font-mono)', fontWeight: 600, color: 'var(--sv-muted)' }}>
          TURN {index + 1} / {total}
        </span>
        <span style={{ fontSize: 11, fontFamily: 'var(--sv-font-mono)', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--sv-bg)', color: 'var(--sv-muted)' }}>
          {turn.topic_title}{turn.is_followup ? ' · follow-up' : ''}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--sv-brass-soft)', color: 'var(--sv-brass)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>AI</span>
        <p style={{ fontSize: 13.5, color: 'var(--sv-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>{turn.question_text}</p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: turn.answer_audio_url ? 10 : 12 }}>
        <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--sv-teal-soft)', color: 'var(--sv-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <User size={13} />
        </span>
        <p style={{ fontSize: 14.5, color: 'var(--sv-ink)', margin: '4px 0 0', lineHeight: 1.5 }}>{turn.answer_text}</p>
      </div>

      {turn.answer_audio_url && (
        <audio controls src={mediaUrl(turn.answer_audio_url)} style={{ width: '100%', height: 32, marginBottom: 12, marginLeft: 36 }} />
      )}

      {!turn.knowledge_status && (
        <p style={{ fontSize: 11.5, color: 'var(--sv-muted-light)', margin: '4px 0 0', paddingTop: 10, borderTop: '1px solid var(--sv-border-light)', fontStyle: 'italic' }}>
          No insight was distilled from this answer — nothing to review here.
        </p>
      )}
      {turn.knowledge_status && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--sv-border-light)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--sv-muted)' }}>
            <Sparkles size={12} color="var(--sv-brass)" /> Distilled insight
          </span>
          {turn.knowledge_status === 'pending' ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="sv-btn sv-btn--danger-text" disabled={busy} onClick={onReject}>
                Delete
              </button>
              <button className="sv-btn sv-btn--teal" disabled={busy} onClick={onApprove}>
                Approve
              </button>
            </div>
          ) : (
            <Stamp status={turn.knowledge_status} />
          )}
        </div>
      )}
    </div>
  );
}

function TranscriptView({ sessionId, onBack, onSessionReviewed }) {
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmRejectAll, setConfirmRejectAll] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    Api.adminInterviewTranscript(sessionId)
      .then(setData)
      .catch((err) => push(err.message, 'error'));
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function approve(turnId, entryId) {
    setBusyId(turnId);
    try {
      await Api.approveEntry(entryId);
      push('Insight approved.', 'success');
      setData((d) => ({
        ...d,
        turns: d.turns.map((t) => t.turn_id === turnId ? { ...t, knowledge_status: 'approved' } : t),
      }));
      onSessionReviewed?.(sessionId);
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(turnId, entryId) {
    setBusyId(turnId);
    try {
      await Api.deleteEntry(entryId);
      push('Insight deleted.', 'success');
      setData((d) => ({
        ...d,
        turns: d.turns.map((t) => t.turn_id === turnId ? { ...t, knowledge_status: 'rejected' } : t),
      }));
      onSessionReviewed?.(sessionId);
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  const pendingTurns = (data?.turns || []).filter((t) => t.knowledge_status === 'pending');

  /* Session-level bulk actions - the actual answer to "there's no way
     to approve or delete the interview, only single insights". One
     server call each, via the same session-scoped endpoints the table
     row's quick actions use, so behavior is identical whether the
     admin acts from the list or from inside the transcript. */
  async function approveAll() {
    setBulkBusy(true);
    try {
      const res = await Api.approveSessionPending(sessionId);
      setData((d) => ({
        ...d,
        turns: d.turns.map((t) => t.knowledge_status === 'pending' ? { ...t, knowledge_status: 'approved' } : t),
      }));
      push(`Approved ${res.approved} pending insight${res.approved === 1 ? '' : 's'}.`, 'success');
      onSessionReviewed?.(sessionId);
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBulkBusy(false);
    }
  }

  async function rejectAll() {
    setConfirmRejectAll(false);
    setBulkBusy(true);
    try {
      const res = await Api.rejectSessionPending(sessionId);
      setData((d) => ({
        ...d,
        turns: d.turns.map((t) => t.knowledge_status === 'pending' ? { ...t, knowledge_status: 'rejected' } : t),
      }));
      push(`Deleted ${res.rejected} pending insight${res.rejected === 1 ? '' : 's'}.`, 'success');
      onSessionReviewed?.(sessionId);
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBulkBusy(false);
    }
  }

  if (!data) return <p style={{ fontSize: 13, color: 'var(--sv-muted)' }}>Loading transcript…</p>;

  const approvedCount = data.turns.filter((t) => t.knowledge_status === 'approved').length;
  const rejectedCount = data.turns.filter((t) => t.knowledge_status === 'rejected').length;

  return (
    <div>
      <button
        onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--sv-muted)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 14, padding: 0 }}
      >
        <ChevronLeft size={15} /> Back to interviews
      </button>

      <div
        className="sv-card"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}
      >
        <div>
          <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 18, margin: '0 0 4px' }}>
            {data.worker_name} · {data.machine_id}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <StatusChip status={data.status} />
            <span style={{ fontSize: 12, color: 'var(--sv-muted)' }}>
              {data.turns.length} turn{data.turns.length === 1 ? '' : 's'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--sv-muted)' }}>
              {pendingTurns.length} pending · {approvedCount} approved · {rejectedCount} deleted
            </span>
          </div>
        </div>

        {pendingTurns.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {confirmRejectAll ? (
              <>
                <span style={{ fontSize: 12, color: 'var(--sv-danger)' }}>Delete all {pendingTurns.length} pending insights?</span>
                <button className="sv-btn sv-btn--outline" disabled={bulkBusy} onClick={() => setConfirmRejectAll(false)}>Cancel</button>
                <button className="sv-btn sv-btn--danger" disabled={bulkBusy} onClick={rejectAll}>Confirm delete</button>
              </>
            ) : (
              <>
                <button className="sv-btn sv-btn--outline" style={{ color: 'var(--sv-danger)' }} disabled={bulkBusy} onClick={() => setConfirmRejectAll(true)}>
                  <Trash2 size={13} /> Delete all pending ({pendingTurns.length})
                </button>
                <button className="sv-btn sv-btn--teal" disabled={bulkBusy} onClick={approveAll}>
                  <Check size={13} /> Approve all pending ({pendingTurns.length})
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.turns.map((t, i) => (
          <TurnCard
            key={t.turn_id}
            turn={t}
            index={i}
            total={data.turns.length}
            busy={busyId === t.turn_id || bulkBusy}
            onApprove={() => approve(t.turn_id, t.knowledge_entry_id)}
            onReject={() => remove(t.turn_id, t.knowledge_entry_id)}
          />
        ))}
      </div>
    </div>
  );
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'paused', label: 'Paused' },
  { key: 'completed', label: 'Completed' },
];

export default function InterviewsTab({ machine }) {
  const [sessions, setSessions] = useState(null);
  const [openSessionId, setOpenSessionId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [rowBusyId, setRowBusyId] = useState(null);
  const [confirmingRejectId, setConfirmingRejectId] = useState(null);
  const { push } = useToast();

  function load() {
    setSessions(null);
    setOpenSessionId(null);
    Api.adminInterviewSessions(machine || null)
      .then((res) => setSessions(res.sessions || []))
      .catch((err) => push(err.message, 'error'));
  }

  useEffect(load, [machine]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-syncs one session's insight counts after a review action taken
  // inside its transcript, so navigating back to the list shows the
  // up-to-date "pending" badge instead of a stale one from page load.
  function refreshSessionCounts(sessionId) {
    Api.adminInterviewSessions(machine || null)
      .then((res) => setSessions(res.sessions || []))
      .catch(() => {});
  }

  async function approveAllForRow(sessionId) {
    setRowBusyId(sessionId);
    try {
      const res = await Api.approveSessionPending(sessionId);
      push(`Approved ${res.approved} pending insight${res.approved === 1 ? '' : 's'}.`, 'success');
      setSessions((list) => list.map((s) => s.session_id === sessionId
        ? { ...s, pending_insights: 0, approved_insights: (s.approved_insights || 0) + res.approved }
        : s));
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setRowBusyId(null);
    }
  }

  async function rejectAllForRow(sessionId) {
    setRowBusyId(sessionId);
    setConfirmingRejectId(null);
    try {
      const res = await Api.rejectSessionPending(sessionId);
      push(`Deleted ${res.rejected} pending insight${res.rejected === 1 ? '' : 's'}.`, 'success');
      setSessions((list) => list.map((s) => s.session_id === sessionId
        ? { ...s, pending_insights: 0, rejected_insights: (s.rejected_insights || 0) + res.rejected }
        : s));
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setRowBusyId(null);
    }
  }

  const counts = useMemo(() => {
    const c = { all: sessions?.length || 0, in_progress: 0, paused: 0, completed: 0 };
    (sessions || []).forEach((s) => { if (c[s.status] !== undefined) c[s.status]++; });
    return c;
  }, [sessions]);

  const filtered = useMemo(() => {
    return (sessions || []).filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (query.trim() && !s.worker_name?.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [sessions, statusFilter, query]);

  const totalPending = useMemo(() => (sessions || []).reduce((sum, s) => sum + (s.pending_insights || 0), 0), [sessions]);

  if (openSessionId) {
    return <TranscriptView sessionId={openSessionId} onBack={() => setOpenSessionId(null)} onSessionReviewed={refreshSessionCounts} />;
  }

  return (
    <div>
      {totalPending > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--sv-warning)',
            background: 'var(--sv-warning-soft)', border: '1px solid var(--sv-warning)', borderRadius: 'var(--sv-radius-sm)',
            padding: '10px 14px', marginBottom: 14,
          }}
        >
          <AlertCircle size={15} />
          <strong>{totalPending}</strong>&nbsp;insight{totalPending === 1 ? '' : 's'} across these interviews {totalPending === 1 ? 'is' : 'are'} waiting on your review.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            style={{
              padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              border: statusFilter === f.key ? 'none' : '1px solid var(--sv-border)',
              background: statusFilter === f.key ? 'var(--sv-brass)' : 'transparent',
              color: statusFilter === f.key ? '#fff' : 'var(--sv-muted)',
            }}
          >
            {f.label} ({counts[f.key] ?? 0})
          </button>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', border: '1px solid var(--sv-border)', borderRadius: 999, padding: '6px 12px', minWidth: 180 }}>
          <Search size={13} color="var(--sv-muted)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by worker…"
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, flex: 1, color: 'var(--sv-ink)' }}
          />
        </div>
      </div>

      {sessions === null && <p style={{ fontSize: 13, color: 'var(--sv-muted)' }}>Loading interviews…</p>}
      {sessions?.length === 0 && (
        <div className="sv-card" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--sv-muted)' }}>
          <PlayCircle size={22} color="var(--sv-muted-light)" style={{ marginBottom: 8 }} />
          <p style={{ margin: 0 }}>No tacit knowledge interviews for {machine || 'this machine'} yet.</p>
        </div>
      )}
      {sessions?.length > 0 && filtered.length === 0 && (
        <div className="sv-card" style={{ textAlign: 'center', padding: '32px 24px', color: 'var(--sv-muted)' }}>
          <p style={{ margin: 0 }}>No interviews match this filter.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div
          style={{
            border: '1px solid var(--sv-border)', borderRadius: 'var(--sv-radius-md)',
            overflow: 'hidden', boxShadow: 'var(--sv-shadow-xs)',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table className="sv-interviews-table">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Machine</th>
                  <th>Progress</th>
                  <th>Insights</th>
                  <th>Status</th>
                  <th>Last activity</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <SessionRow
                    key={s.session_id}
                    s={s}
                    onOpen={setOpenSessionId}
                    busy={rowBusyId === s.session_id}
                    confirmingReject={confirmingRejectId === s.session_id}
                    onApproveAll={() => approveAllForRow(s.session_id)}
                    onAskReject={() => setConfirmingRejectId(s.session_id)}
                    onCancelReject={() => setConfirmingRejectId(null)}
                    onRejectAll={() => rejectAllForRow(s.session_id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}