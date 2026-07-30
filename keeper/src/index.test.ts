import { describe, it, expect, vi, beforeEach } from "vitest";
import worker, { handleInflow, confirmJob } from "./index";
import * as distribute from "./distribute";
import { Horizon } from "@stellar/stellar-sdk";
import { Env } from "./env";

vi.mock("./distribute", () => ({
  buildDistributeTx: vi.fn(),
  amountToStroops: vi.fn((amt) => BigInt(Math.floor(Number(amt) * 1e7))),
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...actual,
    Horizon: {
      Server: vi.fn(),
    },
  };
});

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

  async list({ prefix, cursor }: { prefix?: string; cursor?: string }) {
    const keys = Array.from(this.store.keys())
      .filter((k) => !prefix || k.startsWith(prefix))
      .map((k) => ({ name: k }));
    return { keys, list_complete: true };
  }
}

describe("keeper lifecycle", () => {
  let env: Env;
  let mockHorizonTransaction: any;

  beforeEach(() => {
    vi.clearAllMocks();
    env = {
      KEEPER_KV: new MockKV() as unknown as KVNamespace,
      STELLAR_NETWORK: "TESTNET",
      HORIZON_URL: "https://horizon-testnet.stellar.org",
      SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org",
      NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
      USDC_CODE: "USDC",
      USDC_ISSUER: "GBBD47IF6LWK7P7MDEVSCWTTCJM4RTQR6EPCEGYMPEBA6LPM5M3K6UZA",
      VAULT_CONTRACT_ID: "C...",
      WATCH_ACCOUNTS: "",
    };

    mockHorizonTransaction = vi.fn();
    vi.mocked(Horizon.Server).mockImplementation(() => ({
      transactions: () => ({
        transaction: (hash: string) => ({
          call: () => mockHorizonTransaction(hash),
        }),
      }),
    }) as any);
  });

  it("preparing an XDR does not create a processed marker", async () => {
    vi.mocked(distribute.buildDistributeTx).mockResolvedValue("prepared-xdr");

    const job = await handleInflow(env, "GABC", "10.0", "hash1");

    expect(job.status).toBe("prepared");
    expect(await env.KEEPER_KV.get("processed:hash1")).toBeNull();
    const pending = await env.KEEPER_KV.get("pending:hash1", "json") as any;
    expect(pending).not.toBeNull();
    expect(pending.status).toBe("prepared");
  });

  it("a failed preparation remains retryable", async () => {
    vi.mocked(distribute.buildDistributeTx).mockRejectedValueOnce(new Error("fail"));
    
    const job1 = await handleInflow(env, "GABC", "10.0", "hash2");
    expect(job1.status).toBe("failed");
    expect(await env.KEEPER_KV.get("processed:hash2")).toBeNull();

    vi.mocked(distribute.buildDistributeTx).mockResolvedValueOnce("prepared-xdr");
    const job2 = await handleInflow(env, "GABC", "10.0", "hash2");
    expect(job2.status).toBe("prepared");
    expect(await env.KEEPER_KV.get("processed:hash2")).toBeNull();
  });

  it("an XDR-less prepared job is rebuilt", async () => {
    await env.KEEPER_KV.put("pending:hash3", JSON.stringify({
      account: "GABC",
      amount: "10.0",
      txHash: "hash3",
      status: "prepared",
      xdr: null,
      detectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    vi.mocked(distribute.buildDistributeTx).mockResolvedValue("prepared-xdr");
    const job = await handleInflow(env, "GABC", "10.0", "hash3");

    expect(distribute.buildDistributeTx).toHaveBeenCalled();
    expect(job.xdr).toBe("prepared-xdr");
  });

  it("confirmation rejects an unknown keeper job", async () => {
    await expect(confirmJob(env, "hash-unknown", "sub-hash")).rejects.toThrow("keeper job not found");
  });

  it("confirmation rejects a missing Horizon transaction", async () => {
    await env.KEEPER_KV.put("pending:hash4", JSON.stringify({
      account: "GABC",
      amount: "10.0",
      txHash: "hash4",
      status: "prepared",
      xdr: "xdr",
      detectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    mockHorizonTransaction.mockRejectedValue(new Error("not found"));

    await expect(confirmJob(env, "hash4", "sub-hash")).rejects.toThrow("not found on Horizon");
    expect(await env.KEEPER_KV.get("processed:hash4")).toBeNull();
  });

  it("confirmation rejects an unsuccessful transaction", async () => {
    await env.KEEPER_KV.put("pending:hash5", JSON.stringify({
      account: "GABC",
      amount: "10.0",
      txHash: "hash5",
      status: "prepared",
      xdr: "xdr",
      detectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    mockHorizonTransaction.mockResolvedValue({ successful: false });

    await expect(confirmJob(env, "hash5", "sub-hash")).rejects.toThrow("submitted transaction is not successful");
    expect(await env.KEEPER_KV.get("processed:hash5")).toBeNull();
  });

  it("confirmation rejects a different source account", async () => {
    await env.KEEPER_KV.put("pending:hash6", JSON.stringify({
      account: "GABC",
      amount: "10.0",
      txHash: "hash6",
      status: "prepared",
      xdr: "xdr",
      detectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    mockHorizonTransaction.mockResolvedValue({ successful: true, source_account: "GDEF" });

    await expect(confirmJob(env, "hash6", "sub-hash")).rejects.toThrow("source does not match");
    expect(await env.KEEPER_KV.get("processed:hash6")).toBeNull();
  });

  it("successful chain verification confirms the job", async () => {
    const job = {
      account: "GABC",
      amount: "10.0",
      txHash: "hash7",
      status: "prepared",
      xdr: "xdr",
      detectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await env.KEEPER_KV.put("pending:hash7", JSON.stringify(job));

    mockHorizonTransaction.mockResolvedValue({
      successful: true,
      source_account: job.account,
    });

    const confirmed = await confirmJob(env, "hash7", "sub-hash");
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.xdr).toBeNull();
    expect(confirmed.submissionTxHash).toBe("sub-hash");
    expect(await env.KEEPER_KV.get("processed:hash7")).toBe("sub-hash");
  });

  it("confirmation is idempotent for the same submission hash", async () => {
    const job = {
      account: "GABC",
      amount: "10.0",
      txHash: "hash8",
      status: "prepared",
      xdr: "xdr",
      detectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await env.KEEPER_KV.put("pending:hash8", JSON.stringify(job));

    mockHorizonTransaction.mockResolvedValue({
      successful: true,
      source_account: job.account,
    });

    await confirmJob(env, "hash8", "sub-hash");
    await expect(confirmJob(env, "hash8", "sub-hash")).resolves.not.toThrow();
  });

  it("confirmation rejects a second different submission hash", async () => {
    const job = {
      account: "GABC",
      amount: "10.0",
      txHash: "hash9",
      status: "prepared",
      xdr: "xdr",
      detectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await env.KEEPER_KV.put("pending:hash9", JSON.stringify(job));

    mockHorizonTransaction.mockResolvedValue({
      successful: true,
      source_account: job.account,
    });

    await confirmJob(env, "hash9", "sub-hash1");
    await expect(confirmJob(env, "hash9", "sub-hash2")).rejects.toThrow("different transaction");
  });
});

describe("ramp session endpoints", () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    env = {
      KEEPER_KV: new MockKV() as unknown as KVNamespace,
      STELLAR_NETWORK: "TESTNET",
      HORIZON_URL: "https://horizon-testnet.stellar.org",
      SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org",
      NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
      USDC_CODE: "USDC",
      USDC_ISSUER: "GBBD47IF6LWK7P7MDEVSCWTTCJM4RTQR6EPCEGYMPEBA6LPM5M3K6UZA",
      VAULT_CONTRACT_ID: "C...",
      WATCH_ACCOUNTS: "",
      MOONPAY_API_KEY: "moonpay-api-key-for-tests",
      MOONPAY_SECRET_KEY: "moonpay-secret-for-tests",
      TRANSAK_API_KEY: "transak-key",
      TRANSAK_API_SECRET: "transak-secret",
    };
  });

  it("MoonPay rejects non-Stellar wallet addresses before signing a URL", async () => {
    const response = await worker.fetch(
      new Request("https://keeper.test/moonpay-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress: "not-a-stellar-address" }),
      }),
      env,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "valid Stellar walletAddress required",
    });
  });

  it("Transak rejects non-Stellar wallet addresses before requesting a token", async () => {
    const response = await worker.fetch(
      new Request("https://keeper.test/transak-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress: "not-a-stellar-address" }),
      }),
      env,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "valid Stellar walletAddress required",
    });
  });

  it("Transak returns the provider quote reason without exposing credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      error: { message: "Provider route is not enabled for this partner key." },
    }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      new Request("https://keeper.test/transak-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          walletAddress: "GACIPGS6ZFHSK5B2UAI7KHO7QONSDVC2USAP7T4KSMWI5LBFV3WN6RYW",
        }),
      }),
      env,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Transak route unavailable for USD to Stellar XLM in the current staging environment.",
      providerStatus: 400,
      providerMessage: "Provider route is not enabled for this partner key.",
    });
  });

  it("Transak explains when the provider rejects a Stellar wallet for this route", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        response: {
          quoteId: "quote-for-tests",
          fiatCurrency: "USD",
          cryptoCurrency: "XLM",
          network: "mainnet",
          paymentMethod: "credit_debit_card",
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { message: "Invalid wallet address. Please provide a valid wallet address to proceed." },
      }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      new Request("https://keeper.test/transak-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          walletAddress: "GC4IUJPBQZKXYONI6UABEXE7EA6QXT4OYV2JYJA5GTPMXSMEKDL6AGDZ",
        }),
      }),
      env,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Transak staging does not accept this wallet for USD to Stellar XLM.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("Transak never bypasses staging wallet rejection with production verification", async () => {
    const walletAddress = "GACIPGS6ZFHSK5B2UAI7KHO7QONSDVC2USAP7T4KSMWI5LBFV3WN6RYW";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        response: {
          quoteId: "quote-for-tests",
          fiatCurrency: "USD",
          cryptoCurrency: "XLM",
          network: "mainnet",
          paymentMethod: "credit_debit_card",
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { message: "Invalid wallet address. Please provide a valid wallet address to proceed." },
      }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        response: true,
        success: true,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { accessToken: "access-token-for-tests" },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { widgetUrl: "https://global-stg.transak.com?sessionId=session-for-tests" },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      new Request("https://keeper.test/transak-url", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.10",
        },
        body: JSON.stringify({ mode: "locked", walletAddress }),
      }),
      env,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Transak staging does not accept this wallet for USD to Stellar XLM.",
    });
    expect(fetchMock.mock.calls[1][0].toString()).toContain("api-stg.transak.com/cryptocoverage");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("Transak refuses hosted mode so clients cannot fall back to a manual wallet form", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      new Request("https://keeper.test/transak-url", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.10",
        },
        body: JSON.stringify({ mode: "hosted" }),
      }),
      env,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Transak auto-fill needs a funded Stellar mainnet recipient configured in Shunt.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Transak creates a locked Stellar recipient widget with memo support", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        response: {
          quoteId: "quote-for-tests",
          fiatCurrency: "USD",
          cryptoCurrency: "XLM",
          network: "mainnet",
          paymentMethod: "credit_debit_card",
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        response: true,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { accessToken: "access-token-for-tests" },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { widgetUrl: "https://global-stg.transak.com?sessionId=session-for-tests" },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const walletAddress = "GC4IUJPBQZKXYONI6UABEXE7EA6QXT4OYV2JYJA5GTPMXSMEKDL6AGDZ";
    const response = await worker.fetch(
      new Request("https://keeper.test/transak-url", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.10",
        },
        body: JSON.stringify({ mode: "locked", walletAddress, walletMemo: "12345" }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      widgetUrl: "https://global-stg.transak.com?sessionId=session-for-tests",
    });

    expect(fetchMock.mock.calls[0][0].toString()).toContain("pricing/public/quotes");
    expect(fetchMock.mock.calls[0][0].toString()).toContain("network=mainnet");
    expect(fetchMock.mock.calls[1][0].toString()).toContain("verify-wallet-address");
    expect(fetchMock.mock.calls[1][0].toString()).toContain("cryptoCurrency=XLM");
    expect(fetchMock.mock.calls[1][0].toString()).toContain("network=mainnet");
    const sessionRequest = JSON.parse(fetchMock.mock.calls[3][1].body);
    expect(sessionRequest.widgetParams).toMatchObject({
      apiKey: "transak-key",
      walletAddress,
      fiatCurrency: "USD",
      fiatAmount: "100",
      cryptoCurrencyCode: "XLM",
      network: "mainnet",
      isBuyOrSell: "BUY",
      paymentMethod: "credit_debit_card",
      quoteCountryCode: "ID",
      hideExchangeScreen: true,
      disableWalletAddressForm: true,
    });
    expect(sessionRequest.widgetParams.walletAddressesData).toBeUndefined();
    expect(sessionRequest.widgetParams.walletType).toBeUndefined();
  });

  it("Transak can auto-fill a configured Stellar recipient without client wallet input", async () => {
    const configuredWallet = "GC4IUJPBQZKXYONI6UABEXE7EA6QXT4OYV2JYJA5GTPMXSMEKDL6AGDZ";
    env.TRANSAK_STELLAR_RECIPIENT_ADDRESS = configuredWallet;
    env.TRANSAK_STELLAR_RECIPIENT_MEMO = "demo-memo";

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        response: {
          quoteId: "quote-for-tests",
          fiatCurrency: "USD",
          cryptoCurrency: "XLM",
          network: "mainnet",
          paymentMethod: "credit_debit_card",
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        response: true,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { accessToken: "access-token-for-tests" },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { widgetUrl: "https://global-stg.transak.com?sessionId=session-for-tests" },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      new Request("https://keeper.test/transak-url", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.10",
        },
        body: JSON.stringify({ mode: "locked" }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    const verifyUrl = fetchMock.mock.calls[1][0].toString();
    expect(verifyUrl).toContain(`walletAddress=${configuredWallet}`);
    expect(verifyUrl).toContain("cryptoCurrency=XLM");
    expect(verifyUrl).toContain("network=mainnet");

    const sessionRequest = JSON.parse(fetchMock.mock.calls[3][1].body);
    expect(sessionRequest.widgetParams.walletAddress).toBe(configuredWallet);
    expect(sessionRequest.widgetParams.walletAddressesData).toBeUndefined();
    expect(sessionRequest.widgetParams.hideExchangeScreen).toBe(true);
    expect(sessionRequest.widgetParams.disableWalletAddressForm).toBe(true);
    expect(sessionRequest.widgetParams.walletType).toBeUndefined();
  });
});
