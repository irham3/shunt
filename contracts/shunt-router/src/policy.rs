//! Policy management: create, update, validate, query.

use soroban_sdk::{panic_with_error, Env};

use crate::errors::Error;
use crate::events::PolicyUpdated;
use crate::storage;
use crate::types::{Config, Policy, PolicyInput};

/// Maximum combined BPS for emergency + obligation + goal.
/// Must leave room for spendable (at least 1 bps effectively).
const MAX_COMBINED_BPS: u32 = 10_000;

/// Validate policy input against protocol limits.
fn validate_policy_input(env: &Env, input: &PolicyInput, config: &Config) {
    // Emergency target must be non-negative
    if input.emergency_target < 0 {
        panic_with_error!(env, Error::InvalidEmergencyTarget);
    }

    // Individual BPS must not exceed 10_000
    if input.emergency_topup_bps > MAX_COMBINED_BPS {
        panic_with_error!(env, Error::InvalidBps);
    }
    if input.obligation_bps > MAX_COMBINED_BPS {
        panic_with_error!(env, Error::InvalidBps);
    }
    if input.goal_bps > MAX_COMBINED_BPS {
        panic_with_error!(env, Error::InvalidBps);
    }

    // Combined BPS check: obligation + goal must not exceed 10_000.
    // (Emergency is capped separately by the gap, so it doesn't participate
    // in the "must leave room for spendable" check the same way — but the
    // post-emergency remainder is split by obligation + goal, which must
    // not exceed 100%.)
    if input.obligation_bps + input.goal_bps > MAX_COMBINED_BPS {
        panic_with_error!(env, Error::InvalidBps);
    }

    // Lock and cooldown within protocol limits
    if input.goal_lock_seconds > config.max_lock_seconds {
        panic_with_error!(env, Error::LockTooLong);
    }
    if input.obligation_cooldown_seconds > config.max_cooldown_seconds {
        panic_with_error!(env, Error::CooldownTooLong);
    }
}

/// Create or update a recipient's income policy.
///
/// - Owner must authorize this call.
/// - Policy version auto-increments.
/// - Only affects future payments.
pub fn set_policy(env: &Env, owner: &soroban_sdk::Address, input: PolicyInput) {
    owner.require_auth();

    let config = storage::get_config(env);
    validate_policy_input(env, &input, &config);

    // Get current version (0 if first policy)
    let current_version = storage::get_policy(env, owner)
        .map(|p| p.version)
        .unwrap_or(0);

    let new_version = current_version + 1;

    let policy = Policy {
        owner: owner.clone(),
        spend_destination: input.spend_destination,
        emergency_target: input.emergency_target,
        emergency_topup_bps: input.emergency_topup_bps,
        obligation_bps: input.obligation_bps,
        obligation_cooldown_seconds: input.obligation_cooldown_seconds,
        goal_bps: input.goal_bps,
        goal_lock_seconds: input.goal_lock_seconds,
        version: new_version,
        active: true,
    };

    storage::set_policy(env, owner, &policy);

    // Emit event
    PolicyUpdated {
        owner: owner.clone(),
        version: new_version,
        emergency_target: policy.emergency_target,
        emergency_topup_bps: policy.emergency_topup_bps,
        obligation_bps: policy.obligation_bps,
        goal_bps: policy.goal_bps,
    }
    .publish(env);
}

/// Query a recipient's current policy. Returns None if no policy exists.
pub fn get_policy(env: &Env, owner: &soroban_sdk::Address) -> Option<Policy> {
    storage::get_policy(env, owner)
}
