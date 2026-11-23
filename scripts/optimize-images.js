#!/usr/bin/env node
/**
 * img/ klasöründeki orijinal fotoğrafları data/projects.json'a göre
 * SEO uyumlu isimlerle AVIF + WebP (responsive) ve paylaşım için JPG'ye dönüştürür.
 * Çıktı: assets/images/  ve  data/images.generated.json
 * Gereksinim (yalnızca geliştirme): npm install  (sharp)
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'img');
const OUT = path.join(ROOT, 'assets', 'images');
const WIDTHS = [480, 960, 1600];
const projects = require(path.join(ROOT, 'data', 'projects.json'));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = {};
  for (const p of projects) {
    const input = path.join(SRC, p.src);
    if (!fs.existsSync(input)) { console.warn('Eksik görsel:', p.src); continue; }
    let base = sharp(input).rotate();
    if (p.crop) {
      const [x0, y0, x1, y1] = p.crop;
      base = base.extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 });
    }
    const buf = await base.toBuffer();
    const meta = await sharp(buf).metadata();
    const widths = WIDTHS.filter(w => w < meta.width);
    if (!widths.length || meta.width <= 1600) widths.push(meta.width);
    const uniq = [...new Set(widths)].sort((a, b) => a - b).slice(0, 3);
    const variants = [];
    for (const w of uniq) {
      const h = Math.round(meta.height * w / meta.width);
      const r = sharp(buf).resize(w);
      await r.clone().webp({ quality: 74, effort: 5 }).toFile(path.join(OUT, `${p.slug}-${w}.webp`));
      await r.clone().avif({ quality: 50, effort: 4 }).toFile(path.join(OUT, `${p.slug}-${w}.avif`));
      variants.push({ w, h });
    }
    // Paylaşım (Open Graph) görseli: 1200x630 JPG
    await sharp(buf).resize(1200, 630, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(OUT, `${p.slug}-og.jpg`));
    manifest[p.slug] = { width: meta.width, height: meta.height, variants };
    process.stdout.write('.');
  }
  fs.writeFileSync(path.join(ROOT, 'data', 'images.generated.json'), JSON.stringify(manifest, null, 1));
  console.log('\nTamam:', Object.keys(manifest).length, 'görsel');
})().catch(e => { console.error(e); process.exit(1); });
