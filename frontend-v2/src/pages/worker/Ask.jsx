import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Sparkles, Factory, Video, Mic, Square, Loader2,
  Volume2, BookOpen, User, Bot, Image as ImageIcon, X, Paperclip, Camera, Pause, Play,
} from 'lucide-react';
import { api, mediaUrl, ApiError } from '../../lib/api';
import { getWorkerId, clearAskChatStorage } from '../../lib/auth';
import { Select, EmptyState, Button, Card } from '../../components/ui';
import { useToast } from '../../components/Toast';

/**
 * Ask AI — warm chat experience with live captions on mic input.
 */

export default function Ask() {
  const toast = useToast();
  const [machines, setMachines] = useState([]);
  const [machineId, setMachineId] = useState('');
  const [question, setQuestion] = useState('');
  const textareaRef = useRef(null);
  // Per-worker + per-machine threads for this browser tab session only
  const workerId = getWorkerId() || '';
  const [thread, setThread] = useState([]);
  const [asking, setAsking] = useState(false);
  const [askElapsed, setAskElapsed] = useState(0);
  const askTimerRef = useRef(null);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const threadsByMachineRef = useRef({});
  const activeMachineRef = useRef('');
  const ownerRef = useRef(workerId);

  // ChatGPT-style: grow the box with content, then scroll inside
  const resizeComposer = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = 160; // ~6–7 lines, then scrollbar
    const next = Math.min(el.scrollHeight, max);
    el.style.height = `${Math.max(44, next)}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    resizeComposer();
  }, [question, resizeComposer]);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const imageInputRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const [listening, setListening] = useState(false);
  const [liveCaption, setLiveCaption] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [speakState, setSpeakState] = useState('idle'); // idle | playing | paused

  const endRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStreamRef = useRef(null);
  const audioElRef = useRef(null);
  const languageRef = useRef(
    (typeof navigator !== 'undefined' && navigator.language) || 'en-IN'
  );
  // Browser STT final text for this recording (primary); Sarvam is fallback only
  const browserFinalRef = useRef('');
  const browserGotResultRef = useRef(false);
  // Snapshot of whatever was already in the textbox before this recording started —
  // every live update recomputes base + transcript from scratch, so nothing gets
  // appended twice (once live, once again at stop).
  const baseTextRef = useRef('');
  // Bumps on stop so in-flight speakText does not start Sarvam after cancel
  const speakGenRef = useRef(0);

  // Load machines + restore THIS worker's per-machine threads (never another worker's)
  useEffect(() => {
    const wid = getWorkerId() || '';
    // If account changed in this tab, wipe any leftover ask cache
    try {
      const owner = sessionStorage.getItem('sv_ask_owner');
      if (owner && owner !== wid) {
        clearAskChatStorage();
      }
      if (wid) sessionStorage.setItem('sv_ask_owner', wid);
    } catch (_) {}

    ownerRef.current = wid;
    threadsByMachineRef.current = {};
    try {
      const raw = sessionStorage.getItem(`sv_ask_map_${wid}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') threadsByMachineRef.current = parsed;
      }
    } catch (_) {}

    api.myMachines()
      .then((r) => {
        const ids = r.machine_ids || [];
        setMachines(ids);
        const first = ids[0] || '';
        setMachineId(first);
        activeMachineRef.current = first;
        setThread(Array.isArray(threadsByMachineRef.current[first])
          ? threadsByMachineRef.current[first]
          : []);
      })
      .catch(() => {});
  }, []);

  // When machine changes: save current thread under old machine, load the other
  useEffect(() => {
    if (!machineId) return;
    const prev = activeMachineRef.current;
    if (prev && prev !== machineId) {
      threadsByMachineRef.current[prev] = thread.slice(-40);
    }
    activeMachineRef.current = machineId;
    const next = threadsByMachineRef.current[machineId];
    setThread(Array.isArray(next) ? next : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only switch on machineId
  }, [machineId]);

  // Persist current worker map whenever thread changes
  useEffect(() => {
    const wid = getWorkerId() || ownerRef.current;
    if (!wid || !machineId) return;
    threadsByMachineRef.current[machineId] = thread.slice(-40);
    try {
      sessionStorage.setItem(`sv_ask_map_${wid}`, JSON.stringify(threadsByMachineRef.current));
      sessionStorage.setItem('sv_ask_owner', wid);
    } catch (_) {}
  }, [thread, machineId]);

  // HARD stop all audio / mic / camera when leaving Ask (fixes ghost TTS after navigate)
  useEffect(() => {
    const hardStop = () => {
      try { speakGenRef.current += 1; } catch (_) {}
      try { window.speechSynthesis?.cancel(); } catch (_) {}
      try {
        if (audioElRef.current) {
          if (!audioElRef.current._browser) {
            try { audioElRef.current.pause?.(); } catch (_) {}
            try { audioElRef.current.src = ''; } catch (_) {}
          }
          audioElRef.current = null;
        }
      } catch (_) {}
      try {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
          recognitionRef.current = null;
        }
      } catch (_) {}
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
      } catch (_) {}
      try {
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }
      } catch (_) {}
      try {
        if (cameraStreamRef.current) {
          cameraStreamRef.current.getTracks().forEach((t) => t.stop());
          cameraStreamRef.current = null;
        }
      } catch (_) {}
      setSpeakingId(null);
      setSpeakState('idle');
      setListening(false);
      setCameraOpen(false);
    };
    const onVis = () => { if (document.hidden) hardStop(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', hardStop);
    return () => {
      hardStop();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', hardStop);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread, asking, liveCaption]);

  const stopSpeak = () => {
    // Invalidate any in-flight speakText so browser cancel does NOT fall through to Sarvam
    speakGenRef.current += 1;
    try { window.speechSynthesis?.cancel(); } catch (_) {}
    if (audioElRef.current) {
      try {
        if (audioElRef.current._browser) {
          try { window.speechSynthesis?.cancel(); } catch (_) {}
        } else {
          audioElRef.current.pause();
          audioElRef.current.src = '';
        }
      } catch (_) {}
      audioElRef.current = null;
    }
    setSpeakingId(null);
    setSpeakState('idle');
  };

  const pauseSpeak = () => {
    const a = audioElRef.current;
    if (!a) return;
    try {
      if (a._browser) {
        window.speechSynthesis?.pause();
      } else if (!a.paused) {
        a.pause();
      }
      setSpeakState('paused');
    } catch (_) {}
  };

  const resumeSpeak = async () => {
    const a = audioElRef.current;
    if (!a) return;
    try {
      if (a._browser) {
        window.speechSynthesis?.resume();
      } else if (a.paused) {
        await a.play();
      }
      setSpeakState('playing');
    } catch (_) {
      toast.error('Could not resume audio.');
    }
  };

  /**
   * TTS policy:
   *  1. PRIMARY — browser speechSynthesis
   *  2. FALLBACK — Sarvam /speak
   * Stop/cancel must NOT trigger Sarvam (that was the bug).
   */
  const speakWithBrowser = (text) =>
    new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        reject(new Error('no speechSynthesis'));
        return;
      }
      try { window.speechSynthesis.cancel(); } catch (_) {}
      const u = new SpeechSynthesisUtterance(text);
      const lang = languageRef.current || navigator.language || 'en-IN';
      u.lang = lang;
      u.onend = () => resolve({ status: 'ended' });
      u.onerror = (e) => {
        const err = (e && e.error) || '';
        // User hit Stop, or another utterance replaced this one — not a real failure
        if (err === 'interrupted' || err === 'canceled' || err === 'cancelled') {
          resolve({ status: 'stopped' });
          return;
        }
        reject(new Error(err || 'tts error'));
      };
      audioElRef.current = {
        pause: () => { try { window.speechSynthesis.pause(); } catch (_) {} },
        play: () => { try { window.speechSynthesis.resume(); } catch (_) {} },
        get paused() {
          try { return window.speechSynthesis.paused; } catch (_) { return false; }
        },
        src: '',
        _browser: true,
        _utterance: u,
      };
      window.speechSynthesis.speak(u);
    });

  const speakWithSarvam = async (text, gen) => {
    const result = await api.speak(text.trim(), languageRef.current || 'en-IN');
    // User may have stopped while waiting for Sarvam response
    if (gen !== speakGenRef.current) return { status: 'stopped' };
    const blob = result?.blob || result;
    if (!blob || !(blob instanceof Blob)) throw new Error('no audio');
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioElRef.current = audio;
    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve({ status: 'ended' });
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('audio error'));
      };
      audio.play().then(() => {
        if (gen !== speakGenRef.current) {
          try {
            audio.pause();
            audio.src = '';
          } catch (_) {}
          URL.revokeObjectURL(url);
          resolve({ status: 'stopped' });
        }
      }).catch(reject);
    });
  };

  const speakText = async (text, id) => {
    if (!text?.trim()) return;
    stopSpeak(); // bumps gen + clears previous audio
    const gen = speakGenRef.current;
    setSpeakingId(id);
    setSpeakState('playing');
    try {
      let outcome;
      try {
        outcome = await speakWithBrowser(text.trim());
      } catch (_) {
        // Real browser failure only — not user stop
        if (gen !== speakGenRef.current) {
          setSpeakingId(null);
          setSpeakState('idle');
          return;
        }
        outcome = await speakWithSarvam(text.trim(), gen);
      }
      // If user stopped during browser play, do NOT start Sarvam
      if (!outcome || outcome.status === 'stopped' || gen !== speakGenRef.current) {
        setSpeakingId(null);
        setSpeakState('idle');
        return;
      }
      setSpeakingId(null);
      setSpeakState('idle');
    } catch (_) {
      if (gen === speakGenRef.current) {
        setSpeakingId(null);
        setSpeakState('idle');
        toast.error('Could not play audio.');
      }
    }
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

  /**
   * Voice STT policy (foreign clients + Indian languages):
   *  1. PRIMARY — browser Web Speech API (Chrome/Edge etc.) — supports FR, DE, ES, …
   *  2. FALLBACK — Sarvam STT on the recorded blob (strong on Indian languages)
   * Browser is preferred because Sarvam does not cover many non-Indian languages.
   */
  const startListening = async () => {
    setLiveCaption('');
    setListening(true);
    browserFinalRef.current = '';
    browserGotResultRef.current = false;
    // Snapshot whatever is already typed so we can rebuild "base + transcript"
    // fresh on every result, instead of appending onto a value that may already
    // include part of this recording (which is what caused the duplicate text).
    baseTextRef.current = question.trim();
    const lang = languageRef.current || navigator.language || 'en-IN';
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const rec = new SR();
      recognitionRef.current = rec;
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = lang;
      // Tracks the highest finalized result index we've already used —
      // Chrome can re-emit already-finalized results after an internal restart.
      const lastFinalIndexRef = { current: -1 };
      rec.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) {
            if (i <= lastFinalIndexRef.current) continue;
            lastFinalIndexRef.current = i;
            browserGotResultRef.current = true;
            // Accumulate ALL final chunks for this recording in one place …
            browserFinalRef.current = `${browserFinalRef.current} ${r[0].transcript}`.trim();
          } else {
            interim += r[0].transcript;
          }
        }
        // … then rebuild the textbox value from the snapshot every time —
        // never append on top of the live state, so there is nothing to duplicate.
        const combined = baseTextRef.current
          ? `${baseTextRef.current} ${browserFinalRef.current}`.trim()
          : browserFinalRef.current;
        setQuestion(combined);
        setLiveCaption(interim);
      };
      rec.onerror = () => {};
      try { rec.start(); } catch (_) {}
    }
    // Always record a blob so Sarvam can run if browser STT is weak / missing
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
    // Primary path: browser already produced usable final text.
    // The textbox was already kept in sync on every onresult event (base +
    // transcript, recomputed fresh each time) — so there is nothing to
    // append here. Re-appending here was what caused the duplicate text.
    if (browserText.length >= 2) {
      // Still stop recorder to release mic; skip Sarvam
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
                resolve();
              };
              try { mr.stop(); } catch (_) { resolve(); }
            });
          }
        } catch (_) {}
        mediaRecorderRef.current = null;
      }
      browserFinalRef.current = '';
      return;
    }

    // Fallback: no solid browser transcript → Sarvam STT
    if (!had) {
      if (!browserGotResultRef.current) {
        toast.error("Couldn't hear that — try again or type.");
      }
      return;
    }
    setTranscribing(true);
    await new Promise((resolve) => {
      const mr = mediaRecorderRef.current;
      if (!mr || mr.state === 'inactive') {
        setTranscribing(false);
        resolve();
        return;
      }
      mr.onstop = async () => {
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }
        try {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (blob.size > 500) {
            const res = await api.transcribe(blob);
            if (res?.transcript) {
              const next = res.transcript.trim();
              const combined = baseTextRef.current
                ? `${baseTextRef.current} ${next}`.trim()
                : next;
              setQuestion(combined);
              if (res.language_code) languageRef.current = res.language_code;
            } else {
              toast.error("Couldn't transcribe — try typing.");
            }
          } else {
            toast.error("Couldn't hear that — try again or type.");
          }
        } catch (_) {
          toast.error("Couldn't transcribe — try typing.");
        } finally {
          setTranscribing(false);
          resolve();
        }
      };
      try { mr.stop(); } catch (_) {
        setTranscribing(false);
        resolve();
      }
    });
    mediaRecorderRef.current = null;
    browserFinalRef.current = '';
  };

  const toggleMic = () => {
    if (listening) finishListening();
    else startListening();
  };

  // revoke=true when user removes the draft photo.
  // After send we keep the blob URL so the chat bubble can still show the image.
  const clearImage = (revoke = true) => {
    if (revoke && imagePreview) {
      try { URL.revokeObjectURL(imagePreview); } catch (_) {}
    }
    setImageFile(null);
    setImagePreview(null);
  };

  const onImagePick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast.error('Please choose an image file (JPEG, PNG, WebP).');
      e.target.value = '';
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      toast.error('Image is too large (max 15 MB).');
      e.target.value = '';
      return;
    }
    stopCamera();
    clearImage();
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
    e.target.value = '';
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    setCameraOpen(false);
  };

  const openCamera = async () => {
    if (listening) await finishListening();
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          cameraVideoRef.current.play().catch(() => {});
        }
      });
    } catch (_) {
      toast.error('Camera access denied or unavailable.');
      setCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    const video = cameraVideoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error('Could not capture photo.');
        return;
      }
      clearImage();
      const file = new File([blob], `ask-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setImageFile(file);
      setImagePreview(URL.createObjectURL(blob));
      stopCamera();
    }, 'image/jpeg', 0.92);
  };


  const ask = async (text) => {
    const q = (text || question).trim();
    if ((!q && !imageFile) || !machineId || asking) return;
    if (listening) await finishListening();

    const id = Date.now();
    const attached = imageFile;
    const preview = imagePreview;
    setThread((t) => [
      ...t,
      {
        id: `w-${id}`,
        role: 'worker',
        text: q || '(Photo of the issue)',
        imagePreview: preview || null, // keep blob URL alive for the bubble
      },
    ]);
    setQuestion('');
    clearImage(false); // clear composer only — do not revoke message preview URL
    setAsking(true);
    setAskElapsed(0);
    if (askTimerRef.current) clearInterval(askTimerRef.current);
    askTimerRef.current = setInterval(() => setAskElapsed((s) => s + 1), 1000);
    try {
      // Context window: last turns before this question (max 8 = ~4 Q&A pairs)
      const history = thread
        .filter((m) => m && (m.role === 'worker' || m.role === 'ai') && (m.text || '').trim())
        .slice(-8)
        .map((m) => ({ role: m.role, text: String(m.text).slice(0, 1200) }));
      const res = await api.ask(q, machineId, attached, null, history);
      const aiId = `a-${id}`;
      const answer = res.answer || 'No answer returned.';
      setThread((t) => [
        ...t,
        {
          id: aiId,
          role: 'ai',
          text: answer,
          sources: res.sources_used || res.sources || [],
          video: res.video_url,
          tipImage: res.tip_image_url || null,
        },
      ]);
      if (autoSpeak) {
        setTimeout(() => speakText(answer, aiId), 200);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not get an answer.');
      setThread((t) => t.filter((m) => m.id !== `w-${id}`));
    } finally {
      setAsking(false);
      if (askTimerRef.current) {
        clearInterval(askTimerRef.current);
        askTimerRef.current = null;
      }
      setAskElapsed(0);
    }
  };

  // Suggestions follow the selected machine (name in the question).
  // Keep them general so they work for CNC, lathe, grinder, etc. — not CNC-only tips.
  const suggestions = machineId
    ? [
        `What should I check before starting ${machineId}?`,
        `What are common warning signs on ${machineId}?`,
        `What safety steps are required on ${machineId}?`,
      ]
    : [
        'What should I check before starting this machine?',
        'What are common warning signs on this machine?',
        'What safety steps are required before I begin?',
      ];

  return (
    <div className="flex flex-col h-[calc(100dvh-7.5rem)] sm:h-[calc(100vh-130px)] lg:h-[calc(100vh-88px)] max-w-3xl mx-auto w-full min-h-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-3 sm:mb-4 shrink-0">
        <div className="min-w-0">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-amber mb-0.5">Ask AI</p>
          <h1 className="text-xl sm:text-2xl font-semibold text-text leading-tight">Ask the machine</h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5 leading-snug">Answers from manuals & approved tips only — never a guess.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {thread.length > 0 && (
            <button
              type="button"
              onClick={() => {
                stopSpeak();
                setThread([]);
                const wid = getWorkerId() || ownerRef.current;
                if (machineId) {
                  threadsByMachineRef.current[machineId] = [];
                }
                try {
                  if (wid) sessionStorage.setItem(`sv_ask_map_${wid}`, JSON.stringify(threadsByMachineRef.current));
                } catch (_) {}
              }}
              className="px-3 py-2 rounded-xl text-sm font-semibold border-2 border-line bg-surface-2 text-muted hover:text-text hover:border-line"
            >
              Clear chat
            </button>
          )}
          {machines.length > 0 && (
            <Select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="min-w-0 flex-1 sm:flex-none sm:min-w-[160px]">
              {machines.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {machines.length === 0 ? (
        <EmptyState
          icon={Factory}
          title="No machine assigned"
          description="Ask your supervisor to assign you to a machine before asking questions."
        />
      ) : (
        <>
          {/* Thread */}
          <div className="flex-1 overflow-y-auto sv-scrollbar-none space-y-4 pr-1 min-h-0 pb-2">
            {thread.length === 0 && !asking && (
              <Card className="p-4 sm:p-6 border-2 border-line text-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-3 sm:mb-4 rounded-2xl bg-signal/15 border-2 border-signal/30 flex items-center justify-center text-signal">
                  <Sparkles size={24} />
                </div>
                <h2 className="text-base sm:text-lg font-semibold text-text mb-1">How can I help on the floor?</h2>
                <p className="text-xs sm:text-sm text-muted mb-4 sm:mb-5 max-w-md mx-auto leading-snug">
                  Speak or type a question about <span className="font-semibold text-text">{machineId}</span>.
                </p>
                <div className="flex flex-col sm:flex-row sm:flex-wrap justify-center gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => ask(s)}
                      className="text-left text-sm px-3.5 py-2.5 sm:py-2 rounded-xl border-2 border-line bg-surface-2 hover:border-amber hover:bg-amber/10 transition-colors w-full sm:w-auto sm:max-w-xs"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Card>
            )}

            <AnimatePresence initial={false}>
              {thread.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2.5 ${m.role === 'worker' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.role === 'ai' && (
                    <div className="w-9 h-9 rounded-full bg-signal/15 border-2 border-signal/30 flex items-center justify-center text-signal shrink-0 mt-0.5">
                      <Bot size={18} />
                    </div>
                  )}
                  <div
                    className={`max-w-[90%] sm:max-w-[80%] rounded-2xl px-4 py-3 border-2 ${
                      m.role === 'worker'
                        ? 'bg-amber text-white border-amber rounded-br-md'
                        : 'bg-surface border-line rounded-bl-md shadow-sm'
                    }`}
                  >
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'worker' ? 'text-white' : 'text-text'}`}>
                      {m.text}
                    </p>
                    {m.imagePreview && (
                      <button
                        type="button"
                        onClick={() => setLightboxSrc(m.imagePreview)}
                        className="mt-2.5 block w-full text-left"
                        title="View full image"
                      >
                        <img
                          src={m.imagePreview}
                          alt="Attached photo"
                          className={`w-full max-h-48 rounded-xl object-cover cursor-zoom-in hover:opacity-95 transition-opacity ${
                            m.role === 'worker'
                              ? 'border-2 border-white/35'
                              : 'border border-line'
                          }`}
                        />
                        <span
                          className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold ${
                            m.role === 'worker' ? 'text-white/85' : 'text-muted'
                          }`}
                        >
                          <ImageIcon size={11} /> Photo attached · tap to enlarge
                        </span>
                      </button>
                    )}
                    {/* Source tip video — play inline in the chat bubble */}
                    {m.role === 'ai' && m.video && (
                      <div className="mt-3 rounded-xl overflow-hidden border-2 border-line bg-black">
                        <video
                          key={m.video}
                          src={mediaUrl(m.video)}
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full max-h-56 object-contain bg-black"
                        >
                          Your browser does not support video playback.
                        </video>
                        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-surface-2 border-t border-line">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber">
                            <Video size={11} /> Related tip video
                          </span>
                          <a
                            href={mediaUrl(m.video)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-semibold text-muted hover:text-signal"
                          >
                            Open full size
                          </a>
                        </div>
                      </div>
                    )}
                    {/* Source tip photo from approved knowledge */}
                    {m.role === 'ai' && m.tipImage && (
                      <div className="mt-3 rounded-xl overflow-hidden border-2 border-line bg-surface-2">
                        <button
                          type="button"
                          onClick={() => setLightboxSrc(mediaUrl(m.tipImage))}
                          className="block w-full text-left"
                          title="View full image"
                        >
                          <img
                            src={mediaUrl(m.tipImage)}
                            alt="Related tip photo"
                            className="w-full max-h-56 object-contain bg-black cursor-zoom-in"
                          />
                        </button>
                        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-t border-line">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-signal">
                            <ImageIcon size={11} /> Related tip photo
                          </span>
                          <button
                            type="button"
                            onClick={() => setLightboxSrc(mediaUrl(m.tipImage))}
                            className="text-[11px] font-semibold text-muted hover:text-signal"
                          >
                            Enlarge
                          </button>
                        </div>
                      </div>
                    )}
                    {m.role === 'ai' && (
                      <div className="mt-3 pt-2 border-t border-line flex flex-wrap items-center gap-2">
                        {speakingId === m.id && speakState === 'playing' && (
                          <>
                            <button
                              type="button"
                              onClick={pauseSpeak}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border border-amber text-amber bg-amber/10 hover:bg-amber/15 transition-colors"
                            >
                              <Pause size={12} /> Pause
                            </button>
                            <button
                              type="button"
                              onClick={stopSpeak}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border border-line text-muted hover:border-danger hover:text-danger transition-colors"
                            >
                              <Square size={12} /> Stop
                            </button>
                          </>
                        )}
                        {speakingId === m.id && speakState === 'paused' && (
                          <>
                            <button
                              type="button"
                              onClick={resumeSpeak}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border border-signal text-signal bg-signal/10 hover:bg-signal/15 transition-colors"
                            >
                              <Play size={12} /> Resume
                            </button>
                            <button
                              type="button"
                              onClick={stopSpeak}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border border-line text-muted hover:border-danger hover:text-danger transition-colors"
                            >
                              <Square size={12} /> Stop
                            </button>
                          </>
                        )}
                        {speakingId !== m.id && (
                          <button
                            type="button"
                            onClick={() => speakText(m.text, m.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border border-line text-muted hover:border-signal hover:text-signal transition-colors"
                          >
                            <Volume2 size={13} /> Listen
                          </button>
                        )}
                        {Array.isArray(m.sources) && m.sources.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                            <BookOpen size={11} />
                            {m.sources.length} source{m.sources.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {m.role === 'worker' && (
                    <div className="w-9 h-9 rounded-full bg-amber/20 border-2 border-amber/40 flex items-center justify-center text-amber shrink-0 mt-0.5">
                      <User size={18} />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {asking && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-9 h-9 rounded-full bg-signal/15 border-2 border-signal/30 flex items-center justify-center text-signal shrink-0">
                  <Bot size={18} />
                </div>
                <div className="rounded-2xl rounded-bl-md border-2 border-line bg-surface px-4 py-3 max-w-[min(100%,28rem)]">
                  <div className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-amber shrink-0" />
                    <span className="text-sm font-medium text-text">
                      {askElapsed < 3
                        ? 'Searching manuals & approved tips…'
                        : askElapsed < 8
                          ? 'Reading the best matches…'
                          : askElapsed < 20
                            ? 'Writing a clear answer…'
                            : 'Still working — complex answers can take a bit…'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted mt-1.5 font-mono tabular-nums">
                    {askElapsed}s · answers use only this machine’s knowledge (no guessing)
                  </p>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Composer */}
          <div className="shrink-0 pt-3 border-t-2 border-line">

            {cameraOpen && (
              <div className="mb-3 relative rounded-2xl overflow-hidden border-2 border-line bg-black aspect-video max-h-56">
                <video
                  ref={cameraVideoRef}
                  muted
                  playsInline
                  autoPlay
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute bottom-3 inset-x-0 flex justify-center gap-3 z-10">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2 rounded-full text-sm font-semibold bg-black/70 text-white border border-white/30"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="w-14 h-14 rounded-full bg-white border-4 border-amber flex items-center justify-center shadow-lg"
                    title="Take photo"
                    aria-label="Take photo"
                  >
                    <Camera size={22} className="text-amber" />
                  </button>
                </div>
                <span className="absolute top-3 left-3 z-10 text-[11px] font-semibold text-white bg-black/55 px-2.5 py-1 rounded-full">
                  Camera
                </span>
              </div>
            )}

            {imagePreview && (
              <div className="mb-2 relative inline-block">
                <button
                  type="button"
                  onClick={() => setLightboxSrc(imagePreview)}
                  title="View full image"
                  className="block"
                >
                  <img
                    src={imagePreview}
                    alt="Attached"
                    className="h-20 rounded-xl border-2 border-line object-cover cursor-zoom-in hover:opacity-95 transition-opacity"
                  />
                </button>
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-danger text-white flex items-center justify-center shadow"
                  aria-label="Remove image"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            {(listening || liveCaption || transcribing) && (
              <div className="mb-2 px-3 py-2 rounded-xl bg-surface-2 border-2 border-danger/25 text-sm">
                {transcribing ? (
                  <span className="text-muted flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Finishing transcript…
                  </span>
                ) : (
                  <span>
                    <span className="text-danger font-semibold text-xs uppercase tracking-wide mr-2">Live</span>
                    <span className="text-text">{liveCaption || 'Listening…'}</span>
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={onImagePick}
              />

              {/* Photo tools above the text line */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={asking || listening || cameraOpen}
                  title="Upload a photo from files"
                  aria-label="Upload photo"
                  className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full border-2 text-xs font-semibold transition-all disabled:opacity-50 ${
                    imageFile && !cameraOpen
                      ? 'border-amber bg-amber/15 text-amber'
                      : 'border-line bg-surface-2 text-muted hover:border-amber hover:text-amber'
                  }`}
                >
                  <ImageIcon size={15} />
                  Gallery
                </button>
                <button
                  type="button"
                  onClick={() => (cameraOpen ? stopCamera() : openCamera())}
                  disabled={asking || listening}
                  title={cameraOpen ? 'Close camera' : 'Take a photo with camera'}
                  aria-label={cameraOpen ? 'Close camera' : 'Open camera'}
                  className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full border-2 text-xs font-semibold transition-all disabled:opacity-50 ${
                    cameraOpen
                      ? 'border-amber bg-amber text-white'
                      : 'border-line bg-surface-2 text-muted hover:border-amber hover:text-amber'
                  }`}
                >
                  <Camera size={15} />
                  {cameraOpen ? 'Close cam' : 'Camera'}
                </button>
                {(imageFile || cameraOpen) && (
                  <span className="text-[11px] text-muted truncate">
                    {cameraOpen ? 'Aim at the issue, then capture' : 'Photo attached'}
                  </span>
                )}
              </div>

              {/* Mic + text + send on one line */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(question);
                }}
                className="flex items-end gap-2 min-w-0"
              >
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={asking || transcribing}
                  aria-label={listening ? 'Stop listening' : 'Speak'}
                  title={listening ? 'Stop' : 'Speak question'}
                  className={`shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-md transition-all disabled:opacity-50 ${
                    listening
                      ? 'bg-danger text-white shadow-danger/25'
                      : 'bg-signal text-white shadow-signal/20 hover:scale-105'
                  }`}
                >
                  {transcribing ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : listening ? (
                    <Square size={16} />
                  ) : (
                    <Mic size={20} />
                  )}
                </button>
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter → send · Shift+Enter → new line (ChatGPT-style)
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if ((!question.trim() && !imageFile) || asking || listening) return;
                      ask(question);
                    }
                  }}
                  placeholder={listening ? 'Speak your question…' : 'Type a question…'}
                  className="flex-1 min-w-0 resize-none bg-surface-2 border-2 border-line rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-[15px] sm:text-sm text-text outline-none focus:border-amber placeholder:text-muted leading-relaxed max-h-40"
                  style={{ minHeight: 44 }}
                  disabled={asking}
                  aria-label="Question"
                />
                <button
                  type="submit"
                  disabled={(!question.trim() && !imageFile) || asking || listening}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-amber text-white flex items-center justify-center disabled:opacity-40 shrink-0 shadow-md shadow-amber/20"
                  aria-label="Send"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>

            {speakingId && speakState !== 'idle' && (
              <div className="mt-2 flex items-center gap-2 rounded-xl border-2 border-amber/40 bg-amber/10 px-3 py-2 text-sm">
                <Volume2 size={16} className="text-amber shrink-0" />
                <span className="font-semibold text-text flex-1 min-w-0">
                  {speakState === 'paused' ? 'Answer paused' : 'Playing answer…'}
                </span>
                {speakState === 'playing' ? (
                  <button
                    type="button"
                    onClick={pauseSpeak}
                    className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-white border border-amber/40 text-amber"
                  >
                    <Pause size={12} /> Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={resumeSpeak}
                    className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-white border border-signal/40 text-signal"
                  >
                    <Play size={12} /> Resume
                  </button>
                )}
                <button
                  type="button"
                  onClick={stopSpeak}
                  className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-white border border-line text-muted hover:text-danger"
                >
                  <Square size={12} /> Stop
                </button>
              </div>
            )}

            <div className="mt-2 flex flex-col xs:flex-row sm:flex-row sm:flex-wrap sm:items-center gap-1.5 sm:gap-3 text-xs text-muted">
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={autoSpeak}
                  onChange={(e) => setAutoSpeak(e.target.checked)}
                  className="rounded border-line"
                />
                Auto-play answers
              </label>
              <span className="leading-snug">
                {listening
                  ? 'Tap Speak again when done'
                  : 'Enter to send · Shift+Enter new line · mic or photo optional'}
              </span>
            </div>
          </div>
        </>
      )}

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
              className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25"
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