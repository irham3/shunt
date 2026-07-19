/**
 * Fonts are loaded through @remotion/google-fonts so rendering stays
 * deterministic (the same subset files are fetched at bundle time and the
 * frame render blocks on font readiness via Remotion's delayRender).
 * Montserrat + Plus Jakarta Sans match the shipped Shunt web app.
 */
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadJakarta } from "@remotion/google-fonts/PlusJakartaSans";

const montserrat = loadMontserrat("normal", {
  weights: ["500", "600", "700", "800"],
});

const jakarta = loadJakarta("normal", {
  weights: ["400", "500", "600"],
});

/** Display / numeric face. */
export const FONT_DISPLAY = montserrat.fontFamily;

/** Body / label face. */
export const FONT_BODY = jakarta.fontFamily;
