async function loadStrategies() {
    if (!supabaseClient || !currentUser) return;
    const res = await supabaseClient.from('strategies').select('*').eq('user_id', currentUser.id).order('name');
    if (!res.error) { allStrategies = res.data || []; }
    renderStrategiesGrid();
}

async function handleCreateStrategy() {
    if (!supabaseClient || !currentUser) return;
    const name = (document.getElementById('strategyName').value || '').trim();
    const timeframe = (document.getElementById('strategyTimeframe').value || '').trim();
    const rr = parseFloat(document.getElementById('strategyRR').value || '');
    const desc = (document.getElementById('strategyDescription').value || '').trim();
    const msg = document.getElementById('strategyMessage');
    if (!name) { msg.innerHTML = '<div class="error">Informe o nome</div>'; return; }
    const ins = await supabaseClient.from('strategies').insert([{ user_id: currentUser.id, name: name, description: desc, timeframe: timeframe, risk_reward_expected: isNaN(rr) ? null : rr }]).select('id').single();
    if (ins.error) { msg.innerHTML = '<div class="error">' + ins.error.message + '</div>'; return; }
    msg.innerHTML = '<div class="success">Estratégia criada</div>';
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

function renderStrategiesGrid() {
    const grid = document.getElementById('strategiesGrid');
    if (!grid) return;
    if (!allStrategies || allStrategies.length === 0) { grid.innerHTML = '<div class="loading">Nenhuma estratégia</div>'; return; }
    let html = '';
    for (let i = 0; i < allStrategies.length; i++) {
        const s = allStrategies[i];
        html += '<div style="background: var(--surface); border: 1px solid #334155; border-radius: 8px; padding: 14px; display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">' +
            '<div style="font-size:18px; font-weight:bold; color: var(--text);">' + (s.name || '-') + '</div>' +
            '<div style="font-size:13px; color: #9ca3af;">Timeframe: ' + (s.timeframe || '-') + '</div>' +
            '<div style="font-size:13px; color: #9ca3af;">RR esperado: ' + (s.risk_reward_expected != null ? s.risk_reward_expected : '-') + '</div>' +
            '<div style="font-size:13px; color: var(--text);">' + (s.description || '') + '</div>' +
            '<div style="display:flex; gap:8px; margin-top:6px;">' +
                '<button class="btn" style="background:#22d3ee; color:#0b1020;" onclick="editStrategy(\'' + s.id + '\')">Editar</button>' +
                '<button class="btn" style="background:#ef4444; color:white;" onclick="deleteStrategy(\'' + s.id + '\')">Excluir</button>' +
            '</div>' +
        '</div>';
    }
    grid.innerHTML = html;
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