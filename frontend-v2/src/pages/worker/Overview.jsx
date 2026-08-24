import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircleQuestion, ShieldCheck, PlusCircle, Mic2, Ticket, ArrowUpRight, Factory } from 'lucide-react';
import { api } from '../../lib/api';
import { getWorkerName } from '../../lib/auth';
import { PageHeader, Card, FullPageLoader, Badge } from '../../components/ui';

export default function Overview() {
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState([]);
  const [safety, setSafety] = useState([]);
  const [tips, setTips] = useState([]);
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [m, s, t, tk] = await Promise.all([
          api.myMachines(), api.mySafetyStatus(), api.myTips(), api.myTickets(),
        ]);
        setMachines(m.machine_ids || []);
        setSafety(s.machines || []);
        setTips(t.tips || []);
        setTickets(tk || []);
      } catch (_) {} finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <FullPageLoader label="Loading your floor…" />;

  const pendingSafety = safety.filter((s) => !s.completed).length;
  const pendingTips = tips.filter((t) => t.status === 'pending').length;
  const openTickets = tickets.filter((t) => t.status === 'Open' || t.status === 'In Progress').length;

  const actions = [
    { to: '/worker/ask', title: 'Ask AI', body: 'Get a grounded, spoken answer about any assigned machine.', icon: MessageCircleQuestion, tone: 'signal' },
    { to: '/worker/safety', title: 'Safety briefing', body: pendingSafety ? `${pendingSafety} machine${pendingSafety > 1 ? 's' : ''} need briefing` : 'All caught up', icon: ShieldCheck, tone: pendingSafety ? 'amber' : 'signal' },
    { to: '/worker/add-tip', title: 'Add a tip', body: 'Share something you know before it\u2019s forgotten.', icon: PlusCircle, tone: 'signal' },
    { to: '/worker/interview', title: 'Tacit Interview', body: 'Let AI walk you through what you know, topic by topic.', icon: Mic2, tone: 'signal' },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Your floor"
        title={`Welcome back, ${getWorkerName() || 'operator'}.`}
        description="Everything you need before, during, and after your shift — in one place."
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {actions.map((a, i) => (
          <motion.div key={a.to} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Link to={a.to} className="sv-card p-5 flex flex-col justify-between h-full group hover:-translate-y-1 transition-transform duration-300">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${a.tone === 'amber' ? 'bg-amber/10 border border-amber/30 text-amber' : 'bg-signal/10 border border-signal/30 text-signal'}`}>
                <a.icon size={19} />
              </div>
              <h3 className="font-display font-bold text-lg mb-1 flex items-center gap-1.5">
                {a.title}
                <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-signal" />
              </h3>
              <p className="text-muted text-xs leading-relaxed">{a.body}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg flex items-center gap-2"><Factory size={17} className="text-signal" /> My machines</h3>
            <Badge tone="signal">{machines.length}</Badge>
          </div>
          {machines.length === 0 ? (
            <p className="text-sm text-muted">No machines assigned yet. Ask your supervisor to assign you one.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {machines.map((m) => <span key={m} className="font-mono text-xs px-3 py-1.5 rounded-full bg-surface-3 border border-line">{m}</span>)}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg flex items-center gap-2"><PlusCircle size={17} className="text-signal" /> My tips</h3>
            <Badge tone={pendingTips ? 'amber' : 'signal'}>{tips.length}</Badge>
          </div>
          <p className="text-sm text-muted">{pendingTips > 0 ? `${pendingTips} awaiting admin review.` : 'All your tips have been reviewed.'}</p>
          <Link to="/worker/my-tips" className="inline-flex items-center gap-1 text-xs font-semibold text-signal mt-3 hover:underline">View all <ArrowUpRight size={12} /></Link>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg flex items-center gap-2"><Ticket size={17} className="text-signal" /> My tickets</h3>
            <Badge tone={openTickets ? 'amber' : 'signal'}>{tickets.length}</Badge>
          </div>
          <p className="text-sm text-muted">{openTickets > 0 ? `${openTickets} open or in progress.` : 'Nothing open right now.'}</p>
          <Link to="/worker/my-tickets" className="inline-flex items-center gap-1 text-xs font-semibold text-signal mt-3 hover:underline">View all <ArrowUpRight size={12} /></Link>
        </Card>
      </div>
    </div>
  );
}
