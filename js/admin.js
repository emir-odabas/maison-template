/**
 * admin.js
 * ─────────────────────────────────────────────
 * Admin paneli iş mantığı.
 * - Firebase Authentication ile güvenli giriş
 * - Tüm veriler sanitize.js'den geçirilir
 * - DOM manipülasyonu güvenli yöntemlerle yapılır
 * ─────────────────────────────────────────────
 */

(function () {
  // ── Firebase başlat ─────────────────────────────────────────
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  const db = firebase.firestore();
  const storage = firebase.storage();
  const auth = firebase.auth();

  // ── Durum ───────────────────────────────────────────────────
  let tumUrunler = [];
  let filtreliUrunler = [];
  let secilenRenkler = [];
  let secilenGorsel = null;
  let uploadRate = { count: 0, resetAt: Date.now() }; // Basit rate limit

  // ── Site adı ────────────────────────────────────────────────
  const setTextSafe = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = Sanitize.escapeHtml(val);
  };
  setTextSafe('login-site-name', SITE_NAME);
  setTextSafe('sidebar-site-name', SITE_NAME);
  document.title = Sanitize.escapeHtml(SITE_NAME) + ' — Admin';

  // ── Auth durumu izle ────────────────────────────────────────
  auth.onAuthStateChanged(user => {
    document.getElementById('loading-screen').style.display = 'none';
    if (user) {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      setTextSafe('user-email', user.email);
      urunleriYukle();
    } else {
      document.getElementById('app').style.display = 'none';
      document.getElementById('login-screen').style.display = 'flex';
    }
  });
  // ── Auth durumu izle ────────────────────────────────────────
  auth.onAuthStateChanged(user => {
    if (user) {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      setTextSafe('user-email', user.email);
      urunleriYukle();
    } else {
      document.getElementById('app').style.display = 'none';
      document.getElementById('login-screen').style.display = 'flex';
    }
  });

  // ── Giriş ───────────────────────────────────────────────────
  window.girisYap = async function () {
    const emailEl = document.getElementById('login-email');
    const sifreEl = document.getElementById('login-pass');
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');

    const email = emailEl.value.trim();
    const sifre = sifreEl.value;

    errEl.style.display = 'none';

    if (!email || !sifre) {
      errEl.textContent = 'E-posta ve şifre gerekli.';
      errEl.style.display = 'block';
      return;
    }

    // Temel e-posta format kontrolü
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errEl.textContent = 'Geçerli bir e-posta gir.';
      errEl.style.display = 'block';
      return;
    }

    btn.textContent = 'Giriş yapılıyor...';
    btn.disabled = true;

    try {
      await auth.signInWithEmailAndPassword(email, sifre);
      sifreEl.value = ''; // Şifreyi bellekten temizle
    } catch (err) {
      errEl.textContent = 'E-posta veya şifre hatalı.';
      errEl.style.display = 'block';
      btn.textContent = 'Giriş Yap';
      btn.disabled = false;
    }
  };

  // ── Çıkış ───────────────────────────────────────────────────
  window.cikisYap = async function () {
    await auth.signOut();
  };

  // ── Sayfa geçişi ────────────────────────────────────────────
  window.sayfaAc = function (sayfa, link) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    const hedef = document.getElementById('page-' + sayfa);
    if (hedef) hedef.classList.add('active');
    if (link) link.classList.add('active');
    if (sayfa === 'urun-ekle-sayfa') {
      setTextSafe('form-sayfa-baslik', 'Yeni Ürün Ekle');
      formuTemizle();
    }
  };

  // ── Ürünleri yükle ──────────────────────────────────────────
  async function urunleriYukle() {
    try {
      const snap = await db
        .collection('urunler')
        .orderBy('olusturma', 'desc')
        .get();

      tumUrunler = snap.docs.map(doc => Sanitize.sanitizeProduct({ id: doc.id, ...doc.data() }));
      filtreliUrunler = [...tumUrunler];
      tabloYenile();
      istatistikYenile();
    } catch (err) {
      toast('Veriler yüklenemedi.', 'error');
      console.error('[admin] Yükleme hatası:', err.code);
    }
  }

  // ── İstatistikler ────────────────────────────────────────────
  function istatistikYenile() {
    setTextSafe('stat-toplam', String(tumUrunler.length));
    setTextSafe('stat-kadin', String(tumUrunler.filter(u => u.kategoriCinsiyet === 'kadin').length));
    setTextSafe('stat-erkek', String(tumUrunler.filter(u => u.kategoriCinsiyet === 'erkek').length));
    setTextSafe('stat-indirim', String(tumUrunler.filter(u => u.indirimFiyat).length));
    setTextSafe('urun-sayisi-text', tumUrunler.length + ' ürün');
    buildSonUrunlerTablosu();
  }

  // ── DOM oluşturma — textContent ile XSS korumalı ─────────────
  function buildProductRow(u, cols) {
    const tr = document.createElement('tr');

    // Görsel
    const tdImg = document.createElement('td');
    if (u.gorselURL) {
      const img = document.createElement('img');
      img.className = 'td-img';
      img.src = u.gorselURL; // safeUrl ile doğrulandı
      img.alt = u.ad;
      tdImg.appendChild(img);
    } else {
      const div = document.createElement('div');
      div.className = 'td-img-placeholder';
      tdImg.appendChild(div);
    }
    tr.appendChild(tdImg);

    // Ad
    const tdAd = document.createElement('td');
    tdAd.style.fontWeight = '400';
    tdAd.textContent = u.ad;
    tr.appendChild(tdAd);

    if (cols === 'full') {
      // Kategori
      const tdKat = document.createElement('td');
      tdKat.style.cssText = 'color:var(--warm-gray);font-size:12px';
      tdKat.textContent = u.altKategori || '—';
      tr.appendChild(tdKat);
    }

    // Cinsiyet badge
    const tdCins = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'badge badge-' + u.kategoriCinsiyet;
    badge.textContent = u.kategoriCinsiyet === 'kadin' ? 'Kadın' : 'Erkek';
    tdCins.appendChild(badge);
    tr.appendChild(tdCins);

    // Fiyat
    const tdFiyat = document.createElement('td');
    if (u.indirimFiyat) {
      const orig = document.createElement('span');
      orig.className = 'price-original';
      orig.textContent = u.fiyat.toLocaleString('tr-TR') + ' ₺';
      const sale = document.createElement('span');
      sale.className = 'price-sale';
      sale.textContent = u.indirimFiyat.toLocaleString('tr-TR') + ' ₺';
      tdFiyat.appendChild(orig);
      tdFiyat.appendChild(sale);
    } else {
      tdFiyat.textContent = u.fiyat.toLocaleString('tr-TR') + ' ₺';
    }
    tr.appendChild(tdFiyat);

    if (cols === 'full') {
      // Durum
      const tdDurum = document.createElement('td');
      const durumBadge = document.createElement('span');
      durumBadge.className = 'badge badge-' + (u.durum || 'aktif');
      durumBadge.textContent = u.durum === 'pasif' ? 'Pasif' : 'Aktif';
      tdDurum.appendChild(durumBadge);
      tr.appendChild(tdDurum);
    }

    // Aksiyonlar
    const tdActions = document.createElement('td');
    const div = document.createElement('div');
    div.className = 'actions';

    const btnDuzenle = document.createElement('button');
    btnDuzenle.className = 'btn btn-outline btn-sm';
    btnDuzenle.textContent = 'Düzenle';
    btnDuzenle.addEventListener('click', () => duzenle(u.id));

    const btnSil = document.createElement('button');
    btnSil.className = 'btn btn-danger btn-sm';
    btnSil.textContent = 'Sil';
    btnSil.addEventListener('click', () => sil(u.id));

    div.appendChild(btnDuzenle);
    div.appendChild(btnSil);
    tdActions.appendChild(div);
    tr.appendChild(tdActions);

    return tr;
  }

  function buildSonUrunlerTablosu() {
    const tbody = document.getElementById('son-urunler-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const son5 = tumUrunler.slice(0, 5);
    if (!son5.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5; td.className = 'empty-state';
      td.textContent = 'Henüz ürün yok.';
      tr.appendChild(td); tbody.appendChild(tr);
      return;
    }
    son5.forEach(u => tbody.appendChild(buildProductRow(u, 'mini')));
  }

  function tabloYenile() {
    const tbody = document.getElementById('urunler-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!filtreliUrunler.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7; td.className = 'empty-state';
      td.textContent = 'Ürün bulunamadı.';
      tr.appendChild(td); tbody.appendChild(tr);
      return;
    }
    filtreliUrunler.forEach(u => tbody.appendChild(buildProductRow(u, 'full')));
  }

  // ── Ara & Filtrele ──────────────────────────────────────────
  window.urunAra = function (q) {
    const temiz = q.trim().toLowerCase();
    filtreliUrunler = tumUrunler.filter(u => u.ad.toLowerCase().includes(temiz));
    tabloYenile();
  };

  window.filtrele = function (tip) {
    filtreliUrunler = tip === 'hepsi'
      ? [...tumUrunler]
      : tumUrunler.filter(u => u.kategoriCinsiyet === tip);
    tabloYenile();
  };

  // ── Görsel seç & önizle ─────────────────────────────────────
  window.gorselOnizle = function (input) {
    const file = input.files[0];
    if (!file) return;

    // Dosya tipi kontrolü
    const izinliTipler = ['image/jpeg', 'image/png', 'image/webp'];
    if (!izinliTipler.includes(file.type)) {
      toast('Sadece JPG, PNG veya WebP yükleyebilirsin.', 'error');
      input.value = '';
      return;
    }
    // Boyut kontrolü (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast('Dosya 5MB\'dan büyük olamaz.', 'error');
      input.value = '';
      return;
    }

    secilenGorsel = file;
    const reader = new FileReader();
    reader.onload = e => {
      const prev = document.getElementById('upload-preview');
      if (prev) { prev.src = e.target.result; prev.style.display = 'block'; }
      const txt = document.querySelector('.upload-zone-text');
      if (txt) txt.style.display = 'none';
    };
    reader.readAsDataURL(file);
  };

  // ── Renk ────────────────────────────────────────────────────
  window.renkEkle = function () {
    const picker = document.getElementById('renk-picker');
    if (!picker) return;
    const renk = Sanitize.safeColor(picker.value);
    if (!secilenRenkler.includes(renk) && secilenRenkler.length < 10) {
      secilenRenkler.push(renk);
      renkListesiYenile();
    }
  };

  window.renkSil = function (renk) {
    secilenRenkler = secilenRenkler.filter(r => r !== renk);
    renkListesiYenile();
  };

  function renkListesiYenile() {
    const liste = document.getElementById('renkler-list');
    if (!liste) return;
    liste.innerHTML = '';
    secilenRenkler.forEach(r => {
      const div = document.createElement('div');
      div.className = 'renk-item';

      const dot = document.createElement('div');
      dot.className = 'renk-dot';
      dot.style.background = r;

      const txt = document.createElement('span');
      txt.style.cssText = 'font-size:11px;color:var(--warm-gray)';
      txt.textContent = r;

      const btn = document.createElement('button');
      btn.className = 'renk-sil';
      btn.textContent = '×';
      btn.setAttribute('aria-label', 'Rengi kaldır');
      btn.addEventListener('click', () => renkSil(r));

      div.appendChild(dot);
      div.appendChild(txt);
      div.appendChild(btn);
      liste.appendChild(div);
    });
  }

  // ── Ürün kaydet ─────────────────────────────────────────────
  window.urunKaydet = async function () {
    const ad = document.getElementById('form-ad').value.trim();
    const cinsiyet = document.getElementById('form-cinsiyet').value;
    const fiyatRaw = document.getElementById('form-fiyat').value;

    if (!ad || ad.length > 200) { toast('Ürün adı gerekli (max 200 karakter).', 'error'); return; }
    if (!['kadin', 'erkek'].includes(cinsiyet)) { toast('Cinsiyet seç.', 'error'); return; }
    const fiyat = Sanitize.safeNumber(fiyatRaw);
    if (!fiyat) { toast('Geçerli bir fiyat gir.', 'error'); return; }

    // Upload rate limit — 30 saniyede max 10 yükleme
    const simdi = Date.now();
    if (simdi - uploadRate.resetAt > 30000) { uploadRate = { count: 0, resetAt: simdi }; }
    if (uploadRate.count >= 10) { toast('Çok hızlı işlem yapıyorsun. Biraz bekle.', 'error'); return; }
    uploadRate.count++;

    const btn = document.querySelector('[onclick="urunKaydet()"]');
    if (btn) { btn.textContent = 'Kaydediliyor...'; btn.disabled = true; }

    try {
      let gorselURL = '';
      const mevcutId = document.getElementById('form-urun-id').value;

      if (mevcutId) {
        const mevcut = tumUrunler.find(u => u.id === mevcutId);
        gorselURL = mevcut ? mevcut.gorselURL : '';
      }

      if (secilenGorsel) {
        // Dosya adından özel karakter temizle
        const temizAd = secilenGorsel.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const ref = storage.ref(`urunler/${Date.now()}_${temizAd}`);
        const snap = await ref.put(secilenGorsel);
        gorselURL = await snap.ref.getDownloadURL();
      }

      const indirimRaw = document.getElementById('form-indirim-fiyat').value;
      const indirim = indirimRaw ? Sanitize.safeNumber(indirimRaw) : null;

      const veri = {
        ad: ad.slice(0, 200),
        altKategori: document.getElementById('form-alt-kategori').value.trim().slice(0, 100),
        kategoriCinsiyet: cinsiyet,
        fiyat: fiyat,
        indirimFiyat: indirim && indirim < fiyat ? indirim : null,
        aciklama: document.getElementById('form-aciklama').value.trim().slice(0, 1000),
        durum: document.getElementById('form-durum').value === 'pasif' ? 'pasif' : 'aktif',
        renkler: secilenRenkler.slice(0, 10),
        gorselURL: gorselURL,
        guncelleme: firebase.firestore.FieldValue.serverTimestamp(),
      };

      if (mevcutId) {
        await db.collection('urunler').doc(mevcutId).update(veri);
        toast('Ürün güncellendi ✓', 'success');
      } else {
        veri.olusturma = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('urunler').add(veri);
        toast('Ürün eklendi ✓', 'success');
      }

      formuTemizle();
      await urunleriYukle();
      sayfaAc('urunler', document.querySelector('[onclick*="urunler"]'));

    } catch (err) {
      toast('Kayıt hatası. Tekrar dene.', 'error');
      console.error('[admin] Kayıt hatası:', err.code);
    } finally {
      if (btn) { btn.textContent = 'Kaydet'; btn.disabled = false; }
    }
  };

  // ── Düzenle ─────────────────────────────────────────────────
  window.duzenle = function (id) {
    const u = tumUrunler.find(x => x.id === id);
    if (!u) return;

    sayfaAc('urun-ekle-sayfa', document.querySelector('[onclick*="urun-ekle-sayfa"]'));
    setTextSafe('form-sayfa-baslik', 'Ürünü Düzenle');

    document.getElementById('form-urun-id').value = u.id;
    document.getElementById('form-ad').value = u.ad;
    document.getElementById('form-alt-kategori').value = u.altKategori;
    document.getElementById('form-cinsiyet').value = u.kategoriCinsiyet;
    document.getElementById('form-durum').value = u.durum;
    document.getElementById('form-fiyat').value = u.fiyat;
    document.getElementById('form-indirim-fiyat').value = u.indirimFiyat || '';
    document.getElementById('form-aciklama').value = u.aciklama;

    secilenRenkler = [...u.renkler];
    renkListesiYenile();

    if (u.gorselURL) {
      const prev = document.getElementById('upload-preview');
      if (prev) { prev.src = u.gorselURL; prev.style.display = 'block'; }
      const txt = document.querySelector('.upload-zone-text');
      if (txt) txt.style.display = 'none';
    }
    secilenGorsel = null;
  };

  // ── Sil ─────────────────────────────────────────────────────
  window.sil = async function (id) {
    if (!confirm('Bu ürünü kalıcı olarak silmek istediğine emin misin?')) return;
    try {
      await db.collection('urunler').doc(id).delete();
      toast('Ürün silindi.', 'success');
      await urunleriYukle();
    } catch (err) {
      toast('Silinemedi. Tekrar dene.', 'error');
      console.error('[admin] Silme hatası:', err.code);
    }
  };

  // ── Form temizle ─────────────────────────────────────────────
  function formuTemizle() {
    const alanlar = ['form-urun-id', 'form-ad', 'form-alt-kategori',
      'form-fiyat', 'form-indirim-fiyat', 'form-aciklama'];
    alanlar.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const cins = document.getElementById('form-cinsiyet');
    const durum = document.getElementById('form-durum');
    if (cins) cins.value = '';
    if (durum) durum.value = 'aktif';

    secilenRenkler = [];
    secilenGorsel = null;
    renkListesiYenile();

    const prev = document.getElementById('upload-preview');
    if (prev) { prev.style.display = 'none'; prev.src = ''; }
    const txt = document.querySelector('.upload-zone-text');
    if (txt) txt.style.display = 'block';
  }
  window.formuTemizle = formuTemizle;

  // ── Toast bildirimi ─────────────────────────────────────────
  function toast(mesaj, tip = '') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = mesaj; // textContent — XSS yok
    t.className = 'show ' + tip;
    setTimeout(() => { t.className = ''; }, 3500);
  }

})();
