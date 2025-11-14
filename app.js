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
        console.log('✅ Supabase inicializado com sucesso!');
        return true;
    } else {
        console.error('❌ Supabase não carregou');
        return false;
    }
}

// Mostrar mensagem
function showMessage(type, text) {
    const msg = document.getElementById('authMessage');
    if (type === 'error') {
        msg.innerHTML = `<div class="error">${text}</div>`;
    } else {
        msg.innerHTML = `<div class="success">${text}</div>`;
    }
    setTimeout(() => { msg.innerHTML = ''; }, 5000);
}

// Alternar form
function toggleForm() {
    document.getElementById('loginForm').style.display = 
        document.getElementById('loginForm').style.display === 'none' ? 'block' : 'none';
    document.getElementById('registerForm').style.display = 
        document.getElementById('registerForm').style.display === 'none' ? 'block' : 'none';
}

// Login - API CORRIGIDA
async function handleLogin() {
    if (!supabaseClient) {
        showMessage('error', 'Supabase não foi inicializado');
        return;
    }

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showMessage('error', 'Preencha email e senha');
        return;
    }

    try {
        console.log('🔐 Tentando login com:', email);
        
        // NOVA API SUPABASE
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;

        currentUser = data.user;
        currentSession = data.session;

        console.log('✅ Login realizado!');
        console.log('📧 Email:', currentUser.email);
        console.log('🆔 User ID:', currentUser.id);
        
        showApp();
        await loadDataFromSupabase();
        
    } catch (err) {
        console.error('❌ Erro:', err.message);
        showMessage('error', err.message);
    }
}

// Register - API CORRIGIDA
async function handleRegister() {
    if (!supabaseClient) {
        showMessage('error', 'Supabase não foi inicializado');
        return;
    }

    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    if (!email || password.length < 6) {
        showMessage('error', 'Email e senha (mín 6 chars) obrigatórios');
        return;
    }

    try {
        console.log('📝 Registrando novo usuário:', email);
        
        // NOVA API SUPABASE
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password
        });
        
        if (error) throw error;

        console.log('✅ Conta criada com sucesso!');
        showMessage('success', 'Conta criada! Faça login para continuar.');
        toggleForm();
        
    } catch (err) {
        console.error('❌ Erro:', err.message);
        showMessage('error', err.message);
    }
}

// Logout
async function handleLogout() {
    try {
        await supabaseClient.auth.signOut();
        currentUser = null;
        currentSession = null;
        trades = [];
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('appScreen').style.display = 'none';
        console.log('✅ Logout realizado');
    } catch (err) {
        console.error('❌ Erro logout:', err);
    }
}

// Mostrar app
function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
    document.getElementById('userEmail').textContent = currentUser.email;
}

// Upload CSV
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    console.log('📄 Arquivo selecionado:', file.name);

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            await processCSV(e.target.result);
        } catch (err) {
            console.error('❌ Erro ao processar arquivo:', err);
            document.getElementById('uploadMessage').innerHTML = 
                `<div class="error">Erro: ${err.message}</div>`;
        }
    };
    reader.readAsText(file);
}

// Processar CSV
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
                console.error(`Erro na linha ${i}:`, error.message);
            } else {
                imported++;
            }

        } catch (err) {
            errors++;
            console.error(`Erro ao processar linha ${i}:`, err.message);
        }
    }

    document.getElementById('uploadMessage').innerHTML = 
        `<div class="success">✅ ${imported} importadas, ${duplicates} duplicatas, ${errors} erros</div>`;

    await loadDataFromSupabase();
}

// Carregar dados
async function loadDataFromSupabase() {
    try {
        console.log('📥 Carregando dados...');

        const { data: operations } = await supabaseClient
            .from('operations')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('time');

        if (operations && operations.length > 0) {
            console.log(`📊 ${operations.length} operações carregadas`);
            trades = calculateTrades(operations);
            updateDashboard();
        } else {
            console.log('ℹ️ Nenhuma operação encontrada');
        }
    } catch (err) {
        console.error('❌ Erro:', err);
    }
}

