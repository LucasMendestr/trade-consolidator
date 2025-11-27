import { state } from '../state.js'

export function updateDashboard() {
  let totalTrades = state.filteredTrades.length
  let totalPnL = 0; let wins = 0; let losses = 0; let sumProfit = 0; let sumLoss = 0
  for (let i = 0; i < state.filteredTrades.length; i++) { const t = state.filteredTrades[i]; const pnl = parseFloat(t.pnlDollars || 0); totalPnL += pnl; if (pnl > 0) { wins++; sumProfit += pnl } if (pnl < 0) { losses++; sumLoss += Math.abs(pnl) } }
  const pnlColor = totalPnL >= 0 ? '#4CAF50' : '#f44336'
  const profitFactor = sumLoss > 0 ? (sumProfit / sumLoss) : null
  const payoffFactor = (wins > 0 && losses > 0) ? ((sumProfit / wins) / (sumLoss / losses)) : null
  const hitRate = (wins + losses) > 0 ? (wins / (wins + losses)) : 0
  const closed = []; for (let i = 0; i < state.filteredTrades.length; i++) { if (state.filteredTrades[i].status === 'Closed') closed.push(state.filteredTrades[i]) }
  const dailyMap = {}; let maxGain = null, maxLoss = null
  for (let i = 0; i < closed.length; i++) { const t = closed[i]; const pnl = parseFloat(t.pnlDollars || 0); const d = new Date(t.endTime); if (!isNaN(d)) { const k = d.toISOString().split('T')[0]; dailyMap[k] = (dailyMap[k] || 0) + pnl } if (pnl > 0) { if (maxGain === null || pnl > maxGain) maxGain = pnl } if (pnl < 0) { if (maxLoss === null || pnl < maxLoss) maxLoss = pnl } }
  const days = Object.keys(dailyMap); let bestDay = null, worstDay = null, sumDaily = 0
  for (let i = 0; i < days.length; i++) { const v = dailyMap[days[i]]; sumDaily += v; if (bestDay === null || v > bestDay) bestDay = v; if (worstDay === null || v < worstDay) worstDay = v }
  const avgPerTrade = totalTrades > 0 ? (totalPnL / totalTrades) : null
  const avgPerDay = days.length > 0 ? (sumDaily / days.length) : null
  let maxWinStreak = 0, maxLossStreak = 0, curW = 0, curL = 0
  const sorted = closed.slice().sort(function(a, b) { return new Date(a.endTime) - new Date(b.endTime) })
  for (let i = 0; i < sorted.length; i++) { const v = parseFloat(sorted[i].pnlDollars || 0); if (v > 0) { curW++; curL = 0 } else if (v < 0) { curL++; curW = 0 } else { curW = 0; curL = 0 } if (curW > maxWinStreak) maxWinStreak = curW; if (curL > maxLossStreak) maxLossStreak = curL }
  const avgGain = wins > 0 ? (sumProfit / wins) : null; const avgLoss = losses > 0 ? (sumLoss / losses) : null
  const rrShare = (avgGain != null || avgLoss != null) ? ((avgGain || 0) / ((avgGain || 0) + (avgLoss || 0))) : 0
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
    '</div>'
}

