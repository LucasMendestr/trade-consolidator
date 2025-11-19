function formatDate(dateString) { if (!dateString) return '-'; const date = new Date(dateString); return date.toLocaleString('pt-BR'); }

function updateTradesTable() {
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
    const tradesBody = document.getElementById('tradesBody');
    if (tableHtml === '') { tradesBody.innerHTML = '<tr><td colspan="10" class="loading">Nenhum trade</td></tr>'; }
    else { tradesBody.innerHTML = tableHtml; }
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
    window.scrollTo(0, document.getElementById('tradeDetails').offsetTop - 100);
}

async function populateOperationsTable() {
    if (!selectedTrade || !selectedTrade.id) { document.getElementById('detailOperations').innerHTML = ''; return; }
    const res = await supabaseClient.from('operations').select('*').eq('user_id', currentUser.id).eq('trade_id', selectedTrade.id).order('time');
    selectedTradeOperations = res.data || [];
    const allOps = selectedTradeOperations.slice().sort(function(a, b) { return new Date(a.time) - new Date(b.time); });
    let html = '';
    for (let i = 0; i < allOps.length; i++) {
        const op = allOps[i];
        const timeStr = new Date(op.time).toLocaleString('pt-BR');
        html += '<tr>' +
            '<td style="padding: 10px;">' + timeStr + '</td>' +
            '<td style="padding: 10px;">' + op.action + '</td>' +
            '<td style="padding: 10px;">' + parseFloat(op.quantity).toFixed(2) + '</td>' +
            '<td style="padding: 10px;">$' + parseFloat(op.price).toFixed(2) + '</td>' +
            '<td style="padding: 10px;">$' + parseFloat(op.commission || 0).toFixed(2) + '</td>' +
            '<td style="padding: 10px;">' + op.e_x + '</td>' +
            '</tr>';
    }
    document.getElementById('detailOperations').innerHTML = html;
}

function closeTradeDetails() { document.getElementById('tradeDetails').style.display = 'none'; selectedTrade = null; selectedTradeOperations = []; }