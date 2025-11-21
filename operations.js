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
    let imported = 0; let errors = 0;
    const batchSize = 500; let batch = [];
    document.getElementById('uploadMessage').innerHTML = '<div class="loading">⏳ Importando...</div>';
    for (let i = 1; i < lines.length; i++) {
        const raw = lines[i]; if (!raw || !raw.trim()) continue;
        try {
            const values = raw.split(';').map(function(v) { return v.trim(); });
            const op = {}; for (let j = 0; j < headers.length; j++) { op[headers[j]] = values[j]; }
            const row = {
                user_id: currentUser.id,
                instrument: op.Instrument,
                action: op.Action,
                quantity: normalizeNumber(op.Quantity),
                price: normalizeNumber(op.Price),
                time: toIsoUTC(op.Time),
                e_x: op['E/X'],
                position: op.Position,
                commission: normalizeNumber((op.Commission || '0').replace('$','')),
                account: op.Account
            };
            batch.push(row);
            if (batch.length >= batchSize) {
                const res = await supabaseClient.from('operations').upsert(batch, { onConflict: 'user_id,digest' });
                if (res.error) { errors += batch.length; } else { imported += (res.data ? res.data.length : batch.length); }
                batch = [];
            }
        } catch (err) { errors++; }
    }
    if (batch.length > 0) {
        const res = await supabaseClient.from('operations').upsert(batch, { onConflict: 'user_id,digest' });
        if (res.error) { errors += batch.length; } else { imported += (res.data ? res.data.length : batch.length); }
    }
    document.getElementById('uploadMessage').innerHTML = '<div class="success">✅ ' + imported + ' processadas, ' + errors + ' erros</div>';
    try { await consolidateTradesForUser(); } catch (e) {}
    await loadDataFromSupabase();
}
