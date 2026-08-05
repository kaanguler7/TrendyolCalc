// Trendyol Kâr Hesaplayıcı — COGS Storage (chrome.storage.local)

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
      console.warn('[TY Calc] Storage load error:', e);
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
      console.warn('[TY Calc] Storage save error:', e);
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
