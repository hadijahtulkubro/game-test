/* =======================================================================
   MATH TOWER RACE - script.js
   Vanilla JavaScript, tanpa framework.

   Struktur file:
   1.  KONFIGURASI
   2.  AMBIL ELEMEN HTML
   3.  STATE GAME
   4.  HELPER UMUM
   5.  GENERATOR SOAL
   6.  RENDER / TAMPILAN
   7.  EFEK (partikel, suara, animasi)
   8.  LOGIKA JAWABAN (PLAYER 1)
   8b. LOGIKA JAWABAN (PLAYER 2 - mode Lawan Teman / PvP)   <-- BARU
   9.  BOT (hanya aktif mode Lawan Bot / PvE)
   10. TIMER
   11. LEVEL & MODAL
   12. MODE PERMAINAN (pvp / pve)                           <-- BARU
   13. EVENT LISTENER + INIT
   ======================================================================= */

'use strict';

/* =======================================================================
   1. KONFIGURASI
   Semua angka yang mungkin ingin kamu ubah ada di sini.
   ======================================================================= */

var TARGET_BLOCKS = 15;   // tinggi tower untuk menang
var MAX_LEVEL = 5;        // level terakhir
var BASE_SCORE = 100;     // skor dasar per jawaban benar
var MAX_COMBO = 5;        // combo maksimal (x5)
var POWER_MAX = 4;        // jumlah segmen power [####]
var FEEDBACK_DELAY = 900; // jeda (ms) sebelum soal berikutnya muncul

// --- Sistem STREAK ---
var STREAK_TARGET = 3;    // berapa jawaban benar berturut-turut untuk dapat bonus
var STREAK_BONUS = 1;     // berapa balok bonus yang diberikan saat streak tercapai

// Kalau CSS temanmu memakai nama class lain untuk balok tower,
// cukup ganti satu baris ini.
var BLOCK_CLASS = 'block';

// Parameter per level.
// botMin/botMax = rentang waktu berpikir BOT (ms)
// botAcc        = peluang BOT menjawab benar (0-1)
// time          = waktu menjawab untuk pemain manusia, P1 maupun P2 (detik)
//
// --- NERF BOT (revisi dosen) --------------------------------------------
// Sebelumnya BOT nyaris selalu menang: delay 6-8 detik dengan akurasi 70%
// di Level 1 saja berarti BOT rata-rata dapat ~1 balok tiap ~7 detik - lebih
// cepat dari kebanyakan pemain pemula yang masih harus membaca, menghitung,
// lalu mengetik jawaban. Di level atas bedanya makin parah (delay makin
// pendek, akurasi makin tinggi), padahal soal & waktu jawab pemain manusia
// ikut makin susah juga. Revisi ini memperlambat BOT dan menurunkan akurasinya
// di semua level, supaya pemain manusia punya peluang menang yang realistis:
var LEVEL_CONFIG = {
  1: { botMin: 7000, botMax: 11000, botAcc: 0.55, time: 15 },
  2: { botMin: 6500, botMax: 10000, botAcc: 0.58, time: 14 },
  3: { botMin: 6000, botMax: 9500,  botAcc: 0.62, time: 13 },
  4: { botMin: 5500, botMax: 9000,  botAcc: 0.66, time: 12 },
  5: { botMin: 5000, botMax: 8500,  botAcc: 0.70, time: 10 }
};

/* =======================================================================
   2. AMBIL ELEMEN HTML
   Pakai fungsi byId() supaya kalau ada elemen yang tidak ketemu,
   kita hanya dapat peringatan di console, bukan error yang
   menghentikan seluruh game.
   ======================================================================= */

function byId(id) {
  var el = document.getElementById(id);
  if (!el) console.warn('[Math Tower Race] Elemen #' + id + ' tidak ditemukan di HTML.');
  return el;
}

var el = {};

function cacheElements() {
  el.startScreen   = byId('start-screen');
  el.startBtn      = byId('start-btn');

  // BARU: layar aturan + pilih mode
  el.rulesScreen   = byId('rules-screen');
  el.modePvpBtn    = byId('mode-pvp-btn');
  el.modePveBtn    = byId('mode-pve-btn');

  el.winModal      = byId('win-modal');
  el.modalCard     = byId('modal-card');
  el.winTitle      = byId('win-title');
  el.winSubtitle   = byId('win-subtitle');
  el.nextLevelBtn  = byId('next-level-btn');

  el.levelDisplay  = byId('level-display');
  el.musicBtn      = byId('music-btn');

  el.questionBox   = byId('question-box');
  el.powerupBadge  = byId('powerup-badge');
  el.turnDisplay   = byId('turn-display');
  el.answerInput   = byId('answer-input');
  el.submitBtn     = byId('submit-btn');

  el.p1Score  = byId('p1-score');
  el.p1Ht     = byId('p1-ht');
  el.p1Combo  = byId('p1-combo');
  el.p1Power  = byId('p1-power');
  el.p1Tower  = byId('p1-tower');
  el.p1Robot  = byId('p1-robot');
  el.p1Bubble = byId('p1-bubble');

  el.p2Score  = byId('p2-score');
  el.p2Ht     = byId('p2-ht');
  el.p2Combo  = byId('p2-combo');
  el.p2Power  = byId('p2-power');
  el.p2Tower  = byId('p2-tower');
  el.p2Robot  = byId('p2-robot');
  el.p2Bubble = byId('p2-bubble');

  // BARU: label mode + badge progres Player 2
  el.p2ModeLabel  = byId('p2-mode-label');
  el.turnDisplayP2 = byId('turn-display-p2');

  // BARU: kotak soal & input Player 2 (dipakai hanya saat mode Lawan Teman)
  el.questionContainerP2 = byId('question-container-p2');
  el.questionBoxP2  = byId('question-box-p2');
  el.powerupBadgeP2 = byId('powerup-badge-p2');
  el.answerInputP2  = byId('answer-input-p2');
  el.submitBtnP2    = byId('submit-btn-p2');

  el.particles   = byId('particles-container');

  // Combo banner tidak punya id, jadi diambil lewat class.
  el.comboBanner = document.querySelector('.center-effects .combo-banner');
  el.comboBannerTop = el.comboBanner
    ? el.comboBanner.querySelector('.mult-text')
    : null;
  el.comboBannerText = el.comboBanner
    ? el.comboBanner.querySelector('.combo-text')
    : null;
}

