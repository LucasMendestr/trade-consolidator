async function deleteAllTransactions() {
    if (!supabaseClient) { showMessage('error', 'Supabase não inicializado'); return; }
    if (!confirm('⚠️ Tem certeza que deseja EXCLUIR TODAS as transações? Essa ação não pode ser desfeita!')) { return; }
    try {
        if (!currentUser) { const r = await supabaseClient.auth.getUser(); if (r.error) throw r.error; currentUser = r.data.user; if (!currentUser) throw new Error('Usuário não autenticado'); }
        document.getElementById('uploadMessage').innerHTML = '<div class="loading">⏳ Deletando...</div>';
        const delOps = await supabaseClient.from('operations').delete().eq('user_id', currentUser.id).select('id');
        if (delOps.error) throw delOps.error;
        const delTrades = await supabaseClient.from('trades').delete().eq('user_id', currentUser.id).select('id');
        if (delTrades.error) throw delTrades.error;
        const opsCount = delOps.data ? delOps.data.length : 0;
        const tradesCount = delTrades.data ? delTrades.data.length : 0;
        showMessage('success', '✅ ' + opsCount + ' operações e ' + tradesCount + ' trades excluídos');
        allTrades = [];
        selectedTrade = null;
        document.getElementById('uploadMessage').innerHTML = '';
        await loadDataFromSupabase();
    } catch (err) { showMessage('error', 'Erro ao deletar: ' + err.message); document.getElementById('uploadMessage').innerHTML = ''; }
}