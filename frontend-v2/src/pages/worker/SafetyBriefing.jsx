import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, PartyPopper,
  ShieldAlert, Video, Volume2, Square, Loader2, AlertTriangle,
} from 'lucide-react';
import { api, mediaUrl, ApiError } from '../../lib/api';
import { FullPageLoader, Button, ProgressBar, Card } from '../../components/ui';
import { useToast } from '../../components/Toast';

/**
 * Step-by-step safety tutorial for one machine.
 * Worker must walk through each step; final confirm marks complete.
 */

export default function SafetyBriefing() {
  const { machineId } = useParams();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [measures, setMeasures] = useState([]);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [idx, setIdx] = useState(0);
  const [visited, setVisited] = useState(new Set([0]));
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    api.safetyMeasures(machineId)
      .then((r) => {
        setMeasures(r.measures || []);
        setAlreadyDone(!!r.completed);
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not load briefing.'))
      .finally(() => setLoading(false));
    return () => stopSpeak();
  }, [machineId]);

  const stopSpeak = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = '';
      } catch (_) {}
      audioRef.current = null;
    }
    setSpeaking(false);
  };

  const speak = async (text) => {
    if (!text?.trim()) return;
    stopSpeak();
    setSpeaking(true);
    try {
      const result = await api.speak(text.trim(), 'en-IN');
      const blob = result?.blob || result;
      if (!blob || !(blob instanceof Blob)) throw new Error('no audio');
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (_) {
      setSpeaking(false);
      toast.error('Could not play audio.');
    }
  };

  const goTo = (next) => {
    stopSpeak();
    setIdx(next);
    setVisited((v) => new Set([...v, next]));
  };

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

  if (loading) return <FullPageLoader label="Loading safety tutorial…" />;

  if (measures.length === 0) {
    return (
      <div className="max-w-lg mx-auto">
        <Link to="/worker/safety" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text mb-6">
          <ArrowLeft size={15} /> Back to safety
        </Link>
        <Card className="p-10 border-2 border-line text-center text-muted">
          No safety measures have been added for <strong className="text-text">{machineId}</strong> yet.
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="w-20 h-20 rounded-2xl bg-signal/15 border-2 border-signal/40 flex items-center justify-center text-signal mx-auto mb-6"
        >
          <PartyPopper size={34} />
        </motion.div>
        <h1 className="text-2xl font-semibold mb-2">Briefing complete</h1>
        <p className="text-sm text-muted mb-2">
          You’re cleared to work on <strong className="text-text">{machineId}</strong>.
        </p>
        <p className="text-xs text-muted mb-8">
          Stay alert on the floor. Revisit this tutorial anytime from Safety.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/worker/safety">
            <Button variant="amber" size="lg">Back to Safety</Button>
          </Link>
          <Link to="/worker">
            <Button variant="ghost" size="lg">Go to overview</Button>
          </Link>
        </div>
      </div>
    );
  }

  const step = measures[idx];
  const total = measures.length;
  const progress = ((idx + 1) / total) * 100;
  const allVisited = visited.size >= total;
  const isLast = idx === total - 1;

  return (
    <div className="max-w-2xl mx-auto w-full">
      <Link to="/worker/safety" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text mb-4">
        <ArrowLeft size={15} /> All machines
      </Link>

      {/* Tutorial header */}
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber">Safety tutorial</span>
          {alreadyDone && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-signal/15 text-signal border border-signal/30">
              Already completed — review mode
            </span>
          )}
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-text">{machineId}</h1>
        <p className="text-sm text-muted mt-1">
          Step {idx + 1} of {total} — read carefully before operating this machine.
        </p>
      </div>

      {!alreadyDone && (
        <div className="mb-5 rounded-xl border-2 border-amber/30 bg-amber/10 px-4 py-3 flex gap-3 items-start">
          <AlertTriangle size={18} className="text-amber shrink-0 mt-0.5" />
          <p className="text-sm text-text leading-relaxed">
            <strong>Required before work.</strong> Go through every step. You can only mark complete after the last step.
          </p>
        </div>
      )}

      <ProgressBar value={progress} tone="amber" className="mb-2" />
      <div className="flex gap-1.5 mb-6 flex-wrap">
        {measures.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            className={`h-2 flex-1 min-w-[24px] max-w-[48px] rounded-full transition-colors ${
              i === idx ? 'bg-amber' : visited.has(i) ? 'bg-signal/50' : 'bg-surface-3'
            }`}
            aria-label={`Step ${i + 1}`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id || idx}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="p-6 md:p-8 border-2 border-line min-h-[360px] flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber/15 border-2 border-amber/30 text-amber flex items-center justify-center font-bold text-sm">
                  {idx + 1}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">Step {idx + 1}</p>
                  <h2 className="text-lg font-semibold text-text leading-snug">{step.title}</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (speaking) stopSpeak();
                  else speak(`${step.title}. ${step.content || ''}`);
                }}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full border-2 shrink-0 ${
                  speaking
                    ? 'border-amber bg-amber text-white'
                    : 'border-line text-muted hover:border-amber hover:text-amber'
                }`}
              >
                {speaking ? <Square size={12} /> : <Volume2 size={14} />}
                {speaking ? 'Stop' : 'Listen'}
              </button>
            </div>

            {step.video_url && (
              <div className="mb-4 rounded-xl overflow-hidden border-2 border-line bg-black aspect-video">
                <video
                  key={step.video_url}
                  src={mediaUrl(step.video_url)}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            <div className="flex-1 text-sm text-text leading-relaxed whitespace-pre-wrap mb-6">
              {step.content || 'No details provided for this step.'}
            </div>

            <div className="pt-4 border-t-2 border-line flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => goTo(Math.max(0, idx - 1))}
                disabled={idx === 0}
                icon={ChevronLeft}
              >
                Previous
              </Button>

              {!isLast ? (
                <Button
                  variant="amber"
                  size="lg"
                  onClick={() => goTo(idx + 1)}
                  icon={ChevronRight}
                >
                  Next step
                </Button>
              ) : alreadyDone ? (
                <Link to="/worker/safety">
                  <Button variant="signal" size="lg" icon={CheckCircle2}>
                    Done reviewing
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="amber"
                  size="lg"
                  loading={submitting}
                  onClick={finish}
                  disabled={!allVisited && total > 1}
                  icon={CheckCircle2}
                >
                  I understand — mark complete
                </Button>
              )}
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>

      {isLast && !alreadyDone && !allVisited && total > 1 && (
        <p className="text-xs text-muted text-center mt-3 flex items-center justify-center gap-1.5">
          <ShieldAlert size={12} />
          Open every step above before you can mark this briefing complete.
        </p>
      )}
    </div>
  );
}