/* =======================================================================
   3. STATE GAME
   Semua data game disimpan di satu objek supaya mudah di-reset.
   ======================================================================= */

var state = {
  level: 1,             // level kampanye saat ini (1-5); HANYA berubah di akhir race (menang/kalah)
  raceWinner: null,     // 'p1' atau 'p2' - pemenang race terakhir, dipakai saat pindah level
  running: false,       // true hanya saat gameplay berlangsung

  gameMode: null,       // BARU: 'pve' (lawan BOT) atau 'pvp' (lawan teman manusia)

  // --- round Player 1 ---
  question: null,       // { text, answer } soal Player 1 saat ini
  answered: true,       // true = soal sekarang sudah dijawab (anti double submit)
  timeLeft: 0,

  // --- round Player 2 (BARU, hanya dipakai saat gameMode === 'pvp') ---
  questionP2: null,
  answeredP2: true,
  timeLeftP2: 0,

  p1: newPlayerState(),
  p2: newPlayerState()
};

function newPlayerState() {
  return {
    score: 0,      // akumulatif selama balapan
    blocks: 0,     // tinggi tower
    combo: 1,      // x1 .. x5
    power: 0,      // 0 .. POWER_MAX
    powerUses: 0,  // angka xN di samping bar power
    streak: 0      // jawaban benar berturut-turut (0 .. STREAK_TARGET-1)
  };
}

// Penampung id timer supaya bisa dihentikan dengan pasti.
var tickTimer = null;     // countdown Player 1
var botTimer = null;      // jadwal jawaban BOT
var nextQTimer = null;    // jeda sebelum soal berikutnya Player 1

var tickTimerP2 = null;   // BARU: countdown Player 2 (mode PvP)
var nextQTimerP2 = null;  // BARU: jeda sebelum soal berikutnya Player 2

var botThinkTimer = null;     // BARU: interval untuk hitung mundur "BOT sedang berpikir"
var botThinkRemaining = 0;    // BARU: sisa detik sampai BOT menjawab (ditampilkan di UI)

/* =======================================================================
   4. HELPER UMUM
   ======================================================================= */

function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[rnd(0, arr.length - 1)];
}

function setText(node, value) {
  if (node) node.textContent = value;
}

// Menyembunyikan elemen: pakai class .hidden DAN inline style.
// Inline style dipakai supaya tetap bekerja walau CSS belum punya .hidden.
function hideEl(node) {
  if (!node) return;
  node.classList.add('hidden');
  node.style.display = 'none';
}

// Menampilkan elemen: hapus class .hidden dan kembalikan display
// ke nilai bawaan CSS (string kosong = "ikuti CSS").
function showEl(node) {
  if (!node) return;
  node.classList.remove('hidden');
  node.style.display = '';
}

// Hentikan semua timer yang sedang berjalan (punya P1, P2, maupun BOT).
function clearAllTimers() {
  if (tickTimer)     { clearInterval(tickTimer);   tickTimer = null; }
  if (botTimer)      { clearTimeout(botTimer);     botTimer = null; }
  if (nextQTimer)    { clearTimeout(nextQTimer);   nextQTimer = null; }
  if (tickTimerP2)   { clearInterval(tickTimerP2); tickTimerP2 = null; }
  if (nextQTimerP2)  { clearTimeout(nextQTimerP2); nextQTimerP2 = null; }
  if (botThinkTimer) { clearInterval(botThinkTimer); botThinkTimer = null; }
}

/* =======================================================================
   5. GENERATOR SOAL
   Semua soal dijamin berjawaban BILANGAN BULAT,
   supaya cocok dengan <input type="number">.
   ======================================================================= */

function makeQuestion(level) {
  if (level <= 1) return qLevel1();
  if (level === 2) return qLevel2();
  if (level === 3) return qLevel3();
  if (level === 4) return qLevel4();
  return qLevel5();
}

// LEVEL 1 - mudah: penjumlahan & pengurangan
function qLevel1() {
  if (Math.random() < 0.5) {
    var a = rnd(5, 40), b = rnd(5, 40);
    return { text: a + ' + ' + b + ' = ?', answer: a + b };
  }
  var c = rnd(20, 60), d = rnd(1, 19);
  return { text: c + ' - ' + d + ' = ?', answer: c - d };
}

// LEVEL 2 - mudah/menengah: perkalian & pembagian habis
function qLevel2() {
  var t = pick(['kali', 'bagi', 'campur']);
  if (t === 'kali') {
    var a = rnd(2, 12), b = rnd(2, 12);
    return { text: a + ' × ' + b + ' = ?', answer: a * b };
  }
  if (t === 'bagi') {
    var pembagi = rnd(2, 12), hasil = rnd(2, 12);
    return { text: (pembagi * hasil) + ' ÷ ' + pembagi + ' = ?', answer: hasil };
  }
  var x = rnd(10, 50), y = rnd(10, 50), z = rnd(1, 20);
  return { text: x + ' + ' + y + ' - ' + z + ' = ?', answer: x + y - z };
}

// LEVEL 3 - menengah: operasi campuran (urutan operasi)
function qLevel3() {
  var t = pick(['kali-tambah', 'tambah-kali', 'kurung']);
  if (t === 'kali-tambah') {
    var a = rnd(3, 12), b = rnd(3, 12), c = rnd(5, 40);
    return { text: a + ' × ' + b + ' + ' + c + ' = ?', answer: a * b + c };
  }
  if (t === 'tambah-kali') {
    var d = rnd(10, 60), e = rnd(2, 10), f = rnd(2, 10);
    return { text: d + ' + ' + e + ' × ' + f + ' = ?', answer: d + e * f };
  }
  var g = rnd(2, 15), h = rnd(2, 15), i = rnd(2, 6);
  return { text: '(' + g + ' + ' + h + ') × ' + i + ' = ?', answer: (g + h) * i };
}

