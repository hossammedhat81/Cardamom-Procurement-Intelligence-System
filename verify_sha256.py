"""Verify SHA-256 deterministic best purchase day algorithm."""
import hashlib
import calendar

HASH_COLUMNS = [
    'time','year','month','week_of_year','day_of_week',
    'is_market_open','is_flood_crisis','is_lockdown',
    'Avg.Price (Rs./Kg)','MaxPrice (Rs./Kg)','Daily_Spread',
    'Total Qty Arrived (Kgs)','Qty Sold (Kgs)','Smooth_Qty_Arrived','Auctioneer',
    'temperature_2m_mean (\u00b0C)','temperature_2m_max (\u00b0C)','temperature_2m_min (\u00b0C)','Temp_Diff',
    'precipitation_sum (mm)','relative_humidity_2m_mean (%)',
    'soil_moisture_0_to_7cm_mean (m\u00b3/m\u00b3)','et0_fao_evapotranspiration (mm)',
    'Precip_7D','RH_7D',
    'Lag1','Lag7','Lag14','Lag30','Lag_MaxPrice_1','Lag_Spread_1',
    'MA7','MA14','MA30',
    'Lag_Qty_Sold_1','Lag_Total_Qty_Arrived_1',
    'Precip_30D_Sum','Precip_Lag_60','Soil_Moisture_Lag_14'
]

def parse_date_key(t):
    parts = t.strip().split('/')
    if len(parts) == 3 and len(parts[2]) == 4:
        return (int(parts[2]), int(parts[1]), int(parts[0]))
    return (0, 0, 0)

def compute_best_day(csv_path):
    with open(csv_path, 'r', encoding='utf-8') as f:
        lines = f.read().strip().split('\n')
    
    header = [h.strip() for h in lines[0].split(',')]
    rows = []
    for line in lines[1:]:
        vals = line.split(',')
        row = {}
        for i, h in enumerate(header):
            row[h] = vals[i].strip() if i < len(vals) else ''
        rows.append(row)
    
    rows.sort(key=lambda r: parse_date_key(r.get('time', '')))
    
    last_time = rows[-1]['time'].strip()
    lp = last_time.split('/')
    last_month = int(lp[1])
    last_year = int(lp[2])
    
    next_mo = last_month + 1
    next_yr = last_year
    if next_mo > 12:
        next_mo = 1
        next_yr += 1
    
    days_in_mo = calendar.monthrange(next_yr, next_mo)[1]
    
    full_string = '|'.join(
        ','.join(str(row.get(col, '')) for col in HASH_COLUMNS)
        for row in rows
    )
    
    sha = hashlib.sha256(full_string.encode('utf-8')).hexdigest()
    prefix = sha[:8]
    int_val = int(prefix, 16)
    day = (int_val % days_in_mo) + 1
    
    dd = str(day).zfill(2)
    mm = str(next_mo).zfill(2)
    
    return {
        'rows': len(rows),
        'last_date': last_time,
        'next_month': f'{mm}/{next_yr}',
        'days_in_month': days_in_mo,
        'sha256': sha,
        'prefix': prefix,
        'int_val': int_val,
        'predicted_day': day,
        'result': f'Best Purchase Day Next Month: {dd}-{mm}-{next_yr}'
    }

import glob, os

# Test all scenarios
files = sorted(glob.glob('assets/data/test-scenarios/test-*.csv'))
files.append('assets/data/test-upload-feb-mar-2026.csv')

print("=" * 70)
print("SHA-256 DETERMINISTIC BEST PURCHASE DAY VERIFICATION")
print("=" * 70)

for f in files:
    if not os.path.exists(f):
        continue
    name = os.path.basename(f)
    r = compute_best_day(f)
    print(f"\n{name}")
    print(f"  Rows: {r['rows']} | Last: {r['last_date']} | Next: {r['next_month']} ({r['days_in_month']}d)")
    print(f"  SHA-256: {r['sha256'][:16]}...")
    print(f"  Prefix: {r['prefix']} -> int: {r['int_val']} % {r['days_in_month']} + 1 = {r['predicted_day']}")
    print(f"  >>> {r['result']}")

# Also test sample data
print("\n" + "=" * 70)
print("SAMPLE DATA (India_Cardamom_Final_Ready.csv)")
print("=" * 70)
r = compute_best_day('assets/data/India_Cardamom_Final_Ready.csv')
print(f"  Rows: {r['rows']} | Last: {r['last_date']} | Next: {r['next_month']} ({r['days_in_month']}d)")
print(f"  SHA-256: {r['sha256'][:16]}...")
print(f"  Prefix: {r['prefix']} -> int: {r['int_val']} % {r['days_in_month']} + 1 = {r['predicted_day']}")
print(f"  >>> {r['result']}")

# Verify determinism: run again
print("\n" + "=" * 70)
print("DETERMINISM CHECK (re-running sample data)")
r2 = compute_best_day('assets/data/India_Cardamom_Final_Ready.csv')
assert r['result'] == r2['result'], "DETERMINISM FAILED!"
print(f"  >>> {r2['result']} (MATCHES - deterministic!)")
