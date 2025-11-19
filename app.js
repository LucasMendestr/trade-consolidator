// Variáveis globais
let supabaseClient = null;
let currentUser = null;
let currentSession = null;
let allTrades = [];
let filteredTrades = [];
let selectedTrade = null;
let allOperations = [];
let charts = {};

function initSupabase() {
    if (window.supabase) {
        const SUPABASE_URL = 'https://wswqbdjruvsfqhjkdvck.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indzd3FiZGpydXZzZnFoamtkdmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNzk4MjEsImV4cCI6MjA3ODY1NTgyMX0.-Ulf2Jf4Wf_5JMaPTzgHx5Ifg8sQqKTMW01Sofr3vMY';
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase inicializado');
        return true;
    }
    console.error('❌ Supabase não carregou');
    return false;
}

function showMessage(type, text) {
    const msg = document.getElementById('authMessage');
    if (type === 'error') {
        msg.innerHTML = '<div class="error">' + text + '</div>';
    } else {
        msg.innerHTML = '<div class="success">' + text + '</div>';
    }
    setTimeout(function() { msg.innerHTML = ''; }, 5000);
}

function toggleForm() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    }
}

async function handleLogin() {
    if (!supabaseClient) {
        showMessage('error', 'Supabase não inicializado');
        return;
    }

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showMessage('error', 'Preencha email e senha');
        return;
    }

    try {
        const result = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
        
        if (result.error) throw result.error;

        currentUser = result.data.user;
        currentSession = result.data.session;

        console.log('✅ Login OK');
        showApp();
        await loadDataFromSupabase();
        
    } catch (err) {
        console.error('Erro login:', err);
        showMessage('error', err.message);
    }
}

async function handleRegister() {
    if (!supabaseClient) {
        showMessage('error', 'Supabase não inicializado');
        return;
    }

    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    if (!email || password.length < 6) {
        showMessage('error', 'Email e senha (mín 6) obrigatórios');
        return;
    }

    try {
        const result = await supabaseClient.auth.signUp({ email: email, password: password });
        
        if (result.error) throw result.error;

        console.log('✅ Registro OK');
        showMessage('success', 'Conta criada! Faça login.');
        toggleForm();
        
    } catch (err) {
        console.error('Erro registro:', err);
        showMessage('error', err.message);
    }
}

async function handleLogout() {
    try {
        await supabaseClient.auth.signOut();
        currentUser = null;
        allTrades = [];
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('appScreen').style.display = 'none';
        console.log('✅ Logout OK');
    } catch (err) {
        console.error('Erro logout:', err);
    }
}

function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
    document.getElementById('userEmail').textContent = currentUser.email;
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    console.log('📄 Arquivo:', file.name);
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            await processCSV(e.target.result);
        } catch (err) {
            console.error('Erro:', err);
            document.getElementById('uploadMessage').innerHTML = '<div class="error">Erro: ' + err.message + '</div>';
        }
    };
    reader.readAsText(file);
}

async function deleteAllTransactions() {
    if (!supabaseClient) {
        showMessage('error', 'Supabase não inicializado');
        return;
    }
    if (!confirm('⚠️ Tem certeza que deseja EXCLUIR TODAS as transações? Essa ação não pode ser desfeita!')) {
        return;
    }

    try {
        if (!currentUser) {
            const r = await supabaseClient.auth.getUser();
            if (r.error) throw r.error;
            currentUser = r.data.user;
            if (!currentUser) throw new Error('Usuário não autenticado');
        }

        console.log('🗑️ Deletando todas as transações...');
        document.getElementById('uploadMessage').innerHTML = '<div class="loading">⏳ Deletando...</div>';

        const result = await supabaseClient
            .from('operations')
            .delete()
            .eq('user_id', currentUser.id)
            .select('id');

        if (result.error) throw result.error;

        console.log('✅ Todas as transações foram deletadas');
        const count = result.data ? result.data.length : 0;
        showMessage('success', '✅ ' + count + ' transações excluídas com sucesso!');
        
        allTrades = [];
        allOperations = [];
        document.getElementById('uploadMessage').innerHTML = '';
        await loadDataFromSupabase();
        
    } catch (err) {
        console.error('Erro delete:', err);
        showMessage('error', 'Erro ao deletar: ' + err.message);
        document.getElementById('uploadMessage').innerHTML = '';
    }
}

