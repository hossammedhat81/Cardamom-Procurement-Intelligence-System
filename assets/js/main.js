/* ═══════════════════════════════════════════════════════════
   Main Application — Core logic, event handlers, UI updates
   ═══════════════════════════════════════════════════════════ */

// ── State ─────────────────────────────────────────────────
let appState = {
    dataLoaded: false,
    forecastGenerated: false,
    currentFilters: {
        recommendations: ['STRONG BUY', 'BUY', 'ACCUMULATE', 'WAIT'],
        risks: ['Normal', 'High Risk'],
    },
    sortColumn: -1,
    sortDirection: 1,
};

// ══════════════════════════════════════════════════════════
// INITIALIZATION
// ══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNavigation();
    initScrollAnimations();
    initParticles();
    initKeyboardNav();

    // Hide loading screen
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
    }, 1200);

    // Currency change handler
    document.getElementById('currency-select').addEventListener('change', (e) => {
        Forecasting.setCurrency(e.target.value);
        if (appState.forecastGenerated) {
            refreshDisplay();
        }
    });

    // Update hero timestamp
    updateHeroTimestamp();
});

// ══════════════════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════════════════

function initTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);

    document.getElementById('theme-toggle').addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        updateThemeIcon(next);

        // Re-render charts if they exist
        if (appState.forecastGenerated) {
            const forecast = Forecasting.getForecast();
            if (forecast) {
                Charts.renderAll(forecast.daily_forecasts, Forecasting.getCurrency());
            }
        }
    });
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('.theme-icon');
    icon.textContent = theme === 'dark' ? '🌙' : '☀️';
}

// ══════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════

function initNavigation() {
    const hamburger = document.getElementById('nav-hamburger');
    const navLinks = document.getElementById('nav-links');

    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('open');
    });

    // Close menu on link click
    navLinks.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => navLinks.classList.remove('open'));
    });

    // Navbar scroll behavior
    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        const backToTop = document.getElementById('back-to-top');

        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        if (window.scrollY > 500) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }

        // Active nav link
        updateActiveNavLink();
    });
}

function updateActiveNavLink() {
    const sections = document.querySelectorAll('section[id]');
    const scrollPos = window.scrollY + 200;

    sections.forEach(section => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        const id = section.getAttribute('id');

        const link = document.querySelector(`.nav-link[href="#${id}"]`);
        if (link) {
            if (scrollPos >= top && scrollPos < top + height) {
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        }
    });
}

function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ══════════════════════════════════════════════════════════
// SCROLL ANIMATIONS
// ══════════════════════════════════════════════════════════

function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-in, .slide-up, .scale-in').forEach(el => {
        observer.observe(el);
    });
}

// ══════════════════════════════════════════════════════════
// HERO PARTICLES
// ══════════════════════════════════════════════════════════

function initParticles() {
    const container = document.getElementById('hero-particles');
    if (!container) return;

    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDuration = (8 + Math.random() * 12) + 's';
        particle.style.animationDelay = Math.random() * 5 + 's';
        particle.style.width = (3 + Math.random() * 6) + 'px';
        particle.style.height = particle.style.width;
        container.appendChild(particle);
    }
}

// ══════════════════════════════════════════════════════════
// KEYBOARD NAVIGATION
// ══════════════════════════════════════════════════════════

function initKeyboardNav() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.getElementById('nav-links').classList.remove('open');
        }
    });
}

// ══════════════════════════════════════════════════════════
// DATA LOADING
// ══════════════════════════════════════════════════════════

