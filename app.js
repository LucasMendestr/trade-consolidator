// Supabase Configuration
const SUPABASE_URL = 'https://wswqbdjruvsfqhjkdvck.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indzd3FiZGpydXZzZnFoamtkdmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNzk4MjEsImV4cCI6MjA3ODY1NTgyMX0.-Ulf2Jf4Wf_5JMaPTzgHx5Ifg8sQqKTMW01Sofr3vMY';

let supabaseClient = null;
let currentUser = null;
let currentSession = null;

// Global state
let allTrades = [];
let allOperations = [];
let filteredTrades = [];
let selectedTradeIndex = null;

// Chart instances
let dailyPnlChart = null;
let instrumentPnlChart = null;
let pieChart = null;
let winRateChart = null;
let dailyPnlBarsChart = null;

// Point multipliers by instrument
const POINT_MULTIPLIERS = {
    'NQ': 20,
    'MNQ': 2,
    'GC': 100,
    'MGC': 10
};

// Get point multiplier for instrument
function getPointMultiplier(instrument) {
    for (const [prefix, multiplier] of Object.entries(POINT_MULTIPLIERS)) {
        if (instrument.startsWith(prefix)) {
            return multiplier;
        }
    }
    return 1; // default
}

// Initialize Supabase and check authentication
window.addEventListener('DOMContentLoaded', async () => {
    console.log('\n🚀 INICIALIZANDO APLICAÇÃO');
    console.log('Data/Hora:', new Date().toLocaleString('pt-BR'));
    
    // Initialize Supabase client v1 (simple initialization)
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    console.log('✅ Supabase client inicializado');
    console.log('🌐 URL:', SUPABASE_URL);
    console.log('🔑 Anon Key presente:', !!SUPABASE_ANON_KEY);
    
    // Check if user is authenticated (session stored in memory)
    if (currentSession) {
        currentUser = currentSession.user;
        console.log('✅ Sessão existente encontrada');
        console.log('👤 Usuário:', currentUser.email);
        showApp();
        updateChecklist();
        await loadDataFromSupabase();
    } else {
        console.log('⚠️ Nenhuma sessão ativa - mostrando tela de login');
        showAuth();
    }
    
    // Set up event listeners
    document.getElementById('csvFile').addEventListener('change', handleFileUpload);
    document.getElementById('instrumentFilter').addEventListener('change', applyFilters);
    document.getElementById('accountFilter').addEventListener('change', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    
    console.log('✅ Event listeners configurados');
    console.log('\n');
});

// Update checklist status
function updateChecklist() {
    const authIcon = document.getElementById('checkAuth');
    if (authIcon) {
        if (currentUser && currentUser.id) {
            authIcon.textContent = '✅';
            authIcon.style.color = 'var(--color-success)';
        } else {
            authIcon.textContent = '❌';
            authIcon.style.color = 'var(--color-error)';
        }
    }
}

// Authentication Functions
function showAuth() {
    document.getElementById('authContainer').classList.remove('hidden');
    document.getElementById('appContainer').classList.add('hidden');
}

function showApp() {
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    if (currentUser) {
        document.getElementById('userEmail').textContent = currentUser.email;
    }
    updateChecklist();
}

function showLogin() {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('loginMessage').innerHTML = '';
    document.getElementById('registerMessage').innerHTML = '';
}

function showRegister() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
    document.getElementById('loginMessage').innerHTML = '';
    document.getElementById('registerMessage').innerHTML = '';
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const messageEl = document.getElementById('loginMessage');
    
    if (!email || !password) {
        messageEl.innerHTML = '<div class="message error">Preencha todos os campos</div>';
        return;
    }
    
    messageEl.innerHTML = '<div class="message">Entrando...</div>';
    
    try {
        // Supabase v1 API: signIn instead of signInWithPassword
        const { user, session, error } = await supabaseClient.auth.signIn({
            email: email,
            password: password
        });
        
        if (error) {
            console.error('Erro no login:', error);
            messageEl.innerHTML = `<div class="message error">Erro ao fazer login: ${error.message}</div>`;
            return;
        }
        
        // Store session in memory
        currentSession = session;
        currentUser = user;
        
        console.log('\n✅ ===== LOGIN REALIZADO COM SUCESSO =====');
        console.log('📧 Email:', currentUser.email);
        console.log('🆔 User ID:', currentUser.id);
        console.log('🔑 Session válida:', !!currentSession);
        console.log('========================================\n');
        
        showApp();
        updateChecklist();
        await loadDataFromSupabase();
    } catch (err) {
        console.error('Erro ao fazer login:', err);
        messageEl.innerHTML = `<div class="message error">Erro ao conectar: ${err.message}</div>`;
    }
}

async function handleRegister() {
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
    const messageEl = document.getElementById('registerMessage');
    
    if (!email || !password || !passwordConfirm) {
        messageEl.innerHTML = '<div class="message error">Preencha todos os campos</div>';
        return;
    }
    
    if (password !== passwordConfirm) {
        messageEl.innerHTML = '<div class="message error">As senhas não coincidem</div>';
        return;
    }
    
    if (password.length < 6) {
        messageEl.innerHTML = '<div class="message error">A senha deve ter no mínimo 6 caracteres</div>';
        return;
    }
    
    messageEl.innerHTML = '<div class="message">Criando conta...</div>';
    
    try {
        // Supabase v1 API: signUp
        const { user, session, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password
        });
        
        if (error) {
            console.error('Erro ao criar conta:', error);
            messageEl.innerHTML = `<div class="message error">Erro ao criar conta: ${error.message}</div>`;
            return;
        }
        
        messageEl.innerHTML = '<div class="message success">Conta criada com sucesso! Fazendo login...</div>';
        
        console.log('✅ CONTA CRIADA COM SUCESSO');
        console.log('📧 Email:', user?.email);
        console.log('🆔 User ID:', user?.id);
        
        // Store session in memory and auto login
        setTimeout(() => {
            currentSession = session;
            currentUser = user;
            
            console.log('✅ Sessão armazenada');
            console.log('🔑 Session válida:', !!currentSession);
            
            showApp();
        }, 1000);
    } catch (err) {
        console.error('Erro ao criar conta:', err);
        messageEl.innerHTML = `<div class="message error">Erro ao conectar: ${err.message}</div>`;
    }
}

async function handleLogout() {
    try {
        await supabaseClient.auth.signOut();
    } catch (err) {
        console.error('Logout error:', err);
    }
    
    // Clear in-memory session
    currentSession = null;
    currentUser = null;
    allTrades = [];
    allOperations = [];
    filteredTrades = [];
    selectedTradeIndex = null;
    showAuth();
    showLogin();
}

