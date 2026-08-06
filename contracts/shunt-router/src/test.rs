//! Comprehensive tests for ShuntRouter (PRD §17).
//!
//! Covers: constructor, policy CRUD, authorization, waterfall arithmetic,
//! routing, replay protection, policy version binding, all withdrawal flows,
//! pause behavior, and conservation invariants.

#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    vec, Address, BytesN, Env,
};

use crate::types::{Limits, PolicyInput};
use crate::ShuntRouter;
use crate::ShuntRouterClient;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

fn setup_env() -> (Env, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = env.register_stellar_asset_contract_v2(admin.clone()).address().clone();

    let limits = Limits {
        max_lock_seconds: 365 * 24 * 3600, // 1 year
        max_cooldown_seconds: 30 * 24 * 3600, // 30 days
        max_open_lots: 50,
    };

    let contract_id = env.register(ShuntRouter, (&admin, &usdc, &limits));

    (env, contract_id, admin, usdc)
}

fn default_policy_input(_env: &Env, spend_dest: &Address) -> PolicyInput {
    PolicyInput {
        spend_destination: spend_dest.clone(),
        emergency_target: 1_000_0000000, // 1000 USDC
        emergency_topup_bps: 3_000,      // 30%
        obligation_bps: 1_000,           // 10%
        obligation_cooldown_seconds: 86_400, // 1 day
        goal_bps: 2_000,                 // 20%
        goal_lock_seconds: 90 * 24 * 3600, // 90 days
    }
}

fn mint_usdc(env: &Env, usdc: &Address, _admin: &Address, to: &Address, amount: i128) {
    let usdc_client = soroban_sdk::token::StellarAssetClient::new(env, usdc);
    usdc_client.mint(to, &amount);
}

fn request_id(env: &Env, n: u8) -> BytesN<32> {
    let mut bytes = [0u8; 32];
    bytes[0] = n;
    BytesN::from_array(env, &bytes)
}

fn set_timestamp(env: &Env, ts: u64) {
    env.ledger().set(LedgerInfo {
        timestamp: ts,
        protocol_version: 26,
        sequence_number: env.ledger().sequence(),
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 100,
        min_persistent_entry_ttl: 100,
        max_entry_ttl: 10_000_000,
    });
}

// ===========================================================================
// Constructor tests (PRD §17.1)
// ===========================================================================