// LEVEL 4 - menengah/sulit: persamaan linear, x selalu bulat
function qLevel4() {
  var t = pick(['linear', 'kurung', 'bagi-kali']);
  if (t === 'linear') {
    var x = rnd(2, 15), a = rnd(2, 9), b = rnd(1, 25);
    return { text: a + 'x + ' + b + ' = ' + (a * x + b) + '  ,  x = ?', answer: x };
  }
  if (t === 'kurung') {
    var x2 = rnd(2, 15), a2 = rnd(2, 8), b2 = rnd(1, 15);
    return { text: a2 + '(x + ' + b2 + ') = ' + (a2 * (x2 + b2)) + '  ,  x = ?', answer: x2 };
  }
  var p = rnd(2, 12), q = rnd(2, 12), r = rnd(2, 9);
  return { text: (p * q) + ' ÷ ' + p + ' × ' + r + ' = ?', answer: q * r };
}

// LEVEL 5 - sulit: kuadrat, akar, pola bilangan, x bisa negatif
function qLevel5() {
  var t = pick(['kuadrat', 'akar', 'pola-aritmetika', 'pola-geometri', 'linear-negatif']);

  if (t === 'kuadrat') {
    var a = rnd(11, 25);
    return { text: a + '² = ?', answer: a * a };
  }

  if (t === 'akar') {
    var b = rnd(6, 20);
    return { text: '√' + (b * b) + ' = ?', answer: b };
  }

  if (t === 'pola-aritmetika') {
    var awal = rnd(2, 15), beda = rnd(3, 12);
    var deret = [awal, awal + beda, awal + 2 * beda, awal + 3 * beda];
    return {
      text: deret.join(', ') + ', ?',
      answer: awal + 4 * beda
    };
  }

  if (t === 'pola-geometri') {
    var mula = rnd(2, 5), rasio = rnd(2, 3);
    var g = [mula, mula * rasio, mula * rasio * rasio, mula * Math.pow(rasio, 3)];
    return {
      text: g.join(', ') + ', ?',
      answer: mula * Math.pow(rasio, 4)
    };
  }

  // 5x - 13 = -38  ->  x = -5
  var x = rnd(-12, -2), c = rnd(3, 9), d = rnd(5, 30);
  return { text: c + 'x - ' + d + ' = ' + (c * x - d) + '  ,  x = ?', answer: x };
}

/* =======================================================================
   6. RENDER / TAMPILAN
   ======================================================================= */

// Membuat teks bar power, contoh: "[##--] x1"
function powerText(p) {
  var bar = '';
  for (var i = 0; i < POWER_MAX; i++) bar += (i < p.power) ? '#' : '-';
  return '[' + bar + '] x' + p.powerUses;
}

function renderHUD() {
  setText(el.p1Score, state.p1.score);
  setText(el.p1Ht,    state.p1.blocks);
  setText(el.p1Combo, 'x' + state.p1.combo);
  setText(el.p1Power, powerText(state.p1));

  setText(el.p2Score, state.p2.score);
  setText(el.p2Ht,    state.p2.blocks);
  setText(el.p2Combo, 'x' + state.p2.combo);
  setText(el.p2Power, powerText(state.p2));
}

// Kalau CSS belum punya aturan untuk balok, balok akan setinggi 0px
// dan tidak terlihat. Fungsi ini mendeteksi hal itu sekali saja,
// lalu memakai style cadangan agar game tetap bisa dimainkan.
var blockStyleChecked = false;
var needInlineBlock = false;

function createBlock(index, who) {
  var b = document.createElement('div');
  b.className = BLOCK_CLASS + ' ' + who + '-block';
  b.textContent = index;
  if (needInlineBlock) applyFallbackBlockStyle(b, who);
  return b;
}

function applyFallbackBlockStyle(b, who) {
  b.style.width = '70px';
  b.style.height = '22px';
  b.style.margin = '2px auto';
  b.style.border = '3px solid #000';
  b.style.boxSizing = 'border-box';
  b.style.display = 'flex';
  b.style.alignItems = 'center';
  b.style.justifyContent = 'center';
  b.style.fontSize = '10px';
  b.style.color = '#000';
  b.style.background = (who === 'p1') ? '#f1c40f' : '#e74c3c';
}

// Menyamakan jumlah balok di layar dengan jumlah balok di state.
function syncTower(towerEl, count, who) {
  if (!towerEl) return;

  while (towerEl.children.length > count) {
    towerEl.removeChild(towerEl.lastChild);
  }
  while (towerEl.children.length < count) {
    var idx = towerEl.children.length + 1;
    var block = createBlock(idx, who);
    towerEl.appendChild(block);

    // Cek sekali: apakah CSS sudah memberi ukuran pada balok?
    if (!blockStyleChecked) {
      blockStyleChecked = true;
      var h = window.getComputedStyle(block).height;
      if (h === '0px' || h === 'auto') {
        needInlineBlock = true;
        applyFallbackBlockStyle(block, who);
        console.info('[Math Tower Race] CSS untuk .' + BLOCK_CLASS +
                     ' belum ada, memakai style cadangan dari JS.');
      }
    }
  }
}

function renderTowers() {
  syncTower(el.p1Tower, state.p1.blocks, 'p1');
  syncTower(el.p2Tower, state.p2.blocks, 'p2');
}

function renderTurn() {
  if (!el.turnDisplay) return;

  var streakInfo = ' · 🔥 ' + state.p1.streak + '/' + STREAK_TARGET;

  if (!state.running) {
    el.turnDisplay.textContent = 'PLAYER 1’s TURN';
    return;
  }
  el.turnDisplay.textContent =
    'PLAYER 1’s TURN · ⏱ ' + state.timeLeft + 's' + streakInfo;
}

