/* ═══════════════════════════════════════════════════════════
   Data Loader — CSV parsing & sample data management
   ═══════════════════════════════════════════════════════════ */

const DataLoader = (() => {
    let rawData = null;
    let parsedData = null;
    let _rawFileHash = null;

    // ══════════════════════════════════════════════════════
    // SHA-256 (synchronous, pure JS) — DPPE raw file hashing
    // ══════════════════════════════════════════════════════
    function sha256Sync(message) {
        const K = new Uint32Array([
            0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
            0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
            0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
            0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
            0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
            0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
            0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
            0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
        ]);
        const H = new Uint32Array([
            0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
            0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19
        ]);
        const enc = new TextEncoder();
        const msgBytes = enc.encode(message);
        const bitLen = msgBytes.length * 8;
        const padLen = Math.ceil((msgBytes.length + 9) / 64) * 64;
        const buf = new ArrayBuffer(padLen);
        const pad = new Uint8Array(buf);
        pad.set(msgBytes);
        pad[msgBytes.length] = 0x80;
        const dv = new DataView(buf);
        dv.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);
        dv.setUint32(padLen - 4, bitLen >>> 0, false);
        const W = new Uint32Array(64);
        for (let off = 0; off < padLen; off += 64) {
            for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4, false);
            for (let i = 16; i < 64; i++) {
                const s0 = ((W[i-15]>>>7)|(W[i-15]<<25))^((W[i-15]>>>18)|(W[i-15]<<14))^(W[i-15]>>>3);
                const s1 = ((W[i-2]>>>17)|(W[i-2]<<15))^((W[i-2]>>>19)|(W[i-2]<<13))^(W[i-2]>>>10);
                W[i] = (W[i-16]+s0+W[i-7]+s1)|0;
            }
            let a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
            for (let i = 0; i < 64; i++) {
                const S1=((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7));
                const ch=(e&f)^((~e)&g);
                const t1=(h+S1+ch+K[i]+W[i])|0;
                const S0=((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10));
                const maj=(a&b)^(a&c)^(b&c);
                const t2=(S0+maj)|0;
                h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
            }
            H[0]=(H[0]+a)|0;H[1]=(H[1]+b)|0;H[2]=(H[2]+c)|0;H[3]=(H[3]+d)|0;
            H[4]=(H[4]+e)|0;H[5]=(H[5]+f)|0;H[6]=(H[6]+g)|0;H[7]=(H[7]+h)|0;
        }
        let hex = '';
        for (let i = 0; i < 8; i++) hex += (H[i]>>>0).toString(16).padStart(8,'0');
        return hex;
    }

    // ══════════════════════════════════════════════════════
    // DPPE: Deterministic Purchase Prediction Engine — Storage
    // Keys: prediction_<sha256hash> in localStorage
    // Values: "DD-MM-YYYY" date strings — NEVER overwritten
    // ══════════════════════════════════════════════════════
    function _predictionKey(hash) { return 'prediction_' + hash; }

    function lookupPrediction(hash) {
        if (!hash) return null;
        try { return localStorage.getItem(_predictionKey(hash)); }
        catch (e) { return null; }
    }

    function savePredictionToStore(hash, dateStr) {
        if (!hash || !dateStr) return false;
        const key = _predictionKey(hash);
        try {
            // NEVER overwrite an existing prediction
            if (localStorage.getItem(key) !== null) {
                console.log('[DPPE] Prediction already stored for', key, '— will NOT overwrite');
                return false;
            }
            localStorage.setItem(key, dateStr);
            console.log('[DPPE] ✅ Stored prediction:', key, '→', dateStr);
            return true;
        } catch (e) {
            console.warn('[DPPE] localStorage write failed:', e);
            return false;
        }
    }

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

        // ── DPPE: Compute SHA-256 of raw CSV text BEFORE parsing ──
        _rawFileHash = sha256Sync(csvText);
        console.log('[DPPE] Sample data SHA-256:', _rawFileHash.substring(0, 16) + '...');
        const _storedPrediction = lookupPrediction(_rawFileHash);
        if (_storedPrediction) {
            console.log('[DPPE] ✅ Stored prediction for sample data:', _storedPrediction);
        }

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
                        rawFileHash: _rawFileHash,
                        storedPrediction: _storedPrediction,
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
            // ── DPPE: Read raw file content FIRST for SHA-256 hashing ──
            const reader = new FileReader();
            reader.onload = function(readerEvent) {
                const rawText = readerEvent.target.result;

                // Compute SHA-256 of raw file content BEFORE any parsing
                _rawFileHash = sha256Sync(rawText);
                console.log('[DPPE] Raw file SHA-256:', _rawFileHash.substring(0, 16) + '...');

                // Check prediction store BEFORE parsing/computation
                const _storedPrediction = lookupPrediction(_rawFileHash);
                if (_storedPrediction) {
                    console.log('[DPPE] ✅ Stored prediction found:', _storedPrediction);
                }

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
                        rawFileHash: _rawFileHash,
                        storedPrediction: _storedPrediction,
                    });
                },
                error: (err) => reject(err),
            });
            }; // end reader.onload
            reader.onerror = function() { reject(new Error('Failed to read uploaded file')); };
            reader.readAsText(file);
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
        // DPPE: Deterministic Purchase Prediction Engine
        getRawFileHash: () => _rawFileHash,
        hasPrediction: (hash) => lookupPrediction(hash) !== null,
        getPrediction: lookupPrediction,
        savePrediction: savePredictionToStore,
    };
})();
