const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { console };
vm.createContext(context);

const shippingSource = fs.readFileSync(path.join(root, 'shipping-rates.js'), 'utf8');
const hepsiburadaRatesSource = fs.readFileSync(path.join(root, 'hepsiburada-rates.js'), 'utf8');
const calculatorSource = fs.readFileSync(path.join(root, 'calculator.js'), 'utf8');
vm.runInContext(`${shippingSource}\nglobalThis.__shipping = TYShippingRates;`, context);
vm.runInContext(`${hepsiburadaRatesSource}\nglobalThis.__hbRates = HBRates;`, context);
vm.runInContext(`${calculatorSource}\nglobalThis.__calculator = TYCalculator;`, context);

const shipping = context.__shipping;
const hbRates = context.__hbRates;
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

// A supplier's quoted "50 TL arrival price" is normally VAT included. The UI
// must convert it to 41.67 TL net COGS instead of silently treating it as net.
const grossCost = calc.getCostBreakdown(50, 0.20, true, 1);
nearlyEqual(grossCost.unitNet, 41.67);
nearlyEqual(grossCost.unitVat, 8.33);
nearlyEqual(grossCost.grossTotal, 50);
const netCost = calc.getCostBreakdown(50, 0.20, false, 2);
nearlyEqual(netCost.netTotal, 100);
nearlyEqual(netCost.vatTotal, 20);
nearlyEqual(netCost.grossTotal, 120);

