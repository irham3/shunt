//! Storage keys, TTL management, and low-level helpers.

use soroban_sdk::{contracttype, Address, BytesN, Env};

use crate::types::{BucketBalances, Config, GoalLot, Policy, WithdrawalRequest};

// ---------------------------------------------------------------------------
// TTL constants (same approach as v1)
// ---------------------------------------------------------------------------

/// Extend persistent entries roughly monthly (~30 days of ledgers).
pub const BUMP_AMOUNT: u32 = 518_400;
/// Bump threshold: extend when TTL drops below ~15 days.
pub const BUMP_THRESHOLD: u32 = 259_200;

// ---------------------------------------------------------------------------
// Storage key enum
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Global protocol configuration.
    Config,
    /// Policy for a recipient.
    Policy(Address),
    /// Bucket balances for a recipient.
    Balances(Address),
    /// Goal lot by lot ID.
    GoalLot(u64),
    /// Next goal lot ID counter.
    NextLotId,
    /// Count of open (unclaimed) lots per user.
    OpenLotCount(Address),
    /// Pending obligation withdrawal request.
    WithdrawalReq(u64),
    /// Next withdrawal request ID counter.
    NextWithdrawalId,
    /// Idempotency guard: request_id → processed.
    Processed(BytesN<32>),
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

pub fn get_config(env: &Env) -> Config {
    env.storage()
        .instance()
        .get(&DataKey::Config)
        .expect("contract not initialized")
}

pub fn set_config(env: &Env, config: &Config) {
    env.storage().instance().set(&DataKey::Config, config);
    env.storage()
        .instance()
        .extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
}

// ---------------------------------------------------------------------------
// Policy helpers
// ---------------------------------------------------------------------------

pub fn get_policy(env: &Env, owner: &Address) -> Option<Policy> {
    let key = DataKey::Policy(owner.clone());
    let result: Option<Policy> = env.storage().persistent().get(&key);
    if result.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
    }
    result
}

pub fn set_policy(env: &Env, owner: &Address, policy: &Policy) {
    let key = DataKey::Policy(owner.clone());
    env.storage().persistent().set(&key, policy);
    env.storage()
        .persistent()
        .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
}

// ---------------------------------------------------------------------------
// Balances helpers
// ---------------------------------------------------------------------------

pub fn get_balances(env: &Env, owner: &Address) -> BucketBalances {
    let key = DataKey::Balances(owner.clone());
    env.storage().persistent().get(&key).unwrap_or(BucketBalances {
        emergency: 0,
        obligation: 0,
        goal_total: 0,
    })
}

pub fn set_balances(env: &Env, owner: &Address, balances: &BucketBalances) {
    let key = DataKey::Balances(owner.clone());
    env.storage().persistent().set(&key, balances);
    env.storage()
        .persistent()
        .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
}

// ---------------------------------------------------------------------------
// Goal lot helpers
// ---------------------------------------------------------------------------

pub fn get_goal_lot(env: &Env, lot_id: u64) -> Option<GoalLot> {
    let key = DataKey::GoalLot(lot_id);
    let result: Option<GoalLot> = env.storage().persistent().get(&key);
    if result.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
    }
    result
}

pub fn set_goal_lot(env: &Env, lot_id: u64, lot: &GoalLot) {
    let key = DataKey::GoalLot(lot_id);
    env.storage().persistent().set(&key, lot);
    env.storage()
        .persistent()
        .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
}

pub fn next_lot_id(env: &Env) -> u64 {
    let key = DataKey::NextLotId;
    let id: u64 = env.storage().persistent().get(&key).unwrap_or(0);
    env.storage().persistent().set(&key, &(id + 1));
    env.storage()
        .persistent()
        .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
    id
}

pub fn get_open_lot_count(env: &Env, owner: &Address) -> u32 {
    let key = DataKey::OpenLotCount(owner.clone());
    env.storage().persistent().get(&key).unwrap_or(0)
}

pub fn set_open_lot_count(env: &Env, owner: &Address, count: u32) {
    let key = DataKey::OpenLotCount(owner.clone());
    env.storage().persistent().set(&key, &count);
    env.storage()
        .persistent()
        .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
}

// ---------------------------------------------------------------------------
// Withdrawal request helpers
// ---------------------------------------------------------------------------

pub fn get_withdrawal_req(env: &Env, id: u64) -> Option<WithdrawalRequest> {
    let key = DataKey::WithdrawalReq(id);
    let result: Option<WithdrawalRequest> = env.storage().persistent().get(&key);
    if result.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
    }
    result
}

pub fn set_withdrawal_req(env: &Env, id: u64, req: &WithdrawalRequest) {
    let key = DataKey::WithdrawalReq(id);
    env.storage().persistent().set(&key, req);
    env.storage()
        .persistent()
        .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
}

pub fn remove_withdrawal_req(env: &Env, id: u64) {
    let key = DataKey::WithdrawalReq(id);
    env.storage().persistent().remove(&key);
}

pub fn next_withdrawal_id(env: &Env) -> u64 {
    let key = DataKey::NextWithdrawalId;
    let id: u64 = env.storage().persistent().get(&key).unwrap_or(0);
    env.storage().persistent().set(&key, &(id + 1));
    env.storage()
        .persistent()
        .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
    id
}

// ---------------------------------------------------------------------------
// Replay protection
// ---------------------------------------------------------------------------

pub fn is_request_processed(env: &Env, request_id: &BytesN<32>) -> bool {
    let key = DataKey::Processed(request_id.clone());
    env.storage().persistent().has(&key)
}

pub fn mark_request_processed(env: &Env, request_id: &BytesN<32>) {
    let key = DataKey::Processed(request_id.clone());
    env.storage().persistent().set(&key, &true);
    env.storage()
        .persistent()
        .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
}
