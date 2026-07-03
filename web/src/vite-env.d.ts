/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STELLAR_NETWORK?: "testnet" | "mainnet";
  readonly VITE_SOROBAN_RPC_URL?: string;
  readonly VITE_VAULT_CONTRACT_ID?: string;
  readonly VITE_KEEPER_URL?: string;
  readonly VITE_ANCHOR_HOME_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
