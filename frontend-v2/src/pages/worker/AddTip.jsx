import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, X, CheckCircle2, Sparkles, UploadCloud } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { PageHeader, Select, Textarea, Button, Card, ProgressBar } from '../../components/ui';
import MicButton from '../../components/MicButton';
import { useToast } from '../../components/Toast';

export default function AddTip() {
  const toast = useToast();
  const [machines, setMachines] = useState([]);
  const [machineId, setMachineId] = useState('');
  const [text, setText] = useState('');
  const [languageCode, setLanguageCode] = useState('en-IN');
  const [round, setRound] = useState(1);
  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    api.myMachines().then((r) => {
      setMachines(r.machine_ids || []);
      if (r.machine_ids?.length) setMachineId(r.machine_ids[0]);
    }).catch(() => {});
  }, []);

  const onVideoChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setVideoFile(f);
    setVideoPreview(URL.createObjectURL(f));
  };

  const runCheck = async () => {
    if (!text.trim() || !machineId) return;
    setChecking(true);
    try {
      const res = await api.checkKnowledge(text, machineId, round, languageCode);
      setCheckResult(res);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not review the tip.');
    } finally {
      setChecking(false);
    }
  };

  const answerFollowup = (answerText) => {
    setText((t) => `${t}\n\n${answerText}`);
    setRound((r) => r + 1);
    setCheckResult(null);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await api.addKnowledge(text, machineId, languageCode, videoFile, setProgress);
      setSubmitted(res);
      toast.success('Tip submitted — pending review.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not submit the tip.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setText(''); setRound(1); setCheckResult(null); setVideoFile(null); setVideoPreview(null); setSubmitted(null); setProgress(0);
  };

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="w-20 h-20 rounded-full bg-signal/10 border border-signal/40 flex items-center justify-center text-signal mx-auto mb-6">
          <CheckCircle2 size={34} />
        </motion.div>
        <h2 className="font-display text-3xl font-bold mb-2">Thanks — that's saved.</h2>
        <p className="text-muted mb-8">{submitted.spoken_confirmation || 'Your tip is now waiting for a supervisor to review it.'}</p>
        <Button onClick={reset}>Add another tip</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader eyebrow="Add a tip" title="Share what you know." description="Speak or type a tip about a machine. AI may ask one quick follow-up to sharpen it before it's saved." />

      <Card className="p-7 space-y-5">
        <Select label="Machine" value={machineId} onChange={(e) => setMachineId(e.target.value)}>
          {machines.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>

        <div>
          <span className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wide">Your tip</span>
          <div className="flex items-start gap-4">
            <MicButton size={44} label={false} onResult={(res) => { setText((t) => (t ? `${t} ${res.transcript}` : res.transcript)); setLanguageCode(res.language_code || 'en-IN'); }} />
            <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. When the coolant pump hums louder than usual, check the inlet filter first — it's clogged 9 times out of 10." className="flex-1" />
          </div>
        </div>

        <AnimatePresence>
          {checkResult?.question && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="sv-card p-4 border-amber/30">
              <p className="text-xs font-mono uppercase tracking-widest text-amber mb-2 flex items-center gap-1.5"><Sparkles size={13} /> One quick follow-up</p>
              <p className="text-sm text-text/90 mb-3">{checkResult.question}</p>
              <FollowupAnswer onSubmit={answerFollowup} />
            </motion.div>
          )}
          {checkResult && !checkResult.question && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="sv-card p-4 border-signal/30 flex items-center gap-2 text-sm text-signal">
              <CheckCircle2 size={16} /> Looks good — ready to submit.
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <span className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wide">Attach a video (optional)</span>
          {videoPreview ? (
            <div className="relative">
              <video src={videoPreview} controls className="w-full rounded-xl border border-line" />
              <button onClick={() => { setVideoFile(null); setVideoPreview(null); }} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 flex items-center justify-center text-white">
                <X size={15} />
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-line rounded-xl py-8 flex flex-col items-center gap-2 text-muted hover:border-signal/50 hover:text-signal transition-colors">
              <UploadCloud size={22} />
              <span className="text-xs font-mono">MP4, WebM, MOV or AVI — up to 80MB</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/x-msvideo" onChange={onVideoChange} className="hidden" />
        </div>

        {submitting && progress > 0 && <ProgressBar value={progress * 100} />}

        <div className="flex items-center gap-3 pt-2">
          <Button variant="ghost" onClick={runCheck} loading={checking} disabled={!text.trim()}>Check my tip</Button>
          <Button onClick={submit} loading={submitting} disabled={!text.trim()} className="flex-1">Submit tip</Button>
        </div>
      </Card>
    </div>
  );
}

function FollowupAnswer({ onSubmit }) {
  const [val, setVal] = useState('');
  return (
    <div className="flex items-center gap-2">
      <MicButton size={38} label={false} onResult={(res) => setVal(res.transcript)} />
      <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Answer…" className="flex-1 bg-surface-2 border border-line rounded-full px-4 py-2 text-sm outline-none focus:border-signal" />
      <Button size="sm" onClick={() => { if (val.trim()) onSubmit(val); }}>Add</Button>
    </div>
  );
}