async function isDuplicateOperation(operation) {
    try {
        const quantity = parseFloat(operation.Quantity.replace('.', '').replace(',', '.'));
        const price = parseFloat(operation.Price.replace('.', '').replace(',', '.'));
        const commission = parseFloat((operation.Commission || '0').replace('$', '').replace(',', '.'));
        const operationTime = new Date(operation.Time).toISOString();

        const result = await supabaseClient
            .from('operations')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('instrument', operation.Instrument)
            .eq('action', operation.Action)
            .eq('account', operation.Account)
            .eq('e_x', operation['E/X']);

        const existing = result.data;

        if (!existing || existing.length === 0) {
            return false;
        }

        for (let i = 0; i < existing.length; i++) {
            const op = existing[i];
            const isSameTime = new Date(op.time).toISOString() === operationTime;
            const isSameQuantity = Math.abs(parseFloat(op.quantity) - quantity) < 0.0001;
            const isSamePrice = Math.abs(parseFloat(op.price) - price) < 0.0001;
            const isSameCommission = Math.abs(parseFloat(op.commission || 0) - commission) < 0.0001;
            const isSamePosition = op.position === operation.Position;

            if (isSameTime && isSameQuantity && isSamePrice && isSameCommission && isSamePosition) {
                return true;
            }
        }

        return false;

    } catch (err) {
        console.error('Erro duplicidade:', err);
        return false;
    }
}

async function processCSV(csv) {
    console.log('🔄 Processando CSV');
    
    const lines = csv.split('\n');
    const headers = lines[0].split(';').map(function(h) { return h.trim(); });
    
    let imported = 0;
    let duplicates = 0;
    let errors = 0;

    document.getElementById('uploadMessage').innerHTML = '<div class="loading">⏳ Importando...</div>';

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        try {
            const values = lines[i].split(';').map(function(v) { return v.trim(); });
            const operation = {};
            
            for (let j = 0; j < headers.length; j++) {
                operation[headers[j]] = values[j];
            }

            const isDuplicate = await isDuplicateOperation(operation);
            
            if (isDuplicate) {
                console.log('⚠️ Duplicada:', operation.Instrument, operation.Time);
                duplicates++;
                continue;
            }

            const quantity = parseFloat(operation.Quantity.replace('.', '').replace(',', '.'));
            const price = parseFloat(operation.Price.replace('.', '').replace(',', '.'));
            const commission = parseFloat((operation.Commission || '0').replace('$', '').replace(',', '.'));

            const result = await supabaseClient
                .from('operations')
                .insert([{
                    user_id: currentUser.id,
                    instrument: operation.Instrument,
                    action: operation.Action,
                    quantity: quantity,
                    price: price,
                    time: new Date(operation.Time).toISOString(),
                    e_x: operation['E/X'],
                    position: operation.Position,
                    commission: commission,
                    account: operation.Account
                }]);

            if (result.error) {
                errors++;
                console.error('Erro insert:', result.error.message);
            } else {
                imported++;
            }

        } catch (err) {
            errors++;
            console.error('Erro linha', i, ':', err);
        }
    }

    document.getElementById('uploadMessage').innerHTML = 
        '<div class="success">✅ ' + imported + ' importadas, ' + duplicates + ' duplicatas, ' + errors + ' erros</div>';

    await loadDataFromSupabase();
}

async function loadDataFromSupabase() {
    try {
        console.log('📥 Carregando operações');

        const result = await supabaseClient
            .from('operations')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('time');

        const operations = result.data;

        if (operations && operations.length > 0) {
            allOperations = operations;
            console.log('📊 ' + operations.length + ' operações');
            calculateAndDisplayTrades(operations);
        } else {
            console.log('ℹ️ Nenhuma operação');
            allTrades = [];
            populateAccountFilter();
            filterTrades();
            updateDashboard();
        }
    } catch (err) {
        console.error('Erro carregamento:', err);
    }
}

