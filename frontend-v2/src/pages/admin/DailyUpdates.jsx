import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, Factory, Search, NotebookPen,
  ChevronLeft, ChevronRight, User, X, CheckCheck,
  Circle, ArrowRight, MailOpen, Filter, LayoutGrid, Database,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { Card, Button, FullPageLoader } from '../../components/ui';
import { useToast } from '../../components/Toast';
import SpeakButton from '../../components/SpeakButton';

const READ_KEY = 'sv_admin_daily_read_ids';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDay(iso, delta) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function niceDate(iso) {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {
      weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function timeLabel(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function loadReadSet() {
  try {
    const raw = localStorage.getItem(READ_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveReadSet(set) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...set]));
  } catch (_) {}
}

export default function AdminDailyUpdates() {
  const toast = useToast();
  const [tab, setTab] = useState('day'); // day | browse
  const [reportDate, setReportDate] = useState(todayISO());
  const [machineFilter, setMachineFilter] = useState('all');
  const [updates, setUpdates] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [readIds, setReadIds] = useState(() => loadReadSet());
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  // Browse tab filters
  const [fromDate, setFromDate] = useState(() => shiftDay(todayISO(), -7));
  const [toDate, setToDate] = useState(todayISO());
  const [browseMachine, setBrowseMachine] = useState('');
  const [browseWorker, setBrowseWorker] = useState('');
  const [browseRows, setBrowseRows] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseWorkers, setBrowseWorkers] = useState([]);
  const [browseMachines, setBrowseMachines] = useState([]);

  const loadDay = useCallback(async (day) => {
    setLoading(true);
    setSelected(null);
    setMachineFilter('all');
    try {
      const res = await api.adminDailyUpdates({ report_date: day });
      setUpdates(res.updates || []);
      setMachines(res.machines || []);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load daily updates.');
      setUpdates([]);
      setMachines([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (tab === 'day') loadDay(reportDate);
  }, [reportDate, tab, loadDay]);

  const runBrowse = async () => {
    setBrowseLoading(true);
    setSelected(null);
    try {
      const res = await api.adminDailyUpdates({
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        machine_id: browseMachine || undefined,
        worker_id: browseWorker.trim() || undefined,
        limit: 300,
      });
      setBrowseRows(res.updates || []);
      setBrowseMachines(res.machines || []);
      setBrowseWorkers(res.workers || []);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Browse failed.');
      setBrowseRows([]);
    } finally {
      setBrowseLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'browse') runBrowse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const markRead = (id) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadSet(next);
      return next;
    });
  };

  const markUnread = (id) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      saveReadSet(next);
      return next;
    });
  };

  const openUpdate = (u) => {
    setSelected(u);
    markRead(u.id);
  };

  const machineCounts = useMemo(() => {
    const map = { general: 0 };
    for (const u of updates) {
      if (!u.machine_id) map.general += 1;
      else map[u.machine_id] = (map[u.machine_id] || 0) + 1;
    }
    return map;
  }, [updates]);

  const unreadCount = useMemo(
    () => updates.filter((u) => !readIds.has(u.id)).length,
    [updates, readIds],
  );

  const visible = useMemo(() => {
    let list = updates;
    if (machineFilter === 'general') list = list.filter((u) => !u.machine_id);
    else if (machineFilter !== 'all') list = list.filter((u) => u.machine_id === machineFilter);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((u) => {
        const blob = `${u.worker_name || ''} ${u.worker_id || ''} ${u.machine_id || ''} ${u.optimized_text || ''}`.toLowerCase();
        return blob.includes(needle);
      });
    }
    if (showUnreadOnly) list = list.filter((u) => !readIds.has(u.id));
    return [...list].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }, [updates, machineFilter, q, showUnreadOnly, readIds]);

  const relatedForSelected = useMemo(() => {
    if (!selected) return [];
    const pool = tab === 'browse' ? browseRows : updates;
    return pool.filter((u) => u.worker_id === selected.worker_id && u.id !== selected.id);
  }, [selected, updates, browseRows, tab]);

  const weekDays = useMemo(() => {
    const center = new Date(reportDate + 'T12:00:00');
    const start = new Date(center);
    start.setDate(center.getDate() - 3);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return {
        iso,
        day: d.toLocaleDateString(undefined, { weekday: 'short' }),
        num: d.getDate(),
        isToday: iso === todayISO(),
        isActive: iso === reportDate,
      };
    });
  }, [reportDate]);

  return (
    <div className="max-w-6xl mx-auto w-full pb-14">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-700 mb-2">Supervisor desk</p>
          <h1 className="text-3xl font-semibold tracking-tight text-text">Daily updates</h1>
          <p className="text-sm text-muted mt-1.5 max-w-lg leading-relaxed">
            Review floor notes by day, or search any date range, worker, or machine.
          </p>
        </div>
        <div className="inline-flex p-1 rounded-2xl bg-stone-200/60 border border-line shadow-inner">
          <TabBtn active={tab === 'day'} onClick={() => setTab('day')} icon={LayoutGrid}>By day</TabBtn>
          <TabBtn active={tab === 'browse'} onClick={() => setTab('browse')} icon={Database}>Browse all</TabBtn>
        </div>
      </div>

      {tab === 'day' ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard label="Selected day" value={reportDate.slice(5)} sub={niceDate(reportDate).split(',')[0]} />
            <StatCard label="Updates" value={updates.length} />
            <StatCard label="Unread" value={unreadCount} accent={unreadCount > 0} />
            <StatCard label="Machines" value={machines.length} />
          </div>

          {/* Date navigator */}
          <div className="rounded-3xl border border-line bg-white/80 backdrop-blur shadow-sm p-5 mb-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <CalendarDays size={13} /> Calendar
              </p>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setReportDate((d) => shiftDay(d, -7))} className="text-xs font-medium text-muted hover:text-text px-2 py-1 rounded-lg hover:bg-surface-2">−7d</button>
                <Button variant="ghost" size="sm" onClick={() => setReportDate(todayISO())}>Today</Button>
                <button type="button" onClick={() => setReportDate((d) => shiftDay(d, 7))} className="text-xs font-medium text-muted hover:text-text px-2 py-1 rounded-lg hover:bg-surface-2">+7d</button>
                <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="ml-1 h-8 rounded-lg border border-line bg-surface-2 px-2 text-xs" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <IconBtn onClick={() => setReportDate((d) => shiftDay(d, -1))} aria="Prev"><ChevronLeft size={18} /></IconBtn>
              <div className="flex-1 grid grid-cols-7 gap-2">
                {weekDays.map((d) => (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => setReportDate(d.iso)}
                    className={`relative rounded-2xl py-3 text-center transition-all ${
                      d.isActive
                        ? 'bg-teal-700 text-white shadow-lg shadow-teal-700/25 scale-[1.02]'
                        : d.isToday
                          ? 'bg-teal-50 text-teal-900 ring-1 ring-teal-700/30'
                          : 'bg-stone-50 text-text hover:bg-stone-100'
                    }`}
                  >
                    <p className={`text-[10px] font-semibold uppercase tracking-wide ${d.isActive ? 'text-white/75' : 'text-muted'}`}>{d.day}</p>
                    <p className="text-base font-bold tabular-nums mt-0.5">{d.num}</p>
                  </button>
                ))}
              </div>
              <IconBtn onClick={() => setReportDate((d) => shiftDay(d, 1))} aria="Next"><ChevronRight size={18} /></IconBtn>
            </div>
          </div>

          {/* Machine: All + General + searchable dropdown */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted mr-1 flex items-center gap-1 shrink-0">
              <Filter size={12} /> Machine
            </span>
            <Chip active={machineFilter === 'all'} onClick={() => setMachineFilter('all')} label="All" count={updates.length} />
            <Chip active={machineFilter === 'general'} onClick={() => setMachineFilter('general')} label="General" count={machineCounts.general || 0} />
            <MachineSearchSelect
              machines={machines}
              counts={machineCounts}
              value={machineFilter}
              onChange={setMachineFilter}
            />
            {machineFilter !== 'all' && machineFilter !== 'general' && (
              <span className="text-[11px] text-teal-800 font-medium px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-700/20">
                {machineFilter}
                <button type="button" className="ml-1.5 text-teal-700/70 hover:text-teal-900" onClick={() => setMachineFilter('all')} aria-label="Clear machine">×</button>
              </span>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search worker or text…" className="w-full h-10 rounded-xl border border-line bg-white pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700" />
            </div>
            <button type="button" onClick={() => setShowUnreadOnly((v) => !v)} className={`h-10 px-3.5 rounded-xl text-xs font-semibold border transition-colors ${showUnreadOnly ? 'border-amber-400 bg-amber-50 text-amber-950' : 'border-line bg-white text-muted hover:text-text'}`}>
              Unread only
            </button>
            {visible.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setReadIds((prev) => {
                    const next = new Set(prev);
                    visible.forEach((u) => next.add(u.id));
                    saveReadSet(next);
                    return next;
                  });
                  toast.success('Marked visible as read.');
                }}
                className="h-10 px-3.5 rounded-xl text-xs font-semibold border border-line bg-white text-muted hover:text-text inline-flex items-center gap-1.5"
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          {loading ? (
            <FullPageLoader label="Loading…" />
          ) : (
            <SplitList
              rows={visible}
              selected={selected}
              readIds={readIds}
              onOpen={openUpdate}
              onClose={() => setSelected(null)}
              onMarkRead={markRead}
              onMarkUnread={markUnread}
              related={relatedForSelected}
              empty="No updates for this day and filter."
            />
          )}
        </>
      ) : (
        /* ========== BROWSE ALL ========== */
        <>
          <div className="rounded-3xl border border-line bg-white/80 shadow-sm p-5 mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-4 flex items-center gap-1.5">
              <Database size={13} /> Filter archive
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="From date">
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full h-10 rounded-xl border border-line bg-surface-2 px-3 text-sm" />
              </Field>
              <Field label="To date">
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full h-10 rounded-xl border border-line bg-surface-2 px-3 text-sm" />
              </Field>
              <Field label="Machine">
                <select value={browseMachine} onChange={(e) => setBrowseMachine(e.target.value)} className="w-full h-10 rounded-xl border border-line bg-surface-2 px-3 text-sm">
                  <option value="">All machines</option>
                  <option value="__general__">General only</option>
                  {[...new Set([...browseMachines, ...machines])].sort().map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Worker ID">
                <input value={browseWorker} onChange={(e) => setBrowseWorker(e.target.value)} placeholder="e.g. W116" className="w-full h-10 rounded-xl border border-line bg-surface-2 px-3 text-sm font-mono" list="worker-id-list" />
                <datalist id="worker-id-list">
                  {browseWorkers.map((w) => (
                    <option key={w} value={w} />
                  ))}
                </datalist>
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="amber" onClick={runBrowse} loading={browseLoading} icon={Search}>Apply filters</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setFromDate(shiftDay(todayISO(), -7));
                  setToDate(todayISO());
                  setBrowseMachine('');
                  setBrowseWorker('');
                  setTimeout(runBrowse, 0);
                }}
              >
                Reset (last 7 days)
              </Button>
              <p className="text-xs text-muted self-center ml-auto tabular-nums">{browseRows.length} result{browseRows.length === 1 ? '' : 's'}</p>
            </div>
          </div>

          {browseLoading ? (
            <FullPageLoader label="Searching…" />
          ) : (
            <SplitList
              rows={browseRows}
              selected={selected}
              readIds={readIds}
              onOpen={openUpdate}
              onClose={() => setSelected(null)}
              onMarkRead={markRead}
              onMarkUnread={markUnread}
              related={relatedForSelected}
              empty="No updates match these filters."
              showDate
            />
          )}
        </>
      )}
    </div>
  );
}

