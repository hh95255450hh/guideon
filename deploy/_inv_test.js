(async () => {
  const SupabaseDB = require('./src/models/SupabaseDB');
  const invoice = require('./src/services/invoiceService');
  const commission = require('./src/services/commission');
  const { v4: uuidv4 } = require('uuid');
  const users = new SupabaseDB('users'), inv = new SupabaseDB('invoices');
  const r3 = n => Math.round((Number(n)||0)*1000)/1000;

  const u = (await users.findAllWhere({ userType:'guide' }))[0];
  const items = [{desc:'عمولة المنصّة — يونيو', amount:120.5},{desc:'رسوم خدمة', amount:9.75}];
  const RATES = await commission.getRates();
  const subtotal = r3(items.reduce((s,i)=>s+i.amount,0));
  const vat = r3(subtotal*(RATES.vat||0)); const total = r3(subtotal+vat);
  const id = 'inv-'+uuidv4().slice(0,8);
  const number = invoice.invoiceDocNumber(id, new Date().toISOString());
  await inv.insert({ id, number, recipientId:u.id, recipientName:u.fullName||'', recipientType:'guide', items, subtotal, vatRate:RATES.vat||0, vat, total, note:'شكراً', createdAt:new Date().toISOString(), createdBy:'admin-001' });
  console.log('created invoice', number, 'total', total);

  const pdf = await invoice.generateInvoice({ id, number, items, note:'شكراً', createdAt:new Date().toISOString() }, { name:u.fullName||'Guide', type:'guide', email:u.email||'' }, RATES.vat||0, RATES.vatNumber||'');
  console.log('INVOICE PDF: valid=' + (pdf.slice(0,5).toString()==='%PDF-') + ' size=' + pdf.length);

  const list = await inv.readAll();
  console.log('invoices in DB:', list.length);
  await inv.delete(id);
  console.log('cleanup done. remaining:', (await inv.readAll()).length);
})().catch(e=>console.log('ERR', e.message, e.stack));