// Verify database connection and permissions
async function verifyDatabaseConnection() {
    console.log('\n🔍 VERIFICANDO CONEXÃO COM DATABASE...');
    
    if (!currentUser || !currentUser.id) {
        console.error('❌ Usuário não autenticado');
        return false;
    }
    
    try {
        // Test SELECT permission
        console.log('Testando permissão SELECT...');
        const { data: selectTest, error: selectError } = await supabaseClient
            .from('operations')
            .select('id')
            .eq('user_id', currentUser.id)
            .limit(1);
        
        if (selectError) {
            console.error('❌ Erro no SELECT:', selectError.message);
            return false;
        }
        console.log('✅ SELECT: OK');
        
        // Test INSERT permission with a minimal test record
        console.log('Testando permissão INSERT...');
        const testOperation = {
            user_id: currentUser.id,
            ninja_id: 'TEST_' + Date.now(),
            instrument: 'TEST',
            action: 'Buy',
            quantity: 1,
            price: 1.0,
            time: new Date().toISOString(),
            e_x: 'E',
            position: '1',
            commission: 0,
            account: 'TEST'
        };
        
        // Supabase v1 API: insert returns data directly
        const { data: insertTest, error: insertError } = await supabaseClient
            .from('operations')
            .insert([testOperation]);
        
        if (insertError) {
            console.error('❌ Erro no INSERT:', insertError.message);
            console.error('Código:', insertError.code);
            console.error('Detalhes:', insertError.details);
            console.error('Hint:', insertError.hint);
            
            // Diagnose the error
            if (insertError.code === '42501' || insertError.message.includes('policy')) {
                console.error('\n🔒 DIAGNÓSTICO: Erro de RLS Policy');
                console.error('SOLUÇÃO: Configure a RLS policy no Supabase:');
                console.error('1. Vá para: Authentication > Policies');
                console.error('2. Na tabela "operations", adicione:');
                console.error('   - Policy name: "Users can insert their own operations"');
                console.error('   - Command: INSERT');
                console.error('   - Using: true');
                console.error('   - With check: (auth.uid() = user_id)');
            }
            
            return false;
        }
        
        console.log('✅ INSERT: OK');
        
        // Delete test record
        if (insertTest && insertTest[0]) {
            await supabaseClient
                .from('operations')
                .delete()
                .eq('id', insertTest[0].id);
            console.log('✅ Registro de teste removido');
        }
        
        console.log('✅ CONEXÃO COM DATABASE: OK\n');
        return true;
        
    } catch (err) {
        console.error('❌ Erro ao verificar conexão:', err);
        return false;
    }
}

// Parse CSV file
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        console.log('Nenhum arquivo selecionado');
        return;
    }

    console.log('\n=== ARQUIVO SELECIONADO ===');
    console.log('📄 Nome:', file.name);
    console.log('📊 Tamanho:', file.size, 'bytes');
    console.log('📝 Tipo:', file.type);
    
    if (!currentUser) {
        console.error('❌ Usuário não autenticado');
        showMessage('Erro: Você precisa fazer login primeiro!', 'error');
        return;
    }
    
    console.log('✅ Usuário autenticado:', currentUser.email);

    const reader = new FileReader();
    reader.onload = function(e) {
        console.log('Arquivo lido com sucesso');
        try {
            const content = e.target.result;
            parseCSV(content);
        } catch (error) {
            console.error('Erro no handleFileUpload:', error);
            showMessage('Erro ao processar arquivo: ' + error.message, 'error');
        }
    };
    
    reader.onerror = function(e) {
        console.error('Erro ao ler arquivo:', e);
        showMessage('Erro ao ler arquivo', 'error');
    };
    
    reader.readAsText(file);
}

// Generate unique ninja_id for operation
function generateNinjaId(operation) {
    const timeStr = operation.Time ? operation.Time.getTime().toString() : '';
    return `${operation.Instrument}${timeStr}${operation.Action}${operation.Quantity}${operation.Price}`;
}

// Parse CSV content
async function parseCSV(content) {
    console.log('\n=== INÍCIO DO PARSE CSV ===');
    console.log('📏 Tamanho do conteúdo:', content.length);
    console.log('👤 Usuário atual:', currentUser?.email);
    console.log('🆔 User ID:', currentUser?.id);
    
    const statusEl = document.getElementById('uploadStatus');
    statusEl.innerHTML = '<div class="message">Processando CSV...</div>';
    
    // Verify database connection before proceeding
    console.log('\nVerificando permissões do banco de dados...');
    statusEl.innerHTML = '<div class="message">Verificando permissões...</div>';
    
    const canConnect = await verifyDatabaseConnection();
    if (!canConnect) {
        const errorMsg = 'Erro: Não foi possível conectar ao banco de dados. Verifique o console (F12) para detalhes.';
        showMessage(errorMsg, 'error');
        statusEl.innerHTML = `<div class="message error">${errorMsg}<br><br>🔍 Abra o Console do navegador (F12) para ver os detalhes do erro.</div>`;
        return;
    }
    
    statusEl.innerHTML = '<div class="message">Processando CSV...</div>';
    
    try {
        const lines = content.split('\n').filter(line => line.trim());
        console.log('Número de linhas:', lines.length);
        
        if (lines.length < 2) {
            showMessage('Arquivo CSV vazio ou inválido', 'error');
            statusEl.innerHTML = '';
            return;
        }

        const headers = lines[0].split(';').map(h => h.trim());
        console.log('Headers encontrados:', headers);
        
        const operations = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(';');
            if (values.length < headers.length) {
                console.warn(`Linha ${i} ignorada - campos insuficientes`);
                continue;
            }

            const operation = {};
            headers.forEach((header, index) => {
                operation[header] = values[index] ? values[index].trim() : '';
            });

            // Parse numbers and dates
            operation.Quantity = parseFloat(operation.Quantity || '0');
            operation.Price = parsePrice(operation.Price || '0');
            operation.Commission = parseCommission(operation.Commission || '0');
            operation.Time = parseDateTime(operation.Time);
            operation.Position = operation.Position || '';
            operation.Action = operation.Action || '';
            operation.Instrument = operation.Instrument || '';
            operation.Account = operation.Account || '';
            operation['E/X'] = operation['E/X'] || '';

            operations.push(operation);
        }

        console.log(`${operations.length} operações parseadas com sucesso`);
        console.log('Primeira operação:', operations[0]);
        
        allOperations = operations;
        
        // CRITICAL: Save to Supabase BEFORE processing trades
        if (currentUser) {
            console.log('Salvando operações no Supabase...');
            await saveOperationsToSupabase(operations);
            // After saving, reload from Supabase to ensure consistency
            await loadDataFromSupabase();
        } else {
            console.warn('Usuário não autenticado - processando apenas localmente');
            processTrades(operations);
            showMessage(`Arquivo carregado com sucesso! ${operations.length} operações encontradas.`, 'success');
            statusEl.innerHTML = '';
        }
        
    } catch (error) {
        console.error('ERRO NO PARSE CSV:', error);
        showMessage('Erro ao processar arquivo: ' + error.message, 'error');
        statusEl.innerHTML = `<div class="message error">Erro: ${error.message}</div>`;
    }
    
    console.log('=== FIM DO PARSE CSV ===');
}

