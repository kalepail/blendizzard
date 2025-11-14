"""
Multiplier Algorithm Implementations

Each function returns a multiplier value where:
- 1.0 = no bonus
- Higher values = bonus
- Target: Peak at ~5.0x at sweet spot ($1k, 30-35 days)
"""

import numpy as np
from typing import Tuple

# Constants
TARGET_AMOUNT_USD = 1_000  # $1,000 target deposit
TARGET_TIME_DAYS = 35  # 5 weeks (35 days)
MAX_AMOUNT_USD = 100_000  # $100k ceiling
MAX_TIME_DAYS = 350  # 50 weeks

# ============================================================================
# CURRENT IMPLEMENTATION (Asymptotic)
# ============================================================================

def current_amount_multiplier(amount_usd: float) -> float:
    """Current asymptotic amount multiplier"""
    return 1.0 + (amount_usd / (amount_usd + TARGET_AMOUNT_USD))

def current_time_multiplier(time_days: float) -> float:
    """Current asymptotic time multiplier"""
    time_seconds = time_days * 24 * 60 * 60
    max_time_seconds = 30 * 24 * 60 * 60
    return 1.0 + (time_seconds / (time_seconds + max_time_seconds))

def current_combined(amount_usd: float, time_days: float) -> float:
    """Current implementation combined multiplier"""
    return current_amount_multiplier(amount_usd) * current_time_multiplier(time_days)

# ============================================================================
# ALGORITHM 1: Gaussian (Bell Curve)
# ============================================================================

def gaussian_amount_multiplier(amount_usd: float, peak: float = 5.0) -> float:
    """
    Gaussian bell curve centered at target amount

    Args:
        amount_usd: Deposit amount
        peak: Peak multiplier at target (default 5.0)

    Returns:
        Multiplier that peaks at target and decays toward extremes
    """
    # Standard deviation controls curve width
    # Larger sigma = wider curve
    sigma = TARGET_AMOUNT_USD * 0.8

    # Gaussian formula: peak * exp(-(x - target)^2 / (2 * sigma^2))
    exponent = -((amount_usd - TARGET_AMOUNT_USD) ** 2) / (2 * sigma ** 2)
    multiplier = 1.0 + (peak - 1.0) * np.exp(exponent)

    return multiplier

def gaussian_time_multiplier(time_days: float, peak: float = 5.0) -> float:
    """
    Gaussian bell curve centered at target time

    Args:
        time_days: Time held in days
        peak: Peak multiplier at target (default 5.0)

    Returns:
        Multiplier that peaks at target and decays toward extremes
    """
    sigma = TARGET_TIME_DAYS * 0.8

    exponent = -((time_days - TARGET_TIME_DAYS) ** 2) / (2 * sigma ** 2)
    multiplier = 1.0 + (peak - 1.0) * np.exp(exponent)

    return multiplier

def gaussian_combined(amount_usd: float, time_days: float, peak: float = 5.0) -> float:
    """Combined Gaussian multipliers"""
    # For combined, use sqrt(peak) for each component so product = peak
    component_peak = np.sqrt(peak)
    return (gaussian_amount_multiplier(amount_usd, component_peak) *
            gaussian_time_multiplier(time_days, component_peak))

# ============================================================================
# ALGORITHM 2: Inverted Parabola (Quadratic)
# ============================================================================

def parabola_amount_multiplier(amount_usd: float, peak: float = 5.0) -> float:
    """
    Inverted parabola: peaks at target, returns to 1.0 at extremes

    Uses quadratic formula with vertex at target
    """
    # Normalize to [0, 1] range where 0.5 is target
    if amount_usd <= 0:
        return 1.0

    # Map: 0 -> 0, TARGET -> 0.5, MAX -> 1.0
    x = min(amount_usd / (2 * MAX_AMOUNT_USD), 1.0)
    target_x = TARGET_AMOUNT_USD / (2 * MAX_AMOUNT_USD)

    # Parabola: -a(x - h)^2 + k where (h, k) is vertex
    # Want: vertex at (target_x, peak), zeros near 0 and 1
    a = (peak - 1.0) / (target_x ** 2)
    multiplier = 1.0 + (peak - 1.0) - a * (x - target_x) ** 2

    return max(1.0, multiplier)

