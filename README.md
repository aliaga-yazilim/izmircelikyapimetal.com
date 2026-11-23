# İzmir Çelik Yapı Ferforje – Statik Web Sitesi

GitHub Pages'te çalışan, tamamen statik, SEO odaklı web sitesi. Sayfalar `data/` içindeki JSON dosyalarından Node.js build scriptleriyle üretilir; yayınlanan site yalnızca HTML/CSS/JS ve görsellerden oluşur.

## Yayına alma (GitHub Pages)
1. Bu klasörü bir GitHub deposuna gönderin (`node_modules/` hariç, `.gitignore` hazır).
2. Settings → Pages → "Deploy from a branch" → `main` / `(root)`.
3. `CNAME` dosyası `izmircelikyapiferforje.com` alan adını içerir. Alan adının DNS kayıtlarını GitHub Pages'e yönlendirin ve "Enforce HTTPS"i açın.
4. Yayından sonra Google Search Console'a `https://izmircelikyapiferforje.com/sitemap.xml` adresini ekleyin.

## Yerelde gezme
Kök klasördeki `index.html` dosyasını tarayıcıda çift tıklayarak açabilirsiniz; tüm bağlantılar göreli yollarla çalışır. (Haritayı yükleme gibi dış servisler için internet gerekir.)

## Değişiklik yapma
```bash
npm install        # yalnızca bir kez (sharp + esbuild, sadece geliştirme için)
npm run build      # CSS/JS küçültme + tüm sayfalar + sitemap.xml + robots.txt
npm run images     # img/ klasörüne yeni fotoğraf eklediyseniz (önce data/projects.json'a ekleyin)
npm run serve      # http://localhost:8080 adresinde önizleme
```

| Dosya | İçerik |
|---|---|
| `data/site-config.json` | Marka adı, telefon/WhatsApp, adres, e-posta, sosyal medya, çalışma saatleri, SEO ayarları |
| `data/services.json` | 18 hizmetin başlık, açıklama, detay, SSS ve senaryo metinleri |
| `data/districts.json` | 30 ilçenin tanıtım metni, özellikleri ve `focus` (o ilçede sayfası üretilecek hizmetler) |
| `data/projects.json` | `img/` içindeki her fotoğrafın SEO dosya adı, alt metni ve ilgili hizmetleri |

**Önemli:** `brandName` şu an geçici bir isimdir. E-posta, çalışma saatleri ve sosyal medya boş bırakıldı (doğrulanmamış bilgi eklenmedi); doldurduğunuzda sitede ve yapılandırılmış veride otomatik görünür.

## İlçe + hizmet sayfaları (doorway koruması)
Her ilçe için yalnızca o ilçeye gerçekten uyan hizmetlerin sayfası üretilir (`districts.json → focus`). Bir hizmeti bir ilçeye eklemek için slug'ını o ilçenin `focus` listesine yazıp `npm run build` çalıştırın. `site-config.json → seo.lowRelevanceCombos` değeri `"noindex"` yapılırsa diğer tüm kombinasyonlar da üretilir ama `noindex` olur ve sitemap'e girmez. Keşif talep sayfaları her zaman `noindex, follow`'dur.

Build, önceki çıktıları `.build-manifest.json` listesine göre temizler; elle eklediğiniz dosyalara dokunmaz.