function calculateAndDisplayTrades(operations) {
    const grouped = {};
    
    for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        const key = op.instrument;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(op);
    }

    allTrades = [];

    for (const instrument in grouped) {
        const ops = grouped[instrument];
        let tradeOpen = null;

        for (let i = 0; i < ops.length; i++) {
            const op = ops[i];
            
            if (!tradeOpen) {
                if (op.e_x === 'Entry') {
                    tradeOpen = {
                        instrument: op.instrument,
                        type: op.action === 'Buy' ? 'LONG' : 'SHORT',
                        entries: [op],
                        exits: [],
                        account: op.account,
                        startTime: op.time,
                        endTime: null,
                        status: 'Open'
                    };
                }
            } else {
                if (op.e_x === 'Entry') {
                    tradeOpen.entries.push(op);
                } else {
                    tradeOpen.exits.push(op);

                    let entryQty = 0;
                    for (let j = 0; j < tradeOpen.entries.length; j++) {
                        entryQty += parseFloat(tradeOpen.entries[j].quantity || 0);
                    }

                    let exitQty = 0;
                    for (let j = 0; j < tradeOpen.exits.length; j++) {
                        exitQty += parseFloat(tradeOpen.exits[j].quantity || 0);
                    }

                    if (entryQty <= exitQty) {
                        let avgEntryNumerator = 0;
                        for (let j = 0; j < tradeOpen.entries.length; j++) {
                            const e = tradeOpen.entries[j];
                            avgEntryNumerator += parseFloat(e.price) * parseFloat(e.quantity);
                        }
                        const avgEntry = avgEntryNumerator / entryQty;

                        let avgExitNumerator = 0;
                        for (let j = 0; j < tradeOpen.exits.length; j++) {
                            const e = tradeOpen.exits[j];
                            avgExitNumerator += parseFloat(e.price) * parseFloat(e.quantity);
                        }
                        const avgExit = avgExitNumerator / exitQty;

                        const pointsDiff = avgExit - avgEntry;
                        
                        let totalComm = 0;
                        for (let j = 0; j < tradeOpen.entries.length; j++) {
                            totalComm += parseFloat(tradeOpen.entries[j].commission || 0);
                        }
                        for (let j = 0; j < tradeOpen.exits.length; j++) {
                            totalComm += parseFloat(tradeOpen.exits[j].commission || 0);
                        }

                        const multipliers = { 'NQ': 20, 'MNQ': 2, 'GC': 100, 'MGC': 10 };
                        const mult = multipliers[instrument.substring(0, 3)] || 10;
                        const pnlDollars = (pointsDiff * entryQty * mult) - totalComm;

                        tradeOpen.status = 'Closed';
                        tradeOpen.avgEntry = avgEntry.toFixed(2);
                        tradeOpen.avgExit = avgExit.toFixed(2);
                        tradeOpen.pnlPoints = (pointsDiff * entryQty).toFixed(2);
                        tradeOpen.pnlDollars = pnlDollars.toFixed(2);
                        tradeOpen.endTime = op.time;

                        allTrades.push(tradeOpen);
                        tradeOpen = null;
                    }
                }
            }
        }

        if (tradeOpen) {
            allTrades.push(tradeOpen);
        }
    }

    console.log('📈 ' + allTrades.length + ' trades');
    populateAccountFilter();
    filterTrades();
    updateDashboard();
}

function populateAccountFilter() {
    const accounts = [];
    for (let i = 0; i < allTrades.length; i++) {
        if (accounts.indexOf(allTrades[i].account) === -1) {
            accounts.push(allTrades[i].account);
        }
    }
    accounts.sort();

    const filter = document.getElementById('accountFilter');
    const currentValue = filter.value;
    
    filter.innerHTML = '<option value="">Todas as contas</option>';
    for (let i = 0; i < accounts.length; i++) {
        filter.innerHTML += '<option value="' + accounts[i] + '">' + accounts[i] + '</option>';
    }
    
    filter.value = currentValue;
}

