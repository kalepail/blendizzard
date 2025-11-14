#!/usr/bin/env python3
"""
Visualize multiplier curves for different algorithms
"""

import numpy as np
import matplotlib.pyplot as plt
import algorithms as algo

def plot_amount_multipliers(peak: float = 5.0, save: bool = True):
    """Plot amount multiplier curves for all algorithms"""
    amounts = np.linspace(0, 100000, 1000)

    plt.figure(figsize=(14, 8))

    for algo_key, algo_info in algo.ALGORITHMS.items():
        if algo_key == 'current':
            mults = [algo_info['amount'](a) for a in amounts]
        else:
            mults = [algo_info['amount'](a, peak) for a in amounts]

        plt.plot(amounts, mults, label=algo_info['name'], linewidth=2)

    # Mark target and max
    plt.axvline(x=1000, color='green', linestyle='--', alpha=0.5, label='Target ($1k)')
    plt.axvline(x=100000, color='red', linestyle='--', alpha=0.5, label='Max ($100k)')
    plt.axhline(y=peak, color='gray', linestyle=':', alpha=0.5, label=f'Peak ({peak}x)')

    plt.xlabel('Deposit Amount (USD)', fontsize=12)
    plt.ylabel('Amount Multiplier', fontsize=12)
    plt.title(f'Amount Multiplier Comparison (Peak = {peak}x)', fontsize=14, fontweight='bold')
    plt.legend(loc='best', fontsize=10)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()

    if save:
        plt.savefig('amount_multipliers.png', dpi=150)
        print("✓ Saved amount_multipliers.png")

    plt.close()

def plot_time_multipliers(peak: float = 5.0, save: bool = True):
    """Plot time multiplier curves for all algorithms"""
    times = np.linspace(0, 350, 1000)

    plt.figure(figsize=(14, 8))

    for algo_key, algo_info in algo.ALGORITHMS.items():
        if algo_key == 'current':
            mults = [algo_info['time'](t) for t in times]
        else:
            mults = [algo_info['time'](t, peak) for t in times]

        plt.plot(times, mults, label=algo_info['name'], linewidth=2)

    # Mark target and max
    plt.axvline(x=35, color='green', linestyle='--', alpha=0.5, label='Target (35 days)')
    plt.axvline(x=350, color='red', linestyle='--', alpha=0.5, label='Max (350 days)')
    plt.axhline(y=peak, color='gray', linestyle=':', alpha=0.5, label=f'Peak ({peak}x)')

    plt.xlabel('Time Held (Days)', fontsize=12)
    plt.ylabel('Time Multiplier', fontsize=12)
    plt.title(f'Time Multiplier Comparison (Peak = {peak}x)', fontsize=14, fontweight='bold')
    plt.legend(loc='best', fontsize=10)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()

    if save:
        plt.savefig('time_multipliers.png', dpi=150)
        print("✓ Saved time_multipliers.png")

    plt.close()

def plot_heatmap(algorithm: str = 'gaussian', peak: float = 5.0, save: bool = True):
    """
    Plot 2D heatmap of FP efficiency (FP per $1) across amount and time
    """
    amounts = np.linspace(10, 100000, 100)
    times = np.linspace(1, 350, 100)

    efficiency_matrix = np.zeros((len(times), len(amounts)))

    algo_funcs = algo.ALGORITHMS[algorithm]

    for i, time in enumerate(times):
        for j, amount in enumerate(amounts):
            if algorithm == 'current':
                combined = algo_funcs['combined'](amount, time)
            else:
                combined = algo_funcs['combined'](amount, time, peak)

            # FP per dollar = (amount * 100 * combined) / amount = 100 * combined
            efficiency_matrix[i, j] = 100 * combined

    plt.figure(figsize=(12, 8))
    im = plt.imshow(efficiency_matrix, aspect='auto', origin='lower',
                    extent=[amounts[0], amounts[-1], times[0], times[-1]],
                    cmap='viridis')

    # Mark target point
    plt.scatter([1000], [35], color='red', s=200, marker='*',
                edgecolors='white', linewidths=2, label='Target ($1k, 35d)')

    plt.colorbar(im, label='FP Efficiency (FP per $1)')
    plt.xlabel('Deposit Amount (USD)', fontsize=12)
    plt.ylabel('Time Held (Days)', fontsize=12)
    plt.title(f'{algo.ALGORITHMS[algorithm]["name"]} - FP Efficiency Heatmap',
              fontsize=14, fontweight='bold')
    plt.legend(loc='upper right', fontsize=10)

    # Add contour lines
    levels = [100, 200, 300, 400, 500]
    contours = plt.contour(amounts, times, efficiency_matrix, levels=levels,
                           colors='white', alpha=0.4, linewidths=1)
    plt.clabel(contours, inline=True, fontsize=8, fmt='%d FP/$')

    plt.tight_layout()

    if save:
        plt.savefig(f'heatmap_{algorithm}.png', dpi=150)
        print(f"✓ Saved heatmap_{algorithm}.png")

    plt.close()

