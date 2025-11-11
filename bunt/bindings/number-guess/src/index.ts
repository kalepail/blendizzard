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





export interface Game {
  guess1: Option<u32>;
  guess2: Option<u32>;
  player1: string;
  player1_wager: i128;
  player2: string;
  player2_wager: i128;
  session_id: u32;
  status: GameStatus;
  winner: Option<string>;
  winning_number: u32;
}

export const Errors = {
  1: {message:"GameNotFound"},
  2: {message:"GameAlreadyStarted"},
  3: {message:"NotPlayer"},
  4: {message:"AlreadyGuessed"},
  5: {message:"BothPlayersNotGuessed"},
  6: {message:"GameAlreadyEnded"},
  7: {message:"NotInitialized"},
  8: {message:"AlreadyInitialized"},
  9: {message:"NotAdmin"}
}

export type DataKey = {tag: "Game", values: readonly [u32]} | {tag: "GameCounter", values: void} | {tag: "BlendizzardAddress", values: void} | {tag: "Admin", values: void};

export type GameStatus = {tag: "Active", values: void} | {tag: "Ended", values: void};


export interface GameOutcome {
  game_id: string;
  player1: string;
  player2: string;
  session_id: u32;
  winner: boolean;
}




export interface Client {
  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update the contract WASM hash (upgrade contract)
   * 
   * # Arguments
   * * `new_wasm_hash` - The hash of the new WASM binary
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
   * Construct and simulate a get_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get game information.
   * 
   * # Arguments
   * * `game_id` - The ID of the game
   * 
   * # Returns
   * * `Game` - The game state (includes winning number after game ends)
   */
  get_game: ({game_id}: {game_id: u32}, options?: {
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
  }) => Promise<AssembledTransaction<Result<Game>>>

