import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ListChecks, Plus, CheckCircle2, Clock, Sparkles, UploadCloud, X,
  Video, Image as ImageIcon, Camera, Circle, Square, Mic, Loader2,
  ShieldCheck, ArrowRight, Pencil, MessageCircle, FileCheck,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  FullPageLoader, EmptyState, Badge, Card,
  Select, Textarea, Button, ProgressBar,
} from '../../components/ui';
import SpeakButton from '../../components/SpeakButton';
import { useToast } from '../../components/Toast';

/**
 * Stages: draft → checking → followup (up to 2) → combining → final → done
 * Simple body text only. Wide form + side tutorial panel.
 */

const numStyle = {
  fontFamily: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif',
  fontVariantNumeric: 'tabular-nums',
};

const HOW_STEPS = [
  { n: 1, title: 'Write or speak', body: 'Share the tip in your own words. Live captions appear while you talk.' },
  { n: 2, title: 'AI checks', body: 'AI looks for missing details. It may ask up to 2 short follow-ups.' },
  { n: 3, title: 'Confirm', body: 'You see one combined tip — edit it, listen to it, then submit for review.' },
];

export default function MyTips() {
  const toast = useToast();
  const [tab, setTab] = useState('capture');
  const [loading, setLoading] = useState(true);
  const [tips, setTips] = useState([]);
  const [filter, setFilter] = useState('all');
  const [machineFilter, setMachineFilter] = useState('all');

  const [machines, setMachines] = useState([]);
  const [machineId, setMachineId] = useState('');
  const [text, setText] = useState('');
  const [languageCode, setLanguageCode] = useState('en-IN');
  const [round, setRound] = useState(1);
  const [stage, setStage] = useState('draft');
  const [followupQ, setFollowupQ] = useState('');
  const [followupAnswer, setFollowupAnswer] = useState('');
  const [finalText, setFinalText] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaKind, setMediaKind] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);

  const [listening, setListening] = useState(false);
  const [liveCaption, setLiveCaption] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStreamRef = useRef(null);
  const listenTargetRef = useRef('main');

  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState('photo');
  const [recording, setRecording] = useState(false);

  const load = () => {
    setLoading(true);
    api.myTips()
      .then((r) => setTips(r.tips || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.myMachines()
      .then((r) => {
        setMachines(r.machine_ids || []);
        if (r.machine_ids?.length) setMachineId(r.machine_ids[0]);
      })
      .catch(() => {});
    return () => {
      stopCamera();
      stopListening();
    };
  }, []);

  const counts = useMemo(() => {
    const c = { all: tips.length, approved: 0, pending: 0 };
    tips.forEach((t) => {
      if (t.status === 'approved') c.approved += 1;
      else c.pending += 1;
    });
    return c;
  }, [tips]);

  const filtered = useMemo(() => {
    let list = tips;
    if (filter === 'approved') list = list.filter((t) => t.status === 'approved');
    else if (filter === 'pending') list = list.filter((t) => t.status !== 'approved');
    if (machineFilter !== 'all') list = list.filter((t) => t.machine_id === machineFilter);
    return list;
  }, [tips, filter, machineFilter]);

  const machineOptions = useMemo(() => {
    const ids = [...new Set(tips.map((t) => t.machine_id).filter(Boolean))];
    return ids.sort();
  }, [tips]);

  const clearMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
    setMediaKind(null);
  };

  const onFilePick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isVideo = f.type.startsWith('video/');
    const isImage = f.type.startsWith('image/');
    if (!isVideo && !isImage) {
      toast.error('Please choose a video or image file.');
      return;
    }
    clearMedia();
    setMediaFile(f);
    setMediaPreview(URL.createObjectURL(f));
    setMediaKind(isVideo ? 'video' : 'image');
    e.target.value = '';
  };

  const stopCamera = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch (_) {}
    }
    recorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const openCamera = async (mode) => {
    stopCamera();
    setCameraMode(mode);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: mode === 'video',
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (_) {
      toast.error('Camera access denied or unavailable.');
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      clearMedia();
      setMediaFile(new File([blob], 'tip-photo-' + Date.now() + '.jpg', { type: 'image/jpeg' }));
      setMediaPreview(URL.createObjectURL(blob));
      setMediaKind('image');
      stopCamera();
    }, 'image/jpeg', 0.92);
  };

  const startVideoRecord = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';
    try {
      const rec = mime
        ? new MediaRecorder(streamRef.current, { mimeType: mime })
        : new MediaRecorder(streamRef.current);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'video/webm' });
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        clearMedia();
        setMediaFile(new File([blob], 'tip-video-' + Date.now() + '.' + ext, { type: blob.type }));
        setMediaPreview(URL.createObjectURL(blob));
        setMediaKind('video');
        stopCamera();
      };
      rec.start(200);
      setRecording(true);
    } catch (_) {
      toast.error('Could not start video recording.');
    }
  };

  const stopVideoRecord = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    setRecording(false);
  };

  const stopListening = useCallback(() => {
    try { recognitionRef.current && recognitionRef.current.stop(); } catch (_) {}
    recognitionRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (_) {}
    }
    mediaRecorderRef.current = null;
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    setListening(false);
  }, []);

  const startListening = async (target) => {
    listenTargetRef.current = target || 'main';
    setLiveCaption('');
    setListening(true);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const rec = new SR();
      recognitionRef.current = rec;
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = languageCode || 'en-IN';
      rec.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) final += r[0].transcript;
          else interim += r[0].transcript;
        }
        const tgt = listenTargetRef.current;
        if (final) {
          if (tgt === 'followup') {
            setFollowupAnswer((t) => (t ? t + ' ' + final : final).trim());
          } else {
            setText((t) => (t ? t + ' ' + final : final).trim());
          }
          setLiveCaption(interim);
        } else setLiveCaption(interim);
      };
      rec.onerror = () => {};
      try { rec.start(); } catch (_) {}
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data && e.data.size) audioChunksRef.current.push(e.data); };
      mr.start();
    } catch (_) {
      if (!SR) {
        toast.error('Microphone access denied.');
        setListening(false);
      }
    }
  };

  const finishListening = async () => {
    const tgt = listenTargetRef.current;
    const had = !!mediaRecorderRef.current;
    setListening(false);
    setLiveCaption('');
    try { recognitionRef.current && recognitionRef.current.stop(); } catch (_) {}
    recognitionRef.current = null;
    if (!had) return;
    setTranscribing(true);
    await new Promise((resolve) => {
      const mr = mediaRecorderRef.current;
      if (!mr || mr.state === 'inactive') { resolve(); return; }
      mr.onstop = async () => {
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }
        try {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (blob.size > 500) {
            const res = await api.transcribe(blob);
            if (res && res.transcript) {
              const next = res.transcript.trim();
              if (tgt === 'followup') {
                setFollowupAnswer((t) => {
                  if (!t) return next;
                  if (t.includes(next.slice(0, Math.min(16, next.length)))) return t;
                  return (t + ' ' + next).trim();
                });
              } else {
                setText((t) => {
                  if (!t) return next;
                  if (t.includes(next.slice(0, Math.min(16, next.length)))) return t;
                  return (t + ' ' + next).trim();
                });
              }
              if (res.language_code) setLanguageCode(res.language_code);
            }
          }
        } catch (_) {
          toast.error("Couldn't transcribe — try typing.");
        } finally {
          setTranscribing(false);
          resolve();
        }
      };
      try { mr.stop(); } catch (_) { resolve(); }
    });
    mediaRecorderRef.current = null;
  };

  const toggleMic = (target) => {
    if (listening) finishListening();
    else startListening(target || 'main');
  };

  /** Allow follow-ups on check rounds 1 and 2 (two cross-questions max). */
  const runCheck = async (bodyText, checkRound) => {
    const body = bodyText.trim();
    if (!body || !machineId) {
      toast.error('Add a tip and select a machine.');
      return;
    }
    setStage('checking');
    setFollowupQ('');
    try {
      const res = await api.checkKnowledge(body, machineId, checkRound, languageCode);
      if (res && res.question && checkRound <= 2) {
        setFollowupQ(res.question);
        setFollowupAnswer('');
        setRound(checkRound);
        setStage('followup');
      } else {
        setStage('combining');
        const cleaned = (res && (res.polished_text || res.cleaned_text || res.text)) || body;
        await new Promise((r) => setTimeout(r, 700));
        setFinalText(cleaned);
        setStage('final');
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'AI check failed.');
      setStage(checkRound > 1 ? 'followup' : 'draft');
    }
  };

  const submitFollowup = async () => {
    if (!followupAnswer.trim()) return;
    const combined = (text + '\n\n' + followupAnswer.trim()).trim();
    setText(combined);
    const nextCheck = round + 1;
    setRound(nextCheck);
    await runCheck(combined, nextCheck);
  };

  const confirmSubmit = async () => {
    const out = finalText.trim();
    if (!out || !machineId) return;
    setSubmitting(true);
    try {
      const res = await api.addKnowledge(
        out,
        machineId,
        languageCode,
        mediaKind === 'video' ? mediaFile : null,
        setProgress,
        mediaKind === 'image' ? mediaFile : null,
      );
      setSubmitted(res);
      setStage('done');
      toast.success('Tip submitted for supervisor review.');
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Submit failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setText('');
    setRound(1);
    setStage('draft');
    setFollowupQ('');
    setFollowupAnswer('');
    setFinalText('');
    setSubmitted(null);
    setProgress(0);
    clearMedia();
    setLiveCaption('');
  };

  const backToEdit = () => {
    setStage('draft');
    setFollowupQ('');
    setFollowupAnswer('');
    setFinalText('');
    setRound(1);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber mb-1">Tips</p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-text tracking-tight">Share what you know</h1>
          <p className="text-[15px] sm:text-base text-muted mt-1.5 leading-relaxed">Speak or type · AI checks before you can submit</p>
        </div>
        <div className="flex p-1 rounded-xl bg-surface-2 border-2 border-line self-start">
          <button
            type="button"
            onClick={() => { setTab('capture'); if (stage === 'done') resetAll(); }}
            className={'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ' + (tab === 'capture' ? 'bg-amber text-white shadow-sm' : 'text-text hover:bg-surface')}
          >
            <Plus size={16} /> Capture
          </button>
          <button
            type="button"
            onClick={() => setTab('library')}
            className={'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ' + (tab === 'library' ? 'bg-amber text-white shadow-sm' : 'text-text hover:bg-surface')}
          >
            <ListChecks size={16} /> Library
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'capture' ? (
          <motion.div
            key="capture"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="min-w-0 space-y-6">
              {stage !== 'done' && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    { id: 'draft', label: '1 · Write' },
                    { id: 'check', label: '2 · AI check' },
                    { id: 'final', label: '3 · Confirm' },
                  ].map((s) => {
                    const active =
                      (s.id === 'draft' && stage === 'draft') ||
                      (s.id === 'check' && (stage === 'checking' || stage === 'followup' || stage === 'combining')) ||
                      (s.id === 'final' && stage === 'final');
                    const done =
                      (s.id === 'draft' && stage !== 'draft' && stage !== 'done') ||
                      (s.id === 'check' && stage === 'final');
                    return (
                      <span
                        key={s.id}
                        className={'text-xs font-semibold px-3.5 py-1.5 rounded-full border-2 ' + (
                          active ? 'bg-amber text-white border-amber' :
                          done ? 'bg-signal/15 text-signal border-signal/40' :
                          'bg-surface-2 text-muted border-line'
                        )}
                      >
                        {s.label}
                      </span>
                    );
                  })}
                </div>
              )}

              <Card className="p-7 md:p-9 border-2 border-line min-h-[480px]">
                <AnimatePresence mode="wait">
                  {stage === 'done' && (
                    <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-14">
                      <div className="w-16 h-16 rounded-2xl bg-signal/15 border-2 border-signal/40 flex items-center justify-center text-signal mx-auto mb-5">
                        <CheckCircle2 size={32} />
                      </div>
                      <h2 className="text-xl font-semibold mb-2">Saved for review</h2>
                      <p className="text-sm text-muted mb-8 max-w-sm mx-auto">
                        {(submitted && submitted.spoken_confirmation) || 'A supervisor will approve it before it goes live.'}
                      </p>
                      <div className="flex flex-wrap justify-center gap-3">
                        <Button variant="amber" size="lg" onClick={resetAll}>Capture another</Button>
                        <Button variant="ghost" size="lg" onClick={() => setTab('library')}>Open library</Button>
                      </div>
                    </motion.div>
                  )}

                  {(stage === 'checking' || stage === 'combining') && (
                    <motion.div key={stage} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-24 gap-4">
                      <Loader2 size={42} className="animate-spin text-amber" />
                      <p className="text-lg font-semibold text-text">
                        {stage === 'checking' ? 'AI is checking your tip…' : 'Combining into a clear tip…'}
                      </p>
                      <p className="text-sm text-muted">
                        {stage === 'checking' ? 'Looking for missing details' : 'Cleaning grammar and structure'}
                      </p>
                      <div className="w-full max-w-sm h-2 rounded-full bg-surface-3 overflow-hidden mt-2">
                        <motion.div
                          className="h-full bg-amber rounded-full"
                          initial={{ width: '12%' }}
                          animate={{ width: ['12%', '65%', '88%'] }}
                          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      </div>
                    </motion.div>
                  )}

                  {stage === 'followup' && (
                    <motion.div key="followup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-amber mb-1">
                            Follow-up {round} of 2
                          </p>
                          <h2 className="text-xl font-semibold text-text">One more detail needed</h2>
                        </div>
                        <SpeakButton text={followupQ} language_code={languageCode} />
                      </div>
                      <div className="rounded-2xl bg-amber/5 border-2 border-amber/30 p-5">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber/15 flex items-center justify-center text-amber shrink-0">
                            <MessageCircle size={20} />
                          </div>
                          <p className="text-base text-text leading-relaxed pt-1.5">{followupQ}</p>
                        </div>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wide">Your answer</span>
                        <div className="flex items-start gap-3">
                          <MicBtn listening={listening} transcribing={transcribing} onClick={() => toggleMic('followup')} />
                          <div className="flex-1">
                            <Textarea rows={4} value={followupAnswer} onChange={(e) => setFollowupAnswer(e.target.value)} placeholder="Answer the question…" className="text-base" />
                            {(listening || liveCaption || transcribing) && (
                              <LiveLine listening={listening} liveCaption={liveCaption} transcribing={transcribing} />
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Button variant="amber" size="lg" onClick={submitFollowup} disabled={!followupAnswer.trim() || listening} icon={ArrowRight}>
                          Send answer
                        </Button>
                        <Button variant="ghost" size="lg" onClick={backToEdit}>Edit original tip</Button>
                      </div>
                    </motion.div>
                  )}

                  {stage === 'final' && (
                    <motion.div key="final" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-signal mb-1 flex items-center gap-1.5">
                            <ShieldCheck size={14} /> Combined tip
                          </p>
                          <h2 className="text-xl font-semibold text-text">Review and confirm</h2>
                          <p className="text-sm text-muted mt-1">Edit if you want · listen · then submit</p>
                        </div>
                        <SpeakButton text={finalText} language_code={languageCode} />
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wide flex items-center gap-1.5">
                          <Pencil size={12} /> Your tip
                        </span>
                        <Textarea rows={6} value={finalText} onChange={(e) => setFinalText(e.target.value)} className="text-base" />
                      </div>
                      {mediaPreview && (
                        <div className="rounded-xl overflow-hidden border-2 border-line bg-surface-3 max-h-48">
                          {mediaKind === 'video'
                            ? <video src={mediaPreview} controls className="w-full max-h-48 object-contain" />
                            : (
                              <button type="button" onClick={() => setLightboxSrc(mediaPreview)} className="block w-full" title="View full image">
                                <img src={mediaPreview} alt="Tip photo" className="w-full max-h-48 object-contain cursor-zoom-in hover:opacity-95" />
                              </button>
                            )}
                        </div>
                      )}
                      {submitting && progress > 0 && <ProgressBar value={progress * 100} tone="amber" />}
                      <div className="flex flex-wrap gap-3">
                        <Button variant="amber" size="lg" className="min-w-[200px]" loading={submitting} onClick={confirmSubmit} icon={CheckCircle2}>
                          Confirm & submit
                        </Button>
                        <Button variant="ghost" size="lg" onClick={backToEdit} disabled={submitting}>Start over</Button>
                      </div>
                    </motion.div>
                  )}

                  {stage === 'draft' && (
                    <motion.div key="draft" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                      <div>
                        <h2 className="text-xl font-semibold text-text">Write your tip</h2>
                        <p className="text-[15px] text-muted mt-1.5 leading-relaxed">Speak or type · AI checks before you can submit</p>
                      </div>
                      <Select label="Machine" value={machineId} onChange={(e) => setMachineId(e.target.value)}>
                        {machines.length === 0 && <option value="">No machines assigned</option>}
                        {machines.map((m) => <option key={m} value={m}>{m}</option>)}
                      </Select>
                      <div>
                        <span className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wide">Your tip</span>
                        <div className="flex items-start gap-3">
                          <MicBtn listening={listening} transcribing={transcribing} onClick={() => toggleMic('main')} />
                          <div className="flex-1 min-w-0">
                            <Textarea
                              rows={10}
                              value={text}
                              onChange={(e) => setText(e.target.value)}
                              placeholder="e.g. When the coolant pump hums louder than usual, check the inlet filter first."
                              className="text-base min-h-[220px]"
                            />
                            {(listening || liveCaption || transcribing) && (
                              <LiveLine listening={listening} liveCaption={liveCaption} transcribing={transcribing} />
                            )}
                          </div>
                        </div>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wide">Photo or video (optional)</span>
                        {mediaPreview ? (
                          <div className="relative rounded-xl overflow-hidden border-2 border-line bg-surface-3">
                            {mediaKind === 'video'
                              ? <video src={mediaPreview} controls className="w-full max-h-56 object-contain" />
                              : (
                                <button type="button" onClick={() => setLightboxSrc(mediaPreview)} className="block w-full" title="View full image">
                                  <img src={mediaPreview} alt="Tip photo" className="w-full max-h-56 object-contain cursor-zoom-in hover:opacity-95" />
                                </button>
                              )}
                            <button type="button" onClick={clearMedia} className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/75 text-white flex items-center justify-center">
                              <X size={16} />
                            </button>
                          </div>
                        ) : cameraOpen ? (
                          <div className="relative rounded-xl overflow-hidden border-2 border-line bg-black aspect-video">
                            <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-contain" />
                            <div className="absolute bottom-3 inset-x-0 flex justify-center gap-3 z-10">
                              <button type="button" onClick={stopCamera} className="px-4 py-2 rounded-full text-sm font-semibold bg-black/70 text-white border border-white/30">Cancel</button>
                              {cameraMode === 'photo' ? (
                                <button type="button" onClick={capturePhoto} className="w-14 h-14 rounded-full bg-white border-4 border-amber flex items-center justify-center">
                                  <Camera size={22} className="text-amber" />
                                </button>
                              ) : recording ? (
                                <button type="button" onClick={stopVideoRecord} className="w-14 h-14 rounded-full bg-danger text-white flex items-center justify-center">
                                  <Square size={20} />
                                </button>
                              ) : (
                                <button type="button" onClick={startVideoRecord} className="w-14 h-14 rounded-full bg-danger text-white flex items-center justify-center">
                                  <Circle size={22} fill="currentColor" />
                                </button>
                              )}
                            </div>
                            {recording && (
                              <span className="absolute top-3 left-3 z-10 text-[11px] font-semibold text-white bg-danger px-2.5 py-1 rounded-full flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> REC
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                              { label: 'Upload video', icon: UploadCloud, go: () => { fileRef.current && fileRef.current.setAttribute('accept', 'video/*'); fileRef.current && fileRef.current.click(); } },
                              { label: 'Upload image', icon: ImageIcon, go: () => { fileRef.current && fileRef.current.setAttribute('accept', 'image/*'); fileRef.current && fileRef.current.click(); } },
                              { label: 'Record video', icon: Video, go: () => openCamera('video') },
                              { label: 'Take photo', icon: Camera, go: () => openCamera('photo') },
                            ].map(({ label, icon: Icon, go }) => (
                              <button
                                key={label}
                                type="button"
                                onClick={go}
                                className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 border-line bg-surface-2 text-text font-medium hover:border-amber hover:bg-amber/10 transition-colors"
                              >
                                <Icon size={24} />
                                <span className="text-sm text-center">{label}</span>
                              </button>
                            ))}
                            <input ref={fileRef} type="file" accept="video/*,image/*" onChange={onFilePick} className="hidden" />
                          </div>
                        )}
                      </div>
                      <div className="pt-4 border-t-2 border-line">
                        <Button
                          variant="amber"
                          size="lg"
                          className="w-full sm:w-auto min-w-[220px]"
                          onClick={() => runCheck(text, 1)}
                          disabled={!text.trim() || !machineId || listening}
                          icon={Sparkles}
                        >
                          Check with AI
                        </Button>
                        <p className="text-sm text-muted mt-2">AI must review before you can submit. Up to 2 follow-ups.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </div>

            {tab === 'capture' && stage !== 'done' && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="sv-card border-2 border-line p-6 md:p-8"
              >
                <p className="text-sm font-semibold uppercase tracking-wider text-amber mb-5 flex items-center gap-2">
                  <Sparkles size={16} /> How it works
                </p>
                <div className="grid sm:grid-cols-3 gap-5">
                  {HOW_STEPS.map((s) => {
                    const active =
                      (s.n === 1 && stage === 'draft') ||
                      (s.n === 2 && (stage === 'checking' || stage === 'followup' || stage === 'combining')) ||
                      (s.n === 3 && stage === 'final');
                    const done =
                      (s.n === 1 && stage !== 'draft') ||
                      (s.n === 2 && stage === 'final');
                    return (
                      <div
                        key={s.n}
                        className={'rounded-2xl border-2 p-5 transition-colors ' + (
                          active ? 'border-amber bg-amber/5' :
                          done ? 'border-signal/30 bg-signal/5' :
                          'border-line bg-surface-2'
                        )}
                      >
                        <div
                          className={'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-3 border-2 ' + (
                            active ? 'bg-amber text-white border-amber' :
                            done ? 'bg-signal text-white border-signal' :
                            'bg-surface text-muted border-line'
                          )}
                        >
                          {done && !active ? <CheckCircle2 size={16} /> : s.n}
                        </div>
                        <p className={'text-base font-semibold mb-1.5 ' + (active ? 'text-amber' : done ? 'text-signal' : 'text-text')}>
                          {s.title}
                        </p>
                        <p className="text-[15px] text-muted leading-relaxed">{s.body}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 flex items-start gap-3 rounded-xl bg-surface-2 border border-line p-4">
                  <FileCheck size={18} className="text-signal shrink-0 mt-0.5" />
                  <p className="text-[15px] text-muted leading-relaxed">
                    Use <strong className="text-text">Speak</strong> on AI questions so you can listen on the floor without reading.
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div key="library" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'Shared', n: counts.all },
                  { key: 'approved', label: 'Live', n: counts.approved },
                  { key: 'pending', label: 'In review', n: counts.pending },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setFilter(s.key)}
                    className={'inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 text-sm font-semibold ' + (
                      filter === s.key ? 'bg-amber text-white border-amber' : 'bg-surface border-line text-text hover:border-amber/50'
                    )}
                  >
                    {s.label}
                    <span style={numStyle} className={'min-w-[1.4rem] h-6 px-1.5 rounded-full text-xs font-bold flex items-center justify-center ' + (filter === s.key ? 'bg-white/25' : 'bg-surface-3')}>
                      {s.n}
                    </span>
                  </button>
                ))}
              </div>
              {machineOptions.length > 0 && (
                <select
                  value={machineFilter}
                  onChange={(e) => setMachineFilter(e.target.value)}
                  className="bg-surface-2 border-2 border-line rounded-xl px-4 py-2.5 text-sm font-semibold text-text outline-none focus:border-amber"
                >
                  <option value="all">All machines</option>
                  {machineOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}
            </div>
            <Card className="p-7 md:p-9 border-2 border-line min-h-[480px]">
              {loading ? (
                <FullPageLoader label="Loading tips…" />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  title="No tips yet"
                  description="Capture a tip — AI checks it, then you confirm before review."
                  action={<Button variant="amber" size="lg" onClick={() => setTab('capture')} icon={Plus}>Capture a tip</Button>}
                />
              ) : (
                <div className="space-y-3">
                  {filtered.map((t, i) => (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.25) }}
                      className="rounded-xl border-2 border-line bg-surface-2 p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-surface border border-line">{t.machine_id}</span>
                          {(t.created_at || t.submitted_at || t.timestamp) && (
                            <span className="text-xs font-mono text-muted">
                              {new Date(t.created_at || t.submitted_at || t.timestamp).toLocaleString()}
                            </span>
                          )}
                        </div>
                        {t.status === 'approved'
                          ? <Badge tone="signal"><CheckCircle2 size={11} /> Live</Badge>
                          : <Badge tone="amber"><Clock size={11} /> In review</Badge>}
                      </div>
                      <p className="text-[15px] text-text leading-relaxed">{t.text}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MicBtn({ listening, transcribing, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={transcribing}
      className={'shrink-0 w-14 h-14 rounded-full flex items-center justify-center transition-all ' + (
        listening ? 'bg-danger text-white shadow-lg shadow-danger/25' : 'bg-signal text-white shadow-md shadow-signal/20'
      ) + ' disabled:opacity-60'}
    >
      {transcribing ? <Loader2 size={22} className="animate-spin" /> : listening ? <Square size={18} /> : <Mic size={22} />}
    </button>
  );
}

function LiveLine({ listening, liveCaption, transcribing }) {
  return (
    <div className="mt-2 px-3 py-2.5 rounded-lg bg-surface-2 border-2 border-line text-sm">
      {transcribing ? (
        <span className="text-muted flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Finishing transcript…
        </span>
      ) : listening ? (
        <span>
          <span className="text-danger font-semibold text-xs uppercase tracking-wide mr-2">Live</span>
          {liveCaption || <span className="text-muted">Listening…</span>}
        </span>
      ) : null}

      {/* Full-size image viewer */}
      <AnimatePresence>
        {lightboxSrc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setLightboxSrc(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
          >
            <button
              type="button"
              onClick={() => setLightboxSrc(null)}
              className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 z-10"
              aria-label="Close"
            >
              <X size={22} />
            </button>
            <motion.img
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              src={lightboxSrc}
              alt="Full size"
              className="max-w-full max-h-[88vh] rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}