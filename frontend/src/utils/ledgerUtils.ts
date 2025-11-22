import { rpc } from '@stellar/stellar-sdk';

/**
 * Ledger close time is approximately 5 seconds
 */
export const LEDGERS_PER_MINUTE = 12;
export const LEDGERS_PER_HOUR = 720;
export const LEDGERS_PER_DAY = 17280;

/**
 * Safety margin percentage to add to TTL calculations
 * Accounts for network variability and signing delays
 */
const SAFETY_MARGIN_PERCENT = 0.2;

/**
 * Fetches the current ledger sequence from the Stellar RPC server
 *
 * @param rpcUrl - The RPC endpoint URL
 * @returns The current ledger sequence number
 * @throws Error if unable to fetch ledger information
 */
export async function getCurrentLedger(rpcUrl: string): Promise<number> {
  try {
    const server = new rpc.Server(rpcUrl);
    const latestLedger = await server.getLatestLedger();
    return latestLedger.sequence;
  } catch (error) {
    console.error('[getCurrentLedger] Failed to fetch current ledger:', error);
    throw new Error(`Failed to fetch current ledger: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculates the validUntilLedgerSeq value for authorization entries
 *
 * The validUntilLedgerSeq is an exclusive ledger sequence number that specifies
 * when an authorization entry expires. The signature is valid until (but not including)
 * this ledger number.
 *
 * @param rpcUrl - The RPC endpoint URL
 * @param ttlMinutes - Time-to-live in minutes (default: 10 minutes)
 * @param includeSafetyMargin - Whether to add a 20% safety margin (default: true)
 * @returns The calculated validUntilLedgerSeq value
 *
 * @example
 * // Calculate TTL for immediate use (10 minutes)
 * const validUntil = await calculateValidUntilLedger(RPC_URL, 10);
 *
 * @example
 * // Calculate TTL for multi-sig flow (1 hour)
 * const validUntil = await calculateValidUntilLedger(RPC_URL, 60);
 */
export async function calculateValidUntilLedger(
  rpcUrl: string,
  ttlMinutes: number = 10,
  includeSafetyMargin: boolean = true
): Promise<number> {
  const currentLedger = await getCurrentLedger(rpcUrl);
  const ttlLedgers = Math.ceil(ttlMinutes * LEDGERS_PER_MINUTE);

  let validUntilLedger = currentLedger + ttlLedgers;

  if (includeSafetyMargin) {
    const safetyMargin = Math.ceil(ttlLedgers * SAFETY_MARGIN_PERCENT);
    validUntilLedger += safetyMargin;
  }

  console.log(`[calculateValidUntilLedger] Current ledger: ${currentLedger}, TTL: ${ttlMinutes}min (${ttlLedgers} ledgers), Valid until: ${validUntilLedger}`);

  return validUntilLedger;
}

/**
 * Calculates a validUntilLedgerSeq based on a target ledger count
 *
 * @param rpcUrl - The RPC endpoint URL
 * @param ledgerCount - Number of ledgers to add to current ledger
 * @returns The calculated validUntilLedgerSeq value
 *
 * @example
 * // Valid for next 100 ledgers (~8 minutes)
 * const validUntil = await calculateValidUntilLedgerByCount(RPC_URL, 100);
 */
export async function calculateValidUntilLedgerByCount(
  rpcUrl: string,
  ledgerCount: number
): Promise<number> {
  const currentLedger = await getCurrentLedger(rpcUrl);
  return currentLedger + ledgerCount;
}

/**
 * Checks if a validUntilLedgerSeq is still valid
 *
 * @param rpcUrl - The RPC endpoint URL
 * @param validUntilLedgerSeq - The ledger sequence to check
 * @returns True if the signature is still valid, false if expired
 */
export async function isSignatureValid(
  rpcUrl: string,
  validUntilLedgerSeq: number
): Promise<boolean> {
  const currentLedger = await getCurrentLedger(rpcUrl);
  return currentLedger < validUntilLedgerSeq;
}

/**
 * Estimates the remaining time (in minutes) for a validUntilLedgerSeq
 *
 * @param rpcUrl - The RPC endpoint URL
 * @param validUntilLedgerSeq - The ledger sequence to check
 * @returns Remaining time in minutes (0 if expired)
 */
export async function getRemainingMinutes(
  rpcUrl: string,
  validUntilLedgerSeq: number
): Promise<number> {
  const currentLedger = await getCurrentLedger(rpcUrl);
  const remainingLedgers = Math.max(0, validUntilLedgerSeq - currentLedger);
  return Math.floor(remainingLedgers / LEDGERS_PER_MINUTE);
}