// Parse price (handle comma and space as decimal separator)
function parsePrice(priceStr) {
    if (!priceStr) return 0;
    // Remove spaces and replace comma with dot
    const cleaned = priceStr.replace(/\s/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
}

// Parse commission (format: "$ 0,00" or "$ 1,50")
function parseCommission(commissionStr) {
    if (!commissionStr) return 0;
    // Remove $ symbol and spaces, replace comma with dot
    const cleaned = commissionStr.replace(/\$/g, '').replace(/\s/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
}

// Parse datetime
function parseDateTime(dateStr) {
    if (!dateStr) return null;
    // Format: DD/MM/YYYY HH:MM:SS
    const parts = dateStr.split(' ');
    if (parts.length !== 2) return null;
    
    const dateParts = parts[0].split('/');
    const timeParts = parts[1].split(':');
    
    if (dateParts.length !== 3 || timeParts.length !== 3) return null;
    
    const day = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1;
    const year = parseInt(dateParts[2]);
    const hour = parseInt(timeParts[0]);
    const minute = parseInt(timeParts[1]);
    const second = parseInt(timeParts[2]);
    
    return new Date(year, month, day, hour, minute, second);
}

// Process trades from operations
function processTrades(operations) {
    // Sort by time
    const sorted = [...operations].sort((a, b) => {
        if (!a.Time || !b.Time) return 0;
        return a.Time - b.Time;
    });

    // Group by instrument and account
    const groups = {};
    sorted.forEach(op => {
        const key = `${op.Instrument}_${op.Account}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(op);
    });

    // Process each group to identify trade cycles
    const trades = [];
    Object.keys(groups).forEach(key => {
        const groupOps = groups[key];
        trades.push(...identifyTradeCycles(groupOps));
    });

    allTrades = trades;
    filteredTrades = trades;
    updateUI();
}

// Identify trade cycles
function identifyTradeCycles(operations) {
    const trades = [];
    let currentTrade = null;
    let currentPosition = 0;

    operations.forEach(op => {
        const prevPosition = currentPosition;
        
        // Calculate new position
        if (op.Action === 'Buy') {
            currentPosition += op.Quantity;
        } else if (op.Action === 'Sell') {
            currentPosition -= op.Quantity;
        }

        // Start new trade if position was zero or changes sign
        if (prevPosition === 0 && currentPosition !== 0) {
            // New trade starting
            currentTrade = {
                instrument: op.Instrument,
                account: op.Account,
                type: op.Action === 'Buy' ? 'LONG' : 'SHORT',
                operations: [op],
                startTime: op.Time,
                endTime: null,
                status: 'open',
                initialQuantity: Math.abs(currentPosition),
                entryOps: [],
                exitOps: [],
                totalQuantityEntry: 0,
                totalQuantityExit: 0,
                avgEntryPrice: 0,
                avgExitPrice: 0,
                pnlPoints: 0,
                pnlDollars: 0,
                commissions: [],
                totalCommissions: 0,
                pnlBruto: 0,
                pnlLiquido: 0
            };
        } else if (currentTrade) {
            // Add to current trade
            currentTrade.operations.push(op);
        }

        // Track entry and exit operations
        if (currentTrade) {
            if (currentTrade.type === 'LONG') {
                if (op.Action === 'Buy') {
                    currentTrade.entryOps.push(op);
                } else if (op.Action === 'Sell') {
                    currentTrade.exitOps.push(op);
                }
            } else { // SHORT
                if (op.Action === 'Sell') {
                    currentTrade.entryOps.push(op);
                } else if (op.Action === 'Buy') {
                    currentTrade.exitOps.push(op);
                }
            }
        }

        // Close trade if position returns to zero
        if (currentTrade && currentPosition === 0) {
            currentTrade.endTime = op.Time;
            currentTrade.status = 'closed';
            calculateTradePnL(currentTrade);
            trades.push(currentTrade);
            currentTrade = null;
        }
    });

    // Handle open trade
    if (currentTrade) {
        calculateTradePnL(currentTrade);
        trades.push(currentTrade);
    }

    return trades;
}

// Calculate trade PnL in points and dollars
function calculateTradePnL(trade) {
    // Calculate average entry price and TOTAL entry quantity
    let totalEntryQty = 0;
    let totalEntryValue = 0;
    trade.entryOps.forEach(op => {
        totalEntryQty += op.Quantity;
        totalEntryValue += op.Quantity * op.Price;
    });
    trade.avgEntryPrice = totalEntryQty > 0 ? totalEntryValue / totalEntryQty : 0;
    trade.totalQuantityEntry = totalEntryQty;

    // Calculate average exit price and TOTAL exit quantity
    let totalExitQty = 0;
    let totalExitValue = 0;
    trade.exitOps.forEach(op => {
        totalExitQty += op.Quantity;
        totalExitValue += op.Quantity * op.Price;
    });
    trade.avgExitPrice = totalExitQty > 0 ? totalExitValue / totalExitQty : 0;
    trade.totalQuantityExit = totalExitQty;

    // Calculate PnL in points using TOTAL quantity (sum of all entries)
    let pointsDiff = 0;
    if (trade.type === 'LONG') {
        pointsDiff = trade.avgExitPrice - trade.avgEntryPrice;
    } else { // SHORT
        pointsDiff = trade.avgEntryPrice - trade.avgExitPrice;
    }
    
    // CRITICAL FIX: Use totalQuantityEntry instead of initialQuantity
    trade.pnlPoints = pointsDiff * totalEntryQty;

    // Calculate PnL in dollars (GROSS)
    const multiplier = getPointMultiplier(trade.instrument);
    trade.pnlBruto = trade.pnlPoints * multiplier;

    // Calculate total commissions for this trade
    trade.commissions = [];
    let totalCommissions = 0;
    
    // Add entry commissions
    trade.entryOps.forEach(op => {
        const commission = op.Commission || 0;
        trade.commissions.push({
            operation: `Entry ${op.Action}`,
            quantity: op.Quantity,
            price: op.Price,
            commission: commission
        });
        totalCommissions += commission;
    });
    
    // Add exit commissions
    trade.exitOps.forEach(op => {
        const commission = op.Commission || 0;
        trade.commissions.push({
            operation: `Exit ${op.Action}`,
            quantity: op.Quantity,
            price: op.Price,
            commission: commission
        });
        totalCommissions += commission;
    });
    
    trade.totalCommissions = totalCommissions;
    
    // Calculate NET PnL (subtract commissions)
    trade.pnlLiquido = trade.pnlBruto - totalCommissions;
    
    // Update pnlDollars to be the NET value
    trade.pnlDollars = trade.pnlLiquido;
}

// Update UI
function updateUI() {
    updateStats();
    updateFilters();
    updateTradesTable();
    updateCharts();
    updateInsights();
    
    document.getElementById('chartsSection').classList.remove('hidden');
    document.getElementById('insightsSection').classList.remove('hidden');
    document.getElementById('statsSection').classList.remove('hidden');
    document.getElementById('filtersSection').classList.remove('hidden');
    document.getElementById('tradesSection').classList.remove('hidden');
}

// Update statistics
function updateStats() {
    const closedTrades = filteredTrades.filter(t => t.status === 'closed');
    const openTrades = filteredTrades.filter(t => t.status === 'open');
    const wins = closedTrades.filter(t => t.pnlLiquido > 0);
    const losses = closedTrades.filter(t => t.pnlLiquido < 0);
    
    const totalPnlDollars = filteredTrades.reduce((sum, t) => sum + t.pnlLiquido, 0);
    const totalPnlPoints = filteredTrades.reduce((sum, t) => sum + t.pnlPoints, 0);
    const totalCommissions = filteredTrades.reduce((sum, t) => sum + (t.totalCommissions || 0), 0);
    const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
    
    // Calculate profit factor
    const totalWins = wins.reduce((sum, t) => sum + t.pnlLiquido, 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnlLiquido, 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

    // Update stats
    document.getElementById('totalTrades').textContent = closedTrades.length;
    document.getElementById('openTrades').textContent = openTrades.length;
    
    const pnlDollarsElement = document.getElementById('totalPnlDollars');
    pnlDollarsElement.textContent = formatDollars(totalPnlDollars);
    pnlDollarsElement.className = 'stat-value ' + (totalPnlDollars > 0 ? 'positive' : totalPnlDollars < 0 ? 'negative' : '');
    
    const pnlPointsElement = document.getElementById('totalPnlPoints');
    pnlPointsElement.textContent = totalPnlPoints.toFixed(2);
    pnlPointsElement.className = 'stat-value ' + (totalPnlPoints > 0 ? 'positive' : totalPnlPoints < 0 ? 'negative' : '');
    
    document.getElementById('winRate').textContent = winRate.toFixed(1) + '%';
    document.getElementById('profitFactor').textContent = profitFactor.toFixed(2);
    
    // Update total commissions
    document.getElementById('totalCommissions').textContent = formatDollars(totalCommissions);
}

// Update filters
function updateFilters() {
    const instruments = [...new Set(allTrades.map(t => t.instrument))].sort();
    const accounts = [...new Set(allTrades.map(t => t.account))].sort();

    const instrumentFilter = document.getElementById('instrumentFilter');
    const accountFilter = document.getElementById('accountFilter');

    // Save current values
    const currentInstrument = instrumentFilter.value;
    const currentAccount = accountFilter.value;

    // Update instrument filter
    instrumentFilter.innerHTML = '<option value="all">Todos</option>';
    instruments.forEach(inst => {
        const option = document.createElement('option');
        option.value = inst;
        option.textContent = inst;
        instrumentFilter.appendChild(option);
    });
    instrumentFilter.value = currentInstrument;

    // Update account filter
    accountFilter.innerHTML = '<option value="all">Todas</option>';
    accounts.forEach(acc => {
        const option = document.createElement('option');
        option.value = acc;
        option.textContent = acc;
        accountFilter.appendChild(option);
    });
    accountFilter.value = currentAccount;
}

// Apply filters
function applyFilters() {
    const instrumentFilter = document.getElementById('instrumentFilter').value;
    const accountFilter = document.getElementById('accountFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;

    filteredTrades = allTrades.filter(trade => {
        if (instrumentFilter !== 'all' && trade.instrument !== instrumentFilter) return false;
        if (accountFilter !== 'all' && trade.account !== accountFilter) return false;
        if (statusFilter !== 'all' && trade.status !== statusFilter) return false;
        return true;
    });

    updateStats();
    updateTradesTable();
    updateCharts();
    updateInsights();
    closeDetailPanel();
}

// Update trades table
function updateTradesTable() {
    const tbody = document.getElementById('tradesTableBody');
    tbody.innerHTML = '';

    if (filteredTrades.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 11;
        cell.className = 'empty-state';
        cell.textContent = 'Nenhum trade encontrado';
        return;
    }

    filteredTrades.forEach((trade, index) => {
        const row = tbody.insertRow();
        row.onclick = () => showTradeDetails(index);

        // Status
        const statusCell = row.insertCell();
        statusCell.innerHTML = `<span class="status-badge ${trade.status}">${trade.status === 'closed' ? 'Fechado' : 'Aberto'}</span>`;

        // Instrument
        row.insertCell().textContent = trade.instrument;

        // Start date
        row.insertCell().textContent = formatDateTime(trade.startTime);

        // End date
        row.insertCell().textContent = trade.endTime ? formatDateTime(trade.endTime) : '-';

        // Type
        const typeCell = row.insertCell();
        typeCell.innerHTML = `<span class="trade-type ${trade.type.toLowerCase()}">${trade.type}</span>`;

        // Quantity (use totalQuantityEntry which is the sum of all entries)
        row.insertCell().textContent = trade.totalQuantityEntry || trade.initialQuantity;

        // Average Entry Price
        row.insertCell().textContent = trade.avgEntryPrice.toFixed(2);

        // Average Exit Price
        row.insertCell().textContent = trade.avgExitPrice > 0 ? trade.avgExitPrice.toFixed(2) : '-';

        // PnL Points
        const pnlPointsCell = row.insertCell();
        pnlPointsCell.textContent = trade.pnlPoints.toFixed(2);
        pnlPointsCell.className = trade.pnlPoints > 0 ? 'pnl-positive' : trade.pnlPoints < 0 ? 'pnl-negative' : 'pnl-neutral';

        // PnL Dollars (NET - with commissions deducted)
        const pnlDollarsCell = row.insertCell();
        pnlDollarsCell.textContent = formatDollars(trade.pnlLiquido);
        pnlDollarsCell.className = trade.pnlLiquido > 0 ? 'pnl-positive' : trade.pnlLiquido < 0 ? 'pnl-negative' : 'pnl-neutral';

        // Duration
        row.insertCell().textContent = calculateDuration(trade.startTime, trade.endTime || new Date());
    });
}

// Show trade details
function showTradeDetails(index) {
    selectedTradeIndex = index;
    const trade = filteredTrades[index];

    // Update title
    document.getElementById('detailTitle').textContent = 
        `Detalhes do Trade - ${trade.instrument} (${trade.type}) - ${trade.status === 'closed' ? 'Fechado' : 'Aberto'}`;

    // Update operations table - show grouped entries and exits
    const tbody = document.getElementById('operationsTableBody');
    tbody.innerHTML = '';

    // Add header row for ENTRY operations
    if (trade.entryOps.length > 0) {
        const headerRow = tbody.insertRow();
        headerRow.style.backgroundColor = 'var(--color-bg-3)';
        headerRow.style.fontWeight = 'var(--font-weight-semibold)';
        const headerCell = headerRow.insertCell();
        headerCell.colSpan = 7;
        headerCell.textContent = `OPERAÇÕES DE ENTRADA (${trade.type})`;
        headerCell.style.padding = 'var(--space-12)';
        headerCell.style.color = 'var(--color-text)';
    }

    let runningPosition = 0;
    let runningPnl = 0;
    let totalCost = 0;
    let totalRevenue = 0;

    // Show entry operations
    let totalEntryCommissions = 0;
    trade.entryOps.forEach(op => {
        const row = tbody.insertRow();

        // Date/Time
        row.insertCell().textContent = formatDateTime(op.Time);

        // Action
        const actionCell = row.insertCell();
        actionCell.textContent = op.Action;
        actionCell.style.fontWeight = 'var(--font-weight-semibold)';
        actionCell.style.color = op.Action === 'Buy' ? 'var(--color-success)' : 'var(--color-error)';

        // Quantity
        row.insertCell().textContent = op.Quantity;

        // Price
        row.insertCell().textContent = formatCurrency(op.Price);

        // Commission
        const commissionCell = row.insertCell();
        commissionCell.textContent = formatDollars(op.Commission || 0);
        commissionCell.style.color = 'var(--color-text-secondary)';
        totalEntryCommissions += (op.Commission || 0);

        // Type (Entry/Exit)
        row.insertCell().textContent = 'Entrada';

        // Calculate position
        if (op.Action === 'Buy') {
            runningPosition += op.Quantity;
            totalCost += op.Quantity * op.Price;
        } else if (op.Action === 'Sell') {
            runningPosition -= op.Quantity;
            totalCost += op.Quantity * op.Price;
        }

        // Position
        row.insertCell().textContent = Math.abs(runningPosition);

        // PnL parcial
        row.insertCell().textContent = '-';
    });

    // Add summary row for entries
    if (trade.entryOps.length > 0) {
        const summaryRow = tbody.insertRow();
        summaryRow.style.backgroundColor = 'var(--color-secondary)';
        summaryRow.style.fontWeight = 'var(--font-weight-semibold)';
        const cell1 = summaryRow.insertCell();
        cell1.colSpan = 2;
        cell1.textContent = 'TOTAL ENTRADA:';
        cell1.style.textAlign = 'right';
        cell1.style.padding = 'var(--space-10) var(--space-12)';
        
        const cell2 = summaryRow.insertCell();
        cell2.textContent = trade.totalQuantityEntry;
        cell2.style.padding = 'var(--space-10) var(--space-12)';
        
        const cell3 = summaryRow.insertCell();
        cell3.textContent = formatCurrency(trade.avgEntryPrice);
        cell3.style.padding = 'var(--space-10) var(--space-12)';
        
        const cell4 = summaryRow.insertCell();
        cell4.textContent = formatDollars(totalEntryCommissions);
        cell4.style.padding = 'var(--space-10) var(--space-12)';
        cell4.style.color = 'var(--color-warning)';
        
        const cell5 = summaryRow.insertCell();
        cell5.textContent = 'Preço Médio';
        cell5.style.padding = 'var(--space-10) var(--space-12)';
        
        const cell6 = summaryRow.insertCell();
        cell6.colSpan = 2;
        cell6.textContent = '';
    }

    // Add header row for EXIT operations
    if (trade.exitOps.length > 0) {
        const headerRow = tbody.insertRow();
        headerRow.style.backgroundColor = 'var(--color-bg-4)';
        headerRow.style.fontWeight = 'var(--font-weight-semibold)';
        const headerCell = headerRow.insertCell();
        headerCell.colSpan = 7;
        headerCell.textContent = 'OPERAÇÕES DE SAÍDA';
        headerCell.style.padding = 'var(--space-12)';
        headerCell.style.color = 'var(--color-text)';
    }

    // Show exit operations
    let totalExitCommissions = 0;
    trade.exitOps.forEach(op => {
        const row = tbody.insertRow();

        // Date/Time
        row.insertCell().textContent = formatDateTime(op.Time);

        // Action
        const actionCell = row.insertCell();
        actionCell.textContent = op.Action;
        actionCell.style.fontWeight = 'var(--font-weight-semibold)';
        actionCell.style.color = op.Action === 'Buy' ? 'var(--color-success)' : 'var(--color-error)';

        // Quantity
        row.insertCell().textContent = op.Quantity;

        // Price
        row.insertCell().textContent = formatCurrency(op.Price);

        // Commission
        const commissionCell = row.insertCell();
        commissionCell.textContent = formatDollars(op.Commission || 0);
        commissionCell.style.color = 'var(--color-text-secondary)';
        totalExitCommissions += (op.Commission || 0);

        // Type (Entry/Exit)
        row.insertCell().textContent = 'Saída';

        // Calculate position
        if (op.Action === 'Buy') {
            runningPosition += op.Quantity;
            totalRevenue += op.Quantity * op.Price;
        } else if (op.Action === 'Sell') {
            runningPosition -= op.Quantity;
            totalRevenue += op.Quantity * op.Price;
        }

        // Position
        row.insertCell().textContent = Math.abs(runningPosition);

        // Calculate partial PnL
        runningPnl = totalRevenue - totalCost;
        const multiplier = getPointMultiplier(trade.instrument);
        const pnlDollars = runningPnl * multiplier;
        const pnlCell = row.insertCell();
        pnlCell.textContent = formatDollars(pnlDollars);
        pnlCell.className = pnlDollars > 0 ? 'pnl-positive' : pnlDollars < 0 ? 'pnl-negative' : 'pnl-neutral';
    });

    // Add summary row for exits
    if (trade.exitOps.length > 0) {
        const summaryRow = tbody.insertRow();
        summaryRow.style.backgroundColor = 'var(--color-secondary)';
        summaryRow.style.fontWeight = 'var(--font-weight-semibold)';
        const cell1 = summaryRow.insertCell();
        cell1.colSpan = 2;
        cell1.textContent = 'TOTAL SAÍDA:';
        cell1.style.textAlign = 'right';
        cell1.style.padding = 'var(--space-10) var(--space-12)';
        
        const cell2 = summaryRow.insertCell();
        cell2.textContent = trade.totalQuantityExit;
        cell2.style.padding = 'var(--space-10) var(--space-12)';
        
        const cell3 = summaryRow.insertCell();
        cell3.textContent = formatCurrency(trade.avgExitPrice);
        cell3.style.padding = 'var(--space-10) var(--space-12)';
        
        const cell4 = summaryRow.insertCell();
        cell4.textContent = formatDollars(totalExitCommissions);
        cell4.style.padding = 'var(--space-10) var(--space-12)';
        cell4.style.color = 'var(--color-warning)';
        
        const cell5 = summaryRow.insertCell();
        cell5.textContent = 'Preço Médio';
        cell5.style.padding = 'var(--space-10) var(--space-12)';
        
        const cell6 = summaryRow.insertCell();
        cell6.colSpan = 2;
        cell6.textContent = '';
    }

    // Add commission summary row
    if (trade.status === 'closed') {
        const commissionRow = tbody.insertRow();
        commissionRow.style.backgroundColor = 'var(--color-bg-2)';
        commissionRow.style.fontWeight = 'var(--font-weight-semibold)';
        const cell1 = commissionRow.insertCell();
        cell1.colSpan = 4;
        cell1.textContent = 'COMISSÕES TOTAIS:';
        cell1.style.textAlign = 'right';
        cell1.style.padding = 'var(--space-12)';
        
        const cell2 = commissionRow.insertCell();
        cell2.colSpan = 4;
        cell2.textContent = formatDollars(trade.totalCommissions);
        cell2.style.padding = 'var(--space-12)';
        cell2.style.color = 'var(--color-warning)';
        cell2.style.fontWeight = 'var(--font-weight-bold)';
    }

    // Add PnL breakdown
    if (trade.status === 'closed') {
        // PnL Bruto
        const brutoRow = tbody.insertRow();
        brutoRow.style.backgroundColor = 'var(--color-secondary)';
        brutoRow.style.fontWeight = 'var(--font-weight-semibold)';
        const cell1 = brutoRow.insertCell();
        cell1.colSpan = 4;
        cell1.textContent = 'PnL BRUTO:';
        cell1.style.textAlign = 'right';
        cell1.style.padding = 'var(--space-12)';
        
        const cell2 = brutoRow.insertCell();
        cell2.textContent = `${trade.pnlPoints.toFixed(2)} pts`;
        cell2.style.padding = 'var(--space-12)';
        cell2.className = trade.pnlPoints > 0 ? 'pnl-positive' : trade.pnlPoints < 0 ? 'pnl-negative' : 'pnl-neutral';
        
        const cell3 = brutoRow.insertCell();
        cell3.colSpan = 3;
        cell3.textContent = formatDollars(trade.pnlBruto);
        cell3.style.padding = 'var(--space-12)';
        cell3.className = trade.pnlBruto > 0 ? 'pnl-positive' : trade.pnlBruto < 0 ? 'pnl-negative' : 'pnl-neutral';
        
        // PnL Líquido
        const liquidoRow = tbody.insertRow();
        liquidoRow.style.backgroundColor = 'var(--color-bg-1)';
        liquidoRow.style.fontWeight = 'var(--font-weight-bold)';
        liquidoRow.style.fontSize = 'var(--font-size-lg)';
        const lcell1 = liquidoRow.insertCell();
        lcell1.colSpan = 4;
        lcell1.textContent = 'PnL LÍQUIDO (após comissões):';
        lcell1.style.textAlign = 'right';
        lcell1.style.padding = 'var(--space-12)';
        
        const lcell2 = liquidoRow.insertCell();
        lcell2.textContent = `${trade.pnlPoints.toFixed(2)} pts`;
        lcell2.style.padding = 'var(--space-12)';
        lcell2.className = trade.pnlLiquido > 0 ? 'pnl-positive' : trade.pnlLiquido < 0 ? 'pnl-negative' : 'pnl-neutral';
        
        const lcell3 = liquidoRow.insertCell();
        lcell3.colSpan = 3;
        lcell3.textContent = formatDollars(trade.pnlLiquido);
        lcell3.style.padding = 'var(--space-12)';
        lcell3.className = trade.pnlLiquido > 0 ? 'pnl-positive' : trade.pnlLiquido < 0 ? 'pnl-negative' : 'pnl-neutral';
    }

    // Highlight selected row
    const rows = document.querySelectorAll('#tradesTableBody tr');
    rows.forEach((row, i) => {
        if (i === index) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    });

    document.getElementById('detailPanel').classList.remove('hidden');
}

// Close detail panel
function closeDetailPanel() {
    selectedTradeIndex = null;
    document.getElementById('detailPanel').classList.add('hidden');
    
    const rows = document.querySelectorAll('#tradesTableBody tr');
    rows.forEach(row => row.classList.remove('selected'));
}

// Format currency (kept for operations detail)
function formatCurrency(value) {
    return 'R$ ' + value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Format dollars
function formatDollars(value) {
    const formatted = Math.abs(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return value >= 0 ? '$' + formatted : '-$' + formatted;
}

// Format datetime
function formatDateTime(date) {
    if (!date) return '-';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hour}:${minute}`;
}

// Calculate duration
function calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return '-';
    
    const diff = endTime - startTime;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

// Show message
function showMessage(text, type) {
    const messageArea = document.getElementById('messageArea');
    messageArea.innerHTML = `<div class="message ${type}">${text}</div>`;
    
    setTimeout(() => {
        messageArea.innerHTML = '';
    }, 5000);
}

// Update Charts
function updateCharts() {
    updateDailyPnlChart();
    updateInstrumentPnlChart();
    updatePieChart();
    updateWinRateChart();
    updateDailyPnlBarsChart();
}

// Chart 1: Daily PnL (Accumulated)
function updateDailyPnlChart() {
    const closedTrades = filteredTrades.filter(t => t.status === 'closed').sort((a, b) => a.endTime - b.endTime);
    
    const dailyData = {};
    closedTrades.forEach(trade => {
        if (!trade.endTime) return;
        const dateKey = formatDate(trade.endTime);
        if (!dailyData[dateKey]) dailyData[dateKey] = 0;
        dailyData[dateKey] += trade.pnlLiquido;
    });
    
    const dates = Object.keys(dailyData).sort();
    let accumulated = 0;
    const accumulatedValues = dates.map(date => {
        accumulated += dailyData[date];
        return accumulated;
    });
    
    const ctx = document.getElementById('dailyPnlChart');
    if (dailyPnlChart) dailyPnlChart.destroy();
    
    dailyPnlChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'PnL Acumulado',
                data: accumulatedValues,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true,
                segment: {
                    borderColor: ctx => {
                        const value = ctx.p1.parsed.y;
                        return value >= 0 ? '#10b981' : '#ef4444';
                    }
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => 'PnL: ' + formatDollars(context.parsed.y)
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => formatDollars(value)
                    }
                }
            }
        }
    });
}

