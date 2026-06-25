(async () => {
  const T = process.env.WHATSAPP_ACCESS_TOKEN;
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${T}&access_token=${T}`);
    const d = await r.json();
    console.log('app_id:', d.data?.app_id, '| app:', d.data?.application, '| type:', d.data?.type);
  } catch(e){ console.log('ERR', e.message); }
})();
