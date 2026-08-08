import { useEffect, useState } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { DonutChart } from "../components/DonutChart";
import { AllocationBar } from "../components/AllocationBar";
import { DEFAULT_BUCKETS } from "../store";
import { AnimatedBackground } from "../components/AnimatedBackground";
import { Reveal } from "../components/Reveal";

function Logo({ size = 30 }: { size?: number }) {
  const pad = Math.round(size * 0.2);
  return (
    <span className="lp-brand-mark" style={{ width: size, height: size, padding: pad }}>
      <img src="/logomark.svg" width={size - pad * 2} height={size - pad * 2} alt="" />
    </span>
  );
}

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
  const { scrollYProgress } = useScroll();
  const heroCardY = useTransform(scrollYProgress, [0, 0.25], [0, reduceMotion ? 0 : -50]);

  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatedBackground aurora threads>
      <motion.div className="lp-scroll-progress" style={{ scaleX: scrollYProgress }} aria-hidden />

      <nav className={`lp-nav${scrolled ? " scrolled" : ""}`}>
        <div className="lp-nav-inner">
          <div className="lp-brand" style={{ fontSize: 20 }}>
            <Logo />
            Shunt
          </div>
          <div className="lp-nav-links">
            <a href="#waterfall">Architecture</a>
            <a href="#trust">Trust Model</a>
            <a href="#integrate">Developers</a>
            <button
              className="btn-primary lp-btn-primary-glow"
              style={{ width: "auto", padding: "9px 20px", fontSize: 14, minHeight: 0 }}
              onClick={() => nav("/connect")}
            >
              Launch Dashboard
            </button>
          </div>
        </div>
      </nav>

      {/* 1. Asymmetric Hero */}
      <section className="lp-section" style={{ padding: "96px 24px 64px" }}>
        <div className="split-cols" style={{ alignItems: "center", gap: 64 }}>
          <div className="col-main" style={{ flex: "1 1 400px" }}>
            <Reveal variant="blur">
              <h1 className="hero-title" style={{ textAlign: "left", fontSize: "clamp(40px, 5vw, 64px)", lineHeight: 1.1 }}>
                Programmable<br />Income Routing
              </h1>
            </Reveal>
            <Reveal variant="up" delay={0.1}>
              <p className="muted" style={{ fontSize: 18, marginTop: 24, marginBottom: 32, lineHeight: 1.6, maxWidth: 500 }}>
                A Soroban smart contract that atomically splits incoming payments into emergency reserves, obligations, timelocked goals, and spendable liquidity.
              </p>
            </Reveal>
            <Reveal variant="up" delay={0.2}>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <button
                  className="btn-primary lp-btn-primary-glow"
                  style={{ width: "auto", fontSize: 16, padding: "14px 28px", borderRadius: 30 }}
                  onClick={() => nav("/connect")}
                >
                  Enter App
                </button>
                <button
                  className="btn-secondary"
                  style={{ width: "auto", fontSize: 16, padding: "14px 28px", borderRadius: 30 }}
                  onClick={() => window.open("https://github.com/irham3/shunt", "_blank")}
                >
                  <i className="ph ph-github-logo" /> Read Contract
                </button>
              </div>
            </Reveal>
          </div>
          <div className="col-side" style={{ flex: "1 1 400px" }}>
            <motion.div style={{ y: heroCardY, width: "100%" }}>
              <Reveal variant="scale" delay={0.3}>
                <div className="lp-float">
                  <div className="card lp-hero-card" onMouseMove={spotlight} onMouseLeave={resetTilt} style={{ padding: 32 }}>
                    <h3 style={{ margin: "0 0 24px", fontSize: 16, color: "#f4f5f6" }}>Routing Execution Preview</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 32, alignItems: "center" }}>
                      <DonutChart buckets={DEFAULT_BUCKETS} size={180} strokeWidth={24} />
                      <div style={{ width: "100%" }}>
                        <AllocationBar buckets={DEFAULT_BUCKETS} />
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. Evidence Band */}
      <div style={{ overflow: "hidden", padding: "20px 0", borderTop: "1px solid var(--color-border-subtle)", borderBottom: "1px solid var(--color-border-subtle)", background: "rgba(10, 12, 16, 0.4)" }}>
        <div className="lp-marquee-track">
          {[...Array(2)].flatMap((_, dup) =>
            [
              "Stellar Community Fund Build Award",
              "Live on Soroban Testnet",
              "USDC Native",
              "Open Source Smart Contracts",
              "Self-Custodial Architecture",
              "Atomic Settlement"
            ].map((t, i) => (
              <span key={`${dup}-${i}`} className="muted" style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 10 }}>
                <i className="ph-fill ph-check-circle" style={{ color: "var(--color-accent-primary)" }} />
                {t}
              </span>
            )),
          )}
        </div>
      </div>

      {/* 3. Interactive Waterfall */}
      <section id="waterfall" className="lp-section" style={{ padding: "96px 24px" }}>
        <Reveal variant="up" style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "var(--text-h1)", margin: 0 }}>The Waterfall Model</h2>
          <p className="muted" style={{ fontSize: 16, marginTop: 12, maxWidth: 600, margin: "12px auto 0" }}>
            Gross deposits flow through a deterministic priority sequence.
          </p>
        </Reveal>
        
        <div className="split-cols">
          <div className="col-side" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { title: "1. Emergency Reserve", color: "#cdf14a", desc: "Fills first until a hard USDC target is met." },
              { title: "2. Obligations", color: "#8c9099", desc: "Taxes and recurring fees held in a cold reserve." },
              { title: "3. Savings Goal", color: "#38bdf8", desc: "Locked into a time-based lot for future withdrawal." },
              { title: "4. Spendable", color: "#f4f5f6", desc: "The remainder drops to the everyday wallet." }
            ].map((stage, i) => (
              <div 
                key={i}
                onClick={() => setActiveStage(i)}
                style={{
                  padding: 20,
                  borderRadius: 12,
                  border: activeStage === i ? `1px solid ${stage.color}` : "1px solid #1c1d20",
                  background: activeStage === i ? "rgba(20, 26, 33, 0.8)" : "rgba(10, 12, 16, 0.4)",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                <h3 style={{ margin: "0 0 6px", fontSize: 16, color: activeStage === i ? stage.color : "#f4f5f6" }}>
                  {stage.title}
                </h3>
                <p className="muted" style={{ margin: 0, fontSize: 14 }}>{stage.desc}</p>
              </div>
            ))}
          </div>
          
          <div className="col-main card" style={{ padding: 40, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
            <Reveal variant="scale" key={activeStage}>
              {activeStage === 0 && (
                <div style={{ textAlign: "center" }}>
                  <i className="ph-fill ph-first-aid" style={{ fontSize: 48, color: "#cdf14a", marginBottom: 16 }} />
                  <h4 style={{ fontSize: 20, margin: "0 0 12px" }}>Priority 1: Emergency</h4>
                  <p className="muted" style={{ maxWidth: 400, margin: "0 auto" }}>
                    The contract checks the current emergency balance. If it is below the target (e.g. $1000), funds are routed here first, up to the maximum top-up basis points.
                  </p>
                </div>
              )}
              {activeStage === 1 && (
                <div style={{ textAlign: "center" }}>
                  <i className="ph-fill ph-bank" style={{ fontSize: 48, color: "#8c9099", marginBottom: 16 }} />
                  <h4 style={{ fontSize: 20, margin: "0 0 12px" }}>Priority 2: Obligations</h4>
                  <p className="muted" style={{ maxWidth: 400, margin: "0 auto" }}>
                    Applied to the remaining balance. Reserves funds for taxes or mandatory expenses. Can only be withdrawn after an optional cooling-off period.
                  </p>
                </div>
              )}
              {activeStage === 2 && (
                <div style={{ textAlign: "center" }}>
                  <i className="ph-fill ph-lock-key" style={{ fontSize: 48, color: "#38bdf8", marginBottom: 16 }} />
                  <h4 style={{ fontSize: 20, margin: "0 0 12px" }}>Priority 3: Goal Lots</h4>
                  <p className="muted" style={{ maxWidth: 400, margin: "0 auto" }}>
                    A percentage of the remaining balance is locked into a new lot with a specific unlock timestamp (e.g., 90 days). Cannot be withdrawn early.
                  </p>
                </div>
              )}
              {activeStage === 3 && (
                <div style={{ textAlign: "center" }}>
                  <i className="ph-fill ph-wallet" style={{ fontSize: 48, color: "#f4f5f6", marginBottom: 16 }} />
                  <h4 style={{ fontSize: 20, margin: "0 0 12px" }}>Priority 4: Spendable</h4>
                  <p className="muted" style={{ maxWidth: 400, margin: "0 auto" }}>
                    Whatever survives the waterfall is returned to the user's primary wallet address for immediate use.
                  </p>
                </div>
              )}
            </Reveal>
          </div>
        </div>
      </section>

      {/* 4. Trust Boundaries */}
      <section id="trust" className="lp-section" style={{ padding: "48px 24px 96px" }}>
        <Reveal variant="up" style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "var(--text-h1)", margin: 0 }}>Trust Boundaries</h2>
          <p className="muted" style={{ fontSize: 16, marginTop: 12 }}>What the protocol can and cannot do.</p>
        </Reveal>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          <div className="card" style={{ padding: 32, borderTop: "2px solid #cdf14a" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18, color: "#f4f5f6", display: "flex", alignItems: "center", gap: 8 }}>
              <i className="ph-fill ph-check-circle" style={{ color: "#cdf14a" }} />
              Protocol CAN
            </h3>
            <ul style={{ padding: "0 0 0 20px", margin: 0, color: "var(--color-text-secondary)", display: "flex", flexDirection: "column", gap: 12 }}>
              <li>Hold funds securely in a Soroban smart contract.</li>
              <li>Enforce mathematically verified routing rules.</li>
              <li>Reject withdrawals before time-locks expire.</li>
              <li>Execute atomic, multi-party distributions.</li>
            </ul>
          </div>
          
          <div className="card" style={{ padding: 32, borderTop: "2px solid #ef4444" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18, color: "#f4f5f6", display: "flex", alignItems: "center", gap: 8 }}>
              <i className="ph-fill ph-x-circle" style={{ color: "#ef4444" }} />
              Protocol CANNOT
            </h3>
            <ul style={{ padding: "0 0 0 20px", margin: 0, color: "var(--color-text-secondary)", display: "flex", flexDirection: "column", gap: 12 }}>
              <li>Access funds in your external wallet.</li>
              <li>Change routing rules without your cryptographic signature.</li>
              <li>Generate yield or interest.</li>
              <li>Invest funds in external DeFi protocols.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 5. Integrator Section */}
      <section id="integrate" className="lp-section" style={{ padding: "0 24px 96px" }}>
        <Reveal variant="blur" className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "32px 40px", borderBottom: "1px solid var(--color-border-subtle)" }}>
            <h2 style={{ fontSize: 24, margin: "0 0 12px" }}>For Integrators</h2>
            <p className="muted" style={{ margin: 0, fontSize: 15, maxWidth: 600 }}>
              Trigger the routing engine from any platform using standard Soroban RPC calls.
            </p>
          </div>
          <div style={{ background: "#0a0c0f", padding: "32px 40px", overflowX: "auto" }}>
            <pre style={{ margin: 0, color: "#a78bfa", fontSize: 14, fontFamily: "monospace", lineHeight: 1.5 }}>
              <code>
{`// Execute a routing sequence via Soroban SDK
const contractId = "CDMFJZ6VRD2JEV7J2W7KMZZ3AXNSOST2C6L2KYRJAYIN7ULWJEOCWO5B";
const tx = await contract.invoke({
  method: "route_income",
  args: [
    scVal.symbol(payerAddress),
    scVal.u32(amountUsdc),
    scVal.string(requestId)
  ]
});

// The contract automatically determines the owner's policy,
// splits the funds, and emits a SettlementEvent.`}
              </code>
            </pre>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="lp-section" style={{ padding: "28px 24px 44px", borderTop: "1px solid var(--color-border-subtle)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        <div className="lp-brand muted" style={{ fontSize: 13, fontWeight: 500 }}>
          <Logo size={22} />
          Shunt Programmable Money
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <a href="https://github.com/irham3/shunt" target="_blank" rel="noreferrer" className="muted" style={{ fontSize: 13 }}>
            GitHub
          </a>
          <a
            href="https://stellar.expert/explorer/testnet/contract/CDMFJZ6VRD2JEV7J2W7KMZZ3AXNSOST2C6L2KYRJAYIN7ULWJEOCWO5B"
            target="_blank"
            rel="noreferrer"
            className="muted"
            style={{ fontSize: 13 }}
          >
            Vault Contract
          </a>
        </div>
      </footer>
    </AnimatedBackground>
  );
}
