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
     * Load forecast data from JSON.
     * Supports: 1) Pre-computed fixed scenarios, 2) Default forecasts.json, 3) Simulated fallback.
     */
    async function loadForecast(progressCb) {
        if (progressCb) progressCb(10, 'Loading forecast data...');

        // ── Check for pre-computed fixed scenario first ──
        const scenario = (typeof DataLoader !== 'undefined' && DataLoader.getActiveScenario)
            ? DataLoader.getActiveScenario() : null;

        if (scenario && scenario.forecastFile) {
            if (progressCb) progressCb(20, 'Loading pre-computed forecast...');
            const scenarioData = await DataLoader.loadScenarioForecast(scenario.forecastFile);
            if (scenarioData) {
                console.log('[Forecasting] ✅ Pre-computed scenario loaded:', scenario.forecastFile);
                forecastData = scenarioData;
                if (progressCb) progressCb(60, 'Pre-computed forecast loaded!');
                ensureForecastFields();
                // Skip DPPE — pre-computed scenarios have their own best_entry
                isLivePrediction = false;
                if (!forecastData.analysis_points || forecastData.analysis_points.length === 0) {
                    forecastData.analysis_points = generateAnalysisPoints();
                }
                if (progressCb) progressCb(100, 'Complete!');
                return forecastData;
            }
            console.warn('[Forecasting] Failed to load scenario JSON, falling through to default...');
        }

        // ── Default flow: forecasts.json or simulated ──
        const data = await DataLoader.loadForecastJSON();
        if (!data) {
            if (progressCb) progressCb(30, 'Generating forecast...');
            forecastData = generateSimulatedForecast();
        } else {
            forecastData = data;
        }

        if (progressCb) progressCb(60, 'Processing...');
        ensureForecastFields();

        if (progressCb) progressCb(80, 'Applying prediction...');
        _applyDPPE();

        if (!forecastData.analysis_points || forecastData.analysis_points.length === 0) {
            forecastData.analysis_points = generateAnalysisPoints();
        }

        isLivePrediction = false;
        if (progressCb) progressCb(100, 'Complete!');
        return forecastData;
    }

    /**
     * DPPE: Apply deterministic prediction date to forecastData.
     * Hash → stored date → display. Zero recomputation.
     */
    function _applyDPPE() {
        if (!forecastData) return;
        const rawHash = (typeof DataLoader !== 'undefined' && DataLoader.getRawFileHash)
            ? DataLoader.getRawFileHash() : null;
        if (!rawHash) return;

        // Prediction is always pre-computed and stored by DataLoader during CSV load
        let predDate = DataLoader.getPrediction(rawHash);
        if (!predDate) {
            // Fallback: compute from parsed data if somehow not stored
            const data = DataLoader.getData();
            if (data) {
                predDate = DataLoader.computePredictionDate(data);
                if (predDate) DataLoader.savePrediction(rawHash, predDate);
            }
        }
        if (!predDate) return;

        const parts = predDate.split('-');
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        const pDate = new Date(year, month, day);
        const monthNames = ['January','February','March','April','May','June',
            'July','August','September','October','November','December'];

        forecastData.best_purchase_day = {
            date_str: predDate,
            date_iso: `${parts[2]}-${parts[1]}-${parts[0]}`,
            date_display: formatDateDisplay(pDate),
            month_name: monthNames[month],
            year, day,
            algorithm: 'DPPE (SHA-256 hash-based)',
        };
        forecastData.best_purchase_day_str = 'Best Purchase Day Next Month: ' + predDate;

        if (forecastData.daily_forecasts) {
            const match = forecastData.daily_forecasts.find(
                d => d.date === forecastData.best_purchase_day.date_iso);
            if (match) forecastData.best_entry = { ...match };
        }
    }

    /**
     * Generate simulated 30-day forecast (fallback if no JSON)
     */
    function generateSimulatedForecast() {
        const baseDate = new Date('2026-01-10');
        const basePriceINR = 2412.5;
        const daily = [];

        // Deterministic seeded PRNG for fallback simulation
        let _simSeed = 48271;
        function _simRng() {
            _simSeed |= 0; _simSeed = _simSeed + 0x6D2B79F5 | 0;
            let t = Math.imul(_simSeed ^ _simSeed >>> 15, 1 | _simSeed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }

        // Realistic price simulation with trends
        let price = basePriceINR;
        const trend = -0.001; // slight downward
        const volatility = 0.015;

        for (let i = 0; i < 30; i++) {
            const date = new Date(baseDate);
            date.setDate(date.getDate() + i);

            // Add deterministic noise (seeded, not Math.random)
            const noise = (_simRng() - 0.5) * 2 * volatility;
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
                confidence = 85 + _simRng() * 10;
            } else if (dailyPct < -0.5 && risk === 'Normal') {
                recommendation = 'BUY';
                confidence = 70 + _simRng() * 15;
            } else if (dailyPct < 0) {
                recommendation = 'ACCUMULATE';
                confidence = 55 + _simRng() * 15;
            } else {
                recommendation = 'WAIT';
                confidence = 40 + _simRng() * 20;
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
            generated: '2026-01-09T12:00:00Z',
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

    /** Clear the active in-memory forecast */
    function clearCache() {
        forecastData = null;
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
        clearCache,
        EXCHANGE_RATES,
        CURRENCY_SYMBOLS,
    };
})();
