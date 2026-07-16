#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{token::StellarAssetClient, vec, Address, BytesN, Env, String};

fn setup(env: &Env) -> (ShuntVaultClient<'_>, Address, Address, StellarAssetClient<'_>) {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_admin = StellarAssetClient::new(env, &sac.address());

    let contract_id = env.register(ShuntVault, ());
    let client = ShuntVaultClient::new(env, &contract_id);
    client.init(&sac.address());

    let user = Address::generate(env);
    (client, user, sac.address(), token_admin)
}

fn key(env: &Env, n: u8) -> BytesN<32> {
    BytesN::from_array(env, &[n; 32])
}

#[test]
fn split_60_25_15_exact() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &10_000_0000000); // 10,000 USDC (7 decimals)

    client.set_rules(&user, &6000, &2500, &1500, &86400, &vec![&env], &0);
    // 500 USDC inflow
    let (needs, savings, buffer) = client.distribute(&user, &500_0000000, &key(&env, 1), &0);
    assert_eq!(needs, 300_0000000);
    assert_eq!(savings, 125_0000000);
    assert_eq!(buffer, 75_0000000);
    assert_eq!(needs + savings + buffer, 500_0000000);
    assert_eq!(client.get_savings(&user), 125_0000000);
}

#[test]
fn dust_rounds_into_needs() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &10_000_0000000);

    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    // 7 stroops: 25% = 1.75 -> 1, 15% = 1.05 -> 1, needs gets 5 (dust absorbed)
    let (needs, savings, buffer) = client.distribute(&user, &7, &key(&env, 2), &0);
    assert_eq!(savings, 1);
    assert_eq!(buffer, 1);
    assert_eq!(needs, 5);
    assert_eq!(needs + savings + buffer, 7); // no dust lost, ever
}

#[test]
fn one_stroop_all_to_needs() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &10_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    let (needs, savings, buffer) = client.distribute(&user, &1, &key(&env, 3), &0);
    assert_eq!((needs, savings, buffer), (1, 0, 0));
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn no_double_split_same_inflow() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &10_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &100_0000000, &key(&env, 4), &0);
    client.distribute(&user, &100_0000000, &key(&env, 4), &0); // same tx hash -> panics
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn rules_must_total_100_percent() {
    let env = Env::default();
    let (client, user, _token, _admin) = setup(&env);
    client.set_rules(&user, &6000, &2500, &1000, &0, &vec![&env], &0); // 95%
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn rules_reject_negative_buffer_target() {
    let env = Env::default();
    let (client, user, _token, _admin) = setup(&env);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &-1);
}

#[test]
fn withdraw_after_timelock_no_penalty() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &1000, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 5), &0); // savings = 100 USDC

    env.ledger().with_mut(|l| l.timestamp += 2000); // past lock
    let payout = client.withdraw_savings(&user, &100_0000000);
    assert_eq!(payout, 100_0000000);
    assert_eq!(client.get_savings(&user), 0);
    assert_eq!(client.get_buffer_credit(&user), 0);
}

#[test]
fn early_withdraw_penalty_goes_to_buffer_credit() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &86400, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 6), &0); // savings = 100 USDC

    // still locked
    let payout = client.withdraw_savings(&user, &100_0000000);
    assert_eq!(payout, 90_0000000); // 10% penalty
    assert_eq!(client.get_buffer_credit(&user), 10_0000000);

    // buffer credit is instantly withdrawable
    client.withdraw_buffer(&user, &10_0000000);
    assert_eq!(client.get_buffer_credit(&user), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn cannot_overdraw_savings() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 7), &0);
    client.withdraw_savings(&user, &200_0000000); // only 100 in vault
}

#[test]
fn offramp_enforces_anchor_allowlist() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    let anchor = Address::generate(&env);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env, anchor.clone()], &0);
    client.offramp(&user, &anchor, &50_0000000); // allowlisted: ok
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn offramp_rejects_unknown_anchor() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    let anchor = Address::generate(&env);
    let rogue = Address::generate(&env);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env, anchor], &0);
    client.offramp(&user, &rogue, &50_0000000);
}

