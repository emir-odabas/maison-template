/**
 * products.js
 * ─────────────────────────────────────────────
 * Firebase Firestore'dan ürünleri çeker,
 * sanitize ederek güvenli şekilde DOM'a yazar.
 * ─────────────────────────────────────────────
 */

(function () {
  // Firebase başlat (çift init önlemi)
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  const db = firebase.firestore();

  // ── Ürünleri yükle ────────────────────────────────────────
  async function loadProducts() {
    const kadinGrid = document.getElementById('kadin-grid');
    const erkekGrid = document.getElementById('erkek-grid');
    if (!kadinGrid || !erkekGrid) return;

    setLoading(kadinGrid);
    setLoading(erkekGrid);

    try {
      const snapshot = await db
        .collection('urunler')

        .orderBy('olusturma', 'desc')
        .get();

      const kadinler = [];
      const erkekler = [];

      snapshot.forEach(doc => {
        const raw = { id: doc.id, ...doc.data() };
        const urun = Sanitize.sanitizeProduct(raw);
        if (urun.kategoriCinsiyet === 'kadin') kadinler.push(urun);
        else erkekler.push(urun);
      });

      kadinGrid.innerHTML = kadinler.length
        ? kadinler.map(buildProductCard).join('')
        : buildEmptyState('Kadın koleksiyonu yakında ekleniyor.');

      erkekGrid.innerHTML = erkekler.length
        ? erkekler.map(buildProductCard).join('')
        : buildEmptyState('Erkek koleksiyonu yakında ekleniyor.');

    } catch (err) {
      console.error('[products] Yükleme hatası:', err.code);
      const msg = buildEmptyState('Ürünler yüklenemedi. Lütfen sayfayı yenileyin.');
      kadinGrid.innerHTML = msg;
      erkekGrid.innerHTML = msg;
    }
  }

  // ── Kart HTML'i (sanitize edilmiş verilerle) ──────────────
  function buildProductCard(u) {
    const gorselHTML = u.gorselURL
      ? `<img src="${u.gorselURL}" alt="${u.ad}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;">`
      : `<div style="width:100%;height:100%;background:linear-gradient(145deg,#E8E2D9,#C9C0B2);"></div>`;

    const fiyatHTML = u.indirimFiyat
      ? `<span class="original">${u.fiyat.toLocaleString('tr-TR')} ₺</span>
         <span class="sale">${u.indirimFiyat.toLocaleString('tr-TR')} ₺</span>`
      : `${u.fiyat.toLocaleString('tr-TR')} ₺`;

    const renkleriHTML = u.renkler.length
      ? `<div class="product-color-swatch">${u.renkler.map(r =>
          `<div class="swatch" style="background:${r}" aria-label="${r}"></div>`
        ).join('')}</div>`
      : '';

    return `
      <div class="product-card" role="article">
        <div class="product-image">
          ${gorselHTML}
          <button class="product-wishlist" aria-label="Favorilere ekle">♡</button>
          ${renkleriHTML}
        </div>
        <div class="product-info">
          <p class="product-category">${u.altKategori}</p>
          <p class="product-name">${u.ad}</p>
          <p class="product-price">${fiyatHTML}</p>
        </div>
      </div>`;
  }

  function setLoading(el) {
    el.innerHTML = `<div style="grid-column:span 4;padding:40px;color:var(--warm-gray);font-size:13px;text-align:center;">Yükleniyor...</div>`;
  }

  function buildEmptyState(msg) {
    return `<div style="grid-column:span 4;padding:40px;color:var(--warm-gray);font-size:13px;text-align:center;">${Sanitize.escapeHtml(msg)}</div>`;
  }

  document.addEventListener('DOMContentLoaded', loadProducts);
})();
