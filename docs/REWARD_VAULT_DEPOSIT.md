# Reward Claim with Fee-Vault Deposit

## Overview

When players claim epoch rewards, the USDC is now automatically deposited into the fee-vault instead of being transferred directly to their wallet. This allows rewards to continue generating yield.

## How It Works

### Contract Implementation

The contract uses the `FeeVaultClient` interface (same pattern as `cycle_epoch`):

```rust
use crate::fee_vault_v2::Client as FeeVaultClient;

// Step 1: Transfer USDC from contract to player
usdc_client.transfer(&env.current_contract_address(), player, &reward_amount);

// Step 2: Deposit into fee-vault on behalf of player
let vault_client = FeeVaultClient::new(env, &config.fee_vault);
let shares_minted = vault_client.deposit(player, &reward_amount);
```

### Contract Flow

1. **Transfer**: Contract transfers USDC to player's address
2. **Deposit**: Contract calls `vault_client.deposit(player, amount)` using the generated client
3. **Result**: Player receives vault shares representing their USDC deposit

### Authorization Requirements

**Critical**: The player must authorize **TWO** actions in a single transaction:

1. `blendizzard.claim_epoch_reward(player, epoch)` - Claim the reward
2. `fee_vault.deposit(player, amount)` - Deposit into vault

## Client-Side Implementation

### TypeScript Example with Stellar SDK

```typescript
import { Contract, SorobanRpc, TransactionBuilder, Networks } from '@stellar/stellar-sdk';

async function claimRewardWithVaultDeposit(
  playerKeypair: Keypair,
  blendizzardContract: Contract,
  feeVaultContract: Contract,
  epoch: number,
  rewardAmount: bigint
) {
  const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
  const playerAddress = playerKeypair.publicKey();

  // Build the claim transaction
  const claimTx = new TransactionBuilder(
    await server.getAccount(playerAddress),
    {
      fee: '100000', // Will be adjusted
      networkPassphrase: Networks.TESTNET,
    }
  )
    // Operation 1: Claim the reward
    .addOperation(
      blendizzardContract.call('claim_epoch_reward', playerAddress, epoch)
    )
    .setTimeout(300)
    .build();

  // Simulate to get auth requirements
  const simulation = await server.simulateTransaction(claimTx);

  // The simulation will show that TWO authorizations are needed:
  // 1. blendizzard.claim_epoch_reward
  // 2. fee_vault.deposit

  // Build the final transaction with all required auth
  const preparedTx = await server.prepareTransaction(claimTx);

  // Sign the transaction (this signs ALL required authorizations)
  preparedTx.sign(playerKeypair);

  // Submit
  const result = await server.sendTransaction(preparedTx);

  return result;
}
```

### Important Notes

1. **Single Transaction**: Both authorizations happen in ONE transaction - the player signs once
2. **Automatic Handling**: The Stellar SDK's `prepareTransaction()` handles the dual authorization automatically
3. **Simulation First**: Always simulate first to see auth requirements and fees
4. **Gas Costs**: The transaction is slightly more expensive due to the additional vault deposit call

## Benefits

- **Compound Yield**: Rewards immediately start earning yield in the fee-vault
- **Seamless UX**: From the player's perspective, it's still a single signature
- **Gas Efficient**: More efficient than claiming + depositing in separate transactions

## Withdrawal

Players can withdraw their vault balance anytime using the fee-vault's `withdraw()` method:

```typescript
await feeVaultContract.withdraw({
  user: playerAddress,
  amount: amountToWithdraw,
});
```

## Testing Considerations

When writing integration tests, make sure to:

1. Mock both contracts (blendizzard and fee-vault)
2. Verify the player receives vault shares (not direct USDC)
3. Check that the USDC moved: contract → player → vault
4. Confirm proper authorization flow

Example test assertion:
```typescript
// After claiming reward
const vaultBalance = await feeVault.get_underlying_tokens({ user: player });
expect(vaultBalance).toBe(expectedRewardAmount);

const playerUsdcBalance = await usdcToken.balance({ id: player });
expect(playerUsdcBalance).toBe(previousBalance); // Should not change (USDC went to vault)
```
