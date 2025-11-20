import type { ContractSigner } from '@/types/signer';
import { walletService } from '@/services/walletService';
import { devWalletService } from '@/services/devWalletService';

/**
 * Get a signer for wallet-connected users
 * Returns a ContractSigner that uses the Stellar Wallets Kit
 */
export function getWalletSigner(publicKey: string): ContractSigner {
  return {
    signTransaction: async (xdr: string, opts?: {
      networkPassphrase?: string;
      address?: string;
      submit?: boolean;
      submitUrl?: string;
    }) => {
      return await walletService.signTransaction(xdr, { address: opts?.address || publicKey });
    },
    signAuthEntry: async (authEntry: string, opts?: {
      networkPassphrase?: string;
      address?: string;
    }) => {
      const result = await walletService.signAuthEntry(authEntry, { address: opts?.address || publicKey });

      return {
        ...result,
        signedAuthEntry: result.signedAuthEntry,
      }
    },
  };
}

/**
 * Get a signer for dev mode users
 * Returns a ContractSigner that uses the dev wallet service
 */
export function getDevSigner(): ContractSigner {
  return devWalletService.getSigner();
}

/**
 * Get a signer based on the wallet type
 * This is the main function to use in your app
 */
export function getSigner(walletType: 'dev' | 'wallet', publicKey: string): ContractSigner {
  if (walletType === 'dev') {
    return getDevSigner();
  } else {
    return getWalletSigner(publicKey);
  }
}
