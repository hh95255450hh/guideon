/* Ministry of Heritage and Tourism support letter — shared trust blocks.
 *
 *   <div data-mht="strip"></div>     one-line strip (home page)
 *   <div data-mht="section"></div>   full section with quote (about page)
 *
 * Wording follows the letter itself: support and encouragement, never
 * "accredited" or "licensed" — the letter says explicitly it is neither.
 * Text follows <html lang>, so i18n's live EN↔AR switch re-renders it.
 */
(function () {
  if (window.__gdMht) return;
  window.__gdMht = true;

  var IMG = '/img/mht-support-letter.webp';
  var THUMB = '/img/mht-support-letter-thumb.webp';
  var TXT = {
    ar: {
      stripTitle: 'بدعم وتشجيع من وزارة التراث والسياحة',
      stripSub: 'مبادرة رقمية وطنية لتطوير خدمات الإرشاد السياحي في سلطنة عُمان',
      view: 'اطّلع على الخطاب ←',
      title: 'ثقة وطنية بمبادرتنا',
      body: 'تفخر Guideon بتلقّيها خطاب دعم وتشجيع من وزارة التراث والسياحة، ضمن دعم الوزارة للمبادرات الوطنية التي تسهم في تعزيز التحول الرقمي وتطوير الخدمات السياحية، بما يواكب مستهدفات رؤية عُمان 2040.',
      quote: '«تثمّن الوزارة المبادرة المقدّمة… لتطوير منصة رقمية لحجز خدمات المرشدين السياحيين المرخّصين، لما من شأنها الإسهام في تنظيم خدمات الإرشاد السياحي وتيسير الوصول إليها من خلال الحلول الرقمية.»',
      cite: '— وزارة التراث والسياحة، يوليو 2026',
      close: 'هذا الدعم يحمّلنا مسؤولية أكبر: أن نقدّم للسائح تجربة موثوقة، وللمرشد العُماني منصة تليق بخبرته.',
      note: '* خطاب دعم وتشجيع، ولا يُعد اعتماداً أو ترخيصاً للمنصة أو خدماتها.',
      full: '📄 عرض الخطاب كاملاً',
      alt: 'خطاب دعم وتشجيع من وزارة التراث والسياحة إلى Guideon',
      x: 'إغلاق',
    },
    en: {
      stripTitle: 'Supported & encouraged by the Ministry of Heritage and Tourism',
      stripSub: "A national digital initiative advancing tour-guiding services in Oman",
      view: 'View the letter →',
      title: 'A national vote of confidence',
      body: "Guideon is proud to have received a letter of support and encouragement from the Ministry of Heritage and Tourism, as part of the Ministry's backing for national initiatives that advance digital transformation and tourism services in line with Oman Vision 2040.",
      quote: '"The Ministry values the initiative… to develop a digital platform for booking licensed tour-guide services, contributing to the organisation of tour-guiding services and easier access to them through digital solutions."',
      cite: '— Ministry of Heritage and Tourism, July 2026',
      close: "This support raises our responsibility: a trusted experience for every traveller, and a platform worthy of Oman's guides.",
      note: '* A letter of support and encouragement; it does not constitute accreditation or licensing of the platform or its services.',
      full: '📄 View the full letter',
      alt: 'Letter of support and encouragement from the Ministry of Heritage and Tourism to Guideon',
      x: 'Close',
    },
  };

  var CSS = '' +
    '.mht-strip{max-width:1100px;margin:28px auto 0;padding:0 16px}' +
    '.mht-strip a{display:flex;align-items:center;gap:16px;padding:16px 22px;border-radius:18px;text-decoration:none;color:#0f1c3e;' +
      'background:linear-gradient(135deg,#fffaf0,#f5efe0);border:1px solid #e8dcc0;box-shadow:0 6px 24px rgba(15,28,62,.06);transition:transform .2s,box-shadow .2s}' +
    '.mht-strip a:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(15,28,62,.1)}' +
    '.mht-ico{flex-shrink:0;width:48px;height:48px;border-radius:14px;display:grid;place-items:center;font-size:1.5rem;background:#fff;border:1px solid #e8dcc0}' +
    '.mht-strip b{display:block;font-weight:800;font-size:1.02rem}' +
    '.mht-strip small{display:block;opacity:.75;font-size:.88rem;margin-top:2px}' +
    '.mht-go{margin-inline-start:auto;flex-shrink:0;font-weight:800;font-size:.88rem;color:#b07d1a;white-space:nowrap}' +
    '@media(max-width:640px){.mht-strip a{flex-wrap:wrap;gap:12px}.mht-go{margin-inline-start:64px}}' +
    '.mht-sec{display:grid;grid-template-columns:200px 1fr;gap:28px;align-items:start;margin:40px 0;padding:28px;border-radius:22px;' +
      'background:linear-gradient(135deg,#fffaf0,#f5efe0);border:1px solid #e8dcc0}' +
    '.mht-sec h2{margin-top:0!important}' +
    '.mht-thumb{display:block;border:0;padding:0;background:none;cursor:zoom-in;border-radius:10px;overflow:hidden;box-shadow:0 10px 30px rgba(15,28,62,.18);transform:rotate(-1.5deg);transition:transform .25s}' +
    '.mht-thumb:hover{transform:rotate(0) scale(1.03)}' +
    '.mht-thumb img{display:block;width:100%;height:auto}' +
    '.mht-sec blockquote{margin:18px 0;padding:14px 18px;border-inline-start:4px solid #c9a227;background:rgba(255,255,255,.7);border-radius:10px;font-style:italic;line-height:1.85}' +
    '.mht-sec cite{display:block;margin-top:8px;font-style:normal;font-weight:700;font-size:.9rem;opacity:.8}' +
    '.mht-note{font-size:.8rem;opacity:.65;margin-top:12px}' +
    '.mht-btn{display:inline-block;margin-top:6px;padding:9px 18px;border-radius:999px;border:1px solid #c9a227;background:#fff;color:#0f1c3e;font-weight:800;cursor:pointer}' +
    '@media(max-width:700px){.mht-sec{grid-template-columns:1fr}.mht-thumb{max-width:220px;margin:0 auto}}' +
    '.mht-dlg{border:0;padding:0;background:transparent;max-width:min(720px,94vw);max-height:94vh}' +
    '.mht-dlg::backdrop{background:rgba(10,18,40,.82);backdrop-filter:blur(4px)}' +
    '.mht-dlg img{display:block;width:100%;height:auto;max-height:88vh;object-fit:contain;border-radius:8px;-webkit-user-drag:none}' +
    '.mht-x{position:absolute;top:8px;inset-inline-end:8px;width:38px;height:38px;border-radius:50%;border:0;background:#fff;font-size:1.2rem;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.3)}';

  function lang() { return (document.documentElement.lang || 'en').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var dlg;
  function open() {
    var t = TXT[lang()];
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.className = 'mht-dlg';
      dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.classList.contains('mht-x')) dlg.close(); });
      dlg.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      document.body.appendChild(dlg);
    }
    dlg.innerHTML = '<button type="button" class="mht-x" aria-label="' + esc(t.x) + '">✕</button><img src="' + IMG + '" alt="' + esc(t.alt) + '">';
    if (dlg.showModal) dlg.showModal(); else window.open(IMG, '_blank');
  }

  function render() {
    var t = TXT[lang()], dir = lang() === 'ar' ? 'rtl' : 'ltr';
    Array.prototype.forEach.call(document.querySelectorAll('[data-mht]'), function (el) {
      el.dir = dir;
      if (el.dataset.mht === 'strip') {
        el.className = 'mht-strip';
        el.innerHTML = '<a href="#" data-mht-open><span class="mht-ico">🏛️</span><span><b>' + esc(t.stripTitle) + '</b><small>' + esc(t.stripSub) + '</small></span><span class="mht-go">' + esc(t.view) + '</span></a>';
      } else {
        el.className = 'mht-sec';
        el.innerHTML =
          '<button type="button" class="mht-thumb" data-mht-open aria-label="' + esc(t.full) + '"><img src="' + THUMB + '" alt="' + esc(t.alt) + '" loading="lazy" width="360" height="557"></button>' +
          '<div><h2>🏛️ ' + esc(t.title) + '</h2><p>' + esc(t.body) + '</p>' +
          '<blockquote>' + esc(t.quote) + '<cite>' + esc(t.cite) + '</cite></blockquote>' +
          '<p>' + esc(t.close) + '</p>' +
          '<button type="button" class="mht-btn" data-mht-open>' + esc(t.full) + '</button>' +
          '<p class="mht-note">' + esc(t.note) + '</p></div>';
      }
    });
  }

  function init() {
    if (!document.querySelector('[data-mht]')) return;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    render();
    document.addEventListener('click', function (e) {
      var o = e.target.closest && e.target.closest('[data-mht-open]');
      if (o) { e.preventDefault(); open(); }
    });
    new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
