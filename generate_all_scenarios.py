#!/usr/bin/env python3
"""
Generate 6 Realistic Test Scenario CSVs for Cardamom Price Forecasting
=======================================================================
Each file: 30 rows, 39 features, distinct market personality.

Scenarios:
  1. Stable Uptrend    (Feb-Mar 2026)
  2. High Volatility   (Mar-Apr 2026)
  3. Strong Downtrend   (Apr-May 2026)
  4. Recovery Rally     (May-Jun 2026)
  5. Bubble & Crash     (Jun-Jul 2026)
  6. Post-Crash Stable  (Jul-Aug 2026)
"""

import csv, os, math, random
from datetime import datetime, timedelta

# ── Column order (must match existing CSVs) ───────────────
COLUMNS = [
    'time', 'year', 'month', 'week_of_year', 'day_of_week',
    'is_market_open', 'is_flood_crisis', 'is_lockdown',
    'Avg.Price (Rs./Kg)', 'MaxPrice (Rs./Kg)', 'Daily_Spread',
    'Total Qty Arrived (Kgs)', 'Qty Sold (Kgs)', 'Smooth_Qty_Arrived', 'Auctioneer',
    'temperature_2m_mean (°C)', 'temperature_2m_max (°C)', 'temperature_2m_min (°C)', 'Temp_Diff',
    'precipitation_sum (mm)', 'relative_humidity_2m_mean (%)',
    'soil_moisture_0_to_7cm_mean (m³/m³)', 'et0_fao_evapotranspiration (mm)',
    'Precip_7D', 'RH_7D',
    'Lag1', 'Lag7', 'Lag14', 'Lag30', 'Lag_MaxPrice_1', 'Lag_Spread_1',
    'MA7', 'MA14', 'MA30',
    'Lag_Qty_Sold_1', 'Lag_Total_Qty_Arrived_1',
    'Precip_30D_Sum', 'Precip_Lag_60', 'Soil_Moisture_Lag_14',
]

# ── Kerala weather profiles by month ─────────────────────
WEATHER = {
    2:  {'temp_mean': 26.0, 'temp_range': 5.5, 'precip_base': 8,   'precip_var': 12,  'humidity': 68, 'soil': 0.27, 'et0': 20.5, 'hum_var': 8},
    3:  {'temp_mean': 28.5, 'temp_range': 5.0, 'precip_base': 25,  'precip_var': 35,  'humidity': 72, 'soil': 0.29, 'et0': 22.0, 'hum_var': 10},
    4:  {'temp_mean': 29.5, 'temp_range': 5.0, 'precip_base': 80,  'precip_var': 60,  'humidity': 76, 'soil': 0.33, 'et0': 19.0, 'hum_var': 8},
    5:  {'temp_mean': 30.0, 'temp_range': 4.5, 'precip_base': 180, 'precip_var': 100, 'humidity': 82, 'soil': 0.38, 'et0': 15.5, 'hum_var': 6},
    6:  {'temp_mean': 29.0, 'temp_range': 4.0, 'precip_base': 250, 'precip_var': 120, 'humidity': 88, 'soil': 0.43, 'et0': 12.0, 'hum_var': 5},
    7:  {'temp_mean': 28.0, 'temp_range': 3.5, 'precip_base': 220, 'precip_var': 100, 'humidity': 90, 'soil': 0.45, 'et0': 11.0, 'hum_var': 4},
    8:  {'temp_mean': 28.5, 'temp_range': 4.0, 'precip_base': 140, 'precip_var': 80,  'humidity': 85, 'soil': 0.40, 'et0': 13.0, 'hum_var': 6},
}


def r(v, d=2):
    """Round helper."""
    return round(v, d)


def week_of_year(dt):
    return dt.isocalendar()[1]


