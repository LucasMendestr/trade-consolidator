async function loadStrategies() {
    if (!supabaseClient || !currentUser) return;
    const res = await supabaseClient.from('strategies').select('*').eq('user_id', currentUser.id).order('name');
    if (!res.error) { allStrategies = res.data || []; }
    renderStrategiesTable();
    try { populateStrategyFilter(); } catch (e) {}
    try { if (document.getElementById('tradesBody')) updateTradesTable(); } catch (e) {}
}

async function handleCreateStrategy() {
    if (!supabaseClient || !currentUser) return;
    const name = (document.getElementById('strategyName').value || '').trim();
    const timeframe = (document.getElementById('strategyTimeframe').value || '').trim();
    const rr = parseFloat(document.getElementById('strategyRR').value || '');
    const desc = (document.getElementById('strategyDescription').value || '').trim();
    const msg = document.getElementById('strategyMessage');
    if (!name) { if (msg) { msg.textContent = 'Informe o nome'; msg.className = 'error'; } return; }
    const ins = await supabaseClient.from('strategies').insert([{ user_id: currentUser.id, name: name, description: desc, timeframe: timeframe, risk_reward_expected: isNaN(rr) ? null : rr }]).select('id').single();
    if (ins.error) { if (msg) { msg.textContent = ins.error.message; msg.className = 'error'; } return; }
    if (msg) { msg.textContent = 'Estratégia criada'; msg.className = 'success'; }
    document.getElementById('strategyName').value = '';
    document.getElementById('strategyTimeframe').value = '';
    document.getElementById('strategyRR').value = '';
    document.getElementById('strategyDescription').value = '';
    await loadStrategies();
    updateTradesTable();
}

async function assignStrategyToTrade(tradeId, strategyId) {
    if (!tradeId || !supabaseClient || !currentUser) return;
    const res = await supabaseClient.from('trades').update({ strategy_id: strategyId || null }).eq('id', tradeId).eq('user_id', currentUser.id).select('id, strategy_id').single();
    if (res.error) { showMessage('error', res.error.message); return; }
    for (let i = 0; i < filteredTrades.length; i++) { if (filteredTrades[i].id === tradeId) { filteredTrades[i].strategy_id = strategyId || null; break; } }
    updateTradesTable();
}

function renderStrategiesTable() {
    const body = document.getElementById('strategiesTableBody');
    if (!body) return;
    if (!allStrategies || allStrategies.length === 0) { body.innerHTML = '<tr><td colspan="5" class="loading">Nenhuma estratégia</td></tr>'; return; }
    function escapeHtml(s){ return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    let html = '';
    for (let i = 0; i < allStrategies.length; i++) {
        const s = allStrategies[i];
        html += '<tr>' +
            '<td style="padding:12px; border-bottom:1px solid #334155; color: var(--text);">' + escapeHtml(s.name || '-') + '</td>' +
            '<td style="padding:12px; border-bottom:1px solid #334155; color: #9ca3af;">' + escapeHtml(s.timeframe || '-') + '</td>' +
            '<td style="padding:12px; border-bottom:1px solid #334155; color: #9ca3af;">' + escapeHtml(s.risk_reward_expected != null ? s.risk_reward_expected : '-') + '</td>' +
            '<td style="padding:12px; border-bottom:1px solid #334155; color: var(--text);">' + escapeHtml(s.description || '') + '</td>' +
            '<td style="padding:12px; border-bottom:1px solid #334155;">' +
                '<button class="btn" style="background:#22d3ee; color:#0b1020; margin-right:8px;" onclick="editStrategy(\'' + escapeHtml(s.id) + '\')">Editar</button>' +
                '<button class="btn" style="background:#ef4444; color:white;" onclick="deleteStrategy(\'' + escapeHtml(s.id) + '\')">Excluir</button>' +
            '</td>' +
        '</tr>';
    }
    body.innerHTML = html;
}

async function editStrategy(id) {
    if (!supabaseClient || !currentUser) return;
    const s = (allStrategies || []).find(function(x){ return x.id === id; });
    const name = prompt('Nome', s ? s.name || '' : '');
    if (name === null) return;
    const timeframe = prompt('Timeframe', s ? s.timeframe || '' : '');
    if (timeframe === null) return;
    const rrStr = prompt('Risco/Recompensa esperado', s && s.risk_reward_expected != null ? String(s.risk_reward_expected) : '');
    if (rrStr === null) return;
    const rr = rrStr === '' ? null : parseFloat(rrStr);
    const desc = prompt('Descrição', s ? s.description || '' : '');
    if (desc === null) return;
    const res = await supabaseClient
        .from('strategies')
        .update({ name: name, timeframe: timeframe, risk_reward_expected: rr, description: desc })
        .eq('id', id)
        .eq('user_id', currentUser.id)
        .select('id')
        .single();
    if (res.error) { alert(res.error.message); return; }
    await loadStrategies();
}

async function deleteStrategy(id) {
    if (!supabaseClient || !currentUser) return;
    if (!confirm('Excluir esta estratégia?')) return;
    const res = await supabaseClient
        .from('strategies')
        .delete()
        .eq('id', id)
        .eq('user_id', currentUser.id)
        .select('id')
        .single();
    if (res.error) { alert(res.error.message); return; }
    await loadStrategies();
}