import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ticket, Plus, List, CheckCircle2, Clock, AlertCircle,
  ChevronDown, Wrench, Sparkles,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, FullPageLoader, EmptyState, Badge, Card,
  Input, Textarea, Select, Button,
} from '../../components/ui';
import { useToast } from '../../components/Toast';

const STATUS_TONE = {
  Open: 'amber',
  'In Progress': 'amber',
  Resolved: 'signal',
  Closed: 'default',
};

const PRIORITY_STYLE = {
  High: 'text-danger bg-danger/10 border-danger/25',
  Medium: 'text-amber bg-amber/10 border-amber/25',
  Low: 'text-muted bg-surface-3 border-line',
};

const STATUS_ICON = {
  Open: AlertCircle,
  'In Progress': Clock,
  Resolved: CheckCircle2,
  Closed: CheckCircle2,
};

/* Soft rounded digits — different from title / body text */
const numStyle = {
  fontFamily: 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, sans-serif',
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '-0.03em',
};

export default function MyTickets() {
  const toast = useToast();
  const [tab, setTab] = useState('new');
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);

  const [machines, setMachines] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', machine_id: '', priority: 'Medium' });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    api.myTickets()
      .then(setTickets)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.myMachines()
      .then((r) => {
        setMachines(r.machine_ids || []);
        if (r.machine_ids?.length) setForm((f) => ({ ...f, machine_id: r.machine_ids[0] }));
      })
      .catch(() => {});
  }, []);

  const counts = useMemo(() => {
    const c = { all: tickets.length, Open: 0, 'In Progress': 0, Resolved: 0, Closed: 0 };
    tickets.forEach((t) => { if (c[t.status] !== undefined) c[t.status] += 1; });
    return c;
  }, [tickets]);

  const filtered = useMemo(() => {
    if (filter === 'all') return tickets;
    return tickets.filter((t) => t.status === filter);
  }, [tickets, filter]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createTicket(form);
      toast.success('Ticket raised — a supervisor will follow up.');
      setForm((f) => ({ ...f, title: '', description: '', priority: 'Medium' }));
      setTab('history');
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not raise ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Tickets"
        title="Tickets"
        description="Flag an issue on the floor, then track every update in one place."
        actions={
          <div className="flex p-1 rounded-full bg-surface-2 border border-line">
            <button
              type="button"
              onClick={() => setTab('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                tab === 'history' ? 'bg-signal text-white shadow-sm' : 'text-muted hover:text-text'
              }`}
            >
              <List size={15} /> History
            </button>
            <button
              type="button"
              onClick={() => setTab('new')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                tab === 'new' ? 'bg-signal text-white shadow-sm' : 'text-muted hover:text-text'
              }`}
            >
              <Plus size={15} /> New ticket
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { key: 'all', label: 'All', tone: 'text-text' },
          { key: 'Open', label: 'Open', tone: 'text-amber' },
          { key: 'In Progress', label: 'In progress', tone: 'text-amber' },
          { key: 'Resolved', label: 'Resolved', tone: 'text-signal' },
        ].map((s, i) => (
          <motion.button
            key={s.key}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => { setFilter(s.key); setTab('history'); }}
            className={`sv-card p-4 text-left transition-all ${
              filter === s.key && tab === 'history' ? 'ring-2 ring-signal/40' : 'hover:-translate-y-0.5'
            }`}
          >
            <p className="text-[11px] font-mono uppercase tracking-widest text-muted mb-1">{s.label}</p>
            <p
              style={numStyle}
              className={`text-3xl font-bold ${s.tone}`}
            >
              {counts[s.key] || 0}
            </p>
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'new' ? (
          <motion.div
            key="new"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="grid lg:grid-cols-[1fr_280px] gap-6 items-start"
          >
            <Card className="p-7">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-signal/10 border border-signal/25 flex items-center justify-center text-signal">
                  <Wrench size={18} />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold">Raise a ticket</h3>
                  <p className="text-sm text-muted">Tell us what’s wrong — a supervisor will pick it up.</p>
                </div>
              </div>
              <form onSubmit={submit} className="space-y-4">
                <Input label="Title" value={form.title} onChange={set('title')} placeholder="e.g. Coolant leak on spindle" required />
                <Textarea label="Description" rows={5} value={form.description} onChange={set('description')} placeholder="What's happening, and since when?" required />
                <div className="grid sm:grid-cols-2 gap-4">
                  <Select label="Machine (optional)" value={form.machine_id} onChange={set('machine_id')}>
                    <option value="">— None —</option>
                    {machines.map((m) => <option key={m} value={m}>{m}</option>)}
                  </Select>
                  <Select label="Priority" value={form.priority} onChange={set('priority')}>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </Select>
                </div>
                <Button type="submit" loading={submitting} icon={CheckCircle2} className="w-full sm:w-auto">
                  Submit ticket
                </Button>
              </form>
            </Card>
            <aside className="sv-card p-5 space-y-4 text-sm">
              <div className="flex items-center gap-2 text-signal">
                <Sparkles size={16} />
                <p className="font-mono text-[11px] uppercase tracking-widest">Tips</p>
              </div>
              <ul className="space-y-3 text-muted leading-snug">
                <li>Be specific — machine ID and symptom help supervisors respond faster.</li>
                <li>Use <strong className="text-text">High</strong> only when production or safety is at risk.</li>
                <li>After submit, your ticket appears under History with live status.</li>
              </ul>
            </aside>
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {loading ? (
              <FullPageLoader label="Loading tickets…" />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Ticket}
                title={filter === 'all' ? 'No tickets yet' : `No ${filter.toLowerCase()} tickets`}
                description={
                  filter === 'all'
                    ? 'When something goes wrong on a machine, raise a ticket so a supervisor can act.'
                    : 'Try another filter, or raise a new ticket.'
                }
                action={
                  <Button onClick={() => setTab('new')} icon={Plus}>
                    Raise a ticket
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {filtered.map((t, i) => {
                  const open = expanded === t.id;
                  const StatusIcon = STATUS_ICON[t.status] || AlertCircle;
                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.3) }}
                      layout
                    >
                      <Card className={`p-0 overflow-hidden transition-shadow ${open ? 'shadow-md' : ''}`}>
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : t.id)}
                          className="w-full text-left p-5 flex items-start gap-4 hover:bg-surface-2/40 transition-colors"
                        >
                          <div className={`mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                            t.status === 'Resolved' || t.status === 'Closed'
                              ? 'bg-signal/10 border-signal/25 text-signal'
                              : 'bg-amber/10 border-amber/25 text-amber'
                          }`}>
                            <StatusIcon size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h3 className="font-display font-bold text-lg text-text">{t.title}</h3>
                              <Badge tone={STATUS_TONE[t.status] || 'default'}>{t.status}</Badge>
                              {t.priority && (
                                <span className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border ${PRIORITY_STYLE[t.priority] || PRIORITY_STYLE.Medium}`}>
                                  {t.priority}
                                </span>
                              )}
                            </div>
                            <p className={`text-sm text-muted leading-relaxed ${open ? '' : 'line-clamp-2'}`}>
                              {t.description}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] font-mono text-muted">
                              {t.machine_id && (
                                <span className="px-2 py-0.5 rounded-md bg-surface-3 border border-line">{t.machine_id}</span>
                              )}
                              <span>{new Date(t.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                          <ChevronDown
                            size={18}
                            className={`text-muted shrink-0 mt-2 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                          />
                        </button>

                        <AnimatePresence>
                          {open && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22 }}
                              className="overflow-hidden border-t border-line"
                            >
                              <div className="px-5 py-4 bg-surface-2/50">
                                <p className="text-[11px] font-mono uppercase tracking-widest text-muted mb-3">Status trail</p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {['Open', 'In Progress', 'Resolved', 'Closed'].map((step, si) => {
                                    const order = ['Open', 'In Progress', 'Resolved', 'Closed'];
                                    const currentIdx = order.indexOf(t.status);
                                    const done = si <= currentIdx;
                                    const active = step === t.status;
                                    return (
                                      <div key={step} className="flex items-center gap-2">
                                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                                          active
                                            ? 'bg-signal text-white border-signal'
                                            : done
                                              ? 'bg-signal/10 text-signal border-signal/30'
                                              : 'bg-surface text-muted border-line'
                                        }`}>
                                          {done && <CheckCircle2 size={12} />}
                                          {step}
                                        </div>
                                        {si < 3 && <div className={`w-4 h-px ${done ? 'bg-signal/40' : 'bg-line'}`} />}
                                      </div>
                                    );
                                  })}
                                </div>
                                <p className="text-xs text-muted mt-4">
                                  Supervisors update status as they work the issue. You’ll see changes here as soon as they’re saved.
                                </p>
                                {t.admin_note && (
                                  <div className="mt-4 rounded-xl border-2 border-signal/25 bg-signal/5 p-3.5">
                                    <p className="text-[10px] font-mono uppercase tracking-wider text-signal mb-1.5">Supervisor note</p>
                                    <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{t.admin_note}</p>
                                  </div>
                                )}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}