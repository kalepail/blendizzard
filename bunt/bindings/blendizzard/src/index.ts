import { Buffer } from "buffer";
import { Address } from '@stellar/stellar-sdk';
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from '@stellar/stellar-sdk/contract';
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Typepoint,
  Duration,
} from '@stellar/stellar-sdk/contract';
export * from '@stellar/stellar-sdk'
export * as contract from '@stellar/stellar-sdk/contract'
export * as rpc from '@stellar/stellar-sdk/rpc'

if (typeof window !== 'undefined') {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}





/**
 * Persistent user data (across all epochs)
 * 
 * Stores the user's faction preference and time multiplier tracking.
 * This persists across epoch boundaries.
 */
export interface User {
  /**
 * User's vault balance from the previous epoch (for cross-epoch comparison)
 * Used to detect >50% withdrawal between epochs
 */
last_epoch_balance: i128;
  /**
 * The user's persistent faction selection (can be changed between epochs)
 */
selected_faction: u32;
  /**
 * Timestamp when the time multiplier calculation started
 * Set when user plays their first game (with vault balance > 0)
 * Reset to current time if user withdraws >50% between epochs
 */
time_multiplier_start: u64;
}


/**
 * Global configuration
 * 
 * Stores contract configuration parameters.
 * Note: Admin address is stored separately via DataKey::Admin for single source of truth.
 * Note: Pause state is stored separately via DataKey::Paused for efficient access.
 */
export interface Config {
  /**
 * BLND token address
 */
blnd_token: string;
  /**
 * Duration of each epoch in seconds (default: 4 days = 345,600 seconds)
 */
epoch_duration: u64;
  /**
 * fee-vault-v2 contract address
 */
fee_vault: string;
  /**
 * Reserve token IDs for claiming BLND emissions from Blend pool
 * Formula: reserve_index * 2 + token_type
 * token_type: 0 = debt token, 1 = b-token (suppliers)
 * Example: For reserve 0 b-tokens (suppliers), use [1]
 */
reserve_token_ids: Array<u32>;
  /**
 * Soroswap router contract address
 */
soroswap_router: string;
  /**
 * USDC token address
 */
usdc_token: string;
}


/**
 * Epoch metadata
 * 
 * Stores all information about an epoch including timing, standings, and rewards.
 */
export interface EpochInfo {
  /**
 * Unix timestamp when this epoch ends (start_time + epoch_duration)
 */
end_time: u64;
  /**
 * The sequential epoch number (starts at 0)
 */
epoch_number: u32;
  /**
 * Map of faction_id -> total fp contributed by all players
 * Used to determine the winning faction
 */
faction_standings: Map<u32, i128>;
  /**
 * True if epoch has been finalized via cycle_epoch
 */
is_finalized: boolean;
  /**
 * Total USDC available for reward distribution (set during cycle_epoch)
 */
reward_pool: i128;
  /**
 * Unix timestamp when this epoch started
 */
start_time: u64;
  /**
 * The winning faction (None until epoch is finalized)
 */
winning_faction: Option<u32>;
}


/**
 * Per-epoch user data
 * 
 * Created when a user first interacts with the contract in a new epoch.
 * Tracks faction points and epoch-specific faction lock.
 * FP is calculated once at first game of epoch based on vault balance.
 */
export interface EpochUser {
  /**
 * Available faction points (not locked in games)
 * Calculated once at first game of epoch and remains valid until next epoch
 */
available_fp: i128;
  /**
 * User's vault balance snapshot at first game of this epoch
 * Captures the vault balance used to calculate this epoch's FP
 */
epoch_balance_snapshot: i128;
  /**
 * The faction locked in for this epoch (locked on first game)
 * None = not yet locked, Some(faction_id) = locked
 */
epoch_faction: Option<u32>;
  /**
 * Faction points currently locked in active games
 */
locked_fp: i128;
  /**
 * Total faction points contributed to the user's faction this epoch
 * Used for reward distribution calculation
 */
total_fp_contributed: i128;
}

/**
 * Game session status
 */
export type GameStatus = {tag: "Pending", values: void} | {tag: "Completed", values: void} | {tag: "Cancelled", values: void};


/**
 * Game outcome for verification
 * 
 * This is the data structure that should be proven by the ZK proof.
 * The proof verifies that these values are correct based on game execution.
 */
export interface GameOutcome {
  /**
 * Game contract address
 */
game_id: string;
  /**
 * First player's address
 */
player1: string;
  /**
 * Second player's address
 */
player2: string;
  /**
 * Unique session identifier
 */
session_id: u32;
  /**
 * Winner of the game
 * true = player1 won, false = player2 won
 */
winner: boolean;
}


/**
 * Game session tracking
 * 
 * Created when a game starts, updated when it ends.
 * Tracks all game state including players, wagers, and outcome.
 */
export interface GameSession {
  /**
 * Timestamp when game was created
 */
created_at: u64;
  /**
 * Epoch when this game was created
 * Used to prevent games from being completed in a different epoch
 */
epoch_id: u32;
  /**
 * Address of the game contract
 */
game_id: string;
  /**
 * First player's address
 */
player1: string;
  /**
 * Faction points wagered by player1
 */
player1_wager: i128;
  /**
 * Second player's address
 */
player2: string;
  /**
 * Faction points wagered by player2
 */
player2_wager: i128;
  /**
 * Unique session identifier for this game instance
 */
session_id: u32;
  /**
 * Current status of the game
 */
status: GameStatus;
  /**
 * Winner of the game (None until completed)
 * true = player1 won, false = player2 won
 */
winner: Option<boolean>;
}

/**
 * Error codes for the Blendizzard contract
 * 
 * All errors are represented as u32 values for efficient storage and transmission.
 * Error codes are grouped by category for better organization.
 */
export const Errors = {
  /**
   * Caller is not the admin
   */
  1: {message:"NotAdmin"},
  /**
   * Contract has already been initialized
   */
  2: {message:"AlreadyInitialized"},
  /**
   * User has insufficient balance for the requested operation
   */
  10: {message:"InsufficientBalance"},
  /**
   * User has insufficient faction points for the requested wager
   */
  11: {message:"InsufficientFactionPoints"},
  /**
   * Amount is invalid (e.g., zero or negative)
   */
  12: {message:"InvalidAmount"},
  /**
   * Faction ID is invalid (must be 0, 1, or 2)
   */
  13: {message:"InvalidFaction"},
  /**
   * User's faction is already locked for this epoch (cannot change)
   */
  14: {message:"FactionAlreadyLocked"},
  /**
   * User does not exist (no deposits or interactions yet)
   */
  15: {message:"UserNotFound"},
  /**
   * User must select a faction before playing games
   */
  16: {message:"FactionNotSelected"},
  /**
   * Game contract is not in the whitelist
   */
  20: {message:"GameNotWhitelisted"},
  /**
   * Game session was not found
   */
  21: {message:"SessionNotFound"},
  /**
   * Game session with this ID already exists
   */
  22: {message:"SessionAlreadyExists"},
  /**
   * Game session is in an invalid state for this operation
   */
  23: {message:"InvalidSessionState"},
  /**
   * Game outcome data is invalid
   */
  24: {message:"InvalidGameOutcome"},
  /**
   * Proof verification failed (ZK proof is invalid)
   */
  25: {message:"ProofVerificationFailed"},
  /**
   * Game is from a previous epoch and cannot be completed
   */
  26: {message:"GameExpired"},
  /**
   * Epoch has not been finalized yet
   */
  30: {message:"EpochNotFinalized"},
  /**
   * Epoch has already been finalized
   */
  31: {message:"EpochAlreadyFinalized"},
  /**
   * Epoch cannot be cycled yet (not enough time has passed)
   */
  32: {message:"EpochNotReady"},
  /**
   * No rewards available for this user in this epoch
   */
  40: {message:"NoRewardsAvailable"},
  /**
   * Reward has already been claimed for this epoch
   */
  41: {message:"RewardAlreadyClaimed"},
  /**
   * User was not in the winning faction for this epoch
   */
  42: {message:"NotWinningFaction"},
  /**
   * fee-vault-v2 operation failed
   */
  50: {message:"FeeVaultError"},
  /**
   * Soroswap swap operation failed
   */
  51: {message:"SwapError"},
  /**
   * Token transfer operation failed
   */
  52: {message:"TokenTransferError"},
  /**
   * Arithmetic overflow occurred
   */
  60: {message:"OverflowError"},
  /**
   * Division by zero attempted
   */
  61: {message:"DivisionByZero"},
  /**
   * Contract is paused (emergency stop activated)
   */
  70: {message:"ContractPaused"}
}











export type DataKey = {tag: "Admin", values: void} | {tag: "Config", values: void} | {tag: "CurrentEpoch", values: void} | {tag: "Paused", values: void} | {tag: "User", values: readonly [string]} | {tag: "EpochUser", values: readonly [u32, string]} | {tag: "Epoch", values: readonly [u32]} | {tag: "Session", values: readonly [u32]} | {tag: "Game", values: readonly [string]} | {tag: "Claimed", values: readonly [string, u32]};

