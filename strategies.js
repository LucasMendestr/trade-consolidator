async function loadStrategies() {
    if (!supabaseClient || !currentUser) return;
    const res = await supabaseClient.from('strategies').select('*').eq('user_id', currentUser.id).order('name');
    if (!res.error) { allStrategies = res.data || []; }
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