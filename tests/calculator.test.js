const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { console };
vm.createContext(context);

const shippingSource = fs.readFileSync(path.join(root, 'shipping-rates.js'), 'utf8');
const calculatorSource = fs.readFileSync(path.join(root, 'calculator.js'), 'utf8');
vm.runInContext(`${shippingSource}\nglobalThis.__shipping = TYShippingRates;`, context);
vm.runInContext(`${calculatorSource}\nglobalThis.__calculator = TYCalculator;`, context);

const shipping = context.__shipping;
const calc = context.__calculator;

function nearlyEqual(actual, expected, tolerance = 0.011) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);
}

function calculate(overrides = {}) {
  return calc.calculate({
    satisFiyati: 100,
    cogs: 0,
    desi: 1,
    satisKdvOrani: 0.20,
    alisKdvOrani: 0.20,
    carrier: 'PTT',
    baremMode: 'standard',
    categoryHierarchy: 'Elektronik/Telefon',
    categoryName: 'Telefon',
    komisyonOverride: 0,
    hizmetUygula: false,
    stopajUygula: false,
    ...overrides,
  });
}

// Official 13 July 2026 barem bands (KDV excluded).
const expectedBarem = {
  advantage: {
    under200: { Aras: 48.33, DHLEcommerce: 57.08, KolayGelsin: 55.83, PTT: 34.16, Surat: 54.58, TEX: 34.16, Yurtici: 83.33 },
    from200: { Aras: 79.16, DHLEcommerce: 87.91, KolayGelsin: 86.66, PTT: 65.83, Surat: 85.41, TEX: 65.83, Yurtici: 113.33 },
  },
  standard: {
    under200: { Aras: 80.83, DHLEcommerce: 89.58, KolayGelsin: 88.33, PTT: 68.74, Surat: 87.08, TEX: 68.74, Yurtici: 114.16 },
    from200: { Aras: 86.24, DHLEcommerce: 94.99, KolayGelsin: 93.74, PTT: 74.16, Surat: 92.49, TEX: 74.16, Yurtici: 119.16 },
  },
};
for (const [mode, bands] of Object.entries(expectedBarem)) {
  for (const [carrier, rate] of Object.entries(bands.under200)) {
    nearlyEqual(calc.getCargoQuote(199.99, 1, carrier, mode).rate, rate);
  }
  for (const [carrier, rate] of Object.entries(bands.from200)) {
    nearlyEqual(calc.getCargoQuote(200, 1, carrier, mode).rate, rate);
  }
}
nearlyEqual(calc.getCargoQuote(349.99, 10, 'PTT', 'advantage').rate, 65.83);
assert.equal(calc.getCargoQuote(349.99, 10, 'PTT', 'advantage').type, 'barem');
assert.equal(calc.getCargoQuote(350, 1, 'PTT', 'standard').type, 'desi');
nearlyEqual(calc.getCargoQuote(350, 1, 'PTT', 'standard').rate, calc.getShippingRate('PTT', 1));

// Barem exclusions.
assert.equal(calc.getCargoQuote(100, 11, 'PTT', 'standard').type, 'desi');
assert.equal(calc.getCargoQuote(100, 1, 'CEVA', 'standard').type, 'desi');
nearlyEqual(calc.getCargoQuote(100, 1, 'PTT', 'advantage').rate, 34.16);
assert.equal(calc.getShippingRate('PTT', 101), null);
assert.equal(calc.getShippingRate('TEX', 101), null);

// Genuine %0 VAT must remain %0.
const zeroVat = calculate({ satisKdvOrani: 0, alisKdvOrani: 0 });
assert.equal(zeroVat.kdvOrani, 0);
assert.equal(zeroVat.satisKdv, 0);
nearlyEqual(zeroVat.ticariKar, 31.26);

// Withholding affects cash/payout, not commercial profit.
const stopajOn = calculate({ stopajUygula: true });
const stopajOff = calculate({ stopajUygula: false });
assert.equal(stopajOn.ticariKar, stopajOff.ticariKar);
nearlyEqual(stopajOff.trendyolOdeme - stopajOn.trendyolOdeme, stopajOn.stopaj);

// Carried-forward VAT is an asset and reconciles cash to commercial profit.
const carriedVat = calculate({ cogs: 100, stopajUygula: true });
assert.ok(carriedVat.devredenKdv > 0);
nearlyEqual(
  carriedVat.nakitKalan + carriedVat.devredenKdv + carriedVat.stopaj,
  carriedVat.ticariKar,
);

// User's example: 1,450 TL gross sale, 718 TL net cost, 15% commission.
const example = calculate({
  satisFiyati: 1450,
  cogs: 718,
  komisyonOverride: 15,
  hizmetUygula: true,
  hizmetBedeliKdvHaric: 6.99,
  stopajUygula: true,
});
nearlyEqual(example.ticariKar, 224.55);
nearlyEqual(example.nakitKalan, 212.47);
nearlyEqual(example.roi, 31.3, 0.051);
nearlyEqual(example.margin, 18.6, 0.051);

// Specific leaf-category phrases must win over generic keyword collisions.
assert.equal(calc.findCommissionRate('Elektronik/Tablet Kılıfı', 'Tablet Kılıfı').rate, 23);
assert.equal(calc.findCommissionRate('Ev/Mobilya/TV Ünitesi', 'TV Ünitesi').rate, 23);
assert.equal(calc.findCommissionRate('Süpermarket/Bebek Maması', 'Bebek Maması').rate, 15);
assert.equal(calc.findCommissionRate('Mobilya/Kitaplık', 'Kitaplık').rate, 23);
assert.equal(calc.findCommissionRate('Kitap/Kitap', 'Kitap').rate, 15.5);

const automaticCommission = calculate({ komisyonOverride: null });
assert.equal(automaticCommission.komisyonOrani, 7);

assert.equal(shipping.BAREM_THRESHOLD, 350);
assert.equal(shipping.BAREM_MAX_DESI, 10);

console.log('Tüm hesaplama testleri geçti.');
