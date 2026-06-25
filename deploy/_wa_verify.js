(async () => {
  const w = require('./src/services/whatsappService');
  console.log('config:', JSON.stringify(w.config ? w.config() : {}));
  try {
    const t = await w.sendTextVerbose('96895255450', '✅ تمّ تدوير رمز واتساب بنجاح — التكامل يعمل بالرمز الجديد على الخادم العُماني. 🔐🚀');
    console.log('WA_RESULT:', JSON.stringify(t));
  } catch (e) { console.log('WA_ERR:', e.message); }
})();
