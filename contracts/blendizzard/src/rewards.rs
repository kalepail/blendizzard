use soroban_fixed_point_math::FixedPoint;
use soroban_sdk::{Address, Env};

use crate::errors::Error;
use crate::events::emit_rewards_claimed;
use crate::storage;
use crate::types::SCALAR_7;

// ============================================================================
// Reward Distribution
// ============================================================================

/// Claim epoch reward for a user for a specific epoch
///
/// Users who contributed FP to the winning faction can claim their share
/// of the epoch's reward pool (USDC converted from BLND yield).
///
/// Formula:
/// ```
/// user_reward = (user_fp_contributed / total_winning_faction_fp) * reward_pool
/// ```
///
/// # Arguments
/// * `env` - Contract environment
/// * `user` - User claiming rewards
/// * `epoch` - Epoch number to claim from
///
/// # Returns
/// Amount of USDC claimed
///
/// # Errors
/// * `EpochNotFinalized` - If epoch doesn't exist or isn't finalized
/// * `RewardAlreadyClaimed` - If user already claimed for this epoch
/// * `NotWinningFaction` - If user wasn't in the winning faction
/// * `NoRewardsAvailable` - If user has no rewards to claim
pub(crate) fn claim_epoch_reward(env: &Env, user: &Address, epoch: u32) -> Result<i128, Error> {
    // Authenticate user
    user.require_auth();

    // Check if already claimed
    if storage::has_claimed(env, user, epoch) {
        return Err(Error::RewardAlreadyClaimed);
    }

    // Get epoch info
    let epoch_info = storage::get_epoch(env, epoch).ok_or(Error::EpochNotFinalized)?;

    // Check if epoch is finalized
    if !epoch_info.is_finalized {
        return Err(Error::EpochNotFinalized);
    }

    // Get winning faction
    let winning_faction = epoch_info.winning_faction.ok_or(Error::EpochNotFinalized)?;

    // Get user's epoch data
    let epoch_user = storage::get_epoch_user(env, epoch, user).ok_or(Error::NoRewardsAvailable)?;

    // Check if user was in winning faction
    let user_faction = epoch_user.epoch_faction.ok_or(Error::NoRewardsAvailable)?;

    if user_faction != winning_faction {
        return Err(Error::NotWinningFaction);
    }

    // Get user's fp contribution
    let user_fp_contributed = epoch_user.total_fp_contributed;

    if user_fp_contributed == 0 {
        return Err(Error::NoRewardsAvailable);
    }

    // Get total fp for winning faction
    let total_winning_fp = epoch_info
        .faction_standings
        .get(winning_faction)
        .ok_or(Error::NoRewardsAvailable)?;

    if total_winning_fp == 0 {
        return Err(Error::DivisionByZero);
    }

    // Calculate user's share of rewards
    // Formula: (user_fp / total_fp) * reward_pool
    let reward_amount = calculate_reward_share(
        user_fp_contributed,
        total_winning_fp,
        epoch_info.reward_pool,
    )?;

    if reward_amount == 0 {
        return Err(Error::NoRewardsAvailable);
    }

    // Mark as claimed
    storage::set_claimed(env, user, epoch);

    // Transfer USDC to user
    let config = storage::get_config(env);
    let usdc_client = soroban_sdk::token::Client::new(env, &config.usdc_token);
    usdc_client.transfer(&env.current_contract_address(), user, &reward_amount);

    // Emit event
    emit_rewards_claimed(env, user, epoch, user_faction, reward_amount);

    Ok(reward_amount)
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Calculate user's share of the reward pool
///
/// Formula: (user_fp_contributed / total_winning_fp) * reward_pool
/// Uses fixed-point math to avoid overflow
///
/// # Arguments
/// * `user_fp` - User's total fp contributed
/// * `total_fp` - Total fp for winning faction
/// * `reward_pool` - Total USDC available for distribution
///
/// # Returns
/// User's reward amount in USDC
///
/// # Errors
/// * `OverflowError` - If calculation overflows
/// * `DivisionByZero` - If total_fp is 0
fn calculate_reward_share(user_fp: i128, total_fp: i128, reward_pool: i128) -> Result<i128, Error> {
    // Calculate user's share as a fraction: user_fp / total_fp
    let share = user_fp
        .fixed_div_floor(total_fp, SCALAR_7)
        .ok_or(Error::DivisionByZero)?;

    // Calculate reward: share * reward_pool
    let reward = reward_pool
        .fixed_mul_floor(share, SCALAR_7)
        .ok_or(Error::OverflowError)?;

    Ok(reward)
}

// ============================================================================
// Query Functions
// ============================================================================

/// Calculate how much a user would receive if they claimed now
///
/// This doesn't actually claim, just calculates the amount.
/// Useful for UIs to show pending rewards.
///
/// # Arguments
/// * `env` - Contract environment
/// * `user` - User to check
/// * `epoch` - Epoch to check
///
/// # Returns
/// Amount user would receive, or 0 if not eligible
pub(crate) fn get_claimable_amount(env: &Env, user: &Address, epoch: u32) -> i128 {
    // Check if already claimed
    if storage::has_claimed(env, user, epoch) {
        return 0;
    }

    // Get epoch info
    let epoch_info = match storage::get_epoch(env, epoch) {
        Some(e) => e,
        None => return 0,
    };

    // Check if epoch is finalized
    if !epoch_info.is_finalized {
        return 0;
    }

    // Get winning faction
    let winning_faction = match epoch_info.winning_faction {
        Some(f) => f,
        None => return 0,
    };

    // Get user's epoch data
    let epoch_user = match storage::get_epoch_user(env, epoch, user) {
        Some(eu) => eu,
        None => return 0,
    };

    // Check if user was in winning faction
    let user_faction = match epoch_user.epoch_faction {
        Some(f) => f,
        None => return 0,
    };

    if user_faction != winning_faction {
        return 0;
    }

    // Get user's fp contribution
    let user_fp_contributed = epoch_user.total_fp_contributed;

    if user_fp_contributed == 0 {
        return 0;
    }

    // Get total fp for winning faction
    let total_winning_fp = match epoch_info.faction_standings.get(winning_faction) {
        Some(fp) => fp,
        None => return 0,
    };

    if total_winning_fp == 0 {
        return 0;
    }

    // Calculate reward
    match calculate_reward_share(
        user_fp_contributed,
        total_winning_fp,
        epoch_info.reward_pool,
    ) {
        Ok(amount) => amount,
        Err(_) => 0,
    }
}

/// Check if user has claimed rewards for an epoch
pub(crate) fn has_claimed_rewards(env: &Env, user: &Address, epoch: u32) -> bool {
    storage::has_claimed(env, user, epoch)
}
