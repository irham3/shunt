#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{
    token::{StellarAssetClient, TokenClient},
    vec, Address, BytesN, Env, String,
};

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
fn goal_lock_secs_zero_still_gated_by_aggregate_lock() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    // Aggregate lock IS active (86400s out).
    client.set_rules(&user, &6000, &2500, &1500, &86400, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 24), &0); // savings = 100 USDC

    // A zero-lock goal must NOT be a liquidity escape hatch: while the
    // aggregate Savings lock is active, withdrawing through a goal whose own
    // lock is 0 still incurs the early-exit penalty. A goal can only lock
    // longer than the aggregate, never shorter.
    let label = String::from_str(&env, "Flexible");
    let id = client.create_savings_goal(&user, &label, &30_0000000, &0);
    let payout = client.withdraw_from_goal(&user, &id, &30_0000000);
    assert_eq!(payout, 27_0000000); // 10% penalty applies via the aggregate lock
    assert_eq!(client.get_buffer_credit(&user), 3_0000000);
    assert_eq!(client.get_savings(&user), 70_0000000);
}

#[test]
fn goal_withdraw_free_only_when_aggregate_also_unlocked() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    // Aggregate lock is short (1s); a zero-lock goal is genuinely liquid only
    // because the aggregate lock has also passed.
    client.set_rules(&user, &6000, &2500, &1500, &1, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 26), &0); // savings = 100 USDC
    env.ledger().with_mut(|l| l.timestamp += 10); // aggregate lock now in the past

    let label = String::from_str(&env, "Flexible");
    let id = client.create_savings_goal(&user, &label, &30_0000000, &0);
    let payout = client.withdraw_from_goal(&user, &id, &30_0000000);
    assert_eq!(payout, 30_0000000); // no penalty: both locks passed
    assert_eq!(client.get_buffer_credit(&user), 0);
}

#[test]
fn zero_lock_goal_cannot_bypass_aggregate_timelock() {
    // Regression for the full attack: user with locked aggregate Savings tries
    // to drain it penalty-free by funneling everything through a lock_secs=0
    // goal and withdrawing immediately. The penalty must still apply.
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &86400, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 27), &0); // savings = 100 USDC, locked 1 day

    // Route the ENTIRE unallocated balance into a zero-lock goal...
    let id = client.create_savings_goal(&user, &String::from_str(&env, "Escape"), &100_0000000, &0);
    // ...and try to pull it all out at once, still inside the aggregate lock.
    let payout = client.withdraw_from_goal(&user, &id, &100_0000000);
    assert_eq!(payout, 90_0000000); // 10% penalty enforced, not bypassed
    assert_eq!(client.get_buffer_credit(&user), 10_0000000);
    assert_eq!(client.get_savings(&user), 0);
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

// ---- Authorization boundaries ----
// The setup helper turns on mock_all_auths so state can be seeded. Each attack
// test then switches to `mock_auths(&[])` — authorizing nobody — so the only
// thing that can make the call panic is the owner's `require_auth()`. That is
// the boundary: no signature other than the account owner's satisfies it.

#[test]
#[should_panic]
fn cannot_withdraw_another_users_savings() {
    let env = Env::default();
    let (client, victim, _token, admin) = setup(&env);
    admin.mint(&victim, &1_000_0000000);
    client.set_rules(&victim, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&victim, &400_0000000, &key(&env, 30), &0); // savings = 100 USDC

    let _attacker = Address::generate(&env); // has no authority over `victim`
    env.mock_auths(&[]); // nobody is authorized
    client.withdraw_savings(&victim, &100_0000000); // victim.require_auth() fails
}

#[test]
#[should_panic]
fn cannot_change_another_users_rules() {
    let env = Env::default();
    let (client, victim, _token, admin) = setup(&env);
    admin.mint(&victim, &1_000_0000000);
    client.set_rules(&victim, &6000, &2500, &1500, &86400, &vec![&env], &0);

    env.mock_auths(&[]);
    // Attempt to rewrite the victim's split (e.g. route everything to Needs).
    client.set_rules(&victim, &10000, &0, &0, &0, &vec![&env], &0);
}

