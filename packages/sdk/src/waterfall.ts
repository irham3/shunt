import type { WaterfallAllocation } from "./types.js";

/**
 * Deterministic client-side formula for Shunt v2 waterfall routing.
 * Ensures the conservation invariant:
 *   gross === emergency + obligation + goal + spendable
 *
 * @param gross Amount of incoming token being routed
 * @param currentEmergency Current emergency balance held in reserve
 * @param emergencyTarget Target ceiling balance for emergency tier
 * @param emergencyBps Basis points maximum fill rate (e.g. 3500 for 35%)
 * @param obligationBps Basis points obligation tax withholding of remaining
 * @param goalBps Basis points timelocked goal lot deduction of remaining
 * @returns Precise allocation breakdown across all four tiers
 */
export function calculateWaterfall(
  gross: number,
  currentEmergency: number,
  emergencyTarget: number,
  emergencyBps: number,
  obligationBps: number,
  goalBps: number
): WaterfallAllocation {
  if (gross <= 0) {
    return { gross: 0, emergency: 0, obligation: 0, goal: 0, spendable: 0 };
  }

  // Tier 1: Emergency reserve fill
  const maxEmergencyFill = Math.floor((gross * emergencyBps) / 10000);
  const currentGap = Math.max(0, emergencyTarget - currentEmergency);
  const emergency = Math.min(maxEmergencyFill, currentGap);

  // Remaining after emergency topup
  const afterEmergency = gross - emergency;

  // Tier 2: Obligation & Tax Reserve
  const obligation = Math.floor((afterEmergency * obligationBps) / 10000);

  // Remaining after obligation withholding
  const afterObligation = afterEmergency - obligation;

  // Tier 3: Timelocked Goal Lots
  const goal = Math.floor((afterObligation * goalBps) / 10000);

  // Residual Spendable Pool (absorbs rounding division remainder)
  const spendable = Math.max(0, afterObligation - goal);

  return {
    gross,
    emergency,
    obligation,
    goal,
    spendable,
  };
}
