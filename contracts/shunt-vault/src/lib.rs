//! ShuntVault — auto-split engine for incoming USDC on Stellar (Soroban).
//!
//! Two-tier custody model (PRD §8):
//! - Needs + Buffer lanes stay in the user's wallet (never touch this contract).
//! - Savings lane is transferred into this contract so the timelock is
//!   enforceable by code. Only the owning user can withdraw.
//!
//! Early withdrawal penalty (10% = 1000 bps, DESIGN.md §5.3 decision) is
//! redirected to the user's Buffer: the penalty portion stays in the vault as
//! an instantly-withdrawable buffer credit, so the separation is real
//! on-chain, not just app-side accounting.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, token,
    Address, BytesN, Env, Vec,
};

/// 100% in basis points.
pub const BPS_DENOM: i128 = 10_000;
/// Early-withdrawal penalty: 10% of the withdrawn amount, credited to Buffer.
pub const PENALTY_BPS: i128 = 1_000;
/// TTL bookkeeping: extend persistent entries roughly monthly.
const BUMP_AMOUNT: u32 = 518_400; // ~30 days of ledgers
const BUMP_THRESHOLD: u32 = 259_200;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    RulesNotSet = 3,
    InvalidRules = 4,
    AmountNotPositive = 5,
    AlreadyProcessed = 6,
    InsufficientSavings = 7,
    InsufficientBuffer = 8,
    AnchorNotAllowlisted = 9,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Rules {
    /// Basis points per lane; must sum to exactly 10_000.
    pub needs_bps: u32,
    pub savings_bps: u32,
    pub buffer_bps: u32,
    /// Savings timelock duration in seconds, applied from each deposit.
    pub lock_secs: u64,
    /// Allowlisted anchor addresses permitted to receive off-ramp USDC
    /// (PRD §12: we lock the anchor address, not the bank account).
    pub anchors: Vec<Address>,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// USDC SAC token address.
    Token,
    /// Rules(user)
    Rules(Address),
    /// Savings vault balance per user (7-decimal stroops of USDC).
    Savings(Address),
    /// Unix time until which Savings is locked, per user.
    LockUntil(Address),
    /// Buffer credit held in the vault (early-withdrawal penalties), per user.
    BufferCredit(Address),
    /// Idempotency guard keyed by inflow tx hash (keeper supplies it).
    Processed(BytesN<32>),
}

#[contract]
pub struct ShuntVault;

