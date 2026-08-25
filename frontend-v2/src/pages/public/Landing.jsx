import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowUpRight, Mic, ShieldCheck, BrainCircuit, Ticket,
  Fingerprint, Factory, Waves, ChevronRight, Check, Sparkles,
  Users, BookOpen, MessageCircleQuestion, Mic2, HardHat, Radio,
} from 'lucide-react';

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
};

export default function Landing() {
  return (
    <div className="overflow-x-clip bg-[#f7f4ef] text-stone-900">
      <TopBar />
      <Hero />
      <TrustStrip />
      <Problem />
      <Results />
      <Handoff />
      <Features />
      <Flow />
      <Metrics />
      <CTA />
      <Footer />
    </div>
  );
}

/* ─── Top bar ─────────────────────────────────────────── */

function TopBar() {
  return (
    <header className="sticky top-0 z-50">
      <div
        className="border-b border-stone-200/80 shadow-[0_1px_0_rgba(255,255,255,0.75)_inset,0_12px_32px_-12px_rgba(28,25,23,0.16)]"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,252,248,0.99) 0%, rgba(250,247,242,0.96) 100%)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}
      >
        {/* Taller bar — standard desktop ~72–80px for easy reading */}
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-[4.75rem] sm:h-[5.25rem] md:h-[5.75rem] flex items-center justify-between gap-5">
          <Link to="/" className="flex items-center gap-3 shrink-0 group">
            <div className="relative w-12 h-12 sm:w-[3.25rem] sm:h-[3.25rem] rounded-[13px] bg-gradient-to-br from-[#0f9d8a] to-[#0b7a6b] flex items-center justify-center shadow-[0_3px_12px_-2px_rgba(15,157,138,0.5)] group-hover:shadow-[0_5px_16px_-2px_rgba(15,157,138,0.55)] transition-shadow">
              <span className="absolute inset-[3px] rounded-[10px] border border-white/30" />
              <div className="w-3 h-3 rounded-full bg-white shadow-sm" />
            </div>
            <div className="leading-none">
              <span className="font-display font-bold text-[1.35rem] sm:text-[1.5rem] tracking-tight text-stone-900">
                SkillVault
              </span>
              <span className="hidden sm:block text-[12px] font-mono uppercase tracking-[0.16em] text-stone-500 mt-1">
                Shop-floor knowledge
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 p-1.5 rounded-full border border-stone-200/90 bg-white/90 shadow-[0_1px_4px_rgba(28,25,23,0.06)]">
            {[
              { href: '#problem', label: 'The Problem' },
              { href: '#results', label: 'Results' },
              { href: '#how', label: 'How it Works' },
              { href: '#features', label: 'Platform' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-5 py-2.5 rounded-full text-[15px] sm:text-base font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center h-12 px-5 rounded-full text-[15px] font-semibold text-stone-700 hover:text-stone-900 hover:bg-stone-100/90 transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center h-12 sm:h-[3.25rem] px-6 sm:px-7 rounded-full text-[15px] sm:text-base font-semibold text-white bg-[#0f9d8a] hover:bg-[#0d8a79] transition-all shadow-[0_1px_0_rgba(255,255,255,0.22)_inset,0_8px_18px_-6px_rgba(15,157,138,0.55)]"
            >
              Join the floor
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ─── Hero ─────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative pt-16 pb-24 md:pt-24 md:pb-32 px-6 overflow-hidden">
      {/* Ambient glow layers */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 15% 25%, rgba(15,157,138,0.16), transparent 55%), radial-gradient(ellipse 55% 45% at 88% 15%, rgba(217,119,6,0.12), transparent 50%), radial-gradient(ellipse 40% 30% at 50% 100%, rgba(15,157,138,0.06), transparent 50%), linear-gradient(180deg, #faf7f2 0%, #f3eee6 100%)',
        }}
      />
      {/* Soft noise-like dots */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(rgba(120,100,80,0.12) 0.8px, transparent 0.8px)',
          backgroundSize: '22px 22px',
        }}
      />

      <div className="relative max-w-7xl mx-auto grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#0b7a6b] border border-[#0f9d8a]/25 bg-white/70 backdrop-blur-sm px-3.5 py-1.5 rounded-full mb-7 shadow-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0f9d8a] opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0f9d8a]" />
            </span>
            Shop-floor knowledge that ships
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.06 }}
            className="font-display font-black text-[11.5vw] sm:text-6xl lg:text-[4.6rem] leading-[0.96] tracking-[-0.03em] text-stone-900"
          >
            We capture AI
            <br />
            knowledge
            <br />
            <span className="bg-gradient-to-r from-[#0f9d8a] via-[#0d8f7d] to-[#0b7a6b] bg-clip-text text-transparent">
              that actually stays
            </span>
            <br />
            on the floor.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.14 }}
            className="mt-7 text-[17px] text-stone-500 max-w-[28rem] leading-relaxed"
          >
            Thirty years of knowing when a machine sounds wrong lives in one person&apos;s head — until it doesn&apos;t.
            SkillVault listens, distills, and hands that know-how to every worker by voice, in seconds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.22 }}
            className="mt-9 flex flex-wrap items-center gap-3.5"
          >
            <Link
              to="/register"
              className="group inline-flex items-center gap-2 bg-[#0f9d8a] text-white font-bold px-7 py-3.5 rounded-full hover:bg-[#0d8a79] transition-all shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_10px_28px_-8px_rgba(15,157,138,0.55)] hover:shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_14px_32px_-8px_rgba(15,157,138,0.65)] hover:-translate-y-0.5"
            >
              Register as a worker
              <ArrowUpRight size={18} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 border-2 border-stone-200/90 bg-white/80 text-stone-800 font-semibold px-7 py-3.5 rounded-full hover:border-[#0f9d8a]/40 hover:bg-white transition-all shadow-sm"
            >
              Supervisor sign-in
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.8 }}
            className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-mono text-stone-400 uppercase tracking-[0.14em]"
          >
            {['Voice-first', 'Works mid-shift', 'No typing required'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check size={13} className="text-[#0f9d8a]" strokeWidth={2.5} />
                {t}
              </span>
            ))}
          </motion.div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

