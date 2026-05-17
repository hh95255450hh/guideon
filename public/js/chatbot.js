/* ── GuideonBot Chat Widget — shared across all pages ── */
(function () {
  const CSS = `
:root{--cb:#0f7b6c;--cb-dk:#0a5c50;--cb-bg:#f8f9fa;--cb-border:#dee2e6;--cb-muted:#6c757d}
#chat-fab{position:fixed;bottom:24px;right:24px;z-index:9999;width:58px;height:58px;background:var(--cb);border-radius:50%;border:none;cursor:pointer;box-shadow:0 4px 18px rgba(15,123,108,.5);display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s}
#chat-fab:hover{transform:scale(1.09);box-shadow:0 6px 24px rgba(15,123,108,.6)}
#chat-fab svg{width:26px;height:26px;fill:#fff}
#chat-fab .fab-badge{position:absolute;top:0;right:0;width:18px;height:18px;background:#ef4444;border-radius:50%;font-size:10px;font-weight:700;color:#fff;display:none;align-items:center;justify-content:center;border:2px solid #fff}
#chat-fab.has-badge .fab-badge{display:flex}
#chat-box{position:fixed;bottom:96px;right:24px;z-index:9998;width:370px;max-height:530px;background:#fff;border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.18);display:flex;flex-direction:column;transform:translateY(16px) scale(.97);opacity:0;pointer-events:none;transition:transform .25s cubic-bezier(.34,1.56,.64,1),opacity .18s}
#chat-box.open{transform:none;opacity:1;pointer-events:all}
.cb-header{background:linear-gradient(135deg,var(--cb),#1abc9c);border-radius:18px 18px 0 0;padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0}
.cb-avatar{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.cb-title{font-size:14px;font-weight:700;color:#fff}
.cb-status{display:flex;align-items:center;gap:4px;font-size:11px;color:rgba(255,255,255,.8)}
.cb-dot{width:6px;height:6px;background:#4ade80;border-radius:50%;animation:cbBlink 2s infinite}
@keyframes cbBlink{0%,100%{opacity:1}50%{opacity:.4}}
.cb-clear{background:rgba(255,255,255,.15);border:none;color:rgba(255,255,255,.8);cursor:pointer;font-size:11px;padding:3px 8px;border-radius:6px;transition:all .2s}
.cb-clear:hover{background:rgba(255,255,255,.25);color:#fff}
.cb-close{background:rgba(255,255,255,.15);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:background .2s}
.cb-close:hover{background:rgba(255,255,255,.3)}
.cb-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px;min-height:0;scroll-behavior:smooth}
.cb-msgs::-webkit-scrollbar{width:3px}
.cb-msgs::-webkit-scrollbar-thumb{background:var(--cb-border);border-radius:3px}
.cb-msg{display:flex;gap:7px;max-width:90%;animation:cbMsgIn .22s ease-out}
@keyframes cbMsgIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
.cb-msg.user{margin-right:0;margin-left:auto;flex-direction:row-reverse}
.cb-msg-av{width:26px;height:26px;border-radius:50%;background:rgba(15,123,108,.1);display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;align-self:flex-end}
.cb-bubble{padding:9px 13px;border-radius:14px;font-size:13px;line-height:1.5;word-break:break-word}
.cb-msg.bot .cb-bubble{background:var(--cb-bg);color:#1a1a2e;border-bottom-left-radius:3px}
.cb-msg.user .cb-bubble{background:var(--cb);color:#fff;border-bottom-right-radius:3px}
.cb-time{font-size:10px;color:var(--cb-muted);margin-top:2px}
.cb-msg.user .cb-time{text-align:right}
.cb-typing{display:flex;gap:5px;padding:10px 13px;background:var(--cb-bg);border-radius:14px;border-bottom-left-radius:3px;width:fit-content}
.cb-tdot{width:6px;height:6px;background:var(--cb-muted);border-radius:50%;animation:cbTdot 1.4s infinite ease-in-out}
.cb-tdot:nth-child(2){animation-delay:.2s}.cb-tdot:nth-child(3){animation-delay:.4s}
@keyframes cbTdot{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
.cb-chips{display:flex;flex-wrap:wrap;gap:5px;padding:0 14px 10px;flex-shrink:0}
.cb-chip{background:rgba(15,123,108,.08);border:1px solid rgba(15,123,108,.2);border-radius:18px;padding:4px 11px;font-size:11.5px;color:var(--cb);cursor:pointer;transition:background .15s;white-space:nowrap}
.cb-chip:hover{background:rgba(15,123,108,.16)}
.cb-input-row{padding:10px 12px;border-top:1px solid var(--cb-border);display:flex;gap:7px;align-items:flex-end;flex-shrink:0}
#cb-input{flex:1;border:1px solid var(--cb-border);border-radius:10px;padding:8px 11px;font-size:13px;font-family:inherit;outline:none;resize:none;max-height:90px;overflow-y:auto;transition:border-color .2s;line-height:1.4}
#cb-input:focus{border-color:var(--cb)}
#cb-input::placeholder{color:var(--cb-muted)}
#cb-send{width:36px;height:36px;background:var(--cb);border:none;border-radius:9px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:background .2s,transform .1s}
#cb-send:hover:not(:disabled){background:var(--cb-dk)}
#cb-send:active{transform:scale(.92)}
#cb-send:disabled{opacity:.45;cursor:not-allowed}
#cb-send svg{width:17px;height:17px;fill:#fff}
.cb-footer-txt{font-size:10.5px;color:var(--cb-muted);text-align:center;padding:4px 0 9px;flex-shrink:0}
@media(max-width:420px){#chat-box{width:calc(100vw - 20px);right:10px;bottom:84px}}
`;

  function inject() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    document.body.insertAdjacentHTML('beforeend', `
<button id="chat-fab" onclick="cbToggle()" aria-label="GuideonBot">
  <div class="fab-badge">1</div>
  <svg id="fab-icon-chat" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
  <svg id="fab-icon-x" viewBox="0 0 24 24" style="display:none"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
</button>
<div id="chat-box" role="dialog" aria-label="GuideonBot Chat">
  <div class="cb-header">
    <div class="cb-avatar">🌿</div>
    <div style="flex:1">
      <div class="cb-title">GuideonBot 🇴🇲</div>
      <div class="cb-status"><div class="cb-dot"></div><span>Online · AI Tourism Assistant</span></div>
    </div>
    <button class="cb-clear" onclick="cbClear()">🗑 Clear</button>
    <button class="cb-close" onclick="cbToggle()">✕</button>
  </div>
  <div class="cb-msgs" id="cb-msgs"></div>
  <div class="cb-chips" id="cb-chips"></div>
  <div class="cb-input-row">
    <textarea id="cb-input" rows="1" placeholder="Ask about Oman tours, destinations, tips…" onkeydown="cbKey(event)" oninput="cbResize(this)" maxlength="500"></textarea>
    <button id="cb-send" onclick="cbSend()">
      <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
    </button>
  </div>
  <div class="cb-footer-txt">Powered by Guideon AI · Ask anything about Oman 🌿</div>
</div>`);

    initChatbot();
  }

  function initChatbot() {
    const CB_KEY  = 'Guideon_bot_v1';
    const CHIPS   = ['🏜️ Best desert tour?','🕌 Top Muscat sights?','🗓️ Best time to visit?','🌊 Marine adventures?','💰 Budget trip tips?','أفضل وجهة في عُمان؟'];
    const WELCOME = "مرحباً! 👋 أنا **GuideonBot**، مساعدك السياحي الذكي لعُمان.\n\nHello! I'm your AI guide for Oman — ask me about tours, destinations, travel tips, or booking a guide. Let's plan your perfect Omani adventure! 🌿 🇴🇲";

    let msgs = [], open = false, busy = false;

    window.cbToggle = function () {
      open = !open;
      document.getElementById('chat-box').classList.toggle('open', open);
      document.getElementById('fab-icon-chat').style.display = open ? 'none' : 'block';
      document.getElementById('fab-icon-x').style.display    = open ? 'block' : 'none';
      if (open) { hideBadge(); setTimeout(() => { scrollEnd(false); document.getElementById('cb-input').focus(); }, 280); }
    };

    window.cbClear = function () {
      msgs = []; sessionStorage.removeItem(CB_KEY);
      document.getElementById('cb-msgs').innerHTML = '';
      document.getElementById('cb-chips').innerHTML = '';
      appendBot(WELCOME); showChips();
    };

    window.cbSend = async function () {
      const input = document.getElementById('cb-input');
      const text  = input.value.trim();
      if (!text || busy) return;
      input.value = ''; cbResize(input);
      document.getElementById('cb-chips').innerHTML = '';
      setBusy(true);
      msgs.push({ role: 'user', content: text });
      save();
      renderUser(text); scrollEnd();
      showTyping();
      try {
        const r = await fetch('/api/chat', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: msgs.slice(-14) }),
        });
        const d = await r.json();
        hideTyping();
        if (!r.ok) throw new Error(d.message || 'Error');
        appendBot(d.data.reply);
      } catch (err) {
        hideTyping();
        appendBot(err.message.toLowerCase().includes('limit')
          ? '⚠️ Chat limit reached (20/hour). Please try again later!\nتم الوصول للحد الأقصى (20 رسالة/ساعة). حاول لاحقاً!'
          : '😔 I\'m temporarily unavailable. Please try again in a moment.\nأنا غير متاح مؤقتاً. حاول مجدداً بعد لحظة.');
      } finally { setBusy(false); }
    };

    window.cbKey     = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); cbSend(); } };
    window.cbResize  = (el) => { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 90) + 'px'; };

    function appendBot(text) { msgs.push({ role: 'assistant', content: text }); save(); renderBot(text); scrollEnd(); if (!open) showBadge(); }
    function renderUser(text) { append('user', `<div class="cb-bubble">${esc(text)}</div><div class="cb-time">${time()}</div>`, '👤'); }
    function renderBot(text)  { append('bot',  `<div class="cb-bubble">${fmt(text)}</div><div class="cb-time">GuideonBot · ${time()}</div>`, '🌿'); }

    function append(role, inner, av) {
      const el = document.createElement('div');
      el.className = 'cb-msg ' + role;
      el.innerHTML = role === 'user'
        ? `<div>${inner}</div><div class="cb-msg-av">${av}</div>`
        : `<div class="cb-msg-av">${av}</div><div>${inner}</div>`;
      document.getElementById('cb-msgs').appendChild(el);
    }

    function showChips() {
      const el = document.getElementById('cb-chips');
      el.innerHTML = '';
      CHIPS.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'cb-chip'; btn.textContent = c;
        btn.onclick = () => { el.innerHTML = ''; document.getElementById('cb-input').value = c; cbSend(); };
        el.appendChild(btn);
      });
    }

    function showTyping() {
      const el = document.createElement('div');
      el.className = 'cb-msg bot'; el.id = 'cb-typing';
      el.innerHTML = `<div class="cb-msg-av">🌿</div><div class="cb-typing"><div class="cb-tdot"></div><div class="cb-tdot"></div><div class="cb-tdot"></div></div>`;
      document.getElementById('cb-msgs').appendChild(el); scrollEnd();
    }
    function hideTyping()  { const e = document.getElementById('cb-typing'); if (e) e.remove(); }
    function showBadge()   { document.getElementById('chat-fab').classList.add('has-badge'); }
    function hideBadge()   { document.getElementById('chat-fab').classList.remove('has-badge'); }
    function setBusy(on)   { busy = on; document.getElementById('cb-send').disabled = on; document.getElementById('cb-input').disabled = on; }
    function scrollEnd(s=true) { const el = document.getElementById('cb-msgs'); setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: s ? 'smooth' : 'instant' }), 50); }
    function save()        { sessionStorage.setItem(CB_KEY, JSON.stringify(msgs)); }
    function time()        { return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }); }
    function esc(s)        { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); }
    function fmt(s)        {
      return esc(s)
        .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,'<em>$1</em>')
        .replace(/`([^`]+)`/g,'<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:11px">$1</code>')
        .replace(/^#{1,3}\s(.+)$/gm,'<strong>$1</strong>')
        .replace(/&lt;br&gt;/g,'<br>');
    }

    // Boot
    const saved = sessionStorage.getItem(CB_KEY);
    if (saved) {
      try { msgs = JSON.parse(saved); msgs.forEach(m => { if (m.role === 'assistant') renderBot(m.content, false); else if (m.role === 'user') renderUser(m.content, false); }); if (msgs.length <= 1) showChips(); scrollEnd(false); return; } catch {}
    }
    appendBot(WELCOME); showChips();
    if (!open) showBadge();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
