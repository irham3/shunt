import { useEffect } from "react";
import { useShunt } from "../store";
import { motion, AnimatePresence } from "framer-motion";

export function Toast() {
  const toast = useShunt((s) => s.toast);
  const clearToast = useShunt((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, toast.type === "error" ? 6000 : 4000);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          className="toast"
          role={toast.type === "error" ? "alert" : "status"}
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          style={toast.type === "error" ? { borderColor: "var(--color-danger)" } : undefined}
        >
          {toast.msg}{" "}
          {toast.type === "error" ? (
            <i className="ph-fill ph-warning-circle" style={{ color: "var(--color-danger)", fontSize: 16 }} />
          ) : (
            <i className="ph-fill ph-check-circle" style={{ color: "var(--color-accent-primary)", fontSize: 16 }} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
