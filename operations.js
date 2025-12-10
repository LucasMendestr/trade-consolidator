function readCommissionUnit() {
    try {
        const el = document.getElementById('commissionPerContract');
        if (!el) return NaN;
        const s = String(el.value || '').trim();
        if (!s) return NaN;
        return parseFloat(s.replace(/\./g,'').replace(',', '.'));
    } catch (e) { return NaN; }
}
function round2(n){ return Math.round(n * 100) / 100; }

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const unit = readCommissionUnit();
    const msgEl = document.getElementById('uploadMessage');
    if (isNaN(unit) || unit < 0) { if (msgEl) { msgEl.innerHTML = '<div class="error">❌ Informe o campo "Valor da Comissão por Contrato" corretamente</div>'; } return; }
    if (msgEl) { msgEl.innerHTML = '<div class="info">ℹ️ Comissão por contrato aplicada: R$ ' + unit.toFixed(2).replace('.', ',') + '</div>'; }
    const reader = new FileReader();
    reader.onload = async function(e) {
        try { await processCSV(e.target.result, unit); }
        catch (err) {
            const el = document.getElementById('uploadMessage');
            if (el) { el.textContent = 'Erro: ' + (err && err.message ? err.message : 'Falha ao processar arquivo'); el.className = 'error'; }
        }
    };
    reader.readAsText(file);
}

async function isDuplicateOperation(operation) {
    try {
        const quantity = parseFloat(operation.Quantity.replace('.', '').replace(',', '.'));
        const price = parseFloat(operation.Price.replace('.', '').replace(',', '.'));
        const commission = parseFloat((operation.Commission || '0').replace('$', '').replace(',', '.'));
        const operationTime = new Date(operation.Time).toISOString();
        const result = await supabaseClient.from('operations').select('*').eq('user_id', currentUser.id).eq('instrument', operation.Instrument).eq('action', operation.Action).eq('account', operation.Account).eq('e_x', operation['E/X']);
        const existing = result.data;
        if (!existing || existing.length === 0) return false;
        for (let i = 0; i < existing.length; i++) {
            const op = existing[i];
            const isSameTime = new Date(op.time).toISOString() === operationTime;
            const isSameQuantity = Math.abs(parseFloat(op.quantity) - quantity) < 0.0001;
            const isSamePrice = Math.abs(parseFloat(op.price) - price) < 0.0001;
            const isSameCommission = Math.abs(parseFloat(op.commission || 0) - commission) < 0.0001;
            const isSamePosition = op.position === operation.Position;
            if (isSameTime && isSameQuantity && isSamePrice && isSameCommission && isSamePosition) return true;
        }
        return false;
    } catch (err) { return false; }
}

function normalizeNumber(n) { if (typeof n !== 'string') return n; return parseFloat(n.replace('.', '').replace(',', '.')); }
function toIsoUTC(s) {
    if (!s) return null;
    const raw = String(s).trim();
    let m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/);
    if (m) {
        const d = new Date(parseInt(m[3],10), parseInt(m[2],10)-1, parseInt(m[1],10), parseInt(m[4],10), parseInt(m[5],10), m[6]?parseInt(m[6],10):0, m[7]?parseInt(m[7],10):0);
        if (!isNaN(d.getTime())) return d.toISOString();
    }
    m = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/);
    if (m) {
        const d = new Date(parseInt(m[3],10), parseInt(m[2],10)-1, parseInt(m[1],10), parseInt(m[4],10), parseInt(m[5],10), m[6]?parseInt(m[6],10):0, m[7]?parseInt(m[7],10):0);
        if (!isNaN(d.getTime())) return d.toISOString();
    }
    m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?$/);
    if (m) {
        const y = parseInt(m[1],10), mo = parseInt(m[2],10)-1, da = parseInt(m[3],10);
        const hh = m[4]?parseInt(m[4],10):0, mm = m[5]?parseInt(m[5],10):0, ss = m[6]?parseInt(m[6],10):0, ms = m[7]?parseInt(m[7],10):0;
        const d = new Date(y, mo, da, hh, mm, ss, ms);
        if (!isNaN(d.getTime())) return d.toISOString();
    }
    m = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
        const d = new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10), parseInt(m[4],10), parseInt(m[5],10), m[6]?parseInt(m[6],10):0, 0);
        if (!isNaN(d.getTime())) return d.toISOString();
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw) || /Z$/.test(raw)) {
        const direct = new Date(raw);
        if (!isNaN(direct.getTime())) return direct.toISOString();
    }
    return null;
}

