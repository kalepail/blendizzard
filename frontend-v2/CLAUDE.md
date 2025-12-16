# CLAUDE.md - Frontend V2

This file provides guidance to Claude Code when working with the Ohloss frontend.

## Project Overview

React frontend for Ohloss - a faction-based competitive gaming protocol on Stellar. Uses OpenZeppelin's smart-account-kit for passkey-based smart wallets.

## Tech Stack

- **Runtime**: Bun (NOT Node.js)
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS
- **Smart Wallets**: smart-account-kit (OpenZeppelin)
- **Blockchain**: Stellar/Soroban
- **Deployment**: Cloudflare Workers (via wrangler)

## Commands

```bash
# Install dependencies
bun install

# Development
bun run dev

# Build
bun run build

# Type check
npx tsc --noEmit

# Deploy to Cloudflare
bunx wrangler deploy
```

## Key Directories

```
frontend-v2/
├── src/
│   ├── components/     # React components
│   ├── lib/           # Utilities and services
│   │   ├── smartAccount.ts   # Smart Account Kit wrapper
│   │   ├── contractService.ts # Soroban contract calls
│   │   └── swapService.ts    # Soroswap integration
│   └── App.tsx
├── worker/            # Cloudflare Worker (API proxy)
└── wrangler.jsonc     # Cloudflare config
```

## Environment Variables

All client-side env vars must be prefixed with `VITE_`.

### Required
```
VITE_RPC_URL                       # Stellar RPC endpoint
VITE_NETWORK_PASSPHRASE            # Network passphrase
VITE_ACCOUNT_WASM_HASH             # Smart account WASM hash
VITE_WEBAUTHN_VERIFIER_ADDRESS     # WebAuthn verifier contract
```

### Blendizzard Contracts
```
VITE_BLENDIZZARD_CONTRACT          # Main game contract
VITE_FEE_VAULT_CONTRACT            # Fee vault contract
VITE_USDC_TOKEN_CONTRACT           # USDC token address
VITE_NATIVE_TOKEN_CONTRACT         # XLM SAC address
```

### Smart Account Kit
```
VITE_SMART_ACCOUNT_INDEXER_URL     # Indexer for reverse lookups
VITE_LAUNCHTUBE_URL                # Fee sponsoring service
VITE_LAUNCHTUBE_JWT                # Launchtube auth token
```

### Worker Secrets (.dev.vars)
```
SOROSWAP_API_KEY                   # Soroswap API key (server-side only)
```

## Smart Account Kit Integration

**Source**: https://github.com/kalepail/stellar-contracts/tree/kalepail-edit/smart-account-kit

The SDK is initialized in `src/lib/smartAccount.ts` with these key options:

```typescript
new SmartAccountKit({
  rpcUrl,
  networkPassphrase,
  accountWasmHash,
  webauthnVerifierAddress,
  storage: new IndexedDBStorage(),
  rpName: 'Blendizzard',
  indexerUrl,      // For credential -> contract lookups
  launchtube,      // For fee-sponsored transactions
})
```

### Key Methods
- `createWallet()` - Create new passkey-based smart wallet
- `connectWallet()` - Connect to existing wallet
- `authenticateAndDiscover()` - Auth + find contracts via indexer
- `transfer()` - Send tokens from smart wallet

### Indexer

The indexer (`VITE_SMART_ACCOUNT_INDEXER_URL`) enables reverse lookups:
- Find all contracts associated with a credential ID
- Essential for wallet discovery when user has multiple smart accounts

Mainnet: `https://smart-account-indexer-mainnet.sdf-ecosystem.workers.dev`

## Cloudflare Worker

The worker in `worker/` proxies API calls (e.g., Soroswap) to keep API keys server-side.

```typescript
// worker/index.ts handles routes like:
// /api/swap/quote - Get swap quote from Soroswap
```

Secrets are stored in `.dev.vars` (local) or Cloudflare dashboard (production).

## Important Notes

1. **Use Bun** - Never use npm/yarn/pnpm
2. **VITE_ prefix** - All client env vars need this prefix
3. **Stellar decimals** - USDC uses 7 decimals (not 6 like Ethereum)
4. **Smart wallets** - Users interact via passkeys, no seed phrases
5. **Fee sponsoring** - Launchtube covers transaction fees for users
