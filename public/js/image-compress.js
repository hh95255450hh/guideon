/**
 * image-compress.js — shrink an image in the browser BEFORE uploading.
 *
 * Modern phone photos are 5–15 MB. Sending them raw over a mobile data
 * connection is the #1 reason "upload is slow / fails". This helper
 * decodes the image, draws it onto a canvas at a sensible cap (2000 px
 * on the longest side), and re-encodes it as JPEG at quality 0.85 —
 * typically a 5–15× size reduction with no visible quality loss.
 *
 * Use it as a drop-in:
 *
 *     const small = await window.gdCompressImage(file);
 *     fd.append('photo', small, small.name);
 *
 * Falls back to the original File on any failure so callers never break.
 */
(function () {
  if (window.gdCompressImage) return;

  // Tighter defaults — Supabase egress was the bottleneck, not Storage size.
  // Even 1400 px is enough for full-bleed hero images on a 5" phone.
  const DEFAULT_MAX_DIM   = 1400;   // longest edge (px)
  const DEFAULT_QUALITY   = 0.80;
  const DEFAULT_TARGET_KB = 600;    // try to land under ~600 KB
  const HARD_CAP_KB       = 4000;   // never send anything bigger than 4 MB

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(new Error('Image could not be decoded')); };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob(b => resolve(b), type, quality));
  }

  async function compress(file, opts = {}) {
    const max     = opts.maxDim   || DEFAULT_MAX_DIM;
    const quality = opts.quality  || DEFAULT_QUALITY;
    const targetKB = opts.targetKB || DEFAULT_TARGET_KB;

    // Not an image, or animated GIF → don't touch it.
    if (!file || !file.type || !file.type.startsWith('image/')) return file;
    if (file.type === 'image/gif') return file;
    // Already small enough → skip the work.
    if (file.size <= targetKB * 1024) return file;

    try {
      const img = await loadImage(file);
      const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth  * ratio);
      const h = Math.round(img.naturalHeight * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      // White background for transparent PNGs converted to JPEG
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      // Walk quality down until we beat the target, or give up.
      let q = quality, blob = null;
      for (let i = 0; i < 4; i++) {
        blob = await canvasToBlob(canvas, 'image/jpeg', q);
        if (!blob) break;
        if (blob.size <= targetKB * 1024) break;
        if (blob.size > HARD_CAP_KB * 1024) q -= 0.15;
        else q -= 0.07;
        if (q < 0.4) break;
      }
      if (!blob) return file;

      // Name it consistently and as JPEG so the server picks the right preset.
      const baseName = (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg';
      const out = new File([blob], baseName, { type: 'image/jpeg', lastModified: Date.now() });
      // If compression somehow made it bigger (rare on already-tiny inputs), keep original.
      return out.size < file.size ? out : file;
    } catch (e) {
      console.warn('[gdCompressImage] fallback to original:', e.message);
      return file;
    }
  }

  window.gdCompressImage = compress;

  /**
   * Global fetch interceptor — when ANY upload endpoint receives an
   * image File, transparently shrink it first. This means every old
   * upload helper across the app (profile photo, gallery, message
   * attachments, tour package gallery, …) gets the speed-up for free,
   * without touching their code.
   *
   * Only acts on:
   *  - POST requests to /api/upload/* OR /api/auth/upload-photo
   *  - FormData bodies
   *  - Fields named photo / file / image that contain an image File
   */
  const UPLOAD_PATHS = /\/api\/upload\/|\/api\/auth\/upload-photo|\/api\/reviews\/upload-photo/;
  const PRESET_BY_PATH = [
    [/\/upload\/photo/,              { maxDim: 500,  targetKB: 150 }], // avatars — rendered ≤110 px
    [/\/upload\/gallery/,            { maxDim: 1200, targetKB: 500 }],
    [/\/upload\/image/,              { maxDim: 1400, targetKB: 500 }],
    [/\/upload\/message-attachment/, { maxDim: 1000, targetKB: 350 }],
    [/upload-photo/,                 { maxDim: 500,  targetKB: 150 }],
  ];
  function presetFor(url) {
    for (const [rx, opts] of PRESET_BY_PATH) if (rx.test(url)) return opts;
    return { maxDim: 1800, targetKB: 800 };
  }

  const origFetch = window.fetch.bind(window);
  window.fetch = async function (resource, init) {
    try {
      const url    = typeof resource === 'string' ? resource : (resource && resource.url) || '';
      const method = (init && init.method) || 'GET';
      if (UPLOAD_PATHS.test(url) && /post/i.test(method) && init && init.body instanceof FormData) {
        const opts = presetFor(url);
        const fd   = init.body;
        const newFd = new FormData();
        // Walk every entry, compressing image File entries only.
        for (const [k, v] of fd.entries()) {
          if (v instanceof File && v.type && v.type.startsWith('image/') && v.type !== 'image/gif') {
            try {
              const small = await compress(v, opts);
              newFd.append(k, small, small.name || v.name);
            } catch { newFd.append(k, v); }
          } else {
            newFd.append(k, v);
          }
        }
        init = { ...init, body: newFd };
      }
    } catch (e) { /* never break the original request */ }
    return origFetch(resource, init);
  };
})();
