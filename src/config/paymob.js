/**
 * paymob.js — client for Paymob Accept (Oman) — oman.paymob.com.
 *
 * Classic 3-step flow:
 *   1) auth()                → auth token
 *   2) createOrder()         → Paymob order id (idempotent via merchant id)
 *   3) paymentKey()          → payment token for the hosted iframe
 *   4) redirect to checkoutUrl(paymentToken)
 *   5) Paymob calls our webhook → verifyHmac() then settle the booking
 *
 * Amounts are in the smallest unit. OMR is a 1000-subunit (baisa) currency,
 * so amount_cents = OMR × 1000 (3 decimals), same as Thawani.
 *
 * Required env (set on the server, never in code):
 *   PAYMOB_API_KEY          secret API key (Settings → Account Info)
 *   PAYMOB_INTEGRATION_ID   online-card integration id (Developers → Integrations)
 *   PAYMOB_IFRAME_ID        hosted checkout iframe id (Developers → iframes)
 *   PAYMOB_HMAC_SECRET      callback HMAC secret (Settings → Account Info)
 *   PAYMOB_CURRENCY         defaults to OMR
 */
const crypto = require('crypto');

const BASE = process.env.PAYMOB_BASE_URL || 'https://oman.paymob.com/api';
const API_KEY        = process.env.PAYMOB_API_KEY || '';
const INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID || '';
const IFRAME_ID      = process.env.PAYMOB_IFRAME_ID || '';
const HMAC_SECRET     = process.env.PAYMOB_HMAC_SECRET || '';
const CURRENCY       = process.env.PAYMOB_CURRENCY || 'OMR';

function configured() {
  return !!(API_KEY && INTEGRATION_ID && IFRAME_ID && HMAC_SECRET);
}

async function call(method, path, body, headers) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : {}; }
  catch { throw new Error(`Paymob returned non-JSON (${res.status}): ${text.slice(0, 200)}`); }
  if (!res.ok) throw new Error(json.message || json.detail || `Paymob API error (${res.status})`);
  return json;
}

// 1) authentication token
async function auth() {
  const json = await call('POST', '/auth/tokens', { api_key: API_KEY });
  if (!json.token) throw new Error('Paymob auth returned no token.');
  return json.token;
}

// 2) register an order. merchantOrderId makes it traceable back to our booking.
async function createOrder(token, amountCents, merchantOrderId) {
  const json = await call('POST', '/ecommerce/orders', {
    auth_token: token,
    delivery_needed: false,
    amount_cents: amountCents,
    currency: CURRENCY,
    merchant_order_id: merchantOrderId,
    items: [],
  });
  if (!json.id) throw new Error('Paymob order creation returned no id.');
  return json.id;
}

// 3) payment key (token) for the hosted iframe
async function paymentKey(token, amountCents, orderId, billing) {
  const json = await call('POST', '/acceptance/payment_keys', {
    auth_token: token,
    amount_cents: amountCents,
    expiration: 3600,
    order_id: orderId,
    currency: CURRENCY,
    integration_id: Number(INTEGRATION_ID),
    billing_data: {
      first_name: billing.firstName || 'Guideon',
      last_name:  billing.lastName  || 'Customer',
      email:      billing.email     || 'customer@guideon.om',
      phone_number: billing.phone   || '+96800000000',
      country: 'OMN', city: 'Muscat', street: 'NA', building: 'NA',
      floor: 'NA', apartment: 'NA', postal_code: 'NA', state: 'NA',
    },
  });
  if (!json.token) throw new Error('Paymob payment_key returned no token.');
  return json.token;
}

function checkoutUrl(paymentToken) {
  return `${BASE}/acceptance/iframes/${IFRAME_ID}?payment_token=${encodeURIComponent(paymentToken)}`;
}

// Retrieve a transaction (server-side source of truth on callback).
async function getTransaction(token, transactionId) {
  return call('GET', `/acceptance/transactions/${encodeURIComponent(transactionId)}`, null,
    { Authorization: `Bearer ${token}` });
}

// OMR → baisa integer
function toCents(omr) { return Math.round(parseFloat(omr) * 1000); }

/**
 * Verify a Paymob callback HMAC (SHA512 over a fixed field order). `obj` is the
 * transaction object (from the webhook body's `obj`). Returns true if valid.
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

module.exports = {
  configured, auth, createOrder, paymentKey, checkoutUrl, getTransaction,
  toCents, verifyHmac, CURRENCY,
};
