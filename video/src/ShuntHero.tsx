import { AbsoluteFill, Sequence } from "remotion";
import { Background } from "./components/Background";
import { Scene } from "./components/Scene";
import { BrandIntro } from "./components/scenes/BrandIntro";
import { IncomingPayment } from "./components/scenes/IncomingPayment";
import { SplitScene } from "./components/scenes/SplitScene";
import { VaultScene } from "./components/scenes/VaultScene";
import { FinalCTA } from "./components/scenes/FinalCTA";
import { FONT_BODY } from "./fonts";
import { COLORS } from "./theme";

/**
 * Scene windows (30fps, 240 frames total). Each window overlaps the next by
 * exactly 10 frames, which is also the Scene fade length — so the outgoing
 * fade-out and incoming fade-in are perfectly complementary (a clean dissolve,
 * never two scenes at full opacity at once).
 *   1. Brand intro            0 –  56
 *   2. Incoming payment      46 – 112
 *   3. Split into 3 lanes   102 – 172
 *   4. Save flows to vault  162 – 212
 *   5. Final CTA            202 – 240
 */
export const ShuntHero: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bgBase,
        fontFamily: FONT_BODY,
      }}
    >
      <Background />

      <Sequence from={0} durationInFrames={56} name="1 · Brand intro">
        <Scene durationInFrames={56}>
          <BrandIntro />
        </Scene>
      </Sequence>

      <Sequence from={46} durationInFrames={66} name="2 · Incoming payment">
        <Scene durationInFrames={66}>
          <IncomingPayment />
        </Scene>
      </Sequence>

      <Sequence from={102} durationInFrames={70} name="3 · Split">
        <Scene durationInFrames={70}>
          <SplitScene />
        </Scene>
      </Sequence>

      <Sequence from={162} durationInFrames={50} name="4 · Vault">
        <Scene durationInFrames={50}>
          <VaultScene />
        </Scene>
      </Sequence>

      <Sequence from={202} durationInFrames={38} name="5 · Final CTA">
        <Scene durationInFrames={38} fadeOut={0}>
          <FinalCTA />
        </Scene>
      </Sequence>
    </AbsoluteFill>
  );
};
