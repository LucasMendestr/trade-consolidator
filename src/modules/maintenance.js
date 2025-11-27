import { state } from '../state.js'
import { showMessage } from './auth.js'
import { loadDataFromSupabase } from './trades.js'

export async function deleteAllTransactions() {
  if (!state.supabaseClient) { showMessage('error', 'Supabase não inicializado'); return }
  if (!confirm('⚠️ Tem certeza que deseja EXCLUIR TODAS as transações? Essa ação não pode ser desfeita!')) { return }
  try {
    if (!state.currentUser) { const r = await state.supabaseClient.auth.getUser(); if (r.error) throw r.error; state.currentUser = r.data.user; if (!state.currentUser) throw new Error('Usuário não autenticado') }
    const msgEl = document.getElementById('uploadMessage'); if (msgEl) { msgEl.innerHTML = '<div class="loading">⏳ Deletando...</div>' }
    const delOps = await state.supabaseClient.from('operations').delete().eq('user_id', state.currentUser.id).select('id')
    if (delOps.error) throw delOps.error
    const delTrades = await state.supabaseClient.from('trades').delete().eq('user_id', state.currentUser.id).select('id')
    if (delTrades.error) throw delTrades.error
    const opsCount = delOps.data ? delOps.data.length : 0
    const tradesCount = delTrades.data ? delTrades.data.length : 0
    try { showMessage('success', '✅ ' + opsCount + ' operações e ' + tradesCount + ' trades excluídos') } catch {}
    state.allTrades = []
    state.selectedTrade = null
    if (msgEl) { msgEl.innerHTML = '' }
    await loadDataFromSupabase()
  } catch (err) { try { showMessage('error', 'Erro ao deletar: ' + err.message) } catch {} const msgEl = document.getElementById('uploadMessage'); if (msgEl) { msgEl.innerHTML = '' } }
}
