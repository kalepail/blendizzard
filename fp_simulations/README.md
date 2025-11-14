# Faction Points Multiplier Simulations

This directory contains Python scripts to test and compare different multiplier algorithms for the Blendizzard FP system.

## Goal

Design a multiplier system where:
- **Target Sweet Spot**: $1,000 deposit held for 35 days (5 weeks) gets maximum 5x multiplier
- **Decline to extremes**: Both very small/large deposits and very short/long holds trend back toward 1.0x
- **Discourage whales**: Mega deposits ($100k+) and flash deposits get minimal advantage

## Algorithms Tested

1. **Current (Asymptotic)** - Existing implementation with asymptotic curves
2. **Gaussian (Bell Curve)** - Peaks at target, smooth decay to extremes
3. **Parabolic (Inverted)** - Quadratic curve peaking at target
4. **Piecewise Linear** - Linear rise to peak, linear fall after
5. **Smooth Piecewise** - Cubic interpolation for smooth transitions
6. **Asymmetric** - Steep rise to target, gentle exponential decay after

## Quick Start

### 1. Install Dependencies

```bash
cd fp_simulations
pip install -r requirements.txt
```

### 2. Run Simulation

```bash
python simulate.py
```

This will:
- Test all algorithms across 16 player scenarios
- Generate comparison tables for FP, multipliers, and efficiency
- Analyze sweet spot performance, whale discouragement, and fairness
- Save results to `analysis_report.txt` and `results_raw.csv`

### 3. Generate Visualizations

```bash
python visualize.py
```

This creates:
- `amount_multipliers.png` - Amount curves for all algorithms
- `time_multipliers.png` - Time curves for all algorithms
- `heatmap_*.png` - 2D efficiency heatmaps
- `efficiency_vs_amount.png` - Efficiency at target time (35 days)
- `efficiency_vs_time.png` - Efficiency at target amount ($1k)

## File Structure

```
fp_simulations/
├── README.md              # This file
├── requirements.txt       # Python dependencies
├── algorithms.py          # Multiplier algorithm implementations
├── simulate.py            # Main simulation script
├── visualize.py           # Visualization generation
├── analysis_report.txt    # Generated report (after running)
├── results_raw.csv        # Raw simulation data (after running)
└── *.png                  # Generated plots (after running)
```

## Key Scenarios Tested

- **New Micro Player**: $10, 1 day
- **Entry Player**: $100, 7 days
- **TARGET SWEET SPOT**: $1,000, 35 days ⭐
- **Whale**: $10,000, 100 days
- **MAXIMUM**: $100,000, 350 days
- **Flash Deposit Whale**: $10,000, 1 day (anti-exploit)
- **Long-term Micro**: $100, 350 days (fairness test)

## Metrics

- **Final FP**: Total faction points earned
- **Combined Multiplier**: Product of amount × time multipliers
- **FP Efficiency**: FP per $1 deposited (lower for whales = more balanced)

## Interpreting Results

### Good Algorithm Characteristics:
1. ✓ Target scenario gets highest or near-highest FP efficiency
2. ✓ Mega whales ($100k) get <50% efficiency of target
3. ✓ Flash whales get <50% efficiency of target
4. ✓ Small long-term holders get competitive efficiency
5. ✓ Smooth curves (no exploitable discontinuities)

### Red Flags:
1. ✗ Whales get higher efficiency than target players
2. ✗ Flash deposits are viable strategies
3. ✗ Extreme values cause overflows or zero multipliers
4. ✗ Sharp discontinuities create gaming opportunities

## Customization

### Change Peak Multiplier

Edit `peak` parameter in scripts:

```python
# In simulate.py or visualize.py
peak = 5.0  # Change to 3.0, 4.0, 6.0, etc.
```

### Add New Algorithm

Add to `algorithms.py`:

```python
def my_algorithm_amount_multiplier(amount_usd: float, peak: float = 5.0) -> float:
    # Your implementation
    return multiplier

def my_algorithm_time_multiplier(time_days: float, peak: float = 5.0) -> float:
    # Your implementation
    return multiplier

def my_algorithm_combined(amount_usd: float, time_days: float, peak: float = 5.0) -> float:
    component_peak = np.sqrt(peak)
    return (my_algorithm_amount_multiplier(amount_usd, component_peak) *
            my_algorithm_time_multiplier(time_days, component_peak))

# Register in ALGORITHMS dict
ALGORITHMS['my_algo'] = {
    'name': 'My Algorithm',
    'amount': my_algorithm_amount_multiplier,
    'time': my_algorithm_time_multiplier,
    'combined': my_algorithm_combined,
}
```

### Add New Scenario

Edit `SCENARIOS` in `simulate.py`:

```python
SCENARIOS.append((5000, 100, "My Custom Scenario"))
```

## Notes

- All amounts are in USD (7 decimals on Stellar)
- Time is in days (converted to seconds in contract)
- Base FP rate: 1 USDC = 100 FP (before multipliers)
- Combined multiplier = amount_mult × time_mult
- Each component uses √peak so product = peak
