export interface KeeperConfig {
  horizonUrl: string;
  rpcUrl: string;
  networkPassphrase: string;
  /** USDC asset code + issuer being watched (SAC on Soroban side). */
  usdcCode: string;
  usdcIssuer: string;
  /** ShuntVault contract id (C...). */
  vaultContractId: string;
  /** Accounts to watch, comma separated G... addresses. */
  watchAccounts: string[];
  /** HTTP port for the manual-trigger/health API. */
  port: number;
  /** Path to the JSON file persisting processed tx hashes (idempotency). */
  stateFile: string;
}

export function loadConfig(): KeeperConfig {
  const env = process.env;
  const testnet = (env.STELLAR_NETWORK ?? "testnet") === "testnet";
  return {
    horizonUrl:
      env.HORIZON_URL ??
      (testnet ? "https://horizon-testnet.stellar.org" : "https://horizon.stellar.org"),
    rpcUrl:
      env.SOROBAN_RPC_URL ??
      (testnet ? "https://soroban-testnet.stellar.org" : "https://mainnet.sorobanrpc.com"),
    networkPassphrase:
      env.NETWORK_PASSPHRASE ??
      (testnet ? "Test SDF Network ; September 2015" : "Public Global Stellar Network ; September 2015"),
    usdcCode: env.USDC_CODE ?? "USDC",
    usdcIssuer:
      env.USDC_ISSUER ??
      (testnet
        ? "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" // Circle testnet USDC
        : "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"), // Circle mainnet USDC
    vaultContractId: env.VAULT_CONTRACT_ID ?? "",
    watchAccounts: (env.WATCH_ACCOUNTS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    port: Number(env.PORT ?? 8787),
    stateFile: env.STATE_FILE ?? "./keeper-state.json",
  };
}
