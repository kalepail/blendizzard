# Async Game Matchmaking Architecture

## Problem Statement

The current `number-guess` game requires both players to sign a transaction simultaneously, which creates a poor UX for matchmaking. We need a solution that allows:

1. Player 1 to commit to playing a game asynchronously
2. Player 2 to discover available game offers
3. Player 2 to accept an offer at a later time
4. Both player signatures to eventually reach `blendizzard.start_game()`

### Key Constraint

The `blendizzard` contract's `start_game()` method requires:
```rust
player1.require_auth();
player2.require_auth();
game_id.require_auth(); // The game contract itself
```

This means we need to "farm signatures" somehow and deliver them together to satisfy these requirements.

## Research Findings

### Soroban Authorization System

1. **Authorization Entries Can Be Collected Ahead of Time**
   - Transactions can be simulated to generate authorization trees
   - Each player can sign their auth entry separately
   - Auth entries include nonces and expiration (typically ~5 minutes)

2. **Sub-Invocation Pattern**
   - Contract A can call Contract B, and Contract B sees Contract A as the invoker
   - `env.invoker()` returns the calling contract address
   - Allows trusted contracts to act on behalf of users (with proper design)

3. **Custom Account Contracts**
   - Advanced pattern: contracts with `__check_auth` implementation
   - Can define custom authorization logic
   - Very complex, generally not recommended for MVP

4. **Authorization Limitations**
   - Cannot store auth entries indefinitely (nonces expire)
   - No built-in "delegation" mechanism like ERC20 approvals
   - Each transaction must have valid auth at submission time

## Architectural Options

### Option 1: XDR Exchange Pattern (Current Implementation)

**Status:** ✅ Already implemented in `numberGuessService.ts`

**How it works:**
1. Player 1 calls `prepareStartGame()` - creates transaction and signs their auth entry
2. Transaction is simulated to get authorization tree + nonce
3. Partially-signed XDR is exported
4. Player 2 imports XDR via `importAndSignAuthEntry()`
5. Player 2 signs their auth entry
6. Either player submits via `finalizeStartGame()`

**Implementation:**
- `prepareStartGame()` - Create and sign (Player 1)
- `importAndSignAuthEntry()` - Sign (Player 2)
- `finalizeStartGame()` - Submit (Either player)

**Pros:**
- ✅ Works with current contract (no changes needed)
- ✅ Already implemented
- ✅ Trustless - no intermediary needed
- ✅ Players can review exact game terms before signing
- ✅ Minimal gas costs

**Cons:**
- ❌ Requires XDR exchange mechanism (URL sharing, QR codes, database)
- ❌ Nonces expire quickly (~5 minute window)
- ❌ Not great UX for browsing available games
- ❌ Requires some coordination between players

**Best for:** Direct challenges between known players (like chess.com style challenges)

**Gas Cost:** Same as direct start_game call

---

### Option 2: Matchmaking Pool Contract (On-Chain)

**Status:** 🚧 Requires new contract + blendizzard modifications

**How it works:**
1. New `matchmaking` contract stores game offers on-chain
2. Player 1 calls `matchmaking.create_offer(faction, wager, expiry)`
   - FP is locked immediately in blendizzard
   - Offer stored with unique ID
3. Players browse offers (on-chain query or indexed via API)
4. Player 2 calls `matchmaking.accept_offer(offer_id)`
   - Matchmaking contract calls `blendizzard.start_game()` via sub-invocation
   - Both authorizations satisfied through trusted invoker pattern

**Architecture:**

```rust
// New matchmaking contract
pub struct GameOffer {
    pub id: BytesN<32>,
    pub creator: Address,
    pub faction: u32,
    pub wager: i128,
    pub expiry: u64,
    pub status: OfferStatus,
}

pub fn create_offer(
    env: Env,
    player: Address,
    faction: u32,
    wager: i128,
    ttl: u64
) -> BytesN<32> {
    player.require_auth();

    // Lock FP in blendizzard
    let blendizzard = get_blendizzard_contract(&env);
    blendizzard.lock_fp_for_offer(&player, &wager, &offer_id);

    // Store offer on-chain
    let offer = GameOffer { ... };
    env.storage().persistent().set(&DataKey::Offer(offer_id), &offer);

    offer_id
}

pub fn accept_offer(
    env: Env,
    offer_id: BytesN<32>,
    acceptor: Address,
    acceptor_faction: u32
) -> u32 {
    acceptor.require_auth();

    // Load offer, verify not expired
    let offer = get_offer(&env, &offer_id)?;
    require!(offer.status == OfferStatus::Open, Error::OfferNotAvailable);
    require!(env.ledger().timestamp() < offer.expiry, Error::OfferExpired);

    // Call blendizzard.start_game() via sub-invocation
    // Matchmaking contract acts as trusted intermediary
    let blendizzard = get_blendizzard_contract(&env);
    let session_id = blendizzard.start_game_delegated(
        &offer.creator,
        &acceptor,
        &offer.faction,
        &acceptor_faction,
        &offer.wager,
        &number_guess_contract_id
    );

    // Mark offer as accepted
    offer.status = OfferStatus::Accepted;
    env.storage().persistent().set(&DataKey::Offer(offer_id), &offer);

    session_id
}
```

