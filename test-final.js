// Stub DOM (sama seperti test-combined3.js, id-aware)
var nodeStore = {};
function makeNode(tag) {
  var n = {
    tagName: tag || 'div', textContent: '', value: '', disabled: false,
    style: {}, _classes: {}, children: [],
    classList: {
      add: function (c) { n._classes[c] = true; },
      remove: function (c) { delete n._classes[c]; },
      contains: function (c) { return !!n._classes[c]; }
    },
    appendChild: function (c) { n.children.push(c); return c; },
    removeChild: function () { n.children.pop(); },
    get lastChild() { return n.children[n.children.length - 1]; },
    focus: function () {},
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 10, height: 10 }; },
    querySelector: function () { return makeNode(); },
    addEventListener: function (type, fn) {
      n._listeners = n._listeners || {};
      n._listeners[type] = n._listeners[type] || [];
      n._listeners[type].push(fn);
    },
    trigger: function (type, evt) {
      (n._listeners && n._listeners[type] || []).forEach(function (fn) { fn(evt || {}); });
    }
  };
  Object.defineProperty(n, 'innerHTML', { set: function () { n.children.length = 0; }, get: function () { return ''; } });
  return n;
}
global.document = {
  getElementById: function (id) { if (!nodeStore[id]) nodeStore[id] = makeNode(); return nodeStore[id]; },
  querySelector: function () { return makeNode(); },
  addEventListener: function () {}, readyState: 'complete',
  body: { classList: { add: function () {}, remove: function () {} } },
  createElement: function () { return makeNode(); }
};
global.window = { getComputedStyle: function () { return { position: 'fixed', height: '40px' }; } };
console.warn = function () {};
global.setInterval = function () { return {}; };   // objek unik, bukan 0, biar truthy
global.setTimeout = function () { return {}; };
global.clearInterval = function () {};
global.clearTimeout = function () {};

var src = require('fs').readFileSync('script3.js', 'utf8');
eval(src.replace(/^'use strict';/m, ''));