  /**
   * Construct and simulate a make_guess transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Make a guess for the current game.
   * Players can guess a number between 1 and 10.
   * 
   * # Arguments
   * * `game_id` - The ID of the game
   * * `player` - Address of the player making the guess
   * * `guess` - The guessed number (1-10)
   */
  make_guess: ({game_id, player, guess}: {game_id: u32, player: string, guess: u32}, options?: {
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
   * Construct and simulate a start_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Start a new game between two players with FP wagers.
   * This creates a session in Blendizzard and locks FP before starting the game.
   * 
   * **CRITICAL:** This method requires authorization from THIS contract (not users).
   * Blendizzard will call `game_id.require_auth()` which checks this contract's address.
   * 
   * # Arguments
   * * `session_id` - Unique session identifier (u32)
   * * `player1` - Address of first player
   * * `player2` - Address of second player
   * * `player1_wager` - FP amount player1 is wagering
   * * `player2_wager` - FP amount player2 is wagering
   * 
   * # Returns
   * * `u32` - The game ID
   */
  start_game: ({session_id, player1, player2, player1_wager, player2_wager}: {session_id: u32, player1: string, player2: string, player1_wager: i128, player2_wager: i128}, options?: {
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
   * Construct and simulate a reveal_winner transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Reveal the winner of the game and submit outcome to Blendizzard.
   * Can only be called after both players have made their guesses.
   * This ends the Blendizzard session, unlocks FP, and updates faction standings.
   * 
   * # Arguments
   * * `game_id` - The ID of the game
   * 
   * # Returns
   * * `Address` - Address of the winning player
   */
  reveal_winner: ({game_id}: {game_id: u32}, options?: {
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
  }) => Promise<AssembledTransaction<Result<string>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, blendizzard}: {admin: string, blendizzard: string},
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
    return ContractClient.deploy({admin, blendizzard}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABEdhbWUAAAAKAAAAAAAAAAZndWVzczEAAAAAA+gAAAAEAAAAAAAAAAZndWVzczIAAAAAA+gAAAAEAAAAAAAAAAdwbGF5ZXIxAAAAABMAAAAAAAAADXBsYXllcjFfd2FnZXIAAAAAAAALAAAAAAAAAAdwbGF5ZXIyAAAAABMAAAAAAAAADXBsYXllcjJfd2FnZXIAAAAAAAALAAAAAAAAAApzZXNzaW9uX2lkAAAAAAAEAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAKR2FtZVN0YXR1cwAAAAAAAAAAAAZ3aW5uZXIAAAAAA+gAAAATAAAAAAAAAA53aW5uaW5nX251bWJlcgAAAAAABA==",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACQAAAAAAAAAMR2FtZU5vdEZvdW5kAAAAAQAAAAAAAAASR2FtZUFscmVhZHlTdGFydGVkAAAAAAACAAAAAAAAAAlOb3RQbGF5ZXIAAAAAAAADAAAAAAAAAA5BbHJlYWR5R3Vlc3NlZAAAAAAABAAAAAAAAAAVQm90aFBsYXllcnNOb3RHdWVzc2VkAAAAAAAABQAAAAAAAAAQR2FtZUFscmVhZHlFbmRlZAAAAAYAAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAAHAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAgAAAAAAAAACE5vdEFkbWluAAAACQ==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABAAAAAEAAAAAAAAABEdhbWUAAAABAAAABAAAAAAAAAAAAAAAC0dhbWVDb3VudGVyAAAAAAAAAAAAAAAAEkJsZW5kaXp6YXJkQWRkcmVzcwAAAAAAAAAAAAAAAAAFQWRtaW4AAAA=",
        "AAAAAgAAAAAAAAAAAAAACkdhbWVTdGF0dXMAAAAAAAIAAAAAAAAAAAAAAAZBY3RpdmUAAAAAAAAAAAAAAAAABUVuZGVkAAAA",
        "AAAAAQAAAAAAAAAAAAAAC0dhbWVPdXRjb21lAAAAAAUAAAAAAAAAB2dhbWVfaWQAAAAAEwAAAAAAAAAHcGxheWVyMQAAAAATAAAAAAAAAAdwbGF5ZXIyAAAAABMAAAAAAAAACnNlc3Npb25faWQAAAAAAAQAAAAAAAAABndpbm5lcgAAAAAAAQ==",
        "AAAABQAAAAAAAAAAAAAADkd1ZXNzTWFkZUV2ZW50AAAAAAABAAAAEGd1ZXNzX21hZGVfZXZlbnQAAAADAAAAAAAAAAdnYW1lX2lkAAAAAAQAAAAAAAAAAAAAAAZwbGF5ZXIAAAAAABMAAAAAAAAAAAAAAAVndWVzcwAAAAAAAAQAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAEEdhbWVTdGFydGVkRXZlbnQAAAABAAAAEmdhbWVfc3RhcnRlZF9ldmVudAAAAAAAAwAAAAAAAAAHZ2FtZV9pZAAAAAAEAAAAAAAAAAAAAAAHcGxheWVyMQAAAAATAAAAAAAAAAAAAAAHcGxheWVyMgAAAAATAAAAAAAAAAI=",
        "AAAAAAAAAKVVcGRhdGUgdGhlIGNvbnRyYWN0IFdBU00gaGFzaCAodXBncmFkZSBjb250cmFjdCkKCiMgQXJndW1lbnRzCiogYG5ld193YXNtX2hhc2hgIC0gVGhlIGhhc2ggb2YgdGhlIG5ldyBXQVNNIGJpbmFyeQoKIyBFcnJvcnMKKiBgTm90QWRtaW5gIC0gSWYgY2FsbGVyIGlzIG5vdCB0aGUgYWRtaW4AAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAABQAAAAAAAAAAAAAAE1dpbm5lclJldmVhbGVkRXZlbnQAAAAAAQAAABV3aW5uZXJfcmV2ZWFsZWRfZXZlbnQAAAAAAAADAAAAAAAAAAdnYW1lX2lkAAAAAAQAAAAAAAAAAAAAAAZ3aW5uZXIAAAAAABMAAAAAAAAAAAAAAA53aW5uaW5nX251bWJlcgAAAAAABAAAAAAAAAAC",
        "AAAAAAAAAJJHZXQgZ2FtZSBpbmZvcm1hdGlvbi4KCiMgQXJndW1lbnRzCiogYGdhbWVfaWRgIC0gVGhlIElEIG9mIHRoZSBnYW1lCgojIFJldHVybnMKKiBgR2FtZWAgLSBUaGUgZ2FtZSBzdGF0ZSAoaW5jbHVkZXMgd2lubmluZyBudW1iZXIgYWZ0ZXIgZ2FtZSBlbmRzKQAAAAAACGdldF9nYW1lAAAAAQAAAAAAAAAHZ2FtZV9pZAAAAAAEAAAAAQAAA+kAAAfQAAAABEdhbWUAAAAD",
        "AAAAAAAAANdNYWtlIGEgZ3Vlc3MgZm9yIHRoZSBjdXJyZW50IGdhbWUuClBsYXllcnMgY2FuIGd1ZXNzIGEgbnVtYmVyIGJldHdlZW4gMSBhbmQgMTAuCgojIEFyZ3VtZW50cwoqIGBnYW1lX2lkYCAtIFRoZSBJRCBvZiB0aGUgZ2FtZQoqIGBwbGF5ZXJgIC0gQWRkcmVzcyBvZiB0aGUgcGxheWVyIG1ha2luZyB0aGUgZ3Vlc3MKKiBgZ3Vlc3NgIC0gVGhlIGd1ZXNzZWQgbnVtYmVyICgxLTEwKQAAAAAKbWFrZV9ndWVzcwAAAAAAAwAAAAAAAAAHZ2FtZV9pZAAAAAAEAAAAAAAAAAZwbGF5ZXIAAAAAABMAAAAAAAAABWd1ZXNzAAAAAAAABAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAjhTdGFydCBhIG5ldyBnYW1lIGJldHdlZW4gdHdvIHBsYXllcnMgd2l0aCBGUCB3YWdlcnMuClRoaXMgY3JlYXRlcyBhIHNlc3Npb24gaW4gQmxlbmRpenphcmQgYW5kIGxvY2tzIEZQIGJlZm9yZSBzdGFydGluZyB0aGUgZ2FtZS4KCioqQ1JJVElDQUw6KiogVGhpcyBtZXRob2QgcmVxdWlyZXMgYXV0aG9yaXphdGlvbiBmcm9tIFRISVMgY29udHJhY3QgKG5vdCB1c2VycykuCkJsZW5kaXp6YXJkIHdpbGwgY2FsbCBgZ2FtZV9pZC5yZXF1aXJlX2F1dGgoKWAgd2hpY2ggY2hlY2tzIHRoaXMgY29udHJhY3QncyBhZGRyZXNzLgoKIyBBcmd1bWVudHMKKiBgc2Vzc2lvbl9pZGAgLSBVbmlxdWUgc2Vzc2lvbiBpZGVudGlmaWVyICh1MzIpCiogYHBsYXllcjFgIC0gQWRkcmVzcyBvZiBmaXJzdCBwbGF5ZXIKKiBgcGxheWVyMmAgLSBBZGRyZXNzIG9mIHNlY29uZCBwbGF5ZXIKKiBgcGxheWVyMV93YWdlcmAgLSBGUCBhbW91bnQgcGxheWVyMSBpcyB3YWdlcmluZwoqIGBwbGF5ZXIyX3dhZ2VyYCAtIEZQIGFtb3VudCBwbGF5ZXIyIGlzIHdhZ2VyaW5nCgojIFJldHVybnMKKiBgdTMyYCAtIFRoZSBnYW1lIElEAAAACnN0YXJ0X2dhbWUAAAAAAAUAAAAAAAAACnNlc3Npb25faWQAAAAAAAQAAAAAAAAAB3BsYXllcjEAAAAAEwAAAAAAAAAHcGxheWVyMgAAAAATAAAAAAAAAA1wbGF5ZXIxX3dhZ2VyAAAAAAAACwAAAAAAAAANcGxheWVyMl93YWdlcgAAAAAAAAsAAAABAAAD6QAAAAQAAAAD",
        "AAAAAAAAAK5Jbml0aWFsaXplIHRoZSBjb250cmFjdCB3aXRoIEJsZW5kaXp6YXJkIGFkZHJlc3MgYW5kIGFkbWluCgojIEFyZ3VtZW50cwoqIGBhZG1pbmAgLSBBZG1pbiBhZGRyZXNzIChjYW4gdXBncmFkZSBjb250cmFjdCkKKiBgYmxlbmRpenphcmRgIC0gQWRkcmVzcyBvZiB0aGUgQmxlbmRpenphcmQgY29udHJhY3QAAAAAAA1fX2NvbnN0cnVjdG9yAAAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAtibGVuZGl6emFyZAAAAAATAAAAAA==",
        "AAAAAAAAATJSZXZlYWwgdGhlIHdpbm5lciBvZiB0aGUgZ2FtZSBhbmQgc3VibWl0IG91dGNvbWUgdG8gQmxlbmRpenphcmQuCkNhbiBvbmx5IGJlIGNhbGxlZCBhZnRlciBib3RoIHBsYXllcnMgaGF2ZSBtYWRlIHRoZWlyIGd1ZXNzZXMuClRoaXMgZW5kcyB0aGUgQmxlbmRpenphcmQgc2Vzc2lvbiwgdW5sb2NrcyBGUCwgYW5kIHVwZGF0ZXMgZmFjdGlvbiBzdGFuZGluZ3MuCgojIEFyZ3VtZW50cwoqIGBnYW1lX2lkYCAtIFRoZSBJRCBvZiB0aGUgZ2FtZQoKIyBSZXR1cm5zCiogYEFkZHJlc3NgIC0gQWRkcmVzcyBvZiB0aGUgd2lubmluZyBwbGF5ZXIAAAAAAA1yZXZlYWxfd2lubmVyAAAAAAAAAQAAAAAAAAAHZ2FtZV9pZAAAAAAEAAAAAQAAA+kAAAATAAAAAw==" ]),
      options
    )
  }
  public readonly fromJSON = {
    upgrade: this.txFromJSON<Result<void>>,
        get_game: this.txFromJSON<Result<Game>>,
        make_guess: this.txFromJSON<Result<void>>,
        start_game: this.txFromJSON<Result<u32>>,
        reveal_winner: this.txFromJSON<Result<string>>
  }
}