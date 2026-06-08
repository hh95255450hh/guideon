const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'دليل_إضافة_الرحلات_GUIDEON.pdf');
const SS  = path.join(__dirname, 'screenshots');
const TMP = path.join(__dirname, 'tmp_pages');
if (!fs.existsSync(SS))  fs.mkdirSync(SS);
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP);

const LOGO_PATH = path.join(__dirname, '..', 'public', 'logo.png');
const LOGO_B64  = fs.existsSync(LOGO_PATH)
  ? `data:image/png;base64,${fs.readFileSync(LOGO_PATH).toString('base64')}`
  : '';

function ssB64(file) {
  const p = path.join(SS, file);
  return fs.existsSync(p)
    ? `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`
    : '';
}

// ── shared CSS reset ─────────────────────────────────────────
const BASE_CSS = `
  html { width:1280px; overflow-x:hidden; background:#fff; }
  body { margin:0; padding:0; width:1280px; overflow-x:hidden; font-family:'Segoe UI',Tahoma,Arial,sans-serif; direction:rtl; }
  * { box-sizing:border-box; }
`;

// ── Write a temp HTML file and return its path ───────────────
function writePage(name, html) {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, html, 'utf8');
  return 'file:///' + p.replace(/\\/g, '/');
}

// ── Take screenshot of a page ────────────────────────────────
async function shot(browser, url, outFile, w = 1280, h = 680) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(SS, outFile) });
  await page.close();
  const kb = (fs.statSync(path.join(SS, outFile)).size / 1024).toFixed(0);
  console.log(`  ✓ ${outFile} — ${kb}KB`);
}

// ── NAVBAR ──────────────────────────────────────────────────
function nav() {
  return `<div style="background:#0f1c3e;padding:0 24px;height:54px;display:flex;align-items:center;justify-content:space-between;width:100%">
    <div style="display:flex;align-items:center;gap:16px">
      ${LOGO_B64 ? `<img src="${LOGO_B64}" style="height:34px">` : '<span style="color:#fff;font-weight:900;font-size:16px">GUIDEON</span>'}
      <span style="color:#aad4cf;font-size:10px;letter-spacing:1.5px;text-transform:uppercase">Discover Oman</span>
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      <span style="color:#aad4cf;font-size:11px;padding:5px 10px">بحث</span>
      <span style="color:#aad4cf;font-size:11px;padding:5px 10px">المرشدون</span>
      <button style="background:#0f7b6c;color:#fff;border:none;padding:7px 14px;border-radius:7px;font-size:11px;font-weight:700">تسجيل الدخول</button>
    </div>
  </div>`;
}

