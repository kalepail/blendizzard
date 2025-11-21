use soroban_sdk::{Address, Env, IntoVal as _, vec};

use crate::errors::Error;
use crate::events::{emit_game_ended, emit_game_started};
use crate::faction::lock_epoch_faction;
use crate::faction_points::{initialize_epoch_fp, lock_fp};
use crate::storage;
use crate::types::GameSession;

// ============================================================================
// Game Registry
// ============================================================================

/// Add a game contract to the approved list
///
/// Only whitelisted games can be played. This prevents malicious contracts
/// from interacting with the Blendizzard system.
///
/// # Arguments
/// * `env` - Contract environment
/// * `game_id` - Address of the game contract to whitelist
///
/// # Errors
/// * `NotAdmin` - If caller is not the admin
pub(crate) fn add_game(env: &Env, game_id: &Address) -> Result<(), Error> {
    // Authenticate admin
    let admin = storage::get_admin(env);
    admin.require_auth();

    // Add to whitelist
    storage::add_game_to_whitelist(env, game_id);

    // Emit event
    crate::events::emit_game_added(env, game_id);

    Ok(())
}

/// Remove a game contract from the approved list
///
/// # Arguments
/// * `env` - Contract environment
/// * `game_id` - Address of the game contract to remove
///
/// # Errors
/// * `NotAdmin` - If caller is not the admin
pub(crate) fn remove_game(env: &Env, game_id: &Address) -> Result<(), Error> {
    // Authenticate admin
    let admin = storage::get_admin(env);
    admin.require_auth();

    // Remove from whitelist
    storage::remove_game_from_whitelist(env, game_id);

    // Emit event
    crate::events::emit_game_removed(env, game_id);

    Ok(())
}

/// Check if a contract is an approved game
///
/// # Arguments
/// * `env` - Contract environment
/// * `game_id` - Address of the game contract to check
///
/// # Returns
/// * `true` if the game is whitelisted
/// * `false` otherwise
pub(crate) fn is_game(env: &Env, game_id: &Address) -> bool {
    storage::is_game_whitelisted(env, game_id)
}

// ============================================================================
// Game Lifecycle
// ============================================================================

