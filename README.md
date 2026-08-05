# Trendyol Kâr Hesaplayıcı

Trendyol ürün sayfasındaki fiyatı başlangıç değeri olarak alır; satış/paket
toplamı, maliyet, desi, kargo firması, KDV ve komisyon değiştirildiğinde sonucu
anında yeniden hesaplar.

## 1.3.0 hesaplama modeli

- 0–199,99 TL ve 200–349,99 TL paketlerde, en fazla 10 desi olan standart koli
  gönderileri için Trendyol'un **Barem Destek** tarifesi uygulanır.
- 350 TL ve üzeri paketlerde desi tarifesi uygulanır.
- 10 desi üzerindeki paketler ile CEVA/CEVA Tedarik/Horoz gönderileri barem
  dışında kalır ve desi tarifesine geçer.
- Barem ve desi tarifeleri KDV hariç tutulur; hesapta %20 kargo KDV'si eklenir.
- Stopaj, KDV hariç brüt satışın %1'i olarak nakit ödemeden düşülür. Mahsup
  edilebilir vergi ön ödemesi olduğu için ticari kârdan ikinci kez düşülmez.
- Ticari kâr KDV hariç ekonomik sonucu; `Nakit Kalan` ise tedarikçi ödemesi,
  stopaj ve o dönemde ödenecek KDV sonrasındaki nakit görünümünü gösterir.

Kargo barem kaynağı: [Trendyol Akademi – Trendyol Kargo Barem Altı Uygulaması](https://akademi.trendyol.com/courses/training/11822)

Stopaj kaynağı: [Gelir İdaresi Başkanlığı – Elektronik Ticarette Tevkifat](https://gib.gov.tr/mevzuat/kanun/433/teblig/6659)

## Yerel kurulum

1. Chrome'da `chrome://extensions` adresini açın.
2. Geliştirici modunu etkinleştirin.
3. **Paketlenmemiş öğe yükle** ile bu klasörü seçin.
4. Kaynak kod güncellendiğinde uzantı kartındaki **Yeniden yükle** düğmesine
   basıp Trendyol ürün sayfasını yenileyin.

## Test

```powershell
node tests/calculator.test.js
```

Komisyon oranı ve platform hizmet bedeli sözleşmeye/satıcı hesabına göre
değişebildiği için arayüzde düzenlenebilir. Otomatik komisyon eşleşmesi bir
tahmindir; Partner Panel'deki geçerli oranla kontrol edilmelidir.