#[test]
#[should_panic]
fn cannot_delete_another_users_goal() {
    let env = Env::default();
    let (client, victim, _token, admin) = setup(&env);
    admin.mint(&victim, &1_000_0000000);
    client.set_rules(&victim, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&victim, &400_0000000, &key(&env, 31), &0);
    let id = client.create_savings_goal(&victim, &String::from_str(&env, "Hajj"), &50_0000000, &0);

    env.mock_auths(&[]);
    client.delete_savings_goal(&victim, &id);
}

// ---- Initialization ----

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn init_cannot_be_reinitialized() {
    let env = Env::default();
    // setup() already calls init once with the real SAC.
    let (client, _user, _token, _admin) = setup(&env);
    let rogue_token = Address::generate(&env);
    client.init(&rogue_token); // re-binding the token must revert
}

// ---- Input validation ----

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn distribute_rejects_zero_amount() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &0, &key(&env, 32), &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn distribute_rejects_negative_amount() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &-100, &key(&env, 33), &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn deposit_rejects_zero_amount() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.deposit(&user, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn withdraw_savings_rejects_zero_amount() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 34), &0);
    client.withdraw_savings(&user, &0);
}

// ---- Solvency / conservation invariant ----
// The vault pools many users' Savings. The invariant that must never break:
//   token balance of contract  >=  sum(all users' Savings + all Buffer credits)
// Because Needs/Buffer normal lanes never enter the vault, this should hold
// with exact equality after any sequence of in-vault operations.

#[test]
fn vault_stays_solvent_across_users() {
    let env = Env::default();
    let (client, user_a, token, admin) = setup(&env);
    let user_b = Address::generate(&env);
    admin.mint(&user_a, &1_000_0000000);
    admin.mint(&user_b, &1_000_0000000);
    client.set_rules(&user_a, &6000, &2500, &1500, &86400, &vec![&env], &0);
    client.set_rules(&user_b, &6000, &2500, &1500, &86400, &vec![&env], &0);
    client.distribute(&user_a, &400_0000000, &key(&env, 35), &0); // a savings = 100
    client.distribute(&user_b, &800_0000000, &key(&env, 36), &0); // b savings = 200

    // A pulls out early: payout leaves the vault, penalty stays as buffer credit.
    client.withdraw_savings(&user_a, &40_0000000); // payout 36, penalty 4 credited

    let vault_balance = TokenClient::new(&env, &token).balance(&client.address);
    let liabilities = client.get_savings(&user_a)
        + client.get_savings(&user_b)
        + client.get_buffer_credit(&user_a)
        + client.get_buffer_credit(&user_b);
    assert!(vault_balance >= liabilities, "vault must cover all liabilities");
    assert_eq!(vault_balance, liabilities, "and with no unaccounted-for dust");
    // Concretely: 300 in − 36 out = 264; liabilities = 60 + 200 + 4 + 0 = 264.
    assert_eq!(vault_balance, 264_0000000);
}

/// Reusable invariant check: the vault's token balance must exactly cover the
/// sum of every user's Savings + Buffer credit, and no user's goal allocations
/// may exceed their aggregate Savings (unallocated >= 0).
fn assert_invariants(env: &Env, client: &ShuntVaultClient<'_>, token: &Address, users: &[&Address]) {
    let mut liabilities: i128 = 0;
    for u in users {
        assert!(
            client.get_unallocated_savings(*u) >= 0,
            "goal allocations must never exceed Savings"
        );
        liabilities += client.get_savings(*u) + client.get_buffer_credit(*u);
    }
    let vault = TokenClient::new(env, token).balance(&client.address);
    assert!(vault >= liabilities, "vault must be solvent");
    assert_eq!(vault, liabilities, "vault balance must equal total liabilities exactly");
}

