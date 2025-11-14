# Faction Points Multiplier Recommendations

## Executive Summary

After running comprehensive simulations across 6 different multiplier algorithms and 16 player scenarios, I have identified the **optimal multiplier system** for Blendizzard.

**TL;DR Recommendation: Use the Smooth Piecewise algorithm with peak = 5.0x**

---

## Key Findings

### 1. Current System (Asymptotic) Problems

❌ **Whales get BETTER efficiency than target players**
- Target ($1k, 35d): 231 FP per $1
- Mega Whale ($100k, 350d): 382 FP per $1 (1.66x target!)
- **Flash whales are viable**: $10k for 1 day = 197 FP/$

❌ **No incentive ceiling**
- Multiplier keeps growing infinitely (approaches 2.0x × 2.0x = 4.0x)
- Whales with massive deposits dominate the game

❌ **Doesn't meet design goals**
- Goal: Peak at target, decline to extremes
- Reality: Continues rising indefinitely

---

### 2. Algorithm Comparison Summary

| Algorithm | Sweet Spot Performance | Whale Discouragement | Smoothness | Recommendation |
|-----------|------------------------|----------------------|------------|----------------|
| **Current (Asymptotic)** | ⚠️ 231 FP/$ (2.31x) | ❌ Whales get 1.66x target | ✓ Smooth | ❌ Replace |
| **Gaussian (Bell Curve)** | ✓ 500 FP/$ (5.0x) | ✓ Whales get 0.20x target | ✓ Smooth | ⭐ Good |
| **Parabolic (Inverted)** | ✓ 500 FP/$ (5.0x) | ✓ Whales get 0.20x target | ⚠️ Sharp edges | ⚠️ OK |
| **Piecewise Linear** | ✓ 500 FP/$ (5.0x) | ✓ Whales get 0.20x target | ❌ Sharp corners | ❌ Gameable |
| **Smooth Piecewise** | ✓ 500 FP/$ (5.0x) | ✓ Whales get 0.20x target | ✓✓ Very smooth | ⭐⭐ BEST |
| **Asymmetric** | ✓ 500 FP/$ (5.0x) | ✓ Whales get 0.20x target | ✓ Smooth | ⭐ Good |

---

## Recommended Algorithm: **Smooth Piecewise (Cubic Hermite Spline)**

### Why This Algorithm Wins

✅ **Perfectly achieves target sweet spot**: 500 FP/$ at $1k, 35 days (5.0x combined)

✅ **Excellent whale discouragement**:
- Mega Whale ($100k, 350d): 100 FP/$ (0.20x target efficiency)
- Flash Whale ($10k, 1d): 221 FP/$ (0.44x target efficiency)
- **Result**: Whales get <50% efficiency of target players ✓

✅ **Smoothest curves** (no exploitable discontinuities):
- Uses cubic interpolation (Hermite spline)
- Zero derivatives at endpoints (gentle transitions)
- No sharp corners or kinks

✅ **Predictable behavior**:
- Linear-like rise to target
- Linear-like fall after target
- But with smooth acceleration/deceleration

✅ **Fair to all player types**:
- Small long-term holders can compete
- Medium players rewarded appropriately
- Large players not excessively punished (just not as efficient)

---

## Implementation Formula

### Smooth Piecewise Amount Multiplier

```python
def smooth_piecewise_amount_multiplier(amount_usd: i128, peak: i128 = 5_0000000) -> i128 {
    if amount_usd <= 0 {
        return FIXED_POINT_ONE; // 1.0x
    }

    let target_amount = 1000_0000000; // $1,000
    let max_amount = 100000_0000000;  // $100,000

    if amount_usd <= target_amount {
        // Rise from 1.0x to peak using smooth curve
        let t = amount_usd.fixed_div_floor(target_amount, SCALAR_7)?;
        // Hermite basis: h(t) = 3t² - 2t³
        let t_squared = t.fixed_mul_floor(t, SCALAR_7)?;
        let t_cubed = t_squared.fixed_mul_floor(t, SCALAR_7)?;
        let h = (3 * t_squared - 2 * t_cubed)?;

        return FIXED_POINT_ONE + h.fixed_mul_floor(peak - FIXED_POINT_ONE, SCALAR_7)?;
    } else {
        // Fall from peak to 1.0x using smooth curve
        let excess = min(amount_usd - target_amount, max_amount - target_amount);
        let t = excess.fixed_div_floor(max_amount - target_amount, SCALAR_7)?;
        let t_squared = t.fixed_mul_floor(t, SCALAR_7)?;
        let t_cubed = t_squared.fixed_mul_floor(t, SCALAR_7)?;
        let h = (3 * t_squared - 2 * t_cubed)?;

        return peak - h.fixed_mul_floor(peak - FIXED_POINT_ONE, SCALAR_7)?;
    }
}
```