// Chart 2: PnL by Instrument
function updateInstrumentPnlChart() {
    const closedTrades = filteredTrades.filter(t => t.status === 'closed');
    const instrumentData = {};
    
    closedTrades.forEach(trade => {
        if (!instrumentData[trade.instrument]) instrumentData[trade.instrument] = 0;
        instrumentData[trade.instrument] += trade.pnlLiquido;
    });
    
    const instruments = Object.keys(instrumentData).sort();
    const values = instruments.map(inst => instrumentData[inst]);
    const colors = values.map(v => v >= 0 ? '#10b981' : '#ef4444');
    
    const ctx = document.getElementById('instrumentPnlChart');
    if (instrumentPnlChart) instrumentPnlChart.destroy();
    
    instrumentPnlChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: instruments,
            datasets: [{
                label: 'PnL Total',
                data: values,
                backgroundColor: colors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => 'PnL: ' + formatDollars(context.parsed.y)
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => formatDollars(value)
                    }
                }
            }
        }
    });
}

// Chart 3: Pie Chart - Wins vs Losses
function updatePieChart() {
    const closedTrades = filteredTrades.filter(t => t.status === 'closed');
    const wins = closedTrades.filter(t => t.pnlLiquido > 0).length;
    const losses = closedTrades.filter(t => t.pnlLiquido < 0).length;
    const neutral = closedTrades.filter(t => t.pnlLiquido === 0).length;
    
    const ctx = document.getElementById('pieChart');
    if (pieChart) pieChart.destroy();
    
    pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Ganhos', 'Perdas', 'Empates'],
            datasets: [{
                data: [wins, losses, neutral],
                backgroundColor: ['#10b981', '#ef4444', '#6b7280']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Chart 4: Win Rate Accumulated
function updateWinRateChart() {
    const closedTrades = filteredTrades.filter(t => t.status === 'closed').sort((a, b) => a.endTime - b.endTime);
    
    let wins = 0;
    let total = 0;
    const winRates = [];
    const labels = [];
    
    closedTrades.forEach((trade, index) => {
        total++;
        if (trade.pnlLiquido > 0) wins++;
        winRates.push((wins / total) * 100);
        labels.push(`Trade ${index + 1}`);
    });
    
    const ctx = document.getElementById('winRateChart');
    if (winRateChart) winRateChart.destroy();
    
    winRateChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Win Rate %',
                data: winRates,
                borderColor: '#1FB8CD',
                backgroundColor: 'rgba(31, 184, 205, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => 'Win Rate: ' + context.parsed.y.toFixed(1) + '%'
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    ticks: {
                        callback: (value) => value + '%'
                    }
                },
                x: {
                    display: false
                }
            }
        }
    });
}

