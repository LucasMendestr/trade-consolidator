import React, { useEffect } from 'react'
import { state } from './state.js'
import { initSupabase } from './lib/supabase.js'
import { initThemeFromStorage, toggleTheme } from './modules/theme.js'
import { showApp, handleLogin, handleRegister, handleLogout, toggleForm } from './modules/auth.js'
import { loadDataFromSupabase, filterTrades, applyStrategyBulk, toggleSelectAllTrades } from './modules/trades.js'
import { loadStrategies, handleCreateStrategy } from './modules/strategies.js'
import { updateTradesTable, closeTradeDetails } from './modules/table.js'
import { handleFileUpload } from './modules/operations.js'
import { deleteAllTransactions } from './modules/maintenance.js'

function App() {
  useEffect(() => {
    initThemeFromStorage()
    const client = initSupabase(state)
    if (!client) return
    ;(async () => {
      try {
        const r = await state.supabaseClient.auth.getUser()
        if (!r.error && r.data && r.data.user) {
          state.currentUser = r.data.user
          await loadDataFromSupabase()
          await loadStrategies()
        }
      } catch {}
    })()
  }, [])

  return (
    <div>
      <div id="loginScreen">
        <div className="login-container">
          <h1>📊 Trade Consolidator</h1>
          <div id="authMessage"></div>
          <div id="loginForm">
            <h3>Login</h3>
            <div className="form-group">
              <label>Email:</label>
              <input type="email" id="loginEmail" placeholder="seu@email.com" />
            </div>
            <div className="form-group">
              <label>Senha:</label>
              <input type="password" id="loginPassword" placeholder="Senha" />
            </div>
            <button className="btn btn-primary" onClick={() => handleLogin({ loadDataFromSupabase, loadStrategies })}>Entrar</button>
            <button className="btn btn-secondary" onClick={() => toggleForm()}>Criar Conta</button>
          </div>
          <div id="registerForm" style={{ display: 'none' }}>
            <h3>Registrar</h3>
            <div className="form-group"><label>Email:</label><input type="email" id="registerEmail" placeholder="seu@email.com" /></div>
            <div className="form-group"><label>Senha:</label><input type="password" id="registerPassword" placeholder="Mínimo 6 caracteres" /></div>
            <button className="btn btn-primary" onClick={() => handleRegister()}>Registrar</button>
            <button className="btn btn-secondary" onClick={() => toggleForm()}>Voltar</button>
          </div>
        </div>
      </div>

      <div id="appScreen" style={{ display: 'none' }}>
        <div className="app-container">
          <div className="app-header">
            <h1>📊 Trade Consolidator Pro</h1>
            <div className="user-section">
              <p>Email: <strong id="userEmail"></strong></p>
              <div style={{ margin: '8px 0' }}></div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => toggleTheme()} style={{ width: 160 }}>Alternar tema</button>
                <button className="btn btn-secondary" onClick={() => handleLogout()} style={{ width: 150 }}>Sair</button>
              </div>
            </div>
          </div>

          <div className="upload-section">
            <div className="upload-controls">
              <h3 style={{ margin: 0 }}>📤 Importar CSV</h3>
              <button className="btn btn-danger" onClick={() => deleteAllTransactions()}>🗑️ Excluir Tudo</button>
            </div>
            <div className="upload-area" onClick={() => document.getElementById('csvFile').click()}>
              <p>📁 Clique para selecionar arquivo CSV</p>
              <p style={{ fontSize: 12, color: '#999' }}>NinjaTrader Export</p>
            </div>
            <input type="file" id="csvFile" accept=".csv" onChange={e => handleFileUpload(e)} style={{ display: 'none' }} />
            <div id="uploadMessage"></div>
          </div>

          <h2>📈 Estatísticas</h2>
          <div className="stats-grid" id="statsGrid"></div>

          <h2>📉 Gráficos</h2>
          <div id="chartsSection" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            <div style={{ background: 'var(--card-bg)', padding: 15, borderRadius: 8 }}><strong>PnL Diário Acumulado</strong><canvas id="chartDailyCumulative" height="140"></canvas></div>
            <div style={{ background: 'var(--card-bg)', padding: 15, borderRadius: 8 }}><strong>PnL por Instrumento</strong><canvas id="chartPnlInstrument" height="140"></canvas></div>
            <div style={{ background: 'var(--card-bg)', padding: 15, borderRadius: 8 }}><strong>Trades Positivos vs Negativos</strong><canvas id="chartPosNeg" height="140"></canvas></div>
            <div style={{ background: 'var(--card-bg)', padding: 15, borderRadius: 8 }}><strong>Win Rate Acumulado</strong><canvas id="chartWinRateCumulative" height="140"></canvas></div>
            <div style={{ background: 'var(--card-bg)', padding: 15, borderRadius: 8 }}><strong>PnL Diário</strong><canvas id="chartDailyBar" height="140"></canvas></div>
          </div>

          <div className="filter-section">
            <label>🏦 Filtrar por Conta:</label>
            <select id="accountFilter" onChange={() => filterTrades()}>
              <option value="">Todas as contas</option>
            </select>
          </div>

          <div className="upload-section" id="strategiesSection" style={{ marginTop: 10 }}>
            <h3 style={{ margin: '0 0 10px 0' }}>🧠 Estratégias</h3>
            <div className="form-group"><label>Nome</label><input type="text" id="strategyName" /></div>
            <div className="form-group"><label>Timeframe</label><input type="text" id="strategyTimeframe" /></div>
            <div className="form-group"><label>Risco/Recompensa Esperado</label><input type="number" id="strategyRR" step="0.01" /></div>
            <div className="form-group"><label>Descrição</label><input type="text" id="strategyDescription" /></div>
            <button className="btn btn-primary" onClick={() => handleCreateStrategy()}>Criar Estratégia</button>
            <div id="strategyMessage" style={{ marginTop: 8 }}></div>
          </div>

          <h2>📋 Trades (Clique em um trade para ver detalhes)</h2>
          <div style={{ overflowX: 'auto' }}>
            <table id="tradesTable">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Conta</th>
                  <th>Instrumento</th>
                  <th>Tipo</th>
                  <th>Entrada</th>
                  <th>Saída</th>
                  <th>Pontos</th>
                  <th>PnL $</th>
                  <th>Fechamento</th>
                  <th>Estratégia</th>
                </tr>
              </thead>
              <tbody id="tradesBody">
                <tr><td colSpan="10" className="loading">Nenhum trade</td></tr>
              </tbody>
            </table>
          </div>

          <div id="tradeDetails">
            <div className="detail-header">
              <h2>📊 Detalhes do Trade</h2>
              <button className="close-btn" onClick={() => closeTradeDetails()}>✕ Fechar</button>
            </div>
            <div className="detail-grid">
              <div className="detail-item"><strong>Instrumento</strong><span id="detailInstrument">-</span></div>
              <div className="detail-item"><strong>Tipo</strong><span id="detailType">-</span></div>
              <div className="detail-item"><strong>Status</strong><span id="detailStatus">-</span></div>
              <div className="detail-item"><strong>Conta</strong><span id="detailAccount">-</span></div>
            </div>
            <h3>📈 Operações do Trade</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: 10, textAlign: 'left', borderBottom: '2px solid #ddd' }}>Hora</th>
                    <th style={{ padding: 10, textAlign: 'left', borderBottom: '2px solid #ddd' }}>Ação</th>
                    <th style={{ padding: 10, textAlign: 'left', borderBottom: '2px solid #ddd' }}>Quantidade</th>
                    <th style={{ padding: 10, textAlign: 'left', borderBottom: '2px solid #ddd' }}>Preço</th>
                    <th style={{ padding: 10, textAlign: 'left', borderBottom: '2px solid #ddd' }}>Comissão</th>
                    <th style={{ padding: 10, textAlign: 'left', borderBottom: '2px solid #ddd' }}>Tipo</th>
                  </tr>
                </thead>
                <tbody id="detailOperations"></tbody>
              </table>
            </div>
            <div style={{ marginTop: 20, padding: 20, background: 'white', borderRadius: 4, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              <div style={{ borderLeft: '4px solid #2196F3', paddingLeft: 15 }}>
                <strong style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 8 }}>Preço Médio Entrada</strong>
                <div style={{ fontSize: 22, color: '#2196F3', fontWeight: 'bold' }}>$<span id="detailAvgEntry">-</span></div>
              </div>
              <div style={{ borderLeft: '4px solid #2196F3', paddingLeft: 15 }}>
                <strong style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 8 }}>Preço Médio Saída</strong>
                <div style={{ fontSize: 22, color: '#2196F3', fontWeight: 'bold' }}>$<span id="detailAvgExit">-</span></div>
              </div>
              <div style={{ borderLeft: '4px solid #4CAF50', paddingLeft: 15 }}>
                <strong style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 8 }}>PnL Total</strong>
                <div id="detailPnL" style={{ fontSize: 22, fontWeight: 'bold' }}>-</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4"></script>
    </div>
  )
}

export default App
