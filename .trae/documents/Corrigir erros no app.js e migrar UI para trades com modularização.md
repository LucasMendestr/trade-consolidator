## Diagnóstico
- O `app.js` está corrompido por trechos soltos (concatenações de `<td>`) e múltiplas funções duplicadas (showTradeDetails, populateOperationsTable, window.load) fora de escopo, causando erros de sintaxe.
- A tabela e os cards usam `filteredTrades` calculados a partir de `operations`; já adicionamos persistência em `trades`, mas a UI não lê direto de `trades`.
- Estratégias: precisamos carregar/criar e permitir vínculo via dropdown por trade, com uma única fonte de verdade e funções únicas.

## Correções do app.js (limpeza e estabilização)
1. Remover fragmentos soltos após o listener `window.addEventListener('load', ...)`:
   - Procurar e apagar linhas que começam com `+ (t.avgExit ...` e `+ (t.pnlDollars ...)` fora de funções.
2. Unificar funções, mantendo apenas uma definição de cada:
   - `showTradeDetails`, `populateOperationsTable`, `updateTradesTable`, `renderCharts`, `setTheme`/`initThemeFromStorage`, `loadStrategies`, `handleCreateStrategy`, `assignStrategyToTrade`, `deleteAllTransactions`, `processCSV`, `isDuplicateOperation`.
   - Deixar apenas um `window.addEventListener('load', ...)` que chama `initSupabase()` e `initThemeFromStorage()`.
3. Reescrever `updateTradesTable` de forma íntegra:
   - Construir a linha com todas as colunas (Status, Conta, Instrumento, Tipo, Entrada, Saída, Pontos, PnL $, Fechamento, Estratégia).
   - Incluir dropdown de estratégia com `event.stopPropagation()` e `assignStrategyToTrade(tradeId, strategyId)`.
   - Fechar corretamente o `<tr>` e a função; usar `colspan="10"` quando vazio.
4. Garantir que ao consolidar um trade fechado o objeto contenha `id` (proveniente da inserção/verificação em `trades`) e que `strategy_id` seja refletido no objeto.
5. Inicialização:
   - Após login: `await loadDataFromSupabase(); await loadStrategies();`.
   - No filtro: `updateTradesTable(); updateDashboard(); renderCharts();`.
6. Verificação funcional:
   - Subir CSV, verificar tabela sem erros de sintaxe.
   - Criar estratégia e atribuir via dropdown; confirmar atualização em `trades.strategy_id`.
   - Aplicar filtro de conta e checar que cards e gráficos mudam.

## Migrar UI para ler diretamente de `trades`
1. Alterar `loadDataFromSupabase` para consultar `from('trades')` com os campos necessários (`instrument, account, type, status, avg_price_entry, avg_price_exit, pnl_points, pnl_dollars, start_time, end_time, id, strategy_id`).
2. Descontinuar a dependência de `calculateAndDisplayTrades` para renderização; manter a consolidação somente durante `processCSV` para gerar/atualizar `trades` e `operations.trade_id`.
3. Ajustar `showTradeDetails` para, ao abrir um trade, buscar `operations` com `trade_id = selectedTrade.id` e preencher o painel de operações.
4. Atualizar `updateDashboard` e `renderCharts` para usar `filteredTrades` vindos de `trades`.

## UI de Estratégias
1. Manter a seção de cadastro de estratégias (nome, timeframe, RR esperado, descrição) e funções `loadStrategies`/`handleCreateStrategy`.
2. Dropdown por trade na tabela para atribuição (`assignStrategyToTrade`) e refletir imediatamente na UI.

## Modularização por arquivos (recomendado)
- Benefícios: organização, manutenção, testes e evolução mais fáceis.
- Proposta de módulos:
  - `supabase.js`: init e helpers de auth/queries.
  - `data/trades.js`: carregar trades, salvar trade, atribuir estratégia.
  - `data/operations.js`: importação de CSV, checagem de duplicidade, busca por `trade_id`.
  - `ui/table.js`: renderização da tabela de trades.
  - `ui/dashboard.js`: cálculo e render de cards.
  - `ui/charts.js`: gráficos com Chart.js.
  - `ui/theme.js`: claro/escuro.
  - `ui/strategies.js`: CRUD de estratégias.
  - `main.js`: bootstrap e listeners.
- Passo a passo: primeiro estabilizar `app.js` (sem quebras), migrar para ler de `trades`, depois fatiar em módulos em duas ou três etapas para minimizar risco.

## Validação
- Testar: login, upload CSV, filtro por conta, criação de estratégias, atribuição em dropdown, gráficos/cards atualizando.
- Console do navegador sem erros; revisões pontuais conforme necessário.

## Confirmação
- Com a sua confirmação, aplico a limpeza do `app.js`, migro o carregamento para `trades`, ajusto a UI de detalhes para buscar `operations` por `trade_id`, e deixo pronto para modularização em arquivos separados na sequência.