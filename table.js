function formatDate(dateString) { if (!dateString) return '-'; const date = new Date(dateString); return date.toLocaleString('pt-BR'); }

function normalizeText(v){ return String(v || '').toLowerCase(); }
function parseNumber(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; }
function parseDate(v){ var d = new Date(v); var t = d.getTime(); return isNaN(t) ? 0 : t; }
function valueForKey(t, key){
    if (key === 'status') return normalizeText(t.status);
    if (key === 'account') return normalizeText(t.account);
    if (key === 'instrument') return normalizeText(t.instrument);
    if (key === 'type') return normalizeText(t.type);
    if (key === 'avgEntry') return parseNumber(t.avgEntry);
    if (key === 'avgExit') return parseNumber(t.avgExit);
    if (key === 'pnlPoints') return parseNumber(t.pnlPoints);
    if (key === 'pnlDollars') return parseNumber(t.pnlDollars);
    if (key === 'endTime') return parseDate(t.endTime);
    if (key === 'strategy') { var id = t.strategy_id || ''; var name = (strategyNameById && strategyNameById[String(id)]) || ''; return normalizeText(name || String(id)); }
    return 0;
}
function applySort(){
    if (!tableSort || !tableSort.key) return;
    var k = tableSort.key, dir = tableSort.dir === 'desc' ? -1 : 1;
    filteredTrades.sort(function(a,b){ var va=valueForKey(a,k), vb=valueForKey(b,k); if (va<vb) return -1*dir; if (va>vb) return 1*dir; return 0; });
}

function updateTradesTable() {
    const tradesBody = document.getElementById('tradesBody');
    if (!tradesBody) {
        return;
    }
    applySort();
    function escapeHtml(s){ return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    let tableHtml = '';
    for (let i = 0; i < filteredTrades.length; i++) {
        const t = filteredTrades[i];
        const statusClass = t.status === 'Closed' ? 'status-closed' : 'status-open';
        const pnlClass = parseFloat(t.pnlDollars || 0) >= 0 ? 'pnl-positive' : 'pnl-negative';
        const endTimeFormatted = formatDate(t.endTime);
        const currentSid = t.strategy_id || '';
        let selectHtml = '<select onchange="assignStrategyToTrade(\'' + escapeHtml(t.id || '') + '\', this.value)" onclick="event.stopPropagation()">\n<option value="">Selecione</option>';
        for (let j = 0; j < allStrategies.length; j++) { const s = allStrategies[j]; selectHtml += '<option value="' + escapeHtml(s.id) + '"' + (s.id === currentSid ? ' selected' : '') + '>' + escapeHtml(s.name) + '</option>'; }
        selectHtml += '</select>';
        tableHtml += 
            '<tr onclick="showTradeDetails(' + i + ')" style="cursor: pointer;">' +
            '<td><input type="checkbox" class="trade-select" value="' + (t.id || '') + '"' + (!t.id ? ' disabled' : '') + (selectedTradeIds.has(String(t.id)) ? ' checked' : '') + ' onclick="event.stopPropagation()" aria-label="Selecionar trade"></td>' +
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
            '</tr>';
    }
    if (tableHtml === '') { tradesBody.innerHTML = '<tr><td colspan="11" class="loading">Nenhum trade</td></tr>'; }
    else { tradesBody.innerHTML = tableHtml; }

    const top = document.getElementById('tableScrollTop');
    const topInner = document.getElementById('tableScrollTopInner');
    const bottom = document.getElementById('tableScrollBottom');
    if (top && topInner && bottom) {
        topInner.style.width = bottom.scrollWidth + 'px';
        const syncTop = function() { bottom.scrollLeft = top.scrollLeft; };
        const syncBottom = function() { top.scrollLeft = bottom.scrollLeft; };
        top.removeEventListener('scroll', syncTop);
        bottom.removeEventListener('scroll', syncBottom);
        top.addEventListener('scroll', syncTop);
        bottom.addEventListener('scroll', syncBottom);
    }

    initHeaderSorting();
    initSelectionHandlers();
    updateSelectionUI();
}

function showTradeDetails(idx) {
    selectedTrade = filteredTrades[idx];
    document.getElementById('tradeDetails').style.display = 'block';
    document.getElementById('detailInstrument').textContent = selectedTrade.instrument;
    document.getElementById('detailType').textContent = selectedTrade.type;
    document.getElementById('detailStatus').textContent = selectedTrade.status;
    document.getElementById('detailAccount').textContent = selectedTrade.account;
    document.getElementById('detailAvgEntry').textContent = selectedTrade.avgEntry;
    document.getElementById('detailAvgExit').textContent = selectedTrade.avgExit || '-';
    const pnlValue = parseFloat(selectedTrade.pnlDollars || 0);
    const pnlColor = pnlValue >= 0 ? '#4CAF50' : '#f44336';
    document.getElementById('detailPnL').innerHTML = '<span style="color: ' + pnlColor + ';">$' + selectedTrade.pnlDollars + '</span>';
    populateOperationsTable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function populateOperationsTable() {
    if (!selectedTrade) { document.getElementById('detailOperations').innerHTML = ''; return; }
    let res = null;
    if (selectedTrade.id) {
        res = await supabaseClient.from('operations').select('*').eq('user_id', currentUser.id).eq('trade_id', selectedTrade.id).order('time');
    } else {
        res = await supabaseClient
            .from('operations')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('instrument', selectedTrade.instrument)
            .eq('account', selectedTrade.account)
            .gte('time', selectedTrade.startTime)
            .lte('time', selectedTrade.endTime)
            .order('time');
    }
    selectedTradeOperations = (res && res.data) ? res.data : [];
    function parseMillis(s){ const d = new Date(s); const t = d.getTime(); return isNaN(t) ? 0 : t; }
    const allOps = selectedTradeOperations.slice().sort(function(a, b) { return parseMillis(a.time) - parseMillis(b.time); });
    let entries = 0; let exits = 0;
    for (let i = 0; i < allOps.length; i++) { if (allOps[i].e_x === 'Entry') entries++; else if (allOps[i].e_x === 'Exit') exits++; }
    const sumEl = document.getElementById('detailOpsSummary');
    if (sumEl) {
        const startStr = selectedTrade.startTime ? new Date(selectedTrade.startTime).toLocaleString('pt-BR') : '-';
        const endStr = selectedTrade.endTime ? new Date(selectedTrade.endTime).toLocaleString('pt-BR') : '-';
        sumEl.textContent = entries + ' entradas • ' + exits + ' saídas • Filtro: ' + (selectedTrade.instrument || '-') + ' | ' + (selectedTrade.account || '-') + ' • ' + startStr + ' → ' + endStr;
    }
    let html = '';
    for (let i = 0; i < allOps.length; i++) {
        const op = allOps[i];
        const dt = new Date(op.time);
        const timeStr = isNaN(dt.getTime()) ? String(op.time || '-') : dt.toLocaleString('pt-BR');
        html += '<tr>' +
            '<td style="padding: 10px;">' + timeStr + '</td>' +
            '<td style="padding: 10px;">' + op.action + '</td>' +
            '<td style="padding: 10px;">' + parseFloat(op.quantity).toFixed(2) + '</td>' +
            '<td style="padding: 10px;">$' + parseFloat(op.price).toFixed(2) + '</td>' +
            '<td style="padding: 10px;">$' + parseFloat(op.commission || 0).toFixed(2) + '</td>' +
            '<td style="padding: 10px;">' + op.e_x + '</td>' +
            '<td style="padding: 10px;">' + (op.source_id || '-') + '</td>' +
            '</tr>';
    }
    document.getElementById('detailOperations').innerHTML = html;
    try {
        const a = document.getElementById('downloadOpsCSV');
        if (a) {
            const rows = [['Hora','Ação','Quantidade','Preço','Comissão','Tipo','ID']].concat(allOps.map(function(op){
                const dt = new Date(op.time); const timeStr = isNaN(dt.getTime()) ? String(op.time || '-') : dt.toISOString();
                return [timeStr, op.action, op.quantity, op.price, op.commission || 0, op.e_x, op.source_id || ''];
            }));
            const csv = rows.map(function(r){ return r.join(','); }).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            a.href = url;
        }
    } catch (e) {}
}

function closeTradeDetails() { document.getElementById('tradeDetails').style.display = 'none'; selectedTrade = null; selectedTradeOperations = []; }

function initHeaderSorting(){
    const headers = document.querySelectorAll('#tradesTable thead th[data-key]');
    for (let i=0;i<headers.length;i++){
        const h = headers[i];
        const key = h.getAttribute('data-key');
        const handler = function(){
            if (tableSort.key === key) { tableSort.dir = tableSort.dir === 'asc' ? 'desc' : 'asc'; }
            else { tableSort.key = key; tableSort.dir = 'asc'; }
            applySort();
            updateSortIndicators();
            updateTradesTable();
        };
        h.onclick = handler;
        h.onkeydown = function(ev){ if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); handler(); } };
    }
    updateSortIndicators();
}