#[test]
fn deposit_extends_lock_monotonically() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &1000, &vec![&env], &0);

    client.deposit(&user, &50_0000000);
    let lock1 = client.get_lock_until(&user);
    env.ledger().with_mut(|l| l.timestamp += 500);
    client.deposit(&user, &50_0000000);
    let lock2 = client.get_lock_until(&user);
    assert!(lock2 > lock1);
    assert_eq!(client.get_savings(&user), 100_0000000);
}

// ---- Threshold Buffer auto-refill ----

#[test]
fn buffer_topup_prioritized_before_bps_split() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    // 60/25/15 split with a buffer_target set (display/UI value only — the
    // priority amount itself is a caller-supplied param on distribute).
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &50_0000000);

    // 400 USDC inflow, caller says Buffer is short by 40 USDC this cycle.
    let (needs, savings, buffer) = client.distribute(&user, &400_0000000, &key(&env, 20), &40_0000000);
    // remaining after priority = 360; savings = 25% of 360 = 90; buffer = 40 (priority) + 15% of 360 (54) = 94
    assert_eq!(savings, 90_0000000);
    assert_eq!(buffer, 94_0000000);
    assert_eq!(needs, 400_0000000 - savings - buffer);
    assert_eq!(needs + savings + buffer, 400_0000000);
    assert_eq!(client.get_savings(&user), 90_0000000); // Savings share shrank, never touched by the refill itself
}

#[test]
fn buffer_topup_clamped_to_inflow_amount() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &1000_0000000);

    // Ask for a topup bigger than the whole inflow — clamped, not overpaid.
    let (needs, savings, buffer) = client.distribute(&user, &50_0000000, &key(&env, 21), &999_0000000);
    assert_eq!(buffer, 50_0000000);
    assert_eq!(savings, 0);
    assert_eq!(needs, 0);
    assert_eq!(needs + savings + buffer, 50_0000000);
}

#[test]
fn buffer_topup_zero_is_the_original_split() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    let (needs, savings, buffer) = client.distribute(&user, &400_0000000, &key(&env, 22), &0);
    assert_eq!((needs, savings, buffer), (240_0000000, 100_0000000, 60_0000000));
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn distribute_rejects_negative_buffer_topup() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 23), &-1);
}

// ---- Savings goals ----

#[test]
fn create_goal_within_unallocated_ok() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 10), &0); // savings = 100 USDC

    let label = String::from_str(&env, "Emergency fund");
    let id = client.create_savings_goal(&user, &label, &60_0000000, &0);
    assert_eq!(id, 0);
    assert_eq!(client.get_unallocated_savings(&user), 40_0000000);
    let goals = client.get_savings_goals(&user);
    assert_eq!(goals.len(), 1);
    assert_eq!(goals.get(0).unwrap().amount, 60_0000000);
    assert_eq!(client.get_savings(&user), 100_0000000); // aggregate untouched
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn create_goal_rejects_over_unallocated() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 11), &0); // savings = 100 USDC

    let label = String::from_str(&env, "Too big");
    client.create_savings_goal(&user, &label, &200_0000000, &0); // only 100 available
}

#[test]
fn withdraw_from_goal_before_lock_applies_penalty() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    // Aggregate lock is short (would already be unlocked) — the goal's OWN
    // 86400s lock is what must gate the penalty here, proving the two are
    // independent.
    client.set_rules(&user, &6000, &2500, &1500, &1, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 12), &0); // savings = 100 USDC
    env.ledger().with_mut(|l| l.timestamp += 10); // aggregate LockUntil now in the past

    let label = String::from_str(&env, "Wedding");
    let id = client.create_savings_goal(&user, &label, &50_0000000, &86400); // laddered: locked 1 day from now

    let payout = client.withdraw_from_goal(&user, &id, &20_0000000); // still locked (goal-specific)
    assert_eq!(payout, 18_0000000); // 10% penalty
    assert_eq!(client.get_buffer_credit(&user), 2_0000000);
    assert_eq!(client.get_savings(&user), 80_0000000); // aggregate: 100 - 20
    let goals = client.get_savings_goals(&user);
    assert_eq!(goals.get(0).unwrap().amount, 30_0000000); // goal: 50 - 20
}

