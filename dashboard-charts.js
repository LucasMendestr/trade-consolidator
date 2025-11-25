function updateDashboard() {
    let totalTrades = filteredTrades.length;
    let totalPnL = 0; let wins = 0; let losses = 0; let sumProfit = 0; let sumLoss = 0;
    for (let i = 0; i < filteredTrades.length; i++) { const t = filteredTrades[i]; const pnl = parseFloat(t.pnlDollars || 0); totalPnL += pnl; if (pnl > 0) { wins++; sumProfit += pnl; } if (pnl < 0) { losses++; sumLoss += Math.abs(pnl); } }
    const pnlColor = totalPnL >= 0 ? '#4CAF50' : '#f44336';
    const profitFactor = sumLoss > 0 ? (sumProfit / sumLoss) : null;
    const payoffFactor = (wins > 0 && losses > 0) ? ((sumProfit / wins) / (sumLoss / losses)) : null;
    const hitRate = (wins + losses) > 0 ? (wins / (wins + losses)) : 0;
    const closed = []; for (let i = 0; i < filteredTrades.length; i++) { if (filteredTrades[i].status === 'Closed') closed.push(filteredTrades[i]); }
    const dailyMap = {}; let maxGain = null, maxLoss = null;
    for (let i = 0; i < closed.length; i++) { const t = closed[i]; const pnl = parseFloat(t.pnlDollars || 0); const d = new Date(t.endTime); if (!isNaN(d)) { const k = d.toISOString().split('T')[0]; dailyMap[k] = (dailyMap[k] || 0) + pnl; } if (pnl > 0) { if (maxGain === null || pnl > maxGain) maxGain = pnl; } if (pnl < 0) { if (maxLoss === null || pnl < maxLoss) maxLoss = pnl; } }
    const days = Object.keys(dailyMap); let bestDay = null, worstDay = null, sumDaily = 0;
    for (let i = 0; i < days.length; i++) { const v = dailyMap[days[i]]; sumDaily += v; if (bestDay === null || v > bestDay) bestDay = v; if (worstDay === null || v < worstDay) worstDay = v; }
    const avgPerTrade = totalTrades > 0 ? (totalPnL / totalTrades) : null;
    const avgPerDay = days.length > 0 ? (sumDaily / days.length) : null;
    const sorted = closed.slice().sort(function(a, b) { return new Date(a.endTime) - new Date(b.endTime); });
    let maxWinStreak = 0, maxLossStreak = 0, curW = 0, curL = 0;
    for (let i = 0; i < sorted.length; i++) { const v = parseFloat(sorted[i].pnlDollars || 0); if (v > 0) { curW++; curL = 0; } else if (v < 0) { curL++; curW = 0; } else { curW = 0; curL = 0; } if (curW > maxWinStreak) maxWinStreak = curW; if (curL > maxLossStreak) maxLossStreak = curL; }
    const avgGain = wins > 0 ? (sumProfit / wins) : null; const avgLoss = losses > 0 ? (sumLoss / losses) : null;
    var hitPct = (hitRate * 100);
    var posShare = wins + losses > 0 ? (wins / (wins + losses)) : 0;
    var negShare = wins + losses > 0 ? (losses / (wins + losses)) : 0;
    var rrShare = (avgGain != null || avgLoss != null) ? ((avgGain || 0) / ((avgGain || 0) + (avgLoss || 0))) : 0;
    var maxAbs = Math.max(Math.abs(maxGain || 0), Math.abs(maxLoss || 0)) || 1;
    var bestAbs = Math.max(Math.abs(bestDay || 0), Math.abs(worstDay || 0)) || 1;
    document.getElementById('statsGrid').innerHTML = 
        '<div class="stat-card col-span-6 card-primary">' +
            '<div class="card-title">PnL Total</div>' +
            '<div class="kpi-row">' +
                '<div class="kpi" style="grid-column: span 3"><div class="label">Total</div><div class="value" style="color:' + pnlColor + '">$' + totalPnL.toFixed(2) + '</div></div>' +
            '</div>' +
        '</div>' +
        '<div class="stat-card col-span-3">' +
            '<div class="card-title">Ganho Médio / Perda Média</div>' +
            '<div class="kpi-row">' +
                '<div class="kpi"><div class="label">Ganho</div><div class="value" style="color:var(--positive)">$' + (avgGain !== null ? avgGain.toFixed(2) : '-') + '</div></div>' +
                '<div class="kpi"><div class="label">Perda</div><div class="value" style="color:var(--negative)">$' + (avgLoss !== null ? avgLoss.toFixed(2) : '-') + '</div></div>' +
                '<div class="kpi"><div class="label">Payoff</div><div class="value">' + (payoffFactor !== null ? payoffFactor.toFixed(2) : '-') + '</div></div>' +
            '</div>' +
            '<div class="meter"><div class="fill-green" style="width:' + (rrShare * 100).toFixed(0) + '%"></div><div class="fill-red" style="width:' + (100 - (rrShare * 100).toFixed(0)) + '%"></div></div>' +
        '</div>' +
        '<div class="stat-card col-span-3">' +
            '<div class="card-title">Maior Ganho / Maior Perda</div>' +
            '<div class="kpi-row">' +
                '<div class="kpi"><div class="label">Maior Ganho</div><div class="value" style="color:var(--positive)">$' + (maxGain !== null ? maxGain.toFixed(2) : '-') + '</div></div>' +
                '<div class="kpi"><div class="label">Maior Perda</div><div class="value" style="color:var(--negative)">$' + (maxLoss !== null ? maxLoss.toFixed(2) : '-') + '</div></div>' +
                '<div class="kpi"><div class="label">Média/Trade</div><div class="value">' + (avgPerTrade !== null ? ('$' + avgPerTrade.toFixed(2)) : '-') + '</div></div>' +
            '</div>' +
            '<div class="meter"><div class="fill-green" style="width:' + ((Math.abs(maxGain || 0)/maxAbs)*100).toFixed(0) + '%"></div><div class="fill-red" style="width:' + (100 - ((Math.abs(maxGain || 0)/maxAbs)*100).toFixed(0)) + '%"></div></div>' +
        '</div>' +
        '<div class="stat-card col-span-6">' +
            '<div class="card-title">Win/Loss Streak</div>' +
            '<div class="kpi-row">' +
                '<div class="kpi"><div class="label">W Streak</div><div class="value" style="color:var(--positive)">' + maxWinStreak + '</div></div>' +
                '<div class="kpi"><div class="label">L Streak</div><div class="value" style="color:var(--negative)">' + maxLossStreak + '</div></div>' +
                '<div class="kpi"><div class="label">Média/Dia</div><div class="value">' + (avgPerDay !== null ? ('$' + avgPerDay.toFixed(2)) : '-') + '</div></div>' +
            '</div>' +
            '<div class="meter"><div class="fill-green" style="width:' + ((maxWinStreak/Math.max(maxWinStreak + maxLossStreak,1))*100).toFixed(0) + '%"></div><div class="fill-red" style="width:' + ((maxLossStreak/Math.max(maxWinStreak + maxLossStreak,1))*100).toFixed(0) + '%"></div></div>' +
        '</div>' +
        '<div class="stat-card col-span-6">' +
            '<div class="card-title">Melhor/Pior Dia</div>' +
            '<div class="kpi-row">' +
                '<div class="kpi"><div class="label">Melhor</div><div class="value" style="color:var(--positive)">' + (bestDay !== null ? ('$' + bestDay.toFixed(2)) : '-') + '</div></div>' +
                '<div class="kpi"><div class="label">Pior</div><div class="value" style="color:var(--negative)">' + (worstDay !== null ? ('$' + worstDay.toFixed(2)) : '-') + '</div></div>' +
                '<div class="kpi"><div class="label">PF</div><div class="value">' + (profitFactor !== null ? profitFactor.toFixed(2) : '-') + '</div></div>' +
            '</div>' +
            '<div class="meter"><div class="fill-green" style="width:' + ((Math.abs(bestDay||0)/bestAbs)*100).toFixed(0) + '%"></div><div class="fill-red" style="width:' + ((Math.abs(worstDay||0)/bestAbs)*100).toFixed(0) + '%"></div></div>' +
        '</div>' +
        '<div class="stat-card col-span-6">' +
            '<div class="card-title">Taxa de Acerto</div>' +
            '<div class="kpi-row">' +
                '<div class="kpi"><div class="label">Trades</div><div class="value">' + totalTrades + '</div></div>' +
                '<div class="kpi"><div class="label">Wins</div><div class="value" style="color:var(--positive)">' + wins + '</div></div>' +
                '<div class="kpi"><div class="label">Losses</div><div class="value" style="color:var(--negative)">' + losses + '</div></div>' +
            '</div>' +
            '<canvas id="miniHitGauge" class="mini-chart"></canvas>' +
        '</div>';
    renderMiniCards();
}

