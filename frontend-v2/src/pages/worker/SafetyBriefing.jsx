import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, PartyPopper } from 'lucide-react';
import { api, mediaUrl, ApiError } from '../../lib/api';
import { FullPageLoader, Button, ProgressBar, Badge } from '../../components/ui';
import SpeakButton from '../../components/SpeakButton';
import { useToast } from '../../components/Toast';

export default function SafetyBriefing() {
  const { machineId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [measures, setMeasures] = useState([]);
  const [completed, setCompleted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.safetyMeasures(machineId).then((r) => {
      setMeasures(r.measures || []);
      setCompleted(r.completed);
    }).catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not load briefing.'))
      .finally(() => setLoading(false));
  }, [machineId]);

  const finish = async () => {
    setSubmitting(true);
    try {
      await api.completeSafety(machineId, 'en-IN');
      setDone(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not mark briefing complete.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <FullPageLoader label="Loading briefing…" />;

  if (measures.length === 0) {
    return (
      <div>
        <Link to="/worker/safety" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text mb-6"><ArrowLeft size={15} /> Back to safety</Link>
        <div className="sv-card p-10 text-center">
          <p className="text-muted">No safety measures have been added for {machineId} yet.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="w-20 h-20 rounded-full bg-signal/10 border border-signal/40 flex items-center justify-center text-signal mx-auto mb-6">
          <PartyPopper size={34} />
        </motion.div>
        <h2 className="font-display text-3xl font-bold mb-2">Briefing complete.</h2>
        <p className="text-muted mb-8">You're cleared to work on {machineId}. Stay sharp out there.</p>
        <Button onClick={() => nav('/worker/safety')}>Back to safety hub</Button>
      </div>
    );
  }

  const m = measures[idx];
  const progress = ((idx + 1) / measures.length) * 100;

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/worker/safety" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text mb-6"><ArrowLeft size={15} /> Back to safety</Link>

      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs text-muted">Step {idx + 1} of {measures.length}</span>
        {completed && <Badge tone="signal">Previously completed</Badge>}
      </div>
      <ProgressBar value={progress} />

      <AnimatePresence mode="wait">
        <motion.div key={idx} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}
          className="sv-card p-8 mt-6">
          <p className="font-mono text-[11px] uppercase tracking-widest text-amber mb-2">{machineId}</p>
          <h2 className="font-display text-2xl font-bold mb-4">{m.title}</h2>
          <p className="text-text/90 leading-relaxed whitespace-pre-wrap mb-5">{m.content}</p>
          {m.video_url && (
            <video controls className="w-full rounded-xl border border-line mb-5" src={mediaUrl(m.video_url)} />
          )}
          <SpeakButton text={`${m.title}. ${m.content}`} language_code={m.language_code} />
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} icon={ChevronLeft}>Previous</Button>
        {idx < measures.length - 1 ? (
          <Button onClick={() => setIdx((i) => i + 1)}>Next<ChevronRight size={16} /></Button>
        ) : (
          <Button variant="amber" onClick={finish} loading={submitting} icon={CheckCircle2}>Mark briefing complete</Button>
        )}
      </div>
    </div>
  );
}
