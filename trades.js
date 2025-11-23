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
    function parseTimeToMillis(s) {
        if (!s) return NaN;
        const raw = String(s).trim();
        let m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/);
        if (m) { const dt = new Date(parseInt(m[3],10), parseInt(m[2],10)-1, parseInt(m[1],10), parseInt(m[4],10), parseInt(m[5],10), m[6]?parseInt(m[6],10):0, m[7]?parseInt(m[7],10):0); if (!isNaN(dt.getTime())) return dt.getTime(); }
        m = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/);
        if (m) { const dt = new Date(parseInt(m[3],10), parseInt(m[2],10)-1, parseInt(m[1],10), parseInt(m[4],10), parseInt(m[5],10), m[6]?parseInt(m[6],10):0, m[7]?parseInt(m[7],10):0); if (!isNaN(dt.getTime())) return dt.getTime(); }
        m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?$/);
        if (m) { const dt = new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10), m[4]?parseInt(m[4],10):0, m[5]?parseInt(m[5],10):0, m[6]?parseInt(m[6],10):0, m[7]?parseInt(m[7],10):0); if (!isNaN(dt.getTime())) return dt.getTime(); }
        m = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (m) { const dt = new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10), parseInt(m[4],10), parseInt(m[5],10), m[6]?parseInt(m[6],10):0, 0); if (!isNaN(dt.getTime())) return dt.getTime(); }
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return d.getTime();
        return NaN;
    }
    operations.sort(function(a,b){ const ta = parseTimeToMillis(a.time); const tb = parseTimeToMillis(b.time); if (isNaN(ta) && isNaN(tb)) return 0; if (isNaN(ta)) return -1; if (isNaN(tb)) return 1; return ta - tb; });
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
                        const tsStart = parseTimeToMillis(tradeOpen.startTime);
                        const tsEnd = parseTimeToMillis(op.time);
                        const startIso = isNaN(tsStart) ? String(tradeOpen.startTime || '') : new Date(tsStart).toISOString();
                        const endIso = isNaN(tsEnd) ? String(op.time || '') : new Date(tsEnd).toISOString();
                        candidates.push({ instrument: tradeOpen.instrument, account: tradeOpen.account, type: tradeOpen.type, start_time: startIso, end_time: endIso, status: 'Closed', avg_price_entry: avgEntry, avg_price_exit: avgExit, total_qty_entry: entryQty, total_qty_exit: exitQty, pnl_points: (pointsDiff * entryQty), pnl_dollars: pnlDollars, total_commissions: totalComm, opIds: tradeOpen.entries.concat(tradeOpen.exits).map(function(o){ return o.id; }), opSourceIds: tradeOpen.entries.concat(tradeOpen.exits).map(function(o){ return o.source_id || null; }).filter(function(v){ return v; }) });
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
            .select('id,instrument,account,type,start_time,end_time,trades_seq')
            .eq('user_id', currentUser.id)
            .in('instrument', instruments)
            .in('account', accounts)
            .gte('start_time', minIso)
            .lte('end_time', maxIso);
        const existing = sel.data || [];
        for (let i = 0; i < existing.length; i++) { const x = existing[i]; const k = (x.instrument || '') + '|' + (x.account || '') + '|' + (x.type || '') + '|' + (x.start_time || '') + '|' + (x.end_time || ''); existingMap[k] = x.id; existingMap[k + '|seq'] = x.trades_seq; }
    }
    let nextSeq = 1;
    try {
        const seqRes = await supabaseClient
            .from('trades')
            .select('trades_seq')
            .eq('user_id', currentUser.id)
            .order('trades_seq', { ascending: false })
            .limit(1);
        if (seqRes && seqRes.data && seqRes.data.length > 0 && seqRes.data[0].trades_seq != null) { nextSeq = parseInt(seqRes.data[0].trades_seq, 10) + 1; }
    } catch (e) {}
    const toInsert = []; const keysForInsert = []; const tradeIdByKey = {};
    for (let i = 0; i < candidates.length; i++) {
        const key = kTrade(candidates[i]);
        const exId = existingMap[key];
        if (exId) { tradeIdByKey[key] = exId; }
        else {
            const seq = nextSeq++;
            toInsert.push({ user_id: currentUser.id, instrument: candidates[i].instrument, account: candidates[i].account, type: candidates[i].type, start_time: candidates[i].start_time, end_time: candidates[i].end_time, status: candidates[i].status, avg_price_entry: candidates[i].avg_price_entry, avg_price_exit: candidates[i].avg_price_exit, total_qty_entry: candidates[i].total_qty_entry, total_qty_exit: candidates[i].total_qty_exit, pnl_points: candidates[i].pnl_points, pnl_dollars: candidates[i].pnl_dollars, total_commissions: candidates[i].total_commissions, trades_seq: seq });
            keysForInsert.push(key);
            existingMap[key + '|seq'] = seq;
        }
    }
    if (toInsert.length > 0) {
        const ins = await supabaseClient
            .from('trades')
            .insert(toInsert)
            .select('id,instrument,account,type,start_time,end_time,trades_seq');
        const rows = ins.data || [];
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const k = (r.instrument || '') + '|' + (r.account || '') + '|' + (r.type || '') + '|' + (r.start_time || '') + '|' + (r.end_time || '');
            tradeIdByKey[k] = r.id;
            existingMap[k + '|seq'] = r.trades_seq;
        }
    }
    const updates = [];
    for (let i = 0; i < candidates.length; i++) {
        const key = kTrade(candidates[i]);
        const tId = tradeIdByKey[key];
        const tSeq = existingMap[key + '|seq'];
        if (!tId) continue;
        const ids = candidates[i].opIds || [];
        if (ids.length === 0) continue;
        updates.push({ tradeId: tId, tradeSeq: tSeq, opIds: ids, opSourceIds: candidates[i].opSourceIds || [], instrument: candidates[i].instrument, account: candidates[i].account, start_time: candidates[i].start_time, end_time: candidates[i].end_time });
    }
    const linkLogs = [];
    let opsUpdatedTotal = 0; let opsUpdatedByIds = 0; let opsUpdatedBySource = 0; let opsUpdatedByRange = 0;
    for (let i = 0; i < updates.length; i++) {
        const u = updates[i];
        const chunkSize = 100;
        let updatedCount = 0;
        for (let start = 0; start < u.opIds.length; start += chunkSize) {
            const chunk = u.opIds.slice(start, start + chunkSize);
            const res = await supabaseClient
                .from('operations')
                .update({ trade_id: u.tradeId, trade_seq: u.tradeSeq })
                .in('id', chunk)
                .eq('user_id', currentUser.id)
                .select('id');
            linkLogs.push({ type: 'update_by_ids', tradeId: u.tradeId, chunkCount: chunk.length, affected: res && res.data ? res.data.length : 0, error: res && res.error ? res.error.message : null });
            if (res && !res.error) { const n = (res.data ? res.data.length : 0); updatedCount += n; opsUpdatedTotal += n; opsUpdatedByIds += n; }
        }
        if (updatedCount === 0 && (u.opSourceIds || []).length > 0) {
            for (let start = 0; start < u.opSourceIds.length; start += chunkSize) {
                const sChunk = u.opSourceIds.slice(start, start + chunkSize);
                const res2 = await supabaseClient
                    .from('operations')
                    .update({ trade_id: u.tradeId, trade_seq: u.tradeSeq })
                    .in('source_id', sChunk)
                    .eq('user_id', currentUser.id)
                    .select('id');
                linkLogs.push({ type: 'update_by_source_id', tradeId: u.tradeId, chunkCount: sChunk.length, affected: res2 && res2.data ? res2.data.length : 0, error: res2 && res2.error ? res2.error.message : null });
                if (res2 && !res2.error) { const n2 = (res2.data ? res2.data.length : 0); updatedCount += n2; opsUpdatedTotal += n2; opsUpdatedBySource += n2; }
            }
        }
        if (updatedCount === 0) {
            const res3 = await supabaseClient
                .from('operations')
                .update({ trade_id: u.tradeId, trade_seq: u.tradeSeq })
                .eq('user_id', currentUser.id)
                .eq('instrument', u.instrument)
                .eq('account', u.account)
                .gte('time', u.start_time)
                .lte('time', u.end_time)
                .select('id');
            linkLogs.push({ type: 'update_by_range', tradeId: u.tradeId, instrument: u.instrument, account: u.account, start: u.start_time, end: u.end_time, affected: res3 && res3.data ? res3.data.length : 0, error: res3 && res3.error ? res3.error.message : null });
            if (res3 && !res3.error) { const n3 = (res3.data ? res3.data.length : 0); opsUpdatedTotal += n3; opsUpdatedByRange += n3; }
        }
        if (updatedCount === 0) {
            for (let k = 0; k < (u.opIds || []).length; k++) {
                const singleId = u.opIds[k];
                const r1 = await supabaseClient
                    .from('operations')
                    .update({ trade_id: u.tradeId, trade_seq: u.tradeSeq })
                    .eq('user_id', currentUser.id)
                    .eq('id', singleId)
                    .select('id');
                linkLogs.push({ type: 'update_single_id', tradeId: u.tradeId, id: singleId, affected: r1 && r1.data ? r1.data.length : 0, error: r1 && r1.error ? r1.error.message : null });
                if (r1 && !r1.error && r1.data && r1.data.length > 0) { updatedCount += 1; opsUpdatedTotal += 1; opsUpdatedByIds += 1; continue; }
                const singleSrc = (u.opSourceIds || [])[k];
                if (singleSrc) {
                    const r2 = await supabaseClient
                        .from('operations')
                        .update({ trade_id: u.tradeId, trade_seq: u.tradeSeq })
                        .eq('user_id', currentUser.id)
                        .eq('source_id', singleSrc)
                        .select('id');
                    linkLogs.push({ type: 'update_single_source', tradeId: u.tradeId, source_id: singleSrc, affected: r2 && r2.data ? r2.data.length : 0, error: r2 && r2.error ? r2.error.message : null });
                    if (r2 && !r2.error && r2.data && r2.data.length > 0) { updatedCount += 1; opsUpdatedTotal += 1; opsUpdatedBySource += 1; }
                }
            }
        }
    }
    const insertedCount = Object.keys(tradeIdByKey).length;
    let linkedOps = 0; for (let i = 0; i < updates.length; i++) { linkedOps += (updates[i].opIds || []).length; }
    const summaryHtml = '<div class="success">✅ Trades consolidados: ' + insertedCount + ' inseridos, ' + (candidates.length - insertedCount) + ' duplicatas</div>' +
        '<div class="success">🔗 Operações atualizadas: ' + opsUpdatedTotal + ' de ' + linkedOps + ' (IDs: ' + opsUpdatedByIds + ', source_id: ' + opsUpdatedBySource + ', intervalo: ' + opsUpdatedByRange + ')</div>' +
        '<div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">' +
        '<button class="btn btn-secondary" onclick="toggleTradeErrors()">Ver detalhes da consolidação</button>' +
        '<a id="downloadTradeErrors" class="btn btn-secondary" href="#" download="trade-consolidation-log.json">Baixar log</a>' +
        '</div>' +
        '<div id="tradeErrorsPanel" style="display:none; margin-top:10px; background: #1f2937; color:#e5e7eb; padding:10px; border-radius:4px; max-height:280px; overflow:auto;"></div>';
    const msgEl = document.getElementById('uploadMessage');
    if (msgEl) { const prev = msgEl.innerHTML; msgEl.innerHTML = prev + summaryHtml; }
    window.lastTradeErrors = { summary: { inserted: insertedCount, duplicates: (candidates.length - insertedCount), opsUpdated: opsUpdatedTotal, requested: linkedOps, byIds: opsUpdatedByIds, bySource: opsUpdatedBySource, byRange: opsUpdatedByRange }, details: linkLogs };
    setTradeErrorsDownloadLink(window.lastTradeErrors);
}

function toggleTradeErrors() {
    const panel = document.getElementById('tradeErrorsPanel');
    if (!panel) return;
    const visible = panel.style.display !== 'none';
    if (visible) { panel.style.display = 'none'; return; }
    panel.innerHTML = '<div>Nenhum detalhe adicional</div>';
    panel.style.display = 'block';
}

function setTradeErrorsDownloadLink(tracker) {
    try { const a = document.getElementById('downloadTradeErrors'); if (!a) return; const obj = tracker || {}; const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' }); const url = URL.createObjectURL(blob); a.href = url; } catch (e) {}
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