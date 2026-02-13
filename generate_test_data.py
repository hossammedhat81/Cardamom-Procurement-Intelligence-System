#!/usr/bin/env python3
"""
Generate realistic 30-day synthetic test data for Cardamom Price Forecasting.
Period: Feb 8 – Mar 9, 2026 (continuing from last historical date 2026-01-09)
Output: website/assets/data/test-upload-feb-mar-2026.csv

This script produces a CSV with all 39 features that the website expects,
using realistic statistical patterns extracted from the historical dataset.
"""

import csv
import math
import random
import os
from datetime import datetime, timedelta

# ── Seed for reproducibility ─────────────────────────────
random.seed(42)

# ── Constants from historical data analysis ──────────────
# Last known values (Jan 9, 2026)
LAST_AVG_PRICE = 2523.475
LAST_MAX_PRICE = 2956.0
LAST_DAILY_SPREAD = 432.525
LAST_QTY_ARRIVED = 118588.1
LAST_QTY_SOLD = 118171.9
LAST_SMOOTH_QTY = 125238.5857

# Recent price history (last 30 values for lag/MA calculation)
RECENT_PRICES = [
    2398.06, 2402.025, 2379.57, 2400.305, 2385.595, 2370.885, 2384.4725,
    2398.515, 2368.405, 2431.545, 2428.385, 2407.235, 2417.81, 2431.505,
    2453.52, 2435.72, 2449.72, 2468.715, 2463.72, 2444.295, 2443.1125,
    2417.51, 2428.215, 2407.235, 2472.83, 2443.355, 2462.005, 2513.895,
    2515.225, 2516.555, 2508.29, 2522.22, 2529.9, 2523.475,
]

RECENT_MAX_PRICES = [
    2978, 3002, 3038, 3369.5, 3413, 3443, 3076, 3502, 3212, 3002,
    3326, 3369.5, 3413, 3443, 3076, 2978, 2956,
]

RECENT_QTY_ARRIVED = [
    105862.2, 105056.9, 187948.3, 83919.4, 181497.9, 139597.6, 0,
    131139.8, 182402.7, 169925.4, 135016.5, 118588.1,
]

RECENT_QTY_SOLD = [
    92564.6, 105056.9, 184189.4, 83200.6, 179976.7, 138698.9, 0,
    129421.4, 180783.8, 168797.0, 130826.5, 118171.9,
]

# Kerala weather patterns for Feb-Mar
# Feb: warm & dry; Mar: getting warmer, monsoon approaching
WEATHER_FEB = {
    'temp_mean': (24, 27), 'temp_max': (30, 34), 'temp_min': (18, 22),
    'precip': (0, 5), 'humidity': (55, 75), 'soil': (0.22, 0.30),
    'et0': (16, 22),
}
WEATHER_MAR = {
    'temp_mean': (26, 30), 'temp_max': (32, 36), 'temp_min': (20, 24),
    'precip': (0, 15), 'humidity': (60, 80), 'soil': (0.20, 0.28),
    'et0': (18, 25),
}


def rand_range(lo, hi):
    return lo + random.random() * (hi - lo)


def clamp(val, lo, hi):
    return max(lo, min(hi, val))


