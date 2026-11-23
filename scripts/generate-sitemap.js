#!/usr/bin/env node
/** sitemap.xml ve robots.txt üretir. Yalnızca indexlenebilir (canonical) sayfaları içerir. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const config = require(path.join(ROOT, 'data', 'site-config.json'));
const pages = require(path.join(ROOT, 'data', 'pages.generated.json'));
const base = config.siteUrl.replace(/\/$/, '');
const today = new Date().toISOString().slice(0, 10);
const urls = pages.filter((p) => !p.noindex);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((p) => `  <url><loc>${base}${p.url}</loc><lastmod>${today}</lastmod><priority>${Number(p.priority).toFixed(1)}</priority></url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /scripts/
Disallow: /data/

Sitemap: ${base}/sitemap.xml
`);
console.log(`sitemap.xml: ${urls.length} URL`);
