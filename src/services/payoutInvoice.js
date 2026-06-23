/**
 * payoutInvoice — auto-issue a guide/company payout invoice when a booking is
 * completed, so the platform always knows the exact net amount owed to each
 * provider (gross − platform commission).
 *
 * Idempotent per booking (keyed on invoices.bookingId). Never throws into the
 * caller — settling a booking must not fail because invoicing hiccuped.
 */
const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');
const commission = require('./commission');

const invoices = new SupabaseDB('invoices');
const users    = new SupabaseDB('users');
const bookings = new SupabaseDB('bookings');

const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

// Columns that may be absent on older deployments — strip & retry (resilient write).
const OPTIONAL_INV_COLS = ['bookingId', 'kind', 'gross', 'commission', 'net', 'paidOutAt', 'vatRate'];
const isMissingCol = (m) => /Could not find the '\w+' column|column \S+ does not exist|schema cache/i.test(m || '');
async function insertSafe(row) {
  try { return await invoices.insert(row); }
  catch (e) {
    if (isMissingCol(e.message)) {
      const clean = { ...row }; OPTIONAL_INV_COLS.forEach(c => delete clean[c]);
      return await invoices.insert(clean);
    }
    throw e;
  }
}

/**
 * Create the payout invoice for a completed, paid booking. Returns the invoice
 * row (existing or new), or null if it doesn't apply.
 */
async function createForCompletedBooking(bookingId) {
  try {
    const b = await bookings.findById(bookingId);
    if (!b || b.status !== 'completed' || !b.isPaid || b.totalAmount == null) return null;

    // Idempotent: one payout invoice per booking.
    const existing = await invoices.findAllByField('bookingId', bookingId).catch(() => []);
    if (existing && existing.length) return existing[0];

    const guide = await users.findById(b.guideId);
    if (!guide) return null;

    const RATES = await commission.getRates();
    const rate  = commission.rateFor(guide, RATES);
    const gross = r3(b.totalAmount);
    const comm  = r3(gross * rate);
    const net   = r3(gross - comm);
    const pct   = Math.round(rate * 100);

    const row = {
      id: 'inv-' + uuidv4().slice(0, 10),
      number: 'PAY-' + String(b.id).replace(/^bk-/, '').toUpperCase(),
      recipientId:   guide.id,
      recipientName: guide.companyName || guide.fullName || 'Provider',
      recipientType: guide.userType || 'guide',
      items: [
        { desc: `رحلة ${b.destination || ''} — ${b.tourDate || ''} · Tour`, amount: gross },
        { desc: `عمولة المنصّة (${pct}%) · Platform commission`,            amount: -comm },
      ],
      subtotal: gross,
      vatRate: 0,
      vat: 0,
      total: net,
      kind: 'payout',
      gross, commission: comm, net,
      bookingId,
      note: `صافي مستحقّ المزوّد عن رحلة مكتملة — الحجز ${b.id}.`,
      createdBy: 'system',
      createdAt: new Date().toISOString(),
    };
    await insertSafe(row);
    console.log(`[payoutInvoice] ${row.number} for ${row.recipientName}: net ${net} (gross ${gross} − comm ${comm})`);
    return row;
  } catch (e) {
    console.error('[payoutInvoice] failed for', bookingId, '—', e.message);
    return null;
  }
}

module.exports = { createForCompletedBooking };