#[contractimpl]
impl ShuntVault {
    /// One-time init with the USDC SAC address.
    pub fn init(env: Env, token: Address) {
        if env.storage().instance().has(&DataKey::Token) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Token, &token);
    }

    /// Store or replace the user's split rules. Percentages are in basis
    /// points and must total exactly 10_000 (100%). F3.
    pub fn set_rules(
        env: Env,
        user: Address,
        needs_bps: u32,
        savings_bps: u32,
        buffer_bps: u32,
        lock_secs: u64,
        anchors: Vec<Address>,
    ) {
        user.require_auth();
        if needs_bps + savings_bps + buffer_bps != BPS_DENOM as u32 {
            panic_with_error!(&env, Error::InvalidRules);
        }
        let rules = Rules { needs_bps, savings_bps, buffer_bps, lock_secs, anchors };
        let key = DataKey::Rules(user);
        env.storage().persistent().set(&key, &rules);
        env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
    }

    /// Split an inflow atomically. F4.
    ///
    /// Needs + Buffer never leave the user's wallet; only the Savings lane is
    /// pulled into the vault. Dust from integer division is rounded into the
    /// Needs lane (PRD §14), i.e. it simply stays in the wallet.
    ///
    /// `inflow_key` is the hash of the inflow transaction — the on-chain
    /// idempotency guard against double-splits (PRD §12).
    ///
    /// Returns (needs, savings, buffer) amounts.
    pub fn distribute(
        env: Env,
        user: Address,
        amount: i128,
        inflow_key: BytesN<32>,
    ) -> (i128, i128, i128) {
        user.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountNotPositive);
        }
        let processed_key = DataKey::Processed(inflow_key.clone());
        if env.storage().persistent().has(&processed_key) {
            panic_with_error!(&env, Error::AlreadyProcessed);
        }

        let rules: Rules = env
            .storage()
            .persistent()
            .get(&DataKey::Rules(user.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, Error::RulesNotSet));

        // Integer split; remainder (dust) goes to Needs, the wallet lane.
        let savings = amount * rules.savings_bps as i128 / BPS_DENOM;
        let buffer = amount * rules.buffer_bps as i128 / BPS_DENOM;
        let needs = amount - savings - buffer;

        if savings > 0 {
            let token = Self::token(&env);
            token::Client::new(&env, &token).transfer(
                &user,
                &env.current_contract_address(),
                &savings,
            );
            Self::credit_savings(&env, &user, savings, rules.lock_secs);
        }

        env.storage().persistent().set(&processed_key, &true);
        env.storage().persistent().extend_ttl(&processed_key, BUMP_THRESHOLD, BUMP_AMOUNT);

        env.events().publish(
            (symbol_short!("split"), user),
            (amount, needs, savings, buffer, inflow_key),
        );
        (needs, savings, buffer)
    }

    /// Voluntary extra deposit into the Savings vault. F5.
    pub fn deposit(env: Env, user: Address, amount: i128) {
        user.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountNotPositive);
        }
        let rules: Rules = env
            .storage()
            .persistent()
            .get(&DataKey::Rules(user.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, Error::RulesNotSet));
        let token = Self::token(&env);
        token::Client::new(&env, &token).transfer(
            &user,
            &env.current_contract_address(),
            &amount,
        );
        Self::credit_savings(&env, &user, amount, rules.lock_secs);
        env.events().publish((symbol_short!("deposit"), user), amount);
    }

    /// Withdraw from Savings. Before `lock_until`, a 10% penalty is deducted
    /// and credited to the user's in-vault Buffer credit (instant access).
    /// Returns the amount actually sent to the wallet.
    pub fn withdraw_savings(env: Env, user: Address, amount: i128) -> i128 {
        user.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountNotPositive);
        }
        let bal_key = DataKey::Savings(user.clone());
        let balance: i128 = env.storage().persistent().get(&bal_key).unwrap_or(0);
        if amount > balance {
            panic_with_error!(&env, Error::InsufficientSavings);
        }

        let lock_until: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::LockUntil(user.clone()))
            .unwrap_or(0);
        let now = env.ledger().timestamp();

        let penalty = if now < lock_until { amount * PENALTY_BPS / BPS_DENOM } else { 0 };
        let payout = amount - penalty;

        env.storage().persistent().set(&bal_key, &(balance - amount));
        if penalty > 0 {
            let credit_key = DataKey::BufferCredit(user.clone());
            let credit: i128 = env.storage().persistent().get(&credit_key).unwrap_or(0);
            env.storage().persistent().set(&credit_key, &(credit + penalty));
            env.storage().persistent().extend_ttl(&credit_key, BUMP_THRESHOLD, BUMP_AMOUNT);
        }

        let token = Self::token(&env);
        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &user,
            &payout,
        );
        env.events().publish(
            (symbol_short!("withdraw"), user),
            (amount, payout, penalty),
        );
        payout
    }

    /// Withdraw in-vault Buffer credit (accrued penalties). No timelock.
    pub fn withdraw_buffer(env: Env, user: Address, amount: i128) {
        user.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountNotPositive);
        }
        let key = DataKey::BufferCredit(user.clone());
        let credit: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if amount > credit {
            panic_with_error!(&env, Error::InsufficientBuffer);
        }
        env.storage().persistent().set(&key, &(credit - amount));
        let token = Self::token(&env);
        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &user,
            &amount,
        );
    }

    /// Off-ramp the given amount from the user's wallet to an allowlisted
    /// anchor address (F8 sketch). The contract enforces the anchor
    /// allowlist; KYC/bank details live in the anchor's hosted flow.
    pub fn offramp(env: Env, user: Address, anchor: Address, amount: i128) {
        user.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountNotPositive);
        }
        let rules: Rules = env
            .storage()
            .persistent()
            .get(&DataKey::Rules(user.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, Error::RulesNotSet));
        if !rules.anchors.contains(&anchor) {
            panic_with_error!(&env, Error::AnchorNotAllowlisted);
        }
        let token = Self::token(&env);
        token::Client::new(&env, &token).transfer(&user, &anchor, &amount);
        env.events().publish((symbol_short!("offramp"), user), (anchor, amount));
    }

    // ---- Views ----

    pub fn get_rules(env: Env, user: Address) -> Option<Rules> {
        env.storage().persistent().get(&DataKey::Rules(user))
    }

    pub fn get_savings(env: Env, user: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Savings(user)).unwrap_or(0)
    }

    pub fn get_lock_until(env: Env, user: Address) -> u64 {
        env.storage().persistent().get(&DataKey::LockUntil(user)).unwrap_or(0)
    }

    pub fn get_buffer_credit(env: Env, user: Address) -> i128 {
        env.storage().persistent().get(&DataKey::BufferCredit(user)).unwrap_or(0)
    }

    pub fn is_processed(env: Env, inflow_key: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Processed(inflow_key))
    }

    // ---- Internals ----

    fn token(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    fn credit_savings(env: &Env, user: &Address, amount: i128, lock_secs: u64) {
        let bal_key = DataKey::Savings(user.clone());
        let balance: i128 = env.storage().persistent().get(&bal_key).unwrap_or(0);
        env.storage().persistent().set(&bal_key, &(balance + amount));
        env.storage().persistent().extend_ttl(&bal_key, BUMP_THRESHOLD, BUMP_AMOUNT);

        let lock_key = DataKey::LockUntil(user.clone());
        let new_lock = env.ledger().timestamp() + lock_secs;
        let current: u64 = env.storage().persistent().get(&lock_key).unwrap_or(0);
        if new_lock > current {
            env.storage().persistent().set(&lock_key, &new_lock);
            env.storage().persistent().extend_ttl(&lock_key, BUMP_THRESHOLD, BUMP_AMOUNT);
        }
    }
}

#[cfg(test)]
mod test;