// BARU: badge progres Player 2, simetris dengan renderTurn() milik Player 1.
// Isinya berbeda tergantung mode:
//   - mode BOT (pve): tampilkan hitung mundur "BOT sedang berpikir"
//     supaya Player 1 tahu kira-kira kapan BOT akan menjawab.
//   - mode Lawan Teman (pvp): tampilkan timer + progres streak Player 2,
//     persis seperti punya Player 1.
function renderTurnP2() {
  if (!el.turnDisplayP2) return;

  if (!state.running) {
    el.turnDisplayP2.textContent = (state.gameMode === 'pvp') ? 'PLAYER 2’S TURN' : 'MENUNGGU...';
    return;
  }

  if (state.gameMode === 'pvp') {
    var streakInfo = ' · 🔥 ' + state.p2.streak + '/' + STREAK_TARGET;
    el.turnDisplayP2.textContent =
      'PLAYER 2’S TURN · ⏱ ' + state.timeLeftP2 + 's' + streakInfo;
  } else {
    el.turnDisplayP2.textContent =
      '🤖 BOT MENGHITUNG… ⏱ ' + botThinkRemaining + 's';
  }
}

// Kecil: pilih renderTurn (P1) atau renderTurnP2 (P2) sesuai pemiliknya.
function renderTurnFor(who) {
  if (who === 'p1') renderTurn();
  else renderTurnP2();
}

function renderLevel() {
  setText(el.levelDisplay, 'LEVEL ' + state.level + '/' + MAX_LEVEL);
}

// Background per level: class .level-1 .. .level-5 dipasang di <body>.
// Dipasang di body (bukan di .game-container) karena CSS memakai
// selector #game-container sementara HTML memakai class.
function applyLevelBackground(level) {
  for (var i = 1; i <= MAX_LEVEL; i++) {
    document.body.classList.remove('level-' + i);
  }
  document.body.classList.add('level-' + level);
}

/* =======================================================================
   7. EFEK: partikel, suara, animasi kecil
   ======================================================================= */

// Siapkan layer partikel. Hanya diatur lewat JS kalau CSS belum
// memposisikannya (position masih static).
function setupParticleLayer() {
  if (!el.particles) return;
  var pos = window.getComputedStyle(el.particles).position;
  if (pos === 'static') {
    var s = el.particles.style;
    s.position = 'fixed';
    s.left = '0';
    s.top = '0';
    s.width = '100%';
    s.height = '100%';
    s.pointerEvents = 'none';
    s.overflow = 'hidden';
    s.zIndex = '90';
  }
}

// Ledakan partikel kecil di sekitar sebuah elemen.
function burst(targetEl, emoji, count) {
  if (!el.particles || !targetEl) return;
  if (el.particles.children.length > 60) return; // jaga agar tidak berat

  var r = targetEl.getBoundingClientRect();
  for (var i = 0; i < count; i++) {
    var p = document.createElement('span');
    p.textContent = emoji;
    p.style.position = 'absolute';
    p.style.left = (r.left + r.width / 2) + 'px';
    p.style.top = (r.top + r.height / 2) + 'px';
    p.style.fontSize = rnd(14, 26) + 'px';
    p.style.pointerEvents = 'none';
    el.particles.appendChild(p);

    var dx = rnd(-110, 110);
    var dy = rnd(-170, -50);

    if (typeof p.animate === 'function') {
      var anim = p.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(0.4)', opacity: 0 }
      ], { duration: rnd(600, 1000), easing: 'ease-out' });
      anim.onfinish = (function (node) {
        return function () { if (node.parentNode) node.parentNode.removeChild(node); };
      })(p);
    } else {
      (function (node) {
        setTimeout(function () {
          if (node.parentNode) node.parentNode.removeChild(node);
        }, 800);
      })(p);
    }
  }
}

// Kilatan hijau/merah pada kotak soal.
// Diubah agar menerima elemen target secara eksplisit (targetEl), supaya
// bisa dipakai untuk kotak soal Player 1 (#question-box) MAUPUN
// kotak soal Player 2 (#question-box-p2) tanpa menduplikasi fungsi ini.
function flashQuestionBox(targetEl, mode) {
  if (!targetEl) return;
  targetEl.classList.remove('ok', 'bad');
  if (mode) targetEl.classList.add(mode);
}

// Lompatan kecil robot saat berhasil menambah balok.
function hopRobot(robotEl) {
  if (!robotEl || typeof robotEl.animate !== 'function') return;
  robotEl.animate([
    { transform: 'translateY(0)' },
    { transform: 'translateY(-14px)' },
    { transform: 'translateY(0)' }
  ], { duration: 320, easing: 'ease-out' });
}

// Banner combo muncul sebentar saat combo tinggi.
// Memakai class .show yang sudah disiapkan di CSS (opacity + scale).
var comboBannerTimer = null;

function showBanner(atasText, bawahText, durasi) {
  if (!el.comboBanner) return;
  setText(el.comboBannerTop, atasText);
  setText(el.comboBannerText, bawahText);
  el.comboBanner.classList.add('show');

  if (el.comboBannerText && typeof el.comboBannerText.animate === 'function') {
    el.comboBannerText.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(1.3)' },
      { transform: 'scale(1)' }
    ], { duration: 450, easing: 'ease-out' });
  }

  if (comboBannerTimer) clearTimeout(comboBannerTimer);
  comboBannerTimer = setTimeout(function () {
    el.comboBanner.classList.remove('show');
  }, durasi || 1200);
}

function hideBanner() {
  if (comboBannerTimer) { clearTimeout(comboBannerTimer); comboBannerTimer = null; }
  if (el.comboBanner) el.comboBanner.classList.remove('show');
}

function flashComboBanner(combo) {
  showBanner('MULTIPLIER!', 'COMBO x' + combo, 1200);
}

