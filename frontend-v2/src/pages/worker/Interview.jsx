import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic2, PartyPopper, PauseCircle, StopCircle, Sparkles,
  Mic, Square, Loader2, Volume2, Radio, Shield,
  Settings2, CheckCircle2, Play, Video, VideoOff,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { speakSmart, transcribeSmart, defaultLanguage } from '../../lib/voice';
import { Select, Button, Card, ProgressBar, FullPageLoader } from '../../components/ui';
import { useToast } from '../../components/Toast';

/**
 * Internshala-style work interview panel:
 *  Left  = AI interviewer avatar
 *  Right = worker camera (preview only, not recorded)
 *  Bottom = live captions / transcript
 * Stages: lobby → setup → live → done
 */

const SETUP_STEPS = [
  { id: 'topics', label: 'Building topic list for this machine…', icon: Settings2 },
  { id: 'safety', label: 'Loading safety & troubleshooting bank…', icon: Shield },
  { id: 'mic', label: 'Checking microphone…', icon: Mic },
  { id: 'cam', label: 'Starting camera preview…', icon: Video },
  { id: 'ai', label: 'Connecting AI interviewer…', icon: Sparkles },
];

const AI_AVATAR =
  'https://api.dicebear.com/7.x/avataaars/svg?seed=MarcusInterview&backgroundColor=b6e3f4&clothing=blazerAndShirt&clothingColor=262e33&top=shortHairShortFlat&hairColor=2c1b18&facialHair=beardLight&facialHairColor=2c1b18&skinColor=edb98a';

/** Inline fallback if CDN fails — professional male silhouette */
const AI_AVATAR_FALLBACK =
  "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect fill="#dce6f0" width="120" height="120"/><circle cx="60" cy="44" r="22" fill="#c4a484"/><ellipse cx="60" cy="38" rx="22" ry="12" fill="#3d2914"/><rect x="38" y="68" width="44" height="40" rx="8" fill="#2c3e50"/><rect x="48" y="68" width="24" height="12" fill="#e8eef5"/></svg>`);

