const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const warnings = [];
let failure = new Error('Extension context invalidated.');
const context = {
  console: { warn: (...args) => warnings.push(args) },
  chrome: {
    storage: {
      local: {
        get: async () => { throw failure; },
        set: async () => { throw failure; },
      },
    },
  },
  SellerHistoryEngine: { VERSION: 1 },
};
vm.createContext(context);
const source = fs.readFileSync(path.join(__dirname, '..', 'storage.js'), 'utf8');
vm.runInContext(`${source}\nglobalThis.__cogs = COGSStorage;`, context);

(async () => {
  assert.equal(await context.__cogs.load('product'), null);
  await context.__cogs.save('product', 10);
  assert.equal(warnings.length, 0, 'extension reload must not create warning entries');

  failure = new Error('QUOTA_BYTES quota exceeded');
  await context.__cogs.load('product');
  assert.equal(warnings.length, 1, 'unexpected storage errors must remain visible');
  console.log('storage tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
