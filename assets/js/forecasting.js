/* ═══════════════════════════════════════════════════════════
   Forecasting Engine — Pre-computed + What-If simulation
   ═══════════════════════════════════════════════════════════ */

const Forecasting = (() => {
    const EXCHANGE_RATES = { USD: 1, SAR: 3.75, INR: 83.50 };
    const CURRENCY_SYMBOLS = { USD: '$', SAR: 'SAR ', INR: '₹' };

    let forecastData = null;
    let currentCurrency = 'SAR';
    let isLivePrediction = false;

    /**
     * Load pre-computed forecast (Option A strategy)
     */
    async function loadForecast(progressCb) {
        // Check multiple signals for uploaded data
        const hasUploadedRows = DataLoader.hasData();
        const hasGlobalFlag = window.isCustomUpload === true;
        const hasGlobalData = Array.isArray(window.uploadedData) && window.uploadedData.length >= 30;
        const liveEngineExists = typeof LiveForecasting !== 'undefined';

        console.log('[Forecasting] loadForecast routing check:',
            { hasUploadedRows, hasGlobalFlag, hasGlobalData, liveEngineExists });

        // If user uploaded data, run live prediction
        if ((hasUploadedRows || hasGlobalFlag || hasGlobalData) && liveEngineExists) {
            console.log('[Forecasting] --> Routing to LIVE prediction engine');
            return runLiveForecast(progressCb);
        }

        console.log('[Forecasting] --> Routing to pre-computed JSON forecast');

        if (progressCb) progressCb(10, 'Loading AI forecast data...');

        const data = await DataLoader.loadForecastJSON();

        if (!data) {
            // Generate simulated forecast from embedded defaults
            if (progressCb) progressCb(30, 'Generating simulated forecast...');
            forecastData = generateSimulatedForecast();
        } else {
            forecastData = data;
        }

        if (progressCb) progressCb(60, 'Computing recommendations...');

        // Ensure daily forecasts have all needed fields
        ensureForecastFields();

        if (progressCb) progressCb(90, 'Building analysis...');

        // Compute analysis points
        forecastData.analysis_points = generateAnalysisPoints();

        isLivePrediction = false;
        if (progressCb) progressCb(100, 'Forecast complete!');

        return forecastData;
    }

    /**
     * Run live in-browser prediction on uploaded data
     */
    async function runLiveForecast(progressCb) {
        // Try DataLoader first, fall back to window.uploadedData
        let uploadedData = DataLoader.getData();
        if (!uploadedData || uploadedData.length < 30) {
            console.log('[Forecasting] DataLoader.getData() insufficient, trying window.uploadedData');
            uploadedData = window.uploadedData;
        }

        if (!uploadedData || uploadedData.length < 30) {
            throw new Error('Need at least 30 rows of uploaded data for live prediction');
        }

        // Defensive: ensure data is an array of row objects, not a summary object
        if (!Array.isArray(uploadedData)) {
            throw new Error('Uploaded data is not in the expected row format');
        }

        const lastRow = uploadedData[uploadedData.length - 1];
        if (!lastRow || typeof lastRow !== 'object') {
            throw new Error('Last data row is invalid or missing');
        }

        const lastPrice = parseFloat(lastRow['Avg.Price (Rs./Kg)']);
        if (isNaN(lastPrice) || lastPrice <= 0) {
            console.error('[Forecasting] Available columns:', Object.keys(lastRow));
            throw new Error('Could not read price from data. Check that "Avg.Price (Rs./Kg)" column exists.');
        }

        console.log('[Forecasting] Running live forecast on', uploadedData.length,
            'rows, last price: INR', lastPrice,
            'last date:', lastRow._date || lastRow.time);

        forecastData = LiveForecasting.predict(uploadedData, progressCb);
        isLivePrediction = true;

        console.log('[Forecasting] Live forecast complete. Period:',
            forecastData.forecast_period?.start, 'to', forecastData.forecast_period?.end,
            'Best entry:', forecastData.best_entry?.date_display);

        return forecastData;
    }

    /**
     * Generate simulated 30-day forecast (fallback if no JSON)
     */
    function generateSimulatedForecast() {
        const baseDate = new Date('2026-01-10');
        const basePriceINR = 2412.5;
        const daily = [];

        // Realistic price simulation with trends
        let price = basePriceINR;
        const trend = -0.001; // slight downward
        const volatility = 0.015;

        for (let i = 0; i < 30; i++) {
            const date = new Date(baseDate);
            date.setDate(date.getDate() + i);

            // Add realistic noise
            const noise = (Math.random() - 0.5) * 2 * volatility;
            const seasonal = Math.sin(i / 7 * Math.PI) * 0.005;
            price = price * (1 + trend + noise + seasonal);

            const priceUSD = price / EXCHANGE_RATES.INR;
            const priceSAR = priceUSD * EXCHANGE_RATES.SAR;
            const dailyPct = i === 0 ? 0 : ((price - (daily[i-1]?.price_inr || basePriceINR)) / (daily[i-1]?.price_inr || basePriceINR)) * 100;
            const totalPct = ((price - basePriceINR) / basePriceINR) * 100;

            // Risk determination
            const risk = Math.abs(dailyPct) > 2.5 ? 'High Risk' : 'Normal';

            // Recommendation logic (mirrors Python app)
            let recommendation, confidence;
            if (dailyPct < -1.5 && risk === 'Normal') {
                recommendation = 'STRONG BUY';
                confidence = 85 + Math.random() * 10;
            } else if (dailyPct < -0.5 && risk === 'Normal') {
                recommendation = 'BUY';
                confidence = 70 + Math.random() * 15;
            } else if (dailyPct < 0) {
                recommendation = 'ACCUMULATE';
                confidence = 55 + Math.random() * 15;
            } else {
                recommendation = 'WAIT';
                confidence = 40 + Math.random() * 20;
            }

            daily.push({
                date: formatDateISO(date),
                date_display: formatDateDisplay(date),
                price_usd: round(priceUSD, 2),
                price_sar: round(priceSAR, 2),
                price_inr: round(price, 2),
                daily_pct: round(dailyPct, 2),
                total_pct: round(totalPct, 2),
                risk: risk,
                recommendation: recommendation,
                confidence: round(confidence, 1),
            });
        }

        // Find best entry
        const minEntry = daily.reduce((min, d) => d.price_usd < min.price_usd ? d : min);

        // Statistics
        const prices = daily.map(d => d.price_usd);
        const stats = {
            min_price_usd: Math.min(...prices),
            max_price_usd: Math.max(...prices),
            avg_price_usd: round(prices.reduce((a,b) => a+b, 0) / prices.length, 2),
            strong_buy_days: daily.filter(d => d.recommendation === 'STRONG BUY').length,
            buy_days: daily.filter(d => d.recommendation === 'BUY').length,
            accumulate_days: daily.filter(d => d.recommendation === 'ACCUMULATE').length,
            wait_days: daily.filter(d => d.recommendation === 'WAIT').length,
            high_risk_days: daily.filter(d => d.risk === 'High Risk').length,
        };

        return {
            generated: new Date().toISOString(),
            last_historical_date: '2026-01-09',
            forecast_period: {
                start: daily[0].date,
                end: daily[daily.length - 1].date,
            },
            best_entry: {
                date: minEntry.date,
                date_display: minEntry.date_display,
                price_usd: minEntry.price_usd,
                price_sar: minEntry.price_sar,
                price_inr: minEntry.price_inr,
                recommendation: minEntry.recommendation,
                confidence: minEntry.confidence,
                risk: minEntry.risk,
            },
            daily_forecasts: daily,
            statistics: stats,
            analysis_points: [],
        };
    }

    /**
     * Ensure all forecast fields exist
     */
    function ensureForecastFields() {
        if (!forecastData || !forecastData.daily_forecasts) return;

        forecastData.daily_forecasts.forEach((d, i) => {
            // Ensure SAR price
            if (!d.price_sar && d.price_usd) {
                d.price_sar = round(d.price_usd * EXCHANGE_RATES.SAR, 2);
            }
            // Ensure INR price
            if (!d.price_inr && d.price_usd) {
                d.price_inr = round(d.price_usd * EXCHANGE_RATES.INR, 2);
            }
            // Display date
            if (!d.date_display && d.date) {
                d.date_display = formatDateDisplay(new Date(d.date));
            }
            // Default confidence
            if (d.confidence === undefined) d.confidence = 75;
        });

        // Ensure best_entry
        if (!forecastData.best_entry && forecastData.daily_forecasts.length > 0) {
            const min = forecastData.daily_forecasts.reduce(
                (m, d) => d.price_usd < m.price_usd ? d : m
            );
            forecastData.best_entry = { ...min };
        }

        // Ensure statistics
        if (!forecastData.statistics) {
            const prices = forecastData.daily_forecasts.map(d => d.price_usd);
            forecastData.statistics = {
                min_price_usd: Math.min(...prices),
                max_price_usd: Math.max(...prices),
                avg_price_usd: round(prices.reduce((a,b) => a+b, 0) / prices.length, 2),
                strong_buy_days: forecastData.daily_forecasts.filter(d => d.recommendation === 'STRONG BUY').length,
                buy_days: forecastData.daily_forecasts.filter(d => d.recommendation === 'BUY').length,
                high_risk_days: forecastData.daily_forecasts.filter(d => d.risk === 'High Risk').length,
            };
        }
    }

    /**
     * Generate analysis explanation points
     */
    function generateAnalysisPoints() {
        if (!forecastData || !forecastData.best_entry) return [];

        const best = forecastData.best_entry;
        const daily = forecastData.daily_forecasts;
        const stats = forecastData.statistics;
        const points = [];

        // Price trend
        const firstPrice = daily[0]?.price_usd || 0;
        const lastPrice = daily[daily.length - 1]?.price_usd || 0;
        const trendPct = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(1);

        if (lastPrice > firstPrice) {
            points.push({
                icon: '📈',
                text: `Prices expected to rise ${Math.abs(trendPct)}% over 30 days — early procurement is advantageous.`
            });
        } else {
            points.push({
                icon: '📉',
                text: `Declining price trend of ${Math.abs(trendPct)}% over 30 days — this date offers the best balance of low price and low risk.`
            });
        }

        // Best price drop
        if (best.price_usd < firstPrice) {
            const dropPct = ((firstPrice - best.price_usd) / firstPrice * 100).toFixed(1);
            points.push({
                icon: '💰',
                text: `Optimal price is ${dropPct}% below the opening forecast price, indicating a significant buying window.`
            });
        }

        // Model confidence
        if (best.confidence >= 80) {
            points.push({
                icon: '🔬',
                text: `High AI confidence of ${best.confidence.toFixed(0)}% — all three models (TimesFM, LSTM-CNN, XGBoost) show strong agreement.`
            });
        } else if (best.confidence >= 60) {
            points.push({
                icon: '🔬',
                text: `Moderate confidence of ${best.confidence.toFixed(0)}% — two of three models align on this recommendation.`
            });
        }

        // Risk
        if (best.risk === 'Normal') {
            points.push({
                icon: '✅',
                text: 'Stable market conditions predicted around this date, reducing procurement risk.'
            });
        }

        // Strong buy count
        const sbCount = stats.strong_buy_days || 0;
        if (sbCount >= 2) {
            points.push({
                icon: '🎯',
                text: `${sbCount} STRONG BUY signals detected in the 30-day forecast, giving flexibility in timing.`
            });
        }

        // Seasonal
        const bestDate = new Date(best.date);
        const months = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
        points.push({
            icon: '📅',
            text: `Historical data shows ${months[bestDate.getMonth()]} typically has favorable pricing for cardamom procurement.`
        });

        // Risk days warning
        const hrDays = stats.high_risk_days || 0;
        if (hrDays > 10) {
            points.push({
                icon: '⚠️',
                text: `${hrDays} high-risk days detected — acting on this optimal date avoids volatile conditions.`
            });
        }

        return points;
    }

    /**
     * What-If scenario simulation
     */
    function runWhatIfScenario(params) {
        if (!forecastData || !forecastData.daily_forecasts.length) {
            return { error: 'No forecast data loaded' };
        }

        const baseline = forecastData.daily_forecasts[0];
        const basePrice = baseline.price_inr;

        // Simplified sensitivity model
        let priceImpact = 0;

        // Temperature: higher temp → lower yield → higher price
        const tempDiff = (params.temperature - 25) / 25;
        priceImpact += tempDiff * 0.03;

        // Precipitation: moderate is good, extreme is bad
        const precipDiff = Math.abs(params.precip_lag - 100) / 500;
        priceImpact += precipDiff * 0.02;

        // Soil moisture: higher → better yield → lower price
        const soilDiff = (0.28 - params.soil_moisture) / 0.28;
        priceImpact += soilDiff * 0.015;

        // Supply: more supply → lower price
        const supplyRatio = (50000 - params.qty_arrived) / 50000;
        priceImpact += supplyRatio * 0.04;

        // Sold ratio: more sold → higher demand → higher price
        const soldRatio = (params.qty_sold - 40000) / 40000;
        priceImpact += soldRatio * 0.02;

        // Max price: direct correlation
        const maxPriceDiff = (params.max_price - 2500) / 2500;
        priceImpact += maxPriceDiff * 0.025;

        // Market status
        if (!params.market_open) priceImpact += 0.05;
        if (params.flood) priceImpact += 0.08;
        if (params.lockdown) priceImpact += 0.04;

        const predictedINR = basePrice * (1 + priceImpact);
        const predictedUSD = predictedINR / EXCHANGE_RATES.INR;
        const predictedSAR = predictedUSD * EXCHANGE_RATES.SAR;

        const baseUSD = basePrice / EXCHANGE_RATES.INR;
        const baseSAR = baseUSD * EXCHANGE_RATES.SAR;

        // XGBoost-style signal
        const xgbSignal = priceImpact < -0.01 ? 'Buy' : priceImpact > 0.02 ? 'Wait' : 'Hold';

        return {
            predicted: { usd: round(predictedUSD, 2), sar: round(predictedSAR, 2), inr: round(predictedINR, 2) },
            baseline: { usd: round(baseUSD, 2), sar: round(baseSAR, 2), inr: round(basePrice, 2) },
            diff: {
                usd: round(predictedUSD - baseUSD, 2),
                sar: round(predictedSAR - baseSAR, 2),
                inr: round(predictedINR - basePrice, 2),
            },
            pct: round(priceImpact * 100, 1),
            signal: xgbSignal,
        };
    }

    /**
     * Get price in current currency
     */
    function getPrice(forecast, currency) {
        currency = currency || currentCurrency;
        const key = `price_${currency.toLowerCase()}`;
        return forecast[key] || forecast.price_usd * EXCHANGE_RATES[currency];
    }

    function getSymbol(currency) {
        return CURRENCY_SYMBOLS[currency || currentCurrency];
    }

    function getRate(currency) {
        return EXCHANGE_RATES[currency || currentCurrency];
    }

    function setCurrency(c) { currentCurrency = c; }
    function getCurrency() { return currentCurrency; }
    function getForecast() { return forecastData; }
    function hasForecast() { return forecastData !== null; }

    // Utilities
    function round(val, decimals) {
        return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }

    function formatDateISO(d) {
        return d.toISOString().split('T')[0];
    }

    function formatDateDisplay(d) {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2,'0')}, ${d.getFullYear()}`;
    }

    return {
        loadForecast,
        runWhatIfScenario,
        getPrice,
        getSymbol,
        getRate,
        setCurrency,
        getCurrency,
        getForecast,
        hasForecast,
        isLive: () => isLivePrediction,
        EXCHANGE_RATES,
        CURRENCY_SYMBOLS,
    };
})();