def parabola_time_multiplier(time_days: float, peak: float = 5.0) -> float:
    """
    Inverted parabola for time multiplier
    """
    if time_days <= 0:
        return 1.0

    # Map time to [0, 1] range
    x = min(time_days / MAX_TIME_DAYS, 1.0)
    target_x = TARGET_TIME_DAYS / MAX_TIME_DAYS

    # Parabola with vertex at target
    a = (peak - 1.0) / (target_x ** 2)
    multiplier = 1.0 + (peak - 1.0) - a * (x - target_x) ** 2

    return max(1.0, multiplier)

def parabola_combined(amount_usd: float, time_days: float, peak: float = 5.0) -> float:
    """Combined parabolic multipliers"""
    component_peak = np.sqrt(peak)
    return (parabola_amount_multiplier(amount_usd, component_peak) *
            parabola_time_multiplier(time_days, component_peak))

# ============================================================================
# ALGORITHM 3: Piecewise Linear (Two Segments)
# ============================================================================

def piecewise_amount_multiplier(amount_usd: float, peak: float = 5.0) -> float:
    """
    Piecewise linear: rises to peak at target, falls back to 1.0

    Segments:
    - [0, TARGET]: Linear rise from 1.0 to peak
    - [TARGET, MAX]: Linear fall from peak to 1.0
    """
    if amount_usd <= 0:
        return 1.0
    elif amount_usd <= TARGET_AMOUNT_USD:
        # Rising segment: 1.0 -> peak
        slope = (peak - 1.0) / TARGET_AMOUNT_USD
        return 1.0 + slope * amount_usd
    else:
        # Falling segment: peak -> 1.0
        slope = (1.0 - peak) / (MAX_AMOUNT_USD - TARGET_AMOUNT_USD)
        return peak + slope * (amount_usd - TARGET_AMOUNT_USD)

def piecewise_time_multiplier(time_days: float, peak: float = 5.0) -> float:
    """
    Piecewise linear time multiplier
    """
    if time_days <= 0:
        return 1.0
    elif time_days <= TARGET_TIME_DAYS:
        # Rising segment
        slope = (peak - 1.0) / TARGET_TIME_DAYS
        return 1.0 + slope * time_days
    else:
        # Falling segment
        slope = (1.0 - peak) / (MAX_TIME_DAYS - TARGET_TIME_DAYS)
        return peak + slope * (time_days - TARGET_TIME_DAYS)

def piecewise_combined(amount_usd: float, time_days: float, peak: float = 5.0) -> float:
    """Combined piecewise multipliers"""
    component_peak = np.sqrt(peak)
    return (piecewise_amount_multiplier(amount_usd, component_peak) *
            piecewise_time_multiplier(time_days, component_peak))

# ============================================================================
# ALGORITHM 4: Smooth Piecewise (Cubic Hermite Spline)
# ============================================================================

def smooth_piecewise_amount_multiplier(amount_usd: float, peak: float = 5.0) -> float:
    """
    Smooth piecewise using cubic interpolation for gentle transitions

    Uses Hermite spline with zero derivatives at endpoints for smoothness
    """
    if amount_usd <= 0:
        return 1.0

    # Define control points: [0, TARGET, MAX]
    # Values: [1.0, peak, 1.0]

    if amount_usd <= TARGET_AMOUNT_USD:
        # Interpolate between 0 and TARGET
        t = amount_usd / TARGET_AMOUNT_USD
        # Hermite basis: smooth acceleration/deceleration
        h = 3 * t**2 - 2 * t**3
        return 1.0 + h * (peak - 1.0)
    else:
        # Interpolate between TARGET and MAX
        t = (amount_usd - TARGET_AMOUNT_USD) / (MAX_AMOUNT_USD - TARGET_AMOUNT_USD)
        t = min(t, 1.0)
        h = 3 * t**2 - 2 * t**3
        return peak - h * (peak - 1.0)

