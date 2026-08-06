//! Core data types for the ShuntRouter contract (PRD §9.2).

use soroban_sdk::{contracttype, Address};

/// Global protocol configuration, set at construction time.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    /// Admin address (multisig on mainnet).
    pub admin: Address,
    /// USDC Stellar Asset Contract address.
    pub usdc: Address,
    /// Whether new routes are paused (withdrawals still allowed).
    pub paused: bool,
    /// Maximum allowed goal lock duration in seconds.
    pub max_lock_seconds: u64,
    /// Maximum allowed obligation cooldown in seconds.
    pub max_cooldown_seconds: u64,
    /// Maximum open (unclaimed) goal lots per user.
    pub max_open_lots: u32,
}

/// Protocol limits, passed to constructor.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Limits {
    pub max_lock_seconds: u64,
    pub max_cooldown_seconds: u64,
    pub max_open_lots: u32,
}

/// A recipient's income-routing policy (PRD §8.1).
///
/// Controls how incoming USDC is split across buckets.
/// Policy version increments on every update; payers bind to an expected
/// version to prevent stale-policy routing.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Policy {
    /// Policy owner (the income recipient).
    pub owner: Address,
    /// Where spendable USDC is sent (owner's wallet or a separate address).
    pub spend_destination: Address,
    /// Target emergency reserve in USDC stroops (7-decimal).
    /// Emergency allocation stops when balance reaches this target.
    pub emergency_target: i128,
    /// Max percentage of gross allocated to emergency, in basis points.
    pub emergency_topup_bps: u32,
    /// Percentage of post-emergency amount for obligation reserve, in bps.
    pub obligation_bps: u32,
    /// Cooldown seconds before obligation withdrawal can be executed.
    pub obligation_cooldown_seconds: u64,
    /// Percentage of post-obligation amount for goal savings, in bps.
    pub goal_bps: u32,
    /// Lock duration in seconds for each new goal lot.
    pub goal_lock_seconds: u64,
    /// Monotonically increasing policy version (starts at 1).
    pub version: u32,
    /// Whether this policy is active (can receive routes).
    pub active: bool,
}

/// Input parameters for creating/updating a policy.
/// Excludes `owner` (derived from caller) and `version` (auto-incremented).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PolicyInput {
    pub spend_destination: Address,
    pub emergency_target: i128,
    pub emergency_topup_bps: u32,
    pub obligation_bps: u32,
    pub obligation_cooldown_seconds: u64,
    pub goal_bps: u32,
    pub goal_lock_seconds: u64,
}

/// Aggregated bucket balances for a recipient (PRD §9.2).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BucketBalances {
    /// Emergency reserve balance (instantly withdrawable by owner).
    pub emergency: i128,
    /// Obligation reserve balance (cooldown-gated withdrawal).
    pub obligation: i128,
    /// Total across all unclaimed goal lots.
    pub goal_total: i128,
}

/// A single goal deposit lot with its own maturity date (PRD §9.2).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GoalLot {
    /// Lot owner (recipient).
    pub owner: Address,
    /// USDC amount in this lot (7-decimal stroops).
    pub amount: i128,
    /// Ledger timestamp when this lot was created.
    pub created_at: u64,
    /// Ledger timestamp after which this lot can be claimed.
    pub unlock_at: u64,
    /// Whether this lot has been claimed.
    pub claimed: bool,
}

/// Computed allocation breakdown returned by `route_payment` and
/// `preview_route` (PRD §9.2).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Allocation {
    /// Total payment amount.
    pub gross: i128,
    /// Amount routed to emergency reserve.
    pub emergency: i128,
    /// Amount routed to obligation reserve.
    pub obligation: i128,
    /// Amount routed to a new goal lot.
    pub goal: i128,
    /// Amount sent to spend destination.
    pub spendable: i128,
}

/// Pending obligation withdrawal request.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WithdrawalRequest {
    /// Request owner.
    pub owner: Address,
    /// Requested withdrawal amount.
    pub amount: i128,
    /// Ledger timestamp when request was created.
    pub created_at: u64,
    /// Ledger timestamp after which withdrawal can be executed.
    pub execute_after: u64,
}
