//! Contract events (PRD §9.5).
//!
//! Every state-changing operation emits a canonical event for indexer
//! consumption. Events are the source of truth for off-chain systems.

use soroban_sdk::{contractevent, Address, BytesN};

/// Emitted when a recipient creates or updates their income policy.
#[contractevent(topics = ["policy_updated"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PolicyUpdated {
    pub owner: Address,
    pub version: u32,
    pub emergency_target: i128,
    pub emergency_topup_bps: u32,
    pub obligation_bps: u32,
    pub goal_bps: u32,
}

/// Emitted when a payment is routed through the waterfall (PRD §9.5).
/// This is the primary event for receipt generation.
#[contractevent(topics = ["income_routed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IncomeRouted {
    pub request_id: BytesN<32>,
    pub payer: Address,
    pub recipient: Address,
    pub asset: Address,
    pub gross: i128,
    pub emergency: i128,
    pub obligation: i128,
    pub goal: i128,
    pub spendable: i128,
    pub policy_version: u32,
}

/// Emitted when the owner withdraws from emergency reserve.
#[contractevent(topics = ["emergency_withdrawn"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EmergencyWithdrawn {
    pub owner: Address,
    pub amount: i128,
    pub destination: Address,
}

/// Emitted when an obligation withdrawal request is created.
#[contractevent(topics = ["obligation_withdrawal_requested"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ObligationWithdrawalRequested {
    pub owner: Address,
    pub withdrawal_id: u64,
    pub amount: i128,
    pub execute_after: u64,
}

/// Emitted when a pending obligation withdrawal is cancelled.
#[contractevent(topics = ["obligation_withdrawal_cancelled"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ObligationWithdrawalCancelled {
    pub owner: Address,
    pub withdrawal_id: u64,
}

/// Emitted when an obligation withdrawal is executed after cooldown.
#[contractevent(topics = ["obligation_withdrawn"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ObligationWithdrawn {
    pub owner: Address,
    pub withdrawal_id: u64,
    pub amount: i128,
    pub destination: Address,
}

/// Emitted when a new goal lot is created during routing.
#[contractevent(topics = ["goal_lot_created"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GoalLotCreated {
    pub owner: Address,
    pub lot_id: u64,
    pub amount: i128,
    pub unlock_at: u64,
}

/// Emitted when matured goal lots are claimed.
#[contractevent(topics = ["goal_lot_claimed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GoalLotClaimed {
    pub owner: Address,
    pub lot_id: u64,
    pub amount: i128,
    pub destination: Address,
}

/// Emitted when admin pauses the protocol.
#[contractevent(topics = ["protocol_paused"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProtocolPaused {
    pub admin: Address,
}

/// Emitted when admin unpauses the protocol.
#[contractevent(topics = ["protocol_unpaused"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProtocolUnpaused {
    pub admin: Address,
}

/// Emitted when the contract WASM is upgraded.
#[contractevent(topics = ["contract_upgraded"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractUpgraded {
    pub admin: Address,
    pub new_wasm_hash: BytesN<32>,
}