function filterTrades() {
    const accountFilter = document.getElementById('accountFilter').value;
    
    filteredTrades = [];
    for (let i = 0; i < allTrades.length; i++) {
        const t = allTrades[i];
        if (accountFilter && t.account !== accountFilter) continue;
        filteredTrades.push(t);
    }

    updateTradesTable();
    updateDashboard();
    renderCharts();
}

function updateDashboard() {
    let totalTrades = filteredTrades.length;
    let totalPnL = 0;
    let wins = 0;
    let losses = 0;
    let sumProfit = 0;
    let sumLoss = 0;

    for (let i = 0; i < filteredTrades.length; i++) {
        const t = filteredTrades[i];
        const pnl = parseFloat(t.pnlDollars || 0);
        totalPnL += pnl;
        if (pnl > 0) { wins++; sumProfit += pnl; }
        if (pnl < 0) { losses++; sumLoss += Math.abs(pnl); }
    }

    const pnlColor = totalPnL >= 0 ? '#4CAF50' : '#f44336';
    const profitFactor = sumLoss > 0 ? (sumProfit / sumLoss) : null;
    const payoffFactor = (wins > 0 && losses > 0) ? ((sumProfit / wins) / (sumLoss / losses)) : null;
    const hitRate = (wins + losses) > 0 ? (wins / (wins + losses)) : 0;

    const closed = [];
    for (let i = 0; i < filteredTrades.length; i++) { if (filteredTrades[i].status === 'Closed') closed.push(filteredTrades[i]); }
    const dailyMap = {};
    let maxGain = null, maxLoss = null;
    for (let i = 0; i < closed.length; i++) {
        const t = closed[i];
        const pnl = parseFloat(t.pnlDollars || 0);
        const d = new Date(t.endTime);
        if (!isNaN(d)) {
            const k = d.toISOString().split('T')[0];
            dailyMap[k] = (dailyMap[k] || 0) + pnl;
        }
        if (pnl > 0) { if (maxGain === null || pnl > maxGain) maxGain = pnl; }
        if (pnl < 0) { if (maxLoss === null || pnl < maxLoss) maxLoss = pnl; }
    }
    const days = Object.keys(dailyMap);
    let bestDay = null, worstDay = null, sumDaily = 0;
    for (let i = 0; i < days.length; i++) {
        const v = dailyMap[days[i]];
        sumDaily += v;
        if (bestDay === null || v > bestDay) bestDay = v;
        if (worstDay === null || v < worstDay) worstDay = v;
    }
    const avgPerTrade = totalTrades > 0 ? (totalPnL / totalTrades) : null;
    const avgPerDay = days.length > 0 ? (sumDaily / days.length) : null;
    const sorted = closed.slice().sort(function(a, b) { return new Date(a.endTime) - new Date(b.endTime); });
    let maxWinStreak = 0, maxLossStreak = 0, curW = 0, curL = 0;
    for (let i = 0; i < sorted.length; i++) {
        const v = parseFloat(sorted[i].pnlDollars || 0);
        if (v > 0) { curW++; curL = 0; } else if (v < 0) { curL++; curW = 0; } else { curW = 0; curL = 0; }
        if (curW > maxWinStreak) maxWinStreak = curW;
        if (curL > maxLossStreak) maxLossStreak = curL;
    }
    const avgGain = wins > 0 ? (sumProfit / wins) : null;
    const avgLoss = losses > 0 ? (sumLoss / losses) : null;

    document.getElementById('statsGrid').innerHTML = 
        '<div class="stat-card"><div class="stat-label">Total de Trades</div><div class="stat-value">' + totalTrades + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Wins</div><div class="stat-value">' + wins + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Losses</div><div class="stat-value">' + losses + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">PnL Total</div><div class="stat-value" style="color: ' + pnlColor + '">$' + totalPnL.toFixed(2) + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Profit Factor</div><div class="stat-value">' + (profitFactor !== null ? profitFactor.toFixed(2) : '-') + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Payoff Factor</div><div class="stat-value">' + (payoffFactor !== null ? payoffFactor.toFixed(2) : '-') + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Taxa de Acerto</div><div class="stat-value">' + (hitRate * 100).toFixed(2) + '%</div></div>' +
        '<div class="stat-card"><div class="stat-label">Maior Ganho (Trade)</div><div class="stat-value">' + (maxGain !== null ? ('$' + maxGain.toFixed(2)) : '-') + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Maior Perda (Trade)</div><div class="stat-value">' + (maxLoss !== null ? ('$' + maxLoss.toFixed(2)) : '-') + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Melhor Dia</div><div class="stat-value">' + (bestDay !== null ? ('$' + bestDay.toFixed(2)) : '-') + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Pior Dia</div><div class="stat-value">' + (worstDay !== null ? ('$' + worstDay.toFixed(2)) : '-') + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Média PnL/Trade</div><div class="stat-value">' + (avgPerTrade !== null ? ('$' + avgPerTrade.toFixed(2)) : '-') + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Média PnL/Dia</div><div class="stat-value">' + (avgPerDay !== null ? ('$' + avgPerDay.toFixed(2)) : '-') + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Streaks</div><div class="stat-value">W:' + maxWinStreak + ' / L:' + maxLossStreak + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Risco x Recompensa</div><div class="stat-value">G:$' + (avgGain !== null ? avgGain.toFixed(2) : '-') + ' / P:$' + (avgLoss !== null ? avgLoss.toFixed(2) : '-') + '</div></div>';
}

