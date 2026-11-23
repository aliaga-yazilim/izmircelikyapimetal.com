#!/usr/bin/env node
/**
 * Tüm statik HTML sayfalarını data/*.json kaynaklarından üretir.
 * Çıktı doğrudan proje köküne yazılır (GitHub Pages için klasör/index.html yapısı).
 * Üretilen dosyaların listesi .build-manifest.json içinde tutulur; bir sonraki
 * derlemede yalnızca bu dosyalar temizlenir (kaynak dosyalara dokunulmaz).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./lib/helpers');
const L = require('./lib/layout');
const { ROOT, config, services, districts, projects, svcBySlug, distBySlug, IZMIR, esc, lower, lowerFirst, abs, waUrl, waMsg, rotate, projectsFor, picture, largest, ogImage, relevance } = H;
const { ICON } = L;

const ASSET_V = process.env.ASSET_VERSION || Date.now().toString(36);
const MANIFEST = path.join(ROOT, '.build-manifest.json');
const pages = []; // sitemap için: {url, noindex, lastmod}
const written = [];

// ---------- Ortak ----------
/**
 * Site içi kök-göreli yolları (/assets/..., /karsiyaka/...) sayfanın derinliğine göre
 * göreli yollara çevirir (../../assets/...). Böylece site hem GitHub Pages'te hem de
 * yerelde index.html dosyası doğrudan açılarak (file://) gezilebilir.
 * 404.html mutlak yolları korur: GitHub Pages onu her derinlikte sunar.
 */