// Efek visual saat seorang pemain berhasil streak 3.
// Diubah menerima "who" supaya partikelnya meletus di robot pemain yang
// benar-benar mencapai streak (P1 atau P2), bukan selalu di P1.
function showStreakEffect(who) {
  showBanner('🔥 STREAK!', STREAK_TARGET + 'x STREAK! +' + STREAK_BONUS + ' BLOCK', 1600);
  var robot = (who === 'p1') ? el.p1Robot : el.p2Robot;
  if (robot) burst(robot, '🔥', 14);
  soundStreak();
}

/* --- Suara sederhana (Web Audio API, tanpa file audio) --- */
var soundOn = true;
var audioCtx = null;

function beep(freq, duration, type) {
  if (!soundOn) return;
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Kalau browser menolak, game tetap jalan tanpa suara.
  }
}

function soundCorrect() { beep(880, 0.12); setTimeout(function () { beep(1320, 0.12); }, 90); }
function soundWrong()   { beep(160, 0.25, 'sawtooth'); }
function soundWin()     { beep(660, 0.12); setTimeout(function () { beep(880, 0.12); }, 110);
                          setTimeout(function () { beep(1320, 0.2); }, 230); }
function soundStreak()  { beep(740, 0.1); setTimeout(function () { beep(990, 0.1); }, 80);
                          setTimeout(function () { beep(1480, 0.18); }, 160); }

/* =======================================================================
   8. LOGIKA JAWABAN (PLAYER 1)
   ======================================================================= */

// Apakah soal berikutnya untuk pemain ini adalah Power-Up Question?
function isPowerReady(p) {
  return p.power >= POWER_MAX;
}

/* --- LEVEL BERBASIS RONDE (race) -----------------------------------------
   state.level TIDAK berubah tiap jawaban. Ia hanya berubah di ANTARA
   dua race: setiap race adalah adu cepat sampai 15 balok pada satu level.
   Soal dan konfigurasi BOT/timer sepanjang SATU race memakai level yang sama.
   Keputusan naik/turun level dibuat di endLevel() + handleNextLevel():
     menang race -> level + 1 (maksimal MAX_LEVEL)
     kalah race  -> level - 1 (minimal 1)
------------------------------------------------------------------------ */

/* --- SISTEM STREAK ---------------------------------------------------------
   Streak = jumlah jawaban benar BERTURUT-TURUT milik seorang pemain.
   Mencapai STREAK_TARGET -> bonus balok + efek visual, lalu kembali ke 0.
   Sistem ini terpisah dari combo: combo mengatur skor, streak mengatur balok.
   Diubah menerima "who" ('p1' atau 'p2') supaya satu fungsi ini bisa dipakai
   untuk kedua pemain - penting karena mode Lawan Teman butuh streak di P2 juga.
   Mengembalikan true kalau bonus baru saja diberikan.
------------------------------------------------------------------------ */
function addStreak(who) {
  var p = state[who];
  p.streak += 1;

  if (p.streak >= STREAK_TARGET) {
    p.streak = 0;  // reset supaya bisa mengejar streak berikutnya

    // Bonus benar-benar masuk ke state pemain, bukan sekadar tulisan.
    p.blocks = Math.min(p.blocks + STREAK_BONUS, TARGET_BLOCKS);

    renderHUD();
    renderTowers();
    renderTurnFor(who);
    showStreakEffect(who);
    return true;
  }

  renderTurnFor(who);  // update tampilan "🔥 1/3" atau "🔥 2/3"
  return false;
}

// Streak hilang saat salah menjawab atau kehabisan waktu.
function resetStreak(who) {
  state[who].streak = 0;
  renderTurnFor(who);
}

// Dipanggil saat seorang pemain menjawab BENAR. Sudah generik sejak awal
// (menerima "who"), jadi tidak perlu diubah untuk mendukung Player 2 manusia.
function handleCorrect(who) {
  var p = state[who];
  var powered = isPowerReady(p);

  var gained = BASE_SCORE * p.combo * (powered ? 2 : 1);
  p.score += gained;

  var add = powered ? 2 : 1;
  p.blocks = Math.min(p.blocks + add, TARGET_BLOCKS);

  p.combo = Math.min(p.combo + 1, MAX_COMBO);

  if (powered) {
    p.power = 0;
    p.powerUses += 1;
  } else {
    p.power = Math.min(p.power + 1, POWER_MAX);
  }

  renderHUD();
  renderTowers();

  var robot = (who === 'p1') ? el.p1Robot : el.p2Robot;
  hopRobot(robot);
  burst(robot, powered ? '⚡' : '⭐', powered ? 12 : 7);
  if (p.combo >= 3) flashComboBanner(p.combo);

  return gained;
}

// Dipanggil saat seorang pemain menjawab SALAH atau kehabisan waktu.
// Sudah generik sejak awal, tidak perlu diubah.
function handleWrong(who) {
  var p = state[who];
  p.combo = 1;          // combo reset
  if (isPowerReady(p)) p.power = 0;  // kesempatan power-up hangus
  renderHUD();
}

// Membuat dan menampilkan soal baru untuk Player 1.
function nextQuestion() {
  if (!state.running) return;

  state.question = makeQuestion(state.level);
  state.answered = false;

  setText(el.questionBox, state.question.text);
  flashQuestionBox(el.questionBox, null);

  if (isPowerReady(state.p1)) showEl(el.powerupBadge);
  else hideEl(el.powerupBadge);

  if (el.answerInput) {
    el.answerInput.disabled = false;
    el.answerInput.value = '';
    el.answerInput.focus();
  }
  if (el.submitBtn) el.submitBtn.disabled = false;

  startTimer();
}

function scheduleNextQuestion() {
  if (nextQTimer) clearTimeout(nextQTimer);
  nextQTimer = setTimeout(function () {
    nextQTimer = null;
    nextQuestion();
  }, FEEDBACK_DELAY);
}

function lockInput() {
  if (el.answerInput) el.answerInput.disabled = true;
  if (el.submitBtn) el.submitBtn.disabled = true;
}

