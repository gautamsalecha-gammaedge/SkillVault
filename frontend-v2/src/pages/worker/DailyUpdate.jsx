import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, Clock, HardHat, Factory, Mic, Square, Loader2,
  Sparkles, Send, Volume2, Pencil, Plus, CheckCircle2, NotebookPen,
  ArrowRight, RefreshCw,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { getWorkerName, getWorkerId } from '../../lib/auth';
import { speakSmart, transcribeSmart, defaultLanguage } from '../../lib/voice';
import { Select, Button, Card, Textarea, FullPageLoader } from '../../components/ui';
import { useToast } from '../../components/Toast';

/**
 * Daily Update — worker end-of-shift note
 * Stages: draft → optimizing → review → done
 * AI only polishes what the worker wrote (no new suggestions / facts).
 */

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatNiceDate(iso) {
  try {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatTime() {
  return new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function DailyUpdate() {
  const toast = useToast();
  const name = getWorkerName() || 'Worker';
  const workerId = getWorkerId() || '—';

  const [machines, setMachines] = useState([]);
  const [machineId, setMachineId] = useState('');
  const [reportDate] = useState(todayISO());
  const [clock, setClock] = useState(formatTime());

  const [tab, setTab] = useState('write'); // write | history — like Tips / Tickets
  const [stage, setStage] = useState('draft'); // draft | optimizing | review | done
  const [draft, setDraft] = useState('');
  const [rawSnapshot, setRawSnapshot] = useState('');
  const [optimized, setOptimized] = useState('');
  const [addon, setAddon] = useState('');
  const [listening, setListening] = useState(false);
  const [liveCaption, setLiveCaption] = useState('');
  const [targetField, setTargetField] = useState('draft'); // draft | addon
  const [submitting, setSubmitting] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHist, setLoadingHist] = useState(true);

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const browserFinalRef = useRef('');
  const speakJobRef = useRef(null);
  const langRef = useRef(defaultLanguage());

  useEffect(() => {
    const t = setInterval(() => setClock(formatTime()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    api.myMachines()
      .then((r) => {
        const ids = r.machine_ids || [];
        setMachines(ids);
        // Must choose a machine or General — default first assigned machine
        if (ids.length) setMachineId(ids[0]);
        else setMachineId('general');
      })
      .catch(() => setMachineId('general'));
    api.myDailyUpdates()
      .then((r) => setHistory(r.updates || []))
      .catch(() => {})
      .finally(() => setLoadingHist(false));

    return () => {
      hardStopVoice();
    };
  }, []);

  const hardStopVoice = () => {
    try { recognitionRef.current?.stop(); } catch (_) {}
    recognitionRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (_) {}
    }
    mediaRecorderRef.current = null;
    if (audioStreamRef.current) {
      try { audioStreamRef.current.getTracks().forEach((t) => t.stop()); } catch (_) {}
      audioStreamRef.current = null;
    }
    try { speakJobRef.current?.stop?.(); } catch (_) {}
    speakJobRef.current = null;
    try { window.speechSynthesis?.cancel(); } catch (_) {}
    setListening(false);
    setSpeaking(false);
    setLiveCaption('');
  };

  const startMic = async (field) => {
    hardStopVoice();
    setTargetField(field);
    setListening(true);
    setLiveCaption('');
    browserFinalRef.current = '';
    const lang = langRef.current || defaultLanguage();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const rec = new SR();
      recognitionRef.current = rec;
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = lang;
      rec.onresult = (event) => {
        let interim = '';
        let finalChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) finalChunk += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (finalChunk) {
          browserFinalRef.current = `${browserFinalRef.current} ${finalChunk}`.trim();
        }
        setLiveCaption([browserFinalRef.current, interim].filter(Boolean).join(' ') || '…');
      };
      try { rec.start(); } catch (_) {}
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data?.size) audioChunksRef.current.push(e.data); };
      mr.start();
    } catch (_) {
      if (!SR) {
        toast.error('Microphone access needed to speak your update.');
        setListening(false);
      }
    }
  };

  const stopMic = async () => {
    setListening(false);
    setLiveCaption('');
    try { recognitionRef.current?.stop(); } catch (_) {}
    recognitionRef.current = null;
    const browserText = (browserFinalRef.current || '').trim();
    browserFinalRef.current = '';

    const apply = (text) => {
      if (!text) return;
      if (targetField === 'addon') {
        setAddon((prev) => (prev ? `${prev} ${text}` : text).trim());
      } else {
        setDraft((prev) => (prev ? `${prev} ${text}` : text).trim());
      }
    };

    if (browserText.length >= 2) {
      apply(browserText);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (_) {}
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
      mediaRecorderRef.current = null;
      return;
    }

    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === 'inactive') return;
    await new Promise((resolve) => {
      mr.onstop = async () => {
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }
        try {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (blob.size > 400) {
            const res = await transcribeSmart({
              blob,
              browserText: '',
              languageCode: langRef.current,
            });
            if (res?.transcript) {
              apply(res.transcript.trim());
              if (res.language_code) langRef.current = res.language_code;
            }
          }
        } catch (_) {
          toast.error("Couldn't catch that — type a line or try the mic again.");
        }
        resolve();
      };
      try { mr.stop(); } catch (_) { resolve(); }
    });
    mediaRecorderRef.current = null;
  };

  const toggleMic = (field) => {
    if (listening && targetField === field) stopMic();
    else startMic(field);
  };

  const runOptimize = async () => {
    const text = draft.trim();
    if (!machineId) {
      toast.error('Select a machine or General before continuing.');
      return;
    }
    if (!text) {
      toast.error('Write or speak what you did today first.');
      return;
    }
    if (listening) await stopMic();
    hardStopVoice();
    setStage('optimizing');
    setRawSnapshot(text);
    try {
      const mid = machineId === 'general' ? null : machineId;
      const res = await api.optimizeDailyUpdate(text, mid);
      setOptimized((res.optimized_text || text).trim());
      setAddon('');
      setStage('review');
      toast.success('Update polished — read it, listen, or add more.');
    } catch (err) {
      setOptimized(text);
      setStage('review');
      toast.error(err instanceof ApiError ? err.message : 'Could not polish — showing your original text.');
    }
  };

  const appendAddon = async () => {
    const extra = addon.trim();
    if (!extra) {
      toast.error('Add a line first, or speak with the mic.');
      return;
    }
    if (listening) await stopMic();
    const merged = `${optimized.trim()}\n\n${extra}`.trim();
    setStage('optimizing');
    setRawSnapshot(`${rawSnapshot}\n${extra}`.trim());
    try {
      const res = await api.optimizeDailyUpdate(merged, machineId === 'general' ? null : machineId);
      setOptimized((res.optimized_text || merged).trim());
      setAddon('');
      setStage('review');
      toast.success('Added and polished.');
    } catch (_) {
      setOptimized(merged);
      setAddon('');
      setStage('review');
    }
  };

  const listenOptimized = async () => {
    if (!optimized.trim()) return;
    if (speaking) {
      hardStopVoice();
      return;
    }
    setSpeaking(true);
    try {
      const job = speakSmart(optimized.trim(), langRef.current || defaultLanguage());
      speakJobRef.current = job;
      await job;
    } catch (_) {
      toast.error('Could not play audio.');
    } finally {
      setSpeaking(false);
      speakJobRef.current = null;
    }
  };

  const finalSubmit = async () => {
    const text = optimized.trim();
    if (!machineId) {
      toast.error('Select a machine or General before submitting.');
      return;
    }
    if (!text) {
      toast.error('Nothing to submit.');
      return;
    }
    hardStopVoice();
    setSubmitting(true);
    try {
      const row = await api.submitDailyUpdate({
        raw_text: rawSnapshot || text,
        optimized_text: text,
        machine_id: machineId === 'general' ? null : machineId,
        report_date: reportDate,
      });
      setHistory((h) => [row, ...h]);
      setStage('done');
      toast.success('Daily update sent to your supervisor.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Submit failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const startAnother = () => {
    hardStopVoice();
    setDraft('');
    setOptimized('');
    setRawSnapshot('');
    setAddon('');
    setStage('draft');
  };

  if (loadingHist && machines.length === 0 && stage === 'draft' && !draft) {
    // light first paint — don't block whole page on history
  }

  return (
    <div className="max-w-3xl mx-auto w-full pb-12">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700 mb-1">End of shift</p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-text flex items-center gap-2">
          <NotebookPen className="text-teal-700" size={28} />
          Daily update
        </h1>
        <p className="text-[15px] sm:text-base text-muted mt-2 leading-relaxed max-w-2xl">
          Tell what you did today in your own words. AI only cleans the wording —
          it will not invent work or add advice. Then send it to your supervisor.
        </p>
      </div>

      {/* Write | History — same pattern as Tips / Tickets */}
      <div className="inline-flex p-1 rounded-2xl bg-stone-200/70 border border-line mb-6 shadow-inner">
        <button
          type="button"
          onClick={() => setTab('write')}
          className={`h-10 px-5 rounded-xl text-sm font-semibold transition-all ${
            tab === 'write' ? 'bg-white text-text shadow-sm' : 'text-muted hover:text-text'
          }`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => { setTab('history'); hardStopVoice(); }}
          className={`h-10 px-5 rounded-xl text-sm font-semibold transition-all ${
            tab === 'history' ? 'bg-white text-text shadow-sm' : 'text-muted hover:text-text'
          }`}
        >
          History
          {history.length > 0 && (
            <span className="ml-1.5 text-[11px] tabular-nums text-muted">({history.length})</span>
          )}
        </button>
      </div>

      {tab === 'history' ? (
        <div>
          <p className="text-sm text-muted mb-4 leading-relaxed">
            Everything you have already sent to your supervisor. These notes are not used by Ask AI.
          </p>
          {loadingHist ? (
            <p className="text-sm text-muted">Loading history…</p>
          ) : history.length === 0 ? (
            <Card className="p-10 border-2 border-dashed border-line text-center">
              <NotebookPen className="mx-auto text-muted mb-3" size={28} />
              <p className="font-semibold text-text mb-1">No updates yet</p>
              <p className="text-sm text-muted mb-4">Your first submitted update will appear here.</p>
              <Button variant="amber" onClick={() => setTab('write')}>Write an update</Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {history.map((u) => (
                <Card key={u.id} className="p-4 sm:p-5 border-2 border-line">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted mb-2">
                    <span className="font-semibold text-text text-sm">{u.report_date}</span>
                    <span className="px-2 py-0.5 rounded-full bg-surface-2 border border-line">
                      {u.machine_id || 'General'}
                    </span>
                    {u.created_at && (
                      <span>{new Date(u.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </div>
                  <p className="text-[15px] text-text leading-relaxed whitespace-pre-wrap">{u.optimized_text}</p>
                  {u.raw_text && u.raw_text !== u.optimized_text && (
                    <details className="mt-2 text-xs text-muted">
                      <summary className="cursor-pointer hover:text-text">Original draft</summary>
                      <p className="mt-1.5 whitespace-pre-wrap">{u.raw_text}</p>
                    </details>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
      <>

      {/* Template strip — prefilled identity */}
      <Card className="p-5 sm:p-6 border-2 border-line mb-6 overflow-hidden relative">
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 0% 0%, #0f9d8a 0%, transparent 55%), radial-gradient(ellipse at 100% 100%, #d97706 0%, transparent 50%)',
          }}
        />
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Meta icon={HardHat} label="Name" value={name} />
          <Meta icon={Factory} label="Worker ID" value={workerId} mono />
          <Meta icon={CalendarDays} label="Date" value={formatNiceDate(reportDate)} />
          <Meta icon={Clock} label="Time" value={clock} />
        </div>
        <div className="relative mt-5 pt-5 border-t border-line">
          <Select
            label="Machine"
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
          >
            <option value="" disabled>
              Select machine or General…
            </option>
            <option value="general">General (floor / no single machine)</option>
            {machines.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
          <p className="text-xs text-muted mt-1.5">Required — pick the machine this update is about, or General.</p>
        </div>
      </Card>

      {/* Stages */}
      <AnimatePresence mode="wait">
        {stage === 'draft' && (
          <motion.div
            key="draft"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="p-6 sm:p-8 border-2 border-line">
              <h2 className="text-lg font-semibold text-text mb-1">What did you work on today?</h2>
              <p className="text-sm text-muted mb-5 leading-relaxed">
                Jobs finished, issues you hit, handovers, anything your supervisor should know.
                Speak or type — both are fine.
              </p>

              <Textarea
                rows={6}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  machineId && machineId !== 'general'
                    ? `Example: Worked on ${machineId} morning shift. Finished the planned jobs. Noted one issue and informed the next shift at handover.`
                    : 'Example: Morning shift on the floor. Finished planned jobs. Noted one issue and informed the next shift at handover.'
                }
                className="text-[15px] leading-relaxed"
              />

              {listening && targetField === 'draft' && (
                <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <span className="font-semibold">Live · </span>
                  {liveCaption || 'Listening…'}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => toggleMic('draft')}
                  className={`inline-flex items-center justify-center gap-2 h-12 px-5 rounded-2xl font-semibold text-sm transition-all ${
                    listening && targetField === 'draft'
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                      : 'bg-teal-700 text-white shadow-lg shadow-teal-700/20 hover:bg-teal-800'
                  }`}
                >
                  {listening && targetField === 'draft' ? <Square size={18} /> : <Mic size={18} />}
                  {listening && targetField === 'draft' ? 'Stop' : 'Speak update'}
                </button>
                <Button
                  variant="amber"
                  size="lg"
                  onClick={runOptimize}
                  disabled={!draft.trim() || listening || !machineId}
                  icon={Sparkles}
                >
                  Polish with AI
                </Button>
              </div>

              <div className="mt-8 grid sm:grid-cols-3 gap-3">
                {[
                  { n: '1', t: 'Share', d: 'Speak or type what happened on the floor.' },
                  { n: '2', t: 'Polish', d: 'AI only cleans language — no new facts.' },
                  { n: '3', t: 'Send', d: 'Listen, tweak if needed, submit to admin.' },
                ].map((s) => (
                  <div key={s.n} className="rounded-2xl border border-line bg-surface-2 p-4">
                    <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-teal-700 text-white text-xs font-bold mb-2">{s.n}</span>
                    <p className="text-sm font-semibold text-text">{s.t}</p>
                    <p className="text-xs text-muted mt-1 leading-relaxed">{s.d}</p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {stage === 'optimizing' && (
          <motion.div
            key="opt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-16 text-center"
          >
            <Card className="p-10 border-2 border-line max-w-md mx-auto">
              <motion.div
                className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-teal-700/15 border-2 border-teal-700/30 flex items-center justify-center text-teal-700"
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                <Sparkles size={28} />
              </motion.div>
              <h2 className="text-xl font-semibold mb-2">Polishing your update…</h2>
              <p className="text-sm text-muted leading-relaxed">
                Clearing grammar and flow only. Nothing new is added.
              </p>
              <Loader2 className="mx-auto mt-6 animate-spin text-teal-700" size={28} />
            </Card>
          </motion.div>
        )}

        {stage === 'review' && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            <Card className="p-6 sm:p-8 border-2 border-teal-700/25 bg-gradient-to-b from-teal-50/40 to-transparent">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Ready to send</p>
                  <h2 className="text-lg font-semibold text-text">Polished daily update</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={listenOptimized}
                    icon={speaking ? Square : Volume2}
                  >
                    {speaking ? 'Stop' : 'Listen'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setDraft(optimized); setStage('draft'); }}
                    icon={Pencil}
                  >
                    Edit from scratch
                  </Button>
                </div>
              </div>

              <Textarea
                rows={8}
                value={optimized}
                onChange={(e) => setOptimized(e.target.value)}
                className="text-[15px] leading-relaxed bg-white/80"
              />
              <p className="text-xs text-muted mt-2">
                You can edit this text directly, or add more below and polish again.
              </p>

              <div className="mt-6 pt-6 border-t border-line">
                <p className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
                  <Plus size={16} className="text-amber-600" />
                  Add more (optional)
                </p>
                <Textarea
                  rows={3}
                  value={addon}
                  onChange={(e) => setAddon(e.target.value)}
                  placeholder="Forgot something? Type or speak — it will be appended and polished."
                />
                {listening && targetField === 'addon' && (
                  <p className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <span className="font-semibold">Live · </span>
                    {liveCaption || 'Listening…'}
                  </p>
                )}
                <div className="flex flex-wrap gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => toggleMic('addon')}
                    className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl text-sm font-semibold ${
                      listening && targetField === 'addon'
                        ? 'bg-red-500 text-white'
                        : 'bg-surface-2 border-2 border-line text-text hover:border-teal-700'
                    }`}
                  >
                    {listening && targetField === 'addon' ? <Square size={16} /> : <Mic size={16} />}
                    {listening && targetField === 'addon' ? 'Stop' : 'Speak add-on'}
                  </button>
                  <Button variant="ghost" onClick={appendAddon} disabled={!addon.trim() || listening} icon={RefreshCw}>
                    Append & polish
                  </Button>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  variant="amber"
                  size="lg"
                  onClick={finalSubmit}
                  loading={submitting}
                  disabled={!optimized.trim() || listening}
                  icon={Send}
                >
                  Submit to supervisor
                </Button>
                <Button variant="ghost" size="lg" onClick={startAnother} disabled={submitting}>
                  Start over
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {stage === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="p-10 border-2 border-line text-center">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-teal-700/15 border-2 border-teal-700/35 flex items-center justify-center text-teal-700">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Update submitted</h2>
              <p className="text-sm text-muted mb-8 max-w-md mx-auto leading-relaxed">
                Your supervisor can read it under Daily updates for {formatNiceDate(reportDate)}.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="amber" size="lg" onClick={startAnother} icon={ArrowRight}>
                  Write another
                </Button>
                <Button variant="ghost" size="lg" onClick={() => setTab('history')}>
                  View history
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      </>
      )}
    </div>
  );
}

function Meta({ icon: Icon, label, value, mono }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5 mb-1">
        <Icon size={12} /> {label}
      </p>
      <p className={`text-sm font-semibold text-text truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}