def generate_weather(dt, profile_override=None):
    """Generate realistic daily weather for Kerala."""
    m = dt.month
    w = WEATHER.get(m, WEATHER[6])
    if profile_override:
        w = {**w, **profile_override}

    temp_mean = w['temp_mean'] + random.gauss(0, 1.2)
    temp_max = temp_mean + random.uniform(2.5, w['temp_range'])
    temp_min = temp_mean - random.uniform(2.0, w['temp_range'] - 0.5)
    temp_diff = r(temp_max - temp_min, 1)

    # Precipitation: mostly zero on dry days, heavy on monsoon days
    if random.random() < (0.15 + 0.55 * (w['precip_base'] / 300)):
        precip = max(0, random.gauss(w['precip_base'] / 5, w['precip_var'] / 4))
    else:
        precip = max(0, random.gauss(0.5, 1.5))

    humidity = max(40, min(98, w['humidity'] + random.gauss(0, w['hum_var'])))
    soil = max(0.18, min(0.55, w['soil'] + random.gauss(0, 0.025)))
    et0 = max(5, w['et0'] + random.gauss(0, 2.5))

    return {
        'temp_mean': r(temp_mean, 1),
        'temp_max': r(temp_max, 1),
        'temp_min': r(temp_min, 1),
        'temp_diff': r(temp_diff, 1),
        'precip': r(max(0, precip), 1),
        'humidity': r(humidity, 1),
        'soil': r(soil, 3),
        'et0': r(et0, 1),
    }


def generate_prices(n, base_price, trend_total, volatility, pattern='linear',
                    events=None, clamp_daily=0.045):
    """
    Generate n daily prices with specified characteristics.

    pattern: 'linear', 'choppy', 'accelerating', 'bubble', 'recovery'
    events: list of (day_index, pct_shock) tuples
    """
    prices = []
    price = base_price
    events = events or []
    event_map = {d: s for d, s in events}

    # Pre-compute daily trend
    daily_trend = trend_total / n

    for i in range(n):
        # Base trend component depends on pattern
        if pattern == 'linear':
            t = daily_trend
        elif pattern == 'choppy':
            t = daily_trend + random.choice([-1, 1]) * volatility * 0.5
        elif pattern == 'accelerating':
            # Trend accelerates through the period
            t = daily_trend * (0.3 + 1.4 * (i / n))
        elif pattern == 'bubble':
            # Rise first 72%, then correction last 28%
            if i < int(n * 0.72):
                t = abs(trend_total) / (n * 0.72) * 1.1
            else:
                t = -abs(trend_total) / (n * 0.28) * 0.8
        elif pattern == 'recovery':
            # Slight dip first 20%, then steady rise
            if i < int(n * 0.2):
                t = -abs(daily_trend) * 0.5
            else:
                t = abs(daily_trend) * 1.25
        else:
            t = daily_trend

        # Noise (volatility clustering: high vol days cluster)
        if i > 0 and abs(prices[-1] - (prices[-2] if len(prices) > 1 else prices[-1])) / price > volatility * 1.5:
            vol_mult = 1.6  # cluster
        else:
            vol_mult = 1.0
        noise = random.gauss(0, volatility * price * vol_mult)

        # Event shocks
        shock = event_map.get(i, 0) * price

        # Day-of-week effect: weekends/Mondays slightly different
        daily_change = t * price + noise + shock

        # Clamp extreme single-day moves
        max_change = price * clamp_daily
        daily_change = max(-max_change, min(max_change, daily_change))

        price = price + daily_change
        # Keep price within +-15% of base to prevent runaway
        price = max(base_price * 0.85, min(base_price * 1.15, price))
        prices.append(r(price, 3))

    return prices


def compute_spread(avg_price, volatility_base):
    """MaxPrice spread above average."""
    spread_pct = random.uniform(0.08, 0.22) + volatility_base * 2
    spread = avg_price * spread_pct
    return r(spread, 3)


