/**
 * thawani.js — minimal client for the Thawani Pay API (Oman).
 *
 * Thawani is Oman's leading payment gateway (cards + Thawani wallet).
 * Amounts are in BAISA — 1 OMR = 1000 baisa — and must be integers.
 *
 * Required env vars (set in Railway when going live):
 *   THAWANI_MODE             'test' (default) | 'live'
 *   THAWANI_API_KEY          secret API key  (server-side only, never exposed)
 *   THAWANI_PUBLISHABLE_KEY  publishable key (used in the redirect URL)
 *   PAYMENTS_ENABLED         'true' to switch the Pay Now flow on
 *
 * Docs: https://thawani-technologies.stoplight.io/
 */

const MODE = (process.env.THAWANI_MODE || 'test').toLowerCase();
const IS_LIVE = MODE === 'live';

// API base + the customer-facing checkout host differ between UAT and prod.
const API_BASE = IS_LIVE
  ? 'https://checkout.thawani.om/api/v1'
  : 'https://uatcheckout.thawani.om/api/v1';

const PAY_HOST = IS_LIVE
  ? 'https://checkout.thawani.om'
  : 'https://uatcheckout.thawani.om';

const API_KEY        = process.env.THAWANI_API_KEY || '';
const PUBLISHABLE_KEY = process.env.THAWANI_PUBLISHABLE_KEY || '';

function configured() {
  return !!(API_KEY && PUBLISHABLE_KEY);
}

async function call(method, path, body) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'thawani-api-key': API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; }
  catch { throw new Error(`Thawani returned non-JSON (${res.status}): ${text.slice(0, 200)}`); }
  if (!res.ok || json.success === false) {
    throw new Error(json.description || json.message || `Thawani API error (${res.status})`);
  }
  return json;
}

/**
 * Create a checkout session.
 * @returns {Promise<{ sessionId: string, payUrl: string }>}
 */
async function createSession({ clientReferenceId, products, successUrl, cancelUrl, metadata }) {
  const json = await call('POST', '/checkout/session', {
    client_reference_id: clientReferenceId,
    mode: 'payment',
    products,                 // [{ name, quantity, unit_amount(baisa) }]
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: metadata || {},
  });
  const sessionId = json.data?.session_id;
  if (!sessionId) throw new Error('Thawani did not return a session_id.');
  return {
    sessionId,
    payUrl: `${PAY_HOST}/pay/${sessionId}?key=${PUBLISHABLE_KEY}`,
  };
}

/**
 * Retrieve a session to check its payment status.
 * @returns {Promise<{ status: string, raw: object }>}
 *   status is one of: 'paid' | 'unpaid' | 'cancelled'
 */
async function retrieveSession(sessionId) {
  const json = await call('GET', `/checkout/session/${encodeURIComponent(sessionId)}`);
  return { status: json.data?.payment_status || 'unknown', raw: json.data || {} };
}

// OMR → baisa (integer)
function toBaisa(omr) {
  return Math.round(parseFloat(omr) * 1000);
}

module.exports = {
  MODE, IS_LIVE, configured,
  createSession, retrieveSession, toBaisa,
};