export default function Interview() {
  const toast = useToast();
  const [machines, setMachines] = useState([]);
  const [machineId, setMachineId] = useState('');
  const [resumable, setResumable] = useState(null);
  const [checking, setChecking] = useState(true);

  const [phase, setPhase] = useState('lobby');
  const [setupStep, setSetupStep] = useState(0);
  const [session, setSession] = useState(null);
  const [currentQ, setCurrentQ] = useState(null);
  const [history, setHistory] = useState([]);
  const [answer, setAnswer] = useState('');
  const [audioBlob, setAudioBlob] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [liveCaption, setLiveCaption] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  /** When mic/camera blocked — stay here and let worker Allow / Retry (do not cancel interview). */
  const [deviceIssue, setDeviceIssue] = useState(null); // { mic: bool, cam: bool, message: string }
  const [deviceBusy, setDeviceBusy] = useState(false);
  const pendingFreshRef = useRef(false);
  /** Page still mounted — false after navigate away so delayed audio/camera cannot start */
  const mountedRef = useRef(true);
  /** Bumps on leave/unmount so in-flight setup is ignored */
  const sessionGenRef = useRef(0);
  const timersRef = useRef([]);

  const clearScheduled = () => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  };

  const schedule = (fn, ms) => {
    const id = setTimeout(() => {
      if (!mountedRef.current) return;
      fn();
    }, ms);
    timersRef.current.push(id);
    return id;
  };

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStreamRef = useRef(null);
  const audioElRef = useRef(null);
  const objectUrlRef = useRef(null);
  const languageRef = useRef(defaultLanguage());
  const browserFinalRef = useRef('');
  const speakJobRef = useRef(null);
  const videoRef = useRef(null);
  const camStreamRef = useRef(null);
  const captionEndRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    api.myMachines()
      .then((r) => {
        if (!mountedRef.current) return;
        setMachines(r.machine_ids || []);
        if (r.machine_ids?.length) setMachineId(r.machine_ids[0]);
      })
      .finally(() => {
        if (mountedRef.current) setChecking(false);
      });
    return () => {
      // Leaving Interview page → hard stop everything (no delayed audio/camera)
      mountedRef.current = false;
      sessionGenRef.current += 1;
      clearScheduled();
      try { recognitionRef.current && recognitionRef.current.stop(); } catch (_) {}
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
      if (audioElRef.current) {
        try {
          audioElRef.current.onended = null;
          audioElRef.current.onerror = null;
          audioElRef.current.pause();
          audioElRef.current.src = '';
        } catch (_) {}
        audioElRef.current = null;
      }
      if (objectUrlRef.current) {
        try { URL.revokeObjectURL(objectUrlRef.current); } catch (_) {}
        objectUrlRef.current = null;
      }
      try { window.speechSynthesis?.cancel(); } catch (_) {}
      if (camStreamRef.current) {
        try { camStreamRef.current.getTracks().forEach((t) => t.stop()); } catch (_) {}
        camStreamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  useEffect(() => {
    if (!machineId) return;
    setSession(null);
    setCurrentQ(null);
    setHistory([]);
    setResumable(null);
    setPhase('lobby');
    stopCamera();
    api.checkInterview(machineId).then(setResumable).catch(() => {});
  }, [machineId]);

  useEffect(() => {
    captionEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, liveCaption, currentQ]);

  /* ---------- Camera (preview only) ---------- */
  const stopCamera = () => {
    if (camStreamRef.current) {
      camStreamRef.current.getTracks().forEach((t) => t.stop());
      camStreamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  };

  const startCamera = async () => {
    stopCamera();
    setCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      camStreamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
      return true;
    } catch (_) {
      setCameraError(true);
      setCameraOn(false);
      return false;
    }
  };

  /** Chrome/Edge permission state: prompt | granted | denied */
  const readPerm = async (name) => {
    try {
      if (!navigator.permissions?.query) return 'unknown';
      const st = await navigator.permissions.query({ name });
      return st?.state || 'unknown';
    } catch {
      return 'unknown';
    }
  };

  /**
   * Always call getUserMedia on the button click.
   * - Permission "Ask" → Chrome shows Allow popup by the URL bar.
   * - Previously "Block" → full popup may not return, but calling getUserMedia
   *   still surfaces the camera/mic icon in the address bar so the user can Allow.
   * Do NOT skip getUserMedia when denied — that blocked any browser UI.
   */
  const requestMicAndCamera = async () => {
    let micOk = false;
    let camOk = false;
    let message = '';

    if (!navigator.mediaDevices?.getUserMedia) {
      return {
        micOk: false,
        camOk: false,
        message: 'This browser cannot access camera/microphone. Use Chrome or Edge.',
      };
    }

    // Always request — this triggers the native popup or the URL-bar media icon
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      audioTracks.forEach((t) => t.stop());
      if (videoTracks.length) {
        const videoOnly = new MediaStream(videoTracks);
        stopCamera();
        camStreamRef.current = videoOnly;
        setCameraOn(true);
        setCameraError(false);
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = videoOnly;
            videoRef.current.play().catch(() => {});
          }
        });
        camOk = true;
      } else {
        camOk = await startCamera();
      }
      micOk = true;
    } catch (_) {
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        mic.getTracks().forEach((t) => t.stop());
        micOk = true;
      } catch (e) {
        micOk = false;
      }
      camOk = await startCamera();
    }

    if (!micOk || !camOk) {
      const micState = await readPerm('microphone');
      const camState = await readPerm('camera');
      if (micState === 'denied' || camState === 'denied') {
        message =
          'Still blocked. Look in the address bar for a camera/mic icon and click it → Allow. Or: lock icon left of the URL → Site settings → Camera & Microphone → Allow, then press Allow & try again.';
      } else {
        message =
          'Choose Allow on the browser popup near the address bar, then press Allow & try again if needed.';
      }
    }

    return { micOk, camOk, message };
  };

  /* ---------- TTS: browser primary → Sarvam fallback ---------- */
  const stopAiAudio = () => {
    try { speakJobRef.current?.stop?.(); } catch (_) {}
    speakJobRef.current = null;
    if (audioElRef.current) {
      try {
        audioElRef.current.onended = null;
        audioElRef.current.onerror = null;
        audioElRef.current.pause();
        audioElRef.current.src = '';
      } catch (_) {}
      audioElRef.current = null;
    }
    if (objectUrlRef.current) {
      try { URL.revokeObjectURL(objectUrlRef.current); } catch (_) {}
      objectUrlRef.current = null;
    }
    try { window.speechSynthesis?.cancel(); } catch (_) {}
    setAiSpeaking(false);
    setAiLoading(false);
  };

  const speakQuestion = useCallback(async (text, lang) => {
    if (!text || !String(text).trim()) return;
    if (!mountedRef.current) return; // left the page — never start audio
    stopAiAudio();
    setAiLoading(true);
    try {
      const job = speakSmart(String(text).trim(), lang || languageRef.current || defaultLanguage());
      speakJobRef.current = job;
      if (!mountedRef.current) {
        try { job.stop?.(); } catch (_) {}
        speakJobRef.current = null;
        return;
      }
      setAiLoading(false);
      setAiSpeaking(true);
      await job;
    } catch (_) {
      if (mountedRef.current) toast.error('Audio failed. You can still read the question.');
    } finally {
      if (mountedRef.current) {
        setAiSpeaking(false);
        setAiLoading(false);
      }
      speakJobRef.current = null;
    }
  }, [toast]);

  /* ---------- Mic + live captions ---------- */
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

  const startListening = async () => {
    if (aiSpeaking || aiLoading) stopAiAudio();
    setLiveCaption('');
    setListening(true);
    // Reset voice buffer; answer is set once from this buffer (no double append)
    browserFinalRef.current = '';
    const lang = languageRef.current || defaultLanguage();
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
          // Accumulate finals once
          browserFinalRef.current = `${browserFinalRef.current} ${finalChunk}`.trim();
          // Replace answer with full accumulated text (never append on top of itself)
          setAnswer(browserFinalRef.current);
        }
        // Live line = committed + interim (display only)
        const live = [browserFinalRef.current, interim].filter(Boolean).join(' ').trim();
        setLiveCaption(live || interim || '…');
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
    const had = !!mediaRecorderRef.current;
    setListening(false);
    setLiveCaption('');
    try { recognitionRef.current && recognitionRef.current.stop(); } catch (_) {}
    recognitionRef.current = null;
    const browserText = (browserFinalRef.current || '').trim();
    browserFinalRef.current = '';

    // Browser already built the full answer once during listening — set once, do not append again
    if (browserText.length >= 2) {
      setAnswer(browserText);
      if (had) {
        try {
          const mr = mediaRecorderRef.current;
          if (mr && mr.state !== 'inactive') {
            await new Promise((resolve) => {
              mr.onstop = () => {
                if (audioStreamRef.current) {
                  audioStreamRef.current.getTracks().forEach((t) => t.stop());
                  audioStreamRef.current = null;
                }
                try {
                  const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                  setAudioBlob(blob);
                } catch (_) {}
                resolve();
              };
              try { mr.stop(); } catch (_) { resolve(); }
            });
          }
        } catch (_) {}
        mediaRecorderRef.current = null;
      }
      return;
    }

    // Fallback only when browser gave no text
    if (!had) return;
    setTranscribing(true);
    await new Promise((resolve) => {
      const mr = mediaRecorderRef.current;
      if (!mr || mr.state === 'inactive') { setTranscribing(false); resolve(); return; }
      mr.onstop = async () => {
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }
        try {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          setAudioBlob(blob);
          const res = await transcribeSmart({
            blob,
            browserText: '',
            languageCode: languageRef.current,
          });
          if (res.transcript) {
            setAnswer(res.transcript.trim()); // replace once
            if (res.language_code) languageRef.current = res.language_code;
          } else {
            toast.error("Couldn't transcribe — you can still type.");
          }
        } catch (_) {
          toast.error("Couldn't transcribe — you can still type.");
        } finally {
          setTranscribing(false);
          resolve();
        }
      };
      try { mr.stop(); } catch (_) { setTranscribing(false); resolve(); }
    });
    mediaRecorderRef.current = null;
  };

  const toggleMic = () => {
    if (listening) finishListening();
    else startListening();
  };

  /* ---------- Session ---------- */
  const beginInterviewSession = async (fresh) => {
    const gen = sessionGenRef.current;
    const res = await api.startInterview(machineId, languageRef.current || 'en-IN', fresh);
    // User left the page while API was in flight — do not enter live or play audio
    if (!mountedRef.current || gen !== sessionGenRef.current) return;

    setSetupStep(SETUP_STEPS.length - 1);
    await new Promise((r) => {
      const id = setTimeout(r, 350);
      timersRef.current.push(id);
    });
    if (!mountedRef.current || gen !== sessionGenRef.current) return;

    setSession(res);
    if (res.language_code) languageRef.current = res.language_code;

    const hist = [];
    if (res.resumed) {
      try {
        const t = await api.interviewTranscript(res.session_id);
        (t.turns || []).forEach((turn) => {
          hist.push({ role: 'q', text: turn.question_text, topic: turn.topic_title });
          hist.push({ role: 'a', text: turn.answer_text });
        });
      } catch (_) {}
    }
    if (!mountedRef.current || gen !== sessionGenRef.current) return;
    setHistory(hist);
    setDeviceIssue(null);

    if (res.current_question) {
      const q = {
        text: res.current_question,
        topic: res.topic_title,
        followup: !!res.is_followup,
      };
      setCurrentQ(q);
      setPhase('live');
      schedule(() => {
        if (camStreamRef.current && videoRef.current) {
          videoRef.current.srcObject = camStreamRef.current;
          videoRef.current.play().catch(() => {});
        } else {
          startCamera();
        }
      }, 100);
      if (autoPlay) {
        schedule(() => speakQuestion(q.text, languageRef.current), 600);
      }
    } else if (res.completed) {
      stopCamera();
      setPhase('done');
    } else {
      setPhase('live');
      schedule(() => startCamera(), 100);
    }
  };

  const runSetupThenStart = async (fresh) => {
    if (!machineId) {
      toast.error('Select a machine first.');
      return;
    }
    pendingFreshRef.current = !!fresh;
    setDeviceIssue(null);
    setDeviceBusy(true);
    try {
      // Request media FIRST (same click) so the URL-bar Allow popup can show
      const { micOk, camOk, message } = await requestMicAndCamera();
      if (!micOk || !camOk) {
        setDeviceIssue({
          mic: micOk,
          cam: camOk,
          message: message || 'Allow camera and microphone when the browser asks near the address bar.',
        });
        setPhase('permissions');
        return;
      }

      if (!mountedRef.current) return;
      setPhase('setup');
      setSetupStep(0);
      SETUP_STEPS.forEach((_, i) => schedule(() => setSetupStep(i), i * 500));
      setSetupStep(SETUP_STEPS.length - 1);
      await beginInterviewSession(fresh);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not start the interview.');
      setPhase('lobby');
      stopCamera();
    } finally {
      setDeviceBusy(false);
    }
  };

  /** Worker taps Allow / Try again — must call getUserMedia in this click to show browser popup */
  const retryDevicesAndStart = async () => {
    setDeviceBusy(true);
    try {
      const { micOk, camOk, message } = await requestMicAndCamera();
      if (!micOk || !camOk) {
        setDeviceIssue({
          mic: micOk,
          cam: camOk,
          message:
            message ||
            'Still blocked. Click the lock icon left of the URL → Site settings → Camera & Microphone → Allow, then try again.',
        });
        return;
      }
      setDeviceIssue(null);
      setPhase('setup');
      setSetupStep(SETUP_STEPS.length - 1);
      await beginInterviewSession(pendingFreshRef.current);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not start the interview.');
      setPhase('permissions');
    } finally {
      setDeviceBusy(false);
    }
  };

  const backToLobbyFromPermissions = () => {
    setDeviceIssue(null);
    stopCamera();
    setPhase('lobby');
  };

  const submitAnswer = async () => {
    if (!answer.trim() || !session || submitting) return;
    if (listening) await finishListening();
    stopAiAudio();

    const text = answer.trim();
    const blob = audioBlob;
    setHistory((h) => [
      ...h,
      ...(currentQ ? [{ role: 'q', text: currentQ.text, topic: currentQ.topic }] : []),
      { role: 'a', text },
    ]);
    setAnswer('');
    setAudioBlob(null);
    setCurrentQ(null);
    setSubmitting(true);

    try {
      const res = await api.submitInterviewAnswer(
        session.session_id,
        text,
        languageRef.current || session.language_code || 'en-IN',
        blob,
      );
      setSession(res);
      if (res.completed) {
        stopCamera();
        setPhase('done');
      } else if (res.current_question) {
        const q = {
          text: res.current_question,
          topic: res.topic_title,
          followup: !!res.is_followup,
          insight: res.insight_captured,
        };
        setCurrentQ(q);
        if (autoPlay) schedule(() => speakQuestion(q.text, languageRef.current), 450);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not submit that answer.');
    } finally {
      setSubmitting(false);
    }
  };

  const pause = async () => {
    if (!session) return;
    stopListening();
    stopAiAudio();
    stopCamera();
    try {
      await api.pauseInterview(session.session_id);
      toast.info('Paused. Come back anytime to continue.');
    } catch (_) {}
    setSession(null);
    setCurrentQ(null);
    setHistory([]);
    setPhase('lobby');
    api.checkInterview(machineId).then(setResumable).catch(() => {});
  };

  const end = async () => {
    if (!session) return;
    stopListening();
    stopAiAudio();
    stopCamera();
    try {
      await api.endInterview(session.session_id);
    } catch (_) {}
    setPhase('done');
  };

  const resetToLobby = () => {
    stopCamera();
    setSession(null);
    setCurrentQ(null);
    setHistory([]);
    setAnswer('');
    setPhase('lobby');
    api.checkInterview(machineId).then(setResumable).catch(() => {});
  };

  if (checking) return <FullPageLoader label="Loading interview…" />;

  /* ========== PERMISSIONS (mic/camera blocked — give worker a chance to Allow) ========== */
  if (phase === 'permissions') {
    const micOk = deviceIssue?.mic;
    const camOk = deviceIssue?.cam;
    return (
      <div className="max-w-lg mx-auto py-10">
        <Card className="p-8 md:p-10 border-2 border-line">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-amber/15 border-2 border-amber/35 flex items-center justify-center text-amber">
            <Video size={28} />
          </div>
          <h1 className="text-2xl font-semibold text-center mb-2">Allow camera & microphone</h1>
          <p className="text-[15px] text-muted text-center leading-relaxed mb-6">
            The interview room needs both. Your camera is <strong className="text-text">for preview </strong> .
            Voice answers use the microphone.
          </p>

          <div className="space-y-3 mb-6">
            <div className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${micOk ? 'border-signal/40 bg-signal/5' : 'border-danger/40 bg-danger/5'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${micOk ? 'bg-signal text-white' : 'bg-danger/15 text-danger'}`}>
                {micOk ? <CheckCircle2 size={18} /> : <Mic size={18} />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">Microphone</p>
                <p className="text-xs text-muted">{micOk ? 'Ready' : 'Not allowed yet — use Allow below'}</p>
              </div>
            </div>
            <div className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${camOk ? 'border-signal/40 bg-signal/5' : 'border-danger/40 bg-danger/5'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${camOk ? 'bg-signal text-white' : 'bg-danger/15 text-danger'}`}>
                {camOk ? <CheckCircle2 size={18} /> : <VideoOff size={18} />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">Camera</p>
                <p className="text-xs text-muted">{camOk ? 'Ready' : 'Not allowed yet — use Allow below'}</p>
              </div>
            </div>
          </div>

          {deviceIssue?.message && (
            <p className="text-sm text-muted leading-relaxed mb-6 rounded-xl bg-surface-2 border border-line px-4 py-3">
              {deviceIssue.message}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="amber"
              size="lg"
              className="flex-1"
              loading={deviceBusy}
              onClick={retryDevicesAndStart}
              icon={Video}
            >
              Allow & try again
            </Button>
            <Button variant="ghost" size="lg" className="flex-1" disabled={deviceBusy} onClick={backToLobbyFromPermissions}>
              Back to lobby
            </Button>
          </div>
          <p className="text-xs text-muted text-center mt-4 leading-relaxed">
            If the browser does not ask again, open the lock icon in the address bar → Site settings → set Camera and Microphone to Allow.
          </p>
        </Card>
      </div>
    );
  }

  /* ========== SETUP ========== */
  if (phase === 'setup') {
    return (
      <div className="max-w-lg mx-auto py-10">
        <Card className="p-8 md:p-10 border-2 border-line text-center">
          <motion.div
            className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber/15 border-2 border-amber/40 flex items-center justify-center"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          >
            <Radio size={32} className="text-amber" />
          </motion.div>
          <h1 className="text-2xl font-semibold mb-2">Setting up interview room</h1>
          <p className="text-sm text-muted mb-8">
            Preparing session for <span className="font-semibold text-text">{machineId}</span>
          </p>
          <div className="space-y-3 text-left max-w-sm mx-auto">
            {SETUP_STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = i === setupStep;
              const done = i < setupStep;
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 ${
                    active ? 'border-amber bg-amber/10' :
                    done ? 'border-signal/30 bg-signal/5' :
                    'border-line bg-surface-2 opacity-50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    active ? 'bg-amber text-white' :
                    done ? 'bg-signal text-white' :
                    'bg-surface-3 text-muted'
                  }`}>
                    {done ? <CheckCircle2 size={16} /> : active ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
                  </div>
                  <span className={`text-sm ${active ? 'font-semibold text-text' : done ? 'text-signal' : 'text-muted'}`}>
                    {s.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }

  /* ========== DONE ========== */
  if (phase === 'done') {
    return (
      <div className="max-w-lg mx-auto py-10">
        <Card className="p-10 border-2 border-line text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-signal/15 border-2 border-signal/40 flex items-center justify-center text-signal">
            <PartyPopper size={28} />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Interview complete</h1>
          <p className="text-sm text-muted mb-2">
            {session?.insights_captured != null
              ? `${session.insights_captured} insight${session.insights_captured !== 1 ? 's' : ''} captured for review.`
              : 'Your answers are saved for supervisor review.'}
          </p>
          <p className="text-xs text-muted mb-8">Nothing goes live until a supervisor approves it.</p>
          <Button variant="amber" size="lg" onClick={resetToLobby}>Back to lobby</Button>
        </Card>
      </div>
    );
  }

  /* ========== LIVE — Internshala-style panel ========== */
  if (phase === 'live' && session) {
    const progress = ((session.topic_index || 0) / Math.max(1, session.total_topics || 1)) * 100;

    return (
      <div
        className="max-w-5xl mx-auto w-full rounded-3xl p-4 sm:p-6"
        style={{
          background: 'linear-gradient(180deg, #efe8dc 0%, #e8dfd2 45%, #e3d9cb 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(28,25,23,0.06)',
        }}
      >
        {/* Top chrome */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber">Live interview</p>
            <h1 className="text-lg font-semibold text-text">
              Topic {(session.topic_index || 0) + 1}/{session.total_topics || '—'}
              {session.topic_title ? ` · ${session.topic_title}` : ''}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-signal/15 text-signal border border-signal/30">
              {session.insights_captured || 0} insights
            </span>
            <Button variant="ghost" size="sm" onClick={pause} icon={PauseCircle}>Pause</Button>
            <Button variant="ghost" size="sm" onClick={end} icon={StopCircle}>End</Button>
          </div>
        </div>
        <ProgressBar value={progress} tone="amber" className="mb-4" />

        {/* Dual video panel */}
        <div className="rounded-2xl border-2 border-line bg-[#1a1d23] overflow-hidden shadow-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 min-h-[300px] sm:min-h-[360px]">
            {/* LEFT — AI interviewer */}
            <div className={`relative flex flex-col items-center justify-center p-6 border-b sm:border-b-0 sm:border-r border-white/10 ${
              aiSpeaking || aiLoading ? 'bg-[#1e2a38]' : 'bg-[#1a1d23]'
            }`}>
              {(aiSpeaking || aiLoading) && (
                <motion.div
                  className="absolute inset-3 rounded-xl border-2 border-sky-400/70 pointer-events-none"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
              <motion.div
                className="relative"
                animate={aiSpeaking ? { scale: [1, 1.04, 1] } : {}}
                transition={{ duration: 1, repeat: aiSpeaking ? Infinity : 0 }}
              >
                <div className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden border-4 ${
                  aiSpeaking || aiLoading ? 'border-sky-400 shadow-lg shadow-sky-400/30' : 'border-white/20'
                } bg-white`}>
                  <img
                    src={AI_AVATAR}
                    alt="AI Interviewer"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      if (e.currentTarget.src !== AI_AVATAR_FALLBACK) {
                        e.currentTarget.src = AI_AVATAR_FALLBACK;
                      }
                    }}
                  />
                </div>
                {aiSpeaking && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {[0, 1, 2, 3].map((i) => (
                      <motion.span
                        key={i}
                        className="w-1 bg-sky-400 rounded-full"
                        animate={{ height: [6, 16, 6] }}
                        transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }}
                      />
                    ))}
                  </span>
                )}
              </motion.div>
              <p className="mt-4 text-sm font-semibold text-white">Interviewer (Ira)</p>
              <p className="text-xs text-white/50">
                {aiLoading ? 'Preparing audio…' : aiSpeaking ? 'Speaking…' : 'Listening'}
              </p>
            </div>

            {/* RIGHT — Worker camera */}
            <div className="relative bg-[#12151a] flex items-center justify-center min-h-[220px]">
              {cameraOn ? (
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  autoPlay
                  className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                />
              ) : (
                <div className="text-center px-4">
                  <VideoOff size={36} className="text-white/30 mx-auto mb-2" />
                  <p className="text-sm text-white/50">
                    {cameraError ? 'Camera unavailable' : 'Starting camera…'}
                  </p>
                  {cameraError && (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="mt-3 text-xs font-semibold text-sky-400 hover:underline"
                    >
                      Retry camera
                    </button>
                  )}
                </div>
              )}
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 text-white text-[11px] font-semibold">
                <span className={`w-1.5 h-1.5 rounded-full ${cameraOn ? 'bg-red-500 animate-pulse' : 'bg-white/40'}`} />
                {cameraOn ? 'On' : 'Off'}
              </div>
              <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-black/55 text-white text-xs font-medium">
                You
              </div>
            </div>
          </div>

          {/* Bottom caption / transcript strip */}
          <div className="bg-[#0f1218] border-t border-white/10 px-4 py-3 max-h-[140px] overflow-y-auto">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">Live transcript</p>
            <div className="space-y-2 text-sm">
              {history.slice(-6).map((h, i) => (
                <p key={i} className={h.role === 'q' ? 'text-sky-300/90' : 'text-white/80'}>
                  <span className="font-semibold text-[11px] uppercase tracking-wide opacity-70 mr-1.5">
                    {h.role === 'q' ? 'Ira' : 'You'}:
                  </span>
                  {h.text}
                </p>
              ))}
              {currentQ && (
                <p className="text-sky-300">
                  <span className="font-semibold text-[11px] uppercase tracking-wide opacity-70 mr-1.5">Ira:</span>
                  {currentQ.text}
                </p>
              )}
              {listening && (
                <p className="text-amber-300/90">
                  <span className="font-semibold text-[11px] uppercase tracking-wide mr-1.5">You (live):</span>
                  {liveCaption || '…'}
                </p>
              )}
              {!currentQ && submitting && (
                <p className="text-white/40 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Preparing next question…
                </p>
              )}
              <div ref={captionEndRef} />
            </div>
          </div>
        </div>

        {/* Controls under the panel */}
        <div className="mt-5 rounded-2xl border-2 border-line bg-[#f7f1e8] p-5">
          {currentQ && (
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  if (aiSpeaking) stopAiAudio();
                  else speakQuestion(currentQ.text, languageRef.current);
                }}
                disabled={aiLoading}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                  aiSpeaking
                    ? 'bg-amber text-white border-amber'
                    : 'bg-amber/10 text-amber border-amber/40 hover:bg-amber hover:text-white'
                } disabled:opacity-50`}
              >
                {aiLoading ? <Loader2 size={16} className="animate-spin" /> : aiSpeaking ? <Square size={14} /> : <Volume2 size={16} />}
                {aiLoading ? 'Loading…' : aiSpeaking ? 'Stop' : 'Play question'}
              </button>
              {!aiSpeaking && !aiLoading && (
                <button
                  type="button"
                  onClick={() => speakQuestion(currentQ.text, languageRef.current)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 border-line hover:border-amber hover:text-amber"
                >
                  <Play size={14} /> Replay
                </button>
              )}
              {!cameraOn && (
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 border-line hover:border-signal hover:text-signal"
                >
                  <Video size={14} /> Turn camera on
                </button>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              type="button"
              onClick={toggleMic}
              disabled={submitting || transcribing || aiSpeaking || aiLoading || !currentQ}
              className={`w-18 h-18 sm:w-20 sm:h-20 shrink-0 rounded-full flex items-center justify-center shadow-lg transition-all disabled:opacity-40 ${
                listening ? 'bg-danger text-white shadow-danger/30' : 'bg-signal text-white shadow-signal/25 hover:scale-105'
              }`}
              style={{ width: 72, height: 72 }}
            >
              {transcribing ? <Loader2 size={28} className="animate-spin" /> : listening ? <Square size={24} /> : <Mic size={28} />}
            </button>
            <div className="flex-1 w-full min-w-0">
              <textarea
                rows={2}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={listening ? 'Speaking… captions appear above' : 'Answer appears here after you speak (or type)'}
                className="w-full rounded-xl border-2 border-line bg-surface-2 px-4 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:border-amber resize-none"
                disabled={submitting || !currentQ}
              />
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <Button
                  variant="amber"
                  size="lg"
                  onClick={submitAnswer}
                  disabled={!answer.trim() || listening || transcribing || submitting || !currentQ}
                  loading={submitting}
                >
                  Submit answer
                </Button>
                <label className="inline-flex items-center gap-2 text-xs text-muted cursor-pointer">
                  <input type="checkbox" checked={autoPlay} onChange={(e) => setAutoPlay(e.target.checked)} />
                  Auto-play next question
                </label>
                <span className="text-xs text-muted">
                  {listening ? 'Tap mic to stop' : transcribing ? 'Transcribing…' : 'Tap mic to answer'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ========== LOBBY ========== */
  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber mb-1">Tacit knowledge</p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-text">Work interview</h1>
        <p className="text-[15px] sm:text-base text-muted mt-2 leading-relaxed max-w-2xl">
          Video-style panel · AI asks out loud · you answer by voice with live captions.
          Knowledge is distilled into tips for supervisor review — nothing goes live until approved.
        </p>
      </div>

      {machines.length === 0 ? (
        <Card className="p-10 border-2 border-line text-center text-muted text-[15px]">
          No machine assigned yet. Ask a supervisor to assign one.
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="p-8 md:p-10 border-2 border-line">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-2xl bg-amber/15 border-2 border-amber/30 flex items-center justify-center text-amber shrink-0">
                <Mic2 size={28} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-text mb-1">Interview room</h2>
                <p className="text-[15px] text-muted leading-relaxed">
                  Left: AI interviewer · Right: your camera (for preview).
                </p>
              </div>
            </div>

            <div className="mb-6">
              <Select label="Machine" value={machineId} onChange={(e) => setMachineId(e.target.value)}>
                {machines.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              {[
                { n: '1', t: 'Listen', d: 'AI speaks the question out loud so you can work hands-free.' },
                { n: '2', t: 'Answer', d: 'Talk into the mic — live captions appear as you speak.' },
                { n: '3', t: 'Continue', d: 'Move to the next topic or a short follow-up when needed.' },
              ].map((s) => (
                <div key={s.n} className="rounded-2xl border-2 border-line bg-surface-2 p-5 text-left">
                  <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-amber text-white text-sm font-bold mb-3">{s.n}</span>
                  <p className="text-base font-semibold text-text">{s.t}</p>
                  <p className="text-[15px] text-muted mt-1.5 leading-relaxed">{s.d}</p>
                </div>
              ))}
            </div>

            {resumable?.resumable ? (
              <div className="rounded-2xl border-2 border-amber/30 bg-amber/5 p-5">
                <h3 className="text-base font-semibold mb-1">Continue where you left off?</h3>
                <p className="text-[15px] text-muted mb-4 leading-relaxed">
                  Topic {(resumable.topic_index || 0) + 1} of {resumable.total_topics}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button variant="amber" size="lg" onClick={() => runSetupThenStart(false)} icon={Play}>Continue</Button>
                  <Button variant="ghost" size="lg" onClick={() => runSetupThenStart(true)}>Start fresh</Button>
                </div>
              </div>
            ) : (
              <Button variant="amber" size="lg" className="min-w-[220px]" onClick={() => runSetupThenStart(false)} icon={Sparkles}>
                Start interview
              </Button>
            )}
          </Card>

          {/* Tutorial / guidance to fill empty space */}
          <Card className="p-6 md:p-8 border-2 border-line">
            <h3 className="font-display text-xl font-bold mb-4">Before you start</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { t: 'Quiet space helps', d: 'Background noise can hurt captions. Pause if someone interrupts — you can resume later.' },
                { t: 'Camera is preview only', d: 'Your face is never recorded. Only voice answers are saved for admin review when useful.' },
                { t: 'Answer in your words', d: 'Short practical answers beat long theory. Talk like you would train a new joinee.' },
                { t: 'Supervisor reviews first', d: 'Insights become pending tips. Nothing is searchable in Ask AI until approved.' },
              ].map((x) => (
                <div key={x.t} className="rounded-xl border border-line bg-surface-2 p-4">
                  <p className="text-base font-semibold text-text mb-1">{x.t}</p>
                  <p className="text-[15px] text-muted leading-relaxed">{x.d}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}