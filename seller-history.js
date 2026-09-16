// Compact, product-based seller history engine.
// Names are dictionary encoded, prices are stored as integer kurus and
// timestamps as epoch minutes. Only deltas are appended to the event log.

const SellerHistoryEngine = (() => {
  const VERSION = 1;
  const RETENTION_MINUTES = 365 * 24 * 60;
  const MAX_EVENTS_PER_PRODUCT = 2000;

  function toMinute(timestamp = Date.now()) {
    return Math.floor(Number(timestamp) / 60000);
  }

  function toCents(price) {
    const value = Number(price);
    return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
  }

  function normalizeSellers(sellers) {
    const unique = new Map();
    for (const raw of Array.isArray(sellers) ? sellers : []) {
      const name = String(raw?.name || '').trim().slice(0, 100);
      const id = String(raw?.id ?? raw?.merchantId ?? name).trim().slice(0, 100);
      const priceCents = toCents(raw?.price);
      if (!id || !name || priceCents == null) continue;
      const previous = unique.get(id);
      if (!previous || priceCents < previous.priceCents) {
        unique.set(id, { id, name, priceCents });
      }
    }
    return [...unique.values()].sort((a, b) => a.priceCents - b.priceCents || a.name.localeCompare(b.name, 'tr'));
  }

  function pairMap(pairs) {
    return new Map((Array.isArray(pairs) ? pairs : []).map(pair => [pair[0], pair[1]]));
  }

  function ensureSeller(record, seller) {
    let index = record.d.findIndex(item => item[0] === seller.id);
    if (index < 0) {
      index = record.d.length;
      record.d.push([seller.id, seller.name]);
    } else if (record.d[index][1] !== seller.name) {
      record.d[index][1] = seller.name;
    }
    return index;
  }

  function compactDictionary(record) {
    const used = new Set();
    for (const pair of record.c || []) used.add(pair[0]);
    for (const pair of record.b || []) used.add(pair[0]);
    for (const event of record.e || []) {
      for (const delta of event[1] || []) used.add(delta[0]);
    }
    if (used.size === record.d.length) return record;

    const remap = new Map();
    const dictionary = [];
    [...used].sort((a, b) => a - b).forEach(oldIndex => {
      remap.set(oldIndex, dictionary.length);
      dictionary.push(record.d[oldIndex] || [String(oldIndex), `Satıcı ${oldIndex + 1}`]);
    });
    const remapPairs = pairs => (pairs || []).map(pair => [remap.get(pair[0]), pair[1]]);
    record.d = dictionary;
    record.c = remapPairs(record.c);
    record.b = remapPairs(record.b);
    record.e = (record.e || []).map(event => [
      event[0],
      (event[1] || []).map(delta => [remap.get(delta[0]), delta[1]]),
      event[2] || 0,
    ]);
    return record;
  }

  function pruneEvents(record, cutoff, now) {
    const events = record.e || [];
    let start = events.findIndex(event => event[0] >= cutoff);
    if (start < 0) start = events.length;
    start = Math.max(start, events.length - (MAX_EVENTS_PER_PRODUCT - 1));
    if (start === 0 && events.length <= MAX_EVENTS_PER_PRODUCT) return;

    const state = new Map();
    for (const event of events.slice(0, start)) {
      for (const [index, price] of event[1] || []) {
        if (price < 0) state.delete(index);
        else state.set(index, price);
      }
    }
    const recent = events.slice(start, start + MAX_EVENTS_PER_PRODUCT - 1);
    const checkpointPairs = [...state.entries()];
    if (checkpointPairs.length) {
      const checkpointTime = recent.length ? Math.max(cutoff, recent[0][0] - 1) : now;
      record.e = [[checkpointTime, checkpointPairs, 1], ...recent];
    } else {
      record.e = recent;
    }
  }

  function observe(existing, sellers, options = {}) {
    const now = toMinute(options.timestamp);
    const normalized = normalizeSellers(sellers);
    const complete = options.complete !== false;
    const record = existing && existing.v === VERSION
      ? JSON.parse(JSON.stringify(existing))
      : { v: VERSION, n: '', u: '', d: [], c: [], b: [], e: [], k: now, f: complete ? 1 : 0 };

    record.n = String(options.productName || record.n || '').slice(0, 140);
    record.u = String(options.urlPath || record.u || '').slice(0, 220);
    const current = normalized.map(seller => [ensureSeller(record, seller), seller.priceCents]);
    const previousObserved = pairMap(record.c);
    const trustedBaseline = pairMap(record.b?.length ? record.b : record.c);
    const comparison = new Map(trustedBaseline);
    for (const [index, price] of previousObserved) comparison.set(index, price);

    const deltas = [];
    for (const [index, price] of current) {
      if (!comparison.has(index) || comparison.get(index) !== price) deltas.push([index, price]);
    }
    if (complete && (record.c.length || record.b.length)) {
      const currentIndexes = new Set(current.map(pair => pair[0]));
      for (const [index] of trustedBaseline) {
        if (!currentIndexes.has(index)) deltas.push([index, -1]);
      }
    }

    const initial = record.e.length === 0 && record.c.length === 0 && record.b.length === 0;
    if (initial && current.length) {
      record.e.push([now, current.map(pair => [...pair]), 1]);
    } else if (deltas.length) {
      record.e.push([now, deltas, 0]);
    }

    record.c = current;
    if (complete) record.b = current.map(pair => [...pair]);
    record.k = now;
    record.f = complete ? 1 : 0;

    const cutoff = now - RETENTION_MINUTES;
    pruneEvents(record, cutoff, now);
    compactDictionary(record);
    return { record, changed: initial ? current.length > 0 : deltas.length > 0 };
  }

  function toView(record) {
    if (!record || record.v !== VERSION) return null;
    const dictionary = record.d || [];
    const state = new Map();
    const events = [];

    for (const event of record.e || []) {
      const timestamp = event[0] * 60000;
      const initial = event[2] === 1;
      if (initial) {
        events.push({ timestamp, type: 'initial', count: event[1]?.length || 0 });
      }
      for (const [index, nextPrice] of event[1] || []) {
        const oldPrice = state.get(index);
        const seller = dictionary[index] || [String(index), `Satıcı ${index + 1}`];
        if (!initial) {
          events.push({
            timestamp,
            type: nextPrice < 0 ? 'exit' : (oldPrice == null ? 'enter' : 'price'),
            id: seller[0],
            name: seller[1],
            oldPriceCents: oldPrice ?? null,
            priceCents: nextPrice < 0 ? null : nextPrice,
          });
        }
        if (nextPrice < 0) state.delete(index);
        else state.set(index, nextPrice);
      }
    }

    const current = (record.c || []).map(([index, priceCents]) => {
      const seller = dictionary[index] || [String(index), `Satıcı ${index + 1}`];
      return { id: seller[0], name: seller[1], priceCents };
    }).sort((a, b) => a.priceCents - b.priceCents || a.name.localeCompare(b.name, 'tr'));

    return {
      productName: record.n || '',
      urlPath: record.u || '',
      lastChecked: record.k * 60000,
      complete: record.f === 1,
      current,
      events: events.reverse(),
    };
  }

  return {
    VERSION,
    RETENTION_MINUTES,
    MAX_EVENTS_PER_PRODUCT,
    normalizeSellers,
    observe,
    toView,
    toMinute,
    toCents,
  };
})();
