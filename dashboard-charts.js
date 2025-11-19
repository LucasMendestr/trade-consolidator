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
    document.getElementById('statsGrid').innerHTML = 
        '<div class="stat-card"><div class="stat-label">Total de Trades</div><div class="stat-value">' + totalTrades + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Wins</div><div class="stat-value">' + wins + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Losses</div><div class="stat-value">' + losses + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">PnL Total</div><div class="stat-value" style="color: ' + pnlColor + '">$' + totalPnL.toFixed(2) + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Profit Factor</div><div class="stat-value">' + (profitFactor !== null ? profitFactor.toFixed(2) : '-') + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Payoff Factor</div><div class="stat-value">' + (payoffFactor !== null ? payoffFactor.toFixed(2) : '-') + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Taxa de Acerto</div><div class="stat-value">' + (hitRate * 100).toFixed(2) + '%</div></div>' +
        '<div class="stat-card"><div class="stat-label">Maior Ganho (Trade)</div><div class="stat-value">' + (maxGain !== null ? ('$' + maxGain.toFixed(2)) : '-') + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Maior Perda (Trade)</div><div class="stat-value">' + (maxLoss !== null ? ('$' + maxLoss.toFixed(2)) : '-') + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Média PnL/Trade</div><div class="stat-value">' + (avgPerTrade !== null ? ('$' + avgPerTrade.toFixed(2)) : '-') + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Média PnL/Dia</div><div class="stat-value">' + (avgPerDay !== null ? ('$' + avgPerDay.toFixed(2)) : '-') + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Streaks</div><div class="stat-value">W:' + maxWinStreak + ' / L:' + maxLossStreak + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Risco x Recompensa</div><div class="stat-value">G:$' + (avgGain !== null ? avgGain.toFixed(2) : '-') + ' / P:$' + (avgLoss !== null ? avgLoss.toFixed(2) : '-') + '</div></div>';
}

function renderCharts() {
    const elDailyCum = document.getElementById('chartDailyCumulative');
    const elDailyBar = document.getElementById('chartDailyBar');
    const elInst = document.getElementById('chartPnlInstrument');
    const elPosNeg = document.getElementById('chartPosNeg');
    const elWinRate = document.getElementById('chartWinRateCumulative');
    if (!elDailyCum || !elDailyBar || !elInst || !elPosNeg || !elWinRate) return;
    const closed = []; for (let i = 0; i < filteredTrades.length; i++) { if (filteredTrades[i].status === 'Closed') closed.push(filteredTrades[i]); }
    const dailyMap = {}; for (let i = 0; i < closed.length; i++) { const t = closed[i]; const d = new Date(t.endTime); if (!isNaN(d)) { const k = d.toISOString().split('T')[0]; const pnl = parseFloat(t.pnlDollars || 0); dailyMap[k] = (dailyMap[k] || 0) + pnl; } }
    const dates = Object.keys(dailyMap).sort(); const dailyVals = dates.map(function(k) { return dailyMap[k]; });
    const cumulative = []; let run = 0; for (let i = 0; i < dailyVals.length; i++) { run += dailyVals[i]; cumulative.push(run); }
    if (charts.dailyCumulative) charts.dailyCumulative.destroy();
    charts.dailyCumulative = new Chart(elDailyCum.getContext('2d'), { type: 'line', data: { labels: dates, datasets: [{ label: 'PnL Diário Acumulado', data: cumulative, borderColor: '#7c4dff', backgroundColor: 'rgba(124,77,255,0.2)', tension: 0.25 }] }, options: { plugins: { legend: { display: false } } } });
    if (charts.dailyBar) charts.dailyBar.destroy();
    charts.dailyBar = new Chart(elDailyBar.getContext('2d'), { type: 'bar', data: { labels: dates, datasets: [{ label: 'PnL Diário', data: dailyVals, backgroundColor: dailyVals.map(function(v){ return v >= 0 ? 'rgba(166,244,0,0.7)' : 'rgba(244,67,54,0.7)'; }) }] }, options: { plugins: { legend: { display: false } } } });
    const instMap = {}; for (let i = 0; i < closed.length; i++) { const ins = closed[i].instrument; const pnl = parseFloat(closed[i].pnlDollars || 0); instMap[ins] = (instMap[ins] || 0) + pnl; }
    const insts = Object.keys(instMap); const instVals = insts.map(function(k) { return instMap[k]; });
    if (charts.pnlInstrument) charts.pnlInstrument.destroy();
    charts.pnlInstrument = new Chart(elInst.getContext('2d'), { type: 'bar', data: { labels: insts, datasets: [{ label: 'PnL por Instrumento', data: instVals, backgroundColor: 'rgba(106,90,205,0.7)' }] }, options: { plugins: { legend: { display: false } } } });
    let w = 0, l = 0; for (let i = 0; i < closed.length; i++) { const p = parseFloat(closed[i].pnlDollars || 0); if (p > 0) w++; else if (p < 0) l++; }
    if (charts.posNeg) charts.posNeg.destroy();
    charts.posNeg = new Chart(elPosNeg.getContext('2d'), { type: 'pie', data: { labels: ['Positivos', 'Negativos'], datasets: [{ data: [w, l], backgroundColor: ['#a6f400', '#7c4dff'] }] } });
    const sorted = closed.slice().sort(function(a, b) { return new Date(a.endTime) - new Date(b.endTime); });
    const wrLabels = [], wrData = []; let cw = 0, cl = 0;
    for (let i = 0; i < sorted.length; i++) { const p = parseFloat(sorted[i].pnlDollars || 0); if (p > 0) cw++; else if (p < 0) cl++; const rate = (cw + cl) > 0 ? (cw / (cw + cl)) * 100 : 0; wrLabels.push(new Date(sorted[i].endTime).toLocaleDateString('pt-BR')); wrData.push(rate.toFixed(2)); }
    if (charts.winRate) charts.winRate.destroy();
    charts.winRate = new Chart(elWinRate.getContext('2d'), { type: 'line', data: { labels: wrLabels, datasets: [{ label: 'Win Rate Acumulado (%)', data: wrData, borderColor: '#a6f400', backgroundColor: 'rgba(166,244,0,0.2)', tension: 0.25 }] }, options: { plugins: { legend: { display: false } } } });
}