function renderCharts() {
    const cs = getComputedStyle(document.body);
    const accent = cs.getPropertyValue('--accent').trim() || '#22d3ee';
    const positive = cs.getPropertyValue('--positive').trim() || '#10b981';
    const negative = cs.getPropertyValue('--negative').trim() || '#ef4444';
    const gridColor = cs.getPropertyValue('--grid').trim() || '#334155';
    const textColor = cs.getPropertyValue('--text').trim() || '#e5e7eb';
    if (typeof Chart !== 'undefined') {
        Chart.defaults.font.family = 'Inter, Arial, sans-serif';
        Chart.defaults.color = textColor;
        Chart.defaults.borderColor = gridColor;
    }
    const elDailyCum = document.getElementById('chartDailyCumulative');
    const elDailyBar = document.getElementById('chartDailyBar');
    const elInst = document.getElementById('chartPnlInstrument');
    const elWinRate = document.getElementById('chartWinRateCumulative');
    if (!elDailyCum || !elDailyBar || !elInst || !elWinRate) return;
    const closed = []; for (let i = 0; i < filteredTrades.length; i++) { if (filteredTrades[i].status === 'Closed') closed.push(filteredTrades[i]); }
    const dailyMap = {}; for (let i = 0; i < closed.length; i++) { const t = closed[i]; const d = new Date(t.endTime); if (!isNaN(d)) { const k = d.toISOString().split('T')[0]; const pnl = parseFloat(t.pnlDollars || 0); dailyMap[k] = (dailyMap[k] || 0) + pnl; } }
    const dates = Object.keys(dailyMap).sort(); const dailyVals = dates.map(function(k) { return dailyMap[k]; });
    const cumulative = []; let run = 0; for (let i = 0; i < dailyVals.length; i++) { run += dailyVals[i]; cumulative.push(run); }
    if (charts.dailyCumulative) charts.dailyCumulative.destroy();
    charts.dailyCumulative = new Chart(elDailyCum.getContext('2d'), { type: 'line', data: { labels: dates, datasets: [{ label: 'PnL Diário Acumulado', data: cumulative, borderColor: accent, backgroundColor: 'rgba(34,211,238,0.15)', tension: 0.25 }] }, options: { plugins: { legend: { display: false } }, scales: { x: { grid: { color: gridColor }, ticks: { color: textColor } }, y: { grid: { color: gridColor }, ticks: { color: textColor } } } } });
    if (charts.dailyBar) charts.dailyBar.destroy();
    charts.dailyBar = new Chart(elDailyBar.getContext('2d'), { type: 'bar', data: { labels: dates, datasets: [{ label: 'PnL Diário', data: dailyVals, backgroundColor: dailyVals.map(function(v){ return v >= 0 ? positive : negative; }) }] }, options: { plugins: { legend: { display: false } }, scales: { x: { grid: { color: gridColor }, ticks: { color: textColor } }, y: { grid: { color: gridColor }, ticks: { color: textColor } } } } });
    const instMap = {}; for (let i = 0; i < closed.length; i++) { const ins = closed[i].instrument; const pnl = parseFloat(closed[i].pnlDollars || 0); instMap[ins] = (instMap[ins] || 0) + pnl; }
    const insts = Object.keys(instMap); const instVals = insts.map(function(k) { return instMap[k]; });
    if (charts.pnlInstrument) charts.pnlInstrument.destroy();
    charts.pnlInstrument = new Chart(elInst.getContext('2d'), { type: 'bar', data: { labels: insts, datasets: [{ label: 'PnL por Instrumento', data: instVals, backgroundColor: accent }] }, options: { plugins: { legend: { display: false } }, scales: { x: { grid: { color: gridColor }, ticks: { color: textColor } }, y: { grid: { color: gridColor }, ticks: { color: textColor } } } } });
    let w = 0, l = 0; for (let i = 0; i < closed.length; i++) { const p = parseFloat(closed[i].pnlDollars || 0); if (p > 0) w++; else if (p < 0) l++; }
    const sorted = closed.slice().sort(function(a, b) { return new Date(a.endTime) - new Date(b.endTime); });
    const wrLabels = [], wrData = []; let cw = 0, cl = 0;
    for (let i = 0; i < sorted.length; i++) { const p = parseFloat(sorted[i].pnlDollars || 0); if (p > 0) cw++; else if (p < 0) cl++; const rate = (cw + cl) > 0 ? (cw / (cw + cl)) * 100 : 0; wrLabels.push(new Date(sorted[i].endTime).toLocaleDateString('pt-BR')); wrData.push(rate.toFixed(2)); }
    if (charts.winRate) charts.winRate.destroy();
    charts.winRate = new Chart(elWinRate.getContext('2d'), { type: 'line', data: { labels: wrLabels, datasets: [{ label: 'Win Rate Acumulado (%)', data: wrData, borderColor: positive, backgroundColor: 'rgba(16,185,129,0.15)', tension: 0.25 }] }, options: { plugins: { legend: { display: false } }, scales: { x: { grid: { color: gridColor }, ticks: { color: textColor } }, y: { grid: { color: gridColor }, ticks: { color: textColor } } } } });
}

