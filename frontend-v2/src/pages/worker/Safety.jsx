import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheck, ShieldAlert, ArrowRight, AlertTriangle,
  CheckCircle2, Lock, BookOpen,
} from 'lucide-react';
import { api } from '../../lib/api';
import { FullPageLoader, EmptyState, Badge } from '../../components/ui';

/**
 * Safety hub — full-width layout, balanced colors (not all-amber).
 */

export default function Safety() {
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState([]);

  useEffect(() => {
    api.mySafetyStatus()
      .then((r) => setMachines(r.machines || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <FullPageLoader label="Loading safety status…" />;

  const pending = machines.filter((m) => !m.completed);
  const done = machines.filter((m) => m.completed);

  return (
    <div className="w-full max-w-none">
      {/* Header row */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-signal mb-1">Safety first</p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-text">Machine safety briefings</h1>
          <p className="text-[15px] sm:text-base text-muted mt-2 max-w-2xl leading-relaxed">
            Complete the briefing for each machine <strong className="text-text">before you start work</strong>.
            This is required — not optional. Steps cover hazards, PPE, and floor rules for your assignment.
          </p>
        </div>
        {machines.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl border-2 border-line bg-surface px-4 py-2.5 min-w-[100px]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Required</p>
              <p className="text-2xl font-semibold text-amber">{pending.length}</p>
            </div>
            <div className="rounded-xl border-2 border-line bg-surface px-4 py-2.5 min-w-[100px]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Completed</p>
              <p className="text-2xl font-semibold text-signal">{done.length}</p>
            </div>
            <div className="rounded-xl border-2 border-line bg-surface px-4 py-2.5 min-w-[100px]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Machines</p>
              <p className="text-2xl font-semibold text-text">{machines.length}</p>
            </div>
          </div>
        )}
      </div>

      {/* Status + why — side by side on wide screens */}
      <div className="grid lg:grid-cols-12 gap-5 mb-8">
        <div className="lg:col-span-5">
          {pending.length > 0 ? (
            <div className="h-full rounded-2xl border-2 border-line bg-surface p-5 flex gap-4 items-start">
              <div className="w-11 h-11 rounded-xl bg-amber/15 border-2 border-amber/25 text-amber flex items-center justify-center shrink-0">
                <Lock size={20} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text mb-1">
                  {pending.length} briefing{pending.length !== 1 ? 's' : ''} still required
                </h2>
                <p className="text-[15px] text-muted leading-relaxed">
                  Do not operate these machines until you finish the safety tutorial.
                  Steps cover hazards, PPE, and floor rules for your assignment.
                </p>
              </div>
            </div>
          ) : machines.length > 0 ? (
            <div className="h-full rounded-2xl border-2 border-signal/25 bg-signal/5 p-5 flex gap-4 items-start">
              <div className="w-11 h-11 rounded-xl bg-signal/15 border-2 border-signal/30 text-signal flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text mb-1">You’re cleared for assigned machines</h2>
                <p className="text-[15px] text-muted leading-relaxed">
                  All required briefings are complete. Re-open any briefing anytime to review.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-7 grid sm:grid-cols-3 gap-3">
          {[
            { icon: AlertTriangle, t: 'Know the hazards', d: 'Risks manuals alone may miss.', tone: 'text-amber bg-surface border-line' },
            { icon: BookOpen, t: 'Step-by-step tutorial', d: 'Short steps with video when available.', tone: 'text-signal bg-surface border-line' },
            { icon: CheckCircle2, t: 'Confirm before work', d: 'Mark complete only after every step.', tone: 'text-text bg-surface border-line' },
          ].map(({ icon: Icon, t, d, tone }) => (
            <div key={t} className={`rounded-xl border-2 p-4 ${tone}`}>
              <Icon size={18} className="mb-2 opacity-90" />
              <p className="text-[15px] font-semibold text-text">{t}</p>
              <p className="text-sm text-muted mt-1.5 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </div>

      {machines.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No machines assigned"
          description="You’ll see safety briefings here once a supervisor assigns you to a machine."
        />
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
                <ShieldAlert size={14} className="text-amber" /> Required before work
              </h3>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {pending.map((m, i) => (
                  <MachineCard key={m.machine_id} m={m} index={i} required />
                ))}
              </div>
            </section>
          )}
          {done.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
                <ShieldCheck size={14} className="text-signal" /> Completed
              </h3>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {done.map((m, i) => (
                  <MachineCard key={m.machine_id} m={m} index={i} required={false} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function MachineCard({ m, index, required }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link
        to={`/worker/safety/${encodeURIComponent(m.machine_id)}`}
        className={`block rounded-2xl border-2 p-5 h-full transition-all hover:-translate-y-0.5 bg-surface ${
          required
            ? 'border-line hover:border-amber/50'
            : 'border-line hover:border-signal/40'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <span className="text-base font-semibold text-text">{m.machine_id}</span>
          {m.completed ? (
            <Badge tone="signal">Completed</Badge>
          ) : (
            <Badge tone="amber">Required</Badge>
          )}
        </div>
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 border-2 ${
            m.completed
              ? 'bg-signal/10 border-signal/25 text-signal'
              : 'bg-surface-2 border-line text-muted'
          }`}
        >
          {m.completed ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
        </div>
        <p className="text-[15px] text-muted mb-1">
          {m.measure_count || 0} step{(m.measure_count || 0) !== 1 ? 's' : ''} in this briefing
        </p>
        {m.completed_at && (
          <p className="text-sm text-muted">
            Last completed {new Date(m.completed_at).toLocaleDateString()}
          </p>
        )}
        <span
          className={`mt-4 inline-flex items-center gap-1.5 text-[15px] font-semibold ${
            required ? 'text-amber' : 'text-signal'
          }`}
        >
          {required ? 'Start safety tutorial' : 'Review briefing'}
          <ArrowRight size={16} />
        </span>
      </Link>
    </motion.div>
  );
}