async function processCSV(csv, commissionUnit) {
    const lines = csv.split(/\r?\n/);
    const headers = lines[0].split(';').map(function(h) { return h.trim(); });
    let imported = 0; let errors = 0; let duplicates = 0;
    const batchSize = 500; let batch = [];
    const tracker = { parse: 0, validation: 0, normalize: 0, time: 0, insert: 0, other: 0, details: [] };
    tracker.details.push({ line: null, type: 'commission_unit', message: 'Comissão unitária aplicada: ' + (isNaN(commissionUnit) ? 'N/A' : commissionUnit.toFixed(2)) });
    const seenAccounts = {};
    const accountIdByNumber = {};
    const rawRows = [];
    try {
        const accRes = await supabaseClient.from('accounts').select('id,account').eq('user_id', currentUser.id);
        const accRows = accRes.data || [];
        for (let i = 0; i < accRows.length; i++) { accountIdByNumber[String(accRows[i].account || '')] = accRows[i].id; }
    } catch(e){}
    document.getElementById('uploadMessage').innerHTML = '<div class="loading">⏳ Importando...</div>';
    for (let i = 1; i < lines.length; i++) {
        const raw = lines[i]; if (!raw || !raw.trim()) continue;
        try {
            const values = raw.split(';').map(function(v) { return v.trim(); });
            const op = {}; for (let j = 0; j < headers.length; j++) { op[headers[j]] = values[j]; }
            const required = ['Instrument','Action','Quantity','Price','Time','Account'];
            let missing = [];
            for (let r = 0; r < required.length; r++) { if (!op[required[r]] || String(op[required[r]]).trim() === '') missing.push(required[r]); }
            if (missing.length > 0) { tracker.validation++; tracker.details.push({ line: i, type: 'validation', message: 'Campos ausentes: ' + missing.join(','), raw: raw }); continue; }
            const qty = normalizeNumber(op.Quantity);
            const prc = normalizeNumber(op.Price);
            let com = isNaN(commissionUnit) ? normalizeNumber((op.Commission || '0').replace('$','')) : round2(parseFloat(qty || 0) * parseFloat(commissionUnit));
            if (isNaN(qty)) { tracker.normalize++; tracker.details.push({ line: i, type: 'normalize', message: 'Quantidade inválida: ' + op.Quantity, raw: raw }); continue; }
            if (isNaN(prc)) { tracker.normalize++; tracker.details.push({ line: i, type: 'normalize', message: 'Preço inválido: ' + op.Price, raw: raw }); continue; }
            if (isNaN(com)) { tracker.normalize++; tracker.details.push({ line: i, type: 'normalize', message: 'Comissão inválida: ' + op.Commission, raw: raw }); continue; }
            function normalizeEX(v) {
                const s = String(v || '').trim().toLowerCase();
                if (!s) return null;
                if (s === 'e' || s === 'entry' || s === 'entrada') return 'Entry';
                if (s === 'x' || s === 'exit' || s === 'saida' || s === 'saída') return 'Exit';
                return s.indexOf('entr') !== -1 ? 'Entry' : (s.indexOf('exit') !== -1 || s.indexOf('sai') !== -1 ? 'Exit' : null);
            }
            function normalizeAction(v) {
                const s = String(v || '').trim().toLowerCase();
                if (!s) return '';
                if (s === 'b' || s === 'buy' || s === 'long') return 'Buy';
                if (s === 's' || s === 'sell' || s === 'short') return 'Sell';
                return s.charAt(0) === 'b' ? 'Buy' : (s.charAt(0) === 's' ? 'Sell' : String(v || ''));
            }
            const row = {
                user_id: currentUser.id,
                instrument: op.Instrument,
                action: normalizeAction(op.Action),
                quantity: qty,
                price: prc,
                time: toIsoUTC(op.Time),
                e_x: normalizeEX(op['E/X']),
                position: op.Position,
                commission: com,
                account_id: null,
                account_number: String(op.Account || ''),
                source_id: getSourceId(op)
            };
            if (!row.e_x) { tracker.validation++; tracker.details.push({ line: i, type: 'validation', message: 'E/X inválido: ' + String(op['E/X'] || ''), raw: raw }); continue; }
            if (row.account_number) { seenAccounts[row.account_number] = true; }
            rawRows.push(row);
        } catch (err) { errors++; tracker.parse++; tracker.details.push({ line: i, type: 'parse', message: err && err.message ? err.message : 'Falha ao processar linha', raw: raw }); }
    }
    const allAccountsInFile = Object.keys(seenAccounts);
    const missingAccounts = [];
    for (let i = 0; i < allAccountsInFile.length; i++) { const a = allAccountsInFile[i]; if (!accountIdByNumber[a]) missingAccounts.push(a); }
    if (missingAccounts.length > 0) {
        console.log('[import] contas faltantes', missingAccounts.length);
        const toCreate = missingAccounts.map(function(acc){ return {
            user_id: currentUser.id,
            account: acc,
            prop_firm_name: acc,
            status: 'forwardtest',
            type: 'forex',
            initial_bal: 0,
            investment: 0,
            drawdown: 0,
            rules: '',
            platform: ''
        }; });
        try {
            console.time('[import] accounts_upsert');
            const up = await supabaseClient
                .from('accounts')
                .upsert(toCreate, { onConflict: 'account', returning: 'minimal' });
            console.timeEnd('[import] accounts_upsert');
            if (up && up.error) { tracker.other++; tracker.details.push({ line: null, type: 'account_create_error', message: up.error.message }); }
        } catch(e){ tracker.other++; tracker.details.push({ line: null, type: 'account_create_error', message: e && e.message ? e.message : 'Falha ao criar contas' }); }
        await new Promise(function(res){ setTimeout(res, 1000); });
        try {
            console.time('[import] accounts_refetch');
            const accRes2 = await supabaseClient.from('accounts').select('id,account').eq('user_id', currentUser.id);
            console.timeEnd('[import] accounts_refetch');
            const accRows2 = accRes2.data || [];
            for (let i = 0; i < accRows2.length; i++) { accountIdByNumber[String(accRows2[i].account || '')] = accRows2[i].id; }
        } catch(e){}
    }
    for (let i = 0; i < rawRows.length; i++) {
        const r = rawRows[i];
        r.account_id = accountIdByNumber[r.account_number] || null;
        if (!r.account_id) { tracker.other++; tracker.details.push({ line: null, type: 'account_missing_after_create', message: 'Conta não cadastrada após criação: ' + String(r.account_number || '') }); continue; }
        batch.push({ user_id: r.user_id, instrument: r.instrument, action: r.action, quantity: r.quantity, price: r.price, time: r.time, e_x: r.e_x, position: r.position, commission: r.commission, account_id: r.account_id, source_id: r.source_id });
        if (batch.length >= batchSize) {
            console.time('[import] insert_batch');
            const result = await dedupAndInsertBatch(batch);
            console.timeEnd('[import] insert_batch');
            imported += result.inserted; duplicates += result.duplicates; errors += result.errors;
            if (result.errorDetails && result.errorDetails.length > 0) { for (let k = 0; k < result.errorDetails.length; k++) tracker.details.push(result.errorDetails[k]); tracker.insert += result.errors; }
            batch = [];
        }
    }
    if (batch.length > 0) {
        console.time('[import] insert_final_batch');
        const result = await dedupAndInsertBatch(batch);
        console.timeEnd('[import] insert_final_batch');
        imported += result.inserted; duplicates += result.duplicates; errors += result.errors;
        if (result.errorDetails && result.errorDetails.length > 0) { for (let k = 0; k < result.errorDetails.length; k++) tracker.details.push(result.errorDetails[k]); tracker.insert += result.errors; }
    }
    const summary = [];
    if (tracker.validation) summary.push('Validação: ' + tracker.validation);
    if (tracker.time) summary.push('Tempo: ' + tracker.time);
    if (tracker.normalize) summary.push('Normalização: ' + tracker.normalize);
    if (tracker.parse) summary.push('Parse: ' + tracker.parse);
    if (tracker.insert) summary.push('Inserção: ' + tracker.insert);
    window.lastUploadErrors = tracker;
    const statusHtml = '<div class="success">✅ ' + imported + ' processadas, ' + duplicates + ' duplicatas, ' + errors + ' erros' + (summary.length ? ' (' + summary.join(' • ') + ')' : '') + '</div>' +
        '<div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">' +
        '<button class="btn btn-secondary" onclick="toggleUploadErrors()">Ver detalhes dos erros</button>' +
        '<a id="downloadErrors" class="btn btn-secondary" href="#" download="upload-erros.json">Baixar log</a>' +
        '</div>' +
        '<div id="uploadErrorsPanel" style="display:none; margin-top:10px; background: #1f2937; color:#e5e7eb; padding:10px; border-radius:4px; max-height:280px; overflow:auto;"></div>';
    document.getElementById('uploadMessage').innerHTML = statusHtml;
    setUploadErrorsDownloadLink(tracker);
    try {
        console.time('[import] consolidate_trades');
        await consolidateTradesForUserBatch();
        console.timeEnd('[import] consolidate_trades');
    } catch (e) { console.error('[import] consolidate_trades error', e && e.message ? e.message : e); }
    await loadDataFromSupabase();
}

    function makeOpKeyFromRow(row) {
        const q = parseFloat(row.quantity || 0).toFixed(6);
        const p = parseFloat(row.price || 0).toFixed(6);
        const c = parseFloat(row.commission || 0).toFixed(6);
        const sid = row.source_id || '';
        return sid ? ('SID|' + sid) : ((row.instrument || '') + '|' + (row.action || '') + '|' + (row.account_id || '') + '|' + (row.e_x || '') + '|' + (row.position || '') + '|' + q + '|' + p + '|' + c + '|' + (row.time || ''));
    }

    function makeOpKeyFromDb(op) {
        const q = parseFloat(op.quantity || 0).toFixed(6);
        const p = parseFloat(op.price || 0).toFixed(6);
        const c = parseFloat(op.commission || 0).toFixed(6);
        const sid = op.source_id || '';
        if (sid) return 'SID|' + sid;
        const t = new Date(op.time).toISOString();
        return (op.instrument || '') + '|' + (op.action || '') + '|' + (op.account_id || '') + '|' + (op.e_x || '') + '|' + (op.position || '') + '|' + q + '|' + p + '|' + c + '|' + t;
    }

