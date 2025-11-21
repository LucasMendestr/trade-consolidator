async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) { try { await processCSV(e.target.result); } catch (err) { document.getElementById('uploadMessage').innerHTML = '<div class="error">Erro: ' + err.message + '</div>'; } };
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
function toIsoUTC(s) { const d = new Date(s); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds())).toISOString(); }

async function processCSV(csv) {
    const lines = csv.split(/\r?\n/);
    const headers = lines[0].split(';').map(function(h) { return h.trim(); });
    let imported = 0; let errors = 0; let duplicates = 0;
    const batchSize = 500; let batch = [];
    const tracker = { parse: 0, validation: 0, normalize: 0, time: 0, insert: 0, other: 0, details: [] };
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
            const d = new Date(op.Time);
            if (isNaN(d.getTime())) { tracker.time++; tracker.details.push({ line: i, type: 'time', message: 'Data/Hora inválida: ' + op.Time, raw: raw }); continue; }
            const qty = normalizeNumber(op.Quantity);
            const prc = normalizeNumber(op.Price);
            let com = normalizeNumber((op.Commission || '0').replace('$',''));
            if (isNaN(qty)) { tracker.normalize++; tracker.details.push({ line: i, type: 'normalize', message: 'Quantidade inválida: ' + op.Quantity, raw: raw }); continue; }
            if (isNaN(prc)) { tracker.normalize++; tracker.details.push({ line: i, type: 'normalize', message: 'Preço inválido: ' + op.Price, raw: raw }); continue; }
            if (isNaN(com)) { tracker.normalize++; tracker.details.push({ line: i, type: 'normalize', message: 'Comissão inválida: ' + op.Commission, raw: raw }); continue; }
            const row = {
                user_id: currentUser.id,
                instrument: op.Instrument,
                action: op.Action,
                quantity: qty,
                price: prc,
                time: toIsoUTC(op.Time),
                e_x: op['E/X'],
                position: op.Position,
                commission: com,
                account: op.Account
            };
            batch.push(row);
            if (batch.length >= batchSize) {
                const result = await dedupAndInsertBatch(batch);
                imported += result.inserted; duplicates += result.duplicates; errors += result.errors;
                if (result.errorDetails && result.errorDetails.length > 0) { for (let k = 0; k < result.errorDetails.length; k++) tracker.details.push(result.errorDetails[k]); tracker.insert += result.errors; }
                batch = [];
            }
        } catch (err) { errors++; tracker.parse++; tracker.details.push({ line: i, type: 'parse', message: err && err.message ? err.message : 'Falha ao processar linha', raw: raw }); }
    }
    if (batch.length > 0) {
        const result = await dedupAndInsertBatch(batch);
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
    try { await consolidateTradesForUser(); } catch (e) {}
    await loadDataFromSupabase();
}

function makeOpKeyFromRow(row) {
    const q = parseFloat(row.quantity || 0).toFixed(6);
    const p = parseFloat(row.price || 0).toFixed(6);
    const c = parseFloat(row.commission || 0).toFixed(6);
    return (row.instrument || '') + '|' + (row.action || '') + '|' + (row.account || '') + '|' + (row.e_x || '') + '|' + (row.position || '') + '|' + q + '|' + p + '|' + c + '|' + (row.time || '');
}

function makeOpKeyFromDb(op) {
    const q = parseFloat(op.quantity || 0).toFixed(6);
    const p = parseFloat(op.price || 0).toFixed(6);
    const c = parseFloat(op.commission || 0).toFixed(6);
    const t = new Date(op.time).toISOString();
    return (op.instrument || '') + '|' + (op.action || '') + '|' + (op.account || '') + '|' + (op.e_x || '') + '|' + (op.position || '') + '|' + q + '|' + p + '|' + c + '|' + t;
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
        const minIso = new Date(minTime).toISOString();
        const maxIso = new Date(maxTime).toISOString();
        let existingKeys = {};
        if (instruments.length > 0) {
            const sel = await supabaseClient
                .from('operations')
                .select('instrument,action,account,e_x,position,quantity,price,commission,time')
                .eq('user_id', currentUser.id)
                .in('instrument', instruments)
                .gte('time', minIso)
                .lte('time', maxIso);
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
        const res = await supabaseClient.from('operations').insert(toInsert).select('id');
        if (res.error) { return { inserted: 0, duplicates: duplicates, errors: toInsert.length, errorDetails: [{ line: null, type: 'insert', message: res.error.message }] }; }
        return { inserted: res.data ? res.data.length : toInsert.length, duplicates: duplicates, errors: 0, errorDetails: [] };
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