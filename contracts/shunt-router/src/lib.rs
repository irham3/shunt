//! ShuntRouter — programmable income-routing infrastructure for Stellar.
//!
//! One payment, one payer signature, atomic state-aware allocation.
//! User-controlled funds; backend cannot withdraw.
//!
//! Contract interface (PRD §9.3):
//! - `__constructor(admin, usdc, limits)` — deploy-time initialization
//! - `set_policy(owner, policy_input)` — create/update income policy
//! - `preview_route(recipient, amount)` → Allocation
//! - `route_payment(payer, recipient, amount, request_id, expected_policy_version)` → Allocation
//! - `withdraw_emergency(owner, amount, destination)`
//! - `request_obligation_withdrawal(owner, amount)` → withdrawal_id
//! - `cancel_obligation_withdrawal(owner, withdrawal_id)`
//! - `execute_obligation_withdrawal(owner, withdrawal_id, destination)`
//! - `claim_goal_lots(owner, lot_ids, destination)`
//! - `get_policy(owner)`, `get_balances(owner)`, `get_goal_lot(lot_id)`
//! - `is_request_processed(request_id)`, `get_config()`
//! - `pause()`, `unpause()`, `upgrade(new_wasm_hash)`
#![no_std]

mod errors;
mod events;
mod policy;
mod route;
mod storage;
mod types;
mod waterfall;
mod withdraw;

use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Vec};

use events::{ContractUpgraded, ProtocolPaused, ProtocolUnpaused};
use types::{Allocation, BucketBalances, Config, GoalLot, Limits, Policy, PolicyInput};

#[contract]
pub struct ShuntRouter;

#[contractimpl]
impl ShuntRouter {
    /// Deploy-time constructor — no front-run window (PRD §9.8).
    ///
    /// Called exactly once when the contract is deployed. Sets the admin,
    /// USDC token address, and protocol limits.
    pub fn __constructor(env: Env, admin: Address, usdc: Address, limits: Limits) {
        let config = Config {
            admin,
            usdc,
            paused: false,
            max_lock_seconds: limits.max_lock_seconds,
            max_cooldown_seconds: limits.max_cooldown_seconds,
            max_open_lots: limits.max_open_lots,
        };
        storage::set_config(&env, &config);
    }

    // -----------------------------------------------------------------------
    // Policy management
    // -----------------------------------------------------------------------

    /// Create or update income policy. Owner must authorize.
    pub fn set_policy(env: Env, owner: Address, input: PolicyInput) {
        policy::set_policy(&env, &owner, input);
    }

    /// Query a recipient's current policy.
    pub fn get_policy(env: Env, owner: Address) -> Option<Policy> {
        policy::get_policy(&env, &owner)
    }

    // -----------------------------------------------------------------------
    // Routing
    // -----------------------------------------------------------------------

    /// Preview allocation for a hypothetical payment (read-only).
    pub fn preview_route(env: Env, recipient: Address, amount: i128) -> Allocation {
        route::preview_route(&env, &recipient, amount)
    }

    /// Execute an atomic payment route. Payer must authorize.
    /// Recipient does NOT sign.
    pub fn route_payment(
        env: Env,
        payer: Address,
        recipient: Address,
        amount: i128,
        request_id: BytesN<32>,
        expected_policy_version: u32,
    ) -> Allocation {
        route::route_payment(
            &env,
            &payer,
            &recipient,
            amount,
            request_id,
            expected_policy_version,
        )
    }

    // -----------------------------------------------------------------------
    // Withdrawals
    // -----------------------------------------------------------------------

    /// Withdraw from emergency reserve (instant, works during pause).
    pub fn withdraw_emergency(env: Env, owner: Address, amount: i128, destination: Address) {
        withdraw::withdraw_emergency(&env, &owner, amount, &destination);
    }

    /// Request obligation withdrawal (starts cooldown).
    pub fn request_obligation_withdrawal(env: Env, owner: Address, amount: i128) -> u64 {
        withdraw::request_obligation_withdrawal(&env, &owner, amount)
    }

    /// Cancel pending obligation withdrawal.
    pub fn cancel_obligation_withdrawal(env: Env, owner: Address, withdrawal_id: u64) {
        withdraw::cancel_obligation_withdrawal(&env, &owner, withdrawal_id);
    }

    /// Execute obligation withdrawal after cooldown.
    pub fn execute_obligation_withdrawal(
        env: Env,
        owner: Address,
        withdrawal_id: u64,
        destination: Address,
    ) {
        withdraw::execute_obligation_withdrawal(&env, &owner, withdrawal_id, &destination);
    }

    /// Claim matured goal lots (batch).
    pub fn claim_goal_lots(env: Env, owner: Address, lot_ids: Vec<u64>, destination: Address) {
        withdraw::claim_goal_lots(&env, &owner, lot_ids, &destination);
    }

    // -----------------------------------------------------------------------
    // Queries
    // -----------------------------------------------------------------------

    /// Get bucket balances for a recipient.
    pub fn get_balances(env: Env, owner: Address) -> BucketBalances {
        storage::get_balances(&env, &owner)
    }

    /// Get a specific goal lot by ID.
    pub fn get_goal_lot(env: Env, lot_id: u64) -> Option<GoalLot> {
        storage::get_goal_lot(&env, lot_id)
    }

    /// Check if a request ID has been processed.
    pub fn is_request_processed(env: Env, request_id: BytesN<32>) -> bool {
        storage::is_request_processed(&env, &request_id)
    }

    /// Get global protocol configuration.
    pub fn get_config(env: Env) -> Config {
        storage::get_config(&env)
    }

    // -----------------------------------------------------------------------
    // Admin operations (PRD §9.6–9.7)
    // -----------------------------------------------------------------------

    /// Pause the protocol. Stops new routes but NOT withdrawals.
    pub fn pause(env: Env) {
        let mut config = storage::get_config(&env);
        config.admin.require_auth();
        config.paused = true;
        storage::set_config(&env, &config);

        ProtocolPaused {
            admin: config.admin,
        }
        .publish(&env);
    }

    /// Unpause the protocol. Resumes routing.
    pub fn unpause(env: Env) {
        let mut config = storage::get_config(&env);
        config.admin.require_auth();
        config.paused = false;
        storage::set_config(&env, &config);

        ProtocolUnpaused {
            admin: config.admin,
        }
        .publish(&env);
    }

    /// Upgrade the contract WASM. Admin-only.
    /// Does NOT give admin power over user funds (PRD §9.7).
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let config = storage::get_config(&env);
        config.admin.require_auth();

        env.deployer().update_current_contract_wasm(new_wasm_hash.clone());

        ContractUpgraded {
            admin: config.admin,
            new_wasm_hash,
        }
        .publish(&env);
    }
}

#[cfg(test)]
mod test;