// Chart 5: Daily PnL Bars (not accumulated)
function updateDailyPnlBarsChart() {
    const closedTrades = filteredTrades.filter(t => t.status === 'closed').sort((a, b) => a.endTime - b.endTime);
    
    const dailyData = {};
    closedTrades.forEach(trade => {
        if (!trade.endTime) return;
        const dateKey = formatDate(trade.endTime);
        if (!dailyData[dateKey]) dailyData[dateKey] = 0;
        dailyData[dateKey] += trade.pnlLiquido;
    });
    
    const dates = Object.keys(dailyData).sort();
    const values = dates.map(date => dailyData[date]);
    const colors = values.map(v => v >= 0 ? '#10b981' : '#ef4444');
    
    const ctx = document.getElementById('dailyPnlBarsChart');
    if (dailyPnlBarsChart) dailyPnlBarsChart.destroy();
    
    dailyPnlBarsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: 'PnL Diário',
                data: values,
                backgroundColor: colors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => 'PnL: ' + formatDollars(context.parsed.y)
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => formatDollars(value)
                    }
                }
            }
        }
    });
}

// Update Insights Cards
function updateInsights() {
    const closedTrades = filteredTrades.filter(t => t.status === 'closed');
    
    if (closedTrades.length === 0) {
        // Reset all insights
        document.getElementById('bestTradeValue').textContent = '$0.00';
        document.getElementById('bestTradeDetails').textContent = 'Nenhum trade fechado';
        document.getElementById('worstTradeValue').textContent = '$0.00';
        document.getElementById('worstTradeDetails').textContent = 'Nenhum trade fechado';
        document.getElementById('bestDayValue').textContent = '$0.00';
        document.getElementById('bestDayDetails').textContent = 'Nenhum trade fechado';
        document.getElementById('worstDayValue').textContent = '$0.00';
        document.getElementById('worstDayDetails').textContent = 'Nenhum trade fechado';
        document.getElementById('avgPnlValue').textContent = '$0.00';
        document.getElementById('avgPnlDetails').textContent = 'Nenhum trade fechado';
        document.getElementById('bestInstrumentValue').textContent = '-';
        document.getElementById('bestInstrumentDetails').textContent = 'Nenhum trade fechado';
        document.getElementById('streaksValue').textContent = '-';
        document.getElementById('streaksDetails').textContent = 'Nenhum trade fechado';
        document.getElementById('riskRewardValue').textContent = '0:0';
        document.getElementById('riskRewardDetails').textContent = 'Nenhum trade fechado';
        return;
    }
    
    // 1. Best Trade
    const bestTrade = closedTrades.reduce((max, t) => t.pnlLiquido > max.pnlLiquido ? t : max);
    document.getElementById('bestTradeValue').textContent = formatDollars(bestTrade.pnlLiquido);
    document.getElementById('bestTradeDetails').innerHTML = `
        <strong>${bestTrade.instrument}</strong> • ${bestTrade.type}<br>
        ${formatDate(bestTrade.endTime)} • ${calculateDuration(bestTrade.startTime, bestTrade.endTime)}
    `;
    
    // 2. Worst Trade
    const worstTrade = closedTrades.reduce((min, t) => t.pnlLiquido < min.pnlLiquido ? t : min);
    document.getElementById('worstTradeValue').textContent = formatDollars(worstTrade.pnlLiquido);
    document.getElementById('worstTradeDetails').innerHTML = `
        <strong>${worstTrade.instrument}</strong> • ${worstTrade.type}<br>
        ${formatDate(worstTrade.endTime)} • ${calculateDuration(worstTrade.startTime, worstTrade.endTime)}
    `;
    
    // 3. Best Day
    const dailyPnl = {};
    const dailyCount = {};
    closedTrades.forEach(trade => {
        const date = formatDate(trade.endTime);
        if (!dailyPnl[date]) {
            dailyPnl[date] = 0;
            dailyCount[date] = 0;
        }
        dailyPnl[date] += trade.pnlLiquido;
        dailyCount[date]++;
    });
    
    const bestDay = Object.keys(dailyPnl).reduce((max, date) => 
        dailyPnl[date] > dailyPnl[max] ? date : max
    );
    document.getElementById('bestDayValue').textContent = formatDollars(dailyPnl[bestDay]);
    document.getElementById('bestDayDetails').innerHTML = `
        <strong>${bestDay}</strong><br>
        ${dailyCount[bestDay]} trade${dailyCount[bestDay] > 1 ? 's' : ''}
    `;
    
    // 4. Worst Day
    const worstDay = Object.keys(dailyPnl).reduce((min, date) => 
        dailyPnl[date] < dailyPnl[min] ? date : min
    );
    document.getElementById('worstDayValue').textContent = formatDollars(dailyPnl[worstDay]);
    document.getElementById('worstDayDetails').innerHTML = `
        <strong>${worstDay}</strong><br>
        ${dailyCount[worstDay]} trade${dailyCount[worstDay] > 1 ? 's' : ''}
    `;
    
    // 5. Average PnL
    const totalPnl = closedTrades.reduce((sum, t) => sum + t.pnlLiquido, 0);
    const avgPnl = totalPnl / closedTrades.length;
    const sortedPnls = closedTrades.map(t => t.pnlLiquido).sort((a, b) => a - b);
    const medianPnl = sortedPnls[Math.floor(sortedPnls.length / 2)];
    
    document.getElementById('avgPnlValue').textContent = formatDollars(avgPnl);
    document.getElementById('avgPnlDetails').innerHTML = `
        Mediana: <strong>${formatDollars(medianPnl)}</strong><br>
        ${closedTrades.length} trades
    `;
    
    // 6. Best Instrument
    const instrumentPnl = {};
    const instrumentCount = {};
    const instrumentWins = {};
    closedTrades.forEach(trade => {
        if (!instrumentPnl[trade.instrument]) {
            instrumentPnl[trade.instrument] = 0;
            instrumentCount[trade.instrument] = 0;
            instrumentWins[trade.instrument] = 0;
        }
        instrumentPnl[trade.instrument] += trade.pnlLiquido;
        instrumentCount[trade.instrument]++;
        if (trade.pnlLiquido > 0) instrumentWins[trade.instrument]++;
    });
    
    const bestInstrument = Object.keys(instrumentPnl).reduce((max, inst) => 
        instrumentPnl[inst] > instrumentPnl[max] ? inst : max
    );
    const bestInstWinRate = (instrumentWins[bestInstrument] / instrumentCount[bestInstrument]) * 100;
    
    document.getElementById('bestInstrumentValue').textContent = bestInstrument;
    document.getElementById('bestInstrumentDetails').innerHTML = `
        PnL: <strong>${formatDollars(instrumentPnl[bestInstrument])}</strong><br>
        Win Rate: ${bestInstWinRate.toFixed(1)}%
    `;
    
    // 7. Streaks
    let currentStreak = 0;
    let currentStreakType = null;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    
    const sortedTrades = [...closedTrades].sort((a, b) => a.endTime - b.endTime);
    sortedTrades.forEach(trade => {
        const isWin = trade.pnlLiquido > 0;
        
        if (currentStreakType === null) {
            currentStreakType = isWin;
            currentStreak = 1;
        } else if (currentStreakType === isWin) {
            currentStreak++;
        } else {
            if (currentStreakType) {
                maxWinStreak = Math.max(maxWinStreak, currentStreak);
            } else {
                maxLossStreak = Math.max(maxLossStreak, currentStreak);
            }
            currentStreakType = isWin;
            currentStreak = 1;
        }
    });
    
    // Update final streak
    if (currentStreakType !== null) {
        if (currentStreakType) {
            maxWinStreak = Math.max(maxWinStreak, currentStreak);
        } else {
            maxLossStreak = Math.max(maxLossStreak, currentStreak);
        }
    }
    
    document.getElementById('streaksValue').textContent = `${maxWinStreak}W / ${maxLossStreak}L`;
    document.getElementById('streaksDetails').innerHTML = `
        Melhor: <strong>${maxWinStreak} wins</strong><br>
        Pior: <strong>${maxLossStreak} losses</strong>
    `;
    
    // 8. Risk/Reward
    const wins = closedTrades.filter(t => t.pnlLiquido > 0);
    const losses = closedTrades.filter(t => t.pnlLiquido < 0);
    
    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnlLiquido, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.pnlLiquido, 0) / losses.length) : 0;
    const ratio = avgLoss > 0 ? avgWin / avgLoss : 0;
    
    document.getElementById('riskRewardValue').textContent = ratio.toFixed(2) + ':1';
    document.getElementById('riskRewardDetails').innerHTML = `
        Ganho médio: <strong>${formatDollars(avgWin)}</strong><br>
        Perda média: <strong>${formatDollars(avgLoss)}</strong>
    `;
}

