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

    client.set_rules(&user, &6000, &2500, &1500, &86400, &vec![&env]);
    // 500 USDC inflow
    let (needs, savings, buffer) = client.distribute(&user, &500_0000000, &key(&env, 1));
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

    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env]);
    // 7 stroops: 25% = 1.75 -> 1, 15% = 1.05 -> 1, needs gets 5 (dust absorbed)
    let (needs, savings, buffer) = client.distribute(&user, &7, &key(&env, 2));
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
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env]);
    let (needs, savings, buffer) = client.distribute(&user, &1, &key(&env, 3));
    assert_eq!((needs, savings, buffer), (1, 0, 0));
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn no_double_split_same_inflow() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &10_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env]);
    client.distribute(&user, &100_0000000, &key(&env, 4));
    client.distribute(&user, &100_0000000, &key(&env, 4)); // same tx hash -> panics
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn rules_must_total_100_percent() {
    let env = Env::default();
    let (client, user, _token, _admin) = setup(&env);
    client.set_rules(&user, &6000, &2500, &1000, &0, &vec![&env]); // 95%
}

#[test]
fn withdraw_after_timelock_no_penalty() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &1000, &vec![&env]);
    client.distribute(&user, &400_0000000, &key(&env, 5)); // savings = 100 USDC

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
    client.set_rules(&user, &6000, &2500, &1500, &86400, &vec![&env]);
    client.distribute(&user, &400_0000000, &key(&env, 6)); // savings = 100 USDC

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
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env]);
    client.distribute(&user, &400_0000000, &key(&env, 7));
    client.withdraw_savings(&user, &200_0000000); // only 100 in vault
}

#[test]
fn offramp_enforces_anchor_allowlist() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    let anchor = Address::generate(&env);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env, anchor.clone()]);
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
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env, anchor]);
    client.offramp(&user, &rogue, &50_0000000);
}

#[test]
fn deposit_extends_lock_monotonically() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &1000, &vec![&env]);

    client.deposit(&user, &50_0000000);
    let lock1 = client.get_lock_until(&user);
    env.ledger().with_mut(|l| l.timestamp += 500);
    client.deposit(&user, &50_0000000);
    let lock2 = client.get_lock_until(&user);
    assert!(lock2 > lock1);
    assert_eq!(client.get_savings(&user), 100_0000000);
}

// ---- Savings goals ----

#[test]
fn create_goal_within_unallocated_ok() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env]);
    client.distribute(&user, &400_0000000, &key(&env, 10)); // savings = 100 USDC

    let label = String::from_str(&env, "Emergency fund");
    let id = client.create_savings_goal(&user, &label, &60_0000000);
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
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env]);
    client.distribute(&user, &400_0000000, &key(&env, 11)); // savings = 100 USDC

    let label = String::from_str(&env, "Too big");
    client.create_savings_goal(&user, &label, &200_0000000); // only 100 available
}

#[test]
fn withdraw_from_goal_before_lock_applies_penalty() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &86400, &vec![&env]);
    client.distribute(&user, &400_0000000, &key(&env, 12)); // savings = 100 USDC

    let label = String::from_str(&env, "Wedding");
    let id = client.create_savings_goal(&user, &label, &50_0000000);

    let payout = client.withdraw_from_goal(&user, &id, &20_0000000); // still locked
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
    client.set_rules(&user, &6000, &2500, &1500, &1000, &vec![&env]);
    client.distribute(&user, &400_0000000, &key(&env, 13)); // savings = 100 USDC

    let label = String::from_str(&env, "Car");
    let id = client.create_savings_goal(&user, &label, &50_0000000);
    env.ledger().with_mut(|l| l.timestamp += 2000); // past lock

    let payout = client.withdraw_from_goal(&user, &id, &50_0000000);
    assert_eq!(payout, 50_0000000);
    assert_eq!(client.get_savings_goals(&user).get(0).unwrap().amount, 0);
}

#[test]
fn delete_goal_releases_to_unallocated() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env]);
    client.distribute(&user, &400_0000000, &key(&env, 14)); // savings = 100 USDC

    let label = String::from_str(&env, "Temp goal");
    let id = client.create_savings_goal(&user, &label, &70_0000000);
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
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env]);
    client.distribute(&user, &400_0000000, &key(&env, 15));

    let id = client.create_savings_goal(&user, &String::from_str(&env, "Old name"), &50_0000000);
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
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env]);
    client.distribute(&user, &400_0000000, &key(&env, 16)); // savings = 100 USDC

    client.create_savings_goal(&user, &String::from_str(&env, "A"), &30_0000000);
    client.create_savings_goal(&user, &String::from_str(&env, "B"), &40_0000000);
    assert_eq!(client.get_unallocated_savings(&user), 30_0000000);
    assert_eq!(client.get_savings_goals(&user).len(), 2);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn withdraw_from_goal_rejects_unknown_id() {
    let env = Env::default();
    let (client, user, _token, admin) = setup(&env);
    admin.mint(&user, &1_000_0000000);
    client.set_rules(&user, &6000, &2500, &1500, &0, &vec![&env]);
    client.distribute(&user, &400_0000000, &key(&env, 17));
    client.withdraw_from_goal(&user, &999, &1_0000000); // no such goal
}
