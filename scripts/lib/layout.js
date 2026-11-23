'use strict';
const H = require('./helpers');
const { config, esc, abs, waUrl, waMsg, services, districts } = H;

const ICON = {
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.4.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.4-.3Z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  map: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/></svg>',
};
// Tipografik logo işareti: I-profil (çelik kiriş) kesiti
const LOGO_MARK = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="4" fill="none" stroke="#C9A44C" stroke-width="2"/><path d="M10 9h20v5h-7.5v12H30v5H10v-5h7.5V14H10z" fill="#C9A44C"/></svg>';

const BUSINESS_ID = abs('/#isletme');
function businessNode() {
  const a = config.address;
  const n = {
    '@type': 'LocalBusiness', '@id': BUSINESS_ID, name: config.brandName, url: abs('/'),
    telephone: config.contactPhone, image: abs(config.seo.defaultOgImage),
    address: { '@type': 'PostalAddress', streetAddress: a.streetAddress, addressLocality: a.addressLocality, addressRegion: a.addressRegion, addressCountry: a.addressCountry },
    areaServed: { '@type': 'AdministrativeArea', name: 'İzmir' },
  };
  if (a.postalCode) n.address.postalCode = a.postalCode;
  if (config.email) n.email = config.email;
  if (config.geo) n.geo = { '@type': 'GeoCoordinates', latitude: config.geo.lat, longitude: config.geo.lng };
  if (config.logo) n.logo = abs(config.logo);
  const same = Object.values(config.social || {}).filter(Boolean);
  if (same.length) n.sameAs = same;
  if (config.businessHours) n.openingHours = config.businessHours;
  return n;
}
function breadcrumbNode(url, crumbs) {
  return { '@type': 'BreadcrumbList', '@id': abs(url) + '#breadcrumb', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(c.url) })) };
}

