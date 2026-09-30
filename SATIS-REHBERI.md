# FARO — Satış ve Kurulum Rehberi

Bu rehber sizin (satıcının) içindir: müşterilere demo linki göndermek, satın alan müşterinin bilgisayarına
kurmak ve **sizin onayınızla** (lisans anahtarı) çalışır hale getirmek.

---

## 1. Demo linki — müşterilere gönderin

**Link: https://ahmetfarah22.github.io/faro-demo/**

Link önce bir **tanıtım sayfası** açar: özellikler, "Her rolü deneyin" düğmeleri, müşteri QR menüsü ve **Bize ulaşın**
düğmesi. Demo, GitHub Pages üzerinde **ücretsiz** yayınlanır ve hiçbir kurulum gerektirmez. Müşteri linki telefonda veya
bilgisayarda açar, "Canlı demo" bölümünden bir rol seçer (Yönetici, Müdür, Garson, Mutfak, Kasiyer, Müşteri) ve
tek tıkla sisteme girer.

- Tüm özellikler çalışır: siparişler, mutfak ekranı, QR menü, ödemeler, raporlar (PDF / Excel / CSV).
- Her ziyaretçi **kendi örnek verilerini** görür; kimse bir başkasının denemesini görmez. Veriler her gün yenilenir.
- Sağ alttaki **DEMO** düğmesi: rol değiştir, müşteri QR menüsünü aç, demoyu sıfırla.
- Etkileyici gösterim: DEMO → "Müşteri QR menüsünü aç" (yeni sekme) ile sipariş verin; mutfak ekranına **anında** düşer.

**Kaynak kodunuz gizlidir.** Kod gizli `FARO-RESTUREND-AND-COFFE` deposunda durur; herkese açık `faro-demo` deposunda
yalnızca demonun derlenmiş dosyaları bulunur.

**Demoyu güncellemek:** Sistemde bir değişiklik yaptıktan sonra **`demo-yayinla.cmd`** dosyasına çift tıklayın.
Demo derlenir ve `faro-demo` deposuna gönderilir; link birkaç dakika içinde güncellenir.