**Blendizzard modifications needed:**

```rust
// Option A: Modify existing start_game to accept matchmaking contract
pub fn start_game(...) {
    // Check if called by trusted matchmaking contract
    if env.invoker() == get_matchmaking_contract(&env) {
        // Skip individual player auth checks
        // Matchmaking contract has already verified both players
    } else {
        // Original flow
        player1.require_auth();
        player2.require_auth();
    }
    // ... rest of logic
}

// Option B: Add separate delegated method
pub fn start_game_delegated(
    env: Env,
    player1: Address,
    player2: Address,
    // ... other params
) -> u32 {
    // Only callable by matchmaking contract
    require!(env.invoker() == get_matchmaking_contract(&env), Error::Unauthorized);

    // Lock FP (already locked via matchmaking, so unlock and relock properly)
    // ... game logic without require_auth calls
}

// Add FP locking mechanism
pub fn lock_fp_for_offer(
    env: Env,
    player: Address,
    amount: i128,
    offer_id: BytesN<32>
) -> bool {
    // Only callable by matchmaking contract
    require!(env.invoker() == get_matchmaking_contract(&env), Error::Unauthorized);

    // Check player has sufficient available FP
    let epoch_player = get_epoch_player(&env, &player)?;
    require!(epoch_player.available_fp >= amount, Error::InsufficientFP);

    // Move FP to locked state
    env.storage().persistent().set(&DataKey::LockedFP(player.clone(), offer_id), &amount);

    true
}
```

**Storage additions:**

```rust
pub enum DataKey {
    // ... existing keys
    LockedFP(Address, BytesN<32>), // (player, offer_id) -> locked_amount
    MatchmakingContract,            // Address of trusted matchmaking contract
}
```

**Frontend integration:**

```typescript
// Create offer
const offerId = await matchmakingService.createOffer({
  faction: 0,
  wager: BigInt(100_0000000),
  ttl: 300 // 5 minutes
});

// Browse offers
const offers = await matchmakingService.listOffers({
  factionFilter: null,
  minWager: BigInt(0),
  maxWager: BigInt(1000_0000000)
});

// Accept offer
const sessionId = await matchmakingService.acceptOffer(
  offerId,
  myFaction
);
```

**Pros:**
- ✅ Best UX - real matchmaking lobby
- ✅ On-chain offer discovery (trustless)
- ✅ No coordination needed between players
- ✅ FP locked when offer created (prevents overbooking)
- ✅ Composable - other contracts can integrate
- ✅ Future-proof architecture

**Cons:**
- ❌ Requires blendizzard contract changes (authorization model)
- ❌ More complex contract logic (security surface)
- ❌ Higher gas costs (on-chain storage for offers)
- ❌ Need to handle offer cleanup (expired offers)
- ❌ Potential for griefing (spam offers)

**Best for:** Public matchmaking lobby, ranked play, future integrations

**Gas Cost:** ~2-3x higher than direct start_game (offer creation + storage)

---

### Option 3: Hybrid - Off-Chain Lobby + XDR Exchange

**Status:** 🔄 Requires database + API + frontend

**How it works:**
1. Off-chain database (Supabase, Firebase) stores game offer metadata
2. Player 1 creates offer:
   - Calls `prepareStartGame()` to get partially-signed XDR
   - Stores XDR + metadata in database
3. Player 2 browses offers via API/UI
4. Player 2 accepts offer:
   - Fetches full XDR from database
   - Calls `importAndSignAuthEntry(xdr)`
   - Calls `finalizeStartGame()` to submit
5. Database updated to mark offer as accepted

**Implementation:**

