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
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, BytesN, Env, String, Vec,
};

#[contractevent(topics = ["split"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SplitEvent {
    pub user: Address,
    pub amount: i128,
    pub needs: i128,
    pub savings: i128,
    pub buffer: i128,
    pub inflow_key: BytesN<32>,
}

#[contractevent(topics = ["deposit"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DepositEvent {
    pub user: Address,
    pub amount: i128,
}

#[contractevent(topics = ["withdraw"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WithdrawEvent {
    pub user: Address,
    pub amount: i128,
    pub payout: i128,
    pub penalty: i128,
}

#[contractevent(topics = ["offramp"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OfframpEvent {
    pub user: Address,
    pub anchor: Address,
    pub amount: i128,
}

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
    GoalNotFound = 10,
    InsufficientUnallocated = 11,
    LabelTooLong = 12,
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
    /// Target wallet-side Buffer balance (7-decimal USDC). 0 = feature off.
    /// The contract can't read the caller's wallet-side Buffer balance on its
    /// own — Needs and Buffer are the same fungible USDC in the same wallet,
    /// split only in bookkeeping, never in custody. So `distribute`'s
    /// `buffer_topup` param carries the client-computed shortfall (from a
    /// real Horizon wallet-balance read) each call; this field is only the
    /// user's stored target, read back for that computation and shown in the
    /// UI. The *priority-then-split* arithmetic itself is enforced on-chain.
    pub buffer_target: i128,
}

/// A user-labeled sub-allocation of their aggregate Savings balance.
/// Purely a bookkeeping split of `Savings(Address)` — `amount` across all of
/// a user's goals must never exceed that aggregate; the difference is the
/// "unallocated" pool (`get_unallocated_savings`). No separate custody: a
/// goal's funds are the same USDC already held by the vault.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Goal {
    pub id: u32,
    pub label: String,
    pub amount: i128,
    pub created_at: u64,
    /// This goal's own unlock timestamp — independent of the aggregate
    /// `LockUntil(user)`, so goals can be laddered (e.g. a 1-month emergency
    /// fund and a 2-year Hajj fund coexist with different unlock dates).
    /// Unallocated savings still use the shared aggregate lock.
    pub unlock_at: u64,
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
    /// Goals(user) — this user's named sub-allocations of Savings.
    Goals(Address),
}

#[contract]
pub struct ShuntVault;

