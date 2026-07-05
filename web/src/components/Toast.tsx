import { useEffect } from "react";
import { useShunt } from "../store";
import { motion, AnimatePresence } from "framer-motion";

export function Toast() {
  const toast = useShunt((s) => s.toast);
  const clearToast = useShunt((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 4000);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          className="toast"
          role="status"
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          {toast} <i className="ph-fill ph-check-circle" style={{ color: "var(--color-accent-primary)", fontSize: 16 }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
