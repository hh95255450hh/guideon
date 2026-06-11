/*
 * gd-messages.js — shared messaging engine for all dashboards.
 *
 * Why this exists:
 *   guide-dashboard.html, company-dashboard.html, and tourist-dashboard.html
 *   each carried ~200 lines of near-identical messaging code (SSE,
 *   conversations list, thread render, send, typing indicator,
 *   attachment upload). Three copies meant three places to fix every
 *   bug — and they had already drifted (different bubble sizes,
 *   different toast levels, different "empty thread" strings).
 *
 * What this gives back:
 *   A single factory `GDMessages(config)` that each dashboard
 *   instantiates with its own DOM-id prefix and a few knobs. The
 *   factory wires SSE, polling fallback, typing, attachments,
 *   send/receive, and read receipts.
 *
 * Required config fields:
 *   prefix      string  — DOM-id prefix used by the page
 *                         (e.g. 'msg' → expects #msgConvoList,
 *                         #msgThreadName, #msgThreadView, etc.)
 *   myId        string  — current user's id (for distinguishing
 *                         inbound vs outbound)
 *   tickClass   string  — CSS class on outbound-message read ticks
 *                         so the 'read' SSE event can upgrade them
 *   toast       (msg,lvl)=>void — page's toast function. `lvl` is
 *                         one of 'info' | 'success' | 'error'.
 *
 * Optional config fields:
 *   badgeId         string   — id of the unread-count badge
 *                              (defaults to `${prefix}UnreadBadge`)
 *   playBeep        bool     — play short ping on inbound (default true)
 *   bubbleMaxPx     number   — image attachment max side (default 200)
 *   convoEmptyHtml  string   — HTML when conversation list is empty
 *   threadEmptyHtml string   — HTML when an opened thread has 0 messages
 *   typingText      string   — what the typing indicator shows
 *   pollMs          number   — fallback poll cadence (default 9000)
 *   isOutbound      (m)=>bool — override mine/theirs decision; default
 *                              compares fromId to myId
 *
 * Public API (returned object):
 *   connectSSE(), loadConvos(), openThread(otherId, otherName),
 *   loadThread(), sendMsg(extra?), attach(inputEl), typing(),
 *   showConvoList(), contactSupport()
 */
