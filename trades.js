async function loadDataFromSupabase() {
    try {
        const result = await supabaseClient.from('trades').select('id,user_id,instrument,account,type,status,avg_price_entry,avg_price_exit,pnl_points,pnl_dollars,start_time,end_time,strategy_id').eq('user_id', currentUser.id).order('end_time');
        const trades = result.data;
        if (trades && trades.length > 0) {
            allTrades = trades.map(function(t){ return { id: t.id, instrument: t.instrument, account: t.account, type: t.type, status: t.status, avgEntry: t.avg_price_entry != null ? parseFloat(t.avg_price_entry).toFixed(2) : '-', avgExit: t.avg_price_exit != null ? parseFloat(t.avg_price_exit).toFixed(2) : '-', pnlPoints: t.pnl_points != null ? parseFloat(t.pnl_points).toFixed(2) : '-', pnlDollars: t.pnl_dollars != null ? parseFloat(t.pnl_dollars).toFixed(2) : '-', startTime: t.start_time, endTime: t.end_time, strategy_id: t.strategy_id || null, entries: [], exits: [] }; });
            populateAccountFilter();
            populateStrategyFilter();
            populateInstrumentFilter();
            filterTrades();
            updateDashboard();
            renderCharts();
        } else {
            allTrades = [];
            populateAccountFilter();
            populateStrategyFilter();
            populateInstrumentFilter();
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

function populateStrategyFilter() {
    const filter = document.getElementById('strategyFilter');
    if (!filter) return;
    const currentValue = filter.value;
    filter.innerHTML = '<option value="">Todas as estratégias</option>';
    for (let i = 0; i < (allStrategies || []).length; i++) {
        const s = allStrategies[i];
        filter.innerHTML += '<option value="' + s.id + '">' + s.name + '</option>';
    }
    filter.value = currentValue;

    const bulk = document.getElementById('bulkStrategySelect');
    if (bulk) {
        const bulkVal = bulk.value;
        bulk.innerHTML = '<option value="">Selecione a estratégia</option>';
        for (let i = 0; i < (allStrategies || []).length; i++) { const s = allStrategies[i]; bulk.innerHTML += '<option value="' + s.id + '">' + s.name + '</option>'; }
        bulk.value = bulkVal;
    }
}

function populateInstrumentFilter() {
    const filter = document.getElementById('instrumentFilter');
    if (!filter) return;
    const set = {};
    for (let i = 0; i < allTrades.length; i++) { const inst = allTrades[i].instrument || ''; if (inst) set[inst] = true; }
    const instruments = Object.keys(set).sort();
    const currentValue = filter.value;
    filter.innerHTML = '<option value="">Todos</option>';
    for (let i = 0; i < instruments.length; i++) { filter.innerHTML += '<option value="' + instruments[i] + '">' + instruments[i] + '</option>'; }
    filter.value = currentValue;
}

function getPresetRange(preset) {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    const y = now.getFullYear();
    const m = now.getMonth();
    const day = now.getDate();
    function startOfWeek(d) { const date = new Date(d); const dayIdx = date.getDay(); const diff = (dayIdx + 6) % 7; date.setDate(date.getDate() - diff); date.setHours(0,0,0,0); return date; }
    function endOfWeek(d) { const s = startOfWeek(d); const e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23,59,59,999); return e; }
    if (preset === 'this_week') { return [startOfWeek(now), endOfWeek(now)]; }
    if (preset === 'last_week') { const last = new Date(now); last.setDate(day - 7); return [startOfWeek(last), endOfWeek(last)]; }
    if (preset === 'this_month') { const s = new Date(y, m, 1); s.setHours(0,0,0,0); const e = new Date(y, m + 1, 0); e.setHours(23,59,59,999); return [s, e]; }
    if (preset === 'last_month') { const s = new Date(y, m - 1, 1); s.setHours(0,0,0,0); const e = new Date(y, m, 0); e.setHours(23,59,59,999); return [s, e]; }
    if (preset === 'this_year') { const s = new Date(y, 0, 1); s.setHours(0,0,0,0); const e = new Date(y, 11, 31); e.setHours(23,59,59,999); return [s, e]; }
    if (preset === 'last_year') { const s = new Date(y - 1, 0, 1); s.setHours(0,0,0,0); const e = new Date(y - 1, 11, 31); e.setHours(23,59,59,999); return [s, e]; }
    return [null, null];
}

function filterTrades() {
    const accountFilter = (document.getElementById('accountFilter') ? document.getElementById('accountFilter').value : '').trim();
    const strategyFilter = (document.getElementById('strategyFilter') ? document.getElementById('strategyFilter').value : '').trim();
    const instrumentFilter = (document.getElementById('instrumentFilter') ? document.getElementById('instrumentFilter').value : '').trim();
    const datePreset = (document.getElementById('datePreset') ? document.getElementById('datePreset').value : '').trim();
    const dateFromStr = (document.getElementById('dateFrom') ? document.getElementById('dateFrom').value : '').trim();
    const dateToStr = (document.getElementById('dateTo') ? document.getElementById('dateTo').value : '').trim();
    let [rangeStart, rangeEnd] = getPresetRange(datePreset);
    if (dateFromStr) { rangeStart = new Date(dateFromStr + 'T00:00:00'); }
    if (dateToStr) { rangeEnd = new Date(dateToStr + 'T23:59:59'); }
    filteredTrades = [];
    for (let i = 0; i < allTrades.length; i++) {
        const t = allTrades[i];
        const acc = (t.account || '').trim();
        if (accountFilter && acc !== accountFilter) continue;
        if (strategyFilter && (t.strategy_id || '') !== strategyFilter) continue;
        if (instrumentFilter && (t.instrument || '') !== instrumentFilter) continue;
        if (rangeStart || rangeEnd) {
            const endDate = t.endTime ? new Date(t.endTime) : null;
            if (!endDate) continue;
            if (rangeStart && endDate < rangeStart) continue;
            if (rangeEnd && endDate > rangeEnd) continue;
        }
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
async function consolidateTradesForUserBatch() {
    if (!supabaseClient || !currentUser) return;
    const opsRes = await supabaseClient
        .from('operations')
        .select('id,user_id,instrument,account,action,e_x,quantity,price,commission,time,position')
        .eq('user_id', currentUser.id)
        .order('time');
    const operations = opsRes.data || [];
    if (!operations || operations.length === 0) return;
    const grouped = {};
    for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        const key = (op.instrument || '') + '|' + (op.account || '');
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(op);
    }
    const candidates = [];
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
                        const startIso = new Date(tradeOpen.startTime).toISOString();
                        const endIso = new Date(op.time).toISOString();
                        candidates.push({ instrument: tradeOpen.instrument, account: tradeOpen.account, type: tradeOpen.type, start_time: startIso, end_time: endIso, status: 'Closed', avg_price_entry: avgEntry, avg_price_exit: avgExit, total_qty_entry: entryQty, total_qty_exit: exitQty, pnl_points: (pointsDiff * entryQty), pnl_dollars: pnlDollars, total_commissions: totalComm, opIds: tradeOpen.entries.concat(tradeOpen.exits).map(function(o){ return o.id; }) });
                        tradeOpen = null;
                    }
                }
            }
        }
    }
    if (candidates.length === 0) return;
    const instrumentsSet = {}; const accountsSet = {}; let minTime = null; let maxTime = null;
    for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        if (c.instrument) instrumentsSet[c.instrument] = true;
        if (c.account) accountsSet[c.account] = true;
        const s = new Date(c.start_time).getTime(); const e = new Date(c.end_time).getTime();
        if (minTime === null || s < minTime) minTime = s; if (minTime === null || e < minTime) minTime = e;
        if (maxTime === null || s > maxTime) maxTime = s; if (maxTime === null || e > maxTime) maxTime = e;
    }
    const instruments = Object.keys(instrumentsSet);
    const accounts = Object.keys(accountsSet);
    const minIso = new Date(minTime).toISOString();
    const maxIso = new Date(maxTime).toISOString();
    function kTrade(x) { return (x.instrument || '') + '|' + (x.account || '') + '|' + (x.type || '') + '|' + (x.start_time || '') + '|' + (x.end_time || ''); }
    const existingMap = {};
    if (instruments.length > 0) {
        const sel = await supabaseClient
            .from('trades')
            .select('id,instrument,account,type,start_time,end_time')
            .eq('user_id', currentUser.id)
            .in('instrument', instruments)
            .in('account', accounts)
            .gte('start_time', minIso)
            .lte('end_time', maxIso);
        const existing = sel.data || [];
        for (let i = 0; i < existing.length; i++) { const x = existing[i]; existingMap[(x.instrument || '') + '|' + (x.account || '') + '|' + (x.type || '') + '|' + (x.start_time || '') + '|' + (x.end_time || '')] = x.id; }
    }
    const toInsert = []; const keysForInsert = []; const tradeIdByKey = {};
    for (let i = 0; i < candidates.length; i++) {
        const key = kTrade(candidates[i]);
        const exId = existingMap[key];
        if (exId) { tradeIdByKey[key] = exId; }
        else {
            toInsert.push({ user_id: currentUser.id, instrument: candidates[i].instrument, account: candidates[i].account, type: candidates[i].type, start_time: candidates[i].start_time, end_time: candidates[i].end_time, status: candidates[i].status, avg_price_entry: candidates[i].avg_price_entry, avg_price_exit: candidates[i].avg_price_exit, total_qty_entry: candidates[i].total_qty_entry, total_qty_exit: candidates[i].total_qty_exit, pnl_points: candidates[i].pnl_points, pnl_dollars: candidates[i].pnl_dollars, total_commissions: candidates[i].total_commissions });
            keysForInsert.push(key);
        }
    }
    if (toInsert.length > 0) {
        const ins = await supabaseClient
            .from('trades')
            .insert(toInsert)
            .select('id,instrument,account,type,start_time,end_time');
        const rows = ins.data || [];
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            tradeIdByKey[(r.instrument || '') + '|' + (r.account || '') + '|' + (r.type || '') + '|' + (r.start_time || '') + '|' + (r.end_time || '')] = r.id;
        }
    }
    const updates = [];
    for (let i = 0; i < candidates.length; i++) {
        const key = kTrade(candidates[i]);
        const tId = tradeIdByKey[key];
        if (!tId) continue;
        const ids = candidates[i].opIds || [];
        if (ids.length === 0) continue;
        updates.push({ tradeId: tId, opIds: ids });
    }
    for (let i = 0; i < updates.length; i++) {
        const u = updates[i];
        await supabaseClient
            .from('operations')
            .update({ trade_id: u.tradeId })
            .in('id', u.opIds)
            .eq('user_id', currentUser.id);
    }
}
async function applyStrategyBulk() {
    if (!supabaseClient || !currentUser) return;
    const bulk = document.getElementById('bulkStrategySelect');
    if (!bulk || !bulk.value) return;
    const checkboxes = document.querySelectorAll('.trade-select:checked');
    const ids = Array.prototype.map.call(checkboxes, function(el){ return el.value; }).filter(function(v){ return v; });
    if (ids.length === 0) return;
    const res = await supabaseClient
        .from('trades')
        .update({ strategy_id: bulk.value })
        .in('id', ids)
        .eq('user_id', currentUser.id)
        .select('id');
    if (res && res.error) return;
    for (let i = 0; i < filteredTrades.length; i++) { if (ids.indexOf(filteredTrades[i].id) !== -1) { filteredTrades[i].strategy_id = bulk.value; } }
    updateTradesTable();
}

function toggleSelectAllTrades(el) {
    const checks = document.querySelectorAll('.trade-select');
    for (let i = 0; i < checks.length; i++) { if (!checks[i].disabled) checks[i].checked = el.checked; }
}