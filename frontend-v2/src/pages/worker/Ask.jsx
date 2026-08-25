import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Sparkles, Factory, Video, Mic, Square, Loader2,
  Volume2, BookOpen, User, Bot,
} from 'lucide-react';
import { api, mediaUrl, ApiError } from '../../lib/api';
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
  const [thread, setThread] = useState([]);
  const [asking, setAsking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);

  const [listening, setListening] = useState(false);
  const [liveCaption, setLiveCaption] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);

  const endRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStreamRef = useRef(null);
  const audioElRef = useRef(null);
  const languageRef = useRef('en-IN');

  useEffect(() => {
    api.myMachines()
      .then((r) => {
        setMachines(r.machine_ids || []);
        if (r.machine_ids?.length) setMachineId(r.machine_ids[0]);
      })
      .catch(() => {});
    return () => {
      stopListening();
      stopSpeak();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread, asking, liveCaption]);

  const stopSpeak = () => {
    if (audioElRef.current) {
      try {
        audioElRef.current.pause();
        audioElRef.current.src = '';
      } catch (_) {}
      audioElRef.current = null;
    }
    setSpeakingId(null);
  };

  const speakText = async (text, id) => {
    if (!text?.trim()) return;
    stopSpeak();
    setSpeakingId(id);
    try {
      const result = await api.speak(text.trim(), languageRef.current || 'en-IN');
      const blob = result?.blob || result;
      if (!blob || !(blob instanceof Blob)) throw new Error('no audio');
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioElRef.current = audio;
      audio.onended = () => {
        setSpeakingId(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setSpeakingId(null);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (_) {
      setSpeakingId(null);
      toast.error('Could not play audio.');
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

  const startListening = async () => {
    setLiveCaption('');
    setListening(true);
    const lang = languageRef.current || 'en-IN';
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const rec = new SR();
      recognitionRef.current = rec;
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = lang;
      rec.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) final += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (final) {
          setQuestion((t) => (t ? `${t} ${final}` : final).trim());
          setLiveCaption(interim);
        } else {
          setLiveCaption(interim);
        }
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
            if (res?.transcript) {
              const next = res.transcript.trim();
              setQuestion((t) => {
                if (!t) return next;
                if (t.includes(next.slice(0, Math.min(16, next.length)))) return t;
                return `${t} ${next}`.trim();
              });
              if (res.language_code) languageRef.current = res.language_code;
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

  const toggleMic = () => {
    if (listening) finishListening();
    else startListening();
  };

  const ask = async (text) => {
    const q = (text || question).trim();
    if (!q || !machineId || asking) return;
    if (listening) await finishListening();

    const id = Date.now();
    setThread((t) => [...t, { id: `w-${id}`, role: 'worker', text: q }]);
    setQuestion('');
    setAsking(true);
    try {
      const res = await api.ask(q, machineId);
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
    }
  };

  const suggestions = [
    'What does a grinding noise on cold start mean?',
    'How do I check coolant level safely?',
    'What should I do if the spindle overheats?',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] lg:h-[calc(100vh-88px)] max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 shrink-0">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber mb-0.5">Ask AI</p>
          <h1 className="text-2xl font-semibold text-text">Ask the machine</h1>
          <p className="text-sm text-muted mt-0.5">Answers from manuals & approved tips only — never a guess.</p>
        </div>
        {machines.length > 0 && (
          <Select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="min-w-[160px]">
            {machines.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
        )}
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
              <Card className="p-6 border-2 border-line text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-signal/15 border-2 border-signal/30 flex items-center justify-center text-signal">
                  <Sparkles size={26} />
                </div>
                <h2 className="text-lg font-semibold text-text mb-1">How can I help on the floor?</h2>
                <p className="text-sm text-muted mb-5 max-w-md mx-auto">
                  Speak or type a question about <span className="font-semibold text-text">{machineId}</span>.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => ask(s)}
                      className="text-left text-sm px-3.5 py-2 rounded-xl border-2 border-line bg-surface-2 hover:border-amber hover:bg-amber/10 transition-colors max-w-xs"
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
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 border-2 ${
                      m.role === 'worker'
                        ? 'bg-amber text-white border-amber rounded-br-md'
                        : 'bg-surface border-line rounded-bl-md shadow-sm'
                    }`}
                  >
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'worker' ? 'text-white' : 'text-text'}`}>
                      {m.text}
                    </p>
                    {m.role === 'ai' && (
                      <div className="mt-3 pt-2 border-t border-line flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (speakingId === m.id) stopSpeak();
                            else speakText(m.text, m.id);
                          }}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
                            speakingId === m.id
                              ? 'border-amber text-amber bg-amber/10'
                              : 'border-line text-muted hover:border-signal hover:text-signal'
                          }`}
                        >
                          {speakingId === m.id ? <Square size={12} /> : <Volume2 size={13} />}
                          {speakingId === m.id ? 'Stop' : 'Listen'}
                        </button>
                        {m.video && (
                          <a
                            href={mediaUrl(m.video)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border border-line text-amber hover:border-amber"
                          >
                            <Video size={12} /> Watch clip
                          </a>
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
                <div className="rounded-2xl rounded-bl-md border-2 border-line bg-surface px-4 py-3 flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-amber" />
                  <span className="text-sm text-muted">Looking up manuals & tips…</span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Composer */}
          <div className="shrink-0 pt-3 border-t-2 border-line">
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

            <div className="flex items-end gap-3">
              <button
                type="button"
                onClick={toggleMic}
                disabled={asking || transcribing}
                className={`shrink-0 w-14 h-14 rounded-full flex items-center justify-center shadow-md transition-all disabled:opacity-50 ${
                  listening
                    ? 'bg-danger text-white shadow-danger/25'
                    : 'bg-signal text-white shadow-signal/20 hover:scale-105'
                }`}
              >
                {transcribing ? (
                  <Loader2 size={22} className="animate-spin" />
                ) : listening ? (
                  <Square size={18} />
                ) : (
                  <Mic size={22} />
                )}
              </button>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(question);
                }}
                className="flex-1 flex items-center gap-2 min-w-0"
              >
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={listening ? 'Speak your question…' : 'Type or speak a question…'}
                  className="flex-1 bg-surface-2 border-2 border-line rounded-2xl px-4 py-3.5 text-sm text-text outline-none focus:border-amber placeholder:text-muted"
                  disabled={asking}
                />
                <button
                  type="submit"
                  disabled={!question.trim() || asking || listening}
                  className="w-12 h-12 rounded-full bg-amber text-white flex items-center justify-center disabled:opacity-40 shrink-0 shadow-md shadow-amber/20"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoSpeak}
                  onChange={(e) => setAutoSpeak(e.target.checked)}
                  className="rounded border-line"
                />
                Auto-play answers
              </label>
              <span>
                {listening ? 'Tap mic again when done' : 'Tap mic to ask by voice'}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}