**İletişim / Satın al düğmesi (isteğe bağlı):** Demoda WhatsApp veya e-posta düğmesi göstermek isterseniz
`demo-yayinla.cmd --contact https://wa.me/905xxxxxxxxx` şeklinde çalıştırın (ya da Claude'a numaranızı söyleyin).

---

## 2. Müşteri satın aldığında — kurulum

1. Kendi bilgisayarınızda **`paket-olustur.cmd`** dosyasına çift tıklayın.
   Sonuç: `release\FARO-Restaurant-<tarih>.zip` (içinde OKUBENI.txt kurulum kılavuzu var).
2. Müşterinin bilgisayarına **PostgreSQL** kurun (https://www.postgresql.org/download/windows/).
   Kurulumda "postgres" şifresini not edin.
3. Zip'i müşteri bilgisayarında örneğin `C:\FARO` klasörüne çıkarın ve **`FARO-Baslat.cmd`** dosyasına çift tıklayın.
   İlk açılışta PostgreSQL şifresi sorulur. Güvenlik duvarı sorarsa "Özel ağlar" için izin verin.
4. Tarayıcıda **"FARO'yu etkinleştirin"** ekranı açılır ve bir **makine kodu** gösterir (ör. `2KZZ-ABAB-CGFK-TV9D`).
   Müşteri bu kodu size gönderir (WhatsApp, e-posta...).

## 3. Onay verme — lisans anahtarı oluşturma

1. Kendi bilgisayarınızda **`lisans-olustur.cmd`** dosyasına çift tıklayın.
2. Müşteri / restoran adını ve makine kodunu yazın.
3. Süreyi girin: boş bırakırsanız **süresiz**; örneğin `30` yazarsanız 30 gün (kiralama / deneme için).
4. Anahtar ekrana yazılır ve **panoya kopyalanır** — müşteriye gönderin.
5. Müşteri anahtarı yapıştırıp "Etkinleştir"e basar, ardından restoran adını ve yönetici hesabını oluşturur.
   Sistem o anda çalışmaya başlar.

Bilmeniz gerekenler:

- Anahtar **yalnızca o bilgisayarda** çalışır. Başka bir bilgisayara kopyalanırsa kabul edilmez.
- Süreli anahtarın süresi dolunca sistem kilitlenir ve aktivasyon ekranı çıkar; yeni anahtar verirsiniz.
- Müşteri bilgisayarını değiştirirse yeni bilgisayarın makine koduyla yeni anahtar oluşturun.
- Verdiğiniz tüm anahtarların listesi: `%USERPROFILE%\.faro-license\issued-licenses.csv` (Excel ile açılır).
  (`%USERPROFILE%` sizin kullanıcı klasörünüzdür, ör. `C:\Users\<adınız>`; Windows Gezgini adres çubuğuna aynen yazabilirsiniz.)

---

## 4. ÇOK ÖNEMLİ — imza anahtarınızı yedekleyin

Lisans anahtarlarını üreten **gizli imza anahtarınız** şu dosyadır:

`%USERPROFILE%\.faro-license\faro-license-private.pem`

- Bu dosyayı bir USB belleğe veya şifre yöneticisine **yedekleyin**. Kaybederseniz, kurulu müşterilere yeni anahtar
  veremezsiniz (yeni bir sürüm derlemek gerekir).
- **Kimseyle paylaşmayın**, GitHub'a veya OneDrive'a koymayın. Bu dosyaya sahip olan herkes lisans üretebilir.
- Başka bir bilgisayardan lisans üretmek isterseniz `.faro-license` klasörünü o bilgisayarda aynı yere kopyalayın.

## 5. Güncelleme gönderme

Yeni sürüm için yine `paket-olustur.cmd` çalıştırın. Müşteride yalnızca **`app`** klasörünü değiştirin;
`.env` (ayarlar) ve `lisans.key` (lisans) dosyaları olduğu gibi kalır, veritabanı açılışta kendini günceller.

## 6. Kendi bilgisayarınız

Geliştirme bilgisayarınıza süresiz bir lisans kuruldu (lisans no `L-CDB638FB`), `start.cmd` her zamanki gibi çalışır.

**Her zaman açık olsun:** `otomatik-baslat.cmd` dosyasına çift tıklayıp `A` yazın; FARO bilgisayar her açıldığında
kendiliğinden başlar. `start.cmd` pencereleri simge durumunda açılır ve sunucu durursa birkaç saniyede kendini yeniden
başlatır. Müşteri kurulumunda aynı işi `Otomatik-Baslat.cmd` yapar.
Başka bir bilgisayarda geliştirirseniz, orada çıkan makine kodu için `lisans-olustur.cmd` ile anahtar üretin.

## 7. Sınırlamalar ve öneriler

- **Kaynak kod deposunu gizli (private) tutun.** Kod herkese açık olursa bilgili biri indirip lisans kontrolünü
  kaldırabilir. (Depo daha önce birkaç gün herkese açıktı; o sürede eski sürümü indiren olmuş olabilir. Yeni
  eklenen lisans sistemi ve sonraki tüm geliştirmeler yalnızca gizli depodadır.)
- Müşteriye her zaman `paket-olustur.cmd` ile hazırlanan **derlenmiş paketi** verin, kaynak kodu değil.
- Tarayıcı demosunda her cihazın verisi ayrıdır: telefonda verilen demo sipariş bilgisayardaki demoda görünmez.
  Gerçek kurulumda tüm cihazlar aynı sunucuya bağlanır ve her şey canlı görünür.
- Telefon bildirimleri (ekran kapalıyken) HTTPS gerektirir; restoranın yerel ağında sayfa açıkken sesli ve titreşimli
  uyarı çalışır.