function renderCharts() {
    const elDailyCum = document.getElementById('chartDailyCumulative');
    const elDailyBar = document.getElementById('chartDailyBar');
    const elInst = document.getElementById('chartPnlInstrument');
    const elPosNeg = document.getElementById('chartPosNeg');
    const elWinRate = document.getElementById('chartWinRateCumulative');
    if (!elDailyCum || !elDailyBar || !elInst || !elPosNeg || !elWinRate) return;

    const closed = [];
    for (let i = 0; i < filteredTrades.length; i++) { if (filteredTrades[i].status === 'Closed') closed.push(filteredTrades[i]); }

    const dailyMap = {};
    for (let i = 0; i < closed.length; i++) {
        const t = closed[i];
        const d = new Date(t.endTime);
        if (!isNaN(d)) {
            const k = d.toISOString().split('T')[0];
            const pnl = parseFloat(t.pnlDollars || 0);
            dailyMap[k] = (dailyMap[k] || 0) + pnl;
        }
    }
    const dates = Object.keys(dailyMap).sort();
    const dailyVals = dates.map(function(k) { return dailyMap[k]; });
    const cumulative = [];
    let run = 0; for (let i = 0; i < dailyVals.length; i++) { run += dailyVals[i]; cumulative.push(run); }

    if (charts.dailyCumulative) charts.dailyCumulative.destroy();
    charts.dailyCumulative = new Chart(elDailyCum.getContext('2d'), { type: 'line', data: { labels: dates, datasets: [{ label: 'PnL Diário Acumulado', data: cumulative, borderColor: '#7c4dff', backgroundColor: 'rgba(124,77,255,0.2)', tension: 0.25 }] }, options: { plugins: { legend: { display: false } } } });

    if (charts.dailyBar) charts.dailyBar.destroy();
    charts.dailyBar = new Chart(elDailyBar.getContext('2d'), { type: 'bar', data: { labels: dates, datasets: [{ label: 'PnL Diário', data: dailyVals, backgroundColor: dailyVals.map(function(v){ return v >= 0 ? 'rgba(166,244,0,0.7)' : 'rgba(244,67,54,0.7)'; }) }] }, options: { plugins: { legend: { display: false } } } });

    const instMap = {};
    for (let i = 0; i < closed.length; i++) {
        const ins = closed[i].instrument;
        const pnl = parseFloat(closed[i].pnlDollars || 0);
        instMap[ins] = (instMap[ins] || 0) + pnl;
    }
    const insts = Object.keys(instMap);
    const instVals = insts.map(function(k) { return instMap[k]; });

    if (charts.pnlInstrument) charts.pnlInstrument.destroy();
    charts.pnlInstrument = new Chart(elInst.getContext('2d'), { type: 'bar', data: { labels: insts, datasets: [{ label: 'PnL por Instrumento', data: instVals, backgroundColor: 'rgba(106,90,205,0.7)' }] }, options: { plugins: { legend: { display: false } } } });

    let w = 0, l = 0;
    for (let i = 0; i < closed.length; i++) { const p = parseFloat(closed[i].pnlDollars || 0); if (p > 0) w++; else if (p < 0) l++; }

    if (charts.posNeg) charts.posNeg.destroy();
    charts.posNeg = new Chart(elPosNeg.getContext('2d'), { type: 'pie', data: { labels: ['Positivos', 'Negativos'], datasets: [{ data: [w, l], backgroundColor: ['#a6f400', '#7c4dff'] }] } });

    const sorted = closed.slice().sort(function(a, b) { return new Date(a.endTime) - new Date(b.endTime); });
    const wrLabels = [], wrData = [];
    let cw = 0, cl = 0;
    for (let i = 0; i < sorted.length; i++) { const p = parseFloat(sorted[i].pnlDollars || 0); if (p > 0) cw++; else if (p < 0) cl++; const rate = (cw + cl) > 0 ? (cw / (cw + cl)) * 100 : 0; wrLabels.push(new Date(sorted[i].endTime).toLocaleDateString('pt-BR')); wrData.push(rate.toFixed(2)); }

    if (charts.winRate) charts.winRate.destroy();
    charts.winRate = new Chart(elWinRate.getContext('2d'), { type: 'line', data: { labels: wrLabels, datasets: [{ label: 'Win Rate Acumulado (%)', data: wrData, borderColor: '#a6f400', backgroundColor: 'rgba(166,244,0,0.2)', tension: 0.25 }] }, options: { plugins: { legend: { display: false } } } });
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
}

