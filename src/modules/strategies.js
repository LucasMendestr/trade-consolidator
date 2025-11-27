import { state } from '../state.js'

export async function loadStrategies() {
  if (!state.supabaseClient || !state.currentUser) return
  const res = await state.supabaseClient.from('strategies').select('*').eq('user_id', state.currentUser.id).order('name')
  if (!res.error) { state.allStrategies = res.data || []; state.strategyNameById = {}; for (let i = 0; i < state.allStrategies.length; i++) { const s = state.allStrategies[i]; state.strategyNameById[String(s.id)] = s.name || 'Sem estratégia' } }
  renderStrategiesTable()
  try { populateStrategyFilter() } catch {}
}

export async function handleCreateStrategy() {
  if (!state.supabaseClient || !state.currentUser) return
  const name = (document.getElementById('strategyName').value || '').trim()
  const timeframe = (document.getElementById('strategyTimeframe').value || '').trim()
  const rr = parseFloat(document.getElementById('strategyRR').value || '')
  const desc = (document.getElementById('strategyDescription').value || '').trim()
  const msg = document.getElementById('strategyMessage')
  if (!name) { if (msg) { msg.textContent = 'Informe o nome'; msg.className = 'error' } return }
  const ins = await state.supabaseClient.from('strategies').insert([{ user_id: state.currentUser.id, name, description: desc, timeframe, risk_reward_expected: isNaN(rr) ? null : rr }]).select('id').single()
  if (ins.error) { if (msg) { msg.textContent = ins.error.message; msg.className = 'error' } return }
  if (msg) { msg.textContent = 'Estratégia criada'; msg.className = 'success' }
  document.getElementById('strategyName').value = ''
  document.getElementById('strategyTimeframe').value = ''
  document.getElementById('strategyRR').value = ''
  document.getElementById('strategyDescription').value = ''
  await loadStrategies()
}

export async function assignStrategyToTrade(tradeId, strategyId) {
  if (!tradeId || !state.supabaseClient || !state.currentUser) return
  const res = await state.supabaseClient.from('trades').update({ strategy_id: strategyId || null }).eq('id', tradeId).eq('user_id', state.currentUser.id).select('id, strategy_id').single()
  if (res.error) { return }
  for (let i = 0; i < state.filteredTrades.length; i++) { if (state.filteredTrades[i].id === tradeId) { state.filteredTrades[i].strategy_id = strategyId || null; break } }
}

export function renderStrategiesTable() {
  const body = document.getElementById('strategiesTableBody')
  if (!body) return
  if (!state.allStrategies || state.allStrategies.length === 0) { body.innerHTML = '<tr><td colspan="5" class="loading">Nenhuma estratégia</td></tr>'; return }
  function escapeHtml(s){ return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
  let html = ''
  for (let i = 0; i < state.allStrategies.length; i++) {
    const s = state.allStrategies[i]
    html += '<tr>' +
      '<td style="padding:12px; border-bottom:1px solid #334155; color: var(--text);">' + escapeHtml(s.name || '-') + '</td>' +
      '<td style="padding:12px; border-bottom:1px solid #334155; color: #9ca3af;">' + escapeHtml(s.timeframe || '-') + '</td>' +
      '<td style="padding:12px; border-bottom:1px solid #334155; color: #9ca3af;">' + escapeHtml(s.risk_reward_expected != null ? s.risk_reward_expected : '-') + '</td>' +
      '<td style="padding:12px; border-bottom:1px solid #334155; color: var(--text);">' + escapeHtml(s.description || '') + '</td>' +
      '<td style="padding:12px; border-bottom:1px solid #334155;">' +
        '<button class="btn" style="background:#22d3ee; color:#0b1020; margin-right:8px;" onclick="editStrategy(\'' + escapeHtml(String(s.id)) + '\')">Editar</button>' +
        '<button class="btn" style="background:#ef4444; color:white;" onclick="deleteStrategy(\'' + escapeHtml(String(s.id)) + '\')">Excluir</button>' +
      '</td>' +
    '</tr>'
  }
  body.innerHTML = html
}

export function populateStrategyFilter() {
  const filter = document.getElementById('strategyFilter')
  if (!filter) return
  const currentValue = filter.value
  filter.innerHTML = '<option value="">Todas as estratégias</option>'
  for (let i = 0; i < (state.allStrategies || []).length; i++) { const s = state.allStrategies[i]; filter.innerHTML += '<option value="' + s.id + '">' + s.name + '</option>' }
  filter.value = currentValue
  const bulk = document.getElementById('bulkStrategySelect')
  if (bulk) {
    const bulkVal = bulk.value
    bulk.innerHTML = '<option value="">Selecione a estratégia</option>'
    for (let i = 0; i < (state.allStrategies || []).length; i++) { const s = state.allStrategies[i]; bulk.innerHTML += '<option value="' + s.id + '">' + s.name + '</option>' }
    bulk.value = bulkVal
  }
}
