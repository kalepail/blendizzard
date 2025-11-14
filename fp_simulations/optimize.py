#!/usr/bin/env python3
"""
Optimize FP Multiplier Parameters

Tests different peak values and ceiling ranges to find optimal balance for:
- Early adoption incentive
- Player retention
- Whale discouragement
- Long-term player fairness
"""

import numpy as np
import pandas as pd
from tabulate import tabulate
from typing import Dict, List, Tuple
import algorithms as algo

# ============================================================================
# Test Configurations
# ============================================================================

# Peak multiplier values to test
PEAK_VALUES = [3.0, 4.0, 5.0, 6.0, 7.0, 8.0]

# Ceiling configurations: (max_amount, max_time_days, description)
CEILING_CONFIGS = [
    (10_000, 245, "Tight (5-35w, $1k-$10k)"),      # 5-35 weeks
    (50_000, 280, "Medium ($1k-$50k, 5-40w)"),     # 5-40 weeks
    (100_000, 350, "Wide ($1k-$100k, 5-50w)"),     # Current: 5-50 weeks
]

# Player archetypes for testing
SCENARIOS = [
    # Early adopters (key for launch)
    (100, 7, "Week 1 Entry Player"),
    (500, 14, "Week 2 Growing Player"),
    (1000, 21, "Week 3 Committed Player"),
    (1000, 35, "TARGET: Sweet Spot (5 weeks)"),

    # Retention scenarios
    (1000, 70, "10 Week Loyal Player"),
    (1500, 70, "10 Week Above-Target"),
    (500, 140, "20 Week Long-Term Small"),
    (1000, 140, "20 Week Long-Term Target"),

    # Whale scenarios
    (5000, 35, "Early $5k Whale"),
    (10000, 35, "$10k Whale @ Target Time"),
    (10000, 70, "$10k Whale @ 10 Weeks"),
    (10000, 245, "$10k Whale @ 35 Weeks (Max Tight)"),
    (50000, 140, "$50k Mega Whale @ 20w"),
    (100000, 245, "$100k Max Whale @ 35w"),

    # Edge cases
    (10, 1, "Micro Flash"),
    (10000, 1, "Flash Whale Attack"),
    (100, 245, "Long-Term Micro (35w)"),
]

# ============================================================================
# Simulation Functions
# ============================================================================

def calculate_smooth_piecewise_mult(
    value: float,
    target: float,
    maximum: float,
    peak: float
) -> float:
    """
    Calculate smooth piecewise multiplier

    Args:
        value: Current value (amount or time)
        target: Target value for peak
        maximum: Maximum value (returns to 1.0x)
        peak: Peak multiplier value
    """
    if value <= 0:
        return 1.0

    if value <= target:
        # Rising segment
        t = value / target
        # Hermite: h(t) = 3t² - 2t³
        h = 3 * t**2 - 2 * t**3
        return 1.0 + h * (peak - 1.0)
    else:
        # Falling segment
        capped_value = min(value, maximum)
        excess = capped_value - target
        range_val = maximum - target
        t = excess / range_val
        h = 3 * t**2 - 2 * t**3
        return peak - h * (peak - 1.0)

def simulate_scenario(
    amount: float,
    time_days: float,
    peak: float,
    max_amount: float,
    max_time_days: float,
    target_amount: float = 1000,
    target_time_days: float = 35
) -> Dict:
    """Simulate FP calculation for a scenario"""

    # Component peak (sqrt of combined peak)
    component_peak = np.sqrt(peak)

    # Calculate multipliers
    amount_mult = calculate_smooth_piecewise_mult(
        amount, target_amount, max_amount, component_peak
    )

    time_mult = calculate_smooth_piecewise_mult(
        time_days, target_time_days, max_time_days, component_peak
    )

    combined_mult = amount_mult * time_mult

    # FP calculation
    base_fp = amount * 100
    final_fp = base_fp * combined_mult
    fp_per_dollar = final_fp / amount if amount > 0 else 0

    return {
        'amount_mult': amount_mult,
        'time_mult': time_mult,
        'combined_mult': combined_mult,
        'final_fp': final_fp,
        'fp_per_dollar': fp_per_dollar,
    }

# ============================================================================
# Analysis Functions
# ============================================================================