function relativize(html, url) {
  const depth = url.split('/').filter(Boolean).length;
  const pre = depth ? '../'.repeat(depth) : './';
  const fix = (u) => (u.startsWith('/') && !u.startsWith('//') ? (u === '/' ? pre : pre + u.slice(1)) : u);
  return html
    .replace(/(\s(?:href|src|data-zoom|action)=")([^"]*)"/g, (m, a, u) => a + fix(u) + '"')
    .replace(/(\s(?:srcset|imagesrcset)=")([^"]*)"/g, (m, a, v) => a + v.split(', ').map((part) => { const [u, w] = part.split(' '); return fix(u) + (w ? ' ' + w : ''); }).join(', ') + '"');
}
function writePage(url, html, meta = {}) {
  const rel = url === '/404.html' ? '404.html' : path.join(url.replace(/^\//, ''), 'index.html');
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, url === '/404.html' ? html : relativize(html, url));
  written.push(rel.split(path.sep).join('/'));
  if (url !== '/404.html') pages.push({ url, noindex: !!meta.noindex, priority: meta.priority || 0.5, title: meta.title });
}
function page(o) {
  const wa = o.wa || waUrl(waMsg.generic());
  return L.head({ ...o, assetVersion: ASSET_V }) + '\n' + L.header(o.nav, wa) + o.body + L.footer(wa, ASSET_V);
}
const comboUrl = (d, s) => `/${d.slug}/${s.slug}/`;
const btnWa = (wa, label = "WhatsApp'tan Teklif Al", cls = 'btn btn--wa') => `<a class="${cls}" href="${esc(wa)}" rel="noopener" target="_blank">${ICON.wa}${label}</a>`;
const fitTitle = (t) => (t.length > 64 ? t.replace(/ [–|] [^–|]+$/, '') : t);
const tName = (s) => s.titleName || s.name;
const suffix = (s) => (/(Sistemleri|İmalatı|İmalat|Barınağı)$/.test(s.name) ? '' : ' Hizmetleri');

// ---------- Hangi ilçe+hizmet sayfaları üretilecek ----------
const lowMode = config.seo.lowRelevanceCombos === 'noindex' ? 'noindex' : 'skip';
const combos = []; // {d, s, scenarios, noindex}
for (const d of districts) {
  for (const s of services) {
    const r = relevance(s, d);
    if (r.ok) combos.push({ d, s, scenarios: r.scenarios, noindex: false });
    else if (lowMode === 'noindex') combos.push({ d, s, scenarios: [], noindex: true });
  }
}
const hasCombo = (dSlug, sSlug) => combos.some((c) => c.d.slug === dSlug && c.s.slug === sSlug && !c.noindex);
const combosOf = (dSlug) => combos.filter((c) => c.d.slug === dSlug && !c.noindex);
const districtsFor = (sSlug) => combos.filter((c) => c.s.slug === sSlug && !c.noindex).map((c) => c.d);

// ---------- Ortak bileşenler ----------
function serviceCard(s, d) {
  const p = projectsFor(s.slug)[0] || projects[0];
  const url = d && !d.isCity ? comboUrl(d, s) : `/izmir/${s.slug}/`;
  const wa = waUrl(waMsg.service(s, d));
  return `<article class="card reveal"><a class="card-media" href="${url}" tabindex="-1" aria-hidden="true">${picture(p, { sizes: '(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 380px', alt: p.alt })}</a>
<div class="card-body"><h3><a href="${url}">${esc(d && !d.isCity ? `${d.name} ${s.name}` : s.name)}</a></h3><p>${esc(s.short)}</p>
<div class="card-actions"><a class="link-arrow" href="${url}">Detayları İncele</a>${btnWa(wa, 'Teklif Al', 'btn btn--wa btn--sm')}</div></div></article>`;
}
function thumbs(list, max = 4) {
  return `<div class="thumbs">${list.slice(0, max).map((p) => `<figure><a href="/calismalarimiz/#${p.slug}">${picture(p, { sizes: '(max-width: 640px) 50vw, 260px' })}</a><figcaption>${esc(p.title)}</figcaption></figure>`).join('')}</div>`;
}
const ctaAside = (title, text, wa, kesifUrl) => `<div class="cta-box"><h2>${title}</h2><p>${text}</p>${btnWa(wa)}${kesifUrl ? `<a class="btn btn--ghost" href="${kesifUrl}">Keşif Talep Formu</a>` : ''}<a class="btn btn--ghost" href="tel:${config.contactPhone}">${ICON.phone}${esc(config.contactPhoneDisplay)}</a></div>`;

// ================= ANA SAYFA =================
function buildHome() {
  const hero = projects.find((p) => p.slug === 'celik-cati-kafes-kiris-konstruksiyonu');
  const featured = projects.filter((p) => p.featured).slice(0, 9);
  const wa = waUrl(waMsg.generic());
  const homeFaq = [
    { q: 'Keşif süreci nasıl ilerler?', a: 'WhatsApp veya telefonla işinizi anlattıktan sonra, gerekli durumlarda yerinde keşif için uygun gün belirlenir. Keşifte ölçüler alınır, saha koşulları incelenir ve malzeme seçenekleri konuşulur.' },
    { q: 'Fiyat nasıl belirlenir?', a: 'Her iş ölçüsü, malzemesi ve montaj koşullarıyla farklıdır. Bu nedenle sabit liste fiyatı yerine; metraj, profil kalınlığı, yüzey koruma tipi ve montaj kapsamına göre projeye özel teklif hazırlanır.' },
    { q: 'Hangi malzemeler kullanılır?', a: 'İşin türüne göre kutu profil, I/U profiller, lama, dolu demir, trapez sac ve sandviç panel gibi malzemeler kullanılır. Dış ortam işlerinde astar ve boya sistemi veya galvaniz kaplama seçenekleri değerlendirilir.' },
    { q: 'Hangi ilçelere hizmet veriyorsunuz?', a: "Adresimiz Aliağa'dadır ve İzmir'in tüm ilçelerinden keşif talebi alınır. Uzak ilçelerde keşif günü, iş kapsamı netleştikten sonra önceden planlanır." },
    { q: 'Özel ölçü imalat yapılabilir mi?', a: 'Evet. Kapı, korkuluk, pencere demiri, çatı ve sundurma gibi işlerin tamamı yerinde alınan ölçüye göre üretilir; standart dışı ölçüler için de imalat yapılabilir.' },
    { q: 'Ruhsat ve izin işlemlerini siz mi yapıyorsunuz?', a: 'İmar, ruhsat ve kat malikleri kararı gibi izinler yapı sahibinin sorumluluğundadır. Çatı, çelik yapı ve sundurma gibi işlerde başlamadan önce ilgili belediyeden bilgi almanızı öneririz.' },
  ];
  const appAreas = [
    ['Konut', 'Müstakil ev, villa ve apartmanlarda kapı, pencere demiri, korkuluk, çatı ve sundurma.'],
    ['Sanayi', 'Hangar, depo, tesis çatısı, platform, merdiven ve ağır hizmet kapıları.'],
    ['Tarım ve hayvancılık', 'Ahır, kümes, sera, ürün deposu ve ekipman sundurmaları.'],
    ['Ticari işletmeler', 'Dükkan kepenkleri, otel-restoran korkulukları, pergola ve giriş kapıları.'],
  ];
  const why = [
    ['Yerinde keşif ve ölçü', 'İmalat, sahada alınan ölçülere ve yapının gerçek durumuna göre planlanır.'],
    ['Projeye özel çözüm', 'Hazır kalıp yerine ihtiyaca, mimariye ve bütçeye uygun detaylar önerilir.'],
    ['Açık teklif kapsamı', 'Malzeme, yüzey koruma ve montajın teklife dahil olup olmadığı baştan netleştirilir.'],
    ['Dayanıklı malzeme seçenekleri', 'Kıyı, sanayi veya kırsal alan koşullarına uygun malzeme ve boya sistemi önerilir.'],
  ];
  const regions = [['kuzey', 'Kuzey'], ['merkez', 'Merkez'], ['guney', 'Güney'], ['yarimada', 'Yarımada'], ['dogu', 'Doğu ve İç Bölge']];
  const body = `
<section class="hero">
 ${picture(hero, { sizes: '100vw', eager: true, alt: 'İzmir çelik konstrüksiyon: kafes kirişli çelik çatı iskeleti' })}
 <div class="wrap">
  <span class="eyebrow">İzmir geneli · Metal &amp; çelik imalat</span>
  <h1>İzmir'de Demir Doğrama, Ferforje ve <em>Çelik Yapı</em> Çözümleri</h1>
  <p class="lead">Demir, çelik ve metal imalatında projeye özel çözümler. Keşif, ölçülendirme ve teklif için bizimle iletişime geçin.</p>
  <div class="btn-row">${btnWa(wa)}<a class="btn btn--ghost" href="/calismalarimiz/">Çalışmalarımızı İncele</a></div>
  <ul class="hero-facts"><li>Yerinde keşif ve ölçü</li><li>Projeye özel fiyatlandırma</li><li>İzmir'in 30 ilçesinde hizmet</li></ul>
 </div>
</section>
<section class="section" id="hizmetler"><div class="wrap">
 <div class="section-head"><span class="eyebrow">Hizmet kategorileri</span><h2>Demirden çeliğe, ihtiyaca uygun imalat</h2><p>Kapı ve korkuluktan çelik çatıya, hangardan seraya kadar 18 hizmet kategorisinde projeye özel çözümler.</p></div>
 <div class="grid grid-3">${services.slice(0, 9).map((s) => serviceCard(s)).join('')}</div>
 <p style="margin-top:28px"><a class="btn btn--ghost" href="/hizmetlerimiz/">Tüm hizmetleri gör (18)</a></p>
</div></section>
<section class="section section--alt"><div class="wrap">
 <div class="section-head"><span class="eyebrow">Neden bizi tercih etmelisiniz?</span><h2>Ölçüsü doğru, kapsamı net işler</h2></div>
 <div class="grid grid-4">${why.map(([t, p], i) => `<div class="feature reveal"><h3><span class="num">${i + 1}</span>${t}</h3><p>${p}</p></div>`).join('')}</div>
</div></section>
<section class="section"><div class="wrap">
 <div class="section-head"><span class="eyebrow">Öne çıkan çalışmalar</span><h2>Sahadan gerçek uygulamalar</h2><p>Aşağıdaki görseller tamamlanan ve devam eden çalışmalarımızdan alınmıştır.</p></div>
 <div class="grid grid-3">${featured.map((p) => `<figure class="card reveal" style="margin:0"><a class="card-media" href="/calismalarimiz/#${p.slug}">${picture(p, { sizes: '(max-width: 640px) 100vw, 380px' })}</a><figcaption class="card-body"><h3 style="font-size:1.25rem">${esc(p.title)}</h3><p>${p.services.map((s) => svcBySlug[s] ? `<a href="/izmir/${s}/">${esc(svcBySlug[s].name)}</a>` : '').filter(Boolean).join(' · ')}</p></figcaption></figure>`).join('')}</div>
 <p style="margin-top:28px"><a class="btn btn--ghost" href="/calismalarimiz/">Tüm çalışmalar (${projects.length} görsel)</a></p>
</div></section>
<section class="section section--alt"><div class="wrap">
 <div class="section-head"><span class="eyebrow">Uygulama alanlarımız</span><h2>Konuttan sanayiye, tarladan şantiyeye</h2></div>
 <div class="grid grid-4">${appAreas.map(([t, p]) => `<div class="feature reveal"><h3>${t}</h3><p>${p}</p></div>`).join('')}</div>
</div></section>
<section class="section"><div class="wrap">
 <div class="section-head"><span class="eyebrow">Hizmet bölgeleri</span><h2>İzmir'in tüm ilçelerinde hizmet</h2><p>Adresimiz Aliağa'da. Kuzeyden yarımadaya, merkezden iç bölgelere kadar İzmir'in 30 ilçesinden keşif talebi alıyoruz.</p></div>
 ${regions.map(([r, t]) => `<h3 style="margin-top:24px">${t}</h3><ul class="district-grid">${districts.filter((d) => d.region === r).map((d) => `<li><a href="/${d.slug}/">${esc(d.name)}</a></li>`).join('')}</ul>`).join('')}
</div></section>
<section class="section section--alt"><div class="wrap">
 <div class="section-head"><span class="eyebrow">Çalışma süreci</span><h2>İlk mesajdan teslime 5 adım</h2></div>
 ${L.processHtml()}
</div></section>
<section class="section"><div class="wrap" style="max-width:900px">
 <div class="section-head"><span class="eyebrow">Sık sorulan sorular</span><h2>Merak edilenler</h2></div>
 ${L.faqHtml(homeFaq)}
</div></section>
${L.ctaBand("Projenizi WhatsApp'tan anlatın", 'Fotoğraf ve yaklaşık ölçülerinizi gönderin; keşif ve teklif sürecini birlikte planlayalım.', wa)}
`;
  const pre = (() => { const m = H.images[hero.slug]; return m ? `<link rel="preload" as="image" type="image/avif" imagesrcset="${m.variants.map((x) => `/assets/images/${hero.slug}-${x.w}.avif ${x.w}w`).join(', ')}" imagesizes="100vw" fetchpriority="high">\n` : ''; })();
  writePage('/', page({
    url: '/', nav: '/', title: `İzmir Demir Doğrama, Ferforje ve Çelik Yapı | ${config.brandName}`,
    description: config.seo.defaultDescription, wa, body, preload: pre, ogImage: ogImage(hero), primaryImage: largest(hero),
    schema: [{ '@type': 'WebSite', '@id': abs('/#website'), url: abs('/'), name: config.brandName, inLanguage: 'tr-TR', publisher: { '@id': L.BUSINESS_ID } }, ...L.faqSchema(homeFaq, '/')],
  }), { priority: 1.0 });
}

// ================= HİZMETLERİMİZ =================
function buildServicesIndex() {
  const crumbs = [{ name: 'Ana Sayfa', url: '/' }, { name: 'Hizmetlerimiz', url: '/hizmetlerimiz/' }];
  const body = `<section class="page-head"><div class="wrap">${L.crumbsHtml(crumbs)}<h1>Hizmetlerimiz</h1><p class="lead">Demir doğrama ve ferforjeden çelik konstrüksiyona, sac çatıdan seraya kadar İzmir genelinde sunduğumuz metal ve çelik imalat hizmetleri.</p></div></section>
<section class="section"><div class="wrap"><div class="grid grid-3">${services.map((s) => serviceCard(s)).join('')}</div>
<p class="note">Her hizmetin kapsamı ve uygulanabilirliği keşif sırasında işin özelliklerine göre netleştirilir.</p></div></section>
${L.ctaBand('Aradığınız hizmeti bulamadınız mı?', "Özel ölçü ve özel tasarım metal işleri için ihtiyacınızı WhatsApp'tan iletin.", waUrl(waMsg.generic()))}`;
  writePage('/hizmetlerimiz/', page({
    url: '/hizmetlerimiz/', nav: '/hizmetlerimiz/', crumbs, title: `Hizmetlerimiz | Metal ve Çelik İmalat İzmir – ${config.brandShort}`,
    description: "İzmir'de demir doğrama, ferforje, çelik çatı, çelik konstrüksiyon, sac çatı, sundurma, konteyner, kümes ve sera dahil 18 metal ve çelik imalat hizmeti.",
    body, pageType: 'CollectionPage',
    schema: [{ '@type': 'ItemList', name: 'Hizmetlerimiz', itemListElement: services.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(`/izmir/${s.slug}/`), name: s.name })) }],
  }), { priority: 0.9 });
}

