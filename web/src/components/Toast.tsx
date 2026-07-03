import { useEffect } from "react";
import { useShunt } from "../store";

export function Toast() {
  const toast = useShunt((s) => s.toast);
  const clearToast = useShunt((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 4000);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  if (!toast) return null;
  return (
    <div className="toast" role="status">
      {toast} <span style={{ color: "var(--color-accent-primary)" }}>✓</span>
    </div>
  );
}