def analyze_early_adoption(results: List[Dict]) -> Dict:
    """Analyze early adoption incentives"""
    week1 = next(r for r in results if r['scenario'] == 'Week 1 Entry Player')
    week2 = next(r for r in results if r['scenario'] == 'Week 2 Growing Player')
    week3 = next(r for r in results if r['scenario'] == 'Week 3 Committed Player')
    target = next(r for r in results if r['scenario'] == 'TARGET: Sweet Spot (5 weeks)')

    return {
        'week1_fp_per_$': week1['fp_per_dollar'],
        'week2_fp_per_$': week2['fp_per_dollar'],
        'week3_fp_per_$': week3['fp_per_dollar'],
        'target_fp_per_$': target['fp_per_dollar'],
        'week1_vs_target': week1['fp_per_dollar'] / target['fp_per_dollar'],
        'week3_vs_target': week3['fp_per_dollar'] / target['fp_per_dollar'],
        'early_growth_rate': (week3['fp_per_dollar'] - week1['fp_per_dollar']) / week1['fp_per_dollar'],
    }

def analyze_retention(results: List[Dict]) -> Dict:
    """Analyze long-term retention incentives"""
    target = next(r for r in results if r['scenario'] == 'TARGET: Sweet Spot (5 weeks)')
    week10 = next(r for r in results if r['scenario'] == '10 Week Loyal Player')
    week20 = next(r for r in results if r['scenario'] == '20 Week Long-Term Target')

    # Check if long-term micro exists (depends on ceiling config)
    long_micro = next((r for r in results if r['scenario'] == 'Long-Term Micro (35w)'), None)

    retention = {
        'target_fp_per_$': target['fp_per_dollar'],
        'week10_fp_per_$': week10['fp_per_dollar'],
        'week20_fp_per_$': week20['fp_per_dollar'],
        'week10_vs_target': week10['fp_per_dollar'] / target['fp_per_dollar'],
        'week20_vs_target': week20['fp_per_dollar'] / target['fp_per_dollar'],
        'retention_penalty': 1.0 - (week20['fp_per_dollar'] / target['fp_per_dollar']),
    }

    if long_micro:
        retention['long_micro_fp_per_$'] = long_micro['fp_per_dollar']
        retention['long_micro_vs_target'] = long_micro['fp_per_dollar'] / target['fp_per_dollar']

    return retention

def analyze_whale_control(results: List[Dict]) -> Dict:
    """Analyze whale discouragement"""
    target = next(r for r in results if r['scenario'] == 'TARGET: Sweet Spot (5 weeks)')
    flash_whale = next(r for r in results if r['scenario'] == 'Flash Whale Attack')
    whale_5k = next(r for r in results if r['scenario'] == 'Early $5k Whale')
    whale_10k_target = next(r for r in results if r['scenario'] == '$10k Whale @ Target Time')
    whale_10k_10w = next(r for r in results if r['scenario'] == '$10k Whale @ 10 Weeks')

    # Optional whales (depend on ceiling)
    whale_50k = next((r for r in results if r['scenario'] == '$50k Mega Whale @ 20w'), None)
    whale_100k = next((r for r in results if r['scenario'] == '$100k Max Whale @ 35w'), None)

    control = {
        'target_fp_per_$': target['fp_per_dollar'],
        'flash_whale_fp_per_$': flash_whale['fp_per_dollar'],
        'whale_5k_fp_per_$': whale_5k['fp_per_dollar'],
        'whale_10k_target_fp_per_$': whale_10k_target['fp_per_dollar'],
        'whale_10k_10w_fp_per_$': whale_10k_10w['fp_per_dollar'],
        'flash_whale_efficiency': flash_whale['fp_per_dollar'] / target['fp_per_dollar'],
        'whale_5k_efficiency': whale_5k['fp_per_dollar'] / target['fp_per_dollar'],
        'whale_10k_target_efficiency': whale_10k_target['fp_per_dollar'] / target['fp_per_dollar'],
        'whale_10k_10w_efficiency': whale_10k_10w['fp_per_dollar'] / target['fp_per_dollar'],
    }

    if whale_50k:
        control['whale_50k_fp_per_$'] = whale_50k['fp_per_dollar']
        control['whale_50k_efficiency'] = whale_50k['fp_per_dollar'] / target['fp_per_dollar']

    if whale_100k:
        control['whale_100k_fp_per_$'] = whale_100k['fp_per_dollar']
        control['whale_100k_efficiency'] = whale_100k['fp_per_dollar'] / target['fp_per_dollar']

    return control

