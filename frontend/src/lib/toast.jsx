import { createContext, useCallback, useContext, useState } from 'react';
import { Check, X, Info } from 'lucide-react';

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((message, type = 'info') => {
    const id = ++idCounter;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', gap: 8, zIndex: 1000,
      }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 'var(--sv-radius-sm)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              boxShadow: 'var(--sv-shadow-md)', minWidth: 240,
              background: t.type === 'error' ? 'var(--sv-danger)' : t.type === 'success' ? 'var(--sv-teal)' : 'var(--sv-ink)',
              color: '#fff',
            }}
          >
            {t.type === 'error' ? <X size={14} /> : t.type === 'success' ? <Check size={14} /> : <Info size={14} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
