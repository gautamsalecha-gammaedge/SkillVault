import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2 } from 'lucide-react';
import { useVoiceCapture } from '../lib/useVoiceCapture';
import { useToast } from './Toast';

export default function MicButton({ onResult, size = 64, label = true }) {
  const { recording, busy, start, stop } = useVoiceCapture();
  const toast = useToast();

  const handleClick = async () => {
    if (recording) {
      const res = await stop();
      if (res?.transcript) onResult(res);
      else if (res === null) toast.error("Couldn't hear anything. Please try again.");
    } else {
      await start();
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center">
        <AnimatePresence>
          {recording && (
            <>
              <motion.span
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 1.9, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                className="absolute rounded-full bg-danger"
                style={{ width: size, height: size }}
              />
              <motion.span
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 1.5, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
                className="absolute rounded-full bg-danger"
                style={{ width: size, height: size }}
              />
            </>
          )}
        </AnimatePresence>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={handleClick}
          disabled={busy}
          style={{ width: size, height: size }}
          className={`relative rounded-full flex items-center justify-center transition-colors duration-300 ${
            recording ? 'bg-danger text-white' : 'bg-[#2bb89a] text-[#06110d]'
          } shadow-[0_4px_16px_-4px_rgba(43,184,154,0.35)] disabled:opacity-60`}
        >
          {busy ? <Loader2 className="animate-spin" size={size * 0.36} /> : recording ? <Square size={size * 0.32} /> : <Mic size={size * 0.4} />}
        </motion.button>
      </div>
      {label && (
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted">
          {busy ? 'Transcribing…' : recording ? 'Tap to stop' : 'Tap to speak'}
        </p>
      )}
    </div>
  );
}