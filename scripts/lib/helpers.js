'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const load = (f) => require(path.join(ROOT, 'data', f));

const config = load('site-config.json');
const services = load('services.json');
const districts = load('districts.json');
const projects = load('projects.json');
let images = {};
try { images = load('images.generated.json'); } catch (e) { console.warn('images.generated.json yok: önce `npm run images` çalıştırın.'); }

const svcBySlug = Object.fromEntries(services.map((s) => [s.slug, s]));
const distBySlug = Object.fromEntries(districts.map((d) => [d.slug, d]));

// "İzmir geneli" sanal lokasyonu
const IZMIR = { slug: 'izmir', name: 'İzmir', de: "İzmir'de", tags: [], isCity: true };

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const lower = (s) => s.toLocaleLowerCase('tr-TR');
const lowerFirst = (s) => s.charAt(0).toLocaleLowerCase('tr-TR') + s.slice(1);
const abs = (p) => config.siteUrl.replace(/\/$/, '') + p;

const waUrl = (msg) => `https://wa.me/${config.whatsappPhone}?text=${encodeURIComponent(msg)}`;
const waMsg = {
  generic: () => 'Merhaba, İzmir\'de metal ve çelik imalat işim için keşif ve fiyat teklifi almak istiyorum.',
  service: (s, d) => d && !d.isCity
    ? `Merhaba, İzmir ${d.de} ${s.waPhrase} istiyorum. Keşif ve fiyat teklifi alabilir miyim?`
    : `Merhaba, İzmir'de ${s.waPhrase} istiyorum. Keşif ve fiyat teklifi alabilir miyim?`,
  district: (d) => `Merhaba, İzmir ${d.de} metal / çelik imalat işim için keşif ve fiyat teklifi almak istiyorum.`,
  project: (p) => `Merhaba, sitenizdeki "${p.title}" çalışmasına benzer bir iş yaptırmak istiyorum. Keşif ve fiyat teklifi alabilir miyim?`,
};

// Basit deterministik hash: aynı görselin her sayfada tekrarlanmaması için döndürme
const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const rotate = (arr, seed) => { if (!arr.length) return arr; const k = hash(seed) % arr.length; return arr.slice(k).concat(arr.slice(0, k)); };

const projectsFor = (svcSlug) => {
  const prim = projects.filter((p) => p.services[0] === svcSlug);
  const sec = projects.filter((p) => p.services[0] !== svcSlug && p.services.includes(svcSlug));
  return prim.concat(sec);
};

/** Responsive <picture>: AVIF + WebP, width/height, lazy/eager */
function picture(p, { sizes = '(max-width: 760px) 100vw, 33vw', eager = false, alt, cls = '' } = {}) {
  const m = images[p.slug];
  if (!m) return `<img src="/img/${esc(p.src)}" alt="${esc(alt || p.alt)}" loading="lazy">`;
  const v = m.variants;
  const set = (ext) => v.map((x) => `/assets/images/${p.slug}-${x.w}.${ext} ${x.w}w`).join(', ');
  const fallback = v.find((x) => x.w >= 960) || v[v.length - 1];
  return `<picture${cls ? ` class="${cls}"` : ''}><source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">` +
    `<img src="/assets/images/${p.slug}-${fallback.w}.webp" srcset="${set('webp')}" sizes="${sizes}" width="${fallback.w}" height="${fallback.h}" alt="${esc(alt || p.alt)}" ${eager ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"'}></picture>`;
}
const largest = (p) => { const m = images[p.slug]; const v = m ? m.variants[m.variants.length - 1] : null; return v ? `/assets/images/${p.slug}-${v.w}.webp` : `/img/${p.src}`; };
const ogImage = (p) => (images[p.slug] ? `/assets/images/${p.slug}-og.jpg` : config.seo.defaultOgImage);

/**
 * Bir ilçe için hizmet sayfası üretilip üretilmeyeceği (doorway sayfa üretmemek için).
 * districts.json → focus: o ilçede gerçekten anlamlı olan hizmetlerin elle seçilmiş listesi.
 * Ayrıca hizmetin en az bir senaryosu ilçenin özellikleriyle (tags) eşleşmelidir.
 */
function relevance(s, d) {
  if (d.isCity) return { ok: true, scenarios: s.scenarios };
  const scen = s.scenarios.filter((sc) => sc.tags.some((t) => d.tags.includes(t)));
  const inFocus = Array.isArray(d.focus) ? d.focus.includes(s.slug) : s.core;
  if (inFocus && !scen.length) console.warn(`Uyarı: ${d.slug}/${s.slug} odakta ama eşleşen senaryo yok, atlandı.`);
  return { ok: inFocus && scen.length > 0, scenarios: scen };
}

module.exports = { ROOT, config, services, districts, projects, images, svcBySlug, distBySlug, IZMIR, esc, lower, lowerFirst, abs, waUrl, waMsg, hash, rotate, projectsFor, picture, largest, ogImage, relevance };
