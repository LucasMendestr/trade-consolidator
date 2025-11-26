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
        '<div class="stat-card col-span-6 card-winrate">' +
            '<div class="card-title">Taxa de Acerto</div>' +
            '<div class="kpi-row">' +
                '<div class="kpi"><div class="label">Trades</div><div class="value">' + totalTrades + '</div></div>' +
                '<div class="kpi"><div class="label">Wins</div><div class="value" style="color:var(--positive)">' + wins + '</div></div>' +
                '<div class="kpi"><div class="label">Losses</div><div class="value" style="color:var(--negative)">' + losses + '</div></div>' +
            '</div>' +
            '<canvas id="miniHitGauge" class="donut-chart"></canvas>' +
        '</div>';
    renderMiniCards();
    // Hold time & expectancy metrics
    function parseTime(t){ const d = new Date(t); return isNaN(d) ? null : d.getTime(); }
    function avgDuration(msArray){ if (!msArray.length) return null; const s = msArray.reduce(function(a,b){ return a + b; }, 0); return Math.round(s / msArray.length); }
    const durAll = [], durWin = [], durLoss = [], durScratch = [];
    for (let i = 0; i < filteredTrades.length; i++) {
        const t = filteredTrades[i];
        const start = parseTime(t.startTime || t.entryTime);
        const end = parseTime(t.endTime || t.exitTime);
        if (start !== null && end !== null && end >= start) {
            const ms = end - start;
            durAll.push(ms);
            const pnl = parseFloat(t.pnlDollars || 0);
            if (pnl > 0) durWin.push(ms); else if (pnl < 0) durLoss.push(ms); else durScratch.push(ms);
        }
    }
    const avgHoldAll = avgDuration(durAll);
    const avgHoldWin = avgDuration(durWin);
    const avgHoldLoss = avgDuration(durLoss);
    const avgHoldScratch = avgDuration(durScratch);
    let rSum = 0, rCount = 0;
    for (let i = 0; i < filteredTrades.length; i++) { let r = filteredTrades[i].rMultiple; if (r === undefined) r = filteredTrades[i].r_multiple; if (r === undefined) r = filteredTrades[i].r; if (r === undefined) { const risk = parseFloat(filteredTrades[i].risk || filteredTrades[i].initialRisk || 0); const pnl = parseFloat(filteredTrades[i].pnlDollars || 0); if (!isNaN(risk) && risk > 0) r = pnl / risk; else r = 0; } r = parseFloat(r); if (!isNaN(r)) { rSum += r; rCount++; } }
    const avgRMultiple = rCount ? (rSum / rCount) : null;
    const winPct = totalTrades ? (wins / totalTrades) : 0;
    const lossPct = totalTrades ? (losses / totalTrades) : 0;
    const avgWinP = wins ? (sumProfit / wins) : 0;
    const avgLossP = losses ? (sumLoss / losses) : 0;
    const expectancy = (winPct * avgWinP) - (lossPct * Math.abs(avgLossP));

    renderStatisticsTable({
        totalPnL: totalPnL,
        totalTrades: totalTrades,
        wins: wins,
        losses: losses,
        breakEven: (function(){ let c=0; for (let i=0;i<filteredTrades.length;i++){ const p=parseFloat(filteredTrades[i].pnlDollars||0); if (p===0) c++; } return c; })(),
        avgGain: avgGain,
        avgLoss: avgLoss,
        profitFactor: profitFactor,
        payoffFactor: payoffFactor,
        maxWinStreak: maxWinStreak,
        maxLossStreak: maxLossStreak,
        maxGain: maxGain,
        maxLoss: maxLoss,
        bestDay: bestDay,
        worstDay: worstDay,
        avgPerTrade: avgPerTrade,
        avgPerDay: avgPerDay,
        tradingDays: (function(){ const set=new Set(); for (let i=0;i<filteredTrades.length;i++){ const d=new Date(filteredTrades[i].endTime||filteredTrades[i].startTime); if(!isNaN(d)) set.add(d.toISOString().slice(0,10)); } return set.size; })(),
        avgHoldAll: avgHoldAll,
        avgHoldWin: avgHoldWin,
        avgHoldLoss: avgHoldLoss,
        avgHoldScratch: avgHoldScratch,
        avgRMultiple: avgRMultiple,
        expectancy: expectancy
    });
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
        Chart.defaults.font.size = 12;
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
    const gCum = elDailyCum.getContext('2d').createLinearGradient(0, 0, 0, elDailyCum.height);
    gCum.addColorStop(0, 'rgba(34,197,94,0.15)');
    gCum.addColorStop(1, 'rgba(34,197,94,0.00)');
    charts.dailyCumulative = new Chart(elDailyCum.getContext('2d'), { type: 'line', data: { labels: dates, datasets: [{ label: 'PnL Diário Acumulado', data: cumulative, borderColor: accent, backgroundColor: gCum, tension: 0.35, borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: true, padding: 8 } }, scales: { x: { grid: { color: 'rgba(148,163,184,0.2)' }, ticks: { color: textColor } }, y: { grid: { color: 'rgba(148,163,184,0.2)' }, ticks: { color: textColor } } } } });
    if (charts.dailyBar) charts.dailyBar.destroy();
    charts.dailyBar = new Chart(elDailyBar.getContext('2d'), { type: 'bar', data: { labels: dates, datasets: [{ label: 'PnL Diário', data: dailyVals, backgroundColor: dailyVals.map(function(v){ return v >= 0 ? positive : negative; }), borderColor: '#ffffff22', borderWidth: 1, categoryPercentage: 0.7, barPercentage: 0.8 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: true, padding: 8 } }, scales: { x: { grid: { color: 'rgba(148,163,184,0.2)' }, ticks: { color: textColor } }, y: { grid: { color: 'rgba(148,163,184,0.2)' }, ticks: { color: textColor } } } } });
    const instMap = {}; for (let i = 0; i < closed.length; i++) { const ins = closed[i].instrument; const pnl = parseFloat(closed[i].pnlDollars || 0); instMap[ins] = (instMap[ins] || 0) + pnl; }
    const insts = Object.keys(instMap); const instVals = insts.map(function(k) { return instMap[k]; });
    if (charts.pnlInstrument) charts.pnlInstrument.destroy();
    charts.pnlInstrument = new Chart(elInst.getContext('2d'), { type: 'bar', data: { labels: insts, datasets: [{ label: 'PnL por Instrumento', data: instVals, backgroundColor: accent, borderColor: '#ffffff22', borderWidth: 1, categoryPercentage: 0.7, barPercentage: 0.8 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: true, padding: 8 } }, scales: { x: { grid: { color: 'rgba(148,163,184,0.2)' }, ticks: { color: textColor } }, y: { grid: { color: 'rgba(148,163,184,0.2)' }, ticks: { color: textColor } } } } });
    let w = 0, l = 0; for (let i = 0; i < closed.length; i++) { const p = parseFloat(closed[i].pnlDollars || 0); if (p > 0) w++; else if (p < 0) l++; }
    const sorted = closed.slice().sort(function(a, b) { return new Date(a.endTime) - new Date(b.endTime); });
    const wrLabels = [], wrData = []; let cw = 0, cl = 0;
    for (let i = 0; i < sorted.length; i++) { const p = parseFloat(sorted[i].pnlDollars || 0); if (p > 0) cw++; else if (p < 0) cl++; const rate = (cw + cl) > 0 ? (cw / (cw + cl)) * 100 : 0; wrLabels.push(new Date(sorted[i].endTime).toLocaleDateString('pt-BR')); wrData.push(rate.toFixed(2)); }
    if (charts.winRate) charts.winRate.destroy();
    const gWr = elWinRate.getContext('2d').createLinearGradient(0, 0, 0, elWinRate.height);
    gWr.addColorStop(0, 'rgba(16,185,129,0.10)');
    gWr.addColorStop(1, 'rgba(16,185,129,0.00)');
    charts.winRate = new Chart(elWinRate.getContext('2d'), { type: 'line', data: { labels: wrLabels, datasets: [{ label: 'Win Rate Acumulado (%)', data: wrData, borderColor: positive, backgroundColor: gWr, tension: 0.35, borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: true, padding: 8 } }, scales: { x: { grid: { color: 'rgba(148,163,184,0.2)' }, ticks: { color: textColor } }, y: { grid: { color: 'rgba(148,163,184,0.2)' }, ticks: { color: textColor } } } } });

    renderWeeklyCharts();
}

