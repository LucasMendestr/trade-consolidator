function normalizeText(v){ return String(v || '').toLowerCase(); }
function parseNumber(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; }
function parseDate(v){ var d = new Date(v); var t = d.getTime(); return isNaN(t) ? 0 : t; }
function valueForKey(t, key){
  if (key === 'status') return normalizeText(t.status);
  if (key === 'account') return normalizeText(t.account);
  if (key === 'instrument') return normalizeText(t.instrument);
  if (key === 'type') return normalizeText(t.type);
  if (key === 'avgEntry') return parseNumber(t.avgEntry);
  if (key === 'avgExit') return parseNumber(t.avgExit);
  if (key === 'pnlPoints') return parseNumber(t.pnlPoints);
  if (key === 'pnlDollars') return parseNumber(t.pnlDollars);
  if (key === 'endTime') return parseDate(t.endTime);
  if (key === 'strategy') return normalizeText(String(t.strategy_id || '')); 
  return 0;
}
function sortTrades(data, key, dir){ var d = dir==='desc'?-1:1; return data.slice().sort(function(a,b){ var va=valueForKey(a,key), vb=valueForKey(b,key); if(va<vb) return -1*d; if(va>vb) return 1*d; return 0; }); }
function assert(cond, msg){ if(!cond){ console.error('FAIL:', msg); process.exitCode = 1; } else { console.log('PASS:', msg); } }

const sample = [
  { id:'1', status:'Closed', account:'ACC2', instrument:'MNQ', type:'LONG', avgEntry:'100', avgExit:'110', pnlPoints:'10', pnlDollars:'200', endTime:'2024-01-02T10:00:00Z', strategy_id: 2 },
  { id:'2', status:'Open', account:'ACC1', instrument:'NQ', type:'SHORT', avgEntry:'50', avgExit:'40', pnlPoints:'-10', pnlDollars:'-100', endTime:'2023-12-01T09:00:00Z', strategy_id: 1 },
  { id:'3', status:'Closed', account:'ACC3', instrument:'GC', type:'LONG', avgEntry:'5', avgExit:'6', pnlPoints:'1', pnlDollars:'50', endTime:'2025-03-10T11:00:00Z', strategy_id: 3 }
];

assert(sortTrades(sample,'account','asc')[0].account==='ACC1','Sort text asc');
assert(sortTrades(sample,'account','desc')[0].account==='ACC3','Sort text desc');
assert(sortTrades(sample,'pnlDollars','asc')[0].id==='2','Sort number asc');
assert(sortTrades(sample,'pnlDollars','desc')[0].id==='1','Sort number desc');
assert(sortTrades(sample,'endTime','asc')[0].id==='2','Sort date asc');
assert(sortTrades(sample,'endTime','desc')[0].id==='3','Sort date desc');

// selection set behavior
const selected = new Set();
selected.add('1'); selected.add('3');
assert(selected.size===2,'Selection count');
selected.delete('3');
assert(selected.size===1,'Selection after deselect');

console.log('Tests completed');