/// Start a new game session
///
/// From PLAN.md:
/// "When a game starts there's actually quite a bit that needs to be recorded:
/// - If it's the players first game for the epoch we need to lock in their total
///   available factions points for the epoch
/// - Lock in the player's faction if it hasn't been elected yet via `select_faction`"
///
/// # Arguments
/// * `env` - Contract environment
/// * `game_id` - Address of the game contract
/// * `session_id` - Unique session identifier
/// * `player1` - First player's address
/// * `player2` - Second player's address
/// * `player1_wager` - Faction points wagered by player1
/// * `player2_wager` - Faction points wagered by player2
///
/// # Errors
/// * `GameNotWhitelisted` - If game_id is not in the whitelist
/// * `SessionAlreadyExists` - If session_id already exists
/// * `InvalidAmount` - If wagers are <= 0
/// * `PlayerNotFound` - If players don't exist
/// * `InsufficientFactionPoints` - If players don't have enough FP
pub(crate) fn start_game(
    env: &Env,
    game_id: &Address,
    session_id: u32,
    player1: &Address,
    player2: &Address,
    player1_wager: i128,
    player2_wager: i128,
) -> Result<(), Error> {
    // SECURITY: Require game contract to authorize this call
    // Only the whitelisted game contract should be able to start sessions
    // This prevents fake sessions from being created with a whitelisted game_id
    game_id.require_auth();

    // Validate game is whitelisted
    if !storage::is_game_whitelisted(env, game_id) {
        return Err(Error::GameNotWhitelisted);
    }

    // Validate session doesn't already exist
    if storage::has_session(env, session_id) {
        return Err(Error::SessionAlreadyExists);
    }

    // Validate wagers
    if player1_wager <= 0 || player2_wager <= 0 {
        return Err(Error::InvalidAmount);
    }

    // Authenticate players (for their consent to lock FP)
    player1.require_auth_for_args(vec![&env, game_id.to_val(), session_id.into_val(env), player1_wager.into_val(env)]);
    player2.require_auth_for_args(vec![&env, game_id.to_val(), session_id.into_val(env), player2_wager.into_val(env)]);

    // CRITICAL: Validate both players have explicitly selected a faction
    // This check must happen BEFORE any other initialization logic
    storage::get_player(env, player1).ok_or(Error::FactionNotSelected)?;
    storage::get_player(env, player2).ok_or(Error::FactionNotSelected)?;

    // Get current epoch
    let current_epoch = storage::get_current_epoch(env);

    // Initialize faction points for each player if this is their first game
    // This also locks in their total available FP for the epoch
    initialize_player_epoch(env, player1, current_epoch)?;
    initialize_player_epoch(env, player2, current_epoch)?;

    // Lock factions for both players (stored in EpochPlayer.epoch_faction)
    lock_epoch_faction(env, player1, current_epoch)?;
    lock_epoch_faction(env, player2, current_epoch)?;

    // Lock faction points for both players
    lock_fp(env, player1, player1_wager, current_epoch)?;
    lock_fp(env, player2, player2_wager, current_epoch)?;

    // Create game session
    let session = GameSession {
        game_id: game_id.clone(),
        epoch_id: current_epoch,
        player1: player1.clone(),
        player2: player2.clone(),
        player1_wager,
        player2_wager,
        player1_won: None,
    };

    // Save session
    storage::set_session(env, session_id, &session);

    // Get epoch player data for event emission
    let p1_epoch_data =
        storage::get_epoch_player(env, current_epoch, player1).ok_or(Error::PlayerNotFound)?;
    let p2_epoch_data =
        storage::get_epoch_player(env, current_epoch, player2).ok_or(Error::PlayerNotFound)?;

    // Emit event with enhanced data
    emit_game_started(
        env,
        game_id,
        session_id,
        player1,
        player2,
        player1_wager,
        player2_wager,
        p1_epoch_data.epoch_faction.unwrap_or(0), // Should always be Some after lock_epoch_faction
        p2_epoch_data.epoch_faction.unwrap_or(0), // Should always be Some after lock_epoch_faction
        p1_epoch_data.available_fp,               // Remaining FP after wager deduction
        p2_epoch_data.available_fp,               // Remaining FP after wager deduction
    );

    Ok(())
}