#[contractimpl]
impl ShuntVault {
    /// One-time init with the USDC SAC address. Idempotent: re-init reverts
    /// with `AlreadyInitialized`, so the token binding can never be changed
    /// after the fact.
    ///
    /// Hardening note (pre-mainnet): on a *fresh* deploy an attacker could
    /// front-run this call and bind a fake token before the deployer. The
    /// clean fix is a Soroban `#[contractimpl] __constructor` that binds the
    /// token atomically at deploy time (no front-run window). We keep `init`
    /// here because the live testnet instance is already initialized — the
    /// grief window is closed for it — and moving to a constructor requires a
    /// redeploy that would invalidate the published on-chain proof hashes.
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
        buffer_target: i128,
    ) {
        user.require_auth();
        if needs_bps + savings_bps + buffer_bps != BPS_DENOM as u32 {
            panic_with_error!(&env, Error::InvalidRules);
        }
        if buffer_target < 0 {
            panic_with_error!(&env, Error::InvalidRules);
        }
        let rules = Rules { needs_bps, savings_bps, buffer_bps, lock_secs, anchors, buffer_target };
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
        // Threshold auto-refill: the caller-computed Buffer shortfall this
        // cycle (from a real wallet-balance read against rules.buffer_target
        // — the contract itself can't see wallet-side Buffer balance, see
        // Rules.buffer_target doc). 0 when the feature is off or the target
        // is already met. Clamped to `amount`; prioritized ahead of the
        // normal bps split, which then applies to whatever's left.
        buffer_topup: i128,
    ) -> (i128, i128, i128) {
        user.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountNotPositive);
        }
        if buffer_topup < 0 {
            panic_with_error!(&env, Error::InvalidRules);
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

        // Threshold auto-refill takes priority off the top (capped at the
        // inflow); the normal bps split then applies only to what's left, so
        // Savings' share of THIS inflow shrinks accordingly — Buffer refill
        // never reaches into Savings, only reshuffles the wallet-side lanes.
        let buffer_priority = if buffer_topup > amount { amount } else { buffer_topup };
        let remaining = amount - buffer_priority;

        // Integer split; remainder (dust) goes to Needs, the wallet lane.
        let savings = remaining * rules.savings_bps as i128 / BPS_DENOM;
        let buffer = buffer_priority + remaining * rules.buffer_bps as i128 / BPS_DENOM;
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

        SplitEvent {
            user,
            amount,
            needs,
            savings,
            buffer,
            inflow_key,
        }.publish(&env);
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
        DepositEvent { user, amount }.publish(&env);
    }

    /// Withdraw from Savings. Before `lock_until`, a 10% penalty is deducted
    /// and credited to the user's in-vault Buffer credit (instant access).
    /// Returns the amount actually sent to the wallet.
    pub fn withdraw_savings(env: Env, user: Address, amount: i128) -> i128 {
        user.require_auth();
        let lock_until: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::LockUntil(user.clone()))
            .unwrap_or(0);
        let (payout, penalty) = Self::debit_savings(&env, &user, amount, lock_until);
        WithdrawEvent {
            user,
            amount,
            payout,
            penalty,
        }.publish(&env);
        payout
    }

    /// Create a new named sub-allocation of the user's aggregate Savings
    /// balance. `initial_amount` is drawn from the unallocated pool
    /// (`get_unallocated_savings`) — no funds move, this is bookkeeping
    /// only. `lock_secs` sets this goal's OWN unlock date (laddered,
    /// independent of the shared aggregate lock — 0 means unlocked
    /// immediately). Returns the new goal's id.
    pub fn create_savings_goal(
        env: Env,
        user: Address,
        label: String,
        initial_amount: i128,
        lock_secs: u64,
    ) -> u32 {
        user.require_auth();
        if initial_amount < 0 {
            panic_with_error!(&env, Error::AmountNotPositive);
        }
        if label.len() > 64 {
            panic_with_error!(&env, Error::LabelTooLong);
        }

        let goals_key = DataKey::Goals(user.clone());
        let mut goals: Vec<Goal> = env.storage().persistent().get(&goals_key).unwrap_or(Vec::new(&env));

        let total: i128 = env.storage().persistent().get(&DataKey::Savings(user.clone())).unwrap_or(0);
        let mut allocated: i128 = 0;
        let mut next_id: u32 = 0;
        for g in goals.iter() {
            allocated += g.amount;
            if g.id >= next_id {
                next_id = g.id + 1;
            }
        }
        if initial_amount > total - allocated {
            panic_with_error!(&env, Error::InsufficientUnallocated);
        }

        goals.push_back(Goal {
            id: next_id,
            label,
            amount: initial_amount,
            created_at: env.ledger().timestamp(),
            unlock_at: env.ledger().timestamp() + lock_secs,
        });
        env.storage().persistent().set(&goals_key, &goals);
        env.storage().persistent().extend_ttl(&goals_key, BUMP_THRESHOLD, BUMP_AMOUNT);
        next_id
    }

    /// Withdraw from a specific goal — same penalty/timelock rules as
    /// `withdraw_savings` (goals share the vault's one timelock), and also
    /// decrements the goal's own tracked amount. Returns the payout.
    pub fn withdraw_from_goal(env: Env, user: Address, goal_id: u32, amount: i128) -> i128 {
        user.require_auth();
        let goals_key = DataKey::Goals(user.clone());
        let mut goals: Vec<Goal> = env.storage().persistent().get(&goals_key).unwrap_or(Vec::new(&env));
        let idx = Self::find_goal_index(&env, &goals, goal_id);
        let mut goal = goals.get(idx).unwrap();
        if amount > goal.amount {
            panic_with_error!(&env, Error::InsufficientSavings);
        }

        // Goal-specific timelock (laddered) instead of the shared aggregate
        // lock — this is the whole point of a goal having its own unlock_at.
        let (payout, penalty) = Self::debit_savings(&env, &user, amount, goal.unlock_at);

        goal.amount -= amount;
        goals.set(idx, goal);
        env.storage().persistent().set(&goals_key, &goals);
        env.storage().persistent().extend_ttl(&goals_key, BUMP_THRESHOLD, BUMP_AMOUNT);

        WithdrawEvent {
            user,
            amount,
            payout,
            penalty,
        }.publish(&env);
        payout
    }

    /// Rename an existing goal. Purely cosmetic — no balance change.
    pub fn rename_savings_goal(env: Env, user: Address, goal_id: u32, new_label: String) {
        user.require_auth();
        if new_label.len() > 64 {
            panic_with_error!(&env, Error::LabelTooLong);
        }
        let goals_key = DataKey::Goals(user.clone());
        let mut goals: Vec<Goal> = env.storage().persistent().get(&goals_key).unwrap_or(Vec::new(&env));
        let idx = Self::find_goal_index(&env, &goals, goal_id);
        let mut goal = goals.get(idx).unwrap();
        goal.label = new_label;
        goals.set(idx, goal);
        env.storage().persistent().set(&goals_key, &goals);
    }

    /// Delete a goal. Its principal isn't moved — it simply becomes
    /// unallocated again, since unallocated is always
    /// `Savings(user) - sum(goal.amount for goal in goals)`.
    pub fn delete_savings_goal(env: Env, user: Address, goal_id: u32) {
        user.require_auth();
        let goals_key = DataKey::Goals(user.clone());
        let mut goals: Vec<Goal> = env.storage().persistent().get(&goals_key).unwrap_or(Vec::new(&env));
        let idx = Self::find_goal_index(&env, &goals, goal_id);
        goals.remove(idx);
        env.storage().persistent().set(&goals_key, &goals);
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
        OfframpEvent { user, anchor, amount }.publish(&env);
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

    pub fn get_savings_goals(env: Env, user: Address) -> Vec<Goal> {
        env.storage().persistent().get(&DataKey::Goals(user)).unwrap_or(Vec::new(&env))
    }

    /// Savings not currently assigned to any goal.
    pub fn get_unallocated_savings(env: Env, user: Address) -> i128 {
        let total: i128 = env.storage().persistent().get(&DataKey::Savings(user.clone())).unwrap_or(0);
        let goals: Vec<Goal> = env.storage().persistent().get(&DataKey::Goals(user)).unwrap_or(Vec::new(&env));
        let mut allocated: i128 = 0;
        for g in goals.iter() {
            allocated += g.amount;
        }
        total - allocated
    }

    // ---- Internals ----

    fn token(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    /// Shared debit + penalty + payout for withdraw_savings and
    /// withdraw_from_goal — decrements the aggregate Savings(user) balance,
    /// applies the early-withdrawal penalty to Buffer credit if still locked
    /// as of `lock_until` (the caller's own aggregate lock, or a specific
    /// goal's laddered `unlock_at`), and pays out the net amount. Caller
    /// handles require_auth() and any goal-specific bookkeeping.
    fn debit_savings(env: &Env, user: &Address, amount: i128, lock_until: u64) -> (i128, i128) {
        if amount <= 0 {
            panic_with_error!(env, Error::AmountNotPositive);
        }
        let bal_key = DataKey::Savings(user.clone());
        let balance: i128 = env.storage().persistent().get(&bal_key).unwrap_or(0);
        if amount > balance {
            panic_with_error!(env, Error::InsufficientSavings);
        }

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

        let token = Self::token(env);
        token::Client::new(env, &token).transfer(
            &env.current_contract_address(),
            user,
            &payout,
        );
        (payout, penalty)
    }

    fn find_goal_index(env: &Env, goals: &Vec<Goal>, goal_id: u32) -> u32 {
        for (i, g) in goals.iter().enumerate() {
            if g.id == goal_id {
                return i as u32;
            }
        }
        panic_with_error!(env, Error::GoalNotFound)
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
