/**
 * gd-video-upload.js — reusable "upload a video" control.
 *
 * GdVideoUpload.mount(container, {
 *   initialUrl: 'https://…',          // existing video (optional)
 *   onChange: function(url){ … }      // called with the new URL ('' on remove)
 * });
 *
 * Shows the upload conditions (formats + max size + recommendation) and the
 * selected file's size, validates client-side, then uploads to
 * /api/upload/video-file with a progress bar. Self-contained styles.
 */
(function () {
  if (window.GdVideoUpload) return;

  var MAX_MB = 50;
  var EXTS = ['.mp4', '.webm', '.mov', '.m4v', '.ogg'];
  var isAr = function () { return (document.documentElement.lang || 'ar').indexOf('ar') === 0; };
  var t = function (ar, en) { return isAr() ? ar : en; };
  var fmtSize = function (b) {
    if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
    return Math.max(1, Math.round(b / 1024)) + ' KB';
  };
  var safe = function (u) { return (window.gdSafeUrl ? window.gdSafeUrl(u) : String(u || '')); };

  function injectStyles() {
    if (document.getElementById('gd-vu-styles')) return;
    var s = document.createElement('style');
    s.id = 'gd-vu-styles';
    s.textContent = `
.gd-vu{border:1px dashed #cfd8e3;border-radius:12px;padding:14px;background:#f8fafc}
.gd-vu-btn{display:inline-flex;align-items:center;gap:8px;background:#0f7b6c;color:#fff;border:0;
  border-radius:10px;padding:9px 16px;font-weight:600;font-size:.9rem;cursor:pointer;transition:.2s}
.gd-vu-btn:hover{background:#0a5c50}
.gd-vu-req{font-size:.78rem;color:#64748b;margin-top:8px;line-height:1.6}
.gd-vu-req b{color:#0f7b6c}
.gd-vu-file{font-size:.82rem;color:#334155;margin-top:8px}
.gd-vu-bar{height:6px;background:#e2e8f0;border-radius:6px;overflow:hidden;margin-top:8px;display:none}
.gd-vu-bar>i{display:block;height:100%;width:0;background:#0f7b6c;transition:width .15s ease}
.gd-vu-prev{margin-top:10px;display:none}
.gd-vu-prev video{width:100%;max-height:240px;border-radius:10px;background:#000;display:block}
.gd-vu-remove{margin-top:8px;background:transparent;border:1px solid #ef4444;color:#ef4444;border-radius:8px;
  padding:5px 12px;font-size:.8rem;cursor:pointer}
.gd-vu-remove:hover{background:#ef4444;color:#fff}
.gd-vu-err{color:#ef4444;font-size:.8rem;margin-top:6px}`;
    document.head.appendChild(s);
  }

  function mount(container, opts) {
    if (!container) return;
    opts = opts || {};
    injectStyles();
    var url = opts.initialUrl || '';

    container.classList.add('gd-vu');
    container.innerHTML =
      '<button type="button" class="gd-vu-btn">🎬 ' + t('ارفع فيديو من جهازك', 'Upload a video') + '</button>' +
      '<input type="file" accept="video/*,.mp4,.webm,.mov,.m4v" style="display:none">' +
      '<div class="gd-vu-req">📋 <b>' + t('الشروط', 'Requirements') + ':</b> ' +
        t('صيغة MP4 أو WebM أو MOV · الحجم الأقصى <b>' + MAX_MB + ' ميغابايت</b> · يُفضّل فيديو أفقي قصير (حتى دقيقة) بدقّة 720p.',
          'MP4, WebM or MOV · max <b>' + MAX_MB + ' MB</b> · a short landscape clip (≤1 min, 720p) is recommended.') +
      '</div>' +
      '<div class="gd-vu-file"></div>' +
      '<div class="gd-vu-bar"><i></i></div>' +
      '<div class="gd-vu-err"></div>' +
      '<div class="gd-vu-prev"><video controls preload="metadata"></video>' +
        '<button type="button" class="gd-vu-remove">🗑 ' + t('إزالة الفيديو', 'Remove video') + '</button></div>';

    var input  = container.querySelector('input');
    var btn    = container.querySelector('.gd-vu-btn');
    var fileEl = container.querySelector('.gd-vu-file');
    var bar    = container.querySelector('.gd-vu-bar');
    var barI   = container.querySelector('.gd-vu-bar > i');
    var errEl  = container.querySelector('.gd-vu-err');
    var prev   = container.querySelector('.gd-vu-prev');
    var video  = container.querySelector('.gd-vu-prev video');

    function showPreview(u) {
      if (u) { video.src = safe(u); prev.style.display = 'block'; }
      else { video.removeAttribute('src'); prev.style.display = 'none'; }
    }
    showPreview(url);

    btn.onclick = function () { errEl.textContent = ''; input.click(); };

    container.querySelector('.gd-vu-remove').onclick = function () {
      url = ''; fileEl.textContent = ''; showPreview('');
      if (opts.onChange) opts.onChange('');
    };

    input.onchange = function () {
      var f = input.files && input.files[0];
      if (!f) return;
      errEl.textContent = '';
      var ext = (f.name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
      var okType = EXTS.indexOf(ext) !== -1 || (f.type || '').indexOf('video/') === 0;
      if (!okType) { errEl.textContent = t('صيغة غير مدعومة. استخدم MP4 أو WebM أو MOV.', 'Unsupported format — use MP4, WebM or MOV.'); input.value=''; return; }
      // live size readout
      fileEl.innerHTML = '🎞️ ' + (window.gdEsc ? gdEsc(f.name) : f.name) + ' — <b>' + fmtSize(f.size) + '</b>';
      if (f.size > MAX_MB * 1048576) {
        errEl.textContent = t('حجم الفيديو ' + fmtSize(f.size) + ' أكبر من الحدّ (' + MAX_MB + ' ميغابايت).',
                              'Video is ' + fmtSize(f.size) + ' — over the ' + MAX_MB + ' MB limit.');
        input.value = ''; return;
      }
      upload(f);
    };

    function upload(f) {
      var fd = new FormData();
      fd.append('video', f);
      bar.style.display = 'block'; barI.style.width = '0%'; btn.disabled = true;
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload/video-file', true);
      xhr.withCredentials = true;
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) barI.style.width = Math.round((e.loaded / e.total) * 100) + '%';
      };
      xhr.onload = function () {
        btn.disabled = false; bar.style.display = 'none';
        var d = {}; try { d = JSON.parse(xhr.responseText); } catch (_) {}
        if (xhr.status >= 200 && xhr.status < 300 && d.success && d.url) {
          url = d.url; showPreview(url);
          if (opts.onChange) opts.onChange(url);
        } else {
          errEl.textContent = d.message || t('تعذّر رفع الفيديو. حاول مجدداً.', 'Upload failed. Please try again.');
        }
        input.value = '';
      };
      xhr.onerror = function () {
        btn.disabled = false; bar.style.display = 'none';
        errEl.textContent = t('تعذّر الاتصال. حاول مجدداً.', 'Connection error. Please try again.');
      };
      xhr.send(fd);
    }

    return { get url() { return url; }, set: function (u) { url = u || ''; showPreview(url); } };
  }

  window.GdVideoUpload = { mount: mount };
})();
