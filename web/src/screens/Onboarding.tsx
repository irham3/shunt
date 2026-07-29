import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Code2, LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";
import { AllocationBar } from "../components/AllocationBar";
import { DonutChart } from "../components/DonutChart";
import { AnimatedBackground } from "../components/AnimatedBackground";
import { DEFAULT_BUCKETS } from "../store";

const PROOF = [
  "Stellar testnet",
  "Soroban vault",
  "User-signed",
  "49 contract tests",
];

const STEPS = [
  {
    title: "Income lands",
    body: "A USDC payment reaches your wallet. Shunt watches for the payment and prepares the split.",
  },
  {
    title: "You approve",
    body: "You see the exact lanes and sign once. Nothing moves without your wallet.",
  },
  {
    title: "Savings lock",
    body: "The savings lane moves into a timelocked Soroban vault. Spending money stays liquid.",
  },
];

const TRUST = [
  { icon: WalletCards, title: "Non-custodial", body: "Shunt never stores a secret key." },
  { icon: LockKeyhole, title: "Rules on-chain", body: "The vault enforces lock time and penalties." },
  { icon: ShieldCheck, title: "Honest ramps", body: "Test flows and provider sandboxes are labeled separately." },
];

function Logo() {
  return (
    <span className="lp-brand-mark" aria-hidden>
      <img src="/logomark.svg" width={18} height={18} alt="" />
    </span>
  );
}

export function Onboarding() {
  const nav = useNavigate();

  return (
    <AnimatedBackground aurora>
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-brand">
            <Logo />
            Shunt
          </div>
          <div className="lp-nav-links">
            <a href="#product">Product</a>
            <a href="#proof">Proof</a>
            <a href="#ramp">Ramps</a>
            <button className="btn-primary lp-nav-cta" onClick={() => nav("/connect")}>
              Connect wallet
            </button>
          </div>
        </div>
      </nav>

      <main>
        <section className="lp-section lp-hero">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Automated money routing for USDC income</p>
            <h1 className="hero-title">Split freelance income before you spend it.</h1>
            <p className="lp-hero-sub">
              Set rules once. Review and sign each payday. Savings locks in a Soroban vault
              while the rest stays liquid.
            </p>
            <div className="lp-actions">
              <button className="btn-primary" onClick={() => nav("/connect")}>
                Connect wallet <ArrowRight size={16} />
              </button>
              <button className="btn-secondary" onClick={() => window.open("https://github.com/irham3/shunt", "_blank")}>
                <Code2 size={16} /> View source
              </button>
            </div>
            <div className="lp-proof-row" aria-label="Project evidence">
              {PROOF.map((item) => (
                <span key={item}>
                  <CheckCircle2 size={14} />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="lp-product-panel" id="product">
            <div className="lp-panel-header">
              <span>Payday split</span>
              <span className="env-badge env-badge-simulation">Testnet demo</span>
            </div>
            <div className="lp-product-body">
              <DonutChart buckets={DEFAULT_BUCKETS} size={156} strokeWidth={20} />
              <div>
                <p className="muted">Default allocation</p>
                <AllocationBar buckets={DEFAULT_BUCKETS} />
                <div className="lp-allocation-list">
                  {DEFAULT_BUCKETS.map((bucket) => (
                    <div key={bucket.id}>
                      <span style={{ background: bucket.color }} />
                      <strong>{bucket.name}</strong>
                      <em>{bucket.pct}%</em>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="proof" className="lp-section lp-band">
          <div>
            <p className="lp-eyebrow">How it works</p>
            <h2>One clear action after money arrives.</h2>
          </div>
          <div className="lp-steps">
            {STEPS.map((step, index) => (
              <article key={step.title} className="lp-step-card">
                <span>{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section lp-trust-grid">
          {TRUST.map(({ icon: Icon, title, body }) => (
            <article key={title} className="lp-trust-card">
              <Icon size={20} />
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </section>

        <section id="ramp" className="lp-section lp-ramp-note">
          <div>
            <p className="lp-eyebrow">Ramp status</p>
            <h2>Demo flow first. Live providers only when the route is confirmed.</h2>
          </div>
          <p>
            The SDF anchor lane proves SEP-10 and SEP-24 on Stellar testnet. It does not move rupiah.
            Provider sandboxes sit in a separate lane, and Shunt only calls a route live after the provider confirms
            country, fiat, asset, network, direction, and settlement evidence.
          </p>
        </section>

        <section className="lp-section lp-final-cta">
          <h2>Bring order to the next payment.</h2>
          <button className="btn-primary" onClick={() => nav("/connect")}>
            Open Shunt <ArrowRight size={16} />
          </button>
        </section>
      </main>
    </AnimatedBackground>
  );
}
