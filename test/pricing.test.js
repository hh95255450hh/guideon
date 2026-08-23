const test = require('node:test');
const assert = require('node:assert');
const rules = require('../src/domain/bookingRules');

// Company owner's real pricing tables (from support feedback), used as fixtures.
const PKG1 = {
  max_group_size: 50,
  pricing_mode: 'tiered',
  pricing_tiers: [
    { from: 1, to: 2, price: 6, mode: 'flat' },
    { from: 3, to: 4, price: 8, mode: 'flat' },
    { from: 5, to: 7, price: 10, mode: 'flat' },
    { from: 8, to: null, price: 1.5, mode: 'per_person' },
  ],
  child_price: 0,
  free_under_age: 6,
};
const PKG2 = {
  max_group_size: 50,
  pricing_mode: 'tiered',
  pricing_tiers: [
    { from: 1, to: 3, price: 14, mode: 'flat' },
    { from: 4, to: null, price: 4, mode: 'per_person' },
  ],
  child_price: 2, child_age_min: 6, child_age_max: 12, free_under_age: 6,
};

test('priceFromTiers: flat bracket returns group total', () => {
  assert.strictEqual(rules.priceFromTiers(PKG1.pricing_tiers, 2), 6);
  assert.strictEqual(rules.priceFromTiers(PKG1.pricing_tiers, 4), 8);
  assert.strictEqual(rules.priceFromTiers(PKG1.pricing_tiers, 7), 10);
});

test('priceFromTiers: open-ended per-person bracket multiplies', () => {
  assert.strictEqual(rules.priceFromTiers(PKG1.pricing_tiers, 8), 12);   // 1.5 × 8
  assert.strictEqual(rules.priceFromTiers(PKG1.pricing_tiers, 10), 15);  // 1.5 × 10
});

test('priceFromTiers: no matching bracket returns null', () => {
  assert.strictEqual(rules.priceFromTiers([{ from: 1, to: 2, price: 6, mode: 'flat' }], 5), null);
  assert.strictEqual(rules.priceFromTiers([], 3), null);
});

test('tiered pkg1: 2 adults = 6 OMR total', () => {
  const { totalAmount, people } = rules.calculatePackagePrice({ packageData: PKG1, adultCount: 2, childCount: 0 });
  assert.strictEqual(totalAmount, 6);
  assert.strictEqual(people, 2);
});

test('tiered pkg1: 8 adults = 12 OMR (per-person 1.5)', () => {
  const { totalAmount } = rules.calculatePackagePrice({ packageData: PKG1, adultCount: 8, childCount: 0 });
  assert.strictEqual(totalAmount, 12);
});

test('tiered pkg2: 2 adults + 3 children (6-12) = 14 + 3×2 = 20', () => {
  const { totalAmount, people } = rules.calculatePackagePrice({ packageData: PKG2, adultCount: 2, childCount: 3 });
  assert.strictEqual(totalAmount, 20);
  assert.strictEqual(people, 5); // adults+children occupy seats
});

test('tiered pkg2: 5 adults = 4×5 = 20 (open-ended per-person)', () => {
  const { totalAmount } = rules.calculatePackagePrice({ packageData: PKG2, adultCount: 5, childCount: 0 });
  assert.strictEqual(totalAmount, 20);
});

test('tiered: addons add on top', () => {
  const { totalAmount } = rules.calculatePackagePrice({
    packageData: PKG2, adultCount: 2, childCount: 0, addons: [{ price: 5 }, { price: 10 }],
  });
  assert.strictEqual(totalAmount, 29); // 14 + 15
});

test('tiered: discount applies to subtotal', () => {
  const { totalAmount } = rules.calculatePackagePrice({
    packageData: { ...PKG2, discountPercent: 10 }, adultCount: 2, childCount: 0,
  });
  assert.ok(Math.abs(totalAmount - 12.6) < 1e-9); // 14 × 0.9
});

test('tiered: adults beyond all tiers throws NO_PRICE_TIER', () => {
  const capped = { ...PKG1, pricing_tiers: [{ from: 1, to: 2, price: 6, mode: 'flat' }] };
  assert.throws(() => rules.calculatePackagePrice({ packageData: capped, adultCount: 5, childCount: 0 }),
    (e) => e.code === 'NO_PRICE_TIER');
});

test('tiered: over max group size throws GROUP_TOO_LARGE', () => {
  assert.throws(() => rules.calculatePackagePrice({ packageData: { ...PKG2, max_group_size: 4 }, adultCount: 3, childCount: 3 }),
    (e) => e.code === 'GROUP_TOO_LARGE');
});

test('BACKWARD COMPAT: simple model unchanged (base for 2 + extra)', () => {
  const simple = { max_group_size: 10, price_adult: 80, price_child: 30 };
  assert.strictEqual(rules.calculatePackagePrice({ packageData: simple, participants: 2 }).totalAmount, 80);
  assert.strictEqual(rules.calculatePackagePrice({ packageData: simple, participants: 4 }).totalAmount, 140); // 80 + 30×2
});

test('BACKWARD COMPAT: variant price wins and uses simple semantics even if tiers exist', () => {
  const { totalAmount } = rules.calculatePackagePrice({ packageData: PKG1, participants: 2, variantPrice: 50 });
  assert.strictEqual(totalAmount, 50);
});
