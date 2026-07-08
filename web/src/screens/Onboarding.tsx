import { useNavigate } from "react-router-dom";
import { SplitNode } from "../components/SplitNode";
import { DEFAULT_BUCKETS } from "../store";
import { AnimatedBackground } from "../components/AnimatedBackground";
import { ShinyText } from "../components/ShinyText";
import { BentoGrid, BentoCard } from "../components/BentoGrid";
import { Wallet, Shield, Zap, Lock, RefreshCcw, HandCoins } from "lucide-react";

export function Onboarding() {
  const nav = useNavigate();

  return (
    <AnimatedBackground>
        {/* Navbar/Header */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "20px 40px", maxWidth: 1200, margin: "0 auto", width: "100%", alignItems: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 16, height: 16, background: "var(--color-accent-primary)", borderRadius: 4 }} />
          Shunt
        </div>
        <button className="btn-primary" style={{ width: "fit-content", padding: "8px 16px" }} onClick={() => nav("/connect")}>Connect Wallet</button>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px", display: "flex", flexDirection: "column", gap: 100 }}>
        
        {/* 1. Hero Section */}
        <section style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 24, marginTop: 40 }}>
          <h1 style={{ fontSize: "clamp(48px, 6vw, 72px)", margin: 0, lineHeight: 1.1, maxWidth: 800 }}>
            <ShinyText text="Income lands, instantly split." speed={4} />
          </h1>
          <p className="muted" style={{ fontSize: "clamp(18px, 2vw, 22px)", maxWidth: 600, margin: 0 }}>
            Set it once, the rest is automatic. Every incoming USDC is split into its own lanes. The moment discipline is easy: payday.
          </p>
          <button className="btn-primary" style={{ fontSize: 18, padding: "16px 32px", height: "auto", borderRadius: 30, width: "fit-content" }} onClick={() => nav("/connect")}>
            Get Started
          </button>
          
          <div style={{ marginTop: 60, width: "100%", maxWidth: 600 }}>
            <SplitNode buckets={DEFAULT_BUCKETS} height={200} />
          </div>
        </section>

        {/* 2. The Problem / Why People Use It */}
        <section style={{ display: "flex", flexDirection: "column", gap: 32, maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "clamp(32px, 4vw, 48px)", margin: 0 }}>Why people use it</h2>
            <p className="muted" style={{ fontSize: 18, marginTop: 8 }}>Three quiet leaks that freelancers face.</p>
          </div>
          
          <BentoGrid>
            <BentoCard delay={0.1}>
              <Wallet size={32} color="var(--color-accent-primary)" style={{ marginBottom: 16 }} />
              <h3 style={{ margin: "0 0 8px 0", fontSize: 20 }}>The single-balance trap</h3>
              <p className="muted" style={{ margin: 0, fontSize: 15 }}>
                When $2,000 lands as one number, all of it feels spendable — and two weeks later it's gone.
              </p>
            </BentoCard>
            <BentoCard delay={0.2}>
              <Shield size={32} color="var(--color-accent-primary)" style={{ marginBottom: 16 }} />
              <h3 style={{ margin: "0 0 8px 0", fontSize: 20 }}>Rupiah erosion</h3>
              <p className="muted" style={{ margin: 0, fontSize: 15 }}>
                Money parked in IDR loses value year after year. Saving in local currency is running up a down escalator.
              </p>
            </BentoCard>
            <BentoCard delay={0.3}>
              <Zap size={32} color="var(--color-accent-primary)" style={{ marginBottom: 16 }} />
              <h3 style={{ margin: "0 0 8px 0", fontSize: 20 }}>No automation</h3>
              <p className="muted" style={{ margin: 0, fontSize: 15 }}>
                Irregular income defeats every payroll-based savings tool. The only clean moment to save is the instant it arrives.
              </p>
            </BentoCard>
          </BentoGrid>
        </section>

        {/* 3. The Solutions / Outcomes */}
        <section style={{ display: "flex", flexDirection: "column", gap: 32, maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "clamp(32px, 4vw, 48px)", margin: 0 }}>What you get</h2>
            <p className="muted" style={{ fontSize: 18, marginTop: 8 }}>Four concrete outcomes of the Shunt autopilot.</p>
          </div>
          
          <BentoGrid>
            <BentoCard delay={0.1}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>💵</div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: 20 }}>Savings that hold value</h3>
              <p className="muted" style={{ margin: 0, fontSize: 15 }}>Kept in USDC, not IDR — your safety net stops shrinking.</p>
            </BentoCard>
            <BentoCard delay={0.2}>
              <Lock size={32} color="var(--color-bucket-savings)" style={{ marginBottom: 16 }} />
              <h3 style={{ margin: "0 0 8px 0", fontSize: 20 }}>Savings you can't sabotage</h3>
              <p className="muted" style={{ margin: 0, fontSize: 15 }}>Locked by a smart contract with a timelock, not by a label in an app.</p>
            </BentoCard>
            <BentoCard delay={0.3}>
              <RefreshCcw size={32} color="var(--color-bucket-invest)" style={{ marginBottom: 16 }} />
              <h3 style={{ margin: "0 0 8px 0", fontSize: 20 }}>Investing that actually happens</h3>
              <p className="muted" style={{ margin: 0, fontSize: 15 }}>A slice is spot-converted (DCA) the moment it lands.</p>
            </BentoCard>
            <BentoCard delay={0.4}>
              <HandCoins size={32} color="var(--color-bucket-needs)" style={{ marginBottom: 16 }} />
              <h3 style={{ margin: "0 0 8px 0", fontSize: 20 }}>One app for the whole loop</h3>
              <p className="muted" style={{ margin: 0, fontSize: 15 }}>Money in, structured, and out to your bank. You never leave Shunt.</p>
            </BentoCard>
          </BentoGrid>
        </section>

        {/* 4. Bottom CTA */}
        <section style={{ textAlign: "center", padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <h2 style={{ fontSize: "clamp(32px, 4vw, 48px)", margin: 0 }}>Ready to put your income on autopilot?</h2>
          <button className="btn-primary" style={{ fontSize: 18, padding: "16px 32px", height: "auto", borderRadius: 30, width: "fit-content" }} onClick={() => nav("/connect")}>
            Launch App
          </button>
        </section>

      </div>
    </AnimatedBackground>
  );
}