// ================= ÇALIŞMALARIMIZ =================
function buildPortfolio() {
  const crumbs = [{ name: 'Ana Sayfa', url: '/' }, { name: 'Çalışmalarımız', url: '/calismalarimiz/' }];
  const used = services.filter((s) => projects.some((p) => p.services.includes(s.slug)));
  const body = `<section class="page-head"><div class="wrap">${L.crumbsHtml(crumbs)}<h1>Çalışmalarımız</h1><p class="lead">Sahadan gerçek uygulama görselleri: çelik çatı ve konstrüksiyondan ferforje kapı ve korkuluğa, çelik evlerden hayvan barınaklarına.</p></div></section>
<section class="section"><div class="wrap">
 <div class="filters" data-filters role="group" aria-label="Hizmete göre filtrele"><button type="button" data-filter="all" aria-pressed="true">Tümü (${projects.length})</button>${used.map((s) => `<button type="button" data-filter="${s.slug}" aria-pressed="false">${esc(s.name)} (${projects.filter((p) => p.services.includes(s.slug)).length})</button>`).join('')}</div>
 <div class="gallery" data-gallery>${projects.map((p) => `<figure id="${p.slug}" data-services="${p.services.join(' ')}"><button type="button" class="zoom" data-zoom="${largest(p)}" data-alt="${esc(p.alt)}" aria-label="Büyüt: ${esc(p.title)}">${picture(p, { sizes: '(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 380px' })}</button>
 <figcaption><strong>${esc(p.title)}</strong><span>${esc(p.alt)}</span><span class="tags">${p.services.map((s) => svcBySlug[s] ? `<a href="/izmir/${s}/">${esc(svcBySlug[s].name)}</a>` : '').join('')}</span><a class="wa-mini" href="${esc(waUrl(waMsg.project(p)))}" rel="noopener" target="_blank">Benzerini yaptırmak için WhatsApp →</a></figcaption></figure>`).join('')}</div>
 <noscript><p class="note">Filtre ve büyütme özellikleri için JavaScript gereklidir; tüm görseller yukarıda listelenmiştir.</p></noscript>
</div></section>
${L.ctaBand('Benzer bir iş mi planlıyorsunuz?', "Beğendiğiniz çalışmanın görselini WhatsApp'tan gönderin, ihtiyacınıza göre uyarlayalım.", waUrl(waMsg.generic()))}`;
  writePage('/calismalarimiz/', page({
    url: '/calismalarimiz/', nav: '/calismalarimiz/', crumbs, title: `Çalışmalarımız | Çelik Yapı, Ferforje ve Çatı Uygulamaları`,
    description: 'Gerçek saha görselleriyle çalışmalarımız: çelik çatı, çelik konstrüksiyon, çelik ev, ferforje kapı, korkuluk, sundurma, konteyner ve hayvan barınağı uygulamaları.',
    body, pageType: 'CollectionPage', ogImage: ogImage(projects.find((p) => p.slug === 'tamamlanmis-iki-katli-celik-ev')),
    schema: [{ '@type': 'ImageGallery', name: 'Çalışmalarımız', url: abs('/calismalarimiz/'), associatedMedia: projects.map((p) => ({ '@type': 'ImageObject', contentUrl: abs(largest(p)), name: p.title, description: p.alt, creditText: config.brandName })) }],
  }), { priority: 0.8 });
}