def score_configuration(
    peak: float,
    max_amount: float,
    max_time_days: float,
    config_name: str
) -> Dict:
    """
    Score a configuration based on key metrics

    Scoring criteria:
    - Early adoption incentive (higher is better)
    - Retention balance (not too harsh)
    - Whale control (lower efficiency for whales)
    - Overall balance
    """

    # Run all scenarios
    results = []
    for amount, time_days, description in SCENARIOS:
        # Skip scenarios beyond ceiling
        if amount > max_amount or time_days > max_time_days:
            continue

        sim = simulate_scenario(amount, time_days, peak, max_amount, max_time_days)
        results.append({
            'scenario': description,
            'amount': amount,
            'time_days': time_days,
            **sim
        })

    # Analyze
    early = analyze_early_adoption(results)
    retention = analyze_retention(results)
    whale = analyze_whale_control(results)

    # Calculate scores (0-100)

    # 1. Early Adoption Score (want high FP growth in first 3 weeks)
    early_growth = early['early_growth_rate']
    early_score = min(100, early_growth * 100)  # 100% growth = 100 points

    # 2. Retention Score (want week 20 to be 70-90% of target, not too harsh)
    retention_ratio = retention['week20_vs_target']
    # Ideal: 0.70-0.90 range
    if 0.70 <= retention_ratio <= 0.90:
        retention_score = 100
    elif retention_ratio > 0.90:
        # Too generous to long-term, no penalty for being at target
        retention_score = 100 - (retention_ratio - 0.90) * 200
    else:
        # Too harsh on long-term
        retention_score = 100 - (0.70 - retention_ratio) * 200
    retention_score = max(0, min(100, retention_score))

    # 3. Whale Control Score (want whales at <40% target efficiency)
    # Use highest whale efficiency as benchmark
    whale_efficiencies = [
        whale['flash_whale_efficiency'],
        whale['whale_5k_efficiency'],
        whale['whale_10k_target_efficiency'],
        whale['whale_10k_10w_efficiency'],
    ]
    if 'whale_50k_efficiency' in whale:
        whale_efficiencies.append(whale['whale_50k_efficiency'])
    if 'whale_100k_efficiency' in whale:
        whale_efficiencies.append(whale['whale_100k_efficiency'])

    max_whale_efficiency = max(whale_efficiencies)

    # Ideal: <0.40 (40% of target)
    if max_whale_efficiency < 0.40:
        whale_score = 100
    else:
        # Penalize for whales being too efficient
        whale_score = 100 - (max_whale_efficiency - 0.40) * 200
    whale_score = max(0, min(100, whale_score))

    # 4. Target Achievement Score (want target at peak)
    target_mult = early['target_fp_per_$'] / 100  # Divide by base 100 to get multiplier
    # Ideal: equals peak
    target_score = 100 - abs(target_mult - peak) * 20
    target_score = max(0, min(100, target_score))

    # 5. Flash Whale Control (specifically penalize flash whales)
    flash_efficiency = whale['flash_whale_efficiency']
    # Ideal: <0.30
    if flash_efficiency < 0.30:
        flash_score = 100
    else:
        flash_score = 100 - (flash_efficiency - 0.30) * 200
    flash_score = max(0, min(100, flash_score))

    # Weighted average
    total_score = (
        early_score * 0.25 +       # 25% early adoption
        retention_score * 0.20 +   # 20% retention
        whale_score * 0.25 +       # 25% whale control
        target_score * 0.15 +      # 15% target achievement
        flash_score * 0.15         # 15% flash whale control
    )

    return {
        'peak': peak,
        'config': config_name,
        'max_amount': max_amount,
        'max_time_days': max_time_days,
        'total_score': total_score,
        'early_score': early_score,
        'retention_score': retention_score,
        'whale_score': whale_score,
        'target_score': target_score,
        'flash_score': flash_score,
        'early_growth_rate': early['early_growth_rate'],
        'week20_retention': retention['week20_vs_target'],
        'max_whale_efficiency': max_whale_efficiency,
        'flash_whale_efficiency': flash_efficiency,
        'target_fp_per_$': early['target_fp_per_$'],
        'early': early,
        'retention': retention,
        'whale': whale,
    }

# ============================================================================
# Main Analysis
# ============================================================================

