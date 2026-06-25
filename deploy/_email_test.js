(async () => {
  const email = require('./src/services/emailService');
  try {
    const r = await email.send('admin@guideon.om', '✅ Resend key rotated successfully',
      '<div style="font-family:sans-serif"><h2>تمّ تدوير مفتاح Resend بنجاح ✅</h2><p>البريد يعمل بالمفتاح الجديد على الخادم العُماني.</p></div>');
    console.log('EMAIL_RESULT:', JSON.stringify(r).slice(0, 250));
  } catch (e) { console.log('EMAIL_ERR:', e.message); }
})();
