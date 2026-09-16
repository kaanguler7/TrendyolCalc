# Pazaryeri Kâr Hesaplayıcı

Chrome uzantısı, açık ürün sayfasının alan adına göre platformu otomatik seçer:

- `trendyol.com` ürünlerinde Trendyol komisyon ve kargo modeli,
- `hepsiburada.com` ürünlerinde Hepsiburada komisyon ve kargo modeli kullanılır.

Sayfadaki satış fiyatını başlangıç değeri olarak alır; paket toplamı, birim maliyet,
desi, kargo firması, KDV, komisyon ve isteğe bağlı kesintiler değiştirildiğinde
nakit kalan ile KDV hariç ticari kârı anında yeniden hesaplar.

## 2.2.0 satıcı takibi

- Trendyol ve Hepsiburada ürün sayfalarında güncel satıcı sayısı, satıcı adları ve
  liste fiyatları hesaplayıcının **Satıcı Takibi** bölümünde gösterilir.
- Ürün sayfası her açıldığında ve sayfa açıkken 15 dakikada bir kontrol yapılır.
  Tarayıcı kapalıyken uzantı kendi başına veri toplayamaz.
- Satıcının listeye girişi, listeden çıkışı ve fiyat değişimi tarih-saat bilgisiyle
  ürün bazında saklanır. Hepsiburada yalnızca eksik bir önizleme döndürürse yanlış
  çıkış üretmemek için satıcı sayısı `En az ...` olarak işaretlenir.
- Az yer kaplaması için satıcı adları ürün başına bir kez tutulur; fiyatlar kuruş,
  zaman damgaları dakika olarak saklanır ve yalnızca değişiklikler kaydedilir.
  Geçmiş 365 gün, ürün sayısı 500 ve ürün başına olay sayısı 2000 ile sınırlıdır.
  Ayrıca satıcı geçmişi deposu yaklaşık 4 MB'ı aşarsa en eski ürünler temizlenir.

## 2.3.7 hesaplama modeli

### Trendyol

- 0-199,99 TL ve 200-349,99 TL paketlerde, en fazla 10 desi olan standart koli
  gönderileri için Trendyol'un Barem Destek tarifesi uygulanır.
- 350 TL ve üzeri paketlerde desi tarifesi uygulanır.
- 10 desi üzerindeki paketler ile CEVA/CEVA Tedarik/Horoz gönderileri barem
  dışında kalır ve desi tarifesine geçer.
- Ürün sayfasında minimum sipariş adedi varsa görünen birim fiyat bu adetle
  çarpılır; girilen birim maliyet de aynı adetle çarpılarak komisyon, kargo
  baremi ve kâr gerçek paket toplamından hesaplanır.
- Barem bandı paket içindeki ürün sayısına değil, **toplam sipariş tutarına**
  göre seçilir. Arayüzde `Sipariş Toplamı (Barem İçin)` alanı bu nedenle paket
  satış tutarından ayrı düzenlenebilir.
- 350 TL altındaki bir sipariş birden fazla pakete bölünürse yalnız en düşük
  desili bir paket barem desteği alır; diğer paketler desi tarifesinden gider.
  Sipariş toplamı 350 TL veya üzerindeyse bölünen paketlerin tamamı desi
  tarifesinden hesaplanır. `Paket Durumu` seçimi bu kuralı uygular.
- Barem ve desi tarifeleri KDV hariç tutulur; hesapta %20 kargo KDV'si eklenir.
- Barem tutarları Trendyol Akademi'nin 10 Ağustos 2026 tablosudur; PTT/TEX
  avantajlı barem 0-199,99 TL'de 38,74 TL, 200-349,99 TL'de 70,41 TL'dir.
- Müşteriye gösterilen `Kargo Bedava` ifadesi satıcının anlaşmalı kargo
  faturasını sıfırlamaz; hesaplayıcı satıcıya fatura edilen barem/desi bedelini
  gider olarak tutar.
