#!/usr/bin/env node
/**
 * Tam derleme: CSS/JS küçültme, favicon, sayfa üretimi ve sitemap.
 * Kullanım:  npm install  →  npm run build   (görseller değiştiyse önce: npm run images)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const esbuild = require('esbuild');
const ROOT = path.resolve(__dirname, '..');

(async () => {
  // 1) CSS & JS minify
  await esbuild.build({ entryPoints: [path.join(ROOT, 'assets/css/src/main.css')], outfile: path.join(ROOT, 'assets/css/main.min.css'), minify: true, bundle: false, logLevel: 'warning', target: ['chrome90', 'safari14', 'firefox90'] });
  await esbuild.build({ entryPoints: [path.join(ROOT, 'assets/js/src/main.js')], outfile: path.join(ROOT, 'assets/js/main.min.js'), minify: true, logLevel: 'warning', target: ['es2017'] });

  // 2) Favicon (SVG + 180px PNG)
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="6" fill="#0B0B0B"/><path d="M10 9h20v5h-7.5v12H30v5H10v-5h7.5V14H10z" fill="#C9A44C"/></svg>';
  fs.writeFileSync(path.join(ROOT, 'favicon.svg'), svg);
  try { await require('sharp')(Buffer.from(svg)).resize(180, 180).png().toFile(path.join(ROOT, 'apple-touch-icon.png')); } catch (e) { console.warn('apple-touch-icon üretilemedi:', e.message); }

  // 3) Sayfalar + sitemap
  const env = { ...process.env, ASSET_VERSION: Date.now().toString(36) };
  execFileSync(process.execPath, [path.join(__dirname, 'generate-pages.js')], { stdio: 'inherit', env });
  execFileSync(process.execPath, [path.join(__dirname, 'generate-sitemap.js')], { stdio: 'inherit', env });

  // 4) GitHub Pages yardımcı dosyaları
  const cfg = require(path.join(ROOT, 'data', 'site-config.json'));
  fs.writeFileSync(path.join(ROOT, 'CNAME'), cfg.domain + '\n');
  fs.writeFileSync(path.join(ROOT, '.nojekyll'), '');
  console.log('Derleme tamam.');
})().catch((e) => { console.error(e); process.exit(1); });
