import { useEffect, useRef, useState } from 'react';
import { Mic, MessageCircleQuestion, Sparkles, CheckCircle2, Video, VideoOff, Upload, X, Film } from 'lucide-react';
import MachineSelect from '../../components/MachineSelect';
import SpeakButton from '../../components/SpeakButton';
import { Api, mediaUrl } from '../../lib/api';
import { useVoiceRecorder } from '../../lib/useVoiceRecorder';
import { useVideoRecorder } from '../../lib/useVideoRecorder';
import { useToast } from '../../lib/toast';
import { useI18n } from '../../lib/i18n';

const MAX_VIDEO_BYTES = 80 * 1024 * 1024; // matches backend's 80MB limit
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

const PHASE = { WRITING: 'writing', CLARIFYING: 'clarifying', REVIEW: 'review', SUCCESS: 'success' };

const STEP_ORDER = [PHASE.WRITING, PHASE.CLARIFYING, PHASE.REVIEW];

// Fallback used only until the worker's first recording comes back with a
// Sarvam-detected language_code. After that, detectedLang is the single
// source of truth for clarifying questions, confirmations, and TTS.
const DEFAULT_LANG = 'en-IN';

function MicButton({ active, onClick, disabled, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? 'var(--sv-danger, #de6464)' : 'var(--sv-brass-soft)',
        color: active ? '#fff' : 'var(--sv-brass)',
        transition: 'background 0.15s ease',
        boxShadow: active ? '0 0 0 6px rgba(222,100,100,0.15)' : 'none',
      }}
    >
      <Mic size={17} />
    </button>
  );
}

/**
 * Optional video attachment for a tip. Two ways in: record a short clip
 * with the camera (useVideoRecorder), or pick an existing file. Either
 * way ends up as a plain File the caller hands to Api.addKnowledge —
 * the backend sends it to Gemini for understanding on final submit
 * (see routers/knowledge.py), so no preview/description is generated
 * client-side, just a local playback preview.
 */
