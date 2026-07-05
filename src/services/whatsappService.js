/**
 * WhatsApp notification service.
 * Uses the Meta WhatsApp Business Cloud API (free 1,000 conversations/month tier).
 *
 * Setup (one-time):
 * 1. Visit https://developers.facebook.com/apps
 * 2. Create an app → Business → add WhatsApp product
 * 3. Get your test number and Phone Number ID
 * 4. Generate a permanent access token (System User → WhatsApp Business Account)
 * 5. Set these env vars in /opt/guideon/deploy/.env (ODP server):
 *      WHATSAPP_ACCESS_TOKEN=EAAxxxxx...
 *      WHATSAPP_PHONE_NUMBER_ID=123456789012345
 *      WHATSAPP_ENABLED=true
 * 6. For sending freeform messages, the recipient must have messaged you within
 *    the last 24h, OR you must use a pre-approved template.
 *
 * If WHATSAPP_ENABLED!=true, all calls become no-ops — safe to deploy without
 * breaking anything.
 */

const ENABLED   = process.env.WHATSAPP_ENABLED === 'true';
const TOKEN     = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_ID  = process.env.WHATSAPP_PHONE_NUMBER_ID;
const API_VER   = 'v18.0';

/**
 * Normalize phone to E.164 without "+" (Meta requires this).
 * Examples:
 *   "+968 9525 5450" -> "96895255450"
 *   "00968-9525-5450" -> "96895255450"
 *   "95255450"        -> "96895255450" (default Oman country code)
 */
function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/[\s\-()+]/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.length === 8 && /^[79]/.test(p)) p = '968' + p; // Oman mobile
  if (!/^\d{8,15}$/.test(p)) return null;
  return p;
}

/**
 * Send a freeform text WhatsApp message.
 * Returns null if disabled or invalid number.
 *
 * @param {string} to    — recipient phone number (any format)
 * @param {string} text  — message body
 */
async function sendText(to, text) {
  if (!ENABLED || !TOKEN || !PHONE_ID) return null;
  const phone = normalizePhone(to);
  if (!phone || !text) return null;

  try {
    const res = await fetch(`https://graph.facebook.com/${API_VER}/${PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { preview_url: true, body: text.slice(0, 4096) },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn('[whatsapp] send failed:', data?.error?.message || res.statusText);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[whatsapp] exception:', err.message);
    return null;
  }
}

/**
 * Send a pre-approved template message (required when recipient hasn't messaged
 * you in the last 24h). The template must be created and approved in your Meta
 * Business Manager first.
 *
 * @param {string} to             — recipient phone
 * @param {string} templateName   — template name as registered with Meta
 * @param {string} [langCode]     — default "en"
 * @param {Array}  [params]       — body parameters in order
 */
async function sendTemplate(to, templateName, langCode = 'en', params = []) {
  if (!ENABLED || !TOKEN || !PHONE_ID) return null;
  const phone = normalizePhone(to);
  if (!phone || !templateName) return null;

  try {
    const components = params.length ? [{
      type: 'body',
      parameters: params.map(p => ({ type: 'text', text: String(p) })),
    }] : [];

    const res = await fetch(`https://graph.facebook.com/${API_VER}/${PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: langCode },
          components,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn('[whatsapp] template send failed:', data?.error?.message || res.statusText);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[whatsapp] template exception:', err.message);
    return null;
  }
}

// Verbose send for diagnostics — returns the exact Graph API result/error.
async function sendTextVerbose(to, text) {
  if (!ENABLED) return { ok: false, error: 'WHATSAPP_ENABLED is not true' };
  if (!TOKEN)   return { ok: false, error: 'WHATSAPP_ACCESS_TOKEN missing' };
  if (!PHONE_ID) return { ok: false, error: 'WHATSAPP_PHONE_NUMBER_ID missing' };
  const phone = normalizePhone(to);
  if (!phone) return { ok: false, error: 'Invalid recipient number: ' + to };
  try {
    const res = await fetch(`https://graph.facebook.com/${API_VER}/${PHONE_ID}/messages`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: String(text).slice(0, 4096) } }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error?.message || res.statusText, to: phone, details: data?.error };
    return { ok: true, id: data?.messages?.[0]?.id, to: phone };
  } catch (e) { return { ok: false, error: e.message }; }
}

// Verbose template send for diagnostics — returns the exact Graph API error
// (e.g. "template name does not exist", "not approved", param mismatch).
async function sendTemplateVerbose(to, templateName, langCode = 'ar', params = []) {
  if (!ENABLED) return { ok: false, error: 'WHATSAPP_ENABLED is not true' };
  if (!TOKEN)   return { ok: false, error: 'WHATSAPP_ACCESS_TOKEN missing' };
  if (!PHONE_ID) return { ok: false, error: 'WHATSAPP_PHONE_NUMBER_ID missing' };
  const phone = normalizePhone(to);
  if (!phone) return { ok: false, error: 'Invalid recipient number: ' + to };
  try {
    const components = params.length ? [{
      type: 'body',
      parameters: params.map(p => ({ type: 'text', text: String(p) })),
    }] : [];
    const res = await fetch(`https://graph.facebook.com/${API_VER}/${PHONE_ID}/messages`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: phone, type: 'template',
        template: { name: templateName, language: { code: langCode }, components },
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, template: templateName, lang: langCode, error: data?.error?.message || res.statusText, code: data?.error?.code, details: data?.error?.error_data };
    return { ok: true, id: data?.messages?.[0]?.id, to: phone, template: templateName };
  } catch (e) { return { ok: false, error: e.message }; }
}

function config() { return { enabled: ENABLED, hasToken: !!TOKEN, phoneNumberId: PHONE_ID || null, templateName: process.env.WHATSAPP_TEMPLATE_NAME || null, templateLang: process.env.WHATSAPP_TEMPLATE_LANG || null }; }
function isEnabled() { return ENABLED && !!TOKEN && !!PHONE_ID; }

if (!ENABLED) {
  console.log('[whatsapp] disabled — set WHATSAPP_ENABLED=true + tokens in env to enable.');
}

module.exports = { sendText, sendTemplate, sendTextVerbose, sendTemplateVerbose, config, isEnabled, normalizePhone };
