import { useEffect, useState } from 'react';
import { ChevronLeft, PlayCircle, Sparkles } from 'lucide-react';
import Stamp from '../../components/Stamp';
import { Api, mediaUrl } from '../../lib/api';
import { useToast } from '../../lib/toast';

function SessionRow({ s, onOpen }) {
  const statusLabel = s.status === 'completed' ? 'Completed' : s.status === 'paused' ? 'Paused' : 'In progress';
  const statusColor = s.status === 'completed' ? 'var(--sv-teal)' : s.status === 'paused' ? 'var(--sv-muted)' : 'var(--sv-brass)';
  return (
    <button
      onClick={() => onOpen(s.session_id)}
      className="sv-card"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
        textAlign: 'left', cursor: 'pointer', border: '1px solid var(--sv-border)',
      }}
    >
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--sv-ink)', margin: '0 0 3px' }}>
          {s.worker_name} <span style={{ color: 'var(--sv-muted)', fontWeight: 400 }}>on {s.machine_id}</span>
        </p>
        <p style={{ fontSize: 12, color: 'var(--sv-muted)', margin: 0 }}>
          Topic {Math.min(s.topic_index + 1, s.total_topics)}/{s.total_topics} · {s.insights_captured} insight{s.insights_captured === 1 ? '' : 's'}
          {s.started_at && ` · started ${new Date(s.started_at).toLocaleDateString()}`}
        </p>
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: statusColor, whiteSpace: 'nowrap', marginLeft: 12 }}>
        {statusLabel}
      </span>
    </button>
  );
}

function TranscriptView({ sessionId, onBack }) {
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);
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
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (!data) return <p style={{ fontSize: 13, color: 'var(--sv-muted)' }}>Loading transcript…</p>;

  return (
    <div>
      <button
        onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--sv-muted)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 14, padding: 0 }}
      >
        <ChevronLeft size={15} /> Back to interviews
      </button>

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 18, margin: '0 0 4px' }}>
          {data.worker_name} · {data.machine_id}
        </p>
        <p style={{ fontSize: 12, color: 'var(--sv-muted)', margin: 0 }}>
          {data.status === 'completed' ? 'Completed' : data.status === 'paused' ? 'Paused' : 'In progress'} ·{' '}
          {data.turns.length} turn{data.turns.length === 1 ? '' : 's'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.turns.map((t) => (
          <div key={t.turn_id} className="sv-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--sv-font-mono)', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--sv-bg)', color: 'var(--sv-muted)' }}>
                {t.topic_title}{t.is_followup ? ' · follow-up' : ''}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--sv-muted)', margin: '0 0 6px' }}>
              <strong style={{ color: 'var(--sv-brass)' }}>AI: </strong>{t.question_text}
            </p>
            <p style={{ fontSize: 14, color: 'var(--sv-ink)', margin: '0 0 10px' }}>
              <strong style={{ color: 'var(--sv-teal)' }}>{data.worker_name}: </strong>{t.answer_text}
            </p>
            {t.answer_audio_url && (
              <audio controls src={mediaUrl(t.answer_audio_url)} style={{ width: '100%', height: 32, marginBottom: 10 }} />
            )}
            {t.knowledge_status && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--sv-border-light)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--sv-muted)' }}>
                  <Sparkles size={12} color="var(--sv-brass)" /> Distilled insight
                </span>
                {t.knowledge_status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="sv-btn sv-btn--danger-text" disabled={busyId === t.turn_id} onClick={() => remove(t.turn_id, t.knowledge_entry_id)}>
                      Delete
                    </button>
                    <button className="sv-btn sv-btn--teal" disabled={busyId === t.turn_id} onClick={() => approve(t.turn_id, t.knowledge_entry_id)}>
                      Approve
                    </button>
                  </div>
                ) : (
                  <Stamp status={t.knowledge_status} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function InterviewsTab({ machine }) {
  const [sessions, setSessions] = useState(null);
  const [openSessionId, setOpenSessionId] = useState(null);
  const { push } = useToast();

  useEffect(() => {
    setSessions(null);
    setOpenSessionId(null);
    Api.adminInterviewSessions(machine || null)
      .then((res) => setSessions(res.sessions || []))
      .catch((err) => push(err.message, 'error'));
  }, [machine]); // eslint-disable-line react-hooks/exhaustive-deps

  if (openSessionId) {
    return <TranscriptView sessionId={openSessionId} onBack={() => setOpenSessionId(null)} />;
  }

  return (
    <div>
      {sessions === null && <p style={{ fontSize: 13, color: 'var(--sv-muted)' }}>Loading interviews…</p>}
      {sessions?.length === 0 && (
        <div className="sv-card" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--sv-muted)' }}>
          <PlayCircle size={22} color="var(--sv-muted-light)" style={{ marginBottom: 8 }} />
          <p style={{ margin: 0 }}>No tacit knowledge interviews for {machine || 'this machine'} yet.</p>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sessions?.map((s) => <SessionRow key={s.session_id} s={s} onOpen={setOpenSessionId} />)}
      </div>
    </div>
  );
}