def plot_comparison_at_target_time(peak: float = 5.0, save: bool = True):
    """
    Plot FP efficiency vs amount at target time (35 days)
    """
    amounts = np.linspace(10, 100000, 1000)
    target_time = 35

    plt.figure(figsize=(14, 8))

    for algo_key, algo_info in algo.ALGORITHMS.items():
        efficiencies = []

        for amount in amounts:
            if algo_key == 'current':
                combined = algo_info['combined'](amount, target_time)
            else:
                combined = algo_info['combined'](amount, target_time, peak)

            efficiency = 100 * combined
            efficiencies.append(efficiency)

        plt.plot(amounts, efficiencies, label=algo_info['name'], linewidth=2)

    plt.axvline(x=1000, color='green', linestyle='--', alpha=0.5, label='Target ($1k)')
    plt.axvline(x=100000, color='red', linestyle='--', alpha=0.5, label='Max ($100k)')

    plt.xlabel('Deposit Amount (USD)', fontsize=12)
    plt.ylabel('FP Efficiency (FP per $1)', fontsize=12)
    plt.title(f'FP Efficiency vs Amount @ 35 days (Peak = {peak}x)', fontsize=14, fontweight='bold')
    plt.legend(loc='best', fontsize=10)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()

    if save:
        plt.savefig('efficiency_vs_amount.png', dpi=150)
        print("✓ Saved efficiency_vs_amount.png")

    plt.close()

def plot_comparison_at_target_amount(peak: float = 5.0, save: bool = True):
    """
    Plot FP efficiency vs time at target amount ($1000)
    """
    times = np.linspace(1, 350, 1000)
    target_amount = 1000

    plt.figure(figsize=(14, 8))

    for algo_key, algo_info in algo.ALGORITHMS.items():
        efficiencies = []

        for time in times:
            if algo_key == 'current':
                combined = algo_info['combined'](target_amount, time)
            else:
                combined = algo_info['combined'](target_amount, time, peak)

            efficiency = 100 * combined
            efficiencies.append(efficiency)

        plt.plot(times, efficiencies, label=algo_info['name'], linewidth=2)

    plt.axvline(x=35, color='green', linestyle='--', alpha=0.5, label='Target (35d)')
    plt.axvline(x=350, color='red', linestyle='--', alpha=0.5, label='Max (350d)')

    plt.xlabel('Time Held (Days)', fontsize=12)
    plt.ylabel('FP Efficiency (FP per $1)', fontsize=12)
    plt.title(f'FP Efficiency vs Time @ $1,000 (Peak = {peak}x)', fontsize=14, fontweight='bold')
    plt.legend(loc='best', fontsize=10)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()

    if save:
        plt.savefig('efficiency_vs_time.png', dpi=150)
        print("✓ Saved efficiency_vs_time.png")

    plt.close()

def main():
    """Generate all visualizations"""
    print("=" * 80)
    print("GENERATING VISUALIZATIONS")
    print("=" * 80)

    peak = 5.0

    print("\nGenerating plots...")
    plot_amount_multipliers(peak)
    plot_time_multipliers(peak)
    plot_heatmap('gaussian', peak)
    plot_heatmap('smooth', peak)
    plot_heatmap('current', peak)
    plot_comparison_at_target_time(peak)
    plot_comparison_at_target_amount(peak)

    print("\n✓ All visualizations complete!")
    print("=" * 80)

if __name__ == '__main__':
    main()
