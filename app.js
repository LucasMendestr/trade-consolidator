// Variáveis globais
let supabaseClient = null;
let currentUser = null;
let currentSession = null;
let allTrades = [];
let filteredTrades = [];
let selectedTrade = null;
let allOperations = [];

function initSupabase() {
    if (window.supabase) {
        const SUPABASE_URL = 'https://wswqbdjruvsfqhjkdvck.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indzd3FiZGpydXZzZnFoamtkdmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNzk4MjEsImV4cCI6MjA3ODY1NTgyMX0.-Ulf2Jf4Wf_5JMaPTzgHx5Ifg8sQqKTMW01Sofr3vMY';
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    }
    return false;
}

function showMessage(type, text) {
    const msg = document.getElementById('authMessage');
    if (type === 'error') {
        msg.innerHTML = `<div class="error">${text}</div>`;
    } else {
        msg.innerHTML = `<div class="success">${text}</div>`;
    }
    setTimeout(() => { msg.innerHTML = ''; }, 5000);
}

function toggleForm() {
    document.getElementById('loginForm').style.display = 
        document.getElementById('loginForm').style.display === 'none' ? 'block' : 'none';
    document.getElementById('registerForm').style.display = 
        document.getElementById('registerForm').style.display === 'none' ? 'block' : 'none';
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
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;

        currentUser = data.user;
        currentSession = data.session;

        showApp();
        await loadDataFromSupabase();
        
    } catch (err) {
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
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;

        showMessage('success', 'Conta criada! Faça login.');
        toggleForm();
        
    } catch (err) {
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

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            await processCSV(e.target.result);
        } catch (err) {
            document.getElementById('uploadMessage').innerHTML = 
                `<div class="error">Erro: ${err.message}</div>`;
        }
    };
    reader.readAsText(file);
}