// Calcular trades
function calculateTrades(operations) {
    const grouped = {};
    
    operations.forEach(op => {
        const key = `${op.instrument}-${op.account}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(op);
    });

    const calculatedTrades = [];

    Object.values(grouped).forEach(ops => {
        let currentTrade = null;

        ops.forEach(op => {
            if (!currentTrade) {
                currentTrade = {
                    instrument: op.instrument,
                    account: op.account,
                    type: op.action === 'Buy' ? 'LONG' : 'SHORT',
                    entries: [op],
                    exits: [],
                    startTime: op.time
                };
            } else {
                if (op.e_x === 'Entry') {
                    currentTrade.entries.push(op);
                } else {
                    currentTrade.exits.push(op);

                    const entryQty = currentTrade.entries.reduce((s, e) => s + parseFloat(e.quantity || 0), 0);
                    const exitQty = currentTrade.exits.reduce((s, e) => s + parseFloat(e.quantity || 0), 0);

                    if (entryQty === exitQty) {
                        currentTrade.status = 'Closed';
                        const avgEntry = currentTrade.entries.reduce((s, e) => 
                            s + (parseFloat(e.price) * parseFloat(e.quantity)), 0) / entryQty;
                        const avgExit = currentTrade.exits.reduce((s, e) => 
                            s + (parseFloat(e.price) * parseFloat(e.quantity)), 0) / exitQty;

                        const pointsDiff = avgExit - avgEntry;
                        const totalComm = [...currentTrade.entries, ...currentTrade.exits]
                            .reduce((s, o) => s + parseFloat(o.commission || 0), 0);

                        const mult = { 'NQ': 20, 'MNQ': 2, 'GC': 100, 'MGC': 10 }[currentTrade.instrument.substring(0, 3)] || 10;
                        const pnlDollars = (pointsDiff * entryQty * mult) - totalComm;

                        currentTrade.avgEntry = avgEntry.toFixed(2);
                        currentTrade.avgExit = avgExit.toFixed(2);
                        currentTrade.pnlPoints = (pointsDiff * entryQty).toFixed(2);
                        currentTrade.pnlDollars = pnlDollars.toFixed(2);

                        calculatedTrades.push(currentTrade);
                        currentTrade = null;
                    }
                }
            }
        });

        if (currentTrade) {
            currentTrade.status = 'Open';
            calculatedTrades.push(currentTrade);
        }
    });

    return calculatedTrades;
}

// Atualizar dashboard
function updateDashboard() {
    const stats = {
        totalTrades: trades.filter(t => t.status === 'Closed').length,
        openTrades: trades.filter(t => t.status === 'Open').length,
        totalPnL: trades.reduce((s, t) => s + parseFloat(t.pnlDollars || 0), 0),
        wins: trades.filter(t => parseFloat(t.pnlDollars || 0) > 0).length,
        losses: trades.filter(t => parseFloat(t.pnlDollars || 0) < 0).length,
    };

    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">${stats.totalTrades}</div></div>
        <div class="stat-card"><div class="stat-label">Abertos</div><div class="stat-value">${stats.openTrades}</div></div>
        <div class="stat-card ${stats.totalPnL >= 0 ? 'success' : 'danger'}"><div class="stat-label">PnL Total</div><div class="stat-value">$${stats.totalPnL.toFixed(2)}</div></div>
        <div class="stat-card success"><div class="stat-label">Positivos</div><div class="stat-value">${stats.wins}</div></div>
        <div class="stat-card danger"><div class="stat-label">Negativos</div><div class="stat-value">${stats.losses}</div></div>
    `;

    let tableHtml = '';
    trades.forEach(t => {
        tableHtml += `
            <tr>
                <td><span class="status-badge status-${t.status.toLowerCase()}">${t.status}</span></td>
                <td>${t.instrument}</td>
                <td>${t.type}</td>
                <td>${t.avgEntry}</td>
                <td>${t.avgExit || '-'}</td>
                <td>${t.pnlPoints || '-'}</td>
                <td class="${parseFloat(t.pnlDollars || 0) >= 0 ? 'pnl-positive' : 'pnl-negative'}">$${t.pnlDollars || '-'}</td>
            </tr>
        `;
    });

    document.getElementById('tradesBody').innerHTML = tableHtml || '<tr><td colspan="7" class="loading">Nenhum trade</td></tr>';

    if (trades.length > 0) {
        updateCharts();
    }
}

// Gráficos
function updateCharts() {
    // Gráfico de linha
    new Chart(document.getElementById('pnlChart'), {
        type: 'line',
        data: {
            labels: trades.map((_, i) => `Trade ${i + 1}`),
            datasets: [{
                label: 'PnL',
                data: trades.map(t => parseFloat(t.pnlDollars || 0)),
                borderColor: '#2196F3',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } }
        }
    });

    // Gráfico por instrumento
    const byInstrument = {};
    trades.forEach(t => {
        byInstrument[t.instrument] = (byInstrument[t.instrument] || 0) + parseFloat(t.pnlDollars || 0);
    });

    new Chart(document.getElementById('instrumentChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(byInstrument),
            datasets: [{
                label: 'PnL',
                data: Object.values(byInstrument),
                backgroundColor: Object.values(byInstrument).map(v => v >= 0 ? '#4CAF50' : '#f44336')
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// Inicializar quando página carregar
window.addEventListener('load', () => {
    console.log('🚀 Página carregada, inicializando...');
    initSupabase();
});
