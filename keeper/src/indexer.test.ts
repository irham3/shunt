import { describe, it, expect, beforeEach, vi } from "vitest";
import worker from "./index";
import { getDurableCursor, setDurableCursor, listIndexedEvents, pollSorobanContractEvents } from "./indexer";

class MockKV {
  private store = new Map<string, any>();

  async get(key: string, type?: string) {
    const val = this.store.get(key);
    if (val === undefined) return null;
    if (type === "json") return JSON.parse(val);
    return val;
  }

  async put(key: string, value: string, options?: any) {
    this.store.set(key, value);
  }

  async delete(key: string) {
    this.store.delete(key);
  }

  async list({ prefix }: { prefix?: string }) {
    const keys = Array.from(this.store.keys())
      .filter((k) => !prefix || k.startsWith(prefix))
      .map((k) => ({ name: k }));
    return { keys, list_complete: true };
  }
}

describe("Shunt v2 Durable Event Indexer", () => {
  let env: any;

  beforeEach(() => {
    env = {
      KEEPER_KV: new MockKV(),
      VAULT_CONTRACT_ID: "CC_SHUNT_V2_INDEXER_TEST_CONTRACT",
      NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
      WATCH_ACCOUNTS: "GA_ACCOUNT1",
      HORIZON_URL: "https://horizon-testnet.stellar.org",
      SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          latestLedger: 999999,
          events: [
            {
              id: "00001-00001",
              type: "contract",
              contractId: "CC_TEST_CONTRACT",
              ledger: "999998",
              ledgerClosedAt: new Date().toISOString()
            }
          ]
        }
      })
    }) as any;
  });

  it("returns default cursor '0' when no cursor in storage", async () => {
    const state = await getDurableCursor(env);
    expect(state.cursor).toBe("0");
  });

  it("updates and persists durable cursor in KV", async () => {
    const state = await setDurableCursor(env, "ledger_cursor_89201");
    expect(state.cursor).toBe("ledger_cursor_89201");

    const retrieved = await getDurableCursor(env);
    expect(retrieved.cursor).toBe("ledger_cursor_89201");
  });

  it("polls Soroban contract events, indexes them, and advances durable cursor", async () => {
    const res = await pollSorobanContractEvents(env, "CC_TEST_CONTRACT");
    expect(res.ok).toBe(true);
    expect(res.newEventsCount).toBeGreaterThan(0);
    expect(res.previousCursor).toBe("0");
    expect(res.currentCursor).not.toBe("0");

    // Check if event is listed in index storage
    const accountEvents = await listIndexedEvents(env, "GA_PRIMARY_RECIPIENT_WALLET_INDEXER");
    expect(accountEvents.length).toBe(1);
    expect(accountEvents[0].type).toBe("PaymentRouted");
    expect(accountEvents[0].payload).toHaveProperty("gross", 3500);
  });

  it("serves durable event indexing via Cloudflare Worker HTTP routing", async () => {
    // 1. GET /indexer/cursor
    const getRes = await worker.fetch(new Request("http://localhost/indexer/cursor"), env);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json() as any;
    expect(getData.cursor).toBe("0");

    // 2. POST /indexer/poll
    const pollRes = await worker.fetch(new Request("http://localhost/indexer/poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId: "CC_HTTP_POLL_CONTRACT" }),
    }), env);
    expect(pollRes.status).toBe(200);
    const pollData = await pollRes.json() as any;
    expect(pollData.ok).toBe(true);
    expect(pollData.currentCursor).not.toBe("0");

    // 3. Verify cursor advanced via GET /indexer/cursor
    const getResAfter = await worker.fetch(new Request("http://localhost/indexer/cursor"), env);
    const getDataAfter = await getResAfter.json() as any;
    expect(getDataAfter.cursor).toBe(pollData.currentCursor);
  });
});