async function processCSV(csv) {
    const lines = csv.split('\n');
    const headers = lines[0].split(';').map(h => h.trim());
    
    let imported = 0, duplicates = 0;

    document.getElementById('uploadMessage').innerHTML = 
        '<div class="loading">⏳ Importando...</div>';

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        try {
            const values = lines[i].split(';').map(v => v.trim());
            const operation = {};
            
            headers.forEach((h, idx) => {
                operation[h] = values[idx];
            });

            const ninjaId = `${operation.Instrument}-${operation.Time}-${operation.Action}-${operation.Quantity}-${operation.Price}`;

            const { data: existing } = await supabaseClient
                .from('operations')
                .select('id')
                .eq('user_id', currentUser.id)
                .eq('ninja_id', ninjaId)
                .limit(1);

            if (existing && existing.length > 0) {
                duplicates++;
                continue;
            }

            const quantity = parseFloat(operation.Quantity.replace('.', '').replace(',', '.'));
            const price = parseFloat(operation.Price.replace('.', '').replace(',', '.'));
            const commission = parseFloat((operation.Commission || '0').replace('$', '').replace(',', '.'));

            const { error } = await supabaseClient
                .from('operations')
                .insert([{
                    user_id: currentUser.id,
                    ninja_id: ninjaId,
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

            if (!error) {
                imported++;
            }

        } catch (err) {
            console.error('Erro linha:', err);
        }
    }

    document.getElementById('uploadMessage').innerHTML = 
        `<div class="success">✅ ${imported} importadas, ${duplicates} duplicatas</div>`;

    await loadDataFromSupabase();
}

async function loadDataFromSupabase() {
    try {
        const { data: operations } = await supabaseClient
            .from('operations')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('time');

        if (operations && operations.length > 0) {
            allOperations = operations;
            calculateAndDisplayTrades(operations);
        }
    } catch (err) {
        console.error('Erro carregamento:', err);
    }
}

function calculateAndDisplayTrades(operations) {
    const grouped = {};
    operations.forEach(op => {
        const key = op.instrument;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(op);
    });

    allTrades = [];

    Object.entries(grouped).forEach(([instrument, ops]) => {
        let tradeOpen = null;

        ops.forEach(op => {
            if (!tradeOpen) {
                if (op.e_x === 'Entry') {
                    tradeOpen = {
                        instrument: op.instrument,
                        type: op.action === 'Buy' ? 'LONG' : 'SHORT',
                        entries: [op],
                        exits: [],
                        account: op.account,
                        startTime: op.time,
                        status: 'Open'
                    };
                }
            } else {
                if (op.e_x === 'Entry') {
                    tradeOpen.entries.push(op);
                } else {
                    tradeOpen.exits.push(op);

                    const entryQty = tradeOpen.entries.reduce((s, e) => s + parseFloat(e.quantity || 0), 0);
                    const exitQty = tradeOpen.exits.reduce((s, e) => s + parseFloat(e.quantity || 0), 0);

                    if (entryQty <= exitQty) {
                        const avgEntry = tradeOpen.entries.reduce((s, e) => 
                            s + (parseFloat(e.price) * parseFloat(e.quantity)), 0) / entryQty;
                        const avgExit = tradeOpen.exits.reduce((s, e) => 
                            s + (parseFloat(e.price) * parseFloat(e.quantity)), 0) / exitQty;

                        const pointsDiff = avgExit - avgEntry;
                        const totalComm = [...tradeOpen.entries, ...tradeOpen.exits]
                            .reduce((s, o) => s + parseFloat(o.commission || 0), 0);

                        const mult = { 'NQ': 20, 'MNQ': 2, 'GC': 100, 'MGC': 10 }[instrument.substring(0, 3)] || 10;
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
        });

        if (tradeOpen) {
            allTrades.push(tradeOpen);
        }
    });

    populateAccountFilter();
    filterTrades();
    updateDashboard();
}

function populateAccountFilter() {
    const accounts = [...new Set(allTrades.map(t => t.account))].sort();
    const filter = document.getElementById('accountFilter');
    const currentValue = filter.value;
    
    filter.innerHTML = '<option value="">Todas as contas</option>';
    accounts.forEach(acc => {
        filter.innerHTML += `<option value="${acc}">${acc}</option>`;
    });
    
    filter.value = currentValue;
}

function filterTrades() {
    const accountFilter = document.getElementById('accountFilter').value;
    
    filteredTrades = allTrades.filter(t => {
        if (accountFilter && t.account !== accountFilter) return false;
        return true;
    });

    updateTradesTable();
}

function updateDashboard() {
    const closedTrades = filteredTrades.filter(t => t.status === 'Closed');
    const stats = {
        totalTrades: closedTrades.length,
        openTrades: filteredTrades.filter(t => t.status === 'Open').length,
        totalPnL: filteredTrades.reduce((s, t) => s + parseFloat(t.pnlDollars || 0), 0),
        wins: filteredTrades.filter(t => parseFloat(t.pnlDollars || 0) > 0).length,
        losses: filteredTrades.filter(t => parseFloat(t.pnlDollars || 0) < 0).length,
    };

    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card"><div class="stat-label">Trades Fechados</div><div class="stat-value">${stats.totalTrades}</div></div>
        <div class="stat-card"><div class="stat-label">Abertos</div><div class="stat-value">${stats.openTrades}</div></div>
        <div class="stat-card"><div class="stat-label">PnL Total</div><div class="stat-value" style="color: ${stats.totalPnL >= 0 ? '#4CAF50' : '#f44336'}">$${stats.totalPnL.toFixed(2)}</div></div>
        <div class="stat-card"><div class="stat-label">Wins</div><div class="stat-value">${stats.wins}</div></div>
        <div class="stat-card"><div class="stat-label">Losses</div><div class="stat-value">${stats.losses}</div></div>
    `;
}

function updateTradesTable() {
    let tableHtml = '';
    filteredTrades.forEach((t, idx) => {
        const statusClass = t.status === 'Closed' ? 'status-closed' : 'status-open';
        const pnlClass = parseFloat(t.pnlDollars || 0) >= 0 ? 'pnl-positive' : 'pnl-negative';
        
        tableHtml += `
            <tr onclick="showTradeDetails(${idx})" style="cursor: pointer;">
                <td><span class="${statusClass}">${t.status}</span></td>
                <td>${t.account}</td>
                <td>${t.instrument}</td>
                <td>${t.type}</td>
                <td>$${t.avgEntry}</td>
                <td>$${t.avgExit || '-'}</td>
                <td>${t.pnlPoints || '-'}</td>
                <td class="${pnlClass}">$${t.pnlDollars || '-'}</td>
            </tr>
        `;
    });

    document.getElementById('tradesBody').innerHTML = tableHtml || '<tr><td colspan="8" class="loading">Nenhum trade</td></tr>';
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
    document.getElementById('detailPnL').innerHTML = `<span style="color: ${pnlColor};">$${selectedTrade.pnlDollars}</span>`;
    
    populateOperationsTable();
    window.scrollTo(0, document.getElementById('tradeDetails').offsetTop - 100);
}

function populateOperationsTable() {
    const allOps = [...selectedTrade.entries, ...selectedTrade.exits].sort((a, b) => new Date(a.time) - new Date(b.time));
    
    let html = '';
    allOps.forEach(op => {
        const timeStr = new Date(op.time).toLocaleString('pt-BR');
        html += `
            <tr>
                <td style="padding: 10px;">${timeStr}</td>
                <td style="padding: 10px;">${op.action}</td>
                <td style="padding: 10px;">${parseFloat(op.quantity).toFixed(2)}</td>
                <td style="padding: 10px;">$${parseFloat(op.price).toFixed(2)}</td>
                <td style="padding: 10px;">$${parseFloat(op.commission || 0).toFixed(2)}</td>
                <td style="padding: 10px;">${op.e_x}</td>
            </tr>
        `;
    });
    
    document.getElementById('detailOperations').innerHTML = html;
}

function closeTradeDetails() {
    document.getElementById('tradeDetails').style.display = 'none';
    selectedTrade = null;
}

window.addEventListener('load', () => {
    initSupabase();
});