- Platform Hizmet Bedeli standart teslimat paketlerinde **10,99 TL + KDV** ile
  başlar. İndirimli `Bugün Kargoda` tutarı yalnız gerekli etiket ve aynı gün
  taşıma statüsü birlikte sağlandığında kullanılmalı; kesin tutar Satıcı
  Paneli'ndeki güncel faturadan kontrol edilmelidir.
- `Bugün Kargoda` etiketi taşıyan, aynı gün kargoya teslim edilen ve satıcı
  panelinde başarıyla aynı gün taşıma durumuna geçen uygun gönderilerde Platform
  Hizmet Bedeli **4,99 TL + KDV** olarak seçilebilir. Arayüzdeki ayrı kutu bu
  tutarı otomatik uygular; şartlar sağlanmıyorsa standart 10,99 TL korunur.

### Hepsiburada

- Ürün sayfasında indirimli ve eski fiyat birlikte gösteriliyorsa hesaplayıcı
  ödenecek güncel fiyatı alır; üzeri çizili liste fiyatını kullanmaz. Fiyat alanı
  elle değiştirildiğinde Hepsiburada sonuçları anında yeniden hesaplanır.
- Komisyonlar, Hepsiburada'nın resmi kategori tablosundaki listeleme fiyatı
  üzerinden **+ KDV** oranlarıdır. Örneğin %18 oran, %18 komisyon ile bu
  komisyonun %20 KDV'sini ayrı ayrı hesaplar.
- Otomatik kategori eşleştirmesi ürün sayfasındaki JSON-LD kategori, ürün adı ve
  marka bilgisini kullanır. Manuel komisyon alanına Hepsiburada'daki KDV hariç
  temel komisyon oranı girilir.
- Kargo desteği açıkken hepsiJET ve Sürat Kargo için 0-199,99 TL siparişlerde
  42 TL, 200-399,99 TL siparişlerde 72 TL sabit kargo bedeli uygulanır. Bu
  tutarlar KDV hariçtir. Destek 0-1 gün kargoya teslim ve satıcı performans
  koşullarına bağlıdır.
- 400 TL ve üzerindeki siparişler, destek kapsamı dışındaki taşıyıcılar veya
  desteğin elle kapatılması halinde desi tarifesi uygulanır.
- Kargo, 1 Ağustos 2026 tarihli anlaşmalı desi tarifesinden hesaplanır ve tarifeye
  %20 KDV eklenir. Resmi tabloda 0-4500 desi bulunur; hepsiJET sütunu 60 desiden
  sonra boş olduğu için bu taşıyıcıda daha yüksek desiye fiyat atanmaz.
- Hepsiburada teslimat başına hizmet bedeli arayüzde ayrı hesaplanır. Varsayılan
  seçim **Standart 12 TL + KDV**'dir. Sipariş tarihi ile son kargoya teslim tarihi
  aynı gün olan teslimatlar için **Aynı Gün 6 TL + KDV**, performansa bağlı kargo
  destek modelinden yararlanan uygun satıcılar için **Muaf 0 TL** seçilebilir.
- Hizmet bedelinin KDV hariç tutarı ticari kârdan, KDV dahil tutarı platform
  ödemesinden düşülür; hizmet faturasındaki %20 KDV indirilecek KDV'ye eklenir.
  Satıcıya özel kesin koşul ve tutar, Satıcı Paneli `Hesabım > Belgelerim > Ek.8`
  içindeki güncel sözleşmeden kontrol edilmelidir.
- Hepsiburada ürün verisinde KDV oranı yayımlanmadığından satış ve alış KDV'si
  %20 ile başlar ve arayüzden değiştirilebilir.

### Ortak vergi ve kâr yaklaşımı

