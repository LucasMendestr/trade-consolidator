import { state } from '../state.js'

export function showMessage(type, text) {
  const msg = document.getElementById('authMessage')
  if (!msg) return
  msg.textContent = String(text || '')
  msg.className = type === 'error' ? 'error' : 'success'
  setTimeout(function(){ msg.textContent = ''; msg.className = '' }, 5000)
}

export function toggleForm() {
  const loginForm = document.getElementById('loginForm')
  const registerForm = document.getElementById('registerForm')
  if (!loginForm || !registerForm) return
  if (loginForm.style.display === 'none') { loginForm.style.display = 'block'; registerForm.style.display = 'none' }
  else { loginForm.style.display = 'none'; registerForm.style.display = 'block' }
}

export async function handleLogin(loaders) {
  const supabase = state.supabaseClient
  if (!supabase) { showMessage('error', 'Supabase não inicializado'); return }
  const email = document.getElementById('loginEmail').value
  const password = document.getElementById('loginPassword').value
  if (!email || !password) { showMessage('error', 'Preencha email e senha'); return }
  try {
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) throw result.error
    state.currentUser = result.data.user
    state.currentSession = result.data.session
    showApp()
    try {
      if (loaders && loaders.loadDataFromSupabase) await loaders.loadDataFromSupabase()
      if (loaders && loaders.loadStrategies) await loaders.loadStrategies()
    } catch {}
  } catch (err) { showMessage('error', err.message) }
}

export async function handleRegister() {
  const supabase = state.supabaseClient
  if (!supabase) { showMessage('error', 'Supabase não inicializado'); return }
  const email = document.getElementById('registerEmail').value
  const password = document.getElementById('registerPassword').value
  if (!email || password.length < 6) { showMessage('error', 'Email e senha (mín 6) obrigatórios'); return }
  try {
    const result = await supabase.auth.signUp({ email, password })
    if (result.error) throw result.error
    showMessage('success', 'Conta criada! Faça login.')
    toggleForm()
  } catch (err) { showMessage('error', err.message) }
}

export async function handleLogout() {
  try {
    await state.supabaseClient.auth.signOut()
    state.currentUser = null
    state.allTrades = []
    const login = document.getElementById('loginScreen')
    const app = document.getElementById('appScreen')
    if (login && app) { login.style.display = 'block'; app.style.display = 'none' }
  } catch {}
}

export function showApp() {
  const login = document.getElementById('loginScreen')
  const app = document.getElementById('appScreen')
  if (login && app) { login.style.display = 'none'; app.style.display = 'block' }
  const userEmail = document.getElementById('userEmail')
  if (userEmail && state.currentUser) userEmail.textContent = state.currentUser.email
}
