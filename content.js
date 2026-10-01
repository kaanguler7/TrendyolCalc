// Pazaryeri Kâr Hesaplayıcı — Content Script

(async () => {
  const platform = location.hostname.endsWith('hepsiburada.com') ? 'hepsiburada' : 'trendyol';
  const platformConfig = platform === 'hepsiburada'
    ? {
        name: 'Hepsiburada',
        title: 'Hepsiburada Kâr Hesaplayıcı',
        paymentLabel: 'Hepsiburada Ödeme',
        serviceFee: 12,
        serviceFeeEnabled: true,
        serviceFeeLabel: 'Hizmet Bedeli',
        tariffText: 'Barem 0–399 · Desi 01.08 · KDV hariç',
      }
    : {
        name: 'Trendyol',
        title: 'Trendyol Kâr Hesaplayıcı',
        paymentLabel: 'Trendyol Ödeme',
        serviceFee: 10.99,
        serviceFeeEnabled: true,
        serviceFeeLabel: 'Platform Hizmet Bedeli',
        tariffText: 'Barem 10.08 · Desi 08.09 · KDV hariç',
      };
  // ─── Product Data Extraction from SSR JSON ──────────────────
  function extractProductData() {
    return platform === 'hepsiburada'
      ? extractHepsiburadaProductData()
      : extractTrendyolProductData();
  }

  function resolveMarketPrice(value, depth = 0) {
    if (depth > 5 || value == null) return null;
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
      const parsed = Number.parseFloat(cleaned);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const price = resolveMarketPrice(item, depth + 1);
        if (price != null) return price;
      }
      return null;
    }
    if (typeof value === 'object') {
      const preferredKeys = [
        'discountedPrice', 'sellingPrice', 'salePrice', 'currentPrice',
        'price', 'value', 'amount', 'formattedPrice',
      ];
      for (const key of preferredKeys) {
        if (!(key in value)) continue;
        const price = resolveMarketPrice(value[key], depth + 1);
        if (price != null) return price;
      }
    }
    return null;
  }

  function resolveHepsiburadaCurrentPrice(prices) {
    if (!Array.isArray(prices)) return resolveMarketPrice(prices);
    // Hepsiburada can publish the list price first and the discounted/current
    // price second. Prefer an explicitly discounted entry instead of blindly
    // taking the first number in the array.
    const discounted = prices.filter(price => Number(price?.discountRate) > 0);
    if (discounted.length) return resolveMarketPrice(discounted.at(-1));
    return resolveMarketPrice(prices[0]);
  }

  function normalizeSellerSnapshot(sellers) {
    return SellerHistoryEngine.normalizeSellers(sellers).map(seller => ({
      id: seller.id,
      name: seller.name,
      price: seller.priceCents / 100,
    }));
  }

  function extractHepsiburadaPageState() {
    for (const script of document.scripts) {
      const text = (script.textContent || '').trim();
      if (!text.includes('"productState"')) continue;
      try {
        const state = JSON.parse(text);
        if (state?.productState?.product) return state;
      } catch (error) {}
    }
    return null;
  }

  function sellerFromHepsiburadaListing(listing, fallbackPrice = null) {
    if (!listing) return null;
    const merchant = listing.merchant || listing.seller || {};
    const name = listing.merchantName || merchant.name || listing.sellerName || listing.name;
    const id = listing.merchantId || merchant.id || merchant.merchantId || listing.sellerId || name;
    const price = resolveHepsiburadaCurrentPrice(listing.prices)
      || resolveMarketPrice(listing.price)
      || resolveMarketPrice(listing)
      || fallbackPrice;
    return id && name && price ? { id, name, price } : null;
  }

  function extractTrendyolProductData() {
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
    const unitPrice = priceObj?.discountedPrice?.value
      || priceObj?.sellingPrice?.value
      || priceObj?.originalPrice?.value
      || extractPriceFromPage();
    const moqElement = document.querySelector('[data-testid="moq-text"], [data-testid="moq-info"], .moq-info-text');
    const minQuantity = TYCalculator.resolveMinimumOrderQuantity(
      product,
      winnerVariant,
      moqElement?.textContent,
    );
    const packagePrice = TYCalculator.getPackageSaleTotal(unitPrice, minQuantity);
    const listing = product.merchantListing || product.allMerchantListings?.[0] || {};
    const winnerMerchant = listing.merchant || {};
    const sellers = [];
    if (winnerMerchant.id && winnerMerchant.name) {
      sellers.push({ id: winnerMerchant.id, name: winnerMerchant.name, price: packagePrice });
    }
    for (const merchant of listing.otherMerchants || []) {
      const otherPrice = resolveMarketPrice(merchant.price)
        || resolveMarketPrice(merchant.winnerVariant?.price)
        || resolveMarketPrice(merchant);
      if (merchant?.id && merchant?.name && otherPrice) {
        sellers.push({
          id: merchant.id,
          name: merchant.name,
          price: TYCalculator.getPackageSaleTotal(otherPrice, minQuantity),
        });
      }
    }

    return {
      platform,
      id: product.id,
      name: product.name,
      price: packagePrice,
      unitPrice,
      minQuantity,
      tax: product.tax, // KDV oranı (e.g., 10 means %10)
      brand: product.brand?.name,
      categoryId: product.category?.id,
      categoryName: product.category?.name,
      categoryHierarchy: product.category?.hierarchy,
      freeCargo: winnerVariant?.freeCargo || false,
      barcode: product.variants?.[0]?.barcode,
      sellers: normalizeSellerSnapshot(sellers),
      sellerListComplete: sellers.length > 0,
    };
  }

  function extractHepsiburadaProductData() {
    const pageState = extractHepsiburadaPageState();
    const stateProduct = pageState?.productState?.product;
    const candidates = [];
    const visit = (value) => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
      if (types.includes('Product') && value.offers) candidates.push(value);
      Object.values(value).forEach(visit);
    };

    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { visit(JSON.parse(script.textContent || '')); } catch (error) {}
    }

    const product = candidates[0];
    if (!product && !stateProduct) return null;
    const offers = Array.isArray(product?.offers) ? product.offers[0] : product?.offers;
    const unitPrice = extractPriceFromPage()
      || resolveHepsiburadaCurrentPrice(stateProduct?.prices)
      || resolveMarketPrice(stateProduct?.price)
      || Number(offers?.price);
    const stateCategories = (stateProduct?.categories || []).map(category => category?.name).filter(Boolean);
    const categoryHierarchy = stateCategories.length
      ? stateCategories.join(' > ')
      : String(product?.category || '');
    const categoryParts = categoryHierarchy.split(/\s*>\s*/).filter(Boolean);
    const brand = stateProduct?.brand
      || (typeof product?.brand === 'string' ? product.brand : product?.brand?.name);
    const sellers = [];
    const winner = sellerFromHepsiburadaListing({
      merchant: stateProduct?.merchant,
      merchantId: stateProduct?.merchantId,
      merchantName: stateProduct?.merchantName,
      prices: stateProduct?.prices,
      price: stateProduct?.price,
    }, unitPrice) || sellerFromHepsiburadaListing(offers?.seller ? {
      seller: offers.seller,
      price: offers.price,
    } : null, unitPrice);
    if (winner) sellers.push(winner);
    for (const listing of stateProduct?.listings || []) {
      const seller = sellerFromHepsiburadaListing(listing);
      if (seller) sellers.push(seller);
    }

    return {
      platform,
      id: stateProduct?.sku || product?.sku || product?.gtin || location.pathname,
      name: stateProduct?.name || product?.name || document.title,
      price: unitPrice,
      unitPrice,
      minQuantity: 1,
      tax: null,
      brand,
      categoryName: categoryParts.at(-1) || categoryHierarchy,
      categoryHierarchy,
      freeCargo: false,
      barcode: product?.gtin || product?.gtin13 || stateProduct?.sku || product?.sku,
      urlName: stateProduct?.urlName || location.pathname.split('/').filter(Boolean)[0] || '',
      sellers: normalizeSellerSnapshot(sellers),
      sellerListComplete: sellers.length > 0
        && (stateProduct ? stateProduct.hasMoreListings !== true : sellers.length <= 1),
    };
  }

  function extractPriceFromPage() {
    const selectors = platform === 'hepsiburada' ? [
      // The first child is the payable/current price; prev-price and the rest
      // of this container can contain the crossed-out list price and savings.
      '[data-test-id="default-price"] > :first-child',
      '[data-test-id="checkout-price"]',
      '[data-test-id="price"] [data-test-id="price-current-price"]',
      '[itemprop="price"]',
    ] : [
      '.product-price-container .prc-dsc',
      '.product-price-container .prc-slg',
      '.pr-bx-w .prc-dsc',
      '[data-testid="price-current-price"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const rawPrice = el.getAttribute('content') || el.getAttribute('value') || el.textContent || '';
        const text = rawPrice.replace(/[^\d.,]/g, '').trim();
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
    panel.dataset.platform = platform;

    const kdvStr = product.tax != null ? `%${product.tax}` : '%20 varsayılan';
    const categoryShort = product.categoryName || (product.categoryHierarchy || '').split('/').pop() || '—';
    const quantitySuffix = product.minQuantity > 1 ? ` (${product.minQuantity} adet)` : '';
    const minimumOrderRow = product.minQuantity > 1
      ? `<div class="ty-calc-info-row">
            <span class="ty-calc-info-label">Minimum Sipariş</span>
            <span class="ty-calc-info-value">${product.minQuantity} × ₺${formatNum(Number(product.unitPrice))}</span>
          </div>`
      : '';

    // Find initial commission
    const commInfo = TYCalculator.findCommissionRate(
      product.categoryHierarchy,
      product.categoryName,
      platform,
      product.brand,
      product.name,
    );

    // Cargo badge
    const cargoBadge = platform === 'hepsiburada'
      ? (product.price < 400
        ? `<span class="ty-calc-badge barem-cargo">Barem · ${product.price < 200 ? '0–199' : '200–399'}</span>`
        : '<span class="ty-calc-badge seller-cargo">Desi Tarifesi</span>')
      : (product.price < TYCalculator.BAREM_THRESHOLD
        ? '<span class="ty-calc-badge barem-cargo">Barem · Standart</span>'
        : '<span class="ty-calc-badge seller-cargo">Desi Tarifesi</span>');

    // Carrier options
    const carrierOptions = Object.entries(TYCalculator.getCarrierDisplayNames(platform))
      .map(([key, name]) => `<option value="${key}">${name}</option>`)
      .join('');

    const baremOptions = platform === 'hepsiburada'
      ? `<option value="support">Kargo Desteği (Otomatik)</option>
         <option value="desi">Desteği Kapat · Desi</option>`
      : `<option value="standard">Standart Barem</option>
         <option value="advantage">Avantajlı Barem</option>
         <option value="desi">Her Zaman Desi</option>`;
    const commissionVatIncluded = TYCalculator.getPlatformMeta(platform).commissionVatIncluded;
    const commissionRateText = formatCommissionRate(commInfo.rate, commissionVatIncluded);
    const commissionInputLabel = platform === 'hepsiburada'
      ? 'Komisyon % (KDV Hariç)'
      : 'Komisyon % (KDV Dahil)';
    const serviceFeeChecked = platformConfig.serviceFeeEnabled ? 'checked' : '';
    const maxDesi = TYCalculator.getPlatformMeta(platform).maxDesi;
    const deductionsMarkup = platform === 'hepsiburada'
      ? `<div class="ty-calc-row-inputs">
          <div class="ty-calc-input-group">
            <label>Hizmet Bedeli (KDV Hariç)</label>
            <div class="ty-calc-input-wrapper">
              <select class="ty-calc-select" id="ty-calc-hb-service-fee-select">
                <option value="12" selected>Standart · 12 TL + KDV</option>
                <option value="6">Aynı Gün · 6 TL + KDV</option>
                <option value="0">Muaf · 0 TL</option>
              </select>
            </div>
          </div>
          <div class="ty-calc-input-group">
            <label>Uygulanacak Kesintiler</label>
            <div class="ty-calc-toggle-stack">
              <label class="ty-calc-check-row">
                <input type="checkbox" id="ty-calc-stopaj-enabled" checked>
                Stopaj (%1)
              </label>
            </div>
          </div>
        </div>`
      : `<div class="ty-calc-row-inputs">
          <div class="ty-calc-input-group">
            <label>${platformConfig.serviceFeeLabel} (KDV Hariç)</label>
            <div class="ty-calc-input-wrapper">
              <span class="ty-calc-currency-prefix">₺</span>
              <input type="number" class="ty-calc-input" id="ty-calc-service-fee-input"
                     value="${platformConfig.serviceFee}" step="0.01" min="0"
                     title="Standart: 10,99 TL + KDV. Şartları sağlayan Bugün Kargoda gönderileri: 4,99 TL + KDV.">
            </div>
          </div>
          <div class="ty-calc-input-group">
            <label>Uygulanacak Kesintiler</label>
            <div class="ty-calc-toggle-stack">
              <label class="ty-calc-check-row">
                <input type="checkbox" id="ty-calc-service-fee-enabled" ${serviceFeeChecked}>
                ${platformConfig.serviceFeeLabel}
              </label>
              <label class="ty-calc-check-row">
                <input type="checkbox" id="ty-calc-today-shipping-fee-enabled">
                Bugün Kargoda (4,99 + KDV)
              </label>
              <label class="ty-calc-check-row">
                <input type="checkbox" id="ty-calc-stopaj-enabled" checked>
                Stopaj (%1)
              </label>
            </div>
          </div>
        </div>`;
    const serviceFeeResultMarkup = `<div class="ty-calc-row">
          <span class="ty-calc-row-label">${platformConfig.serviceFeeLabel}</span>
          <span class="ty-calc-row-value fee" id="ty-calc-hizmet-val">—</span>
        </div>`;
    const trendyolShippingContextMarkup = platform === 'trendyol'
      ? `<div class="ty-calc-row-inputs">
          <div class="ty-calc-input-group">
            <label>Sipariş Toplamı (Barem İçin)</label>
            <div class="ty-calc-input-wrapper">
              <span class="ty-calc-currency-prefix">₺</span>
              <input type="number" class="ty-calc-input" id="ty-calc-order-total-input"
                     value="${product.price || ''}" step="0.01" min="0.01" data-manual="false">
            </div>
          </div>
          <div class="ty-calc-input-group">
            <label>Paket Durumu</label>
            <div class="ty-calc-input-wrapper">
              <select class="ty-calc-select" id="ty-calc-package-role-select">
                <option value="single" selected>Tek Paket</option>
                <option value="splitLowest">Bölünmüş · En Düşük Desi</option>
                <option value="splitOther">Bölünmüş · Diğer Paket</option>
              </select>
            </div>
          </div>
        </div>
        <div class="ty-calc-cost-note" id="ty-calc-shipping-context-note">
          Barem kararı ürün adedine değil toplam sipariş tutarına göre verilir.
        </div>`
      : '';

    // KDV options
    const initialVatPercent = product.tax != null ? product.tax : 20;
    const kdvOptions = [0, 1, 10, 20].map(v => {
      const selected = v === initialVatPercent ? 'selected' : '';
      return `<option value="${v / 100}" ${selected}>%${v}</option>`;
    }).join('');

    panel.innerHTML = `
      <div class="ty-calc-header">
        <span class="ty-calc-header-title">${platformConfig.title}</span>
        <button class="ty-calc-toggle-btn" id="ty-calc-toggle" title="Küçült">−</button>
      </div>
      <div class="ty-calc-body">
        <div class="ty-calc-info">
          <div class="ty-calc-info-row ty-calc-price-row">
            <span class="ty-calc-info-label">Paket Satış Toplamı${quantitySuffix}</span>
            <span class="ty-calc-price-editor">
              <span class="ty-calc-price-prefix">₺</span>
              <input type="number" class="ty-calc-price-input" id="ty-calc-price-input"
                     value="${product.price || ''}" step="0.01" min="0.01"
                     aria-label="Hesaplanacak satış fiyatı">
              <button type="button" class="ty-calc-price-reset-btn" id="ty-calc-price-reset"
                      title="${platformConfig.name} paket toplamına dön" aria-label="${platformConfig.name} paket toplamına dön">↺</button>
            </span>
          </div>
          ${minimumOrderRow}
          <div class="ty-calc-info-row">
            <span class="ty-calc-info-label">Kategori</span>
            <span class="ty-calc-info-value" title="${product.categoryHierarchy || ''}">${categoryShort}</span>
          </div>
          <div class="ty-calc-info-row">
            <span class="ty-calc-info-label">Sayfadaki KDV</span>
            <span class="ty-calc-info-value">${kdvStr}</span>
          </div>
          <div class="ty-calc-info-row">
            <span class="ty-calc-info-label">Komisyon</span>
            <span class="ty-calc-info-value" id="ty-calc-commission-info">${commInfo.matched ? commInfo.label : 'Eşleşmedi'} (${commissionRateText})</span>
          </div>
          <div class="ty-calc-info-row">
            <span class="ty-calc-info-label">Kargo</span>
            <span class="ty-calc-info-value" id="ty-calc-cargo-badge">${cargoBadge}</span>
          </div>
          <div class="ty-calc-info-row">
            <span class="ty-calc-info-label">Kargo Tarifeleri</span>
            <span class="ty-calc-info-value">${platformConfig.tariffText}</span>
          </div>
        </div>

        <details class="ty-calc-seller-tracker" id="ty-calc-seller-tracker">
          <summary class="ty-calc-seller-summary">
            <div>
              <span class="ty-calc-section-title">Satıcı Takibi</span>
              <strong id="ty-calc-seller-count">Kontrol ediliyor…</strong>
            </div>
            <span id="ty-calc-seller-check-time">—</span>
          </summary>
          <div class="ty-calc-seller-details">
            <div class="ty-calc-seller-note" id="ty-calc-seller-note">
              Sayfa açılışında ve açık kaldığı sürece 15 dakikada bir kontrol edilir.
            </div>
            <div class="ty-calc-seller-subtitle">Güncel satıcılar</div>
            <div class="ty-calc-seller-list" id="ty-calc-seller-list"></div>
            <div class="ty-calc-seller-subtitle">Giriş, çıkış ve fiyat değişimleri</div>
            <div class="ty-calc-seller-history" id="ty-calc-seller-history"></div>
          </div>
        </details>

        ${trendyolShippingContextMarkup}

        <div class="ty-calc-row-inputs">
          <div class="ty-calc-input-group">
            <label>Birim Alış Fiyatı</label>
            <div class="ty-calc-input-wrapper">
              <span class="ty-calc-currency-prefix">₺</span>
              <input type="number" class="ty-calc-input" id="ty-calc-cogs-input"
                     placeholder="0.00" step="0.01" min="0">
            </div>
          </div>
          <div class="ty-calc-input-group">
            <label>Fiyat Girişi</label>
            <div class="ty-calc-input-wrapper">
              <select class="ty-calc-select" id="ty-calc-cogs-vat-basis-select">
                <option value="gross" selected>KDV Dahil</option>
                <option value="net">KDV Hariç</option>
              </select>
            </div>
          </div>
        </div>
        <div class="ty-calc-cost-note" id="ty-calc-cost-note">Alış fiyatının KDV durumunu seçin.</div>

        <div class="ty-calc-row-inputs">
          <div class="ty-calc-input-group">
            <label>${platform === 'hepsiburada' ? 'Kargo Tarife Türü' : 'Kargo Barem Modu'}</label>
            <div class="ty-calc-input-wrapper">
              <select class="ty-calc-select" id="ty-calc-barem-mode-select">
                ${baremOptions}
              </select>
            </div>
          </div>
          <div class="ty-calc-input-group">
            <label>Satış KDV</label>
            <div class="ty-calc-input-wrapper">
              <select class="ty-calc-select" id="ty-calc-satis-kdv-select">
                ${kdvOptions}
              </select>
            </div>
          </div>
        </div>

        <div class="ty-calc-row-inputs">
          <div class="ty-calc-input-group">
            <label>Desi</label>
            <div class="ty-calc-input-wrapper">
              <input type="number" class="ty-calc-input" id="ty-calc-desi-input"
                     placeholder="1" step="1" min="1" max="${maxDesi}" value="1">
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
            <label>${commissionInputLabel}</label>
            <div class="ty-calc-input-wrapper">
              <span class="ty-calc-currency-prefix">%</span>
              <input type="number" class="ty-calc-input" id="ty-calc-komisyon-input"
                     placeholder="${commInfo.rate}" step="0.1" min="0" max="50"
                     value="${commInfo.rate}" data-manual="false">
            </div>
          </div>
        </div>

        ${deductionsMarkup}

        <div class="ty-calc-results">
          <div class="ty-calc-section-title">Kesintiler</div>
          <div class="ty-calc-row">
            <span class="ty-calc-row-label" id="ty-calc-komisyon-label">Komisyon (${commissionRateText})</span>
            <span class="ty-calc-row-value fee" id="ty-calc-komisyon-val">—</span>
          </div>
          <div class="ty-calc-row">
            <span class="ty-calc-row-label" id="ty-calc-kargo-label">Kargo</span>
            <span class="ty-calc-row-value fee" id="ty-calc-kargo-val">—</span>
          </div>
          ${serviceFeeResultMarkup}
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
          <div class="ty-calc-row">
            <span class="ty-calc-row-label">Devreden KDV</span>
            <span class="ty-calc-row-value info" id="ty-calc-devreden-kdv">—</span>
          </div>

          <hr class="ty-calc-divider">

          <div class="ty-calc-row">
            <span class="ty-calc-row-label">${platformConfig.paymentLabel}</span>
            <span class="ty-calc-row-value neutral" id="ty-calc-odeme">—</span>
          </div>
          <div class="ty-calc-row">
            <span class="ty-calc-row-label">Net Nakit</span>
            <span class="ty-calc-row-value neutral" id="ty-calc-nakit-kalan">—</span>
          </div>

          <hr class="ty-calc-divider">

          <div class="ty-calc-row profit">
            <span class="ty-calc-row-label">Ticari Kâr (KDV Hariç)</span>
            <span class="ty-calc-row-value" id="ty-calc-net-kar">—</span>
          </div>
          <div class="ty-calc-row roi">
            <span class="ty-calc-row-label">Maliyet ROI</span>
            <span class="ty-calc-row-value" id="ty-calc-roi">—</span>
          </div>
          <div class="ty-calc-row roi">
            <span class="ty-calc-row-label">Net Marj</span>
            <span class="ty-calc-row-value" id="ty-calc-margin">—</span>
          </div>
          <div class="ty-calc-footnote">Net Nakit; tedarikçi ödemesi, ödenecek KDV ve stopaj sonrasıdır. Bazı internet hesaplayıcılarının “Kâr” sonucu bu satıra karşılık gelir. Ticari kâr KDV hariç ekonomik sonuçtur; stopaj vergi ön ödemesi olduğu için kârdan düşülmez.</div>
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
    const cogsVatBasisSelect = document.getElementById('ty-calc-cogs-vat-basis-select');
    const orderTotalInput = document.getElementById('ty-calc-order-total-input');
    const packageRoleSelect = document.getElementById('ty-calc-package-role-select');
    const desiInput = document.getElementById('ty-calc-desi-input');
    const carrierSelect = document.getElementById('ty-calc-carrier-select');
    const baremModeSelect = document.getElementById('ty-calc-barem-mode-select');
    const satisKdvSelect = document.getElementById('ty-calc-satis-kdv-select');
    const alisKdvSelect = document.getElementById('ty-calc-alis-kdv-select');
    const komisyonInput = document.getElementById('ty-calc-komisyon-input');
    const serviceFeeInput = document.getElementById('ty-calc-service-fee-input');
    const hbServiceFeeSelect = document.getElementById('ty-calc-hb-service-fee-select');
    const serviceFeeEnabled = document.getElementById('ty-calc-service-fee-enabled');
    const todayShippingFeeEnabled = document.getElementById('ty-calc-today-shipping-fee-enabled');
    const stopajEnabled = document.getElementById('ty-calc-stopaj-enabled');

    const satisFiyati = readNumberInput(priceInput);
    const orderTotalGross = platform === 'trendyol' ? readNumberInput(orderTotalInput) : satisFiyati;
    const packageRole = platform === 'trendyol' ? (packageRoleSelect?.value || 'single') : 'single';
    const unitCostEntered = readNumberInput(cogsInput) || 0;
    const desi = parseInt(desiInput?.value) || 1;
    const carrier = carrierSelect?.value || 'enucuz';
    const baremMode = baremModeSelect?.value || (platform === 'hepsiburada' ? 'support' : 'standard');
    const satisKdvOrani = readSelectNumber(satisKdvSelect, product.tax != null ? product.tax / 100 : 0.20);
    const alisKdvOrani = readSelectNumber(alisKdvSelect, satisKdvOrani);
    const purchaseQuantity = Math.max(1, Number(product.minQuantity) || 1);
    const costVatIncluded = cogsVatBasisSelect?.value !== 'net';
    const costBreakdown = TYCalculator.getCostBreakdown(
      unitCostEntered,
      alisKdvOrani,
      costVatIncluded,
      purchaseQuantity,
    );
    const cogs = costBreakdown.netTotal;
    const komisyonOverride = parseFloat(komisyonInput?.value);
    const hizmetBedeliKdvHaric = platform === 'hepsiburada'
      ? readSelectNumber(hbServiceFeeSelect, platformConfig.serviceFee)
      : readNumberInput(serviceFeeInput);

    if (!Number.isFinite(satisFiyati) || satisFiyati <= 0) {
      clearCalculatedValues();
      showStatus('Geçerli bir satış fiyatı girin', true);
      return;
    }
    if (!Number.isFinite(orderTotalGross) || orderTotalGross <= 0) {
      clearCalculatedValues();
      showStatus('Geçerli bir sipariş toplamı girin', true);
      return;
    }
    if (orderTotalGross < satisFiyati) {
      clearCalculatedValues();
      showStatus('Sipariş toplamı paket satış toplamından küçük olamaz', true);
      return;
    }

    const shippingContext = { orderTotalGross, packageRole };
    const cargoQuote = TYCalculator.getCargoQuote(
      satisFiyati,
      desi,
      carrier,
      baremMode,
      platform,
      shippingContext,
    );
    if (!Number.isFinite(cargoQuote.rate)) {
      clearCalculatedValues();
      const carrierName = carrier === 'enucuz'
        ? 'kargo firmalarında'
        : TYCalculator.getCarrierDisplayNames(platform)[carrier] || carrier;
      showStatus(`${carrierName} için ${desi} desi yayımlanmış tarife bulunmuyor`, true);
      return;
    }

    const result = TYCalculator.calculate({
      satisFiyati,
      cogs,
      desi,
      satisKdvOrani,
      alisKdvOrani,
      carrier,
      baremMode,
      orderTotalGross,
      packageRole,
      categoryHierarchy: product.categoryHierarchy,
      categoryName: product.categoryName,
      komisyonOverride: !isNaN(komisyonOverride) ? komisyonOverride : null,
      hizmetUygula: platform === 'hepsiburada'
        ? hizmetBedeliKdvHaric > 0
        : serviceFeeEnabled?.checked !== false,
      hizmetBedeliKdvHaric: Number.isFinite(hizmetBedeliKdvHaric)
        ? hizmetBedeliKdvHaric
        : platformConfig.serviceFee,
      stopajUygula: stopajEnabled?.checked !== false,
      platform,
      brand: product.brand,
      productName: product.name,
    });

    const fmt = (v) => `₺${formatNum(v)}`;
    const cls = (v) => v >= 0 ? 'positive' : 'negative';

    // Komisyon
    setText('ty-calc-komisyon-val', fmt(result.komisyon));
    const komisyonLabel = document.getElementById('ty-calc-komisyon-label');
    if (komisyonLabel) {
      komisyonLabel.textContent = `Komisyon (${formatCommissionRate(
        result.komisyonOrani,
        result.komisyonKdvDahilOran,
        result.komisyonEfektifOran,
      )})`;
    }
    const commissionInfo = document.getElementById('ty-calc-commission-info');
    if (commissionInfo) {
      commissionInfo.textContent = `${result.komisyonLabel || 'Manuel'} (${formatCommissionRate(
        result.komisyonOrani,
        result.komisyonKdvDahilOran,
        result.komisyonEfektifOran,
      )})`;
    }

    // Kargo
    const kargoLabel = document.getElementById('ty-calc-kargo-label');
    const tariffLabel = result.kargoTarifeTipi === 'barem' ? 'Barem' : 'Desi';
    if (kargoLabel) kargoLabel.textContent = `Kargo (${result.kargoCarrierName} · ${tariffLabel})`;
    setText('ty-calc-kargo-val', fmt(result.kargoToplam));
    updateCargoBadge(result);

    // Hizmet & Stopaj
    setText('ty-calc-hizmet-val', fmt(result.hizmetToplam));
    setText('ty-calc-stopaj-val', fmt(result.stopaj));

    // KDV
    setText('ty-calc-satis-kdv', fmt(result.satisKdv));
    setText('ty-calc-indirilecek-kdv', fmt(result.toplamIndirilecekKdv));
    setText('ty-calc-net-kdv', fmt(result.netKdv));
    setText('ty-calc-devreden-kdv', fmt(result.devredenKdv));

    const quantityText = costBreakdown.quantity > 1 ? `${costBreakdown.quantity} adet toplamı: ` : '';
    setText(
      'ty-calc-cost-note',
      `${quantityText}₺${formatNum(costBreakdown.grossTotal)} KDV dahil = ₺${formatNum(costBreakdown.netTotal)} net maliyet + ₺${formatNum(costBreakdown.vatTotal)} alış KDV`,
    );
    if (platform === 'trendyol') {
      const shippingContextText = packageRole === 'splitLowest'
        ? `₺${formatNum(orderTotalGross)} sipariş bölünmüş: en düşük desili bu paket barem adayıdır.`
        : packageRole === 'splitOther'
          ? `₺${formatNum(orderTotalGross)} sipariş bölünmüş: bu paket desi tarifesindedir.`
          : `Barem kararı ₺${formatNum(orderTotalGross)} toplam sipariş tutarı üzerinden verilir.`;
      setText('ty-calc-shipping-context-note', shippingContextText);
    }

    // Pazaryeri ödemesi
    setText('ty-calc-odeme', fmt(result.platformOdeme));
    setValColored('ty-calc-nakit-kalan', fmt(result.nakitKalan), cls(result.nakitKalan));

    // Profit
    setValColored('ty-calc-net-kar', fmt(result.ticariKar), cls(result.ticariKar));
    setValColored('ty-calc-roi', `${result.roi.toFixed(1)}%`, cls(result.roi));
    setValColored('ty-calc-margin', `${result.margin.toFixed(1)}%`, cls(result.margin));

    // Commission and shipping warnings
    const warnings = [];
    if (product.minQuantity > 1) {
      warnings.push(`Minimum ${product.minQuantity} adet zorunlu; paket toplamı ₺${formatNum(product.price)} üzerinden başlatıldı`);
    }
    if (komisyonInput?.dataset.manual !== 'true') {
      warnings.push('Komisyon otomatik tahmindir; sözleşme oranınızla kontrol edin');
    } else if (!result.komisyonMatched) {
      warnings.push('Kategori eşleşmedi; manuel komisyon oranı kullanılıyor');
    }
    const logisticsCarriers = platform === 'hepsiburada'
      ? ['CEVATedarik', 'CEVALojistik', 'HepsiJETXL', 'Horoz']
      : ['CEVA', 'Horoz'];
    if (platform === 'trendyol') {
      const trendyolServiceFee = readNumberInput(serviceFeeInput);
      if (serviceFeeEnabled?.checked === false) {
        warnings.push('Platform hizmet bedeli normalde her teslimat paketinde uygulanır; yalnız panelinizde muafiyet varsa kapatın');
      } else if (todayShippingFeeEnabled?.checked || Math.abs(trendyolServiceFee - 4.99) < 0.001) {
        warnings.push('4,99 TL + KDV yalnız Bugün Kargoda etiketli, aynı gün taşıma durumuna başarıyla geçen gönderilerde geçerlidir');
      } else if (Number.isFinite(trendyolServiceFee) && trendyolServiceFee < 10.99) {
        warnings.push('Platform hizmet bedeli standartta 10,99 TL + KDV; indirimli tutarı yalnız Satıcı Paneliniz doğruluyorsa kullanın');
      }
      if (result.kargoTarifeTipi === 'barem' && result.kargoBaremModu === 'advantage') {
        warnings.push('Avantajlı barem yalnızca başarılı hızlı/termin gönderim koşulunda geçerlidir');
      }
      if (orderTotalGross < TYCalculator.BAREM_THRESHOLD && result.kargoTarifeTipi === 'desi') {
        if (result.desi > TYCalculator.BAREM_MAX_DESI) {
          warnings.push('10 desi üstünde barem uygulanmaz; desi tarifesi kullanıldı');
        } else if (logisticsCarriers.includes(result.kargoCarrier)) {
          warnings.push('Lojistik taşıyıcılarda barem uygulanmaz; desi tarifesi kullanıldı');
        } else if (packageRole === 'splitOther') {
          warnings.push('Bölünmüş siparişte yalnız en düşük desili bir paket barem alır; bu paket desi tarifesinde');
        } else if (baremMode === 'desi') {
          warnings.push('Barem kapalı; desi tarifesi kullanılıyor');
        }
      } else if (orderTotalGross >= TYCalculator.BAREM_THRESHOLD && result.kargoTarifeTipi === 'desi') {
        warnings.push('Toplam sipariş 350 TL veya üzeri; bölünse bile tüm paketler desi tarifesindedir');
      }
    } else {
      const hbServiceFee = readSelectNumber(hbServiceFeeSelect, platformConfig.serviceFee);
      if (hbServiceFee === 0) {
        warnings.push('Hizmet bedeli muafiyeti yalnız hızlı ve zamanında gönderim performans koşulunda geçerlidir');
      } else if (hbServiceFee === 6) {
        warnings.push('6 TL hizmet bedeli yalnız sipariş ve son kargoya teslim tarihi aynı gün olan teslimatlarda geçerlidir');
      } else {
        warnings.push('Standart hizmet bedeli 12 TL + KDV; sözleşmenizde muafiyet varsa seçimi güncelleyin');
      }
      if (result.kargoTarifeTipi === 'barem') {
        warnings.push('Kargo desteği yalnız hepsiJET/Sürat ve 0–1 gün kargoya teslim performans koşullarında geçerlidir');
      } else if (satisFiyati < 400) {
        if (baremMode === 'desi') {
          warnings.push('Kargo desteği kapalı; desi tarifesi kullanılıyor');
        } else if (!['HepsiJET', 'Surat'].includes(result.kargoCarrier)) {
          warnings.push('Seçilen kargo destek kapsamında değil; desi tarifesi kullanıldı');
        }
      }
    }
    if (result.kargoAgirTasimaBedeli > 0) {
      warnings.push(`Ağır kargo taşıma bedeli ₺${formatNum(result.kargoAgirTasimaBedeli)} (KDV hariç) kargoya eklendi`);
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

  function formatPercent(n) {
    return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function formatCommissionRate(rate, vatIncluded, effectiveRate = null) {
    const base = Number(rate) || 0;
    const hasEffectiveRate = effectiveRate !== null
      && effectiveRate !== ''
      && Number.isFinite(Number(effectiveRate));
    const effective = hasEffectiveRate
      ? Number(effectiveRate)
      : (vatIncluded ? base : base * 1.20);
    return vatIncluded
      ? `%${formatPercent(effective)} KDV dahil`
      : `%${formatPercent(base)} + KDV = %${formatPercent(effective)} toplam`;
  }

  function readNumberInput(input) {
    if (!input) return NaN;
    if (Number.isFinite(input.valueAsNumber)) return input.valueAsNumber;
    return Number.parseFloat(String(input.value || '').trim().replace(',', '.'));
  }

  function readSelectNumber(select, fallback) {
    if (!select) return fallback;
    const value = Number.parseFloat(select.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function updateCargoBadge(result) {
    const container = document.getElementById('ty-calc-cargo-badge');
    if (!container) return;
    if (platform === 'hepsiburada' && result.kargoTarifeTipi === 'barem') {
      const band = result.kargoBaremBandı?.replace(',99 TL', '') || 'Destek';
      container.innerHTML = `<span class="ty-calc-badge barem-cargo">Barem · ${band}</span>`;
    } else if (platform === 'hepsiburada') {
      container.innerHTML = '<span class="ty-calc-badge seller-cargo">Desi Tarifesi</span>';
    } else if (result.kargoTarifeTipi === 'barem') {
      const modeLabel = result.kargoBaremModu === 'advantage' ? 'Avantajlı' : 'Standart';
      container.innerHTML = `<span class="ty-calc-badge barem-cargo">Barem · ${modeLabel}</span>`;
    } else {
      container.innerHTML = '<span class="ty-calc-badge seller-cargo">Desi Tarifesi</span>';
    }
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function clearCalculatedValues() {
    const resultIds = [
      'ty-calc-komisyon-val', 'ty-calc-kargo-val', 'ty-calc-hizmet-val',
      'ty-calc-stopaj-val', 'ty-calc-satis-kdv', 'ty-calc-indirilecek-kdv',
      'ty-calc-net-kdv', 'ty-calc-devreden-kdv', 'ty-calc-odeme',
      'ty-calc-nakit-kalan', 'ty-calc-net-kar',
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

  function setupResize(panel) {
    for (const corner of ['nw', 'ne', 'sw', 'se']) {
      const handle = document.createElement('div');
      handle.className = 'ty-calc-resize-handle';
      handle.dataset.corner = corner;
      handle.title = 'Boyutlandırmak için sürükleyin';
      panel.appendChild(handle);

      handle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || panel.classList.contains('minimized')) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = panel.getBoundingClientRect();
        const startX = event.clientX;
        const startY = event.clientY;
        handle.setPointerCapture(event.pointerId);

        const move = (next) => {
          const west = corner.includes('w');
          const north = corner.includes('n');
          const dx = next.clientX - startX;
          const dy = next.clientY - startY;
          const maxWidth = Math.max(0, west ? rect.right : window.innerWidth - rect.left);
          const maxHeight = Math.max(0, north ? rect.bottom : window.innerHeight - rect.top);
          const width = Math.min(maxWidth, Math.max(Math.min(320, maxWidth), rect.width + (west ? -dx : dx)));
          const height = Math.min(maxHeight, Math.max(Math.min(180, maxHeight), rect.height + (north ? -dy : dy)));
          panel.classList.add('ty-calc-resized');
          panel.style.boxSizing = 'border-box';
          panel.style.width = width + 'px';
          panel.style.height = height + 'px';
          panel.style.right = (window.innerWidth - (west ? rect.right : rect.left + width)) + 'px';
          panel.style.bottom = (window.innerHeight - (north ? rect.bottom : rect.top + height)) + 'px';
        };
        const stop = () => {
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', stop);
          handle.removeEventListener('pointercancel', stop);
          handle.removeEventListener('lostpointercapture', stop);
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', stop);
        handle.addEventListener('pointercancel', stop);
        handle.addEventListener('lostpointercapture', stop);
      });
    }
  }

  // ─── Main ───────────────────────────────────────────────────

  // Seller tracking ---------------------------------------------------------
  function findListingArray(payload, depth = 0) {
    if (!payload || depth > 6) return null;
    if (Array.isArray(payload)) return payload;
    if (typeof payload !== 'object') return null;
    for (const key of ['listings', 'allListings', 'merchantListings']) {
      if (Array.isArray(payload[key])) return payload[key];
    }
    for (const key of ['data', 'result', 'response']) {
      const found = findListingArray(payload[key], depth + 1);
      if (found) return found;
    }
    return null;
  }

  async function getCurrentSellerSnapshot(product) {
    const initial = normalizeSellerSnapshot(product.sellers || []);
    if (platform !== 'hepsiburada' || product.sellerListComplete) {
      return { sellers: initial, complete: product.sellerListComplete !== false };
    }

    const encodedSku = encodeURIComponent(String(product.id || ''));
    const query = product.urlName ? `?name=${encodeURIComponent(product.urlName)}` : '';
    const urls = [
      `/api/v1/product/listings/${encodedSku}${query}`,
      `/api/v1/product/listings/${encodedSku}`,
    ];

    for (const url of [...new Set(urls)]) {
      try {
        const response = await fetch(url, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) continue;
        const payload = await response.json();
        const listings = findListingArray(payload);
        if (!Array.isArray(listings)) continue;
        const fetched = listings.map(listing => sellerFromHepsiburadaListing(listing)).filter(Boolean);
        return { sellers: normalizeSellerSnapshot([...initial, ...fetched]), complete: true };
      } catch (error) {}
    }

    // A preview is not trusted for exits: unseen sellers must not be recorded
    // as having left the listing.
    return { sellers: initial, complete: false };
  }

  function formatSellerTime(timestamp) {
    if (!timestamp) return '—';
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(timestamp));
  }

  function formatSellerPrice(priceCents) {
    return priceCents == null ? '—' : `₺${formatNum(priceCents / 100)}`;
  }

  function appendSellerEmpty(container, text) {
    const empty = document.createElement('div');
    empty.className = 'ty-calc-seller-empty';
    empty.textContent = text;
    container.appendChild(empty);
  }

  function renderSellerTracking(view) {
    const count = document.getElementById('ty-calc-seller-count');
    const checkTime = document.getElementById('ty-calc-seller-check-time');
    const note = document.getElementById('ty-calc-seller-note');
    const list = document.getElementById('ty-calc-seller-list');
    const history = document.getElementById('ty-calc-seller-history');
    if (!count || !checkTime || !note || !list || !history) return;

    if (!view) {
      count.textContent = 'Satıcı verisi bulunamadı';
      checkTime.textContent = '—';
      note.textContent = 'Bu ürün sayfası satıcı bilgisini yayımlamadı.';
      list.replaceChildren();
      history.replaceChildren();
      return;
    }

    count.textContent = view.complete
      ? `${view.current.length} satıcı`
      : `En az ${view.current.length} satıcı`;
    checkTime.textContent = formatSellerTime(view.lastChecked);
    note.textContent = view.complete
      ? 'Tam liste kaydedildi. Aynı liste değişmedikçe yeni geçmiş kaydı oluşturulmaz.'
      : 'Hepsiburada tam liste isteği alınamadı; görünen satıcılar kaydedildi. Eksik listede çıkış kaydı üretilmez.';

    list.replaceChildren();
    if (!view.current.length) {
      appendSellerEmpty(list, 'Bu sayfada satıcı adı ve fiyatı bulunamadı.');
    } else {
      view.current.forEach((seller, index) => {
        const row = document.createElement('div');
        row.className = 'ty-calc-seller-row';
        const position = document.createElement('span');
        position.className = 'ty-calc-seller-position';
        position.textContent = String(index + 1);
        const name = document.createElement('span');
        name.className = 'ty-calc-seller-name';
        name.textContent = seller.name;
        name.title = seller.name;
        const price = document.createElement('strong');
        price.className = 'ty-calc-seller-price';
        price.textContent = formatSellerPrice(seller.priceCents);
        row.append(position, name, price);
        list.appendChild(row);
      });
    }

    history.replaceChildren();
    const visibleEvents = view.events.slice(0, 60);
    if (!visibleEvents.length) {
      appendSellerEmpty(history, 'Henüz geçmiş kaydı yok.');
      return;
    }
    visibleEvents.forEach(event => {
      const row = document.createElement('div');
      row.className = `ty-calc-seller-event ${event.type}`;
      const badge = document.createElement('span');
      badge.className = 'ty-calc-seller-event-badge';
      badge.textContent = event.type === 'enter' ? 'Girdi'
        : event.type === 'exit' ? 'Çıktı'
          : event.type === 'price' ? 'Fiyat'
            : 'Başlangıç';
      const detail = document.createElement('span');
      detail.className = 'ty-calc-seller-event-detail';
      if (event.type === 'initial') {
        detail.textContent = `İlk liste kaydedildi (${event.count} satıcı)`;
      } else if (event.type === 'price') {
        detail.textContent = `${event.name}: ${formatSellerPrice(event.oldPriceCents)} → ${formatSellerPrice(event.priceCents)}`;
      } else if (event.type === 'enter') {
        detail.textContent = `${event.name}: ${formatSellerPrice(event.priceCents)}`;
      } else {
        detail.textContent = `${event.name}: son fiyat ${formatSellerPrice(event.oldPriceCents)}`;
      }
      detail.title = detail.textContent;
      const time = document.createElement('time');
      time.className = 'ty-calc-seller-event-time';
      time.dateTime = new Date(event.timestamp).toISOString();
      time.textContent = formatSellerTime(event.timestamp);
      row.append(badge, detail, time);
      history.appendChild(row);
    });
  }

  function setupSellerTracking(productKey, product) {
    let lastCheck = 0;
    let running = false;
    const refresh = async (force = false) => {
      if (running || (!force && Date.now() - lastCheck < 14 * 60 * 1000)) return;
      running = true;
      try {
        const snapshot = await getCurrentSellerSnapshot(product);
        const view = await SellerHistoryStorage.observe(productKey, snapshot.sellers, {
          timestamp: Date.now(),
          complete: snapshot.complete,
          productName: product.name,
          urlPath: location.pathname,
        });
        renderSellerTracking(view);
        lastCheck = Date.now();
      } finally {
        running = false;
      }
    };

    refresh(true);
    const timer = setInterval(refresh, 15 * 60 * 1000);
    window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh();
    });
  }

  async function waitForProductData(timeoutMs = 6000) {
    const deadline = Date.now() + timeoutMs;
    let firstPricedCandidateAt = 0;
    let lastPricedCandidate = null;
    do {
      const candidate = extractProductData();
      if (candidate?.price) {
        lastPricedCandidate = candidate;
        if (platform !== 'trendyol' || candidate.minQuantity > 1) return candidate;

        // Trendyol's price data arrives before the separately rendered
        // product-key-info fragment on some pages. Returning immediately would
        // miss a visible "en az N adet" rule and calculate a one-item package.
        if (!firstPricedCandidateAt) firstPricedCandidateAt = Date.now();
        const productKeyInfoLoaded = document.querySelector(
          '[data-drroot="product-key-info"], [data-fragment="product-key-info"]'
        );
        if (productKeyInfoLoaded || Date.now() - firstPricedCandidateAt >= 2500) {
          return candidate;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 400));
    } while (Date.now() < deadline);
    return lastPricedCandidate;
  }

  // Marketplace SSR data can arrive after document_idle on client navigation.
  const product = await waitForProductData();
  if (!product || !product.price) {
    console.debug('[Pazaryeri Calc] Bu sayfada ürün verisi henüz bulunamadı.');
    return;
  }

  console.log('[Pazaryeri Calc] Ürün bulundu:', product.name, '₺' + product.price);

  const panel = createPanel(product);
  setupToggle(panel);
  setupDrag(panel);
  setupResize(panel);

  // Load saved product inputs and calculation choices
  const baseProductKey = String(product.id || product.barcode || product.name);
  const productKey = platform === 'hepsiburada' ? `hepsiburada:${baseProductKey}` : baseProductKey;
  setupSellerTracking(productKey, product);
  const savedCogs = await COGSStorage.load(productKey);
  const savedDesi = await DesiStorage.load(productKey);
  const savedSettings = await CalculatorSettingsStorage.load(productKey);

  const cogsInput = document.getElementById('ty-calc-cogs-input');
  const cogsVatBasisSelect = document.getElementById('ty-calc-cogs-vat-basis-select');
  const orderTotalInput = document.getElementById('ty-calc-order-total-input');
  const packageRoleSelect = document.getElementById('ty-calc-package-role-select');
  const desiInput = document.getElementById('ty-calc-desi-input');
  const priceInput = document.getElementById('ty-calc-price-input');
  const carrierSelect = document.getElementById('ty-calc-carrier-select');
  const baremModeSelect = document.getElementById('ty-calc-barem-mode-select');
  const satisKdvSelect = document.getElementById('ty-calc-satis-kdv-select');
  const alisKdvSelect = document.getElementById('ty-calc-alis-kdv-select');
  const komisyonInput = document.getElementById('ty-calc-komisyon-input');
  const serviceFeeInput = document.getElementById('ty-calc-service-fee-input');
  const hbServiceFeeSelect = document.getElementById('ty-calc-hb-service-fee-select');
  const serviceFeeEnabled = document.getElementById('ty-calc-service-fee-enabled');
  const todayShippingFeeEnabled = document.getElementById('ty-calc-today-shipping-fee-enabled');
  const stopajEnabled = document.getElementById('ty-calc-stopaj-enabled');

  if (savedCogs != null && cogsInput) {
    cogsInput.value = savedCogs;
  }
  if (savedDesi != null && desiInput) {
    desiInput.value = savedDesi;
  }
  if (savedSettings) {
    if (savedSettings.carrier && carrierSelect) carrierSelect.value = savedSettings.carrier;
    if (baremModeSelect) {
      const hasCurrentHepsiburadaModel = savedSettings.shippingModelVersion === 2;
      baremModeSelect.value = platform === 'hepsiburada' && !hasCurrentHepsiburadaModel
        ? 'support'
        : (savedSettings.baremMode || baremModeSelect.value);
    }
    if (savedSettings.satisKdvOrani != null && satisKdvSelect) satisKdvSelect.value = String(savedSettings.satisKdvOrani);
    if (savedSettings.alisKdvOrani != null && alisKdvSelect) alisKdvSelect.value = String(savedSettings.alisKdvOrani);
    if (savedSettings.cogsVatBasis && cogsVatBasisSelect) cogsVatBasisSelect.value = savedSettings.cogsVatBasis;
    if (savedSettings.orderTotalGross >= Number(priceInput?.value || product.price) && orderTotalInput) {
      orderTotalInput.value = savedSettings.orderTotalGross;
      orderTotalInput.dataset.manual = 'true';
    }
    if (savedSettings.packageRole && packageRoleSelect) packageRoleSelect.value = savedSettings.packageRole;
    if (savedSettings.komisyonOrani != null && komisyonInput) komisyonInput.value = savedSettings.komisyonOrani;
    if (komisyonInput) komisyonInput.dataset.manual = savedSettings.komisyonManual ? 'true' : 'false';
    // v1, 6,99 TL'yi tüm Trendyol paketlerinde varsayılan kabul ediyordu.
    // Eski kaydı taşımak standart (10,99 TL) paketi eksik hesaplatacağından ilk
    // açılışta yeni güvenli varsayıma dön; sonraki manuel seçimler tekrar saklanır.
    const hasCurrentTrendyolFeeModel = savedSettings.platformFeeModelVersion >= 2;
    if (savedSettings.hizmetBedeliKdvHaric != null && serviceFeeInput
        && (platform !== 'trendyol' || hasCurrentTrendyolFeeModel)) {
      serviceFeeInput.value = savedSettings.hizmetBedeliKdvHaric;
    }
    if (savedSettings.hepsiburadaServiceFeeKdvHaric != null && hbServiceFeeSelect) {
      hbServiceFeeSelect.value = String(savedSettings.hepsiburadaServiceFeeKdvHaric);
    }
    if (savedSettings.hizmetUygula != null && serviceFeeEnabled) serviceFeeEnabled.checked = savedSettings.hizmetUygula;
    if (todayShippingFeeEnabled) {
      todayShippingFeeEnabled.checked = savedSettings.todayShippingFeeEnabled === true
        || Math.abs(readNumberInput(serviceFeeInput) - 4.99) < 0.001;
      if (todayShippingFeeEnabled.checked && serviceFeeInput) serviceFeeInput.value = '4.99';
    }
    if (savedSettings.stopajUygula != null && stopajEnabled) stopajEnabled.checked = savedSettings.stopajUygula;
  }
  if (serviceFeeInput && serviceFeeEnabled) serviceFeeInput.disabled = !serviceFeeEnabled.checked;
  if (todayShippingFeeEnabled && serviceFeeEnabled) todayShippingFeeEnabled.disabled = !serviceFeeEnabled.checked;

  // Initial calculation
  recalculate(product);

  // Input handlers with debounced save
  let saveTimeout = null;

  function onInputChange(event) {
    if (event?.target?.id === 'ty-calc-komisyon-input' && event.isTrusted) {
      event.target.dataset.manual = 'true';
    }
    if (event?.target?.id === 'ty-calc-order-total-input' && event.isTrusted) {
      event.target.dataset.manual = 'true';
    }
    if (event?.target?.id === 'ty-calc-price-input'
        && orderTotalInput
        && orderTotalInput.dataset.manual !== 'true') {
      orderTotalInput.value = priceInput.value;
    }
    if (event?.target?.id === 'ty-calc-today-shipping-fee-enabled' && serviceFeeInput) {
      serviceFeeInput.value = event.target.checked ? '4.99' : '10.99';
    }
    if (event?.target?.id === 'ty-calc-service-fee-input' && event.isTrusted && todayShippingFeeEnabled) {
      todayShippingFeeEnabled.checked = Math.abs(readNumberInput(serviceFeeInput) - 4.99) < 0.001;
    }
    if (serviceFeeInput && serviceFeeEnabled) serviceFeeInput.disabled = !serviceFeeEnabled.checked;
    if (todayShippingFeeEnabled && serviceFeeEnabled) todayShippingFeeEnabled.disabled = !serviceFeeEnabled.checked;
    recalculate(product);

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      const cogsVal = parseFloat(cogsInput?.value);
      const desiVal = parseInt(desiInput?.value);
      if (!isNaN(cogsVal) && cogsVal > 0) COGSStorage.save(productKey, cogsVal);
      if (!isNaN(desiVal) && desiVal > 0) DesiStorage.save(productKey, desiVal);
      CalculatorSettingsStorage.save(productKey, {
        carrier: carrierSelect?.value || 'enucuz',
        baremMode: baremModeSelect?.value || (platform === 'hepsiburada' ? 'support' : 'standard'),
        shippingModelVersion: platform === 'hepsiburada' ? 2 : 1,
        platformFeeModelVersion: platform === 'trendyol' ? 3 : 1,
        satisKdvOrani: readSelectNumber(satisKdvSelect, 0.20),
        alisKdvOrani: readSelectNumber(alisKdvSelect, 0.20),
        cogsVatBasis: cogsVatBasisSelect?.value || 'gross',
        orderTotalGross: readNumberInput(orderTotalInput),
        packageRole: packageRoleSelect?.value || 'single',
        komisyonOrani: readNumberInput(komisyonInput),
        komisyonManual: komisyonInput?.dataset.manual === 'true',
        hizmetBedeliKdvHaric: platform === 'hepsiburada'
          ? readSelectNumber(hbServiceFeeSelect, platformConfig.serviceFee)
          : readNumberInput(serviceFeeInput),
        hepsiburadaServiceFeeKdvHaric: readSelectNumber(hbServiceFeeSelect, platformConfig.serviceFee),
        hizmetUygula: platform === 'hepsiburada'
          ? readSelectNumber(hbServiceFeeSelect, platformConfig.serviceFee) > 0
          : serviceFeeEnabled?.checked !== false,
        todayShippingFeeEnabled: todayShippingFeeEnabled?.checked === true,
        stopajUygula: stopajEnabled?.checked !== false,
      });
    }, 500);
  }

  // Attach listeners to all inputs
  const inputs = [
    'ty-calc-price-input',
    'ty-calc-cogs-input',
    'ty-calc-cogs-vat-basis-select',
    'ty-calc-order-total-input',
    'ty-calc-package-role-select',
    'ty-calc-desi-input',
    'ty-calc-carrier-select',
    'ty-calc-barem-mode-select',
    'ty-calc-satis-kdv-select',
    'ty-calc-alis-kdv-select',
    'ty-calc-komisyon-input',
    'ty-calc-service-fee-input',
    'ty-calc-hb-service-fee-select',
    'ty-calc-service-fee-enabled',
    'ty-calc-today-shipping-fee-enabled',
    'ty-calc-stopaj-enabled',
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
      if (orderTotalInput && orderTotalInput.dataset.manual !== 'true') {
        orderTotalInput.value = product.price;
      }
      onInputChange();
    });
  }
})();
