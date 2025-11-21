async function deleteAllTransactions() {
    if (!supabaseClient) { showMessage('error', 'Supabase não inicializado'); return; }
    if (!confirm('⚠️ Tem certeza que deseja EXCLUIR TODAS as transações? Essa ação não pode ser desfeita!')) { return; }
    try {
        if (!currentUser) { const r = await supabaseClient.auth.getUser(); if (r.error) throw r.error; currentUser = r.data.user; if (!currentUser) throw new Error('Usuário não autenticado'); }
        const msgEl = document.getElementById('uploadMessage');
        if (msgEl) { msgEl.innerHTML = '<div class="loading">⏳ Deletando...</div>'; }
        const delOps = await supabaseClient.from('operations').delete().eq('user_id', currentUser.id).select('id');
        if (delOps.error) throw delOps.error;
        const delTrades = await supabaseClient.from('trades').delete().eq('user_id', currentUser.id).select('id');
        if (delTrades.error) throw delTrades.error;
        const opsCount = delOps.data ? delOps.data.length : 0;
        const tradesCount = delTrades.data ? delTrades.data.length : 0;
        try { if (typeof showMessage === 'function') showMessage('success', '✅ ' + opsCount + ' operações e ' + tradesCount + ' trades excluídos'); } catch (e) {}
        allTrades = [];
        selectedTrade = null;
        if (msgEl) { msgEl.innerHTML = ''; }
        await loadDataFromSupabase();
    } catch (err) { try { if (typeof showMessage === 'function') showMessage('error', 'Erro ao deletar: ' + err.message); } catch (e) {} const msgEl = document.getElementById('uploadMessage'); if (msgEl) { msgEl.innerHTML = ''; } }
}