```typescript
// Backend schema (Supabase)
interface GameOffer {
  id: string;
  session_id: number;
  player1: string;
  player1_faction: number;
  wager: bigint;
  xdr: string;              // Partially-signed XDR
  xdr_hash: string;         // For verification
  created_at: number;
  expires_at: number;
  status: 'open' | 'accepted' | 'expired' | 'cancelled';
  accepted_by?: string;
}

// Player 1: Create offer
const xdr = await numberGuessService.prepareStartGame({
  player1Address: myAddress,
  player2Address: Address.fromString('G00000...'), // Placeholder
  player1Faction: 0,
  wager: BigInt(100_0000000),
  sessionId: sessionId
});

await api.createOffer({
  session_id: sessionId,
  player1: myAddress,
  player1_faction: 0,
  wager: BigInt(100_0000000),
  xdr: xdr,
  xdr_hash: hash(xdr),
  expires_at: Date.now() + 300000 // 5 minutes
});

// Player 2: Browse offers
const offers = await api.getOffers({
  status: 'open',
  minWager: 0,
  maxWager: 1000
});

// Player 2: Accept offer
const offer = offers[0];

// Verify XDR matches metadata
const xdrHash = hash(offer.xdr);
if (xdrHash !== offer.xdr_hash) throw new Error("XDR tampered");

const signedXDR = await numberGuessService.importAndSignAuthEntry(
  offer.xdr,
  myAddress,
  player2Signer
);

await numberGuessService.finalizeStartGame(
  signedXDR,
  myAddress,
  player2Signer
);

// Update database
await api.updateOffer(offer.id, {
  status: 'accepted',
  accepted_by: myAddress
});
```

**Database schema:**

```sql
CREATE TABLE game_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id integer NOT NULL,
  player1 text NOT NULL,
  player1_faction integer NOT NULL,
  wager bigint NOT NULL,
  xdr text NOT NULL,
  xdr_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'expired', 'cancelled')),
  accepted_by text,
  accepted_at timestamptz
);

CREATE INDEX idx_open_offers ON game_offers(status, expires_at)
  WHERE status = 'open';

-- Cleanup expired offers (cron job)
DELETE FROM game_offers
WHERE status = 'open' AND expires_at < now();
```

**Pros:**
- ✅ Good UX - lobby with offer discovery
- ✅ Works with current contract (no changes needed)
- ✅ Leverages existing XDR pattern
- ✅ Lower on-chain costs (only game start)
- ✅ Can add rich filters, sorting, player ratings
- ✅ Flexible (easy to add features)
- ✅ Faster to implement than on-chain solution

**Cons:**
- ❌ Requires centralized database (trust assumption)
- ❌ Nonce expiration limits offer lifetime (~5 min)
- ❌ Race conditions if multiple Player 2s accept simultaneously
- ❌ Need to validate XDR hasn't been tampered with
- ❌ Database maintenance (cleanup, backups)

**Best for:** MVP matchmaking with minimal contract changes, rapid iteration

**Gas Cost:** Same as direct start_game call

---

### Option 4: Authorization Delegation via Custom Account Contract

**Status:** 🔬 Advanced pattern, research only

**How it works:**
1. Players deploy or use a shared "game vault" custom account contract
2. Players pre-authorize the account contract to spend their FP
3. Account contract implements custom `__check_auth` logic
4. Matchmaking happens through account contract invocations
5. Account contract handles all player authorizations

**Architecture:**

```rust
// Custom account contract (simplified)
pub struct GameVaultAccount;

impl GameVaultAccount {
    // Custom authorization logic
    fn __check_auth(
        env: Env,
        signature_payload: BytesN<32>,
        signatures: Vec<Val>,
        auth_contexts: Vec<Context>
    ) -> Result<(), Error> {
        // Verify player has authorized this specific game session
        // Check delegation rules and expiry
        // Validate signature matches expected player

        // Load player's authorization preferences
        let player_auth = get_player_authorization(&env, &auth_contexts)?;

        // Verify this invocation matches authorized params
        verify_authorization_matches(&signature_payload, &player_auth)?;

        Ok(())
    }

    // Pre-authorize game sessions
    pub fn authorize_game_session(
        env: Env,
        player: Address,
        session_params: GameSessionParams
    ) {
        player.require_auth();

        // Store authorization for later use
        let auth_id = generate_auth_id(&env);
        env.storage().persistent().set(
            &DataKey::Authorization(auth_id),
            &Authorization {
                player,
                params: session_params,
                expiry: env.ledger().timestamp() + 3600
            }
        );
    }
}
```

