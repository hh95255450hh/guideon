(async () => {
  const SupabaseDB = require('./src/models/SupabaseDB');
  const invoice = require('./src/services/invoiceService');
  const { v4: uuidv4 } = require('uuid');
  const users = new SupabaseDB('users'), trz = new SupabaseDB('treasury_transactions');

  // 1) providers by type
  for (const type of ['guide','company','team']) {
    const list = (await users.findAllWhere({ userType: type }).catch(()=>[])).filter(u=>!u.isSuspended);
    console.log(`providers[${type}]: ${list.length}` + (list[0]?` e.g. "${list[0].companyName||list[0].teamName||list[0].fullName}"`:''));
  }

  // 2) create a test send to first guide
  const guide = (await users.findAllWhere({ userType:'guide' }))[0];
  const id = 'trz-' + uuidv4().slice(0,8);
  await trz.insert({ id, type:'send', amount:250.5, description:'دفعة تجريبيّة', payeeId: guide.id, payeeName: guide.fullName||'', createdAt:new Date().toISOString(), createdBy:'admin-001' });

  // 3) generate voucher PDF
  const pdf = await invoice.generatePaymentVoucher(
    { id, amount:250.5, description:'دفعة تجريبيّة', createdAt:new Date().toISOString() },
    { name: guide.fullName||'Guide', type:'guide', email: guide.email||'' }
  );
  const head = pdf.slice(0,5).toString();
  console.log('VOUCHER PDF: valid=' + (head==='%PDF-') + ' size=' + pdf.length + ' bytes');

  // 4) cleanup
  await trz.delete(id);
  console.log('cleanup done');
})().catch(e=>console.log('ERR', e.message, e.stack));
