(async () => {
  const PID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  const PIN = '628194';
  for (const ver of ['v21.0','v20.0']) {
    try {
      const res = await fetch(`https://graph.facebook.com/${ver}/${PID}/register`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', pin: PIN }),
      });
      const data = await res.json();
      console.log(`[${ver}] status=${res.status}`, JSON.stringify(data));
      if (res.ok) break;
    } catch (e) { console.log(`[${ver}] ERR`, e.message); }
  }
})();
