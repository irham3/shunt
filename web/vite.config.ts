import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      bindings: path.resolve(__dirname, "../contracts/shunt-vault/bindings/src"),
    },
  },
  define: {
    global: "window", // stellar-sdk expects a node-ish global
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          stellar: ["@stellar/stellar-sdk", "@stellar/freighter-api", "@creit.tech/stellar-wallets-kit"],
          vendor: ["react", "react-dom", "react-router-dom", "framer-motion", "zustand"],
        },
      },
    },
    chunkSizeWarningLimit: 2200,
  },
});