function head(p) {
  const title = esc(p.title);
  const desc = esc(p.description);
  const url = abs(p.url);
  const og = abs(p.ogImage || config.seo.defaultOgImage);
  const robots = p.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large';
  const graph = [businessNode()].concat(p.schema || []);
  graph.push({ '@type': p.pageType || 'WebPage', '@id': url + '#webpage', url, name: p.title, description: p.description, inLanguage: 'tr-TR', isPartOf: { '@id': abs('/#website') }, ...(p.crumbs ? { breadcrumb: { '@id': url + '#breadcrumb' } } : {}), ...(p.primaryImage ? { primaryImageOfPage: { '@type': 'ImageObject', url: abs(p.primaryImage) } } : {}) });
  if (p.crumbs) graph.push(breadcrumbNode(p.url, p.crumbs));
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="${config.seo.themeColor}">
<meta name="author" content="${esc(config.brandName)}">
<meta property="og:type" content="${p.ogType || 'website'}">
<meta property="og:site_name" content="${esc(config.brandName)}">
<meta property="og:locale" content="${config.seo.locale}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${og}">
<script>document.documentElement.className="js"</script>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/barlow-condensed-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
${p.preload || ''}<link rel="stylesheet" href="/assets/css/main.min.css?v=${p.assetVersion}">
<script type="application/ld+json">${ld}</script>
</head>`;
}

const NAV = [
  ['/', 'Ana Sayfa'], ['/hizmetlerimiz/', 'Hizmetlerimiz'], ['/calismalarimiz/', 'Çalışmalarımız'], ['/izmir/', 'Hizmet Bölgeleri'], ['/iletisim/', 'İletişim'],
];
function header(current, wa) {
  return `<body>
<a class="skip" href="#icerik">İçeriğe geç</a>
<header class="header">
 <div class="wrap">
  <a class="logo" href="/" aria-label="${esc(config.brandName)} ana sayfa">${LOGO_MARK}<span><i>${esc(config.logoTop)}</i><b>${esc(config.logoMain)}</b><small>${esc(config.logoSub)}</small></span></a>
  <button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Menüyü aç/kapat">${ICON.menu}</button>
  <nav class="nav" id="site-nav" aria-label="Ana menü">
   ${NAV.map(([u, t]) => `<a href="${u}"${u === current ? ' aria-current="page"' : ''}>${t}</a>`).join('')}
   <a class="btn btn--wa btn--sm nav-cta" href="${esc(wa)}" rel="noopener" target="_blank">${ICON.wa}WhatsApp</a>
  </nav>
 </div>
</header>
<main id="icerik">`;
}

const FOOTER_SERVICES = ['demir-dograma', 'ferforje', 'celik-cati', 'celik-konstruksiyon', 'celik-yapi', 'korkuluk', 'sundurma-pergola', 'bahce-kapisi'];
const FOOTER_DISTRICTS = ['aliaga', 'karsiyaka', 'bornova', 'buca', 'cigli', 'menemen', 'urla', 'cesme', 'torbali'];

function footer(wa, assetVersion) {
  const sv = FOOTER_SERVICES.map((s) => H.svcBySlug[s]).filter(Boolean);
  const ds = FOOTER_DISTRICTS.map((d) => H.distBySlug[d]).filter(Boolean);
  const year = new Date().getFullYear();
  return `</main>
<footer class="footer">
 <div class="wrap">
  <div class="footer-grid">
   <div>
    <a class="logo" href="/" aria-label="${esc(config.brandName)}">${LOGO_MARK}<span><i>${esc(config.logoTop)}</i><b>${esc(config.logoMain)}</b><small>${esc(config.logoSub)}</small></span></a>
    <p style="margin-top:16px">İzmir genelinde demir doğrama, ferforje, çelik çatı ve çelik konstrüksiyon işlerinde keşif, ölçülendirme ve projeye özel imalat.</p>
    <a class="btn btn--wa btn--sm" href="${esc(wa)}" rel="noopener" target="_blank">${ICON.wa}WhatsApp'tan Teklif Al</a>
   </div>
   <div><h2>Hizmetler</h2><ul>${sv.map((s) => `<li><a href="/izmir/${s.slug}/">${esc(s.name)}</a></li>`).join('')}<li><a href="/hizmetlerimiz/">Tüm hizmetler →</a></li></ul></div>
   <div><h2>Hizmet Bölgeleri</h2><ul>${ds.map((d) => `<li><a href="/${d.slug}/">${esc(d.name)}</a></li>`).join('')}<li><a href="/izmir/">Tüm ilçeler →</a></li></ul></div>
   <div><h2>İletişim</h2><ul>
    <li><a href="tel:${config.contactPhone}">${esc(config.contactPhoneDisplay)}</a></li>
    <li><a href="${esc(wa)}" rel="noopener" target="_blank">WhatsApp</a></li>
    ${config.email ? `<li><a href="mailto:${esc(config.email)}">${esc(config.email)}</a></li>` : ''}
    <li><span class="muted">${esc(config.address.display)}</span></li>
    <li><a href="/iletisim/">İletişim sayfası →</a></li>
   </ul></div>
  </div>
  <div class="footer-bottom"><span>© ${year} ${esc(config.brandName)}</span><span><a href="/sitemap/">Site Haritası</a> · <a href="/calismalarimiz/">Çalışmalarımız</a></span></div>
 </div>
</footer>
<div class="mobile-bar" role="region" aria-label="Hızlı iletişim">
 <a class="call" href="tel:${config.contactPhone}">${ICON.phone}Telefon Et</a>
 <a class="wa" href="${esc(wa)}" rel="noopener" target="_blank">${ICON.wa}WhatsApp'tan Teklif Al</a>
</div>
<script src="/assets/js/main.min.js?v=${assetVersion}" defer></script>
</body>
</html>
`;
}

function crumbsHtml(crumbs) {
  return `<nav class="crumbs" aria-label="Sayfa konumu"><ol>${crumbs.map((c, i) => i === crumbs.length - 1 ? `<li aria-current="page">${esc(c.name)}</li>` : `<li><a href="${c.url}">${esc(c.name)}</a></li>`).join('')}</ol></nav>`;
}

function faqHtml(list) {
  return `<div class="faq">${list.map((f) => `<details><summary>${esc(f.q)}</summary><div><p>${esc(f.a)}</p></div></details>`).join('')}</div>`;
}
function faqSchema(list, url) {
  if (!config.seo.enableFaqSchema || !list.length) return [];
  return [{ '@type': 'FAQPage', '@id': abs(url) + '#faq', mainEntity: list.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }];
}

function ctaBand(title, text, wa, extra = '') {
  return `<section class="cta-band"><div class="wrap"><div><h2>${title}</h2><p>${text}</p></div><div class="btn-row"><a class="btn btn--wa" href="${esc(wa)}" rel="noopener" target="_blank">${ICON.wa}WhatsApp'tan Teklif Al</a>${extra}<a class="btn btn--ghost" href="tel:${config.contactPhone}">${ICON.phone}${esc(config.contactPhoneDisplay)}</a></div></div></section>`;
}

const PROCESS = [
  ['İletişim', 'WhatsApp veya telefonla işinizi kısaca anlatın; varsa fotoğraf ve yaklaşık ölçüleri paylaşın.'],
  ['Keşif ve ölçü', 'Gerekli işlerde yerinde keşif yapılır, kesin ölçüler alınır ve saha koşulları incelenir.'],
  ['Projeye özel teklif', 'Malzeme, yüzey koruma ve montaj kapsamı netleştirilerek teklif hazırlanır.'],
  ['İmalat', 'Onay sonrası parçalar ölçüye göre kesilir, kaynaklanır, temizlenir ve boyanır.'],
  ['Montaj ve teslim', 'Sahada montaj yapılır, son kontroller tamamlanarak iş teslim edilir.'],
];
const processHtml = () => `<ol class="steps">${PROCESS.map(([t, p]) => `<li><h3>${t}</h3><p>${p}</p></li>`).join('')}</ol>`;

module.exports = { ICON, head, header, footer, crumbsHtml, faqHtml, faqSchema, ctaBand, processHtml, BUSINESS_ID, LOGO_MARK, waUrl, waMsg };