// Official 10 August 2026 barem bands (KDV excluded).
const expectedBarem = {
  advantage: {
    under200: { Aras: 48.33, DHLEcommerce: 57.08, KolayGelsin: 55.83, PTT: 38.74, Surat: 54.58, TEX: 38.74, Yurtici: 83.33 },
    from200: { Aras: 79.16, DHLEcommerce: 87.91, KolayGelsin: 86.66, PTT: 70.41, Surat: 85.41, TEX: 70.41, Yurtici: 113.33 },
  },
  standard: {
    under200: { Aras: 80.83, DHLEcommerce: 89.58, KolayGelsin: 88.33, PTT: 73.33, Surat: 87.08, TEX: 73.33, Yurtici: 114.16 },
    from200: { Aras: 86.24, DHLEcommerce: 94.99, KolayGelsin: 93.74, PTT: 78.74, Surat: 92.49, TEX: 78.74, Yurtici: 119.16 },
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
nearlyEqual(calc.getCargoQuote(349.99, 10, 'PTT', 'advantage').rate, 70.41);
assert.equal(calc.getCargoQuote(349.99, 10, 'PTT', 'advantage').type, 'barem');
assert.equal(calc.getCargoQuote(350, 1, 'PTT', 'standard').type, 'desi');
nearlyEqual(calc.getCargoQuote(350, 1, 'PTT', 'standard').rate, calc.getShippingRate('PTT', 1));

// Barem exclusions.
assert.equal(calc.getCargoQuote(100, 11, 'PTT', 'standard').type, 'desi');
assert.equal(calc.getCargoQuote(100, 1, 'CEVA', 'standard').type, 'desi');
nearlyEqual(calc.getCargoQuote(100, 1, 'PTT', 'advantage').rate, 38.74);
assert.equal(calc.getShippingRate('PTT', 101), null);
assert.equal(calc.getShippingRate('TEX', 101), null);

// Trendyol Academy split-package examples: the order total chooses the band,
// and below 350 TL only the lowest-desi package receives barem support.
const orderBandQuote = calc.getCargoQuote(
  100,
  1,
  'PTT',
  'advantage',
  'trendyol',
  { orderTotalGross: 250, packageRole: 'single' },
);
nearlyEqual(orderBandQuote.rate, 70.41);
assert.equal(orderBandQuote.band, '200-349,99 TL');
const splitLowestQuote = calc.getCargoQuote(
  50,
  3,
  'PTT',
  'advantage',
  'trendyol',
  { orderTotalGross: 70, packageRole: 'splitLowest' },
);
assert.equal(splitLowestQuote.type, 'barem');
const splitOtherQuote = calc.getCargoQuote(
  20,
  5,
  'PTT',
  'advantage',
  'trendyol',
  { orderTotalGross: 70, packageRole: 'splitOther' },
);
assert.equal(splitOtherQuote.type, 'desi');
const splitAboveThresholdQuote = calc.getCargoQuote(
  200,
  4,
  'PTT',
  'advantage',
  'trendyol',
  { orderTotalGross: 350, packageRole: 'splitLowest' },
);
assert.equal(splitAboveThresholdQuote.type, 'desi');
const splitCalculation = calculate({
  satisFiyati: 20,
  orderTotalGross: 70,
  packageRole: 'splitOther',
  desi: 5,
  carrier: 'PTT',
  baremMode: 'advantage',
});
assert.equal(splitCalculation.kargoTarifeTipi, 'desi');
assert.equal(splitCalculation.orderTotalGross, 70);
assert.equal(splitCalculation.packageRole, 'splitOther');

// Trendyol's official settlement example: 449.99 TL sale × 15% = 67.4985 TL
// commissionAmount. The panel rate applies to the VAT-included sale amount.
const officialCommissionExample = calculate({
  satisFiyati: 449.99,
  komisyonOverride: 15,
});
nearlyEqual(officialCommissionExample.komisyon, 67.50);

// A product with a two-item minimum order must use the package total, not its
// unit price, for commission, shipping bands and profit.
assert.equal(calc.getPackageSaleTotal(59, 2), 118);
assert.equal(calc.getPackageSaleTotal(59, 0), 59);
assert.equal(calc.resolveMinimumOrderQuantity({ moq: 2 }, null), 2);
assert.equal(calc.resolveMinimumOrderQuantity({}, {}, 'Bu üründen en az 3 adet satın alınabilmektedir.'), 3);
assert.equal(calc.resolveMinimumOrderQuantity({ moq: 2 }, {}, 'Bu üründen en az 4 adet satın alınabilmektedir.'), 4);
assert.equal(calc.resolveMinimumOrderQuantity({}, {}), 1);
const minimumOrderExample = calculate({
  satisFiyati: calc.getPackageSaleTotal(59, 2),
  cogs: 0,
  komisyonOverride: 23.5,
  hizmetUygula: true,
  hizmetBedeliKdvHaric: 6.99,
  stopajUygula: true,
  baremMode: 'advantage',
});
nearlyEqual(minimumOrderExample.ticariKar, 29.50);
assert.ok(minimumOrderExample.ticariKar > 0);

// A 72 TL item with a two-item minimum is a 144 TL package. The UI accepts
// unit COGS, so 8.936 TL per item becomes 17.872 TL package COGS.
const cablePackageExample = calculate({
  satisFiyati: calc.getPackageSaleTotal(72, 2),
  cogs: 8.936 * 2,
  komisyonOverride: 23,
  hizmetUygula: true,
  hizmetBedeliKdvHaric: 10.99,
  stopajUygula: true,
  baremMode: 'advantage',
});
nearlyEqual(cablePackageExample.satisFiyati, 144);
nearlyEqual(cablePackageExample.cogs, 17.87);
nearlyEqual(cablePackageExample.ticariKar, 24.80);
nearlyEqual(cablePackageExample.platformOdeme, 50.00);

// 17 August 2026 example from the product page. The advantageous PTT barem is
// 38.74 TL + VAT, while an ordinary (not same-day) package uses the conservative
// standard Platform Service Fee default of 10.99 TL + VAT.
const remoteControlExample = calculate({
  satisFiyati: 118.50,
  cogs: 50,
  komisyonOverride: 23,
  hizmetUygula: true,
  hizmetBedeliKdvHaric: undefined,
  stopajUygula: true,
  baremMode: 'advantage',
});
nearlyEqual(remoteControlExample.kargoKdvHaric, 38.74);
nearlyEqual(remoteControlExample.kargoToplam, 46.49);
nearlyEqual(remoteControlExample.hizmetKdvHaric, 10.99);
nearlyEqual(remoteControlExample.hizmetToplam, 13.19);
nearlyEqual(remoteControlExample.ticariKar, -23.69);
nearlyEqual(remoteControlExample.platformOdeme, 30.58);

// Official "Bugün Kargoda" discounted Platform Service Fee: qualifying
// shipments use 4.99 TL + 20% VAT instead of the standard 10.99 TL + VAT.
const todayShippingFeeExample = calculate({
  satisFiyati: 118.50,
  hizmetUygula: true,
  hizmetBedeliKdvHaric: 4.99,
});
nearlyEqual(todayShippingFeeExample.hizmetKdvHaric, 4.99);
nearlyEqual(todayShippingFeeExample.hizmetKdv, 1.00);
nearlyEqual(todayShippingFeeExample.hizmetToplam, 5.99);

// NeSatilir.com asks for VAT-included purchase/sale/shipping values. With the
// exact same inputs its displayed 15.19 TL "profit" reconciles to our Net Nakit;
// VAT-excluded commercial profit is 16.46 TL before withholding prepayment.
const neSatilirExample = calculate({
  satisFiyati: 151.99,
  cogs: calc.getCostBreakdown(50, 0.20, true, 1).netTotal,
  komisyonOverride: 18,
  hizmetUygula: true,
  hizmetBedeliKdvHaric: 6.99,
  stopajUygula: true,
  baremMode: 'advantage',
});
nearlyEqual(neSatilirExample.komisyon, 27.36);
nearlyEqual(neSatilirExample.kargoToplam, 46.49);
nearlyEqual(neSatilirExample.hizmetToplam, 8.39);
nearlyEqual(neSatilirExample.stopaj, 1.27);
nearlyEqual(neSatilirExample.netKdv, 3.29);
nearlyEqual(neSatilirExample.nakitKalan, 15.19);
nearlyEqual(neSatilirExample.ticariKar, 16.46);

// Genuine %0 VAT must remain %0.
const zeroVat = calculate({ satisKdvOrani: 0, alisKdvOrani: 0 });
assert.equal(zeroVat.kdvOrani, 0);
assert.equal(zeroVat.satisKdv, 0);
nearlyEqual(zeroVat.ticariKar, 26.67);

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

// Hepsiburada contracted tariff effective 1 August 2026 (VAT excluded).
nearlyEqual(hbRates.getShippingRate('HepsiJET', 1), 78.50);
nearlyEqual(hbRates.getShippingRate('Aras', 31), 361.46);
nearlyEqual(hbRates.getShippingRate('PTT', 0), 86.99);
nearlyEqual(hbRates.getShippingRate('PTT', 31), 666.93);
nearlyEqual(hbRates.getShippingRate('Aras', 101), 1109.47);
nearlyEqual(hbRates.getShippingRate('PTT', 101), 1792.58);
nearlyEqual(hbRates.getShippingRate('CEVALojistik', 101), 1537.17);
nearlyEqual(hbRates.getShippingRate('Aras', 500), 5420.46);
nearlyEqual(hbRates.getShippingRate('Aras', 4500), 48638.37);
nearlyEqual(hbRates.getShippingRate('DHL', 4500), 157770.68);
nearlyEqual(hbRates.getShippingRate('PTT', 4500), 72528.50);
nearlyEqual(hbRates.getShippingRate('CEVALojistik', 500), 7626.64);
nearlyEqual(hbRates.getShippingRate('CEVALojistik', 4500), 68698.16);
assert.equal(hbRates.getShippingRate('HepsiJET', 61), null);
assert.equal(hbRates.getShippingRate('Aras', 4501), null);

// Hepsiburada 2026 cargo support: only hepsiJET/Surat, VAT excluded.
nearlyEqual(hbRates.getBaremRate('HepsiJET', 199.99), 42);
nearlyEqual(hbRates.getBaremRate('Surat', 200), 72);
assert.equal(hbRates.getBaremRate('Aras', 199.99), null);
assert.equal(hbRates.getBaremRate('HepsiJET', 400), null);
const hbUnder200Quote = calc.getCargoQuote(199.99, 50, 'HepsiJET', 'support', 'hepsiburada');
nearlyEqual(hbUnder200Quote.rate, 42);
assert.equal(hbUnder200Quote.type, 'barem');
assert.equal(hbUnder200Quote.band, '0-199,99 TL');
const hbFrom200Quote = calc.getCargoQuote(200, 50, 'Surat', 'support', 'hepsiburada');
nearlyEqual(hbFrom200Quote.rate, 72);
assert.equal(hbFrom200Quote.band, '200-399,99 TL');
assert.equal(calc.getCargoQuote(399.99, 50, 'Surat', 'support', 'hepsiburada').type, 'barem');
assert.equal(calc.getCargoQuote(400, 1, 'HepsiJET', 'support', 'hepsiburada').type, 'desi');
assert.equal(calc.getCargoQuote(199.99, 1, 'Aras', 'support', 'hepsiburada').type, 'desi');
nearlyEqual(calc.getCargoQuote(199.99, 1, 'enucuz', 'support', 'hepsiburada').rate, 42);
assert.equal(calc.getPlatformMeta('hepsiburada').hasBarem, true);
assert.equal(calc.getPlatformMeta('hepsiburada').baremThreshold, 400);

const hbBaremTax = calculate({
  platform: 'hepsiburada',
  satisFiyati: 199,
  carrier: 'HepsiJET',
  baremMode: 'support',
});
nearlyEqual(hbBaremTax.kargoKdvHaric, 42);
nearlyEqual(hbBaremTax.kargoKdv, 8.4);
nearlyEqual(hbBaremTax.kargoToplam, 50.4);
nearlyEqual(hbBaremTax.toplamIndirilecekKdv, 8.4);
assert.equal(hbBaremTax.hizmetToplam, 0);

// Hepsiburada merged its delivery-level transaction/service charges into a
// single service fee. The fee is published VAT excluded and its VAT is input VAT.
const hbStandardServiceFee = calculate({
  platform: 'hepsiburada',
  satisFiyati: 199,
  carrier: 'HepsiJET',
  baremMode: 'support',
  hizmetUygula: true,
});
nearlyEqual(hbStandardServiceFee.hizmetKdvHaric, 12);
nearlyEqual(hbStandardServiceFee.hizmetKdv, 2.4);
nearlyEqual(hbStandardServiceFee.hizmetToplam, 14.4);
nearlyEqual(hbStandardServiceFee.toplamIndirilecekKdv, 10.8);

const hbSameDayServiceFee = calculate({
  platform: 'hepsiburada',
  hizmetUygula: true,
  hizmetBedeliKdvHaric: 6,
});
nearlyEqual(hbSameDayServiceFee.hizmetKdvHaric, 6);
nearlyEqual(hbSameDayServiceFee.hizmetKdv, 1.2);
nearlyEqual(hbSameDayServiceFee.hizmetToplam, 7.2);

const hbWaivedServiceFee = calculate({
  platform: 'hepsiburada',
  hizmetUygula: false,
  hizmetBedeliKdvHaric: 12,
});
assert.equal(hbWaivedServiceFee.hizmetToplam, 0);

// Hepsiburada publishes commission as a base rate + VAT. A 7% phone
// commission therefore deducts 7% + 1.4% VAT, not 7% in total.
assert.equal(hbRates.findCommissionRate('Telefon > Cep Telefonu > iPhone', 'iPhone', 'Apple', 'iPhone 15').rate, 7);
assert.equal(hbRates.findCommissionRate('Telefon > Telefon Aksesuarları > Kılıflar', 'Kılıflar', '', 'Telefon Kılıfı').rate, 25);
assert.equal(hbRates.findCommissionRate('TV > Televizyonlar', 'LED Televizyon', '', 'Smart TV').rate, 8.34);
const hepsiburadaPhone = calculate({
  platform: 'hepsiburada',
  categoryHierarchy: 'Telefon > Cep Telefonu > iPhone',
  categoryName: 'iPhone',
  productName: 'Apple iPhone 15',
  komisyonOverride: null,
  carrier: 'HepsiJET',
  hizmetUygula: false,
});
nearlyEqual(hepsiburadaPhone.komisyonKdvHaric, 7);
nearlyEqual(hepsiburadaPhone.komisyonKdv, 1.4);
nearlyEqual(hepsiburadaPhone.komisyon, 8.4);
assert.equal(hepsiburadaPhone.komisyonKdvDahilOran, false);
assert.equal(hepsiburadaPhone.platformOdeme, hepsiburadaPhone.trendyolOdeme);

// Same-product comparison from the UI: Trendyol's 19% is VAT included, while
// Hepsiburada's 17% is a base rate plus VAT (20.40% effective deduction).
const comparisonBase = {
  satisFiyati: 1325,
  cogs: 677.66,
  desi: 1,
  satisKdvOrani: 0.20,
  alisKdvOrani: 0.20,
  stopajUygula: true,
};
const trendyolComparison = calculate({
  ...comparisonBase,
  platform: 'trendyol',
  carrier: 'TEX',
  baremMode: 'standard',
  komisyonOverride: 19,
  hizmetUygula: true,
  hizmetBedeliKdvHaric: 6.99,
});
const hepsiburadaComparison = calculate({
  ...comparisonBase,
  platform: 'hepsiburada',
  carrier: 'HepsiJET',
  baremMode: 'support',
  komisyonOverride: 17,
  hizmetUygula: true,
  hizmetBedeliKdvHaric: 12,
});
nearlyEqual(trendyolComparison.komisyonEfektifOran, 19);
nearlyEqual(hepsiburadaComparison.komisyonEfektifOran, 20.4);
nearlyEqual(trendyolComparison.ticariKar, 132.19);
nearlyEqual(hepsiburadaComparison.hizmetToplam, 14.4);
nearlyEqual(hepsiburadaComparison.ticariKar, 110.76);
nearlyEqual(trendyolComparison.ticariKar - hepsiburadaComparison.ticariKar, 21.43);

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'));
assert.equal(manifest.version, '2.3.7');
assert.ok(manifest.content_scripts[0].matches.includes('https://www.trendyol.com/*-p-*'));
assert.ok(manifest.content_scripts[0].matches.includes('https://www.hepsiburada.com/*-p-*'));
assert.ok(manifest.content_scripts[0].matches.includes('https://www.hepsiburada.com/*-pm-*'));
assert.ok(
  manifest.content_scripts[0].js.indexOf('hepsiburada-rates.js') <
  manifest.content_scripts[0].js.indexOf('calculator.js')
);
assert.ok(
  manifest.content_scripts[0].js.indexOf('seller-history.js') <
  manifest.content_scripts[0].js.indexOf('storage.js')
);

const contentSource = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
assert.match(contentSource, /id="ty-calc-cogs-vat-basis-select"/);
assert.match(contentSource, /id="ty-calc-order-total-input"/);
assert.match(contentSource, /id="ty-calc-package-role-select"/);
assert.match(contentSource, /id="ty-calc-today-shipping-fee-enabled"/);
assert.match(contentSource, /Bugün Kargoda \(4,99 \+ KDV\)/);
assert.match(contentSource, /\[data-test-id="default-price"\] > :first-child/);
assert.match(contentSource, /resolveHepsiburadaCurrentPrice\(stateProduct\?\.prices\)/);
assert.match(contentSource, /&& orderTotalInput\s*&& orderTotalInput\.dataset\.manual/);
assert.match(contentSource, /<option value="gross" selected>KDV Dahil<\/option>/);
assert.match(contentSource, /Ticari Kâr \(KDV Hariç\)/);
assert.match(contentSource, /<details class="ty-calc-seller-tracker"/);
assert.doesNotMatch(contentSource, /<details class="ty-calc-seller-tracker"[^>]*\sopen(?:\s|>)/);
assert.match(contentSource, /id="ty-calc-hb-service-fee-select"/);
assert.match(contentSource, /<option value="12" selected>/);

console.log('Tüm hesaplama testleri geçti.');
