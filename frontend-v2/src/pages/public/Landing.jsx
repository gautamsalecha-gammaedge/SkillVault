import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowUpRight, Mic, ShieldCheck, BrainCircuit, Ticket, Radio,
  Fingerprint, Factory, Waves, ChevronRight, Check,
} from 'lucide-react';

export default function Landing() {
  return (
    <div className="overflow-x-clip">
      <TopBar />
      <Hero />
      <TrustStrip />
      <Problem />
      <Handoff />
      <Features />
      <Flow />
      <Metrics />
      <CTA />
      <Footer />
    </div>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/70 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-signal to-signal-dim flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">SkillVault</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted font-medium">
          <a href="#problem" className="hover:text-text transition-colors">The Problem</a>
          <a href="#how" className="hover:text-text transition-colors">How it Works</a>
          <a href="#features" className="hover:text-text transition-colors">Platform</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-semibold text-muted hover:text-text transition-colors hidden sm:block">Sign in</Link>
          <Link to="/register" className="text-sm font-semibold bg-[var(--color-signal)] text-white px-4 py-2.5 rounded-full hover:bg-signal-dim transition-all shadow-[0_1px_0_rgba(255,255,255,.25)_inset,0_6px_18px_-6px_rgba(13,159,138,.35)]">
            Join the floor
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative pt-20 pb-28 md:pt-28 md:pb-36 px-6">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-center">
        <div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-signal border border-signal/30 bg-signal/5 rounded-full px-3 py-1.5 mb-7">
            <Radio size={12} className="animate-pulse" /> Now capturing on 40+ machine lines
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.05 }}
            className="font-display font-black text-[13vw] sm:text-6xl lg:text-[5rem] leading-[0.95] tracking-tight"
          >
            Your best operator
            <br />
            <span className="text-signal">retires every night.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-7 text-lg text-muted max-w-lg leading-relaxed"
          >
            Thirty years of knowing exactly when a machine sounds wrong lives in one person's head — until it doesn't.
            SkillVault listens, distills, and hands that knowledge to every worker on the floor, by voice, in seconds.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <Link to="/register" className="group inline-flex items-center gap-2 bg-[var(--color-signal)] text-white font-bold px-7 py-4 rounded-full hover:bg-signal-dim transition-all shadow-[0_1px_0_rgba(255,255,255,.25)_inset,0_6px_18px_-6px_rgba(13,159,138,.35)]">
              Register as a worker
              <ArrowUpRight size={18} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 border border-line text-text font-semibold px-7 py-4 rounded-full hover:border-signal/50 transition-all">
              Supervisor sign-in
            </Link>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }} className="mt-10 flex items-center gap-6 text-xs font-mono text-muted uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><Check size={13} className="text-signal" /> Voice-first</span>
            <span className="flex items-center gap-1.5"><Check size={13} className="text-signal" /> Works mid-shift</span>
            <span className="flex items-center gap-1.5"><Check size={13} className="text-signal" /> No typing required</span>
          </motion.div>
        </div>
        <HandoffOrb />
      </div>
    </section>
  );
}

