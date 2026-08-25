import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ticket, Search, RefreshCw, Clock, AlertTriangle, CheckCircle2,
  Circle, PlayCircle, XCircle, MessageSquare, User, Factory,
  ChevronDown, Save, Filter, Flame, ArrowUpDown,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { PageHeader, Card, Badge, Button, FullPageLoader, EmptyState } from '../../components/ui';
import { useToast } from '../../components/Toast';

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const PRIORITIES = ['High', 'Medium', 'Low'];

const STATUS_META = {
  Open: { tone: 'amber', icon: Circle, label: 'Open' },
  'In Progress': { tone: 'signal', icon: PlayCircle, label: 'In progress' },
  Resolved: { tone: 'signal', icon: CheckCircle2, label: 'Resolved' },
  Closed: { tone: 'default', icon: XCircle, label: 'Closed' },
};

const PRIORITY_META = {
  High: { tone: 'danger', bar: 'bg-danger', label: 'High' },
  Medium: { tone: 'amber', bar: 'bg-amber', label: 'Medium' },
  Low: { tone: 'default', bar: 'bg-muted/40', label: 'Low' },
};

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function timeAgo(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 60) return 'just now';
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
    return formatWhen(iso);
  } catch {
    return '';
  }
}

export default function AdminTickets() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('priority'); // priority | newest | oldest | updated
  const [openId, setOpenId] = useState(null);
  const [drafts, setDrafts] = useState({}); // id -> { status, priority, admin_note }
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const res = await api.adminTickets(params);
      // Backend returns a bare array; tolerate wrapped shapes too
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.tickets)
          ? res.tickets
          : Array.isArray(res?.data)
            ? res.data
            : [];
      setTickets(list);
    } catch (err) {
      console.error('admin tickets load failed', err);
      toast.error(err instanceof ApiError ? err.message : 'Could not load tickets.');
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, priorityFilter, toast]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = { Open: 0, 'In Progress': 0, Resolved: 0, Closed: 0, High: 0 };
    // counts from current filtered server list - for status we need all
    // Use tickets as loaded (server may already filter)
    for (const t of tickets) {
      if (c[t.status] !== undefined) c[t.status] += 1;
      if (t.priority === 'High' && (t.status === 'Open' || t.status === 'In Progress')) c.High += 1;
    }
    return c;
  }, [tickets]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = tickets;
    if (q) {
      list = list.filter((t) => {
        const hay = [t.title, t.description, t.worker_id, t.worker_name, t.machine_id, t.admin_note]
          .filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    const priorityRank = { High: 0, Medium: 1, Low: 2 };
    list = [...list].sort((a, b) => {
      if (sortBy === 'priority') {
        const pr = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
        if (pr !== 0) return pr;
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }
      if (sortBy === 'updated') {
        return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
      }
      // newest
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
    return list;
  }, [tickets, query, sortBy]);

  const ensureDraft = (t) => {
    setDrafts((d) => {
      if (d[t.id]) return d;
      return {
        ...d,
        [t.id]: {
          status: t.status,
          priority: t.priority,
          admin_note: t.admin_note || '',
        },
      };
    });
  };

  const openTicket = (id) => {
    const t = tickets.find((x) => x.id === id);
    if (t) ensureDraft(t);
    setOpenId((cur) => (cur === id ? null : id));
  };

  const setDraft = (id, patch) => {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  };

  const saveTicket = async (id) => {
    const draft = drafts[id];
    if (!draft) return;
    setSavingId(id);
    try {
      const res = await api.updateTicket(id, {
        status: draft.status,
        priority: draft.priority,
        admin_note: draft.admin_note,
      });
      setTickets((list) =>
        list.map((t) =>
          t.id === id
            ? {
                ...t,
                status: res.status ?? draft.status,
                priority: res.priority ?? draft.priority,
                admin_note: res.admin_note ?? draft.admin_note,
                updated_at: res.updated_at || new Date().toISOString(),
                worker_name: res.worker_name || t.worker_name,
              }
            : t,
        ),
      );
      toast.success('Ticket updated — note is visible to the worker.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update ticket.');
    } finally {
      setSavingId(null);
    }
  };

  const quickStatus = async (id, status) => {
    setSavingId(id);
    try {
      const res = await api.updateTicket(id, { status });
      setTickets((list) =>
        list.map((t) =>
          t.id === id
            ? { ...t, status: res.status ?? status, updated_at: res.updated_at || new Date().toISOString() }
            : t,
        ),
      );
      setDrafts((d) => (d[id] ? { ...d, [id]: { ...d[id], status: res.status ?? status } } : d));
      toast.success(`Marked ${status}.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update status.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow="Floor issues"
        title="Tickets"
        description="Issues raised from the floor — triage by priority, leave a note the worker can see, and close the loop."
        actions={
          <Button size="sm" variant="ghost" icon={RefreshCw} loading={refreshing} onClick={() => load(true)}>
            Refresh
          </Button>
        }
      />

      {/* Priority / status overview — compact chips, not a heavy status bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
            !statusFilter ? 'border-amber bg-amber text-[#221400]' : 'border-line bg-surface text-muted hover:text-text'
          }`}
        >
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
              statusFilter === s
                ? 'border-amber bg-amber text-[#221400]'
                : 'border-line bg-surface text-muted hover:text-text'
            }`}
          >
            {s}
            {counts[s] ? ` · ${counts[s]}` : ''}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPriorityFilter(priorityFilter === 'High' ? '' : 'High')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border-2 transition-all inline-flex items-center gap-1 ${
            priorityFilter === 'High'
              ? 'border-danger bg-danger/15 text-danger'
              : 'border-line bg-surface text-muted hover:text-danger'
          }`}
        >
          <Flame size={12} /> High priority
          {counts.High ? ` · ${counts.High}` : ''}
        </button>
      </div>

      {/* Search + sort */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, worker, machine, note…"
            className="w-full h-11 pl-10 pr-4 rounded-xl border-2 border-line bg-surface text-sm outline-none focus:border-amber placeholder:text-muted"
          />
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown size={14} className="text-muted shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-11 px-3 rounded-xl border-2 border-line bg-surface text-sm font-medium outline-none focus:border-amber min-w-[160px]"
          >
            <option value="priority">Priority first</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="updated">Recently updated</option>
          </select>
        </div>
      </div>

      {loading ? (
        <FullPageLoader label="Loading tickets…" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No tickets here"
          description={
            tickets.length === 0
              ? 'When workers raise issues from the floor, they will land in this queue.'
              : 'Nothing matches this search or filter.'
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((t, i) => {
            const isOpen = openId === t.id;
            const draft = drafts[t.id] || {
              status: t.status,
              priority: t.priority,
              admin_note: t.admin_note || '',
            };
            const pMeta = PRIORITY_META[t.priority] || PRIORITY_META.Medium;
            const sMeta = STATUS_META[t.status] || STATUS_META.Open;
            const StatusIcon = sMeta.icon;

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.2) }}
              >
                <Card className={`overflow-hidden relative ${isOpen ? 'ring-2 ring-signal/20' : ''}`}>
                  {/* Priority rail */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${pMeta.bar}`} />

                  <button
                    type="button"
                    onClick={() => openTicket(t.id)}
                    className="w-full text-left pl-5 pr-4 py-4 hover:bg-surface-2/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <Badge tone={pMeta.tone}>{t.priority}</Badge>
                          <Badge tone={sMeta.tone}>
                            <StatusIcon size={11} /> {t.status}
                          </Badge>
                          {t.machine_id && (
                            <span className="font-mono text-[11px] text-muted px-2 py-0.5 rounded-full border border-line bg-surface-2">
                              {t.machine_id}
                            </span>
                          )}
                        </div>
                        <h3 className="font-display font-bold text-lg leading-snug text-text">{t.title}</h3>
                        <p className="text-sm text-muted mt-1 line-clamp-2 leading-relaxed">{t.description}</p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                          <span className="inline-flex items-center gap-1">
                            <User size={12} />
                            {t.worker_name || t.worker_id}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock size={12} />
                            {timeAgo(t.created_at)}
                          </span>
                          {t.admin_note && (
                            <span className="inline-flex items-center gap-1 text-signal">
                              <MessageSquare size={12} /> Has note
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronDown
                        size={18}
                        className={`text-muted shrink-0 mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </button>

                  {/* Quick actions when collapsed */}
                  {!isOpen && (t.status === 'Open' || t.status === 'In Progress') && (
                    <div className="px-5 pb-4 flex flex-wrap gap-2 pl-5">
                      {t.status === 'Open' && (
                        <Button size="sm" variant="ghost" onClick={() => quickStatus(t.id, 'In Progress')} loading={savingId === t.id}>
                          Start work
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => quickStatus(t.id, 'Resolved')} loading={savingId === t.id}>
                        Mark resolved
                      </Button>
                    </div>
                  )}

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-line bg-surface-2/50 px-5 py-5 space-y-5">
                          <div>
                            <p className="text-[10px] font-mono uppercase tracking-wider text-muted mb-1.5">Full description</p>
                            <p className="text-[15px] text-text leading-relaxed whitespace-pre-wrap">{t.description}</p>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-4 text-sm">
                            <div className="rounded-xl border border-line bg-surface p-3.5">
                              <p className="text-[10px] font-mono uppercase tracking-wider text-muted mb-1">Worker</p>
                              <p className="font-semibold">{t.worker_name || '—'}</p>
                              <p className="font-mono text-xs text-muted">{t.worker_id}</p>
                            </div>
                            <div className="rounded-xl border border-line bg-surface p-3.5">
                              <p className="text-[10px] font-mono uppercase tracking-wider text-muted mb-1">Timeline</p>
                              <p className="text-xs text-muted">Opened {formatWhen(t.created_at)}</p>
                              <p className="text-xs text-muted mt-0.5">Updated {formatWhen(t.updated_at)}</p>
                            </div>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-4">
                            <label className="block">
                              <span className="block text-[11px] font-mono uppercase tracking-wider text-muted mb-1.5">Status</span>
                              <select
                                value={draft.status}
                                onChange={(e) => setDraft(t.id, { status: e.target.value })}
                                className="w-full h-11 px-3 rounded-xl border-2 border-line bg-surface text-sm font-medium outline-none focus:border-signal"
                              >
                                {STATUSES.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="block text-[11px] font-mono uppercase tracking-wider text-muted mb-1.5">Priority</span>
                              <select
                                value={draft.priority}
                                onChange={(e) => setDraft(t.id, { priority: e.target.value })}
                                className="w-full h-11 px-3 rounded-xl border-2 border-line bg-surface text-sm font-medium outline-none focus:border-signal"
                              >
                                {PRIORITIES.map((p) => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <label className="block">
                            <span className="block text-[11px] font-mono uppercase tracking-wider text-muted mb-1.5">
                              Supervisor note
                              <span className="normal-case tracking-normal text-muted/80"> — shown to the worker</span>
                            </span>
                            <textarea
                              value={draft.admin_note}
                              onChange={(e) => setDraft(t.id, { admin_note: e.target.value })}
                              rows={4}
                              placeholder="What did you find? What should the worker do next? This note appears on their ticket history."
                              className="w-full rounded-xl border-2 border-line bg-surface px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-signal resize-none"
                            />
                          </label>

                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap gap-2">
                              {draft.status !== 'In Progress' && draft.status !== 'Resolved' && (
                                <Button size="sm" variant="ghost" onClick={() => setDraft(t.id, { status: 'In Progress' })}>
                                  Set in progress
                                </Button>
                              )}
                              {draft.status !== 'Resolved' && (
                                <Button size="sm" variant="ghost" onClick={() => setDraft(t.id, { status: 'Resolved' })}>
                                  Set resolved
                                </Button>
                              )}
                              {draft.status !== 'Closed' && (
                                <Button size="sm" variant="ghost" onClick={() => setDraft(t.id, { status: 'Closed' })}>
                                  Close
                                </Button>
                              )}
                            </div>
                            <Button
                              size="sm"
                              icon={Save}
                              loading={savingId === t.id}
                              onClick={() => saveTicket(t.id)}
                            >
                              Save update
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}