function updateSortIndicators(){
    const headers = document.querySelectorAll('#tradesTable thead th[data-key]');
    for (let i=0;i<headers.length;i++){
        const h = headers[i];
        const key = h.getAttribute('data-key');
        const active = tableSort.key === key;
        h.setAttribute('aria-sort', active ? (tableSort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
        const span = h.querySelector('.sort');
        if (span) { span.textContent = active ? (tableSort.dir === 'asc' ? '↑' : '↓') : '⇅'; }
    }
}

function initSelectionHandlers(){
    const body = document.getElementById('tradesBody');
    if (body) {
        const boxes = body.querySelectorAll('input.trade-select');
        for (let i=0;i<boxes.length;i++){
            boxes[i].addEventListener('change', function(ev){
                const id = String(this.value || '');
                if (!id) return;
                if (this.checked) selectedTradeIds.add(id); else selectedTradeIds.delete(id);
                updateSelectionUI();
            });
        }
    }
    const selAll = document.getElementById('selectAllHeader');
    if (selAll) {
        selAll.addEventListener('change', function(){
            if (this.indeterminate) { this.indeterminate = false; }
            const check = this.checked;
            selectedTradeIds.clear();
            for (let i=0;i<filteredTrades.length;i++){ const id = String(filteredTrades[i].id || ''); if (id) { if (check) selectedTradeIds.add(id); } }
            updateTradesTable();
        });
    }
}

function updateSelectionUI(){
    const total = filteredTrades.filter(function(t){ return !!t.id; }).length;
    const count = selectedTradeIds.size;
    const hdr = document.getElementById('selectAllHeader');
    if (hdr) {
        hdr.indeterminate = count>0 && count<total;
        hdr.checked = count>0 && count===total;
    }
    const ctr = document.getElementById('selectionCounter');
    if (ctr) ctr.textContent = 'Selecionados: ' + count;
}
