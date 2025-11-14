#!/usr/bin/env python3
"""
Faction Points Multiplier Simulation

Compares different multiplier algorithms across various player scenarios.
"""

import numpy as np
import pandas as pd
from tabulate import tabulate
from typing import Dict, List
import algorithms as algo

# ============================================================================
# Test Scenarios
# ============================================================================

# Player archetypes to test
SCENARIOS = [
    # (amount_usd, time_days, description)
    (10, 1, "New Micro Player"),
    (50, 3, "Casual New Player"),
    (100, 7, "Entry Player (1 week)"),
    (250, 14, "Growing Player (2 weeks)"),
    (500, 21, "Mid-tier (3 weeks)"),
    (1000, 35, "TARGET SWEET SPOT"),
    (1500, 35, "Above Target Amount"),
    (1000, 60, "Target Amount, Long Hold"),
    (2000, 35, "2x Target Amount"),
    (5000, 70, "Large Player (10 weeks)"),
    (10000, 100, "Whale (3+ months)"),
    (25000, 150, "Big Whale"),
    (50000, 250, "Mega Whale"),
    (100000, 350, "MAXIMUM (50 weeks, $100k)"),
    (100, 350, "Long-term Micro"),
    (10000, 1, "Flash Deposit Whale"),
]

# ============================================================================
# Simulation Functions
# ============================================================================

def calculate_fp(amount_usd: float, time_days: float, algorithm: str, peak: float = 5.0) -> Dict:
    """
    Calculate FP for given scenario using specified algorithm

    Returns:
        Dictionary with amount_mult, time_mult, combined_mult, and final FP
    """
    algo_funcs = algo.ALGORITHMS[algorithm]

    # Calculate multipliers (handling peak parameter for new algorithms)
    if algorithm == 'current':
        amount_mult = algo_funcs['amount'](amount_usd)
        time_mult = algo_funcs['time'](time_days)
        combined_mult = algo_funcs['combined'](amount_usd, time_days)
    else:
        amount_mult = algo_funcs['amount'](amount_usd, peak)
        time_mult = algo_funcs['time'](time_days, peak)
        combined_mult = algo_funcs['combined'](amount_usd, time_days, peak)

    # Base FP calculation: (amount_usd * 100) * combined_mult
    base_fp = amount_usd * 100
    final_fp = base_fp * combined_mult

    return {
        'amount_mult': amount_mult,
        'time_mult': time_mult,
        'combined_mult': combined_mult,
        'base_fp': base_fp,
        'final_fp': final_fp,
        'fp_per_dollar': final_fp / amount_usd if amount_usd > 0 else 0,
    }

def run_scenario_comparison(peak: float = 5.0) -> pd.DataFrame:
    """
    Run all scenarios across all algorithms

    Returns:
        DataFrame with results for each scenario and algorithm
    """
    results = []

    for amount_usd, time_days, description in SCENARIOS:
        row = {
            'Scenario': description,
            'Amount': f'${amount_usd:,}',
            'Time': f'{time_days}d',
        }

        for algo_key in algo.ALGORITHMS.keys():
            fp_data = calculate_fp(amount_usd, time_days, algo_key, peak)
            row[f'{algo_key}_fp'] = int(fp_data['final_fp'])
            row[f'{algo_key}_mult'] = fp_data['combined_mult']
            row[f'{algo_key}_fp_per_$'] = fp_data['fp_per_dollar']

        results.append(row)

    return pd.DataFrame(results)

def create_comparison_table(df: pd.DataFrame, metric: str = 'fp') -> str:
    """
    Create a formatted comparison table

    Args:
        df: Results DataFrame
        metric: 'fp', 'mult', or 'fp_per_$'

    Returns:
        Formatted table string
    """
    # Select columns based on metric
    base_cols = ['Scenario', 'Amount', 'Time']
    algo_cols = [f'{key}_{metric}' for key in algo.ALGORITHMS.keys()]

    # Rename algorithm columns to friendly names
    display_df = df[base_cols + algo_cols].copy()

    # Rename columns
    for key, algo_info in algo.ALGORITHMS.items():
        old_name = f'{key}_{metric}'
        new_name = algo_info['name']
        if old_name in display_df.columns:
            display_df.rename(columns={old_name: new_name}, inplace=True)

    # Format numbers
    if metric == 'fp':
        for col in display_df.columns[3:]:
            display_df[col] = display_df[col].apply(lambda x: f'{int(x):,}')
    elif metric == 'mult':
        for col in display_df.columns[3:]:
            display_df[col] = display_df[col].apply(lambda x: f'{x:.2f}x')
    elif metric == 'fp_per_$':
        for col in display_df.columns[3:]:
            display_df[col] = display_df[col].apply(lambda x: f'{x:.0f}')

    return tabulate(display_df, headers='keys', tablefmt='grid', showindex=False)

