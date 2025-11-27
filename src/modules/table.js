import { state } from '../state.js'

export function updateTradesTable() {
  const tradesBody = document.getElementById('tradesBody')
  if (!tradesBody) return
  function escapeHtml(s){ return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
  let tableHtml = ''
  for (let i = 0; i < state.filteredTrades.length; i++) {
    const t = state.filteredTrades[i]
    const statusClass = t.status === 'Closed' ? 'status-closed' : 'status-open'
    const pnlClass = parseFloat(t.pnlDollars || 0) >= 0 ? 'pnl-positive' : 'pnl-negative'
    const endTimeFormatted = (function(s){ if (!s) return '-'; const d = new Date(s); return d.toLocaleString('pt-BR') })(t.endTime)
    const currentSid = t.strategy_id || ''
    let selectHtml = '<select onchange="assignStrategyToTrade(\'' + escapeHtml(String(t.id || '')) + '\', this.value)" onclick="event.stopPropagation()">\n<option value="">Selecione</option>'
    for (let j = 0; j < state.allStrategies.length; j++) { const s = state.allStrategies[j]; selectHtml += '<option value="' + escapeHtml(String(s.id)) + '"' + (s.id === currentSid ? ' selected' : '') + '>' + escapeHtml(s.name) + '</option>' }
    selectHtml += '</select>'
    tableHtml += 
      '<tr onclick="showTradeDetails(' + i + ')" style="cursor: pointer;">' +
      '<td><input type="checkbox" class="trade-select" value="' + (t.id || '') + '"' + (!t.id ? ' disabled' : '') + ' onclick="event.stopPropagation()"></td>' +
      '<td><span class="' + statusClass + '">' + escapeHtml(t.status) + '</span></td>' +
      '<td>' + escapeHtml(t.account) + '</td>' +
      '<td>' + escapeHtml(t.instrument) + '</td>' +
      '<td>' + escapeHtml(t.type) + '</td>' +
      '<td>$' + t.avgEntry + '</td>' +
      '<td>$' + (t.avgExit || '-') + '</td>' +
      '<td>' + (t.pnlPoints || '-') + '</td>' +
      '<td class="' + pnlClass + '">$' + (t.pnlDollars || '-') + '</td>' +
      '<td style="font-size: 12px; color: #666;">' + endTimeFormatted + '</td>' +
      '<td>' + (t.id ? selectHtml : '-') + '</td>' +
      '</tr>'
  }
  if (tableHtml === '') { tradesBody.innerHTML = '<tr><td colspan="11" class="loading">Nenhum trade</td></tr>' }
  else { tradesBody.innerHTML = tableHtml }
}

export function showTradeDetails(idx) {
  state.selectedTrade = state.filteredTrades[idx]
  document.getElementById('tradeDetails').style.display = 'block'
  document.getElementById('detailInstrument').textContent = state.selectedTrade.instrument
  document.getElementById('detailType').textContent = state.selectedTrade.type
  document.getElementById('detailStatus').textContent = state.selectedTrade.status
  document.getElementById('detailAccount').textContent = state.selectedTrade.account
  document.getElementById('detailAvgEntry').textContent = state.selectedTrade.avgEntry
  document.getElementById('detailAvgExit').textContent = state.selectedTrade.avgExit || '-'
  const pnlValue = parseFloat(state.selectedTrade.pnlDollars || 0)
  const pnlColor = pnlValue >= 0 ? '#4CAF50' : '#f44336'
  document.getElementById('detailPnL').innerHTML = '<span style="color: ' + pnlColor + ';">$' + state.selectedTrade.pnlDollars + '</span>'
  populateOperationsTable()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

export async function populateOperationsTable() {
  if (!state.selectedTrade) { document.getElementById('detailOperations').innerHTML = ''; return }
  let res = null
  if (state.selectedTrade.id) {
    res = await state.supabaseClient.from('operations').select('*').eq('user_id', state.currentUser.id).eq('trade_id', state.selectedTrade.id).order('time')
  } else {
    res = await state.supabaseClient
      .from('operations')
      .select('*')
      .eq('user_id', state.currentUser.id)
      .eq('instrument', state.selectedTrade.instrument)
      .eq('account', state.selectedTrade.account)
      .gte('time', state.selectedTrade.startTime)
      .lte('time', state.selectedTrade.endTime)
      .order('time')
  }
  state.selectedTradeOperations = (res && res.data) ? res.data : []
  function parseMillis(s){ const d = new Date(s); const t = d.getTime(); return isNaN(t) ? 0 : t }
  const allOps = state.selectedTradeOperations.slice().sort(function(a, b) { return parseMillis(a.time) - parseMillis(b.time) })
  let entries = 0; let exits = 0
  for (let i = 0; i < allOps.length; i++) { if (allOps[i].e_x === 'Entry') entries++; else if (allOps[i].e_x === 'Exit') exits++ }
  const sumEl = document.getElementById('detailOpsSummary')
  if (sumEl) {
    const startStr = state.selectedTrade.startTime ? new Date(state.selectedTrade.startTime).toLocaleString('pt-BR') : '-'
    const endStr = state.selectedTrade.endTime ? new Date(state.selectedTrade.endTime).toLocaleString('pt-BR') : '-'
    sumEl.textContent = entries + ' entradas • ' + exits + ' saídas • Filtro: ' + (state.selectedTrade.instrument || '-') + ' | ' + (state.selectedTrade.account || '-') + ' • ' + startStr + ' → ' + endStr
  }
  let html = ''
  for (let i = 0; i < allOps.length; i++) {
    const op = allOps[i]
    const dt = new Date(op.time)
    const timeStr = isNaN(dt.getTime()) ? String(op.time || '-') : dt.toLocaleString('pt-BR')
    html += '<tr>' +
      '<td style="padding: 10px;">' + timeStr + '</td>' +
      '<td style="padding: 10px;">' + op.action + '</td>' +
      '<td style="padding: 10px;">' + parseFloat(op.quantity).toFixed(2) + '</td>' +
      '<td style="padding: 10px;">$' + parseFloat(op.price).toFixed(2) + '</td>' +
      '<td style="padding: 10px;">$' + parseFloat(op.commission || 0).toFixed(2) + '</td>' +
      '<td style="padding: 10px;">' + op.e_x + '</td>' +
      '<td style="padding: 10px;">' + (op.source_id || '-') + '</td>' +
      '</tr>'
  }
  document.getElementById('detailOperations').innerHTML = html
}

export function closeTradeDetails() { document.getElementById('tradeDetails').style.display = 'none'; state.selectedTrade = null; state.selectedTradeOperations = [] }
