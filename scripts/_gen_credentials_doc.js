// Generates a Word (.docx) credentials reference for GUIDEON.
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
} = require('docx');

const TEAL = '0F7B6C';
const DARK = '0F1C3E';
const RED = 'B00020';

function ar(text, opts = {}) {
  return new TextRun({ text, rightToLeft: true, font: 'Arial', size: opts.size || 22, bold: !!opts.bold, color: opts.color });
}
function en(text, opts = {}) {
  return new TextRun({ text, font: 'Consolas', size: opts.size || 22, bold: !!opts.bold, color: opts.color });
}
function pAr(children, opts = {}) {
  return new Paragraph({ alignment: AlignmentType.RIGHT, bidirectional: true, spacing: { after: opts.after ?? 80 }, children });
}
function heading(text) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT, bidirectional: true,
    spacing: { before: 240, after: 120 },
    border: { bottom: { color: TEAL, style: BorderStyle.SINGLE, size: 8 } },
    children: [new TextRun({ text, rightToLeft: true, font: 'Arial', size: 28, bold: true, color: TEAL })],
  });
}

// label/value rows as a 2-column table
function kvTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    rows: rows.map(([label, value, color]) => new TableRow({
      children: [
        new TableCell({
          width: { size: 62, type: WidthType.PERCENTAGE },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, bidirectional: true,
            children: [ new TextRun({ text: value, font: 'Consolas', size: 22, bold: true, color: color || '000000' }) ] })],
        }),
        new TableCell({
          width: { size: 38, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: 'EAF5F3' },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, bidirectional: true,
            children: [ new TextRun({ text: label, rightToLeft: true, font: 'Arial', size: 22, bold: true, color: DARK }) ] })],
        }),
      ],
    })),
  });
}

const doc = new Document({
  creator: 'Guideon', title: 'Guideon — Credentials',
  sections: [{
    properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
        children: [new TextRun({ text: 'GUIDEON', font: 'Arial', size: 48, bold: true, color: TEAL })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
        children: [new TextRun({ text: 'بيانات الدخول والحسابات الرسمية', rightToLeft: true, font: 'Arial', size: 28, bold: true, color: DARK })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
        children: [new TextRun({ text: 'Official Accounts & Login Credentials', font: 'Arial', size: 18, color: '777777' })] }),

      // Security warning
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, visuallyRightToLeft: true,
        rows: [new TableRow({ children: [new TableCell({
          shading: { type: ShadingType.CLEAR, fill: 'FDECEA' },
          margins: { top: 100, bottom: 100, left: 150, right: 150 },
          children: [
            pAr([ new TextRun({ text: '⚠ تنبيه أمني', rightToLeft: true, font: 'Arial', size: 24, bold: true, color: RED }) ], { after: 60 }),
            pAr([ ar('هذا الملف يحتوي بيانات حسّاسة. لا ترسله بالبريد ولا تشاركه، ولا ترفعه على الإنترنت. احتفظ بنسخة آمنة فقط.') ]),
          ],
        })] })],
      }),
      new Paragraph({ spacing: { after: 120 }, children: [] }),

      // 1. Admin panel
      heading('١) لوحة تحكم الأدمن (Admin Panel)'),
      kvTable([
        ['الرابط', 'https://guideon.om/login.html', TEAL],
        ['البريد (اسم المستخدم)', 'hh92hh@guideon.om'],
        ['كلمة المرور', 'Hh92Admin@2026  (قيد التفعيل)', RED],
        ['النوع', 'admin — صلاحيات كاملة'],
      ]),
      pAr([ ar('ملاحظة: كلمة المرور أعلاه هي القيمة المقترحة. يلزم تشغيل خطوة إعادة تعيين واحدة لتفعيلها (راجع المطوّر).', { size: 18, color: '777777' }) ], { after: 120 }),

      // 2. Google / Play
      heading('٢) حساب Google و Play Console'),
      kvTable([
        ['البريد', 'Hh95255450hh@hotmail.com'],
        ['كلمة المرور', 'كلمتك الخاصة — أدخلها بنفسك (غير محفوظة هنا)', '777777'],
        ['Play Console', 'https://play.google.com/console', TEAL],
        ['رسوم المطوّر', '25 USD — لمرة واحدة'],
        ['التحقق بخطوتين', 'مطلوب قبل إنشاء حساب المطوّر'],
      ]),

      // 3. Domain
      heading('٣) النطاق (Domain)'),
      kvTable([
        ['النطاق الرسمي', 'guideon.om', TEAL],
        ['المُسجّل', 'Otech — Oman Data Park (منصة .om)'],
        ['DNS', 'A record → 185.64.25.111'],
      ]),

      // 4. Hosting
      heading('٤) الاستضافة (Hosting)'),
      kvTable([
        ['المزوّد', 'Oman Data Park — VPS (185.64.25.111)'],
        ['النشر', 'SSH ثم: bash /opt/deploy.sh  (nginx + Docker Compose)'],
        ['الموقع المباشر', 'https://guideon.om', TEAL],
      ]),

      // 5. Database
      heading('٥) قاعدة البيانات (Supabase)'),
      kvTable([
        ['معرّف المشروع', 'uwgkszszsogivhphlfdy'],
        ['المنطقة', 'eu-central-1'],
        ['لوحة التحكم', 'https://supabase.com/dashboard', TEAL],
      ]),

      // 6. Email
      heading('٦) البريد الرسمي (Microsoft 365)'),
      kvTable([
        ['الباقة', 'Business Basic'],
        ['البريد المخطط', 'contact@guideon.om / info@guideon.om'],
        ['الحالة', 'بانتظار موافقة المزوّد', RED],
      ]),

      // 7. Android app
      heading('٧) تطبيق Android'),
      kvTable([
        ['اسم الحزمة (Package)', 'guide.guideon.twa'],
        ['assetlinks.json', 'منشور على guideon.om ✓', TEAL],
        ['رابط المتجر (بعد النشر)', 'play.google.com/store/apps/details?id=guide.guideon.twa'],
      ]),
      pAr([ ar('⚠ ملف التوقيع signing.keystore + كلمته: احفظهما للأبد — بدونهما لا يمكن تحديث التطبيق إطلاقاً.', { color: RED, bold: true }) ], { after: 120 }),

      // 8. System secrets
      heading('٨) أسرار النظام (.env)'),
      pAr([ ar('مفاتيح الخدمات (Stripe, Resend, Firebase, JWT, كلمة قاعدة البيانات) مخزّنة بأمان داخل ملف .env فقط، ولم تُكرَّر هنا لأسباب أمنية. لا تنسخها إلى ملفات أو رسائل.') ]),

      new Paragraph({ spacing: { before: 300 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'تاريخ التحديث: 2026-05-30  •  Guideon', rightToLeft: true, font: 'Arial', size: 16, color: '999999' })] }),
    ],
  }],
});

const outPath = process.argv[2] || path.join(require('os').homedir(), 'OneDrive', 'Desktop', 'GUIDEON_Credentials.docx');
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outPath, buf);
  console.log('WROTE:', outPath, '(' + buf.length + ' bytes)');
}).catch(e => { console.error('ERR', e.message); process.exit(1); });