export interface Client {
  /**
   * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pause the contract (emergency stop)
   * 
   * When paused, all user-facing functions are disabled except admin functions.
   * This is an emergency mechanism to protect user funds in case of discovered vulnerabilities.
   * 
   * # Errors
   * * `NotAdmin` - If caller is not the admin
   */
  pause: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a is_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if a contract is an approved game
   */
  is_game: ({id}: {id: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a unpause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Unpause the contract
   * 
   * Restores normal contract functionality after emergency pause.
   * 
   * # Errors
   * * `NotAdmin` - If caller is not the admin
   */
  unpause: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update the contract WASM hash (upgrade contract)
   * 
   * # Errors
   * * `NotAdmin` - If caller is not the admin
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a add_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Add a game contract to the approved list
   * 
   * # Errors
   * * `NotAdmin` - If caller is not the admin
   */
  add_game: ({id}: {id: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a end_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * End a game session with outcome verification
   * 
   * Requires game contract authorization. Both players' FP wagers are spent/burned.
   * Only the winner's wager contributes to their faction standings.
   * ZK proof verification handled client-side for MVP.
   * 
   * # Errors
   * * `SessionNotFound` - If session doesn't exist
   * * `InvalidSessionState` - If session is not Pending
   * * `InvalidGameOutcome` - If outcome data doesn't match session
   * * `ProofVerificationFailed` - If ZK proof is invalid
   */
  end_game: ({game_id, session_id, proof, outcome}: {game_id: string, session_id: u32, proof: Buffer, outcome: GameOutcome}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the admin address
   */
  get_admin: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a get_epoch transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get epoch information
   * 
   * Returns current epoch if no number specified, otherwise the specified epoch.
   * 
   * # Errors
   * * `EpochNotFinalized` - If requested epoch doesn't exist
   */
  get_epoch: ({epoch}: {epoch: Option<u32>}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<EpochInfo>>>

  /**
   * Construct and simulate a is_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if contract is paused
   */
  is_paused: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update the admin address
   * 
   * # Errors
   * * `NotAdmin` - If caller is not the current admin
   */
  set_admin: ({new_admin}: {new_admin: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the current configuration
   */
  get_config: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Config>>

  /**
   * Construct and simulate a get_player transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get player information
   * 
   * Returns complete persistent player data including selected faction, total deposited,
   * and deposit timestamp.
   * 
   * # Errors
   * * `UserNotFound` - If user has never interacted with the contract
   */
  get_player: ({user}: {user: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<User>>>

  /**
   * Construct and simulate a start_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Start a new game session
   * 
   * Locks factions and fp for both players. If this is a player's first game
   * in the epoch, initializes their fp and locks their faction.
   * 
   * # Errors
   * * `GameNotWhitelisted` - If game_id is not approved
   * * `SessionAlreadyExists` - If session_id already exists
   * * `InvalidAmount` - If wagers are <= 0
   * * `InsufficientFactionPoints` - If players don't have enough fp
   * * `ContractPaused` - If contract is in emergency pause mode
   */
  start_game: ({game_id, session_id, player1, player2, player1_wager, player2_wager}: {game_id: string, session_id: u32, player1: string, player2: string, player1_wager: i128, player2_wager: i128}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a cycle_epoch transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Cycle to the next epoch
   * 
   * Finalizes current epoch (determines winner, withdraws BLND, swaps to USDC,
   * sets reward pool) and opens next epoch.
   * 
   * # Returns
   * The new epoch number
   * 
   * # Errors
   * * `EpochNotReady` - If not enough time has passed
   * * `EpochAlreadyFinalized` - If current epoch is already finalized
   * * `FeeVaultError` - If fee-vault operations fail
   * * `SwapError` - If BLND → USDC swap fails
   */
  cycle_epoch: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a remove_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Remove a game contract from the approved list
   * 
   * # Errors
   * * `NotAdmin` - If caller is not the admin
   */
  remove_game: ({id}: {id: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a update_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update global configuration
   * 
   * Allows admin to update specific configuration parameters.
   * Only updates parameters that are provided (non-None).
   * 
   * # Arguments
   * * `new_fee_vault` - New fee-vault-v2 contract address (optional)
   * * `new_soroswap_router` - New Soroswap router contract address (optional)
   * * `new_blnd_token` - New BLND token address (optional)
   * * `new_usdc_token` - New USDC token address (optional)
   * * `new_epoch_duration` - New epoch duration in seconds (optional)
   * * `new_reserve_token_ids` - New reserve token IDs for claiming BLND emissions (optional)
   * 
   * # Errors
   * * `NotAdmin` - If caller is not the admin
   */
  update_config: ({new_fee_vault, new_soroswap_router, new_blnd_token, new_usdc_token, new_epoch_duration, new_reserve_token_ids}: {new_fee_vault: Option<string>, new_soroswap_router: Option<string>, new_blnd_token: Option<string>, new_usdc_token: Option<string>, new_epoch_duration: Option<u64>, new_reserve_token_ids: Option<Array<u32>>}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a select_faction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Select a faction for the user
   * 
   * Sets the user's persistent faction preference. Can be changed at ANY time.
   * If you haven't played a game this epoch, the new faction applies immediately.
   * If you've already played this epoch, the current epoch stays locked to your
   * old faction, and the new selection applies starting next epoch.
   * 
   * # Arguments
   * * `faction` - Faction ID (0=WholeNoodle, 1=PointyStick, 2=SpecialRock)
   * 
   * # Errors
   * * `InvalidFaction` - If faction ID is not 0, 1, or 2
   */
  select_faction: ({user, faction}: {user: string, faction: u32}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_reward_pool transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the reward pool (USDC) for a finalized epoch
   * 
   * # Errors
   * * `EpochNotFinalized` - If epoch doesn't exist or isn't finalized
   */
  get_reward_pool: ({epoch}: {epoch: u32}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a get_epoch_player transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get player's epoch-specific information
   * 
   * Returns complete epoch-specific data including locked faction, available/locked FP,
   * total FP contributed, and initial balance snapshot.
   * 
   * If the user exists but hasn't played this epoch yet, returns a valid EpochUser with:
   * - No faction locked (epoch_faction = None)
   * - Zero faction points (available_fp = 0, locked_fp = 0)
   * - No contributions (total_fp_contributed = 0)
   * - Initial balance of 0 (not yet snapshotted)
   * 
   * # Errors
   * * `UserNotFound` - If user has never interacted with the contract
   */
  get_epoch_player: ({user}: {user: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<EpochUser>>>

  /**
   * Construct and simulate a is_faction_locked transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if a user's faction is locked for the current epoch
   * 
   * Once locked (after first game), faction cannot be changed until next epoch.
   */
  is_faction_locked: ({user}: {user: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a claim_epoch_reward transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Claim epoch reward for a user for a specific epoch
   * 
   * Users who contributed FP to the winning faction can claim their share
   * of the epoch's reward pool (USDC converted from BLND yield).
   * 
   * # Returns
   * Amount of USDC claimed
   * 
   * # Errors
   * * `EpochNotFinalized` - If epoch doesn't exist or isn't finalized
   * * `RewardAlreadyClaimed` - If user already claimed for this epoch
   * * `NotWinningFaction` - If user wasn't in the winning faction
   * * `NoRewardsAvailable` - If user has no rewards to claim
   * * `ContractPaused` - If contract is in emergency pause mode
   */
  claim_epoch_reward: ({user, epoch}: {user: string, epoch: u32}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a get_winning_faction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the winning faction for a finalized epoch
   * 
   * # Errors
   * * `EpochNotFinalized` - If epoch doesn't exist or isn't finalized
   */
  get_winning_faction: ({epoch}: {epoch: u32}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a has_claimed_rewards transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if user has claimed rewards for an epoch
   */
  has_claimed_rewards: ({user, epoch}: {user: string, epoch: u32}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a get_claimable_amount transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Calculate how much a user would receive if they claimed now
   * 
   * This doesn't actually claim, just calculates the amount.
   * Useful for UIs to show pending rewards.
   * 
   * # Returns
   * Amount user would receive, or 0 if not eligible
   */
  get_claimable_amount: ({user, epoch}: {user: string, epoch: u32}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_faction_standings transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get faction standings for a specific epoch
   * 
   * Returns a map of faction ID to total faction points.
   * 
   * # Errors
   * * `EpochNotFinalized` - If epoch doesn't exist
   */
  get_faction_standings: ({epoch}: {epoch: u32}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<Map<u32, i128>>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, fee_vault, soroswap_router, blnd_token, usdc_token, epoch_duration, reserve_token_ids}: {admin: string, fee_vault: string, soroswap_router: string, blnd_token: string, usdc_token: string, epoch_duration: u64, reserve_token_ids: Array<u32>},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, fee_vault, soroswap_router, blnd_token, usdc_token, epoch_duration, reserve_token_ids}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAQBQYXVzZSB0aGUgY29udHJhY3QgKGVtZXJnZW5jeSBzdG9wKQoKV2hlbiBwYXVzZWQsIGFsbCB1c2VyLWZhY2luZyBmdW5jdGlvbnMgYXJlIGRpc2FibGVkIGV4Y2VwdCBhZG1pbiBmdW5jdGlvbnMuClRoaXMgaXMgYW4gZW1lcmdlbmN5IG1lY2hhbmlzbSB0byBwcm90ZWN0IHVzZXIgZnVuZHMgaW4gY2FzZSBvZiBkaXNjb3ZlcmVkIHZ1bG5lcmFiaWxpdGllcy4KCiMgRXJyb3JzCiogYE5vdEFkbWluYCAtIElmIGNhbGxlciBpcyBub3QgdGhlIGFkbWluAAAABXBhdXNlAAAAAAAAAAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAACdDaGVjayBpZiBhIGNvbnRyYWN0IGlzIGFuIGFwcHJvdmVkIGdhbWUAAAAAB2lzX2dhbWUAAAAAAQAAAAAAAAACaWQAAAAAABMAAAABAAAAAQ==",
        "AAAAAAAAAIdVbnBhdXNlIHRoZSBjb250cmFjdAoKUmVzdG9yZXMgbm9ybWFsIGNvbnRyYWN0IGZ1bmN0aW9uYWxpdHkgYWZ0ZXIgZW1lcmdlbmN5IHBhdXNlLgoKIyBFcnJvcnMKKiBgTm90QWRtaW5gIC0gSWYgY2FsbGVyIGlzIG5vdCB0aGUgYWRtaW4AAAAAB3VucGF1c2UAAAAAAAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAGRVcGRhdGUgdGhlIGNvbnRyYWN0IFdBU00gaGFzaCAodXBncmFkZSBjb250cmFjdCkKCiMgRXJyb3JzCiogYE5vdEFkbWluYCAtIElmIGNhbGxlciBpcyBub3QgdGhlIGFkbWluAAAAB3VwZ3JhZGUAAAAAAQAAAAAAAAANbmV3X3dhc21faGFzaAAAAAAAA+4AAAAgAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAFxBZGQgYSBnYW1lIGNvbnRyYWN0IHRvIHRoZSBhcHByb3ZlZCBsaXN0CgojIEVycm9ycwoqIGBOb3RBZG1pbmAgLSBJZiBjYWxsZXIgaXMgbm90IHRoZSBhZG1pbgAAAAhhZGRfZ2FtZQAAAAEAAAAAAAAAAmlkAAAAAAATAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAdFFbmQgYSBnYW1lIHNlc3Npb24gd2l0aCBvdXRjb21lIHZlcmlmaWNhdGlvbgoKUmVxdWlyZXMgZ2FtZSBjb250cmFjdCBhdXRob3JpemF0aW9uLiBCb3RoIHBsYXllcnMnIEZQIHdhZ2VycyBhcmUgc3BlbnQvYnVybmVkLgpPbmx5IHRoZSB3aW5uZXIncyB3YWdlciBjb250cmlidXRlcyB0byB0aGVpciBmYWN0aW9uIHN0YW5kaW5ncy4KWksgcHJvb2YgdmVyaWZpY2F0aW9uIGhhbmRsZWQgY2xpZW50LXNpZGUgZm9yIE1WUC4KCiMgRXJyb3JzCiogYFNlc3Npb25Ob3RGb3VuZGAgLSBJZiBzZXNzaW9uIGRvZXNuJ3QgZXhpc3QKKiBgSW52YWxpZFNlc3Npb25TdGF0ZWAgLSBJZiBzZXNzaW9uIGlzIG5vdCBQZW5kaW5nCiogYEludmFsaWRHYW1lT3V0Y29tZWAgLSBJZiBvdXRjb21lIGRhdGEgZG9lc24ndCBtYXRjaCBzZXNzaW9uCiogYFByb29mVmVyaWZpY2F0aW9uRmFpbGVkYCAtIElmIFpLIHByb29mIGlzIGludmFsaWQAAAAAAAAIZW5kX2dhbWUAAAAEAAAAAAAAAAdnYW1lX2lkAAAAABMAAAAAAAAACnNlc3Npb25faWQAAAAAAAQAAAAAAAAABXByb29mAAAAAAAADgAAAAAAAAAHb3V0Y29tZQAAAAfQAAAAC0dhbWVPdXRjb21lAAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAABVHZXQgdGhlIGFkbWluIGFkZHJlc3MAAAAAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAKZHZXQgZXBvY2ggaW5mb3JtYXRpb24KClJldHVybnMgY3VycmVudCBlcG9jaCBpZiBubyBudW1iZXIgc3BlY2lmaWVkLCBvdGhlcndpc2UgdGhlIHNwZWNpZmllZCBlcG9jaC4KCiMgRXJyb3JzCiogYEVwb2NoTm90RmluYWxpemVkYCAtIElmIHJlcXVlc3RlZCBlcG9jaCBkb2Vzbid0IGV4aXN0AAAAAAAJZ2V0X2Vwb2NoAAAAAAAAAQAAAAAAAAAFZXBvY2gAAAAAAAPoAAAABAAAAAEAAAPpAAAH0AAAAAlFcG9jaEluZm8AAAAAAAAD",
        "AAAAAAAAABtDaGVjayBpZiBjb250cmFjdCBpcyBwYXVzZWQAAAAACWlzX3BhdXNlZAAAAAAAAAAAAAABAAAAAQ==",
        "AAAAAAAAAFRVcGRhdGUgdGhlIGFkbWluIGFkZHJlc3MKCiMgRXJyb3JzCiogYE5vdEFkbWluYCAtIElmIGNhbGxlciBpcyBub3QgdGhlIGN1cnJlbnQgYWRtaW4AAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAB1HZXQgdGhlIGN1cnJlbnQgY29uZmlndXJhdGlvbgAAAAAAAApnZXRfY29uZmlnAAAAAAAAAAAAAQAAB9AAAAAGQ29uZmlnAAA=",
        "AAAAAAAAAM9HZXQgcGxheWVyIGluZm9ybWF0aW9uCgpSZXR1cm5zIGNvbXBsZXRlIHBlcnNpc3RlbnQgcGxheWVyIGRhdGEgaW5jbHVkaW5nIHNlbGVjdGVkIGZhY3Rpb24sIHRvdGFsIGRlcG9zaXRlZCwKYW5kIGRlcG9zaXQgdGltZXN0YW1wLgoKIyBFcnJvcnMKKiBgVXNlck5vdEZvdW5kYCAtIElmIHVzZXIgaGFzIG5ldmVyIGludGVyYWN0ZWQgd2l0aCB0aGUgY29udHJhY3QAAAAACmdldF9wbGF5ZXIAAAAAAAEAAAAAAAAABHVzZXIAAAATAAAAAQAAA+kAAAfQAAAABFVzZXIAAAAD",
        "AAAAAAAAAbdTdGFydCBhIG5ldyBnYW1lIHNlc3Npb24KCkxvY2tzIGZhY3Rpb25zIGFuZCBmcCBmb3IgYm90aCBwbGF5ZXJzLiBJZiB0aGlzIGlzIGEgcGxheWVyJ3MgZmlyc3QgZ2FtZQppbiB0aGUgZXBvY2gsIGluaXRpYWxpemVzIHRoZWlyIGZwIGFuZCBsb2NrcyB0aGVpciBmYWN0aW9uLgoKIyBFcnJvcnMKKiBgR2FtZU5vdFdoaXRlbGlzdGVkYCAtIElmIGdhbWVfaWQgaXMgbm90IGFwcHJvdmVkCiogYFNlc3Npb25BbHJlYWR5RXhpc3RzYCAtIElmIHNlc3Npb25faWQgYWxyZWFkeSBleGlzdHMKKiBgSW52YWxpZEFtb3VudGAgLSBJZiB3YWdlcnMgYXJlIDw9IDAKKiBgSW5zdWZmaWNpZW50RmFjdGlvblBvaW50c2AgLSBJZiBwbGF5ZXJzIGRvbid0IGhhdmUgZW5vdWdoIGZwCiogYENvbnRyYWN0UGF1c2VkYCAtIElmIGNvbnRyYWN0IGlzIGluIGVtZXJnZW5jeSBwYXVzZSBtb2RlAAAAAApzdGFydF9nYW1lAAAAAAAGAAAAAAAAAAdnYW1lX2lkAAAAABMAAAAAAAAACnNlc3Npb25faWQAAAAAAAQAAAAAAAAAB3BsYXllcjEAAAAAEwAAAAAAAAAHcGxheWVyMgAAAAATAAAAAAAAAA1wbGF5ZXIxX3dhZ2VyAAAAAAAACwAAAAAAAAANcGxheWVyMl93YWdlcgAAAAAAAAsAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAYZDeWNsZSB0byB0aGUgbmV4dCBlcG9jaAoKRmluYWxpemVzIGN1cnJlbnQgZXBvY2ggKGRldGVybWluZXMgd2lubmVyLCB3aXRoZHJhd3MgQkxORCwgc3dhcHMgdG8gVVNEQywKc2V0cyByZXdhcmQgcG9vbCkgYW5kIG9wZW5zIG5leHQgZXBvY2guCgojIFJldHVybnMKVGhlIG5ldyBlcG9jaCBudW1iZXIKCiMgRXJyb3JzCiogYEVwb2NoTm90UmVhZHlgIC0gSWYgbm90IGVub3VnaCB0aW1lIGhhcyBwYXNzZWQKKiBgRXBvY2hBbHJlYWR5RmluYWxpemVkYCAtIElmIGN1cnJlbnQgZXBvY2ggaXMgYWxyZWFkeSBmaW5hbGl6ZWQKKiBgRmVlVmF1bHRFcnJvcmAgLSBJZiBmZWUtdmF1bHQgb3BlcmF0aW9ucyBmYWlsCiogYFN3YXBFcnJvcmAgLSBJZiBCTE5EIOKGkiBVU0RDIHN3YXAgZmFpbHMAAAAAAAtjeWNsZV9lcG9jaAAAAAAAAAAAAQAAA+kAAAAEAAAAAw==",
        "AAAAAAAAAGFSZW1vdmUgYSBnYW1lIGNvbnRyYWN0IGZyb20gdGhlIGFwcHJvdmVkIGxpc3QKCiMgRXJyb3JzCiogYE5vdEFkbWluYCAtIElmIGNhbGxlciBpcyBub3QgdGhlIGFkbWluAAAAAAAAC3JlbW92ZV9nYW1lAAAAAAEAAAAAAAAAAmlkAAAAAAATAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAnRJbml0aWFsaXplIHRoZSBjb250cmFjdAoKU2V0cyB1cCB0aGUgYWRtaW4sIGV4dGVybmFsIGNvbnRyYWN0IGFkZHJlc3NlcywgYW5kIGNyZWF0ZXMgdGhlIGZpcnN0IGVwb2NoLgoKIyBBcmd1bWVudHMKKiBgYWRtaW5gIC0gQWRtaW4gYWRkcmVzcyAoY2FuIG1vZGlmeSBjb25maWcgYW5kIHVwZ3JhZGUgY29udHJhY3QpCiogYGZlZV92YXVsdGAgLSBmZWUtdmF1bHQtdjIgY29udHJhY3QgYWRkcmVzcwoqIGBzb3Jvc3dhcF9yb3V0ZXJgIC0gU29yb3N3YXAgcm91dGVyIGNvbnRyYWN0IGFkZHJlc3MKKiBgYmxuZF90b2tlbmAgLSBCTE5EIHRva2VuIGFkZHJlc3MKKiBgdXNkY190b2tlbmAgLSBVU0RDIHRva2VuIGFkZHJlc3MKKiBgZXBvY2hfZHVyYXRpb25gIC0gRHVyYXRpb24gb2YgZWFjaCBlcG9jaCBpbiBzZWNvbmRzIChkZWZhdWx0OiAzNDUsNjAwID0gNCBkYXlzKQoqIGByZXNlcnZlX3Rva2VuX2lkc2AgLSBSZXNlcnZlIHRva2VuIElEcyBmb3IgY2xhaW1pbmcgQkxORCBlbWlzc2lvbnMgKGUuZy4sIHZlYyFbJmVudiwgMV0gZm9yIHJlc2VydmUgMCBiLXRva2VucykKCiMgRXJyb3JzCiogYEFscmVhZHlJbml0aWFsaXplZGAgLSBJZiBjb250cmFjdCBoYXMgYWxyZWFkeSBiZWVuIGluaXRpYWxpemVkAAAADV9fY29uc3RydWN0b3IAAAAAAAAHAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAACWZlZV92YXVsdAAAAAAAABMAAAAAAAAAD3Nvcm9zd2FwX3JvdXRlcgAAAAATAAAAAAAAAApibG5kX3Rva2VuAAAAAAATAAAAAAAAAAp1c2RjX3Rva2VuAAAAAAATAAAAAAAAAA5lcG9jaF9kdXJhdGlvbgAAAAAABgAAAAAAAAARcmVzZXJ2ZV90b2tlbl9pZHMAAAAAAAPqAAAABAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAmFVcGRhdGUgZ2xvYmFsIGNvbmZpZ3VyYXRpb24KCkFsbG93cyBhZG1pbiB0byB1cGRhdGUgc3BlY2lmaWMgY29uZmlndXJhdGlvbiBwYXJhbWV0ZXJzLgpPbmx5IHVwZGF0ZXMgcGFyYW1ldGVycyB0aGF0IGFyZSBwcm92aWRlZCAobm9uLU5vbmUpLgoKIyBBcmd1bWVudHMKKiBgbmV3X2ZlZV92YXVsdGAgLSBOZXcgZmVlLXZhdWx0LXYyIGNvbnRyYWN0IGFkZHJlc3MgKG9wdGlvbmFsKQoqIGBuZXdfc29yb3N3YXBfcm91dGVyYCAtIE5ldyBTb3Jvc3dhcCByb3V0ZXIgY29udHJhY3QgYWRkcmVzcyAob3B0aW9uYWwpCiogYG5ld19ibG5kX3Rva2VuYCAtIE5ldyBCTE5EIHRva2VuIGFkZHJlc3MgKG9wdGlvbmFsKQoqIGBuZXdfdXNkY190b2tlbmAgLSBOZXcgVVNEQyB0b2tlbiBhZGRyZXNzIChvcHRpb25hbCkKKiBgbmV3X2Vwb2NoX2R1cmF0aW9uYCAtIE5ldyBlcG9jaCBkdXJhdGlvbiBpbiBzZWNvbmRzIChvcHRpb25hbCkKKiBgbmV3X3Jlc2VydmVfdG9rZW5faWRzYCAtIE5ldyByZXNlcnZlIHRva2VuIElEcyBmb3IgY2xhaW1pbmcgQkxORCBlbWlzc2lvbnMgKG9wdGlvbmFsKQoKIyBFcnJvcnMKKiBgTm90QWRtaW5gIC0gSWYgY2FsbGVyIGlzIG5vdCB0aGUgYWRtaW4AAAAAAAANdXBkYXRlX2NvbmZpZwAAAAAAAAYAAAAAAAAADW5ld19mZWVfdmF1bHQAAAAAAAPoAAAAEwAAAAAAAAATbmV3X3Nvcm9zd2FwX3JvdXRlcgAAAAPoAAAAEwAAAAAAAAAObmV3X2JsbmRfdG9rZW4AAAAAA+gAAAATAAAAAAAAAA5uZXdfdXNkY190b2tlbgAAAAAD6AAAABMAAAAAAAAAEm5ld19lcG9jaF9kdXJhdGlvbgAAAAAD6AAAAAYAAAAAAAAAFW5ld19yZXNlcnZlX3Rva2VuX2lkcwAAAAAAA+gAAAPqAAAABAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAdZTZWxlY3QgYSBmYWN0aW9uIGZvciB0aGUgdXNlcgoKU2V0cyB0aGUgdXNlcidzIHBlcnNpc3RlbnQgZmFjdGlvbiBwcmVmZXJlbmNlLiBDYW4gYmUgY2hhbmdlZCBhdCBBTlkgdGltZS4KSWYgeW91IGhhdmVuJ3QgcGxheWVkIGEgZ2FtZSB0aGlzIGVwb2NoLCB0aGUgbmV3IGZhY3Rpb24gYXBwbGllcyBpbW1lZGlhdGVseS4KSWYgeW91J3ZlIGFscmVhZHkgcGxheWVkIHRoaXMgZXBvY2gsIHRoZSBjdXJyZW50IGVwb2NoIHN0YXlzIGxvY2tlZCB0byB5b3VyCm9sZCBmYWN0aW9uLCBhbmQgdGhlIG5ldyBzZWxlY3Rpb24gYXBwbGllcyBzdGFydGluZyBuZXh0IGVwb2NoLgoKIyBBcmd1bWVudHMKKiBgZmFjdGlvbmAgLSBGYWN0aW9uIElEICgwPVdob2xlTm9vZGxlLCAxPVBvaW50eVN0aWNrLCAyPVNwZWNpYWxSb2NrKQoKIyBFcnJvcnMKKiBgSW52YWxpZEZhY3Rpb25gIC0gSWYgZmFjdGlvbiBJRCBpcyBub3QgMCwgMSwgb3IgMgAAAAAADnNlbGVjdF9mYWN0aW9uAAAAAAACAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAHZmFjdGlvbgAAAAAEAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAHxHZXQgdGhlIHJld2FyZCBwb29sIChVU0RDKSBmb3IgYSBmaW5hbGl6ZWQgZXBvY2gKCiMgRXJyb3JzCiogYEVwb2NoTm90RmluYWxpemVkYCAtIElmIGVwb2NoIGRvZXNuJ3QgZXhpc3Qgb3IgaXNuJ3QgZmluYWxpemVkAAAAD2dldF9yZXdhcmRfcG9vbAAAAAABAAAAAAAAAAVlcG9jaAAAAAAAAAQAAAABAAAD6QAAAAsAAAAD",
        "AAAAAAAAAhBHZXQgcGxheWVyJ3MgZXBvY2gtc3BlY2lmaWMgaW5mb3JtYXRpb24KClJldHVybnMgY29tcGxldGUgZXBvY2gtc3BlY2lmaWMgZGF0YSBpbmNsdWRpbmcgbG9ja2VkIGZhY3Rpb24sIGF2YWlsYWJsZS9sb2NrZWQgRlAsCnRvdGFsIEZQIGNvbnRyaWJ1dGVkLCBhbmQgaW5pdGlhbCBiYWxhbmNlIHNuYXBzaG90LgoKSWYgdGhlIHVzZXIgZXhpc3RzIGJ1dCBoYXNuJ3QgcGxheWVkIHRoaXMgZXBvY2ggeWV0LCByZXR1cm5zIGEgdmFsaWQgRXBvY2hVc2VyIHdpdGg6Ci0gTm8gZmFjdGlvbiBsb2NrZWQgKGVwb2NoX2ZhY3Rpb24gPSBOb25lKQotIFplcm8gZmFjdGlvbiBwb2ludHMgKGF2YWlsYWJsZV9mcCA9IDAsIGxvY2tlZF9mcCA9IDApCi0gTm8gY29udHJpYnV0aW9ucyAodG90YWxfZnBfY29udHJpYnV0ZWQgPSAwKQotIEluaXRpYWwgYmFsYW5jZSBvZiAwIChub3QgeWV0IHNuYXBzaG90dGVkKQoKIyBFcnJvcnMKKiBgVXNlck5vdEZvdW5kYCAtIElmIHVzZXIgaGFzIG5ldmVyIGludGVyYWN0ZWQgd2l0aCB0aGUgY29udHJhY3QAAAAQZ2V0X2Vwb2NoX3BsYXllcgAAAAEAAAAAAAAABHVzZXIAAAATAAAAAQAAA+kAAAfQAAAACUVwb2NoVXNlcgAAAAAAAAM=",
        "AAAAAAAAAIZDaGVjayBpZiBhIHVzZXIncyBmYWN0aW9uIGlzIGxvY2tlZCBmb3IgdGhlIGN1cnJlbnQgZXBvY2gKCk9uY2UgbG9ja2VkIChhZnRlciBmaXJzdCBnYW1lKSwgZmFjdGlvbiBjYW5ub3QgYmUgY2hhbmdlZCB1bnRpbCBuZXh0IGVwb2NoLgAAAAAAEWlzX2ZhY3Rpb25fbG9ja2VkAAAAAAAAAQAAAAAAAAAEdXNlcgAAABMAAAABAAAAAQ==",
        "AAAAAAAAAhlDbGFpbSBlcG9jaCByZXdhcmQgZm9yIGEgdXNlciBmb3IgYSBzcGVjaWZpYyBlcG9jaAoKVXNlcnMgd2hvIGNvbnRyaWJ1dGVkIEZQIHRvIHRoZSB3aW5uaW5nIGZhY3Rpb24gY2FuIGNsYWltIHRoZWlyIHNoYXJlCm9mIHRoZSBlcG9jaCdzIHJld2FyZCBwb29sIChVU0RDIGNvbnZlcnRlZCBmcm9tIEJMTkQgeWllbGQpLgoKIyBSZXR1cm5zCkFtb3VudCBvZiBVU0RDIGNsYWltZWQKCiMgRXJyb3JzCiogYEVwb2NoTm90RmluYWxpemVkYCAtIElmIGVwb2NoIGRvZXNuJ3QgZXhpc3Qgb3IgaXNuJ3QgZmluYWxpemVkCiogYFJld2FyZEFscmVhZHlDbGFpbWVkYCAtIElmIHVzZXIgYWxyZWFkeSBjbGFpbWVkIGZvciB0aGlzIGVwb2NoCiogYE5vdFdpbm5pbmdGYWN0aW9uYCAtIElmIHVzZXIgd2Fzbid0IGluIHRoZSB3aW5uaW5nIGZhY3Rpb24KKiBgTm9SZXdhcmRzQXZhaWxhYmxlYCAtIElmIHVzZXIgaGFzIG5vIHJld2FyZHMgdG8gY2xhaW0KKiBgQ29udHJhY3RQYXVzZWRgIC0gSWYgY29udHJhY3QgaXMgaW4gZW1lcmdlbmN5IHBhdXNlIG1vZGUAAAAAAAASY2xhaW1fZXBvY2hfcmV3YXJkAAAAAAACAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAFZXBvY2gAAAAAAAAEAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAAHlHZXQgdGhlIHdpbm5pbmcgZmFjdGlvbiBmb3IgYSBmaW5hbGl6ZWQgZXBvY2gKCiMgRXJyb3JzCiogYEVwb2NoTm90RmluYWxpemVkYCAtIElmIGVwb2NoIGRvZXNuJ3QgZXhpc3Qgb3IgaXNuJ3QgZmluYWxpemVkAAAAAAAAE2dldF93aW5uaW5nX2ZhY3Rpb24AAAAAAQAAAAAAAAAFZXBvY2gAAAAAAAAEAAAAAQAAA+kAAAAEAAAAAw==",
        "AAAAAAAAAC5DaGVjayBpZiB1c2VyIGhhcyBjbGFpbWVkIHJld2FyZHMgZm9yIGFuIGVwb2NoAAAAAAATaGFzX2NsYWltZWRfcmV3YXJkcwAAAAACAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAFZXBvY2gAAAAAAAAEAAAAAQAAAAE=",
        "AAAAAAAAANhDYWxjdWxhdGUgaG93IG11Y2ggYSB1c2VyIHdvdWxkIHJlY2VpdmUgaWYgdGhleSBjbGFpbWVkIG5vdwoKVGhpcyBkb2Vzbid0IGFjdHVhbGx5IGNsYWltLCBqdXN0IGNhbGN1bGF0ZXMgdGhlIGFtb3VudC4KVXNlZnVsIGZvciBVSXMgdG8gc2hvdyBwZW5kaW5nIHJld2FyZHMuCgojIFJldHVybnMKQW1vdW50IHVzZXIgd291bGQgcmVjZWl2ZSwgb3IgMCBpZiBub3QgZWxpZ2libGUAAAAUZ2V0X2NsYWltYWJsZV9hbW91bnQAAAACAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAFZXBvY2gAAAAAAAAEAAAAAQAAAAs=",
        "AAAAAAAAAJlHZXQgZmFjdGlvbiBzdGFuZGluZ3MgZm9yIGEgc3BlY2lmaWMgZXBvY2gKClJldHVybnMgYSBtYXAgb2YgZmFjdGlvbiBJRCB0byB0b3RhbCBmYWN0aW9uIHBvaW50cy4KCiMgRXJyb3JzCiogYEVwb2NoTm90RmluYWxpemVkYCAtIElmIGVwb2NoIGRvZXNuJ3QgZXhpc3QAAAAAAAAVZ2V0X2ZhY3Rpb25fc3RhbmRpbmdzAAAAAAAAAQAAAAAAAAAFZXBvY2gAAAAAAAAEAAAAAQAAA+kAAAPsAAAABAAAAAsAAAAD",
        "AAAAAQAAAJNQZXJzaXN0ZW50IHVzZXIgZGF0YSAoYWNyb3NzIGFsbCBlcG9jaHMpCgpTdG9yZXMgdGhlIHVzZXIncyBmYWN0aW9uIHByZWZlcmVuY2UgYW5kIHRpbWUgbXVsdGlwbGllciB0cmFja2luZy4KVGhpcyBwZXJzaXN0cyBhY3Jvc3MgZXBvY2ggYm91bmRhcmllcy4AAAAAAAAAAARVc2VyAAAAAwAAAHdVc2VyJ3MgdmF1bHQgYmFsYW5jZSBmcm9tIHRoZSBwcmV2aW91cyBlcG9jaCAoZm9yIGNyb3NzLWVwb2NoIGNvbXBhcmlzb24pClVzZWQgdG8gZGV0ZWN0ID41MCUgd2l0aGRyYXdhbCBiZXR3ZWVuIGVwb2NocwAAAAASbGFzdF9lcG9jaF9iYWxhbmNlAAAAAAALAAAAR1RoZSB1c2VyJ3MgcGVyc2lzdGVudCBmYWN0aW9uIHNlbGVjdGlvbiAoY2FuIGJlIGNoYW5nZWQgYmV0d2VlbiBlcG9jaHMpAAAAABBzZWxlY3RlZF9mYWN0aW9uAAAABAAAALBUaW1lc3RhbXAgd2hlbiB0aGUgdGltZSBtdWx0aXBsaWVyIGNhbGN1bGF0aW9uIHN0YXJ0ZWQKU2V0IHdoZW4gdXNlciBwbGF5cyB0aGVpciBmaXJzdCBnYW1lICh3aXRoIHZhdWx0IGJhbGFuY2UgPiAwKQpSZXNldCB0byBjdXJyZW50IHRpbWUgaWYgdXNlciB3aXRoZHJhd3MgPjUwJSBiZXR3ZWVuIGVwb2NocwAAABV0aW1lX211bHRpcGxpZXJfc3RhcnQAAAAAAAAG",
        "AAAAAQAAAOhHbG9iYWwgY29uZmlndXJhdGlvbgoKU3RvcmVzIGNvbnRyYWN0IGNvbmZpZ3VyYXRpb24gcGFyYW1ldGVycy4KTm90ZTogQWRtaW4gYWRkcmVzcyBpcyBzdG9yZWQgc2VwYXJhdGVseSB2aWEgRGF0YUtleTo6QWRtaW4gZm9yIHNpbmdsZSBzb3VyY2Ugb2YgdHJ1dGguCk5vdGU6IFBhdXNlIHN0YXRlIGlzIHN0b3JlZCBzZXBhcmF0ZWx5IHZpYSBEYXRhS2V5OjpQYXVzZWQgZm9yIGVmZmljaWVudCBhY2Nlc3MuAAAAAAAAAAZDb25maWcAAAAAAAYAAAASQkxORCB0b2tlbiBhZGRyZXNzAAAAAAAKYmxuZF90b2tlbgAAAAAAEwAAAEVEdXJhdGlvbiBvZiBlYWNoIGVwb2NoIGluIHNlY29uZHMgKGRlZmF1bHQ6IDQgZGF5cyA9IDM0NSw2MDAgc2Vjb25kcykAAAAAAAAOZXBvY2hfZHVyYXRpb24AAAAAAAYAAAAdZmVlLXZhdWx0LXYyIGNvbnRyYWN0IGFkZHJlc3MAAAAAAAAJZmVlX3ZhdWx0AAAAAAAAEwAAAM5SZXNlcnZlIHRva2VuIElEcyBmb3IgY2xhaW1pbmcgQkxORCBlbWlzc2lvbnMgZnJvbSBCbGVuZCBwb29sCkZvcm11bGE6IHJlc2VydmVfaW5kZXggKiAyICsgdG9rZW5fdHlwZQp0b2tlbl90eXBlOiAwID0gZGVidCB0b2tlbiwgMSA9IGItdG9rZW4gKHN1cHBsaWVycykKRXhhbXBsZTogRm9yIHJlc2VydmUgMCBiLXRva2VucyAoc3VwcGxpZXJzKSwgdXNlIFsxXQAAAAAAEXJlc2VydmVfdG9rZW5faWRzAAAAAAAD6gAAAAQAAAAgU29yb3N3YXAgcm91dGVyIGNvbnRyYWN0IGFkZHJlc3MAAAAPc29yb3N3YXBfcm91dGVyAAAAABMAAAASVVNEQyB0b2tlbiBhZGRyZXNzAAAAAAAKdXNkY190b2tlbgAAAAAAEw==",
        "AAAAAQAAAF9FcG9jaCBtZXRhZGF0YQoKU3RvcmVzIGFsbCBpbmZvcm1hdGlvbiBhYm91dCBhbiBlcG9jaCBpbmNsdWRpbmcgdGltaW5nLCBzdGFuZGluZ3MsIGFuZCByZXdhcmRzLgAAAAAAAAAACUVwb2NoSW5mbwAAAAAAAAcAAABBVW5peCB0aW1lc3RhbXAgd2hlbiB0aGlzIGVwb2NoIGVuZHMgKHN0YXJ0X3RpbWUgKyBlcG9jaF9kdXJhdGlvbikAAAAAAAAIZW5kX3RpbWUAAAAGAAAAKVRoZSBzZXF1ZW50aWFsIGVwb2NoIG51bWJlciAoc3RhcnRzIGF0IDApAAAAAAAADGVwb2NoX251bWJlcgAAAAQAAABeTWFwIG9mIGZhY3Rpb25faWQgLT4gdG90YWwgZnAgY29udHJpYnV0ZWQgYnkgYWxsIHBsYXllcnMKVXNlZCB0byBkZXRlcm1pbmUgdGhlIHdpbm5pbmcgZmFjdGlvbgAAAAAAEWZhY3Rpb25fc3RhbmRpbmdzAAAAAAAD7AAAAAQAAAALAAAAMFRydWUgaWYgZXBvY2ggaGFzIGJlZW4gZmluYWxpemVkIHZpYSBjeWNsZV9lcG9jaAAAAAxpc19maW5hbGl6ZWQAAAABAAAARVRvdGFsIFVTREMgYXZhaWxhYmxlIGZvciByZXdhcmQgZGlzdHJpYnV0aW9uIChzZXQgZHVyaW5nIGN5Y2xlX2Vwb2NoKQAAAAAAAAtyZXdhcmRfcG9vbAAAAAALAAAAJlVuaXggdGltZXN0YW1wIHdoZW4gdGhpcyBlcG9jaCBzdGFydGVkAAAAAAAKc3RhcnRfdGltZQAAAAAABgAAADNUaGUgd2lubmluZyBmYWN0aW9uIChOb25lIHVudGlsIGVwb2NoIGlzIGZpbmFsaXplZCkAAAAAD3dpbm5pbmdfZmFjdGlvbgAAAAPoAAAABA==",
        "AAAAAQAAANZQZXItZXBvY2ggdXNlciBkYXRhCgpDcmVhdGVkIHdoZW4gYSB1c2VyIGZpcnN0IGludGVyYWN0cyB3aXRoIHRoZSBjb250cmFjdCBpbiBhIG5ldyBlcG9jaC4KVHJhY2tzIGZhY3Rpb24gcG9pbnRzIGFuZCBlcG9jaC1zcGVjaWZpYyBmYWN0aW9uIGxvY2suCkZQIGlzIGNhbGN1bGF0ZWQgb25jZSBhdCBmaXJzdCBnYW1lIG9mIGVwb2NoIGJhc2VkIG9uIHZhdWx0IGJhbGFuY2UuAAAAAAAAAAAACUVwb2NoVXNlcgAAAAAAAAUAAAB4QXZhaWxhYmxlIGZhY3Rpb24gcG9pbnRzIChub3QgbG9ja2VkIGluIGdhbWVzKQpDYWxjdWxhdGVkIG9uY2UgYXQgZmlyc3QgZ2FtZSBvZiBlcG9jaCBhbmQgcmVtYWlucyB2YWxpZCB1bnRpbCBuZXh0IGVwb2NoAAAADGF2YWlsYWJsZV9mcAAAAAsAAAB2VXNlcidzIHZhdWx0IGJhbGFuY2Ugc25hcHNob3QgYXQgZmlyc3QgZ2FtZSBvZiB0aGlzIGVwb2NoCkNhcHR1cmVzIHRoZSB2YXVsdCBiYWxhbmNlIHVzZWQgdG8gY2FsY3VsYXRlIHRoaXMgZXBvY2gncyBGUAAAAAAAFmVwb2NoX2JhbGFuY2Vfc25hcHNob3QAAAAAAAsAAABsVGhlIGZhY3Rpb24gbG9ja2VkIGluIGZvciB0aGlzIGVwb2NoIChsb2NrZWQgb24gZmlyc3QgZ2FtZSkKTm9uZSA9IG5vdCB5ZXQgbG9ja2VkLCBTb21lKGZhY3Rpb25faWQpID0gbG9ja2VkAAAADWVwb2NoX2ZhY3Rpb24AAAAAAAPoAAAABAAAAC9GYWN0aW9uIHBvaW50cyBjdXJyZW50bHkgbG9ja2VkIGluIGFjdGl2ZSBnYW1lcwAAAAAJbG9ja2VkX2ZwAAAAAAAACwAAAGpUb3RhbCBmYWN0aW9uIHBvaW50cyBjb250cmlidXRlZCB0byB0aGUgdXNlcidzIGZhY3Rpb24gdGhpcyBlcG9jaApVc2VkIGZvciByZXdhcmQgZGlzdHJpYnV0aW9uIGNhbGN1bGF0aW9uAAAAAAAUdG90YWxfZnBfY29udHJpYnV0ZWQAAAAL",
        "AAAAAgAAABNHYW1lIHNlc3Npb24gc3RhdHVzAAAAAAAAAAAKR2FtZVN0YXR1cwAAAAAAAwAAAAAAAAAmR2FtZSBoYXMgc3RhcnRlZCBidXQgbm90IHlldCBjb21wbGV0ZWQAAAAAAAdQZW5kaW5nAAAAAAAAAAAqR2FtZSBoYXMgY29tcGxldGVkIHdpdGggYSB2ZXJpZmllZCBvdXRjb21lAAAAAAAJQ29tcGxldGVkAAAAAAAAAAAAACJHYW1lIHdhcyBjYW5jZWxsZWQgKGUuZy4sIHRpbWVvdXQpAAAAAAAJQ2FuY2VsbGVkAAAA",
        "AAAAAQAAAKpHYW1lIG91dGNvbWUgZm9yIHZlcmlmaWNhdGlvbgoKVGhpcyBpcyB0aGUgZGF0YSBzdHJ1Y3R1cmUgdGhhdCBzaG91bGQgYmUgcHJvdmVuIGJ5IHRoZSBaSyBwcm9vZi4KVGhlIHByb29mIHZlcmlmaWVzIHRoYXQgdGhlc2UgdmFsdWVzIGFyZSBjb3JyZWN0IGJhc2VkIG9uIGdhbWUgZXhlY3V0aW9uLgAAAAAAAAAAAAtHYW1lT3V0Y29tZQAAAAAFAAAAFUdhbWUgY29udHJhY3QgYWRkcmVzcwAAAAAAAAdnYW1lX2lkAAAAABMAAAAWRmlyc3QgcGxheWVyJ3MgYWRkcmVzcwAAAAAAB3BsYXllcjEAAAAAEwAAABdTZWNvbmQgcGxheWVyJ3MgYWRkcmVzcwAAAAAHcGxheWVyMgAAAAATAAAAGVVuaXF1ZSBzZXNzaW9uIGlkZW50aWZpZXIAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAADpXaW5uZXIgb2YgdGhlIGdhbWUKdHJ1ZSA9IHBsYXllcjEgd29uLCBmYWxzZSA9IHBsYXllcjIgd29uAAAAAAAGd2lubmVyAAAAAAAB",
        "AAAAAQAAAIZHYW1lIHNlc3Npb24gdHJhY2tpbmcKCkNyZWF0ZWQgd2hlbiBhIGdhbWUgc3RhcnRzLCB1cGRhdGVkIHdoZW4gaXQgZW5kcy4KVHJhY2tzIGFsbCBnYW1lIHN0YXRlIGluY2x1ZGluZyBwbGF5ZXJzLCB3YWdlcnMsIGFuZCBvdXRjb21lLgAAAAAAAAAAAAtHYW1lU2Vzc2lvbgAAAAAKAAAAH1RpbWVzdGFtcCB3aGVuIGdhbWUgd2FzIGNyZWF0ZWQAAAAACmNyZWF0ZWRfYXQAAAAAAAYAAABgRXBvY2ggd2hlbiB0aGlzIGdhbWUgd2FzIGNyZWF0ZWQKVXNlZCB0byBwcmV2ZW50IGdhbWVzIGZyb20gYmVpbmcgY29tcGxldGVkIGluIGEgZGlmZmVyZW50IGVwb2NoAAAACGVwb2NoX2lkAAAABAAAABxBZGRyZXNzIG9mIHRoZSBnYW1lIGNvbnRyYWN0AAAAB2dhbWVfaWQAAAAAEwAAABZGaXJzdCBwbGF5ZXIncyBhZGRyZXNzAAAAAAAHcGxheWVyMQAAAAATAAAAIUZhY3Rpb24gcG9pbnRzIHdhZ2VyZWQgYnkgcGxheWVyMQAAAAAAAA1wbGF5ZXIxX3dhZ2VyAAAAAAAACwAAABdTZWNvbmQgcGxheWVyJ3MgYWRkcmVzcwAAAAAHcGxheWVyMgAAAAATAAAAIUZhY3Rpb24gcG9pbnRzIHdhZ2VyZWQgYnkgcGxheWVyMgAAAAAAAA1wbGF5ZXIyX3dhZ2VyAAAAAAAACwAAADBVbmlxdWUgc2Vzc2lvbiBpZGVudGlmaWVyIGZvciB0aGlzIGdhbWUgaW5zdGFuY2UAAAAKc2Vzc2lvbl9pZAAAAAAABAAAABpDdXJyZW50IHN0YXR1cyBvZiB0aGUgZ2FtZQAAAAAABnN0YXR1cwAAAAAH0AAAAApHYW1lU3RhdHVzAAAAAABRV2lubmVyIG9mIHRoZSBnYW1lIChOb25lIHVudGlsIGNvbXBsZXRlZCkKdHJ1ZSA9IHBsYXllcjEgd29uLCBmYWxzZSA9IHBsYXllcjIgd29uAAAAAAAABndpbm5lcgAAAAAD6AAAAAE=",
        "AAAABAAAALdFcnJvciBjb2RlcyBmb3IgdGhlIEJsZW5kaXp6YXJkIGNvbnRyYWN0CgpBbGwgZXJyb3JzIGFyZSByZXByZXNlbnRlZCBhcyB1MzIgdmFsdWVzIGZvciBlZmZpY2llbnQgc3RvcmFnZSBhbmQgdHJhbnNtaXNzaW9uLgpFcnJvciBjb2RlcyBhcmUgZ3JvdXBlZCBieSBjYXRlZ29yeSBmb3IgYmV0dGVyIG9yZ2FuaXphdGlvbi4AAAAAAAAAAAVFcnJvcgAAAAAAABwAAAAXQ2FsbGVyIGlzIG5vdCB0aGUgYWRtaW4AAAAACE5vdEFkbWluAAAAAQAAACVDb250cmFjdCBoYXMgYWxyZWFkeSBiZWVuIGluaXRpYWxpemVkAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAgAAADlVc2VyIGhhcyBpbnN1ZmZpY2llbnQgYmFsYW5jZSBmb3IgdGhlIHJlcXVlc3RlZCBvcGVyYXRpb24AAAAAAAATSW5zdWZmaWNpZW50QmFsYW5jZQAAAAAKAAAAPFVzZXIgaGFzIGluc3VmZmljaWVudCBmYWN0aW9uIHBvaW50cyBmb3IgdGhlIHJlcXVlc3RlZCB3YWdlcgAAABlJbnN1ZmZpY2llbnRGYWN0aW9uUG9pbnRzAAAAAAAACwAAACpBbW91bnQgaXMgaW52YWxpZCAoZS5nLiwgemVybyBvciBuZWdhdGl2ZSkAAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAADAAAACpGYWN0aW9uIElEIGlzIGludmFsaWQgKG11c3QgYmUgMCwgMSwgb3IgMikAAAAAAA5JbnZhbGlkRmFjdGlvbgAAAAAADQAAAD9Vc2VyJ3MgZmFjdGlvbiBpcyBhbHJlYWR5IGxvY2tlZCBmb3IgdGhpcyBlcG9jaCAoY2Fubm90IGNoYW5nZSkAAAAAFEZhY3Rpb25BbHJlYWR5TG9ja2VkAAAADgAAADVVc2VyIGRvZXMgbm90IGV4aXN0IChubyBkZXBvc2l0cyBvciBpbnRlcmFjdGlvbnMgeWV0KQAAAAAAAAxVc2VyTm90Rm91bmQAAAAPAAAAL1VzZXIgbXVzdCBzZWxlY3QgYSBmYWN0aW9uIGJlZm9yZSBwbGF5aW5nIGdhbWVzAAAAABJGYWN0aW9uTm90U2VsZWN0ZWQAAAAAABAAAAAlR2FtZSBjb250cmFjdCBpcyBub3QgaW4gdGhlIHdoaXRlbGlzdAAAAAAAABJHYW1lTm90V2hpdGVsaXN0ZWQAAAAAABQAAAAaR2FtZSBzZXNzaW9uIHdhcyBub3QgZm91bmQAAAAAAA9TZXNzaW9uTm90Rm91bmQAAAAAFQAAAChHYW1lIHNlc3Npb24gd2l0aCB0aGlzIElEIGFscmVhZHkgZXhpc3RzAAAAFFNlc3Npb25BbHJlYWR5RXhpc3RzAAAAFgAAADZHYW1lIHNlc3Npb24gaXMgaW4gYW4gaW52YWxpZCBzdGF0ZSBmb3IgdGhpcyBvcGVyYXRpb24AAAAAABNJbnZhbGlkU2Vzc2lvblN0YXRlAAAAABcAAAAcR2FtZSBvdXRjb21lIGRhdGEgaXMgaW52YWxpZAAAABJJbnZhbGlkR2FtZU91dGNvbWUAAAAAABgAAAAvUHJvb2YgdmVyaWZpY2F0aW9uIGZhaWxlZCAoWksgcHJvb2YgaXMgaW52YWxpZCkAAAAAF1Byb29mVmVyaWZpY2F0aW9uRmFpbGVkAAAAABkAAAA1R2FtZSBpcyBmcm9tIGEgcHJldmlvdXMgZXBvY2ggYW5kIGNhbm5vdCBiZSBjb21wbGV0ZWQAAAAAAAALR2FtZUV4cGlyZWQAAAAAGgAAACBFcG9jaCBoYXMgbm90IGJlZW4gZmluYWxpemVkIHlldAAAABFFcG9jaE5vdEZpbmFsaXplZAAAAAAAAB4AAAAgRXBvY2ggaGFzIGFscmVhZHkgYmVlbiBmaW5hbGl6ZWQAAAAVRXBvY2hBbHJlYWR5RmluYWxpemVkAAAAAAAAHwAAADdFcG9jaCBjYW5ub3QgYmUgY3ljbGVkIHlldCAobm90IGVub3VnaCB0aW1lIGhhcyBwYXNzZWQpAAAAAA1FcG9jaE5vdFJlYWR5AAAAAAAAIAAAADBObyByZXdhcmRzIGF2YWlsYWJsZSBmb3IgdGhpcyB1c2VyIGluIHRoaXMgZXBvY2gAAAASTm9SZXdhcmRzQXZhaWxhYmxlAAAAAAAoAAAALlJld2FyZCBoYXMgYWxyZWFkeSBiZWVuIGNsYWltZWQgZm9yIHRoaXMgZXBvY2gAAAAAABRSZXdhcmRBbHJlYWR5Q2xhaW1lZAAAACkAAAAyVXNlciB3YXMgbm90IGluIHRoZSB3aW5uaW5nIGZhY3Rpb24gZm9yIHRoaXMgZXBvY2gAAAAAABFOb3RXaW5uaW5nRmFjdGlvbgAAAAAAACoAAAAdZmVlLXZhdWx0LXYyIG9wZXJhdGlvbiBmYWlsZWQAAAAAAAANRmVlVmF1bHRFcnJvcgAAAAAAADIAAAAeU29yb3N3YXAgc3dhcCBvcGVyYXRpb24gZmFpbGVkAAAAAAAJU3dhcEVycm9yAAAAAAAAMwAAAB9Ub2tlbiB0cmFuc2ZlciBvcGVyYXRpb24gZmFpbGVkAAAAABJUb2tlblRyYW5zZmVyRXJyb3IAAAAAADQAAAAcQXJpdGhtZXRpYyBvdmVyZmxvdyBvY2N1cnJlZAAAAA1PdmVyZmxvd0Vycm9yAAAAAAAAPAAAABpEaXZpc2lvbiBieSB6ZXJvIGF0dGVtcHRlZAAAAAAADkRpdmlzaW9uQnlaZXJvAAAAAAA9AAAALUNvbnRyYWN0IGlzIHBhdXNlZCAoZW1lcmdlbmN5IHN0b3AgYWN0aXZhdGVkKQAAAAAAAA5Db250cmFjdFBhdXNlZAAAAAAARg==",
        "AAAABQAAAAAAAAAAAAAACUdhbWVBZGRlZAAAAAAAAAEAAAAKZ2FtZV9hZGRlZAAAAAAAAQAAAAAAAAAHZ2FtZV9pZAAAAAATAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAACUdhbWVFbmRlZAAAAAAAAAEAAAAKZ2FtZV9lbmRlZAAAAAAABQAAAAAAAAAHZ2FtZV9pZAAAAAATAAAAAQAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAEAAAAAAAAABndpbm5lcgAAAAAAEwAAAAAAAAAAAAAABWxvc2VyAAAAAAAAEwAAAAAAAAAAAAAADmZwX2NvbnRyaWJ1dGVkAAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAC0Vwb2NoQ3ljbGVkAAAAAAEAAAAMZXBvY2hfY3ljbGVkAAAABAAAAAAAAAAJb2xkX2Vwb2NoAAAAAAAABAAAAAAAAAAAAAAACW5ld19lcG9jaAAAAAAAAAQAAAAAAAAAAAAAAA93aW5uaW5nX2ZhY3Rpb24AAAAABAAAAAAAAAAAAAAAC3Jld2FyZF9wb29sAAAAAAsAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAC0dhbWVSZW1vdmVkAAAAAAEAAAAMZ2FtZV9yZW1vdmVkAAAAAQAAAAAAAAAHZ2FtZV9pZAAAAAATAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAC0dhbWVTdGFydGVkAAAAAAEAAAAMZ2FtZV9zdGFydGVkAAAABgAAAAAAAAAHZ2FtZV9pZAAAAAATAAAAAQAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAEAAAAAAAAAB3BsYXllcjEAAAAAEwAAAAAAAAAAAAAAB3BsYXllcjIAAAAAEwAAAAAAAAAAAAAADXBsYXllcjFfd2FnZXIAAAAAAAALAAAAAAAAAAAAAAANcGxheWVyMl93YWdlcgAAAAAAAAsAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAADEFkbWluQ2hhbmdlZAAAAAEAAAANYWRtaW5fY2hhbmdlZAAAAAAAAAIAAAAAAAAACW9sZF9hZG1pbgAAAAAAABMAAAAAAAAAAAAAAAluZXdfYWRtaW4AAAAAAAATAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAADUNvbmZpZ1VwZGF0ZWQAAAAAAAABAAAADmNvbmZpZ191cGRhdGVkAAAAAAABAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAADUZhY3Rpb25Mb2NrZWQAAAAAAAABAAAADmZhY3Rpb25fbG9ja2VkAAAAAAADAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAAAAAAABWVwb2NoAAAAAAAABAAAAAAAAAAAAAAAB2ZhY3Rpb24AAAAABAAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAADlJld2FyZHNDbGFpbWVkAAAAAAABAAAAD3Jld2FyZHNfY2xhaW1lZAAAAAAEAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAAAAAAABWVwb2NoAAAAAAAABAAAAAAAAAAAAAAAB2ZhY3Rpb24AAAAABAAAAAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAD0ZhY3Rpb25TZWxlY3RlZAAAAAABAAAAEGZhY3Rpb25fc2VsZWN0ZWQAAAACAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAAAAAAAB2ZhY3Rpb24AAAAABAAAAAAAAAAC",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAACgAAAAAAAAAsQWRtaW4gYWRkcmVzcyAtIHNpbmdsZXRvbiAoSW5zdGFuY2Ugc3RvcmFnZSkAAAAFQWRtaW4AAAAAAAAAAAAAM0dsb2JhbCBjb25maWd1cmF0aW9uIC0gc2luZ2xldG9uIChJbnN0YW5jZSBzdG9yYWdlKQAAAAAGQ29uZmlnAAAAAAAAAAAAM0N1cnJlbnQgZXBvY2ggbnVtYmVyIC0gc2luZ2xldG9uIChJbnN0YW5jZSBzdG9yYWdlKQAAAAAMQ3VycmVudEVwb2NoAAAAAAAAACpQYXVzZSBzdGF0ZSAtIHNpbmdsZXRvbiAoSW5zdGFuY2Ugc3RvcmFnZSkAAAAAAAZQYXVzZWQAAAAAAAEAAABGVXNlciBwZXJzaXN0ZW50IGRhdGEgLSBVc2VyKHVzZXJfYWRkcmVzcykgLT4gVXNlciAoUGVyc2lzdGVudCBzdG9yYWdlKQAAAAAABFVzZXIAAAABAAAAEwAAAAEAAABhVXNlciBlcG9jaC1zcGVjaWZpYyBkYXRhIC0gRXBvY2hVc2VyKGVwb2NoX251bWJlciwgdXNlcl9hZGRyZXNzKSAtPiBFcG9jaFVzZXIgKFRlbXBvcmFyeSBzdG9yYWdlKQAAAAAAAAlFcG9jaFVzZXIAAAAAAAACAAAABAAAABMAAAABAAAARUVwb2NoIG1ldGFkYXRhIC0gRXBvY2goZXBvY2hfbnVtYmVyKSAtPiBFcG9jaEluZm8gKFRlbXBvcmFyeSBzdG9yYWdlKQAAAAAAAAVFcG9jaAAAAAAAAAEAAAAEAAAAAQAAAEpHYW1lIHNlc3Npb24gZGF0YSAtIFNlc3Npb24oc2Vzc2lvbl9pZCkgLT4gR2FtZVNlc3Npb24gKFRlbXBvcmFyeSBzdG9yYWdlKQAAAAAAB1Nlc3Npb24AAAAAAQAAAAQAAAABAAAATFdoaXRlbGlzdGVkIGdhbWUgY29udHJhY3RzIC0gR2FtZShnYW1lX2FkZHJlc3MpIC0+IGJvb2wgKFBlcnNpc3RlbnQgc3RvcmFnZSkAAAAER2FtZQAAAAEAAAATAAAAAQAAAFdSZXdhcmQgY2xhaW0gdHJhY2tpbmcgLSBDbGFpbWVkKHVzZXJfYWRkcmVzcywgZXBvY2hfbnVtYmVyKSAtPiBib29sIChUZW1wb3Jhcnkgc3RvcmFnZSkAAAAAB0NsYWltZWQAAAAAAgAAABMAAAAE" ]),
      options
    )
  }
  public readonly fromJSON = {
    pause: this.txFromJSON<Result<void>>,
        is_game: this.txFromJSON<boolean>,
        unpause: this.txFromJSON<Result<void>>,
        upgrade: this.txFromJSON<Result<void>>,
        add_game: this.txFromJSON<Result<void>>,
        end_game: this.txFromJSON<Result<void>>,
        get_admin: this.txFromJSON<string>,
        get_epoch: this.txFromJSON<Result<EpochInfo>>,
        is_paused: this.txFromJSON<boolean>,
        set_admin: this.txFromJSON<Result<void>>,
        get_config: this.txFromJSON<Config>,
        get_player: this.txFromJSON<Result<User>>,
        start_game: this.txFromJSON<Result<void>>,
        cycle_epoch: this.txFromJSON<Result<u32>>,
        remove_game: this.txFromJSON<Result<void>>,
        update_config: this.txFromJSON<Result<void>>,
        select_faction: this.txFromJSON<Result<void>>,
        get_reward_pool: this.txFromJSON<Result<i128>>,
        get_epoch_player: this.txFromJSON<Result<EpochUser>>,
        is_faction_locked: this.txFromJSON<boolean>,
        claim_epoch_reward: this.txFromJSON<Result<i128>>,
        get_winning_faction: this.txFromJSON<Result<u32>>,
        has_claimed_rewards: this.txFromJSON<boolean>,
        get_claimable_amount: this.txFromJSON<i128>,
        get_faction_standings: this.txFromJSON<Result<Map<u32, i128>>>
  }
}