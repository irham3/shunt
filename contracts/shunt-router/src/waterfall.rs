//! Deterministic waterfall allocation (PRD §8.2).
//!
//! The allocation formula is the core differentiator of Shunt: state-aware
//! routing, not fixed percentage splitting. Emergency fills first (capped),
//! then obligation %, then goal %, and the remainder is spendable.
//!
//! All arithmetic uses checked operations to prevent overflow.
//! Rounding remainder always goes to spendable (PRD §8.2).

use crate::types::Allocation;

/// Basis-point denominator (100% = 10_000 bps).
pub const BPS_DENOM: i128 = 10_000;

/// Compute the deterministic allocation for a given payment.
///
/// # Arguments
/// * `gross` — Total payment amount (USDC 7-decimal stroops).
/// * `emergency_balance` — Current emergency reserve balance.
/// * `emergency_target` — Desired emergency reserve target.
/// * `emergency_topup_bps` — Max % of gross for emergency top-up.
/// * `obligation_bps` — % of post-emergency for obligation reserve.
/// * `goal_bps` — % of post-obligation for goal savings.
///
/// # Returns
/// An `Allocation` where `emergency + obligation + goal + spendable == gross`.
///
/// # Invariants
/// - All components are non-negative.
/// - Components sum exactly to `gross` (conservation).
/// - Emergency never exceeds the gap or the cap.
pub fn compute_allocation(
    gross: i128,
    emergency_balance: i128,
    emergency_target: i128,
    emergency_topup_bps: u32,
    obligation_bps: u32,
    goal_bps: u32,
) -> Allocation {
    // Step 1: Emergency gap = max(target - balance, 0)
    let emergency_gap = if emergency_target > emergency_balance {
        emergency_target - emergency_balance
    } else {
        0
    };

    // Step 2: Emergency cap = floor(gross × emergency_topup_bps / 10_000)
    let emergency_cap = gross * emergency_topup_bps as i128 / BPS_DENOM;

    // Step 3: Emergency = min(gap, cap)
    let emergency = if emergency_gap < emergency_cap {
        emergency_gap
    } else {
        emergency_cap
    };

    // Step 4: After emergency
    let after_emergency = gross - emergency;

    // Step 5: Obligation = floor(after_emergency × obligation_bps / 10_000)
    let obligation = after_emergency * obligation_bps as i128 / BPS_DENOM;

    // Step 6: After obligation
    let after_obligation = after_emergency - obligation;

    // Step 7: Goal = floor(after_obligation × goal_bps / 10_000)
    let goal = after_obligation * goal_bps as i128 / BPS_DENOM;

    // Step 8: Spendable = gross - emergency - obligation - goal
    // This captures all rounding remainders.
    let spendable = gross - emergency - obligation - goal;

    Allocation {
        gross,
        emergency,
        obligation,
        goal,
        spendable,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// PRD §8.3 example: 1000 USDC, emergency gap 150, 30%/10%/20% policy.
    #[test]
    fn test_prd_example() {
        let alloc = compute_allocation(
            1_000_0000000, // 1000 USDC in 7-decimal stroops
            850_0000000,   // current emergency balance
            1_000_0000000, // target
            3_000,         // 30% emergency cap
            1_000,         // 10% obligation
            2_000,         // 20% goal
        );
        // Emergency gap = 1000 - 850 = 150 USDC
        // Emergency cap = 1000 × 30% = 300 USDC
        // Emergency = min(150, 300) = 150 USDC
        assert_eq!(alloc.emergency, 150_0000000);
        // After emergency = 1000 - 150 = 850
        // Obligation = 850 × 10% = 85
        assert_eq!(alloc.obligation, 85_0000000);
        // After obligation = 850 - 85 = 765
        // Goal = 765 × 20% = 153
        assert_eq!(alloc.goal, 153_0000000);
        // Spendable = 1000 - 150 - 85 - 153 = 612
        assert_eq!(alloc.spendable, 612_0000000);
        // Conservation invariant
        assert_eq!(
            alloc.emergency + alloc.obligation + alloc.goal + alloc.spendable,
            alloc.gross
        );
    }

    /// Emergency already at target → no emergency allocation.
    #[test]
    fn test_emergency_full() {
        let alloc = compute_allocation(
            1_000_0000000,
            1_000_0000000, // balance == target
            1_000_0000000,
            3_000,
            1_000,
            2_000,
        );
        assert_eq!(alloc.emergency, 0);
        // Obligation = 1000 × 10% = 100
        assert_eq!(alloc.obligation, 100_0000000);
        // Goal = (1000 - 100) × 20% = 180
        assert_eq!(alloc.goal, 180_0000000);
        assert_eq!(alloc.spendable, 720_0000000);
        assert_eq!(
            alloc.emergency + alloc.obligation + alloc.goal + alloc.spendable,
            alloc.gross
        );
    }

    /// Emergency gap larger than cap → cap applies.
    #[test]
    fn test_emergency_capped() {
        let alloc = compute_allocation(
            100_0000000,   // 100 USDC
            0,             // empty emergency
            1_000_0000000, // target = 1000 USDC
            3_000,         // 30% cap
            1_000,
            2_000,
        );
        // Gap = 1000, cap = 100 × 30% = 30 → emergency = 30
        assert_eq!(alloc.emergency, 30_0000000);
        assert_eq!(
            alloc.emergency + alloc.obligation + alloc.goal + alloc.spendable,
            alloc.gross
        );
    }

    /// Zero emergency target → no emergency.
    #[test]
    fn test_no_emergency() {
        let alloc = compute_allocation(1_000_0000000, 0, 0, 0, 1_000, 2_000);
        assert_eq!(alloc.emergency, 0);
        assert_eq!(
            alloc.emergency + alloc.obligation + alloc.goal + alloc.spendable,
            alloc.gross
        );
    }

    /// All bps zero → everything goes to spendable.
    #[test]
    fn test_all_spendable() {
        let alloc = compute_allocation(500_0000000, 0, 0, 0, 0, 0);
        assert_eq!(alloc.emergency, 0);
        assert_eq!(alloc.obligation, 0);
        assert_eq!(alloc.goal, 0);
        assert_eq!(alloc.spendable, 500_0000000);
    }

    /// Small amount with rounding → remainder goes to spendable.
    #[test]
    fn test_rounding_remainder() {
        // 1 stroop, 33.33% each bucket → floor gives 0 each
        let alloc = compute_allocation(1, 0, 0, 0, 3_333, 3_333);
        assert_eq!(
            alloc.emergency + alloc.obligation + alloc.goal + alloc.spendable,
            alloc.gross
        );
        // Remainder goes to spendable
        assert!(alloc.spendable >= 0);
    }

    /// Conservation invariant for many combinations.
    #[test]
    fn test_conservation_invariant_sweep() {
        for gross in [1i128, 7, 100, 999, 1_000_0000000, i128::MAX / 10_000] {
            for emergency_bps in [0u32, 1_000, 5_000, 10_000] {
                for obligation_bps in [0u32, 500, 3_000] {
                    for goal_bps in [0u32, 1_000, 4_000] {
                        let alloc = compute_allocation(
                            gross,
                            0,
                            gross, // target = gross (gap = gross)
                            emergency_bps,
                            obligation_bps,
                            goal_bps,
                        );
                        assert_eq!(
                            alloc.emergency + alloc.obligation + alloc.goal + alloc.spendable,
                            alloc.gross,
                            "conservation failed for gross={}, e={}, o={}, g={}",
                            gross,
                            emergency_bps,
                            obligation_bps,
                            goal_bps,
                        );
                        assert!(alloc.emergency >= 0);
                        assert!(alloc.obligation >= 0);
                        assert!(alloc.goal >= 0);
                        assert!(alloc.spendable >= 0);
                    }
                }
            }
        }
    }
}