### Smooth Piecewise Time Multiplier

```python
def smooth_piecewise_time_multiplier(time_days: u64, peak: i128 = 5_0000000) -> i128 {
    if time_days == 0 {
        return FIXED_POINT_ONE;
    }

    let target_time = 35; // 35 days (5 weeks)
    let max_time = 350;   // 350 days (50 weeks)

    if time_days <= target_time {
        // Rise from 1.0x to peak
        let t = (time_days as i128).fixed_div_floor(target_time as i128, SCALAR_7)?;
        let t_squared = t.fixed_mul_floor(t, SCALAR_7)?;
        let t_cubed = t_squared.fixed_mul_floor(t, SCALAR_7)?;
        let h = (3 * t_squared - 2 * t_cubed)?;

        return FIXED_POINT_ONE + h.fixed_mul_floor(peak - FIXED_POINT_ONE, SCALAR_7)?;
    } else {
        // Fall from peak to 1.0x
        let excess = min(time_days - target_time, max_time - target_time);
        let t = (excess as i128).fixed_div_floor((max_time - target_time) as i128, SCALAR_7)?;
        let t_squared = t.fixed_mul_floor(t, SCALAR_7)?;
        let t_cubed = t_squared.fixed_mul_floor(t, SCALAR_7)?;
        let h = (3 * t_squared - 2 * t_cubed)?;

        return peak - h.fixed_mul_floor(peak - FIXED_POINT_ONE, SCALAR_7)?;
    }
}
```

### Combined Multiplier

```rust
// Each component uses sqrt(5) ≈ 2.236x so product = 5.0x
let component_peak = 2_2360680; // sqrt(5) in fixed-point

let amount_mult = smooth_piecewise_amount_multiplier(amount, component_peak)?;
let time_mult = smooth_piecewise_time_multiplier(time_days, component_peak)?;

let combined_mult = amount_mult.fixed_mul_floor(time_mult, SCALAR_7)?;
```

---

## Alternative: Gaussian (Bell Curve)

If you prefer a more "organic" mathematical curve, **Gaussian is also excellent**:

### Pros:
- Classic bell curve (aesthetically pleasing)
- Mathematically elegant
- Same whale discouragement as Smooth Piecewise

### Cons:
- More complex calculation (exponential)
- Slightly higher gas costs
- Less intuitive to explain to players

**Gaussian Formula:**
```rust
// Amount multiplier
let sigma = 800_0000000; // Controls curve width (0.8 × $1000)
let diff = amount_usd - 1000_0000000;
let exponent = -(diff² / (2 × sigma²));
multiplier = 1.0 + (peak - 1.0) × e^exponent;
```

---

## Peak Value Recommendation

**Recommended: peak = 5.0x** (component peak = 2.236x each)

### Testing Results (Gaussian algorithm):

| Peak | Target FP | Target FP/$ | Whale FP/$ | Whale/Target Ratio |
|------|-----------|-------------|------------|-------------------|
| 3.0x | 299,999 | 300 | 100 | 0.33x |
| 4.0x | 400,000 | 400 | 100 | 0.25x |
| **5.0x** | **500,000** | **500** | **100** | **0.20x** ⭐ |
| 6.0x | 599,999 | 600 | 100 | 0.17x |
| 7.0x | 700,000 | 700 | 100 | 0.14x |

**Why 5.0x is optimal:**
- Sweet spot players get **5x boost** (strong incentive)
- Whales get **1.0x** at extremes (no advantage)
- **5:1 efficiency ratio** creates clear targeting
- Higher peaks don't significantly improve whale discouragement
- Lower peaks reduce target player incentive

---

## Scenario Analysis

### Target Sweet Spot ($1k, 35 days)
- **Current**: 230,769 FP (2.31x mult)
- **Smooth Piecewise**: 500,000 FP (5.0x mult) ✓
- **Improvement**: +117% more FP for target behavior!

### Mega Whale ($100k, 350 days)
- **Current**: 38,230,849 FP (382 FP/$) ❌
- **Smooth Piecewise**: 10,000,000 FP (100 FP/$) ✓
- **Whale efficiency**: 0.20x of target (down from 1.66x!)

