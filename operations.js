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

async function processCSV(csv) {
    const lines = csv.split('\n');
    const headers = lines[0].split(';').map(function(h) { return h.trim(); });
    let imported = 0; let duplicates = 0; let errors = 0;
    document.getElementById('uploadMessage').innerHTML = '<div class="loading">⏳ Importando...</div>';
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        try {
            const values = lines[i].split(';').map(function(v) { return v.trim(); });
            const operation = {}; for (let j = 0; j < headers.length; j++) { operation[headers[j]] = values[j]; }
            const isDuplicate = await isDuplicateOperation(operation);
            if (isDuplicate) { duplicates++; continue; }
            const quantity = parseFloat(operation.Quantity.replace('.', '').replace(',', '.'));
            const price = parseFloat(operation.Price.replace('.', '').replace(',', '.'));
            const commission = parseFloat((operation.Commission || '0').replace('$', '').replace(',', '.'));
            const result = await supabaseClient.from('operations').insert([{ user_id: currentUser.id, instrument: operation.Instrument, action: operation.Action, quantity: quantity, price: price, time: new Date(operation.Time).toISOString(), e_x: operation['E/X'], position: operation.Position, commission: commission, account: operation.Account }]);
            if (result.error) { errors++; } else { imported++; }
        } catch (err) { errors++; }
    }
    document.getElementById('uploadMessage').innerHTML = '<div class="success">✅ ' + imported + ' importadas, ' + duplicates + ' duplicatas, ' + errors + ' erros</div>';
    await loadDataFromSupabase();
}