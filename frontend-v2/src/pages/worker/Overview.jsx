import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MessageCircleQuestion, ShieldCheck, PlusCircle, Mic2, Ticket,
  ArrowUpRight, Factory, ListChecks, Sparkles,
} from 'lucide-react';
import { api } from '../../lib/api';
import { getWorkerName } from '../../lib/auth';
import { PageHeader, Card, FullPageLoader, Badge } from '../../components/ui';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

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
      } catch (_) {} finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <FullPageLoader label="Loading your floor…" />;

  const pendingSafety = safety.filter((s) => !s.completed).length;
  const pendingTips = tips.filter((t) => t.status === 'pending').length;
  const openTickets = tickets.filter((t) => t.status === 'Open' || t.status === 'In Progress').length;

  const actions = [
    {
      to: '/worker/ask',
      title: 'Ask AI',
      body: 'Get a grounded, spoken answer about any assigned machine — from manuals and approved tips only.',
      icon: MessageCircleQuestion,
      tone: 'signal',
    },
    {
      to: '/worker/safety',
      title: 'Safety briefing',
      body: pendingSafety
        ? `${pendingSafety} machine${pendingSafety > 1 ? 's' : ''} still need a full briefing before work.`
        : 'All assigned machines are cleared. You can review any briefing anytime.',
      icon: ShieldCheck,
      tone: pendingSafety ? 'amber' : 'signal',
    },
    {
      to: '/worker/my-tips',
      title: 'Add a tip',
      body: 'Share something you know before it is forgotten. AI helps sharpen it, then a supervisor reviews.',
      icon: PlusCircle,
      tone: 'signal',
    },
    {
      to: '/worker/interview',
      title: 'Tacit Interview',
      body: 'Let AI walk you through what you know, topic by topic — voice answers with live captions.',
      icon: Mic2,
      tone: 'signal',
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Your floor"
        title={`Welcome back, ${getWorkerName() || 'operator'}.`}
        description="Everything you need before, during, and after your shift — in one place."
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10"
      >
        {actions.map((a) => (
          <motion.div key={a.to} variants={item}>
            <Link
              to={a.to}
              className="sv-card p-6 flex flex-col h-full min-h-[180px] group hover:-translate-y-1.5 transition-transform duration-300"
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${
                  a.tone === 'amber'
                    ? 'bg-amber/10 border-2 border-amber/30 text-amber'
                    : 'bg-signal/10 border-2 border-signal/30 text-signal'
                }`}
              >
                <a.icon size={22} />
              </div>
              <h3 className="font-display font-bold text-xl mb-2 flex items-center gap-1.5">
                {a.title}
                <ArrowUpRight
                  size={16}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-signal"
                />
              </h3>
              <p className="text-muted text-[15px] leading-relaxed flex-1">{a.body}</p>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid lg:grid-cols-3 gap-5 mb-10"
      >
        <motion.div variants={item}>
          <Card className="p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-xl flex items-center gap-2">
                <Factory size={20} className="text-signal" /> My machines
              </h3>
              <Badge tone="signal">{machines.length}</Badge>
            </div>
            {machines.length === 0 ? (
              <p className="text-[15px] text-muted leading-relaxed">
                No machines assigned yet. Ask your supervisor to assign you one.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {machines.map((m) => (
                  <span
                    key={m}
                    className="font-mono text-sm px-3.5 py-2 rounded-full bg-surface-3 border border-line"
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-xl flex items-center gap-2">
                <ListChecks size={20} className="text-signal" /> My tips
              </h3>
              <Badge tone={pendingTips ? 'amber' : 'signal'}>{tips.length}</Badge>
            </div>
            <p className="text-[15px] text-muted leading-relaxed">
              {pendingTips > 0
                ? `${pendingTips} awaiting admin review.`
                : 'All your tips have been reviewed.'}
            </p>
            <Link
              to="/worker/my-tips"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-signal mt-4 hover:underline"
            >
              View all <ArrowUpRight size={14} />
            </Link>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-xl flex items-center gap-2">
                <Ticket size={20} className="text-signal" /> My tickets
              </h3>
              <Badge tone={openTickets ? 'amber' : 'signal'}>{tickets.length}</Badge>
            </div>
            <p className="text-[15px] text-muted leading-relaxed">
              {openTickets > 0
                ? `${openTickets} open or in progress.`
                : 'Nothing open right now.'}
            </p>
            <Link
              to="/worker/my-tickets"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-signal mt-4 hover:underline"
            >
              View all <ArrowUpRight size={14} />
            </Link>
          </Card>
        </motion.div>
      </motion.div>

      {/* Bottom guidance strip — fills empty space */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="sv-card p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-5"
      >
        <div className="w-12 h-12 rounded-2xl bg-signal/10 border-2 border-signal/25 text-signal flex items-center justify-center shrink-0">
          <Sparkles size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-xl mb-1">How to use this floor</h3>
          <p className="text-[15px] text-muted leading-relaxed">
            Start with <strong className="text-text">Safety</strong> if anything is still required.
            Use <strong className="text-text">Ask AI</strong> mid-shift for machine questions.
            Capture tips and interviews so knowledge stays when people rotate or retire.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link
            to="/worker/safety"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold border-2 border-line bg-surface-2 hover:border-amber hover:text-amber transition-colors"
          >
            <ShieldCheck size={15} /> Safety
          </Link>
          <Link
            to="/worker/ask"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold bg-signal text-white hover:bg-signal-dim transition-colors"
          >
            <MessageCircleQuestion size={15} /> Ask AI
          </Link>
        </div>
      </motion.div>
    </div>
  );
}