// ---- A2: generic withdrawal cannot drain goal allocations ----

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn generic_withdraw_over_unallocated_reverts() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    // No aggregate lock, so this isolates the unallocated guard from the timelock.
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 40), &0); // savings = 100 USDC
    client.create_savings_goal(&user, &String::from_str(&env, "Locked away"), &80_0000000, &0);
    assert_eq!(client.get_unallocated_savings(&user), 20_0000000);

    // 21 > unallocated(20) but <= balance(100): the goal-drain attempt.
    client.withdraw_savings(&user, &21_0000000);
}

#[test]
fn generic_withdraw_up_to_unallocated_succeeds() {
    let env = Env::default();
    let (client, user, token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 41), &0); // savings = 100 USDC
    client.create_savings_goal(&user, &String::from_str(&env, "Locked away"), &80_0000000, &0);

    // Exactly the unallocated 20 USDC withdraws cleanly.
    let payout = client.withdraw_savings(&user, &20_0000000);
    assert_eq!(payout, 20_0000000);

    // Goal principal untouched; aggregate reduced only by the unallocated pull.
    assert_eq!(client.get_savings_goals(&user).get(0).unwrap().amount, 80_0000000);
    assert_eq!(client.get_savings(&user), 80_0000000);
    assert_eq!(client.get_unallocated_savings(&user), 0);
    assert_invariants(&env, &client, &token, &[&user]);
}

// ---- A3: zero-value goals are rejected ----

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn create_goal_rejects_zero_amount() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 42), &0);
    client.create_savings_goal(&user, &String::from_str(&env, "Empty"), &0, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn create_goal_rejects_negative_amount() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 43), &0);
    client.create_savings_goal(&user, &String::from_str(&env, "Negative"), &-1, &0);
}

#[test]
fn create_goal_accepts_positive_amount() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 44), &0);
    let id = client.create_savings_goal(&user, &String::from_str(&env, "Real"), &1, &0);
    assert_eq!(id, 0);
    assert_eq!(client.get_savings_goals(&user).get(0).unwrap().amount, 1);
}

// ---- A4: per-user goal cap ----

#[test]
#[should_panic(expected = "Error(Contract, #13)")]
fn goal_cap_rejects_twenty_first_goal() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 45), &0); // savings = 100 USDC

    // 20 goals of 1 USDC each = 20 USDC, well within the 100 available.
    for _ in 0..20u32 {
        client.create_savings_goal(&user, &String::from_str(&env, "g"), &1_0000000, &0);
    }
    assert_eq!(client.get_savings_goals(&user).len(), 20);

    // The 21st must revert.
    client.create_savings_goal(&user, &String::from_str(&env, "overflow"), &1_0000000, &0);
}

#[test]
fn deleting_a_goal_frees_a_cap_slot() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&user, &400_0000000, &key(&env, 46), &0);

    let mut first_id = 0u32;
    for i in 0..20u32 {
        let id = client.create_savings_goal(&user, &String::from_str(&env, "g"), &1_0000000, &0);
        if i == 0 {
            first_id = id;
        }
    }
    assert_eq!(client.get_savings_goals(&user).len(), 20);

    // Free one slot, then a new goal fits again.
    client.delete_savings_goal(&user, &first_id);
    assert_eq!(client.get_savings_goals(&user).len(), 19);
    client.create_savings_goal(&user, &String::from_str(&env, "refill"), &1_0000000, &0);
    assert_eq!(client.get_savings_goals(&user).len(), 20);
}

// ---- A5: invariants hold across a full lifecycle ----

