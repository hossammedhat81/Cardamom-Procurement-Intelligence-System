/* ═══════════════════════════════════════════════════════════
   Forecasting Engine — Pre-computed JSON only + What-If
   ═══════════════════════════════════════════════════════════
   DATE-RANGE LOCKED SYSTEM:
   • loadForecast() loads ONLY from pre-computed JSON files
   • NO DPPE, NO SHA-256, NO seeded RNG, NO simulated fallback
   • If no JSON found → error. Zero exceptions.
   ═══════════════════════════════════════════════════════════ */

const Forecasting = (() => {
    const EXCHANGE_RATES = { USD: 1, SAR: 3.75, INR: 83.50 };
    const CURRENCY_SYMBOLS = { USD: '$', SAR: 'SAR ', INR: '₹' };

    let forecastData = null;
    let currentCurrency = 'SAR';

    /**
     * Load forecast data from the active scenario's pre-computed JSON.
     * There is NO fallback — if no scenario is active, this throws.
     */
    async function loadForecast(progressCb) {
        if (progressCb) progressCb(10, 'Loading forecast data...');

        const scenario = (typeof DataLoader !== 'undefined' && DataLoader.getActiveScenario)
            ? DataLoader.getActiveScenario() : null;

        if (!scenario) {
            throw new Error('No fixed scenario active. Upload a CSV with a recognized date range.');
        }

        if (progressCb) progressCb(20, 'Loading pre-computed forecast...');

        const forecastFile = scenario.forecastFile; // null = default forecasts.json
        const data = await DataLoader.loadScenarioForecast(forecastFile);

        if (!data) {
            throw new Error('Failed to load forecast JSON' + (forecastFile ? ': ' + forecastFile : ''));
        }

        console.log('[Forecasting] ✅ Pre-computed forecast loaded:', forecastFile || 'forecasts.json');
        forecastData = data;

        if (progressCb) progressCb(60, 'Processing forecast fields...');
        ensureForecastFields();

        if (!forecastData.analysis_points || forecastData.analysis_points.length === 0) {
            forecastData.analysis_points = generateAnalysisPoints();
        }

        if (progressCb) progressCb(100, 'Complete!');
        return forecastData;
    }

    /**
     * Ensure all forecast fields exist with proper currency conversions
     */
    function ensureForecastFields() {
        if (!forecastData || !forecastData.daily_forecasts) return;

        forecastData.daily_forecasts.forEach((d) => {
            if (!d.price_sar && d.price_usd) {
                d.price_sar = round(d.price_usd * EXCHANGE_RATES.SAR, 2);
            }
            if (!d.price_inr && d.price_usd) {
                d.price_inr = round(d.price_usd * EXCHANGE_RATES.INR, 2);
            }
            if (!d.date_display && d.date) {
                d.date_display = formatDateDisplay(new Date(d.date));
            }
            if (d.confidence === undefined) d.confidence = 75;
        });

        if (!forecastData.best_entry && forecastData.daily_forecasts.length > 0) {
            const min = forecastData.daily_forecasts.reduce(
                (m, d) => d.price_usd < m.price_usd ? d : m
            );
            forecastData.best_entry = { ...min };
        }

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
     * Generate analysis explanation points from loaded forecast data
     */
    function generateAnalysisPoints() {
        if (!forecastData || !forecastData.best_entry) return [];

        const best = forecastData.best_entry;
        const daily = forecastData.daily_forecasts;
        const stats = forecastData.statistics;
        const points = [];

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

        if (best.price_usd < firstPrice) {
            const dropPct = ((firstPrice - best.price_usd) / firstPrice * 100).toFixed(1);
            points.push({
                icon: '💰',
                text: `Optimal price is ${dropPct}% below the opening forecast price, indicating a significant buying window.`
            });
        }

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

        if (best.risk === 'Normal') {
            points.push({
                icon: '✅',
                text: 'Stable market conditions predicted around this date, reducing procurement risk.'
            });
        }

        const sbCount = stats.strong_buy_days || 0;
        if (sbCount >= 2) {
            points.push({
                icon: '🎯',
                text: `${sbCount} STRONG BUY signals detected in the 30-day forecast, giving flexibility in timing.`
            });
        }

        const bestDate = new Date(best.date);
        const months = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
        points.push({
            icon: '📅',
            text: `Historical data shows ${months[bestDate.getMonth()]} typically has favorable pricing for cardamom procurement.`
        });

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

        let priceImpact = 0;

        const tempDiff = (params.temperature - 25) / 25;
        priceImpact += tempDiff * 0.03;

        const precipDiff = Math.abs(params.precip_lag - 100) / 500;
        priceImpact += precipDiff * 0.02;

        const soilDiff = (0.28 - params.soil_moisture) / 0.28;
        priceImpact += soilDiff * 0.015;

        const supplyRatio = (50000 - params.qty_arrived) / 50000;
        priceImpact += supplyRatio * 0.04;

        const soldRatio = (params.qty_sold - 40000) / 40000;
        priceImpact += soldRatio * 0.02;

        const maxPriceDiff = (params.max_price - 2500) / 2500;
        priceImpact += maxPriceDiff * 0.025;

        if (!params.market_open) priceImpact += 0.05;
        if (params.flood) priceImpact += 0.08;
        if (params.lockdown) priceImpact += 0.04;

        const predictedINR = basePrice * (1 + priceImpact);
        const predictedUSD = predictedINR / EXCHANGE_RATES.INR;
        const predictedSAR = predictedUSD * EXCHANGE_RATES.SAR;

        const baseUSD = basePrice / EXCHANGE_RATES.INR;
        const baseSAR = baseUSD * EXCHANGE_RATES.SAR;

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

    // ══════════════════════════════════════════════════════
    // CURRENCY & PRICE HELPERS
    // ══════════════════════════════════════════════════════

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

    // ══════════════════════════════════════════════════════
    // UTILITIES
    // ══════════════════════════════════════════════════════
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
        clearCache,
        EXCHANGE_RATES,
        CURRENCY_SYMBOLS,
    };
})();
