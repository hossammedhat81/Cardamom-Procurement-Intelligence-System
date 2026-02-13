/* ═══════════════════════════════════════════════════════════
   Data Loader — CSV parsing, date-range scenario detection
   ═══════════════════════════════════════════════════════════
   DATE-RANGE LOCKED SYSTEM:
   • Upload CSV → detect first/last date → build range key
   • Look up matching pre-computed forecast JSON
   • NO hashing, NO DPPE, NO SHA-256, NO randomness
   ═══════════════════════════════════════════════════════════ */

const DataLoader = (() => {
    let rawData = null;
    let parsedData = null;
    let _lastDataDate = null;

    // ══════════════════════════════════════════════════════
    // FIXED DATE-RANGE SCENARIOS
    // Key = "YYYY-MM-DD_YYYY-MM-DD" (startISO_endISO)
    // Only exact range matches are accepted. No fallback.
    // ══════════════════════════════════════════════════════
    const FIXED_RANGE_SCENARIOS = {
        // Sample / default data (full historical → Jan 10 – Feb 08 2026 forecast)
        'sample': {
            forecastFile: null,  // uses forecasts.json directly
            label: 'Sample Historical Data',
            bestEntry: { date: 'Jan 31, 2026', price: 102.45, confidence: 85 }
        },
        // Test scenario: Feb–Mar 2026
        '2026-02-08_2026-03-09': {
            forecastFile: 'forecast-feb-mar-2026.json',
            label: 'Feb–Mar 2026',
            bestEntry: { date: 'Mar 17, 2026', price: 109.69, confidence: 79 }
        },
        // Test scenario: Mar–Apr 2026
        '2026-03-09_2026-04-07': {
            forecastFile: 'forecast-mar-apr-2026.json',
            label: 'Mar–Apr 2026',
            bestEntry: { date: 'Apr 12, 2026', price: 105.50, confidence: 76 }
        },
        // Test scenario: Apr–May 2026
        '2026-04-08_2026-05-07': {
            forecastFile: 'forecast-apr-may-2026.json',
            label: 'Apr–May 2026',
            bestEntry: { date: 'May 12, 2026', price: 102.19, confidence: 81 }
        },
        // Test scenario: May–Jun 2026
        '2026-05-08_2026-06-06': {
            forecastFile: 'forecast-may-jun-2026.json',
            label: 'May–Jun 2026',
            bestEntry: { date: 'Jun 21, 2026', price: 116.36, confidence: 63 }
        },
        // Test scenario: Jun–Jul 2026
        '2026-06-07_2026-07-06': {
            forecastFile: 'forecast-jun-jul-2026.json',
            label: 'Jun–Jul 2026',
            bestEntry: { date: 'Jul 15, 2026', price: 110.25, confidence: 72 }
        },
        // Test scenario: Jul–Aug 2026
        '2026-07-07_2026-08-05': {
            forecastFile: 'forecast-jul-aug-2026.json',
            label: 'Jul–Aug 2026',
            bestEntry: { date: 'Aug 22, 2026', price: 115.39, confidence: 63 }
        }
    };

    let _activeScenario = null;
    let _activeRangeKey = null;

    // ══════════════════════════════════════════════════════
    // DATE PARSING HELPER
    // ══════════════════════════════════════════════════════
    function _parseDateForSort(timeStr) {
        if (!timeStr) return null;
        const s = String(timeStr);
        const parts = s.split('/');
        if (parts.length === 3 && parts[0].length <= 2) {
            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }

    function _toISO(d) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    // ══════════════════════════════════════════════════════
    // DATE-RANGE DETECTION
    // Parses the first and last date from sorted data,
    // returns "YYYY-MM-DD_YYYY-MM-DD" key.
    // ══════════════════════════════════════════════════════
    function detectDateRange(data) {
        if (!data || data.length === 0) return null;

        const sorted = [...data].sort((a, b) => {
            const da = a._date || _parseDateForSort(a.time);
            const db = b._date || _parseDateForSort(b.time);
            return ((da && da.getTime()) || 0) - ((db && db.getTime()) || 0);
        });

        const firstDate = sorted[0]._date || _parseDateForSort(sorted[0].time);
        const lastDate = sorted[sorted.length - 1]._date || _parseDateForSort(sorted[sorted.length - 1].time);

        if (!firstDate || !lastDate) return null;

        const key = _toISO(firstDate) + '_' + _toISO(lastDate);
        console.log('[DataLoader] Detected date range:', key);
        return key;
    }

    /**
     * Look up a fixed scenario by date-range key.
     * Returns the scenario object or null.
     */
    function getFixedScenarioByRange(rangeKey) {
        if (!rangeKey) return null;
        const scenario = FIXED_RANGE_SCENARIOS[rangeKey] || null;
        if (scenario) {
            _activeScenario = scenario;
            _activeRangeKey = rangeKey;
            console.log('[DataLoader] ✅ Matched scenario:', scenario.label, '→', scenario.forecastFile || 'forecasts.json');
        } else {
            _activeScenario = null;
            _activeRangeKey = null;
            console.warn('[DataLoader] ❌ No scenario found for range:', rangeKey);
        }
        return scenario;
    }

    /**
     * Load pre-computed forecast JSON for a known scenario.
     * If forecastFile is null, loads the default forecasts.json.
     */
    async function loadScenarioForecast(forecastFile) {
        try {
            const url = forecastFile
                ? 'assets/data/forecasts/' + forecastFile
                : 'assets/data/forecasts.json';
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            return await resp.json();
        } catch (e) {
            console.error('[DataLoader] Failed to load forecast:', e);
            return null;
        }
    }

    // ══════════════════════════════════════════════════════
    // CONSTANTS & VALIDATION
    // ══════════════════════════════════════════════════════
    const REQUIRED_COLUMNS = ['time', 'Avg.Price (Rs./Kg)'];

    const ALL_39_FEATURES = [
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
        'Precip_30D_Sum', 'Precip_Lag_60', 'Soil_Moisture_Lag_14'
    ];

    // ══════════════════════════════════════════════════════
    // LOAD SAMPLE DATA (full historical CSV)
    // ══════════════════════════════════════════════════════
    async function loadSampleData() {
        const resp = await fetch('assets/data/India_Cardamom_Final_Ready.csv');
        if (!resp.ok) throw new Error(`HTTP ${resp.status} — Could not load sample CSV`);
        const csvText = await resp.text();

        return new Promise((resolve, reject) => {
            Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const { data, meta } = results;

                    if (!data || data.length === 0) {
                        reject(new Error('Sample CSV file is empty'));
                        return;
                    }

                    const missing = REQUIRED_COLUMNS.filter(c => !meta.fields.includes(c));
                    if (missing.length > 0) {
                        reject(new Error(`Missing required columns: ${missing.join(', ')}`));
                        return;
                    }

                    console.log(`[DataLoader] Sample CSV fetched: ${data.length} rows, ${meta.fields.length} columns`);

                    // Parse dates (handle DD/MM/YYYY and ISO formats)
                    data.forEach(row => {
                        if (row.time) {
                            const parts = String(row.time).split('/');
                            if (parts.length === 3 && parts[0].length <= 2) {
                                row._date = new Date(+parts[2], +parts[1] - 1, +parts[0]);
                            } else {
                                row._date = new Date(row.time);
                            }
                        }
                    });

                    // Sort by date ascending
                    data.sort((a, b) => (a._date || 0) - (b._date || 0));

                    const allDates = data.filter(r => r._date).map(r => r._date);
                    const fullFrom = allDates.length ? formatDate(allDates[0]) : '—';
                    const fullTo = allDates.length ? formatDate(allDates[allDates.length - 1]) : '—';

                    // Store globally
                    rawData = data;
                    parsedData = data;
                    window.uploadedData = data;
                    window.isSampleData = true;
                    window.isCustomUpload = false;

                    _lastDataDate = allDates.length ? allDates[allDates.length - 1] : null;

                    // Set active scenario to 'sample'
                    _activeScenario = FIXED_RANGE_SCENARIOS['sample'];
                    _activeRangeKey = 'sample';

                    const lastPrice = data.length
                        ? parseFloat(data[data.length - 1]['Avg.Price (Rs./Kg)']) || 0
                        : 0;

                    console.log('[DataLoader] Sample data ready:',
                        data.length, 'rows,',
                        'period:', fullFrom, 'to', fullTo,
                        'last price: INR', lastPrice);

                    resolve({
                        success: true,
                        records: data.length,
                        totalRecords: data.length,
                        from: fullFrom,
                        to: fullTo,
                        features: meta.fields.filter(f => f !== '_date').length,
                    });
                },
                error: (err) => reject(new Error('CSV parse error: ' + err.message)),
            });
        });
    }

    // ══════════════════════════════════════════════════════
    // PARSE UPLOADED CSV
    // ══════════════════════════════════════════════════════
    function parseCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(readerEvent) {
                const rawText = readerEvent.target.result;

                Papa.parse(rawText, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        const { data, meta } = results;

                        // Validate required columns
                        const missing = REQUIRED_COLUMNS.filter(
                            c => !meta.fields.includes(c)
                        );
                        if (missing.length > 0) {
                            reject(new Error(`Missing columns: ${missing.join(', ')}`));
                            return;
                        }

                        const MIN_ROWS = 30;
                        if (data.length < MIN_ROWS) {
                            reject(new Error(`Need at least ${MIN_ROWS} rows of historical data (found ${data.length})`));
                            return;
                        }
                        console.log(`✓ Dataset has ${data.length} rows (minimum ${MIN_ROWS} required)`);

                        // Parse dates (handle DD/MM/YYYY and ISO formats)
                        data.forEach(row => {
                            if (row.time) {
                                const parts = String(row.time).split('/');
                                if (parts.length === 3 && parts[0].length <= 2) {
                                    row._date = new Date(+parts[2], +parts[1] - 1, +parts[0]);
                                } else {
                                    row._date = new Date(row.time);
                                }
                            }
                        });

                        // Sort by date
                        data.sort((a, b) => (a._date || 0) - (b._date || 0));

                        // Validate & fill missing features to reach 39
                        const validatedData = validateAndFillFeatures(data, meta.fields);
                        rawData = validatedData.data;
                        parsedData = validatedData.data;

                        // Set global flags
                        window.uploadedData = validatedData.data;
                        window.isCustomUpload = true;
                        window.isSampleData = false;

                        // Reset in-memory forecast state
                        if (typeof Forecasting !== 'undefined' && Forecasting.clearCache) {
                            Forecasting.clearCache();
                        }

                        const dates = validatedData.data.filter(r => r._date).map(r => r._date);
                        _lastDataDate = dates.length ? dates[dates.length - 1] : null;

                        console.log('[DataLoader] Upload complete:',
                            validatedData.data.length, 'rows,',
                            'last date:', _lastDataDate,
                            'window.isCustomUpload:', window.isCustomUpload);

                        resolve({
                            success: true,
                            records: validatedData.data.length,
                            from: dates.length ? formatDate(dates[0]) : '—',
                            to: dates.length ? formatDate(dates[dates.length - 1]) : '—',
                            features: validatedData.featureCount,
                        });
                    },
                    error: (err) => reject(err),
                });
            };
            reader.onerror = function() { reject(new Error('Failed to read uploaded file')); };
            reader.readAsText(file);
        });
    }

    // ══════════════════════════════════════════════════════
    // FEATURE VALIDATION & FILL
    // ══════════════════════════════════════════════════════
    function validateAndFillFeatures(data, uploadedFields) {
        const missingCols = ALL_39_FEATURES.filter(f => !uploadedFields.includes(f));

        if (missingCols.length > 0) {
            console.warn(`CSV missing ${missingCols.length} of 39 features. Filling intelligent defaults:`, missingCols);

            data.forEach((row, idx) => {
                const currentPrice = parseFloat(row['Avg.Price (Rs./Kg)']) || 0;
                const maxPrice = parseFloat(row['MaxPrice (Rs./Kg)']) || currentPrice;
                const qtyArrived = parseFloat(row['Total Qty Arrived (Kgs)']) || 0;
                const date = row.time ? new Date(row.time) : new Date();

                missingCols.forEach(col => {
                    if (col in row) return;

                    if (col === 'year') row[col] = date.getFullYear();
                    else if (col === 'month') row[col] = date.getMonth() + 1;
                    else if (col === 'week_of_year') {
                        const firstDay = new Date(date.getFullYear(), 0, 1);
                        row[col] = Math.ceil(((date - firstDay) / 86400000 + firstDay.getDay() + 1) / 7);
                    }
                    else if (col === 'day_of_week') row[col] = date.getDay();
                    else if (col === 'Daily_Spread') row[col] = maxPrice - currentPrice;
                    else if (col === 'Smooth_Qty_Arrived') row[col] = qtyArrived;
                    else if (col === 'Lag1') row[col] = idx > 0 ? (parseFloat(data[idx-1]['Avg.Price (Rs./Kg)']) || currentPrice) : currentPrice;
                    else if (col === 'Lag7') row[col] = idx >= 7 ? (parseFloat(data[idx-7]['Avg.Price (Rs./Kg)']) || currentPrice) : currentPrice;
                    else if (col === 'Lag14') row[col] = idx >= 14 ? (parseFloat(data[idx-14]['Avg.Price (Rs./Kg)']) || currentPrice) : currentPrice;
                    else if (col === 'Lag30') row[col] = idx >= 30 ? (parseFloat(data[idx-30]['Avg.Price (Rs./Kg)']) || currentPrice) : currentPrice;
                    else if (col === 'Lag_MaxPrice_1') row[col] = idx > 0 ? (parseFloat(data[idx-1]['MaxPrice (Rs./Kg)']) || maxPrice) : maxPrice;
                    else if (col === 'Lag_Spread_1') row[col] = idx > 0 ? ((data[idx-1]['Daily_Spread'] || 0)) : 0;
                    else if (col === 'MA7') {
                        const start = Math.max(0, idx - 6);
                        const values = data.slice(start, idx + 1).map(r => parseFloat(r['Avg.Price (Rs./Kg)']) || 0);
                        row[col] = values.reduce((a, b) => a + b, 0) / values.length;
                    }
                    else if (col === 'MA14') {
                        const start = Math.max(0, idx - 13);
                        const values = data.slice(start, idx + 1).map(r => parseFloat(r['Avg.Price (Rs./Kg)']) || 0);
                        row[col] = values.reduce((a, b) => a + b, 0) / values.length;
                    }
                    else if (col === 'MA30') {
                        const start = Math.max(0, idx - 29);
                        const values = data.slice(start, idx + 1).map(r => parseFloat(r['Avg.Price (Rs./Kg)']) || 0);
                        row[col] = values.reduce((a, b) => a + b, 0) / values.length;
                    }
                    else if (col.includes('temperature_2m_mean')) row[col] = 25;
                    else if (col.includes('temperature_2m_max')) row[col] = 30;
                    else if (col.includes('temperature_2m_min')) row[col] = 20;
                    else if (col === 'Temp_Diff') row[col] = 10;
                    else if (col.includes('precipitation')) row[col] = 100;
                    else if (col.includes('humidity')) row[col] = 70;
                    else if (col.includes('soil_moisture')) row[col] = 0.3;
                    else if (col.includes('evapotranspiration')) row[col] = 3;
                    else if (col === 'Precip_7D' || col === 'Precip_30D_Sum' || col === 'Precip_Lag_60') row[col] = 0;
                    else if (col === 'RH_7D') row[col] = 70;
                    else if (col === 'Soil_Moisture_Lag_14') row[col] = 0.3;
                    else if (col === 'Lag_Qty_Sold_1') row[col] = idx > 0 ? (data[idx-1]['Qty Sold (Kgs)'] || 0) : 0;
                    else if (col === 'Lag_Total_Qty_Arrived_1') row[col] = idx > 0 ? (data[idx-1]['Total Qty Arrived (Kgs)'] || 0) : 0;
                    else if (col === 'is_market_open') row[col] = 1;
                    else if (col === 'is_flood_crisis' || col === 'is_lockdown') row[col] = 0;
                    else if (col === 'Auctioneer') row[col] = '';
                    else row[col] = 0;
                });
            });
        }

        const presentCount = ALL_39_FEATURES.filter(f => uploadedFields.includes(f)).length;
        const extraCols = uploadedFields.filter(f => !ALL_39_FEATURES.includes(f) && f !== '_date');

        console.log(`✅ Feature validation: ${presentCount}/39 present, ${missingCols.length} filled, ${extraCols.length} extra`);

        return {
            data,
            featureCount: Math.max(uploadedFields.length, 39),
            presentFeatures: presentCount,
            missingFeatures: missingCols,
            extraFeatures: extraCols,
        };
    }

    // ══════════════════════════════════════════════════════
    // UTILITIES
    // ══════════════════════════════════════════════════════
    function formatDate(d) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
    }

    function getData() { return parsedData; }
    function getRawData() { return rawData; }
    function hasData() { return parsedData !== null; }

    return {
        loadSampleData,
        parseCSV,
        getData,
        getRawData,
        hasData,
        formatDate,
        // Date-range locked scenario system
        detectDateRange,
        getFixedScenarioByRange,
        loadScenarioForecast,
        getActiveScenario: () => _activeScenario,
        getActiveRangeKey: () => _activeRangeKey,
        clearActiveScenario: () => { _activeScenario = null; _activeRangeKey = null; },
        // Ad-hoc scenario for unknown CSV date ranges
        setAdHocScenario: (scenario, rangeKey) => {
            _activeScenario = scenario;
            _activeRangeKey = rangeKey || 'adhoc';
            console.log('[DataLoader] Ad-hoc scenario set:', scenario.label);
        },
    };
})();
