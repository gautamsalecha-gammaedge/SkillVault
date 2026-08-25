import { useEffect, useRef, useState, useCallback } from 'react';
import { Reorder, motion, AnimatePresence } from 'framer-motion';
import {
  GripVertical, Plus, Trash2, Video, X, Users, Pencil, Save,
  ShieldCheck, Play, Clock, RotateCcw, Film, CheckCircle2,
} from 'lucide-react';
import { api, mediaUrl, ApiError } from '../../lib/api';
import {
  PageHeader, Select, Card, Button, FullPageLoader, EmptyState, Badge,
} from '../../components/ui';
import { useToast } from '../../components/Toast';

/**
 * Admin Safety Measures
 * - Fixed first-load blank: wait for machines + measures together
 * - Edit / Add use a full right-side studio drawer (not a plain form modal)
 * - Completions is a proper in-page panel
 */

function sortMeasures(list) {
  return (list || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export default function SafetyMeasures() {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [machines, setMachines] = useState([]);
  const [machineId, setMachineId] = useState('');
  const [loading, setLoading] = useState(true);
  const [measuresLoading, setMeasuresLoading] = useState(false);
  const [measures, setMeasures] = useState([]);
  const [panel, setPanel] = useState(null); // null | 'create' | 'edit' | 'completions'
  const [editing, setEditing] = useState(null);
  const [completions, setCompletions] = useState([]);
  const [completionsLoading, setCompletionsLoading] = useState(false);

  // Always start at top of page when opening this route
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Single sequential bootstrap: machines THEN first machine's measures.
  // Avoids the race where machineId was set and loading flipped false before measures arrived
  // (blank page on first nav; content only after clicking Safety Measures again).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await api.allMachines();
        if (cancelled) return;
        const ids = Array.isArray(r?.machine_ids) ? r.machine_ids : [];
        setMachines(ids);
        if (!ids.length) {
          setMachineId('');
          setMeasures([]);
          return;
        }
        const mid = ids[0];
        setMachineId(mid);
        const mr = await api.adminSafetyMeasures(mid);
        if (cancelled) return;
        setMeasures(sortMeasures(mr?.measures));
      } catch (err) {
        if (!cancelled) {
          setMachines([]);
          setMachineId('');
          setMeasures([]);
          toastRef.current.error(
            err instanceof ApiError ? err.message : 'Could not load safety measures.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadMeasures = useCallback(async (mid, { fullPage = false } = {}) => {
    if (!mid) {
      setMeasures([]);
      if (fullPage) setLoading(false);
      setMeasuresLoading(false);
      return;
    }
    if (fullPage) setLoading(true);
    else setMeasuresLoading(true);
    try {
      const r = await api.adminSafetyMeasures(mid);
      setMeasures(sortMeasures(r?.measures));
    } catch (err) {
      setMeasures([]);
      toastRef.current.error(err instanceof ApiError ? err.message : 'Could not load safety steps.');
    } finally {
      setMeasuresLoading(false);
      if (fullPage) setLoading(false);
    }
  }, []);

  const changeMachine = (mid) => {
    if (!mid || mid === machineId) return;
    setMachineId(mid);
    setPanel(null);
    setEditing(null);
    loadMeasures(mid, { fullPage: false });
  };

  const reorder = async (newOrder) => {
    setMeasures(newOrder);
    const items = newOrder.map((m, i) => ({ id: m.id, sort_order: i + 1 }));
    try {
      await api.reorderSafetyMeasures(items);
    } catch {
      toast.error('Could not save order.');
      loadMeasures(machineId, { fullPage: false });
    }
  };

  const remove = async (id) => {
    try {
      await api.deleteSafetyMeasure(id);
      setMeasures((m) => m.filter((x) => x.id !== id));
      if (editing?.id === id) {
        setPanel(null);
        setEditing(null);
      }
      toast.info('Step deactivated.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete.');
    }
  };

  const openCompletions = async () => {
    setPanel('completions');
    setCompletionsLoading(true);
    try {
      const r = await api.safetyCompletions(machineId);
      setCompletions(r.completions || []);
    } catch (err) {
      setCompletions([]);
      toast.error(err instanceof ApiError ? err.message : 'Could not load completions.');
    } finally {
      setCompletionsLoading(false);
    }
  };

  const openEdit = (m) => {
    setEditing(m);
    setPanel('edit');
  };

  const openCreate = () => {
    setEditing(null);
    setPanel('create');
  };

  const closePanel = () => {
    setPanel(null);
    setEditing(null);
  };

  return (
    <div className="max-w-5xl relative">
      <PageHeader
        eyebrow="Safety"
        title="Safety measures"
        description="Ordered steps every worker completes before starting on a machine. Drag to reorder. Edit or add steps in the studio panel."
        actions={
          !loading && (
            <div className="flex flex-wrap items-center gap-2">
              {machines.length > 0 && (
                <Select
                  value={machineId}
                  onChange={(e) => changeMachine(e.target.value)}
                  className="min-w-[160px]"
                >
                  {machines.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Select>
              )}
              {machineId && (
                <>
                  <Button size="sm" variant="ghost" icon={Users} onClick={openCompletions}>
                    Completions
                  </Button>
                  <Button size="sm" icon={Plus} onClick={openCreate}>
                    Add step
                  </Button>
                </>
              )}
            </div>
          )
        }
      />

      {loading ? (
        <FullPageLoader label="Loading safety measures…" />
      ) : !machines.length ? (
        <EmptyState
          icon={ShieldCheck}
          title="No machines yet"
          description="Upload a manual for a machine first — safety steps are scoped per machine."
        />
      ) : measuresLoading ? (
        <div className="flex items-center justify-center py-24 text-muted text-sm gap-2">
          <span className="w-5 h-5 border-2 border-signal/30 border-t-signal rounded-full animate-spin" />
          Loading steps for {machineId}…
        </div>
      ) : measures.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No safety steps yet"
          description="Add the first step for this machine. Workers will complete the sequence before operating."
          action={
            <Button icon={Plus} onClick={openCreate}>
              Add first step
            </Button>
          }
        />
      ) : (
        <Reorder.Group axis="y" values={measures} onReorder={reorder} className="space-y-3">
          {measures.map((m, index) => (
            <Reorder.Item key={m.id} value={m} className="list-none">
              <Card
                className={`p-5 relative overflow-hidden ${!m.is_active ? 'opacity-60' : ''}`}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-signal via-signal/50 to-transparent" />
                <div className="flex items-start gap-3 pl-2">
                  <div className="cursor-grab active:cursor-grabbing text-muted/70 hover:text-text pt-1 shrink-0">
                    <GripVertical size={18} />
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-signal/10 border border-signal/25 flex items-center justify-center font-mono text-sm font-bold text-signal shrink-0">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-display font-bold text-base truncate">{m.title}</h3>
                      {!m.is_active && <Badge tone="default">Inactive</Badge>}
                      {m.video_url && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-signal">
                          <Film size={11} /> Video
                        </span>
                      )}
                    </div>
                    <p className="text-[15px] text-muted leading-relaxed line-clamp-2">{m.content}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(m)}
                      className="w-9 h-9 rounded-xl border-2 border-line flex items-center justify-center text-muted hover:text-signal hover:border-signal/40 transition-colors"
                      title="Edit step"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      className="w-9 h-9 rounded-xl border-2 border-line flex items-center justify-center text-muted hover:text-danger hover:border-danger/40 transition-colors"
                      title="Deactivate"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </Card>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      {/* Studio drawer: create / edit / completions */}
      <AnimatePresence>
        {panel && (
          <StudioPanel
            mode={panel}
            machineId={machineId}
            measure={editing}
            sortOrder={measures.length + 1}
            completions={completions}
            completionsLoading={completionsLoading}
            onClose={closePanel}
            onSaved={() => {
              closePanel();
              loadMeasures(machineId, { fullPage: false });
            }}
            onRetake={async (workerId) => {
              try {
                await api.requireRetake(machineId, workerId);
                setCompletions((cs) => cs.filter((x) => x.worker_id !== workerId));
                toast.info('Retake required for that worker.');
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : 'Could not require retake.');
              }
            }}
            toast={toast}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Studio side panel (create / edit / completions) ─── */

function StudioPanel({
  mode,
  machineId,
  measure,
  sortOrder,
  completions,
  completionsLoading,
  onClose,
  onSaved,
  onRetake,
  toast,
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[180] bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="fixed top-0 right-0 z-[190] h-full w-full max-w-lg bg-surface border-l-2 border-line shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === 'completions' ? (
          <CompletionsPanel
            machineId={machineId}
            completions={completions}
            loading={completionsLoading}
            onClose={onClose}
            onRetake={onRetake}
          />
        ) : mode === 'edit' && measure ? (
          <MeasureEditor
            key={measure.id}
            mode="edit"
            machineId={machineId}
            measure={measure}
            onClose={onClose}
            onSaved={onSaved}
            toast={toast}
          />
        ) : (
          <MeasureEditor
            mode="create"
            machineId={machineId}
            sortOrder={sortOrder}
            onClose={onClose}
            onSaved={onSaved}
            toast={toast}
          />
        )}
      </motion.aside>
    </>
  );
}

function CompletionsPanel({ machineId, completions, loading, onClose, onRetake }) {
  return (
    <>
      <div className="shrink-0 px-6 pt-6 pb-4 border-b-2 border-line">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-signal mb-1">Completions</p>
            <h2 className="font-display font-bold text-2xl tracking-tight">Who finished the briefing</h2>
            <p className="text-sm text-muted mt-1.5">
              Machine <span className="font-mono text-text">{machineId}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl border-2 border-line flex items-center justify-center text-muted hover:text-text"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
            <span className="w-5 h-5 border-2 border-signal/30 border-t-signal rounded-full animate-spin" />
            Loading completions…
          </div>
        ) : completions.length === 0 ? (
          <div className="text-center py-16">
            <Users size={28} className="mx-auto text-muted mb-3" />
            <p className="font-display font-bold text-lg">No completions yet</p>
            <p className="text-sm text-muted mt-1 max-w-xs mx-auto">
              When a worker finishes this machine&apos;s safety sequence, they will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {completions.map((c) => (
              <div
                key={c.worker_id + (c.completed_at || '')}
                className="rounded-2xl border-2 border-line bg-surface-2/80 p-4 flex items-center gap-3"
              >
                <div className="w-11 h-11 rounded-full bg-signal/15 border border-signal/30 flex items-center justify-center text-signal shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{c.worker_name || c.worker_id}</p>
                  <p className="font-mono text-[11px] text-muted">{c.worker_id}</p>
                  <p className="text-xs text-muted mt-1 inline-flex items-center gap-1">
                    <Clock size={12} />
                    {c.completed_at ? new Date(c.completed_at).toLocaleString() : '—'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={RotateCcw}
                  onClick={() => onRetake(c.worker_id)}
                  className="shrink-0"
                >
                  Require retake
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function MeasureEditor({ mode, machineId, measure, sortOrder = 1, onClose, onSaved, toast }) {
  const isEdit = mode === 'edit';
  const [title, setTitle] = useState(measure?.title || '');
  const [content, setContent] = useState(measure?.content || '');
  const [languageCode, setLanguageCode] = useState(measure?.language_code || 'en-IN');
  const [isActive, setIsActive] = useState(measure?.is_active !== false);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(
    measure?.video_url ? mediaUrl(measure.video_url) : null,
  );
  const [removeExistingVideo, setRemoveExistingVideo] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    return () => {
      if (videoPreview && videoFile) URL.revokeObjectURL(videoPreview);
    };
  }, [videoPreview, videoFile]);

  const onPickVideo = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (videoPreview && videoFile) URL.revokeObjectURL(videoPreview);
    setVideoFile(f);
    setVideoPreview(URL.createObjectURL(f));
    setRemoveExistingVideo(false);
    e.target.value = '';
  };

  const clearVideo = () => {
    if (videoPreview && videoFile) URL.revokeObjectURL(videoPreview);
    setVideoFile(null);
    setVideoPreview(null);
    if (isEdit && measure?.video_url) setRemoveExistingVideo(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('Title and instructions are required.');
      return;
    }
    setSaving(true);
    try {
      let measureId = measure?.id;
      if (isEdit) {
        await api.updateSafetyMeasure(measure.id, {
          title: title.trim(),
          content: content.trim(),
          language_code: languageCode,
          is_active: isActive,
        });
        if (removeExistingVideo && measure.video_url) {
          await api.removeSafetyVideo(measure.id);
        }
        if (videoFile) {
          await api.uploadSafetyVideo(measure.id, videoFile);
        }
        toast.success('Step updated.');
      } else {
        const res = await api.createSafetyMeasure({
          title: title.trim(),
          content: content.trim(),
          machine_id: machineId,
          sort_order: sortOrder,
          language_code: languageCode,
          is_active: true,
        });
        measureId = res.measure?.id;
        if (videoFile && measureId) {
          await api.uploadSafetyVideo(measureId, videoFile);
        }
        toast.success('Step added.');
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : isEdit ? 'Could not update step.' : 'Could not create step.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="shrink-0 px-6 pt-6 pb-4 border-b-2 border-line relative overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse 80% 80% at 0% 0%, rgba(15,157,138,0.12), transparent 55%), var(--color-surface, #fffcf8)',
        }}
      >
        <div className="flex items-start justify-between gap-3 relative">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-signal mb-1">
              {isEdit ? 'Edit step' : 'New step'}
            </p>
            <h2 className="font-display font-bold text-2xl tracking-tight">
              {isEdit ? 'Refine this safety measure' : 'Craft a safety step'}
            </h2>
            <p className="text-sm text-muted mt-1.5 max-w-sm leading-relaxed">
              {isEdit
                ? 'Update the title, instructions, or demo video. Workers see the active version on their next briefing.'
                : 'Write clear, actionable instructions workers hear and read before they touch the machine.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl border-2 border-line flex items-center justify-center text-muted hover:text-text"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <form onSubmit={submit} className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <label className="block">
            <span className="block text-[11px] font-mono uppercase tracking-wider text-muted mb-1.5">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Check emergency stop"
              className="w-full rounded-xl border-2 border-line bg-surface-2 px-4 py-3 text-[15px] outline-none focus:border-signal"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-mono uppercase tracking-wider text-muted mb-1.5">Instructions</span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={7}
              placeholder="Step-by-step what the worker must do or verify…"
              className="w-full rounded-xl border-2 border-line bg-surface-2 px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-signal resize-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[11px] font-mono uppercase tracking-wider text-muted mb-1.5">Language</span>
              <select
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                className="w-full h-11 rounded-xl border-2 border-line bg-surface-2 px-3 text-sm outline-none focus:border-signal"
              >
                <option value="en-IN">English (India)</option>
                <option value="hi-IN">Hindi</option>
                <option value="en-US">English (US)</option>
              </select>
            </label>
            {isEdit && (
              <label className="block">
                <span className="block text-[11px] font-mono uppercase tracking-wider text-muted mb-1.5">Status</span>
                <button
                  type="button"
                  onClick={() => setIsActive((v) => !v)}
                  className={`w-full h-11 rounded-xl border-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'border-signal/40 bg-signal/10 text-signal'
                      : 'border-line bg-surface-2 text-muted'
                  }`}
                >
                  {isActive ? 'Active' : 'Inactive'}
                </button>
              </label>
            )}
          </div>

          {/* Video studio */}
          <div>
            <span className="block text-[11px] font-mono uppercase tracking-wider text-muted mb-2">
              Demo video <span className="normal-case tracking-normal text-muted/80">(optional)</span>
            </span>
            {videoPreview && !removeExistingVideo ? (
              <div className="rounded-2xl border-2 border-line overflow-hidden bg-black/90 relative">
                <video src={videoPreview} controls className="w-full max-h-52 object-contain" />
                <div className="absolute top-2 right-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold bg-black/60 text-white border border-white/20 hover:bg-black/80"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={clearVideo}
                    className="w-8 h-8 rounded-full bg-black/60 text-white border border-white/20 flex items-center justify-center hover:bg-danger/80"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-2xl border-2 border-dashed border-line bg-surface-2/80 py-10 px-4 flex flex-col items-center gap-2 hover:border-signal/50 hover:bg-signal/5 transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-signal/10 border border-signal/25 flex items-center justify-center text-signal group-hover:scale-105 transition-transform">
                  <Video size={22} />
                </div>
                <p className="text-sm font-semibold text-text">Drop or choose a short demo</p>
                <p className="text-xs text-muted">MP4, WebM, MOV · shows beside this step for workers</p>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
              onChange={onPickVideo}
              className="hidden"
            />
          </div>
        </div>

        <div className="shrink-0 px-6 py-4 border-t-2 border-line bg-surface-2/40 flex gap-2">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" icon={isEdit ? Save : Plus} loading={saving} className="flex-1">
            {isEdit ? 'Save step' : 'Add step'}
          </Button>
        </div>
      </form>
    </>
  );
}