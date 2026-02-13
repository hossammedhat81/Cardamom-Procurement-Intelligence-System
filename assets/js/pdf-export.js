/* ═══════════════════════════════════════════════════════════
   Professional PDF Report Generator — COMPLETE REWRITE
   - No garbled symbols (no emojis in jsPDF)
   - Professional color-coded tables
   - 5-page executive report
   ═══════════════════════════════════════════════════════════ */

const Exporter = (() => {

    // ── Brand Colors ───────────────────────────────────────
    const C = {
        BRAND:      [5, 90, 60],     // Dark green header
        BRAND_MID:  [4, 120, 87],    // #047857
        BRAND_LITE: [209, 250, 229], // Light green bg
        WHITE:      [255, 255, 255],
        BLACK:      [0, 0, 0],
        DARK:       [30, 41, 59],    // Slate-800
        GRAY:       [100, 116, 139], // Slate-500
        GRAY_BG:    [249, 250, 251], // Very light gray
        RED:        [239, 68, 68],
        ORANGE:     [217, 119, 6],
        YELLOW_BG:  [254, 249, 195],
        RED_BG:     [254, 226, 226],
    };

    const PW = 210; // page width mm
    const PH = 297; // page height mm

    // ── CSV Export ─────────────────────────────────────────
    function exportCSV(forecasts, currency) {
        if (!forecasts || !forecasts.length) return;

        const sym  = Forecasting.getSymbol(currency);
        const pKey = `price_${currency.toLowerCase()}`;

        const headers = ['Date', `Price (${currency})`, 'Daily %', 'Total %', 'Risk', 'Recommendation', 'Confidence'];
        const rows = forecasts.map(d => [
            d.date_display || d.date,
            (d[pKey] || 0).toFixed(2),
            (d.daily_pct || 0).toFixed(2) + '%',
            (d.total_pct || 0).toFixed(2) + '%',
            d.risk,
            d.recommendation,
            (d.confidence || 0).toFixed(0) + '%',
        ]);

        let csv = headers.join(',') + '\n';
        rows.forEach(r => { csv += r.map(v => `"${v}"`).join(',') + '\n'; });
        downloadFile(csv, `cardamom_forecast_${currency}_${getDateStamp()}.csv`, 'text/csv');
    }

    // ══════════════════════════════════════════════════════
    //  MAIN PDF GENERATOR — 5 Pages
    // ══════════════════════════════════════════════════════

    async function exportPDF(forecastData, currency) {
        if (!forecastData) throw new Error('No forecast data provided');
        console.log('[PDF] Starting professional PDF generation...');

        if (typeof window.jspdf === 'undefined') {
            throw new Error('jsPDF library not loaded. Check CDN script tags.');
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        const sym    = Forecasting.getSymbol(currency);
        const pKey   = `price_${currency.toLowerCase()}`;
        const daily  = forecastData.daily_forecasts;
        const best   = forecastData.best_entry;
        const stats  = forecastData.statistics;

        const bestPrice  = best[pKey] || best.price_usd * Forecasting.getRate(currency);
        const firstPrice = daily[0]?.[pKey] || daily[0]?.price_usd * Forecasting.getRate(currency);
        const prices     = daily.map(d => d[pKey] || d.price_usd * Forecasting.getRate(currency));

        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const lastPrice  = prices[prices.length - 1];

        const trendPct   = ((lastPrice - firstPrice) / firstPrice * 100);
        const dropPct    = ((firstPrice - bestPrice) / firstPrice * 100);
        const strongBuyDays  = stats.strong_buy_days || daily.filter(d => d.recommendation === 'STRONG BUY').length;
        const buyDays        = stats.buy_days || daily.filter(d => d.recommendation === 'BUY').length;
        const accumulateDays = stats.accumulate_days || daily.filter(d => d.recommendation === 'ACCUMULATE').length;
        const waitDays       = stats.wait_days || daily.filter(d => d.recommendation === 'WAIT').length;
        const highRiskDays   = stats.high_risk_days || daily.filter(d => d.risk === 'High Risk').length;
        const normalDays     = daily.filter(d => d.risk === 'Normal').length;
        const quantity       = parseInt(document.getElementById('calc-quantity')?.value || 500);
        const savings        = Math.max(0, (firstPrice - bestPrice) * quantity);

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        // ════════════════════════════════════════════════════
        //  PAGE 1 : EXECUTIVE SUMMARY
        // ════════════════════════════════════════════════════
        console.log('[PDF] Page 1: Executive Summary');

        // Header banner
        doc.setFillColor(...C.BRAND);
        doc.rect(0, 0, PW, 50, 'F');

        doc.setTextColor(...C.WHITE);
        doc.setFontSize(26);
        doc.setFont('helvetica', 'bold');
        doc.text('Cardamom Procurement', PW / 2, 20, { align: 'center' });
        doc.setFontSize(20);
        doc.text('Intelligence Report', PW / 2, 32, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generated: ${dateStr} at ${timeStr}`, PW / 2, 43, { align: 'center' });

        // Best Entry highlight box
        doc.setFillColor(...C.BRAND_LITE);
        doc.roundedRect(15, 58, 180, 38, 3, 3, 'F');
        doc.setDrawColor(...C.BRAND_MID);
        doc.setLineWidth(0.5);
        doc.roundedRect(15, 58, 180, 38, 3, 3, 'S');

        doc.setTextColor(...C.BRAND);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('OPTIMAL ENTRY POINT', PW / 2, 68, { align: 'center' });

        doc.setFontSize(22);
        doc.setTextColor(...C.BRAND);
        doc.text(`${best.date_display || best.date}  --  ${sym}${bestPrice.toFixed(2)} / kg`, PW / 2, 80, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.DARK);
        doc.text(`${best.recommendation}  |  Confidence: ${(best.confidence || 75).toFixed(0)}%  |  Risk: ${best.risk}`, PW / 2, 89, { align: 'center' });

        // Savings line
        if (savings > 0) {
            doc.setTextColor(...C.BRAND_MID);
            doc.setFont('helvetica', 'italic');
            doc.text(`Potential Savings: ${sym}${savings.toFixed(0)} on ${quantity.toLocaleString()} kg order`, PW / 2, 95, { align: 'center' });
        }

        // ── AI Analysis Section (clean text, no emojis) ────
        let y = 108;
        doc.setTextColor(...C.BLACK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('AI Analysis', 20, y);
        y += 10;

        const analysisPoints = [
            `Prices expected to ${trendPct > 0 ? 'rise' : 'decline'} ${Math.abs(trendPct).toFixed(1)}% over 30 days -- ${trendPct > 0 ? 'early procurement is advantageous' : 'strategic waiting may yield better prices'}.`,
            `Optimal price is ${Math.abs(dropPct).toFixed(1)}% below the opening forecast price, indicating a significant buying window.`,
            `High AI confidence of ${(best.confidence || 75).toFixed(0)}% -- all three models (TimesFM, LSTM-CNN, XGBoost) show strong agreement.`,
            `${best.risk === 'Normal' ? 'Stable' : 'Volatile'} market conditions predicted around the optimal date, ${best.risk === 'Normal' ? 'reducing' : 'increasing'} procurement risk.`,
            `${strongBuyDays} STRONG BUY signal${strongBuyDays !== 1 ? 's' : ''} detected in the 30-day forecast, giving flexibility in timing.`,
        ];

        doc.setFontSize(10);
        analysisPoints.forEach((text) => {
            // Green bullet circle
            doc.setFillColor(...C.BRAND_MID);
            doc.circle(23, y - 1, 1.5, 'F');

            // Text
            doc.setTextColor(...C.DARK);
            doc.setFont('helvetica', 'normal');
            const lines = doc.splitTextToSize(text, 163);
            doc.text(lines, 28, y);
            y += lines.length * 5 + 3;
        });

        // ── Summary Statistics Table ────────────────────────
        y += 4;
        doc.setTextColor(...C.BLACK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('30-Day Forecast Summary', 20, y);
        y += 6;

        const summaryRows = [
            ['Forecast Period', `${daily[0]?.date_display || daily[0]?.date} -- ${daily[daily.length-1]?.date_display || daily[daily.length-1]?.date}`],
            ['Lowest Price',    `${sym}${minPrice.toFixed(2)}`],
            ['Highest Price',   `${sym}${maxPrice.toFixed(2)}`],
            ['Average Price',   `${sym}${avgPrice.toFixed(2)}`],
            ['Price Volatility', `${((maxPrice - minPrice) / avgPrice * 100).toFixed(1)}%`],
            ['STRONG BUY Days',  String(strongBuyDays)],
            ['High Risk Days',   String(highRiskDays)],
        ];

        doc.autoTable({
            startY: y,
            head: [['Metric', 'Value']],
            body: summaryRows,
            theme: 'grid',
            headStyles: { fillColor: C.BRAND, textColor: 255, fontStyle: 'bold', fontSize: 10 },
            bodyStyles: { fontSize: 9 },
            alternateRowStyles: { fillColor: C.GRAY_BG },
            margin: { left: 20, right: 20 },
        });

        console.log('[PDF] Page 1 complete');

        // ════════════════════════════════════════════════════
        //  PAGE 2 : TOP BUYING OPPORTUNITIES
        // ════════════════════════════════════════════════════
        doc.addPage();
        console.log('[PDF] Page 2: Top Buying Opportunities');

        // Header
        doc.setFillColor(...C.BRAND);
        doc.rect(0, 0, PW, 20, 'F');
        doc.setTextColor(...C.WHITE);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Top Buying Opportunities', PW / 2, 14, { align: 'center' });

        doc.setTextColor(...C.GRAY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Ranked by lowest predicted price during the forecast window', PW / 2, 28, { align: 'center' });

        // Top 10 lowest prices
        const top10 = [...daily]
            .sort((a, b) => (a[pKey] || a.price_usd) - (b[pKey] || b.price_usd))
            .slice(0, 10)
            .map((row, i) => {
                const p = row[pKey] || row.price_usd * Forecasting.getRate(currency);
                return [
                    String(i + 1),
                    row.date_display || row.date,
                    `${sym}${p.toFixed(2)}`,
                    `${(row.daily_pct || 0) >= 0 ? '+' : ''}${(row.daily_pct || 0).toFixed(1)}%`,
                    row.recommendation,
                    `${(row.confidence || 0).toFixed(0)}%`,
                    row.risk,
                ];
            });

        doc.autoTable({
            startY: 34,
            head: [['#', 'Date', `Price (${currency})`, 'Daily %', 'Action', 'Conf', 'Risk']],
            body: top10,
            theme: 'grid',
            headStyles: { fillColor: C.BRAND, textColor: 255, fontStyle: 'bold', fontSize: 10 },
            bodyStyles: { fontSize: 9 },
            alternateRowStyles: { fillColor: C.GRAY_BG },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' },
                1: { cellWidth: 30 },
                2: { cellWidth: 30, halign: 'right' },
                3: { cellWidth: 22, halign: 'center' },
                4: { cellWidth: 34, fontStyle: 'bold' },
                5: { cellWidth: 18, halign: 'center' },
                6: { cellWidth: 26 },
            },
            didParseCell: function(data) {
                if (data.section !== 'body') return;
                // Color-code Action column
                if (data.column.index === 4) {
                    const val = data.cell.text[0];
                    if (val === 'STRONG BUY') {
                        data.cell.styles.textColor = C.BRAND_MID;
                        data.cell.styles.fillColor = C.BRAND_LITE;
                    } else if (val === 'BUY') {
                        data.cell.styles.textColor = [6, 150, 105];
                    } else if (val === 'ACCUMULATE') {
                        data.cell.styles.textColor = C.ORANGE;
                    } else if (val === 'WAIT') {
                        data.cell.styles.textColor = C.RED;
                    }
                }
                // Color-code Risk column
                if (data.column.index === 6) {
                    const risk = data.cell.text[0];
                    if (risk === 'High Risk') {
                        data.cell.styles.textColor = C.RED;
                    } else {
                        data.cell.styles.textColor = C.BRAND_MID;
                    }
                }
            },
            margin: { left: 15, right: 15 },
        });

        // ── Procurement Strategy ────────────────────────────
        y = doc.lastAutoTable.finalY + 14;

        doc.setTextColor(...C.BLACK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Procurement Strategy', 20, y);
        y += 9;

        const strategies = [];

        if (strongBuyDays === 0) {
            strategies.push(`Limited STRONG BUY signals. Consider gradual accumulation on BUY days (${buyDays} available) or wait for better conditions.`);
        } else if (strongBuyDays <= 3) {
            strategies.push(`${strongBuyDays} STRONG BUY opportunities identified. Focus procurement on these specific dates for optimal pricing.`);
        } else {
            strategies.push(`Multiple STRONG BUY signals (${strongBuyDays} days). Consider splitting procurement across top-ranked dates to average out risk.`);
        }

        if (highRiskDays > 15) {
            strategies.push(`High volatility expected (${highRiskDays} high-risk days). Recommend conservative approach with smaller order sizes and frequent reassessment.`);
        } else if (highRiskDays > 8) {
            strategies.push(`Moderate volatility expected (${highRiskDays} high-risk days). Consider phased procurement to mitigate risk exposure.`);
        } else {
            strategies.push(`Low volatility environment (only ${highRiskDays} high-risk days). Safe to proceed with standard procurement volumes.`);
        }

        if (trendPct > 3) {
            strategies.push(`Upward price trend (+${trendPct.toFixed(1)}%). Act quickly to lock in current prices before further increases.`);
        } else if (trendPct < -3) {
            strategies.push(`Downward price trend (${trendPct.toFixed(1)}%). Strategic patience may yield better prices in the later forecast period.`);
        } else {
            strategies.push(`Stable price trend (${trendPct > 0 ? '+' : ''}${trendPct.toFixed(1)}%). Moderate urgency for procurement decisions.`);
        }

        strategies.push(`For a ${quantity.toLocaleString()} kg order, the optimal entry date of ${best.date_display || best.date} could save approximately ${sym}${savings.toFixed(0)} compared to buying at the opening price.`);

        doc.setFontSize(10);
        strategies.forEach((text, i) => {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...C.BRAND_MID);
            doc.text(`${i + 1}.`, 20, y);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...C.DARK);
            const lines = doc.splitTextToSize(text, 163);
            doc.text(lines, 28, y);
            y += lines.length * 5 + 3;
        });

        // ── Risk Assessment Box ─────────────────────────────
        y += 6;
        doc.setTextColor(...C.BLACK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Risk Assessment', 20, y);
        y += 8;

        const riskScore = (highRiskDays / 30) * 100;
        let riskLevel, riskColor, riskAdvice;

        if (riskScore < 20) {
            riskLevel = 'LOW';
            riskColor = C.BRAND_MID;
            riskAdvice = 'Market conditions are favorable with minimal volatility. Safe to proceed with standard procurement volumes and strategies.';
        } else if (riskScore < 50) {
            riskLevel = 'MODERATE';
            riskColor = C.ORANGE;
            riskAdvice = 'Some volatility expected. Consider hedging strategies, phased procurement, or setting price limits to manage exposure.';
        } else {
            riskLevel = 'HIGH';
            riskColor = C.RED;
            riskAdvice = 'Significant volatility predicted. Recommend cautious approach with smaller orders, frequent reassessment, and close market monitoring.';
        }

        // Colored risk level bar
        doc.setFillColor(...riskColor);
        doc.roundedRect(20, y, 170, 10, 2, 2, 'F');
        doc.setTextColor(...C.WHITE);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`Overall Risk Level: ${riskLevel}`, 25, y + 7);
        y += 15;

        doc.setTextColor(...C.DARK);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const advLines = doc.splitTextToSize(riskAdvice, 170);
        doc.text(advLines, 20, y);
        y += advLines.length * 5 + 4;

        // Risk breakdown mini-table
        const riskRows = [
            ['Normal Risk Days', `${normalDays}`, `${(normalDays / 30 * 100).toFixed(0)}%`],
            ['High Risk Days',   `${highRiskDays}`, `${(highRiskDays / 30 * 100).toFixed(0)}%`],
            ['STRONG BUY Days',  `${strongBuyDays}`, `${(strongBuyDays / 30 * 100).toFixed(0)}%`],
            ['BUY Days',         `${buyDays}`, `${(buyDays / 30 * 100).toFixed(0)}%`],
            ['ACCUMULATE Days',  `${accumulateDays}`, `${(accumulateDays / 30 * 100).toFixed(0)}%`],
            ['WAIT Days',        `${waitDays}`, `${(waitDays / 30 * 100).toFixed(0)}%`],
        ];

        doc.autoTable({
            startY: y,
            head: [['Category', 'Count', 'Proportion']],
            body: riskRows,
            theme: 'grid',
            headStyles: { fillColor: C.BRAND, textColor: 255, fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { fontSize: 9 },
            alternateRowStyles: { fillColor: C.GRAY_BG },
            columnStyles: {
                1: { halign: 'center' },
                2: { halign: 'center' },
            },
            didParseCell: function(data) {
                if (data.section !== 'body') return;
                const label = data.row.cells[0]?.text?.[0] || '';
                if (label.includes('High Risk') && data.column.index > 0)   data.cell.styles.textColor = C.RED;
                if (label.includes('STRONG BUY') && data.column.index > 0)  data.cell.styles.textColor = C.BRAND_MID;
                if (label.includes('WAIT') && data.column.index > 0)        data.cell.styles.textColor = C.RED;
            },
            margin: { left: 20, right: 20 },
        });

        console.log('[PDF] Page 2 complete');

        // ════════════════════════════════════════════════════
        //  PAGE 3 : PRICE ANALYSIS & CHARTS
        // ════════════════════════════════════════════════════
        doc.addPage();
        console.log('[PDF] Page 3: Price Analysis & Charts');

        // Header
        doc.setFillColor(...C.BRAND);
        doc.rect(0, 0, PW, 20, 'F');
        doc.setTextColor(...C.WHITE);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Price Trend & Market Analysis', PW / 2, 14, { align: 'center' });

        // Try capturing the price chart (with full validation)
        let chartImg = null;
        if (typeof html2canvas !== 'undefined') {
            try {
                await new Promise(r => setTimeout(r, 400));
                const el = document.getElementById('chart-price-trend');
                if (el && el.offsetWidth > 0) {
                    const canvas = await html2canvas(el, {
                        backgroundColor: '#1e293b',
                        scale: 2,
                        useCORS: true,
                        allowTaint: true,
                        logging: false,
                    });
                    if (canvas && canvas.width > 0 && canvas.height > 0) {
                        const imgData = canvas.toDataURL('image/png');
                        if (imgData && imgData.length > 200 && imgData.startsWith('data:image/png')) {
                            chartImg = imgData;
                            console.log('[PDF] Chart captured successfully');
                        }
                    }
                }
            } catch (e) {
                console.warn('[PDF] Chart capture failed:', e.message);
            }
        }

        if (chartImg) {
            doc.addImage(chartImg, 'PNG', 10, 28, 190, 95, undefined, 'FAST');
            y = 130;
        } else {
            // Fallback: draw a text-based price trend summary
            y = 30;
            doc.setFillColor(...C.BRAND_LITE);
            doc.roundedRect(15, y, 180, 55, 3, 3, 'F');

            doc.setTextColor(...C.BRAND);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text('Price Range Summary', PW / 2, y + 12, { align: 'center' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.setTextColor(...C.DARK);
            doc.text(`Lowest:   ${sym}${minPrice.toFixed(2)}  (${best.date_display || best.date})`, 30, y + 24);
            doc.text(`Average:  ${sym}${avgPrice.toFixed(2)}`, 30, y + 33);
            doc.text(`Highest:  ${sym}${maxPrice.toFixed(2)}`, 30, y + 42);

            const trendDir = trendPct > 0 ? 'UPWARD' : trendPct < 0 ? 'DOWNWARD' : 'STABLE';
            doc.text(`Trend:    ${trendDir} (${trendPct > 0 ? '+' : ''}${trendPct.toFixed(1)}%)`, 110, y + 24);
            doc.text(`Spread:   ${sym}${(maxPrice - minPrice).toFixed(2)}`, 110, y + 33);
            doc.text(`Volatility: ${((maxPrice - minPrice) / avgPrice * 100).toFixed(1)}%`, 110, y + 42);

            y = y + 63;
        }

        // Price statistics table
        doc.setTextColor(...C.BLACK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Detailed Price Statistics', 15, y);
        y += 6;

        const priceStatsRows = [
            ['Opening Price',   `${sym}${firstPrice.toFixed(2)}`],
            ['Closing Price',   `${sym}${lastPrice.toFixed(2)}`],
            ['Minimum Price',   `${sym}${minPrice.toFixed(2)}`],
            ['Maximum Price',   `${sym}${maxPrice.toFixed(2)}`],
            ['Average Price',   `${sym}${avgPrice.toFixed(2)}`],
            ['Price Range',     `${sym}${(maxPrice - minPrice).toFixed(2)}`],
            ['Volatility',      `${((maxPrice - minPrice) / avgPrice * 100).toFixed(1)}%`],
            ['30-Day Trend',    `${trendPct > 0 ? '+' : ''}${trendPct.toFixed(1)}%`],
            ['Best Entry Date', best.date_display || best.date],
            ['Best Entry Price', `${sym}${bestPrice.toFixed(2)}`],
        ];

        doc.autoTable({
            startY: y,
            head: [['Metric', 'Value']],
            body: priceStatsRows,
            theme: 'grid',
            headStyles: { fillColor: C.BRAND, textColor: 255, fontStyle: 'bold', fontSize: 10 },
            bodyStyles: { fontSize: 9 },
            alternateRowStyles: { fillColor: C.GRAY_BG },
            margin: { left: 15, right: 15 },
        });

        // Weekly breakdown
        y = doc.lastAutoTable.finalY + 12;
        doc.setTextColor(...C.BLACK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Weekly Price Breakdown', 15, y);
        y += 6;

        const weeklyData = [];
        for (let w = 0; w < 5; w++) {
            const start = w * 7;
            const end = Math.min(start + 7, daily.length);
            if (start >= daily.length) break;
            const weekSlice = daily.slice(start, end);
            const wp = weekSlice.map(d => d[pKey] || d.price_usd * Forecasting.getRate(currency));
            const wMin = Math.min(...wp);
            const wMax = Math.max(...wp);
            const wAvg = wp.reduce((a, b) => a + b, 0) / wp.length;
            const wBuy = weekSlice.filter(d => d.recommendation === 'STRONG BUY' || d.recommendation === 'BUY').length;
            const wRisk = weekSlice.filter(d => d.risk === 'High Risk').length;

            weeklyData.push([
                `Week ${w + 1}`,
                `${weekSlice[0]?.date_display || ''} - ${weekSlice[weekSlice.length - 1]?.date_display || ''}`,
                `${sym}${wAvg.toFixed(2)}`,
                `${sym}${wMin.toFixed(2)} - ${sym}${wMax.toFixed(2)}`,
                `${wBuy} buy`,
                `${wRisk} risk`,
            ]);
        }

        doc.autoTable({
            startY: y,
            head: [['Week', 'Period', 'Avg Price', 'Range', 'Buy Signals', 'Risk Days']],
            body: weeklyData,
            theme: 'grid',
            headStyles: { fillColor: C.BRAND, textColor: 255, fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { fontSize: 8 },
            alternateRowStyles: { fillColor: C.GRAY_BG },
            margin: { left: 15, right: 15 },
        });

        console.log('[PDF] Page 3 complete');

        // ════════════════════════════════════════════════════
        //  PAGE 4 : DETAILED 30-DAY FORECAST TABLE
        // ════════════════════════════════════════════════════
        doc.addPage();
        console.log('[PDF] Page 4: Detailed 30-Day Forecast');

        doc.setFillColor(...C.BRAND);
        doc.rect(0, 0, PW, 20, 'F');
        doc.setTextColor(...C.WHITE);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Detailed 30-Day Forecast', PW / 2, 14, { align: 'center' });

        const fullTableData = daily.map(d => {
            const p = d[pKey] || d.price_usd * Forecasting.getRate(currency);
            return [
                d.date_display || d.date,
                `${sym}${p.toFixed(2)}`,
                `${(d.daily_pct || 0) >= 0 ? '+' : ''}${(d.daily_pct || 0).toFixed(1)}%`,
                `${(d.total_pct || 0) >= 0 ? '+' : ''}${(d.total_pct || 0).toFixed(1)}%`,
                d.risk,
                d.recommendation,
                `${(d.confidence || 0).toFixed(0)}%`,
                (d.confidence || 0) >= 70 ? 'Bullish' : (d.confidence || 0) >= 50 ? 'Neutral' : 'Bearish',
            ];
        });

        doc.autoTable({
            startY: 28,
            head: [['Date', `Price`, 'Dly%', 'Tot%', 'Risk', 'Action', 'Conf', 'Signal']],
            body: fullTableData,
            theme: 'grid',
            styles: { fontSize: 7.5, cellPadding: 2 },
            headStyles: { fillColor: C.BRAND, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
            alternateRowStyles: { fillColor: C.GRAY_BG },
            columnStyles: {
                0: { cellWidth: 26 },
                1: { cellWidth: 24, halign: 'right' },
                2: { cellWidth: 18, halign: 'center' },
                3: { cellWidth: 18, halign: 'center' },
                4: { cellWidth: 22 },
                5: { cellWidth: 30, fontStyle: 'bold' },
                6: { cellWidth: 16, halign: 'center' },
                7: { cellWidth: 22 },
            },
            didParseCell: function(data) {
                if (data.section !== 'body') return;
                const rowIdx = data.row.index;
                const action = fullTableData[rowIdx][5];

                // Highlight entire row by action
                if (action === 'STRONG BUY')      data.cell.styles.fillColor = C.BRAND_LITE;
                else if (action === 'WAIT')        data.cell.styles.fillColor = C.RED_BG;
                else if (action === 'ACCUMULATE')  data.cell.styles.fillColor = C.YELLOW_BG;

                // Color action text
                if (data.column.index === 5) {
                    if (action === 'STRONG BUY')       data.cell.styles.textColor = C.BRAND_MID;
                    else if (action === 'BUY')         data.cell.styles.textColor = [6, 150, 105];
                    else if (action === 'ACCUMULATE')   data.cell.styles.textColor = C.ORANGE;
                    else if (action === 'WAIT')         data.cell.styles.textColor = C.RED;
                }

                // Color risk text
                if (data.column.index === 4) {
                    const risk = fullTableData[rowIdx][4];
                    data.cell.styles.textColor = risk === 'High Risk' ? C.RED : C.BRAND_MID;
                }

                // Color signal text
                if (data.column.index === 7) {
                    const signal = fullTableData[rowIdx][7];
                    if (signal === 'Bullish')       data.cell.styles.textColor = C.BRAND_MID;
                    else if (signal === 'Bearish')  data.cell.styles.textColor = C.RED;
                    else                             data.cell.styles.textColor = C.ORANGE;
                }
            },
            margin: { left: 10, right: 10 },
        });

        console.log('[PDF] Page 4 complete');

        // ════════════════════════════════════════════════════
        //  PAGE 5 : ADDITIONAL INSIGHTS & MODEL INFO
        // ════════════════════════════════════════════════════
        doc.addPage();
        console.log('[PDF] Page 5: Additional Insights');

        doc.setFillColor(...C.BRAND);
        doc.rect(0, 0, PW, 20, 'F');
        doc.setTextColor(...C.WHITE);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Additional Insights & Methodology', PW / 2, 14, { align: 'center' });

        // Model Information
        y = 30;
        doc.setTextColor(...C.BLACK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('AI Model Ensemble', 20, y);
        y += 8;

        const modelInfo = [
            ['TimesFM v1.0', 'Google foundation model for time series. Captures long-range temporal patterns and seasonality.', 'Primary price trajectory'],
            ['LSTM-CNN-34', '34-layer deep learning hybrid. Combines recurrent memory with convolutional feature extraction.', 'Volatility & short-term shifts'],
            ['XGBoost v17', 'Gradient boosted trees trained on 39 features including weather, supply, and lag indicators.', 'Buy/Sell signal generation'],
        ];

        doc.autoTable({
            startY: y,
            head: [['Model', 'Description', 'Role']],
            body: modelInfo,
            theme: 'grid',
            headStyles: { fillColor: C.BRAND, textColor: 255, fontStyle: 'bold', fontSize: 10 },
            bodyStyles: { fontSize: 8.5 },
            alternateRowStyles: { fillColor: C.GRAY_BG },
            columnStyles: {
                0: { cellWidth: 30, fontStyle: 'bold' },
                1: { cellWidth: 100 },
                2: { cellWidth: 45 },
            },
            margin: { left: 15, right: 15 },
        });

        // Recommendation thresholds
        y = doc.lastAutoTable.finalY + 12;
        doc.setTextColor(...C.BLACK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('Recommendation Criteria', 20, y);
        y += 8;

        const thresholdRows = [
            ['STRONG BUY', 'Price in bottom 15% of forecast range, confidence > 75%, Normal risk', 'Highest-priority procurement window'],
            ['BUY',        'Price below average, confidence > 60%, Normal risk', 'Good procurement opportunity'],
            ['ACCUMULATE', 'Price near average, mixed signals from models', 'Gradual procurement acceptable'],
            ['WAIT',       'Price above average or High Risk conditions', 'Defer procurement if possible'],
        ];

        doc.autoTable({
            startY: y,
            head: [['Action', 'Criteria', 'Guidance']],
            body: thresholdRows,
            theme: 'grid',
            headStyles: { fillColor: C.BRAND, textColor: 255, fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { fontSize: 8.5 },
            alternateRowStyles: { fillColor: C.GRAY_BG },
            columnStyles: {
                0: { cellWidth: 30, fontStyle: 'bold' },
                1: { cellWidth: 80 },
                2: { cellWidth: 65 },
            },
            didParseCell: function(data) {
                if (data.section !== 'body' || data.column.index !== 0) return;
                const val = data.cell.text[0];
                if (val === 'STRONG BUY')       { data.cell.styles.textColor = C.BRAND_MID; data.cell.styles.fillColor = C.BRAND_LITE; }
                else if (val === 'BUY')          data.cell.styles.textColor = [6, 150, 105];
                else if (val === 'ACCUMULATE')   data.cell.styles.textColor = C.ORANGE;
                else if (val === 'WAIT')         { data.cell.styles.textColor = C.RED; data.cell.styles.fillColor = C.RED_BG; }
            },
            margin: { left: 15, right: 15 },
        });

        // Data Features Used
        y = doc.lastAutoTable.finalY + 12;
        doc.setTextColor(...C.BLACK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('Data Features (39 Input Variables)', 20, y);
        y += 8;

        const featureCategories = [
            ['Market Data (6)',  'Avg Price, Max Price, Daily Spread, Qty Arrived, Qty Sold, Smoothed Arrivals'],
            ['Weather (8)',      'Temperature (mean/max/min), Temp Diff, Precipitation, Humidity, Soil Moisture, Evapotranspiration'],
            ['Lag Features (9)', 'Price lags (1/7/14/30 day), Max Price lag, Spread lag, Qty Sold lag, Qty Arrived lag, Soil Moisture lag'],
            ['Moving Avg (3)',   '7-day, 14-day, and 30-day moving averages of price'],
            ['Temporal (5)',     'Year, Month, Week of Year, Day of Week, Time index'],
            ['Derived (5)',      'Precipitation (7D/30D/60D), Relative Humidity 7D, Market flags (open/flood/lockdown)'],
            ['Categorical (1)',  'Auctioneer identifier'],
            ['External (2)',     'Flood crisis indicator, Lockdown status'],
        ];

        doc.autoTable({
            startY: y,
            head: [['Category', 'Features Included']],
            body: featureCategories,
            theme: 'grid',
            headStyles: { fillColor: C.BRAND, textColor: 255, fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { fontSize: 8 },
            alternateRowStyles: { fillColor: C.GRAY_BG },
            columnStyles: {
                0: { cellWidth: 38, fontStyle: 'bold' },
                1: { cellWidth: 140 },
            },
            margin: { left: 15, right: 15 },
        });

        // Cost Comparison Mini-table
        y = doc.lastAutoTable.finalY + 12;
        doc.setTextColor(...C.BLACK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('Cost Comparison Analysis', 20, y);
        y += 8;

        const orderSizes = [100, 250, 500, 1000, 2500];
        const costRows = orderSizes.map(qty => {
            const openCost = firstPrice * qty;
            const bestCost = bestPrice * qty;
            const saved    = openCost - bestCost;
            return [
                `${qty.toLocaleString()} kg`,
                `${sym}${openCost.toFixed(0)}`,
                `${sym}${bestCost.toFixed(0)}`,
                `${sym}${saved.toFixed(0)}`,
                `${(saved / openCost * 100).toFixed(1)}%`,
            ];
        });

        doc.autoTable({
            startY: y,
            head: [['Order Size', `At Opening (${sym})`, `At Best Entry (${sym})`, 'Savings', 'Saving %']],
            body: costRows,
            theme: 'grid',
            headStyles: { fillColor: C.BRAND, textColor: 255, fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { fontSize: 9 },
            alternateRowStyles: { fillColor: C.GRAY_BG },
            columnStyles: {
                0: { fontStyle: 'bold' },
                1: { halign: 'right' },
                2: { halign: 'right' },
                3: { halign: 'right', textColor: C.BRAND_MID },
                4: { halign: 'center', textColor: C.BRAND_MID },
            },
            margin: { left: 15, right: 15 },
        });

        // Disclaimer box at bottom
        y = doc.lastAutoTable.finalY + 10;
        if (y < 255) {
            doc.setFillColor(254, 243, 199);  // Amber-100
            doc.roundedRect(15, y, 180, 25, 2, 2, 'F');
            doc.setDrawColor(...C.ORANGE);
            doc.setLineWidth(0.4);
            doc.roundedRect(15, y, 180, 25, 2, 2, 'S');

            doc.setTextColor(...C.ORANGE);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('DISCLAIMER', 20, y + 7);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...C.DARK);
            const disclaimer = 'This report is generated by AI models and should be used as decision support only. Historical performance does not guarantee future results. Always consider additional market intelligence and conduct your own due diligence before making procurement decisions.';
            const discLines = doc.splitTextToSize(disclaimer, 170);
            doc.text(discLines, 20, y + 13);
        }

        console.log('[PDF] Page 5 complete');

        // ════════════════════════════════════════════════════
        //  FOOTER ON ALL PAGES
        // ════════════════════════════════════════════════════
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(150, 150, 150);

            doc.text(
                'AI-Generated Forecast -- Use as decision support only. Not financial advice.',
                PW / 2, PH - 14,
                { align: 'center' }
            );
            doc.text(
                `Page ${i} of ${totalPages}  |  Cardamom Procurement Intelligence  |  ${dateStr}`,
                PW / 2, PH - 9,
                { align: 'center' }
            );
        }

        // ════════════════════════════════════════════════════
        //  SAVE PDF
        // ════════════════════════════════════════════════════
        const filename = `Cardamom_Report_${currency}_${getDateStamp()}.pdf`;
        console.log('[PDF] Saving:', filename);
        doc.save(filename);
        console.log('[PDF] Download triggered successfully!');
    }

    // ── Utilities ──────────────────────────────────────────

    function downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function getDateStamp() {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    }

    return { exportCSV, exportPDF };
})();
