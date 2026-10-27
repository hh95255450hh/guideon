/**
 * WhatsApp notification service — two providers behind one switch.
 *
 *   WHATSAPP_PROVIDER=meta    → Meta WhatsApp Business Cloud API (default)
 *   WHATSAPP_PROVIDER=twilio  → Twilio WhatsApp API
 *
 * The public API (sendText / sendTemplate / …) is identical for both, so no
 * caller changes when the provider is switched; only env vars change.
 *
 * ── Meta setup ──
 *   WHATSAPP_ENABLED=true
 *   WHATSAPP_ACCESS_TOKEN=EAAxxxx…          (permanent System User token)
 *   WHATSAPP_PHONE_NUMBER_ID=1234567890
 *
 * ── Twilio setup ──
 *   WHATSAPP_ENABLED=true
 *   WHATSAPP_PROVIDER=twilio
 *   TWILIO_ACCOUNT_SID=ACxxxx…
 *   TWILIO_AUTH_TOKEN=…                     (never commit it; server .env only)
 *   TWILIO_WHATSAPP_FROM=+14155238886       (sandbox number, or an approved sender)
 *   TWILIO_MESSAGING_SERVICE_SID=MGxxxx…    (optional, used instead of FROM)
 *
 * Twilio notes: on a trial account the recipient must first join the sandbox
 * ("join <code>" to the sandbox number), and templates are Content SIDs (HX…)
 * created in Twilio, not Meta template names.
 *
 * With WHATSAPP_ENABLED!=true every call is a no-op, so deploying is always safe.
 */

const ENABLED  = process.env.WHATSAPP_ENABLED === 'true';
const PROVIDER = (process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase() === 'twilio' ? 'twilio' : 'meta';

// Meta
const TOKEN    = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const API_VER  = 'v18.0';

// Twilio
const TW_SID   = process.env.TWILIO_ACCOUNT_SID;
const TW_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TW_FROM  = process.env.TWILIO_WHATSAPP_FROM;
const TW_MSID  = process.env.TWILIO_MESSAGING_SERVICE_SID;

/**
 * Normalize phone to E.164 digits, no "+".
 *   "+968 9525 5450" → "96895255450"
 *   "00968-9525-5450" → "96895255450"
 *   "95255450"        → "96895255450" (Oman default)
 */
function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/[\s\-()+]/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.length === 8 && /^[79]/.test(p)) p = '968' + p; // Oman mobile
  if (!/^\d{8,15}$/.test(p)) return null;
  return p;
}

// Twilio addresses carry the "whatsapp:+" prefix; Meta wants bare digits.
const waAddr = digits => 'whatsapp:+' + String(digits).replace(/^\+/, '');

/** Why the configured provider cannot send, or null when it is ready. */
function notReady() {
  if (!ENABLED) return 'WHATSAPP_ENABLED is not true';
  if (PROVIDER === 'twilio') {
    if (!TW_SID)   return 'TWILIO_ACCOUNT_SID missing';
    if (!TW_TOKEN) return 'TWILIO_AUTH_TOKEN missing';
    if (!TW_FROM && !TW_MSID) return 'TWILIO_WHATSAPP_FROM or TWILIO_MESSAGING_SERVICE_SID missing';
    return null;
  }
  if (!TOKEN)    return 'WHATSAPP_ACCESS_TOKEN missing';
  if (!PHONE_ID) return 'WHATSAPP_PHONE_NUMBER_ID missing';
  return null;
}

// ── Twilio transport ──────────────────────────────────────────────────────
async function twilioSend(fields) {
  const body = new URLSearchParams(
    TW_MSID ? { MessagingServiceSid: TW_MSID, ...fields } : { From: waAddr(TW_FROM.replace(/^whatsapp:/, '')), ...fields }
  );
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TW_SID)}/Messages.json`, {
    method: 'POST',
    headers: {
      // Basic auth; the token never appears in a URL or a log line.
      Authorization: 'Basic ' + Buffer.from(`${TW_SID}:${TW_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.message || res.statusText, code: data?.code, details: data?.more_info };
  return { ok: true, id: data.sid, status: data.status };
}