**Pros:**
- ✅ Most flexible authorization pattern
- ✅ Can pre-authorize multiple games at once
- ✅ Sophisticated delegation rules possible
- ✅ No blendizzard changes needed
- ✅ Allows complex workflows (auto-matching, tournaments)

**Cons:**
- ❌ Very complex - custom account contracts are advanced
- ❌ Requires players to deploy/interact with account contract
- ❌ High gas costs (account contract invocations)
- ❌ Security risks if not implemented correctly
- ❌ Steep learning curve for developers and users
- ❌ Not well-documented in Soroban yet

**Best for:** Advanced users, future v2 implementation, research

**Gas Cost:** 3-5x higher than direct start_game

---

## Recommended Implementation Path

### Phase 1 (Immediate): Option 3 - Hybrid Off-Chain Lobby

**Timeline:** 2-3 days

**Why:**
- Works with current contracts (no Rust changes)
- Leverages existing XDR infrastructure
- Good UX for matchmaking
- Fastest to implement and iterate
- Lower risk

**Steps:**
1. Set up Supabase database (or similar)
2. Create `game_offers` table with schema above
3. Add API endpoints:
   - `POST /offers` - Create offer
   - `GET /offers` - List offers (with filters)
   - `PATCH /offers/:id` - Update status
   - `DELETE /offers/:id` - Cancel offer
4. Update `numberGuessService.ts` with wrapper methods
5. Create `MatchmakingLobby` UI component
6. Add offer expiration cleanup (cron job)
7. Handle race conditions (optimistic locking)

**Risks:**
- Database is single point of failure
- XDR validation required to prevent tampering
- Nonce expiration limits offer lifetime

---

### Phase 2 (Future): Option 2 - Matchmaking Pool Contract

**Timeline:** 1-2 weeks (after Phase 1 validates UX)

**Why:**
- Fully decentralized
- Better long-term architecture
- Composable with other protocols
- Eliminates XDR exchange complexity

**Steps:**
1. Create `contracts/matchmaking/` contract
2. Implement core offer management
3. Add FP locking to blendizzard
4. Modify blendizzard authorization model
5. Deploy and test on testnet
6. Comprehensive security audit
7. Generate TypeScript bindings
8. Create UI (can reuse Phase 1 components)
9. Deploy to mainnet

**Migration:**
- Keep Phase 1 as fallback option
- Feature flag to switch between modes
- Let users choose preferred method

---

## Key Implementation Challenges

### 1. Nonce Expiration (All Options)

**Problem:** Authorization entries expire after ~5 minutes (ledger-based)

**Solutions:**
- **Option 1/3:** Show countdown timers on offers, auto-expire
- **Option 2:** Use shorter TTL for offers (2-3 minutes), aggressive cleanup
- **All:** Clear UX indicators when offer is about to expire

### 2. Race Conditions (Options 1, 3)

**Problem:** Multiple Player 2s might try accepting same offer simultaneously

**Solutions:**
- **Database:** Use optimistic locking with version field
- **UI:** Show "pending" state during acceptance
- **Error handling:** Gracefully handle "AlreadyStarted" errors
- **Retry logic:** Suggest alternative offers if race condition occurs

### 3. FP Availability (All Options)

**Problem:** Player 1's FP not locked until game starts (Options 1, 3)

**Solutions:**
- **Option 1/3:** Query FP availability before finalizing
- **Option 2:** Lock FP on offer creation
- **UI:** Show Player 1's current available FP
- **Error handling:** Handle "InsufficientFP" errors gracefully

### 4. Security (All Options)

**Concerns:**
- XDR tampering (Options 1, 3)
- Spam offers (All)
- Griefing attacks (lock FP without accepting)
- Signature verification

**Solutions:**
- **XDR validation:** Hash verification, parameter checks
- **Rate limiting:** Limit offers per player per time window
- **Deposits:** Small deposit required for offer creation (refunded)
- **Reputation:** Track player reliability, show completion rate

### 5. Contract Authorization Changes (Option 2)

**Problem:** Modifying authorization model has security implications

**Solutions:**
- **Whitelist approach:** Store trusted matchmaking contract address
- **Separate method:** Add `start_game_delegated()` instead of modifying existing
- **Extensive testing:** Unit tests, integration tests, fuzzing
- **Audit:** Security audit before mainnet deployment
- **Upgrade path:** Make matchmaking contract upgradeable for fixes