def generate_scenario(config):
    """Generate a complete 30-row, 39-column dataset."""
    start_date = datetime.strptime(config['start_date'], '%Y-%m-%d')
    n = config.get('n_days', 30)
    base_price = config['base_price']

    # Generate price series
    prices = generate_prices(
        n, base_price,
        config['trend_total'],
        config['volatility'],
        config.get('pattern', 'linear'),
        config.get('events', []),
        config.get('clamp_daily', 0.045),
    )

    # Generate supply series
    supply_base = config.get('supply_base', 13000)
    supply_var = config.get('supply_var', 3000)
    supply_trend = config.get('supply_trend', 0)  # per-day change

    rows = []

    # Pre-generate weather for consistency in 7D/30D aggregates
    weather_days = []
    for i in range(n):
        dt = start_date + timedelta(days=i)
        weather_days.append(generate_weather(dt, config.get('weather_override')))

    for i in range(n):
        dt = start_date + timedelta(days=i)
        avg_price = prices[i]
        w = weather_days[i]

        spread = compute_spread(avg_price, config['volatility'])
        max_price = r(avg_price + spread, 3)

        # Market open: closed on Sundays roughly, but Indian markets vary
        dow = dt.weekday()  # 0=Mon
        # Cardamom auctions: mostly weekdays, some Saturdays
        is_open = 0 if dow == 6 else 1  # closed Sunday
        if dow == 6:
            qty_arrived = 0
            qty_sold = 0
        else:
            qty_arrived = max(0, r(supply_base + supply_trend * i + random.gauss(0, supply_var), 1))
            sell_rate = random.uniform(0.78, 0.96)
            qty_sold = r(qty_arrived * sell_rate, 1)

        # Smooth qty (rolling-like)
        smooth_qty = r(supply_base + supply_trend * i * 0.5, 4)

        # Auctioneer count (1-3 typical)
        auctioneer = random.choice([1, 2, 2, 3]) if is_open else 0

        # Lag features
        lag1 = prices[i - 1] if i >= 1 else avg_price
        lag7 = prices[i - 7] if i >= 7 else prices[0]
        lag14 = prices[i - 14] if i >= 14 else prices[0]
        lag30 = prices[0]  # only 30 rows, so lag30 = first price

        lag_max_1 = r(prices[i - 1] + compute_spread(prices[i - 1], config['volatility']), 3) if i >= 1 else max_price
        lag_spread_1 = r(compute_spread(prices[i - 1], config['volatility']), 3) if i >= 1 else spread

        # Moving averages
        def ma(window):
            start = max(0, i - window + 1)
            subset = prices[start:i + 1]
            return r(sum(subset) / len(subset), 6)

        ma7 = ma(7)
        ma14 = ma(14)
        ma30 = ma(30)

        # Lag qty features
        if i >= 1:
            prev_dt = start_date + timedelta(days=i - 1)
            prev_dow = prev_dt.weekday()
            if prev_dow == 6:
                lag_qty_sold = 0
                lag_qty_arrived = 0
            else:
                lag_qty_arrived = max(0, r(supply_base + supply_trend * (i - 1) + random.gauss(0, supply_var * 0.3), 1))
                lag_qty_sold = r(lag_qty_arrived * random.uniform(0.80, 0.95), 1)
        else:
            lag_qty_sold = qty_sold
            lag_qty_arrived = qty_arrived

        # Precipitation aggregates
        precip_7d = r(sum(weather_days[max(0, i - 6):i + 1], []) if False else
                      sum(wd['precip'] for wd in weather_days[max(0, i - 6):i + 1]), 1)
        rh_7d = r(sum(wd['humidity'] for wd in weather_days[max(0, i - 6):i + 1]) /
                  len(weather_days[max(0, i - 6):i + 1]), 1)
        precip_30d = r(sum(wd['precip'] for wd in weather_days[:i + 1]), 1)

        # Precip_Lag_60 and Soil_Moisture_Lag_14: estimate from current
        precip_lag60 = r(w['precip'] * random.uniform(0.3, 1.5), 1)
        soil_lag14 = r(w['soil'] + random.gauss(0, 0.015), 3)

        row = {
            'time': dt.strftime('%d/%m/%Y'),
            'year': dt.year,
            'month': dt.month,
            'week_of_year': week_of_year(dt),
            'day_of_week': dt.isoweekday() % 7,  # 0=Sun like JS
            'is_market_open': is_open,
            'is_flood_crisis': config.get('flood_days', lambda i: 0)(i) if callable(config.get('flood_days')) else 0,
            'is_lockdown': 0,
            'Avg.Price (Rs./Kg)': avg_price,
            'MaxPrice (Rs./Kg)': max_price,
            'Daily_Spread': r(spread, 3),
            'Total Qty Arrived (Kgs)': qty_arrived,
            'Qty Sold (Kgs)': qty_sold,
            'Smooth_Qty_Arrived': smooth_qty,
            'Auctioneer': auctioneer,
            'temperature_2m_mean (°C)': w['temp_mean'],
            'temperature_2m_max (°C)': w['temp_max'],
            'temperature_2m_min (°C)': w['temp_min'],
            'Temp_Diff': w['temp_diff'],
            'precipitation_sum (mm)': w['precip'],
            'relative_humidity_2m_mean (%)': w['humidity'],
            'soil_moisture_0_to_7cm_mean (m³/m³)': w['soil'],
            'et0_fao_evapotranspiration (mm)': w['et0'],
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
            'Lag_Qty_Sold_1': lag_qty_sold,
            'Lag_Total_Qty_Arrived_1': lag_qty_arrived,
            'Precip_30D_Sum': precip_30d,
            'Precip_Lag_60': precip_lag60,
            'Soil_Moisture_Lag_14': soil_lag14,
        }
        rows.append(row)

    return rows