// Dipanggil saat tombol Jawab Player 1 ditekan atau Enter.
function submitAnswer() {
  if (!state.running) return;
  if (state.answered) return;
  if (!el.answerInput) return;

  var raw = el.answerInput.value.trim();

  if (raw === '') {
    setText(el.questionBox, '✏ Isi jawabanmu dulu!');
    setTimeout(function () {
      if (state.running && !state.answered && state.question) {
        setText(el.questionBox, state.question.text);
      }
    }, 700);
    return;
  }

  var value = parseInt(raw, 10);
  if (isNaN(value)) {
    setText(el.questionBox, '✏ Masukkan angka, ya!');
    setTimeout(function () {
      if (state.running && !state.answered && state.question) {
        setText(el.questionBox, state.question.text);
      }
    }, 700);
    return;
  }

  state.answered = true;
  stopTimer();
  lockInput();
  setText(el.p1Bubble, value);

  if (value === state.question.answer) {
    var gained = handleCorrect('p1');
    var dapatBonus = addStreak('p1');

    if (dapatBonus) {
      setText(el.questionBox,
        '🔥 STREAK x' + STREAK_TARGET + '! +' + STREAK_BONUS +
        ' BALOK BONUS (+' + gained + ')');
    } else {
      setText(el.questionBox, '✅ BENAR! +' + gained);
    }
    flashQuestionBox(el.questionBox, 'ok');
    soundCorrect();
  } else {
    handleWrong('p1');
    resetStreak('p1');

    setText(el.questionBox, '❌ SALAH! Jawaban: ' + state.question.answer);
    flashQuestionBox(el.questionBox, 'bad');
    soundWrong();
  }

  hideEl(el.powerupBadge);

  if (checkWin()) return;
  scheduleNextQuestion();
}

/* =======================================================================
   8b. LOGIKA JAWABAN (PLAYER 2 - mode Lawan Teman / PvP)        <-- BARU
   Sengaja ditulis terpisah ("mirror") dari logika Player 1 di atas,
   bukan digabung jadi satu fungsi super generik. Alasannya: Player 1 dan
   Player 2 punya elemen HTML yang berbeda (#answer-input vs
   #answer-input-p2, dst), dan dengan meniru struktur yang sudah terbukti
   jalan di Player 1, risiko bug baru jauh lebih kecil dibanding menulis
   ulang semuanya dengan abstraksi baru. Baca berdampingan dengan versi
   Player 1 di atas - urutannya sengaja dibuat sama persis.
   Semua fungsi di bawah ini hanya aktif saat state.gameMode === 'pvp'.
   ======================================================================= */

function lockInputP2() {
  if (el.answerInputP2) el.answerInputP2.disabled = true;
  if (el.submitBtnP2) el.submitBtnP2.disabled = true;
}

function nextQuestionP2() {
  if (!state.running || state.gameMode !== 'pvp') return;

  state.questionP2 = makeQuestion(state.level);
  state.answeredP2 = false;

  setText(el.questionBoxP2, state.questionP2.text);
  flashQuestionBox(el.questionBoxP2, null);

  if (isPowerReady(state.p2)) showEl(el.powerupBadgeP2);
  else hideEl(el.powerupBadgeP2);

  if (el.answerInputP2) {
    el.answerInputP2.disabled = false;
    el.answerInputP2.value = '';
  }
  if (el.submitBtnP2) el.submitBtnP2.disabled = false;

  startTimerP2();
}

function scheduleNextQuestionP2() {
  if (nextQTimerP2) clearTimeout(nextQTimerP2);
  nextQTimerP2 = setTimeout(function () {
    nextQTimerP2 = null;
    nextQuestionP2();
  }, FEEDBACK_DELAY);
}

// Dipanggil saat tombol Jawab Player 2 ditekan atau Enter (hanya mode pvp).
function submitAnswerP2() {
  if (!state.running) return;
  if (state.gameMode !== 'pvp') return;
  if (state.answeredP2) return;
  if (!el.answerInputP2) return;

  var raw = el.answerInputP2.value.trim();

  if (raw === '') {
    setText(el.questionBoxP2, '✏ Isi jawabanmu dulu!');
    setTimeout(function () {
      if (state.running && !state.answeredP2 && state.questionP2) {
        setText(el.questionBoxP2, state.questionP2.text);
      }
    }, 700);
    return;
  }

  var value = parseInt(raw, 10);
  if (isNaN(value)) {
    setText(el.questionBoxP2, '✏ Masukkan angka, ya!');
    setTimeout(function () {
      if (state.running && !state.answeredP2 && state.questionP2) {
        setText(el.questionBoxP2, state.questionP2.text);
      }
    }, 700);
    return;
  }

  state.answeredP2 = true;
  stopTimerP2();
  lockInputP2();
  setText(el.p2Bubble, value);

  if (value === state.questionP2.answer) {
    var gained = handleCorrect('p2');
    var dapatBonus = addStreak('p2');

    if (dapatBonus) {
      setText(el.questionBoxP2,
        '🔥 STREAK x' + STREAK_TARGET + '! +' + STREAK_BONUS +
        ' BALOK BONUS (+' + gained + ')');
    } else {
      setText(el.questionBoxP2, '✅ BENAR! +' + gained);
    }
    flashQuestionBox(el.questionBoxP2, 'ok');
    soundCorrect();
  } else {
    handleWrong('p2');
    resetStreak('p2');

    setText(el.questionBoxP2, '❌ SALAH! Jawaban: ' + state.questionP2.answer);
    flashQuestionBox(el.questionBoxP2, 'bad');
    soundWrong();
  }

  hideEl(el.powerupBadgeP2);

  if (checkWin()) return;
  scheduleNextQuestionP2();
}

/* =======================================================================
   9. BOT (hanya aktif saat state.gameMode === 'pve')
   BOT berjalan paralel dengan Player 1 (sistem simultan).
   Setiap "ronde", BOT berpikir selama botMin..botMax milidetik,
   lalu menjawab benar dengan peluang botAcc (lihat NERF BOT di bagian 1).
   ======================================================================= */