// Format date only (DD/MM/YYYY)
function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

// Supabase Data Functions
async function saveOperationsToSupabase(operations) {
    // CRITICAL: Verify authentication
    if (!currentUser || !currentUser.id) {
        console.error('❌ ERRO CRÍTICO: Usuário não autenticado');
        console.error('currentUser:', currentUser);
        console.error('currentSession:', currentSession);
        showMessage('Erro: Usuário não autenticado. Faça login novamente.', 'error');
        return;
    }
    
    console.log('=== INÍCIO SAVE TO SUPABASE ===');
    console.log('✅ Usuário autenticado:', currentUser.email);
    console.log('✅ User ID:', currentUser.id);
    console.log('📊 Operações a salvar:', operations.length);
    console.log('📋 Primeira operação:', operations[0]);
    
    const statusEl = document.getElementById('uploadStatus');
    statusEl.innerHTML = '<div class="message">Verificando duplicatas...</div>';
    
    let newCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    let firstError = null;
    let errorDetails = [];
    
    try {
        for (let i = 0; i < operations.length; i++) {
            const op = operations[i];
            
            // Update progress
            if (i % 10 === 0 || i === operations.length - 1) {
                statusEl.innerHTML = `<div class="message">Importando ${i + 1} de ${operations.length}...</div>`;
            }
            
            const ninjaId = generateNinjaId(op);
            console.log(`Operação ${i + 1}: ninja_id =`, ninjaId);
            
            // Check if operation already exists
            const { data: existing, error: checkError } = await supabaseClient
                .from('operations')
                .select('id')
                .eq('user_id', currentUser.id)
                .eq('ninja_id', ninjaId)
                .maybeSingle();
            
            if (checkError) {
                console.error('Erro ao verificar duplicata:', checkError);
            }
            
            if (existing) {
                duplicateCount++;
                console.log(`Operação ${i + 1} é duplicata`);
                continue;
            }
            
            // Insert new operation
            const operationData = {
                user_id: currentUser.id,
                ninja_id: ninjaId,
                instrument: op.Instrument || '',
                action: op.Action || '',
                quantity: parseFloat(op.Quantity) || 0,
                price: parseFloat(op.Price) || 0,
                time: op.Time ? op.Time.toISOString() : null,
                e_x: op['E/X'] || '',
                position: op.Position || '',
                commission: parseFloat(op.Commission) || 0,
                account: op.Account || ''
            };
            
            if (i < 3) {
                console.log(`📝 Inserindo operação ${i + 1}:`, operationData);
            }
            
            // Supabase v1 API: insert returns data directly
            const { data: insertData, error: insertError } = await supabaseClient
                .from('operations')
                .insert([operationData]);
            
            if (insertError) {
                errorCount++;
                
                // Capture first error for detailed reporting
                if (!firstError) {
                    firstError = insertError;
                    console.error('❌ PRIMEIRO ERRO DETECTADO:');
                    console.error('Mensagem:', insertError.message);
                    console.error('Código:', insertError.code);
                    console.error('Detalhes:', insertError.details);
                    console.error('Hint:', insertError.hint);
                    console.error('Dados da operação:', operationData);
                }
                
                // Store error details
                if (errorCount <= 5) {
                    errorDetails.push({
                        index: i + 1,
                        message: insertError.message,
                        code: insertError.code,
                        hint: insertError.hint
                    });
                    console.error(`❌ Erro ${errorCount} ao inserir operação ${i + 1}:`, insertError.message);
                }
            } else {
                newCount++;
                if (i < 3) {
                    console.log(`✅ Operação ${i + 1} inserida com sucesso`);
                }
            }
        }
        
        console.log('=== RESULTADO DO IMPORT ===');
        console.log('✅ Novas:', newCount);
        console.log('🔄 Duplicatas:', duplicateCount);
        console.log('❌ Erros:', errorCount);
        
        if (errorCount > 0) {
            // Diagnose error type and show specific message
            let errorMessage = `Upload com erros: ${newCount} importadas, ${duplicateCount} duplicatas, ${errorCount} erros`;
            let suggestion = '';
            
            if (firstError) {
                console.error('\n🔍 DIAGNÓSTICO DO ERRO:');
                const errorMsg = firstError.message.toLowerCase();
                const errorCode = firstError.code;
                
                if (errorMsg.includes('policy') || errorMsg.includes('rls') || errorCode === '42501') {
                    suggestion = '🔒 Erro de RLS Policy: Configure as políticas de segurança no Supabase para permitir inserção.';
                    console.error(suggestion);
                } else if (errorMsg.includes('auth') || errorMsg.includes('permission')) {
                    suggestion = '🔑 Erro de Autenticação: Faça logout e login novamente.';
                    console.error(suggestion);
                } else if (errorMsg.includes('unique') || errorMsg.includes('duplicate')) {
                    suggestion = '📋 Erro de Duplicata: Algumas operações já existem no banco.';
                    console.error(suggestion);
                } else if (errorMsg.includes('foreign key') || errorMsg.includes('violates')) {
                    suggestion = '🔗 Erro de Constraint: Verifique a estrutura da tabela no Supabase.';
                    console.error(suggestion);
                } else {
                    suggestion = `⚠️ Erro: ${firstError.message}`;
                    console.error(suggestion);
                }
                
                console.error('\nPrimeiros erros:', errorDetails);
                errorMessage = `${errorMessage}<br><br><strong>${suggestion}</strong><br><br>Detalhes: ${firstError.message}`;
            }
            
            statusEl.innerHTML = `<div class="message error" style="max-width: 800px;">${errorMessage}<br><br>🔍 Abra o Console (F12) para mais detalhes</div>`;
            showMessage(errorMessage, 'error');
        } else {
            const successMsg = `Upload concluído! ${newCount} nova(s) operação(ões), ${duplicateCount} duplicada(s)`;
            statusEl.innerHTML = `<div class="message success">${successMsg}</div>`;
            showMessage(successMsg, 'success');
        }
        
        setTimeout(() => {
            statusEl.innerHTML = '';
        }, 15000);
        
    } catch (err) {
        console.error('❌ ERRO GERAL NO SAVE:', err);
        console.error('Stack trace:', err.stack);
        
        let errorMessage = `Erro ao importar dados: ${err.message}`;
        let suggestion = '';
        
        if (err.message.includes('fetch') || err.message.includes('network')) {
            suggestion = '🌐 Erro de Conexão: Verifique sua internet e as configurações do Supabase.';
        } else if (err.message.includes('auth')) {
            suggestion = '🔑 Erro de Autenticação: Faça logout e login novamente.';
        } else {
            suggestion = '⚠️ Erro inesperado: Verifique o console (F12) para detalhes.';
        }
        
        console.error(suggestion);
        errorMessage = `${errorMessage}<br><br><strong>${suggestion}</strong>`;
        
        statusEl.innerHTML = `<div class="message error" style="max-width: 800px;">${errorMessage}<br><br>🔍 Abra o Console (F12) para mais detalhes</div>`;
        showMessage(errorMessage, 'error');
        
        setTimeout(() => {
            statusEl.innerHTML = '';
        }, 15000);
    }
    
    console.log('=== FIM SAVE TO SUPABASE ===');
}