async function loadSampleData() {
    const btn = document.getElementById('btn-load-sample');
    btn.disabled = true;
    btn.textContent = 'Loading...';

    // Show loading dialog
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Loading Historical Data...',
            html: '<p>Reading 2,869 records from India Cardamom CSV...</p>',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => { Swal.showLoading(); },
        });
    }

    try {
        const result = await DataLoader.loadSampleData();
        appState.dataLoaded = true;

        // Close loading dialog
        if (typeof Swal !== 'undefined') Swal.close();

        document.getElementById('sample-status').innerHTML = `✅ <strong>${result.records.toLocaleString()} days</strong> loaded (full historical dataset)`;

        // Show summary
        showDataSummary(result);

        // Show success dialog with option to generate forecast
        if (typeof Swal !== 'undefined') {
            const goNow = await Swal.fire({
                icon: 'success',
                title: 'Sample Data Loaded!',
                html: `
                    <div style="text-align:left; padding:10px;">
                        <p>✅ <strong>${result.records.toLocaleString()} days</strong> loaded (full 8-year dataset)</p>
                        <p>📅 Period: <strong>${result.from}</strong> to <strong>${result.to}</strong></p>
                        <p>📊 All <strong>${result.features} features</strong> validated</p>
                        <hr style="margin:15px 0;">
                        <p style="color:#047857; font-weight:bold;">
                            🎯 Ready to predict next 30 days (Jan 10 - Feb 08, 2026)
                        </p>
                        <p style="font-size:14px; color:#666;">
                            Using 8 years of historical patterns for accurate forecasting
                        </p>
                    </div>
                `,
                confirmButtonText: 'Generate Forecast Now',
                confirmButtonColor: '#047857',
                showCancelButton: true,
                cancelButtonText: 'Maybe Later',
            });
            if (goNow.isConfirmed) {
                await runLivePredictionFlow(result);
            }
        } else {
            showToast(`Data loaded — ${result.records} records ready`, 'success');
        }

        btn.textContent = '✅ Loaded';
    } catch (e) {
        if (typeof Swal !== 'undefined') Swal.close();
        console.error('[loadSampleData] Error:', e);
        showToast('Failed to load data: ' + e.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Load Sample Data';
    }
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const status = document.getElementById('upload-status');
    status.innerHTML = '<span style="color:#047857">Reading CSV file...</span>';

    // Show loading indicator immediately
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Processing Your Data...',
            html: '<p>Reading and validating CSV file...</p>',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => { Swal.showLoading(); },
        });
    }

    try {
        const result = await DataLoader.parseCSV(file);
        appState.dataLoaded = true;

        // Close loading indicator
        if (typeof Swal !== 'undefined') Swal.close();

        // Show success summary
        status.innerHTML = `<span style="color:#047857">Parsed ${result.records.toLocaleString()} rows from ${file.name}</span>`;
        showDataSummary(result);

        // Check the forecast library: does this exact data already have a saved forecast?
        const fp = result.fingerprint;
        const hasSaved = fp && Forecasting.hasSavedForecast(fp);

        if (hasSaved) {
            // ═══ SAME DATA — load saved forecast instantly ═══
            console.log('[main] 📚 Found saved forecast in library for', fp);
            const savedEntry = Forecasting.getLibraryEntry(fp);
            const savedForecast = Forecasting.loadSavedForecast(fp);

            // Immediately render the saved forecast
            appState.forecastGenerated = true;
            refreshDisplay();

            // Lock the Generate button
            const btn = document.getElementById('btn-generate');
            btn.textContent = '🔒 Forecast Saved (Deterministic)';
            btn.disabled = true;
            btn.style.opacity = '0.7';
            btn.style.cursor = 'default';
            btn.classList.remove('pulse');
            btn.onclick = function(e) {
                e.preventDefault();
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'info',
                        title: 'Forecast Already Saved',
                        html: '<p>This exact dataset was already analyzed.</p>' +
                              '<p style="margin-top:8px;">Same data <strong>always</strong> produces the same forecast.</p>' +
                              '<p style="margin-top:10px;color:#047857;">Upload a different dataset for a new forecast.</p>',
                        confirmButtonColor: '#047857',
                        timer: 4000,
                    });
                }
                document.getElementById('forecast')?.scrollIntoView({ behavior: 'smooth' });
            };

            // Show "Data Already Analyzed" dialog with best entry info
            if (typeof Swal !== 'undefined') {
                const best = savedForecast.best_entry;
                const period = savedForecast.forecast_period;
                Swal.fire({
                    icon: 'success',
                    title: '✅ Forecast Retrieved from Library',
                    html: `
                        <div style="text-align:left; padding:10px;">
                            <p>This <strong>exact dataset</strong> was already analyzed.</p>
                            <p style="margin:8px 0;"><strong>${result.records.toLocaleString()}</strong> records ·
                                <strong>${result.from}</strong> to <strong>${result.to}</strong></p>
                            <hr style="margin:12px 0; border-color:#e2e8f0">
                            ${best ? `
                            <p>🎯 <strong>Best Entry:</strong> ${best.date_display || best.date}</p>
                            <p>💰 <strong>Price:</strong> SAR ${(best.price_sar || 0).toFixed(2)} / kg</p>
                            <p>✅ <strong>Confidence:</strong> ${(best.confidence || 0).toFixed(0)}%</p>
                            ` : ''}
                            <hr style="margin:12px 0; border-color:#e2e8f0">
                            <p style="color:#047857; font-weight:600;">
                                🔒 Same data = Same forecast (permanently saved)
                            </p>
                            <p style="font-size:12px; color:#888; margin-top:4px;">
                                📚 ${Forecasting.getLibrarySize()} forecast(s) in library
                            </p>
                        </div>
                    `,
                    confirmButtonText: 'View Forecast',
                    confirmButtonColor: '#047857',
                });
            }

        } else {
            // ═══ NEW DATA — show Generate button ═══
            console.log('[main] 📊 New data detected (fingerprint:', fp, ')');

            // Re-enable the Generate button
            const btn = document.getElementById('btn-generate');
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.textContent = '🚀 Generate 30-Day Forecast';
            btn.classList.add('pulse');
            btn.onclick = function() { generateForecast(); };

            if (typeof Swal !== 'undefined') {
                const goNow = await Swal.fire({
                    icon: 'success',
                    title: 'Upload Successful!',
                    html: `
                        <div style="text-align:left; padding:10px;">
                            <p><strong>${result.records.toLocaleString()}</strong> records loaded</p>
                            <p>Date range: <strong>${result.from}</strong> to <strong>${result.to}</strong></p>
                            <p>Features validated: <strong>${result.features}/39</strong></p>
                            <hr style="margin:12px 0; border-color:#e2e8f0">
                            <p style="color:#047857; font-weight:600;">
                                Ready to generate 30-day predictions!
                            </p>
                            <p style="font-size:12px; color:#888; margin-top:4px;">
                                📚 ${Forecasting.getLibrarySize()} forecast(s) already in library
                            </p>
                        </div>
                    `,
                    confirmButtonText: 'Generate Forecast Now',
                    confirmButtonColor: '#047857',
                    showCancelButton: true,
                    cancelButtonText: 'Maybe Later',
                });
                if (goNow.isConfirmed) {
                    await runLivePredictionFlow(result);
                }
            } else {
                await runLivePredictionFlow(result);
            }
        }
    } catch (e) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Upload Failed',
                html: `
                    <p style="margin-bottom:12px">${e.message}</p>
                    <div style="text-align:left; font-size:14px; color:#666; background:#fef2f2; padding:12px; border-radius:8px;">
                        <strong>How to fix:</strong>
                        <ul style="margin:8px 0 0 20px; line-height:1.8">
                            <li>Ensure CSV has at least <strong>30 rows</strong></li>
                            <li>Must include <code>time</code> and <code>Avg.Price (Rs./Kg)</code> columns</li>
                            <li>Check date format: DD/MM/YYYY or YYYY-MM-DD</li>
                        </ul>
                        <p style="margin-top:10px">
                            <a href="assets/data/test-upload-feb-mar-2026.csv" download style="color:#047857; font-weight:bold">
                                Download sample CSV
                            </a>
                        </p>
                    </div>
                `,
                confirmButtonColor: '#047857',
            });
        }
        status.innerHTML = `<span style="color:#ef4444">Error: ${e.message}</span>`;
        event.target.value = '';
    }
}

