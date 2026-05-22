#!/usr/bin/env node
/**
 * Generate Word document with new Guideon credentials.
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType,
  HeadingLevel, PageNumber, LevelFormat, PageBreak,
} = require('docx');

const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'new-credentials.json'), 'utf8'));

const teal = '0F7B6C';
const darkText = '1A1A1A';
const muted = '666666';
const lightBg = 'F0F4F3';

const border = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' };
const cellBorders = { top: border, bottom: border, left: border, right: border };

function cell(text, opts = {}) {
  const { bold = false, bg, color = darkText, width = 4680, mono = false } = opts;
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: bg ? { fill: bg, type: ShadingType.CLEAR } : undefined,
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
    children: [new Paragraph({
      children: [new TextRun({
        text, bold, color,
        font: mono ? 'Consolas' : 'Arial',
        size: mono ? 22 : 22,
      })]
    })]
  });
}

function headerRow(...labels) {
  return new TableRow({
    tableHeader: true,
    children: labels.map(label => cell(label, { bold: true, bg: teal, color: 'FFFFFF', width: 9360 / labels.length })),
  });
}

function dataRow(...cells) {
  return new TableRow({
    children: cells.map(c => {
      if (typeof c === 'string') return cell(c, { width: 9360 / cells.length });
      return cell(c.text, { ...c, width: 9360 / cells.length });
    }),
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 240 },
    children: [new TextRun({ text, bold: true, size: 36, color: teal, font: 'Arial' })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, color: darkText, font: 'Arial' })],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, font: 'Arial', size: 22, ...opts })],
  });
}

function spacer() {
  return new Paragraph({ children: [new TextRun({ text: '' })] });
}

const adminTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [3120, 6240],
  rows: [
    new TableRow({
      children: [
        cell('Email', { bold: true, bg: lightBg, width: 3120 }),
        cell(credentials.admin.email, { bold: true, color: teal, mono: true, width: 6240 }),
      ],
    }),
    new TableRow({
      children: [
        cell('Password', { bold: true, bg: lightBg, width: 3120 }),
        cell(credentials.admin.password, { bold: true, color: 'CC0000', mono: true, width: 6240 }),
      ],
    }),
    new TableRow({
      children: [
        cell('Login URL', { bold: true, bg: lightBg, width: 3120 }),
        cell('https://guideon.guide/login.html', { mono: true, width: 6240 }),
      ],
    }),
    new TableRow({
      children: [
        cell('Admin Panel', { bold: true, bg: lightBg, width: 3120 }),
        cell('https://guideon.guide/admin.html', { mono: true, width: 6240 }),
      ],
    }),
  ],
});

const guidesTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [4680, 4680],
  rows: [
    headerRow('Email', 'Password'),
    ...credentials.guides.map(g => new TableRow({
      children: [
        cell(g.email, { mono: true, width: 4680 }),
        cell(g.password, { mono: true, color: 'CC0000', width: 4680 }),
      ],
    })),
  ],
});

const touristsTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [4680, 4680],
  rows: [
    headerRow('Email', 'Password'),
    ...credentials.tourists.map(t => new TableRow({
      children: [
        cell(t.email, { mono: true, width: 4680 }),
        cell(t.password, { mono: true, color: 'CC0000', width: 4680 }),
      ],
    })),
  ],
});

const servicesTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [2340, 7020],
  rows: [
    headerRow('Service', 'URL / Detail'),
    new TableRow({ children: [cell('Live Site', { bold: true, width: 2340 }), cell('https://guideon.guide', { mono: true, color: teal, width: 7020 })] }),
    new TableRow({ children: [cell('Login', { bold: true, width: 2340 }), cell('https://guideon.guide/login.html', { mono: true, width: 7020 })] }),
    new TableRow({ children: [cell('Admin Panel', { bold: true, width: 2340 }), cell('https://guideon.guide/admin.html', { mono: true, width: 7020 })] }),
    new TableRow({ children: [cell('Tourist Register', { bold: true, width: 2340 }), cell('https://guideon.guide/register.html', { mono: true, width: 7020 })] }),
    new TableRow({ children: [cell('GitHub', { bold: true, width: 2340 }), cell('https://github.com/hh95255450hh/guideon', { mono: true, width: 7020 })] }),
    new TableRow({ children: [cell('Railway', { bold: true, width: 2340 }), cell('proactive-perception (production)', { mono: true, width: 7020 })] }),
    new TableRow({ children: [cell('Supabase', { bold: true, width: 2340 }), cell('https://supabase.com/dashboard/project/uwgkszszsogivhphlfdy', { mono: true, width: 7020 })] }),
    new TableRow({ children: [cell('Cloudflare', { bold: true, width: 2340 }), cell('https://dash.cloudflare.com — Zone: guideon.guide', { mono: true, width: 7020 })] }),
    new TableRow({ children: [cell('Resend', { bold: true, width: 2340 }), cell('https://resend.com — Domain: guideon.guide (verified)', { mono: true, width: 7020 })] }),
    new TableRow({ children: [cell('Hostinger', { bold: true, width: 2340 }), cell('Domain registrar (DNS managed by Cloudflare)', { mono: true, width: 7020 })] }),
    new TableRow({ children: [cell('Email From', { bold: true, width: 2340 }), cell('Guideon <noreply@guideon.guide>', { mono: true, width: 7020 })] }),
  ],
});

const doc = new Document({
  creator: 'Claude',
  title: 'Guideon Credentials',
  description: 'Confidential — login credentials and service information',
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, color: teal, font: 'Arial' },
        paragraph: { spacing: { before: 480, after: 240 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, color: darkText, font: 'Arial' },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 1 } },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'CONFIDENTIAL — Guideon', font: 'Arial', size: 18, color: muted, bold: true })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Page ', font: 'Arial', size: 18, color: muted }),
            new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: muted }),
            new TextRun({ text: ' — Generated automatically. Keep this file private.', font: 'Arial', size: 18, color: muted }),
          ],
        })],
      }),
    },
    children: [
      // Title
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 120 },
        children: [new TextRun({ text: 'GUIDEON', bold: true, size: 64, color: teal, font: 'Arial' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: 'Credentials & Access Information', size: 28, color: darkText, font: 'Arial' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 },
        children: [new TextRun({ text: 'Generated: ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), italics: true, size: 20, color: muted, font: 'Arial' })],
      }),

      // Warning box
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [new TableRow({
          children: [new TableCell({
            borders: {
              top: { style: BorderStyle.SINGLE, size: 12, color: 'CC0000' },
              bottom: { style: BorderStyle.SINGLE, size: 12, color: 'CC0000' },
              left: { style: BorderStyle.SINGLE, size: 12, color: 'CC0000' },
              right: { style: BorderStyle.SINGLE, size: 12, color: 'CC0000' },
            },
            width: { size: 9360, type: WidthType.DXA },
            shading: { fill: 'FFF3F3', type: ShadingType.CLEAR },
            margins: { top: 240, bottom: 240, left: 280, right: 280 },
            children: [
              new Paragraph({ children: [new TextRun({ text: 'SECURITY WARNING', bold: true, size: 24, color: 'CC0000', font: 'Arial' })] }),
              new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: 'This file contains sensitive credentials. Store it in a secure location (password manager, encrypted drive). Do NOT share via email or messaging apps in plain text. Delete after memorizing or transferring to a password manager.', size: 20, font: 'Arial' })] }),
            ],
          })],
        })],
      }),

      // Admin
      h1('Admin Account (You)'),
      p('This is your primary administrator account. Use it to manage guides, companies, bookings, and platform settings.'),
      spacer(),
      adminTable,
      spacer(),
      p('How to use: Open the Login URL above, enter the credentials, and you will be redirected to the Admin Panel.', { italics: true, color: muted }),

      // Guides
      h1('Demo Guide Accounts'),
      p('These accounts are pre-loaded test guides. You can either delete them and start fresh, or keep them for testing.'),
      spacer(),
      guidesTable,
      spacer(),
      p('Recommendation: After onboarding your first 3 real guides, delete these test accounts from the Admin Panel.', { italics: true, color: muted }),

      // Tourists
      h1('Demo Tourist Accounts'),
      p('Test tourist accounts. Use these to simulate the booking flow and test guide profiles.'),
      spacer(),
      touristsTable,

      // Services
      h1('Services & Infrastructure'),
      p('Quick reference for all the services that power Guideon.'),
      spacer(),
      servicesTable,

      // Security notes
      h1('Security Notes'),
      h2('Already Protected'),
      new Paragraph({ children: [new TextRun({ text: '• Passwords are bcrypt-hashed (one-way, never stored as plain text)', font: 'Arial', size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: '• HTTPS active via Cloudflare (free SSL)', font: 'Arial', size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: '• Rate limiting on login (5 attempts / 15 min) and registration (3 / hour)', font: 'Arial', size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: '• CSRF protection via Origin header check + SameSite=strict cookies', font: 'Arial', size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: '• DDoS protection via Cloudflare', font: 'Arial', size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: '• Helmet security headers (CSP, X-Frame-Options, etc.)', font: 'Arial', size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: '• Email verification + Password reset flows implemented', font: 'Arial', size: 22 })] }),

      spacer(),
      h2('Recommended Next Steps'),
      new Paragraph({ children: [new TextRun({ text: '1. Enable 2FA for the admin account (planned for next iteration)', font: 'Arial', size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: '2. Add Cloudflare Turnstile (CAPTCHA) to registration form', font: 'Arial', size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: '3. Replace Stripe placeholder keys with real ones before accepting payments', font: 'Arial', size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: '4. Set up Cloudflare Email Routing to receive emails at noreply@guideon.guide', font: 'Arial', size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: '5. Delete demo accounts once real users join', font: 'Arial', size: 22 })] }),

      // Final note
      spacer(),
      spacer(),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [new TableRow({
          children: [new TableCell({
            borders: cellBorders,
            width: { size: 9360, type: WidthType.DXA },
            shading: { fill: lightBg, type: ShadingType.CLEAR },
            margins: { top: 240, bottom: 240, left: 280, right: 280 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Need to change a password?', bold: true, size: 24, color: teal, font: 'Arial' })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: 'Log in → Profile → Change Password. Or use "Forgot password?" on the login page.', size: 20, font: 'Arial' })] }),
            ],
          })],
        })],
      }),
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  const outputPath = path.join(__dirname, '..', 'GUIDEON_Credentials.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log('✓ Created:', outputPath);
  console.log('  Size:', (buffer.length / 1024).toFixed(2), 'KB');
});