(function () {
  'use strict';

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtTime(iso) {
    const d = new Date(iso);
    const diff = Date.now() - d;
    if (diff < 60000)    return '<1m';
    if (diff < 3600000)  return Math.floor(diff / 60000) + 'm';
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }

  function beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = 680;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
      o.start(); o.stop(ctx.currentTime + 0.3);
      setTimeout(() => ctx.close().catch(() => {}), 500);
    } catch (e) { /* audio not granted yet — silent */ }
  }

  function t(key, fallback) {
    if (window.I18N && typeof I18N.t === 'function') {
      const v = I18N.t(key);
      if (v && v !== key) return v;
    }
    return fallback;
  }

  function GDMessages(config) {
    if (!config || !config.prefix || !config.myId) {
      throw new Error('GDMessages: prefix and myId are required');
    }
    const P              = config.prefix;
    const MY_ID          = config.myId;
    const TICK_CLASS     = config.tickClass     || 't-tick';
    const TOAST          = config.toast         || function () {};
    const BADGE_ID       = config.badgeId       || (P + 'UnreadBadge');
    const PLAY_BEEP      = config.playBeep      !== false;
    const BUBBLE_MAX_PX  = config.bubbleMaxPx   || 200;
    const POLL_MS        = config.pollMs        || 9000;
    const TYPING_TEXT    = config.typingText    || t('msg_typing', 'typing…');
    const isOutbound     = config.isOutbound    || function (m) { return m.fromId === MY_ID; };

    // DOM helpers — every id is built from the configured prefix so
    // each dashboard owns its own message UI nodes.
    const id    = (suffix) => P + suffix;
    const $     = (suffix) => document.getElementById(id(suffix));

    let CONVOS          = [];
    let ACTIVE_OTHER_ID = null;
    let POLL            = null;
    let SSE             = null;
    let TYPING_TS       = 0;
    let TYPING_HIDE     = null;

    // ── SSE / realtime ──────────────────────────────────────────
    function connectSSE() {
      if (SSE) return;
      try {
        SSE = new EventSource('/api/messages/stream', { withCredentials: true });

        SSE.addEventListener('message', (e) => {
          let m; try { m = JSON.parse(e.data); } catch { return; }
          const otherId  = m.fromId === MY_ID ? m.toId : m.fromId;
          const incoming = m.toId === MY_ID;
          if (ACTIVE_OTHER_ID && otherId === ACTIVE_OTHER_ID) {
            loadThread();
            if (incoming && PLAY_BEEP) beep();
          } else {
            if (incoming && PLAY_BEEP) beep();
            loadConvos();
          }
        });

        SSE.addEventListener('typing', (e) => {
          let payload; try { payload = JSON.parse(e.data); } catch { return; }
          if (ACTIVE_OTHER_ID && payload.fromId === ACTIVE_OTHER_ID) showTyping(payload.isTyping);
        });

        SSE.addEventListener('read', () => {
          // Other side opened the thread → upgrade my ✓ ticks to ✓✓
          document.querySelectorAll('.' + TICK_CLASS).forEach((el) => {
            el.textContent = '✓✓';
            el.style.color = '#bfe3ff';
          });
        });
      } catch (e) { /* SSE blocked → polling still covers us */ }
    }

    // ── Typing indicator ────────────────────────────────────────
    function showTyping(on) {
      const el = $('Typing'); if (!el) return;
      clearTimeout(TYPING_HIDE);
      if (on) {
        el.textContent   = TYPING_TEXT;
        el.style.display = '';
        TYPING_HIDE = setTimeout(() => { el.style.display = 'none'; }, 4000);
      } else {
        el.style.display = 'none';
      }
    }

    function typing() {
      if (!ACTIVE_OTHER_ID) return;
      const now = Date.now();
      if (now - TYPING_TS < 2500) return;  // throttle: at most one ping / 2.5s
      TYPING_TS = now;
      fetch('/api/messages/typing', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toId: ACTIVE_OTHER_ID, isTyping: true }),
      }).catch(() => {});
    }

    // ── Attachment upload ───────────────────────────────────────
    async function attach(inp) {
      const file = inp.files && inp.files[0];
      inp.value = '';
      if (!file || !ACTIVE_OTHER_ID) return;
      if (file.size > 10 * 1024 * 1024) {
        TOAST(t('attach_too_big', 'Max 10 MB'), 'error');
        return;
      }
      TOAST(t('uploading', 'Uploading…'), 'info');
      try {
        const fd = new FormData(); fd.append('file', file);
        const ur = await fetch('/api/upload/message-attachment', {
          method: 'POST', credentials: 'include', body: fd,
        });
        const ud = await ur.json();
        if (!ur.ok || !ud.success) throw new Error(ud.message || 'Upload failed');
        await sendMsg({ attachmentUrl: ud.url, attachmentType: 'image', attachmentName: ud.name });
      } catch (e) {
        TOAST(e.message || 'Upload failed', 'error');
      }
    }

    // ── Conversation list ──────────────────────────────────────
    async function loadConvos() {
      try {
        const r = await fetch('/api/messages/conversations', { credentials: 'include' });
        const d = await r.json();
        CONVOS = d.conversations || [];
        renderConvos();
        updateBadge();
      } catch (e) { /* swallow — UI keeps prior state */ }
    }

    function renderConvos() {
      const el = $('ConvoList'); if (!el) return;
      if (!CONVOS.length) {
        el.innerHTML = config.convoEmptyHtml
          || `<div class="text-center py-3 text-muted small">${
               escHtml(t('msg_no_convos', 'No conversations yet.'))
             }</div>`;
        return;
      }
      el.innerHTML = CONVOS.map((c) => {
        const last       = c.lastMessage || {};
        const rawPreview = last.content
          || (last.attachmentType ? '📷 ' + t('image', 'image') : '');
        const preview    = rawPreview.length > 50 ? rawPreview.slice(0, 50) + '…' : rawPreview;
        const time       = fmtTime(last.createdAt);
        const unread     = c.unread > 0 ? `<span class="badge bg-danger ms-1">${c.unread}</span>` : '';
        const nm         = c.otherName || '؟';
        const nameJson   = JSON.stringify(nm).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        return `<button class="list-group-item list-group-item-action d-flex align-items-center gap-3 py-2"
          onclick="${P}_inst.openThread('${escHtml(c.otherId)}', ${nameJson})">
          <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
            style="width:38px;height:38px;background:#e2f0ee;color:var(--teal,#0f7b6c);font-weight:700">
            ${escHtml(nm.charAt(0).toUpperCase())}
          </div>
          <div class="flex-grow-1 text-start" style="min-width:0">
            <div class="d-flex justify-content-between">
              <span class="fw-600 small">${escHtml(nm)}${unread}</span>
              <span class="text-muted" style="font-size:.72rem">${time}</span>
            </div>
            <div class="text-muted text-truncate" style="font-size:.8rem">${escHtml(preview)}</div>
          </div>
        </button>`;
      }).join('');
    }

    function updateBadge() {
      const total = CONVOS.reduce((s, c) => s + (c.unread || 0), 0);
      const b = document.getElementById(BADGE_ID);
      if (!b) return;
      if (total > 0) { b.textContent = total; b.style.display = ''; }
      else b.style.display = 'none';
    }

    // ── Thread view ────────────────────────────────────────────
    async function openThread(otherId, otherName) {
      ACTIVE_OTHER_ID = otherId;
      const nameEl = $('ThreadName');
      if (nameEl) nameEl.textContent = otherName || '…';
      const typingEl = $('Typing');     if (typingEl) typingEl.style.display = 'none';
      const convoView = $('ConvoView'); if (convoView) convoView.style.display = 'none';
      const threadV   = $('ThreadView'); if (threadV)  threadV.style.display = '';
      await loadThread();
      clearInterval(POLL);
      POLL = setInterval(loadThread, POLL_MS);
    }

    function showConvoList() {
      clearInterval(POLL);
      ACTIVE_OTHER_ID = null;
      const threadV   = $('ThreadView'); if (threadV)  threadV.style.display = 'none';
      const convoView = $('ConvoView');  if (convoView) convoView.style.display = '';
      loadConvos();
    }

    async function loadThread() {
      if (!ACTIVE_OTHER_ID) return;
      try {
        const r = await fetch(`/api/messages/thread/${encodeURIComponent(ACTIVE_OTHER_ID)}`, {
          credentials: 'include',
        });
        const d = await r.json();
        renderThread(d.messages || []);
        const dot = $('Online');
        if (dot) dot.style.display = d.online ? '' : 'none';
        // Deep-link case: header still '…' → take the name from the first inbound message
        const nameEl = $('ThreadName');
        if (nameEl && nameEl.textContent === '…') {
          const inbound = (d.messages || []).find((m) => m.fromId === ACTIVE_OTHER_ID);
          if (inbound && inbound.fromName) nameEl.textContent = inbound.fromName;
        }
        updateBadge();
      } catch (e) { /* network blip — next poll retries */ }
    }

    function renderThread(msgs) {
      const el = $('ThreadMessages'); if (!el) return;
      const wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
      if (!msgs.length) {
        el.innerHTML = config.threadEmptyHtml
          || `<div class="text-center text-muted small mt-auto pt-4">${
               escHtml(t('msg_empty', 'Start the conversation 👋'))
             }</div>`;
        return;
      }
      let lastDay = '';
      el.innerHTML = msgs.map((m) => {
        const mine  = isOutbound(m);
        const align = mine
          ? 'align-self:flex-end;background:var(--teal,#0f7b6c);color:#fff'
          : 'align-self:flex-start;background:#fff;border:1px solid #e5e7eb';

        // Date separator: only on the first message of each day
        const day = new Date(m.createdAt).toLocaleDateString([], {
          day: 'numeric', month: 'short', year: 'numeric',
        });
        let sep = '';
        if (day !== lastDay) {
          lastDay = day;
          sep = `<div style="align-self:center;font-size:.68rem;color:#9aa3ab;background:#eef1f3;padding:1px 9px;border-radius:10px;margin:4px 0">${escHtml(day)}</div>`;
        }

        // Attachment (image or file) then optional text
        let body = '';
        if (m.attachmentUrl && m.attachmentType === 'image') {
          body += `<a href="${escHtml(m.attachmentUrl)}" target="_blank" rel="noopener"><img src="${escHtml(m.attachmentUrl)}" alt="image" style="max-width:${BUBBLE_MAX_PX}px;max-height:${BUBBLE_MAX_PX}px;border-radius:9px;display:block;margin-bottom:${m.content ? '4px' : '0'}"></a>`;
        } else if (m.attachmentUrl) {
          body += `<a href="${escHtml(m.attachmentUrl)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">📎 ${escHtml(m.attachmentName || 'file')}</a>`;
        }
        if (m.content) body += `<div style="font-size:.92rem">${escHtml(m.content)}</div>`;

        const tick = mine
          ? `<span class="${TICK_CLASS}" style="margin-inline-start:5px;${m.isRead ? 'color:#bfe3ff' : ''}">${m.isRead ? '✓✓' : '✓'}</span>`
          : '';

        return `${sep}<div style="max-width:78%;padding:8px 12px;border-radius:14px;${align}">
          ${body}
          <div style="font-size:.72rem;opacity:.7;margin-top:2px;text-align:${mine ? 'right' : 'left'}">${fmtTime(m.createdAt)}${tick}</div>
        </div>`;
      }).join('');
      if (wasAtBottom) el.scrollTop = el.scrollHeight;
    }

    // ── Send + support ─────────────────────────────────────────
    async function sendMsg(extra) {
      const input   = $('Input');
      const content = input ? (input.value || '').trim() : '';
      const payload = { toId: ACTIVE_OTHER_ID, content, ...(extra || {}) };
      if ((!content && !payload.attachmentUrl) || !ACTIVE_OTHER_ID) return;
      if (input) input.value = '';
      try {
        const r = await fetch('/api/messages', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error();
        await loadThread();
      } catch {
        TOAST(t('msg_send_fail', 'Could not send'), 'error');
      }
    }

    async function contactSupport() {
      try {
        const r = await fetch('/api/messages/support-agent', { credentials: 'include' });
        const d = await r.json();
        if (!d.success) throw new Error(d.message || 'Support unavailable');
        const lang = window.I18N && I18N.lang;
        const name = lang === 'ar' ? (d.agent.nameAr || d.agent.name) : d.agent.name;
        openThread(d.agent.id, name);
      } catch (e) {
        TOAST(e.message || 'Could not reach support', 'error');
      }
    }

    // Enter-to-send on the dedicated input
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && document.activeElement && document.activeElement.id === id('Input')) {
        sendMsg();
      }
    });

    const api = {
      connectSSE, loadConvos, openThread, loadThread,
      sendMsg, attach, typing, showConvoList, contactSupport,
      // Exposed for callers that need to re-render after locale / data
      // changes (e.g. window.onLangChange) without round-tripping the API.
      renderConvos, renderThread: (msgs) => renderThread(msgs || []),
    };

    // Expose `${prefix}_inst` globally so the inline onclick we render in
    // renderConvos() can find this instance no matter how the page
    // imported the module.
    window[P + '_inst'] = api;

    return api;
  }

  window.GDMessages = GDMessages;
})();