var fail = 0;
function check(label, got, want) {
  var ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log((ok ? 'OK  ' : 'FAIL') + ' | ' + label + ' -> got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want));
}

console.log('=== TES 1: Level naik/turun, batas bawah & atas (mode PvE) ===');
el.startBtn.trigger('click');
el.modePveBtn.trigger('click');
check('level awal', state.level, 1);
check('gameMode', state.gameMode, 'pve');
check('p2 question container tersembunyi', el.questionContainerP2.classList.contains('hidden'), true);

function p1MenangRonde() { while (state.p1.blocks < TARGET_BLOCKS && state.running) { state.question = { text: 'x', answer: 10 }; state.answered = false; el.answerInput.value = '10'; submitAnswer(); } }
function p2MenangRonde() { while (state.p2.blocks < TARGET_BLOCKS && state.running) { handleCorrect('p2'); checkWin(); } }

p1MenangRonde(); el.nextLevelBtn.trigger('click');
check('naik ke level 2 setelah menang', state.level, 2);

p1MenangRonde(); el.nextLevelBtn.trigger('click');
p1MenangRonde(); el.nextLevelBtn.trigger('click');
p1MenangRonde(); el.nextLevelBtn.trigger('click');
check('mentok di level 5 (MAX_LEVEL)', state.level, 5);

p2MenangRonde(); el.nextLevelBtn.trigger('click');
check('turun ke level 4 setelah kalah dari level 5', state.level, 4);

console.log('\n=== TES 2: tidak bisa turun di bawah level 1 ===');
startGame('pve');
check('restart ke level 1', state.level, 1);
p2MenangRonde(); el.nextLevelBtn.trigger('click');
check('tetap level 1 setelah kalah di level 1 (bukan level 0)', state.level, 1);

console.log('\n=== TES 3: menang di level 5 -> GAME COMPLETE -> reset skor ===');
startGame('pve');
state.level = 5; state.p1.score = 999;
p1MenangRonde();
check('raceWinner p1 di level 5', state.raceWinner, 'p1');
el.nextLevelBtn.trigger('click');
check('game complete -> reset ke level 1', state.level, 1);
check('skor p1 ikut reset', state.p1.score, 0);

console.log('\n=== TES 4: BOT benar2 tidak jalan di mode PvP ===');
startGame('pvp');
check('gameMode pvp', state.gameMode, 'pvp');
check('p2 question container TAMPIL', el.questionContainerP2.classList.contains('hidden'), false);
check('botTimer tidak terjadwal', botTimer, null);
scheduleBot();
check('scheduleBot() dipanggil manual saat pvp tetap tidak membuat timer', botTimer, null);

console.log('\n=== TES 5: P2 manusia bisa dapat streak bonus + menang sendiri ===');
startGame('pvp');
function jawabP2(benar) {
  state.questionP2 = { text: 'x', answer: 10 };
  state.answeredP2 = false;
  el.answerInputP2.value = benar ? '10' : '99';
  submitAnswerP2();
}
jawabP2(true); jawabP2(true);
check('streak p2 sebelum bonus', state.p2.streak, 2);
check('blocks p2 sebelum bonus (2x benar normal)', state.p2.blocks, 2);
jawabP2(true); // benar ke-3 -> bonus
check('streak p2 reset setelah bonus', state.p2.streak, 0);
check('blocks p2 setelah bonus (2 normal + 1 normal + 1 bonus)', state.p2.blocks, 4);

console.log('\n=== TES 6: jawaban salah P1 me-reset combo & streak, TIDAK mengubah level mid-race ===');
startGame('pve');
state.question = { text: 'x', answer: 10 }; state.answered = false; el.answerInput.value = '10'; submitAnswer();
state.question = { text: 'x', answer: 10 }; state.answered = false; el.answerInput.value = '10'; submitAnswer();
check('combo p1 setelah 2x benar', state.p1.combo, 3);
var levelSebelum = state.level;
state.question = { text: 'x', answer: 10 }; state.answered = false; el.answerInput.value = '1'; submitAnswer();
check('combo p1 reset setelah salah', state.p1.combo, 1);
check('streak p1 reset setelah salah', state.p1.streak, 0);
check('level TIDAK berubah di tengah race (bukan sistem lama)', state.level, levelSebelum);

console.log('\n=== TES 7: timeout dianggap sama seperti salah ===');
startGame('pve');
state.question = { text: 'x', answer: 10 }; state.answered = false;
timeUp();
check('combo p1 reset setelah timeout', state.p1.combo, 1);
check('answered p1 jadi true setelah timeout', state.answered, true);

console.log('\n=== TES 8: input kosong / bukan angka TIDAK dihitung salah ===');
startGame('pve');
state.question = { text: 'x', answer: 10 }; state.answered = false;
el.answerInput.value = '';
submitAnswer();
check('answered TETAP false saat submit kosong', state.answered, false);
el.answerInput.value = 'abc';
submitAnswer();
check('answered TETAP false saat submit huruf', state.answered, false);

console.log('\n=== TES 9: tidak ada listener dobel ===');
check('listener startBtn', (el.startBtn._listeners.click || []).length, 1);
check('listener nextLevelBtn', (el.nextLevelBtn._listeners.click || []).length, 1);
check('listener modePveBtn', (el.modePveBtn._listeners.click || []).length, 1);
check('listener modePvpBtn', (el.modePvpBtn._listeners.click || []).length, 1);
check('listener submitBtnP2', (el.submitBtnP2._listeners.click || []).length, 1);

console.log('\n=== TES 10: nerf bot - cek rentang nilai level config ===');
check('L1 botAcc diturunkan dari 0.70', LEVEL_CONFIG[1].botAcc < 0.70, true);
check('L5 botAcc diturunkan dari 0.90', LEVEL_CONFIG[5].botAcc < 0.90, true);
check('L1 botMin dinaikkan dari 6000', LEVEL_CONFIG[1].botMin > 6000, true);
check('L5 masih lebih cepat dari L1 (progresi tetap)', LEVEL_CONFIG[5].botMin < LEVEL_CONFIG[1].botMin, true);
check('L5 masih lebih akurat dari L1 (progresi tetap)', LEVEL_CONFIG[5].botAcc > LEVEL_CONFIG[1].botAcc, true);

console.log('\n' + (fail === 0 ? '✅ SEMUA TES LULUS (0 gagal)' : '❌ ADA ' + fail + ' TES GAGAL'));
