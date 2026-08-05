// Trendyol Kâr Hesaplayıcı — Content Script

(async () => {
  // ─── Product Data Extraction from SSR JSON ──────────────────
  function extractProductData() {
    // Trendyol embeds product data in window.__SEARCH_RESULT__ or SSR props
    const scripts = document.querySelectorAll('script');
    let productJSON = null;

    for (const script of scripts) {
      const text = script.textContent || '';

      // Try window.__PRODUCT_DETAIL_APP_INITIAL_STATE__
      let match = text.match(/window\.__PRODUCT_DETAIL_APP_INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*(?:window\.|<\/script>|$)/);
      if (match) {
        try {
          const state = JSON.parse(match[1]);
          if (state?.product) {
            productJSON = state.product;
            break;
          }
        } catch (e) {}
      }

      // Try __envoy__PROPS
      if (text.includes('__envoy__PROPS') || text.includes('product')) {
        // Look for product JSON with balanced braces
        const productMatch = text.match(/"product"\s*:\s*\{/);
        if (productMatch) {
          const startIdx = productMatch.index + productMatch[0].length - 1;
          let depth = 0;
          let endIdx = startIdx;
          for (let i = startIdx; i < text.length; i++) {
            if (text[i] === '{') depth++;
            else if (text[i] === '}') depth--;
            if (depth === 0) { endIdx = i + 1; break; }
          }
          try {
            productJSON = JSON.parse(text.substring(startIdx, endIdx));
            break;
          } catch (e) {}
        }
      }
    }

    if (!productJSON) return null;

    // Extract fields
    const product = productJSON;
    const winnerVariant = product.merchantListing?.winnerVariant
      || product.allMerchantListings?.[0]?.winnerVariant;

    const priceObj = winnerVariant?.price || product.price;
    const price = priceObj?.discountedPrice?.value
      || priceObj?.sellingPrice?.value
      || priceObj?.originalPrice?.value
      || extractPriceFromPage();

    return {
      id: product.id,
      name: product.name,
      price: price,
      tax: product.tax, // KDV oranı (e.g., 10 means %10)
      brand: product.brand?.name,
      categoryId: product.category?.id,
      categoryName: product.category?.name,
      categoryHierarchy: product.category?.hierarchy,
      freeCargo: winnerVariant?.freeCargo || false,
      barcode: product.variants?.[0]?.barcode,
    };
  }

  function extractPriceFromPage() {
    const selectors = [
      '.product-price-container .prc-dsc',
      '.product-price-container .prc-slg',
      '.pr-bx-w .prc-dsc',
      '[data-testid="price-current-price"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent.replace(/[^\d.,]/g, '').trim();
        const cleaned = text.replace(/\./g, '').replace(',', '.');
        const val = parseFloat(cleaned);
        if (!isNaN(val) && val > 0) return val;
      }
    }
    return null;
  }

  // ─── Panel Creation ─────────────────────────────────────────
  function createPanel(product) {
    const panel = document.createElement('div');
    panel.id = 'ty-calc-panel';

    const kdvStr = product.tax != null ? `%${product.tax}` : '—';
    const categoryShort = product.categoryName || (product.categoryHierarchy || '').split('/').pop() || '—';

    // Find initial commission
    const commInfo = TYCalculator.findCommissionRate(product.categoryHierarchy, product.categoryName);

    // Cargo badge
    const cargoBadge = product.price >= 300
      ? '<span class="ty-calc-badge seller-cargo">Satıcı Öder</span>'
      : '<span class="ty-calc-badge free-cargo">Müşteri Öder</span>';

    // Carrier options
    const carrierOptions = Object.entries(TYCalculator.CARRIER_DISPLAY_NAMES)
      .map(([key, name]) => `<option value="${key}">${name}</option>`)
      .join('');

    // KDV options
    const kdvOptions = [0, 1, 10, 20].map(v => {
      const selected = (product.tax != null && v === product.tax) ? 'selected' : '';
      return `<option value="${v / 100}" ${selected}>%${v}</option>`;
    }).join('');

    panel.innerHTML = `
      <div class="ty-calc-header">
        <span class="ty-calc-header-title">Trendyol Kâr Hesaplayıcı</span>
        <button class="ty-calc-toggle-btn" id="ty-calc-toggle" title="Küçült">−</button>
      </div>
      <div class="ty-calc-body">
        <div class="ty-calc-info">
          <div class="ty-calc-info-row ty-calc-price-row">
            <span class="ty-calc-info-label">Satış Fiyatı</span>
            <span class="ty-calc-price-editor">
              <span class="ty-calc-price-prefix">₺</span>
              <input type="number" class="ty-calc-price-input" id="ty-calc-price-input"
                     value="${product.price || ''}" step="0.01" min="0.01"
                     aria-label="Hesaplanacak satış fiyatı">
              <button type="button" class="ty-calc-price-reset-btn" id="ty-calc-price-reset"
                      title="Trendyol fiyatına dön" aria-label="Trendyol fiyatına dön">↺</button>
            </span>
          </div>
          <div class="ty-calc-info-row">
            <span class="ty-calc-info-label">Kategori</span>
            <span class="ty-calc-info-value" title="${product.categoryHierarchy || ''}">${categoryShort}</span>
          </div>
          <div class="ty-calc-info-row">
            <span class="ty-calc-info-label">KDV</span>
            <span class="ty-calc-info-value">${kdvStr}</span>
          </div>
          <div class="ty-calc-info-row">
            <span class="ty-calc-info-label">Komisyon</span>
            <span class="ty-calc-info-value" id="ty-calc-commission-info">${commInfo.matched ? commInfo.label : 'Eşleşmedi'} (${commInfo.rate}%)</span>
          </div>
          <div class="ty-calc-info-row">
            <span class="ty-calc-info-label">Kargo</span>
            <span class="ty-calc-info-value" id="ty-calc-cargo-badge">${cargoBadge}</span>
          </div>
          <div class="ty-calc-info-row">
            <span class="ty-calc-info-label">Kargo Tarifesi</span>
            <span class="ty-calc-info-value">16.07.2026 · KDV hariç</span>
          </div>
        </div>

        <div class="ty-calc-input-group">
          <label>Maliyet / COGS (KDV Hariç)</label>
          <div class="ty-calc-input-wrapper">
            <span class="ty-calc-currency-prefix">₺</span>
            <input type="number" class="ty-calc-input" id="ty-calc-cogs-input"
                   placeholder="0.00" step="0.01" min="0">
          </div>
        </div>

        <div class="ty-calc-row-inputs">
          <div class="ty-calc-input-group">
            <label>Desi</label>
            <div class="ty-calc-input-wrapper">
              <input type="number" class="ty-calc-input" id="ty-calc-desi-input"
                     placeholder="1" step="1" min="1" max="500" value="1">
            </div>
          </div>
          <div class="ty-calc-input-group">
            <label>Kargo Firması</label>
            <div class="ty-calc-input-wrapper">
              <select class="ty-calc-select" id="ty-calc-carrier-select">
                <option value="enucuz">En Ucuz</option>
                ${carrierOptions}
              </select>
            </div>
          </div>
        </div>

        <div class="ty-calc-row-inputs">
          <div class="ty-calc-input-group">
            <label>Alış KDV</label>
            <div class="ty-calc-input-wrapper">
              <select class="ty-calc-select" id="ty-calc-alis-kdv-select">
                ${kdvOptions}
              </select>
            </div>
          </div>
          <div class="ty-calc-input-group">
            <label>Komisyon %</label>
            <div class="ty-calc-input-wrapper">
              <span class="ty-calc-currency-prefix">%</span>
              <input type="number" class="ty-calc-input" id="ty-calc-komisyon-input"
                     placeholder="${commInfo.rate}" step="0.1" min="0" max="50"
                     value="${commInfo.rate}">
            </div>
          </div>
        </div>

        <div class="ty-calc-results">
          <div class="ty-calc-section-title">Kesintiler</div>
          <div class="ty-calc-row">
            <span class="ty-calc-row-label" id="ty-calc-komisyon-label">Komisyon (${commInfo.rate}%)</span>
            <span class="ty-calc-row-value fee" id="ty-calc-komisyon-val">—</span>
          </div>
          <div class="ty-calc-row">
            <span class="ty-calc-row-label" id="ty-calc-kargo-label">Kargo</span>
            <span class="ty-calc-row-value fee" id="ty-calc-kargo-val">—</span>
          </div>
          <div class="ty-calc-row">
            <span class="ty-calc-row-label">Hizmet Bedeli</span>
            <span class="ty-calc-row-value fee" id="ty-calc-hizmet-val">—</span>
          </div>
          <div class="ty-calc-row">
            <span class="ty-calc-row-label">Stopaj (%1)</span>
            <span class="ty-calc-row-value fee" id="ty-calc-stopaj-val">—</span>
          </div>

          <hr class="ty-calc-divider">

          <div class="ty-calc-section-title">KDV Hesabı</div>
          <div class="ty-calc-row">
            <span class="ty-calc-row-label">Satış KDV</span>
            <span class="ty-calc-row-value info" id="ty-calc-satis-kdv">—</span>
          </div>
          <div class="ty-calc-row">
            <span class="ty-calc-row-label">İndirilecek KDV</span>
            <span class="ty-calc-row-value info" id="ty-calc-indirilecek-kdv">—</span>
          </div>
          <div class="ty-calc-row">
            <span class="ty-calc-row-label">Ödenecek KDV</span>
            <span class="ty-calc-row-value fee" id="ty-calc-net-kdv">—</span>
          </div>

          <hr class="ty-calc-divider">

          <div class="ty-calc-row">
            <span class="ty-calc-row-label">Trendyol Ödeme</span>
            <span class="ty-calc-row-value neutral" id="ty-calc-odeme">—</span>
          </div>

          <hr class="ty-calc-divider">

          <div class="ty-calc-row profit">
            <span class="ty-calc-row-label">Net Kâr</span>
            <span class="ty-calc-row-value" id="ty-calc-net-kar">—</span>
          </div>
          <div class="ty-calc-row roi">
            <span class="ty-calc-row-label">ROI</span>
            <span class="ty-calc-row-value" id="ty-calc-roi">—</span>
          </div>
          <div class="ty-calc-row roi">
            <span class="ty-calc-row-label">Marj</span>
            <span class="ty-calc-row-value" id="ty-calc-margin">—</span>
          </div>
        </div>

        <div class="ty-calc-warning" id="ty-calc-status" style="display:none;"></div>
      </div>
    `;

    document.body.appendChild(panel);
    return panel;
  }

  // ─── Update Calculations ────────────────────────────────────
  function recalculate(product) {
    const priceInput = document.getElementById('ty-calc-price-input');
    const cogsInput = document.getElementById('ty-calc-cogs-input');
    const desiInput = document.getElementById('ty-calc-desi-input');
    const carrierSelect = document.getElementById('ty-calc-carrier-select');
    const alisKdvSelect = document.getElementById('ty-calc-alis-kdv-select');
    const komisyonInput = document.getElementById('ty-calc-komisyon-input');

    const satisFiyati = readNumberInput(priceInput);
    const cogs = readNumberInput(cogsInput) || 0;
    const desi = parseInt(desiInput?.value) || 1;
    const carrier = carrierSelect?.value || 'enucuz';
    const alisKdvOrani = parseFloat(alisKdvSelect?.value) || 0;
    const komisyonOverride = parseFloat(komisyonInput?.value);

    if (!Number.isFinite(satisFiyati) || satisFiyati <= 0) {
      clearCalculatedValues();
      showStatus('Geçerli bir satış fiyatı girin', true);
      return;
    }

    if (satisFiyati >= 300 && desi > 0) {
      const shippingRate = carrier === 'enucuz'
        ? TYCalculator.getCheapestCarrier(desi).rate
        : TYCalculator.getShippingRate(carrier, desi);

      if (!Number.isFinite(shippingRate)) {
        clearCalculatedValues();
        const carrierName = carrier === 'enucuz'
          ? 'kargo firmalarında'
          : TYCalculator.CARRIER_DISPLAY_NAMES[carrier] || carrier;
        showStatus(`${carrierName} için ${desi} desi yayımlanmış tarife bulunmuyor`, true);
        return;
      }
    }

    const result = TYCalculator.calculate({
      satisFiyati,
      cogs,
      desi,
      satisKdvOrani: product.tax != null ? product.tax / 100 : 0.20,
      alisKdvOrani,
      carrier,
      categoryHierarchy: product.categoryHierarchy,
      categoryName: product.categoryName,
      komisyonOverride: !isNaN(komisyonOverride) ? komisyonOverride : null,
      freeCargo: product.freeCargo,
    });

    const fmt = (v) => `₺${formatNum(v)}`;
    const cls = (v) => v >= 0 ? 'positive' : 'negative';

    // Komisyon
    setText('ty-calc-komisyon-val', fmt(result.komisyon));
    const komisyonLabel = document.getElementById('ty-calc-komisyon-label');
    if (komisyonLabel) komisyonLabel.textContent = `Komisyon (%${result.komisyonOrani})`;

    // Kargo
    if (result.sellerPaysCargo) {
      const kargoLabel = document.getElementById('ty-calc-kargo-label');
      if (kargoLabel) kargoLabel.textContent = `Kargo (${result.kargoCarrierName})`;
      setText('ty-calc-kargo-val', fmt(result.kargoToplam));
    } else {
      const kargoLabel = document.getElementById('ty-calc-kargo-label');
      if (kargoLabel) kargoLabel.textContent = 'Kargo';
      setText('ty-calc-kargo-val', '₺0 (müşteri öder)');
    }
    updateCargoBadge(result.sellerPaysCargo);

    // Hizmet & Stopaj
    setText('ty-calc-hizmet-val', fmt(result.hizmetToplam));
    setText('ty-calc-stopaj-val', fmt(result.stopaj));

    // KDV
    setText('ty-calc-satis-kdv', fmt(result.satisKdv));
    setText('ty-calc-indirilecek-kdv', fmt(result.toplamIndirilecekKdv));
    if (result.devredenKdv > 0) {
      setValColored('ty-calc-net-kdv', `₺0 (₺${formatNum(result.devredenKdv)} devreden)`, 'info');
    } else {
      setText('ty-calc-net-kdv', fmt(result.netKdv));
    }

    // Trendyol Ödeme
    setText('ty-calc-odeme', fmt(result.trendyolOdeme));

    // Profit
    setValColored('ty-calc-net-kar', fmt(result.netKar), cls(result.netKar));
    setValColored('ty-calc-roi', `${result.roi.toFixed(1)}%`, cls(result.roi));
    setValColored('ty-calc-margin', `${result.margin.toFixed(1)}%`, cls(result.margin));

    // Commission and shipping warnings
    const warnings = [];
    if (!result.komisyonMatched) {
      warnings.push('Kategori eşleşmedi — komisyon oranını kontrol edin');
    }
    const logisticsCarriers = ['CEVATedarik', 'CEVA', 'Horoz'];
    if (result.sellerPaysCargo && result.desi >= 100 && !logisticsCarriers.includes(result.kargoCarrier)) {
      warnings.push('100 desi ve üzerindeki gönderilerde ağır kargo ek bedeli ayrıca oluşabilir');
    }
    if (warnings.length) {
      showStatus(warnings.join(' · '), false);
    } else {
      hideStatus();
    }
  }

  // ─── Helpers ────────────────────────────────────────────────
  function formatNum(n) {
    return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function readNumberInput(input) {
    if (!input) return NaN;
    if (Number.isFinite(input.valueAsNumber)) return input.valueAsNumber;
    return Number.parseFloat(String(input.value || '').trim().replace(',', '.'));
  }

  function updateCargoBadge(sellerPaysCargo) {
    const container = document.getElementById('ty-calc-cargo-badge');
    if (!container) return;
    container.innerHTML = sellerPaysCargo
      ? '<span class="ty-calc-badge seller-cargo">Satıcı Öder</span>'
      : '<span class="ty-calc-badge free-cargo">Müşteri Öder</span>';
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function clearCalculatedValues() {
    const resultIds = [
      'ty-calc-komisyon-val', 'ty-calc-kargo-val', 'ty-calc-hizmet-val',
      'ty-calc-stopaj-val', 'ty-calc-satis-kdv', 'ty-calc-indirilecek-kdv',
      'ty-calc-net-kdv', 'ty-calc-odeme', 'ty-calc-net-kar',
      'ty-calc-roi', 'ty-calc-margin',
    ];
    for (const id of resultIds) setText(id, '—');
  }

  function setValColored(id, text, colorClass) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = text;
      el.className = `ty-calc-row-value ${colorClass}`;
    }
  }

  function showStatus(msg, isError) {
    const el = document.getElementById('ty-calc-status');
    if (el) {
      el.textContent = msg;
      el.style.display = msg ? 'block' : 'none';
      el.style.color = isError ? '#ef5350' : '#ff9800';
      el.style.background = isError ? 'rgba(239,83,80,0.08)' : 'rgba(255,152,0,0.08)';
    }
  }

  function hideStatus() {
    const el = document.getElementById('ty-calc-status');
    if (el) el.style.display = 'none';
  }

  // ─── Toggle & Drag ──────────────────────────────────────────
  function setupToggle(panel) {
    const btn = document.getElementById('ty-calc-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const minimized = panel.classList.toggle('minimized');
      btn.textContent = minimized ? '+' : '−';
      btn.title = minimized ? 'Genişlet' : 'Küçült';
    });
  }

  function setupDrag(panel) {
    const header = panel.querySelector('.ty-calc-header');
    let isDragging = false, startX, startY, startRight, startBottom;

    header.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startRight = parseInt(panel.style.right || '16');
      startBottom = parseInt(panel.style.bottom || '16');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panel.style.right = Math.max(0, startRight + (startX - e.clientX)) + 'px';
      panel.style.bottom = Math.max(0, startBottom + (startY - e.clientY)) + 'px';
    });

    document.addEventListener('mouseup', () => { isDragging = false; });
  }

  // ─── Main ───────────────────────────────────────────────────

  // Wait for page to fully load
  await new Promise(r => setTimeout(r, 500));

  const product = extractProductData();
  if (!product || !product.price) {
    console.warn('[TY Calc] Ürün verisi bulunamadı');
    return;
  }

  console.log('[TY Calc] Ürün bulundu:', product.name, '₺' + product.price);

  const panel = createPanel(product);
  setupToggle(panel);
  setupDrag(panel);

  // Load saved COGS & Desi
  const productKey = String(product.id || product.barcode || product.name);
  const savedCogs = await COGSStorage.load(productKey);
  const savedDesi = await DesiStorage.load(productKey);

  const cogsInput = document.getElementById('ty-calc-cogs-input');
  const desiInput = document.getElementById('ty-calc-desi-input');
  const priceInput = document.getElementById('ty-calc-price-input');

  if (savedCogs != null && cogsInput) {
    cogsInput.value = savedCogs;
  }
  if (savedDesi != null && desiInput) {
    desiInput.value = savedDesi;
  }

  // Initial calculation
  recalculate(product);

  // Input handlers with debounced save
  let saveTimeout = null;

  function onInputChange() {
    recalculate(product);

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      const cogsVal = parseFloat(cogsInput?.value);
      const desiVal = parseInt(desiInput?.value);
      if (!isNaN(cogsVal) && cogsVal > 0) COGSStorage.save(productKey, cogsVal);
      if (!isNaN(desiVal) && desiVal > 0) DesiStorage.save(productKey, desiVal);
    }, 500);
  }

  // Attach listeners to all inputs
  const inputs = [
    'ty-calc-price-input',
    'ty-calc-cogs-input',
    'ty-calc-desi-input',
    'ty-calc-carrier-select',
    'ty-calc-alis-kdv-select',
    'ty-calc-komisyon-input',
  ];

  for (const inputId of inputs) {
    const el = document.getElementById(inputId);
    if (el) {
      el.addEventListener('input', onInputChange);
      el.addEventListener('change', onInputChange);
    }
  }

  const resetPriceButton = document.getElementById('ty-calc-price-reset');
  if (resetPriceButton && priceInput) {
    resetPriceButton.addEventListener('click', () => {
      priceInput.value = product.price;
      onInputChange();
    });
  }
})();
