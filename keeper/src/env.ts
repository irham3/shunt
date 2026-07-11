export interface Env {
  KEEPER_KV: KVNamespace;
  STELLAR_NETWORK: string;
  HORIZON_URL: string;
  SOROBAN_RPC_URL: string;
  NETWORK_PASSPHRASE: string;
  USDC_CODE: string;
  USDC_ISSUER: string;
  VAULT_CONTRACT_ID: string;
  WATCH_ACCOUNTS: string;
}

export function watchAccounts(env: Env): string[] {
  return env.WATCH_ACCOUNTS.split(",").map((s) => s.trim()).filter(Boolean);
}
