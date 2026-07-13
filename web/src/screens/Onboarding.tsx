import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { DonutChart } from "../components/DonutChart";
import { AllocationBar } from "../components/AllocationBar";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { DEFAULT_BUCKETS } from "../store";
import { AnimatedBackground } from "../components/AnimatedBackground";

/** Fade-up-on-scroll used throughout the landing sections below the fold. */
const EASE_STANDARD = [0.22, 1, 0.36, 1] as const;
const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.6, ease: EASE_STANDARD, delay },
});

/** Problem → outcome, paired — one compact scan, real product language. */
const PROBLEM_OUTCOME = [
  { problem: "One balance, all of it feels spendable", outcome: "Split into lanes the moment it lands" },
  { problem: "IDR loses value, year after year", outcome: "Savings held in USDC" },
  { problem: "No payroll, no automatic saving", outcome: "One tap, every payday" },
  { problem: "A lock you could just switch off", outcome: "Held by a Soroban timelock, not a label" },
];

const LANES = [
  { ...DEFAULT_BUCKETS[0], desc: "In your wallet. Spend or cash out to IDR anytime." },
  { ...DEFAULT_BUCKETS[1], desc: "In the vault contract, timelocked by code." },
  { ...DEFAULT_BUCKETS[2], desc: "Instant-access emergency fund, no penalty." },
  { ...DEFAULT_BUCKETS[3], desc: "Spot-DCA'd into XLM via a Stellar path payment." },
];

const STEPS = [
  { title: "Connect", body: "Freighter, Albedo, or xBull. No sign-up, no custody." },
  { title: "Set rules", body: "Needs / Savings / Buffer / Invest, saved on-chain." },
  { title: "Income lands", body: "Payment link, Top Up, or transfer — detected in seconds." },
  { title: "One tap", body: "Review the breakdown, sign. Nothing moves without you." },
  { title: "Auto-split", body: "One atomic transaction. Sub-cent fees." },
];

// Figures verified against docs/unit-economics.md and the contract test suite.
const STATS = [
  { value: 0.29, decimals: 2, suffix: "%", label: "Blended take-rate" },
  { value: 15, decimals: 0, suffix: "–20×", label: "Cheaper than remittance" },
  { value: 19, decimals: 0, suffix: "", label: "Contract unit tests" },
  { value: 10, decimals: 0, suffix: "%", label: "Early-exit penalty → Buffer" },
];

const FEES = [
  { label: "Cash-out → IDR", rate: "0.40%" },
  { label: "Top Up → USDC", rate: "0.35%" },
  { label: "Invest / Convert", rate: "0.40%" },
  { label: "Savings, in and out", rate: "Free" },
];

function Logo({ size = 30 }: { size?: number }) {
  const pad = Math.round(size * 0.2);
  return (
    <span className="lp-brand-mark" style={{ width: size, height: size, padding: pad }}>
      <img src="/logomark.svg" width={size - pad * 2} height={size - pad * 2} alt="" />
    </span>
  );
}

function StatCard({ stat, inView }: { stat: (typeof STATS)[number]; inView: boolean }) {
  return (
    <div className="lp-stat">
      <div className="lp-stat-value">
        <AnimatedNumber value={inView ? stat.value : 0} decimals={stat.decimals} suffix={stat.suffix} />
      </div>
      <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        {stat.label}
      </div>
    </div>
  );
}

/** Cursor-following spotlight (reactbits SpotlightCard pattern). */
function spotlight(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
}

