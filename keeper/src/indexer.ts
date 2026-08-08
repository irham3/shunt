import type { Env } from "./env";
import { xdr, scValToNative } from "@stellar/stellar-sdk";

export interface IndexedEvent {
  id: string;
  type: "PaymentRouted" | "PolicyUpdated" | "EmergencyWithdrawal" | "ObligationWithdrawal" | "GoalLotClaimed";
  account: string;
  contractId: string;
  ledger: number;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface CursorState {
  cursor: string;
  updatedAt: string;
}

const CURSOR_KEY = "indexer:durable_cursor";
const EVENT_PREFIX = "indexer:evt:";

/**
 * Retrieves the currently durable stored event cursor from KV.
 */
export async function getDurableCursor(env: Env): Promise<CursorState> {
  const data = await env.KEEPER_KV.get(CURSOR_KEY, "json") as CursorState | null;
  if (!data) {
    return {
      cursor: "0",
      updatedAt: new Date().toISOString(),
    };
  }
  return data;
}

/**
 * Persistently advances or overwrites the durable event cursor in KV.
 */
export async function setDurableCursor(env: Env, cursor: string): Promise<CursorState> {
  const state: CursorState = {
    cursor: cursor.trim() || "0",
    updatedAt: new Date().toISOString(),
  };
  await env.KEEPER_KV.put(CURSOR_KEY, JSON.stringify(state));
  return state;
}

/**
 * Stores newly discovered Soroban contract events in KV indexed by account & id.
 */
export async function saveIndexedEvent(env: Env, event: IndexedEvent): Promise<void> {
  const key = `${EVENT_PREFIX}${event.account}:${event.id}`;
  await env.KEEPER_KV.put(key, JSON.stringify(event), { expirationTtl: 2592000 }); // 30-day index retention
}

/**
 * Lists recently indexed contract events for a given Stellar account.
 */
export async function listIndexedEvents(env: Env, account: string): Promise<IndexedEvent[]> {
  const prefix = `${EVENT_PREFIX}${account}:`;
  const list = await env.KEEPER_KV.list({ prefix });
  const events: IndexedEvent[] = [];
  
  for (const key of list.keys) {
    const data = await env.KEEPER_KV.get(key.name, "json") as IndexedEvent | null;
    if (data) {
      events.push(data);
    }
  }

  // Sort descending by timestamp / ledger
  return events.sort((a, b) => b.ledger - a.ledger);
}

/**
 * Polls Stellar Soroban RPC node for new smart contract events starting from
 * the stored durable cursor, indexes them into KV, and advances the cursor.
 */
export async function pollSorobanContractEvents(
  env: Env,
  contractId?: string
): Promise<{ ok: boolean; previousCursor: string; currentCursor: string; newEventsCount: number; events: IndexedEvent[] }> {
  const current = await getDurableCursor(env);
  const targetContract = contractId || env.VAULT_CONTRACT_ID || "CC_SHUNT_ROUTER_V2_MOCK";

  try {
    const rpcUrl = env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
    const requestBody = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "getEvents",
      params: {
        startLedger: current.cursor === "0" ? 0 : undefined,
        cursor: current.cursor === "0" ? undefined : current.cursor,
        filters: [
          {
            type: "contract",
            contractIds: [targetContract],
            topics: [["*"]]
          }
        ],
        pagination: { limit: 100 }
      }
    };

    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      throw new Error(`Soroban RPC Error: ${res.status}`);
    }

    const json = await res.json() as any;
    const rpcEvents = json?.result?.events || [];
    const latestCursor = json?.result?.latestLedger 
      ? json.result.latestLedger.toString() 
      : current.cursor;

    // Map RPC raw events to Shunt IndexedEvent format
    const parsedEvents: IndexedEvent[] = rpcEvents.map((evt: any) => {
      let payload: Record<string, any> = {};
      let evtType = "Unknown";
      
      try {
        if (evt.topic && evt.topic.length > 0) {
          const topic0Val = xdr.ScVal.fromXDR(evt.topic[0], "base64");
          if (topic0Val.switch() === xdr.ScValType.scvSymbol()) {
            evtType = topic0Val.sym().toString();
          }
        }

        if (evt.value && evt.value.xdr) {
          const val = xdr.ScVal.fromXDR(evt.value.xdr, "base64");
          const native = scValToNative(val) as Record<string, any>;
          
          // Convert any Uint8Arrays or Buffers (like request_id or hashes) to hex strings
          // and any BigInts to strings for JSON serialization
          for (const [k, v] of Object.entries(native)) {
            if (v instanceof Uint8Array || Buffer.isBuffer(v)) {
              payload[k] = Buffer.from(v).toString("hex");
            } else if (typeof v === "bigint") {
              payload[k] = v.toString();
            } else {
              payload[k] = v;
            }
          }
        }
      } catch (err) {
        console.error("Failed to parse event XDR:", err);
      }

      let account = "UNKNOWN_ACCOUNT";
      if (payload.recipient) account = payload.recipient as string;
      else if (payload.owner) account = payload.owner as string;
      else if (payload.payer) account = payload.payer as string;

      return {
        id: evt.id,
        type: evtType as any,
        account, 
        contractId: evt.contractId,
        ledger: parseInt(evt.ledger, 10),
        timestamp: evt.ledgerClosedAt || new Date().toISOString(),
        payload, 
      };
    });

    for (const evt of parsedEvents) {
      await saveIndexedEvent(env, evt);
    }

    await setDurableCursor(env, latestCursor);

    return {
      ok: true,
      previousCursor: current.cursor,
      currentCursor: latestCursor,
      newEventsCount: parsedEvents.length,
      events: parsedEvents,
    };
  } catch (err) {
    return {
      ok: false,
      previousCursor: current.cursor,
      currentCursor: current.cursor,
      newEventsCount: 0,
      events: [],
    };
  }
}
