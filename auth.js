function showMessage(type, text) {
    const msg = document.getElementById('authMessage');
    if (type === 'error') { msg.innerHTML = '<div class="error">' + text + '</div>'; }
    else { msg.innerHTML = '<div class="success">' + text + '</div>'; }
    setTimeout(function() { msg.innerHTML = ''; }, 5000);
}

function toggleForm() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (loginForm.style.display === 'none') { loginForm.style.display = 'block'; registerForm.style.display = 'none'; }
    else { loginForm.style.display = 'none'; registerForm.style.display = 'block'; }
}

async function handleLogin() {
    if (!supabaseClient) { showMessage('error', 'Supabase não inicializado'); return; }
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) { showMessage('error', 'Preencha email e senha'); return; }
    try {
        const result = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
        if (result.error) throw result.error;
        currentUser = result.data.user;
        currentSession = result.data.session;
        showApp();
        try { await loadDataFromSupabase(); await loadStrategies(); } catch (e) {}
        window.location.href = 'dashboard.html';
    } catch (err) { showMessage('error', err.message); }
}

async function handleRegister() {
    if (!supabaseClient) { showMessage('error', 'Supabase não inicializado'); return; }
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    if (!email || password.length < 6) { showMessage('error', 'Email e senha (mín 6) obrigatórios'); return; }
    try {
        const result = await supabaseClient.auth.signUp({ email: email, password: password });
        if (result.error) throw result.error;
        showMessage('success', 'Conta criada! Faça login.');
        toggleForm();
    } catch (err) { showMessage('error', err.message); }
}

async function handleLogout() {
    try {
        await supabaseClient.auth.signOut();
        currentUser = null;
        allTrades = [];
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('appScreen').style.display = 'none';
    } catch (err) {}
}

function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
    document.getElementById('userEmail').textContent = currentUser.email;
}