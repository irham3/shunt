//! Typed error codes for the ShuntRouter contract.

use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    // -- General --
    /// Protocol is paused; new routes are rejected.
    ProtocolPaused = 1,
    /// Caller is not the admin.
    NotAdmin = 2,
    /// Caller is not the owner of the resource.
    NotOwner = 3,

    // -- Policy --
    /// No policy found for the given recipient.
    PolicyNotFound = 10,
    /// Policy is not active (disabled by owner).
    PolicyNotActive = 11,
    /// BPS values exceed allowed bounds.
    InvalidBps = 12,
    /// Emergency target must be non-negative.
    InvalidEmergencyTarget = 13,
    /// Lock duration exceeds protocol maximum.
    LockTooLong = 14,
    /// Cooldown duration exceeds protocol maximum.
    CooldownTooLong = 15,
    /// Spend destination is invalid (zero/contract).
    InvalidSpendDestination = 16,

    // -- Route --
    /// Payment amount must be positive.
    AmountNotPositive = 20,
    /// Request has already been processed (replay protection).
    RequestAlreadyProcessed = 21,
    /// Expected policy version doesn't match current version.
    PolicyVersionMismatch = 22,
    /// Only the configured USDC asset is accepted.
    UnsupportedAsset = 23,
    /// Payment request has expired.
    RequestExpired = 24,

    // -- Withdrawal --
    /// Insufficient emergency balance for withdrawal.
    InsufficientEmergency = 30,
    /// Insufficient obligation balance for withdrawal.
    InsufficientObligation = 31,
    /// No pending withdrawal request found.
    WithdrawalNotFound = 32,
    /// Cooldown period has not elapsed yet.
    CooldownNotElapsed = 33,
    /// Goal lot not found.
    GoalLotNotFound = 34,
    /// Goal lot has not matured yet.
    GoalNotMatured = 35,
    /// Goal lot has already been claimed.
    GoalAlreadyClaimed = 36,
    /// Maximum number of open goal lots reached.
    TooManyOpenLots = 37,

    // -- Arithmetic --
    /// Integer overflow in allocation calculation.
    Overflow = 50,
}
