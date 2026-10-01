// Trendyol Kâr Hesaplayıcı — COGS Storage (chrome.storage.local)

function isInvalidatedExtensionContext(error) {
  return /extension context invalidated/i.test(String(error?.message || error || ''));
}

function warnStorageError(message, error) {
  // Reloading an unpacked extension invalidates content scripts that are still
  // alive in already-open tabs. This is expected and ends on page reload.
  if (!isInvalidatedExtensionContext(error)) console.warn(message, error);
}

const COGSStorage = (() => {
  const STORAGE_KEY = 'ty_calc_cogs';
  const MAX_ENTRIES = 1000;

  async function load(productId) {
    if (!productId) return null;
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const data = result[STORAGE_KEY] || {};
      const entry = data[productId];
      return entry ? entry.value : null;
    } catch (e) {
      warnStorageError('[TY Calc] Storage load error:', e);
      return null;
    }
  }

  async function save(productId, value) {
    if (!productId) return;
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const data = result[STORAGE_KEY] || {};
      data[productId] = { value, ts: Date.now() };

      const keys = Object.keys(data);
      if (keys.length > MAX_ENTRIES) {
        const sorted = keys.sort((a, b) => data[a].ts - data[b].ts);
        const toRemove = sorted.slice(0, keys.length - MAX_ENTRIES);
        for (const k of toRemove) delete data[k];
      }

      await chrome.storage.local.set({ [STORAGE_KEY]: data });
    } catch (e) {
      warnStorageError('[TY Calc] Storage save error:', e);
    }
  }

  return { load, save };
})();

// Desi storage (remember last entered desi per product)
const DesiStorage = (() => {
  const STORAGE_KEY = 'ty_calc_desi';
  const MAX_ENTRIES = 1000;

  async function load(productId) {
    if (!productId) return null;
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const data = result[STORAGE_KEY] || {};
      const entry = data[productId];
      return entry ? entry.value : null;
    } catch (e) {
      return null;
    }
  }

  async function save(productId, value) {
    if (!productId) return;
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const data = result[STORAGE_KEY] || {};
      data[productId] = { value, ts: Date.now() };

      const keys = Object.keys(data);
      if (keys.length > MAX_ENTRIES) {
        const sorted = keys.sort((a, b) => data[a].ts - data[b].ts);
        for (const k of sorted.slice(0, keys.length - MAX_ENTRIES)) delete data[k];
      }

      await chrome.storage.local.set({ [STORAGE_KEY]: data });
    } catch (e) {}
  }

  return { load, save };
})();

// Calculator choices (VAT, commission, cargo mode and optional deductions)
// are remembered per product so a manual correction is not lost on refresh.
const CalculatorSettingsStorage = (() => {
  const STORAGE_KEY = 'ty_calc_settings';
  const MAX_ENTRIES = 1000;

  async function load(productId) {
    if (!productId) return null;
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      return result[STORAGE_KEY]?.[productId]?.value || null;
    } catch (e) {
      warnStorageError('[TY Calc] Settings load error:', e);
      return null;
    }
  }

  async function save(productId, value) {
    if (!productId || !value) return;
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const data = result[STORAGE_KEY] || {};
      data[productId] = { value, ts: Date.now() };

      const keys = Object.keys(data);
      if (keys.length > MAX_ENTRIES) {
        const sorted = keys.sort((a, b) => data[a].ts - data[b].ts);
        for (const key of sorted.slice(0, keys.length - MAX_ENTRIES)) delete data[key];
      }

      await chrome.storage.local.set({ [STORAGE_KEY]: data });
    } catch (e) {
      warnStorageError('[TY Calc] Settings save error:', e);
    }
  }

  return { load, save };
})();

// Seller history is kept in a single compact store. Seller names are encoded
// once per product and only entry/exit/price deltas are appended by the engine.
const SellerHistoryStorage = (() => {
  const STORAGE_KEY = 'ty_calc_seller_history_v1';
  const MAX_PRODUCTS = 500;
  const MAX_STORE_CHARS = 4_000_000;
  let queue = Promise.resolve();

  async function readStore() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const store = result[STORAGE_KEY];
    return store?.v === SellerHistoryEngine.VERSION && store.p
      ? store
      : { v: SellerHistoryEngine.VERSION, p: {} };
  }

  async function load(productKey) {
    if (!productKey) return null;
    try {
      const store = await readStore();
      return SellerHistoryEngine.toView(store.p[productKey]);
    } catch (error) {
      warnStorageError('[Pazaryeri Calc] Seller history load error:', error);
      return null;
    }
  }

  function observe(productKey, sellers, options = {}) {
    if (!productKey) return Promise.resolve(null);
    queue = queue.then(async () => {
      try {
        const store = await readStore();
        const observed = SellerHistoryEngine.observe(store.p[productKey], sellers, options);
        store.p[productKey] = observed.record;

        const productKeys = Object.keys(store.p);
        if (productKeys.length > MAX_PRODUCTS) {
          productKeys
            .sort((a, b) => (store.p[a]?.k || 0) - (store.p[b]?.k || 0))
            .slice(0, productKeys.length - MAX_PRODUCTS)
            .forEach(key => delete store.p[key]);
        }

        // Keep a safety margin below chrome.storage.local's usual quota. The
        // oldest products are removed first; the currently observed product is
        // never removed by this pass.
        const oldestFirst = Object.keys(store.p)
          .filter(key => key !== productKey)
          .sort((a, b) => (store.p[a]?.k || 0) - (store.p[b]?.k || 0));
        while (oldestFirst.length && JSON.stringify(store).length > MAX_STORE_CHARS) {
          delete store.p[oldestFirst.shift()];
        }

        await chrome.storage.local.set({ [STORAGE_KEY]: store });
        return SellerHistoryEngine.toView(observed.record);
      } catch (error) {
        warnStorageError('[Pazaryeri Calc] Seller history save error:', error);
        return null;
      }
    });
    return queue;
  }

  return { load, observe };
})();
