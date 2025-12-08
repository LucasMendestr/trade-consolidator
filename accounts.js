let allAccounts = [];

function computeBalance(acc){
  var ib = parseFloat(acc.initial_bal || 0) || 0;
  var pl = parseFloat(acc.profit_loss || 0) || 0;
  var wd = parseFloat(acc.withdrawals || 0) || 0;
  return ib + pl - wd;
}

function formatMoney(v){ var n = parseFloat(v || 0) || 0; return (n < 0 ? '-' : '') + '$' + Math.abs(n).toFixed(2); }
function formatDateIso(v){ try { var d = new Date(v); if (isNaN(d.getTime())) return '-'; return d.toISOString().slice(0,10); } catch(e){ return '-'; } }

function openCreateAccountModal(){ var m=document.getElementById('createAccountModal'); var b=document.getElementById('modalBackdrop'); if(m&&b){ m.classList.add('open'); b.classList.add('open'); } }
function closeCreateAccountModal(){ var m=document.getElementById('createAccountModal'); var b=document.getElementById('modalBackdrop'); if(m&&b){ m.classList.remove('open'); b.classList.remove('open'); } }

function setCreateLoading(loading){ var btn=document.getElementById('btnCreateAccount'); if(btn){ btn.disabled=!!loading; btn.textContent=loading? 'Criando...' : 'Criar'; } }

function showFormError(msg){ var e=document.getElementById('createAccountError'); var s=document.getElementById('createAccountSuccess'); if(s){ s.style.display='none'; s.textContent=''; } if(e){ e.style.display='block'; e.textContent=String(msg||''); } }
function showFormSuccess(msg){ var e=document.getElementById('createAccountError'); var s=document.getElementById('createAccountSuccess'); if(e){ e.style.display='none'; e.textContent=''; } if(s){ s.style.display='block'; s.textContent=String(msg||''); }
  setTimeout(function(){ if(s){ s.style.display='none'; s.textContent=''; } }, 3000);
}

function validateAccountForm(){
  var p = (document.getElementById('propFirmName').value || '').trim();
  var a = (document.getElementById('accountNumber').value || '').trim();
  var st = (document.getElementById('accountStatus').value || '').trim();
  var tp = (document.getElementById('accountType').value || '').trim();
  var ib = (document.getElementById('initialBal').value || '').trim();
  if (!p) return { ok:false, error:'Informe Prop Firm Name' };
  if (!a) return { ok:false, error:'Informe o número da conta' };
  if (!st) return { ok:false, error:'Selecione o status' };
  if (!tp) return { ok:false, error:'Selecione o tipo' };
  if (!ib || isNaN(parseFloat(ib))) return { ok:false, error:'Saldo inicial inválido' };
  return { ok:true };
}

async function submitCreateAccount(){
  if (!supabaseClient || !currentUser) { showFormError('Sessão inválida'); return; }
  var v = validateAccountForm();
  if (!v.ok) { showFormError(v.error); return; }
  setCreateLoading(true);
  try {
    var payload = {
      user_id: currentUser.id,
      prop_firm_name: (document.getElementById('propFirmName').value || '').trim(),
      account: (document.getElementById('accountNumber').value || '').trim(),
      status: (document.getElementById('accountStatus').value || '').trim(),
      type: (document.getElementById('accountType').value || '').trim(),
      initial_bal: parseFloat(document.getElementById('initialBal').value || '0') || 0,
      investment: parseFloat(document.getElementById('investment').value || '0') || 0,
      withdrawals: parseFloat(document.getElementById('withdrawals').value || '0') || 0,
      profit_loss: parseFloat(document.getElementById('profitLoss').value || '0') || 0,
      rules: (document.getElementById('rules').value || '').trim(),
      platform: (document.getElementById('platform').value || '').trim()
    };
    var res = await supabaseClient.from('accounts').insert([payload]).select('*').single();
    if (res.error) { showFormError(res.error.message); setCreateLoading(false); return; }
    showFormSuccess('Conta criada com sucesso');
    closeCreateAccountModal();
    await loadAccounts();
    try {
      document.getElementById('createAccountForm').reset();
    } catch(e){}
  } catch(err){ showFormError(err.message || String(err)); }
  setCreateLoading(false);
}

async function loadAccounts(){
  if (!supabaseClient || !currentUser) return;
  var msg = document.getElementById('accountsMessage');
  if (msg) { msg.textContent = 'Carregando...'; msg.className = 'loading'; }
  var res = await supabaseClient.from('accounts').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  if (res.error) { if (msg) { msg.textContent = res.error.message; msg.className = 'error'; } return; }
  allAccounts = res.data || [];
  renderAccountsTable();
  if (msg) { msg.textContent = ''; msg.className = ''; }
}

function renderAccountsTable(){
  var body = document.getElementById('accountsBody');
  if (!body) return;
  if (!allAccounts.length) { body.innerHTML = '<tr><td colspan="4" class="loading">Nenhuma conta</td></tr>'; return; }
  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var html = '';
  for (var i=0;i<allAccounts.length;i++){
    var a = allAccounts[i];
    var saldo = computeBalance(a);
    html += '<tr>' +
      '<td>' + escapeHtml(a.prop_firm_name || a.account || '-') + '</td>' +
      '<td>' + escapeHtml(String(a.type || '-').toUpperCase()) + '</td>' +
      '<td>' + formatMoney(saldo) + '</td>' +
      '<td>' + escapeHtml(formatDateIso(a.created_at)) + '</td>' +
    '</tr>';
  }
  body.innerHTML = html;
}