async function loadDataFromSupabase() {
    if (!currentUser) {
        console.error('Usuário não autenticado');
        return;
    }
    
    console.log('=== INÍCIO LOAD FROM SUPABASE ===');
    console.log('User ID:', currentUser.id);
    
    showMessage('Carregando dados...', 'success');
    
    try {
        // Load operations
        const { data: operations, error } = await supabaseClient
            .from('operations')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('time', { ascending: true });
        
        if (error) {
            console.error('Erro ao carregar operações:', error);
            showMessage('Erro ao carregar dados: ' + error.message, 'error');
            return;
        }
        
        console.log('Operações carregadas:', operations ? operations.length : 0);
    
        if (!operations || operations.length === 0) {
            showMessage('Nenhuma operação encontrada. Faça upload de um arquivo CSV.', 'error');
            return;
        }
    
        // Convert database format to app format
        allOperations = operations.map(op => ({
            Instrument: op.instrument,
            Action: op.action,
            Quantity: parseFloat(op.quantity),
            Price: parseFloat(op.price),
            Time: op.time ? new Date(op.time) : null,
            'E/X': op.e_x,
            Position: op.position,
            Commission: parseFloat(op.commission) || 0,
            Account: op.account
        }));
        
        console.log('Operações convertidas para formato app:', allOperations.length);
        console.log('Primeira operação:', allOperations[0]);
        
        // Process trades
        processTrades(allOperations);
        showMessage(`${operations.length} operações carregadas com sucesso!`, 'success');
        
        console.log('=== FIM LOAD FROM SUPABASE ===');
    } catch (err) {
        console.error('ERRO AO CARREGAR DADOS:', err);
        showMessage('Erro ao carregar dados: ' + err.message, 'error');
    }
}

