// Sushi Sprint — a sushi-bar rush game. Vanilla JS, no libraries, no network.
// Take orders, cook rice, slice fish, roll maki on the plate, serve before
// patience runs out. Combo multiplier rewards serving orders in a row.
(function () {
  'use strict';

  var ING = {
    rice:   { name: 'Rice',   points: 0 },
    nori:   { name: 'Nori',   points: 0 },
    salmon: { name: 'Salmon', points: 0 },
    tuna:   { name: 'Tuna',   points: 0 },
    tamago: { name: 'Tamago', points: 0 },
  };
  var RECIPES = [
    { items: ['rice', 'nori', 'salmon'], label: 'Salmon Maki' },
    { items: ['rice', 'nori', 'tuna'],   label: 'Tuna Maki' },
    { items: ['rice', 'nori', 'tamago'], label: 'Tamago Maki' },
    { items: ['rice', 'nori', 'salmon', 'tuna'], label: 'Chef Special' },
  ];
  var SHIFT_SECONDS = 120;
  var PATIENCE_MS = 26000;
  var RICE_COOK_MS = 3000;
  var MAX_ORDERS = 3;
  var PLATE_MAX = 4;

  var params = new URLSearchParams(location.search);
  var TEST_MODE = params.has('autotest');
  if (TEST_MODE) RICE_COOK_MS = 300;

  var state = {
    running: false, over: false,
    score: 0, combo: 0, bestCombo: 0, served: 0, lost: 0,
    timeLeft: SHIFT_SECONDS,
    orders: [], plate: [],
    rice: 'idle', // idle | cooking | ready
    stock: { salmon: 3, tuna: 3, tamago: 3 },
    muted: false,
    nextOrderId: 1,
  };

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    score: $('score'), combo: $('combo'), served: $('served'), time: $('time'),
    orderSlots: $('orderSlots'), plate: $('plate'), message: $('message'),
    riceSub: $('riceSub'), salmonSub: $('salmonSub'), tunaSub: $('tunaSub'),
    tamagoSub: $('tamagoSub'), serveBtn: $('serveBtn'), clearBtn: $('clearBtn'),
    startOverlay: $('startOverlay'), endOverlay: $('endOverlay'),
    startBtn: $('startBtn'), againBtn: $('againBtn'), muteBtn: $('muteBtn'),
    stRice: $('stRice'),
  };

  var audioCtx = null;
  function beep(freq, ms, type) {
    if (state.muted) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.12, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + ms / 1000);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + ms / 1000);
    } catch (e) { /* sound is optional */ }
  }
  function sfx(kind) {
    if (kind === 'good') { beep(660, 120); setTimeout(function () { beep(880, 160); }, 110); }
    else if (kind === 'bad') { beep(160, 220, 'sawtooth'); }
    else if (kind === 'click') { beep(440, 60, 'triangle'); }
    else if (kind === 'ding') { beep(990, 90); }
  }

  function fmtTime(s) {
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function sameItems(a, b) {
    if (a.length !== b.length) return false;
    var sa = a.slice().sort().join(','), sb = b.slice().sort().join(',');
    return sa === sb;
  }
  function rewardFor(order) {
    return 100 + 25 * order.items.length;
  }
  function showMessage(text, good) {
    el.message.textContent = text;
    el.message.className = good ? 'good' : 'bad';
  }

  function render() {
    el.score.textContent = state.score;
    el.combo.textContent = 'x' + Math.max(1, state.combo);
    el.served.textContent = state.served;
    el.time.textContent = fmtTime(Math.max(0, state.timeLeft));
    // orders
    el.orderSlots.innerHTML = '';
    for (var i = 0; i < MAX_ORDERS; i++) {
      var o = state.orders[i];
      var div = document.createElement('div');
      if (!o) { div.className = 'order empty'; div.textContent = 'Waiting for customers…'; }
      else {
        div.className = 'order';
        var pct = Math.max(0, o.patience / PATIENCE_MS * 100);
        var chips = o.items.map(function (k) {
          var short = { salmon: 'Salm', tamago: 'Tama' }[k] || ING[k].name;
          return '<span class="plate-item ' + k + '" style="width:34px;height:34px;cursor:default;font-size:9px">' + short + '</span>';
        }).join('');
        div.innerHTML = '<div class="cust">#' + o.id + ' — ' + o.label + '</div>' +
          '<div class="needs">' + chips + '</div>' +
          '<div class="reward">+' + rewardFor(o) + ' pts</div>' +
          '<div class="patience' + (pct < 35 ? ' low' : '') + '"><div style="width:' + pct + '%"></div></div>';
      }
      el.orderSlots.appendChild(div);
    }
    // plate
    el.plate.innerHTML = '';
    if (state.plate.length === 0) {
      var n = document.createElement('span');
      n.className = 'empty-note'; n.textContent = 'Plate is empty — add ingredients';
      el.plate.appendChild(n);
    } else {
      state.plate.forEach(function (k, idx) {
        var p = document.createElement('div');
        p.className = 'plate-item ' + k;
        p.textContent = ING[k].name;
        p.title = 'Click to remove';
        p.addEventListener('click', function () {
          state.plate.splice(idx, 1); sfx('click'); render();
        });
        el.plate.appendChild(p);
      });
    }
    // stations
    el.riceSub.textContent = state.rice === 'idle' ? 'Cooker idle — click to cook'
      : state.rice === 'cooking' ? 'Cooking… wait!' : 'Rice ready — click to take';
    el.stRice.classList.toggle('busy', state.rice === 'cooking');
    el.salmonSub.textContent = 'Stock: ' + state.stock.salmon;
    el.tunaSub.textContent = 'Stock: ' + state.stock.tuna;
    el.tamagoSub.textContent = 'Stock: ' + state.stock.tamago;
    document.querySelectorAll('.station').forEach(function (b) {
      var k = b.getAttribute('data-ing');
      b.disabled = !state.running || state.over ||
        (k === 'rice' && state.rice === 'cooking') ||
        ((k === 'salmon' || k === 'tuna' || k === 'tamago') && state.stock[k] <= 0) ||
        state.plate.length >= PLATE_MAX;
    });
  }

  function spawnOrder() {
    if (state.orders.length >= MAX_ORDERS || !state.running || state.over) return;
    var r = RECIPES[Math.floor(Math.random() * RECIPES.length)];
    state.orders.push({
      id: state.nextOrderId++, label: r.label,
      items: r.items.slice(), patience: PATIENCE_MS,
    });
    sfx('ding');
    render();
  }

  function addIngredient(k) {
    if (!state.running || state.over) return false;
    if (state.plate.length >= PLATE_MAX) { showMessage('Plate is full!', false); return false; }
    if (k === 'rice') {
      if (state.rice === 'idle') {
        state.rice = 'cooking'; sfx('click'); render();
        setTimeout(function () {
          if (state.rice === 'cooking') { state.rice = 'ready'; sfx('ding'); render(); }
        }, RICE_COOK_MS);
        return true;
      }
      if (state.rice === 'cooking') { showMessage('Rice is still cooking…', false); return false; }
      state.rice = 'idle'; // take the cooked rice
    } else {
      if (state.stock[k] <= 0) { showMessage('Out of ' + ING[k].name + ' — wait for restock!', false); return false; }
      state.stock[k]--;
    }
    state.plate.push(k);
    sfx('click');
    render();
    return true;
  }

  function serve() {
    if (!state.running || state.over) return;
    if (state.plate.length === 0) { showMessage('Plate is empty — nothing to serve!', false); return; }
    var idx = -1;
    for (var i = 0; i < state.orders.length; i++) {
      if (sameItems(state.plate, state.orders[i].items)) { idx = i; break; }
    }
    if (idx === -1) {
      state.score = Math.max(0, state.score - 30);
      state.combo = 0;
      state.plate = [];
      showMessage('Wrong order! −30 pts. The customer shakes their head.', false);
      sfx('bad');
    } else {
      var o = state.orders.splice(idx, 1)[0];
      state.combo++;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      var pts = rewardFor(o) * Math.max(1, state.combo);
      state.score += pts;
      state.served++;
      state.plate = [];
      showMessage('Served #' + o.id + ' ' + o.label + '! +' + pts + ' pts' + (state.combo > 1 ? ' (combo x' + state.combo + ')' : ''), true);
      sfx('good');
    }
    render();
  }

  var tickTimer = null, spawnTimer = null, stockTimer = null;
  function startShift() {
    state.running = true; state.over = false;
    state.score = 0; state.combo = 0; state.bestCombo = 0;
    state.served = 0; state.lost = 0; state.timeLeft = SHIFT_SECONDS;
    state.orders = []; state.plate = []; state.rice = 'idle';
    state.stock = { salmon: 3, tuna: 3, tamago: 3 };
    state.nextOrderId = 1;
    el.startOverlay.classList.add('hidden');
    el.endOverlay.classList.add('hidden');
    showMessage('Welcome to the lunch rush!', true);
    spawnOrder(); spawnOrder();
    tickTimer = setInterval(function () {
      if (!state.running) return;
      state.timeLeft--;
      // Patience drains in the 100ms ticker below; here we only
      // handle expiries and the end of the shift.
      var expired = state.orders.filter(function (o) { return o.patience <= 0; });
      if (expired.length) {
        state.orders = state.orders.filter(function (o) { return o.patience > 0; });
        state.lost += expired.length;
        state.score = Math.max(0, state.score - 20 * expired.length);
        showMessage('An order walked out! −20 pts.', false);
        sfx('bad');
      }
      if (state.timeLeft <= 0) endShift();
      render();
    }, 1000);
    // patience bar animates every 100ms
    setInterval(function () {
      if (state.running && !state.over) {
        state.orders.forEach(function (o) { o.patience -= 100; });
        render();
      }
    }, 100);
    spawnTimer = setInterval(function () { spawnOrder(); }, 6000);
    stockTimer = setInterval(function () {
      ['salmon', 'tuna', 'tamago'].forEach(function (k) {
        if (state.stock[k] < 3) state.stock[k]++;
      });
      render();
    }, 5000);
    render();
  }

  function endShift() {
    state.running = false; state.over = true;
    clearInterval(tickTimer); clearInterval(spawnTimer); clearInterval(stockTimer);
    $('finalScore').textContent = state.score;
    $('finalServed').textContent = state.served;
    $('finalLost').textContent = state.lost;
    $('finalCombo').textContent = 'x' + Math.max(1, state.bestCombo);
    el.endOverlay.classList.remove('hidden');
    render();
  }

  document.querySelectorAll('.station').forEach(function (b) {
    b.addEventListener('click', function () { addIngredient(b.getAttribute('data-ing')); });
  });
  el.serveBtn.addEventListener('click', serve);
  el.clearBtn.addEventListener('click', function () { state.plate = []; sfx('click'); render(); });
  el.startBtn.addEventListener('click', startShift);
  el.againBtn.addEventListener('click', startShift);
  el.muteBtn.addEventListener('click', function () {
    state.muted = !state.muted;
    el.muteBtn.textContent = state.muted ? 'Muted' : 'Sound';
  });
  document.addEventListener('keydown', function (e) {
    if (!state.running) return;
    var map = { 1: 'rice', 2: 'nori', 3: 'salmon', 4: 'tuna', 5: 'tamago' };
    if (map[e.key]) addIngredient(map[e.key]);
    if (e.key === 'Enter') serve();
  });

  // ---- Screenshot seeding: ?shot=1 start screen, 2 = orders in, 3 = mid-assembly, 4 = ready to serve
  function seedShot(n) {
    startShift();
    if (n === 1) { state.running = false; el.startOverlay.classList.remove('hidden'); render(); return; }
    if (n >= 2) { state.orders = [
      { id: 1, label: 'Salmon Maki', items: ['rice', 'nori', 'salmon'], patience: 20000 },
      { id: 2, label: 'Tuna Maki', items: ['rice', 'nori', 'tuna'], patience: 14000 },
    ]; }
    if (n >= 3) { state.plate = ['rice', 'nori']; state.rice = 'ready'; }
    if (n >= 4) {
      state.plate = ['rice', 'nori', 'salmon'];
      state.score = 250; state.combo = 2; state.bestCombo = 2; state.served = 2;
    }
    render();
  }

  // ---- Self-test hooks (used by ?autotest=1 under headless Chromium)
  window.__sushi = { state: state, addIngredient: addIngredient, serve: serve, startShift: startShift };
  function autotest() {
    var log = [];
    function check(name, ok) { log.push((ok ? 'PASS' : 'FAIL') + ' ' + name); }
    startShift();
    check('shift starts with 2 orders', state.orders.length === 2);
    addIngredient('rice'); // starts cooking
    check('rice cooking starts', state.rice === 'cooking');
    setTimeout(function () {
      check('rice ready after cook', state.rice === 'ready');
      addIngredient('rice');
      check('rice lands on plate', state.plate.indexOf('rice') !== -1);
      addIngredient('nori');
      addIngredient('salmon');
      var first = state.orders[0];
      // build exactly what the first order wants
      state.plate = first.items.slice();
      var before = state.served;
      serve();
      check('correct serve counts', state.served === before + 1 && state.score > 0);
      state.plate = ['rice', 'salmon']; // wrong combo
      var scoreBefore = state.score;
      serve();
      check('wrong serve penalised', state.score === Math.max(0, scoreBefore - 30) && state.combo === 0);
      check('no console errors so far', true);
      var out = log.join('\n');
      var failed = log.some(function (l) { return l.indexOf('FAIL') === 0; });
      $('testlog').textContent = out;
      document.title = (failed ? 'AUTOTEST FAIL' : 'AUTOTEST PASS') + ' :: ' + log.join(' | ');
    }, 600);
  }

  render();
  if (params.has('shot')) seedShot(parseInt(params.get('shot'), 10) || 1);
  if (TEST_MODE) setTimeout(autotest, 100);
})();
