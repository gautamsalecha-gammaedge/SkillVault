import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Trash2, Pencil, Video, BookOpenText, Mic2, ChevronDown, X } from 'lucide-react';
import { api, mediaUrl, ApiError } from '../../lib/api';
import { PageHeader, Select, Card, Button, EmptyState, Badge, Textarea, FullPageLoader } from '../../components/ui';
import { useToast } from '../../components/Toast';

export default function KnowledgeReview() {
  const toast = useToast();
  const [tab, setTab] = useState('tips');
  const [machines, setMachines] = useState([]);
  const [machineId, setMachineId] = useState('');

  useEffect(() => { api.allMachines().then((r) => { setMachines(r.machine_ids || []); if (r.machine_ids?.length) setMachineId(r.machine_ids[0]); }); }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Quality control"
        title="Knowledge review"
        description="Every tip and interview insight is queued here before it goes live."
        actions={machines.length > 0 && (
          <Select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="min-w-[180px]">
            {machines.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        )}
      />

      <div className="flex p-1 rounded-full bg-surface-2 border border-line mb-7 w-fit">
        <button onClick={() => setTab('tips')} className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all ${tab === 'tips' ? 'bg-amber text-[#221400]' : 'text-muted'}`}>
          <BookOpenText size={15} /> Tips
        </button>
        <button onClick={() => setTab('interviews')} className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all ${tab === 'interviews' ? 'bg-amber text-[#221400]' : 'text-muted'}`}>
          <Mic2 size={15} /> Interviews
        </button>
      </div>

      {!machineId ? <p className="text-muted text-sm">No machines with manuals yet.</p> : tab === 'tips' ? <TipsTab machineId={machineId} /> : <InterviewsTab machineId={machineId} />}
    </div>
  );
}

function TipsTab({ machineId }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const load = () => { setLoading(true); api.pendingEntries(machineId).then((r) => setEntries(r.pending_entries || [])).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [machineId]);

  const approve = async (id) => {
    try { await api.approveEntry(id); setEntries((e) => e.filter((x) => x.id !== id)); toast.success('Approved.'); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : 'Could not approve.'); }
  };
  const remove = async (id) => {
    try { await api.deleteEntry(id); setEntries((e) => e.filter((x) => x.id !== id)); toast.info('Deleted.'); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : 'Could not delete.'); }
  };
  const saveEdit = async (id) => {
    try { const res = await api.editEntry(id, editText); setEntries((e) => e.map((x) => x.id === id ? { ...x, text: res.text } : x)); setEditingId(null); toast.success('Updated.'); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : 'Could not save edit.'); }
  };

  if (loading) return <FullPageLoader label="Loading pending tips…" />;
  if (entries.length === 0) return <EmptyState icon={BookOpenText} title="Queue is clear" description="No pending tips for this machine right now." />;

  return (
    <div className="space-y-4">
      {entries.map((e) => (
        <Card key={e.id} className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs text-muted">{e.worker_name} · {e.worker_id}</span>
            <Badge tone="amber">Pending</Badge>
          </div>
          {editingId === e.id ? (
            <div className="space-y-3">
              <Textarea rows={4} value={editText} onChange={(ev) => setEditText(ev.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveEdit(e.id)}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text/90 leading-relaxed mb-3 whitespace-pre-wrap">{e.text}</p>
          )}
          {e.video_url && (
            <div className="mb-3">
              <video controls src={mediaUrl(e.video_url)} className="w-full max-w-md rounded-xl border border-line" />
              {e.video_description && <p className="text-xs text-muted mt-2"><Video size={11} className="inline mr-1" />{e.video_description}</p>}
            </div>
          )}
          {editingId !== e.id && (
            <div className="flex items-center gap-2">
              <Button size="sm" icon={Check} onClick={() => approve(e.id)}>Approve</Button>
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => { setEditingId(e.id); setEditText(e.text); }}>Edit</Button>
              <Button size="sm" variant="danger" icon={Trash2} onClick={() => remove(e.id)}>Delete</Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function InterviewsTab({ machineId }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [transcript, setTranscript] = useState(null);

  const load = () => { setLoading(true); api.adminInterviewSessions(machineId).then((r) => setSessions(r.sessions || [])).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [machineId]);

  const toggle = async (id) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    const t = await api.adminInterviewTranscript(id);
    setTranscript(t);
  };

  const approveAll = async (id) => {
    try { const r = await api.approveSessionPending(id); toast.success(`Approved ${r.approved} insight(s).`); load(); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : 'Could not approve.'); }
  };
  const rejectAll = async (id) => {
    try { const r = await api.rejectSessionPending(id); toast.info(`Rejected ${r.rejected} insight(s).`); load(); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : 'Could not reject.'); }
  };

  if (loading) return <FullPageLoader label="Loading interview sessions…" />;
  if (sessions.length === 0) return <EmptyState icon={Mic2} title="No interviews yet" description="Tacit Knowledge Capture sessions for this machine will appear here." />;

  return (
    <div className="space-y-4">
      {sessions.map((s) => (
        <Card key={s.session_id} className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div>
              <p className="font-display font-bold">{s.worker_name}</p>
              <p className="font-mono text-xs text-muted">{s.status} · topic {s.topic_index + 1}/{s.total_topics} · {s.insights_captured} insight{s.insights_captured !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              {s.pending_insights > 0 && <Badge tone="amber">{s.pending_insights} pending</Badge>}
              {s.approved_insights > 0 && <Badge tone="signal">{s.approved_insights} approved</Badge>}
              <button onClick={() => toggle(s.session_id)} className="text-muted hover:text-text">
                <ChevronDown size={18} className={`transition-transform ${openId === s.session_id ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
          {s.pending_insights > 0 && (
            <div className="flex gap-2 mb-3">
              <Button size="sm" icon={Check} onClick={() => approveAll(s.session_id)}>Approve all pending</Button>
              <Button size="sm" variant="danger" icon={X} onClick={() => rejectAll(s.session_id)}>Reject all pending</Button>
            </div>
          )}
          <AnimatePresence>
            {openId === s.session_id && transcript && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="border-t border-line pt-3 mt-2 space-y-3">
                  {transcript.turns.map((t) => (
                    <div key={t.turn_id} className="sv-card bg-surface-3 p-3.5">
                      <p className="text-[10px] font-mono uppercase text-amber mb-1">{t.topic_title}{t.is_followup ? ' · follow-up' : ''}</p>
                      <p className="text-sm text-text/80 mb-1.5">Q: {t.question_text}</p>
                      <p className="text-sm text-text mb-1.5">A: {t.answer_text}</p>
                      {t.answer_audio_url && <audio controls src={mediaUrl(t.answer_audio_url)} className="w-full h-8 mt-1" />}
                      {t.knowledge_status && <Badge tone={t.knowledge_status === 'approved' ? 'signal' : 'amber'} className="mt-2">{t.knowledge_status}</Badge>}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      ))}
    </div>
  );
}
