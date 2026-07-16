import { motion } from "framer-motion";

/** Cross-screen navigation motion — enter-only fade/rise on mount. No exit
    animation on purpose: routing must never wait on an exit to complete. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