// ── MOCKUP DEFINITIONS ───────────────────────────────────────
const MOCKUPS = {

  'home.html': `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><style>${BASE_CSS}</style></head><body>
${nav()}
<div style="background:linear-gradient(135deg,#0f1c3e 0%,#1a2c5b 60%,#0f7b6c 100%);padding:56px 80px;text-align:center;color:#fff">
  <h1 style="font-size:36px;font-weight:900;margin-bottom:10px">اكتشف عُمان مع مرشد محلي معتمد</h1>
  <p style="color:#aad4cf;font-size:15px;margin-bottom:28px">أكثر من 50 مرشداً معتمداً في جميع مناطق سلطنة عُمان</p>
  <div style="background:rgba(255,255,255,.15);border-radius:12px;padding:14px 20px;max-width:600px;margin:0 auto;display:flex;gap:10px;align-items:center">
    <span style="color:rgba(255,255,255,.6);font-size:13px;flex:1;text-align:right">ابحث عن وجهة أو رحلة...</span>
    <button style="background:#0f7b6c;color:#fff;border:none;padding:9px 22px;border-radius:8px;font-size:12px;font-weight:700;white-space:nowrap">🔍 بحث</button>
  </div>
</div>
<div style="padding:36px 80px;background:#f0f4f3">
  <h2 style="color:#0f1c3e;font-size:18px;font-weight:800;margin-bottom:18px">🌟 المرشدون المميزون</h2>
  <div style="display:flex;gap:14px">
    ${[
      ['أشرف العامري','نزوى · ثقافية وتاريخية','4.9 ⭐ · 24 تقييم','OMR 45'],
      ['غالب البوسعيدي','الجبل الأخضر · طبيعية','4.8 ⭐ · 18 تقييم','OMR 85'],
      ['علي البوسعيدي','مسقط · تاريخية وثقافية','4.7 ⭐ · 31 تقييم','OMR 30'],
    ].map(([n,d,r,p]) => `
    <div style="background:#fff;border-radius:12px;overflow:hidden;flex:1;box-shadow:0 2px 10px rgba(0,0,0,.08);border:1px solid #e0ede8">
      <div style="height:110px;background:linear-gradient(135deg,#0f1c3e,#0f7b6c);display:flex;align-items:center;justify-content:center;font-size:36px">🏔️</div>
      <div style="padding:12px 14px">
        <div style="font-weight:700;font-size:13px;color:#0f1c3e;margin-bottom:4px">${n}</div>
        <div style="color:#888;font-size:10px;margin-bottom:4px">${d}</div>
        <div style="color:#f59e0b;font-size:10px;margin-bottom:8px">${r}</div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="color:#0f7b6c;font-weight:800;font-size:14px">${p}<span style="color:#888;font-size:10px;font-weight:400">/يوم</span></span>
          <button style="background:#0f7b6c;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:10px;font-weight:700">عرض الرحلات</button>
        </div>
      </div>
    </div>`).join('')}
  </div>
</div>
</body></html>`,

  'search.html': `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><style>${BASE_CSS}</style></head><body>
${nav()}
<div style="background:#fff;padding:14px 32px;border-bottom:1px solid #e0e0e0;display:flex;gap:8px;align-items:center">
  <input style="flex:1;border:1px solid #d0ede8;border-radius:8px;padding:8px 12px;font-size:12px;font-family:inherit;direction:rtl" value="نزوى - رحلات ثقافية">
  <select style="border:1px solid #d0ede8;border-radius:8px;padding:8px 10px;font-size:11px;font-family:inherit"><option>كل التصنيفات</option></select>
  <select style="border:1px solid #d0ede8;border-radius:8px;padding:8px 10px;font-size:11px;font-family:inherit"><option>ترتيب حسب</option></select>
  <button style="background:#0f7b6c;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:12px;font-weight:700">بحث</button>
</div>
<div style="display:flex">
  <div style="width:200px;background:#fff;border-left:1px solid #e0e0e0;padding:18px;font-size:11px;flex-shrink:0">
    <div style="font-weight:800;color:#0f1c3e;margin-bottom:12px;font-size:12px">🔽 الفلاتر</div>
    <div style="font-weight:700;color:#0f1c3e;margin-bottom:8px">التصنيف</div>
    ${['ثقافية ✓','طبيعية','مغامرة','تاريخية','شاطئية'].map(c=>`<label style="display:block;padding:4px 0;color:#555;cursor:pointer">${c.includes('✓')?'☑':'☐'} ${c.replace(' ✓','')}</label>`).join('')}
    <div style="font-weight:700;color:#0f1c3e;margin:14px 0 8px">السعر (OMR)</div>
    <div style="display:flex;gap:6px">
      <input style="width:56px;border:1px solid #d0ede8;border-radius:6px;padding:4px 6px;font-size:10px;text-align:center" value="0">
      <span style="color:#888;padding-top:3px">—</span>
      <input style="width:56px;border:1px solid #d0ede8;border-radius:6px;padding:4px 6px;font-size:10px;text-align:center" value="200">
    </div>
    <div style="font-weight:700;color:#0f1c3e;margin:14px 0 8px">المدة</div>
    ${['أقل من ساعة','1–3 ساعات','نصف يوم','يوم كامل'].map(d=>`<label style="display:block;padding:3px 0;color:#555">☐ ${d}</label>`).join('')}
  </div>
  <div style="flex:1;padding:18px;background:#f8fffe">
    <div style="color:#888;font-size:11px;margin-bottom:12px">12 رحلة متاحة · نزوى</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
      ${[
        ['جولة قلعة نزوى','نزوى · ثقافية · 3 ساعات','OMR 30','4.9 ⭐ (24)','🏰'],
        ['رحلة الجبل الأخضر','الجبل الأخضر · طبيعية · يوم','OMR 85','4.8 ⭐ (18)','🏔️'],
        ['وادي شاب السحري','وادي شاب · مغامرة · 5 ساعات','OMR 45','4.7 ⭐ (31)','🌊'],
        ['سوق نزوى التقليدي','نزوى · تاريخية · ساعتان','OMR 20','4.9 ⭐ (42)','🛒'],
        ['بهلاء والحمراء','داخلية · ثقافية · يوم','OMR 60','4.6 ⭐ (15)','🕌'],
        ['جولة الفلج القصيرة','نزوى · تراثية · 40 دقيقة','OMR 8','5.0 ⭐ (9)','💧'],
      ].map(([t,d,p,r,e]) => `
      <div style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.07);border:1px solid #e8f0ef">
        <div style="height:80px;background:linear-gradient(135deg,#0f1c3e,#0f7b6c);display:flex;align-items:center;justify-content:center;font-size:28px">${e}</div>
        <div style="padding:10px">
          <div style="font-weight:700;font-size:11px;color:#0f1c3e;margin-bottom:3px">${t}</div>
          <div style="color:#888;font-size:9px;margin-bottom:5px">${d}</div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="color:#0f7b6c;font-weight:800;font-size:12px">${p}</span>
            <span style="color:#f59e0b;font-size:9px">${r}</span>
          </div>
        </div>
      </div>`).join('')}
    </div>
  </div>
</div>
</body></html>`,

  'dashboard.html': `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><style>${BASE_CSS}</style></head><body>
${nav()}
<div style="background:#0f1c3e;padding:0 24px;display:flex;border-bottom:2px solid #0f7b6c">
  ${['📋 الحجوزات','🗺️ رحلاتي','📊 التحليلات','📅 المواعيد','👤 الملف الشخصي'].map((t,i) => `
  <div style="padding:11px 14px;color:${i===1?'#fff':'#aad4cf'};font-size:11px;font-weight:${i===1?700:400};border-bottom:${i===1?'3px solid #0f7b6c':'3px solid transparent'}">${t}</div>`).join('')}
</div>
<div style="display:flex;height:calc(100vh - 110px)">
  <div style="flex:1;padding:20px;background:#f8fffe;overflow:hidden">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 style="color:#0f1c3e;font-size:16px;font-weight:900">🗺️ رحلاتي</h2>
      <button style="background:#0f7b6c;color:#fff;border:none;padding:9px 18px;border-radius:9px;font-size:11px;font-weight:700">+ إضافة رحلة جديدة</button>
    </div>
    ${[
      ['جولة قلعة نزوى والسوق التقليدي','نزوى · ثقافية · 3 ساعات · حتى 12 شخص','OMR 30','منشورة','#ecfdf5','#065f46','4.9 ⭐ (24 تقييم)','🏰'],
      ['رحلة الجبل الأخضر المميزة','الجبل الأخضر · طبيعية · يوم كامل · حتى 8 أشخاص','OMR 85','منشورة','#ecfdf5','#065f46','4.8 ⭐ (18 تقييم)','🏔️'],
      ['استكشاف وادي شاب','وادي شاب · مغامرة · 5 ساعات · حتى 10 أشخاص','OMR 45','مسودة','#fffbeb','#856404','—','🌊'],
    ].map(([t,d,p,s,bg,c,r,e]) => `
    <div style="background:#fff;border:1px solid #e0ede8;border-radius:12px;padding:14px;margin-bottom:10px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 4px rgba(0,0,0,.04)">
      <div style="width:52px;height:52px;min-width:52px;background:linear-gradient(135deg,#0f1c3e,#0f7b6c);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px">${e}</div>
      <div style="flex:1;min-width:0">
        <div style="color:#0f1c3e;font-weight:700;font-size:12px;margin-bottom:2px">${t}</div>
        <div style="color:#888;font-size:10px;margin-bottom:2px">${d}</div>
        <div style="color:#f59e0b;font-size:10px">${r}</div>
      </div>
      <div style="color:#0f7b6c;font-weight:800;font-size:14px;white-space:nowrap">${p}</div>
      <div style="background:${bg};color:${c};font-size:10px;font-weight:700;padding:4px 10px;border-radius:6px;white-space:nowrap">${s}</div>
      <div style="display:flex;gap:5px">
        <button style="background:#f0f4f3;border:1px solid #d0ede8;padding:5px 10px;border-radius:7px;font-size:10px;cursor:pointer">✏️ تعديل</button>
        <button style="background:#fef2f2;border:1px solid #fecaca;padding:5px 8px;border-radius:7px;font-size:11px;cursor:pointer;color:#dc2626">🗑️</button>
      </div>
    </div>`).join('')}
  </div>
  <div style="width:260px;flex-shrink:0;background:#fff;border-right:1px solid #e0ede8;padding:16px;overflow:hidden">
    <h4 style="color:#0f1c3e;font-size:12px;font-weight:800;margin-bottom:4px">📅 إدارة المواعيد</h4>
    <p style="color:#888;font-size:9px;margin-bottom:12px">أضف مواعيد بالساعة والدقيقة</p>
    <div style="background:#f8fffe;border:1px solid #d0ede8;border-radius:10px;padding:12px;margin-bottom:10px">
      <div style="margin-bottom:8px"><div style="font-size:9px;color:#555;font-weight:600;margin-bottom:3px">📆 التاريخ</div><div style="background:#fff;border:1px solid #d0ede8;border-radius:6px;padding:6px 9px;font-size:10px;color:#0f1c3e">2026-06-15</div></div>
      <div style="margin-bottom:8px"><div style="font-size:9px;color:#555;font-weight:600;margin-bottom:3px">🕐 وقت البداية</div><div style="background:#fff;border:1px solid #d0ede8;border-radius:6px;padding:6px 9px;font-size:10px;color:#0f1c3e">09:00</div></div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <div style="flex:1"><div style="font-size:9px;color:#555;font-weight:600;margin-bottom:3px">⏱ المدة</div><div style="background:#fff;border:1px solid #d0ede8;border-radius:6px;padding:6px 9px;font-size:10px;color:#0f1c3e">30 دقيقة ▾</div></div>
        <div style="flex:1"><div style="font-size:9px;color:#555;font-weight:600;margin-bottom:3px">💰 السعر</div><div style="background:#fff;border:1px solid #d0ede8;border-radius:6px;padding:6px 9px;font-size:10px;color:#0f1c3e">OMR 5</div></div>
      </div>
      <button style="background:#0f7b6c;color:#fff;border:none;width:100%;padding:8px;border-radius:7px;font-size:10px;font-weight:700">+ إضافة موعد</button>
    </div>
    ${[['09:00–09:30','30 دقيقة','OMR 5'],['14:00–16:00','ساعتان','OMR 18']].map(([t,d,p]) => `
    <div style="background:#f0f4f3;border-radius:7px;padding:8px 10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-size:10px;font-weight:700;color:#0f1c3e">🕐 ${t}</div><div style="font-size:9px;color:#888">${d}</div></div>
      <div style="color:#0f7b6c;font-weight:800;font-size:11px">${p}</div>
      <div style="color:#dc2626;cursor:pointer">✕</div>
    </div>`).join('')}
    <button style="background:#0f1c3e;color:#fff;border:none;width:100%;padding:8px;border-radius:7px;font-size:10px;font-weight:700;margin-top:4px">💾 حفظ المواعيد</button>
  </div>
</div>
</body></html>`,

  'add-tour.html': `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
<style>${BASE_CSS}
label{display:block;font-size:10.5px;font-weight:700;color:#0f1c3e;margin-bottom:4px}
.fi{background:#fff;border:1px solid #d0ede8;border-radius:8px;padding:8px 11px;font-size:11px;color:#333;width:100%;font-family:inherit;direction:rtl}
</style></head><body>
${nav()}
<div style="background:#0f1c3e;padding:8px 24px;display:flex;gap:6px;align-items:center;font-size:10px">
  <span style="color:#aad4cf">لوحة التحكم</span><span style="color:#555">›</span>
  <span style="color:#aad4cf">رحلاتي</span><span style="color:#555">›</span>
  <span style="color:#fff;font-weight:700">إضافة رحلة جديدة</span>
</div>
<div style="padding:22px 36px;background:#f8fffe">
  <h2 style="color:#0f1c3e;font-size:16px;font-weight:900;margin-bottom:18px">🗺️ إضافة رحلة سياحية جديدة</h2>

  <div style="background:#fff;border:1px solid #e0ede8;border-radius:12px;padding:20px;margin-bottom:14px">
    <h3 style="color:#0f7b6c;font-size:12px;font-weight:800;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #f0f4f3">📝 المعلومات الأساسية</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="grid-column:1/-1"><label>عنوان الرحلة *</label><input class="fi" value="جولة قلعة نزوى والسوق التقليدي الأصيل"></div>
      <div><label>الوجهة *</label><input class="fi" value="نزوى، المنطقة الداخلية"></div>
      <div><label>التصنيف *</label><select class="fi"><option>ثقافية / تاريخية</option><option>طبيعية</option><option>مغامرة</option></select></div>
      <div><label>مستوى الصعوبة</label><select class="fi"><option>متوسطة (Moderate)</option><option>سهلة</option><option>صعبة</option></select></div>
      <div><label>أقصى حجم المجموعة</label><input class="fi" value="12 شخص"></div>
    </div>
    <div style="margin-top:12px"><label>الوصف التفصيلي *</label>
    <textarea class="fi" style="min-height:60px;resize:none">استكشف قلعة نزوى الشهيرة مع مرشد سياحي معتمد من وزارة التراث. سنزور الأبراج الدفاعية التاريخية ثم ننتقل لجولة في السوق التقليدي العريق والفلج التراثي...</textarea></div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
    <div style="background:#fff;border:1px solid #e0ede8;border-radius:12px;padding:18px">
      <h3 style="color:#0f7b6c;font-size:12px;font-weight:800;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #f0f4f3">⏱ المدة</h3>
      <div style="display:flex;gap:8px">
        ${[['أيام','0'],['ساعات','3'],['دقائق','0']].map(([l,v]) => `
        <div style="flex:1;text-align:center">
          <label style="text-align:center">${l}</label>
          <div style="background:#f0f4f3;border-radius:8px;padding:10px;font-size:18px;font-weight:900;color:#0f7b6c">${v}</div>
        </div>`).join('')}
      </div>
    </div>
    <div style="background:#fff;border:1px solid #e0ede8;border-radius:12px;padding:18px">
      <h3 style="color:#0f7b6c;font-size:12px;font-weight:800;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #f0f4f3">💰 الأسعار</h3>
      <div style="margin-bottom:10px"><label>السعر الأساسي (شخصان) *</label><input class="fi" value="30 OMR"></div>
      <div><label>سعر الشخص الإضافي</label><input class="fi" value="12 OMR"></div>
    </div>
  </div>

  <div style="display:flex;gap:10px">
    <button style="background:#0f7b6c;color:#fff;border:none;padding:11px 24px;border-radius:9px;font-size:12px;font-weight:700">🚀 نشر الرحلة</button>
    <button style="background:#fff;color:#555;border:1px solid #d0ede8;padding:11px 22px;border-radius:9px;font-size:12px">💾 حفظ مسودة</button>
    <button style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:11px 18px;border-radius:9px;font-size:12px">إلغاء</button>
  </div>
</div>
</body></html>`,

  'tour-page.html': `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><style>${BASE_CSS}</style></head><body>
${nav()}
<div style="background:linear-gradient(to top,rgba(15,28,62,.95) 0%,rgba(15,123,108,.3) 100%),linear-gradient(135deg,#0f1c3e,#1a2c5b);padding:20px 44px 24px;color:#fff">
  <div style="display:flex;gap:6px;margin-bottom:10px">
    <span style="background:#0f7b6c;color:#fff;font-size:9px;padding:3px 9px;border-radius:4px;font-weight:700">ثقافية</span>
    <span style="background:rgba(255,255,255,.2);color:#fff;font-size:9px;padding:3px 9px;border-radius:4px">تاريخية</span>
  </div>
  <h1 style="font-size:22px;font-weight:900;margin-bottom:8px">جولة قلعة نزوى والسوق التقليدي الأصيل</h1>
  <div style="display:flex;gap:14px;color:#aad4cf;font-size:11px">
    <span>📍 نزوى، المنطقة الداخلية</span>
    <span>⏱ 3 ساعات</span>
    <span>👥 حتى 12 شخص</span>
    <span>⭐ 4.9 (24 تقييم)</span>
  </div>
</div>
<div style="display:flex;gap:20px;padding:22px 44px;background:#f8fffe">
  <div style="flex:1;min-width:0">
    <h3 style="color:#0f1c3e;font-size:13px;font-weight:800;margin-bottom:10px">عن هذه الجولة</h3>
    <p style="color:#555;font-size:11px;line-height:1.8;margin-bottom:14px">استكشف قلعة نزوى الشهيرة مع مرشد سياحي معتمد من وزارة التراث. سنزور الأبراج الدفاعية التاريخية ثم ننتقل لجولة في السوق التقليدي العريق...</p>
    <h3 style="color:#0f1c3e;font-size:12px;font-weight:800;margin-bottom:8px">✅ يشمل السعر</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:14px">
      ${['مرشد سياحي معتمد','مواصلات مكيفة','وجبة غداء تقليدية','مياه وعصائر طازجة'].map(i=>`<div style="color:#065f46;font-size:11px">✓ ${i}</div>`).join('')}
    </div>
    <h3 style="color:#0f1c3e;font-size:12px;font-weight:800;margin-bottom:8px">🗺️ البرنامج</h3>
    <div style="background:#fff;border-radius:8px;border:1px solid #e0ede8;overflow:hidden">
      ${[['09:00','الانطلاق من نقطة الالتقاء'],['09:30','زيارة قلعة نزوى والأبراج'],['11:00','جولة السوق التقليدي'],['12:30','وجبة غداء محلية'],['14:00','العودة وإنهاء الجولة']].map(([t,a],i)=>`
      <div style="display:flex;gap:12px;padding:8px 12px;background:${i%2?'#f8fffe':'#fff'};border-bottom:1px solid #f0f0f0">
        <span style="color:#0f7b6c;font-weight:700;font-size:11px;white-space:nowrap">${t}</span>
        <span style="color:#555;font-size:11px">${a}</span>
      </div>`).join('')}
    </div>
  </div>
  <div style="width:260px;flex-shrink:0">
    <div style="background:#fff;border:1px solid #e0ede8;border-radius:14px;padding:18px;box-shadow:0 4px 16px rgba(0,0,0,.08);position:sticky;top:20px">
      <div style="text-align:center;margin-bottom:14px">
        <div style="color:#888;font-size:10px;margin-bottom:4px">يبدأ من</div>
        <div style="color:#0f7b6c;font-size:26px;font-weight:900">OMR 30</div>
        <div style="color:#888;font-size:9px">للشخصين</div>
      </div>
      <div style="margin-bottom:10px">
        <div style="font-size:10px;font-weight:700;color:#0f1c3e;margin-bottom:5px">📅 اختر التاريخ</div>
        <input type="date" style="width:100%;border:1px solid #d0ede8;border-radius:7px;padding:7px 10px;font-size:11px;font-family:inherit">
      </div>
      <div style="margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;color:#0f1c3e;margin-bottom:6px">🕐 الوقت <span style="font-weight:400;color:#888">(اختياري)</span></div>
        <div style="display:flex;gap:6px">
          <div style="flex:1;border:2px solid #0f7b6c;border-radius:8px;padding:7px 6px;text-align:center;background:#ecfdf5">
            <div style="font-size:10px;font-weight:700;color:#0f7b6c">🌅 09:00</div>
            <div style="font-size:9px;color:#888">30 دقيقة · OMR 5</div>
          </div>
          <div style="flex:1;border:1px solid #d0ede8;border-radius:8px;padding:7px 6px;text-align:center">
            <div style="font-size:10px;font-weight:700;color:#555">🌇 14:00</div>
            <div style="font-size:9px;color:#888">3 ساعات · OMR 25</div>
          </div>
        </div>
      </div>
      <button style="background:#0f7b6c;color:#fff;border:none;width:100%;padding:11px;border-radius:10px;font-size:12px;font-weight:700">📅 احجز الآن</button>
      <p style="color:#888;font-size:9px;text-align:center;margin-top:8px">تأكيد خلال 24 ساعة · إلغاء مجاني</p>
    </div>
  </div>
</div>
</body></html>`,
};

