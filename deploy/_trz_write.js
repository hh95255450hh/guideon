(async () => {
  const SupabaseDB = require('./src/models/SupabaseDB');
  const { v4: uuidv4 } = require('uuid');
  const trz = new SupabaseDB('treasury_transactions');
  const id = 'trz-' + uuidv4().slice(0,8);
  // insert a test deposit of 1000
  await trz.insert({ id, type:'deposit', amount:1000, description:'اختبار إيداع رأس مال', payeeId:null, payeeName:'', createdAt:new Date().toISOString(), createdBy:'admin-001' });
  console.log('inserted deposit', id);
  // read back
  const all = await trz.readAll();
  const mine = all.find(x=>x.id===id);
  console.log('read back:', mine ? `type=${mine.type} amount=${mine.amount}` : 'NOT FOUND');
  console.log('total treasury txns now:', all.length);
  // cleanup
  await trz.delete(id);
  console.log('deleted test txn. remaining:', (await trz.readAll()).length);
})().catch(e=>console.log('ERR', e.message));
