
/**
 * Plain wrapper — no framer-motion.
 * Motion + AnimatePresence was shifting page content down the viewport
 * until a second sidebar click. Layout stability > page fade.
 */
export default function PageTransition({ children }) {
  return <div className="w-full">{children}</div>;
}