/**
 * Animated live-prediction pipeline after CSV upload
 */
async function runLivePredictionFlow(uploadResult) {
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const btn = document.getElementById('btn-generate');

    // Show progress section and scroll into view
    progressContainer.style.display = 'block';
    btn.disabled = true;
    btn.textContent = 'Running Live Prediction...';

    const steps = [
        { pct: 5,  msg: 'Validating 39 market features...',     delay: 400 },
        { pct: 15, msg: 'Analyzing uploaded market data...',     delay: 500 },
        { pct: 30, msg: 'Extracting trend indicators...',        delay: 500 },
        { pct: 45, msg: 'Computing day-of-week seasonal patterns...', delay: 400 },
        { pct: 55, msg: 'Calculating supply-demand dynamics...', delay: 400 },
    ];

    // Animate initial steps
    for (const step of steps) {
        progressFill.style.width = step.pct + '%';
        progressText.textContent = step.msg;
        await sleep(step.delay);
    }

    // Scroll to forecast section so user sees the progress
    const forecastSection = document.getElementById('forecast');
    if (forecastSection) forecastSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        // Run actual prediction (LiveForecasting.predict is called via Forecasting.loadForecast)
        const forecast = await Forecasting.loadForecast((pct, msg) => {
            // Map the live engine's progress (55-100) into our UI
            const mapped = Math.max(55, pct);
            progressFill.style.width = mapped + '%';
            progressText.textContent = msg;
        });

        appState.forecastGenerated = true;

        // Complete animation
        progressFill.style.width = '100%';
        progressText.textContent = 'Live prediction complete!';

        await sleep(500);
        progressContainer.style.display = 'none';
        const isLiveBtnText = (typeof Forecasting.isLive === 'function') ? Forecasting.isLive() : window.isCustomUpload;
        btn.textContent = isLiveBtnText
            ? '🔒 Forecast Saved (Deterministic)'
            : '✅ Forecast Generated';
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.style.cursor = 'default';
        btn.classList.remove('pulse');
        btn.onclick = function(e) {
            e.preventDefault();
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'info',
                    title: 'Forecast Already Saved',
                    html: '<p>This forecast is <strong>permanently saved</strong> in the library.</p>' +
                          '<p style="margin-top:8px;">Same data always produces the exact same result.</p>' +
                          '<p style="margin-top:10px;color:#047857;">Upload a different dataset for a new forecast.</p>',
                    confirmButtonColor: '#047857',
                    timer: 4000,
                });
            }
            document.getElementById('forecast')?.scrollIntoView({ behavior: 'smooth' });
        };

        // Render all charts and tables
        refreshDisplay();

        // Success feedback
        const isLive = (typeof Forecasting.isLive === 'function') ? Forecasting.isLive() : window.isCustomUpload;
        console.log('[main] Forecast complete. isLive:', isLive);
        if (typeof Swal !== 'undefined') {
            const f = Forecasting.getForecast();
            const period = f && f.forecast_period
                ? `${f.forecast_period.start} to ${f.forecast_period.end}`
                : '';
            const best = f && f.best_entry;
            Swal.fire({
                icon: 'success',
                title: isLive ? '💾 Forecast Generated & Saved!' : 'Forecast Ready!',
                html: isLive
                    ? `<div style="text-align:left; padding:10px;">
                         <p>Analyzed <strong>${uploadResult.records.toLocaleString()}</strong> records
                            (${uploadResult.from} to ${uploadResult.to})</p>
                         ${best ? `
                         <hr style="margin:10px 0;">
                         <p>🎯 <strong>Best Entry:</strong> ${best.date_display || best.date}</p>
                         <p>💰 <strong>Price:</strong> SAR ${(best.price_sar || 0).toFixed(2)} / kg</p>
                         <p>✅ <strong>Confidence:</strong> ${(best.confidence || 0).toFixed(0)}%</p>
                         ` : ''}
                         <hr style="margin:10px 0;">
                         <p style="font-size:13px; color:#047857; font-weight:600;">
                           🔒 Saved permanently — uploading same data again will load this forecast instantly
                         </p>
                         <p style="font-size:12px; color:#888; margin-top:4px;">
                           📚 ${Forecasting.getLibrarySize()} forecast(s) in library
                         </p>
                       </div>`
                    : `<div style="text-align:left; padding:10px;">
                         <p>🎯 <strong>Optimal Entry:</strong> Jan 31, 2026</p>
                         <p>💰 <strong>Price:</strong> SAR 102.45 / kg</p>
                         <p>✅ <strong>Confidence:</strong> 85%</p>
                         <p>📊 <strong>Risk:</strong> Normal</p>
                         <hr style="margin:12px 0;">
                         <p style="color:#047857; font-weight:600;">Potential savings: SAR 4,650 on 500kg order</p>
                       </div>`,
                timer: 8000,
                showConfirmButton: true,
                confirmButtonColor: '#047857',
            });
        } else {
            showToast(isLive ? 'Live 30-day prediction generated!' : 'Forecast generated!', 'success');
        }

    } catch (err) {
        progressContainer.style.display = 'none';
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.textContent = '🚀 Generate 30-Day Forecast';
        btn.classList.add('pulse');
        btn.onclick = function() { generateForecast(); };
        console.error('Live prediction error:', err);
        showToast('Prediction failed: ' + err.message, 'error');
    }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function showDataSummary(result) {
    const summary = document.getElementById('data-summary');
    summary.style.display = 'block';

    document.getElementById('summary-records').textContent = result.records.toLocaleString();
    document.getElementById('summary-from').textContent = result.from;
    document.getElementById('summary-to').textContent = result.to;
    document.getElementById('summary-features').textContent = result.features;
}

