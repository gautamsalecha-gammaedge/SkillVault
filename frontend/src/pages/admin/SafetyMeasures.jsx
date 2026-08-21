import { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck, Plus, Trash2, Pencil, ChevronUp, ChevronDown,
  X, Users, EyeOff, Eye, Video, VideoOff, Loader2,
} from 'lucide-react';
import { Api, mediaUrl } from '../../lib/api';
import { useToast } from '../../lib/toast';

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
const MAX_VIDEO_BYTES = 80 * 1024 * 1024; // matches backend's 80MB limit

const LANGUAGE_OPTIONS = [
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)' },
  { code: 'mr-IN', label: 'मराठी (Marathi)' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)' },
  { code: 'ur-IN', label: 'اردو (Urdu)' },
];

const emptyForm = { title: '', content: '', language_code: 'en-IN', is_active: true };

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function MeasureForm({ initial, onCancel, onSubmit, saving }) {
  const [form, setForm] = useState(initial || emptyForm);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const inputRef = useRef(null);
  const { push } = useToast();

  useEffect(() => {
    if (!videoFile) { setVideoPreviewUrl(null); return; }
    const url = URL.createObjectURL(videoFile);
    setVideoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      push('Only MP4, WebM, MOV or AVI videos are allowed.', 'error');
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      push('Video is too large. Maximum size is 80 MB.', 'error');
      return;
    }
    setVideoFile(file);
  }

  return (
    <div className="sv-card" style={{ padding: 18, marginBottom: 14, border: '1px solid var(--sv-brass)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--sv-brass)', margin: 0 }}>
          {initial?.id ? 'Edit safety measure' : 'New safety measure'}
        </p>
        <button type="button" onClick={onCancel} aria-label="Cancel" style={{ color: 'var(--sv-muted)' }}>
          <X size={16} />
        </button>
      </div>

      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 4 }}>
        Title
      </label>
      <input
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        placeholder="e.g. Lock out the power supply before opening the guard"
        style={{
          width: '100%', fontSize: 14, borderRadius: 'var(--sv-radius-sm)', padding: '9px 12px',
          border: '1px solid var(--sv-border)', marginBottom: 12, color: 'var(--sv-ink)', background: 'var(--sv-bg)',
        }}
      />

      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 4 }}>
        Instructions (what the worker will read / hear)
      </label>
      <textarea
        value={form.content}
        onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
        placeholder="Step-by-step detail — this is what gets read aloud too, so write it the way you'd say it out loud."
        rows={4}
        style={{
          width: '100%', fontSize: 14, borderRadius: 'var(--sv-radius-sm)', padding: '9px 12px',
          border: '1px solid var(--sv-border)', marginBottom: 12, resize: 'vertical',
          color: 'var(--sv-ink)', background: 'var(--sv-bg)', fontFamily: 'inherit',
        }}
      />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 4 }}>
            Audio language
          </label>
          <select
            value={form.language_code}
            onChange={(e) => setForm((f) => ({ ...f, language_code: e.target.value }))}
            style={{
              fontSize: 13, borderRadius: 'var(--sv-radius-sm)', padding: '7px 10px',
              border: '1px solid var(--sv-border)', color: 'var(--sv-ink)', background: 'var(--sv-bg)',
            }}
          >
            {LANGUAGE_OPTIONS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--sv-ink)', marginTop: 18, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          />
          Active (visible to workers)
        </label>
      </div>

      {/* Optional video — only offered here for a brand-new measure,
          attached right after save once the measure has an id. Existing
          measures already have a video control on their row (below). */}
      {!initial?.id && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--sv-muted)', marginBottom: 4 }}>
            Video (optional)
          </label>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {videoFile && (
              <video
                src={videoPreviewUrl}
                controls
                preload="metadata"
                style={{ width: 160, maxHeight: 90, borderRadius: 'var(--sv-radius-sm)', background: '#000', display: 'block' }}
              />
            )}
            <button
              type="button"
              className="sv-btn sv-btn--outline sv-btn--sm"
              onClick={() => inputRef.current?.click()}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Video size={13} /> {videoFile ? 'Choose different video' : 'Attach video'}
            </button>
            {videoFile && (
              <button
                type="button"
                className="sv-btn sv-btn--outline sv-btn--sm"
                onClick={() => setVideoFile(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--sv-danger)' }}
              >
                <VideoOff size={13} /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="sv-btn sv-btn--outline sv-btn--sm" onClick={onCancel} type="button">Cancel</button>
        <button
          className="sv-btn sv-btn--brass sv-btn--sm"
          type="button"
          disabled={saving || !form.title.trim() || !form.content.trim()}
          onClick={() => onSubmit(form, videoFile)}
        >
          {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Add measure'}
        </button>
      </div>
    </div>
  );
}

function CompletionsPanel({ machineId, onClose }) {
  const [rows, setRows] = useState(null);
  const [retaking, setRetaking] = useState(null); // worker_id currently being reset
  const { push } = useToast();

  function load() {
    setRows(null);
    Api.safetyCompletions(machineId)
      .then((res) => setRows(res.completions || []))
      .catch((err) => push(err.message, 'error'));
  }

  useEffect(load, [machineId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRequireRetake(r) {
    if (!window.confirm(
      `Require ${r.worker_name} to go through this briefing again? They'll show as "not completed" until they do.`
    )) return;
    setRetaking(r.worker_id);
    try {
      await Api.requireSafetyRetake(machineId, r.worker_id);
      push(`${r.worker_name} will be asked to redo this briefing.`, 'success');
      load();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setRetaking(null);
    }
  }

  return (
    <div className="sv-card" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--sv-ink)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={14} /> Who has completed this briefing
        </p>
        <button type="button" onClick={onClose} aria-label="Close" style={{ color: 'var(--sv-muted)' }}>
          <X size={16} />
        </button>
      </div>
      {rows === null && <p style={{ fontSize: 13, color: 'var(--sv-muted)' }}>Loading…</p>}
      {rows?.length === 0 && <p style={{ fontSize: 13, color: 'var(--sv-muted)' }}>No one has completed this briefing yet.</p>}
      {rows && rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((r) => (
            <div key={r.worker_id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13,
              padding: '8px 10px', borderRadius: 'var(--sv-radius-sm)', background: 'var(--sv-bg)', flexWrap: 'wrap',
            }}>
              <span style={{ color: 'var(--sv-ink)', fontWeight: 500 }}>{r.worker_name} <span style={{ color: 'var(--sv-muted)', fontWeight: 400 }}>({r.worker_id})</span></span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--sv-muted)' }}>{formatDate(r.completed_at)}</span>
                <button
                  type="button"
                  onClick={() => handleRequireRetake(r)}
                  disabled={retaking === r.worker_id}
                  className="sv-btn sv-btn--outline sv-btn--sm"
                  style={{ fontSize: 12 }}
                >
                  {retaking === r.worker_id ? 'Resetting…' : 'Require retake'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Optional video for one measure - text/title/content are managed
 * entirely by MeasureForm above and untouched by this. Just a thin
 * upload/replace/remove control per row, next to the existing actions.
 */
function MeasureVideo({ measure, onChanged }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  function pickFile() {
    inputRef.current?.click();
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      push('Only MP4, WebM, MOV or AVI videos are allowed.', 'error');
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      push('Video is too large. Maximum size is 80 MB.', 'error');
      return;
    }
    setBusy(true);
    try {
      await Api.uploadSafetyVideo(measure.id, file);
      push(measure.video_url ? 'Video replaced.' : 'Video added.', 'success');
      onChanged();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!window.confirm('Remove the video from this step? The text stays.')) return;
    setBusy(true);
    try {
      await Api.deleteSafetyVideo(measure.id);
      push('Video removed.', 'success');
      onChanged();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      {measure.video_url && (
        <video
          src={mediaUrl(measure.video_url)}
          controls
          preload="metadata"
          style={{ width: 160, maxHeight: 90, borderRadius: 'var(--sv-radius-sm)', background: '#000', display: 'block' }}
        />
      )}

      <button
        type="button"
        onClick={pickFile}
        disabled={busy}
        className="sv-btn sv-btn--outline sv-btn--sm"
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        {busy ? <Loader2 size={13} className="sv-spin" /> : <Video size={13} />}
        {measure.video_url ? 'Replace video' : 'Add video'}
      </button>

      {measure.video_url && (
        <button
          type="button"
          onClick={handleRemove}
          disabled={busy}
          className="sv-btn sv-btn--outline sv-btn--sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--sv-danger)' }}
        >
          <VideoOff size={13} /> Remove
        </button>
      )}
    </div>
  );
}

export default function SafetyMeasures() {
  const { push } = useToast();
  const [allMachines, setAllMachines] = useState([]);
  const [machine, setMachine] = useState('');
  const [measures, setMeasures] = useState(null);
  const [showForm, setShowForm] = useState(false); // false | 'new' | measure object being edited
  const [saving, setSaving] = useState(false);
  const [showCompletions, setShowCompletions] = useState(false);

  useEffect(() => {
    Api.allMachines()
      .then((res) => {
        setAllMachines(res.machine_ids || []);
        if (res.machine_ids?.length) setMachine(res.machine_ids[0]);
      })
      .catch((err) => push(err.message, 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadMeasures(machineId) {
    if (!machineId) return;
    setMeasures(null);
    Api.adminSafetyMeasures(machineId)
      .then((res) => setMeasures(res.measures || []))
      .catch((err) => push(err.message, 'error'));
  }

  useEffect(() => {
    setShowForm(false);
    setShowCompletions(false);
    if (machine) loadMeasures(machine);
  }, [machine]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(form, videoFile) {
    setSaving(true);
    try {
      if (showForm?.id) {
        await Api.updateSafetyMeasure(showForm.id, {
          title: form.title.trim(),
          content: form.content.trim(),
          language_code: form.language_code,
          is_active: form.is_active,
        });
        push('Safety measure updated.', 'success');
      } else {
        const nextOrder = (measures?.length ? Math.max(...measures.map((m) => m.sort_order)) : 0) + 1;
        const res = await Api.createSafetyMeasure({
          machine_id: machine,
          title: form.title.trim(),
          content: form.content.trim(),
          language_code: form.language_code,
          is_active: form.is_active,
          sort_order: nextOrder,
        });
        push('Safety measure added.', 'success');

        // Text is already saved at this point - a video upload failure
        // here shouldn't look like the whole save failed.
        if (videoFile && res?.measure?.id) {
          try {
            await Api.uploadSafetyVideo(res.measure.id, videoFile);
          } catch (videoErr) {
            push(`Measure saved, but the video failed to upload: ${videoErr.message}`, 'error');
          }
        }
      }
      setShowForm(false);
      loadMeasures(machine);
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(m) {
    try {
      await Api.updateSafetyMeasure(m.id, { is_active: !m.is_active });
      loadMeasures(machine);
    } catch (err) {
      push(err.message, 'error');
    }
  }

  async function deleteMeasure(m) {
    if (!window.confirm(`Remove "${m.title}"? Workers will no longer see this step.`)) return;
    try {
      await Api.deleteSafetyMeasure(m.id);
      push('Safety measure removed.', 'success');
      loadMeasures(machine);
    } catch (err) {
      push(err.message, 'error');
    }
  }

  async function move(m, direction) {
    const idx = measures.findIndex((x) => x.id === m.id);
    const swapWith = measures[idx + direction];
    if (!swapWith) return;
    try {
      await Api.reorderSafetyMeasures([
        { id: m.id, sort_order: swapWith.sort_order },
        { id: swapWith.id, sort_order: m.sort_order },
      ]);
      loadMeasures(machine);
    } catch (err) {
      push(err.message, 'error');
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 720 }}>
      <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 20, color: 'var(--sv-ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldCheck size={20} color="var(--sv-brass)" /> Safety measures
      </p>
      <p style={{ fontSize: 13, color: 'var(--sv-muted)', marginBottom: 20 }}>
        Ordered safety steps workers go through — in text and audio — before starting work on a machine.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <select
          value={machine}
          onChange={(e) => setMachine(e.target.value)}
          style={{
            fontSize: 13, fontWeight: 600, borderRadius: 'var(--sv-radius-sm)', padding: '8px 12px',
            background: 'var(--sv-brass-soft)', color: 'var(--sv-brass)', border: '1px solid var(--sv-border)',
          }}
        >
          {allMachines.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        <button
          className="sv-btn sv-btn--brass sv-btn--sm"
          onClick={() => setShowForm('new')}
          disabled={!machine}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={14} /> Add measure
        </button>

        <button
          className="sv-btn sv-btn--outline sv-btn--sm"
          onClick={() => setShowCompletions((s) => !s)}
          disabled={!machine}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Users size={14} /> Completions
        </button>
      </div>

      {showForm === 'new' && (
        <MeasureForm
          initial={{ ...emptyForm }}
          onCancel={() => setShowForm(false)}
          onSubmit={handleSubmit}
          saving={saving}
        />
      )}
      {showForm && showForm !== 'new' && (
        <MeasureForm
          initial={showForm}
          onCancel={() => setShowForm(false)}
          onSubmit={handleSubmit}
          saving={saving}
        />
      )}

      {showCompletions && machine && (
        <CompletionsPanel machineId={machine} onClose={() => setShowCompletions(false)} />
      )}

      {measures === null && <p style={{ fontSize: 13, color: 'var(--sv-muted)' }}>Loading…</p>}
      {measures?.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--sv-muted)' }}>No safety measures added for {machine} yet.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {measures?.map((m, i) => (
          <div
            key={m.id}
            className="sv-card"
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14,
              opacity: m.is_active ? 1 : 0.55,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 2 }}>
              <button
                type="button"
                onClick={() => move(m, -1)}
                disabled={i === 0}
                aria-label="Move up"
                style={{ color: i === 0 ? 'var(--sv-muted-light)' : 'var(--sv-muted)' }}
              >
                <ChevronUp size={15} />
              </button>
              <button
                type="button"
                onClick={() => move(m, 1)}
                disabled={i === measures.length - 1}
                aria-label="Move down"
                style={{ color: i === measures.length - 1 ? 'var(--sv-muted-light)' : 'var(--sv-muted)' }}
              >
                <ChevronDown size={15} />
              </button>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--sv-muted)', background: 'var(--sv-bg)',
                  border: '1px solid var(--sv-border)', borderRadius: 'var(--sv-radius-full)', padding: '1px 8px',
                }}>
                  {i + 1}
                </span>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--sv-ink)', margin: 0 }}>{m.title}</p>
                {!m.is_active && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--sv-muted)' }}>
                    Inactive
                  </span>
                )}
              </div>
              <p style={{
                fontSize: 13, color: 'var(--sv-muted)', margin: '0 0 4px',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {m.content}
              </p>
              <span style={{ fontSize: 11, color: 'var(--sv-muted-light)' }}>
                {LANGUAGE_OPTIONS.find((l) => l.code === m.language_code)?.label || m.language_code}
              </span>

              <MeasureVideo measure={m} onChanged={() => loadMeasures(machine)} />
            </div>

            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => toggleActive(m)}
                aria-label={m.is_active ? 'Deactivate' : 'Activate'}
                title={m.is_active ? 'Deactivate' : 'Activate'}
                style={{ color: 'var(--sv-muted)' }}
              >
                {m.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <button type="button" onClick={() => setShowForm(m)} aria-label="Edit" style={{ color: 'var(--sv-muted)' }}>
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={() => deleteMeasure(m)}
                aria-label="Delete"
                className="sv-btn--danger-text"
                style={{ color: 'var(--sv-danger)' }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}