#[test]
fn test_constructor_initializes_config() {
    let (env, contract_id, admin, usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let config = client.get_config();
    assert_eq!(config.admin, admin);
    assert_eq!(config.usdc, usdc);
    assert!(!config.paused);
    assert_eq!(config.max_lock_seconds, 365 * 24 * 3600);
    assert_eq!(config.max_cooldown_seconds, 30 * 24 * 3600);
    assert_eq!(config.max_open_lots, 50);
}

// ===========================================================================
// Policy tests (PRD §17.1)
// ===========================================================================

#[test]
fn test_set_and_get_policy() {
    let (env, contract_id, _admin, _usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let spend_dest = Address::generate(&env);

    let input = default_policy_input(&env, &spend_dest);
    client.set_policy(&owner, &input);

    let policy = client.get_policy(&owner).unwrap();
    assert_eq!(policy.owner, owner);
    assert_eq!(policy.spend_destination, spend_dest);
    assert_eq!(policy.emergency_target, 1_000_0000000);
    assert_eq!(policy.emergency_topup_bps, 3_000);
    assert_eq!(policy.obligation_bps, 1_000);
    assert_eq!(policy.goal_bps, 2_000);
    assert_eq!(policy.version, 1);
    assert!(policy.active);
}

#[test]
fn test_policy_version_increments() {
    let (env, contract_id, _admin, _usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let spend_dest = Address::generate(&env);

    let input = default_policy_input(&env, &spend_dest);
    client.set_policy(&owner, &input);
    assert_eq!(client.get_policy(&owner).unwrap().version, 1);

    client.set_policy(&owner, &input);
    assert_eq!(client.get_policy(&owner).unwrap().version, 2);

    client.set_policy(&owner, &input);
    assert_eq!(client.get_policy(&owner).unwrap().version, 3);
}

#[test]
#[should_panic]
fn test_invalid_bps_rejected() {
    let (env, contract_id, _admin, _usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let spend_dest = Address::generate(&env);

    let input = PolicyInput {
        spend_destination: spend_dest,
        emergency_target: 0,
        emergency_topup_bps: 0,
        obligation_bps: 6_000, // 60%
        obligation_cooldown_seconds: 0,
        goal_bps: 5_000, // 50% → combined 110% > 100%
        goal_lock_seconds: 0,
    };
    client.set_policy(&owner, &input); // should panic
}

#[test]
#[should_panic]
fn test_lock_too_long_rejected() {
    let (env, contract_id, _admin, _usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let spend_dest = Address::generate(&env);

    let input = PolicyInput {
        spend_destination: spend_dest,
        emergency_target: 0,
        emergency_topup_bps: 0,
        obligation_bps: 0,
        obligation_cooldown_seconds: 0,
        goal_bps: 1_000,
        goal_lock_seconds: 366 * 24 * 3600, // > max 365 days
    };
    client.set_policy(&owner, &input); // should panic
}

#[test]
fn test_policy_not_found() {
    let (env, contract_id, _admin, _usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);
    let nobody = Address::generate(&env);
    assert!(client.get_policy(&nobody).is_none());
}

// ===========================================================================
// Route tests (PRD §17.1)
// ===========================================================================

#[test]
fn test_route_payment_basic() {
    let (env, contract_id, admin, usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let recipient = Address::generate(&env);
    let spend_dest = Address::generate(&env);
    let payer = Address::generate(&env);

    // Setup policy
    let input = default_policy_input(&env, &spend_dest);
    client.set_policy(&recipient, &input);

    // Mint USDC to payer
    mint_usdc(&env, &usdc, &admin, &payer, 1_000_0000000);

    // Route payment
    let rid = request_id(&env, 1);
    let alloc = client.route_payment(&payer, &recipient, &1_000_0000000, &rid, &1);

    // PRD §8.3 example allocation (emergency gap = 1000, target = 1000)
    assert_eq!(alloc.gross, 1_000_0000000);
    assert_eq!(alloc.emergency, 300_0000000); // 30% cap (gap=1000, cap=300)
    // After emergency = 700
    // Obligation = 700 × 10% = 70
    assert_eq!(alloc.obligation, 70_0000000);
    // After obligation = 630
    // Goal = 630 × 20% = 126
    assert_eq!(alloc.goal, 126_0000000);
    // Spendable = 1000 - 300 - 70 - 126 = 504
    assert_eq!(alloc.spendable, 504_0000000);

    // Conservation
    assert_eq!(
        alloc.emergency + alloc.obligation + alloc.goal + alloc.spendable,
        alloc.gross
    );

    // Check balances updated
    let balances = client.get_balances(&recipient);
    assert_eq!(balances.emergency, 300_0000000);
    assert_eq!(balances.obligation, 70_0000000);
    assert_eq!(balances.goal_total, 126_0000000);

    // Spendable should have been sent to spend_dest
    let usdc_client = soroban_sdk::token::Client::new(&env, &usdc);
    assert_eq!(usdc_client.balance(&spend_dest), 504_0000000);
}

#[test]
fn test_preview_matches_route() {
    let (env, contract_id, admin, usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let recipient = Address::generate(&env);
    let spend_dest = Address::generate(&env);
    let payer = Address::generate(&env);

    let input = default_policy_input(&env, &spend_dest);
    client.set_policy(&recipient, &input);
    mint_usdc(&env, &usdc, &admin, &payer, 500_0000000);

    // Preview
    let preview = client.preview_route(&recipient, &500_0000000);

    // Route
    let rid = request_id(&env, 1);
    let alloc = client.route_payment(&payer, &recipient, &500_0000000, &rid, &1);

    // Must match
    assert_eq!(preview.emergency, alloc.emergency);
    assert_eq!(preview.obligation, alloc.obligation);
    assert_eq!(preview.goal, alloc.goal);
    assert_eq!(preview.spendable, alloc.spendable);
}

#[test]
#[should_panic]
fn test_zero_amount_rejected() {
    let (env, contract_id, _admin, _usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let recipient = Address::generate(&env);
    let spend_dest = Address::generate(&env);
    let payer = Address::generate(&env);

    let input = default_policy_input(&env, &spend_dest);
    client.set_policy(&recipient, &input);

    let rid = request_id(&env, 1);
    client.route_payment(&payer, &recipient, &0, &rid, &1); // should panic
}

#[test]
#[should_panic]
fn test_duplicate_request_rejected() {
    let (env, contract_id, admin, usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let recipient = Address::generate(&env);
    let spend_dest = Address::generate(&env);
    let payer = Address::generate(&env);

    let input = default_policy_input(&env, &spend_dest);
    client.set_policy(&recipient, &input);
    mint_usdc(&env, &usdc, &admin, &payer, 2_000_0000000);

    let rid = request_id(&env, 1);
    client.route_payment(&payer, &recipient, &100_0000000, &rid, &1);
    client.route_payment(&payer, &recipient, &100_0000000, &rid, &1); // duplicate → panic
}

#[test]
#[should_panic]
fn test_policy_version_mismatch_rejected() {
    let (env, contract_id, admin, usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let recipient = Address::generate(&env);
    let spend_dest = Address::generate(&env);
    let payer = Address::generate(&env);

    let input = default_policy_input(&env, &spend_dest);
    client.set_policy(&recipient, &input); // version = 1

    mint_usdc(&env, &usdc, &admin, &payer, 1_000_0000000);

    let rid = request_id(&env, 1);
    // Expected version 99 doesn't match actual version 1
    client.route_payment(&payer, &recipient, &100_0000000, &rid, &99); // panic
}

#[test]
fn test_request_processed_flag() {
    let (env, contract_id, admin, usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let rid = request_id(&env, 42);
    assert!(!client.is_request_processed(&rid));

    let recipient = Address::generate(&env);
    let spend_dest = Address::generate(&env);
    let payer = Address::generate(&env);

    let input = default_policy_input(&env, &spend_dest);
    client.set_policy(&recipient, &input);
    mint_usdc(&env, &usdc, &admin, &payer, 100_0000000);

    client.route_payment(&payer, &recipient, &100_0000000, &rid, &1);
    assert!(client.is_request_processed(&rid));
}

// ===========================================================================
// Emergency withdrawal tests
// ===========================================================================

#[test]
fn test_emergency_withdrawal() {
    let (env, contract_id, admin, usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let recipient = Address::generate(&env);
    let spend_dest = Address::generate(&env);
    let payer = Address::generate(&env);
    let withdraw_dest = Address::generate(&env);

    let input = default_policy_input(&env, &spend_dest);
    client.set_policy(&recipient, &input);
    mint_usdc(&env, &usdc, &admin, &payer, 1_000_0000000);

    let rid = request_id(&env, 1);
    let alloc = client.route_payment(&payer, &recipient, &1_000_0000000, &rid, &1);

    // Withdraw half of emergency
    let half = alloc.emergency / 2;
    client.withdraw_emergency(&recipient, &half, &withdraw_dest);

    let balances = client.get_balances(&recipient);
    assert_eq!(balances.emergency, alloc.emergency - half);

    let usdc_client = soroban_sdk::token::Client::new(&env, &usdc);
    assert_eq!(usdc_client.balance(&withdraw_dest), half);
}

#[test]
#[should_panic]
fn test_emergency_insufficient() {
    let (env, contract_id, _admin, _usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let dest = Address::generate(&env);

    // No balance → withdrawal should fail
    client.withdraw_emergency(&owner, &100, &dest);
}

// ===========================================================================
// Obligation withdrawal tests
// ===========================================================================

#[test]
fn test_obligation_withdrawal_full_flow() {
    let (env, contract_id, admin, usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let recipient = Address::generate(&env);
    let spend_dest = Address::generate(&env);
    let payer = Address::generate(&env);
    let withdraw_dest = Address::generate(&env);

    let input = default_policy_input(&env, &spend_dest);
    client.set_policy(&recipient, &input);
    mint_usdc(&env, &usdc, &admin, &payer, 1_000_0000000);

    set_timestamp(&env, 1_000_000);

    let rid = request_id(&env, 1);
    let alloc = client.route_payment(&payer, &recipient, &1_000_0000000, &rid, &1);

    // Request withdrawal
    let wid = client.request_obligation_withdrawal(&recipient, &alloc.obligation);

    // Try to execute too early → should panic
    // (We'll test this separately)

    // Advance time past cooldown (1 day = 86400)
    set_timestamp(&env, 1_000_000 + 86_400 + 1);

    // Execute
    client.execute_obligation_withdrawal(&recipient, &wid, &withdraw_dest);

    let balances = client.get_balances(&recipient);
    assert_eq!(balances.obligation, 0);

    let usdc_client = soroban_sdk::token::Client::new(&env, &usdc);
    assert_eq!(usdc_client.balance(&withdraw_dest), alloc.obligation);
}

#[test]
#[should_panic]
fn test_obligation_cooldown_enforced() {
    let (env, contract_id, admin, usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let recipient = Address::generate(&env);
    let spend_dest = Address::generate(&env);
    let payer = Address::generate(&env);
    let withdraw_dest = Address::generate(&env);

    let input = default_policy_input(&env, &spend_dest);
    client.set_policy(&recipient, &input);
    mint_usdc(&env, &usdc, &admin, &payer, 1_000_0000000);

    set_timestamp(&env, 1_000_000);

    let rid = request_id(&env, 1);
    let alloc = client.route_payment(&payer, &recipient, &1_000_0000000, &rid, &1);

    let wid = client.request_obligation_withdrawal(&recipient, &alloc.obligation);

    // Don't advance time — cooldown not elapsed
    client.execute_obligation_withdrawal(&recipient, &wid, &withdraw_dest); // panic
}

#[test]
fn test_obligation_withdrawal_cancel() {
    let (env, contract_id, admin, usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let recipient = Address::generate(&env);
    let spend_dest = Address::generate(&env);
    let payer = Address::generate(&env);

    let input = default_policy_input(&env, &spend_dest);
    client.set_policy(&recipient, &input);
    mint_usdc(&env, &usdc, &admin, &payer, 1_000_0000000);

    set_timestamp(&env, 1_000_000);

    let rid = request_id(&env, 1);
    let alloc = client.route_payment(&payer, &recipient, &1_000_0000000, &rid, &1);

    let wid = client.request_obligation_withdrawal(&recipient, &alloc.obligation);

    // Cancel
    client.cancel_obligation_withdrawal(&recipient, &wid);

    // Balance unchanged
    let balances = client.get_balances(&recipient);
    assert_eq!(balances.obligation, alloc.obligation);
}

// ===========================================================================
// Goal lot tests
// ===========================================================================

#[test]
fn test_goal_lot_claim_after_maturity() {
    let (env, contract_id, admin, usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let recipient = Address::generate(&env);
    let spend_dest = Address::generate(&env);
    let payer = Address::generate(&env);
    let claim_dest = Address::generate(&env);

    let input = default_policy_input(&env, &spend_dest);
    client.set_policy(&recipient, &input);
    mint_usdc(&env, &usdc, &admin, &payer, 1_000_0000000);

    set_timestamp(&env, 1_000_000);

    let rid = request_id(&env, 1);
    let alloc = client.route_payment(&payer, &recipient, &1_000_0000000, &rid, &1);

    // Check goal lot was created
    let lot = client.get_goal_lot(&0).unwrap();
    assert_eq!(lot.owner, recipient);
    assert_eq!(lot.amount, alloc.goal);
    assert!(!lot.claimed);

    // Advance past lock (90 days)
    set_timestamp(&env, 1_000_000 + 90 * 24 * 3600 + 1);

    // Claim
    client.claim_goal_lots(&recipient, &vec![&env, 0], &claim_dest);

    // Verify claimed
    let lot_after = client.get_goal_lot(&0).unwrap();
    assert!(lot_after.claimed);

    let balances = client.get_balances(&recipient);
    assert_eq!(balances.goal_total, 0);

    let usdc_client = soroban_sdk::token::Client::new(&env, &usdc);
    assert_eq!(usdc_client.balance(&claim_dest), alloc.goal);
}

#[test]
#[should_panic]
fn test_goal_lot_claim_before_maturity() {
    let (env, contract_id, admin, usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let recipient = Address::generate(&env);
    let spend_dest = Address::generate(&env);
    let payer = Address::generate(&env);
    let claim_dest = Address::generate(&env);

    let input = default_policy_input(&env, &spend_dest);
    client.set_policy(&recipient, &input);
    mint_usdc(&env, &usdc, &admin, &payer, 1_000_0000000);

    set_timestamp(&env, 1_000_000);

    let rid = request_id(&env, 1);
    client.route_payment(&payer, &recipient, &1_000_0000000, &rid, &1);

    // Don't advance time — goal not matured
    client.claim_goal_lots(&recipient, &vec![&env, 0], &claim_dest); // panic
}

#[test]
#[should_panic]
fn test_goal_lot_double_claim() {
    let (env, contract_id, admin, usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let recipient = Address::generate(&env);
    let spend_dest = Address::generate(&env);
    let payer = Address::generate(&env);
    let claim_dest = Address::generate(&env);

    let input = default_policy_input(&env, &spend_dest);
    client.set_policy(&recipient, &input);
    mint_usdc(&env, &usdc, &admin, &payer, 1_000_0000000);

    set_timestamp(&env, 1_000_000);

    let rid = request_id(&env, 1);
    client.route_payment(&payer, &recipient, &1_000_0000000, &rid, &1);

    set_timestamp(&env, 1_000_000 + 90 * 24 * 3600 + 1);

    client.claim_goal_lots(&recipient, &vec![&env, 0], &claim_dest);
    client.claim_goal_lots(&recipient, &vec![&env, 0], &claim_dest); // double claim → panic
}

// ===========================================================================
// Pause tests (PRD §17.1)
// ===========================================================================

#[test]
#[should_panic]
fn test_pause_rejects_new_routes() {
    let (env, contract_id, admin, usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let recipient = Address::generate(&env);
    let spend_dest = Address::generate(&env);
    let payer = Address::generate(&env);

    let input = default_policy_input(&env, &spend_dest);
    client.set_policy(&recipient, &input);
    mint_usdc(&env, &usdc, &admin, &payer, 1_000_0000000);

    // Pause
    client.pause();

    let rid = request_id(&env, 1);
    client.route_payment(&payer, &recipient, &100_0000000, &rid, &1); // should panic
}

#[test]
fn test_pause_does_not_block_emergency_withdrawal() {
    let (env, contract_id, admin, usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let recipient = Address::generate(&env);
    let spend_dest = Address::generate(&env);
    let payer = Address::generate(&env);
    let withdraw_dest = Address::generate(&env);

    let input = default_policy_input(&env, &spend_dest);
    client.set_policy(&recipient, &input);
    mint_usdc(&env, &usdc, &admin, &payer, 1_000_0000000);

    let rid = request_id(&env, 1);
    let alloc = client.route_payment(&payer, &recipient, &1_000_0000000, &rid, &1);

    // Pause
    client.pause();

    // Emergency withdrawal should still work
    client.withdraw_emergency(&recipient, &alloc.emergency, &withdraw_dest);

    let usdc_client = soroban_sdk::token::Client::new(&env, &usdc);
    assert_eq!(usdc_client.balance(&withdraw_dest), alloc.emergency);
}

// ===========================================================================
// Emergency target progression
// ===========================================================================

#[test]
fn test_emergency_fills_over_multiple_payments() {
    let (env, contract_id, admin, usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let recipient = Address::generate(&env);
    let spend_dest = Address::generate(&env);
    let payer = Address::generate(&env);

    let input = default_policy_input(&env, &spend_dest);
    client.set_policy(&recipient, &input);

    // Fund payer generously
    mint_usdc(&env, &usdc, &admin, &payer, 10_000_0000000);

    // Payment 1: target=1000, balance=0, gap=1000
    let alloc1 = client.route_payment(
        &payer,
        &recipient,
        &500_0000000,
        &request_id(&env, 1),
        &1,
    );
    // Emergency cap = 500 × 30% = 150. Gap = 1000. → emergency = 150
    assert_eq!(alloc1.emergency, 150_0000000);

    let bal1 = client.get_balances(&recipient);
    assert_eq!(bal1.emergency, 150_0000000);

    // Payment 2: balance now 150, gap = 850
    let alloc2 = client.route_payment(
        &payer,
        &recipient,
        &500_0000000,
        &request_id(&env, 2),
        &1,
    );
    // Cap = 150 again. Gap = 850. → emergency = 150
    assert_eq!(alloc2.emergency, 150_0000000);

    let bal2 = client.get_balances(&recipient);
    assert_eq!(bal2.emergency, 300_0000000);

    // After enough payments, emergency should cap at target
    for i in 3..=20u8 {
        client.route_payment(
            &payer,
            &recipient,
            &500_0000000,
            &request_id(&env, i),
            &1,
        );
    }

    let final_bal = client.get_balances(&recipient);
    assert_eq!(final_bal.emergency, 1_000_0000000); // exactly at target
}

// ===========================================================================
// Multiple goal lots
// ===========================================================================

#[test]
fn test_multiple_goal_lots_created() {
    let (env, contract_id, admin, usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let recipient = Address::generate(&env);
    let spend_dest = Address::generate(&env);
    let payer = Address::generate(&env);

    // Policy with 0 emergency target to simplify
    let input = PolicyInput {
        spend_destination: spend_dest.clone(),
        emergency_target: 0,
        emergency_topup_bps: 0,
        obligation_bps: 0,
        obligation_cooldown_seconds: 0,
        goal_bps: 5_000, // 50%
        goal_lock_seconds: 3600,
    };
    client.set_policy(&recipient, &input);
    mint_usdc(&env, &usdc, &admin, &payer, 10_000_0000000);

    set_timestamp(&env, 1_000);

    // Three payments → three lots
    for i in 0..3u8 {
        client.route_payment(
            &payer,
            &recipient,
            &100_0000000,
            &request_id(&env, i),
            &1,
        );
    }

    // Verify three lots exist
    for i in 0..3u64 {
        let lot = client.get_goal_lot(&i).unwrap();
        assert_eq!(lot.amount, 50_0000000); // 50% of 100
        assert!(!lot.claimed);
    }

    let balances = client.get_balances(&recipient);
    assert_eq!(balances.goal_total, 150_0000000);
}

// ===========================================================================
// Allocation conservation invariant
// ===========================================================================

#[test]
fn test_allocation_always_conserves() {
    let (env, contract_id, _admin, _usdc) = setup_env();
    let client = ShuntRouterClient::new(&env, &contract_id);

    let recipient = Address::generate(&env);
    let spend_dest = Address::generate(&env);

    let input = default_policy_input(&env, &spend_dest);
    client.set_policy(&recipient, &input);

    for amount in [1i128, 7, 100, 9999, 1_000_0000000, 50_000_0000000] {
        let alloc = client.preview_route(&recipient, &amount);
        assert_eq!(
            alloc.emergency + alloc.obligation + alloc.goal + alloc.spendable,
            alloc.gross,
            "conservation failed for amount={}",
            amount,
        );
    }
}
