(async () => {
  const notif = require('./src/services/notificationService');
  await notif.notify({
    userId: 'admin-001', type: 'system',
    title: 'WhatsApp notifications active',
    titleAr: 'إشعارات واتساب مُفعّلة',
    body: 'This came through the full notification pipeline (in-app + email + WhatsApp).',
    bodyAr: 'وصلتك هذه عبر مسار الإشعارات الكامل: داخل التطبيق + بريد + واتساب. 🎉',
    link: '/admin.html', icon: '🔔',
  });
  // keep the process alive so the fire-and-forget template request completes
  await new Promise(r => setTimeout(r, 5000));
  console.log('done (pipeline fired + waited for WhatsApp template)');
})();
