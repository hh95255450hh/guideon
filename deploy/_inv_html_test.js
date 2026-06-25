(async () => {
  const invoice = require('./src/services/invoiceService');
  const fs = require('fs');
  const items = [
    { desc: 'عمولة المنصّة — رحلات يونيو 2026', amount: 185.000 },
    { desc: 'رسوم خدمة وتسويق رقمي', amount: 25.500 },
    { desc: 'اشتراك ودعم فنّي', amount: 15.000 },
  ];
  const pdf = await invoice.generateInvoice(
    { id: 'inv-sample01', items, note: 'شكراً لتعاملكم مع Guideon — يُرجى السداد خلال 15 يوماً.', createdAt: new Date().toISOString() },
    { name: 'دروب عُمان للسياحة — Duroob Oman', type: 'company', email: 'info@duroob.om' }, 0, ''
  );
  fs.writeFileSync('/tmp/sample-invoice.pdf', pdf);
  console.log('INVOICE PDF valid=' + (pdf.slice(0,5).toString()==='%PDF-') + ' size=' + pdf.length);
  const v = await invoice.generatePaymentVoucher(
    { id: 'trz-sample01', amount: 250.000, description: 'دفعة مستحقّات يونيو', createdAt: new Date().toISOString() },
    { name: 'علي عبدالله البوسعيدي', type: 'guide', email: 'ali@example.om' }
  );
  fs.writeFileSync('/tmp/sample-voucher.pdf', v);
  console.log('VOUCHER PDF valid=' + (v.slice(0,5).toString()==='%PDF-') + ' size=' + v.length);
})().catch(e=>console.log('ERR', e.message));