def generate_data():
    """Generate 30 days of synthetic cardamom market data."""
    start_date = datetime(2026, 2, 8)
    rows = []

    # Build price history for lag calculations
    price_history = list(RECENT_PRICES)
    max_price_history = list(RECENT_MAX_PRICES)
    qty_arrived_history = list(RECENT_QTY_ARRIVED)
    qty_sold_history = list(RECENT_QTY_SOLD)
    precip_history = [0] * 60  # last 60 days of precip

    # Price simulation parameters
    current_price = LAST_AVG_PRICE
    trend = -0.0008  # slight downward trend (typical Feb correction)
    volatility = 0.018  # ~1.8% daily volatility

    for i in range(30):
        date = start_date + timedelta(days=i)
        month = date.month
        day_of_week = date.weekday()  # 0=Mon, 6=Sun

        # Market is open on weekdays (Mon-Fri)
        is_market_open = 1 if day_of_week < 5 else 0

        # Weather based on month
        wx = WEATHER_FEB if month == 2 else WEATHER_MAR

        temp_mean = round(rand_range(*wx['temp_mean']), 1)
        temp_max = round(rand_range(*wx['temp_max']), 1)
        temp_min = round(rand_range(*wx['temp_min']), 1)
        temp_diff = round(temp_max - temp_min, 2)
        precip = round(rand_range(*wx['precip']), 1)
        humidity = round(rand_range(*wx['humidity']), 1)
        soil_moisture = round(rand_range(*wx['soil']), 3)
        et0 = round(rand_range(*wx['et0']), 1)

        precip_history.append(precip)

        # ── Price simulation ──────────────────────────────
        if is_market_open:
            # Add trend, noise, and seasonal
            seasonal = math.sin(i / 14 * math.pi) * 0.004
            weather_impact = (precip / 500) * 0.003  # heavy rain → slight price up
            noise = (random.random() - 0.5) * 2 * volatility
            daily_return = trend + noise + seasonal + weather_impact

            # Mean reversion toward ~2450
            mean_reversion = (2450 - current_price) / 2450 * 0.02
            daily_return += mean_reversion

            current_price = current_price * (1 + daily_return)
            current_price = clamp(current_price, 2200, 2800)
        # else: weekend, price unchanged from Friday

        avg_price = round(current_price, 3) if is_market_open else round(current_price, 3)

        # Max price: typically 15-40% above avg
        spread_pct = rand_range(0.15, 0.40) if is_market_open else rand_range(0.15, 0.35)
        max_price = round(avg_price * (1 + spread_pct), 0)
        daily_spread = round(max_price - avg_price, 3)

        # Quantity (0 on weekends/holidays)
        if is_market_open:
            base_qty = rand_range(80000, 200000)
            qty_arrived = round(base_qty, 1)
            sold_ratio = rand_range(0.92, 0.99)
            qty_sold = round(qty_arrived * sold_ratio, 1)
        else:
            qty_arrived = 0
            qty_sold = 0

        # Smooth quantity (7-day rolling)
        recent_qty = qty_arrived_history[-6:] + [qty_arrived]
        smooth_qty = round(sum(recent_qty) / len(recent_qty), 4)

        # Auctioneer (2 = typical)
        auctioneer = 2 if is_market_open else 0

        # ── Lag features ──────────────────────────────────
        price_history.append(avg_price)
        max_price_history.append(max_price)
        qty_arrived_history.append(qty_arrived)
        qty_sold_history.append(qty_sold)

        lag1 = price_history[-2]
        lag7 = price_history[-8] if len(price_history) >= 8 else price_history[0]
        lag14 = price_history[-15] if len(price_history) >= 15 else price_history[0]
        lag30 = price_history[-31] if len(price_history) >= 31 else price_history[0]

        lag_max_1 = max_price_history[-2]
        lag_spread_1 = round(max_price_history[-2] - price_history[-2], 3)

        # Moving averages
        ma7 = round(sum(price_history[-7:]) / min(7, len(price_history)), 6)
        ma14 = round(sum(price_history[-14:]) / min(14, len(price_history)), 6)
        ma30 = round(sum(price_history[-30:]) / min(30, len(price_history)), 6)

        # Quantity lags
        lag_qty_sold_1 = qty_sold_history[-2] if len(qty_sold_history) >= 2 else 0
        lag_qty_arrived_1 = qty_arrived_history[-2] if len(qty_arrived_history) >= 2 else 0

        # Precipitation features
        precip_7d = round(sum(precip_history[-7:]), 1)
        rh_7d = round(humidity, 1)  # simplified: use current day
        precip_30d_sum = round(sum(precip_history[-30:]), 1)
        precip_lag_60 = round(sum(precip_history[-60:-30]) if len(precip_history) >= 60 else 0, 1)
        soil_moisture_lag_14 = round(soil_moisture + rand_range(-0.02, 0.02), 3)

        # Week of year
        week_of_year = date.isocalendar()[1]

        # Format date as DD/MM/YYYY (matching historical data format)
        date_str = date.strftime('%d/%m/%Y')

        row = {
            'time': date_str,
            'year': date.year,
            'month': month,
            'week_of_year': week_of_year,
            'day_of_week': day_of_week,
            'is_market_open': is_market_open,
            'is_flood_crisis': 0,
            'is_lockdown': 0,
            'Avg.Price (Rs./Kg)': avg_price,
            'MaxPrice (Rs./Kg)': max_price,
            'Daily_Spread': daily_spread,
            'Total Qty Arrived (Kgs)': qty_arrived,
            'Qty Sold (Kgs)': qty_sold,
            'Smooth_Qty_Arrived': smooth_qty,
            'Auctioneer': auctioneer,
            'temperature_2m_mean (°C)': temp_mean,
            'temperature_2m_max (°C)': temp_max,
            'temperature_2m_min (°C)': temp_min,
            'Temp_Diff': temp_diff,
            'precipitation_sum (mm)': precip,
            'relative_humidity_2m_mean (%)': humidity,
            'soil_moisture_0_to_7cm_mean (m³/m³)': soil_moisture,
            'et0_fao_evapotranspiration (mm)': et0,
            'Precip_7D': precip_7d,
            'RH_7D': rh_7d,
            'Lag1': lag1,
            'Lag7': lag7,
            'Lag14': lag14,
            'Lag30': lag30,
            'Lag_MaxPrice_1': lag_max_1,
            'Lag_Spread_1': lag_spread_1,
            'MA7': ma7,
            'MA14': ma14,
            'MA30': ma30,
            'Lag_Qty_Sold_1': lag_qty_sold_1,
            'Lag_Total_Qty_Arrived_1': lag_qty_arrived_1,
            'Precip_30D_Sum': precip_30d_sum,
            'Precip_Lag_60': precip_lag_60,
            'Soil_Moisture_Lag_14': soil_moisture_lag_14,
        }
        rows.append(row)

    return rows


def main():
    rows = generate_data()

    # Determine output path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(script_dir, 'assets', 'data', 'test-upload-feb-mar-2026.csv')

    # Write CSV
    fieldnames = list(rows[0].keys())
    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f'Generated {len(rows)} rows -> {out_path}')
    print(f'Date range: {rows[0]["time"]} to {rows[-1]["time"]}')
    print(f'Price range: {min(r["Avg.Price (Rs./Kg)"] for r in rows):.2f} - {max(r["Avg.Price (Rs./Kg)"] for r in rows):.2f} Rs/Kg')
    print(f'Features: {len(fieldnames)}')


if __name__ == '__main__':
    main()
