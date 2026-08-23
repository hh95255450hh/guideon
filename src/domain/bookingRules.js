/**
 * Booking domain rules — PURE functions, no I/O, no DB, no req/res.
 *
 * These encode the business rules for availability, slot conflicts and
 * server-authoritative pricing. Being pure, they are trivially unit-testable
 * and reusable across the REST controller, webhooks and future schedulers.
 */

const VALID_TOUR_TIMES = ['morning', 'afternoon', 'full_day'];

function normalizeTourTime(tourTime) {
  return VALID_TOUR_TIMES.includes(tourTime) ? tourTime : 'full_day';
}

// Which slot keys conflict with the requested tourTime
function conflictingSlots(tourTime) {
  if (tourTime === 'morning')   return ['morning', 'full_day'];
  if (tourTime === 'afternoon') return ['afternoon', 'full_day'];
  return ['morning', 'afternoon', 'full_day']; // full_day conflicts with everything
}

// Does the guide's availability array include the requested slot?
function guideHasSlot(availability, tourDate, tourTime) {
  if (availability.includes(`${tourDate}_${tourTime}`)) return true;
  if (tourTime !== 'full_day' && availability.includes(`${tourDate}_full_day`)) return true;
  if (availability.includes(tourDate)) return true; // legacy plain-date = full_day
  return false;
}

// Remove booked slot(s) from a guide availability array
function removeSlotFromAvailability(availability, tourDate, tourTime) {
  const toRemove = new Set();
  if (tourTime === 'morning' || tourTime === 'full_day') {
    toRemove.add(`${tourDate}_morning`);
    toRemove.add(tourDate);
  }
  if (tourTime === 'afternoon' || tourTime === 'full_day') {
    toRemove.add(`${tourDate}_afternoon`);
    toRemove.add(tourDate);
  }
  if (tourTime === 'full_day') {
    toRemove.add(`${tourDate}_full_day`);
  }
  return availability.filter(a => !toRemove.has(a));
}

// Do two time ranges [aStart,aEnd) and [bStart,bEnd) overlap?
function timeRangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// Optimistic-concurrency decision: given every active conflicting booking
// (each { id, createdAt }) competing for a provider's capacity, return the set
// of booking ids that win the slots — the earliest `capacity` by createdAt,
// breaking ties on id. Deterministic, so two racing requests independently
// agree on who keeps the slot and who must roll back. Infinite capacity keeps
// everyone.
function bookingsWithinCapacity(conflicts, capacity) {
  if (!Number.isFinite(capacity)) return new Set(conflicts.map(b => b.id));
  const ordered = [...conflicts].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    if (ta !== tb) return ta - tb;
    return String(a.id) < String(b.id) ? -1 : 1;
  });
  return new Set(ordered.slice(0, Math.max(0, capacity)).map(b => b.id));
}

// ── Date / timezone helpers (Oman = UTC+4, no DST) ──────────────────────────
// Tour dates are stored as plain 'YYYY-MM-DD' strings. We interpret them in
// Oman local time so "today", the 48h cancellation window and the earliest
// trip-start check stay correct regardless of the server's own timezone.

// True only for a real calendar date in strict 'YYYY-MM-DD' form
// (rejects '2026-02-31', '2026-13-01', malformed/empty input).
function isValidDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Midnight (start) of an Oman calendar date, as a Date instant.
function omanDateStart(s) {
  return new Date(`${s}T00:00:00+04:00`);
}

// Today's Oman calendar date as 'YYYY-MM-DD' for a given instant (default now).
function omanToday(now = new Date()) {
  return new Date(now.getTime() + 4 * 3600 * 1000).toISOString().slice(0, 10);
}

// Is the tour date strictly before today (Oman)?
function isPastDate(dateStr, now = new Date()) {
  return dateStr < omanToday(now);
}

// Hours from `now` until the start of the Oman tour date (can be negative).
function hoursUntilDate(dateStr, now = new Date()) {
  return (omanDateStart(dateStr).getTime() - now.getTime()) / 36e5;
}

/**
 * Cost of the adult party from a group-size tier table.
 *   tiers: [{ from, to|null, price, mode: 'flat' | 'per_person' }]
 *   - the bracket is chosen by the adult count (from ≤ adults ≤ to, to=null = open-ended)
 *   - mode 'flat'       → price is the TOTAL for the whole adult party in that bracket
 *   - mode 'per_person' → price is multiplied by the adult count
 * Returns a finite number, or null when no bracket matches (caller decides).
 */