function HeroVisual() {
  const bars = Array.from({ length: 26 });
  const nodes = [
    { x: 28, y: 18 }, { x: 72, y: 14 }, { x: 12, y: 52 }, { x: 88, y: 48 },
    { x: 42, y: 82 }, { x: 62, y: 38 }, { x: 22, y: 86 }, { x: 80, y: 80 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.85, delay: 0.15 }}
      className="relative mx-auto w-full max-w-[420px]"
    >
      {/* Glow behind card */}
      <div
        className="absolute -inset-6 rounded-[2.5rem] blur-2xl opacity-60"
        style={{
          background:
            'radial-gradient(circle at 40% 40%, rgba(15,157,138,0.25), transparent 60%), radial-gradient(circle at 80% 20%, rgba(217,119,6,0.15), transparent 50%)',
        }}
      />

      <div
        className="relative aspect-square rounded-[1.75rem] border border-stone-200/80 overflow-hidden shadow-[0_24px_60px_-20px_rgba(28,25,23,0.22)]"
        style={{
          background:
            'linear-gradient(155deg, #fffcf8 0%, #f4efe7 55%, #ebe4d8 100%)',
        }}
      >
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'linear-gradient(rgba(140,120,100,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(140,120,100,0.14) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />

        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
          {nodes.map((n, i) => (
            <g key={i}>
              <motion.line
                x1="50"
                y1="50"
                x2={n.x}
                y2={n.y}
                stroke="#0f9d8a"
                strokeWidth="0.45"
                strokeOpacity="0.55"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.55 }}
                transition={{ duration: 1.1, delay: 0.7 + i * 0.1, ease: 'easeOut' }}
              />
              <motion.circle
                cx={n.x}
                cy={n.y}
                r="2.4"
                fill="#fffcf8"
                stroke="#0f9d8a"
                strokeWidth="0.7"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.45, delay: 1.2 + i * 0.1 }}
              />
            </g>
          ))}
        </svg>

        {/* Center pulse */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-[7.5rem] h-[7.5rem] rounded-full bg-white/90 border border-[#0f9d8a]/30 flex items-center justify-center shadow-[0_12px_40px_-12px_rgba(15,157,138,0.45)]">
            <motion.div
              className="absolute inset-0 rounded-full border border-[#0f9d8a]/35"
              animate={{ scale: [1, 1.55, 1], opacity: [0.55, 0, 0.55] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute inset-[-8px] rounded-full border border-[#0f9d8a]/15"
              animate={{ scale: [1, 1.35, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
            />
            <div className="flex items-end gap-[3px] h-10">
              {bars.map((_, i) => (
                <motion.span
                  key={i}
                  className="w-[2.5px] rounded-full bg-gradient-to-t from-[#0b7a6b] to-[#0f9d8a]"
                  animate={{ height: [7, 12 + ((i * 17) % 26), 7] }}
                  transition={{
                    duration: 0.85 + (i % 5) * 0.1,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: (i % 7) * 0.07,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating chips */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.5 }}
        className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-2 rounded-full bg-white border border-stone-200/90 shadow-lg text-xs font-medium text-stone-600 whitespace-nowrap"
      >
        <Fingerprint size={14} className="text-amber-600" />
        <span className="font-mono text-[11px] tracking-wide">tacit → structured insight</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.35, duration: 0.5 }}
        className="absolute -left-2 md:-left-6 bottom-16 flex items-center gap-2 px-3 py-2 rounded-2xl bg-white border border-stone-200/90 shadow-lg text-xs"
      >
        <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-[#0f9d8a]">
          <Mic size={15} />
        </div>
        <div>
          <p className="font-semibold text-stone-800 text-[12px]">Voice capture</p>
          <p className="text-stone-400 text-[10px] font-mono">mid-shift ready</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.5, duration: 0.5 }}
        className="absolute -right-2 md:-right-4 top-24 flex items-center gap-2 px-3 py-2 rounded-2xl bg-white border border-stone-200/90 shadow-lg text-xs"
      >
        <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
          <ShieldCheck size={15} />
        </div>
        <div>
          <p className="font-semibold text-stone-800 text-[12px]">Admin approved</p>
          <p className="text-stone-400 text-[10px] font-mono">before it goes live</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Trust strip ──────────────────────────────────────── */

function TrustStrip() {
  const items = [
    'CNC-204 LATHE',
    'PRESS-BRAKE-11',
    'WELD CELL 4',
    'INJECTION-M2',
    'PACK LINE 7',
    'ROBOT ARM 03',
    'GRINDER-09',
    'ASSEMBLY BAY 2',
  ];
  return (
    <div className="relative border-y border-stone-200/80 py-7 overflow-hidden bg-white/50">
      <p className="text-center text-[10px] font-mono uppercase tracking-[0.22em] text-stone-400 mb-5">
        Live knowledge streaming from
      </p>
      <div className="flex gap-10 animate-[marquee_28s_linear_infinite] w-max">
        {[...items, ...items].map((t, i) => (
          <span
            key={i}
            className="font-mono text-sm text-stone-400/90 shrink-0 flex items-center gap-10"
          >
            {t}
            <span className="w-1.5 h-1.5 rounded-full bg-[#0f9d8a]/40" />
          </span>
        ))}
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}

/* ─── Problem ──────────────────────────────────────────── */

function Problem() {
  const stats = [
    {
      n: '41%',
      l: 'of skilled trade workers reach retirement age within 10 years',
      s: 'Industry workforce studies',
    },
    {
      n: '3–6 mo',
      l: 'typical ramp time for a new hire to reach solo competence on a machine',
      s: 'without a formal capture process',
    },
    {
      n: '0',
      l: 'of it written down — most fixes live only in one operator\u2019s memory',
      s: 'until SkillVault',
    },
  ];
  return (
    <section
      id="problem"
      className="relative scroll-mt-28 py-24 md:py-32 px-6"
      style={{
        background:
          'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(217,119,6,0.1), transparent 55%), linear-gradient(180deg, #f5f0e8 0%, #efe9df 100%)',
      }}
    >
      <div className="max-w-7xl mx-auto">
        <motion.div {...fadeUp} transition={{ duration: 0.55 }} className="max-w-2xl mb-14">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-px bg-amber-600/50" /> The problem
          </p>
          <h2 className="font-display text-4xl md:text-[2.75rem] font-bold leading-[1.08] tracking-tight">
            Knowledge walks out the door{' '}
            <span className="text-stone-400">every time someone clocks out for the last time.</span>
          </h2>
          <p className="mt-5 text-[16px] text-stone-500 leading-relaxed max-w-xl">
            Manuals cover the design. They rarely capture the sound of a bad bearing, the sequence that clears a jam, or the safety habit that prevents a near-miss.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-5">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group relative p-7 md:p-8 rounded-2xl border border-stone-200/90 bg-white/80 backdrop-blur-sm shadow-[0_8px_30px_-16px_rgba(28,25,23,0.12)] hover:shadow-[0_16px_40px_-16px_rgba(28,25,23,0.18)] hover:-translate-y-1 transition-all duration-300"
            >
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#0f9d8a]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="font-display text-5xl font-black text-[#0f9d8a] mb-3 tracking-tight">{s.n}</p>
              <p className="text-stone-700 text-[15px] leading-relaxed mb-4">{s.l}</p>
              <p className="text-[11px] font-mono text-stone-400 uppercase tracking-wide">{s.s}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Results ──────────────────────────────────────────── */

function Results() {
  const cases = [
    {
      tag: 'Voice on the floor',
      title: 'Ask AI that never guesses',
      body: 'Answers come only from manuals and approved tips — spoken back in the worker’s language, mid-shift, hands-free. Attach a photo of the issue when words aren’t enough.',
      metric: 'Seconds',
      metricLabel: 'to a grounded answer',
      icon: MessageCircleQuestion,
      accent: '#0f9d8a',
    },
    {
      tag: 'Tacit capture',
      title: 'Knowledge that survives retirement',
      body: 'Guided AI interviews pull out what senior operators never write down — then supervisors approve before it goes live on the floor.',
      metric: 'Topic by topic',
      metricLabel: 'structured interviews',
      icon: Mic2,
      accent: '#d97706',
    },
    {
      tag: 'Safety first',
      title: 'Briefings before the first part',
      body: 'Ordered safety steps with optional video. Workers complete them per machine; supervisors track completions and retakes.',
      metric: 'Required',
      metricLabel: 'before operating',
      icon: HardHat,
      accent: '#0f9d8a',
    },
  ];
  return (
    <section
      id="results"
      className="relative scroll-mt-28 py-24 md:py-32 px-6 border-y border-stone-200/70"
      style={{
        background:
          'radial-gradient(ellipse 60% 45% at 100% 30%, rgba(15,157,138,0.1), transparent 50%), radial-gradient(ellipse 45% 35% at 0% 80%, rgba(217,119,6,0.07), transparent 45%), #fffcf8',
      }}
    >
      <div className="max-w-7xl mx-auto">
        <motion.div {...fadeUp} transition={{ duration: 0.55 }} className="max-w-2xl mb-14">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#0b7a6b] mb-3 flex items-center gap-2">
            <span className="w-6 h-px bg-[#0f9d8a]/50" /> Real systems. Measurable outcomes.
          </p>
          <h2 className="font-display text-4xl md:text-[2.75rem] font-bold leading-[1.08] tracking-tight">
            Built for the shop floor — with the numbers that matter.
          </h2>
          <p className="mt-5 text-[16px] text-stone-500 leading-relaxed">
            Production-grade capture, review, and delivery — not a chatbot bolted onto a PDF.
          </p>
        </motion.div>
        <div className="grid lg:grid-cols-3 gap-6">
          {cases.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.55, delay: i * 0.1 }}
              className="group relative flex flex-col h-full p-7 md:p-8 rounded-2xl border border-stone-200/90 bg-white shadow-[0_10px_40px_-20px_rgba(28,25,23,0.15)] hover:-translate-y-1.5 hover:shadow-[0_20px_50px_-18px_rgba(28,25,23,0.2)] transition-all duration-300 overflow-hidden"
            >
              <div
                className="absolute top-0 inset-x-0 h-1 opacity-80"
                style={{ background: `linear-gradient(90deg, transparent, ${c.accent}, transparent)` }}
              />
              <div className="flex items-center justify-between gap-3 mb-5">
                <span
                  className="text-[11px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full border"
                  style={{
                    color: c.accent,
                    borderColor: `${c.accent}40`,
                    background: `${c.accent}12`,
                  }}
                >
                  {c.tag}
                </span>
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center border"
                  style={{
                    color: c.accent,
                    borderColor: `${c.accent}35`,
                    background: `${c.accent}12`,
                  }}
                >
                  <c.icon size={20} />
                </div>
              </div>
              <h3 className="font-display text-2xl font-bold mb-2.5 tracking-tight">{c.title}</h3>
              <p className="text-[15px] text-stone-500 leading-relaxed flex-1 mb-6">{c.body}</p>
              <div className="pt-5 border-t border-stone-100">
                <p className="font-display text-3xl font-black tracking-tight" style={{ color: c.accent }}>
                  {c.metric}
                </p>
                <p className="text-sm text-stone-400 mt-1">{c.metricLabel}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How it works ─────────────────────────────────────── */

function Handoff() {
  const steps = [
    {
      n: '01',
      title: 'A senior operator speaks',
      body: 'No forms, no typing. They talk through a fix the same way they’d explain it to an apprentice — SkillVault records it.',
      icon: Mic,
      meta: 'Voice or text',
    },
    {
      n: '02',
      title: 'AI distills tacit into explicit',
      body: 'A guided interview asks the follow-up a good trainer would ask, then turns the answer into a clear, reusable tip.',
      icon: BrainCircuit,
      meta: 'Scoped to the machine',
    },
    {
      n: '03',
      title: 'A supervisor reviews once',
      body: 'Every tip is queued for approval before it goes live — quality control without slowing anyone down.',
      icon: ShieldCheck,
      meta: 'Pending → live',
    },
    {
      n: '04',
      title: 'Every worker can ask, anytime',
      body: 'Any worker on that machine can ask out loud and get an answer grounded in real, approved know-how.',
      icon: Waves,
      meta: 'Ongoing',
    },
  ];
  return (
    <section
      id="how"
      className="relative scroll-mt-28 py-24 md:py-32 px-6"
      style={{
        background: 'linear-gradient(180deg, #e9e1d4 0%, #e6ddd0 35%, #f0ebe3 100%)',
      }}
    >
      <div className="max-w-7xl mx-auto">
        <motion.div {...fadeUp} transition={{ duration: 0.55 }} className="max-w-2xl mb-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#0b7a6b] mb-3 flex items-center gap-2">
            <span className="w-6 h-px bg-[#0f9d8a]/50" /> How we work
          </p>
          <h2 className="font-display text-4xl md:text-[2.75rem] font-bold leading-[1.08] tracking-tight">
            From one operator&apos;s head to the whole floor&apos;s hands.
          </h2>
          <p className="mt-5 text-[16px] text-stone-500 leading-relaxed">
            Four steps from a spoken tip to a searchable, supervisor-approved answer — timeline depends on your machines and shift pattern.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-2 gap-5">
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group flex gap-5 p-7 md:p-8 rounded-2xl border border-stone-200/80 bg-[#fffcf8]/95 shadow-[0_8px_28px_-16px_rgba(28,25,23,0.12)] hover:shadow-[0_16px_36px_-14px_rgba(28,25,23,0.16)] hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="w-12 h-12 rounded-xl bg-[#0f9d8a]/10 border border-[#0f9d8a]/30 flex items-center justify-center text-[#0f9d8a] group-hover:bg-[#0f9d8a] group-hover:text-white transition-colors duration-300">
                  <s.icon size={22} />
                </div>
                <span className="text-[11px] font-mono font-bold text-stone-400">{s.n}</span>
              </div>
              <div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-amber-700 mb-1.5">{s.meta}</p>
                <h3 className="font-display font-bold text-xl mb-2 tracking-tight">{s.title}</h3>
                <p className="text-stone-500 text-[15px] leading-relaxed">{s.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Platform ─────────────────────────────────────────── */

function Features() {
  const items = [
    {
      icon: Mic,
      title: 'Ask by voice',
      body: 'Speak a question in your own language and get a grounded, spoken answer — optional photo of the issue for visual context.',
    },
    {
      icon: BrainCircuit,
      title: 'Tacit Knowledge Capture',
      body: 'A guided AI interview draws out the reasoning senior operators never think to write down, topic by topic.',
    },
    {
      icon: ShieldCheck,
      title: 'Machine safety briefings',
      body: 'Ordered, video-backed safety steps every worker completes before touching a machine.',
    },
    {
      icon: Ticket,
      title: 'Ticketing built in',
      body: 'Raise an issue straight from the floor; supervisors track it through to resolved.',
    },
    {
      icon: Factory,
      title: 'Per-machine access',
      body: 'Workers only ever see the machines they’re assigned to — nothing more, nothing less.',
    },
    {
      icon: BookOpen,
      title: 'Admin review queue',
      body: 'Every tip, interview insight, and manual chunk is approved before it becomes searchable.',
    },
  ];
  return (
    <section
      id="features"
      className="relative scroll-mt-28 py-24 md:py-32 px-6"
      style={{
        background:
          'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(15,157,138,0.08), transparent 55%), linear-gradient(180deg, #f5f0e8 0%, #fffcf8 100%)',
      }}
    >
      <div className="max-w-7xl mx-auto">
        <motion.div {...fadeUp} transition={{ duration: 0.55 }} className="max-w-2xl mb-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-px bg-amber-600/50" /> The platform
          </p>
          <h2 className="font-display text-4xl md:text-[2.75rem] font-bold leading-[1.08] tracking-tight">
            Built for the shop floor, not a browser tab.
          </h2>
          <p className="mt-5 text-[16px] text-stone-500 leading-relaxed">
            Voice, safety, tips, interviews, and tickets in one loop — designed so operators can use it between cycles.
          </p>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.07 }}
              className="group p-6 md:p-7 rounded-2xl border border-stone-200/90 bg-white/90 shadow-[0_6px_24px_-14px_rgba(28,25,23,0.1)] hover:-translate-y-1 hover:shadow-[0_14px_36px_-14px_rgba(28,25,23,0.16)] hover:border-[#0f9d8a]/25 transition-all duration-300"
            >
              <div className="w-11 h-11 rounded-xl bg-[#0f9d8a]/10 border border-[#0f9d8a]/20 flex items-center justify-center text-[#0f9d8a] mb-4 group-hover:bg-[#0f9d8a] group-hover:text-white group-hover:border-[#0f9d8a] transition-colors duration-300">
                <f.icon size={20} />
              </div>
              <h3 className="font-display font-bold text-lg mb-2 tracking-tight">{f.title}</h3>
              <p className="text-stone-500 text-[15px] leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Flow ─────────────────────────────────────────────── */

function Flow() {
  const steps = [
    'Worker asks',
    'AI answers or flags a gap',
    'Senior operator fills it',
    'Supervisor approves',
    'Everyone benefits',
  ];
  return (
    <section
      className="relative py-24 px-6 border-y border-stone-200/70"
      style={{
        background: 'linear-gradient(180deg, #e6ddd0 0%, #ebe4d8 50%, #f0ebe3 100%)',
      }}
    >
      <div className="max-w-5xl mx-auto text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#0b7a6b] mb-3">
          One loop, always running
        </p>
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 tracking-tight">
          Ask → Capture → Review → Apply
        </h2>
        <p className="text-[16px] text-stone-500 max-w-lg mx-auto mb-14 leading-relaxed">
          Gaps discovered on the floor become tips. Approved tips become the next answer — without a separate knowledge project.
        </p>
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-2 flex-wrap">
          {steps.map((t, i, arr) => (
            <div key={i} className="flex items-center gap-2 md:gap-3">
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="px-5 py-3.5 min-w-[140px] rounded-xl border border-stone-200/90 bg-white shadow-sm"
              >
                <p className="text-sm font-semibold text-stone-800">{t}</p>
              </motion.div>
              {i < arr.length - 1 && (
                <ChevronRight size={18} className="text-[#0f9d8a] shrink-0 hidden md:block" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Metrics ──────────────────────────────────────────── */

function Metrics() {
  const items = [
    { n: '12,400+', l: 'questions answered on the floor', icon: MessageCircleQuestion },
    { n: '860', l: 'tips captured from senior operators', icon: Sparkles },
    { n: '99.2%', l: 'safety briefings completed before shift start', icon: ShieldCheck },
    { n: '4.6×', l: 'faster ramp-up for new hires', icon: Users },
  ];
  return (
    <section
      className="relative py-24 px-6"
      style={{
        background:
          'radial-gradient(ellipse 55% 50% at 50% 50%, rgba(15,157,138,0.09), transparent 65%), #f5f0e8',
      }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#0b7a6b] mb-2">Impact</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            What continuous capture looks like
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
          {items.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="p-6 rounded-2xl border border-stone-200/90 bg-white/90 text-center shadow-[0_8px_28px_-16px_rgba(28,25,23,0.12)] hover:-translate-y-1 transition-transform duration-300"
            >
              <m.icon size={18} className="text-[#0f9d8a] mx-auto mb-3 opacity-85" />
              <p className="font-display text-4xl md:text-5xl font-black text-[#0f9d8a] mb-2 tracking-tight">
                {m.n}
              </p>
              <p className="text-stone-500 text-sm leading-snug">{m.l}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA ──────────────────────────────────────────────── */

function CTA() {
  return (
    <section className="max-w-7xl mx-auto px-6 pb-28 pt-10">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-[1.75rem] border border-stone-200/90 p-12 md:p-16 text-center shadow-[0_24px_60px_-24px_rgba(28,25,23,0.2)]"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 15% 0%, rgba(15,157,138,0.18), transparent 50%), radial-gradient(ellipse 55% 50% at 95% 100%, rgba(217,119,6,0.12), transparent 45%), linear-gradient(155deg, #fffcf8 0%, #f0ebe3 100%)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.28]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(140,120,100,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(140,120,100,0.18) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative">
          <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-[#0b7a6b] border border-[#0f9d8a]/25 bg-white/70 px-3 py-1 rounded-full mb-6">
            <Radio size={12} /> Start capturing today
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Ready to build knowledge
            <br className="hidden sm:block" /> that actually stays?
          </h2>
          <p className="text-stone-500 text-[16px] max-w-lg mx-auto mb-10 leading-relaxed">
            Start capturing what your best people know — before the next retirement erases thirty years of judgment.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3.5">
            <Link
              to="/register"
              className="group inline-flex items-center gap-2 bg-[#0f9d8a] text-white font-bold px-8 py-4 rounded-full hover:bg-[#0d8a79] transition-all shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_10px_28px_-8px_rgba(15,157,138,0.55)] hover:-translate-y-0.5"
            >
              Register as a worker
              <ArrowUpRight size={18} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 border-2 border-stone-200 bg-white/80 px-8 py-4 rounded-full hover:border-[#0f9d8a]/40 transition-all font-semibold shadow-sm"
            >
              Supervisor sign-in
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/* ─── Footer ───────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="relative overflow-hidden">
      {/* Top edge highlight */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#0f9d8a]/50 to-transparent" />

      <div
        className="px-6 py-14 md:py-16"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 10% 0%, rgba(15,157,138,0.22), transparent 50%), radial-gradient(ellipse 50% 50% at 95% 100%, rgba(217,119,6,0.12), transparent 45%), linear-gradient(180deg, #292524 0%, #1c1917 45%, #0c0a09 100%)',
        }}
      >
        <div className="max-w-7xl mx-auto">
          {/* Main row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 pb-10 border-b border-white/10">
            {/* Brand */}
            <div className="max-w-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-[11px] bg-gradient-to-br from-[#0f9d8a] to-[#0b7a6b] flex items-center justify-center shadow-[0_4px_14px_-2px_rgba(15,157,138,0.45)]">
                  <span className="absolute w-10 h-10 rounded-[11px] border border-white/20 pointer-events-none" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white" />
                </div>
                <div>
                  <p className="font-display font-bold text-white text-lg tracking-tight leading-none">
                    SkillVault
                  </p>
                  <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-stone-300 mt-1">
                    Shop-floor knowledge
                  </p>
                </div>
              </div>
              <p className="text-sm text-stone-300 leading-relaxed">
                Capture what your best operators know — before it walks out the door.
              </p>
            </div>

            {/* Links */}
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="https://gammaedge.ai/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center h-11 px-5 rounded-full text-sm font-semibold text-stone-900 bg-white hover:bg-stone-100 border border-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)] transition-all"
              >
                GammaEdge
              </a>
              <Link
                to="/login"
                className="inline-flex items-center h-11 px-5 rounded-full text-sm font-semibold text-stone-900 bg-white hover:bg-stone-100 border border-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)] transition-all"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center h-11 px-6 rounded-full text-sm font-semibold text-white bg-[#0f9d8a] hover:bg-[#12b09b] transition-all shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_8px_20px_-6px_rgba(15,157,138,0.55)]"
              >
                Register
              </Link>
            </div>
          </div>

          {/* Bottom meta */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-stone-500">
            <p className="font-mono">
              © {new Date().getFullYear()} SkillVault — a factory&apos;s collective brain.
            </p>
            <p className="font-mono text-stone-600">
              Built with care for the shop floor
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}