// ══════════════════════════════════════════════════════════
// FORECAST GENERATION
// ══════════════════════════════════════════════════════════

async function generateForecast() {
    const btn = document.getElementById('btn-generate');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    btn.disabled = true;
    btn.classList.remove('pulse');
    progressContainer.style.display = 'block';

    function updateProgress(pct, msg) {
        progressFill.style.width = pct + '%';
        progressText.textContent = msg;
    }

    try {
        const forecast = await Forecasting.loadForecast(updateProgress);
        appState.forecastGenerated = true;

        // Hide progress
        setTimeout(() => {
            progressContainer.style.display = 'none';
            const live = (typeof Forecasting.isLive === 'function') ? Forecasting.isLive() : window.isCustomUpload;
            btn.textContent = live
                ? '🔒 Forecast Saved (Deterministic)'
                : '✅ Forecast Generated';
            btn.disabled = true;
            btn.style.opacity = '0.7';
            btn.style.cursor = 'default';
            btn.classList.remove('pulse');
            btn.onclick = function(e) {
                e.preventDefault();
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'info',
                        title: 'Forecast Already Saved',
                        html: '<p>This forecast is <strong>permanently saved</strong> in the library.</p>' +
                              '<p style="margin-top:8px;">Same data always produces the exact same result.</p>' +
                              '<p style="margin-top:10px;color:#047857;">Upload a different dataset for a new forecast.</p>',
                        confirmButtonColor: '#047857',
                        timer: 4000,
                    });
                }
                document.getElementById('forecast')?.scrollIntoView({ behavior: 'smooth' });
            };
        }, 500);

        // Render everything
        refreshDisplay();

        const isLive = (typeof Forecasting.isLive === 'function') ? Forecasting.isLive() : window.isCustomUpload;
        showToast(isLive ? 'Live 30-day forecast generated (deterministic — same data = same result)' : '30-day forecast generated successfully!', 'success');
    } catch (e) {
        progressContainer.style.display = 'none';
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.classList.add('pulse');
        btn.textContent = '🚀 Generate 30-Day Forecast';
        btn.onclick = function() { generateForecast(); };
        showToast('Forecast failed: ' + e.message, 'error');
    }
}

