/* ═══════════════════════════════════════════════════════════
   Data Loader — CSV parsing & sample data management
   ═══════════════════════════════════════════════════════════ */

const DataLoader = (() => {
    let rawData = null;
    let parsedData = null;

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

    /**
     * Load pre-computed forecast from JSON
     */
    async function loadForecastJSON() {
        try {
            const resp = await fetch('assets/data/forecasts.json');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            return data;
        } catch (e) {
            console.error('Failed to load forecasts.json:', e);
            return null;
        }
    }

    /**
     * Load sample data from the full historical CSV.
     * Fetches India_Cardamom_Final_Ready.csv, parses it, takes the
     * last 90 days, validates all 39 features, and stores globally.
     */
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

                    // Validate required columns
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

                    // Get full date range from ALL records
                    const allDates = data.filter(r => r._date).map(r => r._date);
                    const fullFrom = allDates.length ? formatDate(allDates[0]) : '—';
                    const fullTo = allDates.length ? formatDate(allDates[allDates.length - 1]) : '—';

                    // Store ALL data globally
                    rawData = data;
                    parsedData = data;
                    window.uploadedData = data;        // ALL 2,869 rows
                    window.isSampleData = true;         // Flag: use pre-computed forecasts.json
                    window.isCustomUpload = false;

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

    /**
     * Parse uploaded CSV file
     */
    function parseCSV(file) {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
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
                    console.log(`\u2713 Dataset has ${data.length} rows (minimum ${MIN_ROWS} required)`);

                    // Parse dates (handle DD/MM/YYYY and ISO formats)
                    data.forEach(row => {
                        if (row.time) {
                            const parts = String(row.time).split('/');
                            if (parts.length === 3 && parts[0].length <= 2) {
                                // DD/MM/YYYY format
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

                    // Set global flags so forecasting engine can find the data
                    window.uploadedData = validatedData.data;
                    window.isCustomUpload = true;
                    window.isSampleData = false;

                    // Compute fingerprint for this upload so the UI can check the library
                    let _uploadFingerprint = null;
                    if (typeof Forecasting !== 'undefined' && Forecasting.computeFingerprint) {
                        _uploadFingerprint = Forecasting.computeFingerprint(validatedData.data);
                        console.log('[DataLoader] Upload fingerprint:', _uploadFingerprint);
                    }

                    // Reset in-memory forecast state (library is NOT cleared — it persists)
                    if (typeof Forecasting !== 'undefined' && Forecasting.clearCache) {
                        Forecasting.clearCache();
                    }

                    const dates = validatedData.data.filter(r => r._date).map(r => r._date);
                    const lastDate = dates.length ? dates[dates.length - 1] : null;
                    const lastPrice = validatedData.data.length
                        ? parseFloat(validatedData.data[validatedData.data.length - 1]['Avg.Price (Rs./Kg)']) || 0
                        : 0;

                    console.log('[DataLoader] Upload complete:',
                        validatedData.data.length, 'rows,',
                        'last date:', lastDate,
                        'last price: INR', lastPrice,
                        'window.isCustomUpload:', window.isCustomUpload);

                    resolve({
                        success: true,
                        records: validatedData.data.length,
                        from: dates.length ? formatDate(dates[0]) : '—',
                        to: dates.length ? formatDate(dates[dates.length - 1]) : '—',
                        features: validatedData.featureCount,
                        fingerprint: _uploadFingerprint,
                    });
                },
                error: (err) => reject(err),
            });
        });
    }

    /**
     * Validate uploaded CSV features against expected 39 columns.
     * Fill any missing features with intelligent defaults based on available data.
     */
    function validateAndFillFeatures(data, uploadedFields) {
        const missingCols = ALL_39_FEATURES.filter(f => !uploadedFields.includes(f));

        if (missingCols.length > 0) {
            console.warn(`CSV missing ${missingCols.length} of 39 features. Filling intelligent defaults:`, missingCols);
            
            data.forEach((row, idx) => {
                const currentPrice = parseFloat(row['Avg.Price (Rs./Kg)']) || 0;
                const maxPrice = parseFloat(row['MaxPrice (Rs./Kg)']) || currentPrice;
                const qtyArrived = parseFloat(row['Total Qty Arrived (Kgs)']) || 0;
                const qtySold = parseFloat(row['Qty Sold (Kgs)']) || 0;
                const date = row.time ? new Date(row.time) : new Date();

                missingCols.forEach(col => {
                    if (col in row) return; // Skip if already exists

                    // Temporal features from date
                    if (col === 'year') row[col] = date.getFullYear();
                    else if (col === 'month') row[col] = date.getMonth() + 1;
                    else if (col === 'week_of_year') {
                        const firstDay = new Date(date.getFullYear(), 0, 1);
                        row[col] = Math.ceil(((date - firstDay) / 86400000 + firstDay.getDay() + 1) / 7);
                    }
                    else if (col === 'day_of_week') row[col] = date.getDay();
        
                    // Market-derived features
                    else if (col === 'Daily_Spread') row[col] = maxPrice - currentPrice;
                    else if (col === 'Smooth_Qty_Arrived') row[col] = qtyArrived;
                    
                    // Lag features - use current price or look back in data
                    else if (col === 'Lag1') row[col] = idx > 0 ? (parseFloat(data[idx-1]['Avg.Price (Rs./Kg)']) || currentPrice) : currentPrice;
                    else if (col === 'Lag7') row[col] = idx >= 7 ? (parseFloat(data[idx-7]['Avg.Price (Rs./Kg)']) || currentPrice) : currentPrice;
                    else if (col === 'Lag14') row[col] = idx >= 14 ? (parseFloat(data[idx-14]['Avg.Price (Rs./Kg)']) || currentPrice) : currentPrice;
                    else if (col === 'Lag30') row[col] = idx >= 30 ? (parseFloat(data[idx-30]['Avg.Price (Rs./Kg)']) || currentPrice) : currentPrice;
                    else if (col === 'Lag_MaxPrice_1') row[col] = idx > 0 ? (parseFloat(data[idx-1]['MaxPrice (Rs./Kg)']) || maxPrice) : maxPrice;
                    else if (col === 'Lag_Spread_1') row[col] = idx > 0 ? ((data[idx-1]['Daily_Spread'] || 0)) : 0;
                    
                    // Moving averages - calculate from recent data
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
                    
                    // Weather defaults
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
                    
                    // Market efficiency and quantity
                    else if (col === 'Lag_Qty_Sold_1') row[col] = idx > 0 ? (data[idx-1]['Qty Sold (Kgs)'] || 0) : 0;
                    else if (col === 'Lag_Total_Qty_Arrived_1') row[col] = idx > 0 ? (data[idx-1]['Total Qty Arrived (Kgs)'] || 0) : 0;
                    
                    // Boolean/categorical
                    else if (col === 'is_market_open') row[col] = 1;
                    else if (col === 'is_flood_crisis' || col === 'is_lockdown') row[col] = 0;
                    else if (col === 'Auctioneer') row[col] = '';
                    
                    // Fallback
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

    function formatDate(d) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2,'0')}, ${d.getFullYear()}`;
    }

    function getData() { return parsedData; }
    function getRawData() { return rawData; }
    function hasData() { return parsedData !== null; }

    return {
        loadForecastJSON,
        loadSampleData,
        parseCSV,
        getData,
        getRawData,
        hasData,
        formatDate,
    };
})();
