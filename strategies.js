async function loadStrategies() {
    if (!supabaseClient || !currentUser) return;
    const res = await supabaseClient.from('strategies').select('*').eq('user_id', currentUser.id).order('name');
    if (!res.error) { allStrategies = res.data || []; strategyNameById = {}; for (let i = 0; i < allStrategies.length; i++) { const s = allStrategies[i]; strategyNameById[String(s.id)] = s.name || 'Sem estratégia'; } }
    renderStrategiesTable();
    try { populateStrategyFilter(); } catch (e) {}
    try { if (typeof renderStrategySections === 'function') renderStrategySections(); } catch (e) {}
    try { if (document.getElementById('tradesBody')) updateTradesTable(); } catch (e) {}
}

let formEntryRules = [];
let formExitRules = [];
function addEntryRule(){ formEntryRules.push({ id: String(Date.now()) + '-e', descricao: '', condicao: '' }); renderRuleLists(); }
function addExitRule(){ formExitRules.push({ id: String(Date.now()) + '-s', descricao: '', condicao: '' }); renderRuleLists(); }
function removeEntryRule(idx){ formEntryRules.splice(idx,1); renderRuleLists(); }
function removeExitRule(idx){ formExitRules.splice(idx,1); renderRuleLists(); }
function renderRuleLists(){
    const eList = document.getElementById('entryRulesList'); const sList = document.getElementById('exitRulesList');
    function ruleRow(rule, idx, removeFn){
        return '<div style="display:flex; gap:8px; align-items:flex-start; margin:6px 0;">'+
          '<input type="text" placeholder="Descrição" value="'+(rule.descricao||'')+'" oninput="formEntryRules['+idx+'].descricao=this.value" style="flex:1; padding:8px; border:1px solid var(--grid); border-radius:8px; background: var(--surface); color: var(--text);">'+
          '<input type="text" placeholder="Condição (opcional)" value="'+(rule.condicao||'')+'" oninput="formEntryRules['+idx+'].condicao=this.value" style="flex:1; padding:8px; border:1px solid var(--grid); border-radius:8px; background: var(--surface); color: var(--text);">'+
          '<button class="btn btn-danger" onclick="'+removeFn+'('+idx+')">x</button>'+
        '</div>';
    }
    function ruleRowExit(rule, idx){
        return '<div style="display:flex; gap:8px; align-items:flex-start; margin:6px 0;">'+
          '<input type="text" placeholder="Descrição" value="'+(rule.descricao||'')+'" oninput="formExitRules['+idx+'].descricao=this.value" style="flex:1; padding:8px; border:1px solid var(--grid); border-radius:8px; background: var(--surface); color: var(--text);">'+
          '<input type="text" placeholder="Condição (opcional)" value="'+(rule.condicao||'')+'" oninput="formExitRules['+idx+'].condicao=this.value" style="flex:1; padding:8px; border:1px solid var(--grid); border-radius:8px; background: var(--surface); color: var(--text);">'+
          '<button class="btn btn-danger" onclick="removeExitRule('+idx+')">x</button>'+
        '</div>';
    }
    if (eList) { eList.innerHTML = formEntryRules.map(function(r,i){ return ruleRow(r,i,'removeEntryRule'); }).join('') || '<div style="color:#94a3b8;">Nenhuma regra de entrada</div>'; }
    if (sList) { sList.innerHTML = formExitRules.map(function(r,i){ return ruleRowExit(r,i); }).join('') || '<div style="color:#94a3b8;">Nenhuma regra de saída</div>'; }
}