/// End a game session with outcome verification
///
/// Outcome verification is handled by the individual game contracts.
/// Each game is responsible for implementing its own verification mechanism
/// (multi-sig oracle, ZK proofs, etc.) before calling this function.
///
/// # Arguments
/// * `env` - Contract environment
/// * `session_id` - The unique session identifier
/// * `player1_won` - true if player1 won, false if player2 won
///
/// # Errors
/// * `SessionNotFound` - If session doesn't exist
/// * `InvalidSessionState` - If session is not in Pending state
/// * `GameExpired` - If game is from a previous epoch
pub(crate) fn end_game(env: &Env, session_id: u32, player1_won: bool) -> Result<(), Error> {
    // Get session
    let mut session = storage::get_session(env, session_id).ok_or(Error::SessionNotFound)?;

    // SECURITY: Require game contract to authorize this call
    // Only the whitelisted game contract should be able to submit outcomes
    session.game_id.require_auth();

    // Validate session state (game must not be completed yet)
    if session.player1_won.is_some() {
        return Err(Error::InvalidSessionState);
    }

    // Validate game is from current epoch
    // Games cannot be completed in a different epoch than they were started
    let current_epoch = storage::get_current_epoch(env);
    if session.epoch_id != current_epoch {
        return Err(Error::GameExpired);
    }

    // Determine winner and loser
    let (winner, loser, winner_wager, _loser_wager) = if player1_won {
        // Player1 won
        (
            &session.player1,
            &session.player2,
            session.player1_wager,
            session.player2_wager,
        )
    } else {
        // Player2 won
        (
            &session.player2,
            &session.player1,
            session.player2_wager,
            session.player1_wager,
        )
    };

    // Spend FP: Both players LOSE their wagered FP (it's consumed/burned)
    // Only the winner's wager contributes to their faction standings
    // Note: FP was already subtracted from available_fp when game started (in lock_fp)

    // Get winner's epoch data
    let mut winner_epoch =
        storage::get_epoch_player(env, current_epoch, winner).ok_or(Error::PlayerNotFound)?;

    // Only winner's wager contributes to faction standings
    // Note: Wager is already in FP units with multipliers applied
    winner_epoch.total_fp_contributed = winner_epoch
        .total_fp_contributed
        .checked_add(winner_wager)
        .ok_or(Error::OverflowError)?;

    // Save winner's updated data
    storage::set_epoch_player(env, current_epoch, winner, &winner_epoch);

    // Update session (marking it as completed)
    session.player1_won = Some(player1_won);
    storage::set_session(env, session_id, &session);

    // Update faction standings (only winner's wager contributes)
    update_faction_standings(env, winner, winner_wager, current_epoch)?;

    // Emit event (only winner's wager counts as contribution)
    emit_game_ended(
        env,
        &session.game_id,
        session_id,
        winner,
        loser,
        winner_wager,
    );

    Ok(())
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Initialize faction points for a player if this is their first game in the epoch
///
/// **NEW ARCHITECTURE (Cross-Epoch Balance Comparison):**
/// 1. Query current vault balance
/// 2. Check for >50% withdrawal since last epoch
/// 3. Initialize time_multiplier_start if first-time player
/// 4. Calculate FP based on current balance + multipliers
/// 5. Save epoch snapshot and update last_epoch_balance
fn initialize_player_epoch(env: &Env, player: &Address, current_epoch: u32) -> Result<(), Error> {
    // Check if player already has epoch data
    if storage::has_epoch_player(env, current_epoch, player) {
        // Already initialized this epoch
        return Ok(());
    }

    // STEP 1: Query current vault balance
    let current_balance = crate::vault::get_vault_balance(env, player);

    // STEP 2: Get or create player record
    let mut player_data = storage::get_player(env, player).unwrap_or(crate::types::Player {
        selected_faction: 0, // Default to WholeNoodle
        time_multiplier_start: 0,
        last_epoch_balance: 0,
    });

    // STEP 3: Initialize time_multiplier_start if first-time player
    if player_data.time_multiplier_start == 0 && current_balance > 0 {
        player_data.time_multiplier_start = env.ledger().timestamp();
        storage::set_player(env, player, &player_data); // Save before reset check
    }

    // STEP 4: Check for cross-epoch withdrawal reset (>50%)
    // This may update time_multiplier_start in storage and emit TimeMultiplierReset event
    let _reset = crate::vault::check_cross_epoch_withdrawal_reset(
        env,
        player,
        current_balance,
        current_epoch,
    )?;

    // STEP 5: Calculate FP based on current balance and multipliers
    // This calls initialize_epoch_fp which will use the balance we pass
    initialize_epoch_fp(env, player, current_epoch)?;

    // STEP 6: Reload player data after potential reset, then update last_epoch_balance
    // CRITICAL: Must reload to get the updated time_multiplier_start from step 4
    player_data = storage::get_player(env, player).ok_or(Error::PlayerNotFound)?;
    player_data.last_epoch_balance = current_balance;
    storage::set_player(env, player, &player_data);

    Ok(())
}

/// Update faction standings with the winner's FP contribution
fn update_faction_standings(
    env: &Env,
    winner: &Address,
    fp_amount: i128,
    current_epoch: u32,
) -> Result<(), Error> {
    // Get winner's faction
    let epoch_player =
        storage::get_epoch_player(env, current_epoch, winner).ok_or(Error::PlayerNotFound)?;

    let faction = epoch_player
        .epoch_faction
        .ok_or(Error::FactionAlreadyLocked)?;

    // Get current epoch info
    let mut epoch_info = storage::get_epoch(env, current_epoch).ok_or(Error::EpochNotFinalized)?;

    // Update faction standings
    let current_standing = epoch_info.faction_standings.get(faction).unwrap_or(0);
    let new_standing = current_standing
        .checked_add(fp_amount)
        .ok_or(Error::OverflowError)?;

    epoch_info.faction_standings.set(faction, new_standing);

    // Save epoch info
    storage::set_epoch(env, current_epoch, &epoch_info);

    Ok(())
}
