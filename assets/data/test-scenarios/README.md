# Test Scenario Library — Cardamom Price Forecasting

Six CSV datasets covering different market conditions. Each file has **30 rows** and all **39 features** matching the production data format.

---

## Quick Reference

| # | File | Period | Scenario | Price Range (INR) | SAR Range | Trend |
|---|------|--------|----------|-------------------|-----------|-------|
| 1 | `test-feb-mar-2026.csv` | Feb 08 – Mar 09 | Stable Uptrend | 2,336 – 2,481 | 105 – 111 | +3.9% |
| 2 | `test-mar-apr-2026.csv` | Mar 09 – Apr 07 | High Volatility | 2,083 – 2,389 | 94 – 107 | -3.6% |
| 3 | `test-apr-may-2026.csv` | Apr 08 – May 07 | Strong Downtrend | 2,210 – 2,500 | 99 – 112 | -9.1% |
| 4 | `test-may-jun-2026.csv` | May 08 – Jun 06 | Recovery Rally | 2,215 – 2,680 | 100 – 121 | +13.0% |
| 5 | `test-jun-jul-2026.csv` | Jun 07 – Jul 06 | Bubble & Crash | 2,615 – 3,013 | 118 – 135 | +12.6% |
| 6 | `test-jul-aug-2026.csv` | Jul 07 – Aug 05 | Post-Crash Stable | 2,500 – 2,834 | 112 – 127 | +4.4% |

---

## Scenario Details

### 1. Stable Uptrend (Feb–Mar 2026)
**Market personality:** Calm, predictable, low risk.

- Gradual price increase, smooth curve
- Low daily volatility (1.2%)
- Dry season weather (24–30 C, minimal rain)
- Normal supply ~13,000 kg/day

**Expected predictions:** Continued gentle rise. 4–5 STRONG BUY days early. Mostly green risk calendar.

---

### 2. High Volatility Chop (Mar–Apr 2026)
**Market personality:** Nervous, unpredictable, choppy.

- Prices swing up and down with no clear direction
- 3 shock events (days 7, 14, 22) with 2–3% jumps
- Pre-monsoon humidity building
- Erratic supply volumes

**Expected predictions:** Wide confidence bands. Mixed recommendations. 50/50 risk split.

---

### 3. Strong Downtrend (Apr–May 2026)
**Market personality:** Bearish, oversupplied.

- Consistent decline from INR 2,500 to INR 2,272
- Supply surge (18,000+ kg/day) from bumper harvest
- Early monsoon rains
- Predictable decline = low risk despite falling prices

**Expected predictions:** Decline slowing, bottom forming. WAIT early, BUY/ACCUMULATE late.

---

### 4. Recovery Rally (May–Jun 2026)
**Market personality:** Bullish reversal, supply constrained.

- Sharp recovery from INR 2,372 to INR 2,680
- Flood crisis flagged (days 12–18) disrupting supply
- Supply drops to 8,000 kg/day
- Accelerating trend (slow start, fast finish)

**Expected predictions:** Rally continues but weakening. STRONG BUY early, WAIT/caution late.

---

### 5. Bubble & Crash (Jun–Jul 2026)
**Market personality:** Speculative mania then panic.

- Parabolic rise to peak around day 22, then sharp correction
- Very high volatility (2.5%)
- Crash events on days 20–21
- Peak monsoon weather

**Expected predictions:** Major correction expected. Mostly WAIT. Risk calendar dominated by red.

---

### 6. Post-Crash Stabilization (Jul–Aug 2026)
**Market personality:** Finding floor, tentative recovery.

- Initial dip then slow recovery
- Volatility decreasing over time
- Monsoon ending, supply normalizing
- Healthy consolidation pattern

**Expected predictions:** Stable with slight upside. Many ACCUMULATE signals. Risk improving through period.

---

## How to Use

1. Open the Cardamom Intelligence website
2. Click **Upload CSV & Predict**
3. Select any scenario file
4. Click **Generate Forecast Now**
5. Predictions start from the day after the file's last date

### Comparison Test
Upload different files and confirm:
- Forecast dates change (start after each file's last date)
- Price charts look visually distinct
- Best entry dates differ
- Risk profiles differ
- Recommendations match the scenario personality

---

## Regenerating Files

```bash
cd website/
python generate_all_scenarios.py
```

The script uses `random.seed(42)` for reproducibility. Change the seed or scenario parameters in the `SCENARIOS` list to create new variations.