function VideoAttach({ t, videoFile, onPick, onClear, disabled }) {
  const { recording, stream, start, stop, cancel } = useVideoRecorder();
  const liveRef = useRef(null);
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const { push } = useToast();

  useEffect(() => {
    if (liveRef.current) liveRef.current.srcObject = stream || null;
  }, [stream]);

  useEffect(() => () => cancel(), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!videoFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(videoFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  async function handleStartRecording() {
    start((err) => push(err, 'error'));
  }

  async function handleStopRecording() {
    const file = await stop();
    if (file) onPick(file);
  }

  function handleFilePick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      push(t('videoTypeError') || 'Only MP4, WebM, MOV or AVI videos are allowed.', 'error');
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      push(t('videoSizeError') || 'Video is too large. Maximum size is 80 MB.', 'error');
      return;
    }
    onPick(file);
  }

  if (recording) {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative', borderRadius: 'var(--sv-radius-md)', overflow: 'hidden', background: '#000' }}>
          <video ref={liveRef} autoPlay muted playsInline style={{ width: '100%', maxHeight: 220, display: 'block', objectFit: 'cover' }} />
          <span style={{
            position: 'absolute', top: 10, left: 10, display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(222,100,100,0.9)',
            padding: '3px 10px', borderRadius: 'var(--sv-radius-full)',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
            {t('recordingNow') || 'Recording…'}
          </span>
        </div>
        <button
          type="button"
          className="sv-btn sv-btn--primary sv-btn--full"
          style={{ marginTop: 10 }}
          onClick={handleStopRecording}
        >
          <VideoOff size={15} /> {t('stopRecordingBtn') || 'Stop recording'}
        </button>
      </div>
    );
  }

  if (videoFile) {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative', borderRadius: 'var(--sv-radius-md)', overflow: 'hidden', background: '#000' }}>
          <video src={previewUrl} controls style={{ width: '100%', maxHeight: 220, display: 'block' }} />
          <button
            type="button"
            onClick={onClear}
            aria-label={t('removeVideoAria') || 'Remove video'}
            style={{
              position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
            }}
          >
            <X size={14} />
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--sv-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Film size={12} /> {videoFile.name}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <button
        type="button"
        className="sv-btn sv-btn--outline"
        style={{ flex: 1, justifyContent: 'center' }}
        disabled={disabled}
        onClick={handleStartRecording}
      >
        <Video size={15} /> {t('recordVideoBtn') || 'Record a video'}
      </button>
      <button
        type="button"
        className="sv-btn sv-btn--outline"
        style={{ flex: 1, justifyContent: 'center' }}
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={15} /> {t('uploadVideoBtn') || 'Upload a video'}
      </button>
      <input ref={fileInputRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/x-msvideo" hidden onChange={handleFilePick} />
    </div>
  );
}

function StepDots({ phase }) {
  const idx = STEP_ORDER.indexOf(phase);
  if (idx === -1) return null;
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
      {STEP_ORDER.map((s, i) => (
        <div
          key={s}
          style={{
            height: 4, flex: 1, borderRadius: 999,
            background: i <= idx ? 'var(--sv-brass)' : 'var(--sv-border)',
            transition: 'background 0.2s ease',
          }}
        />
      ))}
    </div>
  );
}

export default function AddTip() {
  const { t } = useI18n();
  const [machines, setMachines] = useState([]);
  const [machine, setMachine] = useState('');
  const [phase, setPhase] = useState(PHASE.WRITING);
  const [tipText, setTipText] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [polishedText, setPolishedText] = useState('');
  const [spokenConfirmation, setSpokenConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [micTarget, setMicTarget] = useState(null); // 'tip' | 'clarify' | null
  // Optional video demo attached to the tip — recorded or uploaded in the
  // WRITING step, carried through clarification/review, sent on saveTip.
  const [videoFile, setVideoFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null); // 0-100 while a video is uploading
  const [savedVideoUrl, setSavedVideoUrl] = useState(null); // video_url returned after a successful save
  // Language auto-detected by Sarvam STT from the worker's own voice.
  // Replaces the old getLanguage()/stored-setting approach entirely -
  // there is no picker, this just updates every time they speak.
  const [detectedLang, setDetectedLang] = useState(DEFAULT_LANG);
  const { push } = useToast();
  const { recording, busy: transcribing, start, stop } = useVoiceRecorder();

  useEffect(() => {
    Api.myMachines()
      .then((res) => {
        setMachines(res.machine_ids || []);
        if (res.machine_ids?.length) setMachine(res.machine_ids[0]);
      })
      .catch((err) => push(err.message, 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleMic(target, setter) {
    if (recording && micTarget === target) {
      stop();
      return;
    }
    setMicTarget(target);
    start(
      ({ transcript, language_code }) => {
        setter((prev) => (prev ? `${prev} ${transcript}` : transcript));
        if (language_code) setDetectedLang(language_code);
        setMicTarget(null);
      },
      (err) => {
        push(err || t('micError'), 'error');
        setMicTarget(null);
      },
    );
  }

  async function reviewTip() {
    if (!tipText.trim() || !machine) return;
    setBusy(true);
    try {
      const res = await Api.checkKnowledge(tipText, machine, 1, detectedLang);
      if (!res.complete) {
        setQuestion(res.question);
        setAnswer('');
        setPhase(PHASE.CLARIFYING);
      } else {
        setPolishedText(res.polished_text);
        setPhase(PHASE.REVIEW);
      }
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function answerClarification() {
    if (!answer.trim()) return;
    setBusy(true);
    try {
      const combined = `${tipText}\n${answer}`;
      const res = await Api.checkKnowledge(combined, machine, 2, detectedLang);
      setPolishedText(res.polished_text);
      setPhase(PHASE.REVIEW);
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function saveTip() {
    setBusy(true);
    if (videoFile) setUploadProgress(0);
    try {
      const res = await Api.addKnowledge(
        polishedText,
        machine,
        detectedLang,
        videoFile,
        videoFile ? (frac) => setUploadProgress(Math.round(frac * 100)) : null,
      );
      setSpokenConfirmation(res.spoken_confirmation || '');
      setSavedVideoUrl(res.video_url || null);
      push(t('tipSavedSuccess'), 'success');
      setPhase(PHASE.SUCCESS);
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(false);
      setUploadProgress(null);
    }
  }

  function reset() {
    if (recording) stop();
    setMicTarget(null);
    setTipText('');
    setQuestion('');
    setAnswer('');
    setPolishedText('');
    setSpokenConfirmation('');
    setDetectedLang(DEFAULT_LANG);
    setVideoFile(null);
    setUploadProgress(null);
    setSavedVideoUrl(null);
    setPhase(PHASE.WRITING);
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
        <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 20, color: 'var(--sv-ink)' }}>
          {t('addTipFor')}
        </p>
        {machines.length > 0 ? (
          <MachineSelect value={machine} onChange={setMachine} machines={machines} />
        ) : (
          <span style={{ fontSize: 13, color: 'var(--sv-muted)' }}>{t('noMachinesAssigned')}</span>
        )}
      </div>
      <p style={{ fontSize: 13, color: 'var(--sv-muted)', marginBottom: 20 }}>
        {t('addTipSubtitle')}
      </p>

      <div className="sv-card" style={{ padding: 24 }}>
        <StepDots phase={phase} />

        {phase === PHASE.WRITING && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, borderRadius: 'var(--sv-radius-lg)',
              padding: '8px 8px 8px 18px', background: 'var(--sv-bg)', border: '1px solid var(--sv-border)', marginBottom: 16,
            }}>
              <textarea
                rows={3}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, lineHeight: 1.5, background: 'transparent', resize: 'none', padding: '6px 0' }}
                placeholder={machine ? t('addTipPlaceholder', { machine }) : t('selectMachineFirst')}
                value={tipText}
                onChange={(e) => setTipText(e.target.value)}
                disabled={!machine}
              />
              <MicButton
                active={recording && micTarget === 'tip'}
                onClick={() => handleMic('tip', setTipText)}
                disabled={!machine || (transcribing && micTarget !== 'tip')}
                label={t('speakTipAria')}
              />
            </div>
            {recording && micTarget === 'tip' && (
              <p style={{ fontSize: 12, color: 'var(--sv-brass)', marginTop: -8, marginBottom: 16, fontWeight: 600 }}>
                {t('listeningNow') || 'Listening… speak now'}
              </p>
            )}
            {transcribing && micTarget === 'tip' && (
              <p style={{ fontSize: 12, color: 'var(--sv-muted)', marginTop: -8, marginBottom: 16, fontWeight: 600 }}>
                {t('transcribing') || 'Transcribing…'}
              </p>
            )}

            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 8 }}>
              {t('attachVideoLabel') || 'Add a quick video demo (optional)'}
            </p>
            <VideoAttach
              t={t}
              videoFile={videoFile}
              onPick={setVideoFile}
              onClear={() => setVideoFile(null)}
              disabled={!machine}
            />

            <button className="sv-btn sv-btn--primary sv-btn--full" disabled={!tipText.trim() || !machine || busy} onClick={reviewTip}>
              {busy ? t('reviewingTip') : t('reviewTipBtn')}
            </button>
          </div>
        )}

        {phase === PHASE.CLARIFYING && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <MessageCircleQuestion size={18} color="var(--sv-brass)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sv-brass)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {t('tipClarifyingTitle') || 'One quick question'}
              </span>
            </div>

            <div style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
              marginBottom: 16, padding: 14, borderRadius: 'var(--sv-radius-md)', background: 'var(--sv-brass-soft)',
            }}>
              <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--sv-ink)', margin: 0 }}>{question}</p>
              <SpeakButton text={question} lang={detectedLang} style={{ flexShrink: 0 }} />
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, borderRadius: 'var(--sv-radius-lg)',
              padding: '8px 8px 8px 18px', background: 'var(--sv-bg)', border: '1px solid var(--sv-border)', marginBottom: 12,
            }}>
              <textarea
                rows={2}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, lineHeight: 1.5, background: 'transparent', resize: 'none', padding: '6px 0' }}
                placeholder={t('answerPlaceholder')}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                autoFocus
              />
              <MicButton
                active={recording && micTarget === 'clarify'}
                onClick={() => handleMic('clarify', setAnswer)}
                disabled={transcribing && micTarget !== 'clarify'}
                label={t('speakAnswerAria') || t('speakTipAria')}
              />
            </div>
            {recording && micTarget === 'clarify' && (
              <p style={{ fontSize: 12, color: 'var(--sv-brass)', marginTop: -6, marginBottom: 12, fontWeight: 600 }}>
                {t('listeningNow') || 'Listening… speak now'}
              </p>
            )}
            {transcribing && micTarget === 'clarify' && (
              <p style={{ fontSize: 12, color: 'var(--sv-muted)', marginTop: -6, marginBottom: 12, fontWeight: 600 }}>
                {t('transcribing') || 'Transcribing…'}
              </p>
            )}

            <button className="sv-btn sv-btn--primary sv-btn--full" disabled={!answer.trim() || busy} onClick={answerClarification}>
              {busy ? t('pleaseWait') : t('continueBtn')}
            </button>
          </div>
        )}

        {phase === PHASE.REVIEW && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Sparkles size={17} color="var(--sv-brass)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sv-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {t('reviewBeforeSaving')}
              </span>
            </div>
            <textarea
              rows={5}
              style={{
                width: '100%', border: '1px solid var(--sv-brass)', borderRadius: 'var(--sv-radius-md)',
                padding: 14, fontSize: 15, lineHeight: 1.5, outline: 'none', marginBottom: 16, resize: 'vertical', background: 'var(--sv-surface)',
              }}
              value={polishedText}
              onChange={(e) => setPolishedText(e.target.value)}
            />

            {videoFile && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--sv-muted)',
                marginBottom: 16, padding: '8px 12px', background: 'var(--sv-bg)', borderRadius: 'var(--sv-radius-sm)',
              }}>
                <Film size={13} />
                {t('videoWillBeAttached', { name: videoFile.name }) || `"${videoFile.name}" will be attached to this tip.`}
              </div>
            )}

            {uploadProgress !== null && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: 'var(--sv-muted)', marginBottom: 4 }}>
                  {t('uploadingVideo') || 'Uploading video…'} {uploadProgress}%
                </p>
                <div style={{ height: 6, borderRadius: 'var(--sv-radius-full)', background: 'var(--sv-border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--sv-brass)', transition: 'width 0.15s ease' }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="sv-btn sv-btn--outline" disabled={busy} onClick={reset}>{t('startOver')}</button>
              <button className="sv-btn sv-btn--primary" style={{ flex: 1 }} disabled={!polishedText.trim() || busy} onClick={saveTip}>
                {busy ? t('savingTip') : t('saveTipBtn')}
              </button>
            </div>
          </div>
        )}

        {phase === PHASE.SUCCESS && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: 'var(--sv-brass-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
            }}>
              <CheckCircle2 size={26} color="var(--sv-brass)" />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--sv-ink)', marginBottom: 6 }}>
              {t('tipSuccessTitle') || t('tipSavedSuccess')}
            </p>
            <p style={{ fontSize: 13, color: 'var(--sv-muted)', marginBottom: 18 }}>
              {t('tipSuccessBody') || 'Sent for approval.'}
            </p>

            {savedVideoUrl && (
              <video
                src={mediaUrl(savedVideoUrl)}
                controls
                style={{ width: '100%', maxHeight: 220, borderRadius: 'var(--sv-radius-md)', marginBottom: 18, background: '#000' }}
              />
            )}

            {spokenConfirmation && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                <SpeakButton text={spokenConfirmation} lang={detectedLang} label={t('playConfirmation') || t('speakAnswer')} />
              </div>
            )}

            <button className="sv-btn sv-btn--primary sv-btn--full" onClick={reset}>
              {t('shareAnotherTip') || 'Share another tip'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}