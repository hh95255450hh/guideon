/**
 * Newsletter signup widget — adds a fixed bottom-right card after 8s on first visit.
 * Dismissed via localStorage.
 */
(function () {
  if (localStorage.getItem('og_newsletter_dismissed')) return;
  if (sessionStorage.getItem('og_newsletter_shown')) return;

  function show() {
    sessionStorage.setItem('og_newsletter_shown', '1');
    const box = document.createElement('div');
    box.id = 'ogNewsletter';
    box.style.cssText = `
      position:fixed; bottom:20px; right:20px; z-index:9999;
      max-width:340px; padding:20px;
      background:#fff; border-radius:14px; box-shadow:0 8px 32px rgba(0,0,0,0.18);
      font-family:'Segoe UI',Arial,sans-serif; animation:ogslide .5s ease-out;
    `;
    box.innerHTML = `
      <style>@keyframes ogslide{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}</style>
      <button onclick="document.getElementById('ogNewsletter').remove();localStorage.setItem('og_newsletter_dismissed','1')"
        style="position:absolute;top:8px;right:10px;background:none;border:none;font-size:20px;cursor:pointer;color:#999">×</button>
      <div style="font-size:28px;margin-bottom:6px">🌿</div>
      <h5 style="margin:0 0 6px;font-weight:800;color:#0f7b6c">Get Oman travel tips</h5>
      <p style="margin:0 0 12px;font-size:13px;color:#666;line-height:1.5">Hidden gems, festivals, deals. No spam.</p>
      <form id="ogSubForm" style="display:flex;gap:6px">
        <input type="email" placeholder="your@email.com" required
          style="flex:1;padding:9px 12px;border:1px solid #d0d7d4;border-radius:8px;font-size:13px">
        <button type="submit"
          style="background:#0f7b6c;color:#fff;border:none;padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">
          Subscribe
        </button>
      </form>
      <div id="ogSubMsg" style="margin-top:10px;font-size:12px"></div>
    `;
    document.body.appendChild(box);

    box.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = e.target.querySelector('input').value;
      const msg = box.querySelector('#ogSubMsg');
      msg.style.color = '#666';
      msg.textContent = 'Subscribing...';
      try {
        const r = await fetch('/api/newsletter/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, source: 'popup' }),
        });
        const j = await r.json();
        msg.style.color = j.success ? '#0f7b6c' : '#cc0000';
        msg.textContent = j.message;
        if (j.success) {
          localStorage.setItem('og_newsletter_dismissed', '1');
          setTimeout(() => box.remove(), 2200);
        }
      } catch {
        msg.style.color = '#cc0000';
        msg.textContent = 'Network error';
      }
    });
  }

  if (document.readyState === 'complete') setTimeout(show, 8000);
  else window.addEventListener('load', () => setTimeout(show, 8000));
})();
