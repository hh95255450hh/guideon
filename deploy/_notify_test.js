(async () => {
  const notif = require('./src/services/notificationService');
  const row = await notif.notify({
    userId: 'admin-001',
    type: 'system',
    title: 'Notifications now on WhatsApp',
    titleAr: 'الإشعارات الآن على واتساب',
    body: 'WhatsApp is now a primary channel alongside email — you will get bookings, confirmations and alerts here.',
    bodyAr: 'واتساب أصبح قناة رئيسيّة مثل البريد — ستصلك الحجوزات والتأكيدات والتنبيهات هنا. ✅',
    link: '/admin.html',
    icon: '🔔',
  });
  console.log('NOTIFY_INSERTED:', row ? row.id : 'null');
})();
