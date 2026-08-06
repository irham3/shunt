//! Withdrawal operations for all three bucket types (PRD §7.4).
//!
//! - **Emergency**: instant withdrawal, no cooldown, no pause restriction.
//! - **Obligation**: request → cooldown → execute (cancelable during cooldown).
//! - **Goal lots**: claim individual matured lots.

use soroban_sdk::{panic_with_error, token, Address, Env, Vec};

use crate::errors::Error;
use crate::events::{
    EmergencyWithdrawn, GoalLotClaimed, ObligationWithdrawalCancelled,
    ObligationWithdrawalRequested, ObligationWithdrawn,
};
use crate::storage;
use crate::types::WithdrawalRequest;

// ---------------------------------------------------------------------------
// Emergency withdrawal (PRD §7.4: "dapat ditarik kapan saja oleh owner")
// ---------------------------------------------------------------------------

/// Withdraw from emergency reserve. Instant, no cooldown.
/// Works even when protocol is paused (PRD §9.6).
pub fn withdraw_emergency(env: &Env, owner: &Address, amount: i128, destination: &Address) {
    owner.require_auth();

    if amount <= 0 {
        panic_with_error!(env, Error::AmountNotPositive);
    }

    let mut balances = storage::get_balances(env, owner);
    if amount > balances.emergency {
        panic_with_error!(env, Error::InsufficientEmergency);
    }

    // Effects
    balances.emergency -= amount;
    storage::set_balances(env, owner, &balances);

    // Interaction: transfer USDC
    let config = storage::get_config(env);
    let usdc = token::Client::new(env, &config.usdc);
    usdc.transfer(&env.current_contract_address(), destination, &amount);

    // Event
    EmergencyWithdrawn {
        owner: owner.clone(),
        amount,
        destination: destination.clone(),
    }
    .publish(env);
}

// ---------------------------------------------------------------------------
// Obligation withdrawal (PRD §7.4: cooldown-gated)
// ---------------------------------------------------------------------------

/// Request an obligation withdrawal. Starts cooldown timer.
pub fn request_obligation_withdrawal(env: &Env, owner: &Address, amount: i128) -> u64 {
    owner.require_auth();

    if amount <= 0 {
        panic_with_error!(env, Error::AmountNotPositive);
    }

    let balances = storage::get_balances(env, owner);
    if amount > balances.obligation {
        panic_with_error!(env, Error::InsufficientObligation);
    }

    let policy = storage::get_policy(env, owner)
        .unwrap_or_else(|| panic_with_error!(env, Error::PolicyNotFound));

    let now = env.ledger().timestamp();
    let execute_after = now + policy.obligation_cooldown_seconds;

    let withdrawal_id = storage::next_withdrawal_id(env);
    let req = WithdrawalRequest {
        owner: owner.clone(),
        amount,
        created_at: now,
        execute_after,
    };
    storage::set_withdrawal_req(env, withdrawal_id, &req);

    // Event
    ObligationWithdrawalRequested {
        owner: owner.clone(),
        withdrawal_id,
        amount,
        execute_after,
    }
    .publish(env);

    withdrawal_id
}

/// Cancel a pending obligation withdrawal during cooldown.
pub fn cancel_obligation_withdrawal(env: &Env, owner: &Address, withdrawal_id: u64) {
    owner.require_auth();

    let req = storage::get_withdrawal_req(env, withdrawal_id)
        .unwrap_or_else(|| panic_with_error!(env, Error::WithdrawalNotFound));

    if req.owner != *owner {
        panic_with_error!(env, Error::NotOwner);
    }

    storage::remove_withdrawal_req(env, withdrawal_id);

    ObligationWithdrawalCancelled {
        owner: owner.clone(),
        withdrawal_id,
    }
    .publish(env);
}

/// Execute an obligation withdrawal after cooldown has elapsed.
/// Works even when protocol is paused.
pub fn execute_obligation_withdrawal(
    env: &Env,
    owner: &Address,
    withdrawal_id: u64,
    destination: &Address,
) {
    owner.require_auth();

    let req = storage::get_withdrawal_req(env, withdrawal_id)
        .unwrap_or_else(|| panic_with_error!(env, Error::WithdrawalNotFound));

    if req.owner != *owner {
        panic_with_error!(env, Error::NotOwner);
    }

    let now = env.ledger().timestamp();
    if now < req.execute_after {
        panic_with_error!(env, Error::CooldownNotElapsed);
    }

    // Effects: deduct from obligation balance
    let mut balances = storage::get_balances(env, owner);
    if req.amount > balances.obligation {
        panic_with_error!(env, Error::InsufficientObligation);
    }
    balances.obligation -= req.amount;
    storage::set_balances(env, owner, &balances);

    // Clean up request
    storage::remove_withdrawal_req(env, withdrawal_id);

    // Interaction: transfer USDC
    let config = storage::get_config(env);
    let usdc = token::Client::new(env, &config.usdc);
    usdc.transfer(&env.current_contract_address(), destination, &req.amount);

    // Event
    ObligationWithdrawn {
        owner: owner.clone(),
        withdrawal_id,
        amount: req.amount,
        destination: destination.clone(),
    }
    .publish(env);
}

// ---------------------------------------------------------------------------
// Goal lot claim (PRD §7.4: per-lot maturity)
// ---------------------------------------------------------------------------

/// Claim one or more matured goal lots. Lots must belong to the owner
/// and be past their `unlock_at` timestamp.
pub fn claim_goal_lots(env: &Env, owner: &Address, lot_ids: Vec<u64>, destination: &Address) {
    owner.require_auth();

    let config = storage::get_config(env);
    let usdc = token::Client::new(env, &config.usdc);
    let contract_addr = env.current_contract_address();

    let mut total_claimed: i128 = 0;
    let now = env.ledger().timestamp();
    let mut lots_closed: u32 = 0;

    for lot_id in lot_ids.iter() {
        let mut lot = storage::get_goal_lot(env, lot_id)
            .unwrap_or_else(|| panic_with_error!(env, Error::GoalLotNotFound));

        if lot.owner != *owner {
            panic_with_error!(env, Error::NotOwner);
        }

        if lot.claimed {
            panic_with_error!(env, Error::GoalAlreadyClaimed);
        }

        if now < lot.unlock_at {
            panic_with_error!(env, Error::GoalNotMatured);
        }

        // Mark as claimed
        lot.claimed = true;
        storage::set_goal_lot(env, lot_id, &lot);
        total_claimed += lot.amount;
        lots_closed += 1;

        // Event per lot
        GoalLotClaimed {
            owner: owner.clone(),
            lot_id,
            amount: lot.amount,
            destination: destination.clone(),
        }
        .publish(env);
    }

    // Update aggregate balances
    if total_claimed > 0 {
        let mut balances = storage::get_balances(env, owner);
        balances.goal_total -= total_claimed;
        storage::set_balances(env, owner, &balances);

        // Update open lot count
        let current_count = storage::get_open_lot_count(env, owner);
        let new_count = if lots_closed > current_count {
            0
        } else {
            current_count - lots_closed
        };
        storage::set_open_lot_count(env, owner, new_count);

        // Transfer total claimed USDC
        usdc.transfer(&contract_addr, destination, &total_claimed);
    }
}
