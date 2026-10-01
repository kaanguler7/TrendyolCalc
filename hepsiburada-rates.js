// Hepsiburada resmi komisyon ve kargo tarifeleri.
// Komisyon: Hepsiburada Çözüm Merkezi "Kategori Bazlı Komisyon Oranları" (+ KDV).
// Kargo: "1agustos_fiyat_degisimi_mp.pdf"; 1 Ağustos 2026 itibarıyla geçerli, KDV hariç tarife.

const HBRates = (() => {
  const SEED_RATES = {
    Aras: [89.92,89.92,92.34,100.55,108.91,116.23,126.37,133.77,142.47,150.41,160.62,168.79,174.5,181.9,188.46,195.02,205.21,215.36,225.55,235.74,239.78,251.52,262.21,272.95,282.38,291.78,305.2,317.41,328.36,340.86,350.4,361.46,372.51,383.57,394.63,405.69,416.75,427.81,438.87,449.92,460.98,472.04,483.1,494.16,505.22,516.27,527.33,538.39,549.45,560.51,571.57,582.62,593.68,604.74,615.8,626.86,637.92,648.97,660.03,671.09,682.15,693.21,704.27,715.32,726.38,737.44,748.5,759.56,770.62,781.67,792.73,803.79,814.85,825.91,836.97,848.03,859.08,870.14,881.2,892.26,903.32,914.38,925.43,936.49,947.55,958.61,969.67,980.73,991.78,1002.84,1013.9,1024.96,1036.02,1047.08,1058.13,1069.19,1080.25,1091.31,1102.37,1113.43,1124.48],
    DHL: [100.99,100.99,100.99,110.99,126.99,137.99,153.99,162.99,172.99,182.99,192.99,203.99,214.99,224.99,234.99,249.99,286.99,301.99,321.99,346.99,364.99,378.99,386.99,413.99,440.99,467.99,494.99,521.99,548.99,575.99,602.99,638.98,674.97,710.96,746.95,782.94,818.93,854.92,890.91,926.9,962.89,998.88,1034.87,1070.86,1106.85,1142.84,1178.83,1214.82,1250.81,1286.8,1322.79,1358.78,1394.77,1430.76,1466.75,1502.74,1538.73,1574.72,1610.71,1646.7,1682.69,1718.68,1754.67,1790.66,1826.65,1862.64,1898.63,1934.62,1970.61,2006.6,2042.59,2078.58,2114.57,2150.56,2186.55,2222.54,2258.53,2294.52,2330.51,2366.5,2402.49,2438.48,2474.47,2510.46,2546.45,2582.44,2618.43,2654.42,2690.41,2726.4,2762.39,2798.38,2834.37,2870.36,2906.35,2942.34,2978.33,3014.32,3050.31,3086.3,3122.29],
    HepsiJET: [78.5,78.5,78.5,94,101.84,108.66,117.72,125.6,132.71,141.39,149.12,155.75,162.48,177,181,191.5,201.5,208.5,220.15,235.3,242.17,251.2,279.65,288.35,296.75,305.65,314.14,322.84,331.54,340.44,360.31,410.44,421.7,432.45,444.41,455.67,466.73,478.19,489.25,500.7,511.96,522.52,533.78,545.04,556.3,568.06,579.31,590.57,601.83,613.09,624.35,635.61,646.87,658.12,669.38,680.64,691.9,703.16,714.42,725.67,736.93,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
    KolayGelsin: [100.91,100.91,100.91,111.65,123.47,133.15,143.89,153.57,164.31,173.98,185.81,196.55,208.37,219.12,230.94,242.76,254.58,266.41,278.23,290.05,301.87,313.69,325.51,337.34,349.16,360.98,372.8,384.62,396.44,408.26,420.08,431.34,442.6,453.86,465.12,476.38,487.64,498.89,510.15,521.41,532.67,543.93,555.19,566.45,577.7,588.96,600.22,611.48,622.74,634,645.25,656.51,667.77,679.03,690.29,701.55,712.81,724.06,735.32,746.58,757.84,769.1,780.36,791.62,802.87,814.13,825.39,836.65,847.91,859.17,870.42,881.68,892.94,904.2,915.46,926.72,937.98,949.23,960.49,971.75,983.01,994.27,1005.53,1016.79,1028.04,1039.3,1050.56,1061.82,1073.08,1084.34,1095.59,1106.85,1118.11,1129.37,1140.63,1151.89,1163.15,1174.4,1185.66,1196.92,1208.18],
    PTT: [86.99,86.99,86.99,106.56,106.56,110.92,117.44,123.96,137.01,150.06,169.64,178.33,187.03,195.73,204.43,213.13,221.83,230.53,239.23,247.93,256.63,265.32,271.85,280.55,289.25,297.95,306.65,315.34,324.04,332.74,341.44,666.93,683.01,699.09,715.17,731.25,747.33,763.42,779.49,795.57,811.66,827.74,843.81,859.9,875.98,892.06,908.14,924.22,940.3,956.39,972.46,988.54,1004.63,1020.71,1036.78,1052.86,1068.95,1085.03,1101.1,1117.19,1133.27,1149.35,1165.43,1181.51,1197.59,1213.68,1229.75,1245.83,1261.92,1278,1294.07,1310.16,1326.24,1342.32,1358.4,1374.48,1390.56,1406.65,1422.72,1438.8,1454.89,1470.97,1487.04,1503.13,1519.21,1535.29,1551.36,1567.45,1583.53,1599.61,1615.69,1631.77,1647.85,1663.94,1680.01,1696.09,1712.18,1728.26,1744.33,1760.42,1776.5],
    Surat: [97.55,97.55,97.55,110.05,120,125.99,138.57,147.83,157.24,166.64,175.9,187.76,195.66,203.56,211.47,219.23,227.41,239.4,251.39,263.51,275.5,287.9,298.94,309.98,321.01,332.05,342.68,353.44,364.07,374.7,385.32,460.95,474.3,487.79,501.14,514.63,527.98,541.47,554.82,568.31,587.93,601.56,615.05,628.67,642.16,655.79,669.28,682.9,696.39,710.02,723.51,737.13,750.62,764.25,777.73,791.36,804.85,818.47,831.96,845.59,859.08,872.7,886.19,899.82,913.31,926.93,940.42,954.05,967.54,981.16,994.65,1008.28,1021.76,1035.39,1048.88,1062.5,1075.99,1089.62,1103.11,1116.73,1130.22,1143.85,1157.34,1170.96,1184.45,1198.08,1211.57,1225.19,1238.68,1252.31,1265.79,1279.42,1292.91,1306.53,1320.02,1333.65,1347.14,1360.63,1374.25,1387.88,1401.37],
    Yurtici: [135.08,135.08,138.51,147.26,150.21,167.73,173.59,196.04,204.4,216.55,226.24,248.21,264.79,275.08,296.52,315.03,323.77,342.31,355.04,365.26,376.53,395.06,413.6,421.33,431.17,464.25,513.54,532.06,546.72,552.55,573.05,589.18,605.73,621.82,637.87,654.47,671.09,687.16,703.25,719.82,736.42,752.49,768.64,785.22,801.29,817.87,833.95,850.51,866.69,883.21,899.29,915.87,932,948.56,964.69,981.26,997.33,1013.43,1029.99,1046.55,1062.73,1078.81,1095.34,1111.96,1128.05,1144.09,1160.73,1176.8,1193.41,1209.5,1226.03,1242.11,1258.73,1274.83,1291.43,1307.49,1324.09,1340.16,1356.71,1372.89,1389.45,1405.54,1422.1,1438.21,1454.26,1470.94,1487.47,1503.53,1519.67,1536.25,1552.76,1568.93,1585.01,1601.58,1617.68,1634.25,1650.29,1666.97,1683.04,1699.59,1715.72],
    CEVATedarik: [465,465,465,465,465,465,465,465,465,465,465,465,465,465,465,465,465,465,465,465,465,465,465,465,465,465,465,465,465,465,465,480.5,496,511.5,527,542.5,558,573.5,589,604.5,620,635.5,651,666.5,682,697.5,713,728.5,744,759.5,775,790.5,806,821.5,837,852.5,868,883.5,899,914.5,930,945.5,961,976.5,992,1007.5,1023,1038.5,1054,1069.5,1085,1100.5,1116,1131.5,1147,1162.5,1178,1193.5,1209,1224.5,1240,1255.5,1271,1286.5,1302,1317.5,1333,1348.5,1364,1379.5,1395,1410.5,1426,1441.5,1457,1472.5,1488,1503.5,1519,1534.5,1550],
    CEVALojistik: [723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,723.86,731.75,739.82,747.91,756.2,764.44,772.96,781.37,789.92,798.7,807.54,815.49,823.78,832.08,840.25,848.78,857.16,865.85,874.43,883.21,892.05,943.58,952.99,962.49,972.12,981.33,986.14,989.22,992.17,994.12,994.57,1005.38,1006.74,1008.11,1010.99,1011.51,1027.04,1042.62,1058.16,1073.74,1089.27,1104.86,1120.39,1135.97,1151.61,1167.09,1182.73,1198.21,1213.85,1229.33,1244.96,1260.44,1276.08,1291.56,1307.2,1322.68,1338.31,1353.79,1369.43,1385.01,1400.55,1416.13,1431.66,1447.25,1462.73,1478.36,1493.84,1509.48,1524.96,1534.24,1535.67],
    HepsiJETXL: [675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,675.51,686.77,698.03,709.29,720.54,731.8,743.06,754.32,765.58,776.84,788.1,799.35,810.61,821.87,833.13,844.39,855.65,866.9,878.16,889.42,900.68,911.94,923.2,934.46,945.71,956.97,968.23,979.49,990.75,1002.01,1013.27,1024.52,1035.78,1047.04,1058.3,1069.56,1080.82,1092.07,1103.33,1114.59,1125.85],
    Horoz: [685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.84,685.96,701.55,717.14,732.73,748.32,763.91,779.5,795.09,810.68,826.27,841.86,857.45,873.04,888.63,904.22,919.81,935.4,950.99,966.58,982.17,997.76,1013.35,1028.94,1044.53,1060.12,1075.71,1091.3,1106.89,1122.48,1138.07,1153.66,1169.25,1184.84,1200.43,1216.02,1231.61,1247.2,1262.79,1278.38,1293.97,1309.56,1325.15,1340.74,1356.33,1371.92,1387.51,1403.1,1418.69,1434.28,1449.87,1465.46,1481.05,1496.64,1512.23,1527.82,1543.41,1559]
  };

  const CARRIER_DISPLAY_NAMES = Object.freeze({
    Aras: 'Aras Kargo', DHL: 'DHL Kargo', HepsiJET: 'hepsiJET',
    KolayGelsin: 'Kolay Gelsin', PTT: 'PTT Kargo', Surat: 'Sürat Kargo',
    Yurtici: 'Yurtiçi Kargo', CEVATedarik: 'Ceva Tedarik (Borusan)',
    CEVALojistik: 'Ceva Lojistik', HepsiJETXL: 'hepsiJET XL', Horoz: 'Horoz Lojistik'
  });
  const PARCEL_CARRIERS = Object.freeze(['Aras','DHL','HepsiJET','KolayGelsin','PTT','Surat','Yurtici']);
  const LOGISTICS_CARRIERS = Object.freeze(['CEVATedarik','CEVALojistik','HepsiJETXL','Horoz']);
  const BAREM_CARRIERS = Object.freeze(['HepsiJET', 'Surat']);
  const BAREM_RATES = Object.freeze({
    under200: 42,
    from200: 72,
  });
  const CEVA_LOJISTIK_101_150 = Object.freeze([
    1537.17,1552.31,1567.61,1582.87,1598.04,1613.31,1628.47,1643.74,1658.9,1674.17,
    1689.34,1704.6,1719.77,1735.01,1750.2,1765.45,1780.64,1795.88,1811.15,1826.31,
    1841.58,1856.74,1872.01,1887.18,1902.44,1917.61,1932.88,1948.04,1963.31,1978.48,
    1993.74,2008.91,2024.18,2039.42,2054.61,2069.85,2085.04,2100.28,2115.48,2130.72,
    2145.91,2161.15,2176.34,2191.58,2206.8,2222.02,2237.23,2252.45,2267.74,2282.88
  ]);

  // 100 desi sonrasındaki değerler resmi tablonun doğrusal tarife formülleridir.
  const LINEAR_RATES = Object.freeze({
    Aras: [18.2183136741, 10.8044778709],
    DHL: [-465.7645338107, 35.1636541281],
    KolayGelsin: [80.44, 11],
    PTT: [168.5, 16.08],
    Surat: [-68.81, 14.38],
    Yurtici: [80.1299997621, 15.9620000001],
    CEVATedarik: [0, 15.5],
    HepsiJETXL: [0, 14.27],
    Horoz: [0, 15.59]
  });

  function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function getShippingRate(carrier, desi) {
    const normalizedDesi = Math.max(0, Math.ceil(Number(desi) || 0));
    if (normalizedDesi > 4500 || !SEED_RATES[carrier]) return null;
    if (normalizedDesi <= 100) {
      const rate = SEED_RATES[carrier][normalizedDesi];
      return Number.isFinite(rate) ? rate : null;
    }
    if (carrier === 'HepsiJET') return null; // Resmi tabloda 60 desi sonrasında değer yoktur.
    if (carrier === 'CEVALojistik') {
      if (normalizedDesi <= 150) return CEVA_LOJISTIK_101_150[normalizedDesi - 101];
      const [base, slope] = normalizedDesi <= 1132
        ? [-7.2997636803, 15.267880537]
        : [-7.2986802944, 15.2678805741];
      return roundMoney(base + slope * normalizedDesi);
    }
    const formula = LINEAR_RATES[carrier];
    return formula ? roundMoney(formula[0] + formula[1] * normalizedDesi) : null;
  }

  // Güncel kargo desteği: hepsiJET/Sürat, 0-1 gün kargoya teslim ve
  // performans koşullarıyla 400 TL altındaki siparişlerde sabit barem.
  // Tutarlar KDV hariçtir; hizmet bedeli ve gecikme bedeli uygulanmaz.
  function getBaremRate(carrier, saleTotal) {
    const price = Number(saleTotal);
    if (!BAREM_CARRIERS.includes(carrier)) return null;
    if (!Number.isFinite(price) || price <= 0 || price >= 400) return null;
    return price < 200 ? BAREM_RATES.under200 : BAREM_RATES.from200;
  }

  // Daha özel ürün grupları önce değerlendirilir. Oranlar KDV hariç komisyon oranıdır.
  const COMMISSION_RULES = Object.freeze([
    [['telefon kılıf','telefon batarya','cep telefonu yedek parça','selfie çubuğu','telefon oyun aksesuar'],25],
    [['data şarj kablo','şarj kablo','notebook aksesuar','tablet aksesuar','notebook çanta'],20],
    [['yenilenmiş telefon','ikinci el telefon','tuşlu telefon'],8.5],
    [['cep telefonu aksesuar','telefon aksesuar','powerbank','taşınabilir şarj cihazı','grafik tablet'],15],
    [['cep telefonu','iphone ios telefon','android telefon'],7],
    [['tablet','ipad','galaxy tab'],7],
    [['taşınabilir bilgisayar','dizüstü bilgisayar','laptop','notebook','mini pc','all-in-one'],7],
    [['masaüstü bilgisayar','server'],7],
    [['ssd','ekran kartı','ana kart','ram','işlemci','bilgisayar kasası','hard disk','usb bellek','klavye mouse','modem','yazıcılar'],10],
    [['kartuş','toner','yazıcı yedek','projeksiyon aksesuar','mouse pad'],12],
    [['lcd televizyon','led televizyon','smart tv','televizyonlar'],8.34],
    [['bulaşık makinesi','çamaşır makinesi','kurutma makinesi','buzdolabı','derin dondurucu','klima','kombi'],10],
    [['ankastre','aspiratör','davlumbaz','mikrodalga','ocaklar','şofben','termosifon','ısıtıcı'],12],
    [['robot süpürge','toz torbalı süpürge','toz torbasız süpürge'],11],
    [['dikey süpürge','ütü'],12],
    [['blender','kahve makinesi','tost makinesi','çay makinesi','fritöz','mikser','mutfak robotu'],13],
    [['saç kurutma','tıraş makinesi','epilatör','saç şekillendirici'],15],
    [['oyun konsolu','playstation 5 konsol','playstation 4 konsol','xbox konsol','nintendo konsol'],6],
    [['ps5 oyun','ps4 oyun','xbox one oyun','nintendo oyun','konsol aksesuar'],10],
    [['oyun ödeme kart','dijital oyun kart'],8.5],
    [['kulak içi kulaklık','kulak üstü kulaklık','bluetooth kulaklık','akıllı saat','akıllı bileklik','taşınabilir hoparlör'],15],
    [['bebek maması'],11],
    [['bebek bezi','ıslak mendil'],13],
    [['bebek arabası','oto koltuğu','mama sandalyesi','bebek odası','beşik','emzirme'],18],
    [['kedi maması','köpek maması','kedi kumu'],14],
    [['petshop','akvaryum','kuş yemi','tavşan ürün'],17],
    [['parfüm'],17],
    [['cilt bakım','saç bakım','makyaj','şampuan','ruj','fondöten','maskara'],17],
    [['diş fırçası','diş macunu','besin takviyesi','sağlık ürünleri','kişisel bakım'],17],
    [['hasta bezi'],13],
    [['deterjan','temizlik malzemesi','tuvalet kağıdı','kağıt havlu','peçete'],15],
    [['çay','kahve','içecek','gıda','atıştırmalık','kuruyemiş','baharat'],17],
    [['altın yatırım','gram altın','çeyrek altın','yarım altın','tam altın'],6],
    [['takı','mücevher','gümüş kolye','gümüş küpe','bijuteri'],18.64],
    [['güneş gözlüğü','kol saati','duvar saati','saat aksesuarı'],18],
    [['valiz','bavul','çanta'],18],
    [['ayakkabı','babet','terlik','bot','çizme'],19.49],
    [['giyim','bluz','etek','ceket','pantolon','gömlek','tişört','mont','kaban'],18],
    [['koşu bandı','kondisyon bisikleti'],10],
    [['dambıl','pilates topu','fitness ekipmanı'],13],
    [['bisiklet','elektrikli scooter','paten'],10],
    [['kamp','outdoor','doğa sporları'],14],
    [['balık av malzemesi'],16],
    [['tekne motoru','zodyak bot','balık bulucu'],8.47],
    [['oto lastik','motosiklet lastik'],9],
    [['oto yedek parça','traktör yedek parça'],20],
    [['akü'],12],
    [['motor yağı','şanzıman yağı','yağ katkı'],12],
    [['banyo dolabı','banyo aksesuar','boya'],16],
    [['batarya','musluk','duş sistemi','vitrifiye'],15],
    [['hırdavat','seramik','fayans','parke','inşaat malzemesi'],18],
    [['avize','aplik','lambader','aydınlatma'],18],
    [['nevresim','yorgan','yastık','perde','halı','kilim','havlu','bornoz'],18],
    [['dekorasyon'],22],
    [['mobilya','koltuk','sandalye','tabure','yatak odası takımı'],18],
    [['tencere','tava','yemek takımı','züccaciye','sofra mutfak'],18],
    [['oyuncak','yapboz','puzzle'],18],
    [['fotokopi kağıdı','a3 kağıt','a4 kağıt','a5 kağıt'],7],
    [['kırtasiye','sanatsal malzeme','ajanda'],17],
    [['kitap','edebiyat','akademik kitap','çocuk kitabı'],15],
    [['dijital dergi','e-kitap','online lisans','sinema bileti','online eğitim'],8.05],
    [['sesli kitap','ön ödemeli kart','yayın paketi'],8.47],
    [['fotoğraf makinesi','video kamera','drone'],10],
    [['drone yedek parça','drone aksesuar'],15],
    [['soundbar','subwoofer','ev sinema','ses sistemi'],16.67],
    [['güvenlik kamerası','akıllı priz','akıllı ev sistemi'],14]
  ]);

  const CATEGORY_DEFAULTS = Object.freeze([
    [['telefon'],7], [['bilgisayar'],10], [['tv','televizyon'],8.34],
    [['beyaz eşya'],10], [['anne bebek'],18], [['sağlık','kozmetik'],17],
    [['petshop'],17], [['gıda','süpermarket'],17], [['giyim'],18],
    [['ayakkabı'],19.49], [['çanta'],18], [['mobilya'],18], [['oyuncak'],18],
    [['kitap'],15], [['kırtasiye'],17], [['yapı market'],18], [['oto'],14],
    [['spor','outdoor'],14]
  ]);

  function normalize(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
  }

  function findCommissionRate(categoryHierarchy, categoryName, brand, productName) {
    const searchText = normalize(`${categoryHierarchy || ''} ${categoryName || ''} ${productName || ''}`);
    const brandText = normalize(brand);
    if (['mustela','sudocrem','bepanthol'].includes(brandText)
        && /bebek (krem|güneş kremi|şampuan|bakım seti)/.test(searchText)) {
      return { rate: 13, matched: true, label: `${brand} marka özel oran` };
    }
    for (const [keywords, rate] of COMMISSION_RULES) {
      for (const keyword of keywords) {
        const normalizedKeyword = normalize(keyword);
        if (searchText.includes(normalizedKeyword)) {
          return { rate, matched: true, label: keyword };
        }
      }
    }
    for (const [keywords, rate] of CATEGORY_DEFAULTS) {
      const keyword = keywords.find(item => searchText.includes(normalize(item)));
      if (keyword) return { rate, matched: true, label: keyword };
    }
    return { rate: 18, matched: false, label: 'Varsayılan (%18 + KDV)' };
  }

  for (const rates of Object.values(SEED_RATES)) Object.freeze(rates);
  Object.freeze(SEED_RATES);

  return Object.freeze({
    getShippingRate,
    getBaremRate,
    findCommissionRate,
    CARRIER_DISPLAY_NAMES,
    PARCEL_CARRIERS,
    LOGISTICS_CARRIERS,
    BAREM_CARRIERS,
    BAREM_RATES,
    BAREM_THRESHOLD: 400,
    BAREM_MAX_DESI: Infinity,
    BAREM_EFFECTIVE_DATE: '2026-08-01',
    EFFECTIVE_DATE: '2026-08-01',
    VAT_RATE: 0.20,
    MAX_DESI: 4500,
    COMMISSION_VAT_INCLUDED: false
  });
})();
