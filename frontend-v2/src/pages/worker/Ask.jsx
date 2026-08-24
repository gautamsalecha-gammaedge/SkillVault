import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Factory, Video } from 'lucide-react';
import { api, mediaUrl, ApiError } from '../../lib/api';
import { PageHeader, Select, Spinner, EmptyState } from '../../components/ui';
import MicButton from '../../components/MicButton';
import SpeakButton from '../../components/SpeakButton';
import { useToast } from '../../components/Toast';

export default function Ask() {
  const [machines, setMachines] = useState([]);
  const [machineId, setMachineId] = useState('');
  const [question, setQuestion] = useState('');
  const [thread, setThread] = useState([]);
  const [asking, setAsking] = useState(false);
  const toast = useToast();
  const endRef = useRef(null);

  useEffect(() => {
    api.myMachines().then((r) => {
      setMachines(r.machine_ids || []);
      if (r.machine_ids?.length) setMachineId(r.machine_ids[0]);
    }).catch(() => {});
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread, asking]);

  const ask = async (text) => {
    if (!text.trim() || !machineId) return;
    setThread((t) => [...t, { role: 'worker', text }]);
    setQuestion('');
    setAsking(true);
    try {
      const res = await api.ask(text, machineId);
      setThread((t) => [...t, { role: 'ai', text: res.answer, sources: res.sources_used, video: res.video_url }]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not get an answer.');
      setThread((t) => t.slice(0, -1));
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] lg:h-[calc(100vh-90px)]">
      <PageHeader
        eyebrow="Ask AI"
        title="Ask the machine anything."
        description="Grounded only in manuals and admin-approved tips — never a guess."
        actions={
          machines.length > 0 && (
            <Select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="min-w-[180px]">
              {machines.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          )
        }
      />

      {machines.length === 0 ? (
        <EmptyState icon={Factory} title="No machine assigned yet" description="Ask your supervisor to assign you to a machine before asking questions." />
      ) : (
        <>
          <div className="flex-1 overflow-y-auto sv-scrollbar-none space-y-4 pb-6">
            {thread.length === 0 && (
              <div className="sv-card sv-grid-tile p-8 text-center">
                <Sparkles size={24} className="text-signal mx-auto mb-3" />
                <p className="text-muted text-sm max-w-sm mx-auto">Tap the mic or type a question about <span className="font-mono text-text">{machineId}</span> — e.g. "why is the spindle overheating?"</p>
              </div>
            )}
            <AnimatePresence initial={false}>
              {thread.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.role === 'worker' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-5 py-3.5 ${m.role === 'worker' ? 'bg-signal text-[#06110d] font-medium' : 'sv-card'}`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
                    {m.role === 'ai' && (
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        <SpeakButton text={m.text} />
                        {m.sources > 0 && <span className="text-[11px] font-mono text-muted">{m.sources} source{m.sources > 1 ? 's' : ''} used</span>}
                        {m.video && (
                          <a href={mediaUrl(m.video)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-mono text-amber hover:underline">
                            <Video size={12} /> watch clip
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {asking && (
              <div className="flex justify-start">
                <div className="sv-card px-5 py-3.5 flex items-center gap-2"><Spinner size={16} /> <span className="text-xs text-muted font-mono">thinking…</span></div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-line pt-5 flex items-end gap-4">
            <MicButton size={52} label={false} onResult={(res) => ask(res.transcript)} />
            <form onSubmit={(e) => { e.preventDefault(); ask(question); }} className="flex-1 flex items-center gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Or type your question…"
                className="flex-1 bg-surface-2 border border-line rounded-full px-5 py-3.5 text-sm outline-none focus:border-signal focus:ring-2 focus:ring-signal/20"
              />
              <button type="submit" disabled={!question.trim() || asking} className="w-12 h-12 rounded-full bg-signal text-[#06110d] flex items-center justify-center disabled:opacity-40 shrink-0">
                <Send size={18} />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
