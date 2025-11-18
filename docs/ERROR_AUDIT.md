# Error Audit Report

## Number-Guess Contract

### Defined Errors
```rust
pub enum Error {
    GameNotFound = 1,           // ✓ USED
    GameAlreadyStarted = 2,     // ✗ UNUSED - REMOVE
    NotPlayer = 3,              // ✓ USED
    AlreadyGuessed = 4,         // ✓ USED
    BothPlayersNotGuessed = 5,  // ✓ USED
    GameAlreadyEnded = 6,       // ✓ USED
    NotInitialized = 7,         // ✓ USED
    AlreadyInitialized = 8,     // ✗ UNUSED - Uses panic! instead
    NotAdmin = 9,               // ✗ UNUSED - Uses require_auth() instead
}
```

### Usage Analysis

**Used Errors (6):**
- `GameNotFound` (3 usages): lines 229, 275, 355
- `NotPlayer` (1 usage): line 248
- `AlreadyGuessed` (2 usages): lines 239, 244
- `BothPlayersNotGuessed` (2 usages): lines 283, 284
- `GameAlreadyEnded` (1 usage): line 233
- `NotInitialized` (7 usages): lines 166, 320, 370, 385, 401, 416, 438

**Unused Errors (3):**
- `GameAlreadyStarted`: Never used, not needed (games can't be restarted)
- `AlreadyInitialized`: Uses `panic!("Already initialized")` at line 127 instead
- `NotAdmin`: Admin functions use `require_auth()` which handles this automatically

### Issues Found

1. **Inconsistent initialization check**: Line 127 uses `panic!` but `AlreadyInitialized` error exists
2. **Dead code**: `GameAlreadyStarted` serves no purpose in the contract logic
3. **Redundant error**: `NotAdmin` not needed due to `require_auth()`

---

## Blendizzard Contract

### Defined Errors (27 total)
```rust
pub enum Error {
    // Admin errors (1-9)
    NotAdmin = 1,                    // ✗ UNUSED - Uses require_auth()
    AlreadyInitialized = 2,          // ✓ USED (1 usage)

    // Player errors (10-19)
    InsufficientBalance = 10,        // ✗ UNUSED - REMOVE
    InsufficientFactionPoints = 11,  // ✓ USED (1 usage)
    InvalidAmount = 12,              // ✓ USED (1 usage)
    InvalidFaction = 13,             // ✓ USED (1 usage)
    FactionAlreadyLocked = 14,       // ✓ USED (1 usage)
    PlayerNotFound = 15,             // ✓ USED (7 usages)
    FactionNotSelected = 16,         // ✓ USED (4 usages)

    // Game errors (20-29)
    GameNotWhitelisted = 20,         // ✓ USED (1 usage)
    SessionNotFound = 21,            // ✓ USED (1 usage)
    SessionAlreadyExists = 22,       // ✓ USED (1 usage)
    InvalidSessionState = 23,        // ✓ USED (1 usage)
    InvalidGameOutcome = 24,         // ✓ USED (1 usage)
    GameExpired = 25,                // ✓ USED (2 usages)

    // Epoch errors (30-39)
    EpochNotFinalized = 30,          // ✓ USED (7 usages)
    EpochAlreadyFinalized = 31,      // ✓ USED (1 usage)
    EpochNotReady = 32,              // ✓ USED (1 usage)

    // Reward errors (40-49)
    NoRewardsAvailable = 40,         // ✓ USED (5 usages)
    RewardAlreadyClaimed = 41,       // ✓ USED (1 usage)
    NotWinningFaction = 42,          // ✓ USED (1 usage)

    // External contract errors (50-59)
    FeeVaultError = 50,              // ✗ UNUSED - REMOVE
    SwapError = 51,                  // ✓ USED (1 usage)
    TokenTransferError = 52,         // ✗ UNUSED - REMOVE

    // Math errors (60-69)
    OverflowError = 60,              // ✓ USED (14 usages)
    DivisionByZero = 61,             // ✓ USED (2 usages)

    // Emergency errors (70-79)
    ContractPaused = 70,             // ✓ USED (1 usage)
}
```

### Usage Analysis

**Used Errors (23):**
- High usage: `OverflowError` (14), `EpochNotFinalized` (7), `PlayerNotFound` (7), `NoRewardsAvailable` (5), `FactionNotSelected` (4)
- Medium usage: `DivisionByZero` (2), `GameExpired` (2)
- Single usage: 16 other errors

**Unused Errors (4):**
- `NotAdmin`: Admin functions use `require_auth()` which panics automatically
- `InsufficientBalance`: Never referenced, likely replaced by vault balance checks
- `FeeVaultError`: No fee-vault error handling implemented yet
- `TokenTransferError`: No token transfer error handling implemented yet

### Observations

1. **Math errors well-used**: `OverflowError` and `DivisionByZero` properly handle arithmetic edge cases
2. **Missing vault integration errors**: `FeeVaultError` and `TokenTransferError` not used (future Phase 2?)
3. **Admin error pattern**: Like number-guess, uses `require_auth()` instead of custom error
4. **Good error categorization**: Errors grouped by category (10-19 for players, 20-29 for games, etc.)

---

## Recommendations

### Number-Guess Contract

**Remove (3 errors):**
```rust
// Remove these unused errors:
GameAlreadyStarted = 2,    // Dead code
AlreadyInitialized = 8,    // Uses panic! instead
NotAdmin = 9,              // Uses require_auth()
```

**Fix inconsistency:**
```rust
// Option 1: Use the error (recommended for consistency)
if env.storage().instance().has(&DataKey::BlendizzardAddress) {
    return Err(Error::AlreadyInitialized);  // Instead of panic!
}

// Option 2: Remove the error and keep panic!
```

### Blendizzard Contract

**Remove (4 errors):**
```rust
// Remove these unused errors:
NotAdmin = 1,                // Uses require_auth()
InsufficientBalance = 10,    // Not implemented
FeeVaultError = 50,          // Not implemented
TokenTransferError = 52,     // Not implemented
```

**Keep for future use (if Phase 2 plans exist):**
- If fee-vault and token transfer error handling is planned for Phase 2, keep those errors but add comments
- Otherwise, remove and add when needed (YAGNI principle)

---

## Summary

| Contract | Total Defined | Used | Unused | Removed |
|----------|---------------|------|--------|---------|
| number-guess | 9 → 6 | 6 | 3 | ✅ 3 (GameAlreadyStarted, AlreadyInitialized, NotAdmin) |
| blendizzard | 27 → 23 | 23 | 4 | ✅ 4 (NotAdmin, InsufficientBalance, FeeVaultError, TokenTransferError) |
| **Total** | **36 → 29** | **29** | **7** | **✅ 7** |

**Error Reduction:** 19% of defined errors were unused and have been removed.

---

## Changes Applied

### Number-Guess Contract (`contracts/number-guess/src/lib.rs`)
**Removed 3 errors:**
- `GameAlreadyStarted = 2` - Dead code, never used
- `AlreadyInitialized = 8` - Uses `panic!` instead
- `NotAdmin = 9` - Admin functions use `require_auth()`

**Result:** ✅ All 16 tests pass

### Blendizzard Contract (`contracts/blendizzard/src/errors.rs`)
**Removed 4 errors:**
- `NotAdmin = 1` - Admin functions use `require_auth()`
- `InsufficientBalance = 10` - Not implemented
- `FeeVaultError = 50` - Not implemented
- `TokenTransferError = 52` - Not implemented

**Result:** Error types cleaned up. Note: Tests need separate fix for GameOutcome API change (unrelated to error audit).

---

## Known Issue (Separate from Error Audit)

The blendizzard tests are failing due to `GameOutcome` struct removal (API change from `end_game(outcome: GameOutcome)` to `end_game(session_id: u32, player1_won: bool)`). This is a separate refactoring task not related to error cleanup.
