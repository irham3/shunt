/**
 * Authenticated test fixture — every context starts with:
 *  - the throwaway testnet secret on window.__SHUNT_E2E_SECRET__ so the
 *    app's central signer (src/lib/signer.ts) signs locally, and
 *  - the zustand store seeded with the account address, replacing the
 *    wallet-extension connect step that can't run headless.
 *
 * Nothing else is faked: Horizon, Soroban RPC, the keeper, and the anchor
 * are all the live testnet services.
 */
import { test as base, expect } from "@playwright/test";
import { readE2EState, type E2EState } from "./global-setup";

export const test = base.extend<{ e2e: E2EState }>({
  e2e: async ({}, use) => {
    await use(readE2EState());
  },
  context: async ({ context }, use) => {
    const state = readE2EState();
    await context.addInitScript(
      ([address, secret]) => {
        (window as any).__SHUNT_E2E_SECRET__ = secret;
        const KEY = "shunt-store";
        if (!localStorage.getItem(KEY)) {
          // rulesSavedOnChain starts false — spec 02 exercises the editing UI
          // and performs the real set_rules; later specs recover the "saved"
          // state from the chain itself (Home's syncFromChain on mount reads
          // get_rules and flips the local mirror back to true).
          localStorage.setItem(
            KEY,
            JSON.stringify({
              state: { address, walletId: "e2e", rulesSavedOnChain: false },
              version: 6,
            }),
          );
        }
      },
      [state.publicKey, state.secret],
    );
    await use(context);
  },
});

export { expect };