// ================= İLETİŞİM =================
function buildContact() {
  const crumbs = [{ name: 'Ana Sayfa', url: '/' }, { name: 'İletişim', url: '/iletisim/' }];
  const wa = waUrl(waMsg.generic());
  const mapEmbed = `https://www.google.com/maps?q=${encodeURIComponent(config.mapQuery)}&output=embed`;
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.mapQuery)}`;
  const body = `<section class="page-head"><div class="wrap">${L.crumbsHtml(crumbs)}<h1>İletişim</h1><p class="lead">Keşif ve fiyat teklifi için en hızlı yol WhatsApp. İşinizi kısaca anlatıp fotoğraf ve yaklaşık ölçü paylaşmanız yeterli.</p></div></section>
<section class="section"><div class="wrap content-grid">
 <div>
  <h2>İletişim bilgileri</h2>
  <ul class="contact-list">
   <li>${ICON.wa}<div><b>WhatsApp</b><a href="${esc(wa)}" rel="noopener" target="_blank">${esc(config.contactPhoneDisplay)}</a><div class="muted">Fotoğraf, konum ve ölçü paylaşımı için önerilir.</div></div></li>
   <li>${ICON.phone}<div><b>Telefon</b><a href="tel:${config.contactPhone}">${esc(config.contactPhoneDisplay)}</a></div></li>
   ${config.email ? `<li>${ICON.mail}<div><b>E-posta</b><a href="mailto:${esc(config.email)}">${esc(config.email)}</a></div></li>` : ''}
   <li>${ICON.pin}<div><b>Adres</b><span>${esc(config.address.display)}</span><div><a href="${esc(mapLink)}" rel="noopener" target="_blank" style="font-size:.95rem">Haritada aç →</a></div></div></li>
   ${config.businessHours ? `<li>${ICON.pin}<div><b>Çalışma saatleri</b><span>${esc(config.businessHours.display || '')}</span></div></li>` : ''}
  </ul>
  <h2 style="margin-top:40px">Konum</h2>
  <div class="map-box" data-map="${esc(mapEmbed)}"><button class="btn btn--ghost" type="button">${ICON.map}Haritayı yükle</button></div>
  <p class="muted" style="font-size:.88rem;margin-top:8px">Harita, Google Haritalar'dan yalnızca butona tıkladığınızda yüklenir.</p>
  <h2 style="margin-top:40px">Hizmet bölgeleri</h2>
  <p>İzmir'in tüm ilçelerinden keşif talebi alınır. İlçenizi seçerek o bölgeye özel bilgileri inceleyebilirsiniz.</p>
  <ul class="district-grid">${districts.map((d) => `<li><a href="/${d.slug}/">${esc(d.name)}</a></li>`).join('')}</ul>
 </div>
 <aside class="aside">${ctaAside('Hızlı teklif', 'İşin türünü, ilçenizi ve varsa ölçüleri yazın. Fotoğraf eklemeniz değerlendirmeyi hızlandırır.', wa, '/izmir/demir-dograma/kesif-talep/')}</aside>
</div></section>`;
  writePage('/iletisim/', page({
    url: '/iletisim/', nav: '/iletisim/', crumbs, title: `İletişim | Keşif ve Teklif – ${config.brandName}`,
    description: `Keşif ve fiyat teklifi için WhatsApp veya telefon: ${config.contactPhoneDisplay}. Adres: ${config.address.display}. İzmir'in tüm ilçelerine hizmet.`,
    body, pageType: 'ContactPage', wa,
  }), { priority: 0.8 });
}

