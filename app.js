// Variáveis globais
let supabaseClient = null;
let currentUser = null;
let currentSession = null;
let trades = [];

// Inicializar Supabase
function initSupabase() {
    console.log('⏳ Inicializando Supabase...');
    
    if (window.supabase) {
        const SUPABASE_URL = 'https://wswqbdjruvsfqhjkdvck.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indzd3FiZGpydXZzZnFoamtkdmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNzk4MjEsImV4cCI6MjA3ODY1NTgyMX0.-Ulf2Jf4Wf_5JMaPTzgHx5Ifg8sQqKTMW01Sofr3vMY';
        
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase inicializado!');
        return true;
    } else {
        console.error('❌ Supabase não carregou');
        return false;
    }
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

        console.log('✅ Login OK:', currentUser.email);
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
        trades = [];
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
    console.log('🔄 Processando CSV...');
    
    const lines = csv.split('\n');
    const headers = lines[0].split(';').map(h => h.trim());
    
    let imported = 0, duplicates = 0, errors = 0;

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

            if (error) {
                errors++;
            } else {
                imported++;
            }

        } catch (err) {
            errors++;
        }
    }

    console.log(`✅ ${imported} importadas`);
    document.getElementById('uploadMessage').innerHTML = 
        `<div class="success">✅ ${imported} importadas, ${duplicates} duplicatas</div>`;

    await loadDataFromSupabase();
}

async function loadDataFromSupabase() {
    try {
        console.log('📥 Carregando operações...');

        const { data: operations } = await supabaseClient
            .from('operations')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('time');

        if (operations && operations.length > 0) {
            console.log(`📊 ${operations.length} operações`);
            calculateAndDisplayTrades(operations);
        }
    } catch (err) {
        console.error('❌ Erro:', err);
    }
}

function calculateAndDisplayTrades(operations) {
    console.log('🔄 Calculando trades...');
    
    // Agrupar por instrumento
    const grouped = {};
    operations.forEach(op => {
        const key = op.instrument;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(op);
    });

    trades = [];

    // Processar cada grupo de operações
    Object.entries(grouped).forEach(([instrument, ops]) => {
        let tradeOpen = null;

        ops.forEach(op => {
            if (!tradeOpen) {
                // Abrir novo trade
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
                    // Adicionar mais entry
                    tradeOpen.entries.push(op);
                } else {
                    // Adicionar exit
                    tradeOpen.exits.push(op);

                    // Calcular se trade fechou
                    const entryQty = tradeOpen.entries.reduce((s, e) => s + parseFloat(e.quantity || 0), 0);
                    const exitQty = tradeOpen.exits.reduce((s, e) => s + parseFloat(e.quantity || 0), 0);

                    if (entryQty <= exitQty) {
                        // Trade fechou
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

                        trades.push(tradeOpen);
                        tradeOpen = null;
                    }
                }
            }
        });

        // Se sobrou trade aberto
        if (tradeOpen) {
            trades.push(tradeOpen);
        }
    });

    console.log(`📈 ${trades.length} trades calculados`);
    updateDashboard();
}

function updateDashboard() {
    const stats = {
        totalTrades: trades.filter(t => t.status === 'Closed').length,
        openTrades: trades.filter(t => t.status === 'Open').length,
        totalPnL: trades.reduce((s, t) => s + parseFloat(t.pnlDollars || 0), 0),
        wins: trades.filter(t => parseFloat(t.pnlDollars || 0) > 0).length,
        losses: trades.filter(t => parseFloat(t.pnlDollars || 0) < 0).length,
    };

    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card"><div class="stat-label">Trades Fechados</div><div class="stat-value">${stats.totalTrades}</div></div>
        <div class="stat-card"><div class="stat-label">Abertos</div><div class="stat-value">${stats.openTrades}</div></div>
        <div class="stat-card"><div class="stat-label">PnL Total</div><div class="stat-value">$${stats.totalPnL.toFixed(2)}</div></div>
        <div class="stat-card"><div class="stat-label">Wins</div><div class="stat-value">${stats.wins}</div></div>
        <div class="stat-card"><div class="stat-label">Losses</div><div class="stat-value">${stats.losses}</div></div>
    `;

    let tableHtml = '';
    trades.forEach(t => {
        tableHtml += `
            <tr>
                <td>${t.status}</td>
                <td>${t.instrument}</td>
                <td>${t.type}</td>
                <td>${t.avgEntry || '-'}</td>
                <td>${t.avgExit || '-'}</td>
                <td style="color: ${parseFloat(t.pnlDollars || 0) >= 0 ? 'green' : 'red'}">$${t.pnlDollars || '-'}</td>
            </tr>
        `;
    });

    document.getElementById('tradesBody').innerHTML = tableHtml || '<tr><td colspan="6">Nenhum trade</td></tr>';
}

window.addEventListener('load', () => {
    initSupabase();
});
