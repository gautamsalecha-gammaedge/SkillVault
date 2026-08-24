import { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastCtx = createContext(null);
let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, type = 'info') => {
    const id = ++idCounter;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  const value = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  };

  const icon = { success: CheckCircle2, error: XCircle, info: Info };
  const color = { success: 'text-signal border-signal/40', error: 'text-danger border-danger/40', info: 'text-amber border-amber/40' };

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-[999] flex flex-col gap-2 w-[min(92vw,360px)]">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = icon[t.type];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                className={`sv-card ${color[t.type]} border !border px-4 py-3 flex items-start gap-2.5 shadow-2xl bg-surface`}
              >
                <Icon size={18} className="mt-0.5 shrink-0" />
                <p className="text-sm text-text/90 leading-snug flex-1">{t.message}</p>
                <button onClick={() => dismiss(t.id)} className="text-muted hover:text-text">
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