def validate_scenario(rows, name):
    """Check internal consistency."""
    errors = []
    for i, row in enumerate(rows):
        # Lag1 check
        if i >= 1:
            expected_lag1 = rows[i - 1]['Avg.Price (Rs./Kg)']
            if abs(row['Lag1'] - expected_lag1) > 0.01:
                errors.append(f"Row {i}: Lag1 mismatch ({row['Lag1']} vs {expected_lag1})")

        # Spread check
        expected_spread = row['MaxPrice (Rs./Kg)'] - row['Avg.Price (Rs./Kg)']
        if abs(row['Daily_Spread'] - expected_spread) > 0.01:
            errors.append(f"Row {i}: Spread mismatch")

        # Price jump check
        if i >= 1:
            prev = rows[i - 1]['Avg.Price (Rs./Kg)']
            pct = abs(row['Avg.Price (Rs./Kg)'] - prev) / prev
            if pct > 0.06:
                errors.append(f"Row {i}: Jump {pct*100:.1f}% exceeds 6%")

    if errors:
        print(f"  WARN [{name}]: {len(errors)} issues")
        for e in errors[:3]:
            print(f"    - {e}")
    else:
        print(f"  OK [{name}]: All validations passed")
    return len(errors) == 0


def write_csv(rows, filepath):
    """Write rows to CSV with exact column order."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Saved: {filepath} ({len(rows)} rows)")


def summarize(rows, name):
    """Print summary stats."""
    prices = [r['Avg.Price (Rs./Kg)'] for r in rows]
    first_date = rows[0]['time']
    last_date = rows[-1]['time']
    first_p = prices[0]
    last_p = prices[-1]
    change = (last_p - first_p) / first_p * 100
    vol = (max(prices) - min(prices)) / ((max(prices) + min(prices)) / 2) * 100

    print(f"\n{'='*60}")
    print(f"  {name}")
    print(f"  Period : {first_date} -> {last_date}")
    print(f"  Price  : INR {first_p:,.1f} -> {last_p:,.1f} ({change:+.1f}%)")
    print(f"  Range  : INR {min(prices):,.1f} - {max(prices):,.1f} (spread {vol:.1f}%)")
    print(f"  SAR    : {first_p/83.5*3.75:.1f} -> {last_p/83.5*3.75:.1f}")


# ═══════════════════════════════════════════════════════════
# SCENARIO DEFINITIONS
# ═══════════════════════════════════════════════════════════

SCENARIOS = [
    # ── 1. Stable Uptrend ─────────────────────────────────
    {
        'name': 'Stable Uptrend',
        'filename': 'test-feb-mar-2026.csv',
        'start_date': '2026-02-08',
        'base_price': 2360,
        'trend_total': 0.03,       # +3% over 30 days
        'volatility': 0.012,       # low
        'pattern': 'linear',
        'supply_base': 13000,
        'supply_var': 2500,
        'supply_trend': 50,
        'events': [],
        'clamp_daily': 0.025,
    },
    # ── 2. High Volatility ────────────────────────────────
    {
        'name': 'High Volatility Chop',
        'filename': 'test-mar-apr-2026.csv',
        'start_date': '2026-03-09',
        'base_price': 2420,
        'trend_total': 0.005,      # nearly flat overall
        'volatility': 0.018,       # moderate-high
        'pattern': 'choppy',
        'supply_base': 12000,
        'supply_var': 5000,
        'supply_trend': 0,
        'events': [(7, 0.025), (14, -0.03), (22, 0.02)],  # shock days
        'clamp_daily': 0.035,
    },
    # ── 3. Strong Downtrend ───────────────────────────────
    {
        'name': 'Strong Downtrend',
        'filename': 'test-apr-may-2026.csv',
        'start_date': '2026-04-08',
        'base_price': 2550,
        'trend_total': -0.07,      # -7% decline
        'volatility': 0.016,       # moderate
        'pattern': 'linear',
        'supply_base': 18000,
        'supply_var': 3000,
        'supply_trend': 100,       # increasing supply
        'events': [],
        'clamp_daily': 0.03,
        'weather_override': {'precip_base': 160, 'humidity': 80, 'soil': 0.36},
    },
    # ── 4. Recovery Rally ─────────────────────────────────
    {
        'name': 'Recovery Rally',
        'filename': 'test-may-jun-2026.csv',
        'start_date': '2026-05-08',
        'base_price': 2330,
        'trend_total': 0.08,       # +8% rally (moderate)
        'volatility': 0.018,       # moderate vol
        'pattern': 'accelerating',
        'supply_base': 8000,
        'supply_var': 2000,
        'supply_trend': -60,       # shrinking supply
        'events': [(3, -0.012), (18, 0.015)],
        'clamp_daily': 0.035,
        'flood_days': lambda i: 1 if 12 <= i <= 18 else 0,
        'weather_override': {'precip_base': 240, 'humidity': 86, 'soil': 0.42},
    },
    # ── 5. Bubble & Crash ─────────────────────────────────
    {
        'name': 'Bubble & Crash',
        'filename': 'test-jun-jul-2026.csv',
        'start_date': '2026-06-07',
        'base_price': 2620,
        'trend_total': 0.02,       # net small positive, but via bubble then crash
        'volatility': 0.025,       # high
        'pattern': 'bubble',
        'supply_base': 9000,
        'supply_var': 3500,
        'supply_trend': 0,
        'events': [(20, -0.03), (21, -0.025), (25, 0.015)],  # crash days
        'clamp_daily': 0.04,
        'weather_override': {'precip_base': 280, 'humidity': 90, 'soil': 0.46},
    },
    # ── 6. Post-Crash Stabilization ───────────────────────
    {
        'name': 'Post-Crash Stabilization',
        'filename': 'test-jul-aug-2026.csv',
        'start_date': '2026-07-07',
        'base_price': 2490,
        'trend_total': 0.015,      # slight recovery
        'volatility': 0.018,       # moderate, declining
        'pattern': 'recovery',
        'supply_base': 13000,
        'supply_var': 2500,
        'supply_trend': 30,
        'events': [],
        'clamp_daily': 0.03,
        'weather_override': {'precip_base': 180, 'humidity': 87, 'soil': 0.43},
    },
]


def main():
    random.seed(42)  # Reproducible
    out_dir = os.path.join(os.path.dirname(__file__), 'assets', 'data', 'test-scenarios')
    os.makedirs(out_dir, exist_ok=True)

    print("Generating 6 market scenario datasets...\n")

    for cfg in SCENARIOS:
        rows = generate_scenario(cfg)
        filepath = os.path.join(out_dir, cfg['filename'])
        summarize(rows, cfg['name'])
        validate_scenario(rows, cfg['name'])
        write_csv(rows, filepath)

    # Also overwrite the main test file with Scenario 1
    main_test = os.path.join(os.path.dirname(__file__), 'assets', 'data', 'test-upload-feb-mar-2026.csv')
    rows1 = generate_scenario(SCENARIOS[0])
    random.seed(42)  # Reset for consistency
    write_csv(rows1, main_test)

    print(f"\n{'='*60}")
    print(f"  All 6 files generated in: {out_dir}")
    print(f"  Main test file updated:   {main_test}")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()
