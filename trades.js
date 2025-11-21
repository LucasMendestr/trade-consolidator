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

async function consolidateTradesForUser() {
    if (!supabaseClient || !currentUser) return;
    const opsRes = await supabaseClient
        .from('operations')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('time');
    const operations = opsRes.data || [];
    if (operations.length === 0) return;

    const grouped = {};
    for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        const key = (op.instrument || '') + '|' + (op.account || '');
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(op);
    }

    for (const key in grouped) {
        const ops = grouped[key];
        let tradeOpen = null;
        for (let i = 0; i < ops.length; i++) {
            const op = ops[i];
            if (!tradeOpen) {
                if (op.e_x === 'Entry') {
                    tradeOpen = { instrument: op.instrument, type: op.action === 'Buy' ? 'LONG' : 'SHORT', entries: [op], exits: [], account: op.account, startTime: op.time, endTime: null, status: 'Open' };
                }
            } else {
                if (op.e_x === 'Entry') {
                    tradeOpen.entries.push(op);
                } else {
                    tradeOpen.exits.push(op);
                    let entryQty = 0; for (let j = 0; j < tradeOpen.entries.length; j++) { entryQty += parseFloat(tradeOpen.entries[j].quantity || 0); }
                    let exitQty = 0; for (let j = 0; j < tradeOpen.exits.length; j++) { exitQty += parseFloat(tradeOpen.exits[j].quantity || 0); }
                    if (entryQty <= exitQty) {
                        let avgEntryNumerator = 0; for (let j = 0; j < tradeOpen.entries.length; j++) { const e = tradeOpen.entries[j]; avgEntryNumerator += parseFloat(e.price) * parseFloat(e.quantity); }
                        const avgEntry = avgEntryNumerator / (entryQty || 1);
                        let avgExitNumerator = 0; for (let j = 0; j < tradeOpen.exits.length; j++) { const e = tradeOpen.exits[j]; avgExitNumerator += parseFloat(e.price) * parseFloat(e.quantity); }
                        const avgExit = avgExitNumerator / (exitQty || 1);
                        const pointsDiff = avgExit - avgEntry;
                        let totalComm = 0; for (let j = 0; j < tradeOpen.entries.length; j++) { totalComm += parseFloat(tradeOpen.entries[j].commission || 0); } for (let j = 0; j < tradeOpen.exits.length; j++) { totalComm += parseFloat(tradeOpen.exits[j].commission || 0); }
                        const instrumentCode = (tradeOpen.instrument || '').substring(0, 3);
                        const multipliers = { 'NQ': 20, 'MNQ': 2, 'GC': 100, 'MGC': 10 };
                        const mult = multipliers[instrumentCode] || 10;
                        const pnlDollars = (pointsDiff * entryQty * mult) - totalComm;
                        tradeOpen.status = 'Closed';
                        const startIso = new Date(tradeOpen.startTime).toISOString();
                        const endIso = new Date(op.time).toISOString();
                        const dup = await supabaseClient
                            .from('trades')
                            .select('id')
                            .eq('user_id', currentUser.id)
                            .eq('instrument', tradeOpen.instrument)
                            .eq('account', tradeOpen.account)
                            .eq('type', tradeOpen.type)
                            .eq('start_time', startIso)
                            .eq('end_time', endIso)
                            .limit(1);
                        let tradeId = null;
                        if (dup.data && dup.data.length > 0) {
                            tradeId = dup.data[0].id;
                        } else {
                            const ins = await supabaseClient
                                .from('trades')
                                .insert([{ user_id: currentUser.id, instrument: tradeOpen.instrument, account: tradeOpen.account, type: tradeOpen.type, start_time: startIso, end_time: endIso, status: 'Closed', avg_price_entry: avgEntry, avg_price_exit: avgExit, total_qty_entry: entryQty, total_qty_exit: exitQty, pnl_points: (pointsDiff * entryQty), pnl_dollars: pnlDollars, total_commissions: totalComm }])
                                .select('id')
                                .single();
                            if (ins.data) tradeId = ins.data.id;
                        }
                        if (tradeId) {
                            const opIds = tradeOpen.entries.concat(tradeOpen.exits).map(function(o){ return o.id; });
                            if (opIds.length > 0) {
                                await supabaseClient
                                    .from('operations')
                                    .update({ trade_id: tradeId })
                                    .in('id', opIds)
                                    .eq('user_id', currentUser.id);
                            }
                        }
                        tradeOpen = null;
                    }
                }
            }
        }
    }
}
