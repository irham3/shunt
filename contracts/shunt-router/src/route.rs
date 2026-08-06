//! Payment routing: preview and execute (PRD §9.3–9.4).
//!
//! `route_payment` is the core function: a payer calls it with USDC
//! authorization, and the contract atomically splits the payment according
//! to the recipient's policy. No second signature from the recipient.

use soroban_sdk::{panic_with_error, token, Address, BytesN, Env};

use crate::errors::Error;
use crate::events::{GoalLotCreated, IncomeRouted};
use crate::storage;
use crate::types::{Allocation, GoalLot};
use crate::waterfall::compute_allocation;

/// Preview the allocation for a hypothetical payment.
/// Read-only — no state changes, no authorization required.
pub fn preview_route(env: &Env, recipient: &Address, amount: i128) -> Allocation {
    if amount <= 0 {
        panic_with_error!(env, Error::AmountNotPositive);
    }

    let policy = storage::get_policy(env, recipient)
        .unwrap_or_else(|| panic_with_error!(env, Error::PolicyNotFound));

    if !policy.active {
        panic_with_error!(env, Error::PolicyNotActive);
    }

    let balances = storage::get_balances(env, recipient);

    compute_allocation(
        amount,
        balances.emergency,
        policy.emergency_target,
        policy.emergency_topup_bps,
        policy.obligation_bps,
        policy.goal_bps,
    )
}

/// Execute a payment route atomically (PRD §9.4).
///
/// # Execution order (checks/effects/interactions):
/// 1. Verify protocol not paused.
/// 2. Validate amount, recipient, request, and expected policy version.
/// 3. Mark request as processed (replay protection).
/// 4. Compute allocation.
/// 5. Require payer authorization (via token transfer).
/// 6. Transfer gross USDC from payer to router.
/// 7. Update internal liabilities.
/// 8. Transfer spendable to spend destination.
/// 9. Create goal lot if goal > 0.
/// 10. Emit canonical events.
/// 11. Return allocation.
pub fn route_payment(
    env: &Env,
    payer: &Address,
    recipient: &Address,
    amount: i128,
    request_id: BytesN<32>,
    expected_policy_version: u32,
) -> Allocation {
    // 1. Check pause
    let config = storage::get_config(env);
    if config.paused {
        panic_with_error!(env, Error::ProtocolPaused);
    }

    // 2. Validate
    if amount <= 0 {
        panic_with_error!(env, Error::AmountNotPositive);
    }

    let policy = storage::get_policy(env, recipient)
        .unwrap_or_else(|| panic_with_error!(env, Error::PolicyNotFound));

    if !policy.active {
        panic_with_error!(env, Error::PolicyNotActive);
    }

    if policy.version != expected_policy_version {
        panic_with_error!(env, Error::PolicyVersionMismatch);
    }

    // 3. Replay protection
    if storage::is_request_processed(env, &request_id) {
        panic_with_error!(env, Error::RequestAlreadyProcessed);
    }
    storage::mark_request_processed(env, &request_id);

    // 4. Compute allocation
    let balances = storage::get_balances(env, recipient);
    let alloc = compute_allocation(
        amount,
        balances.emergency,
        policy.emergency_target,
        policy.emergency_topup_bps,
        policy.obligation_bps,
        policy.goal_bps,
    );

    // 5–6. Payer authorization + transfer gross USDC to this contract
    payer.require_auth();
    let usdc = token::Client::new(env, &config.usdc);
    let contract_addr = env.current_contract_address();
    usdc.transfer(payer, &contract_addr, &amount);

    // 7. Update liabilities
    let mut new_balances = balances;
    new_balances.emergency += alloc.emergency;
    new_balances.obligation += alloc.obligation;
    new_balances.goal_total += alloc.goal;
    storage::set_balances(env, recipient, &new_balances);

    // 8. Transfer spendable to spend destination
    if alloc.spendable > 0 {
        usdc.transfer(&contract_addr, &policy.spend_destination, &alloc.spendable);
    }

    // 9. Create goal lot if goal > 0
    if alloc.goal > 0 {
        let open_lots = storage::get_open_lot_count(env, recipient);
        if open_lots >= config.max_open_lots {
            panic_with_error!(env, Error::TooManyOpenLots);
        }

        let lot_id = storage::next_lot_id(env);
        let now = env.ledger().timestamp();
        let unlock_at = now + policy.goal_lock_seconds;

        let lot = GoalLot {
            owner: recipient.clone(),
            amount: alloc.goal,
            created_at: now,
            unlock_at,
            claimed: false,
        };
        storage::set_goal_lot(env, lot_id, &lot);
        storage::set_open_lot_count(env, recipient, open_lots + 1);

        GoalLotCreated {
            owner: recipient.clone(),
            lot_id,
            amount: alloc.goal,
            unlock_at,
        }
        .publish(env);
    }

    // 10. Emit income routed event
    IncomeRouted {
        request_id,
        payer: payer.clone(),
        recipient: recipient.clone(),
        asset: config.usdc,
        gross: alloc.gross,
        emergency: alloc.emergency,
        obligation: alloc.obligation,
        goal: alloc.goal,
        spendable: alloc.spendable,
        policy_version: policy.version,
    }
    .publish(env);

    // 11. Return
    alloc
}