#[test]
fn withdraw_from_goal_after_lock_no_penalty() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &1000, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 13), &0); // savings = 100 USDC

    let label = String::from_str(&env, "Car");
    let id = client.create_savings_goal(&user, &label, &50_0000000, &1000);
    env.ledger().with_mut(|l| l.timestamp += 2000); // past this goal's own lock

    let payout = client.withdraw_from_goal(&user, &id, &50_0000000);
    assert_eq!(payout, 50_0000000);
    assert_eq!(client.get_savings_goals(&user).get(0).unwrap().amount, 0);
}

#[test]
fn goal_lock_secs_zero_is_withdrawable_immediately() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    // Aggregate lock IS active (would apply a penalty via withdraw_savings)...
    client.set_rules(&user, &6000, &2500, &1500, &86400, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 24), &0); // savings = 100 USDC

    // ...but a goal created with lock_secs=0 is its own, separately unlocked
    // sub-vault: no penalty, proving goal locks are independent of the
    // aggregate one in both directions.
    let label = String::from_str(&env, "Flexible");
    let id = client.create_savings_goal(&user, &label, &30_0000000, &0);
    let payout = client.withdraw_from_goal(&user, &id, &30_0000000);
    assert_eq!(payout, 30_0000000); // no penalty
    assert_eq!(client.get_buffer_credit(&user), 0);
}

#[test]
fn laddered_goals_unlock_independently() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &1_000_0000000, &key(&env, 25), &0); // savings = 250 USDC

    // Two goals, two very different ladder rungs.
    let short_id = client.create_savings_goal(&user, &String::from_str(&env, "Emergency"), &100_0000000, &2_592_000); // ~30 days
    let long_id = client.create_savings_goal(&user, &String::from_str(&env, "Hajj"), &100_0000000, &63_072_000); // ~2 years

    env.ledger().with_mut(|l| l.timestamp += 2_600_000); // past the 30-day rung, nowhere near the 2-year one

    // Short-ladder goal: unlocked, no penalty.
    let payout_short = client.withdraw_from_goal(&user, &short_id, &50_0000000);
    assert_eq!(payout_short, 50_0000000);

    // Long-ladder goal: still locked, penalty applies — independently of the
    // sibling goal that just paid out with none.
    let payout_long = client.withdraw_from_goal(&user, &long_id, &50_0000000);
    assert_eq!(payout_long, 45_0000000);
}

#[test]
fn delete_goal_releases_to_unallocated() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 14), &0); // savings = 100 USDC

    let label = String::from_str(&env, "Temp goal");
    let id = client.create_savings_goal(&user, &label, &70_0000000, &0);
    assert_eq!(client.get_unallocated_savings(&user), 30_0000000);

    client.delete_savings_goal(&user, &id);
    assert_eq!(client.get_unallocated_savings(&user), 100_0000000);
    assert_eq!(client.get_savings_goals(&user).len(), 0);
    assert_eq!(client.get_savings(&user), 100_0000000); // aggregate untouched by delete
}

#[test]
fn rename_goal_updates_label_only() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 15), &0);

    let id = client.create_savings_goal(&user, &String::from_str(&env, "Old name"), &50_0000000, &0);
    client.rename_savings_goal(&user, &id, &String::from_str(&env, "New name"));

    let goals = client.get_savings_goals(&user);
    assert_eq!(goals.get(0).unwrap().label, String::from_str(&env, "New name"));
    assert_eq!(goals.get(0).unwrap().amount, 50_0000000); // untouched
}

#[test]
fn multiple_goals_unallocated_arithmetic() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 16), &0); // savings = 100 USDC

    client.create_savings_goal(&user, &String::from_str(&env, "A"), &30_0000000, &0);
    client.create_savings_goal(&user, &String::from_str(&env, "B"), &40_0000000, &0);
    assert_eq!(client.get_unallocated_savings(&user), 30_0000000);
    assert_eq!(client.get_savings_goals(&user).len(), 2);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn withdraw_from_goal_rejects_unknown_id() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 17), &0);
    client.withdraw_from_goal(&user, &999, &1_0000000); // no such goal
}
