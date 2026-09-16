// Pazaryeri Kâr Hesaplayıcı — Fee Calculation Engine
// Commission rates from official Trendyol PDF (March 2026)
// Shipping rates from official Trendyol PDF (16 July 2026, KDV hariç)

const TYCalculator = (() => {

  // ─── Commission Rates ────────────────────────────────────────
  // Key: "kategori|alt_kategori" → komisyon % (KDV dahil fiyat üzerinden)
  // "Kategori Komisyon % (KDV Dahil)" — rate includes KDV on commission
  const COMMISSION_RATES = {
    // Aksesuar
    'Aksesuar|Altın (İşlenmemiş)': 9.00,
    'Aksesuar|Mücevher': 21.50,
    'Aksesuar|Atkı & Bere & Eldiven': 21.50,
    'Aksesuar|Gözlük': 21.50,
    'Aksesuar|Takı': 22.50,
    'Aksesuar|Diğer Aksesuar': 22.50,
    'Aksesuar|Saat': 21.50,
    // Ayakkabı & Çanta
    'Ayakkabı & Çanta|Ayakkabı': 21.50,
    'Ayakkabı & Çanta|Çanta': 21.50,
    // Bahçe & Elektrikli El Aletleri
    'Bahçe & Elektrikli El Aletleri|Bahçe': 20.00,
    'Bahçe & Elektrikli El Aletleri|Elektrikli El Aletleri': 16.50,
    'Bahçe & Elektrikli El Aletleri|Enerji Sistemleri': 16.50,
    // Bahçe ve Yapı Market
    'Bahçe ve Yapı Market|Yapı Market': 20.00,
    // Banyo Yapı & Hırdavat
    'Banyo Yapı & Hırdavat|Elektrik & Tesisat Malzemeleri': 20.00,
    'Banyo Yapı & Hırdavat|Banyo Yapı Malzemeleri': 18.00,
    'Banyo Yapı & Hırdavat|Boya': 19.50,
    'Banyo Yapı & Hırdavat|Hırdavat': 16.50,
    // Çocuk
    'Çocuk|Çocuk Gereçleri': 19.00,
    'Çocuk|Oyuncak': 19.00,
    'Çocuk|Bebek Beslenme/Emzirme': 19.00,
    'Çocuk|Bebek Banyo & Tuvalet': 19.00,
    'Çocuk|Bebek Odası ve Tekstili': 19.00,
    // Dijital Kod & Ürünler
    'Dijital Kod & Ürünler|Dijital Kod & Ürünler': 11.00,
    'Dijital Kod & Ürünler|Dijital Kart & Kupon & Hizmetler': 11.00,
    // E-Kitap Okuyucu
    'E-Kitap Okuyucu|E-Kitap Okuyucu': 10.00,
    // Elektronik
    'Elektronik|Elektrikli Ev Aletleri': 19.50,
    'Elektronik|Elektronik Aksesuarlar': 23.00,
    'Elektronik|Giyilebilir Teknoloji & Kulaklıklar': 16.50,
    'Elektronik|Bilgisayar Grubu': 11.00,
    'Elektronik|Telefon': 7.00,
    'Elektronik|Beyaz Eşya & TV': 15.00,
    'Elektronik|Tablet Grubu': 19.00,
    'Elektronik|Oyun & Oyun Konsolları': 12.00,
    'Elektronik|Dijital Kod & Ürünler': 0.00,
    'Elektronik|Foto & Kamera': 11.00,
    'Elektronik|Görüntü & Ses Sistemleri': 17.00,
    'Elektronik|Kişisel Bakım Aletleri': 18.60,
    'Elektronik|Klima & Isıtıcı': 11.00,
    'Elektronik|Yenilenmiş Bilgisayar Grubu': 11.00,
    'Elektronik|Yenilenmiş Tablet Grubu': 11.00,
    // Ev
    'Ev|Banyo': 18.50,
    'Ev|Sofra & Mutfak': 19.00,
    'Ev|Ev Tekstili': 21.00,
    // Giyim
    'Giyim|Giyim': 21.50,
    // Hobi & Eğlence
    'Hobi & Eğlence|Çakmaklar': 20.50,
    'Hobi & Eğlence|Müzik Alet ve Ekipmanları': 15.00,
    'Hobi & Eğlence|Yetişkin Hobi ve Oyun': 20.00,
    'Hobi & Eğlence|Drone': 12.00,
    'Hobi & Eğlence|Drone Aksesuarı': 18.50,
    'Hobi & Eğlence|Film': 11.00,
    'Hobi & Eğlence|Hobi Malzemeleri': 20.50,
    'Hobi & Eğlence|Parti ve Yılbaşı Ürünleri': 20.50,
    'Hobi & Eğlence|Pikap & Gramofon': 15.00,
    'Hobi & Eğlence|RC Araç ve Aksesuarlar': 19.00,
    // Kitap
    'Kitap|Kitap': 15.50,
    'Kitap|E-Kitap': 10.00,
    // Kırtasiye & Ofis Malzemeleri
    'Kırtasiye & Ofis Malzemeleri|Boya Malzemeleri': 18.00,
    'Kırtasiye & Ofis Malzemeleri|Kırtasiye Kağıt Ürünleri': 18.00,
    'Kırtasiye & Ofis Malzemeleri|Fotokopi ve Baskı Kağıtları': 9.00,
    'Kırtasiye & Ofis Malzemeleri|Ofis Teknolojileri': 15.00,
    'Kırtasiye & Ofis Malzemeleri|Dosyalama / Arşivleme': 17.00,
    // Kozmetik & Kişisel Bakım
    'Kozmetik & Kişisel Bakım|Kişisel Bakım': 19.00,
    'Kozmetik & Kişisel Bakım|Kozmetik': 19.00,
    // Mobilya
    'Mobilya|Aydınlatma': 23.50,
    'Mobilya|Salon Mobilyası': 23.00,
    'Mobilya|Yatak Odası Mobilyası': 23.00,
    'Mobilya|Ev Gereçleri': 21.00,
    'Mobilya|Bebek & Çocuk Odası Mobilyası': 22.00,
    'Mobilya|Mutfak & Banyo Mobilyası': 23.00,
    'Mobilya|Ev Dekorasyon': 24.00,
    'Mobilya|Halı/Kilim': 22.50,
    'Mobilya|Ofis Mobilyaları': 23.00,
    'Mobilya|Takım Mobilyalar': 22.00,
    'Mobilya|Perde': 22.50,
    'Mobilya|Bahçe & Balkon Mobilyası': 23.00,
    // Otomobil & Motosiklet
    'Otomobil & Motosiklet|Akü ve Akü Takviye Kabloları': 13.50,
    'Otomobil & Motosiklet|Elektrikli Motosiklet': 10.00,
    'Otomobil & Motosiklet|Oto Aksesuar': 12.00,
    'Otomobil & Motosiklet|Jantlar & Jant Kapakları': 17.50,
    'Otomobil & Motosiklet|Motor Bakım Ürünleri': 13.50,
    'Otomobil & Motosiklet|Motosiklet Çanta ve Kasklar': 13.50,
    'Otomobil & Motosiklet|Motosiklet Aksesuarları': 15.00,
    'Otomobil & Motosiklet|Oto ve Motosiklet Lastikleri': 10.00,
    'Otomobil & Motosiklet|Motosiklet Yedek Parça': 17.00,
    'Otomobil & Motosiklet|Otomobil Yedek Parça': 22.50,
    'Otomobil & Motosiklet|Oto Bakım / Temizlik Ürünleri': 16.50,
    'Otomobil & Motosiklet|Oto Ses Görüntü Sistemleri': 14.00,
    'Otomobil & Motosiklet|Yağ ve Motor Katkıları': 14.00,
    // Spor
    'Spor|Spor Ekipmanları': 15.00,
    'Spor|Outdoor Ekipmanları': 12.00,
    // Süpermarket
    'Süpermarket|Gıda & İçecek': 19.00,
    'Süpermarket|Bebek Bakım': 20.00,
    'Süpermarket|Ev Bakım ve Temizlik': 17.00,
    'Süpermarket|Bebek Beslenme': 15.00,
    'Süpermarket|Sağlık': 19.00,
    'Süpermarket|Pet Shop': 20.00,
    'Süpermarket|Anne Bakım': 20.00,
  };

  // Default commission rates per main category (when subcategory not matched)
  const CATEGORY_DEFAULTS = {
    'Aksesuar': 21.50,
    'Ayakkabı & Çanta': 21.50,
    'Ayakkabı': 21.50,
    'Çanta': 21.50,
    'Bahçe & Elektrikli El Aletleri': 20.00,
    'Bahçe ve Yapı Market': 20.00,
    'Banyo Yapı & Hırdavat': 18.00,
    'Çocuk': 19.00,
    'Dijital Kod & Ürünler': 11.00,
    'E-Kitap Okuyucu': 10.00,
    'Elektronik': 15.00,
    'Ev': 19.00,
    'Giyim': 21.50,
    'Hobi & Eğlence': 20.00,
    'Kitap': 15.50,
    'Kırtasiye & Ofis Malzemeleri': 17.00,
    'Kozmetik & Kişisel Bakım': 19.00,
    'Kozmetik': 19.00,
    'Mobilya': 23.00,
    'Otomobil & Motosiklet': 14.00,
    'Spor': 15.00,
    'Süpermarket': 19.00,
  };

  // Keyword-based matching for categories from product hierarchy
  const CATEGORY_KEYWORDS = [
    // Specific leaf categories must outrank generic words such as tablet, tv,
    // bebek and kitap. findCommissionRate scores the longest matching phrase.
    { keywords: ['tablet kılıfı', 'ipad kılıfı', 'telefon kılıfı'], category: 'Elektronik', sub: 'Elektronik Aksesuarlar' },
    { keywords: ['tv ünitesi', 'televizyon ünitesi'], category: 'Mobilya', sub: 'Salon Mobilyası' },
    { keywords: ['bebek maması', 'devam sütü'], category: 'Süpermarket', sub: 'Bebek Beslenme' },
    { keywords: ['kitaplık'], category: 'Mobilya', sub: 'Salon Mobilyası' },
    { keywords: ['altın', 'işlenmemiş'], category: 'Aksesuar', sub: 'Altın (İşlenmemiş)' },
    { keywords: ['mücevher', 'pırlanta'], category: 'Aksesuar', sub: 'Mücevher' },
    { keywords: ['atkı', 'bere', 'eldiven', 'şal', 'fular', 'eşarp'], category: 'Aksesuar', sub: 'Atkı & Bere & Eldiven' },
    { keywords: ['gözlük', 'güneş gözlüğü'], category: 'Aksesuar', sub: 'Gözlük' },
    { keywords: ['takı', 'kolye', 'bileklik', 'küpe', 'yüzük'], category: 'Aksesuar', sub: 'Takı' },
    { keywords: ['saat', 'kol saati'], category: 'Aksesuar', sub: 'Saat' },
    { keywords: ['kemer', 'saç aksesuarı', 'kravat'], category: 'Aksesuar', sub: 'Diğer Aksesuar' },
    { keywords: ['ayakkabı', 'sneaker', 'bot', 'sandalet', 'terlik', 'topuklu', 'babet', 'loafer', 'spor ayakkabı'], category: 'Ayakkabı & Çanta', sub: 'Ayakkabı' },
    { keywords: ['çanta', 'sırt çantası', 'el çantası', 'cüzdan', 'bavul', 'valiz'], category: 'Ayakkabı & Çanta', sub: 'Çanta' },
    { keywords: ['bahçe'], category: 'Bahçe & Elektrikli El Aletleri', sub: 'Bahçe' },
    { keywords: ['elektrikli el aleti', 'matkap', 'testere'], category: 'Bahçe & Elektrikli El Aletleri', sub: 'Elektrikli El Aletleri' },
    { keywords: ['yapı market'], category: 'Bahçe ve Yapı Market', sub: 'Yapı Market' },
    { keywords: ['tesisat', 'elektrik malzeme'], category: 'Banyo Yapı & Hırdavat', sub: 'Elektrik & Tesisat Malzemeleri' },
    { keywords: ['banyo yapı', 'banyo malzeme'], category: 'Banyo Yapı & Hırdavat', sub: 'Banyo Yapı Malzemeleri' },
    { keywords: ['boya'], category: 'Banyo Yapı & Hırdavat', sub: 'Boya' },
    { keywords: ['hırdavat', 'vida', 'cıvata'], category: 'Banyo Yapı & Hırdavat', sub: 'Hırdavat' },
    { keywords: ['bebek', 'çocuk gereç', 'bebek arabası', 'mama sandalye'], category: 'Çocuk', sub: 'Çocuk Gereçleri' },
    { keywords: ['oyuncak'], category: 'Çocuk', sub: 'Oyuncak' },
    { keywords: ['telefon', 'iphone', 'samsung galaxy', 'cep telefon'], category: 'Elektronik', sub: 'Telefon' },
    { keywords: ['bilgisayar', 'laptop', 'notebook', 'masaüstü bilgisayar'], category: 'Elektronik', sub: 'Bilgisayar Grubu' },
    { keywords: ['tablet', 'ipad'], category: 'Elektronik', sub: 'Tablet Grubu' },
    { keywords: ['televizyon', 'tv', 'beyaz eşya', 'bulaşık makine', 'çamaşır makine', 'buzdolabı'], category: 'Elektronik', sub: 'Beyaz Eşya & TV' },
    { keywords: ['kulaklık', 'akıllı saat', 'smartwatch', 'giyilebilir'], category: 'Elektronik', sub: 'Giyilebilir Teknoloji & Kulaklıklar' },
    { keywords: ['elektronik aksesuar', 'kılıf', 'ekran koruyucu', 'şarj', 'kablo', 'adaptör', 'powerbank'], category: 'Elektronik', sub: 'Elektronik Aksesuarlar' },
    { keywords: ['elektrikli ev aleti', 'süpürge', 'ütü', 'robot süpürge'], category: 'Elektronik', sub: 'Elektrikli Ev Aletleri' },
    { keywords: ['kamera', 'fotoğraf'], category: 'Elektronik', sub: 'Foto & Kamera' },
    { keywords: ['hoparlör', 'ses sistemi', 'soundbar'], category: 'Elektronik', sub: 'Görüntü & Ses Sistemleri' },
    { keywords: ['epilatör', 'saç kurutma', 'tıraş makine', 'kişisel bakım alet'], category: 'Elektronik', sub: 'Kişisel Bakım Aletleri' },
    { keywords: ['klima', 'ısıtıcı', 'kombi'], category: 'Elektronik', sub: 'Klima & Isıtıcı' },
    { keywords: ['oyun konsol', 'playstation', 'xbox', 'nintendo'], category: 'Elektronik', sub: 'Oyun & Oyun Konsolları' },
    { keywords: ['banyo', 'havlu', 'banyo aksesuar'], category: 'Ev', sub: 'Banyo' },
    { keywords: ['mutfak', 'sofra', 'tencere', 'tava', 'tabak', 'bardak'], category: 'Ev', sub: 'Sofra & Mutfak' },
    { keywords: ['ev tekstil', 'nevresim', 'pike', 'battaniye', 'yastık', 'yorgan'], category: 'Ev', sub: 'Ev Tekstili' },
    { keywords: ['kadın giyim', 'erkek giyim', 'elbise', 'pantolon', 'gömlek', 'tişört', 't-shirt', 'kazak', 'mont', 'ceket', 'etek', 'şort', 'jean', 'sweatshirt', 'triko', 'hırka', 'bluz', 'tunik', 'yelek', 'pijama', 'iç giyim', 'mayo', 'bikini'], category: 'Giyim', sub: 'Giyim' },
    { keywords: ['kitap', 'roman', 'dergi'], category: 'Kitap', sub: 'Kitap' },
    { keywords: ['kozmetik', 'makyaj', 'parfüm', 'ruj', 'fondöten', 'maskara', 'göz farı'], category: 'Kozmetik & Kişisel Bakım', sub: 'Kozmetik' },
    { keywords: ['şampuan', 'sabun', 'deodorant', 'duş jeli', 'kişisel bakım', 'diş fırçası', 'cilt bakım', 'güneş krem'], category: 'Kozmetik & Kişisel Bakım', sub: 'Kişisel Bakım' },
    { keywords: ['aydınlatma', 'lamba', 'avize', 'aplik'], category: 'Mobilya', sub: 'Aydınlatma' },
    { keywords: ['koltuk', 'kanepe', 'tv ünitesi', 'sehpa'], category: 'Mobilya', sub: 'Salon Mobilyası' },
    { keywords: ['yatak', 'gardırop', 'komodin'], category: 'Mobilya', sub: 'Yatak Odası Mobilyası' },
    { keywords: ['dekorasyon', 'tablo', 'vazo', 'ayna'], category: 'Mobilya', sub: 'Ev Dekorasyon' },
    { keywords: ['halı', 'kilim'], category: 'Mobilya', sub: 'Halı/Kilim' },
    { keywords: ['perde'], category: 'Mobilya', sub: 'Perde' },
    { keywords: ['ofis mobilya', 'çalışma masası', 'ofis sandalye'], category: 'Mobilya', sub: 'Ofis Mobilyaları' },
    { keywords: ['oto aksesuar', 'araç aksesuar'], category: 'Otomobil & Motosiklet', sub: 'Oto Aksesuar' },
    { keywords: ['lastik'], category: 'Otomobil & Motosiklet', sub: 'Oto ve Motosiklet Lastikleri' },
    { keywords: ['jant'], category: 'Otomobil & Motosiklet', sub: 'Jantlar & Jant Kapakları' },
    { keywords: ['motosiklet'], category: 'Otomobil & Motosiklet', sub: 'Motosiklet Aksesuarları' },
    { keywords: ['spor ekipman', 'fitness', 'dambıl', 'koşu bandı'], category: 'Spor', sub: 'Spor Ekipmanları' },
    { keywords: ['outdoor', 'kamp', 'çadır'], category: 'Spor', sub: 'Outdoor Ekipmanları' },
    { keywords: ['gıda', 'içecek', 'atıştırmalık', 'kahve', 'çay'], category: 'Süpermarket', sub: 'Gıda & İçecek' },
    { keywords: ['temizlik', 'deterjan', 'ev bakım'], category: 'Süpermarket', sub: 'Ev Bakım ve Temizlik' },
    { keywords: ['pet', 'kedi', 'köpek', 'mama'], category: 'Süpermarket', sub: 'Pet Shop' },
    { keywords: ['sağlık', 'vitamin', 'takviye'], category: 'Süpermarket', sub: 'Sağlık' },
  ];

  // ─── Shipping Rates (KDV Hariç, TL) ────────────────────────
  // PDF'deki 0-500 Desi/KG değerleri shipping-rates.js içinden gelir.
  const SHIPPING_RATES = TYShippingRates.RATES;
  const CARRIER_DISPLAY_NAMES = TYShippingRates.CARRIER_DISPLAY_NAMES;

  // ─── Hizmet Bedeli ──────────────────────────────────────────
  // Standart Trendyol paketlerinde Platform Hizmet Bedeli. "Bugün Kargoda"
  // indirimi yalnız etiket ve aynı gün taşıma statüsü birlikte sağlanırsa
  // geçerlidir; bu nedenle bilinmeyen bir siparişte güvenli varsayım standarttır.
  const VARSAYILAN_HIZMET_BEDELI_KDV_HARIC = 10.99;
  const HIZMET_KDV_ORANI = 0.20;

  // ─── Stopaj ─────────────────────────────────────────────────
  const STOPAJ_ORANI = 0.01; // %1 gelir vergisi stopajı

  // ─── Commission Lookup ──────────────────────────────────────

  function findCommissionRate(categoryHierarchy, categoryName, platform = 'trendyol', brand = '', productName = '') {
    if (platform === 'hepsiburada' && typeof HBRates !== 'undefined') {
      return HBRates.findCommissionRate(categoryHierarchy, categoryName, brand, productName);
    }
    if (!categoryHierarchy && !categoryName) return { rate: 20.00, matched: false, label: 'Varsayılan' };

    const searchText = normalizeSearchText(`${categoryHierarchy || ''} ${categoryName || ''}`);
    let bestMatch = null;

    // Prefer the most specific (longest) matching phrase. This prevents
    // "tablet kılıfı" from being classified as a tablet and "tv ünitesi"
    // from being classified as a television.
    for (const entry of CATEGORY_KEYWORDS) {
      for (const kw of entry.keywords) {
        if (keywordMatches(searchText, kw)) {
          const key = `${entry.category}|${entry.sub}`;
          const rate = COMMISSION_RATES[key];
          const score = normalizeSearchText(kw).length;
          if (rate !== undefined && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { rate, score, label: `${entry.category} > ${entry.sub}` };
          }
        }
      }
    }
    if (bestMatch) return { rate: bestMatch.rate, matched: true, label: bestMatch.label };

    // Try direct main category matching from hierarchy
    const hierarchyParts = (categoryHierarchy || '').split('/').map(s => s.trim());
    for (const part of hierarchyParts) {
      // Try exact match with category defaults
      for (const [cat, rate] of Object.entries(CATEGORY_DEFAULTS)) {
        const normalizedPart = normalizeSearchText(part);
        const normalizedCategory = normalizeSearchText(cat);
        if (normalizedPart === normalizedCategory || keywordMatches(normalizedPart, normalizedCategory)) {
          return { rate, matched: true, label: cat };
        }
      }
    }

    return { rate: 20.00, matched: false, label: 'Varsayılan (%20)' };
  }

  function normalizeSearchText(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLocaleLowerCase('tr-TR')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function keywordMatches(searchText, keyword) {
    const normalizedKeyword = normalizeSearchText(keyword);
    if (!normalizedKeyword) return false;
    if (normalizedKeyword.includes(' ')) return searchText.includes(normalizedKeyword);
    return searchText.split(/[^\p{L}\p{N}]+/u).includes(normalizedKeyword);
  }

  // ─── Shipping Lookup ────────────────────────────────────────

  function getShippingConfig(platform = 'trendyol') {
    return platform === 'hepsiburada' && typeof HBRates !== 'undefined'
      ? HBRates
      : TYShippingRates;
  }

  function getCarrierDisplayNames(platform = 'trendyol') {
    return getShippingConfig(platform).CARRIER_DISPLAY_NAMES;
  }

  function getPlatformMeta(platform = 'trendyol') {
    const config = getShippingConfig(platform);
    return {
      platform,
      shippingEffectiveDate: config.EFFECTIVE_DATE,
      maxDesi: config.MAX_DESI,
      carrierDisplayNames: config.CARRIER_DISPLAY_NAMES,
      hasBarem: Boolean(config.BAREM_RATES),
      baremThreshold: config.BAREM_THRESHOLD,
      commissionVatIncluded: config.COMMISSION_VAT_INCLUDED !== false,
    };
  }

  function getShippingRate(carrier, desi, platform = 'trendyol') {
    desi = Math.max(0, Math.ceil(Number(desi) || 0));
    const config = getShippingConfig(platform);
    if (platform === 'hepsiburada') return config.getShippingRate(carrier, desi);
    const rates = SHIPPING_RATES[carrier];
    if (!rates || desi > config.MAX_DESI) return null;

    const rate = rates[desi];
    return Number.isFinite(rate) ? rate : null;
  }

  function getCheapestCarrier(desi, platform = 'trendyol') {
    let cheapest = null;
    let cheapestRate = Infinity;
    const config = getShippingConfig(platform);

    for (const carrier of config.PARCEL_CARRIERS) {
      const rate = getShippingRate(carrier, desi, platform);
      if (rate !== null && rate < cheapestRate) {
        cheapestRate = rate;
        cheapest = carrier;
      }
    }

    return { carrier: cheapest, rate: Number.isFinite(cheapestRate) ? cheapestRate : null };
  }

  function getBaremRate(carrier, satisFiyati, baremMode = 'standard', platform = 'trendyol') {
    if (platform === 'hepsiburada') {
      return getShippingConfig(platform).getBaremRate(carrier, satisFiyati);
    }
    const mode = baremMode === 'advantage' ? 'advantage' : 'standard';
    const price = Number(satisFiyati);
    if (!TYShippingRates.PARCEL_CARRIERS.includes(carrier)) return null;
    if (!Number.isFinite(price) || price <= 0 || price >= TYShippingRates.BAREM_THRESHOLD) return null;

    const band = price < 200 ? 'under200' : 'from200';
    const rate = TYShippingRates.BAREM_RATES?.[mode]?.[band]?.[carrier];
    return Number.isFinite(rate) ? rate : null;
  }

  function getCargoQuote(
    satisFiyati,
    desi,
    carrier = 'enucuz',
    baremMode = 'standard',
    platform = 'trendyol',
    shippingContext = {},
  ) {
    const normalizedDesi = Math.max(0, Math.ceil(Number(desi) || 0));
    const packagePrice = Number(satisFiyati);
    const config = getShippingConfig(platform);
    const isHepsiburada = platform === 'hepsiburada';
    const requestedOrderTotal = Number(shippingContext?.orderTotalGross);
    const orderTotalGross = !isHepsiburada && Number.isFinite(requestedOrderTotal) && requestedOrderTotal > 0
      ? requestedOrderTotal
      : packagePrice;
    const requestedPackageRole = shippingContext?.packageRole;
    const packageRole = !isHepsiburada && ['single', 'splitLowest', 'splitOther'].includes(requestedPackageRole)
      ? requestedPackageRole
      : 'single';
    // Trendyol Academy: a split order below 350 TL grants barem to only the
    // lowest-desi package. At 350 TL and above every split package uses desi.
    const packageCanUseBarem = packageRole !== 'splitOther';
    const mode = isHepsiburada
      ? (baremMode === 'desi' ? 'desi' : 'support')
      : (['advantage', 'standard', 'desi'].includes(baremMode) ? baremMode : 'standard');
    const candidates = carrier === 'enucuz' || !carrier
      ? config.PARCEL_CARRIERS
      : [carrier];

    let best = null;
    for (const candidate of candidates) {
      const baremCarriers = config.BAREM_CARRIERS || config.PARCEL_CARRIERS;
      const useBarem = mode !== 'desi'
        && orderTotalGross < config.BAREM_THRESHOLD
        && packageCanUseBarem
        && normalizedDesi <= config.BAREM_MAX_DESI
        && baremCarriers.includes(candidate);
      const rate = useBarem
        ? getBaremRate(candidate, orderTotalGross, mode, platform)
        : getShippingRate(candidate, normalizedDesi, platform);

      if (rate === null || !Number.isFinite(rate)) continue;
      const quote = {
        carrier: candidate,
        carrierName: config.CARRIER_DISPLAY_NAMES[candidate] || candidate,
        rate,
        type: useBarem ? 'barem' : 'desi',
        mode: useBarem ? mode : 'desi',
        band: useBarem
          ? (orderTotalGross < 200 ? '0-199,99 TL' : (isHepsiburada ? '200-399,99 TL' : '200-349,99 TL'))
          : null,
        desi: normalizedDesi,
        orderTotalGross: r2(orderTotalGross),
        packageRole,
      };
      if (!best || quote.rate < best.rate) best = quote;
    }

    return best || {
      carrier: carrier === 'enucuz' ? null : carrier,
      carrierName: carrier === 'enucuz' ? '' : (config.CARRIER_DISPLAY_NAMES[carrier] || carrier),
      rate: null,
      type: 'desi',
      mode: 'desi',
      band: null,
      desi: normalizedDesi,
      orderTotalGross: r2(orderTotalGross),
      packageRole,
    };
  }

  function getAllCarrierRates(desi, platform = 'trendyol') {
    const results = [];
    const config = getShippingConfig(platform);
    for (const carrier of Object.keys(config.CARRIER_DISPLAY_NAMES)) {
      const rate = getShippingRate(carrier, desi, platform);
      if (rate !== null) {
        results.push({ carrier, rate, name: config.CARRIER_DISPLAY_NAMES[carrier] });
      }
    }
    return results.sort((a, b) => a.rate - b.rate);
  }

  function getPackageSaleTotal(unitPrice, quantity = 1) {
    const normalizedUnitPrice = Math.max(0, Number(unitPrice) || 0);
    const normalizedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    return r2(normalizedUnitPrice * normalizedQuantity);
  }

  function resolveMinimumOrderQuantity(product, winnerVariant, visibleText = '') {
    const textMatch = String(visibleText).match(/en\s+az\s+(\d+)\s+adet/i);
    const visibleMoq = Number.parseInt(textMatch?.[1], 10);
    if (Number.isInteger(visibleMoq) && visibleMoq > 0) return visibleMoq;

    const candidates = [
      product?.moq,
      product?.minimumOrderQuantity,
      winnerVariant?.moq,
      winnerVariant?.minimumOrderQuantity,
    ];
    for (const candidate of candidates) {
      const quantity = Number.parseInt(candidate, 10);
      if (Number.isInteger(quantity) && quantity > 0) return quantity;
    }
    return 1;
  }

  // ─── Main Calculation ───────────────────────────────────────

  function calculate(params) {
    const {
      satisFiyati,       // KDV dahil paket/sipariş toplamı
      cogs,              // Maliyet (KDV hariç)
      desi,
      satisKdvOrani,
      alisKdvOrani,
      carrier,
      baremMode,
      orderTotalGross,
      packageRole,
      categoryHierarchy, // Trendyol category hierarchy string
      categoryName,      // Trendyol category name
      komisyonOverride,
      hizmetUygula,
      hizmetBedeliKdvHaric,
      stopajUygula,
      platform = 'trendyol',
      brand,
      productName,
    } = params;

    const saleGross = Math.max(0, Number(satisFiyati) || 0);
    const cogsNet = Math.max(0, Number(cogs) || 0);

    // 1. Satış KDV hesabı
    // Nullish/validation based fallback keeps a genuine %0 KDV selection intact.
    const kdvOrani = normalizeVatRate(satisKdvOrani, 0.20);
    const purchaseVatRate = normalizeVatRate(alisKdvOrani, kdvOrani);
    const satisKdvHaric = saleGross / (1 + kdvOrani);
    const satisKdv = saleGross - satisKdvHaric;

    // 2. Komisyon
    const commissionInfo = findCommissionRate(categoryHierarchy, categoryName, platform, brand, productName);
    const overrideRate = komisyonOverride == null || komisyonOverride === ''
      ? NaN
      : Number(komisyonOverride);
    const commissionPercent = Number.isFinite(overrideRate) && overrideRate >= 0
      ? overrideRate
      : commissionInfo.rate;
    const komisyonOrani = commissionPercent / 100;
    const commissionVatIncluded = getShippingConfig(platform).COMMISSION_VAT_INCLUDED !== false;
    const komisyonKdvHaric = commissionVatIncluded
      ? (saleGross * komisyonOrani) / (1 + HIZMET_KDV_ORANI)
      : saleGross * komisyonOrani;
    const komisyonKdv = komisyonKdvHaric * HIZMET_KDV_ORANI;
    const komisyon = komisyonKdvHaric + komisyonKdv;
    const komisyonEfektifOran = saleGross > 0 ? (komisyon / saleGross) * 100 : 0;

    // 3. Kargo
    // Müşteriye "ücretsiz kargo" gösterilmesi satıcının kargo faturasını sıfırlamaz.
    // Platformun uygun tutar aralığında sabit barem; diğer siparişlerde desi tarifesi uygulanır.
    const shippingConfig = getShippingConfig(platform);
    const cargoQuote = getCargoQuote(
      saleGross,
      desi,
      carrier,
      baremMode,
      platform,
      { orderTotalGross, packageRole },
    );
    const kargoKdvHaric = Number.isFinite(cargoQuote.rate) ? cargoQuote.rate : 0;
    const kargoCarrier = cargoQuote.carrier;
    const kargoCarrierName = cargoQuote.carrierName;
    const sellerPaysCargo = kargoKdvHaric > 0;

    const kargoKdv = kargoKdvHaric * shippingConfig.VAT_RATE;
    const kargoToplam = kargoKdvHaric + kargoKdv;

    // 4. Hizmet Bedeli
    const defaultServiceFee = platform === 'hepsiburada' ? 12 : VARSAYILAN_HIZMET_BEDELI_KDV_HARIC;
    const platformFeeEnabled = platform === 'hepsiburada'
      ? hizmetUygula === true
      : hizmetUygula !== false;
    const requestedServiceFee = Number(hizmetBedeliKdvHaric);
    const hizmetKdvHaric = platformFeeEnabled
      ? Math.max(0, Number.isFinite(requestedServiceFee)
        ? requestedServiceFee
        : defaultServiceFee)
      : 0;
    const hizmetKdv = hizmetKdvHaric * HIZMET_KDV_ORANI;
    const hizmetToplam = hizmetKdvHaric + hizmetKdv;

    // 5. Stopaj
    // GİB'e göre matrah KDV hariç brüt satış; komisyon/kargo/hizmet düşülmez.
    // Stopaj bir vergi ön ödemesidir: nakit ödemeyi azaltır, ticari kârı azaltmaz.
    const withholdingEnabled = stopajUygula !== false;
    const stopaj = withholdingEnabled ? satisKdvHaric * STOPAJ_ORANI : 0;

    // 6. Pazaryerinden satıcıya ödeme
    const platformOdeme = saleGross - komisyon - kargoToplam - hizmetToplam - stopaj;

    // 7. Alış KDV
    const alisKdv = cogsNet * purchaseVatRate;

    // 8. Net KDV hesabı
    // Output KDV = satış KDV
    // Input KDV (indirilecek) = alış KDV + komisyon KDV + kargo KDV + hizmet KDV
    const toplamIndirilecekKdv = alisKdv + komisyonKdv + kargoKdv + hizmetKdv;
    const netKdv = Math.max(0, satisKdv - toplamIndirilecekKdv);
    const devredenKdv = Math.max(0, toplamIndirilecekKdv - satisKdv);

    // 9. Kâr ve nakit görünümü
    // Ticari kâr bütün kalemlerin KDV hariç ekonomik değerleriyle hesaplanır.
    // Devreden KDV varlıktır; stopaj da mahsup edilebilir vergi ön ödemesidir.
    const ticariKar = satisKdvHaric
      - cogsNet
      - komisyonKdvHaric
      - kargoKdvHaric
      - hizmetKdvHaric;
    const cogsToplam = cogsNet + alisKdv;
    const nakitKalan = platformOdeme - cogsToplam - netKdv;

    // ROI
    const roi = cogsNet > 0 ? (ticariKar / cogsNet) * 100 : 0;

    // Net marjın paydası KDV hariç satış geliridir.
    const margin = satisKdvHaric > 0 ? (ticariKar / satisKdvHaric) * 100 : 0;

    return {
      // Inputs
      satisFiyati: r2(saleGross),
      platform,
      satisKdvHaric: r2(satisKdvHaric),
      cogs: r2(cogsNet),
      cogsToplam: r2(cogsToplam),
      desi: cargoQuote.desi,

      // KDV
      kdvOrani,
      satisKdv: r2(satisKdv),
      alisKdvOrani: purchaseVatRate,
      alisKdv: r2(alisKdv),
      komisyonKdvHaric: r2(komisyonKdvHaric),
      komisyonKdv: r2(komisyonKdv),
      kargoKdv: r2(kargoKdv),
      hizmetKdv: r2(hizmetKdv),
      toplamIndirilecekKdv: r2(toplamIndirilecekKdv),
      netKdv: r2(netKdv),
      devredenKdv: r2(devredenKdv),

      // Komisyon
      komisyonOrani: r2(komisyonOrani * 100),
      komisyonEfektifOran: r2(komisyonEfektifOran),
      komisyonKdvDahilOran: commissionVatIncluded,
      komisyonLabel: commissionInfo.label,
      komisyonMatched: commissionInfo.matched,
      komisyon: r2(komisyon),

      // Kargo
      sellerPaysCargo,
      kargoRateMissing: !Number.isFinite(cargoQuote.rate),
      kargoKdvHaric: r2(kargoKdvHaric),
      kargoToplam: r2(kargoToplam),
      kargoCarrier,
      kargoCarrierName,
      kargoTarifeTipi: cargoQuote.type,
      kargoBaremModu: cargoQuote.mode,
      kargoBaremBandı: cargoQuote.band,
      orderTotalGross: cargoQuote.orderTotalGross,
      packageRole: cargoQuote.packageRole,

      // Hizmet & Stopaj
      hizmetUygula: platformFeeEnabled,
      hizmetKdvHaric: r2(hizmetKdvHaric),
      hizmetToplam: r2(hizmetToplam),
      stopajUygula: withholdingEnabled,
      stopaj: r2(stopaj),

      // Payment & Profit
      platformOdeme: r2(platformOdeme),
      trendyolOdeme: r2(platformOdeme), // Geriye dönük uyumluluk
      nakitKalan: r2(nakitKalan),
      ticariKar: r2(ticariKar),
      netKar: r2(ticariKar), // Backwards-compatible alias
      roi: r1(roi),
      margin: r1(margin),
    };
  }

  // The price written on an invoice is commonly communicated as a VAT-included
  // "arrival price", while the profit engine works with VAT-excluded COGS.
  // Keep that conversion in one testable place so the UI cannot silently treat
  // a gross purchase price as a net expense.
  function getCostBreakdown(unitCost, vatRate, vatIncluded = true, quantity = 1) {
    const enteredUnit = Math.max(0, Number(unitCost) || 0);
    const purchaseVatRate = normalizeVatRate(vatRate, 0.20);
    const itemCount = Math.max(1, Number.parseInt(quantity, 10) || 1);
    const unitNet = vatIncluded
      ? enteredUnit / (1 + purchaseVatRate)
      : enteredUnit;
    const unitVat = unitNet * purchaseVatRate;
    const unitGross = unitNet + unitVat;

    return {
      quantity: itemCount,
      vatIncluded: Boolean(vatIncluded),
      vatRate: purchaseVatRate,
      enteredUnit: r2(enteredUnit),
      unitNet: r2(unitNet),
      unitVat: r2(unitVat),
      unitGross: r2(unitGross),
      netTotal: r2(unitNet * itemCount),
      vatTotal: r2(unitVat * itemCount),
      grossTotal: r2(unitGross * itemCount),
    };
  }

  function normalizeVatRate(value, fallback) {
    if (value == null || value === '') return fallback;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return fallback;
    if (numeric <= 1) return numeric;
    if (numeric <= 100) return numeric / 100;
    return fallback;
  }

  function r2(n) { return Math.round(n * 100) / 100; }
  function r1(n) { return Math.round(n * 10) / 10; }

  // ─── Public API ─────────────────────────────────────────────
  return {
    calculate,
    findCommissionRate,
    getShippingRate,
    getCheapestCarrier,
    getBaremRate,
    getCargoQuote,
    getAllCarrierRates,
    getCarrierDisplayNames,
    getPlatformMeta,
    getCostBreakdown,
    getPackageSaleTotal,
    resolveMinimumOrderQuantity,
    CARRIER_DISPLAY_NAMES,
    SHIPPING_RATES,
    SHIPPING_EFFECTIVE_DATE: TYShippingRates.EFFECTIVE_DATE,
    BAREM_EFFECTIVE_DATE: TYShippingRates.BAREM_EFFECTIVE_DATE,
    BAREM_THRESHOLD: TYShippingRates.BAREM_THRESHOLD,
    BAREM_MAX_DESI: TYShippingRates.BAREM_MAX_DESI,
    MAX_SHIPPING_DESI: TYShippingRates.MAX_DESI,
  };
})();
