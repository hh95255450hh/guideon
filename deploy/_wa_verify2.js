(async () => {
  const w = require('./src/services/whatsappService');
  console.log('config:', JSON.stringify(w.config()));
  try {
    const t = await w.sendTextVerbose('96895255450', 'Test from the new Oman WhatsApp number for Guideon');
    console.log('TEXT_RESULT:', JSON.stringify(t));
  } catch (e) { console.log('TEXT_ERR:', e.message); }
})();