async function dedupAndInsertBatch(batch) {
    try {
        const instrumentsSet = {};
        let minTime = null; let maxTime = null;
        for (let i = 0; i < batch.length; i++) {
            const t = new Date(batch[i].time);
            const ti = t.getTime();
            if (minTime === null || ti < minTime) minTime = ti;
            if (maxTime === null || ti > maxTime) maxTime = ti;
            if (batch[i].instrument) instrumentsSet[batch[i].instrument] = true;
        }
        const instruments = Object.keys(instrumentsSet);
        const sourceIds = [];
        for (let i = 0; i < batch.length; i++) { const sid = batch[i].source_id || ''; if (sid) sourceIds.push(sid); }
        if (sourceIds.length > 0) {
            const existingSet = {};
            const chunkSize = 100;
            for (let start = 0; start < sourceIds.length; start += chunkSize) {
                const chunk = sourceIds.slice(start, start + chunkSize);
                const sel = await supabaseClient
                    .from('operations')
                    .select('source_id')
                    .eq('user_id', currentUser.id)
                    .in('source_id', chunk);
                const existing = sel.data || [];
                for (let i = 0; i < existing.length; i++) { existingSet[existing[i].source_id] = true; }
            }
            const keysInBatch = {};
            const toInsert = [];
            let duplicates = 0;
            for (let i = 0; i < batch.length; i++) {
                const sid = batch[i].source_id || '';
                const key = sid || makeOpKeyFromRow(batch[i]);
                if (sid && existingSet[sid]) { duplicates++; continue; }
                if (keysInBatch[key]) { duplicates++; continue; }
                keysInBatch[key] = true;
                toInsert.push(batch[i]);
            }
            if (toInsert.length === 0) { return { inserted: 0, duplicates: duplicates, errors: 0, errorDetails: [] }; }
            const res = await supabaseClient
                .from('operations')
                .upsert(toInsert, { onConflict: 'user_id,source_id', ignoreDuplicates: true, returning: 'minimal' });
            if (res.error) { return { inserted: 0, duplicates: duplicates, errors: toInsert.length, errorDetails: [{ line: null, type: 'insert', message: res.error.message }] }; }
            return { inserted: toInsert.length, duplicates: duplicates, errors: 0, errorDetails: [] };
        }
        const accountIdsSet = {}; for (let i = 0; i < batch.length; i++) { const acc = batch[i].account_id || ''; if (acc) accountIdsSet[acc] = true; }
        const accountIds = Object.keys(accountIdsSet);
        const minIso = new Date(minTime).toISOString();
        const maxIso = new Date(maxTime).toISOString();
        let existingKeys = {};
        if (instruments.length > 0) {
            let query = supabaseClient
                .from('operations')
                .select('instrument,action,account_id,e_x,position,quantity,price,commission,time,source_id')
                .eq('user_id', currentUser.id)
                .in('instrument', instruments)
                .gte('time', minIso)
                .lte('time', maxIso);
            if (accountIds.length > 0) { query = query.in('account_id', accountIds); }
            const sel = await query;
            const existing = sel.data || [];
            for (let i = 0; i < existing.length; i++) { existingKeys[makeOpKeyFromDb(existing[i])] = true; }
        }
        const keysInBatch = {};
        const toInsert = [];
        let duplicates = 0;
        for (let i = 0; i < batch.length; i++) {
            const key = makeOpKeyFromRow(batch[i]);
            if (existingKeys[key]) { duplicates++; continue; }
            if (keysInBatch[key]) { duplicates++; continue; }
            keysInBatch[key] = true;
            toInsert.push(batch[i]);
        }
        if (toInsert.length === 0) { return { inserted: 0, duplicates: duplicates, errors: 0, errorDetails: [] }; }
        const res = await supabaseClient.from('operations').insert(toInsert, { returning: 'minimal' });
        if (res.error) { return { inserted: 0, duplicates: duplicates, errors: toInsert.length, errorDetails: [{ line: null, type: 'insert', message: res.error.message }] }; }
        return { inserted: toInsert.length, duplicates: duplicates, errors: 0, errorDetails: [] };
    } catch (err) {
        return { inserted: 0, duplicates: 0, errors: batch.length, errorDetails: [{ line: null, type: 'insert', message: err && err.message ? err.message : 'Falha ao inserir lote' }] };
    }
}

