function computeBalance(acc){
  var ib = parseFloat(acc.initial_bal || 0) || 0;
  var pl = parseFloat(acc.profit_loss || 0) || 0;
  var wd = parseFloat(acc.withdrawals || 0) || 0;
  return ib + pl - wd;
}

function validateAccountFormData(d){
  if (!d.prop_firm_name) return { ok:false, error:'Informe Prop Firm Name' };
  if (!d.account) return { ok:false, error:'Informe o número da conta' };
  if (!d.status) return { ok:false, error:'Selecione o status' };
  if (!d.type) return { ok:false, error:'Selecione o tipo' };
  if (d.initial_bal === undefined || d.initial_bal === null || isNaN(parseFloat(d.initial_bal))) return { ok:false, error:'Saldo inicial inválido' };
  return { ok:true };
}

function assert(cond, msg){ if(!cond){ console.error('FAIL:', msg); process.exitCode = 1; } else { console.log('PASS:', msg); } }

assert(computeBalance({ initial_bal: 1000, profit_loss: 200, withdrawals: 100 }) === 1100, 'Saldo básico');
assert(computeBalance({ initial_bal: 0, profit_loss: -50, withdrawals: 0 }) === -50, 'Saldo negativo');
assert(computeBalance({ initial_bal: '100', profit_loss: '50.5', withdrawals: '10.5' }) === 140, 'Saldo com strings');

assert(!validateAccountFormData({}).ok, 'Validação vazia falha');
assert(!validateAccountFormData({ prop_firm_name:'A', account:'1', status:'perfacc', type:'cfds', initial_bal:'x' }).ok, 'Saldo inicial inválido');
assert(validateAccountFormData({ prop_firm_name:'A', account:'1', status:'perfacc', type:'cfds', initial_bal:100 }).ok, 'Validação ok');

console.log('Accounts tests completed');