function renderMiniCards() {
    const cs = getComputedStyle(document.body);
    const positive = cs.getPropertyValue('--positive').trim() || '#10b981';
    const negative = cs.getPropertyValue('--negative').trim() || '#ef4444';
    const accent = cs.getPropertyValue('--accent').trim() || '#22d3ee';
    const gridColor = cs.getPropertyValue('--grid').trim() || '#334155';
    const textColor = cs.getPropertyValue('--text').trim() || '#e5e7eb';
    const pieLabelsPlugin = { id: 'pieLabels', afterDatasetsDraw(chart) { try { const ctx = chart.ctx; const ds = chart.data && chart.data.datasets ? chart.data.datasets[0] : null; if (!ds) return; const meta = chart.getDatasetMeta(0); const total = (ds.data || []).reduce(function(a,b){ return a + (parseFloat(b) || 0); }, 0) || 1; ctx.save(); ctx.font = '600 12px Inter, Arial, sans-serif'; ctx.fillStyle = (chart.options && chart.options.plugins && chart.options.plugins.pieLabels && chart.options.plugins.pieLabels.color) || textColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; for (let i = 0; i < meta.data.length; i++) { const arc = meta.data[i]; const val = parseFloat(ds.data[i] || 0); const pct = Math.round((val / total) * 100); const pos = arc.tooltipPosition(); ctx.fillText(pct + '%', pos.x, pos.y); } ctx.restore(); } catch (e) {} } };
    if (typeof Chart !== 'undefined' && !charts._pieLabelsRegistered) { Chart.register(pieLabelsPlugin); charts._pieLabelsRegistered = true; }
    const pieEl = document.getElementById('miniTradesPie');
    const gaugeEl = document.getElementById('miniHitGauge');
    if (pieEl) {
        let wins = 0, losses = 0; for (let i = 0; i < filteredTrades.length; i++) { const p = parseFloat(filteredTrades[i].pnlDollars || 0); if (p > 0) wins++; else if (p < 0) losses++; }
        if (charts.miniPie) charts.miniPie.destroy();
        charts.miniPie = new Chart(pieEl.getContext('2d'), { type: 'pie', data: { labels: ['Wins','Losses'], datasets: [{ data: [wins, losses], backgroundColor: [positive, negative] }] }, options: { plugins: { legend: { display: false }, pieLabels: { color: textColor } } } });
    }
    if (gaugeEl) {
        let wins = 0, losses = 0; for (let i = 0; i < filteredTrades.length; i++) { const p = parseFloat(filteredTrades[i].pnlDollars || 0); if (p > 0) wins++; else if (p < 0) losses++; }
        const hit = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;
        if (charts.miniGauge) charts.miniGauge.destroy();
        charts.miniGauge = new Chart(gaugeEl.getContext('2d'), { type: 'doughnut', data: { labels: ['Win','Loss'], datasets: [{ data: [hit, 100-hit], backgroundColor: [positive, negative] }] }, options: { plugins: { legend: { display: false } }, cutout: '70%', circumference: 270, rotation: 225 } });
    }
}