import { useEffect, useRef, useState } from "react";
import { motion, useInView, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { DonutChart } from "../components/DonutChart";
import { AllocationBar } from "../components/AllocationBar";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { DEFAULT_BUCKETS } from "../store";
import { AnimatedBackground } from "../components/AnimatedBackground";
import { Reveal } from "../components/Reveal";

/** Problem → outcome, paired — one compact scan, real product language. */
const PROBLEM_OUTCOME = [
  { problem: "One balance, all of it feels spendable", outcome: "Split into lanes the moment it lands" },
  { problem: "IDR loses value, year after year", outcome: "Savings held in USDC" },
  { problem: "No payroll, no automatic saving", outcome: "One tap, every payday" },
  { problem: "A lock you could just switch off", outcome: "Held by a Soroban timelock, not a label" },
];

const LANES = [
  { ...DEFAULT_BUCKETS[0], desc: "In your wallet. Spend, or cash out through a supported Stellar anchor." },
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
// Note: the take-rate below is Shunt's OWN service fee, not total end-to-end
// cost — an anchor charges its own fee on top, so we don't claim a multiple
// "cheaper than remittance" here.
const STATS = [
  { value: 0.29, decimals: 2, suffix: "%", label: "Shunt service fee (blended)" },
  { value: 37, decimals: 0, suffix: "", label: "Contract unit tests" },
  { value: 10, decimals: 0, suffix: "%", label: "Early-exit penalty → Buffer" },
];

const FEES = [
  { label: "Cash-out → fiat (anchor)", rate: "0.40%" },
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

function StatCard({ stat }: { stat: (typeof STATS)[number] }) {
  return (
    <div className="lp-stat">
      <div className="lp-stat-value">
        {/* Render the real figure at rest — never count up from 0, so a
            crawler, a no-JS load, or a screenshot taken before scroll never
            shows a misleading "0". */}
        <AnimatedNumber value={stat.value} decimals={stat.decimals} suffix={stat.suffix} />
      </div>
      <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        {stat.label}
      </div>
    </div>
  );
}

/** Timeline dot that fills with the accent as it scrolls into view. Uses the
    useInView hook (the whileInView prop doesn't hold `initial` in this setup). */
function StepDot({ n }: { n: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const off = { background: "#101112", color: "#f4f5f6", borderColor: "#27282b" };
  const on = { background: "#cdf14a", color: "#0a0c07", borderColor: "#cdf14a" };
  return (
    <motion.div ref={ref} className="lp-step-dot" initial={off} animate={inView ? on : off} transition={{ duration: 0.3 }}>
      {n}
    </motion.div>
  );
}

/** Cursor-following spotlight + subtle 3D tilt (reactbits SpotlightCard /
    TiltedCard patterns). Sets --mx/--my for the glow and --rx/--ry for tilt. */
function spotlight(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width - 0.5;
  const py = (e.clientY - r.top) / r.height - 0.5;
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
  el.style.setProperty("--rx", `${px * 9}deg`);
  el.style.setProperty("--ry", `${-py * 9}deg`);
}
function resetTilt(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  el.style.setProperty("--rx", "0deg");
  el.style.setProperty("--ry", "0deg");
}

export function Onboarding() {
  const nav = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const reduceMotion = useReducedMotion();

  // Scroll-driven motion: a thin top progress bar + gentle hero-card parallax.
  const { scrollYProgress } = useScroll();
  const heroCardY = useTransform(scrollYProgress, [0, 0.25], [0, reduceMotion ? 0 : -70]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatedBackground aurora threads>
      {/* Scroll progress bar */}
      <motion.div className="lp-scroll-progress" style={{ scaleX: scrollYProgress }} aria-hidden />

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
        <Reveal variant="up">
          <span className="chip lp-chip-live" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span className="lp-live-dot" /> Live on Stellar testnet
          </span>
        </Reveal>
        <Reveal variant="blur" delay={0.05}>
          <h1 style={{ fontSize: "var(--text-display)", margin: 0, lineHeight: 1.05, maxWidth: 780, letterSpacing: "-0.02em" }}>
            Set your split once.
            <br />
            <span className="lp-gradient-text">Savings locks itself.</span>
          </h1>
        </Reveal>
        <Reveal variant="up" delay={0.12}>
          <p className="muted" style={{ fontSize: "var(--text-body-lg)", maxWidth: 560, margin: 0 }}>
            At payday, confirm once. Your Savings share moves into a Soroban vault, timelocked by code — the rest stays liquid. Non-custodial, on Stellar.
          </p>
        </Reveal>
        <Reveal variant="up" delay={0.18}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
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
          </div>
        </Reveal>
        <Reveal variant="up" delay={0.24}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 2 }}>
            {["Stellar", "USDC", "Non-custodial"].map((t) => (
              <span key={t} className="chip" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <span className="lp-dot" /> {t}
              </span>
            ))}
          </div>
        </Reveal>

        <motion.div style={{ y: heroCardY, marginTop: 40, width: "100%", maxWidth: 600 }}>
          <Reveal variant="scale" delay={0.3}>
            <div className="lp-float">
              <div className="card lp-hero-card" onMouseMove={spotlight} onMouseLeave={resetTilt} style={{ padding: 26 }}>
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
            </div>
          </Reveal>
        </motion.div>
      </section>

      {/* Trust marquee */}
      <div style={{ overflow: "hidden", padding: "18px 0", borderTop: "1px solid var(--color-border-subtle)", borderBottom: "1px solid var(--color-border-subtle)" }}>
        <div className="lp-marquee-track">
          {[...Array(2)].flatMap((_, dup) =>
            ["Stellar Testnet", "Soroban · Rust", "React + TypeScript", "PWA — Mobile First", "37 Contract Tests Passing", "SEP-1 · SEP-7 · SEP-10 · SEP-24"].map((t, i) => (
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
        <Reveal variant="blur">
          <h2 style={{ fontSize: "var(--text-h1)", margin: 0, textAlign: "center" }}>Why people use it</h2>
        </Reveal>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {PROBLEM_OUTCOME.map((row, i) => (
            <Reveal
              key={row.problem}
              variant={i % 2 === 0 ? "left" : "right"}
              delay={i * 0.05}
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
            </Reveal>
          ))}
        </div>
      </section>

      {/* 3. The loop: four lanes — de-templated, no icon-in-a-box */}
      <section id="loop" className="lp-section" style={{ padding: "72px 24px", display: "flex", flexDirection: "column", gap: 28 }}>
        <Reveal variant="up" style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "var(--text-h1)", margin: 0 }}>One app, the whole loop</h2>
          <p className="muted" style={{ fontSize: 16, marginTop: 8 }}>Money in, structured on-chain, out to your bank.</p>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {LANES.map((l, i) => (
            /* Reveal (transform) lives on the wrapper so framer-motion never
               fights the CSS cursor-tilt transform on .lp-lane-card. */
            <Reveal key={l.id} variant="scale" delay={i * 0.1} style={{ display: "flex" }}>
              <div className="lp-lane-card" onMouseMove={spotlight} onMouseLeave={resetTilt} style={{ flex: 1 }}>
                <div className="lp-lane-glow" style={{ background: `radial-gradient(120px 80px at 30% 0%, ${l.color}33, transparent)` }} />
                <div className="lp-lane-rule" style={{ background: l.color }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <h3 style={{ margin: 0, fontSize: 17 }}>{l.name}</h3>
                  <span className="numeric" style={{ fontWeight: 700, fontSize: 22, color: l.color }}>{l.pct}%</span>
                </div>
                <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>{l.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 4. How it works: 5-step timeline */}
      <section id="how" className="lp-section" style={{ padding: "72px 24px", display: "flex", flexDirection: "column", gap: 36 }}>
        <Reveal variant="blur">
          <h2 style={{ fontSize: "var(--text-h1)", margin: 0, textAlign: "center" }}>How it works</h2>
        </Reveal>
        <div style={{ maxWidth: 600, margin: "0 auto", width: "100%" }}>
          {STEPS.map((s, i) => (
            <Reveal key={s.title} variant="left" delay={i * 0.1} className="lp-step">
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <StepDot n={i + 1} />
                {i < STEPS.length - 1 && <div className="lp-step-line" />}
              </div>
              <div style={{ paddingBottom: 28 }}>
                <h3 style={{ margin: "6px 0 4px", fontSize: 17 }}>{s.title}</h3>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 5. Proof / stats strip */}
      <section id="proof" className="lp-section" style={{ padding: "48px 24px" }}>
        <Reveal variant="up" className="card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 20, padding: 32 }}>
          {STATS.map((s, i) => (
            <Reveal key={s.label} variant="scale" delay={i * 0.1}>
              <StatCard stat={s} />
            </Reveal>
          ))}
        </Reveal>
      </section>

      {/* 6. Fees — service fees, never interest */}
      <section className="lp-section" style={{ padding: "24px 24px 64px" }}>
        <Reveal variant="blur" className="card" style={{ padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, alignItems: "baseline" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18 }}>Fees, never interest</h3>
              <p className="muted" style={{ margin: "6px 0 0", fontSize: 13, maxWidth: 360 }}>
                No lending, no yield products, no cut of your savings.
              </p>
            </div>
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
              {FEES.map((f, i) => (
                <Reveal key={f.label} variant="right" delay={0.1 + i * 0.08} style={{ minWidth: 120 }}>
                  <div className="numeric" style={{ fontWeight: 700, fontSize: 19, color: "var(--color-accent-primary)" }}>{f.rate}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{f.label}</div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* 7. Bottom CTA */}
      <section className="lp-section" style={{ textAlign: "center", padding: "48px 24px 96px", display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <Reveal variant="scale">
          <h2 style={{ fontSize: "var(--text-h1)", margin: 0 }}>Set it once. Confirm at payday.</h2>
        </Reveal>
        <Reveal variant="scale" delay={0.12}>
          <button
            className="btn-primary lp-btn-primary-glow"
            style={{ width: "auto", fontSize: 16, padding: "14px 28px", height: "auto", borderRadius: 30, display: "inline-flex", alignItems: "center", gap: 8 }}
            onClick={() => nav("/connect")}
          >
            Launch App <i className="ph ph-arrow-right" />
          </button>
        </Reveal>
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
            href="https://stellar.expert/explorer/testnet/contract/CC7E2HL7SNQ34PFLV74WEQSW2OVBRBG3EUTLKWC3NYKIC4XPPABQWBMW"
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