#[test]
fn invariants_hold_across_full_lifecycle() {
    let env = Env::default();
    let (client, user_a, token, admin) = setup(&env);
    let user_b = Address::generate(&env);
    admin.mint(&user_a, &1_000_0000000);
    admin.mint(&user_b, &1_000_0000000);
    let users = [&user_a, &user_b];

    client.set_rules(&user_a, &6000, &2500, &1500, &86400, &vec![&env], &0);
    client.set_rules(&user_b, &6000, &2500, &1500, &86400, &vec![&env], &0);
    assert_invariants(&env, &client, &token, &users);

    // distribute (both users)
    client.distribute(&user_a, &400_0000000, &key(&env, 50), &0); // a savings = 100
    client.distribute(&user_b, &800_0000000, &key(&env, 51), &0); // b savings = 200
    assert_invariants(&env, &client, &token, &users);

    // goal creation
    let a_goal = client.create_savings_goal(&user_a, &String::from_str(&env, "A-goal"), &60_0000000, &0);
    let b_goal = client.create_savings_goal(&user_b, &String::from_str(&env, "B-goal"), &150_0000000, &86400);
    assert_invariants(&env, &client, &token, &users);

    // aggregate (unallocated) withdrawal by A — a is still locked, so penalty applies
    client.withdraw_savings(&user_a, &40_0000000); // a unallocated was 40
    assert_invariants(&env, &client, &token, &users);

    // early goal withdrawal by A (zero-lock goal, but aggregate lock active → penalty)
    client.withdraw_from_goal(&user_a, &a_goal, &10_0000000);
    assert_invariants(&env, &client, &token, &users);

    // buffer-credit withdrawal by A (penalties accrued above)
    let a_credit = client.get_buffer_credit(&user_a);
    if a_credit > 0 {
        client.withdraw_buffer(&user_a, &a_credit);
    }
    assert_invariants(&env, &client, &token, &users);

    // goal deletion by B (principal returns to unallocated, aggregate unchanged)
    client.delete_savings_goal(&user_b, &b_goal);
    assert_invariants(&env, &client, &token, &users);
}

// ---- A6: additional authorization boundaries ----

#[test]
#[should_panic]
fn cannot_withdraw_another_users_buffer_credit() {
    let env = Env::default();
    let (client, victim, _token, admin) = setup(&env);
    admin.mint(&victim, &1_000_0000000);
    client.set_rules(&victim, &6000, &2500, &1500, &86400, &vec![&env], &0);
    client.distribute(&victim, &400_0000000, &key(&env, 52), &0);
    client.withdraw_savings(&victim, &10_0000000); // accrue buffer credit (still locked)
    assert!(client.get_buffer_credit(&victim) > 0);

    env.mock_auths(&[]);
    client.withdraw_buffer(&victim, &1_0000000);
}

#[test]
#[should_panic]
fn cannot_withdraw_from_another_users_goal() {
    let env = Env::default();
    let (client, victim, _token, admin) = setup(&env);
    admin.mint(&victim, &1_000_0000000);
    client.set_rules(&victim, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&victim, &400_0000000, &key(&env, 53), &0);
    let id = client.create_savings_goal(&victim, &String::from_str(&env, "Hajj"), &50_0000000, &0);

    env.mock_auths(&[]);
    client.withdraw_from_goal(&victim, &id, &10_0000000);
}

#[test]
#[should_panic]
fn cannot_rename_another_users_goal() {
    let env = Env::default();
    let (client, victim, _token, admin) = setup(&env);
    admin.mint(&victim, &1_000_0000000);
    client.set_rules(&victim, &6000, &2500, &1500, &0, &vec![&env], &0);
    client.distribute(&victim, &400_0000000, &key(&env, 54), &0);
    let id = client.create_savings_goal(&victim, &String::from_str(&env, "Hajj"), &50_0000000, &0);

    env.mock_auths(&[]);
    client.rename_savings_goal(&victim, &id, &String::from_str(&env, "Hacked"));
}

#[test]
#[should_panic]
fn cannot_offramp_as_another_user() {
    let env = Env::default();
    let (client, victim, _token, admin) = setup(&env);
    admin.mint(&victim, &1_000_0000000);
    let anchor = Address::generate(&env);
    client.set_rules(&victim, &6000, &2500, &1500, &0, &vec![&env, anchor.clone()], &0);

    env.mock_auths(&[]);
    client.offramp(&victim, &anchor, &10_0000000);
}