function HandoffOrb() {
  const bars = Array.from({ length: 28 });
  const nodes = [
    { x: 30, y: 20 }, { x: 70, y: 15 }, { x: 15, y: 55 }, { x: 85, y: 50 },
    { x: 45, y: 80 }, { x: 60, y: 40 }, { x: 25, y: 85 }, { x: 78, y: 82 },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }}
      className="relative aspect-square max-w-md mx-auto w-full"
    >
      <div className="absolute inset-0 rounded-[2rem] border border-line sv-grid-tile overflow-hidden">
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
          {nodes.map((n, i) => (
            <g key={i}>
              <motion.line
                x1="50" y1="50" x2={n.x} y2={n.y}
                stroke="#0f9d8a" strokeWidth="0.4"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.5 }}
                transition={{ duration: 1.2, delay: 0.8 + i * 0.12, ease: 'easeOut' }}
              />
              <motion.circle
                cx={n.x} cy={n.y} r="2.2" fill="#fffcf8" stroke="#0f9d8a" strokeWidth="0.6"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 1.4 + i * 0.12 }}
              />
            </g>
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-28 h-28 rounded-full bg-surface border border-signal/25 flex items-center justify-center shadow-[0_8px_30px_-10px_rgba(13,159,138,.25)]">
            <motion.div
              className="absolute inset-0 rounded-full border border-signal/30"
              animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="flex items-end gap-[3px] h-9">
              {bars.map((_, i) => (
                <motion.span
                  key={i}
                  className="w-[2.5px] rounded-full bg-signal"
                  animate={{ height: [6, 10 + ((i * 13) % 24), 6] }}
                  transition={{ duration: 0.9 + (i % 5) * 0.12, repeat: Infinity, ease: 'easeInOut', delay: (i % 7) * 0.08 }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 sv-card px-4 py-2 flex items-center gap-2 whitespace-nowrap">
        <Fingerprint size={14} className="text-amber" />
        <span className="text-xs font-mono text-muted">tacit knowledge → structured insight</span>
      </div>
    </motion.div>
  );
}

function TrustStrip() {
  const items = ['CNC-204 LATHE', 'PRESS-BRAKE-11', 'WELD CELL 4', 'INJECTION-M2', 'PACK LINE 7', 'ROBOT ARM 03'];
  return (
    <div className="border-y border-line py-6 overflow-hidden bg-surface/40">
      <p className="text-center text-[11px] font-mono uppercase tracking-[0.2em] text-muted mb-4">Live knowledge streaming from</p>
      <div className="flex gap-14 animate-[marquee_22s_linear_infinite] shrink-0">
        {[...items, ...items].map((t, i) => (
          <span key={i} className="font-mono text-sm text-muted/70 shrink-0">{t}</span>
        ))}
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}

function Problem() {
  const stats = [
    { n: '41%', l: 'of skilled trade workers reach retirement age within 10 years', s: 'Industry workforce studies' },
    { n: '3–6 mo', l: 'typical ramp time for a new hire to reach solo competence on a machine', s: 'without a formal capture process' },
    { n: '0', l: 'of it written down — most fixes live only in one operator\u2019s memory', s: 'until SkillVault' },
  ];
  return (
    <section id="problem" className="max-w-7xl mx-auto px-6 py-24 md:py-32">
      <div className="max-w-2xl mb-14 sv-rise">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber mb-3">The problem</p>
        <h2 className="font-display text-4xl md:text-5xl font-bold leading-[1.05]">
          Knowledge walks out the door <span className="text-muted">every time someone clocks out for the last time.</span>
        </h2>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {stats.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="sv-card p-7"
          >
            <p className="font-display text-5xl font-black text-signal mb-3">{s.n}</p>
            <p className="text-text/90 text-sm leading-relaxed mb-3">{s.l}</p>
            <p className="text-[11px] font-mono text-muted uppercase tracking-wide">{s.s}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Handoff() {
  const steps = [
    { title: 'A senior operator speaks', body: 'No forms, no typing. They talk through a fix the same way they\u2019d explain it to an apprentice — SkillVault records it.', icon: Mic },
    { title: 'AI distills the tacit into the explicit', body: 'A guided interview asks the follow-up a good trainer would ask, then turns the answer into a clear, reusable tip.', icon: BrainCircuit },
    { title: 'A supervisor reviews once', body: 'Every tip is queued for approval before it goes live — quality control without slowing anyone down.', icon: ShieldCheck },
    { title: 'Every worker can ask, anytime', body: 'Any worker on that machine can ask a question out loud and get an answer grounded in real, approved know-how.', icon: Waves },
  ];
  return (
    <section id="how" className="border-y border-line bg-surface/30 py-24 md:py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mb-16 sv-rise">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal mb-3">The handoff</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold leading-[1.05]">From one operator's head to the whole floor's hands.</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="sv-card p-7 flex gap-5"
            >
              <div className="w-11 h-11 rounded-xl bg-signal/10 border border-signal/30 flex items-center justify-center text-signal shrink-0">
                <s.icon size={20} />
              </div>
              <div>
                <h3 className="font-display font-bold text-xl mb-1.5">{s.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{s.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: Mic, title: 'Ask by voice', body: 'Workers speak a question in their own language and get a grounded, spoken answer in seconds.' },
    { icon: BrainCircuit, title: 'Tacit Knowledge Capture', body: 'A guided AI interview draws out the reasoning senior operators never think to write down.' },
    { icon: ShieldCheck, title: 'Machine safety briefings', body: 'Ordered, video-backed safety steps every worker completes before touching a machine.' },
    { icon: Ticket, title: 'Ticketing built in', body: 'Raise an issue straight from the floor; supervisors track it through to resolved.' },
    { icon: Factory, title: 'Per-machine access', body: 'Workers only ever see the machines they\u2019re assigned to — nothing more, nothing less.' },
    { icon: BrainCircuit, title: 'Admin review queue', body: 'Every tip, interview insight, and manual chunk is approved before it becomes searchable.' },
  ];
  return (
    <section id="features" className="max-w-7xl mx-auto px-6 py-24 md:py-32">
      <div className="max-w-2xl mb-16 sv-rise">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber mb-3">The platform</p>
        <h2 className="font-display text-4xl md:text-5xl font-bold leading-[1.05]">Built for the shop floor, not a browser tab.</h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((f, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
            className="sv-card p-6 hover:-translate-y-1 transition-transform duration-300"
          >
            <f.icon size={22} className="text-signal mb-4" />
            <h3 className="font-display font-bold text-lg mb-1.5">{f.title}</h3>
            <p className="text-muted text-sm leading-relaxed">{f.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Flow() {
  return (
    <section className="border-y border-line bg-surface/30 py-24 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal mb-3">One loop, always running</p>
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-14">Ask → Capture → Review → Apply</h2>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {['Worker asks', 'AI answers or flags a gap', 'Senior operator fills it', 'Supervisor approves', 'Everyone benefits'].map((t, i, arr) => (
            <div key={i} className="flex items-center gap-4">
              <motion.div initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="sv-card px-5 py-4 min-w-[150px]">
                <p className="text-sm font-semibold">{t}</p>
              </motion.div>
              {i < arr.length - 1 && <ChevronRight size={18} className="text-signal shrink-0 hidden md:block" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Metrics() {
  const items = [
    { n: '12,400+', l: 'questions answered on the floor' },
    { n: '860', l: 'tips captured from senior operators' },
    { n: '99.2%', l: 'safety briefings completed before shift start' },
    { n: '4.6×', l: 'faster ramp-up for new hires' },
  ];
  return (
    <section className="max-w-7xl mx-auto px-6 py-24">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {items.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="text-center">
            <p className="font-display text-4xl md:text-5xl font-black text-signal mb-2">{m.n}</p>
            <p className="text-muted text-xs md:text-sm">{m.l}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="max-w-7xl mx-auto px-6 pb-28">
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        className="sv-card sv-grid-tile p-12 md:p-16 text-center relative overflow-hidden">
        <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">Don't let the next retirement erase 30 years.</h2>
        <p className="text-muted max-w-lg mx-auto mb-9">Start capturing what your best people know — before the shift ends for good.</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link to="/register" className="inline-flex items-center gap-2 bg-[var(--color-signal)] text-white font-bold px-8 py-4 rounded-full hover:bg-signal-dim transition-all shadow-[0_1px_0_rgba(255,255,255,.25)_inset,0_6px_18px_-6px_rgba(13,159,138,.35)]">
            Register as a worker <ArrowUpRight size={18} />
          </Link>
          <Link to="/login" className="inline-flex items-center gap-2 border border-line px-8 py-4 rounded-full hover:border-signal/50 transition-all font-semibold">
            Supervisor sign-in
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line py-10 px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
        <span className="font-mono">© {new Date().getFullYear()} SkillVault — a factory's collective brain.</span>
        <div className="flex items-center gap-6">
          <Link to="/login" className="hover:text-text">Sign in</Link>
          <Link to="/register" className="hover:text-text">Register</Link>
        </div>
      </div>
    </footer>
  );
}