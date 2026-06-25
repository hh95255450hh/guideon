(async () => {
  const w = require('./src/services/whatsappService');
  const to = '96895255450';
  console.log('config:', JSON.stringify(w.config ? w.config() : {}));
  try {
    const t = await w.sendTextVerbose(to, '✅ مرحباً هيثم! هذه رسالة اختبار من منصّة Guideon 🇴🇲 عبر تكامل واتساب — كلّ شيء يعمل بنجاح على الخادم العُماني الجديد. 🚀');
    console.log('TEXT_RESULT:', JSON.stringify(t));
  } catch (e) { console.log('TEXT_ERR:', e.message); }
  try {
    const tpl = await w.sendTemplate(to, process.env.WHATSAPP_TEMPLATE_NAME || 'guideon_alert', process.env.WHATSAPP_TEMPLATE_LANG || 'ar', ['Guideon', 'تكامل الواتساب يعمل ✅']);
    console.log('TEMPLATE_RESULT:', JSON.stringify(tpl));
  } catch (e) { console.log('TEMPLATE_ERR:', e.message); }
})();