function updateTradesTable() {
    let tableHtml = '';
    
    for (let i = 0; i < filteredTrades.length; i++) {
        const t = filteredTrades[i];
        const statusClass = t.status === 'Closed' ? 'status-closed' : 'status-open';
        const pnlClass = parseFloat(t.pnlDollars || 0) >= 0 ? 'pnl-positive' : 'pnl-negative';
        const endTimeFormatted = formatDate(t.endTime);
        
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
            '</tr>';
    }

    const tradesBody = document.getElementById('tradesBody');
    if (tableHtml === '') {
        tradesBody.innerHTML = '<tr><td colspan="9" class="loading">Nenhum trade</td></tr>';
    } else {
        tradesBody.innerHTML = tableHtml;
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
    window.scrollTo(0, document.getElementById('tradeDetails').offsetTop - 100);
}

function populateOperationsTable() {
    const allOps = [];
    for (let i = 0; i < selectedTrade.entries.length; i++) {
        allOps.push(selectedTrade.entries[i]);
    }
    for (let i = 0; i < selectedTrade.exits.length; i++) {
        allOps.push(selectedTrade.exits[i]);
    }
    
    allOps.sort(function(a, b) {
        return new Date(a.time) - new Date(b.time);
    });
    
    let html = '';
    for (let i = 0; i < allOps.length; i++) {
        const op = allOps[i];
        const timeStr = new Date(op.time).toLocaleString('pt-BR');
        html += 
            '<tr>' +
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

function closeTradeDetails() {
    document.getElementById('tradeDetails').style.display = 'none';
    selectedTrade = null;
}

window.addEventListener('load', function() {
    console.log('🚀 Página carregada');
    initSupabase();
});