async function calculateAndSaveTrades() {
    if (!currentUser || allTrades.length === 0) return;
    
    try {
        // Delete existing trades for this user
        await supabaseClient
            .from('trades')
            .delete()
            .eq('user_id', currentUser.id);
        
        // Insert new trades
        const tradesToInsert = allTrades.map(trade => ({
            user_id: currentUser.id,
            instrument: trade.instrument,
            type: trade.type,
            status: trade.status,
            account: trade.account,
            avg_price_entry: trade.avgEntryPrice,
            avg_price_exit: trade.avgExitPrice,
            total_qty_entry: trade.totalQuantityEntry,
            total_qty_exit: trade.totalQuantityExit,
            pnl_points: trade.pnlPoints,
            pnl_dollars: trade.pnlDollars,
            total_commissions: trade.totalCommissions,
            start_time: trade.startTime ? trade.startTime.toISOString() : null,
            end_time: trade.endTime ? trade.endTime.toISOString() : null
        }));
        
        const { error } = await supabaseClient
            .from('trades')
            .insert(tradesToInsert);
        
        if (error) {
            console.error('Error saving trades:', error);
        }
    } catch (err) {
        console.error('Error calculating and saving trades:', err);
    }
}

// Override processTrades to also save to Supabase
const originalProcessTrades = processTrades;
function processTrades(operations) {
    originalProcessTrades(operations);
    // Save trades asynchronously (don't wait)
    if (currentUser && allTrades.length > 0) {
        calculateAndSaveTrades().catch(err => console.error('Error saving trades:', err));
    }
}
