const test = require('node:test');
const assert = require('node:assert');
const rules = require('../src/domain/bookingRules');

// A booking request used to carry its own variant and add-on prices, and the
// server charged whatever they said: {variantPrice: 0.01} or an add-on priced
// -500 booked a tour for almost nothing. Prices now come from the package.

const SupabaseDB = require('../src/models/SupabaseDB');
const PKG = {
  id: 'pkg-1', providerId: 'guide-1', isPublished: true, destination: 'Nizwa',
  availableDates: ['daily'], max_group_size: 10, price_adult: 100, price_child: 20,
  variants: [{ name: 'Standard', priceAdult: 100, priceChild: 20 }, { name: 'VIP', priceAdult: 250, priceChild: 40 }],
  addons: [{ name: 'Lunch', price: 15 }],
};
const inserted = [];
SupabaseDB.prototype.findById = async function (id) {
  if (id === 'pkg-1') return PKG;
  if (id === 'guide-1') return { id: 'guide-1', userType: 'guide', isVerified: true, fullName: 'G', pricePerDay: 50 };
  if (id === 'tourist-1') return { id: 'tourist-1', userType: 'tourist', fullName: 'T' };
  return null;
};
SupabaseDB.prototype.findAllByField = async function () { return []; };
SupabaseDB.prototype.findAllWhere = async function () { return []; };
SupabaseDB.prototype.findOneByField = async function () { return null; };
SupabaseDB.prototype.insert = async function (row) { inserted.push(row); return row; };
SupabaseDB.prototype.update = async function (id, row) { return row; };

const bookingService = require('../src/services/bookingService');
const future = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
const base = { guideId: 'guide-1', packageId: 'pkg-1', tourDate: future, destination: 'Nizwa', participants: 2, adultCount: 2 };

async function book(extra) {
  inserted.length = 0;
  const b = await bookingService.createBooking('tourist-1', { ...base, ...extra });
  return b && b.totalAmount != null ? b : inserted[0];
}

test('booking price: a client-sent variant price is ignored', async () => {
  const b = await book({ variantName: 'VIP', variantPrice: 0.01 });
  assert.strictEqual(Number(b.totalAmount), 250);
});

test('booking price: client add-on prices are replaced by the package prices', async () => {
  const b = await book({ variantName: 'Standard', addons: [{ name: 'Lunch', price: -500 }, { name: 'Free helicopter', price: 0 }] });
  assert.strictEqual(Number(b.totalAmount), 115);
  assert.deepStrictEqual(b.addons, [{ name: 'Lunch', price: 15 }]);
});

test('booking price: an unknown variant name is refused', async () => {
  await assert.rejects(book({ variantName: 'Made up', variantPrice: 1 }), e => e.code === 'VARIANT_UNAVAILABLE');
});

test('pricing rules: negative add-ons and runaway discounts cannot lower the price', () => {
  const r = rules.calculatePackagePrice({ packageData: { price_adult: 100, discountPercent: 150 }, participants: 2, addons: [{ price: -80 }] });
  assert.strictEqual(Math.round(r.totalAmount * 1000) / 1000, 10);   // discount capped at 90%, negative add-on counted as 0
});