// ================= HİZMET DETAY (İzmir geneli) =================
function buildServicePage(s) {
  const url = `/izmir/${s.slug}/`;
  const crumbs = [{ name: 'Ana Sayfa', url: '/' }, { name: 'Hizmetlerimiz', url: '/hizmetlerimiz/' }, { name: s.name, url }];
  const wa = waUrl(waMsg.service(s, IZMIR));
  const pr = projectsFor(s.slug);
  const hero = pr[0] || projects[0];
  const ds = districtsFor(s.slug);
  const rel = s.related.map((r) => svcBySlug[r]).filter(Boolean);
  const body = `<section class="page-head"><div class="wrap">${L.crumbsHtml(crumbs)}<span class="eyebrow">İzmir geneli</span><h1>İzmir ${esc(s.h1)}</h1><p class="lead">${esc(s.short)} Keşif, ölçülendirme ve projeye özel teklif.</p><div class="btn-row">${btnWa(wa)}<a class="btn btn--ghost" href="/izmir/${s.slug}/kesif-talep/">Keşif Talep Formu</a></div></div></section>
<section class="section"><div class="wrap content-grid">
 <article class="prose">
  <h2>${esc(s.name)} nedir?</h2>${s.intro.map((p) => `<p>${esc(p)}</p>`).join('')}
  ${pr.length ? `<figure>${picture(hero, { sizes: '(max-width: 1000px) 100vw, 760px' })}<figcaption>${esc(hero.title)} – çalışmalarımızdan</figcaption></figure>` : ''}
  <h2>Hizmet detayları</h2><ul class="checklist">${s.details.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
  <h2>Uygulama alanları</h2><ul class="pill-list">${s.applications.map((x) => `<li><span>${esc(x)}</span></li>`).join('')}</ul>
  <h2>Kullanım senaryoları</h2>${s.scenarios.map((x) => `<p>${esc(x.text)}</p>`).join('')}
  <h2>Malzeme ve üretim süreci</h2><ul class="checklist">${s.materials.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
  <h2>Avantajları</h2><ul class="checklist">${s.advantages.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
  <h2>İlgili çalışmalar</h2>${pr.length ? thumbs(pr, 8) : `<p class="muted">Bu hizmete ait proje görselleri yakında eklenecektir. Benzer işlerimiz için <a href="/calismalarimiz/">çalışmalarımıza</a> göz atabilirsiniz.</p>`}
  <h2>Sık sorulan sorular</h2>${L.faqHtml(s.faq)}
  ${ds.length ? `<h2>İlçelere göre ${esc(lower(s.name))}</h2><p>Bölgenize özel uygulama senaryoları ve sık sorulan sorular için ilçenizi seçin:</p><ul class="district-grid">${ds.map((d) => `<li><a href="${comboUrl(d, s)}">${esc(d.name)}</a></li>`).join('')}</ul>` : ''}
  <h2>İlgili hizmetler</h2><ul class="pill-list">${rel.map((r) => `<li><a href="/izmir/${r.slug}/">${esc(r.name)}</a></li>`).join('')}</ul>
 </article>
 <aside class="aside">${ctaAside(`${esc(s.name)} için teklif alın`, 'İşinizi kısaca anlatın; fotoğraf ve yaklaşık ölçü paylaşırsanız ön değerlendirme hızlanır.', wa, `/izmir/${s.slug}/kesif-talep/`)}
 <div class="feature"><h3>Nasıl çalışıyoruz?</h3><p>İletişim → keşif ve ölçü → projeye özel teklif → imalat → montaj. Fiyatlar sabit liste yerine işin kapsamına göre belirlenir.</p></div></aside>
</div></section>
${L.ctaBand(`İzmir'de ${esc(lower(s.name))} mi planlıyorsunuz?`, "Keşif ve fiyat teklifi için WhatsApp'tan yazın.", wa)}`;
  writePage(url, page({
    url, nav: '/hizmetlerimiz/', crumbs, title: s.title, description: s.description, wa, body, ogImage: ogImage(hero), primaryImage: pr.length ? largest(hero) : null,
    schema: [{ '@type': 'Service', '@id': abs(url) + '#service', name: `${s.name} – İzmir`, serviceType: s.name, description: s.description, provider: { '@id': L.BUSINESS_ID }, areaServed: { '@type': 'City', name: 'İzmir' }, url: abs(url) }, ...L.faqSchema(s.faq, url)],
  }), { priority: 0.9, title: s.name });
  buildKesif(IZMIR, s);
}

