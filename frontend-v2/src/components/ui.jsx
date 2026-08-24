import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export function Card({ children, className = '', hover = true, ...rest }) {
  return (
    <div className={`sv-card ${hover ? '' : ''} p-5 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Button({ children, variant = 'primary', size = 'md', className = '', loading = false, icon: Icon, ...rest }) {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3.5 text-base' };
  const variants = {
    primary: 'bg-signal text-white hover:bg-signal-dim shadow-[0_1px_0_rgba(255,255,255,.25)_inset,0_6px_18px_-6px_rgba(13,159,138,.4)]',
    amber: 'bg-amber text-white hover:brightness-105 shadow-[0_1px_0_rgba(255,255,255,.2)_inset,0_6px_18px_-6px_rgba(232,145,15,.35)]',
    ghost: 'bg-surface-2 text-text border border-line hover:border-signal/50 hover:text-signal',
    outline: 'bg-transparent text-text border border-line hover:border-signal/50',
    danger: 'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20',
    subtle: 'bg-transparent text-muted hover:text-text',
  };
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -1 }}
      disabled={loading || rest.disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : Icon ? <Icon size={16} /> : null}
      {children}
    </motion.button>
  );
}

export function Badge({ children, tone = 'default', className = '' }) {
  const tones = {
    default: 'bg-surface-3 text-muted border-line',
    signal: 'bg-signal/10 text-signal border-signal/30',
    amber: 'bg-amber/10 text-amber border-amber/30',
    danger: 'bg-danger/10 text-danger border-danger/30',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border uppercase tracking-wide ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Input({ label, hint, error, className = '', ...rest }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wide">{label}</span>}
      <input
        className={`w-full bg-surface-2 border border-line rounded-xl px-4 py-3.5 text-[15px] text-text placeholder:text-muted/50 outline-none focus:border-signal focus:ring-2 focus:ring-signal/15 transition-all ${className}`}
        {...rest}
      />
      {hint && !error && <span className="block text-xs text-muted mt-1.5">{hint}</span>}
      {error && <span className="block text-xs text-danger mt-1.5">{error}</span>}
    </label>
  );
}

export function Textarea({ label, hint, className = '', ...rest }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wide">{label}</span>}
      <textarea
        className={`w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-sm text-text placeholder:text-muted/50 outline-none focus:border-signal focus:ring-2 focus:ring-signal/15 transition-all resize-none ${className}`}
        {...rest}
      />
      {hint && <span className="block text-xs text-muted mt-1.5">{hint}</span>}
    </label>
  );
}

export function Select({ label, className = '', children, ...rest }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wide">{label}</span>}
      <select
        className={`w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-sm text-text outline-none focus:border-signal focus:ring-2 focus:ring-signal/15 transition-all ${className}`}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 sv-rise">
      <div>
        {eyebrow && <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal mb-2">{eyebrow}</p>}
        <h1 className="font-display text-3xl md:text-4xl font-bold text-text leading-none">{title}</h1>
        {description && <p className="text-muted text-sm mt-2 max-w-xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Spinner({ size = 22, className = '' }) {
  return <Loader2 size={size} className={`animate-spin text-signal ${className}`} />;
}

export function FullPageLoader({ label = 'Loading…' }) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-muted">
      <Spinner size={30} />
      <p className="font-mono text-xs uppercase tracking-widest">{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="sv-card sv-grid-tile px-8 py-16 md:py-20 text-center flex flex-col items-center gap-3 min-h-[280px] justify-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-signal/10 border border-signal/25 flex items-center justify-center text-signal mb-2">
          <Icon size={28} />
        </div>
      )}
      <h3 className="font-display text-xl md:text-2xl font-bold">{title}</h3>
      {description && <p className="text-muted text-sm max-w-md leading-relaxed">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function StatTile({ label, value, sub, tone = 'signal', icon: Icon }) {
  const toneMap = { signal: 'text-signal', amber: 'text-amber', danger: 'text-danger', default: 'text-text' };
  return (
    <div className="sv-card p-5 flex items-start justify-between">
      <div>
        <p className="text-[11px] font-mono uppercase tracking-widest text-muted mb-2">{label}</p>
        <p className={`font-display text-4xl font-bold ${toneMap[tone]}`}>{value}</p>
        {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
      </div>
      {Icon && (
        <div className={`w-10 h-10 rounded-xl bg-surface-3 border border-line flex items-center justify-center ${toneMap[tone]}`}>
          <Icon size={18} />
        </div>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className={`relative sv-card w-full ${wide ? 'max-w-2xl' : 'max-w-md'} p-6 max-h-[86vh] overflow-y-auto`}
      >
        {title && <h3 className="font-display text-2xl font-bold mb-4">{title}</h3>}
        {children}
      </motion.div>
    </div>
  );
}

export function ProgressBar({ value, tone = 'signal' }) {
  const toneMap = { signal: 'bg-signal', amber: 'bg-amber', danger: 'bg-danger' };
  return (
    <div className="w-full h-1.5 rounded-full bg-surface-3 overflow-hidden">
      <motion.div
        className={`h-full ${toneMap[tone]} rounded-full`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  );
}