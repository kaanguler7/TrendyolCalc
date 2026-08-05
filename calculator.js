// Trendyol Kâr Hesaplayıcı — Fee Calculation Engine
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
  const HIZMET_BEDELI_KDV_HARIC = 6.99; // "Bugün Kargoda" hizmet bedeli
  const HIZMET_KDV_ORANI = 0.20;

  // ─── Stopaj ─────────────────────────────────────────────────
  const STOPAJ_ORANI = 0.01; // %1 gelir vergisi stopajı

  // ─── Commission Lookup ──────────────────────────────────────

  function findCommissionRate(categoryHierarchy, categoryName) {
    if (!categoryHierarchy && !categoryName) return { rate: 20.00, matched: false, label: 'Varsayılan' };

    const searchText = ((categoryHierarchy || '') + ' ' + (categoryName || '')).toLowerCase();

    // Try keyword matching first
    for (const entry of CATEGORY_KEYWORDS) {
      for (const kw of entry.keywords) {
        if (searchText.includes(kw.toLowerCase())) {
          const key = `${entry.category}|${entry.sub}`;
          const rate = COMMISSION_RATES[key];
          if (rate !== undefined) {
            return { rate, matched: true, label: `${entry.category} > ${entry.sub}` };
          }
        }
      }
    }

    // Try direct main category matching from hierarchy
    const hierarchyParts = (categoryHierarchy || '').split('/').map(s => s.trim());
    for (const part of hierarchyParts) {
      // Try exact match with category defaults
      for (const [cat, rate] of Object.entries(CATEGORY_DEFAULTS)) {
        if (part.toLowerCase() === cat.toLowerCase() || part.toLowerCase().includes(cat.toLowerCase())) {
          return { rate, matched: true, label: cat };
        }
      }
    }

    return { rate: 20.00, matched: false, label: 'Varsayılan (%20)' };
  }

  // ─── Shipping Lookup ────────────────────────────────────────

  function getShippingRate(carrier, desi) {
    desi = Math.max(0, Math.ceil(Number(desi) || 0));
    const rates = SHIPPING_RATES[carrier];
    if (!rates) return null;
    if (desi > TYShippingRates.MAX_DESI) return null;

    const rate = rates[desi];
    return Number.isFinite(rate) ? rate : null;
  }

  function getCheapestCarrier(desi) {
    let cheapest = null;
    let cheapestRate = Infinity;

    for (const carrier of TYShippingRates.PARCEL_CARRIERS) {
      const rate = getShippingRate(carrier, desi);
      if (rate !== null && rate < cheapestRate) {
        cheapestRate = rate;
        cheapest = carrier;
      }
    }

    return { carrier: cheapest, rate: cheapestRate };
  }

  function getAllCarrierRates(desi) {
    const results = [];
    for (const carrier of Object.keys(SHIPPING_RATES)) {
      const rate = getShippingRate(carrier, desi);
      if (rate !== null) {
        results.push({ carrier, rate, name: CARRIER_DISPLAY_NAMES[carrier] });
      }
    }
    return results.sort((a, b) => a.rate - b.rate);
  }

  // ─── Main Calculation ───────────────────────────────────────

  function calculate(params) {
    const {
      satisFiyati,       // KDV dahil satış fiyatı (from page)
      cogs,              // Maliyet (KDV hariç, user input)
      desi,              // Kargo desi (user input)
      satisKdvOrani,     // Satış KDV oranı (from product.tax, e.g., 0.10)
      alisKdvOrani,      // Alış KDV oranı (default = satış KDV)
      carrier,           // Kargo firması (key or 'enucuz')
      categoryHierarchy, // Trendyol category hierarchy string
      categoryName,      // Trendyol category name
      komisyonOverride,  // Manual commission override (optional)
      freeCargo,         // Whether product has free shipping (customer doesn't pay)
    } = params;

    // 1. Satış KDV hesabı
    const kdvOrani = satisKdvOrani || 0.20;
    const satisKdvHaric = satisFiyati / (1 + kdvOrani);
    const satisKdv = satisFiyati - satisKdvHaric;

    // 2. Komisyon
    const commissionInfo = findCommissionRate(categoryHierarchy, categoryName);
    const komisyonOrani = (komisyonOverride != null ? komisyonOverride : commissionInfo.rate) / 100;
    const komisyon = satisFiyati * komisyonOrani; // KDV dahil fiyat üzerinden
    const komisyonKdv = komisyon * 0.20 / 1.20;  // Komisyon hizmet bedeli %20 KDV içerir

    // 3. Kargo
    let kargoKdvHaric = 0;
    let kargoCarrier = null;
    let kargoCarrierName = '';
    const sellerPaysCargo = satisFiyati >= 300; // ≥300 TL satıcı öder

    if (sellerPaysCargo && desi > 0) {
      if (carrier === 'enucuz' || !carrier) {
        const cheapest = getCheapestCarrier(desi);
        kargoKdvHaric = cheapest.rate;
        kargoCarrier = cheapest.carrier;
        kargoCarrierName = CARRIER_DISPLAY_NAMES[cheapest.carrier] || cheapest.carrier;
      } else {
        kargoKdvHaric = getShippingRate(carrier, desi) || 0;
        kargoCarrier = carrier;
        kargoCarrierName = CARRIER_DISPLAY_NAMES[carrier] || carrier;
      }
    }

    const kargoKdv = kargoKdvHaric * TYShippingRates.VAT_RATE;
    const kargoToplam = kargoKdvHaric + kargoKdv; // KDV dahil kargo

    // 4. Hizmet Bedeli
    const hizmetKdvHaric = HIZMET_BEDELI_KDV_HARIC;
    const hizmetKdv = hizmetKdvHaric * HIZMET_KDV_ORANI;
    const hizmetToplam = hizmetKdvHaric + hizmetKdv;

    // 5. Stopaj
    const stopaj = satisKdvHaric * STOPAJ_ORANI;

    // 6. Trendyol'dan satıcıya ödeme
    const trendyolOdeme = satisFiyati - komisyon - kargoToplam - hizmetToplam - stopaj;

    // 7. Alış KDV
    const alisKdv = cogs * (alisKdvOrani != null ? alisKdvOrani : kdvOrani);

    // 8. Net KDV hesabı
    // Output KDV = satış KDV
    // Input KDV (indirilecek) = alış KDV + komisyon KDV + kargo KDV + hizmet KDV
    const toplamIndirilecekKdv = alisKdv + komisyonKdv + kargoKdv + hizmetKdv;
    const netKdv = Math.max(0, satisKdv - toplamIndirilecekKdv);
    const devredenKdv = Math.max(0, toplamIndirilecekKdv - satisKdv);

    // 9. Net Kâr
    // = Trendyol ödeme - (COGS + alış KDV) - net KDV
    const cogsToplam = cogs + alisKdv; // Tedarikçiye ödenen toplam
    const netKar = trendyolOdeme - cogsToplam - netKdv;

    // ROI
    const roi = cogs > 0 ? (netKar / cogs) * 100 : 0;

    // Margin
    const margin = satisFiyati > 0 ? (netKar / satisFiyati) * 100 : 0;

    return {
      // Inputs
      satisFiyati: r2(satisFiyati),
      satisKdvHaric: r2(satisKdvHaric),
      cogs: r2(cogs),
      desi,

      // KDV
      kdvOrani,
      satisKdv: r2(satisKdv),
      alisKdvOrani: alisKdvOrani != null ? alisKdvOrani : kdvOrani,
      alisKdv: r2(alisKdv),
      komisyonKdv: r2(komisyonKdv),
      kargoKdv: r2(kargoKdv),
      hizmetKdv: r2(hizmetKdv),
      toplamIndirilecekKdv: r2(toplamIndirilecekKdv),
      netKdv: r2(netKdv),
      devredenKdv: r2(devredenKdv),

      // Komisyon
      komisyonOrani: r2(komisyonOrani * 100),
      komisyonLabel: commissionInfo.label,
      komisyonMatched: commissionInfo.matched,
      komisyon: r2(komisyon),

      // Kargo
      sellerPaysCargo,
      kargoKdvHaric: r2(kargoKdvHaric),
      kargoToplam: r2(kargoToplam),
      kargoCarrier,
      kargoCarrierName,

      // Hizmet & Stopaj
      hizmetToplam: r2(hizmetToplam),
      stopaj: r2(stopaj),

      // Payment & Profit
      trendyolOdeme: r2(trendyolOdeme),
      netKar: r2(netKar),
      roi: r1(roi),
      margin: r1(margin),
    };
  }

  function r2(n) { return Math.round(n * 100) / 100; }
  function r1(n) { return Math.round(n * 10) / 10; }

  // ─── Public API ─────────────────────────────────────────────
  return {
    calculate,
    findCommissionRate,
    getShippingRate,
    getCheapestCarrier,
    getAllCarrierRates,
    CARRIER_DISPLAY_NAMES,
    SHIPPING_RATES,
    SHIPPING_EFFECTIVE_DATE: TYShippingRates.EFFECTIVE_DATE,
    MAX_SHIPPING_DESI: TYShippingRates.MAX_DESI,
  };
})();
