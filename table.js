function formatDate(dateString) { if (!dateString) return '-'; const date = new Date(dateString); return date.toLocaleString('pt-BR'); }

function updateTradesTable() {
    const tradesBody = document.getElementById('tradesBody');
    if (!tradesBody) {
        return;
    }
    let tableHtml = '';
    for (let i = 0; i < filteredTrades.length; i++) {
        const t = filteredTrades[i];
        const statusClass = t.status === 'Closed' ? 'status-closed' : 'status-open';
        const pnlClass = parseFloat(t.pnlDollars || 0) >= 0 ? 'pnl-positive' : 'pnl-negative';
        const endTimeFormatted = formatDate(t.endTime);
        const currentSid = t.strategy_id || '';
        let selectHtml = '<select onchange="assignStrategyToTrade(\'' + (t.id || '') + '\', this.value)" onclick="event.stopPropagation()">\n<option value="">Selecione</option>';
        for (let j = 0; j < allStrategies.length; j++) { const s = allStrategies[j]; selectHtml += '<option value="' + s.id + '"' + (s.id === currentSid ? ' selected' : '') + '>' + s.name + '</option>'; }
        selectHtml += '</select>';
        tableHtml += 
            '<tr onclick="showTradeDetails(' + i + ')" style="cursor: pointer;">' +
            '<td><input type="checkbox" class="trade-select" value="' + (t.id || '') + '"' + (!t.id ? ' disabled' : '') + ' onclick="event.stopPropagation()"></td>' +
            '<td><span class="' + statusClass + '">' + t.status + '</span></td>' +
            '<td>' + t.account + '</td>' +
            '<td>' + t.instrument + '</td>' +
            '<td>' + t.type + '</td>' +
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