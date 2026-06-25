(async () => {
  const SupabaseDB = require('./src/models/SupabaseDB');
  const commission = require('./src/services/commission');
  const users = new SupabaseDB('users'), bookings = new SupabaseDB('bookings');
  const expenses = new SupabaseDB('finance_expenses'), trz = new SupabaseDB('treasury_transactions');
  const r3 = n => Math.round((Number(n)||0)*1000)/1000;
  const RATES = await commission.getRates();
  const [u,b,e,t] = await Promise.all([users.readAll(),bookings.readAll(),expenses.readAll().catch(()=>[]),trz.readAll().catch(()=>[])]);
  const byId = Object.fromEntries(u.map(x=>[x.id,x]));
  let income=0; for(const x of b){ if(!x.isPaid||x.totalAmount==null)continue; income += (parseFloat(x.totalAmount)||0)*commission.rateFor(byId[x.guideId],RATES); }
  income=r3(income);
  const exp=r3(e.reduce((s,x)=>s+(parseFloat(x.amount)||0),0));
  let mIn=0,mOut=0; for(const x of t){ const a=parseFloat(x.amount)||0; if(x.type==='deposit')mIn+=a; else mOut+=a; }
  console.log('TREASURY:', JSON.stringify({ commissionIncome:income, expenses:exp, manualIn:r3(mIn), manualOut:r3(mOut), balance:r3(income+mIn-exp-mOut), txns:t.length, rates:RATES }));
})().catch(e=>console.log('ERR',e.message));
