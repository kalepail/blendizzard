/**
 * End-to-End Game Test
 *
 * This script demonstrates a complete game flow:
 * 1. Players deposit USDC to fee-vault
 * 2. Players select factions in blendizzard
 * 3. Start a number-guess game (locks FP)
 * 4. Players make guesses
 * 5. Reveal winner (burns FP, updates faction standings)
 * 6. Verify results
 *
 * NOTE: This script assumes contracts are deployed and initialized.
 * See CHITSHEET.md for contract addresses.
 */

import { Client as BlendizzardContract, type User, type EpochUser } from 'blendizzard';
import { Client as FeeVaultContract } from 'fee-vault';
import { Client as NumberGuessContract } from 'number-guess';
import { Keypair, Networks, Transaction, BASE_FEE, contract, rpc } from '@stellar/stellar-sdk';

// Re-export types from contract and rpc modules
type AssembledTransaction<T> = contract.AssembledTransaction<T>;
type ClientOptions = contract.ClientOptions;
type MethodOptions = contract.MethodOptions;
const Api = rpc.Api;

// ============================================================================
// Configuration
// ============================================================================

const NETWORK_PASSPHRASE = Networks.PUBLIC;
const RPC_URL = 'https://rpc.lightsail.network';

// Default options for all contract method calls
// BASE_FEE is 100 stroops, so BASE_FEE + 1 = 101 stroops
const DEFAULT_METHOD_OPTIONS = {
  fee: Number(BASE_FEE) + 1, // 101 stroops
  timeoutInSeconds: 30,
} as const;

// Contract addresses from CHITSHEET.md
const BLENDIZZARD_ID = 'CAK6Z6KFMB3V2ENEJ7THVKXUYQ5EG7EL2TM5UQ2FLDXI37FS6DRIMIZH';
const FEE_VAULT_ID = 'CBBY53VYJSMAWCBZZ7BHJZ5XSZNJUS4ZE6Q4RN7TKZGHPYHMEE467W7Y';
const NUMBER_GUESS_ID = 'CDB6IODG5BNNVILLJXBXYZVR7NP4HDO2NL7WALWIXGIDMA6VY4V75CEX';

// Player configuration
// NOTE: Replace with actual funded keypairs for real testing
const PLAYER1_SECRET = process.env.PLAYER1_SECRET || 'SC...'; // Replace with real secret
const PLAYER2_SECRET = process.env.PLAYER2_SECRET || 'SC...'; // Replace with real secret

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a contract client with the given keypair
 * Properly typed to preserve Client type information
 */
function createClient<T extends { new(options: ClientOptions): InstanceType<T> }>(
  ContractClass: T,
  contractId: string,
  keypair: Keypair
): InstanceType<T> {
  const options: ClientOptions = {
    contractId,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    publicKey: keypair.publicKey(),
    async signTransaction(tx: string) {
      const transaction = new Transaction(tx, NETWORK_PASSPHRASE);
      transaction.sign(keypair);
      return { signedTxXdr: transaction.toXDR() };
    },
  };

  return new ContractClass(options) as InstanceType<T>;
}

/**
 * Format amounts for display (7 decimals for USDC on Stellar)
 */
function formatAmount(amount: bigint): string {
  return (Number(amount) / 10_000_000).toFixed(2);
}

/**
 * Execute write transaction with full workflow:
 * 1. Build and simulate
 * 2. Review simulation for errors
 * 3. Check authorization requirements
 * 4. Sign and send
 */
async function logTx<T>(
  txPromise: Promise<AssembledTransaction<T>>,
  description: string
): Promise<T> {
  console.log(`\n📤 ${description}...`);
  try {
    // 1. Build and auto-simulate the transaction
    const assembled = await txPromise;
    console.log(`   ✓ Transaction built and simulated`);

    // 2. Review simulation result using Api.isSimulationSuccess
    if (!Api.isSimulationSuccess(assembled.simulation)) {
      console.error(`   ✗ Simulation failed`);
      console.error(`   Error:`, assembled.simulation);
      throw new Error(`Simulation failed: ${JSON.stringify(assembled.simulation)}`);
    }
    console.log(`   ✓ Simulation successful`);

    // 3. Check for required signatures
    const needsSigningBy = assembled.needsNonInvokerSigningBy();
    if (needsSigningBy.length > 0) {
      console.log(`   ⚠ Transaction requires additional signatures from:`, needsSigningBy);
      throw new Error(`Multi-signature not implemented. Required signers: ${needsSigningBy.join(', ')}`);
    }
    console.log(`   ✓ No additional signatures required`);

    // 4. Sign and send the transaction
    console.log(`   ⏳ Signing and sending...`);
    const { result } = await assembled.signAndSend();
    console.log(`✅ ${description} - Success`);
    return result;
  } catch (error: any) {
    console.error(`❌ ${description} - Failed:`, error.message);
    throw error;
  }
}

