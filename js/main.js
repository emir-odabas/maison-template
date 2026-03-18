/**
 * main.js
 * ─────────────────────────────────────────────
 * Ana site navigasyon ve sekme geçişleri.
 * ─────────────────────────────────────────────
 */

function switchGender(btn, section) {
  document.querySelectorAll('.gender-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  const kadinSec = document.getElementById('sec-kadin');
  const erkekSec = document.getElementById('sec-erkek');

  if (section === 'erkek') {
    kadinSec.style.display = 'none';
    erkekSec.style.display = 'block';
  } else {
    kadinSec.style.display = 'block';
    erkekSec.style.display = 'none';
  }
}

function switchToErkek() {
  const tabs = document.querySelectorAll('.gender-tab');
  if (tabs[1]) switchGender(tabs[1], 'erkek');
  const el = document.getElementById('erkek');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}
