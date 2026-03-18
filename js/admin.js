/**
 * admin.js — v2
 * Session bazlı auth + Sipariş Sistemi + Gelişmiş İstatistikler
 */

(function () {
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  const db      = firebase.firestore();
  const storage = firebase.storage();
  const auth    = firebase.auth();

  // Session bazlı — tarayıcı kapanınca oturum kapanır
  auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);

  // ── State ─────────────────────────────────────────────────────
  let tumUrunler      = [];
  let filtreliUrunler = [];
  let tumSiparisler   = [];
  let secilenRenkler  = [];
  let secilenGorsel   = null;
  let uploadRate      = { count: 0, resetAt: Date.now() };

  // ── Site adı ─────────────────────────────────────────────────
  const setTextSafe = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = Sanitize.escapeHtml(String(val));
  };
  setTextSafe('login-site-name',  SITE_NAME);
  setTextSafe('sidebar-site-name', SITE_NAME);
  document.title = Sanitize.escapeHtml(SITE_NAME) + ' — Admin';

  // ── Auth ─────────────────────────────────────────────────────
  auth.onAuthStateChanged(user => {
    document.getElementById('loading-screen').style.display = 'none';
    if (user) {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').style.display          = 'block';
      setTextSafe('user-email', user.email);
      urunleriYukle();
      siparisleriYukle();
    } else {
      document.getElementById('app').style.display          = 'none';
      document.getElementById('login-screen').style.display = 'flex';
    }
  });

  window.girisYap = async function () {
    const email = document.getElementById('login-email').value.trim();
    const sifre = document.getElementById('login-pass').value;
    const btn   = document.getElementById('login-btn');
    const err   = document.getElementById('login-error');
    err.style.display = 'none';
    if (!email || !sifre) { err.textContent = 'E-posta ve şifre gerekli.'; err.style.display = 'block'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Geçerli bir e-posta gir.'; err.style.display = 'block'; return; }
    btn.textContent = 'Giriş yapılıyor...'; btn.disabled = true;
    try {
      await auth.signInWithEmailAndPassword(email, sifre);
      document.getElementById('login-pass').value = '';
    } catch {
      err.textContent = 'E-posta veya şifre hatalı.'; err.style.display = 'block';
      btn.textContent = 'Giriş Yap'; btn.disabled = false;
    }
  };

  window.cikisYap = async function () { await auth.signOut(); };

  // ── Sayfa geçişi ─────────────────────────────────────────────
  window.sayfaAc = function (sayfa, link) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    const hedef = document.getElementById('page-' + sayfa);
    if (hedef) hedef.classList.add('active');
    if (link)  link.classList.add('active');
    if (sayfa === 'urun-ekle-sayfa') { setTextSafe('form-sayfa-baslik', 'Yeni Ürün Ekle'); formuTemizle(); }
    if (sayfa === 'siparis-ekle')    { setTextSafe('siparis-form-baslik', 'Yeni Sipariş'); siparisFormuTemizle(); }
    if (sayfa === 'dashboard')       { dashboardYenile(); }
  };

  // ══════════════════════════════════════════════════════════════
  // ÜRÜN YÖNETİMİ
  // ══════════════════════════════════════════════════════════════
  async function urunleriYukle() {
    try {
      const snap = await db.collection('urunler').orderBy('olusturma', 'desc').get();
      tumUrunler = snap.docs.map(d => Sanitize.sanitizeProduct({ id: d.id, ...d.data() }));
      filtreliUrunler = [...tumUrunler];
      tabloYenile();
      dashboardYenile();
    } catch (e) { toast('Ürünler yüklenemedi.', 'error'); }
  }

  function buildProductRow(u, cols) {
    const tr = document.createElement('tr');
    const tdImg = document.createElement('td');
    if (u.gorselURL) {
      const img = document.createElement('img'); img.className = 'td-img'; img.src = u.gorselURL; img.alt = u.ad; tdImg.appendChild(img);
    } else { const div = document.createElement('div'); div.className = 'td-img-placeholder'; tdImg.appendChild(div); }
    tr.appendChild(tdImg);
    const tdAd = document.createElement('td'); tdAd.style.fontWeight = '400'; tdAd.textContent = u.ad; tr.appendChild(tdAd);
    if (cols === 'full') {
      const tdKat = document.createElement('td'); tdKat.style.cssText = 'color:var(--warm-gray);font-size:12px'; tdKat.textContent = u.altKategori || '—'; tr.appendChild(tdKat);
    }
    const tdCins = document.createElement('td');
    const badge = document.createElement('span'); badge.className = 'badge badge-' + u.kategoriCinsiyet; badge.textContent = u.kategoriCinsiyet === 'kadin' ? 'Kadın' : 'Erkek'; tdCins.appendChild(badge); tr.appendChild(tdCins);
    const tdFiyat = document.createElement('td');
    if (u.indirimFiyat) {
      const o = document.createElement('span'); o.className = 'price-original'; o.textContent = u.fiyat.toLocaleString('tr-TR') + ' ₺'; tdFiyat.appendChild(o);
      const s = document.createElement('span'); s.className = 'price-sale'; s.textContent = u.indirimFiyat.toLocaleString('tr-TR') + ' ₺'; tdFiyat.appendChild(s);
    } else { tdFiyat.textContent = u.fiyat.toLocaleString('tr-TR') + ' ₺'; }
    tr.appendChild(tdFiyat);
    if (cols === 'full') {
      const tdD = document.createElement('td'); const db2 = document.createElement('span'); db2.className = 'badge badge-' + (u.durum || 'aktif'); db2.textContent = u.durum === 'pasif' ? 'Pasif' : 'Aktif'; tdD.appendChild(db2); tr.appendChild(tdD);
    }
    const tdAct = document.createElement('td'); const div = document.createElement('div'); div.className = 'actions';
    const bD = document.createElement('button'); bD.className = 'btn btn-outline btn-sm'; bD.textContent = 'Düzenle'; bD.addEventListener('click', () => duzenle(u.id));
    const bS = document.createElement('button'); bS.className = 'btn btn-danger btn-sm'; bS.textContent = 'Sil'; bS.addEventListener('click', () => urunSil(u.id));
    div.appendChild(bD); div.appendChild(bS); tdAct.appendChild(div); tr.appendChild(tdAct);
    return tr;
  }

  function tabloYenile() {
    const tbody = document.getElementById('urunler-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!filtreliUrunler.length) {
      const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 7; td.className = 'empty-state'; td.textContent = 'Ürün bulunamadı.'; tr.appendChild(td); tbody.appendChild(tr); return;
    }
    filtreliUrunler.forEach(u => tbody.appendChild(buildProductRow(u, 'full')));
  }

  window.urunAra = function (q) { filtreliUrunler = tumUrunler.filter(u => u.ad.toLowerCase().includes(q.trim().toLowerCase())); tabloYenile(); };
  window.filtrele = function (tip) { filtreliUrunler = tip === 'hepsi' ? [...tumUrunler] : tumUrunler.filter(u => u.kategoriCinsiyet === tip); tabloYenile(); };

  window.gorselOnizle = function (input) {
    const file = input.files[0]; if (!file) return;
    const izinli = ['image/jpeg','image/png','image/webp'];
    if (!izinli.includes(file.type)) { toast('Sadece JPG, PNG veya WebP.', 'error'); input.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { toast('Max 5MB.', 'error'); input.value = ''; return; }
    secilenGorsel = file;
    const r = new FileReader(); r.onload = e => { const p = document.getElementById('upload-preview'); if(p){p.src=e.target.result;p.style.display='block';} const t=document.querySelector('.upload-zone-text'); if(t)t.style.display='none'; }; r.readAsDataURL(file);
  };

  window.renkEkle = function () { const r = Sanitize.safeColor(document.getElementById('renk-picker').value); if (!secilenRenkler.includes(r) && secilenRenkler.length < 10) { secilenRenkler.push(r); renkListesiYenile(); } };
  window.renkSil  = function (r) { secilenRenkler = secilenRenkler.filter(x => x !== r); renkListesiYenile(); };
  function renkListesiYenile() {
    const liste = document.getElementById('renkler-list'); if (!liste) return; liste.innerHTML = '';
    secilenRenkler.forEach(r => {
      const d=document.createElement('div'); d.className='renk-item';
      const dot=document.createElement('div'); dot.className='renk-dot'; dot.style.background=r;
      const txt=document.createElement('span'); txt.style.cssText='font-size:11px;color:var(--warm-gray)'; txt.textContent=r;
      const btn=document.createElement('button'); btn.className='renk-sil'; btn.textContent='×'; btn.addEventListener('click',()=>renkSil(r));
      d.appendChild(dot); d.appendChild(txt); d.appendChild(btn); liste.appendChild(d);
    });
  }

  window.urunKaydet = async function () {
    const ad = document.getElementById('form-ad').value.trim();
    const cinsiyet = document.getElementById('form-cinsiyet').value;
    const fiyat = Sanitize.safeNumber(document.getElementById('form-fiyat').value);
    if (!ad || ad.length > 200) { toast('Ürün adı gerekli.', 'error'); return; }
    if (!['kadin','erkek'].includes(cinsiyet)) { toast('Cinsiyet seç.', 'error'); return; }
    if (!fiyat) { toast('Geçerli fiyat gir.', 'error'); return; }
    const simdi = Date.now();
    if (simdi - uploadRate.resetAt > 30000) uploadRate = { count: 0, resetAt: simdi };
    if (uploadRate.count >= 10) { toast('Çok hızlı. Bekle.', 'error'); return; }
    uploadRate.count++;
    const btn = document.querySelector('[onclick="urunKaydet()"]');
    if (btn) { btn.textContent = 'Kaydediliyor...'; btn.disabled = true; }
    try {
      let gorselURL = '';
      const mevcutId = document.getElementById('form-urun-id').value;
      if (mevcutId) gorselURL = (tumUrunler.find(u => u.id === mevcutId) || {}).gorselURL || '';
      if (secilenGorsel) {
        const temizAd = secilenGorsel.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const ref = storage.ref(`urunler/${Date.now()}_${temizAd}`);
        const snap = await ref.put(secilenGorsel);
        gorselURL = await snap.ref.getDownloadURL();
      }
      const indirimRaw = document.getElementById('form-indirim-fiyat').value;
      const indirim = indirimRaw ? Sanitize.safeNumber(indirimRaw) : null;
      const veri = {
        ad: ad.slice(0,200), altKategori: document.getElementById('form-alt-kategori').value.trim().slice(0,100),
        kategoriCinsiyet: cinsiyet, fiyat, indirimFiyat: indirim && indirim < fiyat ? indirim : null,
        aciklama: document.getElementById('form-aciklama').value.trim().slice(0,1000),
        durum: document.getElementById('form-durum').value === 'pasif' ? 'pasif' : 'aktif',
        renkler: secilenRenkler.slice(0,10), gorselURL,
        guncelleme: firebase.firestore.FieldValue.serverTimestamp(),
      };
      if (mevcutId) { await db.collection('urunler').doc(mevcutId).update(veri); toast('Ürün güncellendi ✓', 'success'); }
      else { veri.olusturma = firebase.firestore.FieldValue.serverTimestamp(); await db.collection('urunler').add(veri); toast('Ürün eklendi ✓', 'success'); }
      formuTemizle(); await urunleriYukle();
      sayfaAc('urunler', document.querySelector('[onclick*="urunler"]'));
    } catch (e) { toast('Kayıt hatası.', 'error'); console.error(e.code); }
    finally { if (btn) { btn.textContent = 'Kaydet'; btn.disabled = false; } }
  };

  window.duzenle = function (id) {
    const u = tumUrunler.find(x => x.id === id); if (!u) return;
    sayfaAc('urun-ekle-sayfa', document.querySelector('[onclick*="urun-ekle-sayfa"]'));
    setTextSafe('form-sayfa-baslik', 'Ürünü Düzenle');
    document.getElementById('form-urun-id').value         = u.id;
    document.getElementById('form-ad').value              = u.ad;
    document.getElementById('form-alt-kategori').value    = u.altKategori;
    document.getElementById('form-cinsiyet').value        = u.kategoriCinsiyet;
    document.getElementById('form-durum').value           = u.durum;
    document.getElementById('form-fiyat').value           = u.fiyat;
    document.getElementById('form-indirim-fiyat').value   = u.indirimFiyat || '';
    document.getElementById('form-aciklama').value        = u.aciklama;
    secilenRenkler = [...u.renkler]; renkListesiYenile();
    if (u.gorselURL) { const p = document.getElementById('upload-preview'); if(p){p.src=u.gorselURL;p.style.display='block';} const t=document.querySelector('.upload-zone-text'); if(t)t.style.display='none'; }
    secilenGorsel = null;
  };

  window.urunSil = async function (id) {
    if (!confirm('Bu ürünü kalıcı olarak silmek istediğine emin misin?')) return;
    try { await db.collection('urunler').doc(id).delete(); toast('Ürün silindi.', 'success'); await urunleriYukle(); }
    catch (e) { toast('Silinemedi.', 'error'); }
  };

  function formuTemizle() {
    ['form-urun-id','form-ad','form-alt-kategori','form-fiyat','form-indirim-fiyat','form-aciklama'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
    const c = document.getElementById('form-cinsiyet'); if(c) c.value='';
    const d = document.getElementById('form-durum'); if(d) d.value='aktif';
    secilenRenkler=[]; secilenGorsel=null; renkListesiYenile();
    const p = document.getElementById('upload-preview'); if(p){p.style.display='none';p.src='';}
    const t = document.querySelector('.upload-zone-text'); if(t)t.style.display='block';
  }
  window.formuTemizle = formuTemizle;

  // ══════════════════════════════════════════════════════════════
  // SİPARİŞ SİSTEMİ
  // ══════════════════════════════════════════════════════════════
  async function siparisleriYukle() {
    try {
      const snap = await db.collection('siparisler').orderBy('tarih', 'desc').get();
      tumSiparisler = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      siparisTabloyenile();
      dashboardYenile();
    } catch (e) { console.error('[siparis] yükleme hatası:', e.code); }
  }

  function siparisTabloyenile() {
    const tbody = document.getElementById('siparisler-tbody'); if (!tbody) return;
    tbody.innerHTML = '';
    if (!tumSiparisler.length) {
      const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 7; td.className = 'empty-state'; td.textContent = 'Henüz sipariş yok.'; tr.appendChild(td); tbody.appendChild(tr); return;
    }
    tumSiparisler.forEach(s => {
      const tr = document.createElement('tr');
      const tarih = s.tarih?.toDate ? s.tarih.toDate().toLocaleDateString('tr-TR') : '—';
      const durumRenk = { 'beklemede': 'badge-beklemede', 'teslim edildi': 'badge-aktif', 'iptal': 'badge-pasif' }[s.durum] || 'badge-beklemede';

      [
        s.siparisNo || '—',
        s.musteriAd || '—',
        s.urunAd || '—',
        s.adet ? String(s.adet) : '1',
        s.tutar ? s.tutar.toLocaleString('tr-TR') + ' ₺' : '—',
        '', // durum badge
        '', // aksiyonlar
      ].forEach((val, i) => {
        const td = document.createElement('td');
        if (i === 5) {
          const badge = document.createElement('span'); badge.className = 'badge ' + durumRenk;
          badge.textContent = s.durum || 'beklemede'; td.appendChild(badge);
        } else if (i === 6) {
          const div = document.createElement('div'); div.className = 'actions';
          const btnD = document.createElement('button'); btnD.className = 'btn btn-outline btn-sm'; btnD.textContent = 'Düzenle'; btnD.addEventListener('click', () => siparisDuzenle(s.id));
          const btnS = document.createElement('button'); btnS.className = 'btn btn-danger btn-sm'; btnS.textContent = 'Sil'; btnS.addEventListener('click', () => siparisSil(s.id));
          div.appendChild(btnD); div.appendChild(btnS); td.appendChild(div);
        } else { td.textContent = val; }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  window.siparisKaydet = async function () {
    const musteriAd = document.getElementById('sp-musteri').value.trim();
    const urunAd    = document.getElementById('sp-urun').value.trim();
    const tutar     = Sanitize.safeNumber(document.getElementById('sp-tutar').value);
    const adet      = Sanitize.safeNumber(document.getElementById('sp-adet').value) || 1;
    const durum     = document.getElementById('sp-durum').value;
    const not       = document.getElementById('sp-not').value.trim();

    if (!musteriAd) { toast('Müşteri adı gerekli.', 'error'); return; }
    if (!urunAd)    { toast('Ürün adı gerekli.', 'error'); return; }
    if (!tutar)     { toast('Tutar gerekli.', 'error'); return; }

    const btn = document.querySelector('[onclick="siparisKaydet()"]');
    if (btn) { btn.textContent = 'Kaydediliyor...'; btn.disabled = true; }

    try {
      const mevcutId = document.getElementById('sp-id').value;
      const siparisNo = mevcutId
        ? (tumSiparisler.find(s => s.id === mevcutId) || {}).siparisNo
        : 'SP' + Date.now().toString().slice(-6);

      const veri = {
        siparisNo, musteriAd: musteriAd.slice(0,100), urunAd: urunAd.slice(0,200),
        adet, tutar, durum,
        not: not.slice(0,500),
        guncelleme: firebase.firestore.FieldValue.serverTimestamp(),
      };

      if (mevcutId) {
        await db.collection('siparisler').doc(mevcutId).update(veri);
        toast('Sipariş güncellendi ✓', 'success');
      } else {
        veri.tarih = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('siparisler').add(veri);
        toast('Sipariş eklendi ✓', 'success');
      }

      siparisFormuTemizle();
      await siparisleriYukle();
      sayfaAc('siparisler', document.querySelector('[onclick*="siparisler"]'));
    } catch (e) { toast('Kayıt hatası.', 'error'); console.error(e); }
    finally { if (btn) { btn.textContent = 'Kaydet'; btn.disabled = false; } }
  };

  window.siparisDuzenle = function (id) {
    const s = tumSiparisler.find(x => x.id === id); if (!s) return;
    sayfaAc('siparis-ekle', document.querySelector('[onclick*="siparis-ekle"]'));
    setTextSafe('siparis-form-baslik', 'Siparişi Düzenle');
    document.getElementById('sp-id').value       = s.id;
    document.getElementById('sp-musteri').value  = s.musteriAd || '';
    document.getElementById('sp-urun').value     = s.urunAd || '';
    document.getElementById('sp-adet').value     = s.adet || 1;
    document.getElementById('sp-tutar').value    = s.tutar || '';
    document.getElementById('sp-durum').value    = s.durum || 'beklemede';
    document.getElementById('sp-not').value      = s.not || '';
  };

  window.siparisSil = async function (id) {
    if (!confirm('Bu siparişi silmek istediğine emin misin?')) return;
    try { await db.collection('siparisler').doc(id).delete(); toast('Sipariş silindi.', 'success'); await siparisleriYukle(); }
    catch { toast('Silinemedi.', 'error'); }
  };

  function siparisFormuTemizle() {
    ['sp-id','sp-musteri','sp-urun','sp-adet','sp-tutar','sp-not'].forEach(id => { const el = document.getElementById(id); if(el) el.value = id === 'sp-adet' ? '1' : ''; });
    const d = document.getElementById('sp-durum'); if(d) d.value = 'beklemede';
  }
  window.siparisFormuTemizle = siparisFormuTemizle;

  window.siparisFiltreله = function (durum) {
    const tbody = document.getElementById('siparisler-tbody'); if (!tbody) return;
    const filtreli = durum === 'hepsi' ? tumSiparisler : tumSiparisler.filter(s => s.durum === durum);
    tbody.innerHTML = '';
    if (!filtreli.length) {
      const tr=document.createElement('tr'); const td=document.createElement('td'); td.colSpan=7; td.className='empty-state'; td.textContent='Sonuç yok.'; tr.appendChild(td); tbody.appendChild(tr); return;
    }
    filtreli.forEach(s => {
      const geçici = tumSiparisler; tumSiparisler = filtreli;
      tbody.appendChild(buildSiparisRow(s));
      tumSiparisler = geçici;
    });
  };

  // ══════════════════════════════════════════════════════════════
  // DASHBOARD — GELİŞMİŞ İSTATİSTİKLER
  // ══════════════════════════════════════════════════════════════
  function dashboardYenile() {
    const toplamUrun    = tumUrunler.length;
    const kadinUrun     = tumUrunler.filter(u => u.kategoriCinsiyet === 'kadin').length;
    const erkekUrun     = tumUrunler.filter(u => u.kategoriCinsiyet === 'erkek').length;
    const indirimliUrun = tumUrunler.filter(u => u.indirimFiyat).length;

    const toplamSiparis    = tumSiparisler.length;
    const teslimSiparis    = tumSiparisler.filter(s => s.durum === 'teslim edildi').length;
    const bekleyenSiparis  = tumSiparisler.filter(s => s.durum === 'beklemede').length;
    const iptalSiparis     = tumSiparisler.filter(s => s.durum === 'iptal').length;
    const toplamCiro       = tumSiparisler.filter(s => s.durum === 'teslim edildi').reduce((acc, s) => acc + (s.tutar || 0), 0);
    const buAy             = new Date(); buAy.setDate(1); buAy.setHours(0,0,0,0);
    const buAyCiro         = tumSiparisler
      .filter(s => s.durum === 'teslim edildi' && s.tarih?.toDate && s.tarih.toDate() >= buAy)
      .reduce((acc, s) => acc + (s.tutar || 0), 0);

    setTextSafe('stat-toplam',   toplamUrun);
    setTextSafe('stat-kadin',    kadinUrun);
    setTextSafe('stat-erkek',    erkekUrun);
    setTextSafe('stat-indirim',  indirimliUrun);
    setTextSafe('stat-siparis',  toplamSiparis);
    setTextSafe('stat-teslim',   teslimSiparis);
    setTextSafe('stat-bekleyen', bekleyenSiparis);
    setTextSafe('stat-ciro',     toplamCiro.toLocaleString('tr-TR') + ' ₺');
    setTextSafe('stat-buay',     buAyCiro.toLocaleString('tr-TR') + ' ₺');
    setTextSafe('stat-iptal',    iptalSiparis);

    // Son siparişler tablosu
    const tbody = document.getElementById('son-siparisler-tbody'); if (!tbody) return;
    tbody.innerHTML = '';
    const son5 = tumSiparisler.slice(0,5);
    if (!son5.length) {
      const tr=document.createElement('tr'); const td=document.createElement('td'); td.colSpan=5; td.className='empty-state'; td.textContent='Henüz sipariş yok.'; tr.appendChild(td); tbody.appendChild(tr); return;
    }
    son5.forEach(s => {
      const tr = document.createElement('tr');
      const tarih = s.tarih?.toDate ? s.tarih.toDate().toLocaleDateString('tr-TR') : '—';
      const durumRenk = { 'beklemede': 'badge-beklemede', 'teslim edildi': 'badge-aktif', 'iptal': 'badge-pasif' }[s.durum] || 'badge-beklemede';
      [s.siparisNo||'—', s.musteriAd||'—', s.urunAd||'—', '', s.tutar ? s.tutar.toLocaleString('tr-TR')+' ₺' : '—'].forEach((val, i) => {
        const td = document.createElement('td');
        if (i === 3) { const b=document.createElement('span'); b.className='badge '+durumRenk; b.textContent=s.durum||'beklemede'; td.appendChild(b); }
        else td.textContent = val;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  // ── Toast ─────────────────────────────────────────────────────
  function toast(mesaj, tip = '') {
    const t = document.getElementById('toast'); if (!t) return;
    t.textContent = mesaj; t.className = 'show ' + tip;
    setTimeout(() => { t.className = ''; }, 3500);
  }

})();