function SplitList({ rows, selected, readIds, onOpen, onClose, onMarkRead, onMarkUnread, related, empty, showDate }) {
  return (
    <div className={`grid gap-5 items-start ${selected ? 'lg:grid-cols-[minmax(260px,320px)_1fr]' : ''}`}>
      <div className={`rounded-3xl border border-line bg-white shadow-sm overflow-hidden min-h-[200px] ${selected ? "lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto" : ""}`}>
        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <NotebookPen className="mx-auto text-stone-300 mb-3" size={32} />
            <p className="text-sm text-muted">{empty}</p>
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {rows.map((u) => {
              const isRead = readIds.has(u.id);
              const active = selected?.id === u.id;
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(u)}
                    className={`w-full flex items-center gap-3.5 px-5 py-4 text-left transition-colors ${
                      active ? 'bg-teal-50/90' : 'hover:bg-stone-50'
                    }`}
                  >
                    <span className="shrink-0 w-4 flex justify-center">
                      {isRead ? <MailOpen size={15} className="text-stone-300" /> : <Circle size={10} className="text-amber-500 fill-amber-500" />}
                    </span>
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-700/15 to-teal-700/5 border border-teal-700/15 flex items-center justify-center text-teal-800 shrink-0">
                      <User size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={`text-sm ${isRead ? 'font-medium text-stone-700' : 'font-semibold text-stone-900'}`}>
                          {u.worker_name || 'Worker'}
                        </span>
                        <span className="text-[11px] font-mono text-stone-400">{u.worker_id}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200/80">
                          {u.machine_id || 'General'}
                        </span>
                        {showDate && (
                          <span className="text-[10px] text-stone-400">{u.report_date}</span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500 mt-1 truncate leading-relaxed">
                        {timeLabel(u.created_at)}
                        {' · '}
                        {(u.optimized_text || '').replace(/\s+/g, ' ').slice(0, 100)}
                        {(u.optimized_text || '').length > 100 ? '…' : ''}
                      </p>
                    </div>
                    <ArrowRight size={15} className="text-stone-300 shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.aside
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="lg:sticky lg:top-4 h-fit"
          >
            <div className="rounded-3xl border border-teal-700/20 bg-white shadow-xl shadow-stone-200/50 overflow-hidden min-h-[420px] lg:min-h-[calc(100vh-10rem)] flex flex-col">
              <div className="px-6 sm:px-8 py-5 bg-gradient-to-r from-teal-700 to-teal-800 text-white shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70 mb-1.5">Update detail</p>
                    <p className="font-semibold truncate text-xl sm:text-2xl tracking-tight">{selected.worker_name}</p>
                    <p className="text-sm font-mono text-white/75 mt-0.5">{selected.worker_id}</p>
                  </div>
                  <button type="button" onClick={onClose} className="w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center shrink-0" aria-label="Close">
                    <X size={18} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/15 backdrop-blur">
                    {selected.machine_id || 'General'}
                  </span>
                  <span className="text-xs px-3 py-1.5 rounded-full bg-white/10">
                    {selected.report_date} · {timeLabel(selected.created_at)}
                  </span>
                </div>
              </div>

              <div className="p-6 sm:p-8 flex-1 flex flex-col min-h-0">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Polished update</p>
                  {!!(selected.optimized_text || '').trim() && (
                    <SpeakButton
                      text={selected.optimized_text}
                      language_code={selected.language_code || 'en-IN'}
                      label="Listen"
                    />
                  )}
                </div>
                <div className="rounded-2xl bg-stone-50 border border-stone-100 px-5 sm:px-6 py-5 flex-1 min-h-[280px] max-h-[min(70vh,640px)] overflow-y-auto">
                  <p className="text-base sm:text-[17px] text-stone-800 leading-[1.7] whitespace-pre-wrap">{selected.optimized_text}</p>
                </div>

                {selected.raw_text && selected.raw_text !== selected.optimized_text && (
                  <details className="mt-4 text-sm text-stone-500">
                    <summary className="cursor-pointer hover:text-stone-800 font-medium">Original draft</summary>
                    <div className="mt-2 flex flex-wrap items-start gap-2">
                      <p className="flex-1 min-w-0 whitespace-pre-wrap leading-relaxed text-[15px]">{selected.raw_text}</p>
                      {!!(selected.raw_text || '').trim() && (
                        <SpeakButton
                          text={selected.raw_text}
                          language_code={selected.language_code || 'en-IN'}
                          label="Listen"
                        />
                      )}
                    </div>
                  </details>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {readIds.has(selected.id) ? (
                    <button type="button" onClick={() => onMarkUnread(selected.id)} className="h-9 px-3 rounded-xl text-xs font-semibold border border-line text-muted hover:text-text">
                      Mark unread
                    </button>
                  ) : (
                    <button type="button" onClick={() => onMarkRead(selected.id)} className="h-9 px-3 rounded-xl text-xs font-semibold bg-teal-700 text-white inline-flex items-center gap-1.5">
                      <CheckCheck size={14} /> Mark read
                    </button>
                  )}
                </div>

                {related.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-stone-100 shrink-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-2.5">
                      Also from this worker
                    </p>
                    <div className="space-y-1.5">
                      {related.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => onOpen(r)}
                          className="w-full flex items-center justify-between gap-2 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2.5 text-left hover:border-teal-700/30 hover:bg-teal-50/50 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-stone-800">{r.machine_id || 'General'}</p>
                            {r.report_date && <p className="text-[10px] text-stone-400">{r.report_date}</p>}
                          </div>
                          <span className="text-[10px] text-stone-400 flex items-center gap-1 shrink-0">
                            {readIds.has(r.id) ? 'Read' : 'Unread'}
                            <ArrowRight size={11} />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-semibold transition-all ${
        active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
      }`}
    >
      <Icon size={14} />
      {children}
    </button>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`rounded-2xl border px-4 py-3.5 ${accent ? 'border-amber-200 bg-amber-50/80' : 'border-line bg-white/90 shadow-sm'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={`text-xl font-bold tabular-nums mt-0.5 ${accent ? 'text-amber-900' : 'text-text'}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function MachineSearchSelect({ machines, counts, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...(machines || [])].sort((a, b) => a.localeCompare(b));
    if (!q) return list;
    return list.filter((m) => m.toLowerCase().includes(q));
  }, [machines, query]);

  const selectedLabel =
    value && value !== 'all' && value !== 'general' ? value : 'All machines…';

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 h-8 pl-3 pr-2.5 rounded-full text-xs font-semibold border transition-all ${
          value && value !== 'all' && value !== 'general'
            ? 'bg-teal-700 text-white border-teal-700 shadow-md shadow-teal-700/20'
            : 'bg-white border-line text-stone-600 hover:border-teal-700/40'
        }`}
      >
        <Factory size={12} className="opacity-70" />
        <span className="max-w-[140px] truncate">{selectedLabel}</span>
        <span className={`tabular-nums text-[10px] ${value && value !== 'all' && value !== 'general' ? 'text-white/80' : 'text-muted'}`}>
          {machines?.length || 0}
        </span>
        <ChevronRight size={12} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 top-full left-0 mt-1.5 w-64 rounded-2xl border border-line bg-white shadow-xl shadow-stone-200/80 overflow-hidden">
          <div className="p-2 border-b border-stone-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search machine…"
                className="w-full h-9 rounded-xl border border-line bg-stone-50 pl-8 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-xs text-muted text-center">No machine matches</li>
            ) : (
              filtered.map((m) => {
                const active = value === m;
                return (
                  <li key={m}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(m);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
                        active ? 'bg-teal-50 text-teal-900 font-semibold' : 'text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <span className="truncate font-medium">{m}</span>
                      <span className="tabular-nums text-[10px] text-muted shrink-0">{counts?.[m] || 0}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold transition-all ${
        active
          ? 'bg-teal-700 text-white shadow-md shadow-teal-700/20'
          : 'bg-white border border-line text-stone-600 hover:border-teal-700/40'
      }`}
    >
      {label}
      <span className={`tabular-nums text-[10px] min-w-[1.1rem] text-center ${active ? 'text-white/80' : 'text-muted'}`}>{count}</span>
    </button>
  );
}

function IconBtn({ onClick, aria, children }) {
  return (
    <button type="button" onClick={onClick} aria-label={aria} className="w-9 h-9 rounded-xl border border-line bg-white flex items-center justify-center shrink-0 hover:border-teal-700/40 text-stone-600">
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}