// ================= İLÇE + HİZMET =================
function comboFaq(d, s) {
  const n = lower(s.name);
  return [
    { q: `${d.de} ${n} için keşfe geliyor musunuz?`, a: `Evet, ${d.name} dahil İzmir'in tüm ilçelerinden keşif talebi alıyoruz. ${d.local} Keşiften önce iş yerinin fotoğraflarını ve yaklaşık ölçülerini WhatsApp'tan göndermeniz ön değerlendirmeyi hızlandırır.` },
    { q: `${d.name} koşullarında ${n} için nelere dikkat edilmeli?`, a: `${d.climate} Malzeme, profil ve yüzey koruma seçenekleri keşifte bu koşullara göre önerilir.` },
    { q: `${d.de} ${n} fiyatı nasıl belirlenir?`, a: `Fiyat; işin ölçüsü, kullanılacak malzeme ve profil kalınlığı, yüzey koruma tipi ve montaj koşullarına göre belirlenir. ${d.name} için ulaşım ve saha koşulları da keşifte değerlendirilir; sabit liste fiyatı yerine projeye özel teklif verilir.` },
    ...s.faq.slice(0, 2),
  ];
}
function buildCombo(c) {
  const { d, s, scenarios } = c;
  const url = comboUrl(d, s);
  const crumbs = [{ name: 'Ana Sayfa', url: '/' }, { name: d.name, url: `/${d.slug}/` }, { name: s.name, url }];
  const wa = waUrl(waMsg.service(s, d));
  const pr = rotate(projectsFor(s.slug), d.slug);
  const hero = pr[0];
  const faq = comboFaq(d, s);
  const nb = d.neighbors.map((x) => distBySlug[x]).filter(Boolean);
  const rel = s.related.map((r) => svcBySlug[r]).filter(Boolean);
  const otherHere = combosOf(d.slug).filter((x) => x.s.slug !== s.slug && !s.related.includes(x.s.slug)).slice(0, 6);
  const h1 = `${d.name} ${s.name}${suffix(s)}`;
  const body = `<section class="page-head"><div class="wrap">${L.crumbsHtml(crumbs)}<span class="eyebrow">${esc(d.name)} · İzmir</span><h1>${esc(h1)}</h1><p class="lead">${esc(d.de)} ${esc(lower(s.name))} ihtiyaçlarınız için keşif, ölçülendirme ve projeye özel imalat. ${esc(s.short)}</p><div class="btn-row">${btnWa(wa)}<a class="btn btn--ghost" href="${url}kesif-talep/">Keşif Talep Formu</a></div></div></section>
<section class="section"><div class="wrap content-grid">
 <article class="prose">
  <h2>${esc(d.de)} ${esc(lower(s.name))}</h2>
  <p>${esc(d.intro)}</p>
  <p>${esc(scenarios[0].text)}</p>
  <p>${esc(d.local)}</p>
  ${hero ? `<figure>${picture(hero, { sizes: '(max-width: 1000px) 100vw, 760px' })}<figcaption>${esc(hero.title)} – örnek çalışmamızdan bir görsel</figcaption></figure>` : ''}
  <h2>Sunulan uygulamalar</h2><ul class="checklist">${s.details.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
  <h2>${esc(d.name)} için uygulama senaryoları</h2>
  ${scenarios.slice(1).map((x) => `<p>${esc(x.text)}</p>`).join('') || `<p>${esc(s.intro[0])}</p>`}
  <p>Keşif talepleri ${esc(d.areas.join(', '))} dahil ${esc(d.name)} genelinden alınır.</p>
  <h2>Kullanılan malzeme ve üretim süreci</h2><ul class="checklist">${s.materials.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
  <p class="note"><strong>${esc(d.name)} koşulları:</strong> ${esc(d.climate)}</p>
  <h2>Uygulama alanları</h2><ul class="pill-list">${s.applications.map((x) => `<li><span>${esc(x)}</span></li>`).join('')}</ul>
  <h2>İlgili çalışmalar</h2>${pr.length ? thumbs(pr, 4) + `<p class="muted" style="font-size:.9rem;margin-top:10px">Görseller farklı lokasyonlardaki çalışmalarımızdan örneklerdir.</p>` : `<p class="muted">Bu hizmete ait proje görselleri yakında eklenecektir. Benzer işler için <a href="/calismalarimiz/">çalışmalarımıza</a> göz atabilirsiniz.</p>`}
  <h2>Neden ${esc(lower(s.name))}?</h2><ul class="checklist">${s.advantages.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
  <h2>Keşif ve fiyatlandırma nasıl ilerler?</h2>${L.processHtml()}
  <h2>Sık sorulan sorular</h2>${L.faqHtml(faq)}
  <h2>İlgili ilçeler</h2><ul class="pill-list">${nb.map((n) => hasCombo(n.slug, s.slug) ? `<li><a href="${comboUrl(n, s)}">${esc(n.name)} ${esc(s.name)}</a></li>` : `<li><a href="/${n.slug}/">${esc(n.name)}</a></li>`).join('')}<li><a href="/izmir/${s.slug}/">İzmir geneli ${esc(s.name)}</a></li></ul>
  <h2>İlgili hizmetler</h2><ul class="pill-list">${rel.map((r) => `<li><a href="${hasCombo(d.slug, r.slug) ? comboUrl(d, r) : `/izmir/${r.slug}/`}">${esc(hasCombo(d.slug, r.slug) ? `${d.name} ${r.name}` : r.name)}</a></li>`).join('')}${otherHere.map((x) => `<li><a href="${comboUrl(d, x.s)}">${esc(d.name)} ${esc(x.s.name)}</a></li>`).join('')}</ul>
 </article>
 <aside class="aside">${ctaAside(`${esc(d.name)} için teklif alın`, `${esc(d.de)} ${esc(lower(s.name))} işinizi kısaca anlatın. WhatsApp mesajınız sayfaya göre hazır gelir.`, wa, `${url}kesif-talep/`)}
 <div class="feature"><h3>Bilgi</h3><p>Sitedeki görseller farklı lokasyonlardaki gerçek çalışmalarımızdandır. İzin ve ruhsat gerektiren işlerde başlamadan önce ilgili belediyeye danışmanızı öneririz.</p></div>
 <div class="feature"><h3>İletişim</h3><p><a href="/iletisim/">İletişim sayfası</a> · <a href="tel:${config.contactPhone}">${esc(config.contactPhoneDisplay)}</a></p></div></aside>
</div></section>
${L.ctaBand(`${esc(d.de)} ${esc(lower(s.name))} için keşif isteyin`, 'Fotoğraf ve ölçülerinizi gönderin, keşif ve teklif sürecini planlayalım.', wa)}`;
  const desc = `${d.de} ${lower(s.name)}: ${lowerFirst(s.short.replace(/\.$/, ''))}. ${d.name} koşullarına uygun malzeme, keşif ve projeye özel teklif için WhatsApp'tan yazın.`;
  writePage(url, page({
    url, nav: '/izmir/', crumbs, title: fitTitle(`${d.name} ${tName(s)} | Keşif ve Teklif – ${config.brandShort}`), description: desc, wa, body, noindex: c.noindex,
    ogImage: hero ? ogImage(hero) : undefined, primaryImage: hero ? largest(hero) : null,
    schema: [{ '@type': 'Service', '@id': abs(url) + '#service', name: `${d.name} ${s.name}`, serviceType: s.name, description: desc, provider: { '@id': L.BUSINESS_ID }, areaServed: { '@type': 'AdministrativeArea', name: `${d.name}, İzmir` }, url: abs(url) }, ...L.faqSchema(faq, url)],
  }), { noindex: c.noindex, priority: 0.7, title: `${d.name} ${s.name}` });
  buildKesif(d, s);
}

