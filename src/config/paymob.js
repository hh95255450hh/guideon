/**
 * paymob.js — Paymob Accept (Oman) via the modern **Unified Checkout**
 * (Intention API). oman.paymob.com.
 *
 * Flow:
 *   1) createIntention()  → POST /v1/intention/ (Secret Key)  → client_secret
 *   2) redirect to checkoutUrl(client_secret)  (Public Key)
 *   3) Paymob → our notification_url (webhook) → verifyHmac() then settle
 *
 * Amounts are in the smallest unit. OMR is a 1000-subunit (baisa) currency,
 * so amount = OMR × 1000 (3 decimals), same as Thawani.
 *
 * Required env (set on the server, never in code):
 *   PAYMOB_SECRET_KEY      sk_... (Settings → Account Info → Secret Key)
 *   PAYMOB_PUBLIC_KEY      pk_... (Settings → Account Info → Public Key)
 *   PAYMOB_INTEGRATION_ID  online-card integration id (Developers → Payment Integrations)
 *   PAYMOB_HMAC_SECRET     callback HMAC secret (Settings → Account Info)
 *   PAYMOB_CURRENCY        defaults to OMR
 */
const crypto = require('crypto');

const HOST = process.env.PAYMOB_HOST || 'https://oman.paymob.com';
const INTENTION_URL = `${HOST}/v1/intention/`;
const CHECKOUT_URL  = process.env.PAYMOB_CHECKOUT_URL || `${HOST}/unifiedcheckout/`;

const SECRET_KEY     = process.env.PAYMOB_SECRET_KEY || '';
const PUBLIC_KEY     = process.env.PAYMOB_PUBLIC_KEY || '';
const INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID || '';
const HMAC_SECRET    = process.env.PAYMOB_HMAC_SECRET || '';
const CURRENCY       = process.env.PAYMOB_CURRENCY || 'OMR';

function configured() {
  return !!(SECRET_KEY && PUBLIC_KEY && INTEGRATION_ID && HMAC_SECRET);
}

/**
 * Create a payment intention and return its client_secret.
 * @returns {Promise<{ clientSecret: string, intentionId: string }>}
 */
async function createIntention({ amountCents, merchantOrderId, billing, notificationUrl, redirectionUrl }) {
  const b = billing || {};
  const body = {
    amount: amountCents,
    currency: CURRENCY,
    payment_methods: [Number(INTEGRATION_ID)],
    items: [{ name: 'Guideon tour booking', amount: amountCents, quantity: 1 }],
    billing_data: {
      first_name: b.firstName || 'Guideon',
      last_name:  b.lastName  || 'Customer',
      email:      b.email     || 'customer@guideon.om',
      phone_number: b.phone   || '+96800000000',
      country: 'OMN', city: 'Muscat', state: 'Muscat',
      street: 'NA', building: 'NA', floor: 'NA', apartment: 'NA',
    },
    special_reference: merchantOrderId,
    notification_url: notificationUrl,
    redirection_url:  redirectionUrl,
  };
  const res = await fetch(INTENTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Token ${SECRET_KEY}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : {}; }
  catch { throw new Error(`Paymob returned non-JSON (${res.status}): ${text.slice(0, 200)}`); }
  if (!res.ok || !json.client_secret) {
    const msg = json.detail || json.message || (json.errors && JSON.stringify(json.errors)) || `Paymob intention error (${res.status})`;
    throw new Error(msg);
  }
  return { clientSecret: json.client_secret, intentionId: json.id };
}

function checkoutUrl(clientSecret) {
  return `${CHECKOUT_URL}?publicKey=${encodeURIComponent(PUBLIC_KEY)}&clientSecret=${encodeURIComponent(clientSecret)}`;
}

// OMR → baisa integer
function toCents(omr) { return Math.round(parseFloat(omr) * 1000); }

/**
 * Verify a Paymob callback HMAC (SHA512 over a fixed field order). `obj` is the
 * transaction object (the webhook body's `obj`). Returns true if valid.
 */
function verifyHmac(obj, hmac) {
  if (!HMAC_SECRET || !hmac || !obj) return false;
  const g = (p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  const fields = [
    'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction',
    'id', 'integration_id', 'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded',
    'is_standalone_payment', 'is_voided', 'order.id', 'owner', 'pending',
    'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success',
  ];
  const concat = fields.map((f) => {
    const v = g(f);
    return v === undefined || v === null ? '' : String(v);
  }).join('');
  const digest = crypto.createHmac('sha512', HMAC_SECRET).update(concat).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(String(hmac))); }
  catch { return false; }
}

module.exports = { configured, createIntention, checkoutUrl, toCents, verifyHmac, CURRENCY };
