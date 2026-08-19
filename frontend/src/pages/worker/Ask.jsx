import { useEffect, useRef, useState } from 'react';
import { Mic, Send, FileText, MessageCircle, Sparkles } from 'lucide-react';
import MachineSelect from '../../components/MachineSelect';
import SpeakButton from '../../components/SpeakButton';
import { Api } from '../../lib/api';
import { useVoiceRecorder } from '../../lib/useVoiceRecorder';
import { useI18n } from '../../lib/i18n';
import { useToast } from '../../lib/toast';
import { useAskSession } from '../../lib/workerSession';

// Fallback used only for typed questions (no audio to detect a language
// from) or before the worker has spoken at all in this session.
const DEFAULT_LANG = 'en-IN';

export default function Ask() {
  const [machines, setMachines] = useState([]);
  const {
    askMachine: machine, setAskMachine: setMachine,
    askQuestion: question, setAskQuestion: setQuestion,
    askMessages: messages, setAskMessages: setMessages,
    askBusy: asking, setAskBusy: setAsking,
  } = useAskSession();
  const scrollRef = useRef(null);
  const { push } = useToast();
  const { t } = useI18n();

  // Sarvam-detected language from the worker's most recent recording.
  // Carries forward as the default for typed follow-ups in the same
  // session, since a worker rarely switches language mid-conversation.
  const [detectedLang, setDetectedLang] = useState(DEFAULT_LANG);
  const { recording, busy: transcribing, start, stop } = useVoiceRecorder();

  useEffect(() => {
    Api.myMachines()
      .then((res) => {
        setMachines(res.machine_ids || []);
        if (res.machine_ids?.length && !machine) setMachine(res.machine_ids[0]);
      })
      .catch((err) => push(err.message, 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // lang = the language this specific question was asked in, so the
  // answer's SpeakButton plays back in that language even if a later
  // question in the same session switches languages.
  async function submitQuestion(text, lang) {
    const q = text.trim();
    if (!q || !machine) return;
    const askLang = lang || detectedLang;
    setMessages((m) => [...m, { role: 'worker', text: q, lang: askLang }]);
    setQuestion('');
    setAsking(true);
    try {
      const res = await Api.ask(q, machine);
      setMessages((m) => [...m, { role: 'answer', text: res.answer, sourcesUsed: res.sources_used, lang: askLang }]);
    } catch (err) {
      push(err.message, 'error');
      setMessages((m) => m.slice(0, -1));
    } finally {
      setAsking(false);
    }
  }

  function handleMic() {
    if (recording) {
      stop();
      return;
    }
    start(
      ({ transcript, language_code }) => {
        if (language_code) setDetectedLang(language_code);
        submitQuestion(transcript, language_code);
      },
      (err) => push(err || t('micError'), 'error'),
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 24px 32px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 20, color: 'var(--sv-ink)', margin: 0 }}>
            {t('askAbout')}
          </p>
          {machines.length > 0 ? (
            <MachineSelect value={machine} onChange={setMachine} machines={machines} />
          ) : (
            <span style={{ fontSize: 13, color: 'var(--sv-muted)' }}>{t('noMachinesAssigned')}</span>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'var(--sv-muted)', marginTop: 4 }}>
          {t('groundedInManual')}
        </p>
      </div>

      {/* Chat panel — one bordered surface holds messages + input */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          background: 'var(--sv-surface)',
          border: '1px solid var(--sv-border)',
          borderRadius: 'var(--sv-radius-lg)',
          boxShadow: 'var(--sv-shadow-md)',
          overflow: 'hidden',
        }}
      >
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            padding: '20px 12px 20px 20px',
            marginRight: 4,
          }}
        >
          {messages.length === 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              gap: 10, padding: '40px 20px', color: 'var(--sv-muted)', margin: 'auto',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', background: 'var(--sv-brass-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <MessageCircle size={20} color="var(--sv-brass)" />
              </div>
              <p style={{ fontSize: 13.5, maxWidth: 320, lineHeight: 1.5 }}>
                {t('askAnythingAbout', { machine: machine || t('yourMachine') })}
              </p>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === 'worker' ? (
              <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{
                  maxWidth: '78%', background: 'var(--sv-question-bg)', color: 'var(--sv-question-text)',
                  borderRadius: '14px 14px 4px 14px', padding: '10px 14px',
                }}>
                  <p style={{ fontSize: 14, lineHeight: 1.45, margin: 0 }}>{m.text}</p>
                </div>
              </div>
            ) : (
              <div key={i} style={{ display: 'flex', gap: 8, maxWidth: '85%' }}>
                <div style={{
                  width: 26, height: 26, minWidth: 26, borderRadius: '50%',
                  background: 'var(--sv-brass-soft)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', marginTop: 2,
                }}>
                  <Sparkles size={13} color="var(--sv-brass)" />
                </div>
                <div style={{
                  background: 'var(--sv-bg)', border: '1px solid var(--sv-border)',
                  borderRadius: '4px 14px 14px 14px', padding: '12px 14px', minWidth: 0,
                }}>
                  <p style={{ fontSize: 14, color: 'var(--sv-ink)', lineHeight: 1.5, margin: 0, marginBottom: 10 }}>
                    {m.text}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    {m.sourcesUsed > 0 ? (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5,
                        color: 'var(--sv-teal)', background: 'rgba(0,0,0,0.03)',
                        border: '1px solid var(--sv-border)', borderRadius: 'var(--sv-radius-full)',
                        padding: '3px 10px',
                      }}>
                        <FileText size={11} />
                        {t('drawnFrom')} {m.sourcesUsed} {m.sourcesUsed === 1 ? t('passageSingular') : t('passagePlural')} {t('inKnowledgeBase')}
                      </div>
                    ) : <span />}
                    <SpeakButton text={m.text} lang={m.lang} />
                  </div>
                </div>
              </div>
            )
          )}

          {asking && (
            <div style={{ display: 'flex', gap: 8, maxWidth: '85%' }}>
              <div style={{
                width: 26, height: 26, minWidth: 26, borderRadius: '50%',
                background: 'var(--sv-brass-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={13} color="var(--sv-brass)" />
              </div>
              <div style={{
                background: 'var(--sv-bg)', border: '1px solid var(--sv-border)',
                borderRadius: '4px 14px 14px 14px', padding: '12px 14px', color: 'var(--sv-muted)', fontSize: 13.5,
              }}>
                {transcribing ? (t('transcribing') || 'Transcribing…') : t('thinking')}
              </div>
            </div>
          )}
        </div>

        {/* Input bar */}
        <form
          onSubmit={(e) => { e.preventDefault(); submitQuestion(question, detectedLang); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: 12, borderTop: '1px solid var(--sv-border)', background: 'var(--sv-surface)',
          }}
        >
          <input
            style={{
              flex: 1, border: '1px solid var(--sv-border)', borderRadius: 'var(--sv-radius-full)',
              outline: 'none', fontSize: 14, background: 'var(--sv-bg)', padding: '10px 16px',
              color: 'var(--sv-ink)',
            }}
            placeholder={machine ? t('askPlaceholder', { machine }) : t('selectMachineFirst')}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={!machine}
          />
          <button
            type="button"
            onClick={handleMic}
            disabled={!machine || transcribing}
            style={{
              width: 40, height: 40, minWidth: 40, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, box-shadow 0.15s',
              background: recording ? 'var(--sv-brass)' : 'transparent',
              color: recording ? '#fff' : 'var(--sv-brass)',
              boxShadow: recording ? 'none' : 'inset 0 0 0 1.5px var(--sv-brass-soft)',
            }}
            aria-label={t('askByVoiceAria')}
          >
            <Mic size={16} />
          </button>
          <button
            type="submit"
            disabled={!machine || !question.trim() || asking}
            aria-label={t('sendAria') || 'Send'}
            style={{
              width: 40, height: 40, minWidth: 40, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', border: 'none',
              cursor: (!machine || !question.trim() || asking) ? 'not-allowed' : 'pointer',
              background: (!machine || !question.trim() || asking) ? 'var(--sv-border)' : 'var(--sv-brass)',
              color: '#fff',
              transition: 'background 0.15s ease',
            }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}