import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SplitNode } from "../components/SplitNode";
import { DEFAULT_BUCKETS } from "../store";
import { AnimatedBackground } from "../components/AnimatedBackground";
import { ShinyText } from "../components/ShinyText";

const SLIDES = [
  {
    headline: "Income lands, instantly split.",
    sub: "Set it once, the rest is automatic. Every incoming USDC is split into its own lanes.",
  },
  {
    headline: "Savings the rupiah can't erode.",
    sub: "The Savings lane is held in USDC — hard value, depreciation-resistant — and timelocked in a smart contract.",
  },
  {
    headline: "Non-custodial. Your keys stay yours.",
    sub: "Needs & Buffer stay in your wallet. Savings is held by contract code that obeys only you — no third party.",
  },
];

export function Onboarding() {
  const [i, setI] = useState(0);
  const nav = useNavigate();
  const last = i === SLIDES.length - 1;

  return (
    <AnimatedBackground>
      <div className="screen" style={{ justifyContent: "center", textAlign: "center", minHeight: "100dvh" }}>
        <SplitNode buckets={DEFAULT_BUCKETS} height={160} />
        <h1 style={{ fontSize: 28, margin: "8px 0 0" }}>
          <ShinyText text={SLIDES[i].headline} speed={4} />
        </h1>
      <p className="muted" style={{ margin: 0 }}>{SLIDES[i].sub}</p>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "12px 0" }} aria-label={`Slide ${i + 1} of 3`}>
        {SLIDES.map((_, d) => (
          <button
            key={d}
            onClick={() => setI(d)}
            aria-label={`Slide ${d + 1}`}
            style={{
              width: d === i ? 24 : 8,
              height: 8,
              minHeight: 8,
              borderRadius: 4,
              background: d === i ? "var(--color-accent-primary)" : "#2a3340",
              transition: "width .2s",
              padding: 0,
            }}
          />
        ))}
      </div>

      <button className="btn-primary" onClick={() => (last ? nav("/connect") : setI(i + 1))}>
        {last ? "Get started" : "Next"}
      </button>
      {!last && (
        <button className="btn-ghost" onClick={() => nav("/connect")}>
          Skip
        </button>
      )}
      </div>
    </AnimatedBackground>
  );
}