export function Onboarding() {
  const nav = useNavigate();
  const statsRef = useRef(null);
  const statsInView = useInView(statsRef, { once: true, amount: 0.3 });
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatedBackground aurora>
      {/* Full-bleed sticky nav */}
      <nav className={`lp-nav${scrolled ? " scrolled" : ""}`}>
        <div className="lp-nav-inner">
          <div className="lp-brand" style={{ fontSize: 20 }}>
            <Logo />
            Shunt
          </div>
          <div className="lp-nav-links">
            <a href="#why">Why</a>
            <a href="#loop">The loop</a>
            <a href="#how">How it works</a>
            <a href="#proof">Proof</a>
            <button
              className="btn-primary lp-btn-primary-glow"
              style={{ width: "auto", padding: "9px 20px", fontSize: 14, minHeight: 0 }}
              onClick={() => nav("/connect")}
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </nav>

      {/* 1. Hero */}
      <section
        className="lp-section"
        style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 22, padding: "72px 24px 40px" }}
      >
        <motion.span
          {...reveal()}
          className="chip lp-chip-live"
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <span className="lp-live-dot" /> Live on Stellar testnet
        </motion.span>
        <motion.h1
          {...reveal(0.05)}
          style={{ fontSize: "var(--text-display)", margin: 0, lineHeight: 1.05, maxWidth: 780, letterSpacing: "-0.02em" }}
        >
          Income lands.
          <br />
          <span className="lp-gradient-text">Instantly split.</span>
        </motion.h1>
        <motion.p {...reveal(0.12)} className="muted" style={{ fontSize: "var(--text-body-lg)", maxWidth: 560, margin: 0 }}>
          One tap splits every USDC payday into Needs, Savings, Buffer, and Invest — non-custodial, on-chain.
        </motion.p>
        <motion.div {...reveal(0.18)} style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            className="btn-primary lp-btn-primary-glow"
            style={{ width: "auto", fontSize: 16, padding: "14px 28px", height: "auto", borderRadius: 30, display: "inline-flex", alignItems: "center", gap: 8 }}
            onClick={() => nav("/connect")}
          >
            Get Started <i className="ph ph-arrow-right" />
          </button>
          <button
            className="btn-secondary"
            style={{ width: "auto", fontSize: 16, padding: "14px 28px", height: "auto", borderRadius: 30, display: "inline-flex", alignItems: "center", gap: 8 }}
            onClick={() => window.open("https://github.com/irham3/shunt", "_blank")}
          >
            <i className="ph ph-github-logo" /> View source
          </button>
        </motion.div>
        <motion.div {...reveal(0.24)} style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 2 }}>
          {["Stellar", "USDC", "Non-custodial"].map((t) => (
            <span key={t} className="chip" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span className="lp-dot" /> {t}
            </span>
          ))}
        </motion.div>

        <motion.div {...reveal(0.3)} className="lp-float" style={{ marginTop: 40, width: "100%", maxWidth: 600 }}>
          <div className="card" style={{ padding: 26 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center", justifyContent: "center" }}>
              <DonutChart buckets={DEFAULT_BUCKETS} size={168} strokeWidth={22} />
              <div style={{ flex: 1, minWidth: 200, textAlign: "left" }}>
                <div className="muted" style={{ fontSize: 13 }}>Default split rules</div>
                <div style={{ marginTop: 10 }}>
                  <AllocationBar buckets={DEFAULT_BUCKETS} />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Trust marquee */}
      <div style={{ overflow: "hidden", padding: "18px 0", borderTop: "1px solid var(--color-border-subtle)", borderBottom: "1px solid var(--color-border-subtle)" }}>
        <div className="lp-marquee-track">
          {[...Array(2)].flatMap((_, dup) =>
            ["Stellar Testnet", "Soroban · Rust", "React + TypeScript", "PWA — Mobile First", "19 Contract Tests Passing", "SEP-1 · SEP-7 · SEP-10 · SEP-24"].map((t, i) => (
              <span key={`${dup}-${i}`} className="muted" style={{ fontSize: 13, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 5, height: 5, borderRadius: 3, background: "var(--color-accent-primary)", display: "inline-block" }} />
                {t}
              </span>
            )),
          )}
        </div>
      </div>

      {/* 2. Problem → outcome */}
      <section id="why" className="lp-section" style={{ padding: "72px 24px", display: "flex", flexDirection: "column", gap: 28 }}>
        <motion.h2 {...reveal()} style={{ fontSize: "var(--text-h1)", margin: 0, textAlign: "center" }}>Why people use it</motion.h2>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {PROBLEM_OUTCOME.map((row, i) => (
            <motion.div
              key={row.problem}
              {...reveal(i * 0.06)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "18px 22px",
                borderBottom: i < PROBLEM_OUTCOME.length - 1 ? "1px solid var(--color-border-subtle)" : "none",
                flexWrap: "wrap",
              }}
            >
              <span className="muted" style={{ fontSize: 14, flex: "1 1 220px" }}>{row.problem}</span>
              <i className="ph ph-arrow-right" style={{ color: "var(--color-accent-primary)", flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 600, flex: "1 1 220px" }}>{row.outcome}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 3. The loop: four lanes — de-templated, no icon-in-a-box */}
      <section id="loop" className="lp-section" style={{ padding: "72px 24px", display: "flex", flexDirection: "column", gap: 28 }}>
        <motion.div {...reveal()} style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "var(--text-h1)", margin: 0 }}>One app, the whole loop</h2>
          <p className="muted" style={{ fontSize: 16, marginTop: 8 }}>Money in, structured on-chain, out to your bank.</p>
        </motion.div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {LANES.map((l, i) => (
            <motion.div key={l.id} {...reveal(i * 0.08)} className="lp-lane-card" onMouseMove={spotlight}>
              <div className="lp-lane-glow" style={{ background: `radial-gradient(120px 80px at 30% 0%, ${l.color}33, transparent)` }} />
              <div className="lp-lane-rule" style={{ background: l.color }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h3 style={{ margin: 0, fontSize: 17 }}>{l.name}</h3>
                <span className="numeric" style={{ fontWeight: 700, fontSize: 22, color: l.color }}>{l.pct}%</span>
              </div>
              <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>{l.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 4. How it works: 5-step timeline */}
      <section id="how" className="lp-section" style={{ padding: "72px 24px", display: "flex", flexDirection: "column", gap: 36 }}>
        <motion.h2 {...reveal()} style={{ fontSize: "var(--text-h1)", margin: 0, textAlign: "center" }}>How it works</motion.h2>
        <div style={{ maxWidth: 600, margin: "0 auto", width: "100%" }}>
          {STEPS.map((s, i) => (
            <motion.div key={s.title} {...reveal(i * 0.05)} className="lp-step">
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <motion.div
                  className="lp-step-dot"
                  initial={{ background: "#141a21", color: "#f5f7fa", borderColor: "#2a3340" }}
                  whileInView={{ background: "#bef264", color: "#0b0f14", borderColor: "#bef264" }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.3 }}
                >
                  {i + 1}
                </motion.div>
                {i < STEPS.length - 1 && <div className="lp-step-line" />}
              </div>
              <div style={{ paddingBottom: 28 }}>
                <h3 style={{ margin: "6px 0 4px", fontSize: 17 }}>{s.title}</h3>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>{s.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 5. Proof / stats strip */}
      <section id="proof" ref={statsRef} className="lp-section" style={{ padding: "48px 24px" }}>
        <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 20, padding: 32 }}>
          {STATS.map((s) => (
            <StatCard key={s.label} stat={s} inView={statsInView} />
          ))}
        </div>
      </section>

      {/* 6. Fees — service fees, never interest */}
      <section className="lp-section" style={{ padding: "24px 24px 64px" }}>
        <motion.div {...reveal()} className="card" style={{ padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, alignItems: "baseline" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18 }}>Fees, never interest</h3>
              <p className="muted" style={{ margin: "6px 0 0", fontSize: 13, maxWidth: 360 }}>
                No lending, no yield products, no cut of your savings.
              </p>
            </div>
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
              {FEES.map((f) => (
                <div key={f.label} style={{ minWidth: 120 }}>
                  <div className="numeric" style={{ fontWeight: 700, fontSize: 19, color: "var(--color-accent-primary)" }}>{f.rate}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{f.label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* 7. Bottom CTA */}
      <section className="lp-section" style={{ textAlign: "center", padding: "48px 24px 96px", display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <motion.h2 {...reveal()} style={{ fontSize: "var(--text-h1)", margin: 0 }}>Put your income on autopilot.</motion.h2>
        <motion.div {...reveal(0.1)}>
          <button
            className="btn-primary lp-btn-primary-glow"
            style={{ width: "auto", fontSize: 16, padding: "14px 28px", height: "auto", borderRadius: 30, display: "inline-flex", alignItems: "center", gap: 8 }}
            onClick={() => nav("/connect")}
          >
            Launch App <i className="ph ph-arrow-right" />
          </button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="lp-section" style={{ padding: "28px 24px 44px", borderTop: "1px solid var(--color-border-subtle)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        <div className="lp-brand muted" style={{ fontSize: 13, fontWeight: 500 }}>
          <Logo size={22} />
          Shunt · income in, structured by code, income out
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <a href="https://github.com/irham3/shunt" target="_blank" rel="noreferrer" className="muted" style={{ fontSize: 13 }}>
            GitHub
          </a>
          <a
            href="https://stellar.expert/explorer/testnet/contract/CB27KRLQAJCQRW2GTH4ETXDSS2STMUU4K4QABIY5QEWGAGQQRJBKPW7K"
            target="_blank"
            rel="noreferrer"
            className="muted"
            style={{ fontSize: 13 }}
          >
            Vault contract
          </a>
        </div>
      </footer>
    </AnimatedBackground>
  );
}