- Birim alış fiyatı `KDV Dahil` veya `KDV Hariç` olarak seçilebilir. Tedarikçinin
  söylediği “geliş fiyatı” KDV dahilse uzantı bu tutarı otomatik olarak net
  maliyet ve indirilecek alış KDV'sine ayırır. Yeni ürünlerde varsayılan seçim
  `KDV Dahil`dir.
- Komisyon alanı iki platformun oran sunumunu açıkça belirtir: Trendyol oranları
  KDV dahil, Hepsiburada oranları ise KDV hariç `+ KDV` olarak gösterilir.
  Örneğin Hepsiburada `%17 + KDV`, satıştan toplam `%20,40` kesinti demektir.
- Trendyol komisyon oranı KDV dahil satış fiyatına uygulanır. Trendyol'un resmi
  finans API örneğinde 449,99 TL satış ve %15 oran için komisyon 67,4985 TL'dir;
  satış KDV'si oran uygulanmadan önce düşülmez. Komisyon faturasının içindeki
  KDV, indirilecek KDV hesabında ayrıca ayrıştırılır.
- Stopaj, KDV hariç brüt satışın %1'i olarak nakit ödemeden düşülür. Mahsup
  edilebilir vergi ön ödemesi olduğu için ticari kârdan ikinci kez düşülmez.
- Alış, komisyon, kargo ve varsa platform hizmet faturalarının KDV'si indirilecek
  KDV'ye eklenir. Stopaj KDV değildir ve indirilecek KDV'ye dahil edilmez.
- Ticari kâr KDV hariç ekonomik sonucu; `Net Nakit` ise tedarikçi ödemesi,
  stopaj ve o dönemde ödenecek KDV sonrasındaki nakit görünümünü gösterir.
- KDV dahil giriş isteyen üçüncü taraf hesaplayıcıların “kâr” diye gösterdiği
  sonuç çoğunlukla uzantıdaki `Net Nakit` ile karşılaştırılmalıdır; `Ticari Kâr`
  stopaj ön ödemesini gider saymadığı için farklı olabilir.
- Komisyon oranları sözleşmeye, markaya ve satıcı programına göre değişebilir.
  Otomatik eşleşme tahmindir; satıcı panelindeki güncel oranla kontrol edilmelidir.

## Resmi kaynaklar

- [Hepsiburada Çözüm Merkezi - güncel komisyon, kargo ve platform dosyaları](https://merchant.hepsiburada.com/cozummerkezi/merchant)
- [Hepsiburada kategori bazlı komisyon oranları PDF](https://images.hepsiburada.net/cst/assets/solutioncenterui/downloads/komisyon-oranlari.pdf)
- Hepsiburada anlaşmalı kargo tarifesi: `1agustos_fiyat_degisimi_mp.pdf`
- [Hepsiburada kargo destek modeli duyurusu](https://kurumsal.hepsiburada.com/tr/basin-odasi/hepsiburadadan-is-ortaklarinin-kargo-maliyetlerini-54e-kadar-azaltan-kargo-destek-modeli)
- [Hepsiburada hizmet ve işlem bedeli duyurusu (2023 PDF)](https://images.hepsiburada.net/mp/mp-cms/1695999884157_ekim-2023-kargo-hizmet-aalem-bedeli-sazleame.pdf)
- [Trendyol Akademi - Trendyol Kargo Barem Altı Uygulaması](https://akademi.trendyol.com/courses/training/11822)
- [Gelir İdaresi Başkanlığı - Elektronik Ticarette Tevkifat](https://gib.gov.tr/mevzuat/kanun/433/teblig/6659)

## Yerel kurulum

1. Chrome'da `chrome://extensions` adresini açın.
2. Geliştirici modunu etkinleştirin.
3. **Paketlenmemiş öğe yükle** ile bu klasörü seçin.
4. Kaynak kod güncellendiğinde uzantı kartındaki **Yeniden yükle** düğmesine
   basıp Trendyol veya Hepsiburada ürün sayfasını yenileyin.

## Test

```powershell
node tests/calculator.test.js
node tests/seller-history.test.js
```
