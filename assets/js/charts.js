/* ═══════════════════════════════════════════════════════════
   Charts — Plotly.js visualization builders
   ═══════════════════════════════════════════════════════════ */

const Charts = (() => {
    const COLORS = {
        primary: '#047857',
        primaryDark: '#065f46',
        green: '#047857',
        darkGreen: '#065f46',
        blue: '#3b82f6',
        yellow: '#fbbf24',
        red: '#ef4444',
        lightGreen: '#059669',
    };

    const REC_COLORS = {
        'STRONG BUY': COLORS.darkGreen,
        'BUY': COLORS.green,
        'ACCUMULATE': COLORS.yellow,
        'WAIT': COLORS.red,
    };

    function getThemeColors() {
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        return {
            bg: isDark ? '#1e293b' : '#ffffff',
            paper: isDark ? '#0f172a00' : '#f8fafc00',
            grid: isDark ? '#334155' : '#e2e8f0',
            text: isDark ? '#94a3b8' : '#475569',
            textBold: isDark ? '#f1f5f9' : '#0f172a',
        };
    }

    /**
     * Price Trend Chart with daily % change bars
     */
    function renderPriceTrend(containerId, forecasts, currency) {
        const sym = Forecasting.getSymbol(currency);
        const priceKey = `price_${currency.toLowerCase()}`;
        const theme = getThemeColors();

        const dates = forecasts.map(d => d.date);
        const prices = forecasts.map(d => d[priceKey] || d.price_usd * Forecasting.getRate(currency));
        const dailyPct = forecasts.map(d => d.daily_pct);

        // Find best entry
        const minIdx = prices.indexOf(Math.min(...prices));
        const bestDate = dates[minIdx];
        const bestPrice = prices[minIdx];

        // Price line
        const traceLine = {
            x: dates, y: prices,
            type: 'scatter', mode: 'lines+markers',
            name: 'Predicted Price',
            line: { color: COLORS.green, width: 3 },
            marker: { size: 5 },
            hovertemplate: '<b>%{x}</b><br>' + sym + '%{y:.2f}<extra></extra>',
            yaxis: 'y1',
        };

        // Best entry marker
        const traceStar = {
            x: [bestDate], y: [bestPrice],
            type: 'scatter', mode: 'markers',
            name: 'Best Entry',
            marker: {
                size: 18, color: COLORS.darkGreen, symbol: 'star',
                line: { width: 2, color: 'white' },
            },
            hovertemplate: '<b>BEST ENTRY</b><br>%{x}<br>' + sym + '%{y:.2f}<extra></extra>',
            yaxis: 'y1',
        };

        // Daily % change bars
        const barColors = dailyPct.map(v => v < 0 ? COLORS.green : COLORS.red);
        const traceBars = {
            x: dates, y: dailyPct,
            type: 'bar', name: 'Daily Change',
            marker: { color: barColors },
            hovertemplate: '%{x}<br>%{y:+.2f}%<extra></extra>',
            yaxis: 'y2',
        };

        const layout = {
            grid: { rows: 2, columns: 1, pattern: 'independent', roworder: 'top to bottom' },
            yaxis: {
                title: `Price (${currency})`, domain: [0.35, 1],
                gridcolor: theme.grid, color: theme.text,
            },
            yaxis2: {
                title: '% Change', domain: [0, 0.28],
                gridcolor: theme.grid, color: theme.text,
            },
            xaxis: { showticklabels: false, gridcolor: theme.grid, color: theme.text },
            xaxis2: { title: 'Date', gridcolor: theme.grid, color: theme.text },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: theme.bg,
            font: { family: 'Inter, sans-serif', color: theme.text },
            showlegend: true,
            legend: { orientation: 'h', y: 1.12, x: 0.5, xanchor: 'center' },
            hovermode: 'x unified',
            margin: { l: 60, r: 30, t: 40, b: 40 },
            height: 550,
            annotations: [{
                x: bestDate, y: bestPrice,
                text: `⭐ Best Entry<br>${sym}${bestPrice.toFixed(2)}`,
                showarrow: true, arrowhead: 2,
                arrowcolor: COLORS.darkGreen,
                font: { size: 12, color: COLORS.darkGreen },
                bgcolor: theme.bg,
                bordercolor: COLORS.darkGreen, borderwidth: 2, borderpad: 6,
                ax: 0, ay: -50,
                yref: 'y1',
            }],
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            displaylogo: false,
        };

        Plotly.newPlot(containerId, [traceLine, traceStar, traceBars], layout, config);
    }

    /**
     * Risk Calendar Heatmap
     */
    function renderRiskCalendar(containerId, forecasts, currency) {
        const sym = Forecasting.getSymbol(currency);
        const priceKey = `price_${currency.toLowerCase()}`;
        const theme = getThemeColors();

        const traces = forecasts.map(d => {
            const date = new Date(d.date);
            const color = d.risk === 'High Risk' ? '#fee2e2' : '#d1fae5';
            const textColor = d.risk === 'High Risk' ? '#dc2626' : '#065f46';
            const price = d[priceKey] || d.price_usd * Forecasting.getRate(currency);

            return {
                x: [date.getDay()],
                y: [getWeekOfMonth(date)],
                mode: 'markers+text',
                type: 'scatter',
                marker: { size: 45, color: color, line: { width: 2, color: theme.bg } },
                text: [String(date.getDate())],
                textposition: 'middle center',
                textfont: { size: 14, color: textColor, family: 'Inter, sans-serif' },
                hovertemplate: `<b>${d.date_display || d.date}</b><br>Risk: ${d.risk}<br>Price: ${sym}${price.toFixed(2)}<extra></extra>`,
                showlegend: false,
            };
        });

        const layout = {
            title: { text: 'Risk Distribution by Day', font: { size: 16, color: theme.textBold } },
            xaxis: {
                tickmode: 'array',
                tickvals: [0, 1, 2, 3, 4, 5, 6],
                ticktext: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                gridcolor: theme.grid, color: theme.text,
            },
            yaxis: {
                title: 'Week', autorange: 'reversed',
                gridcolor: theme.grid, color: theme.text,
            },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: theme.bg,
            font: { family: 'Inter, sans-serif', color: theme.text },
            height: 380,
            margin: { l: 60, r: 30, t: 60, b: 40 },
        };

        Plotly.newPlot(containerId, traces, layout, { responsive: true, displaylogo: false });
    }

    /**
     * Recommendation Pie Chart
     */
    function renderRecPie(containerId, forecasts) {
        const theme = getThemeColors();
        const counts = {};
        forecasts.forEach(d => {
            counts[d.recommendation] = (counts[d.recommendation] || 0) + 1;
        });

        const labels = Object.keys(counts);
        const values = Object.values(counts);
        const colors = labels.map(l => REC_COLORS[l] || '#888');

        const data = [{
            labels, values,
            type: 'pie',
            marker: { colors },
            hovertemplate: '<b>%{label}</b><br>%{value} days (%{percent})<extra></extra>',
            textinfo: 'label+percent',
            textfont: { size: 13, family: 'Inter, sans-serif' },
            hole: 0.4,
        }];

        const layout = {
            title: { text: '30-Day Action Breakdown', font: { size: 16, color: theme.textBold } },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: theme.bg,
            font: { family: 'Inter, sans-serif', color: theme.text },
            showlegend: true,
            legend: { orientation: 'h', y: -0.15, x: 0.5, xanchor: 'center' },
            height: 420,
            margin: { l: 30, r: 30, t: 60, b: 60 },
        };

        Plotly.newPlot(containerId, data, layout, { responsive: true, displaylogo: false });

        // Update insights
        const insights = document.getElementById('pie-insights');
        if (insights) {
            insights.innerHTML = labels.map(l => {
                const cnt = counts[l];
                const pct = (cnt / forecasts.length * 100).toFixed(0);
                return `<span class="legend-item"><span class="legend-dot" style="background:${REC_COLORS[l] || '#888'}"></span> <strong>${l}</strong>: ${cnt} days (${pct}%)</span>`;
            }).join('');
        }
    }

    /**
     * Confidence Gauge
     */
    function renderConfidenceGauge(containerId, forecasts) {
        const theme = getThemeColors();
        const avgConf = forecasts.reduce((s, d) => s + (d.confidence || 75), 0) / forecasts.length;

        const data = [{
            type: 'indicator',
            mode: 'gauge+number+delta',
            value: avgConf,
            title: { text: 'Average Confidence', font: { size: 20, color: theme.textBold } },
            number: { suffix: '%', font: { size: 36, color: theme.textBold } },
            delta: { reference: 70, suffix: '%' },
            gauge: {
                axis: { range: [0, 100], ticksuffix: '%', color: theme.text },
                bar: { color: COLORS.darkGreen },
                bgcolor: theme.bg,
                borderwidth: 2,
                bordercolor: theme.grid,
                steps: [
                    { range: [0, 50], color: '#fee2e2' },
                    { range: [50, 75], color: '#fef3c7' },
                    { range: [75, 100], color: '#d1fae5' },
                ],
                threshold: {
                    line: { color: COLORS.red, width: 4 },
                    thickness: 0.75,
                    value: 90,
                },
            },
        }];

        const layout = {
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: theme.bg,
            font: { family: 'Inter, sans-serif', color: theme.text },
            height: 340,
            margin: { l: 30, r: 30, t: 40, b: 20 },
        };

        Plotly.newPlot(containerId, data, layout, { responsive: true, displaylogo: false });

        // Breakdown
        const breakdown = document.getElementById('confidence-breakdown');
        if (breakdown) {
            const hi = forecasts.filter(d => (d.confidence || 75) >= 75).length;
            const md = forecasts.filter(d => (d.confidence || 75) >= 50 && (d.confidence || 75) < 75).length;
            const lo = forecasts.filter(d => (d.confidence || 75) < 50).length;
            breakdown.innerHTML = `
                <div class="metric-card glass-card" style="flex:1;text-align:center;padding:1rem">
                    <span class="metric-icon">🟢</span>
                    <span class="metric-value">${hi}</span>
                    <span class="metric-label">High (≥75%)</span>
                </div>
                <div class="metric-card glass-card" style="flex:1;text-align:center;padding:1rem">
                    <span class="metric-icon">🟡</span>
                    <span class="metric-value">${md}</span>
                    <span class="metric-label">Medium (50-75%)</span>
                </div>
                <div class="metric-card glass-card" style="flex:1;text-align:center;padding:1rem">
                    <span class="metric-icon">🔴</span>
                    <span class="metric-value">${lo}</span>
                    <span class="metric-label">Low (<50%)</span>
                </div>`;
        }
    }

    /**
     * Render all charts
     */
    function renderAll(forecasts, currency) {
        renderPriceTrend('chart-price-trend', forecasts, currency);
        renderRiskCalendar('chart-risk-calendar', forecasts, currency);
        renderRecPie('chart-rec-pie', forecasts);
        renderConfidenceGauge('chart-confidence', forecasts);
    }

    // Helper
    function getWeekOfMonth(date) {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
        return Math.ceil((date.getDate() + firstDay) / 7);
    }

    return { renderPriceTrend, renderRiskCalendar, renderRecPie, renderConfidenceGauge, renderAll };
})();