function priceFromTiers(tiers, adults) {
  if (!Array.isArray(tiers) || !tiers.length || adults <= 0) return null;
  const sorted = tiers
    .map(t => ({ from: parseInt(t.from) || 0, to: (t.to === null || t.to === '' || t.to === undefined) ? null : parseInt(t.to),
                 price: parseFloat(t.price) || 0, mode: t.mode === 'per_person' ? 'per_person' : 'flat' }))
    .sort((a, b) => a.from - b.from);
  const tier = sorted.find(t => adults >= t.from && (t.to === null || adults <= t.to));
  if (!tier) return null;
  return tier.mode === 'per_person' ? tier.price * adults : tier.price;
}

/**
 * Server-authoritative package pricing. Two models, chosen by pricing_mode:
 *
 *  'tiered' — group-size brackets on the ADULT count + per-child + free-infant:
 *     pricing_tiers = [{from,to,price,mode}]  (see priceFromTiers)
 *     child_price    = price per child (child_age_min..child_age_max)
 *     free_under_age = infants below this age are free and excluded from pax
 *   Mirrors how companies price on TripAdvisor (e.g. 1-2 = 6 OMR flat,
 *   3-4 = 8, 8+ = 1.5/person; child = 2; under 6 free).
 *
 *  'simple' (default, legacy, unchanged) —
 *     price_adult = base covering the first 2 people; price_child = per extra beyond 2.
 *
 * `variantParams` (a chosen product variant Standard/Premium/VIP) always wins
 * and uses simple base+extra semantics with the variant's own price.
 * Returns { totalAmount, people } or throws { code, message }.
 */
function calculatePackagePrice({ packageData, participants, adultCount, childCount, variantPrice, addons }) {
  const maxGroup = parseInt(packageData.max_group_size) || 50;
  const addonsTotal = Array.isArray(addons) ? addons.reduce((s, a) => s + (parseFloat(a.price) || 0), 0) : 0;
  const discount = packageData.discountPercent || 0;
  const tiers = Array.isArray(packageData.pricing_tiers) ? packageData.pricing_tiers : [];
  const tiered = packageData.pricing_mode === 'tiered' && tiers.length && !variantPrice;

  let subtotal, people;

  if (tiered) {
    // Adults default to 1 minimum; children are separate paying guests; infants free.
    const adults   = Math.max(1, parseInt(adultCount) || parseInt(participants) || 1);
    const children = Math.max(0, parseInt(childCount) || 0);
    people = adults + children; // paying guests occupying seats
    if (people > maxGroup) throw { code: 'GROUP_TOO_LARGE', message: `This tour accepts at most ${maxGroup} people.` };

    const adultCost = priceFromTiers(tiers, adults);
    if (adultCost === null) {
      throw { code: 'NO_PRICE_TIER', message: `No price is set for ${adults} guest(s). Please contact the provider.` };
    }
    const childCost = children * (parseFloat(packageData.child_price) || 0);
    subtotal = adultCost + childCost + addonsTotal;
  } else {
    // Legacy simple model — unchanged.
    people = Math.max(2, parseInt(participants) || parseInt(adultCount) || 2);
    if (people > maxGroup) throw { code: 'GROUP_TOO_LARGE', message: `This tour accepts at most ${maxGroup} people.` };
    const basePrice = parseFloat(variantPrice) || packageData.price_adult || 0;
    const perExtra  = packageData.price_child || 0;
    const extras    = Math.max(0, people - 2);
    subtotal = basePrice + (perExtra * extras) + addonsTotal;
  }

  const totalAmount = subtotal * (1 - discount / 100);
  return { totalAmount, people };
}

// Day-rate pricing (legacy, non-package bookings)
function calculateDayRatePrice(pricePerDay, tourTime) {
  const rate = parseFloat(pricePerDay) || 0;
  return tourTime === 'full_day' ? rate : rate * 0.6;
}

// Round money to 2 decimals
function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

module.exports = {
  VALID_TOUR_TIMES,
  normalizeTourTime,
  conflictingSlots,
  guideHasSlot,
  removeSlotFromAvailability,
  timeRangesOverlap,
  bookingsWithinCapacity,
  calculatePackagePrice,
  priceFromTiers,
  calculateDayRatePrice,
  roundMoney,
  isValidDateStr,
  omanDateStart,
  omanToday,
  isPastDate,
  hoursUntilDate,
};