// ── PDF HTML ──────────────────────────────────────────────────
function makePdfHtml() {
  function ss(file, cap) {
    const d = ssB64(file);
    if (!d) return '';
    return `<div class="ss"><div class="cap">📸 ${cap}</div><img src="${d}"></div>`;
  }
  function steps(arr) {
    return `<div class="steps">${arr.map(([t,d],i)=>`<div class="step"><div class="sn">${i+1}</div><div class="sc"><h4>${t}</h4><p>${d}</p></div></div>`).join('')}</div>`;
  }
  function pg(content) {
    return `<div class="page"><div class="ph">${LOGO_B64?`<img src="${LOGO_B64}" style="height:24px">`:'<b>GUIDEON</b>'}<span>guideon.om</span></div>${content}</div>`;
  }

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1a1a1a;direction:rtl;background:#fff}
.cover{width:100%;height:100vh;background:linear-gradient(135deg,#0f1c3e 0%,#1a2c5b 55%,#0f7b6c 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;page-break-after:always}
.cover img{width:180px;margin-bottom:28px}
.cover h1{color:#fff;font-size:32px;font-weight:900;margin-bottom:8px}
.cover h2{color:#0f7b6c;font-size:16px;font-weight:400;margin-bottom:20px;direction:ltr}
.cover .ln{width:150px;height:3px;background:#0f7b6c;margin:0 auto 20px}
.cover p{color:#aad4cf;font-size:12px;text-align:center;line-height:2}
.cover .ver{color:#6b9e99;font-size:9px;margin-top:28px}
.page{padding:28px 36px;page-break-after:always}
.page:last-child{page-break-after:auto}
.ph{background:#0f1c3e;padding:8px 14px;border-radius:7px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between}
.ph span{color:#aad4cf;font-size:9px;direction:ltr}
.sec{background:#0f7b6c;color:#fff;padding:9px 14px;border-radius:7px;font-size:14px;font-weight:800;margin-bottom:16px}
.sub{color:#0f1c3e;font-size:11.5px;font-weight:800;margin:14px 0 7px;border-right:4px solid #0f7b6c;padding-right:8px}
.steps{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
.step{display:flex;align-items:flex-start;gap:9px;background:#f8fffe;border:1px solid #d0ede8;border-radius:9px;padding:10px}
.sn{width:26px;height:26px;min-width:26px;background:#0f7b6c;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px}
.sc h4{color:#0f1c3e;font-size:11px;font-weight:700;margin-bottom:2px}
.sc p{color:#555;font-size:10px;line-height:1.6}
table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10.5px}
th{background:#0f1c3e;color:#fff;padding:7px 9px;text-align:right}
td{padding:7px 9px;border-bottom:1px solid #e0e0e0;vertical-align:top}
tr:nth-child(even) td{background:#f0f4f3}
.fn{color:#0f7b6c;font-weight:700}
.req{color:#e55;font-size:8.5px}
.tip{background:#fffbeb;border-right:4px solid #f59e0b;border-radius:5px;padding:8px 11px;margin:9px 0;font-size:10.5px;color:#7a5000}
.note{background:#fef3c7;border-right:4px solid #f59e0b;border-radius:5px;padding:7px 11px;margin:7px 0;font-size:10.5px;color:#856404}
.ok{background:#ecfdf5;border-right:4px solid #0f7b6c;border-radius:5px;padding:7px 11px;margin:7px 0;font-size:10.5px;color:#065f46}
.ss{border:2px solid #d0ede8;border-radius:9px;overflow:hidden;margin:10px 0;box-shadow:0 2px 8px rgba(0,0,0,.08)}
.ss .cap{background:#0f1c3e;color:#aad4cf;font-size:9px;padding:4px 11px;text-align:center}
.ss img{width:100%;display:block}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:9px 0}
.card{background:#f0f4f3;border:1px solid #d0ede8;border-radius:7px;padding:10px}
.card h4{color:#0f7b6c;font-size:10px;font-weight:700;margin-bottom:2px}
.card p{color:#555;font-size:9.5px;line-height:1.5}
.toc-i{display:flex;align-items:center;gap:9px;padding:7px 11px;border-bottom:1px solid #e0e0e0}
.toc-i:nth-child(even){background:#f0f4f3}
.tn{width:22px;height:22px;min-width:22px;background:#0f7b6c;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:10px}
.tt{flex:1;color:#0f1c3e;font-weight:700;font-size:11px}
.tp{color:#0f7b6c;font-weight:700;font-size:10px;direction:ltr}
.cb{background:#0f1c3e;border-radius:9px;padding:18px;text-align:center;margin-top:18px}
.cb h3{color:#0f7b6c;font-size:14px;margin-bottom:7px}
.cb p{color:#aad4cf;font-size:11px;line-height:2}
</style></head><body>

<div class="cover">
  ${LOGO_B64?`<img src="${LOGO_B64}">`:''}
  <h1>دليل إضافة الرحلات</h1>
  <h2>Guide to Adding Tours & Packages</h2>
  <div class="ln"></div>
  <p>دليل شامل لكيفية إضافة الرحلات السياحية<br>وإدارة المواعيد والميزات على منصة GUIDEON</p>
  <div class="ver">الإصدار 1.0  ·  يونيو 2026  ·  guideon.om</div>
</div>

${pg(`<div class="sec">📋 المحتويات</div>
${[['1','الوصول إلى لوحة تحكم المرشد','3'],['2','إضافة رحلة جديدة خطوة بخطوة','4'],['3','الحقول الأساسية للرحلة','5'],['4','المميزات والمحتويات','6'],['5','الصور وإعداد الأسعار','7'],['6','إدارة المواعيد والأوقات','8'],['7','نشر الرحلة وإدارتها','9'],['8','نصائح وأفضل الممارسات','10']].map(([n,t,p])=>`
<div class="toc-i"><div class="tn">${n}</div><div class="tt">${t}</div><div class="tp">صفحة ${p}</div></div>`).join('')}
${ss('home.png','الصفحة الرئيسية للمنصة — guideon.om')}
`)}

${pg(`<div class="sec">1️⃣  الوصول إلى لوحة تحكم المرشد</div>
${steps([['افتح الموقع','اذهب إلى guideon.om من المتصفح.'],['تسجيل الدخول','اضغط "تسجيل الدخول" وأدخل بريدك وكلمة المرور.'],['لوحة التحكم','ستنتقل تلقائياً إلى: guideon.om/guide-dashboard'],['قسم رحلاتي','اضغط تبويب "رحلاتي" في القائمة العلوية.']])}
${ss('dashboard.png','لوحة تحكم المرشد — قسم رحلاتي وإدارة المواعيد')}
<div class="note">⚠️ يجب تفعيل حسابك من قِبل الأدمن قبل إضافة رحلات.</div>
<div class="g2"><div class="card"><h4>📅 الحجوزات</h4><p>عرض وإدارة طلبات الحجز</p></div><div class="card"><h4>🗺️ رحلاتي</h4><p>إضافة وتعديل الرحلات</p></div><div class="card"><h4>📊 التحليلات</h4><p>إحصائيات الأداء والإيرادات</p></div><div class="card"><h4>🕐 المواعيد</h4><p>إدارة الأوقات بالدقيقة</p></div></div>
`)}

${pg(`<div class="sec">2️⃣  إضافة رحلة جديدة — خطوة بخطوة</div>
${steps([['افتح قسم رحلاتي','من لوحة التحكم اضغط تبويب "رحلاتي".'],['إضافة رحلة جديدة','اضغط زر "+ إضافة رحلة جديدة" الأخضر في أعلى الصفحة.'],['المعلومات الأساسية','أدخل العنوان والوصف والوجهة والتصنيف. هذه الحقول مطلوبة.'],['المدة والتفاصيل','حدد المدة بالأيام+الساعات+الدقائق والصعوبة وأقصى حجم للمجموعة.'],['الأسعار','أدخل السعر الأساسي للشخصين وسعر كل شخص إضافي.'],['المميزات والبرنامج','أضف ما يشمله السعر ونقطة الانطلاق والبرنامج التفصيلي.'],['رفع الصور','ارفع حتى 10 صور. الأولى هي الغلاف الرئيسي.'],['نشر الرحلة','اضغط "نشر" للظهور فوراً أو "حفظ مسودة" لإكمالها لاحقاً.']])}
${ss('add-tour.png','نموذج إضافة رحلة جديدة')}
<div class="tip"><strong>💡</strong> أضف وصفاً يزيد عن 100 كلمة — يرفع الحجوزات 3 أضعاف.</div>
`)}

${pg(`<div class="sec">3️⃣  الحقول الأساسية للرحلة</div>
<table><tr><th>الحقل</th><th>الشرح والمثال</th></tr>
<tr><td><span class="fn">عنوان الرحلة</span><br><span class="req">● مطلوب</span></td><td>اسم جذاب وصفي. مثال: "جولة في قلعة نزوى والسوق التقليدي الأصيل"</td></tr>
<tr><td><span class="fn">الوصف</span><br><span class="req">● مطلوب</span></td><td>وصف تفصيلي لما سيراه السائح وما يميز الجولة. كلما كان أوضح زادت الحجوزات.</td></tr>
<tr><td><span class="fn">الوجهة</span><br><span class="req">● مطلوب</span></td><td>المدينة أو المنطقة. مثال: نزوى، مسقط، صلالة، الجبل الأخضر.</td></tr>
<tr><td><span class="fn">التصنيف</span><br><span class="req">● مطلوب</span></td><td>ثقافية / طبيعية / مغامرة / تاريخية / شاطئية. يمكن أكثر من تصنيف.</td></tr>
<tr><td><span class="fn">مستوى الصعوبة</span></td><td>سهلة · متوسطة · صعبة. يساعد السياح على الاختيار المناسب.</td></tr>
<tr><td><span class="fn">المدة</span><br><span class="req">● مطلوب</span></td><td>بالأيام+الساعات+الدقائق. مثال رحلة قصيرة: 0 يوم + 0 ساعة + 30 دقيقة.</td></tr>
<tr><td><span class="fn">أقصى المجموعة</span></td><td>العدد الأقصى. مثال: 6 للخاصة، 15 للمجموعات.</td></tr>
<tr><td><span class="fn">اللغات</span></td><td>اللغات التي تُرشد بها: عربي، إنجليزي، فرنسي...</td></tr>
</table>
${ss('search.png','صفحة البحث عن الرحلات كما يراها السياح')}
`)}

${pg(`<div class="sec">4️⃣  المميزات والمحتويات التفصيلية</div>
<div class="sub">✅ ما يشمله السعر</div>
<div style="background:#ecfdf5;border-radius:7px;padding:10px;margin-bottom:12px">
${['مركبة مكيفة من وإلى الوجهة','مرشد سياحي معتمد من وزارة التراث','دخول المواقع الأثرية','وجبة غداء تقليدية عُمانية','مياه وعصائر طازجة'].map(i=>`<div style="color:#065f46;font-size:10.5px;padding:2px 0">✓ ${i}</div>`).join('')}
</div>
<div class="sub">❌ ما لا يشمله السعر</div>
<div style="background:#fef2f2;border-radius:7px;padding:10px;margin-bottom:12px">
${['رسوم التأشيرة والتصاريح','المشروبات الكحولية','المصاريف الشخصية','التأمين السياحي'].map(i=>`<div style="color:#991b1b;font-size:10.5px;padding:2px 0">✗ ${i}</div>`).join('')}
</div>
<div class="sub">🗺️ البرنامج اليومي</div>
<table><tr><th>الوقت</th><th>النشاط</th></tr>
${[['09:00','الانطلاق من نقطة الالتقاء'],['09:30','زيارة قلعة نزوى والجولة الداخلية'],['11:00','جولة في السوق التقليدي'],['12:30','وجبة غداء في مطعم محلي'],['14:00','العودة وإنهاء الجولة']].map(([t,a])=>`<tr><td style="color:#0f7b6c;font-weight:700">${t}</td><td>${a}</td></tr>`).join('')}
</table>
${ss('tour-page.png','صفحة الرحلة كما يراها السائح عند الحجز')}
<div class="tip"><strong>💡</strong> البرنامج الساعي يرفع ثقة السائح ويقلل الأسئلة قبل الحجز.</div>
`)}

${pg(`<div class="sec">5️⃣  الصور وإعداد الأسعار</div>
<div class="sub">📸 إرشادات الصور</div>
<div class="g2">
<div class="card"><h4>عدد الصور</h4><p>حتى 10 صور. الأولى هي الغلاف الرئيسي.</p></div>
<div class="card"><h4>الحجم المثالي</h4><p>1200 بكسل عرض، نسبة 16:9، حد أقصى 10 ميجابايت.</p></div>
<div class="card"><h4>الجودة</h4><p>صور نهارية واضحة تُظهر الوجهة بشكل جذاب.</p></div>
<div class="card"><h4>ما يُجنَّب</h4><p>تجنب الشعارات الكبيرة والنصوص المدرجة.</p></div>
</div>
<div class="sub">💰 إعداد الأسعار</div>
<table><tr><th>الحقل</th><th>الشرح</th><th>مثال</th></tr>
<tr><td><span class="fn">السعر الأساسي <span class="req">●</span></span></td><td>يشمل أول شخصين في الرحلة</td><td>OMR 30</td></tr>
<tr><td><span class="fn">سعر الشخص الإضافي</span></td><td>المبلغ لكل شخص بعد الشخصين</td><td>OMR 12</td></tr>
<tr><td><span class="fn">نسبة الخصم %</span></td><td>خصم على الإجمالي (اختياري)</td><td>10%</td></tr>
</table>
<div class="ok">💰 مثال: 30 + 12×2 = <strong>54 OMR لـ 4 أشخاص</strong></div>
<div class="sub">📦 الباقات المتعددة</div>
<table><tr><th>الباقة</th><th>الوصف</th><th>السعر</th></tr>
${[['Standard','جولة أساسية مع المرشد','OMR 30'],['Premium','تشمل الغداء والمواصلات','OMR 55'],['Private','جولة خاصة لشخصين','OMR 90']].map(([n,d,p])=>`<tr><td style="font-weight:700;color:#0f1c3e">${n}</td><td>${d}</td><td style="color:#0f7b6c;font-weight:700">${p}</td></tr>`).join('')}
</table>
`)}

${pg(`<div class="sec">6️⃣  إدارة المواعيد والأوقات</div>
<p style="color:#555;font-size:10.5px;margin-bottom:12px">يدعم GUIDEON مواعيد دقيقة بالساعة والدقيقة — مثالي للرحلات من 20 دقيقة وما فوق.</p>
${steps([['قسم إدارة المواعيد','في لوحة التحكم، قسم "إدارة المواعيد 📅" في الجانب الأيمن من الصفحة.'],['اختر التاريخ ووقت البداية','مثال: 15 يونيو 2026، الساعة 09:00'],['اختر المدة','20 دقيقة · 30 دقيقة · 40 دقيقة · ساعة · ساعتان · نصف يوم · يوم كامل'],['أدخل السعر وأضف','حدد السعر بالريال ثم "+ إضافة موعد" ثم "💾 حفظ المواعيد".']])}
<div class="sub">مثال على جدول مواعيد يوم واحد</div>
<table><tr><th>الوقت</th><th>المدة</th><th>الرحلة</th><th>السعر</th></tr>
${[['09:00–09:30','30 دقيقة','جولة السوق القديم','OMR 5'],['10:00–11:00','ساعة','زيارة القلعة','OMR 9'],['14:00–14:40','40 دقيقة','جولة الفلج','OMR 6'],['16:00–19:30','3.5 ساعة','رحلة غروب الجبل','OMR 25']].map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}
</table>
<div class="tip"><strong>💡 مهم:</strong> اختيار الوقت اختياري للسائح — يمكنه الحجز بدون وقت والاتفاق معك لاحقاً.</div>
`)}

${pg(`<div class="sec">7️⃣  نشر الرحلة وإدارتها</div>
<div class="sub">حالات الرحلة الثلاث</div>
${steps([['🟡 مسودة (Draft)','محفوظة لكنها غير مرئية للسياح. لإتمام التفاصيل قبل النشر.'],['🟢 منشورة (Published)','ظاهرة في صفحة البحث ويمكن حجزها مباشرة.'],['🔴 مؤرشفة (Archived)','مخفية مؤقتاً للمواسم أو الإجازات دون فقدان التقييمات.']])}
<div class="sub">تعديل رحلة موجودة</div>
${steps([['افتح قسم رحلاتي','اضغط تبويب "رحلاتي" من لوحة التحكم.'],['اضغط تعديل','زر "تعديل ✏️" بجانب الرحلة التي تريد تغييرها.'],['عدّل واحفظ','غيّر أي حقل ثم "حفظ التغييرات". تظهر فوراً للسياح.']])}
<div class="note">⚠️ الرحلة المحذوفة لا تُستعاد. ننصح بالأرشفة للحفاظ على التقييمات.</div>
`)}

${pg(`<div class="sec">8️⃣  نصائح وأفضل الممارسات</div>
<div class="steps">
${[['📝','العنوان الجذاب','بدلاً من "جولة نزوى" اكتب "استكشاف قلعة نزوى والسوق العُماني الأصيل مع مرشد معتمد".'],['🌍','اللغتان','أضف الوصف بالعربية والإنجليزية لاستقطاب السياح المحليين والأجانب.'],['⭐','الصور الاحترافية','الصور الجيدة ترفع الحجوزات 70%. صور نهارية واضحة بلا فلاتر.'],['💬','الرد السريع','السياح يفضلون من يرد خلال ساعة. فعّل إشعارات الهاتف.'],['📊','التسعير التنافسي','ابدأ بأسعار منخفضة للحصول على أول تقييمات ثم ارفعها تدريجياً.'],['🗓️','تحديث المواعيد','حدّث مواعيد توفرك أسبوعياً لتظهر كـ"متاح قريباً" في البحث.'],['🎯','التخصص','المرشدون المتخصصون في نوع محدد يحصلون على تقييمات أعلى.'],['📋','البرنامج الدقيق','البرنامج الساعي يقلل أسئلة السياح ويوفر وقتك ووقتهم.']].map(([e,t,d])=>`
<div class="step"><div class="sn" style="font-size:13px;background:transparent;color:#0f7b6c;border:2px solid #0f7b6c">${e}</div><div class="sc"><h4>${t}</h4><p>${d}</p></div></div>`).join('')}
</div>
<div class="cb"><h3>هل تحتاج مساعدة؟</h3><p>📧 hh92hh@guideon.om &nbsp;&nbsp; 🌐 guideon.om &nbsp;&nbsp; 📱 تواصل عبر واتساب من الموقع</p></div>
`)}

</body></html>`;
}

// ── MAIN ─────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Starting...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  console.log('📸 Rendering mockup pages...');
  for (const [name, html] of Object.entries(MOCKUPS)) {
    const url = writePage(name, html);
    await shot(browser, url, name.replace('.html', '.png'));
  }

  await browser.close();

  // Generate PDF
  console.log('📄 Generating PDF...');
  const pdfHtml = makePdfHtml();
  const pdfHtmlPath = writePage('pdf_doc.html', pdfHtml);

  const browser2 = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });
  const page2 = await browser2.newPage();
  await page2.goto(pdfHtmlPath, { waitUntil: 'networkidle0', timeout: 30000 });
  await page2.pdf({
    path: OUT, format: 'A4', printBackground: true,
    margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
  });
  await browser2.close();

  // Cleanup
  fs.readdirSync(TMP).forEach(f => fs.unlinkSync(path.join(TMP, f)));
  fs.rmdirSync(TMP);

  const size = Math.round(fs.statSync(OUT).size / 1024);
  console.log(`\n✅ PDF: ${OUT}`);
  console.log(`📦 Size: ${size} KB`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
