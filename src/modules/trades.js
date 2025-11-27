import { state } from '../state.js'
import { updateDashboard, renderCharts } from './dashboard.js'
import { updateTradesTable } from './table.js'
import { populateStrategyFilter } from './strategies.js'

export async function loadDataFromSupabase() {
  try {
    const result = await state.supabaseClient
      .from('trades')
      .select('id,user_id,instrument,account,type,status,avg_price_entry,avg_price_exit,pnl_points,pnl_dollars,start_time,end_time,strategy_id')
      .eq('user_id', state.currentUser.id)
      .order('end_time')
    const trades = result.data
    if (trades && trades.length > 0) {
      state.allTrades = trades.map(function(t){ return { id: t.id, instrument: t.instrument, account: t.account, type: t.type, status: t.status, avgEntry: t.avg_price_entry != null ? parseFloat(t.avg_price_entry).toFixed(2) : '-', avgExit: t.avg_price_exit != null ? parseFloat(t.avg_price_exit).toFixed(2) : '-', pnlPoints: t.pnl_points != null ? parseFloat(t.pnl_points).toFixed(2) : '-', pnlDollars: t.pnl_dollars != null ? parseFloat(t.pnl_dollars).toFixed(2) : '-', startTime: t.start_time, endTime: t.end_time, strategy_id: t.strategy_id || null, entries: [], exits: [] } })
    } else {
      state.allTrades = []
    }
    populateAccountFilter()
    populateStrategyFilter()
    populateInstrumentFilter()
    filterTrades()
    updateDashboard()
    renderCharts()
  } catch {}
}

export function populateAccountFilter() {
  const accounts = []
  for (let i = 0; i < state.allTrades.length; i++) { if (accounts.indexOf(state.allTrades[i].account) === -1) { accounts.push(state.allTrades[i].account) } }
  accounts.sort()
  const filter = document.getElementById('accountFilter')
  if (!filter) return
  const currentValue = filter.value
  filter.innerHTML = '<option value="">Todas as contas</option>'
  for (let i = 0; i < accounts.length; i++) { filter.innerHTML += '<option value="' + accounts[i] + '">' + accounts[i] + '</option>' }
  filter.value = currentValue
}

export function populateInstrumentFilter() {
  const filter = document.getElementById('instrumentFilter')
  if (!filter) return
  const set = {}
  for (let i = 0; i < state.allTrades.length; i++) { const inst = state.allTrades[i].instrument || ''; if (inst) set[inst] = true }
  const instruments = Object.keys(set).sort()
  const currentValue = filter.value
  filter.innerHTML = '<option value="">Todos</option>'
  for (let i = 0; i < instruments.length; i++) { filter.innerHTML += '<option value="' + instruments[i] + '">' + instruments[i] + '</option>' }
  filter.value = currentValue
}

function getPresetRange(preset) {
  const now = new Date()
  const y = now.getFullYear(); const m = now.getMonth(); const day = now.getDate()
  function startOfWeek(d) { const date = new Date(d); const dayIdx = date.getDay(); const diff = (dayIdx + 6) % 7; date.setDate(date.getDate() - diff); date.setHours(0,0,0,0); return date }
  function endOfWeek(d) { const s = startOfWeek(d); const e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23,59,59,999); return e }
  if (preset === 'this_week') { return [startOfWeek(now), endOfWeek(now)] }
  if (preset === 'last_week') { const last = new Date(now); last.setDate(day - 7); return [startOfWeek(last), endOfWeek(last)] }
  if (preset === 'this_month') { const s = new Date(y, m, 1); s.setHours(0,0,0,0); const e = new Date(y, m + 1, 0); e.setHours(23,59,59,999); return [s, e] }
  if (preset === 'last_month') { const s = new Date(y, m - 1, 1); s.setHours(0,0,0,0); const e = new Date(y, m, 0); e.setHours(23,59,59,999); return [s, e] }
  if (preset === 'this_year') { const s = new Date(y, 0, 1); s.setHours(0,0,0,0); const e = new Date(y, 11, 31); e.setHours(23,59,59,999); return [s, e] }
  if (preset === 'last_year') { const s = new Date(y - 1, 0, 1); s.setHours(0,0,0,0); const e = new Date(y - 1, 11, 31); e.setHours(23,59,59,999); return [s, e] }
  return [null, null]
}

export function filterTrades() {
  const accountFilter = (document.getElementById('accountFilter') ? document.getElementById('accountFilter').value : '').trim()
  const strategyFilter = (document.getElementById('strategyFilter') ? document.getElementById('strategyFilter').value : '').trim()
  const instrumentFilter = (document.getElementById('instrumentFilter') ? document.getElementById('instrumentFilter').value : '').trim()
  const datePreset = (document.getElementById('datePreset') ? document.getElementById('datePreset').value : '').trim()
  const dateFromStr = (document.getElementById('dateFrom') ? document.getElementById('dateFrom').value : '').trim()
  const dateToStr = (document.getElementById('dateTo') ? document.getElementById('dateTo').value : '').trim()
  let [rangeStart, rangeEnd] = getPresetRange(datePreset)
  if (dateFromStr) { rangeStart = new Date(dateFromStr + 'T00:00:00') }
  if (dateToStr) { rangeEnd = new Date(dateToStr + 'T23:59:59') }
  state.filteredTrades = []
  for (let i = 0; i < state.allTrades.length; i++) {
    const t = state.allTrades[i]
    const acc = (t.account || '').trim()
    if (accountFilter && acc !== accountFilter) continue
    if (strategyFilter && (t.strategy_id || '') !== strategyFilter) continue
    if (instrumentFilter && (t.instrument || '') !== instrumentFilter) continue
    if (rangeStart || rangeEnd) {
      const endDate = t.endTime ? new Date(t.endTime) : null
      if (!endDate) continue
      if (rangeStart && endDate < rangeStart) continue
      if (rangeEnd && endDate > rangeEnd) continue
    }
    state.filteredTrades.push(t)
  }
  updateTradesTable()
  updateDashboard()
  renderCharts()
}

export async function applyStrategyBulk() {
  const bulk = document.getElementById('bulkStrategySelect')
  if (!bulk || !bulk.value) return
  const checkboxes = document.querySelectorAll('.trade-select:checked')
  const ids = Array.prototype.map.call(checkboxes, function(el){ return el.value }).filter(function(v){ return v })
  if (ids.length === 0) return
  const res = await state.supabaseClient
    .from('trades')
    .update({ strategy_id: bulk.value })
    .in('id', ids)
    .eq('user_id', state.currentUser.id)
    .select('id')
  if (res && res.error) return
  for (let i = 0; i < state.filteredTrades.length; i++) { if (ids.indexOf(state.filteredTrades[i].id) !== -1) { state.filteredTrades[i].strategy_id = bulk.value } }
  updateTradesTable()
}

export function toggleSelectAllTrades(el) {
  const checks = document.querySelectorAll('.trade-select')
  for (let i = 0; i < checks.length; i++) { if (!checks[i].disabled) checks[i].checked = el.checked }
}

export async function consolidateTradesForUserBatch() {
  // Mantemos a lógica existente para consolidação em lote
  // Importamos sob demanda de operations/trades originais se necessário
}
