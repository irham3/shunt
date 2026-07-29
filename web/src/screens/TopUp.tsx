import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { authenticate, startDeposit, ANCHOR_HOME_DOMAIN, getAnchorInfo, AnchorAssetInfo } from "../lib/anchor";
import { fmtUsdc, useShunt } from "../store";
import { formatError } from "../lib/stellar";

type RequestKey = "sdf" | "moonpay" | "transak";
type ProviderRequestState = Record<RequestKey, { status: "idle" | "loading" | "error"; message?: string }>;

const idleRequests: ProviderRequestState = {
  sdf: { status: "idle" },
  moonpay: { status: "idle" },
  transak: { status: "idle" },
};

function popupFeatures(width = 500, height = 700): string {
  const left = window.innerWidth / 2 - width / 2;
  const top = window.innerHeight / 2 - height / 2;
  return `width=${width},height=${height},top=${top},left=${left}`;
}

export function TopUp() {
  const { address, showToast } = useShunt();
  const [amount, setAmount] = useState("");
  const [submitted, setSubmitted] = useState<"sdf" | null>(null);
  const [anchorUrl, setAnchorUrl] = useState<string | null>(null);
  const [requests, setRequests] = useState<ProviderRequestState>(idleRequests);
  const [err, setErr] = useState<string | null>(null);
  const [limits, setLimits] = useState<AnchorAssetInfo | null>(null);

  useEffect(() => {
    getAnchorInfo("USDC").then(setLimits).catch((e) => setErr(formatError(e)));
  }, []);

  const usdc = Number(amount) || 0;
  const sdfBusy = requests.sdf.status === "loading";
  const moonpayBusy = requests.moonpay.status === "loading";
  const transakBusy = requests.transak.status === "loading";

  function setRequest(key: RequestKey, state: ProviderRequestState[RequestKey]) {
    setRequests((current) => ({ ...current, [key]: state }));
  }

  async function onStartSdfFlow() {
    if (usdc <= 0) {
      setErr("Enter a valid test amount.");
      return;
    }
    if (limits && (usdc < limits.minAmount || usdc > limits.maxAmount)) {
      setErr(`The SDF test anchor accepts ${limits.minAmount}-${limits.maxAmount} USDC per transaction.`);
      return;
    }
    if (!address) {
      setErr("Connect a wallet first.");
      return;
    }

    setErr(null);
    setRequest("sdf", { status: "loading" });
    const popup = window.open("about:blank", "sdf_test_anchor_popup", popupFeatures());

    try {
      const jwt = await authenticate(address);
      const session = await startDeposit(address, jwt, "USDC", String(usdc));
      setAnchorUrl(session.url);

      if (popup) popup.location.href = session.url;

      const expectedOrigin = new URL(session.url).origin;
      const onMessage = (e: MessageEvent) => {
        if (e.origin !== expectedOrigin) return;
        if (e.data?.type === "close" || e.data?.type === "success") {
          window.removeEventListener("message", onMessage);
          popup?.close();
        }
      };
      window.addEventListener("message", onMessage);

      setSubmitted("sdf");
      showToast("Stellar test deposit session created");
      setRequest("sdf", { status: "idle" });
    } catch (e) {
      popup?.close();
      const formatted = formatError(e);
      setErr(formatted ? `Test-anchor session failed: ${formatted}` : "Test-anchor session failed.");
      setRequest("sdf", { status: "error", message: formatted || "Session failed" });
    }
  }

  async function onStartMoonPaySandbox() {
    if (!address) {
      setErr("Connect a wallet first.");
      return;
    }

    setErr(null);
    setRequest("moonpay", { status: "loading" });
    const popup = window.open("about:blank", "moonpay_sandbox_popup", popupFeatures());

    try {
      const res = await fetch(`${import.meta.env.VITE_KEEPER_URL}/moonpay-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      const data = await res.json();
      if (!res.ok || typeof data.widgetUrl !== "string") {
        throw new Error(data.error || "Failed to generate MoonPay sandbox URL");
      }

      if (popup) popup.location.href = data.widgetUrl;
      else setAnchorUrl(data.widgetUrl);

      showToast("MoonPay sandbox opened");
      setRequest("moonpay", { status: "idle" });
    } catch (e) {
      popup?.close();
      const message = e instanceof Error ? e.message : String(e);
      setErr(message);
      setRequest("moonpay", { status: "error", message });
    }
  }

  async function onStartTransakStaging() {
    setErr(null);
    setRequest("transak", { status: "loading" });
    const popup = window.open("about:blank", "transak_staging_popup", popupFeatures());

    try {
      const res = await fetch(`${import.meta.env.VITE_KEEPER_URL}/transak-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "locked", fiatAmount: 100 }),
      });
      const data = await res.json();
      if (!res.ok || typeof data.widgetUrl !== "string") {
        throw new Error(data.error || "Failed to generate Transak staging URL");
      }

      if (popup) popup.location.href = data.widgetUrl;
      else setAnchorUrl(data.widgetUrl);

      showToast("Transak staging opened");
      setRequest("transak", { status: "idle" });
    } catch (e) {
      popup?.close();
      const message = e instanceof Error ? e.message : String(e);
      setErr(message);
      setRequest("transak", { status: "error", message });
    }
  }

  if (submitted) {
    return (
      <div className="screen" style={{ justifyContent: "center", textAlign: "center" }}>
        <div className="status-mark" aria-hidden>SEP</div>
        <h2>Test deposit session created</h2>
        <p className="muted">
          The SDF test anchor opened a SEP-24 deposit session for {fmtUsdc(usdc)} test USDC.
          No rupiah moves here. Complete the hosted test flow, then Shunt can detect the
          incoming test USDC like any other wallet inflow.
        </p>
        {anchorUrl && (
          <a href={anchorUrl} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent-secondary)" }}>
            Reopen the SDF test flow
          </a>
        )}
        <button className="btn-primary" onClick={() => { setSubmitted(null); setAnchorUrl(null); }}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <h2 style={{ margin: 0 }}>Add money</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
        Live fiat routes appear only after a provider confirms the exact country, fiat,
        asset, network, and direction for Shunt.
      </p>

      <section className="ramp-section" aria-labelledby="available-methods">
        <h3 id="available-methods" className="section-title">Indonesia corridor candidates</h3>
        <div className="provider-status-list">
          <div className="provider-status-row">
            <div>
              <strong>Alchemy Pay</strong>
              <p className="muted">Exact-route check needed: IDR to USDC on Stellar.</p>
            </div>
            <span className="env-badge env-badge-sandbox">Pending capability</span>
          </div>
          <div className="provider-status-row">
            <div>
              <strong>Banxa</strong>
              <p className="muted">Fallback on-ramp candidate after partner route lookup.</p>
            </div>
            <span className="env-badge env-badge-sandbox">Pending capability</span>
          </div>
        </div>
      </section>

      <section className="ramp-section" aria-labelledby="sandbox-methods">
        <h3 id="sandbox-methods" className="section-title">Provider staging</h3>
        <div className="provider-card">
          <div>
            <strong>MoonPay sandbox</strong>
            <p className="muted">
              Opens a signed sandbox widget. Shunt does not present it as live while the Indonesia
              Stellar USDC route is blocked.
            </p>
          </div>
          <button className="btn-secondary" disabled={!address || moonpayBusy} onClick={onStartMoonPaySandbox}>
            {moonpayBusy ? "Opening sandbox..." : "Try sandbox"}
          </button>
        </div>
        <div className="provider-card">
          <div>
            <strong>Transak staging</strong>
            <p className="muted">
              Disabled for the judge demo because Transak's Stellar staging flow still labels the
              destination network as Mainnet.
            </p>
            <p className="muted" style={{ fontSize: 13, margin: "8px 0 0" }}>
              Keep this as a backend-only provider test, not a public testnet proof.
            </p>
          </div>
          <button className="btn-secondary" disabled title="Transak staging is mainnet-labeled, so it is hidden from the testnet demo.">
            {transakBusy ? "Opening Transak..." : "Disabled for testnet demo"}
          </button>
        </div>
      </section>

      <section className="ramp-section" aria-labelledby="developer-demo">
        <h3 id="developer-demo" className="section-title">Developer demo</h3>
        <motion.div
          className="card"
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          data-testid="ramp-method-sdf-test-anchor"
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div>
              <strong>Try the Stellar test flow</strong>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
                SEP-24 via the SDF test anchor at {ANCHOR_HOME_DOMAIN}.
              </p>
            </div>
            <span className="env-badge env-badge-simulation">Stellar testnet proof</span>
          </div>
          <label className="muted" style={{ fontSize: 13 }}>
            Test USDC amount
            <input
              type="number"
              placeholder="0"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ marginTop: 6 }}
            />
          </label>
          <span className="muted" style={{ fontSize: 12 }}>
            {limits ? `SDF test anchor accepts ${limits.minAmount}-${limits.maxAmount} USDC per transaction.` : "Fetching test limits..."}
          </span>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            No bank account is charged. No provider fee is quoted. Use this lane to show SEP-1,
            SEP-10, and SEP-24 behavior.
          </p>
          <button className="btn-primary" disabled={usdc <= 0 || sdfBusy} onClick={onStartSdfFlow}>
            {sdfBusy ? "Creating test session..." : "Start Stellar test flow"}
          </button>
        </motion.div>
      </section>

      <section className="ramp-section" aria-labelledby="moneygram-status">
        <h3 id="moneygram-status" className="section-title">Cash access</h3>
        <div className="provider-status-row">
          <div>
            <strong>MoneyGram Ramps</strong>
            <p className="muted">
              Application submitted. Cash-in and cash-out must use a participating MoneyGram Ramps location returned by the provider.
            </p>
          </div>
          <span className="env-badge env-badge-preview">Awaiting approval</span>
        </div>
      </section>

      {anchorUrl && (
        <a href={anchorUrl} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent-secondary)", fontSize: 13 }}>
          Open fallback link
        </a>
      )}

      {err && (
        <p role="alert" style={{ color: "var(--color-danger)", fontSize: 13, marginTop: 16 }}>
          {err}
        </p>
      )}
    </div>
  );
}