function scheduleBot() {
  if (!state.running || state.gameMode !== 'pve') return;

  var cfg = LEVEL_CONFIG[state.level];
  var delay = rnd(cfg.botMin, cfg.botMax);

  // BARU: tampilkan hitung mundur "BOT sedang berpikir" di turn-display-p2,
  // supaya progres Player 2 (BOT) terlihat jelas sama seperti Player 1.
  botThinkRemaining = Math.ceil(delay / 1000);
  renderTurnP2();
  if (botThinkTimer) clearInterval(botThinkTimer);
  botThinkTimer = setInterval(function () {
    botThinkRemaining = Math.max(botThinkRemaining - 1, 0);
    renderTurnP2();
  }, 1000);

  botTimer = setTimeout(botTurn, delay);
}

function botTurn() {
  botTimer = null;
  if (botThinkTimer) { clearInterval(botThinkTimer); botThinkTimer = null; }
  if (!state.running || state.gameMode !== 'pve') return;

  var cfg = LEVEL_CONFIG[state.level];
  var q = makeQuestion(state.level);     // soal versi BOT
  var benar = Math.random() < cfg.botAcc;

  if (benar) {
    setText(el.p2Bubble, q.answer);
    handleCorrect('p2');
  } else {
    // jawaban meleset sedikit, supaya terlihat seperti salah hitung
    var meleset = q.answer + pick([-3, -2, -1, 1, 2, 3]);
    setText(el.p2Bubble, meleset);
    handleWrong('p2');
  }

  if (checkWin()) return;
  scheduleBot();
}

/* =======================================================================
   10. TIMER
   ======================================================================= */

function startTimer() {
  stopTimer();
  state.timeLeft = LEVEL_CONFIG[state.level].time;
  renderTurn();
  tickTimer = setInterval(function () {
    state.timeLeft -= 1;
    renderTurn();
    if (state.timeLeft <= 0) timeUp();
  }, 1000);
}

function stopTimer() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
}

function timeUp() {
  stopTimer();
  if (!state.running || state.answered) return;

  state.answered = true;
  lockInput();
  handleWrong('p1');
  resetStreak('p1');

  setText(el.questionBox, '⏰ WAKTU HABIS! Jawaban: ' + state.question.answer);
  flashQuestionBox(el.questionBox, 'bad');
  setText(el.p1Bubble, '—');
  soundWrong();
  hideEl(el.powerupBadge);

  if (checkWin()) return;
  scheduleNextQuestion();
}

// BARU: timer Player 2, dipakai hanya saat gameMode === 'pvp'.
function startTimerP2() {
  stopTimerP2();
  state.timeLeftP2 = LEVEL_CONFIG[state.level].time;
  renderTurnP2();
  tickTimerP2 = setInterval(function () {
    state.timeLeftP2 -= 1;
    renderTurnP2();
    if (state.timeLeftP2 <= 0) timeUpP2();
  }, 1000);
}

function stopTimerP2() {
  if (tickTimerP2) { clearInterval(tickTimerP2); tickTimerP2 = null; }
}

function timeUpP2() {
  stopTimerP2();
  if (!state.running || state.answeredP2) return;

  state.answeredP2 = true;
  lockInputP2();
  handleWrong('p2');
  resetStreak('p2');

  setText(el.questionBoxP2, '⏰ WAKTU HABIS! Jawaban: ' + state.questionP2.answer);
  flashQuestionBox(el.questionBoxP2, 'bad');
  setText(el.p2Bubble, '—');
  soundWrong();
  hideEl(el.powerupBadgeP2);

  if (checkWin()) return;
  scheduleNextQuestionP2();
}

/* =======================================================================
   11. LEVEL & MODAL
   ======================================================================= */

function checkWin() {
  if (state.p1.blocks >= TARGET_BLOCKS) { endLevel('p1'); return true; }
  if (state.p2.blocks >= TARGET_BLOCKS) { endLevel('p2'); return true; }
  return false;
}

function endLevel(winner) {
  state.running = false;     // ini menghentikan BOT & timer secara logis
  clearAllTimers();          // dan ini menghentikannya secara nyata
  lockInput();
  lockInputP2();
  hideEl(el.powerupBadge);
  hideEl(el.powerupBadgeP2);
  if (el.turnDisplay) el.turnDisplay.textContent = 'ROUND OVER';
  if (el.turnDisplayP2) el.turnDisplayP2.textContent = 'ROUND OVER';

  hideBanner();
  flashQuestionBox(el.questionBox, null);
  flashQuestionBox(el.questionBoxP2, null);

  state.raceWinner = winner;

  if (winner === 'p1') {
    soundWin();
    if (el.p1Robot) burst(el.p1Robot, '🎉', 14);
    if (el.modalCard) el.modalCard.classList.remove('lose');

    if (state.level >= MAX_LEVEL) {
      setText(el.winTitle, '🏆 GAME COMPLETE! 🏆');
      setText(el.winSubtitle,
        'Kamu menyelesaikan seluruh 5 level! Skor akhir: ' + state.p1.score +
        ' (P2: ' + state.p2.score + ')');
      setText(el.nextLevelBtn, 'MAIN LAGI DARI LEVEL 1 🔄');
    } else {
      setText(el.winTitle, '🎉 LEVEL PASSED! 🎉');
      setText(el.winSubtitle,
        'Skor: ' + state.p1.score + ' · Lanjut ke Level ' + (state.level + 1) +
        ', soal akan lebih menantang!');
      setText(el.nextLevelBtn, 'LANJUT LEVEL ' + (state.level + 1) + ' ➜');
    }
  } else {
    soundWrong();
    if (el.modalCard) el.modalCard.classList.add('lose');

    var turunKe = Math.max(state.level - 1, 1);
    setText(el.winTitle, '😵 LEVEL GAGAL!');
    if (turunKe === state.level) {
      setText(el.winSubtitle,
        'Menara P2 sampai 15 duluan. Coba lagi di Level 1. Skormu: ' + state.p1.score);
      setText(el.nextLevelBtn, 'ULANGI LEVEL 1 🔄');
    } else {
      setText(el.winSubtitle,
        'Menara P2 sampai 15 duluan. Level turun ke Level ' + turunKe +
        '. Skormu: ' + state.p1.score);
      setText(el.nextLevelBtn, 'TURUN KE LEVEL ' + turunKe + ' 🔄');
    }
  }

  showEl(el.winModal);
}