---

## Gas Cost Analysis

Approximate gas costs for each option (Testnet estimates):

| Operation | Option 1 (XDR) | Option 2 (On-chain) | Option 3 (Hybrid) |
|-----------|----------------|---------------------|-------------------|
| Create offer | 0 (off-chain) | ~500k stroops | 0 (off-chain) |
| Browse offers | 0 (off-chain) | ~50k per query | 0 (off-chain) |
| Accept offer | ~300k stroops | ~800k stroops | ~300k stroops |
| Cancel offer | 0 | ~200k stroops | 0 |
| **Total per game** | ~300k | ~1.3M | ~300k |

**Notes:**
- Option 2 is ~4x more expensive but fully decentralized
- Costs will decrease as network matures and optimization improves
- On-chain storage is most expensive operation

---

## Security Considerations

### Option 1 & 3 (XDR Exchange)
- ✅ Trustless execution once both signatures collected
- ⚠️ XDR could be modified before Player 2 sees it (verify hash)
- ⚠️ Database compromise could leak game preferences
- ✅ No new attack surface on contracts

### Option 2 (On-chain Matchmaking)
- ✅ Fully trustless and transparent
- ⚠️ New contract increases attack surface
- ⚠️ Authorization delegation must be carefully designed
- ⚠️ FP locking mechanism must maintain invariants
- ⚠️ Offer spam could bloat storage

### Option 4 (Custom Accounts)
- ⚠️ Very high complexity = more bugs
- ⚠️ Authorization logic is critical security boundary
- ⚠️ Not recommended without extensive audit

---

## UX Considerations

### Discovery
- **Option 1:** No discovery (direct challenge via link)
- **Option 2:** On-chain query (requires indexer for good UX)
- **Option 3:** Database with rich queries (best UX)

### Speed
- **Option 1:** Fast once both players coordinated
- **Option 2:** Fast (1 transaction per action)
- **Option 3:** Fast (API latency negligible)

### Coordination
- **Option 1:** Requires external coordination (share link)
- **Option 2:** No coordination needed
- **Option 3:** No coordination needed

### Trust
- **Option 1:** Trustless
- **Option 2:** Trustless
- **Option 3:** Requires trusting database operator

---

## Recommendation Summary

### Start with Option 3 (Hybrid)
- Fastest path to good UX
- Minimal risk (no contract changes)
- Validates matchmaking demand
- Easy to iterate and improve

### Migrate to Option 2 (On-chain) when:
- Matchmaking proves popular
- Gas costs decrease
- Security audit completed
- Decentralization becomes priority

### Keep Option 1 (XDR) as:
- Fallback for direct challenges
- Power-user feature
- Redundancy if database down

---

## Next Steps

1. **Decision:** Choose starting architecture (recommend Option 3)
2. **Design:** Detailed API and database schema
3. **Implementation:** Build matchmaking service
4. **Testing:** Race conditions, expiration, security
5. **Deploy:** Testnet first, gather feedback
6. **Iterate:** Improve based on user behavior
7. **Future:** Plan migration to Option 2 if warranted

---

## Questions to Resolve

Before implementation, clarify:

1. **Offer lifetime:** What's acceptable waiting time? (Recommend: 5 minutes)
2. **FP locking:** Lock on offer creation or game start? (Phase 1: game start, Phase 2: offer creation)
3. **Race conditions:** How to handle multiple acceptors? (Recommend: first wins, others see error)
4. **Discovery UX:** List view, card view, filters? (Recommend: card grid with faction/wager filters)
5. **Notifications:** Real-time updates or polling? (Recommend: Supabase real-time for Phase 1)
6. **Cancellation:** Allow creator to cancel anytime? (Recommend: yes, unless already accepted)
7. **Reputation:** Track player stats (completion rate, games played)? (Recommend: Phase 2)
8. **Tournaments:** Support bracket-style matching? (Recommend: Phase 3)

---

## References

- Current XDR implementation: `bunt/services/numberGuessService.ts`
- Blendizzard game logic: `contracts/blendizzard/src/game.rs`
- Soroban auth docs: https://soroban.stellar.org/docs/learn/authorization
- Sub-invocation pattern: https://soroban.stellar.org/docs/learn/interacting-with-contracts

---

*Document created: 2025-11-21*
*Author: Claude Code (based on research and analysis)*
*Status: Planning / Pre-implementation*
