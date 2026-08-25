import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Trash2, Pencil, Video, BookOpenText, Mic2, ChevronDown, X,
  User, MessageSquare, AlertCircle, RefreshCw, Factory, Clock, Layers, Sparkles,
  Ban, RotateCcw,
} from 'lucide-react';
import { api, mediaUrl, ApiError } from '../../lib/api';
import { PageHeader, Select, Card, Button, EmptyState, Badge, Textarea, FullPageLoader } from '../../components/ui';
import { useToast } from '../../components/Toast';

function formatWhen(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return null;
  }
}

function statusLabel(status) {
  if (!status) return 'unknown';
  return String(status).replace(/_/g, ' ');
}

export default function KnowledgeReview() {
  const [tab, setTab] = useState('tips');
  const [machines, setMachines] = useState([]);
  const [machineId, setMachineId] = useState('');

  useEffect(() => {
    api.allMachines()
      .then((r) => {
        setMachines(r.machine_ids || []);
        if (r.machine_ids?.length) setMachineId(r.machine_ids[0]);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow="Quality control"
        title="Knowledge review"
        description="Every tip and interview insight is queued here before it goes live on the floor."
        actions={
          machines.length > 0 && (
            <Select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="min-w-[180px]">
              {machines.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          )
        }
      />

      <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-surface-2 border-2 border-line mb-8 w-fit">
        <button
          type="button"
          onClick={() => setTab('tips')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            tab === 'tips' ? 'bg-amber text-[#221400] shadow-sm' : 'text-muted hover:text-text'
          }`}
        >
          <BookOpenText size={16} /> Tips queue
        </button>
        <button
          type="button"
          onClick={() => setTab('interviews')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            tab === 'interviews' ? 'bg-amber text-[#221400] shadow-sm' : 'text-muted hover:text-text'
          }`}
        >
          <Mic2 size={16} /> Interview sessions
        </button>
      </div>

      {!machineId ? (
        <EmptyState
          icon={Factory}
          title="No machines yet"
          description="Upload a manual first — knowledge review is scoped per machine."
        />
      ) : tab === 'tips' ? (
        <TipsTab machineId={machineId} />
      ) : (
        <InterviewsTab machineId={machineId} />
      )}
    </div>
  );
}

function TipsTab({ machineId }) {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });

  const load = useCallback(async () => {
    if (!machineId) return;
    setLoading(true);
    try {
      const [cur, pend, appr, rej] = await Promise.all([
        api.knowledgeEntries(machineId, statusFilter),
        api.knowledgeEntries(machineId, 'pending'),
        api.knowledgeEntries(machineId, 'approved'),
        api.knowledgeEntries(machineId, 'rejected'),
      ]);
      setEntries(cur.entries || cur.pending_entries || []);
      setCounts({
        pending: pend.count ?? (pend.entries || []).length,
        approved: appr.count ?? (appr.entries || []).length,
        rejected: rej.count ?? (rej.entries || []).length,
      });
    } catch (err) {
      setEntries([]);
      toast.error(err instanceof ApiError ? err.message : 'Could not load tips.');
    } finally {
      setLoading(false);
    }
  }, [machineId, statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id) => {
    setBusyId(id);
    try {
      await api.approveEntry(id);
      toast.success('Tip approved — now live for Ask.');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not approve.');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id) => {
    setBusyId(id);
    try {
      await api.rejectEntry(id);
      toast.info('Tip rejected — kept in history, hidden from Ask.');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not reject.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Permanently delete this tip? This cannot be undone.')) return;
    setBusyId(id);
    try {
      await api.deleteEntry(id);
      toast.info('Tip permanently deleted.');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete.');
    } finally {
      setBusyId(null);
    }
  };

  const saveEdit = async (id) => {
    setBusyId(id);
    try {
      await api.editEntry(id, editText);
      setEditId(null);
      toast.success('Tip text updated.');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save edit.');
    } finally {
      setBusyId(null);
    }
  };

  const filters = [
    { id: 'pending', label: 'Pending', count: counts.pending, tone: 'amber' },
    { id: 'approved', label: 'Approved', count: counts.approved, tone: 'signal' },
    { id: 'rejected', label: 'Rejected', count: counts.rejected, tone: 'default' },
  ];

  if (loading && entries.length === 0) {
    return <FullPageLoader label="Loading tips…" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setStatusFilter(f.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold border-2 transition-colors ${
              statusFilter === f.id
                ? f.id === 'pending'
                  ? 'bg-amber/15 border-amber text-amber'
                  : f.id === 'approved'
                    ? 'bg-signal/15 border-signal text-signal'
                    : 'bg-surface-2 border-text/30 text-text'
                : 'border-line text-muted hover:text-text hover:border-line'
            }`}
          >
            {f.label}
            <span
              className={`min-w-[1.4rem] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                statusFilter === f.id ? 'bg-white/80 text-text' : 'bg-surface-2 text-muted'
              }`}
            >
              {f.count}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={load}
          className="ml-auto text-sm font-semibold text-muted hover:text-signal px-3 py-2"
        >
          Refresh
        </button>
      </div>

      <p className="text-[15px] text-muted">
        {statusFilter === 'pending' && 'Tips waiting for review. Approve to make them searchable in Ask; reject to keep history without going live.'}
        {statusFilter === 'approved' && 'Live tips used when workers ask about this machine. You can reject or delete if something should come down.'}
        {statusFilter === 'rejected' && 'Rejected tips stay here for audit. Re-approve to put them back into Ask, or delete permanently.'}
      </p>

      {entries.length === 0 ? (
        <EmptyState
          icon={BookOpenText}
          title={
            statusFilter === 'pending'
              ? 'No pending tips'
              : statusFilter === 'approved'
                ? 'No approved tips yet'
                : 'No rejected tips'
          }
          description={
            statusFilter === 'pending'
              ? 'Worker submissions for this machine will land here for review.'
              : statusFilter === 'approved'
                ? 'Approved tips for this machine will show here once you clear the queue.'
                : 'Rejected tips are kept for history when you reject instead of hard-delete.'
          }
        />
      ) : (
        <div className="space-y-3">
          {entries.map((e) => {
            const st = e.status || statusFilter;
            return (
              <Card key={e.id} className="p-5 relative overflow-hidden">
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    st === 'approved' ? 'bg-signal' : st === 'rejected' ? 'bg-muted' : 'bg-amber'
                  }`}
                />
                <div className="pl-2">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-full bg-amber/15 border border-amber/30 flex items-center justify-center text-amber text-sm font-bold shrink-0">
                      {(e.worker_name || e.worker_id || '?').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-text text-[15px]">
                        {e.worker_name || 'Worker'}{' '}
                        <span className="font-mono text-muted text-xs font-normal">· {e.worker_id}</span>
                      </p>
                    </div>
                    <Badge
                      tone={st === 'approved' ? 'signal' : st === 'rejected' ? 'default' : 'amber'}
                      className="ml-auto"
                    >
                      {st}
                    </Badge>
                  </div>

                  {editId === e.id ? (
                    <div className="space-y-2 mb-3">
                      <textarea
                        value={editText}
                        onChange={(ev) => setEditText(ev.target.value)}
                        rows={5}
                        className="w-full rounded-xl border-2 border-line bg-surface-2 px-3 py-2 text-[15px] text-text"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(e.id)} loading={busyId === e.id}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[15px] text-text leading-relaxed whitespace-pre-wrap mb-3">
                      {e.text}
                    </p>
                  )}

                  {(e.video_url || e.image_url) && (
                    <div className="mb-3 space-y-2">
                      {e.video_url && (
                        <video
                          src={mediaUrl(e.video_url)}
                          controls
                          className="w-full max-h-52 rounded-xl bg-black"
                          preload="metadata"
                        />
                      )}
                      {e.image_url && (
                        <button type="button" onClick={() => setLightbox(mediaUrl(e.image_url))} className="block">
                          <img
                            src={mediaUrl(e.image_url)}
                            alt="Tip"
                            className="max-h-40 rounded-xl border border-line object-contain cursor-zoom-in"
                          />
                        </button>
                      )}
                      {(e.video_description || e.image_description) && (
                        <div className="rounded-xl bg-surface-2 border border-line px-3 py-2 text-[13px] text-muted leading-relaxed">
                          {e.video_description && (
                            <p>
                              <span className="font-semibold text-amber uppercase text-[10px] tracking-wide">
                                Video understanding
                              </span>
                              <br />
                              {e.video_description}
                            </p>
                          )}
                          {e.image_description && (
                            <p className={e.video_description ? 'mt-2' : ''}>
                              <span className="font-semibold text-signal uppercase text-[10px] tracking-wide">
                                Image understanding
                              </span>
                              <br />
                              {e.image_description}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {(st === 'pending' || st === 'rejected') && (
                      <Button size="sm" icon={Check} onClick={() => approve(e.id)} loading={busyId === e.id}>
                        {st === 'rejected' ? 'Re-approve' : 'Approve'}
                      </Button>
                    )}
                    {st === 'pending' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Pencil}
                        onClick={() => {
                          setEditId(e.id);
                          setEditText(e.text || '');
                        }}
                      >
                        Edit
                      </Button>
                    )}
                    {(st === 'pending' || st === 'approved') && (
                      <Button size="sm" variant="ghost" icon={Ban} onClick={() => reject(e.id)} loading={busyId === e.id}>
                        Reject
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(e.id)} loading={busyId === e.id}>
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80"
          onClick={() => setLightbox(null)}
          role="presentation"
        >
          <button
            type="button"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center"
            onClick={() => setLightbox(null)}
          >
            ×
          </button>
          <img
            src={lightbox}
            alt="Full"
            className="max-w-full max-h-[90vh] rounded-xl object-contain"
            onClick={(ev) => ev.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function InterviewsTab({ machineId }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [loadingTx, setLoadingTx] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.adminInterviewSessions(machineId)
      .then((r) => setSessions(r.sessions || []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [machineId]);

  useEffect(() => { load(); setOpenId(null); setTranscript(null); }, [load]);

  const visible = useMemo(() => {
    if (filter === 'needs_review') return sessions.filter((s) => (s.pending_insights || 0) > 0);
    if (filter === 'empty') return sessions.filter((s) => (s.insights_captured || 0) === 0);
    if (filter === 'completed') return sessions.filter((s) => s.status === 'completed');
    return sessions;
  }, [sessions, filter]);

  const toggle = async (sessionId) => {
    if (openId === sessionId) { setOpenId(null); setTranscript(null); return; }
    setOpenId(sessionId);
    setLoadingTx(true);
    setTranscript(null);
    try {
      const r = await api.adminInterviewTranscript(sessionId);
      setTranscript(r);
    } catch {
      setTranscript({ turns: [] });
    } finally {
      setLoadingTx(false);
    }
  };

  const approveAll = async (sessionId) => {
    setBusyId(sessionId);
    try {
      const r = await api.approveSessionPending(sessionId);
      toast.success(`Approved ${r.approved ?? r.approved_count ?? 'all'} insight(s).`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not approve.');
    } finally { setBusyId(null); }
  };

  const rejectAll = async (sessionId) => {
    setBusyId(sessionId);
    try {
      await api.rejectSessionPending(sessionId);
      toast.info('Pending insights rejected.');
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not reject.');
    } finally { setBusyId(null); }
  };

  const deleteSession = async (sessionId) => {
    setBusyId(sessionId);
    try {
      await api.deleteInterviewSession(sessionId);
      setSessions((s) => s.filter((x) => x.session_id !== sessionId));
      if (openId === sessionId) { setOpenId(null); setTranscript(null); }
      toast.info('Interview session deleted.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete session.');
    } finally {
      setBusyId(null);
      setConfirmDelete(null);
    }
  };

  if (loading) return <FullPageLoader label="Loading interview sessions…" />;

  const needsReview = sessions.filter((s) => (s.pending_insights || 0) > 0).length;
  const emptyCount = sessions.filter((s) => (s.insights_captured || 0) === 0).length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <p className="text-[15px] text-muted leading-relaxed">
          {sessions.length === 0
            ? 'No interview sessions for this machine yet.'
            : (
              <>
                <span className="text-text font-semibold">{sessions.length}</span> session{sessions.length !== 1 ? 's' : ''}
                {needsReview > 0 && <> · <span className="text-amber font-semibold">{needsReview}</span> need review</>}
                {emptyCount > 0 && <> · <span className="text-muted font-semibold">{emptyCount}</span> empty</>}
              </>
            )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'needs_review', label: 'Needs review' },
            { id: 'empty', label: 'Empty (0 insights)' },
            { id: 'completed', label: 'Completed' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                filter === f.id
                  ? 'border-amber bg-amber text-[#221400]'
                  : 'border-line bg-surface text-muted hover:text-text'
              }`}
            >
              {f.label}
            </button>
          ))}
          <button type="button" onClick={load} className="w-9 h-9 rounded-full border-2 border-line flex items-center justify-center text-muted hover:text-text" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Mic2}
          title={sessions.length === 0 ? 'No interviews yet' : 'Nothing in this filter'}
          description={
            sessions.length === 0
              ? 'Tacit Knowledge Capture sessions for this machine will appear here for review.'
              : 'Try another filter to find sessions.'
          }
        />
      ) : (
        <div className="space-y-4">
          {visible.map((s, i) => {
            const isOpen = openId === s.session_id;
            const when = formatWhen(s.started_at);
            const doneWhen = formatWhen(s.completed_at);
            const empty = (s.insights_captured || 0) === 0;
            const needs = (s.pending_insights || 0) > 0;
            return (
              <motion.div key={s.session_id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className={`overflow-hidden relative ${empty ? 'opacity-90' : ''}`}>
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${needs ? 'bg-amber' : empty ? 'bg-line' : 'bg-signal'}`} />
                  <div className="pl-5 pr-5 pt-5 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border-2 ${
                          needs ? 'bg-amber/15 border-amber/30 text-amber' : empty ? 'bg-surface-2 border-line text-muted' : 'bg-signal/15 border-signal/30 text-signal'
                        }`}>
                          <Mic2 size={22} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="font-display font-bold text-lg truncate">{s.worker_name || s.worker_id}</p>
                            <Badge tone={s.status === 'completed' ? 'signal' : s.status === 'paused' ? 'amber' : 'default'}>{statusLabel(s.status)}</Badge>
                            {needs && <Badge tone="amber">{s.pending_insights} to review</Badge>}
                            {empty && <Badge tone="default">0 insights</Badge>}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                            <span className="inline-flex items-center gap-1"><Layers size={12} /> Topic {Math.min((s.topic_index || 0) + 1, s.total_topics || 0)}/{s.total_topics || 0}</span>
                            <span className="inline-flex items-center gap-1"><Sparkles size={12} /> {s.insights_captured || 0} insight{(s.insights_captured || 0) !== 1 ? 's' : ''}</span>
                            {when && <span className="inline-flex items-center gap-1"><Clock size={12} /> {when}</span>}
                            {doneWhen && s.status === 'completed' && <span>Finished {doneWhen}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={() => toggle(s.session_id)}
                          className="w-10 h-10 rounded-xl border-2 border-line flex items-center justify-center text-muted hover:text-text hover:border-signal/40 transition-all"
                          title={isOpen ? 'Collapse' : 'Open transcript'}>
                          <ChevronDown size={18} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(s)}
                          className="w-10 h-10 rounded-xl border-2 border-line flex items-center justify-center text-muted hover:text-danger hover:border-danger/40 transition-all"
                          title="Delete session">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {needs && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Button size="sm" icon={Check} onClick={() => approveAll(s.session_id)} loading={busyId === s.session_id}>
                          Approve all pending insights
                        </Button>
                        <Button size="sm" variant="danger" icon={X} onClick={() => rejectAll(s.session_id)} loading={busyId === s.session_id}>
                          Reject all pending
                        </Button>
                      </div>
                    )}

                    {empty && !needs && (
                      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 px-3.5 py-3">
                        <AlertCircle size={16} className="text-muted shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-text font-medium">No insights captured</p>
                          <p className="text-xs text-muted mt-0.5">This session produced nothing useful for the knowledge base. Safe to delete.</p>
                        </div>
                        <Button size="sm" variant="danger" icon={Trash2} className="shrink-0" onClick={() => setConfirmDelete(s)}>Delete</Button>
                      </div>
                    )}
                  </div>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="border-t border-line bg-surface-2/50 px-5 py-5">
                          {loadingTx ? (
                            <div className="flex items-center gap-2 text-sm text-muted py-8 justify-center">
                              <RefreshCw size={16} className="animate-spin" /> Loading transcript…
                            </div>
                          ) : !transcript?.turns?.length ? (
                            <div className="text-center py-10">
                              <MessageSquare size={24} className="mx-auto text-muted mb-2" />
                              <p className="text-sm text-muted">No turns recorded in this session.</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <p className="text-xs font-mono uppercase tracking-wider text-muted mb-1">
                                Transcript · {transcript.turns.length} turn{transcript.turns.length !== 1 ? 's' : ''}
                              </p>
                              {transcript.turns.map((t, ti) => (
                                <div key={t.turn_id || ti} className="rounded-2xl border-2 border-line bg-surface p-4 relative overflow-hidden">
                                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber/80" />
                                  <div className="pl-3">
                                    <div className="flex flex-wrap items-center gap-2 mb-3">
                                      <span className="text-[10px] font-mono uppercase tracking-wider text-amber">
                                        {t.topic_title || 'Topic'}{t.is_followup ? ' · follow-up' : ''}
                                      </span>
                                      {t.knowledge_status && (
                                        <Badge tone={t.knowledge_status === 'approved' ? 'signal' : t.knowledge_status === 'pending' ? 'amber' : 'default'}>
                                          {t.knowledge_status}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="space-y-3">
                                      <div>
                                        <p className="text-[10px] font-mono uppercase tracking-wide text-muted mb-1">Question</p>
                                        <p className="text-[15px] text-text/85 leading-relaxed">{t.question_text}</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-mono uppercase tracking-wide text-muted mb-1">Answer</p>
                                        <p className="text-[15px] text-text leading-relaxed whitespace-pre-wrap">
                                          {t.answer_text || <span className="text-muted italic">No answer recorded</span>}
                                        </p>
                                      </div>
                                      {t.answer_audio_url && (
                                        <audio controls src={mediaUrl(t.answer_audio_url)} className="w-full h-9 mt-1" />
                                      )}
                                      {t.knowledge_entry_id && t.knowledge_status === 'pending' && (
                                        <div className="flex flex-wrap gap-2 pt-2">
                                          <Button size="sm" icon={Check} onClick={async () => {
                                            try {
                                              await api.approveEntry(t.knowledge_entry_id);
                                              toast.success('Insight approved.');
                                              // reload transcript + sessions
                                              const r = await api.adminInterviewTranscript(s.session_id);
                                              setTranscript(r);
                                              load();
                                            } catch (err) {
                                              toast.error(err instanceof ApiError ? err.message : 'Could not approve insight.');
                                            }
                                          }}>Approve insight</Button>
                                          <Button size="sm" variant="danger" icon={Trash2} onClick={async () => {
                                            try {
                                              await api.deleteEntry(t.knowledge_entry_id);
                                              toast.info('Insight deleted.');
                                              const r = await api.adminInterviewTranscript(s.session_id);
                                              setTranscript(r);
                                              load();
                                            } catch (err) {
                                              toast.error(err instanceof ApiError ? err.message : 'Could not delete insight.');
                                            }
                                          }}>Delete insight</Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
            onClick={() => !busyId && setConfirmDelete(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border-2 border-line bg-surface p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-danger/15 border border-danger/30 flex items-center justify-center text-danger shrink-0">
                  <Trash2 size={18} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg">Delete interview session?</h3>
                  <p className="text-sm text-muted mt-1 leading-relaxed">
                    Session with <span className="font-semibold text-text">{confirmDelete.worker_name}</span>
                    {' '}({confirmDelete.insights_captured || 0} insights) will be permanently removed,
                    including turns and any linked knowledge entries.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" disabled={!!busyId} onClick={() => setConfirmDelete(null)}>Cancel</Button>
                <Button size="sm" variant="danger" icon={Trash2}
                  loading={busyId === confirmDelete.session_id}
                  onClick={() => deleteSession(confirmDelete.session_id)}>
                  Delete session
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}