def smooth_piecewise_time_multiplier(time_days: float, peak: float = 5.0) -> float:
    """
    Smooth piecewise time multiplier using cubic interpolation
    """
    if time_days <= 0:
        return 1.0

    if time_days <= TARGET_TIME_DAYS:
        t = time_days / TARGET_TIME_DAYS
        h = 3 * t**2 - 2 * t**3
        return 1.0 + h * (peak - 1.0)
    else:
        t = (time_days - TARGET_TIME_DAYS) / (MAX_TIME_DAYS - TARGET_TIME_DAYS)
        t = min(t, 1.0)
        h = 3 * t**2 - 2 * t**3
        return peak - h * (peak - 1.0)

def smooth_piecewise_combined(amount_usd: float, time_days: float, peak: float = 5.0) -> float:
    """Combined smooth piecewise multipliers"""
    component_peak = np.sqrt(peak)
    return (smooth_piecewise_amount_multiplier(amount_usd, component_peak) *
            smooth_piecewise_time_multiplier(time_days, component_peak))

# ============================================================================
# ALGORITHM 5: Asymmetric (Steep Rise, Gentle Fall)
# ============================================================================

def asymmetric_amount_multiplier(amount_usd: float, peak: float = 5.0) -> float:
    """
    Asymmetric curve: steep rise to target, gentle exponential decay after

    Good for encouraging target without harsh penalties for going over
    """
    if amount_usd <= 0:
        return 1.0
    elif amount_usd <= TARGET_AMOUNT_USD:
        # Steep rise: exponential approach to peak
        t = amount_usd / TARGET_AMOUNT_USD
        # Use power > 1 for steep rise
        multiplier = 1.0 + (peak - 1.0) * (t ** 1.5)
        return multiplier
    else:
        # Gentle exponential decay
        excess = amount_usd - TARGET_AMOUNT_USD
        decay_rate = 0.00001  # Slow decay
        multiplier = peak * np.exp(-decay_rate * excess)
        return max(1.0, multiplier)

def asymmetric_time_multiplier(time_days: float, peak: float = 5.0) -> float:
    """
    Asymmetric time multiplier
    """
    if time_days <= 0:
        return 1.0
    elif time_days <= TARGET_TIME_DAYS:
        # Steep rise
        t = time_days / TARGET_TIME_DAYS
        multiplier = 1.0 + (peak - 1.0) * (t ** 1.5)
        return multiplier
    else:
        # Gentle decay
        excess = time_days - TARGET_TIME_DAYS
        decay_rate = 0.003  # Moderate decay
        multiplier = peak * np.exp(-decay_rate * excess)
        return max(1.0, multiplier)

def asymmetric_combined(amount_usd: float, time_days: float, peak: float = 5.0) -> float:
    """Combined asymmetric multipliers"""
    component_peak = np.sqrt(peak)
    return (asymmetric_amount_multiplier(amount_usd, component_peak) *
            asymmetric_time_multiplier(time_days, component_peak))

# ============================================================================
# Algorithm Registry
# ============================================================================

ALGORITHMS = {
    'current': {
        'name': 'Current (Asymptotic)',
        'amount': current_amount_multiplier,
        'time': current_time_multiplier,
        'combined': current_combined,
    },
    'gaussian': {
        'name': 'Gaussian (Bell Curve)',
        'amount': gaussian_amount_multiplier,
        'time': gaussian_time_multiplier,
        'combined': gaussian_combined,
    },
    'parabola': {
        'name': 'Parabolic (Inverted)',
        'amount': parabola_amount_multiplier,
        'time': parabola_time_multiplier,
        'combined': parabola_combined,
    },
    'piecewise': {
        'name': 'Piecewise Linear',
        'amount': piecewise_amount_multiplier,
        'time': piecewise_time_multiplier,
        'combined': piecewise_combined,
    },
    'smooth': {
        'name': 'Smooth Piecewise',
        'amount': smooth_piecewise_amount_multiplier,
        'time': smooth_piecewise_time_multiplier,
        'combined': smooth_piecewise_combined,
    },
    'asymmetric': {
        'name': 'Asymmetric (Steep/Gentle)',
        'amount': asymmetric_amount_multiplier,
        'time': asymmetric_time_multiplier,
        'combined': asymmetric_combined,
    },
}
