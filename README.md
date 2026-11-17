# Berlin'in Ortak Haritası · Berlin's Shared Map · Berlins gemeinsame Karte

**#30DayMapChallenge · Gün 16 · Collaborative**

🗺️ **Canlı harita:** https://hasanemirbicen-dotcom.github.io/berlins_shared_map/
[Türkçe](https://hasanemirbicen-dotcom.github.io/berlins_shared_map/?lang=tr) · [English](https://hasanemirbicen-dotcom.github.io/berlins_shared_map/?lang=en) · [Deutsch](https://hasanemirbicen-dotcom.github.io/berlins_shared_map/?lang=de)

Herkesin birlikte doldurduğu canlı bir harita. Linki açan kişi haritaya bir pin bırakıyor, bir kategori seçip tek cümleyle o yeri anlatıyor. Bırakılan pinler diğer herkesin ekranında sayfa yenilenmeden görünüyor.

- **Ön yüz:** düz HTML/CSS/JS ve [Leaflet](https://leafletjs.com). GitHub Pages'te ücretsiz yayınlanır.
- **Veri:** [Supabase](https://supabase.com) (ücretsiz plan yeterli). Postgres tablosu ve canlı güncellemeler buradan geliyor.
- **Altlık harita:** © OpenStreetMap katkıcıları (API anahtarı gerektirmez)

## Dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `index.html` | Sayfa iskeleti |
| `style.css` | Görünüm (açık/koyu tema, mobil uyum) |
| `app.js` | Harita, pin ekleme, canlı güncelleme, tekrar oynatma, GeoJSON dışa aktarma |
| `i18n.js` | Arayüz metinleri: Türkçe, English, Deutsch |
| `config.js` | **Senin düzenleyeceğin tek dosya:** Supabase bilgileri, varsayılan dil, başlık, harita merkezi, sınırlar |
| `schema.sql` | Supabase'de bir kez çalıştırılacak veritabanı kurulumu |

## Kurulum (yaklaşık 10 dakika)

### 1. Supabase veritabanı
1. [supabase.com](https://supabase.com)'da ücretsiz hesap aç ve **New project** ile bir proje oluştur.
2. Sol menüden **SQL Editor → New query** aç. `schema.sql` dosyasının tamamını yapıştırıp **Run**'a bas.
3. **Project Settings → API** sayfasına (ya da üstteki **Connect** düğmesine) git ve şu ikisini kopyala:
   - **Project URL**
   - **anon public** (yeni panellerde **publishable**) anahtar
4. Bu iki değeri `config.js` içindeki `supabaseUrl` ve `supabaseAnonKey` alanlarına yapıştır.

> Anon anahtarın sitede görünmesi normal. Güvenliği `schema.sql`'deki kurallar sağlıyor: ziyaretçiler yalnızca pin okuyup ekleyebilir, düzenleyemez ve silemez. **`service_role` anahtarını asla bu dosyaya koyma.**

### 2. GitHub'a yükleme
1. GitHub'da **hasanemirbicen-dotcom** hesabı altında `berlins_shared_map` adıyla **public** bir depo oluştur. (GitHub Pages ücretsiz planda yalnızca public depolarda çalışır.)
2. Depo sayfasında **Add file → Upload files** ile bu klasördeki dosyaları sürükleyip bırak ve **Commit changes**'e bas. Dosyalar deponun kök dizininde olmalı, bir alt klasörde değil.
3. **Settings → Pages** sayfasında *Source* olarak **Deploy from a branch** seç, ardından **main** dalını ve **/ (root)** klasörünü seç, **Save**'e bas.
4. 1–2 dakika sonra site şu adreste açılır: https://hasanemirbicen-dotcom.github.io/berlins_shared_map/

Terminalden yüklemek istersen:

```bash
git init
```

```bash
git add . && git commit -m "Gün 16: ortak harita"
```

```bash
git branch -M main && git remote add origin https://github.com/hasanemirbicen-dotcom/berlins_shared_map.git && git push -u origin main
```

### 3. Paylaş
Linki arkadaşlarına, sınıfına, Instagram, Mastodon veya Bluesky takipçilerine gönder. Bir iki gün pin toplanmasını bekle.

## Diller: Türkçe · English · Deutsch
Panelin sağ üstündeki **TR / EN / DE** düğmeleriyle dil değiştirilir. Site dili şu sırayla seçer:
1. Linkteki `?lang=` değeri, ör. `.../berlins_shared_map/?lang=de`
2. Ziyaretçinin daha önce seçtiği dil
3. Tarayıcının dili
4. `config.js` → `defaultLang`

**Linki kopyala** düğmesi o an seçili dili linke ekler. Böylece Alman arkadaşlarına `?lang=de`, İngilizce konuşanlara `?lang=en` linki gönderebilirsin. Kategoriler bütün dillerde aynı olduğu için pinler tek bir haritada toplanır. Kullanıcıların yazdığı mesajlar çevrilmez, yazıldığı dilde kalır.

## Challenge paylaşımı için ipuçları
- **▶ Tekrar oynat:** pinler bırakıldıkları sırayla tek tek düşer. Ekran kaydı alırsan iyi bir video olur.
- **GeoJSON indir:** tüm pinleri QGIS, kepler.gl veya Datawrapper'a aktarıp istediğin gibi görselleştirebilirsin (yoğunluk haritası, kategori dağılımı vb.).
- Başlıkta katkıcı sayısını vurgula, örneğin: *"37 kişi, 112 pin: Berlin'in ortak haritası"*.

## Moderasyon
Uygunsuz bir pin gelirse Supabase panelinde **Table Editor → pins** tablosundan satırı sil. Pin, açık olan tüm ekranlardan anında kaybolur.

Spam'e karşı alınan önlemler:
- Aynı tarayıcıdan iki pin arasında 30 saniye bekleme süresi (`config.js` → `cooldownSeconds`)
- Mesaj en fazla 280, takma ad en fazla 40 karakter
- Pinler yalnızca Berlin sınırları içine bırakılabilir

Bunları sunucuda da zorlamak için `schema.sql`'deki yorum satırına alınmış kutu kuralını açabilirsin.

## Başka bir şehir için
`config.js` dosyasında `center`, `zoom`, `bounds` ve `title` değerlerini değiştirmen yeterli.

## Yerelde deneme
`config.js` boşken `index.html` dosyasını tarayıcıda açarsan **demo modu** çalışır: pinler yalnızca kendi tarayıcında saklanır, veritabanına gitmez.