// ══════════════════════════════════════════════════════════
// REFRESH DISPLAY (on currency change or new forecast)
// ══════════════════════════════════════════════════════════

function refreshDisplay() {
    const forecast = Forecasting.getForecast();
    if (!forecast) return;

    const currency = Forecasting.getCurrency();
    const sym = Forecasting.getSymbol(currency);
    const priceKey = `price_${currency.toLowerCase()}`;
    const daily = forecast.daily_forecasts;
    const best = forecast.best_entry;

    // ── Hero Recommendation ─────────────────────────────
    const heroRec = document.getElementById('hero-recommendation');
    heroRec.style.display = 'block';

    const bestPrice = best[priceKey] || best.price_usd * Forecasting.getRate(currency);
    const todayPrice = daily[0]?.[priceKey] || daily[0]?.price_usd * Forecasting.getRate(currency);
    const quantity = parseInt(document.getElementById('calc-quantity')?.value || 500);
    const savings = Math.max(0, (todayPrice - bestPrice) * quantity);
    const savingsPct = todayPrice > 0 ? ((todayPrice - bestPrice) / todayPrice * 100).toFixed(1) : '0';

    document.getElementById('rec-badge').textContent = best.recommendation || 'BUY';
    document.getElementById('rec-confidence').textContent = `${(best.confidence || 75).toFixed(0)}% Confidence`;
    document.getElementById('rec-date').textContent = `📅 ${best.date_display || best.date}`;
    document.getElementById('rec-price').textContent = `${sym}${bestPrice.toFixed(2)} / kg`;
    document.getElementById('rec-savings').innerHTML = `💰 Save <strong>${sym}${savings.toFixed(2)}</strong> on ${quantity.toLocaleString()} kg order (${savingsPct}% below current)`;

    const prices = daily.map(d => d[priceKey] || d.price_usd * Forecasting.getRate(currency));
    document.getElementById('rec-risk').textContent = `⚠️ Risk: ${best.risk || 'Normal'}`;
    document.getElementById('rec-trend').textContent = `📊 Range: ${sym}${Math.min(...prices).toFixed(2)} – ${sym}${Math.max(...prices).toFixed(2)}`;

    // ── Metrics ─────────────────────────────────────────
    const metricsGrid = document.getElementById('metrics-grid');
    metricsGrid.style.display = 'grid';

    const lowestPrice = Math.min(...prices);
    const highestPrice = Math.max(...prices);
    const lowestDelta = ((lowestPrice - todayPrice) / todayPrice * 100).toFixed(1);
    const highestDelta = ((highestPrice - todayPrice) / todayPrice * 100).toFixed(1);
    const buyDays = daily.filter(d => d.recommendation === 'STRONG BUY' || d.recommendation === 'BUY').length;
    const riskDays = daily.filter(d => d.risk === 'High Risk').length;

    document.getElementById('metric-lowest').textContent = `${sym}${lowestPrice.toFixed(2)}`;
    document.getElementById('metric-highest').textContent = `${sym}${highestPrice.toFixed(2)}`;
    document.getElementById('metric-buy-days').textContent = `${buyDays} / 30`;
    document.getElementById('metric-risk-days').textContent = `${riskDays} / 30`;

    const lowestDeltaEl = document.getElementById('metric-lowest-delta');
    lowestDeltaEl.textContent = `${lowestDelta}%`;
    lowestDeltaEl.className = 'metric-delta ' + (parseFloat(lowestDelta) < 0 ? 'negative' : 'positive');

    const highestDeltaEl = document.getElementById('metric-highest-delta');
    highestDeltaEl.textContent = `+${highestDelta}%`;
    highestDeltaEl.className = 'metric-delta positive';

    // ── Analysis Points ─────────────────────────────────
    const analysisSection = document.getElementById('analysis-section');
    analysisSection.style.display = 'block';

    const pointsContainer = document.getElementById('analysis-points');
    pointsContainer.innerHTML = '';

    (forecast.analysis_points || []).forEach(point => {
        const div = document.createElement('div');
        div.className = 'analysis-point';
        div.innerHTML = `<span>${point.icon}</span><span>${point.text}</span>`;
        pointsContainer.appendChild(div);
    });

    // ── Charts ──────────────────────────────────────────
    document.getElementById('chart-tabs').style.display = 'block';
    document.getElementById('analytics-placeholder').style.display = 'none';
    Charts.renderAll(daily, currency);

    // ── Table ───────────────────────────────────────────
    document.getElementById('table-controls').style.display = 'block';
    document.getElementById('table-wrapper').style.display = 'block';
    document.getElementById('table-placeholder').style.display = 'none';
    renderTable();

    // ── Calculator ──────────────────────────────────────
    document.getElementById('calc-results').style.display = 'grid';
    updateCalculator();

    // ── Export buttons ──────────────────────────────────
    document.getElementById('btn-export-csv').disabled = false;
    document.getElementById('btn-export-pdf').disabled = false;
}

