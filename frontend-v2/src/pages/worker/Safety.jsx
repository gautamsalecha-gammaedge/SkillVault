import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, ShieldAlert, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { PageHeader, FullPageLoader, EmptyState, Badge } from '../../components/ui';

export default function Safety() {
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState([]);

  useEffect(() => {
    api.mySafetyStatus().then((r) => setMachines(r.machines || [])).finally(() => setLoading(false));
  }, []);

  if (loading) return <FullPageLoader label="Loading safety status…" />;

  return (
    <div>
      <PageHeader eyebrow="Safety" title="Machine safety briefings" description="Complete the briefing for a machine before you start working on it." />
      {machines.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No machines assigned" description="You'll see safety briefings here once a supervisor assigns you to a machine." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {machines.map((m, i) => (
            <motion.div key={m.machine_id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Link to={`/worker/safety/${encodeURIComponent(m.machine_id)}`} className="sv-card p-6 flex flex-col gap-4 h-full hover:-translate-y-1 transition-transform duration-300">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-text">{m.machine_id}</span>
                  {m.completed ? <Badge tone="signal">Completed</Badge> : <Badge tone="amber">Required</Badge>}
                </div>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${m.completed ? 'bg-signal/10 border border-signal/30 text-signal' : 'bg-amber/10 border border-amber/30 text-amber'}`}>
                  {m.completed ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
                </div>
                <div>
                  <p className="text-sm text-muted">{m.measure_count} step{m.measure_count !== 1 ? 's' : ''} in this briefing</p>
                  {m.completed_at && <p className="text-[11px] font-mono text-muted mt-1">Last done {new Date(m.completed_at).toLocaleDateString()}</p>}
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-signal mt-auto">
                  {m.completed ? 'Review again' : 'Start briefing'} <ArrowRight size={13} />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
