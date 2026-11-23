/* Site geneli küçük etkileşimler — bağımlılık yok */
(function () {
  'use strict';
  var d = document;

  // Yerelde dosyadan açıldığında (file://) klasör bağlantılarını index.html'e yönlendir
  if (location.protocol === 'file:') {
    d.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (/^(https?:|mailto:|tel:|#)/.test(h)) return;
      var m = h.match(/^([^#?]*\/)([#?].*)?$/);
      if (m) a.setAttribute('href', m[1] + 'index.html' + (m[2] || ''));
    });
  }

  // Mobil menü
  var btn = d.querySelector('.menu-btn');
  var nav = d.getElementById('site-nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus();
      }
    });
  }

  // Görünür olunca hafif giriş animasyonu
  var rev = d.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && rev.length) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -40px 0px' });
    rev.forEach(function (el) { io.observe(el); });
  } else { rev.forEach(function (el) { el.classList.add('in'); }); }

  // Galeri filtresi
  var filters = d.querySelector('[data-filters]');
  var gallery = d.querySelector('[data-gallery]');
  if (filters && gallery) {
    var items = gallery.querySelectorAll('figure');
    filters.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var f = b.getAttribute('data-filter');
      filters.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      items.forEach(function (it) {
        it.hidden = !(f === 'all' || (' ' + it.getAttribute('data-services') + ' ').indexOf(' ' + f + ' ') > -1);
      });
      if (history.replaceState) history.replaceState(null, '', f === 'all' ? location.pathname : '#' + f);
    });
    var h = location.hash.slice(1);
    if (h) { var pre = filters.querySelector('[data-filter="' + h + '"]'); if (pre) pre.click(); }
  }

  // Lightbox
  var zooms = d.querySelectorAll('[data-zoom]');
  if (zooms.length) {
    var lb = d.createElement('div');
    lb.className = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Görsel önizleme');
    lb.innerHTML = '<figure><img alt=""><figcaption></figcaption></figure>' +
      '<button class="lb-close" aria-label="Kapat">×</button><button class="lb-prev" aria-label="Önceki">‹</button><button class="lb-next" aria-label="Sonraki">›</button>';
    d.body.appendChild(lb);
    var img = lb.querySelector('img'), cap = lb.querySelector('figcaption'), idx = 0, last = null;
    var visible = function () { return Array.prototype.filter.call(zooms, function (z) { return !z.closest('figure[hidden]'); }); };
    var show = function (i) {
      var list = visible(); if (!list.length) return;
      idx = (i + list.length) % list.length;
      var z = list[idx];
      img.src = z.getAttribute('data-zoom'); img.alt = z.getAttribute('data-alt') || '';
      cap.textContent = z.getAttribute('data-alt') || '';
    };
    var close = function () { lb.classList.remove('open'); img.removeAttribute('src'); d.body.style.overflow = ''; if (last) last.focus(); };
    zooms.forEach(function (z) {
      z.addEventListener('click', function () { last = z; show(visible().indexOf(z)); lb.classList.add('open'); d.body.style.overflow = 'hidden'; lb.querySelector('.lb-close').focus(); });
    });
    lb.addEventListener('click', function (e) {
      if (e.target.classList.contains('lb-close') || e.target === lb) close();
      else if (e.target.classList.contains('lb-prev')) show(idx - 1);
      else if (e.target.classList.contains('lb-next')) show(idx + 1);
    });
    d.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') show(idx - 1); else if (e.key === 'ArrowRight') show(idx + 1);
    });
  }

  // Keşif formu → önceden doldurulmuş WhatsApp mesajı
  var form = d.querySelector('[data-wa-form]');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (n) { var el = form.elements[n]; return el ? String(el.value || '').trim() : ''; };
      var svc = v('hizmet'), dist = v('ilce'), desc = v('aciklama'), size = v('olcu'), name = v('ad');
      var place = dist === 'İzmir geneli' || !dist ? 'İzmir' : 'İzmir ' + dist;
      var msg = 'Merhaba, ' + place + ' bölgesinde ' + (svc || 'metal imalat') + ' hizmeti almak istiyorum. Projem hakkında keşif ve fiyat teklifi rica ediyorum.';
      if (desc) msg += '\n\nYapılacak iş: ' + desc;
      if (size) msg += '\nÖlçü / proje bilgisi: ' + size;
      if (name) msg += '\nAd: ' + name;
      var url = 'https://wa.me/' + form.getAttribute('data-phone') + '?text=' + encodeURIComponent(msg);
      location.href = url;
    });
  }

  // Harita: tıklayınca yüklenir (performans ve gizlilik için)
  var map = d.querySelector('[data-map]');
  if (map) {
    map.querySelector('button').addEventListener('click', function () {
      var f = d.createElement('iframe');
      f.src = map.getAttribute('data-map'); f.title = 'İşletme konumu haritası'; f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      map.innerHTML = ''; map.appendChild(f);
    });
  }
})();