def run_optimization():
    """Run full optimization analysis"""

    print("=" * 80)
    print("FACTION POINTS MULTIPLIER OPTIMIZATION")
    print("=" * 80)
    print()
    print("Testing configurations:")
    print(f"  Peak values: {PEAK_VALUES}")
    print(f"  Ceiling configs: {len(CEILING_CONFIGS)}")
    print()

    # Test all combinations
    all_scores = []

    for peak in PEAK_VALUES:
        for max_amount, max_time_days, config_name in CEILING_CONFIGS:
            score = score_configuration(peak, max_amount, max_time_days, config_name)
            all_scores.append(score)

    # Create DataFrame
    df = pd.DataFrame(all_scores)

    # Sort by total score
    df_sorted = df.sort_values('total_score', ascending=False)

    # Display top 10
    print("=" * 80)
    print("TOP 10 CONFIGURATIONS (by total score)")
    print("=" * 80)
    print()

    display_cols = [
        'peak', 'config', 'total_score',
        'early_score', 'retention_score', 'whale_score',
        'target_fp_per_$', 'week20_retention', 'max_whale_efficiency'
    ]

    top10 = df_sorted[display_cols].head(10).copy()
    top10['total_score'] = top10['total_score'].round(1)
    top10['early_score'] = top10['early_score'].round(1)
    top10['retention_score'] = top10['retention_score'].round(1)
    top10['whale_score'] = top10['whale_score'].round(1)
    top10['target_fp_per_$'] = top10['target_fp_per_$'].round(0)
    top10['week20_retention'] = top10['week20_retention'].round(2)
    top10['max_whale_efficiency'] = top10['max_whale_efficiency'].round(2)

    print(tabulate(top10, headers='keys', tablefmt='grid', showindex=False))

    # Detailed analysis of top 3
    print("\n" + "=" * 80)
    print("DETAILED ANALYSIS - TOP 3 CONFIGURATIONS")
    print("=" * 80)

    for idx, row in df_sorted.head(3).iterrows():
        print(f"\n{'='*80}")
        print(f"RANK #{df_sorted.index.get_loc(idx) + 1}: Peak {row['peak']}x, {row['config']}")
        print(f"{'='*80}")
        print(f"Total Score: {row['total_score']:.1f}/100")
        print()

        print("Component Scores:")
        print(f"  Early Adoption:  {row['early_score']:.1f}/100")
        print(f"  Retention:       {row['retention_score']:.1f}/100")
        print(f"  Whale Control:   {row['whale_score']:.1f}/100")
        print(f"  Target Hit:      {row['target_score']:.1f}/100")
        print(f"  Flash Control:   {row['flash_score']:.1f}/100")
        print()

        print("Early Adoption Metrics:")
        early = row['early']
        print(f"  Week 1: {early['week1_fp_per_$']:.0f} FP/$ ({early['week1_vs_target']:.1%} of target)")
        print(f"  Week 2: {early['week2_fp_per_$']:.0f} FP/$ ({early['week2_fp_per_$']/early['week1_fp_per_$']:.2f}x week 1)")
        print(f"  Week 3: {early['week3_fp_per_$']:.0f} FP/$ ({early['week3_vs_target']:.1%} of target)")
        print(f"  Growth Rate: {early['early_growth_rate']:.1%} (week 1→3)")
        print()

        print("Retention Metrics:")
        retention = row['retention']
        print(f"  Target (5w): {retention['target_fp_per_$']:.0f} FP/$")
        print(f"  10 Weeks:    {retention['week10_fp_per_$']:.0f} FP/$ ({retention['week10_vs_target']:.1%} of target)")
        print(f"  20 Weeks:    {retention['week20_fp_per_$']:.0f} FP/$ ({retention['week20_vs_target']:.1%} of target)")
        if 'long_micro_fp_per_$' in retention:
            print(f"  Long Micro:  {retention['long_micro_fp_per_$']:.0f} FP/$ ({retention['long_micro_vs_target']:.1%} of target)")
        print()

        print("Whale Control Metrics:")
        whale = row['whale']
        print(f"  Target:           {whale['target_fp_per_$']:.0f} FP/$")
        print(f"  Flash Whale:      {whale['flash_whale_fp_per_$']:.0f} FP/$ ({whale['flash_whale_efficiency']:.1%} efficiency)")
        print(f"  $5k Early:        {whale['whale_5k_fp_per_$']:.0f} FP/$ ({whale['whale_5k_efficiency']:.1%})")
        print(f"  $10k @ Target:    {whale['whale_10k_target_fp_per_$']:.0f} FP/$ ({whale['whale_10k_target_efficiency']:.1%})")
        print(f"  $10k @ 10w:       {whale['whale_10k_10w_fp_per_$']:.0f} FP/$ ({whale['whale_10k_10w_efficiency']:.1%})")
        if 'whale_50k_fp_per_$' in whale:
            print(f"  $50k @ 20w:       {whale['whale_50k_fp_per_$']:.0f} FP/$ ({whale['whale_50k_efficiency']:.1%})")
        if 'whale_100k_fp_per_$' in whale:
            print(f"  $100k @ 35w:      {whale['whale_100k_fp_per_$']:.0f} FP/$ ({whale['whale_100k_efficiency']:.1%})")

    # Save results
    df_sorted.to_csv('optimization_results.csv', index=False)
    print("\n" + "=" * 80)
    print("✓ Full results saved to optimization_results.csv")
    print("=" * 80)

    # Return top config
    return df_sorted.iloc[0]

if __name__ == '__main__':
    top_config = run_optimization()