// Menyiapkan ulang satu level (tower, combo, power, timer, input).
// Skor TIDAK di-reset karena sistemnya akumulatif.
function startLevel(level) {
  clearAllTimers();

  state.level = Math.min(Math.max(level, 1), MAX_LEVEL);
  state.running = true;

  state.answered = true;
  state.question = null;
  state.answeredP2 = true;    // BARU
  state.questionP2 = null;    // BARU

  state.p1.blocks = 0; state.p1.combo = 1; state.p1.power = 0; state.p1.streak = 0;
  state.p2.blocks = 0; state.p2.combo = 1; state.p2.power = 0; state.p2.streak = 0;

  if (el.p1Tower) el.p1Tower.innerHTML = '';
  if (el.p2Tower) el.p2Tower.innerHTML = '';
  setText(el.p1Bubble, '');
  setText(el.p2Bubble, '');
  if (el.answerInput) el.answerInput.value = '';
  if (el.answerInputP2) el.answerInputP2.value = '';   // BARU

  hideEl(el.winModal);
  hideEl(el.powerupBadge);
  hideEl(el.powerupBadgeP2);   // BARU
  hideBanner();
  flashQuestionBox(el.questionBox, null);
  flashQuestionBox(el.questionBoxP2, null);   // BARU
  if (el.modalCard) el.modalCard.classList.remove('lose');

  applyLevelBackground(state.level);
  renderLevel();
  renderHUD();
  renderTowers();
  renderTurn();
  renderTurnP2();   // BARU

  nextQuestion();

  // BARU: Player 2 dijalankan oleh BOT atau menunggu input manusia,
  // tergantung mode yang dipilih di layar aturan.
  if (state.gameMode === 'pvp') {
    nextQuestionP2();
  } else {
    scheduleBot();
  }
}

// Tombol di modal: menentukan level RACE BERIKUTNYA.
//   Menang race ini -> naik 1 level (atau reset total kalau baru menang Level 5).
//   Kalah race ini  -> turun 1 level (minimal Level 1).
function handleNextLevel() {
  hideEl(el.winModal);

  if (state.raceWinner === 'p1') {
    if (state.level >= MAX_LEVEL) {
      state.p1 = newPlayerState();
      state.p2 = newPlayerState();
      startLevel(1);
      return;
    }
    startLevel(state.level + 1);
  } else {
    startLevel(Math.max(state.level - 1, 1));
  }
}

/* =======================================================================
   12. MODE PERMAINAN (pvp / pve)                                 <-- BARU
   ======================================================================= */

// Menyesuaikan tampilan sesuai mode yang dipilih:
//  - label "(BOT)" / "(PLAYER 2)" di kartu HUD Player 2
//  - kotak soal + input Player 2 hanya tampil saat mode Lawan Teman
function updateModeUI(mode) {
  if (mode === 'pvp') {
    setText(el.p2ModeLabel, '(PLAYER 2)');
    showEl(el.questionContainerP2);
  } else {
    setText(el.p2ModeLabel, '(BOT)');
    hideEl(el.questionContainerP2);
  }
}

// Dipanggil saat salah satu tombol mode di layar aturan ditekan.
function startGame(mode) {
  state.gameMode = mode;
  updateModeUI(mode);
  hideEl(el.rulesScreen);

  state.p1 = newPlayerState();
  state.p2 = newPlayerState();
  startLevel(1);
}

/* =======================================================================
   13. EVENT LISTENER + INIT
   Semua listener dipasang SATU KALI di sini, supaya tidak
   pernah terdaftar berkali-kali.
   ======================================================================= */

function bindEvents() {
  // Start -> tampilkan layar aturan (BUKAN langsung mulai game).
  if (el.startBtn) {
    el.startBtn.addEventListener('click', function () {
      hideEl(el.startScreen);
      showEl(el.rulesScreen);
    });
  }

  // BARU: dua tombol pilihan mode di layar aturan.
  if (el.modePvpBtn) {
    el.modePvpBtn.addEventListener('click', function () { startGame('pvp'); });
  }
  if (el.modePveBtn) {
    el.modePveBtn.addEventListener('click', function () { startGame('pve'); });
  }

  if (el.submitBtn) {
    el.submitBtn.addEventListener('click', submitAnswer);
  }
  if (el.answerInput) {
    el.answerInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitAnswer();
      }
    });
  }

  // BARU: tombol & input jawaban Player 2 (mode Lawan Teman).
  if (el.submitBtnP2) {
    el.submitBtnP2.addEventListener('click', submitAnswerP2);
  }
  if (el.answerInputP2) {
    el.answerInputP2.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitAnswerP2();
      }
    });
  }

  if (el.nextLevelBtn) {
    el.nextLevelBtn.addEventListener('click', handleNextLevel);
  }

  if (el.musicBtn) {
    el.musicBtn.addEventListener('click', function () {
      soundOn = !soundOn;
      el.musicBtn.textContent = soundOn ? '🎵 BGM: ON' : '🔇 BGM: OFF';
      if (soundOn) beep(660, 0.1);
    });
  }
}

function init() {
  cacheElements();
  setupParticleLayer();
  bindEvents();

  state.running = false;
  state.gameMode = null;
  lockInput();
  lockInputP2();

  showEl(el.startScreen);
  hideEl(el.rulesScreen);
  hideEl(el.winModal);
  hideEl(el.powerupBadge);
  hideEl(el.powerupBadgeP2);
  hideEl(el.questionContainerP2);
  hideBanner();

  applyLevelBackground(1);
  renderLevel();
  renderHUD();
  setText(el.questionBox, 'READY?');
  setText(el.questionBoxP2, 'READY?');
  renderTurn();
  renderTurnP2();
}

// Jalankan init setelah HTML selesai dimuat.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