function renderMiniCards() {
    const cs = getComputedStyle(document.body);
    const positive = cs.getPropertyValue('--positive').trim() || '#10b981';
    const negative = cs.getPropertyValue('--negative').trim() || '#ef4444';
    const accent = cs.getPropertyValue('--accent').trim() || '#22d3ee';
    const gridColor = cs.getPropertyValue('--grid').trim() || '#334155';
    const textColor = cs.getPropertyValue('--text').trim() || '#e5e7eb';
    // remove custom percentage labels plugin to keep charts clean
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
function renderStatisticsTable(m) {
    function fmtCurrency(v){ if (v===null||v===undefined||isNaN(v)) return '-'; const s = (v>=0?'+':'-') + '$' + Math.abs(v).toFixed(2); return s; }
    function fmtNumber(v){ if (v===null||v===undefined||isNaN(v)) return '-'; return String(v); }
    function fmtDuration(ms){ if (ms===null||ms===undefined) return '-'; const sec=Math.floor(ms/1000); const d=Math.floor(sec/86400); const h=Math.floor((sec%86400)/3600); const m=Math.floor((sec%3600)/60); const s=sec%60; if (d>0) return d+'d '+h+'h '+m+'m'; return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); }
    const el = document.getElementById('statisticsTable'); if (!el) return;
    el.innerHTML =
      '<div class="stats-group" title="Performance metrics">' +
        '<div class="group-title">Performance</div>' +
        '<div class="stats-list">' +
          '<div class="stats-name">Total P&L</div><div class="stats-value" style="color:' + (m.totalPnL>=0?'var(--positive)':'var(--negative)') + '">' + fmtCurrency(m.totalPnL) + '</div>' +
          '<div class="stats-name">Profit Factor</div><div class="stats-value">' + (m.profitFactor!==null?m.profitFactor.toFixed(2):'-') + '</div>' +
          '<div class="stats-name">Payoff Factor</div><div class="stats-value">' + (m.payoffFactor!==null?m.payoffFactor.toFixed(2):'-') + '</div>' +
          '<div class="stats-name">Avg PnL / Trade</div><div class="stats-value">' + fmtCurrency(m.avgPerTrade) + '</div>' +
          '<div class="stats-name">Avg PnL / Day</div><div class="stats-value">' + fmtCurrency(m.avgPerDay) + '</div>' +
          '<div class="stats-name">Trading Days</div><div class="stats-value">' + fmtNumber(m.tradingDays) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="stats-group" title="Distribution and streaks">' +
        '<div class="group-title">Distribution</div>' +
        '<div class="stats-list">' +
          '<div class="stats-name">Total Trades</div><div class="stats-value">' + fmtNumber(m.totalTrades) + '</div>' +
          '<div class="stats-name">Winning Trades</div><div class="stats-value" style="color:var(--positive)">' + fmtNumber(m.wins) + '</div>' +
          '<div class="stats-name">Losing Trades</div><div class="stats-value" style="color:var(--negative)">' + fmtNumber(m.losses) + '</div>' +
          '<div class="stats-name">Break Even Trades</div><div class="stats-value">' + fmtNumber(m.breakEven) + '</div>' +
          '<div class="stats-name">Avg Winning Trade</div><div class="stats-value" style="color:var(--positive)">' + fmtCurrency(m.avgGain) + '</div>' +
          '<div class="stats-name">Avg Losing Trade</div><div class="stats-value" style="color:var(--negative)">' + fmtCurrency(m.avgLoss) + '</div>' +
          '<div class="stats-name">Max Consecutive Wins</div><div class="stats-value" style="color:var(--positive)">' + fmtNumber(m.maxWinStreak) + '</div>' +
          '<div class="stats-name">Max Consecutive Losses</div><div class="stats-value" style="color:var(--negative)">' + fmtNumber(m.maxLossStreak) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="stats-group" title="Extremes and fees">' +
        '<div class="group-title">Extremes & Fees</div>' +
        '<div class="stats-list">' +
          '<div class="stats-name">Largest Profit</div><div class="stats-value" style="color:var(--positive)">' + fmtCurrency(m.maxGain) + '</div>' +
          '<div class="stats-name">Largest Loss</div><div class="stats-value" style="color:var(--negative)">' + fmtCurrency(m.maxLoss) + '</div>' +
          '<div class="stats-name">Best Day</div><div class="stats-value" style="color:var(--positive)">' + fmtCurrency(m.bestDay) + '</div>' +
          '<div class="stats-name">Worst Day</div><div class="stats-value" style="color:var(--negative)">' + fmtCurrency(m.worstDay) + '</div>' +
          '<div class="stats-name">Total Commissions/Fees/Swap</div><div class="stats-value">-</div>' +
          '<div class="stats-name">Average Daily Volume</div><div class="stats-value">-</div>' +
        '</div>' +
      '</div>' +
      '<div class="stats-group" title="Hold time and expectancy">' +
        '<div class="group-title">Hold Time & Expectancy</div>' +
        '<div class="stats-list">' +
          '<div class="stats-name">Avg Hold Time (All)</div><div class="stats-value">' + fmtDuration(m.avgHoldAll) + '</div>' +
          '<div class="stats-name">Avg Hold Time (Winning)</div><div class="stats-value">' + fmtDuration(m.avgHoldWin) + '</div>' +
          '<div class="stats-name">Avg Hold Time (Losing)</div><div class="stats-value">' + fmtDuration(m.avgHoldLoss) + '</div>' +
          '<div class="stats-name">Avg Hold Time (Scratch)</div><div class="stats-value">' + fmtDuration(m.avgHoldScratch) + '</div>' +
          '<div class="stats-name">Avg R-multiple</div><div class="stats-value">' + (m.avgRMultiple!==null?m.avgRMultiple.toFixed(2):'-') + '</div>' +
          '<div class="stats-name">Trade Expectancy</div><div class="stats-value">' + fmtCurrency(m.expectancy) + '</div>' +
        '</div>' +
      '</div>';
}
function renderWeeklyCharts(){
    const cs = getComputedStyle(document.body);
    const accent = cs.getPropertyValue('--accent').trim() || '#22d3ee';
    const positive = cs.getPropertyValue('--positive').trim() || '#10b981';
    const negative = cs.getPropertyValue('--negative').trim() || '#ef4444';
    const gridColor = cs.getPropertyValue('--grid').trim() || '#334155';
    const textColor = cs.getPropertyValue('--text').trim() || '#e5e7eb';
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const labelsPt = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
    const counts = [0,0,0,0,0,0,0];
    const pnlByDay = [0,0,0,0,0,0,0];
    const closed = []; for (let i=0;i<filteredTrades.length;i++){ const t=filteredTrades[i]; if (t.status === 'Closed') closed.push(t); }
    let minDate=null, maxDate=null;
    for (let i=0;i<closed.length;i++){
        const t = closed[i]; const d = new Date(t.endTime || t.startTime); if (isNaN(d)) continue; const idx = d.getDay(); counts[idx]++; pnlByDay[idx] += parseFloat(t.pnlDollars || 0);
        const iso = d.getTime(); if(minDate===null||iso<minDate) minDate=iso; if(maxDate===null||iso>maxDate) maxDate=iso;
    }
    const rangeText = (minDate && maxDate) ? (new Date(minDate).toLocaleDateString('pt-BR') + ' — ' + new Date(maxDate).toLocaleDateString('pt-BR')) : '';
    const r1 = document.getElementById('weekRange1'); const r2 = document.getElementById('weekRange2'); if (r1) r1.textContent = rangeText; if (r2) r2.textContent = rangeText;
    const elDist = document.getElementById('chartTradesByWeekday'); const elPerf = document.getElementById('chartPnlByWeekday');
    if (charts.tradesByWeekday) charts.tradesByWeekday.destroy();
    charts.tradesByWeekday = new Chart(elDist.getContext('2d'), { type: 'bar', data: { labels: labelsPt, datasets: [{ label: 'Trades', data: counts, backgroundColor: accent, borderColor: '#ffffff22', borderWidth: 1 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: true, padding: 8 } }, scales: { x: { grid: { color: 'rgba(148,163,184,0.2)' }, ticks: { color: textColor } }, y: { grid: { color: 'rgba(148,163,184,0.1)' }, ticks: { color: textColor } } } } });
    if (charts.pnlByWeekday) charts.pnlByWeekday.destroy();
    const colors = pnlByDay.map(function(v){ return v>=0?positive:negative; });
    charts.pnlByWeekday = new Chart(elPerf.getContext('2d'), { type: 'bar', data: { labels: labelsPt, datasets: [{ label: 'PnL', data: pnlByDay, backgroundColor: colors, borderColor: '#ffffff22', borderWidth: 1 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: true, padding: 8 } }, scales: { x: { grid: { color: 'rgba(148,163,184,0.2)' }, ticks: { color: textColor } }, y: { grid: { color: 'rgba(148,163,184,0.1)' }, ticks: { color: textColor } } } } });

    renderWeekSummary(labelsPt, counts, pnlByDay, closed);
}