async function handleCreateStrategy() {
    if (!supabaseClient || !currentUser) return;
    const name = (document.getElementById('strategyName').value || '').trim();
    const desc = (document.getElementById('strategyDescription').value || '').trim();
    const msg = document.getElementById('strategyMessage');
    if (!name) { if (msg) { msg.textContent = 'Informe o nome'; msg.className = 'error'; } return; }
    if (!formEntryRules || formEntryRules.length === 0) { if (msg) { msg.textContent = 'Inclua ao menos 1 regra de entrada'; msg.className = 'error'; } return; }
    const payload = { user_id: currentUser.id, name: name, description: desc, regras_entrada: formEntryRules, regras_saida: formExitRules };
    const ins = await supabaseClient.from('strategies').insert([payload]).select('id').single();
    if (ins.error) { if (msg) { msg.textContent = ins.error.message; msg.className = 'error'; } return; }
    if (msg) { msg.textContent = 'Estratégia criada'; msg.className = 'success'; }
    document.getElementById('strategyName').value = '';
    document.getElementById('strategyDescription').value = '';
    formEntryRules = []; formExitRules = []; renderRuleLists();
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
    if (!allStrategies || allStrategies.length === 0) { body.innerHTML = '<tr><td colspan="4" class="loading">Nenhuma estratégia</td></tr>'; return; }
    function escapeHtml(s){ return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    let html = '';
    for (let i = 0; i < allStrategies.length; i++) {
        const s = allStrategies[i];
        html += '<tr>' +
            '<td style="padding:12px; border-bottom:1px solid #334155; color: var(--text);">' + escapeHtml(s.name || '-') + '</td>' +
            '<td style="padding:12px; border-bottom:1px solid #334155; color: var(--text);">' + escapeHtml(s.description || '') + '</td>' +
            '<td style="padding:12px; border-bottom:1px solid #334155; color: #9ca3af;">' +
                (Array.isArray(s.regras_entrada)? s.regras_entrada.length : 0) + ' / ' + (Array.isArray(s.regras_saida)? s.regras_saida.length : 0) +
            '</td>' +
            '<td style="padding:12px; border-bottom:1px solid #334155;">' +
                '<button class="btn" style="background:#22d3ee; color:#0b1020; margin-right:8px;" onclick="editStrategyRules(\'' + escapeHtml(s.id) + '\')">Editar Regras</button>' +
                '<button class="btn" style="background:#ef4444; color:white;" onclick="deleteStrategy(\'' + escapeHtml(s.id) + '\')">Excluir</button>' +
            '</td>' +
        '</tr>';
    }
    body.innerHTML = html;
}

async function editStrategyRules(id){
    const s = (allStrategies || []).find(function(x){ return x.id === id; }) || {};
    const container = document.getElementById('strategiesSection'); if (!container) return;
    const msg = document.getElementById('strategyMessage'); if (msg) { msg.textContent=''; msg.className=''; }
    formEntryRules = Array.isArray(s.regras_entrada) ? JSON.parse(JSON.stringify(s.regras_entrada)) : [];
    formExitRules = Array.isArray(s.regras_saida) ? JSON.parse(JSON.stringify(s.regras_saida)) : [];
    document.getElementById('strategyName').value = s.name || '';
    document.getElementById('strategyDescription').value = s.description || '';
    renderRuleLists();
    container.scrollIntoView({ behavior:'smooth' });
    const save = async function(){
        if (!supabaseClient || !currentUser) return;
        if (!formEntryRules || formEntryRules.length === 0) { if (msg) { msg.textContent = 'Inclua ao menos 1 regra de entrada'; msg.className = 'error'; } return; }
        const payload = { name: document.getElementById('strategyName').value || '', description: document.getElementById('strategyDescription').value || '', regras_entrada: formEntryRules, regras_saida: formExitRules };
        const res = await supabaseClient.from('strategies').update(payload).eq('id', id).eq('user_id', currentUser.id).select('id').single();
        if (res.error) { if (msg) { msg.textContent = res.error.message; msg.className = 'error'; } return; }
        if (msg) { msg.textContent = 'Estratégia atualizada'; msg.className = 'success'; }
        formEntryRules = []; formExitRules = []; renderRuleLists();
        document.getElementById('strategyName').value = ''; document.getElementById('strategyDescription').value = '';
        await loadStrategies();
    };
    // adicionar botão salvar abaixo do formulário se não existir
    if (!document.getElementById('strategySaveBtn')){
        const btn = document.createElement('button'); btn.id='strategySaveBtn'; btn.className='btn btn-primary'; btn.textContent='Salvar Estratégia'; btn.style.marginTop='8px'; btn.onclick=save; container.appendChild(btn);
    }
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