def analyze_sweet_spot_performance(df: pd.DataFrame) -> str:
    """
    Analyze how well each algorithm achieves the target sweet spot
    """
    # Find the target row
    target_row = df[df['Scenario'] == 'TARGET SWEET SPOT'].iloc[0]

    analysis = "\n=== SWEET SPOT ANALYSIS ($1,000 @ 35 days) ===\n\n"

    for algo_key, algo_info in algo.ALGORITHMS.items():
        fp = target_row[f'{algo_key}_fp']
        mult = target_row[f'{algo_key}_mult']
        fp_per_dollar = target_row[f'{algo_key}_fp_per_$']

        analysis += f"{algo_info['name']:30s} | "
        analysis += f"FP: {int(fp):12,} | "
        analysis += f"Mult: {mult:5.2f}x | "
        analysis += f"FP/$: {fp_per_dollar:6.0f}\n"

    return analysis

def analyze_whale_discouragement(df: pd.DataFrame) -> str:
    """
    Analyze how well each algorithm discourages whales
    """
    # Compare mega whale to target
    target_row = df[df['Scenario'] == 'TARGET SWEET SPOT'].iloc[0]
    whale_row = df[df['Scenario'] == 'MAXIMUM (50 weeks, $100k)'].iloc[0]
    flash_whale_row = df[df['Scenario'] == 'Flash Deposit Whale'].iloc[0]

    analysis = "\n=== WHALE DISCOURAGEMENT ANALYSIS ===\n\n"
    analysis += "Comparing FP efficiency (FP per $1) - LOWER is better for balance\n\n"

    for algo_key, algo_info in algo.ALGORITHMS.items():
        target_eff = target_row[f'{algo_key}_fp_per_$']
        whale_eff = whale_row[f'{algo_key}_fp_per_$']
        flash_eff = flash_whale_row[f'{algo_key}_fp_per_$']

        whale_ratio = whale_eff / target_eff if target_eff > 0 else 0
        flash_ratio = flash_eff / target_eff if target_eff > 0 else 0

        analysis += f"\n{algo_info['name']}:\n"
        analysis += f"  Target ($1k, 35d):      {target_eff:6.0f} FP/$\n"
        analysis += f"  Mega Whale ($100k, 50w): {whale_eff:6.0f} FP/$ ({whale_ratio:.2f}x target)\n"
        analysis += f"  Flash Whale ($10k, 1d):  {flash_eff:6.0f} FP/$ ({flash_ratio:.2f}x target)\n"

        if whale_ratio < 0.5:
            analysis += f"  ✓ GOOD: Mega whales get <50% efficiency of target\n"
        elif whale_ratio < 1.0:
            analysis += f"  ~ OK: Mega whales get reduced efficiency\n"
        else:
            analysis += f"  ✗ BAD: Mega whales get same or better efficiency\n"

    return analysis

def analyze_fairness(df: pd.DataFrame) -> str:
    """
    Analyze fairness across different player types
    """
    analysis = "\n=== FAIRNESS ANALYSIS ===\n\n"
    analysis += "How do small, medium, and large players compare?\n\n"

    small = df[df['Scenario'] == 'Entry Player (1 week)'].iloc[0]
    medium = df[df['Scenario'] == 'TARGET SWEET SPOT'].iloc[0]
    large = df[df['Scenario'] == 'Whale (3+ months)'].iloc[0]

    for algo_key, algo_info in algo.ALGORITHMS.items():
        small_fp_per = small[f'{algo_key}_fp_per_$']
        medium_fp_per = medium[f'{algo_key}_fp_per_$']
        large_fp_per = large[f'{algo_key}_fp_per_$']

        analysis += f"\n{algo_info['name']}:\n"
        analysis += f"  Small ($100, 1w):     {small_fp_per:6.0f} FP/$\n"
        analysis += f"  Target ($1k, 5w):     {medium_fp_per:6.0f} FP/$\n"
        analysis += f"  Large ($10k, 3mo):    {large_fp_per:6.0f} FP/$\n"

        # Calculate spread
        values = [small_fp_per, medium_fp_per, large_fp_per]
        spread = max(values) / min(values) if min(values) > 0 else 0

        analysis += f"  Efficiency Spread: {spread:.2f}x (lower is more fair)\n"

    return analysis