// ================= KEŞİF TALEP =================
function buildKesif(d, s) {
  const base = d.isCity ? `/izmir/${s.slug}/` : comboUrl(d, s);
  const url = base + 'kesif-talep/';
  const crumbs = [{ name: 'Ana Sayfa', url: '/' }, { name: d.name, url: d.isCity ? '/izmir/' : `/${d.slug}/` }, { name: s.name, url: base }, { name: 'Keşif Talebi', url }];
  const wa = waUrl(waMsg.service(s, d));
  const opt = (val, sel) => `<option${sel ? ' selected' : ''}>${esc(val)}</option>`;
  const body = `<section class="page-head"><div class="wrap">${L.crumbsHtml(crumbs)}<h1>${esc(d.isCity ? 'İzmir' : d.name)} ${esc(s.name)} Keşif Talebi</h1><p class="lead">Formu doldurun, “WhatsApp ile Gönder” butonuna basın. Bilgileriniz hazır bir WhatsApp mesajına dönüşür; mesajı kontrol edip gönderebilirsiniz.</p></div></section>
<section class="section"><div class="wrap content-grid">
 <form class="form" data-wa-form data-phone="${config.whatsappPhone}" action="https://wa.me/${config.whatsappPhone}" method="get">
  <div class="form-row">
   <div class="field"><label for="hizmet">Hizmet türü</label><select id="hizmet" name="hizmet">${services.map((x) => opt(lower(x.name), x.slug === s.slug)).join('')}</select></div>
   <div class="field"><label for="ilce">İlçe</label><select id="ilce" name="ilce">${opt('İzmir geneli', d.isCity)}${districts.map((x) => opt(x.name, x.slug === d.slug)).join('')}</select></div>
  </div>
  <div class="field"><label for="aciklama">Yapılacak işin kısa açıklaması</label><textarea id="aciklama" name="aciklama" placeholder="Örn. bahçe girişine çift kanat ferforje kapı ve yanına yaya kapısı"></textarea></div>
  <div class="field"><label for="olcu">Ölçü veya proje bilgisi <small>(isteğe bağlı)</small></label><input id="olcu" name="olcu" placeholder="Örn. yaklaşık 4 m genişlik, 1,8 m yükseklik"></div>
  <div class="field"><label for="ad">Adınız <small>(isteğe bağlı)</small></label><input id="ad" name="ad" autocomplete="name"></div>
  <button class="btn btn--wa" type="submit">${ICON.wa}WhatsApp ile Gönder</button>
  <p class="muted" style="font-size:.88rem;margin:0">Bu form herhangi bir veri kaydetmez; yalnızca WhatsApp'ta mesaj taslağı oluşturur. Fotoğrafları WhatsApp sohbetine ekleyebilirsiniz.</p>
 </form>
 <aside class="aside"><div class="cta-box"><h2>Formsuz iletişim</h2><p>Doğrudan yazmak isterseniz hazır mesajla WhatsApp'ı açın veya arayın.</p>${btnWa(wa, 'WhatsApp’ı Aç')}<a class="btn btn--ghost" href="tel:${config.contactPhone}">${ICON.phone}${esc(config.contactPhoneDisplay)}</a></div>
 <div class="feature"><h3>Keşif süreci</h3><p>Mesajınızdan sonra işin kapsamına göre yerinde keşif günü planlanır, ölçüler alınır ve projeye özel teklif hazırlanır.</p><p style="margin-top:10px"><a href="${base}">← ${esc(d.isCity ? '' : d.name + ' ')}${esc(s.name)} sayfasına dön</a></p></div></aside>
</div></section>`;
  writePage(url, page({
    url, nav: '', crumbs, title: fitTitle(`${d.isCity ? 'İzmir' : d.name} ${tName(s)} Keşif Talebi | ${config.brandShort}`),
    description: `${d.isCity ? "İzmir'de" : d.de} ${lower(s.name)} için keşif ve fiyat teklifi talebi: formu doldurun, bilgileriniz WhatsApp mesajı olarak hazırlansın.`,
    wa, body, noindex: true,
  }), { noindex: true });
}

// ================= İLÇE HUB =================
function buildDistrict(d) {
  const url = `/${d.slug}/`;
  const crumbs = [{ name: 'Ana Sayfa', url: '/' }, { name: 'Hizmet Bölgeleri', url: '/izmir/' }, { name: d.name, url }];
  const wa = waUrl(waMsg.district(d));
  const here = combosOf(d.slug);
  const others = services.filter((s) => !here.some((c) => c.s.slug === s.slug));
  const nb = d.neighbors.map((x) => distBySlug[x]).filter(Boolean);
  const faq = [d.faq, { q: `${d.de} hangi metal işleri yapılıyor?`, a: `${d.name} için öne çıkan hizmetler: ${here.map((c) => lower(c.s.name)).join(', ')}. Listede olmayan işler için de WhatsApp'tan bilgi alabilirsiniz.` }];
  const body = `<section class="page-head"><div class="wrap">${L.crumbsHtml(crumbs)}<span class="eyebrow">Hizmet bölgesi</span><h1>${esc(d.name)} Demir, Çelik ve Metal İmalat Hizmetleri</h1><p class="lead">${esc(d.intro)}</p><div class="btn-row">${btnWa(wa)}</div></div></section>
<section class="section"><div class="wrap">
 <div class="section-head"><h2>${esc(d.de)} öne çıkan hizmetler</h2><p>${esc(d.local)}</p></div>
 <div class="grid grid-3">${here.map((c) => serviceCard(c.s, d)).join('')}</div>
 ${others.length ? `<h3 style="margin-top:40px">Diğer hizmetlerimiz</h3><ul class="pill-list">${others.map((s) => `<li><a href="/izmir/${s.slug}/">${esc(s.name)}</a></li>`).join('')}</ul>` : ''}
</div></section>
<section class="section section--alt"><div class="wrap content-grid">
 <div class="prose"><h2>${esc(d.name)} koşulları ve dikkat edilecekler</h2><p>${esc(d.climate)}</p><p>Keşif talepleri ${esc(d.areas.join(', '))} dahil ${esc(d.name)} genelinden alınır.</p>
 <h2>Sık sorulan sorular</h2>${L.faqHtml(faq)}
 <h2>Komşu ilçeler</h2><ul class="pill-list">${nb.map((n) => `<li><a href="/${n.slug}/">${esc(n.name)}</a></li>`).join('')}<li><a href="/izmir/">Tüm ilçeler</a></li></ul></div>
 <aside class="aside">${ctaAside(`${esc(d.name)} için teklif`, 'İşinizi kısaca anlatın; fotoğraf ve konum paylaşırsanız keşif planlaması kolaylaşır.', wa)}</aside>
</div></section>`;
  writePage(url, page({
    url, nav: '/izmir/', crumbs, title: `${d.name} Demir Doğrama, Ferforje ve Çelik Yapı | ${config.brandShort}`,
    description: `${d.de} demir doğrama, ferforje, çelik çatı ve metal imalat: ${here.slice(0, 4).map((c) => lower(c.s.name)).join(', ')} ve daha fazlası. Keşif ve teklif için WhatsApp.`,
    wa, body, schema: L.faqSchema(faq, url),
  }), { priority: 0.7, title: d.name });
}

