/**
 * sanitize.js
 * ─────────────────────────────────────────────
 * XSS saldırılarını önlemek için yardımcı fonksiyonlar.
 * Tüm kullanıcı verisi DOM'a yazılmadan önce bu dosyadan geçer.
 * ─────────────────────────────────────────────
 */

const Sanitize = (() => {

  // HTML özel karakterlerini escape et — temel XSS koruması
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#039;');
  }

  // Sayı olduğunu doğrula, değilse 0 döndür
  function safeNumber(val) {
    const n = Number(val);
    return isFinite(n) && n >= 0 ? n : 0;
  }

  // Renk değerinin geçerli hex olduğunu doğrula
  function safeColor(val) {
    if (typeof val !== 'string') return '#000000';
    return /^#[0-9A-Fa-f]{6}$/.test(val) ? val : '#000000';
  }

  // URL'nin güvenli olduğunu doğrula (sadece https)
  function safeUrl(val) {
    if (!val || typeof val !== 'string') return '';
    try {
      const url = new URL(val);
      return url.protocol === 'https:' ? val : '';
    } catch {
      return '';
    }
  }

  // Firestore'dan gelen ürün nesnesini temizle
  function sanitizeProduct(raw) {
    return {
      id:               escapeHtml(raw.id || ''),
      ad:               escapeHtml(raw.ad || ''),
      altKategori:      escapeHtml(raw.altKategori || ''),
      kategoriCinsiyet: ['kadin', 'erkek'].includes(raw.kategoriCinsiyet) ? raw.kategoriCinsiyet : 'kadin',
      durum:            ['aktif', 'pasif'].includes(raw.durum) ? raw.durum : 'aktif',
      fiyat:            safeNumber(raw.fiyat),
      indirimFiyat:     raw.indirimFiyat ? safeNumber(raw.indirimFiyat) : null,
      aciklama:         escapeHtml(raw.aciklama || ''),
      gorselURL:        safeUrl(raw.gorselURL || ''),
      renkler:          Array.isArray(raw.renkler) ? raw.renkler.map(safeColor) : [],
    };
  }

  return { escapeHtml, safeNumber, safeColor, safeUrl, sanitizeProduct };
})();
