async function loadDataFromSupabase() {
    try {
        const result = await supabaseClient.from('trades').select('id,user_id,instrument,account,type,status,avg_price_entry,avg_price_exit,pnl_points,pnl_dollars,start_time,end_time,strategy_id').eq('user_id', currentUser.id).order('end_time');
        const trades = result.data;
        if (trades && trades.length > 0) {
            allTrades = trades.map(function(t){ return { id: t.id, instrument: t.instrument, account: t.account, type: t.type, status: t.status, avgEntry: t.avg_price_entry != null ? parseFloat(t.avg_price_entry).toFixed(2) : '-', avgExit: t.avg_price_exit != null ? parseFloat(t.avg_price_exit).toFixed(2) : '-', pnlPoints: t.pnl_points != null ? parseFloat(t.pnl_points).toFixed(2) : '-', pnlDollars: t.pnl_dollars != null ? parseFloat(t.pnl_dollars).toFixed(2) : '-', startTime: t.start_time, endTime: t.end_time, strategy_id: t.strategy_id || null, entries: [], exits: [] }; });
            populateAccountFilter();
            filterTrades();
            updateDashboard();
            renderCharts();
        } else {
            allTrades = [];
            populateAccountFilter();
            filterTrades();
            updateDashboard();
            renderCharts();
        }
    } catch (err) {}
}

function populateAccountFilter() {
    const accounts = [];
    for (let i = 0; i < allTrades.length; i++) { if (accounts.indexOf(allTrades[i].account) === -1) { accounts.push(allTrades[i].account); } }
    accounts.sort();
    const filter = document.getElementById('accountFilter');
    const currentValue = filter.value;
    filter.innerHTML = '<option value="">Todas as contas</option>';
    for (let i = 0; i < accounts.length; i++) { filter.innerHTML += '<option value="' + accounts[i] + '">' + accounts[i] + '</option>'; }
    filter.value = currentValue;
}

function filterTrades() {
    const accountFilter = (document.getElementById('accountFilter').value || '').trim();
    filteredTrades = [];
    for (let i = 0; i < allTrades.length; i++) {
        const t = allTrades[i];
        const acc = (t.account || '').trim();
        if (accountFilter && acc !== accountFilter) continue;
        filteredTrades.push(t);
    }
    updateTradesTable();
    updateDashboard();
    renderCharts();
}