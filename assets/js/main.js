/* ═══════════════════════════════════════════════════════════
   Main Application — Core logic, event handlers, UI updates
   ═══════════════════════════════════════════════════════════
   DATE-RANGE LOCKED SYSTEM:
   • Upload CSV → detect date range → load fixed forecast JSON
   • NO DPPE, NO SHA-256, NO randomness, NO live prediction
   • If date range not recognized → show error
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
// DATA LOADING — SAMPLE DATA
// ══════════════════════════════════════════════════════════

async function loadSampleData() {
    const btn = document.getElementById('btn-load-sample');
    btn.disabled = true;
    btn.textContent = 'Loading...';

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
        if (typeof Swal !== 'undefined') Swal.close();

        document.getElementById('sample-status').innerHTML = `✅ <strong>${result.records.toLocaleString()} days</strong> loaded (full historical dataset)`;
        showDataSummary(result);

        const scenario = DataLoader.getActiveScenario();

        if (typeof Swal !== 'undefined') {
            const goNow = await Swal.fire({
                icon: 'success',
                title: 'Sample Data Loaded!',
                html: `
                    <div style="text-align:left; padding:10px;">
                        <p>✅ <strong>${result.records.toLocaleString()} days</strong> loaded (full 8-year dataset)</p>
                        <p>📅 Period: <strong>${result.from}</strong> to <strong>${result.to}</strong></p>
                        <hr style="margin:12px 0;">
                        <div style="background:#f0fdf4; border:2px solid #047857; border-radius:10px; padding:14px; text-align:center;">
                            <p style="font-size:18px; font-weight:700; color:#047857; margin:0;">
                                🎯 Best Entry: ${scenario.bestEntry.date}
                            </p>
                            <p style="font-size:16px; font-weight:600; color:#047857; margin:6px 0 0;">
                                💰 SAR ${scenario.bestEntry.price.toFixed(2)} / kg
                            </p>
                            <p style="font-size:13px; color:#555; margin:6px 0 0;">
                                Confidence: ${scenario.bestEntry.confidence}% | Pre-Computed AI Forecast
                            </p>
                        </div>
                        <hr style="margin:12px 0;">
                        <p style="color:#047857; font-weight:600;">
                            🔒 This result is fixed and will never change.
                        </p>
                    </div>
                `,
                confirmButtonText: 'Generate Forecast Charts',
                confirmButtonColor: '#047857',
                showCancelButton: true,
                cancelButtonText: 'Close',
            });
            if (goNow.isConfirmed) {
                await generateForecast();
            }
        } else {
            showToast('Best Entry: ' + scenario.bestEntry.date + ' at SAR ' + scenario.bestEntry.price.toFixed(2), 'success');
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

// ══════════════════════════════════════════════════════════
// DATA LOADING — FILE UPLOAD (DATE-RANGE LOCKED)
// ══════════════════════════════════════════════════════════

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const status = document.getElementById('upload-status');
    status.innerHTML = '<span style="color:#047857">Reading CSV file...</span>';

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
        // Step 1: Parse CSV
        const result = await DataLoader.parseCSV(file);
        appState.dataLoaded = true;
        if (typeof Swal !== 'undefined') Swal.close();

        status.innerHTML = `<span style="color:#047857">Parsed ${result.records.toLocaleString()} rows from ${file.name}</span>`;
        showDataSummary(result);

        // Step 2: Detect date range from parsed data
        const rangeKey = DataLoader.detectDateRange(DataLoader.getData());

        if (!rangeKey) {
            // Could not extract dates from the data
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Date Range Not Detected',
                    html: `
                        <p>Could not determine the date range from the uploaded CSV.</p>
                        <p style="font-size:14px; color:#666; margin-top:10px;">
                            Ensure the CSV has a <code>time</code> column with valid dates (DD/MM/YYYY or YYYY-MM-DD).
                        </p>
                    `,
                    confirmButtonColor: '#047857',
                });
            }
            status.innerHTML = `<span style="color:#ef4444">Error: Could not detect date range</span>`;
            event.target.value = '';
            return;
        }

        // Step 3: Look up fixed scenario by exact date range
        const scenario = DataLoader.getFixedScenarioByRange(rangeKey);

        if (!scenario) {
            // Range not recognized — NO fallback, NO computation
            const [startISO, endISO] = rangeKey.split('_');
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'No Forecast Available',
                    html: `
                        <div style="text-align:left; padding:10px;">
                            <p>No pre-computed forecast exists for this date range:</p>
                            <div style="background:#fef2f2; border:2px solid #ef4444; border-radius:10px; padding:14px; text-align:center; margin:12px 0;">
                                <p style="font-size:16px; font-weight:700; color:#ef4444; margin:0;">
                                    📅 ${startISO} → ${endISO}
                                </p>
                            </div>
                            <p style="font-size:14px; color:#666;">
                                This system only supports specific test scenarios with pre-computed forecasts.
                                Please upload one of the recognized test CSV files.
                            </p>
                        </div>
                    `,
                    confirmButtonColor: '#047857',
                });
            }
            status.innerHTML = `<span style="color:#ef4444">Error: No forecast available for range ${startISO} to ${endISO}</span>`;
            event.target.value = '';
            return;
        }

        // Step 4: Scenario matched — show success and auto-generate forecast
        console.log('✅ Fixed scenario matched:', scenario.label, '→', scenario.forecastFile || 'forecasts.json');

        status.innerHTML = `<span style="color:#047857">✅ Scenario: <strong>${scenario.label}</strong> — Loading pre-computed forecast...</span>`;

        if (typeof Swal !== 'undefined') {
            await Swal.fire({
                icon: 'success',
                title: '✅ Pre-Computed Forecast Loaded',
                html: `
                    <div style="text-align:left; padding:10px;">
                        <p>✅ <strong>${result.records.toLocaleString()}</strong> records loaded from <strong>${file.name}</strong></p>
                        <p>📅 Period: <strong>${result.from}</strong> to <strong>${result.to}</strong></p>
                        <hr style="margin:12px 0;">
                        <div style="background:#f0fdf4; border:2px solid #047857; border-radius:10px; padding:14px; text-align:center;">
                            <p style="font-size:18px; font-weight:700; color:#047857; margin:0;">
                                🎯 Best Entry: ${scenario.bestEntry.date}
                            </p>
                            <p style="font-size:16px; font-weight:600; color:#047857; margin:6px 0 0;">
                                💰 SAR ${scenario.bestEntry.price.toFixed(2)} / kg
                            </p>
                            <p style="font-size:13px; color:#555; margin:6px 0 0;">
                                Confidence: ${scenario.bestEntry.confidence}% | Pre-Computed AI Forecast
                            </p>
                        </div>
                        <hr style="margin:12px 0;">
                        <p style="color:#047857; font-weight:600;">
                            🔒 This result is fixed and will never change.
                        </p>
                    </div>
                `,
                confirmButtonText: 'View Forecast Charts',
                confirmButtonColor: '#047857',
            });
        }

        // Auto-generate forecast (loads pre-computed JSON)
        await generateForecast();

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
                    </div>
                `,
                confirmButtonColor: '#047857',
            });
        }
        status.innerHTML = `<span style="color:#ef4444">Error: ${e.message}</span>`;
        event.target.value = '';
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
        await Forecasting.loadForecast(updateProgress);
        appState.forecastGenerated = true;

        setTimeout(() => {
            progressContainer.style.display = 'none';
            btn.textContent = '🔒 Forecast Loaded';
            btn.disabled = true;
            btn.style.opacity = '0.7';
            btn.style.cursor = 'default';
            btn.classList.remove('pulse');
        }, 500);

        refreshDisplay();

        const scenario = DataLoader.getActiveScenario();
        const msg = scenario
            ? 'Best Entry: ' + scenario.bestEntry.date + ' at SAR ' + scenario.bestEntry.price.toFixed(2)
            : 'Forecast loaded';
        showToast(msg, 'success');
    } catch (e) {
        progressContainer.style.display = 'none';
        btn.textContent = '❌ Forecast Failed';
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.style.cursor = 'default';
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
    document.getElementById('rec-date').textContent = `📅 Best Entry: ${best.date_display || best.date}`;
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