// ================= İZMİR HUB =================
function buildIzmirHub() {
  const url = '/izmir/';
  const crumbs = [{ name: 'Ana Sayfa', url: '/' }, { name: 'Hizmet Bölgeleri', url }];
  const regions = [['kuzey', 'Kuzey İzmir', 'Aliağa merkezli adresimize en yakın bölge; sanayi, tarım ve kıyı yerleşimleri bir arada.'], ['merkez', 'Merkez ilçeler', 'Apartman ve site yoğunluklu yerleşimler, küçük sanayi ve ticari alanlar.'], ['guney', 'Güney aksı', 'Sanayi bölgeleri, havalimanı çevresi ve gelişen konut alanları.'], ['yarimada', 'Yarımada ve kıyı', 'Yazlık ve villa yerleşimleri; rüzgâr ve tuzlu havaya dikkat gerektiren bölgeler.'], ['dogu', 'Doğu ve iç bölge', 'Tarım, hayvancılık ve dağlık kesimler; kar ve sıcaklık farklarına uygun yapılar.']];
  const body = `<section class="page-head"><div class="wrap">${L.crumbsHtml(crumbs)}<h1>İzmir Hizmet Bölgeleri</h1><p class="lead">İzmir'in 30 ilçesinin tamamından keşif talebi alıyoruz. İlçenizi seçerek bölgeye özel hizmetleri, uygulama senaryolarını ve sık sorulan soruları inceleyin.</p></div></section>
<section class="section"><div class="wrap">
 ${regions.map(([r, t, p]) => `<h2 style="margin-top:32px">${t}</h2><p class="muted">${p}</p><ul class="district-grid">${districts.filter((d) => d.region === r).map((d) => `<li><a href="/${d.slug}/">${esc(d.name)}</a></li>`).join('')}</ul>`).join('')}
 <h2 style="margin-top:48px">İzmir geneli hizmetler</h2><ul class="pill-list">${services.map((s) => `<li><a href="/izmir/${s.slug}/">${esc(s.name)}</a></li>`).join('')}</ul>
</div></section>
${L.ctaBand('İlçenizi listede göremediniz mi?', "İzmir'in tüm ilçelerine hizmet veriyoruz. Konumunuzu WhatsApp'tan paylaşın.", waUrl(waMsg.generic()))}`;
  writePage(url, page({ url, nav: '/izmir/', crumbs, title: `İzmir Hizmet Bölgeleri | 30 İlçede Metal ve Çelik İmalat`, description: "İzmir'in 30 ilçesinde demir doğrama, ferforje, çelik çatı ve çelik yapı hizmeti. İlçenizi seçin, bölgenize özel bilgileri ve keşif seçeneklerini görün.", body, pageType: 'CollectionPage' }), { priority: 0.8 });
}

// ================= HTML SİTE HARİTASI =================
function buildHtmlSitemap() {
  const url = '/sitemap/';
  const crumbs = [{ name: 'Ana Sayfa', url: '/' }, { name: 'Site Haritası', url }];
  const body = `<section class="page-head"><div class="wrap">${L.crumbsHtml(crumbs)}<h1>Site Haritası</h1><p class="lead">Sitedeki tüm sayfalar: genel sayfalar, hizmetler ve ilçelere göre hizmet sayfaları.</p></div></section>
<section class="section"><div class="wrap sitemap-cols">
 <section><h3>Genel</h3><ul><li><a href="/">Ana Sayfa</a></li><li><a href="/hizmetlerimiz/">Hizmetlerimiz</a></li><li><a href="/calismalarimiz/">Çalışmalarımız</a></li><li><a href="/izmir/">Hizmet Bölgeleri</a></li><li><a href="/iletisim/">İletişim</a></li></ul></section>
 <section><h3>Hizmetler (İzmir geneli)</h3><ul>${services.map((s) => `<li><a href="/izmir/${s.slug}/">${esc(s.name)}</a></li>`).join('')}</ul></section>
 ${districts.map((d) => `<section><h3><a href="/${d.slug}/">${esc(d.name)}</a></h3><ul>${combosOf(d.slug).map((c) => `<li><a href="${comboUrl(d, c.s)}">${esc(d.name)} ${esc(c.s.name)}</a></li>`).join('')}</ul></section>`).join('')}
</div></section>`;
  writePage(url, page({ url, nav: '', crumbs, title: `Site Haritası | ${config.brandName}`, description: 'Site haritası: hizmetler, çalışmalar, iletişim ve İzmir ilçelerine göre metal ve çelik imalat hizmet sayfalarının tam listesi.', body }), { priority: 0.3 });
}

// ================= 404 =================
function build404() {
  const body = `<section class="page-head" style="min-height:50vh;display:flex;align-items:center"><div class="wrap"><span class="eyebrow">Hata 404</span><h1>Aradığınız sayfa bulunamadı</h1><p class="lead">Sayfa taşınmış veya adres hatalı yazılmış olabilir. Aşağıdaki bağlantılardan devam edebilirsiniz.</p><div class="btn-row"><a class="btn btn--wa" href="/">Ana Sayfa</a><a class="btn btn--ghost" href="/hizmetlerimiz/">Hizmetlerimiz</a><a class="btn btn--ghost" href="/sitemap/">Site Haritası</a></div></div></section>`;
  writePage('/404.html', page({ url: '/404.html', nav: '', title: `Sayfa bulunamadı | ${config.brandName}`, description: 'Aradığınız sayfa bulunamadı.', body, noindex: true }));
}

// ---------- Çalıştır ----------
function cleanPrevious() {
  if (!fs.existsSync(MANIFEST)) return;
  const prev = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  for (const rel of prev.files || []) {
    const f = path.join(ROOT, rel);
    if (fs.existsSync(f)) fs.unlinkSync(f);
    // boş kalan klasörleri yukarı doğru sil
    let dir = path.dirname(f);
    while (dir !== ROOT && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) { fs.rmdirSync(dir); dir = path.dirname(dir); }
  }
}

function main() {
  cleanPrevious();
  buildHome(); buildServicesIndex(); buildPortfolio(); buildContact(); buildIzmirHub(); buildHtmlSitemap(); build404();
  services.forEach(buildServicePage);
  districts.forEach(buildDistrict);
  combos.forEach(buildCombo);
  fs.writeFileSync(MANIFEST, JSON.stringify({ generated: new Date().toISOString(), files: written }, null, 0));
  fs.writeFileSync(path.join(ROOT, 'data', 'pages.generated.json'), JSON.stringify(pages, null, 0));
  const idx = pages.filter((p) => !p.noindex).length;
  console.log(`Sayfa: ${written.length} dosya, ${idx} indexlenebilir, ${pages.length - idx} noindex. İlçe+hizmet: ${combos.filter((c) => !c.noindex).length}`);
}
main();
