const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { console };
vm.createContext(context);
const source = fs.readFileSync(path.join(root, 'seller-history.js'), 'utf8');
vm.runInContext(`${source}\nglobalThis.__sellerHistory = SellerHistoryEngine;`, context);
const history = context.__sellerHistory;

const minute = 60 * 1000;
const firstTime = Date.UTC(2026, 7, 12, 9, 30);
const first = history.observe(null, [
  { id: 'a', name: 'Satıcı A', price: 100 },
  { id: 'b', name: 'Satıcı B', price: 110.25 },
], { timestamp: firstTime, complete: true, productName: 'Test Ürünü' });

assert.equal(first.changed, true);
assert.equal(first.record.d.length, 2);
assert.equal(first.record.e.length, 1);
assert.deepEqual(
  JSON.parse(JSON.stringify(history.toView(first.record).current.map(item => [item.name, item.priceCents]))),
  [['Satıcı A', 10000], ['Satıcı B', 11025]],
);

const unchanged = history.observe(first.record, [
  { id: 'b', name: 'Satıcı B', price: 110.25 },
  { id: 'a', name: 'Satıcı A', price: 100 },
], { timestamp: firstTime + minute, complete: true });
assert.equal(unchanged.changed, false);
assert.equal(unchanged.record.e.length, 1, 'unchanged snapshots must not append events');

const changed = history.observe(unchanged.record, [
  { id: 'a', name: 'Satıcı A', price: 95.50 },
  { id: 'c', name: 'Satıcı C', price: 120 },
], { timestamp: firstTime + 2 * minute, complete: true });
const changedView = history.toView(changed.record);
assert.equal(changedView.current.length, 2);
assert.deepEqual(
  JSON.parse(JSON.stringify(changedView.events.slice(0, 3).map(event => event.type).sort())),
  ['enter', 'exit', 'price'],
);
const priceEvent = changedView.events.find(event => event.type === 'price');
assert.equal(priceEvent.oldPriceCents, 10000);
assert.equal(priceEvent.priceCents, 9550);
assert.equal(changedView.events.find(event => event.type === 'exit').name, 'Satıcı B');
assert.equal(changedView.events.find(event => event.type === 'enter').name, 'Satıcı C');

const partial = history.observe(changed.record, [
  { id: 'a', name: 'Satıcı A', price: 95.50 },
], { timestamp: firstTime + 3 * minute, complete: false });
const partialView = history.toView(partial.record);
assert.equal(partialView.complete, false);
assert.equal(partialView.current.length, 1);
assert.equal(
  partialView.events.filter(event => event.type === 'exit').length,
  changedView.events.filter(event => event.type === 'exit').length,
  'incomplete snapshots must not create exit events',
);

const completeAfterPartial = history.observe(partial.record, [
  { id: 'a', name: 'Satıcı A', price: 95.50 },
], { timestamp: firstTime + 4 * minute, complete: true });
assert.equal(
  history.toView(completeAfterPartial.record).events.filter(event => event.type === 'exit').length,
  changedView.events.filter(event => event.type === 'exit').length + 1,
  'a later complete snapshot must compare exits against the last trusted full list',
);

const normalized = history.normalizeSellers([
  { id: 'same', name: 'Aynı Satıcı', price: 105 },
  { id: 'same', name: 'Aynı Satıcı', price: 99 },
  { id: '', name: '', price: 10 },
]);
assert.equal(normalized.length, 1);
assert.equal(normalized[0].priceCents, 9900, 'duplicate seller keeps its lowest listing price');

console.log('seller-history tests passed');