function renderWeekSummary(labels, counts, pnlByDay, closed){
    const el = document.getElementById('weekSummaryTable'); if (!el) return;
    const vols = [0,0,0,0,0,0,0]; const wins=[0,0,0,0,0,0,0]; const trades=[0,0,0,0,0,0,0]; let totalProfit=[0,0,0,0,0,0,0], totalLoss=[0,0,0,0,0,0,0];
    for (let i=0;i<closed.length;i++){ const t=closed[i]; const d=new Date(t.endTime||t.startTime); if(isNaN(d)) continue; const idx=d.getDay(); const pnl=parseFloat(t.pnlDollars||0); trades[idx]++; vols[idx]+=parseFloat(t.volume||0)||0; if(pnl>0){ wins[idx]++; totalProfit[idx]+=pnl; } else if(pnl<0){ totalLoss[idx]+=Math.abs(pnl); } }
    function fmtCurrency(v){ if(!v&&v!==0) return '-'; return (v>=0?'+':'-') + '$' + Math.abs(v).toFixed(2); }
    el.innerHTML = '<div class="group-title" style="margin-bottom:8px;">Resumo por Dia da Semana</div>' +
      '<table><thead><tr><th>Dia</th><th>Net Profit</th><th>Winning %</th><th>Total Profits</th><th>Total Loss</th><th>Trades</th><th>Volume</th></tr></thead><tbody>' +
      labels.map(function(lbl, i){ const net=pnlByDay[i]; const total=trades[i]||0; const winPct=total? (wins[i]/total)*100 : 0; return '<tr>'+
        '<td>'+lbl+'</td>'+
        '<td class="'+(net>=0?'pos':'neg')+'">'+fmtCurrency(net)+'</td>'+
        '<td><div class="winbar"><div class="winfill" style="width:'+winPct.toFixed(0)+'%"></div></div></td>'+
        '<td class="pos">'+fmtCurrency(totalProfit[i]||0)+'</td>'+
        '<td class="neg">'+fmtCurrency(-(totalLoss[i]||0))+'</td>'+
        '<td>'+ (trades[i]||0) +'</td>'+
        '<td>'+ ((vols[i]||0).toFixed ? (vols[i]||0).toFixed(1) : '-') +'</td>'+
      '</tr>'; }).join('') + '</tbody></table>';
}