// ── Meta transport ────────────────────────────────────────────────────────
async function metaSend(payload) {
  const res = await fetch(`https://graph.facebook.com/${API_VER}/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error?.message || res.statusText, code: data?.error?.code, details: data?.error?.error_data };
  return { ok: true, id: data?.messages?.[0]?.id };
}

/** Freeform text. Returns a result object, or an error object — never throws. */
async function sendTextVerbose(to, text) {
  const why = notReady();
  if (why) return { ok: false, error: why, provider: PROVIDER };
  const phone = normalizePhone(to);
  if (!phone) return { ok: false, error: 'Invalid recipient number: ' + to, provider: PROVIDER };
  const body = String(text || '').slice(0, 4096);
  if (!body) return { ok: false, error: 'Empty message', provider: PROVIDER };
  try {
    const r = PROVIDER === 'twilio'
      ? await twilioSend({ To: waAddr(phone), Body: body })
      : await metaSend({ to: phone, type: 'text', text: { preview_url: true, body } });
    return { ...r, to: phone, provider: PROVIDER };
  } catch (e) {
    return { ok: false, error: e.message, provider: PROVIDER };
  }
}

/**
 * Pre-approved template, for recipients outside the 24-hour window.
 * Meta  : templateName = template name, params fill {{1}}, {{2}}, … in order.
 * Twilio: templateName = Content SID (HX…), params become ContentVariables.
 */
async function sendTemplateVerbose(to, templateName, langCode = 'ar', params = []) {
  const why = notReady();
  if (why) return { ok: false, error: why, provider: PROVIDER };
  const phone = normalizePhone(to);
  if (!phone) return { ok: false, error: 'Invalid recipient number: ' + to, provider: PROVIDER };
  if (!templateName) return { ok: false, error: 'Template name/SID missing', provider: PROVIDER };
  try {
    let r;
    if (PROVIDER === 'twilio') {
      const vars = {};
      params.forEach((p, i) => { vars[String(i + 1)] = String(p); });
      r = await twilioSend({
        To: waAddr(phone),
        ContentSid: templateName,
        ...(params.length ? { ContentVariables: JSON.stringify(vars) } : {}),
      });
    } else {
      const components = params.length
        ? [{ type: 'body', parameters: params.map(p => ({ type: 'text', text: String(p) })) }]
        : [];
      r = await metaSend({ to: phone, type: 'template', template: { name: templateName, language: { code: langCode }, components } });
    }
    return { ...r, to: phone, template: templateName, provider: PROVIDER };
  } catch (e) {
    return { ok: false, error: e.message, provider: PROVIDER };
  }
}

// Quiet wrappers used by the notification paths: never throw, never block.
async function sendText(to, text) {
  const r = await sendTextVerbose(to, text);
  if (!r.ok && ENABLED) console.warn(`[whatsapp:${PROVIDER}] send failed:`, r.error);
  return r.ok ? r : null;
}
async function sendTemplate(to, templateName, langCode = 'en', params = []) {
  const r = await sendTemplateVerbose(to, templateName, langCode, params);
  if (!r.ok && ENABLED) console.warn(`[whatsapp:${PROVIDER}] template send failed:`, r.error);
  return r.ok ? r : null;
}

function config() {
  return {
    provider: PROVIDER,
    enabled: ENABLED,
    ready: !notReady(),
    reason: notReady(),
    // Identifiers only — never the token itself.
    ...(PROVIDER === 'twilio'
      ? { accountSid: TW_SID ? TW_SID.slice(0, 8) + '…' : null, from: TW_FROM || null, messagingServiceSid: TW_MSID || null, hasToken: !!TW_TOKEN }
      : { phoneNumberId: PHONE_ID || null, hasToken: !!TOKEN }),
    templateName: process.env.WHATSAPP_TEMPLATE_NAME || null,
    templateLang: process.env.WHATSAPP_TEMPLATE_LANG || null,
  };
}
function isEnabled() { return !notReady(); }

if (!ENABLED) {
  console.log('[whatsapp] disabled — set WHATSAPP_ENABLED=true + provider credentials in env to enable.');
} else {
  const why = notReady();
  console.log(why ? `[whatsapp:${PROVIDER}] not ready — ${why}` : `[whatsapp:${PROVIDER}] ready`);
}

module.exports = { sendText, sendTemplate, sendTextVerbose, sendTemplateVerbose, config, isEnabled, normalizePhone, PROVIDER };
