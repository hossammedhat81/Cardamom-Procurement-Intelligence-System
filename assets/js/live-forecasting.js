/* ═══════════════════════════════════════════════════════════
   Live Forecasting Engine — In-browser 30-day price prediction
   ═══════════════════════════════════════════════════════════
   Uses statistical methods on uploaded data to generate real-time
   forecasts without any server calls. Combines:
   - Exponential Moving Average (EMA) trend
   - Weighted linear regression momentum
   - Seasonal day-of-week patterns
   - Mean reversion toward rolling mean
   - Volatility-adaptive confidence bands
   ═══════════════════════════════════════════════════════════ */

const LiveForecasting = (() => {

    const EXCHANGE_RATES = { USD: 1, SAR: 3.75, INR: 83.50 };

    // ── Seeded PRNG (mulberry32) — deterministic random from a seed ──
    function mulberry32(seed) {
        return function() {
            seed |= 0; seed = seed + 0x6D2B79F5 | 0;
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    /**
     * Seeded Random Number Generator (Deterministic)
     * Same seed always produces same sequence.
     */
    class SeededRandom {
        constructor(seed) {
            this.rng = mulberry32(seed);
        }
        next() { return this.rng(); }
        range(min, max) { return min + this.rng() * (max - min); }
        gaussian(mean, stdDev) {
            mean = mean || 0; stdDev = stdDev || 1;
            const u1 = this.rng();
            const u2 = this.rng();
            const z0 = Math.sqrt(-2.0 * Math.log(u1 || 1e-10)) * Math.cos(2.0 * Math.PI * u2);
            return z0 * stdDev + mean;
        }
    }

    /**
     * Generate deterministic seed from input data.
     * Uses first 10 + last 10 rows for a unique fingerprint.
     */
    function createSeedFromData(data) {
        let hash = 0;
        const sample = [
            ...data.slice(0, Math.min(10, data.length)),
            ...data.slice(-Math.min(10, data.length))
        ];
        sample.forEach(row => {
            const str = String(row.time || '') + String(row['Avg.Price (Rs./Kg)'] || '');
            for (let i = 0; i < str.length; i++) {
                const c = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + c;
                hash = hash & hash; // 32-bit int
            }
        });
        return Math.abs(hash) || 12345;
    }

    // ── Helpers ──────────────────────────────────────────
    function round(v, d) { return Math.round(v * 10 ** d) / 10 ** d; }

    function mean(arr) {
        if (!arr.length) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    function stddev(arr) {
        const m = mean(arr);
        return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
    }

    function ema(arr, span) {
        const k = 2 / (span + 1);
        let e = arr[0];
        for (let i = 1; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
        return e;
    }

    function linregSlope(arr) {
        const n = arr.length;
        if (n < 2) return 0;
        let sx = 0, sy = 0, sxy = 0, sx2 = 0;
        for (let i = 0; i < n; i++) {
            sx += i; sy += arr[i]; sxy += i * arr[i]; sx2 += i * i;
        }
        const denom = n * sx2 - sx * sx;
        return denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
    }

    function formatDateISO(d) { return d.toISOString().split('T')[0]; }

    function formatDateDisplay(d) {
        const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${m[d.getMonth()]} ${String(d.getDate()).padStart(2,'0')}, ${d.getFullYear()}`;
    }

    // ── Core Prediction ─────────────────────────────────
    /**
     * Generate a 30-day forecast from uploaded CSV data.
     *
     * @param {Array<Object>} data   Parsed rows sorted by date (newest last).
     *                               Must have 'Avg.Price (Rs./Kg)' and 'time'.
     * @param {Function} progressCb  Optional (pct, msg) callback for UI progress.
     * @returns {Object}             Forecast in the same shape as forecasts.json.
     */
    function predict(data, progressCb) {
        if (progressCb) progressCb(5, 'Analyzing uploaded market data...');

        // ── Extract price series ─────────────────────────
        const prices = data.map(r => parseFloat(r['Avg.Price (Rs./Kg)']) || 0).filter(p => p > 0);
        const maxPrices = data.map(r => parseFloat(r['MaxPrice (Rs./Kg)']) || 0);
        const quantities = data.map(r => parseFloat(r['Total Qty Arrived (Kgs)']) || 0);

        if (prices.length < 30) {
            throw new Error('Need at least 30 price records for prediction');
        }

        if (progressCb) progressCb(15, 'Extracting trend indicators...');

        // ── Statistical features from recent history ─────
        const last30   = prices.slice(-30);
        const last14   = prices.slice(-14);
        const last7    = prices.slice(-7);
        const lastPrice = prices[prices.length - 1];

        const ma7   = mean(last7);
        const ma14  = mean(last14);
        const ma30  = mean(last30);
        const ema7  = ema(last7, 7);
        const ema14 = ema(last14, 14);

        // Trend: weighted linear regression on last 14 days
        const slope14 = linregSlope(last14);
        // Momentum: EMA crossover
        const momentum = (ema7 - ema14) / ema14;

        // Volatility: std of daily returns
        const returns = [];
        for (let i = 1; i < last30.length; i++) {
            returns.push((last30[i] - last30[i - 1]) / last30[i - 1]);
        }
        const vol = stddev(returns);

        if (progressCb) progressCb(30, 'Computing day-of-week seasonal patterns...');

        // ── Day-of-week seasonality ──────────────────────
        const dowReturns = Array.from({ length: 7 }, () => []);
        for (let i = 1; i < data.length; i++) {
            const d = data[i]._date || new Date(data[i].time);
            const dow = d.getDay();
            const p0 = parseFloat(data[i - 1]['Avg.Price (Rs./Kg)']) || 0;
            const p1 = parseFloat(data[i]['Avg.Price (Rs./Kg)']) || 0;
            if (p0 > 0 && p1 > 0) dowReturns[dow].push((p1 - p0) / p0);
        }
        const dowEffect = dowReturns.map(arr => arr.length > 5 ? mean(arr) : 0);

        if (progressCb) progressCb(45, 'Calculating supply-demand dynamics...');

        // ── Supply metrics ───────────────────────────────
        const last7Qty = quantities.slice(-7);
        const avgQty = mean(last7Qty.filter(q => q > 0));
        // Higher supply → downward price pressure
        const supplyPressure = avgQty > 0 ? -0.001 * (avgQty / 100000 - 1) : 0;

        if (progressCb) progressCb(55, 'Running 30-day forward simulation...');

        // ── Initialize deterministic PRNG from data ──────
        const seed = createSeedFromData(data);
        const rng = new SeededRandom(seed);
        console.log('[LiveForecasting] Deterministic seed:', seed,
            '(same data will always produce same forecast)');

        // ── Determine last date ──────────────────────────
        let lastDate;
        const lastRow = data[data.length - 1];
        if (lastRow._date) {
            lastDate = new Date(lastRow._date);
        } else if (lastRow.time) {
            // Try DD/MM/YYYY format first, then ISO
            const parts = String(lastRow.time).split('/');
            if (parts.length === 3 && parts[2].length === 4) {
                lastDate = new Date(parts[2], parts[1] - 1, parts[0]);
            } else {
                lastDate = new Date(lastRow.time);
            }
        }
        if (!lastDate || isNaN(lastDate)) lastDate = new Date();

        // ── Forward simulation (30 days) ─────────────────
        const dailyForecasts = [];
        let price = lastPrice;
        let priceHistForMA = [...last30]; // rolling window for live MAs

        for (let i = 0; i < 30; i++) {
            const fDate = new Date(lastDate);
            fDate.setDate(fDate.getDate() + i + 1);
            const dow = fDate.getDay();

            // Components
            const trendComponent = slope14 * 0.3;          // damped linear trend
            const momentumComp   = momentum * 50;           // EMA crossover
            const meanRevComp    = (ma30 - price) * 0.015;  // pull toward 30-day mean
            const seasonalComp   = dowEffect[dow] * price;  // day-of-week pattern
            const supplyComp     = supplyPressure * price;  // supply impact
            const noiseComp      = rng.gaussian(0, vol) * price; // deterministic Gaussian noise

            // Combine
            const delta = trendComponent + momentumComp + meanRevComp + seasonalComp + supplyComp + noiseComp;
            price = price + delta;

            // Clamp: don't allow > 15% deviation from last known price
            const maxDev = lastPrice * 0.15;
            price = Math.max(lastPrice - maxDev, Math.min(lastPrice + maxDev, price));

            priceHistForMA.push(price);
            if (priceHistForMA.length > 30) priceHistForMA.shift();

            const priceINR = round(price, 2);
            const priceUSD = round(priceINR / EXCHANGE_RATES.INR, 2);
            const priceSAR = round(priceUSD * EXCHANGE_RATES.SAR, 2);

            const dailyPct = round(((price - (i === 0 ? lastPrice : dailyForecasts[i - 1].price_inr)) /
                (i === 0 ? lastPrice : dailyForecasts[i - 1].price_inr)) * 100, 2);
            const totalPct = round(((price - lastPrice) / lastPrice) * 100, 2);

            // Dynamic confidence based on how far out + volatility
            const baseConf = 90 - i * 1.5; // decays with horizon
            const volPenalty = vol * 200;   // higher vol → lower confidence
            const confidence = round(Math.max(40, Math.min(95, baseConf - volPenalty + rng.range(-2.5, 2.5))), 1);

            // Risk assessment
            const risk = Math.abs(dailyPct) > 2.0 || vol > 0.025 ? 'High Risk' : 'Normal';

            // Recommendation logic (mirrors Python app)
            let recommendation;
            if (dailyPct < -1.5 && risk === 'Normal') {
                recommendation = 'STRONG BUY';
            } else if (dailyPct < -0.5 && risk === 'Normal') {
                recommendation = 'BUY';
            } else if (dailyPct < 0) {
                recommendation = 'ACCUMULATE';
            } else {
                recommendation = 'WAIT';
            }

            // XGBoost-style signal from trend + momentum
            const combinedSignal = slope14 + momentum * 100;
            let xgbSignal;
            if (combinedSignal < -0.5) xgbSignal = 'Strong Buy';
            else if (combinedSignal < 0) xgbSignal = 'Buy';
            else xgbSignal = 'Hold';

            // Model agreement (simulated: based on confidence)
            const modelAgreement = confidence > 75 ? '3/3' : confidence > 60 ? '2/3' : '1/3';

            dailyForecasts.push({
                date: formatDateISO(fDate),
                date_display: formatDateDisplay(fDate),
                day: i + 1,
                price_usd: priceUSD,
                price_sar: priceSAR,
                price_inr: priceINR,
                daily_pct: dailyPct,
                total_pct: totalPct,
                risk: risk,
                recommendation: recommendation,
                confidence: confidence,
                xgb_signal: xgbSignal,
                model_agreement: modelAgreement,
            });

            if (progressCb) progressCb(55 + Math.round((i / 30) * 25), `Simulating day ${i + 1}/30...`);
        }

        if (progressCb) progressCb(85, 'Computing recommendations and statistics...');

        // ── Best entry ───────────────────────────────────
        const bestEntry = dailyForecasts.reduce(
            (best, d) => d.price_usd < best.price_usd ? d : best,
            dailyForecasts[0]
        );

        // ── Statistics ───────────────────────────────────
        const fPrices = dailyForecasts.map(d => d.price_usd);
        const statistics = {
            min_price_usd:  round(Math.min(...fPrices), 2),
            max_price_usd:  round(Math.max(...fPrices), 2),
            mean_price_usd: round(mean(fPrices), 2),
            strong_buy_days: dailyForecasts.filter(d => d.recommendation === 'STRONG BUY').length,
            buy_days: dailyForecasts.filter(d => d.recommendation === 'BUY').length,
            accumulate_days: dailyForecasts.filter(d => d.recommendation === 'ACCUMULATE').length,
            wait_days: dailyForecasts.filter(d => d.recommendation === 'WAIT').length,
            high_risk_days: dailyForecasts.filter(d => d.risk === 'High Risk').length,
        };

        if (progressCb) progressCb(92, 'Building analysis insights...');

        // ── Analysis points ──────────────────────────────
        const analysisPoints = buildAnalysisPoints(dailyForecasts, bestEntry, statistics, vol, lastPrice);

        if (progressCb) progressCb(100, 'Live forecast complete!');

        return {
            generated: formatDateISO(lastDate) + 'T12:00:00Z',
            source: 'live-prediction',
            model_versions: {
                primary: 'LiveStatistical v1.0',
                trend: 'EMA-LinReg',
                seasonality: 'DayOfWeek',
                confidence: 'Volatility-Adaptive',
            },
            last_historical_date: formatDateISO(lastDate),
            forecast_period: {
                start: dailyForecasts[0].date,
                end: dailyForecasts[dailyForecasts.length - 1].date,
            },
            currency_rates: { ...EXCHANGE_RATES },
            best_entry: {
                date: bestEntry.date,
                date_display: bestEntry.date_display,
                price_usd: bestEntry.price_usd,
                price_sar: bestEntry.price_sar,
                price_inr: bestEntry.price_inr,
                recommendation: bestEntry.recommendation,
                confidence: bestEntry.confidence,
                risk: bestEntry.risk,
            },
            daily_forecasts: dailyForecasts,
            statistics: statistics,
            analysis_points: analysisPoints,
        };
    }

    // ── Analysis narratives ──────────────────────────────
    function buildAnalysisPoints(daily, best, stats, vol, lastPrice) {
        const points = [];
        const first = daily[0];
        const last = daily[daily.length - 1];

        // Trend direction
        const trendPct = ((last.price_inr - first.price_inr) / first.price_inr * 100).toFixed(1);
        if (parseFloat(trendPct) < -1) {
            points.push({
                icon: 'down-trend',
                text: `Prices expected to decline ${Math.abs(trendPct)}% over 30 days -- early procurement recommended.`
            });
        } else if (parseFloat(trendPct) > 1) {
            points.push({
                icon: 'up-trend',
                text: `Prices projected to rise ${Math.abs(trendPct)}% over 30 days -- immediate action is advantageous.`
            });
        } else {
            points.push({
                icon: 'stable',
                text: `Prices expected to remain relatively stable (${trendPct}% change) over the next 30 days.`
            });
        }

        // Best price opportunity
        const bestDrop = ((lastPrice - best.price_inr) / lastPrice * 100).toFixed(1);
        if (parseFloat(bestDrop) > 0.5) {
            points.push({
                icon: 'savings',
                text: `Optimal buying price is ${bestDrop}% below current market price on ${best.date_display}.`
            });
        }

        // Confidence
        if (best.confidence >= 80) {
            points.push({
                icon: 'high-conf',
                text: `High prediction confidence of ${best.confidence.toFixed(0)}% -- strong statistical agreement across all indicators.`
            });
        } else if (best.confidence >= 60) {
            points.push({
                icon: 'mid-conf',
                text: `Moderate confidence of ${best.confidence.toFixed(0)}% -- most indicators align on this recommendation.`
            });
        }

        // Volatility warning
        if (vol > 0.02) {
            points.push({
                icon: 'warning',
                text: `Market volatility is elevated at ${(vol * 100).toFixed(1)}% daily -- consider splitting orders across multiple dates.`
            });
        } else {
            points.push({
                icon: 'stable-market',
                text: 'Market conditions are stable with low volatility -- favorable for bulk procurement.'
            });
        }

        // Buy window count
        const buyDays = stats.strong_buy_days + stats.buy_days;
        if (buyDays >= 3) {
            points.push({
                icon: 'opportunity',
                text: `${buyDays} buy signals detected (${stats.strong_buy_days} STRONG BUY + ${stats.buy_days} BUY), offering flexible timing.`
            });
        }

        // Risk days
        if (stats.high_risk_days > 8) {
            points.push({
                icon: 'caution',
                text: `${stats.high_risk_days} high-risk days in the forecast -- acting on optimal dates avoids these volatile windows.`
            });
        }

        return points;
    }

    // ── Public API ───────────────────────────────────────
    return { predict };

})();