# ============================================================================
# Main Execution
# ============================================================================

def main():
    """
    Run full simulation and generate reports
    """
    print("=" * 80)
    print("FACTION POINTS MULTIPLIER SIMULATION")
    print("=" * 80)

    # Run simulation with peak = 5.0
    print("\nRunning scenarios with peak multiplier = 5.0x...\n")
    df = run_scenario_comparison(peak=5.0)

    # Save raw data
    df.to_csv('results_raw.csv', index=False)
    print("✓ Raw data saved to results_raw.csv\n")

    # Generate comparison tables
    print("\n" + "=" * 80)
    print("FINAL FP COMPARISON")
    print("=" * 80)
    print(create_comparison_table(df, 'fp'))

    print("\n" + "=" * 80)
    print("COMBINED MULTIPLIER COMPARISON")
    print("=" * 80)
    print(create_comparison_table(df, 'mult'))

    print("\n" + "=" * 80)
    print("FP EFFICIENCY (FP per $1) COMPARISON")
    print("=" * 80)
    print(create_comparison_table(df, 'fp_per_$'))

    # Analysis sections
    print(analyze_sweet_spot_performance(df))
    print(analyze_whale_discouragement(df))
    print(analyze_fairness(df))

    # Save formatted report
    with open('analysis_report.txt', 'w') as f:
        f.write("=" * 80 + "\n")
        f.write("FACTION POINTS MULTIPLIER SIMULATION REPORT\n")
        f.write("=" * 80 + "\n\n")
        f.write("FINAL FP COMPARISON\n")
        f.write("=" * 80 + "\n")
        f.write(create_comparison_table(df, 'fp') + "\n\n")
        f.write("=" * 80 + "\n")
        f.write("COMBINED MULTIPLIER COMPARISON\n")
        f.write("=" * 80 + "\n")
        f.write(create_comparison_table(df, 'mult') + "\n\n")
        f.write("=" * 80 + "\n")
        f.write("FP EFFICIENCY COMPARISON\n")
        f.write("=" * 80 + "\n")
        f.write(create_comparison_table(df, 'fp_per_$') + "\n\n")
        f.write(analyze_sweet_spot_performance(df))
        f.write(analyze_whale_discouragement(df))
        f.write(analyze_fairness(df))

    print("\n✓ Full report saved to analysis_report.txt")

    # Test different peak values
    print("\n" + "=" * 80)
    print("TESTING DIFFERENT PEAK VALUES (Gaussian algorithm)")
    print("=" * 80)

    peaks = [3.0, 4.0, 5.0, 6.0, 7.0]
    peak_results = []

    for peak in peaks:
        target_fp = calculate_fp(1000, 35, 'gaussian', peak)
        whale_fp = calculate_fp(100000, 350, 'gaussian', peak)

        peak_results.append({
            'Peak': f'{peak}x',
            'Target FP': f"{int(target_fp['final_fp']):,}",
            'Target FP/$': f"{target_fp['fp_per_dollar']:.0f}",
            'Whale FP': f"{int(whale_fp['final_fp']):,}",
            'Whale FP/$': f"{whale_fp['fp_per_dollar']:.0f}",
            'Whale/Target Ratio': f"{whale_fp['fp_per_dollar'] / target_fp['fp_per_dollar']:.2f}x",
        })

    print(tabulate(peak_results, headers='keys', tablefmt='grid'))

    print("\n" + "=" * 80)
    print("SIMULATION COMPLETE")
    print("=" * 80)

if __name__ == '__main__':
    main()
