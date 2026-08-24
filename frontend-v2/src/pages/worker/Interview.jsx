import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic2, PartyPopper, PauseCircle, StopCircle, Sparkles } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { PageHeader, Select, Button, Card, ProgressBar, FullPageLoader, Spinner } from '../../components/ui';
import MicButton from '../../components/MicButton';
import SpeakButton from '../../components/SpeakButton';
import { useToast } from '../../components/Toast';

export default function Interview() {
  const toast = useToast();
  const [machines, setMachines] = useState([]);
  const [machineId, setMachineId] = useState('');
  const [resumable, setResumable] = useState(null);
  const [session, setSession] = useState(null);
  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [answer, setAnswer] = useState('');
  const [audioBlob, setAudioBlob] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    api.myMachines().then((r) => {
      setMachines(r.machine_ids || []);
      if (r.machine_ids?.length) setMachineId(r.machine_ids[0]);
    }).finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!machineId) return;
    setSession(null); setThread([]); setResumable(null);
    api.checkInterview(machineId).then((r) => setResumable(r)).catch(() => {});
  }, [machineId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread]);

  const beginSession = async (fresh) => {
    setLoading(true);
    try {
      const res = await api.startInterview(machineId, 'en-IN', fresh);
      setSession(res);
      if (res.resumed) {
        const t = await api.interviewTranscript(res.session_id);
        setThread(t.turns.map((turn) => ([{ role: 'question', text: turn.question_text, topic: turn.topic_title }, { role: 'answer', text: turn.answer_text }])).flat());
      }
      if (res.current_question) setThread((th) => [...th, { role: 'question', text: res.current_question, topic: res.topic_title }]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not start the interview.');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim() || !session) return;
    setThread((t) => [...t, { role: 'answer', text: answer }]);
    setSubmitting(true);
    const text = answer;
    setAnswer(''); setAudioBlob(null);
    try {
      const res = await api.submitInterviewAnswer(session.session_id, text, session.language_code, audioBlob);
      setSession(res);
      if (res.completed) {
        setThread((t) => [...t, { role: 'done' }]);
      } else if (res.current_question) {
        setThread((t) => [...t, { role: 'question', text: res.current_question, topic: res.topic_title, followup: res.is_followup, insight: res.insight_captured }]);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not submit that answer.');
    } finally {
      setSubmitting(false);
    }
  };

  const pause = async () => {
    if (!session) return;
    await api.pauseInterview(session.session_id);
    toast.info('Paused. Come back anytime to continue.');
    setSession(null); setThread([]);
    api.checkInterview(machineId).then(setResumable);
  };

  const end = async () => {
    if (!session) return;
    await api.endInterview(session.session_id);
    setThread((t) => [...t, { role: 'done' }]);
    setSession((s) => ({ ...s, completed: true }));
  };

  if (checking) return <FullPageLoader label="Loading…" />;

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        eyebrow="Tacit Knowledge Capture"
        title="Let AI interview you."
        description="A guided, voice-led conversation that pulls out what you know — one topic at a time."
        actions={machines.length > 0 && (
          <Select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="min-w-[180px]">
            {machines.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        )}
      />

      {machines.length === 0 ? (
        <Card className="p-8 text-center text-muted">No machine assigned yet.</Card>
      ) : !session ? (
        <Card className="p-8 text-center">
          <Mic2 size={30} className="text-signal mx-auto mb-4" />
          {resumable?.resumable ? (
            <>
              <h3 className="font-display text-xl font-bold mb-2">Pick up where you left off?</h3>
              <p className="text-muted text-sm mb-6">You're on topic {resumable.topic_index + 1} of {resumable.total_topics}, with {resumable.insights_captured} insight{resumable.insights_captured !== 1 ? 's' : ''} captured so far.</p>
              <div className="flex items-center justify-center gap-3">
                <Button variant="ghost" onClick={() => beginSession(true)} loading={loading}>Start fresh</Button>
                <Button onClick={() => beginSession(false)} loading={loading}>Continue interview</Button>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-display text-xl font-bold mb-2">Ready when you are.</h3>
              <p className="text-muted text-sm mb-6">This walks through safety, troubleshooting, maintenance and more for <span className="font-mono text-text">{machineId}</span>.</p>
              <Button onClick={() => beginSession(false)} loading={loading}>Start interview</Button>
            </>
          )}
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-xs text-muted">Topic {session.topic_index + 1} of {session.total_topics} — {session.topic_title || 'wrapping up'}</span>
            <span className="font-mono text-xs text-signal">{session.insights_captured} insight{session.insights_captured !== 1 ? 's' : ''} captured</span>
          </div>
          <ProgressBar value={((session.topic_index) / Math.max(1, session.total_topics)) * 100} />

          <div className="space-y-4 my-6 max-h-[46vh] overflow-y-auto sv-scrollbar-none pr-1">
            <AnimatePresence initial={false}>
              {thread.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  {m.role === 'question' && (
                    <div className="sv-card p-4">
                      {m.followup && <p className="text-[10px] font-mono uppercase tracking-widest text-amber mb-1.5">Follow-up</p>}
                      <p className="text-sm text-text/90">{m.text}</p>
                      <SpeakButton text={m.text} className="mt-2" />
                    </div>
                  )}
                  {m.role === 'answer' && (
                    <div className="flex justify-end">
                      <div className="bg-signal text-[#06110d] font-medium rounded-2xl px-4 py-3 max-w-[85%] text-sm">{m.text}</div>
                    </div>
                  )}
                  {m.role === 'done' && (
                    <div className="sv-card p-6 text-center">
                      <PartyPopper size={26} className="text-signal mx-auto mb-2" />
                      <p className="font-display text-lg font-bold">Interview complete — thank you.</p>
                      <p className="text-muted text-sm mt-1">{session.insights_captured} insight{session.insights_captured !== 1 ? 's' : ''} sent for supervisor review.</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={endRef} />
          </div>

          {!session.completed && (
            <div className="sv-card p-5">
              <div className="flex items-center gap-4 mb-3">
                <MicButton size={48} label={false} onResult={(res) => { setAnswer(res.transcript); setAudioBlob(res.blob); }} />
                <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Or type your answer…" className="flex-1 bg-surface-2 border border-line rounded-full px-4 py-3 text-sm outline-none focus:border-signal" />
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={submitAnswer} loading={submitting} disabled={!answer.trim()} className="flex-1">Send answer</Button>
                <Button variant="ghost" icon={PauseCircle} onClick={pause}>Pause</Button>
                <Button variant="danger" icon={StopCircle} onClick={end}>End</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
