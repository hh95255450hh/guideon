/**
 * Notification bell — auto-injects a 🔔 button + dropdown into the navbar
 * for any page that loads this script AFTER the user is signed in.
 *
 * Polls /api/notifications every 30 seconds for unread count.
 */
(function () {
  'use strict';

  const POLL_INTERVAL = 30000;
  let isOpen = false;

  // ─── Inject CSS ────────────────────────────────────────────────────────
  const css = `
    .gd-bell-wrap { position: relative; display: inline-block; }
    .gd-bell-btn {
      background: transparent; border: 1px solid rgba(255,255,255,0.35);
      color: #fff; width: 36px; height: 36px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      cursor: pointer; transition: .15s; font-size: 1.05rem;
      position: relative;
    }
    .gd-bell-btn:hover { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.6); }
    .gd-bell-badge {
      position: absolute; top: -4px; right: -4px;
      background: #ef4444; color: #fff; border-radius: 10px;
      min-width: 18px; height: 18px; padding: 0 5px;
      font-size: .68rem; font-weight: 800; line-height: 18px;
      text-align: center; border: 2px solid var(--navy-dark, #0f1c3e);
      display: none;
    }
    .gd-bell-badge.show { display: inline-block; }

    .gd-bell-panel {
      position: absolute; top: calc(100% + 8px); right: 0;
      width: 360px; max-width: 92vw;
      background: #fff; color: #1a1a2e;
      border-radius: 14px;
      box-shadow: 0 12px 36px rgba(0,0,0,0.18);
      border: 1px solid #e5e7eb;
      z-index: 9999;
      max-height: 480px;
      overflow: hidden;
      display: flex; flex-direction: column;
      animation: gdBellFade .18s ease;
    }
    html[dir="rtl"] .gd-bell-panel { right: auto; left: 0; }
    @keyframes gdBellFade { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

    .gd-bell-header {
      padding: 14px 18px; border-bottom: 1px solid #e5e7eb;
      display: flex; justify-content: space-between; align-items: center;
      flex-shrink: 0;
    }
    .gd-bell-header h6 { margin: 0; font-weight: 800; color: #0f1c3e; font-size: 1rem; }
    .gd-bell-mark-all {
      background: none; border: none; color: #0f7b6c;
      font-size: .8rem; font-weight: 600; cursor: pointer; padding: 4px 8px;
      border-radius: 6px;
    }
    .gd-bell-mark-all:hover { background: #e8f5f0; }
    .gd-bell-mark-all:disabled { color: #aaa; cursor: not-allowed; }

    .gd-bell-list { overflow-y: auto; flex: 1; }
    .gd-bell-item {
      display: flex; gap: 12px; padding: 12px 18px;
      border-bottom: 1px solid #f0f0f0;
      cursor: pointer; transition: background .15s;
    }
    .gd-bell-item:hover { background: #f8faf9; }
    .gd-bell-item:last-child { border-bottom: none; }
    .gd-bell-item.unread { background: #f0faf8; }
    .gd-bell-item.unread:hover { background: #e8f5f0; }
    .gd-bell-icon { font-size: 1.4rem; flex-shrink: 0; line-height: 1.4; }
    .gd-bell-content { flex: 1; min-width: 0; }
    .gd-bell-title { font-weight: 700; font-size: .9rem; color: #1a1a2e; margin-bottom: 2px; }
    .gd-bell-body { font-size: .82rem; color: #555; line-height: 1.45;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden; }
    .gd-bell-time { font-size: .72rem; color: #999; margin-top: 4px; }
    .gd-bell-dot { width: 8px; height: 8px; background: #0f7b6c; border-radius: 50%; flex-shrink: 0; margin-top: 6px; }
    .gd-bell-empty {
      text-align: center; padding: 40px 20px; color: #888; font-size: .9rem;
    }
    .gd-bell-empty .ico { font-size: 2.4rem; margin-bottom: 8px; opacity: .5; }

    .gd-bell-footer {
      padding: 10px 18px; border-top: 1px solid #e5e7eb;
      text-align: center; flex-shrink: 0;
    }
    .gd-bell-footer a { color: #0f7b6c; font-size: .82rem; font-weight: 600; text-decoration: none; }

    @media (max-width: 576px) {
      .gd-bell-panel { width: 92vw; right: -8px; }
      html[dir="rtl"] .gd-bell-panel { left: -8px; right: auto; }
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ─── Build the bell ────────────────────────────────────────────────────
  function buildBell() {
    if (document.querySelector('.gd-bell-wrap')) return null;

    const wrap = document.createElement('div');
    wrap.className = 'gd-bell-wrap';
    wrap.innerHTML = `
      <button class="gd-bell-btn" id="gdBellBtn" title="Notifications" aria-label="Notifications">
        🔔<span class="gd-bell-badge" id="gdBellBadge">0</span>
      </button>
      <div class="gd-bell-panel" id="gdBellPanel" style="display:none">
        <div class="gd-bell-header">
          <h6 id="gdBellHeading">Notifications</h6>
          <button class="gd-bell-mark-all" id="gdMarkAll">Mark all read</button>
        </div>
        <div class="gd-bell-list" id="gdBellList">
          <div class="gd-bell-empty"><div class="ico">⏳</div>Loading…</div>
        </div>
      </div>
    `;
    return wrap;
  }

  // Try several common spots in the navbar to inject the bell.
  function inject() {
    const wrap = buildBell();
    if (!wrap) return;

    const candidates = [
      document.querySelector('#navUser'),                  // index.html
      document.querySelector('.navbar-controls'),
      document.querySelector('.navbar .ms-auto'),
      document.querySelector('nav.navbar .container > *:last-child'),
    ].filter(Boolean);

    const host = candidates[0];
    if (!host) return;

    // Insert as first child so it sits on the left of dashboard/signout
    host.insertBefore(wrap, host.firstChild);

    wireEvents();
  }

  function wireEvents() {
    const btn   = document.getElementById('gdBellBtn');
    const panel = document.getElementById('gdBellPanel');
    const mark  = document.getElementById('gdMarkAll');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      isOpen = !isOpen;
      panel.style.display = isOpen ? 'flex' : 'none';
      if (isOpen) loadList();
    });

    document.addEventListener('click', (e) => {
      if (isOpen && !e.target.closest('.gd-bell-wrap')) {
        isOpen = false;
        panel.style.display = 'none';
      }
    });

    mark.addEventListener('click', async () => {
      mark.disabled = true;
      try {
        await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' });
        updateBadge(0);
        await loadList();
      } catch (e) {}
      mark.disabled = false;
    });
  }

  // ─── Poll for unread count ─────────────────────────────────────────────
  async function pollUnread() {
    try {
      const r = await fetch('/api/notifications/unread-count', { credentials: 'include' });
      if (!r.ok) return;
      const d = await r.json();
      if (d.success !== false) updateBadge(d.unread || 0);
    } catch (e) {}
  }

  function updateBadge(n) {
    const badge = document.getElementById('gdBellBadge');
    if (!badge) return;
    if (n > 0) {
      badge.textContent = n > 99 ? '99+' : String(n);
      badge.classList.add('show');
    } else {
      badge.classList.remove('show');
    }
  }

  // ─── Load full list when panel opens ───────────────────────────────────
  async function loadList() {
    const list = document.getElementById('gdBellList');
    list.innerHTML = '<div class="gd-bell-empty"><div class="ico">⏳</div>Loading…</div>';
    try {
      const r = await fetch('/api/notifications', { credentials: 'include' });
      if (!r.ok) {
        list.innerHTML = '<div class="gd-bell-empty"><div class="ico">🔒</div>Sign in to see notifications</div>';
        return;
      }
      const d = await r.json();
      const items = d.notifications || [];
      if (items.length === 0) {
        list.innerHTML = '<div class="gd-bell-empty"><div class="ico">📭</div>No notifications yet</div>';
        return;
      }
      list.innerHTML = items.map(n => `
        <a class="gd-bell-item ${n.isRead ? '' : 'unread'}" href="${n.link || '#'}" data-id="${n.id}">
          <span class="gd-bell-icon">${escapeHtml(n.icon || '🔔')}</span>
          <div class="gd-bell-content">
            <div class="gd-bell-title">${escapeHtml(n.title || '')}</div>
            <div class="gd-bell-body">${escapeHtml(n.body || '')}</div>
            <div class="gd-bell-time">${timeAgo(n.createdAt)}</div>
          </div>
          ${n.isRead ? '' : '<div class="gd-bell-dot"></div>'}
        </a>
      `).join('');

      // Mark item as read when clicked
      list.querySelectorAll('.gd-bell-item').forEach(item => {
        item.addEventListener('click', async (e) => {
          const id = item.dataset.id;
          if (!item.classList.contains('unread')) return;
          try { await fetch('/api/notifications/' + id + '/read', { method: 'POST', credentials: 'include' }); } catch (e) {}
        });
      });

      updateBadge(d.unread || 0);
    } catch (e) {
      list.innerHTML = '<div class="gd-bell-empty"><div class="ico">⚠️</div>Failed to load</div>';
    }
  }

  function escapeHtml(s) {
    return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function timeAgo(ts) {
    if (!ts) return '';
    const t = new Date(ts).getTime();
    const diff = Date.now() - t;
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24);
    if (d < 7) return d + 'd ago';
    return new Date(ts).toLocaleDateString();
  }

  // ─── Check session, then inject ────────────────────────────────────────
  async function init() {
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include' });
      if (!r.ok) return; // not signed in — don't show bell
      inject();
      pollUnread();
      setInterval(pollUnread, POLL_INTERVAL);
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