export function renderCharts() {
  const cs = getComputedStyle(document.body)
  const accent = cs.getPropertyValue('--accent').trim() || '#22d3ee'
  const positive = cs.getPropertyValue('--positive').trim() || '#10b981'
  const negative = cs.getPropertyValue('--negative').trim() || '#ef4444'
  const gridColor = cs.getPropertyValue('--grid').trim() || '#334155'
  const textColor = cs.getPropertyValue('--text').trim() || '#e5e7eb'
  const Chart = window.Chart
  if (!Chart) return
  Chart.defaults.font.family = 'Inter, Arial, sans-serif'
  Chart.defaults.color = textColor
  Chart.defaults.font.size = 12
  Chart.defaults.borderColor = gridColor
  const elDailyCum = document.getElementById('chartDailyCumulative')
  const elDailyBar = document.getElementById('chartDailyBar')
  const elInst = document.getElementById('chartPnlInstrument')
  const elWinRate = document.getElementById('chartWinRateCumulative')
  if (!elDailyCum || !elDailyBar || !elInst || !elWinRate) return
  const closed = []; for (let i = 0; i < state.filteredTrades.length; i++) { if (state.filteredTrades[i].status === 'Closed') closed.push(state.filteredTrades[i]) }
  const dailyMap = {}; for (let i = 0; i < closed.length; i++) { const t = closed[i]; const d = new Date(t.endTime); if (!isNaN(d)) { const k = d.toISOString().split('T')[0]; const pnl = parseFloat(t.pnlDollars || 0); dailyMap[k] = (dailyMap[k] || 0) + pnl } }
  const dates = Object.keys(dailyMap).sort(); const dailyVals = dates.map(function(k) { return dailyMap[k] })
  if (state.charts.dailyCumulative) state.charts.dailyCumulative.destroy()
  const gCum = elDailyCum.getContext('2d').createLinearGradient(0, 0, 0, elDailyCum.height)
  gCum.addColorStop(0, 'rgba(34,197,94,0.15)')
  gCum.addColorStop(1, 'rgba(34,197,94,0.00)')
  state.charts.dailyCumulative = new Chart(elDailyCum.getContext('2d'), { type: 'line', data: { labels: dates, datasets: [{ label: 'PnL Diário Acumulado', data: dailyVals.reduce((acc, v) => { const last = acc.length ? acc[acc.length-1] : 0; acc.push(last + v); return acc }, []), borderColor: accent, backgroundColor: gCum, tension: 0.35, borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: true, padding: 8 } }, scales: { x: { grid: { color: 'rgba(148,163,184,0.2)' }, ticks: { color: textColor } }, y: { grid: { color: 'rgba(148,163,184,0.2)' }, ticks: { color: textColor } } } } })
  if (state.charts.dailyBar) state.charts.dailyBar.destroy()
  state.charts.dailyBar = new Chart(elDailyBar.getContext('2d'), { type: 'bar', data: { labels: dates, datasets: [{ label: 'PnL Diário', data: dailyVals, backgroundColor: dailyVals.map(function(v){ return v >= 0 ? positive : negative }), borderColor: '#ffffff22', borderWidth: 1, categoryPercentage: 0.7, barPercentage: 0.8 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: true, padding: 8 } }, scales: { x: { grid: { color: 'rgba(148,163,184,0.2)' }, ticks: { color: textColor } }, y: { grid: { color: 'rgba(148,163,184,0.2)' }, ticks: { color: textColor } } } } })
  const instMap = {}; for (let i = 0; i < closed.length; i++) { const ins = closed[i].instrument; const pnl = parseFloat(closed[i].pnlDollars || 0); instMap[ins] = (instMap[ins] || 0) + pnl }
  const insts = Object.keys(instMap); const instVals = insts.map(function(k) { return instMap[k] })
  if (state.charts.pnlInstrument) state.charts.pnlInstrument.destroy()
  state.charts.pnlInstrument = new Chart(elInst.getContext('2d'), { type: 'bar', data: { labels: insts, datasets: [{ label: 'PnL por Instrumento', data: instVals, backgroundColor: accent, borderColor: '#ffffff22', borderWidth: 1, categoryPercentage: 0.7, barPercentage: 0.8 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: true, padding: 8 } }, scales: { x: { grid: { color: 'rgba(148,163,184,0.2)' }, ticks: { color: textColor } }, y: { grid: { color: 'rgba(148,163,184,0.2)' }, ticks: { color: textColor } } } } })
  let w = 0, l = 0; for (let i = 0; i < closed.length; i++) { const p = parseFloat(closed[i].pnlDollars || 0); if (p > 0) w++; else if (p < 0) l++ }
  const sorted2 = closed.slice().sort(function(a, b) { return new Date(a.endTime) - new Date(b.endTime) })
  const wrLabels = [], wrData = []; let cw = 0, cl = 0
  for (let i = 0; i < sorted2.length; i++) { const p = parseFloat(sorted2[i].pnlDollars || 0); if (p > 0) cw++; else if (p < 0) cl++; const rate = (cw + cl) > 0 ? (cw / (cw + cl)) * 100 : 0; wrLabels.push(new Date(sorted2[i].endTime).toLocaleDateString('pt-BR')); wrData.push(rate.toFixed(2)) }
  if (state.charts.winRate) state.charts.winRate.destroy()
  const gWr = elWinRate.getContext('2d').createLinearGradient(0, 0, 0, elWinRate.height)
  gWr.addColorStop(0, 'rgba(16,185,129,0.10)')
  gWr.addColorStop(1, 'rgba(16,185,129,0.00)')
  state.charts.winRate = new Chart(elWinRate.getContext('2d'), { type: 'line', data: { labels: wrLabels, datasets: [{ label: 'Win Rate Acumulado (%)', data: wrData, borderColor: positive, backgroundColor: gWr, tension: 0.35, borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: true, padding: 8 } }, scales: { x: { grid: { color: 'rgba(148,163,184,0.2)' }, ticks: { color: textColor } }, y: { grid: { color: 'rgba(148,163,184,0.2)' }, ticks: { color: textColor } } } } })
}