### Flash Whale ($10k, 1 day)
- **Current**: 1,970,674 FP (197 FP/$) ❌
- **Smooth Piecewise**: 2,213,833 FP (221 FP/$) ⚠️
- **Whale efficiency**: 0.44x of target (acceptable)

### Small Long-term Holder ($100, 350 days)
- **Current**: 20,956 FP (210 FP/$)
- **Smooth Piecewise**: 10,346 FP (103 FP/$)
- **Note**: Reduced but fair (shouldn't match target without capital)

---

## Implementation Checklist

### Phase 1: Update Constants
```rust
// In types.rs
pub const TARGET_AMOUNT_USD: i128 = 1000_0000000;
pub const MAX_AMOUNT_USD: i128 = 100000_0000000;
pub const TARGET_TIME_DAYS: u64 = 35;
pub const MAX_TIME_DAYS: u64 = 350;
pub const COMPONENT_PEAK: i128 = 2_2360680; // sqrt(5) with 7 decimals
```

### Phase 2: Replace Multiplier Functions
- [ ] Replace `calculate_amount_multiplier()` in faction_points.rs
- [ ] Replace `calculate_time_multiplier()` in faction_points.rs
- [ ] Update documentation/comments

### Phase 3: Testing
- [ ] Unit tests for new multiplier formulas
- [ ] Edge case tests (0, target, max values)
- [ ] Overflow protection tests
- [ ] Integration tests with full FP calculation

### Phase 4: Deployment
- [ ] Update contract
- [ ] Communicate changes to community
- [ ] Monitor FP distribution in first epoch

---

## Security Considerations

### ✅ Overflow Protection
- All multiplier calculations use fixed-point math
- Maximum multiplier is 5.0x (won't overflow with reasonable deposits)
- Use `.checked_mul()` and `.fixed_mul_floor()` throughout

### ✅ No Exploitable Discontinuities
- Smooth Piecewise uses continuous derivatives
- No sharp corners where gaming is possible
- Hermite splines ensure C¹ continuity

### ✅ Predictable Behavior
- Players can easily calculate expected FP
- No hidden thresholds or surprise penalties
- Clear target incentives

---

## Comparison to Other Games

### Traditional MMO Mechanics
- **Diminishing returns**: Used in WoW for stats
- **Our approach**: Inverted (returns increase then decrease)
- **Advantage**: Creates specific target behavior vs just capping

### DeFi Yield Curves
- **Curve Finance**: Bonding curves for AMMs
- **Our approach**: Similar bell curve philosophy
- **Advantage**: Encourages specific deposit size vs just "more is better"

### Tokenomics
- **Vesting schedules**: Linear or cliff-based
- **Our approach**: Smooth piecewise (like ease-in/ease-out)
- **Advantage**: No gaming around cliff edges

---

## FAQ

### Q: Why not keep the current asymptotic curves?
**A**: They don't achieve the design goal of declining after the target. Whales get 1.66x better efficiency than target players, which breaks game balance.

### Q: Why 5x instead of 10x or 2x?
**A**: 5x provides strong incentive for target behavior without making FP distribution too extreme. Testing shows 5x gives optimal balance between encouragement and fairness.

### Q: Won't this hurt whales too much?
**A**: Whales still get absolute more FP (10M vs 500k), they just don't get EFFICIENCY advantages. This is intentional - we want skill and engagement to matter, not just capital.

### Q: What if someone deposits exactly at $1k and 35 days repeatedly?
**A**: That's the goal! We WANT players to target this behavior. It creates predictable, sustainable gameplay vs infinite whale escalation.

### Q: Can players game this system?
**A**: Smooth curves minimize gaming. The worst they can do is deposit exactly at target, which is our desired outcome.

---

## Next Steps

1. **Review this recommendation** with the team
2. **Run additional simulations** if needed (custom scenarios)
3. **Implement Smooth Piecewise** algorithm in Rust
4. **Test extensively** (unit + integration)
5. **Deploy to testnet** and monitor
6. **Gather community feedback** before mainnet

---

## Conclusion

The **Smooth Piecewise algorithm with peak = 5.0x** is the clear winner:

✅ Achieves all design goals
✅ Excellent whale discouragement (0.20x efficiency)
✅ Smooth, unexploitable curves
✅ Fair to all player types
✅ Mathematically simple to implement
✅ Predictable and transparent

This replaces the current asymptotic system which inadvertently rewards whales with 1.66x efficiency advantage.

**Recommendation: Implement immediately for next epoch.**
