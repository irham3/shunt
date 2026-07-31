import { useEffect, useRef, useState, Fragment } from "react";
import { motion, useInView, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
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
  { title: "Auto-split", body: "Core allocation settles atomically; Invest converts separately." },
];

// Figures verified against docs/unit-economics.md and the contract test suite.
// Note: the take-rate below is Shunt's OWN service fee, not total end-to-end
// cost — an anchor charges its own fee on top, so we don't claim a multiple
// "cheaper than remittance" here.
const STATS = [
  { value: 0.29, decimals: 2, suffix: "%", label: "Shunt service fee (blended)" },
  { value: 49, decimals: 0, suffix: "", label: "Contract unit tests" },
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

const RISING_PARTICLES = Array.from({ length: 32 }).map((_, i) => ({
  id: i,
  left: (i * 3.1 + (i % 5) * 7) % 92 + 4,
  size: i % 3 === 0 ? 3 : 2,
  duration: 2.2 + (i % 7) * 0.4,
  delay: (i % 11) * 0.3,
  color: i % 4 === 0 ? "#ffffff" : i % 2 === 0 ? "#cdf14a" : "#a3e635",
}));

const MARQUEE_LOGOS = [
  { name: "Stellar", src: "/images/marquee/stellar.png" },
  { name: "Soroban", src: "/images/marquee/soroban.png" },
  { name: "Settle Network", src: "/images/marquee/settle.png" },
  { name: "Freighter", src: "/images/marquee/freighter.png" },
  { name: "Albedo", src: "/images/marquee/albedo.png" },
  { name: "WalletConnect", src: "/images/marquee/walletconnect.png" },
  { name: "MoneyGram", src: "/images/marquee/moneygram.png" },
  { name: "USDC", src: "/images/marquee/usdc.png" },
  { name: "Rust", src: "/images/marquee/rust.png" },
];

const HOW_STEPS = [
  {
    step: 1,
    title: "Connect Non-Custodial Wallet",
    desc: "Link Freighter, Albedo, or xBull in one click. No sign-up, no custody, 100% self-sovereign.",
    image: "/images/step/step1.png",
  },
  {
    step: 2,
    title: "Configure Custom Split Rules",
    desc: "Set percentage rules for Needs, Savings, Buffer, and Invest saved directly on-chain.",
    image: "/images/step/step2.png",
  },
  {
    step: 3,
    title: "Central Dashboard & Actions",
    desc: "Access your balance hub with instant Top Up, Request links, Send & Pay, or Convert tools.",
    image: "/images/step/step3.png",
  },
  {
    step: 4,
    title: "Income Lands in Seconds",
    desc: "Payment links, top-ups, or client transfers are detected automatically in real-time.",
    image: "/images/step/step4.png",
  },
  {
    step: 5,
    title: "One-Tap Atomic Auto-Split",
    desc: "Review the breakdown and sign once funds settle into your smart contract lanes atomically.",
    image: "/images/step/step5.png",
  },
];

const WHY_POINTS = [
  {
    icon: "ph-shield-check",
    title: "100% Non-Custodial",
    desc: "Your keys, your crypto. No central sign-up, bank custody, or custodial risk.",
  },
  {
    icon: "ph-lock-key",
    title: "Soroban Vault Lock",
    desc: "Smart contract timelock on Stellar that enforces true saving discipline.",
  },
  {
    icon: "ph-currency-circle-dollar",
    title: "USDC Inflation Defense",
    desc: "Protect your hard-earned salary against local currency depreciation.",
  },
  {
    icon: "ph-lightning",
    title: "One-Tap Payday Split",
    desc: "No tedious math or manual transfers—allocate your entire income in seconds.",
  },
];

export const Onboarding: React.FC = () => {
  const nav = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const reduceMotion = useReducedMotion();

  // Scroll-driven motion: a thin top progress bar + gentle hero-card parallax.
  const { scrollYProgress } = useScroll();
  const heroCardY = useTransform(scrollYProgress, [0, 0.25], [0, reduceMotion ? 0 : -70]);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);

      const sections = ["why", "loop", "how", "proof"];
      let current = "home";
      for (const s of sections) {
        const el = document.getElementById(s);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 140) {
            current = s;
          }
        }
      }
      setActiveSection(current);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // Initialize Lenis smooth inertial scrolling for the landing page
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return (
    <AnimatedBackground>
      {/* Scroll progress bar */}
      <motion.div className="lp-scroll-progress" style={{ scaleX: scrollYProgress }} aria-hidden />

      {/* Hero Wrapper containing Navbar + Hero with bg-hero.png background */}
      <div className="landing-hero-wrapper">
        {/* Full-bleed sticky nav */}
        <nav className={`lp-nav${scrolled ? " scrolled" : ""}`}>
          <div className="lp-nav-inner">
            <div className="lp-brand">
              <Logo />
              <span>Shunt</span>
            </div>
            <div className="lp-nav-links">
              <a
                href="#"
                className={activeSection === "home" ? "active" : ""}
                onClick={(e) => {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Home
              </a>
              <a href="#why" className={activeSection === "why" ? "active" : ""}>Why</a>
              <a href="#loop" className={activeSection === "loop" ? "active" : ""}>The loop</a>
              <a href="#how" className={activeSection === "how" ? "active" : ""}>How it works</a>
              <a href="#proof" className={activeSection === "proof" ? "active" : ""}>Proof</a>
            </div>
            <button
              className="lp-btn-cta"
              onClick={() => nav("/connect")}
            >
              <span>Connect Wallet</span>
              <i className="ph ph-arrow-up-right" />
            </button>
          </div>
        </nav>

        {/* 1. Hero Section */}
        <section
          className="lp-section"
          style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "124px 24px 0" }}
        >
          {/* Top Pill Badge */}
          <Reveal variant="blur" delay={0.02}>
            <div className="lp-hero-badge">
              <span className="lp-badge-tag">Soroban Vault</span>
              <span>Automated Payday Splitter on Stellar</span>
            </div>
          </Reveal>

          {/* Hero Headline */}
          <Reveal variant="blur" delay={0.08}>
            <h1 className="hero-title">
              Automated
              <br />
              Money Routing
            </h1>
          </Reveal>

          {/* Hero Subtitle */}
          <Reveal variant="up" delay={0.14}>
            <p className="hero-subtitle">
              Set the rules once, confirm each payday, and keep Savings in a timelocked Soroban vault while the rest stays liquid.
            </p>
          </Reveal>

          {/* Hero CTA Combined Glass Capsule Box */}
          <Reveal variant="up" delay={0.2}>
            <div className="lp-hero-cta-capsule">
              <button
                className="lp-hero-cta-left"
                onClick={() => window.open("https://github.com/irham3/shunt", "_blank")}
              >
                <i className="ph ph-github-logo" style={{ fontSize: 18 }} />
                <span>View source</span>
              </button>
              <button
                className="lp-btn-olive"
                onClick={() => nav("/connect")}
              >
                <span>Get Started</span>
                <i className="ph ph-arrow-right" />
              </button>
            </div>
          </Reveal>

          {/* Microcopy tightly below button */}
          <Reveal variant="up" delay={0.24}>
            <div className="hero-microcopy">
              USDC · Non-custodial · Built on Stellar
            </div>
          </Reveal>

          {/* Hero Web Preview Mockup Cropped at Bottom Boundary of Hero Section */}
          <motion.div style={{ y: heroCardY, marginTop: 32, marginBottom: 0, width: "100%", maxWidth: 1020, position: "relative" }}>
            {/* Rising Pixel Particles & Glowing Light Aura */}
            <div className="hero-particles-container">
              <div className="hero-particles-glow" />
              {RISING_PARTICLES.map((p) => (
                <span
                  key={p.id}
                  className="hero-pixel-particle"
                  style={{
                    left: `${p.left}%`,
                    width: p.size,
                    height: p.size,
                    backgroundColor: p.color,
                    animationDuration: `${p.duration}s`,
                    animationDelay: `${p.delay}s`,
                  }}
                />
              ))}
            </div>

            <Reveal variant="scale" delay={0.28}>
              <div className="hero-preview-crop-container">
                <div className="lp-hero-preview-glass">
                  <img
                    src="/images/previeweb-hero.png"
                    alt="Shunt Dashboard Preview"
                    className="lp-hero-preview-img"
                  />
                </div>
              </div>
            </Reveal>
          </motion.div>
        </section>
      </div>

      {/* 2. Ecosystem Partner Marquee */}
      <section className="lp-marquee-section">
        <div className="lp-marquee-header">
          Built on World-Class Stellar Infrastructure
        </div>
        <div className="lp-marquee-container">
          <div className="lp-marquee-track">
            {[...Array(2)].flatMap((_, dup) =>
              MARQUEE_LOGOS.map((logo) => (
                <div key={`${dup}-${logo.name}`} className="lp-marquee-item">
                  <img
                    src={logo.src}
                    alt={logo.name}
                    className="lp-marquee-logo"
                  />
                </div>
              )),
            )}
          </div>
        </div>
      </section>

      {/* 2. Why People Use It — Split Layout with Image Frame & 2x2 Highlights */}
      <section id="why" className="lp-section lp-why-section">
        <div className="lp-why-container">
          {/* Left Column: Badge, Title, Subtitle, and 2x2 Highlights Grid */}
          <div className="lp-why-content">
            <Reveal variant="blur" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
              <div className="lp-hero-badge">
                <i className="ph ph-sparkle" style={{ color: "#cdf14a" }} />
                <span>Why Shunt</span>
              </div>
              <h2 className="lp-why-title">Why People Choose Shunt for Automated Wealth</h2>
              <p className="lp-why-desc">
                Managing payday salary manually leads to un-saved funds and currency depreciation. Shunt automates your financial allocation on-chain the moment income arrives.
              </p>
            </Reveal>

            {/* 2x2 Key Points Grid */}
            <div className="lp-why-grid">
              {WHY_POINTS.map((pt, i) => (
                <Reveal key={pt.title} variant="up" delay={i * 0.08} className="lp-why-point-card">
                  <div className="lp-why-point-header">
                    <i className={`ph ${pt.icon} lp-why-point-icon`} />
                    <h3 className="lp-why-point-title">{pt.title}</h3>
                  </div>
                  <p className="lp-why-point-desc">{pt.desc}</p>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Right Column: Preview Image Frame */}
          <Reveal variant="scale" delay={0.2} className="lp-why-image-wrap">
            <div className="lp-why-image-card">
              <img
                src="/images/whyshunt/whyshunt.png"
                alt="Why People Choose Shunt"
                className="lp-why-img"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* 3. The loop: Interactive Money Flow Branching Diagram Card */}
      <section id="loop" className="lp-section lp-loop-section">
        <Reveal variant="blur" style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div className="lp-hero-badge">
            <i className="ph ph-sparkle" style={{ color: "#cdf14a" }} />
            <span>Smart Allocations</span>
          </div>
          <h2 className="lp-loop-title">One App, The Whole Loop</h2>
          <p className="lp-loop-subtitle">Money in, structured on-chain, out to your bank.</p>
        </Reveal>

        <Reveal variant="scale" delay={0.12} style={{ width: "100%", maxWidth: 1140, margin: "0 auto" }}>
          <div className="lp-loop-diagram-card">
            {/* Subtle Circuit Texture */}
            <svg className="lp-diagram-circuit-texture" viewBox="0 0 900 250" preserveAspectRatio="none">
              <g stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none">
                <path d="M 40,220 H 180 V 200" />
                <path d="M 860,30 H 740 V 52" />
                <circle cx="180" cy="196" r="3" fill="rgba(255,255,255,0.12)" />
                <circle cx="740" cy="56" r="3" fill="rgba(255,255,255,0.12)" />
              </g>
            </svg>

            {/* Left Brand Identity */}
            <div className="lp-diagram-left">
              <div className="lp-diagram-brand">
                <h3 className="lp-diagram-logo">Shunt</h3>
                <span className="lp-diagram-fork-symbol">⑃</span>
              </div>
              <h4 className="lp-diagram-headline">Automated money routing.</h4>
              <p className="lp-diagram-sub">Non-custodial USDC autopilot on Stellar</p>
            </div>

            {/* Middle SVG Flow & Branch Connectors with H 350 straight tails */}
            <div className="lp-diagram-center">
              <svg viewBox="0 0 350 290" className="lp-diagram-svg" preserveAspectRatio="none">
                <defs>
                  <filter id="shuntGlow" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="3.5" result="b"/>
                    <feMerge>
                      <feMergeNode in="b"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  <path id="laneIn" d="M 10,145 H 155"/>
                  <path id="laneA" d="M 155,145 C 215,145 215,42 265,42 H 350"/>
                  <path id="laneB" d="M 155,145 C 215,145 215,114 265,114 H 350"/>
                  <path id="laneC" d="M 155,145 C 215,145 215,182 265,182 H 350"/>
                  <path id="laneD" d="M 155,145 C 215,145 215,246 265,246 H 350"/>
                </defs>

                {/* USDC in Label placed tightly right above input cable */}
                <g fontSize="12" fontWeight="500" fill="#8A93A3">
                  <text x="45" y="132">USDC in</text>
                </g>

                {/* Dim Background Circuit Lanes */}
                <g fill="none" strokeLinecap="round">
                  <use href="#laneIn" stroke="#2a3648" strokeWidth="3"/>
                  <use href="#laneA" stroke="#23394d" strokeWidth="3"/>
                  <use href="#laneB" stroke="#3a4022" strokeWidth="3"/>
                  <use href="#laneC" stroke="#3d2f16" strokeWidth="3"/>
                  <use href="#laneD" stroke="#2e2a4a" strokeWidth="3"/>
                </g>

                {/* Split Node with pulsing animation on handoff at 37.5% cycle */}
                <circle cx="155" cy="145" r="9" fill="#0B0F14" stroke="#D8F15A" strokeWidth="2.5" filter="url(#shuntGlow)">
                  <animate attributeName="r" values="8;8;11;8;8" keyTimes="0;0.375;0.44;0.55;1" dur="4.8s" repeatCount="indefinite"/>
                </circle>

                {/* Incoming Pulse Dot (0% -> 37.5%) */}
                <circle r="5" fill="#F5F7FA" filter="url(#shuntGlow)">
                  <animateMotion dur="4.8s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1;1" keyTimes="0;0.375;1">
                    <mpath href="#laneIn"/>
                  </animateMotion>
                  <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.04;0.33;0.375;1" dur="4.8s" repeatCount="indefinite"/>
                </circle>

                {/* 4 Outgoing Branch Pulses (37.5% -> 75%) */}
                <circle r="4.5" fill="#74BDF6" filter="url(#shuntGlow)">
                  <animateMotion dur="4.8s" repeatCount="indefinite" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;0.375;0.75;1">
                    <mpath href="#laneA"/>
                  </animateMotion>
                  <animate attributeName="opacity" values="0;0;1;1;1;0" keyTimes="0;0.375;0.42;0.75;0.82;1" dur="4.8s" repeatCount="indefinite"/>
                </circle>

                <circle r="4.5" fill="#D8F15A" filter="url(#shuntGlow)">
                  <animateMotion dur="4.8s" repeatCount="indefinite" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;0.375;0.75;1">
                    <mpath href="#laneB"/>
                  </animateMotion>
                  <animate attributeName="opacity" values="0;0;1;1;1;0" keyTimes="0;0.375;0.42;0.75;0.82;1" dur="4.8s" repeatCount="indefinite"/>
                </circle>

                <circle r="4.5" fill="#E19E24" filter="url(#shuntGlow)">
                  <animateMotion dur="4.8s" repeatCount="indefinite" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;0.375;0.75;1">
                    <mpath href="#laneC"/>
                  </animateMotion>
                  <animate attributeName="opacity" values="0;0;1;1;1;0" keyTimes="0;0.375;0.42;0.75;0.82;1" dur="4.8s" repeatCount="indefinite"/>
                </circle>

                <circle r="4.5" fill="#A08BF7" filter="url(#shuntGlow)">
                  <animateMotion dur="4.8s" repeatCount="indefinite" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;0.375;0.75;1">
                    <mpath href="#laneD"/>
                  </animateMotion>
                  <animate attributeName="opacity" values="0;0;1;1;1;0" keyTimes="0;0.375;0.42;0.75;0.82;1" dur="4.8s" repeatCount="indefinite"/>
                </circle>
              </svg>
            </div>

            {/* Right Side: 4 Interactive Lane Cards with Synchronized Glow Pulse */}
            <div className="lp-diagram-right">
              {LANES.map((l) => (
                <div key={l.id} className={`lp-diagram-lane-card lp-card-pulse-${l.id}`}>
                  <div className="lp-diagram-lane-header">
                    <div className="lp-diagram-lane-title-group">
                      <span className="lp-diagram-dot" style={{ backgroundColor: l.color, boxShadow: `0 0 8px ${l.color}` }} />
                      <span className="lp-diagram-lane-name">{l.name}</span>
                    </div>
                    <span className="lp-diagram-lane-pct" style={{ color: l.color }}>{l.pct}%</span>
                  </div>
                  <p className="lp-diagram-lane-desc">{l.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* 4. How Our Process Works: 5-step interactive card grid */}
      <section id="how" className="lp-section lp-how-section">
        <Reveal variant="blur" style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div className="lp-hero-badge">
            <i className="ph ph-sparkle" style={{ color: "#cdf14a" }} />
            <span>How it works</span>
          </div>
          <h2 className="lp-how-title">How Our Process Works</h2>
        </Reveal>

        <div className="lp-how-grid">
          {/* Top Row: Steps 1, 2, 3 */}
          <div className="lp-how-row lp-how-row-3">
            {HOW_STEPS.slice(0, 3).map((s, i) => (
              <Reveal key={s.step} variant="scale" delay={i * 0.1} className="lp-how-card-wrap">
                <div className="lp-how-card">
                  <div className="lp-how-img-box">
                    <img src={s.image} alt={s.title} className="lp-how-img" />
                    <div className="lp-how-num-badge">
                      <span>{s.step}</span>
                    </div>
                  </div>
                  <div className="lp-how-card-content">
                    <h3 className="lp-how-card-title">{s.title}</h3>
                    <p className="lp-how-card-desc">{s.desc}</p>
                  </div>
                </div>
                {i < 2 && (
                  <div className={`lp-how-arrow-connector ${i === 0 ? "lp-how-arrow-top" : "lp-how-arrow-bottom"}`} aria-hidden>
                    <img src="/images/step/arrow-curve.png" alt="" className="lp-how-arrow-img" />
                  </div>
                )}
              </Reveal>
            ))}
          </div>

          {/* Bottom Row: Steps 4, 5 */}
          <div className="lp-how-row lp-how-row-2">
            {HOW_STEPS.slice(3, 5).map((s, i) => (
              <Reveal key={s.step} variant="scale" delay={(i + 3) * 0.1} className="lp-how-card-wrap">
                <div className="lp-how-card">
                  <div className="lp-how-img-box">
                    <img src={s.image} alt={s.title} className="lp-how-img" />
                    <div className="lp-how-num-badge">
                      <span>{s.step}</span>
                    </div>
                  </div>
                  <div className="lp-how-card-content">
                    <h3 className="lp-how-card-title">{s.title}</h3>
                    <p className="lp-how-card-desc">{s.desc}</p>
                  </div>
                </div>
                {i === 0 && (
                  <div className="lp-how-arrow-connector lp-how-arrow-top" aria-hidden>
                    <img src="/images/step/arrow-curve.png" alt="" className="lp-how-arrow-img" />
                  </div>
                )}
              </Reveal>
            ))}
          </div>
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
            href="https://stellar.expert/explorer/testnet/contract/CDMFJZ6VRD2JEV7J2W7KMZZ3AXNSOST2C6L2KYRJAYIN7ULWJEOCWO5B"
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