/**
 * Execute read-only query with simulation review
 * Read operations don't require signing/sending, just simulation
 *
 * Generic type T represents the unwrapped value type
 * The contract methods return Result<T>, and this function unwraps to get T
 */
async function queryContract<T>(
  txPromise: Promise<AssembledTransaction<contract.Result<T>>>,
  description: string
): Promise<T> {
  try {
    // Build and auto-simulate the transaction
    const assembled = await txPromise;

    // Review simulation result using Api.isSimulationSuccess
    if (!Api.isSimulationSuccess(assembled.simulation)) {
      console.error(`Query simulation failed for "${description}"`);
      console.error(`Error:`, assembled.simulation);
      throw new Error(`Query simulation failed: ${JSON.stringify(assembled.simulation)}`);
    }

    // For read operations, just return the result from simulation
    // No need to sign and send - the simulation already contains the data
    // assembled.result is Result<T>, unwrap() returns T
    return assembled.result.unwrap();
  } catch (error: any) {
    console.error(`Failed to query "${description}":`, error.message);
    throw error;
  }
}

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  console.log('🎮 Blendizzard End-to-End Game Test');
  console.log('=' .repeat(60));

  // Initialize players
  const player1 = Keypair.fromSecret(PLAYER1_SECRET);
  const player2 = Keypair.fromSecret(PLAYER2_SECRET);

  console.log('\n👥 Players:');
  console.log(`   Player 1: ${player1.publicKey()}`);
  console.log(`   Player 2: ${player2.publicKey()}`);

  // Create contract clients
  const blendizzard1 = createClient(BlendizzardContract, BLENDIZZARD_ID, player1);
  const blendizzard2 = createClient(BlendizzardContract, BLENDIZZARD_ID, player2);
  const feeVault1 = createClient(FeeVaultContract, FEE_VAULT_ID, player1);
  const feeVault2 = createClient(FeeVaultContract, FEE_VAULT_ID, player2);
  const numberGuess1 = createClient(NumberGuessContract, NUMBER_GUESS_ID, player1);
  const numberGuess2 = createClient(NumberGuessContract, NUMBER_GUESS_ID, player2);

  // // ============================================================================
  // // Step 1: Deposit to Fee Vault
  // // ============================================================================

  // console.log('\n\n📦 Step 1: Deposit to Fee Vault');
  // console.log('-'.repeat(60));

  // const depositAmount = 100000n; // 0.0100000 USDC

  // await logTx(
  //   feeVault1.deposit({
  //     user: player1.publicKey(),
  //     amount: depositAmount,
  //   }, DEFAULT_METHOD_OPTIONS),
  //   `Player 1 deposits ${formatAmount(depositAmount)} USDC`
  // );

  // await logTx(
  //   feeVault2.deposit({
  //     user: player2.publicKey(),
  //     amount: depositAmount,
  //   }, DEFAULT_METHOD_OPTIONS),
  //   `Player 2 deposits ${formatAmount(depositAmount)} USDC`
  // );

  // // ============================================================================
  // // Step 2: Select Factions
  // // ============================================================================

  // console.log('\n\n⚔️  Step 2: Select Factions');
  // console.log('-'.repeat(60));

  // const FACTION_WHOLE_NOODLE = 0;
  // const FACTION_POINTY_STICK = 1;

  // await logTx(
  //   blendizzard1.select_faction({
  //     user: player1.publicKey(),
  //     faction: FACTION_WHOLE_NOODLE,
  //   }, DEFAULT_METHOD_OPTIONS),
  //   'Player 1 selects WholeNoodle faction'
  // );

  // await logTx(
  //   blendizzard2.select_faction({
  //     user: player2.publicKey(),
  //     faction: FACTION_POINTY_STICK,
  //   }, DEFAULT_METHOD_OPTIONS),
  //   'Player 2 selects PointyStick faction'
  // );

  // // ============================================================================
  // // Step 3: Check Initial State
  // // ============================================================================

  // console.log('\n\n📊 Step 3: Check Initial State');
  // console.log('-'.repeat(60));

  // const player1Data = await queryContract<User>(
  //   blendizzard1.get_player({ user: player1.publicKey() }, DEFAULT_METHOD_OPTIONS),
  //   'Get Player 1 data'
  // );
  // const player2Data = await queryContract<User>(
  //   blendizzard2.get_player({ user: player2.publicKey() }, DEFAULT_METHOD_OPTIONS),
  //   'Get Player 2 data'
  // );

  // console.log(`\nPlayer 1:`);
  // console.log(`   Faction: ${player1Data.selected_faction}`);
  // console.log(`   Time Multiplier Start: ${player1Data.time_multiplier_start}`);

  // console.log(`\nPlayer 2:`);
  // console.log(`   Faction: ${player2Data.selected_faction}`);
  // console.log(`   Time Multiplier Start: ${player2Data.time_multiplier_start}`);

  // ============================================================================
  // Step 4: Start Number Guess Game
  // ============================================================================

  console.log('\n\n🎲 Step 4: Start Number Guess Game');
  console.log('-'.repeat(60));

  // First, query each player's available FP
  const p1EpochBefore = await queryContract<EpochUser>(
    blendizzard1.get_epoch_player({ user: player1.publicKey() }, DEFAULT_METHOD_OPTIONS),
    'Get Player 1 epoch data'
  );
  const p2EpochBefore = await queryContract<EpochUser>(
    blendizzard2.get_epoch_player({ user: player2.publicKey() }, DEFAULT_METHOD_OPTIONS),
    'Get Player 2 epoch data'
  );

  console.log(`\n📊 FP State Before Game:`);
  console.log(`   Player 1 Available FP: ${formatAmount(BigInt(p1EpochBefore.available_fp))}`);
  console.log(`   Player 2 Available FP: ${formatAmount(BigInt(p2EpochBefore.available_fp))}`);

  // Use the minimum available FP as the wager
  const player1AvailableFP = BigInt(p1EpochBefore.available_fp);
  const player2AvailableFP = BigInt(p2EpochBefore.available_fp);
  const wager = player1AvailableFP < player2AvailableFP ? player1AvailableFP : player2AvailableFP;

  const sessionId = Math.floor(Math.random() * 1_000_000); // Random session ID

  console.log(`\nSession ID: ${sessionId}`);
  console.log(`Wager: ${formatAmount(wager)} FP (max both players can afford)`);

  // await logTx(
  //   numberGuess1.start_game({
  //     session_id: sessionId,
  //     player1: player1.publicKey(),
  //     player2: player2.publicKey(),
  //     player1_wager: wager,
  //     player2_wager: wager,
  //   }, DEFAULT_METHOD_OPTIONS),
  //   'Start number guess game (locks FP via blendizzard)'
  // );

  // // Check FP state after game start
  // const p1EpochAfter = await queryContract<EpochUser>(
  //   blendizzard1.get_epoch_player({ user: player1.publicKey() }, DEFAULT_METHOD_OPTIONS),
  //   'Get Player 1 epoch data after game start'
  // );
  // const p2EpochAfter = await queryContract<EpochUser>(
  //   blendizzard2.get_epoch_player({ user: player2.publicKey() }, DEFAULT_METHOD_OPTIONS),
  //   'Get Player 2 epoch data after game start'
  // );

  // console.log(`\n📊 FP State After Game Start:`);
  // console.log(`   Player 1:`);
  // console.log(`      Available FP: ${formatAmount(BigInt(p1EpochAfter.available_fp))}`);
  // console.log(`      Locked FP: ${formatAmount(BigInt(p1EpochAfter.locked_fp))}`);
  // console.log(`   Player 2:`);
  // console.log(`      Available FP: ${formatAmount(BigInt(p2EpochAfter.available_fp))}`);
  // console.log(`      Locked FP: ${formatAmount(BigInt(p2EpochAfter.locked_fp))}`);

  // // ============================================================================
  // // Step 5: Players Make Guesses
  // // ============================================================================

  // console.log('\n\n🤔 Step 5: Players Make Guesses');
  // console.log('-'.repeat(60));

  // const player1Guess = 5;
  // const player2Guess = 7;

  // await logTx(
  //   numberGuess1.make_guess({
  //     game_id: sessionId,
  //     player: player1.publicKey(),
  //     guess: player1Guess,
  //   }, DEFAULT_METHOD_OPTIONS),
  //   `Player 1 guesses: ${player1Guess}`
  // );

  // await logTx(
  //   numberGuess2.make_guess({
  //     game_id: sessionId,
  //     player: player2.publicKey(),
  //     guess: player2Guess,
  //   }, DEFAULT_METHOD_OPTIONS),
  //   `Player 2 guesses: ${player2Guess}`
  // );

  // // ============================================================================
  // // Step 6: Reveal Winner
  // // ============================================================================

  // console.log('\n\n🏆 Step 6: Reveal Winner');
  // console.log('-'.repeat(60));

  // await logTx(
  //   numberGuess1.reveal_winner({
  //     game_id: sessionId,
  //   }, DEFAULT_METHOD_OPTIONS),
  //   'Reveal winner (burns FP, updates faction standings)'
  // );

  // // Get game result
  // const gameResult = await queryContract(
  //   numberGuess1.get_game({ game_id: sessionId }, DEFAULT_METHOD_OPTIONS),
  //   'Get game result'
  // );

  // console.log(`\n🎯 Game Result:`);
  // console.log(`   Winning Number: ${gameResult.winning_number}`);
  // console.log(`   Player 1 Guess: ${player1Guess}`);
  // console.log(`   Player 2 Guess: ${player2Guess}`);
  // console.log(`   Winner: ${gameResult.winner === player1.publicKey() ? 'Player 1' : 'Player 2'}`);

  // // ============================================================================
  // // Step 7: Verify Final State
  // // ============================================================================

  // console.log('\n\n✅ Step 7: Verify Final State');
  // console.log('-'.repeat(60));

  // const p1EpochAfter = await queryContract(
  //   blendizzard1.get_epoch_player({ user: player1.publicKey() }, DEFAULT_METHOD_OPTIONS),
  //   'Get Player 1 final epoch data'
  // );
  // const p2EpochAfter = await queryContract(
  //   blendizzard2.get_epoch_player({ user: player2.publicKey() }, DEFAULT_METHOD_OPTIONS),
  //   'Get Player 2 final epoch data'
  // );

  // console.log(`\n📊 FP State After Game End:`);
  // console.log(`   Player 1:`);
  // console.log(`      Available FP: ${formatAmount(BigInt(p1EpochAfter.available_fp))}`);
  // console.log(`      Locked FP: ${formatAmount(BigInt(p1EpochAfter.locked_fp))}`);
  // console.log(`      Total Contributed: ${formatAmount(BigInt(p1EpochAfter.total_fp_contributed))}`);
  // console.log(`   Player 2:`);
  // console.log(`      Available FP: ${formatAmount(BigInt(p2EpochAfter.available_fp))}`);
  // console.log(`      Locked FP: ${formatAmount(BigInt(p2EpochAfter.locked_fp))}`);
  // console.log(`      Total Contributed: ${formatAmount(BigInt(p2EpochAfter.total_fp_contributed))}`);

  // // Get faction standings
  // const epoch = await queryContract(
  //   blendizzard1.get_epoch({ epoch: 0 }, DEFAULT_METHOD_OPTIONS),
  //   'Get epoch 0 data'
  // );

  // console.log(`\n⚔️  Faction Standings:`);
  // for (const [factionId, points] of epoch.faction_standings.entries()) {
  //   const factionName = factionId === 0 ? 'WholeNoodle' : factionId === 1 ? 'PointyStick' : 'SpecialRock';
  //   console.log(`   ${factionName} (${factionId}): ${formatAmount(BigInt(points))} FP`);
  // }

  // console.log('\n\n🎉 End-to-End Test Complete!');
  // console.log('=' .repeat(60));
}

// Run the script
main().catch((error) => {
  console.error('\n💥 Fatal Error:', error);
  process.exit(1);
});