function toggleUploadErrors() {
    const panel = document.getElementById('uploadErrorsPanel');
    if (!panel) return;
    const visible = panel.style.display !== 'none';
    if (visible) { panel.style.display = 'none'; return; }
    const data = window.lastUploadErrors && window.lastUploadErrors.details ? window.lastUploadErrors.details : [];
    const max = 100;
    let html = '';
    if (data.length === 0) { html = '<div>Nenhum detalhe de erro</div>'; }
    else {
        for (let i = 0; i < Math.min(data.length, max); i++) {
            const d = data[i];
            const ln = d.line != null ? ('Linha ' + d.line + ' • ') : '';
            html += '<div style="padding:6px; border-bottom:1px solid #334155;">' + ln + (d.type || '-') + ' • ' + (d.message || '-') + '</div>';
        }
        if (data.length > max) { html += '<div style="padding:6px; color:#9ca3af;">+' + (data.length - max) + ' itens adicionais</div>'; }
    }
    panel.innerHTML = html;
    panel.style.display = 'block';
}

function setUploadErrorsDownloadLink(tracker) {
    try {
        const a = document.getElementById('downloadErrors');
        if (!a) return;
        const obj = { summary: { validation: tracker.validation, time: tracker.time, normalize: tracker.normalize, parse: tracker.parse, insert: tracker.insert }, details: tracker.details };
        const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        a.href = url;
    } catch (e) {}
}
function getSourceId(op) {
    const keys = ['ID','Id','Order','OrderID','Order Id','ExecutionID','ExecID','TradeID','Trade Id'];
    for (let i = 0; i < keys.length; i++) { const v = op[keys[i]]; if (v != null && String(v).trim() !== '') return String(v).trim(); }
    return null;
}

async function checkAndRedirectMissingAccounts(list) {
    try {
        if (!list || list.length === 0) return;
        const sel = await supabaseClient
            .from('accounts')
            .select('account')
            .eq('user_id', currentUser.id)
            .in('account', list);
        const existing = (sel.data || []).map(function(x){ return x.account; });
        const existSet = {}; for (var i=0;i<existing.length;i++){ existSet[existing[i]] = true; }
        const missing = []; for (var j=0;j<list.length;j++){ var a=list[j]; if (a && !existSet[a]) missing.push(a); }
        if (missing.length > 0) {
            try { localStorage.setItem('pending_accounts', JSON.stringify(missing)); localStorage.setItem('active_nav', 'contas.html'); } catch(e){}
            window.location.href = 'contas.html';
        }
    } catch(e){}
}
