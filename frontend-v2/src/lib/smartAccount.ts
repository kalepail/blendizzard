// Smart Account Kit integration
// Uses OpenZeppelin's smart-account-kit for WebAuthn passkey-based Stellar smart wallets

import { SmartAccountKit, IndexedDBStorage } from 'smart-account-kit'

// Configuration from environment
const CONFIG = {
  rpcUrl: import.meta.env.VITE_RPC_URL || 'https://soroban-testnet.stellar.org',
  networkPassphrase: import.meta.env.VITE_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  accountWasmHash: import.meta.env.VITE_ACCOUNT_WASM_HASH || '',
  webauthnVerifierAddress: import.meta.env.VITE_WEBAUTHN_VERIFIER_ADDRESS || '',
  nativeTokenContract: import.meta.env.VITE_NATIVE_TOKEN_CONTRACT || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
}

// Singleton kit instance
let kitInstance: SmartAccountKit | null = null

/**
 * Get or create the SmartAccountKit singleton instance
 */
export function getKit(): SmartAccountKit {
  if (!kitInstance) {
    if (!CONFIG.accountWasmHash || !CONFIG.webauthnVerifierAddress) {
      throw new Error(
        'Smart Account Kit not configured. Set VITE_ACCOUNT_WASM_HASH and VITE_WEBAUTHN_VERIFIER_ADDRESS environment variables.'
      )
    }

    kitInstance = new SmartAccountKit({
      rpcUrl: CONFIG.rpcUrl,
      networkPassphrase: CONFIG.networkPassphrase,
      accountWasmHash: CONFIG.accountWasmHash,
      webauthnVerifierAddress: CONFIG.webauthnVerifierAddress,
      storage: new IndexedDBStorage(),
      rpName: 'Blendizzard',
    })
  }

  return kitInstance
}

/**
 * Check if the SDK is properly configured
 */
export function isConfigured(): boolean {
  return !!(CONFIG.accountWasmHash && CONFIG.webauthnVerifierAddress)
}

/**
 * Create a new smart wallet with a passkey
 * This registers a WebAuthn credential and deploys a smart account contract
 */
export async function createWallet(userName?: string): Promise<{
  contractId: string
  credentialId: string
}> {
  const kit = getKit()

  const result = await kit.createWallet('Blendizzard', userName || 'Player', {
    autoSubmit: true,
  })

  if (!result.submitResult?.success) {
    throw new Error(result.submitResult?.error || 'Wallet deployment failed')
  }

  return {
    contractId: result.contractId,
    credentialId: result.credentialId,
  }
}

/**
 * Connect to an existing wallet
 * First tries silent restore from stored session, then prompts for passkey if needed
 */
export async function connectWallet(options?: {
  prompt?: boolean
  credentialId?: string
  contractId?: string
}): Promise<{
  contractId: string
  credentialId: string
} | null> {
  const kit = getKit()

  // Try silent restore first (unless prompt explicitly requested)
  if (!options?.prompt) {
    const result = await kit.connectWallet()
    if (result) {
      return {
        contractId: result.contractId,
        credentialId: result.credentialId,
      }
    }
  }

  // If prompt requested or no stored session, prompt for passkey
  if (options?.prompt || options?.credentialId || options?.contractId) {
    const result = await kit.connectWallet({
      prompt: options?.prompt,
      credentialId: options?.credentialId,
      contractId: options?.contractId,
    })

    if (result) {
      return {
        contractId: result.contractId,
        credentialId: result.credentialId,
      }
    }
  }

  return null
}

/**
 * Authenticate with passkey and discover contracts via indexer
 * Use this when the user might have multiple smart accounts
 */
export async function authenticateAndDiscover(): Promise<{
  credentialId: string
  contracts: Array<{ contract_id: string; context_rule_count: number }>
}> {
  const kit = getKit()

  // Authenticate to get credential ID
  const { credentialId } = await kit.authenticatePasskey()

  // Discover contracts via indexer
  const contracts = await kit.discoverContractsByCredential(credentialId)

  return {
    credentialId,
    contracts: contracts || [],
  }
}

/**
 * Disconnect from the current wallet and clear session
 */
export async function disconnect(): Promise<void> {
  const kit = getKit()
  await kit.disconnect()
}

/**
 * Check if there's a stored session (for auto-reconnect)
 */
export async function hasStoredSession(): Promise<boolean> {
  try {
    const kit = getKit()
    const result = await kit.connectWallet() // Silent restore attempt
    if (result) {
      await kit.disconnect() // Don't actually connect, just checking
      return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * Get pending credentials that haven't been deployed yet
 */
export async function getPendingCredentials() {
  const kit = getKit()
  return kit.credentials.getPending()
}

/**
 * Deploy a pending credential
 */
export async function deployPendingCredential(credentialId: string): Promise<{
  contractId: string
  success: boolean
  error?: string
}> {
  const kit = getKit()

  const result = await kit.credentials.deploy(credentialId, {
    autoSubmit: true,
  })

  return {
    contractId: result.contractId,
    success: result.submitResult?.success || false,
    error: result.submitResult?.error,
  }
}

/**
 * Delete a pending credential
 */
export async function deletePendingCredential(credentialId: string): Promise<void> {
  const kit = getKit()
  await kit.credentials.delete(credentialId)
}

/**
 * Get the current contract ID if connected
 */
export function getContractId(): string | null {
  if (!kitInstance) return null
  // The kit stores the current contract ID internally after connect
  // We'd need to track this separately or expose it from the kit
  return null
}

// Export configuration for external use
export const config = {
  ...CONFIG,
  isConfigured: isConfigured(),
}

// Export the kit getter for advanced usage
export { getKit as getSmartAccountKit }