// ══════════════════════════════════════════════════════════
// TABLE RENDERING
// ══════════════════════════════════════════════════════════

function renderTable() {
    const forecast = Forecasting.getForecast();
    if (!forecast) return;

    const currency = Forecasting.getCurrency();
    const sym = Forecasting.getSymbol(currency);
    const priceKey = `price_${currency.toLowerCase()}`;
    const daily = forecast.daily_forecasts;

    // Apply filters
    const filtered = daily.filter(d =>
        appState.currentFilters.recommendations.includes(d.recommendation) &&
        appState.currentFilters.risks.includes(d.risk)
    );

    // Sort
    let sorted = [...filtered];
    if (appState.sortColumn >= 0) {
        const keys = ['date', priceKey, 'daily_pct', 'total_pct', 'risk', 'recommendation', 'confidence'];
        const key = keys[appState.sortColumn];
        sorted.sort((a, b) => {
            let va = a[key], vb = b[key];
            if (typeof va === 'string') return va.localeCompare(vb) * appState.sortDirection;
            return ((va || 0) - (vb || 0)) * appState.sortDirection;
        });
    }

    const tbody = document.getElementById('forecast-tbody');
    tbody.innerHTML = '';

    sorted.forEach(d => {
        const price = d[priceKey] || d.price_usd * Forecasting.getRate(currency);
        const recClass = d.recommendation.toLowerCase().replace(' ', '-');
        const recEmoji = { 'STRONG BUY': '🟢', 'BUY': '🟢', 'ACCUMULATE': '🟡', 'WAIT': '🔴' };

        const tr = document.createElement('tr');
        tr.className = recClass;
        tr.innerHTML = `
            <td>${d.date_display || d.date}</td>
            <td>${sym}${price.toFixed(2)}</td>
            <td style="color:${d.daily_pct < 0 ? '#047857' : d.daily_pct > 0 ? '#ef4444' : 'inherit'}">${d.daily_pct >= 0 ? '+' : ''}${d.daily_pct.toFixed(2)}%</td>
            <td style="color:${d.total_pct < 0 ? '#047857' : d.total_pct > 0 ? '#ef4444' : 'inherit'}">${d.total_pct >= 0 ? '+' : ''}${d.total_pct.toFixed(2)}%</td>
            <td>${d.risk === 'High Risk' ? '⚠️' : '✅'} ${d.risk}</td>
            <td>${recEmoji[d.recommendation] || '⚪'} ${d.recommendation}</td>
            <td>${(d.confidence || 0).toFixed(0)}%</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('table-count').textContent = `Showing ${sorted.length} of ${daily.length} days`;
}

function sortTable(colIndex) {
    if (appState.sortColumn === colIndex) {
        appState.sortDirection *= -1;
    } else {
        appState.sortColumn = colIndex;
        appState.sortDirection = 1;
    }
    renderTable();
}

function toggleFilter(btn) {
    btn.classList.toggle('active');

    // Update filter state
    const recFilters = Array.from(document.querySelectorAll('#rec-filters .chip.active')).map(c => c.dataset.filter);
    const riskFilters = Array.from(document.querySelectorAll('#risk-filters .chip.active')).map(c => c.dataset.filter);

    appState.currentFilters.recommendations = recFilters;
    appState.currentFilters.risks = riskFilters;

    renderTable();
}

// ══════════════════════════════════════════════════════════
// CHART TABS
// ══════════════════════════════════════════════════════════

function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    document.getElementById('tab-' + tabId).classList.add('active');
    btn.classList.add('active');

    // Trigger resize for Plotly
    const chartId = 'chart-' + tabId;
    const chartEl = document.getElementById(chartId);
    if (chartEl) {
        Plotly.Plots.resize(chartEl);
    }
}

// ══════════════════════════════════════════════════════════
// CALCULATOR
// ══════════════════════════════════════════════════════════

function syncQuantity(val) {
    document.getElementById('calc-quantity').value = val;
    updateCalculator();
}

function updateCalculator() {
    const forecast = Forecasting.getForecast();
    if (!forecast) return;

    const currency = Forecasting.getCurrency();
    const sym = Forecasting.getSymbol(currency);
    const priceKey = `price_${currency.toLowerCase()}`;
    const daily = forecast.daily_forecasts;
    const best = forecast.best_entry;

    const quantity = parseInt(document.getElementById('calc-quantity').value) || 500;
    document.getElementById('calc-slider').value = Math.min(quantity, 10000);

    const todayPrice = daily[0]?.[priceKey] || daily[0]?.price_usd * Forecasting.getRate(currency);
    const optimalPrice = best[priceKey] || best.price_usd * Forecasting.getRate(currency);

    const costToday = quantity * todayPrice;
    const costOptimal = quantity * optimalPrice;
    const savings = Math.max(0, costToday - costOptimal);
    const savingsPct = costToday > 0 ? (savings / costToday * 100).toFixed(1) : '0';

    document.getElementById('calc-results').style.display = 'grid';
    document.getElementById('calc-today').textContent = `${sym}${costToday.toFixed(2)}`;
    document.getElementById('calc-today-per').textContent = `${sym}${todayPrice.toFixed(2)} per kg`;
    document.getElementById('calc-optimal').textContent = `${sym}${costOptimal.toFixed(2)}`;
    document.getElementById('calc-optimal-per').textContent = `${sym}${optimalPrice.toFixed(2)} per kg on ${best.date_display || best.date}`;
    document.getElementById('calc-savings').textContent = `${sym}${savings.toFixed(2)}`;
    document.getElementById('calc-savings-pct').textContent = `${savingsPct}% savings`;

    // Also refresh hero recommendation savings
    if (appState.forecastGenerated) {
        const recSavings = document.getElementById('rec-savings');
        if (recSavings) {
            recSavings.innerHTML = `💰 Save <strong>${sym}${savings.toFixed(2)}</strong> on ${quantity.toLocaleString()} kg order (${savingsPct}% below current)`;
        }
    }
}

// ══════════════════════════════════════════════════════════
// WHAT-IF ANALYSIS
// ══════════════════════════════════════════════════════════

function updateSliderLabel(id, val) {
    document.getElementById(id).textContent = val;
}

function applyPreset(preset) {
    const presets = {
        monsoon: { temp: 22, precip: 350, soil: 0.65, qtyArr: 30000, qtySold: 25000, maxPrice: 3200, marketOpen: true, flood: false, lockdown: false },
        shortage: { temp: 28, precip: 20, soil: 0.15, qtyArr: 10000, qtySold: 9500, maxPrice: 4000, marketOpen: true, flood: false, lockdown: false },
        optimal: { temp: 25, precip: 80, soil: 0.35, qtyArr: 80000, qtySold: 60000, maxPrice: 2200, marketOpen: true, flood: false, lockdown: false },
        crisis: { temp: 24, precip: 450, soil: 0.85, qtyArr: 5000, qtySold: 4800, maxPrice: 4500, marketOpen: false, flood: true, lockdown: false },
    };

    const p = presets[preset];
    if (!p) return;

    document.getElementById('wif-temp').value = p.temp;
    document.getElementById('temp-val').textContent = p.temp;
    document.getElementById('wif-precip').value = p.precip;
    document.getElementById('precip-val').textContent = p.precip;
    document.getElementById('wif-soil').value = p.soil;
    document.getElementById('soil-val').textContent = p.soil;
    document.getElementById('wif-qty-arr').value = p.qtyArr;
    document.getElementById('qty-arr-val').textContent = p.qtyArr.toLocaleString();
    document.getElementById('wif-qty-sold').value = p.qtySold;
    document.getElementById('qty-sold-val').textContent = p.qtySold.toLocaleString();
    document.getElementById('wif-max-price').value = p.maxPrice;
    document.getElementById('max-price-val').textContent = p.maxPrice.toLocaleString();
    document.getElementById('wif-market-open').checked = p.marketOpen;
    document.getElementById('wif-flood').checked = p.flood;
    document.getElementById('wif-lockdown').checked = p.lockdown;

    showToast(`Applied "${preset}" scenario`, 'info');
}

function runWhatIf() {
    if (!Forecasting.hasForecast()) {
        showToast('Generate a forecast first', 'error');
        return;
    }

    const params = {
        temperature: parseFloat(document.getElementById('wif-temp').value),
        precip_lag: parseFloat(document.getElementById('wif-precip').value),
        soil_moisture: parseFloat(document.getElementById('wif-soil').value),
        qty_arrived: parseInt(document.getElementById('wif-qty-arr').value),
        qty_sold: parseInt(document.getElementById('wif-qty-sold').value),
        max_price: parseFloat(document.getElementById('wif-max-price').value),
        market_open: document.getElementById('wif-market-open').checked,
        flood: document.getElementById('wif-flood').checked,
        lockdown: document.getElementById('wif-lockdown').checked,
    };

    const result = Forecasting.runWhatIfScenario(params);
    const currency = Forecasting.getCurrency();
    const sym = Forecasting.getSymbol(currency);
    const key = currency.toLowerCase();

    const resultsEl = document.getElementById('whatif-results');
    resultsEl.style.display = 'grid';

    document.getElementById('wif-predicted').textContent = `${sym}${result.predicted[key].toFixed(2)}`;
    document.getElementById('wif-baseline').textContent = `${sym}${result.baseline[key].toFixed(2)}`;
    document.getElementById('wif-difference').textContent = `${sym}${result.diff[key].toFixed(2)}`;

    const delta = document.getElementById('wif-delta');
    delta.textContent = `${result.pct >= 0 ? '+' : ''}${result.pct}%`;
    delta.style.color = result.pct < 0 ? '#047857' : '#ef4444';

    const diffCard = document.getElementById('wif-diff-card');
    diffCard.style.borderColor = result.diff[key] < 0 ? '#047857' : '#ef4444';

    const signalEl = document.getElementById('wif-signal');
    const signalColors = { Buy: '#047857', Hold: '#fbbf24', Wait: '#ef4444' };
    signalEl.style.background = signalColors[result.signal] || '#888';
    signalEl.style.color = 'white';
    signalEl.textContent = `🎯 XGBoost Signal: ${result.signal}`;

    showToast('Scenario prediction complete', 'success');
}

// ══════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════

function exportCSV() {
    const forecast = Forecasting.getForecast();
    if (!forecast) return showToast('No forecast to export', 'error');
    Exporter.exportCSV(forecast.daily_forecasts, Forecasting.getCurrency());
    showToast('CSV downloaded', 'success');
}

async function exportPDF() {
    const forecast = Forecasting.getForecast();
    if (!forecast) return showToast('No forecast to export', 'error');

    const btn = document.getElementById('btn-export-pdf');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
    showToast('Generating PDF report...', 'info');

    try {
        await Exporter.exportPDF(forecast, Forecasting.getCurrency());
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'PDF Downloaded!',
                html: `<p>Professional report saved successfully.</p>
                       <p style="font-size: 13px; color: #666; margin-top: 10px; text-align: left;">
                         Page 1: Executive Summary & AI Analysis<br>
                         Page 2: Top Opportunities & Strategy<br>
                         Page 3: Price Trend & Weekly Breakdown<br>
                         Page 4: Detailed 30-Day Forecast Table<br>
                         Page 5: Model Info & Cost Comparison
                       </p>`,
                timer: 6000,
                showConfirmButton: true,
                confirmButtonColor: '#047857',
            });
        } else {
            showToast('PDF report downloaded successfully!', 'success');
        }
    } catch (err) {
        console.error('PDF generation failed:', err);
        showToast('PDF generation failed: ' + err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Download PDF'; }
    }
}

function shareLink() {
    const url = window.location.href.split('?')[0];
    const params = new URLSearchParams();
    params.set('currency', Forecasting.getCurrency());
    params.set('qty', document.getElementById('calc-quantity')?.value || '500');
    const fullUrl = url + '?' + params.toString();

    navigator.clipboard.writeText(fullUrl).then(() => {
        showToast('Link copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Copy failed — URL: ' + fullUrl, 'info');
    });
}

// ══════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 3500);
}

function updateHeroTimestamp() {
    const el = document.getElementById('hero-updated');
    if (el) {
        const now = new Date();
        el.textContent = `Last updated: ${now.toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })}`;
    }
}

// ── URL Parameter Handling ────────────────────────────────
(function parseURLParams() {
    const params = new URLSearchParams(window.location.search);
    const currency = params.get('currency');
    const qty = params.get('qty');

    if (currency && ['USD', 'SAR', 'INR'].includes(currency)) {
        Forecasting.setCurrency(currency);
        const select = document.getElementById('currency-select');
        if (select) select.value = currency;
    }
    if (qty) {
        const qtyInput = document.getElementById('calc-quantity');
        if (qtyInput) qtyInput.value = qty;
    }
})();
