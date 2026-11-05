/* ==========================================================
   Pet Care — app logic (vanilla JS, no dependencies)
   Data is stored in localStorage (this device only).
   ========================================================== */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic  = (id, cls = 'ic') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, '0');
const dateKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const startMs = (date, time) => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi).getTime();
};
const fmtDate = (date, short) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', short ? { month: 'short', day: 'numeric' } : { month: 'long', day: 'numeric', year: 'numeric' });
};
const fmtTime = t => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`; };
const money  = n => '$' + n.toLocaleString('en-US') + ' COP';
const digits = s => String(s || '').replace(/\D/g, '');
const fld = (f, n) => f.querySelector('[name="' + n + '"]');
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const ago = ts => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
};

const SERVICES = [
  {
    id: 'grooming', name: 'Grooming', short: 'Bath, haircut, and grooming care.', title: 'Pet grooming',
    desc: 'Keep your pet clean, healthy, and looking amazing. Our grooming service includes a bath, haircut, ear cleaning, and nail trimming.',
    duration: '1 - 2 hours', recommended: 'All breeds', price: 50000,
    color: '#98dc1a', dark: '#5f9c00', icon: 'scissors',
    slides: [
      { emoji: '🛁', cap: 'Bubble bath & drying', g: ['#d7f58f', '#98dc1a'], img: 'img/grooming-1.jpg' },
      { emoji: '✂️', cap: 'Haircut & styling',    g: ['#c4ee63', '#7cc40a'], img: 'img/grooming-2.jpg' },
      { emoji: '🐾', cap: 'Nails & ears',         g: ['#e6fab0', '#a8e332'], img: 'img/grooming-3.jpg' }
    ]
  },
  {
    id: 'vet', name: 'Veterinary checkup', short: 'Checkups, vaccines, and more.', title: 'Veterinary checkup',
    desc: 'A complete health review by our licensed vets: physical exam, vaccines, deworming and personalized advice to keep your pet healthy.',
    duration: '30 - 45 minutes', recommended: 'Puppies, kittens and adults', price: 60000,
    color: '#19d3f3', dark: '#0690ab', icon: 'heartplus',
    slides: [
      { emoji: '🩺', cap: 'Full physical exam', g: ['#a5f0fc', '#19d3f3'], img: 'img/vet-1.jpg' },
      { emoji: '💉', cap: 'Vaccines & deworming', g: ['#8aeafa', '#0fbfe0'], img: 'img/vet-2.jpg' },
      { emoji: '💙', cap: 'Care advice', g: ['#c2f5fd', '#35d9f5'], img: 'img/vet-3.jpg' }
    ]
  },
  {
    id: 'daycare', name: 'Daycare', short: 'A safe and fun place.', title: 'Pet daycare',
    desc: 'A safe, supervised and fun space where your pet can play, socialize and rest while you are away.',
    duration: 'Up to 8 hours', recommended: 'Friendly, vaccinated pets', price: 45000,
    color: '#ffc90e', dark: '#a87a00', icon: 'househeart',
    slides: [
      { emoji: '🎾', cap: 'Games & play time', g: ['#ffe27a', '#ffc90e'], img: 'img/daycare-1.jpg' },
      { emoji: '🐕', cap: 'Social walks', g: ['#ffd84d', '#f5b800'], img: 'img/daycare-2.jpg' },
      { emoji: '😴', cap: 'Nap time', g: ['#ffeaa0', '#ffcf2e'], img: 'img/daycare-3.jpg' }
    ]
  }
];
const svc = id => SERVICES.find(s => s.id === id);
const SLOTS = ['08:00', '09:30', '11:00', '14:00', '15:30', '17:00'];
const MAX_MONTHS_AHEAD = 5;

const KEY = 'petcare.v1';
const fresh = () => ({ v: 1, users: [], session: null, appts: [], notifs: [], sys: false });
let state = (() => {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return Object.assign(fresh(), s); } catch (_) {}
  return fresh();
})();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} };

const me = () => {
  if (!state.session) return null;
  if (state.session.guest) return { id: 'guest', name: 'Guest', guest: true };
  return state.users.find(u => u.id === state.session.id) || null;
};
const myAppts  = () => { const u = me(); return u ? state.appts.filter(a => a.userId === u.id) : []; };
const myNotifs = () => { const u = me(); return u ? state.notifs.filter(n => n.userId === u.id) : []; };
const apptStatus = a => a.status === 'cancelled' ? 'cancelled' : (startMs(a.date, a.time) < Date.now() ? 'done' : 'upcoming');
const upcoming = () => myAppts().filter(a => apptStatus(a) === 'upcoming').sort((a, b) => startMs(a.date, a.time) - startMs(b.date, b.time));
const history_ = () => myAppts().filter(a => apptStatus(a) !== 'upcoming').sort((a, b) => startMs(b.date, b.time) - startMs(a.date, a.time));

let draft = null;
let lastApptId = null;
let cal = null;
let inboxSeg = 'alerts';
let apptFilter = 'upcoming';
let revealOrigin = null;
let carIdx = 0, carTimer = null;
const CAR_MS = 4500;
const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
let sheetT, drawerT;
function openSheet(html) {
  clearTimeout(sheetT);
  const w = $('#sheet'); w.classList.remove('closing');
  $('#sheet-body').innerHTML = html; w.hidden = false;
}
function closeSheet() {
  const w = $('#sheet'); if (w.hidden) return;
  clearTimeout(sheetT);
  const end = () => { w.hidden = true; w.classList.remove('closing'); $('#sheet-body').innerHTML = ''; };
  if (reduced()) { end(); return; }
  w.classList.add('closing');
  sheetT = setTimeout(end, 230);
}
function openDrawer() {
  const u = me(); if (!u) return;
  $('#drawer-user').innerHTML = u.guest ? 'Guest mode' : `<b>${esc(u.name)}</b><br><small>${esc(u.email)}</small>`;
  $('#drawer-foot').innerHTML = u.guest
    ? `<button class="btn btn-primary btn-small" data-go="register">Sign up</button><button class="btn btn-outline btn-small" data-action="logout">Exit guest mode</button>`
    : `<button class="btn btn-outline btn-small" data-action="logout">Log out</button>`;
  clearTimeout(drawerT);
  const d = $('#drawer'), tb = $('#topbar'), bg = $('.burger'), panel = $('.drawer-panel');
  d.style.top = tb.offsetHeight + 'px';
  const ar = $('#app').getBoundingClientRect(), br = bg.getBoundingClientRect(), tr = tb.getBoundingClientRect();
  panel.style.setProperty('--ox', (br.left - ar.left + br.width / 2) + 'px');
  panel.style.setProperty('--oy', (br.top - tr.bottom + br.height / 2) + 'px');
  $$('.drawer-panel>*').forEach((n, i) => n.style.setProperty('--n', i));
  d.classList.remove('closing');
  d.hidden = false;
  bg.classList.add('open'); bg.setAttribute('aria-expanded', 'true');
}
function closeDrawer() {
  const bg = $('.burger');
  if (bg) { bg.classList.remove('open'); bg.setAttribute('aria-expanded', 'false'); }
  const d = $('#drawer'); if (d.hidden) return;
  clearTimeout(drawerT);
  const end = () => { d.hidden = true; d.classList.remove('closing'); };
  if (reduced()) { end(); return; }
  d.classList.add('closing');
  drawerT = setTimeout(end, 340);
}
function askSheet(title, msg, yesLabel, yesAction) {
  openSheet(`<h3>${esc(title)}</h3><p class="msg">${esc(msg)}</p>
    <div class="btn-stack"><button class="btn btn-danger" data-action="${yesAction}">${esc(yesLabel)}</button>
    <button class="btn btn-outline" data-action="close-sheet">Cancel</button></div>`);
}

function carAuto() {
  clearInterval(carTimer);
  if (reduced() || $$('#car-stage .slide').length < 2) return;
  carTimer = setInterval(() => carGo(carIdx + 1, 1), CAR_MS);
}
function carGo(i, dir) {
  const slides = $$('#car-stage .slide'), n = slides.length;
  if (n < 2) return;
  i = (i + n) % n;
  if (i === carIdx) return;
  dir = dir || (i > carIdx ? 1 : -1);
  const old = slides[carIdx], nw = slides[i];
  old.classList.remove('active'); old.classList.add(dir > 0 ? 'out-left' : 'out-right');
  nw.classList.remove('out-left', 'out-right');
  nw.classList.add(dir > 0 ? 'pre-right' : 'pre-left');
  void nw.offsetWidth;
  nw.classList.remove('pre-right', 'pre-left'); nw.classList.add('active');
  carIdx = i;
  $$('#dots .cdot').forEach((d, k) => { d.classList.remove('on'); if (k === i) { void d.offsetWidth; d.classList.add('on'); } });
  $('#car-count').textContent = `${i + 1}/${n}`;
  carAuto();
}

const MAIN = ['home', 'services', 'inbox', 'profile'];
let stack = [];
let current = null;
const render = {};

function syncTabs() {
  let tab = current;
  if (current === 'inbox') tab = inboxSeg === 'appts' ? 'appts' : null;
  let idx = -1;
  $$('#tabbar [data-tab]').forEach((b, i) => { const on = b.dataset.tab === tab; b.classList.toggle('active', on); if (on) idx = i; });
  const tb = $('#tabbar');
  tb.dataset.has = idx >= 0 ? '1' : '0';
  if (idx >= 0) tb.style.setProperty('--ti', idx);
}
const ANIM = ['enter-fwd', 'enter-back', 'enter-fade', 'leaving', 'leave-fwd', 'leave-back', 'leave-fade'];
let animTimer;

function stagger(root) {
  if (!root) return;
  const set = (box, base = 0) => Array.from(box.children).forEach((c, i) => c.style.setProperty('--i', Math.min(base + i, 9)));
  if (root.classList.contains('s-auth')) set(root);
  $$('.page, .step-body', root).forEach(box => set(box));
  $$('.step-body form, .s-auth form', root).forEach(f => set(f, Array.from(f.parentNode.children).indexOf(f)));
}

function show(id, dir) {
  const prevId = current;
  const prev = prevId ? $('#s-' + prevId) : null;
  const el = $('#s-' + id);
  if (dir === 'back' && prevId === 'service' && revealOrigin && MAIN.includes(id)) dir = 'collapse';
  if ((dir === 'reveal' || dir === 'collapse') && !revealOrigin) dir = dir === 'reveal' ? 'fwd' : 'back';
  current = id;
  clearTimeout(animTimer);
  if (id !== 'service') clearInterval(carTimer);
  $$('.screen').forEach(s => { s.classList.remove(...ANIM); s.classList.toggle('active', s === el); });
  const isMain = MAIN.includes(id);
  $('#topbar').hidden = !isMain;
  $('#tabbar').hidden = !isMain;
  if (el) el.scrollTop = 0;
  closeDrawer(); closeSheet();
  if (render[id]) render[id]();
  stagger(el);
  if (el && prev && prev !== el && dir && !reduced()) {
    if (dir === 'reveal' || dir === 'collapse') {
      const o = revealOrigin;
      [el, prev].forEach(n => { n.style.setProperty('--ct', o.t + 'px'); n.style.setProperty('--cr', o.r + 'px'); n.style.setProperty('--cb', o.b + 'px'); n.style.setProperty('--cl', o.l + 'px'); });
    }
    el.classList.add('enter-' + dir);
    prev.classList.add('leaving', 'leave-' + dir);
    animTimer = setTimeout(() => {
      el.classList.remove('enter-' + dir);
      prev.classList.remove('leaving', 'leave-' + dir);
    }, dir === 'reveal' || dir === 'collapse' ? 620 : 450);
  }
  syncTabs();
  refreshBadge();
}
function go(id, dir) {
  stack.push(id);
  try { history.pushState({ s: id }, ''); } catch (_) {}
  show(id, dir || 'fwd');
}
function goRoot(id) {
  let dir = 'fade';
  if (current && MAIN.includes(current) && MAIN.includes(id)) dir = MAIN.indexOf(id) >= MAIN.indexOf(current) ? 'fwd' : 'back';
  stack = [id];
  try { history.replaceState({ s: id }, ''); } catch (_) {}
  show(id, dir);
}
function back() {
  if (stack.length > 1) { try { history.back(); } catch (_) { stack.pop(); show(stack[stack.length - 1], 'back'); } }
}
window.addEventListener('popstate', () => {
  if (!$('#sheet').hidden) { closeSheet(); }
  if (stack.length > 1) { stack.pop(); show(stack[stack.length - 1], 'back'); }
});

const serviceCards = () => SERVICES.map(s => `
  <button class="svc-card" style="--c:${s.color}" data-service="${s.id}">
    <span class="svc-ic">${ic(s.icon)}</span>
    <span class="svc-txt"><b>${esc(s.name)}</b><small>${esc(s.short)}</small></span>
    ${ic('chev-r', 'ic chev')}
  </button>`).join('');

const detailRows = a => {
  const s = svc(a.serviceId);
  const rows = [
    [s.icon, 'Service', s.title],
    ['dog', 'Pet', `${a.pet.name} (${a.pet.breed || a.pet.species})`],
    ['calendar', 'Date', fmtDate(a.date)],
    ['clock', 'Time', fmtTime(a.time)]
  ];
  return rows.map(([i, k, v]) => `<div class="detail-row"><span class="detail-ic">${ic(i)}</span><div><small>${k}</small><span>${esc(v)}</span></div></div>`).join('');
};

render.home = () => {
  const u = me();
  const first = u.guest ? '' : ', ' + esc(u.name.split(' ')[0]);
  $('#home-greet').innerHTML = `Hello${first}!`;
  const n = upcoming()[0];
  $('#home-next').innerHTML = n
    ? (() => {
        const s = svc(n.serviceId);
        return `<button class="next-card" data-appt="${n.id}"><span class="next-ic">${ic(s.icon)}</span>
          <span><span class="k">Next appointment</span><b>${esc(s.title)} · ${esc(n.pet.name)}</b><small>${fmtDate(n.date, true)} · ${fmtTime(n.time)}</small></span></button>`;
      })()
    : `<div class="empty"><b>No upcoming appointments</b>Book a service for your pet in just a few taps.<button class="btn btn-primary btn-small" data-tab="services">Book now</button></div>`;
  $('#home-services').innerHTML = serviceCards();
};

render.services = () => { $('#services-list').innerHTML = serviceCards(); };

render.service = () => {
  if (!draft) { return; }
  const s = svc(draft.serviceId);
  const el = $('#s-service');
  el.style.setProperty('--accent', s.color);
  el.style.setProperty('--accent-ink', s.dark);
  el.style.setProperty('--accent-btn', s.color);
  el.style.setProperty('--on-accent', '#0b1f44');
  $('#service-body').innerHTML = `
    <div class="carousel" id="carousel">
      <div class="car-stage" id="car-stage">${s.slides.map((sl, i) => `
        <div class="slide ${i ? '' : 'active'}" style="background:linear-gradient(135deg,${sl.g[0]},${sl.g[1]})">
          ${sl.img ? `<img src="${esc(sl.img)}" alt="${esc(sl.cap)}">` : `<span class="slide-emoji">${sl.emoji}</span>`}
          <span class="slide-cap">${esc(sl.cap)}</span>
        </div>`).join('')}</div>
      <button class="car-btn prev" data-car="-1" aria-label="Previous photo">${ic('chev-l')}</button>
      <button class="car-btn next" data-car="1" aria-label="Next photo">${ic('chev-r')}</button>
      <span class="car-count" id="car-count">1/${s.slides.length}</span>
    </div>
    <div class="dots" id="dots">${s.slides.map((_, i) => `<button class="cdot ${i ? '' : 'on'}" data-dot="${i}" aria-label="Photo ${i + 1}"></button>`).join('')}</div>
    <h3 class="svc-title">${esc(s.title)}</h3>
    <p class="svc-desc">${esc(s.desc)}</p>
    <div class="meta">
      <div class="meta-row">${ic('clock')}<span>Estimated duration: ${esc(s.duration)}</span></div>
      <div class="meta-row"><span class="ph"></span><span>Recommended for: ${esc(s.recommended)}</span></div>
      <div class="meta-row"><span class="ph"></span><span>Starting at: ${money(s.price)}</span></div>
    </div>
    <button class="btn btn-primary" data-action="select-service">Select service</button>`;
  carIdx = 0;
  carAuto();
};

const savedPets = () => {
  const seen = new Set(), out = [];
  myAppts().slice().sort((a, b) => b.created - a.created).forEach(a => {
    const k = a.pet.name.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(a.pet); }
  });
  return out;
};
render.pet = () => {
  const f = $('#form-pet');
  const p = draft && draft.pet;
  fld(f, 'name').value = p ? p.name : '';
  fld(f, 'species').value = p ? p.species : 'Dog';
  fld(f, 'breed').value = p ? p.breed : '';
  fld(f, 'age').value = p ? p.age : '';
  fld(f, 'notes').value = p ? p.notes : '';
  $('#err-pet').textContent = '';
  const pets = savedPets();
  const box = $('#saved-pets');
  box.hidden = !pets.length;
  box.innerHTML = pets.length ? `<span style="font-size:13px;font-weight:700;width:100%">Your pets</span>` +
    pets.map((pt, i) => `<button type="button" class="chip" data-pet="${i}">${esc(pt.name)}</button>`).join('') : '';
};

render.datetime = () => {
  if (!draft) return;
  if (!cal) {
    const n = new Date();
    cal = { y: n.getFullYear(), m: n.getMonth() };
  }
  drawCalendar();
  drawSlots(true);
};

function slotState(date, time) {
  if (startMs(date, time) < Date.now() + 30 * 60000) return 'past';
  if (state.appts.some(a => a.status === 'booked' && a.date === date && a.time === time)) return 'taken';
  return 'free';
}
function drawCalendar(dir) {
  const now = new Date();
  const todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const first = new Date(cal.y, cal.m, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(cal.y, cal.m + 1, 0).getDate();
  const diff = (cal.y - now.getFullYear()) * 12 + (cal.m - now.getMonth());
  let h = `<div class="cal-head">
      <button class="cal-nav" data-cal="-1" ${diff <= 0 ? 'disabled' : ''} aria-label="Previous month">${ic('chev-l')}</button>
      <b>${first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b>
      <button class="cal-nav" data-cal="1" ${diff >= MAX_MONTHS_AHEAD ? 'disabled' : ''} aria-label="Next month">${ic('chev-r')}</button>
    </div><div class="cal-grid">`;
  ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].forEach(w => { h += `<div class="cal-dow">${w}</div>`; });
  for (let i = 0; i < offset; i++) h += '<span class="day blank"></span>';
  for (let d = 1; d <= days; d++) {
    const k = dateKey(cal.y, cal.m, d);
    const free = SLOTS.some(t => slotState(k, t) === 'free');
    const cls = ['day'];
    if (k === todayKey) cls.push('today');
    if (draft && k === draft.date) cls.push('sel');
    h += `<button class="${cls.join(' ')}" data-day="${k}" ${free ? '' : 'disabled'} aria-label="${fmtDate(k)}">${d}</button>`;
  }
  $('#cal').innerHTML = h + '</div>';
  if (dir && !reduced()) $('#cal .cal-grid').classList.add(dir > 0 ? 'in-next' : 'in-prev');
}
function drawSlots(force) {
  const el = $('#slots');
  if (!draft.date) {
    el.innerHTML = '<p class="hint">Select a day to see the available times.</p>';
    el.dataset.d = '';
  } else if (force || el.dataset.d !== draft.date) {
    el.dataset.d = draft.date;
    el.innerHTML = SLOTS.map(t => {
      const st = slotState(draft.date, t);
      return `<button class="slot ${draft.time === t ? 'sel' : ''}" data-time="${t}" ${st === 'free' ? '' : 'disabled'} ${st === 'taken' ? 'title="Already booked"' : ''}>${fmtTime(t)}</button>`;
    }).join('');
  } else {
    $$('.slot', el).forEach(b => b.classList.toggle('sel', b.dataset.time === draft.time));
  }
  $('#dt-continue').disabled = !(draft.date && draft.time);
}

render.confirm = () => {
  const a = state.appts.find(x => x.id === lastApptId);
  const body = $('#confirm-body');
  if (!a) { body.innerHTML = ''; setTimeout(() => goRoot('home')); return; }
  const sparks = [['-62deg', '#ff6fa5'], ['-28deg', '#8be04a'], ['18deg', '#19d3f3'], ['58deg', '#ff6fa5'], ['-96deg', '#7a5cff'], ['98deg', '#ffc90e']]
    .map(([r, c]) => `<i class="spark" style="--r:${r};--c:${c}"></i>`).join('');
  const u = me();
  body.innerHTML = `
    <div class="ok-wrap">${sparks}<div class="ok-circle"><svg class="ic check-draw" viewBox="0 0 24 24" aria-hidden="true"><polyline pathLength="1" points="5 13 10 18 19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
    <h3 class="ok-title">Your booking is ready!</h3>
    <p class="ok-sub">Thank you for trusting Pet Care.<br>Here are the details of your appointment:</p>
    <div class="detail-card">${detailRows(a)}</div>
    <div class="code-card"><small>Booking code</small><b>${esc(a.code)}</b>
      <button data-copy="${esc(a.code)}">${ic('copy')} Copy code</button></div>
    ${u && u.guest ? `<div class="notice">${ic('info')}<div>You booked as a guest, so this appointment is saved only on this device.<button data-go="register">Create an account to keep it</button></div></div>` : ''}
    <div class="btn-stack">
      <button class="btn btn-primary" data-tab="appts">View my appointments</button>
      <button class="btn btn-outline" data-tab="home">Back to home</button>
    </div>`;
};

const NOTIF_ICON = { booking: 'check', reminder: 'clock', cancel: 'x', welcome: 'paw', test: 'bell' };

function permCard() {
  if (!('Notification' in window)) {
    return `<div class="perm"><b>System notifications not supported</b>This browser can't show system notifications. You will still see every alert here.</div>`;
  }
  if (Notification.permission === 'denied') {
    return `<div class="perm"><b>Notifications are blocked</b>Allow notifications for this site in your browser settings to get reminders on your phone.</div>`;
  }
  if (state.sys && Notification.permission === 'granted') {
    return `<div class="perm"><b>System notifications are on</b>You get a confirmation when you book and a reminder 24 hours and 1 hour before each appointment while the app is open.
      <button class="btn btn-outline btn-small" data-action="test-notif">Send a test notification</button></div>`;
  }
  return `<div class="perm"><b>Turn on notifications</b>Get a confirmation when you book and reminders before each appointment.
    <button class="btn btn-primary btn-small" data-action="enable-notifs">Enable notifications</button></div>`;
}
const notifHTML = n => `
  <button class="notif ${n.read ? '' : 'unread'}" data-notif="${n.id}">
    <span class="notif-ic t-${esc(n.type)}">${ic(NOTIF_ICON[n.type] || 'bell')}</span>
    <span class="notif-txt"><b>${esc(n.title)}</b><p>${esc(n.body)}</p><small>${ago(n.ts)}</small></span>
    ${n.read ? '' : '<span class="dot"></span>'}
  </button>`;
function alertsHTML() {
  const list = myNotifs();
  const unread = list.filter(n => !n.read).length;
  let h = permCard();
  if (!list.length) {
    return h + `<div class="empty"><b>No notifications yet</b>Booking confirmations and reminders will show up here.</div>`;
  }
  h += `<div class="list-tools"><small>${unread} unread</small><span>
      <button class="link-btn" data-action="mark-read">Mark all as read</button>
      <button class="link-btn" data-action="clear-notifs">Clear</button></span></div>
    <div class="list">${list.map(notifHTML).join('')}</div>`;
  return h;
}
const apptCard = a => {
  const s = svc(a.serviceId), st = apptStatus(a);
  const label = { upcoming: 'Upcoming', done: 'Completed', cancelled: 'Cancelled' }[st];
  return `<button class="appt" style="--c:${s.color}" data-appt="${a.id}">
    <span class="appt-bar"></span>
    <span class="appt-main"><b>${esc(s.title)}</b><p>${esc(a.pet.name)} · ${fmtDate(a.date, true)}, ${fmtTime(a.time)}</p><small>${esc(a.code)}</small></span>
    <span class="appt-side"><span class="status ${st === 'upcoming' ? '' : st}">${label}</span></span></button>`;
};
function apptsHTML() {
  const u = me();
  const list = apptFilter === 'upcoming' ? upcoming() : history_();
  let h = '';
  if (u.guest) h += `<div class="notice">${ic('info')}<div>Guest appointments are saved only on this device.<button data-go="register">Sign up to keep them in your account</button></div></div>`;
  h += `<div class="filters">
      <button class="chip ${apptFilter === 'upcoming' ? 'on' : ''}" data-filter="upcoming">Upcoming (${upcoming().length})</button>
      <button class="chip ${apptFilter === 'history' ? 'on' : ''}" data-filter="history">History (${history_().length})</button></div>`;
  if (!list.length) {
    h += apptFilter === 'upcoming'
      ? `<div class="empty"><b>No upcoming appointments</b>When you book a service it will appear here.<button class="btn btn-primary btn-small" data-tab="services">Book a service</button></div>`
      : `<div class="empty"><b>Nothing here yet</b>Completed and cancelled appointments will appear here.</div>`;
  } else h += `<div class="list">${list.map(apptCard).join('')}</div>`;
  return h;
}
render.inbox = () => {
  $('.seg').dataset.on = inboxSeg;
  $('#seg-alerts').classList.toggle('on', inboxSeg === 'alerts');
  $('#seg-appts').classList.toggle('on', inboxSeg === 'appts');
  $('#seg-alerts').setAttribute('aria-selected', inboxSeg === 'alerts');
  $('#seg-appts').setAttribute('aria-selected', inboxSeg === 'appts');
  $('#inbox-title').textContent = inboxSeg === 'alerts' ? 'Notifications' : 'My appointments';
  const unread = myNotifs().filter(n => !n.read).length;
  $('#seg-count').hidden = !unread;
  $('#seg-count').textContent = unread;
  $('#inbox-body').innerHTML = inboxSeg === 'alerts' ? alertsHTML() : apptsHTML();
  syncTabs();
};

render.profile = () => {
  const u = me();
  const ups = upcoming().length, total = myAppts().length;
  const stats = `<div class="stats"><div class="stat"><b>${ups}</b><span>Upcoming</span></div><div class="stat"><b>${total}</b><span>Total bookings</span></div></div>`;
  const notifCard = `<div class="card"><h4>Notifications</h4>
      <div class="switch-row"><div><b>System notifications</b><p>Confirmations and appointment reminders</p></div>
      <button class="switch" role="switch" data-action="toggle-notifs" aria-checked="${state.sys && 'Notification' in window && Notification.permission === 'granted'}" aria-label="System notifications"></button></div>
    </div>`;
  let h;
  if (u.guest) {
    h = `<div class="avatar">${ic('user')}</div><h2 class="profile-name">Guest</h2><p class="profile-sub">You are browsing without an account</p>
      ${stats}
      <div class="notice">${ic('info')}<div>Appointments made as a guest are saved only on this device. Sign up to keep them in your account.</div></div>
      <div class="btn-stack"><button class="btn btn-primary" data-go="register">Sign up</button><button class="btn btn-outline" data-go="login">Log in</button></div>
      <div class="gap"></div><div class="gap"></div>
      ${notifCard}
      <button class="btn btn-outline" data-action="logout">Exit guest mode</button>`;
  } else {
    h = `<div class="avatar">${esc(u.name.trim().charAt(0).toUpperCase() || '?')}</div><h2 class="profile-name">${esc(u.name)}</h2><p class="profile-sub">${esc(u.email)}</p>
      ${stats}
      <form class="card" id="form-profile" novalidate><h4>My details</h4>
        <label class="field"><span>Full name</span><input name="name" type="text" value="${esc(u.name)}" autocomplete="name"></label>
        <label class="field"><span>E-mail</span><input type="email" value="${esc(u.email)}" readonly></label>
        <label class="field"><span>Phone</span><input name="phone" type="tel" inputmode="tel" value="${esc(u.phone)}" autocomplete="tel"></label>
        <p class="form-error" id="err-profile" role="alert"></p>
        <button class="btn btn-primary" type="submit">Save changes</button></form>
      ${notifCard}
      <div class="btn-stack"><button class="btn btn-outline" data-action="logout">Log out</button></div>`;
  }
  h += `<div class="gap"></div><div class="btn-stack"><button class="btn btn-danger" data-action="reset">Delete all app data</button></div>`;
  $('#profile-body').innerHTML = h;
};

function openAppt(id) {
  const a = state.appts.find(x => x.id === id);
  if (!a) return;
  const s = svc(a.serviceId), st = apptStatus(a);
  openSheet(`<h3>${esc(s.title)} ${st === 'cancelled' ? '(cancelled)' : ''}</h3>
    <div class="detail-card">${detailRows(a)}</div>
    <div class="code-card"><small>Booking code</small><b>${esc(a.code)}</b><button data-copy="${esc(a.code)}">${ic('copy')} Copy code</button></div>
    ${a.pet.notes ? `<p class="msg"><b>Notes:</b> ${esc(a.pet.notes)}</p>` : ''}
    <div class="btn-stack">
      ${st === 'upcoming' ? `<button class="btn btn-danger" data-cancel="${a.id}">Cancel appointment</button>` : ''}
      <button class="btn btn-outline" data-action="close-sheet">Close</button></div>`);
}
function askCancel(id) {
  const a = state.appts.find(x => x.id === id);
  if (!a) return;
  openSheet(`<h3>Cancel this appointment?</h3>
    <p class="msg">${esc(svc(a.serviceId).title)} for ${esc(a.pet.name)} on ${fmtDate(a.date)} at ${fmtTime(a.time)} will be released.</p>
    <div class="btn-stack"><button class="btn btn-danger" data-cancel-yes="${a.id}">Yes, cancel it</button>
    <button class="btn btn-outline" data-action="close-sheet">Keep appointment</button></div>`);
}
function cancelAppt(id) {
  const a = state.appts.find(x => x.id === id);
  if (!a || a.status === 'cancelled') return;
  a.status = 'cancelled';
  save();
  closeSheet();
  notify({
    type: 'cancel', title: 'Appointment cancelled', apptId: a.id,
    body: `${a.pet.name} · ${svc(a.serviceId).title} on ${fmtDate(a.date, true)} at ${fmtTime(a.time)} was cancelled.`
  });
  if (MAIN.includes(current)) render[current]();
  syncTabs();
}

function makeCode(name) {
  const base = name.normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    let r = '';
    for (let i = 0; i < 3; i++) r += chars[Math.floor(Math.random() * chars.length)];
    code = `PC-${new Date().getFullYear()}-${base}${r}`;
  } while (state.appts.some(a => a.code === code));
  return code;
}

function bookNow() {
  if (!draft || !draft.date || !draft.time || !draft.pet) return;
  if (slotState(draft.date, draft.time) !== 'free') {
    toast('That time was just taken. Please pick another one.');
    draft.time = null; drawCalendar(); drawSlots(true);
    return;
  }
  const u = me(); if (!u) return;
  const s = svc(draft.serviceId);
  const t = startMs(draft.date, draft.time), now = Date.now();
  const a = {
    id: uid(), userId: u.id, serviceId: s.id, pet: { ...draft.pet },
    date: draft.date, time: draft.time, code: makeCode(draft.pet.name),
    status: 'booked', created: now,
    r24: t - now <= 24 * 3600e3,
    r1: t - now <= 3600e3
  };
  state.appts.push(a);
  save();
  lastApptId = a.id;
  notify({
    type: 'booking', title: 'Booking confirmed', apptId: a.id,
    body: `${a.pet.name} · ${s.title} — ${fmtDate(a.date, true)} at ${fmtTime(a.time)}. Code ${a.code}.`
  });
  draft = null; cal = null;
  stack = ['home'];
  go('confirm');
}

let swReg = null;
let iconURL = null;
function appIcon() {
  if (iconURL !== null) return iconURL;
  try {
    const c = document.createElement('canvas'); c.width = c.height = 192;
    const g = c.getContext('2d');
    g.fillStyle = '#0f6fff'; g.beginPath(); g.arc(96, 96, 96, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    [[52, 88, 14, 18], [80, 56, 14, 18], [112, 56, 14, 18], [140, 88, 14, 18]].forEach(([x, y, rx, ry]) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); });
    g.beginPath(); g.ellipse(96, 136, 36, 28, 0, 0, Math.PI * 2); g.fill();
    iconURL = c.toDataURL('image/png');
  } catch (_) { iconURL = ''; }
  return iconURL;
}

async function systemNotify(title, body, tag) {
  if (!state.sys || !('Notification' in window) || Notification.permission !== 'granted') return false;
  const opts = { body, tag: String(tag), icon: appIcon() || undefined, badge: appIcon() || undefined, data: { url: location.href } };
  try {
    const reg = swReg || (navigator.serviceWorker && await navigator.serviceWorker.getRegistration());
    if (reg && reg.showNotification) { await reg.showNotification(title, opts); return true; }
  } catch (_) {}
  try { new Notification(title, opts); return true; } catch (_) {}
  return false;
}

function notify({ type, title, body, apptId, userId }) {
  const uidTarget = userId || (me() && me().id);
  if (!uidTarget) return;
  const n = { id: uid(), userId: uidTarget, type, title, body, apptId: apptId || null, ts: Date.now(), read: false };
  state.notifs.unshift(n);
  state.notifs = state.notifs.slice(0, 100);
  save();
  if (me() && me().id === uidTarget) {
    if (type !== 'booking') toast(title);
    systemNotify(title, body, n.id);
  }
  refreshBadge();
  if (current === 'inbox') render.inbox();
}
let lastUnread = 0;
function refreshBadge() {
  const unread = state.session ? myNotifs().filter(n => !n.read).length : 0;
  const b = $('#bell-badge');
  b.hidden = !unread;
  b.textContent = unread > 9 ? '9+' : unread;
  if (unread > lastUnread && !reduced()) {
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    const bell = $('[data-action="bell"]');
    if (bell) { bell.classList.remove('ring'); void bell.offsetWidth; bell.classList.add('ring'); }
  }
  lastUnread = unread;
}

async function setSystemNotifications(on) {
  if (!on) { state.sys = false; save(); return; }
  if (!('Notification' in window)) { toast("This browser doesn't support notifications"); state.sys = false; save(); return; }
  let p = Notification.permission;
  if (p === 'default') { try { p = await Notification.requestPermission(); } catch (_) { p = 'denied'; } }
  state.sys = p === 'granted';
  save();
  if (p === 'denied') toast('Notifications are blocked in your browser settings');
  else if (p === 'granted') systemNotify('Notifications enabled', 'You will get reminders for your appointments.', 'enabled');
}

function checkReminders() {
  const u = me(); if (!u) return;
  const now = Date.now();
  let changed = false;
  state.appts.filter(a => a.userId === u.id && a.status === 'booked').forEach(a => {
    const t = startMs(a.date, a.time);
    const s = svc(a.serviceId);
    const line = `${a.pet.name} · ${s.title} on ${fmtDate(a.date, true)} at ${fmtTime(a.time)}.`;
    if (t <= now) { if (!a.r24 || !a.r1) { a.r24 = a.r1 = true; changed = true; } return; }
    if (!a.r1 && t - now <= 3600e3) {
      a.r1 = a.r24 = true; changed = true;
      notify({ type: 'reminder', title: 'Your appointment is in 1 hour', body: line, apptId: a.id });
    } else if (!a.r24 && t - now <= 24 * 3600e3) {
      a.r24 = true; changed = true;
      notify({ type: 'reminder', title: 'Reminder: appointment in 24 hours', body: line, apptId: a.id });
    }
  });
  if (changed) save();
}

function adoptGuestData(newId) {
  let moved = 0;
  state.appts.forEach(a => { if (a.userId === 'guest') { a.userId = newId; moved++; } });
  state.notifs.forEach(n => { if (n.userId === 'guest') n.userId = newId; });
  return moved;
}
function startGuest() {
  state.session = { id: 'guest', guest: true };
  save();
  goRoot('home');
  toast('Browsing as guest');
}
function logout() {
  state.session = null; draft = null; cal = null; save();
  $$('form').forEach(f => f.reset());
  stack = []; closeDrawer(); closeSheet();
  goRoot('welcome');
}
function resetAll() {
  try { localStorage.removeItem(KEY); } catch (_) {}
  state = fresh(); draft = null; cal = null;
  closeSheet();
  goRoot('welcome');
  toast('All app data deleted');
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-go],[data-back],[data-action],[data-tab],[data-service],[data-notif],[data-appt],[data-seg],[data-filter],[data-time],[data-day],[data-cal],[data-car],[data-dot],[data-pet],[data-cancel],[data-cancel-yes],[data-copy]');
  if (!el || el.disabled) return;
  const d = el.dataset;

  if (d.go) { go(d.go); return; }
  if ('back' in d) { back(); return; }
  if (d.tab) {
    if (d.tab === 'appts') { inboxSeg = 'appts'; goRoot('inbox'); }
    else if (d.tab === 'alerts') { inboxSeg = 'alerts'; goRoot('inbox'); }
    else goRoot(d.tab);
    return;
  }
  if (d.service) {
    draft = { serviceId: d.service, pet: null, date: null, time: null };
    cal = null;
    const sr = $('#screens').getBoundingClientRect(), cr = el.getBoundingClientRect();
    revealOrigin = { t: cr.top - sr.top, r: sr.right - cr.right, b: sr.bottom - cr.bottom, l: cr.left - sr.left };
    go('service', 'reveal');
    return;
  }
  if (d.action) {
    switch (d.action) {
      case 'guest': startGuest(); break;
      case 'menu': ($('#drawer').hidden || $('#drawer').classList.contains('closing')) ? openDrawer() : closeDrawer(); break;
      case 'close-drawer': closeDrawer(); break;
      case 'close-sheet': closeSheet(); break;
      case 'bell': inboxSeg = 'alerts'; goRoot('inbox'); break;
      case 'select-service': if (draft) go('pet'); break;
      case 'mark-read': myNotifs().forEach(n => { n.read = true; }); save(); render.inbox(); refreshBadge(); break;
      case 'clear-notifs': { const u = me(); state.notifs = state.notifs.filter(n => n.userId !== u.id); save(); render.inbox(); refreshBadge(); break; }
      case 'enable-notifs': setSystemNotifications(true).then(() => { if (current === 'inbox') render.inbox(); }); break;
      case 'toggle-notifs': {
        const on = el.getAttribute('aria-checked') !== 'true';
        setSystemNotifications(on).then(() => render.profile());
        break;
      }
      case 'test-notif':
        notify({ type: 'test', title: 'Test notification', body: 'System notifications are working on this device.' });
        break;
      case 'logout': logout(); break;
      case 'reset': askSheet('Delete all app data?', 'This removes every account, appointment and notification stored on this device. It cannot be undone.', 'Yes, delete everything', 'reset-yes'); break;
      case 'reset-yes': resetAll(); break;
    }
    return;
  }
  if (d.notif) {
    const n = state.notifs.find(x => x.id === d.notif);
    if (n) { n.read = true; save(); refreshBadge(); render.inbox(); if (n.apptId) openAppt(n.apptId); }
    return;
  }
  if (d.appt) { openAppt(d.appt); return; }
  if (d.seg) { inboxSeg = d.seg; render.inbox(); return; }
  if (d.filter) { apptFilter = d.filter; render.inbox(); return; }
  if (d.day) {
    draft.date = d.day;
    if (draft.time && slotState(draft.date, draft.time) !== 'free') draft.time = null;
    drawCalendar(); drawSlots();
    return;
  }
  if (d.time) { draft.time = d.time; drawSlots(); return; }
  if (d.cal) {
    cal.m += Number(d.cal);
    if (cal.m < 0) { cal.m = 11; cal.y--; }
    if (cal.m > 11) { cal.m = 0; cal.y++; }
    drawCalendar(Number(d.cal));
    return;
  }
  if (d.car) { const dir = Number(d.car); carGo(carIdx + dir, dir); return; }
  if (d.dot !== undefined) { carGo(Number(d.dot)); return; }
  if (d.pet !== undefined) {
    const p = savedPets()[Number(d.pet)]; if (!p) return;
    const f = $('#form-pet');
    fld(f, 'name').value = p.name; fld(f, 'species').value = p.species; fld(f, 'breed').value = p.breed || ''; fld(f, 'age').value = p.age || ''; fld(f, 'notes').value = p.notes || '';
    $$('#saved-pets .chip').forEach(c => c.classList.toggle('on', c === el));
    return;
  }
  if (d.cancel) { askCancel(d.cancel); return; }
  if (d.cancelYes) { cancelAppt(d.cancelYes); return; }
  if (d.copy) {
    const done = () => toast('Booking code copied');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(d.copy).then(done, () => toast(d.copy));
    else toast(d.copy);
  }
});

document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;

  if (f.id === 'form-register') {
    const name = fld(f, 'name').value.trim(), email = fld(f, 'email').value.trim().toLowerCase(), phone = fld(f, 'phone').value.trim();
    const err = $('#err-register');
    if (name.length < 2) { err.textContent = 'Please enter your full name.'; return; }
    if (!emailOk(email)) { err.textContent = 'Please enter a valid e-mail.'; return; }
    if (digits(phone).length < 7 || digits(phone).length > 15) { err.textContent = 'Please enter a valid phone number.'; return; }
    if (state.users.some(u => u.email === email)) { err.textContent = 'An account with this e-mail already exists. Try logging in.'; return; }
    err.textContent = '';
    const wasGuest = state.session && state.session.guest;
    const user = { id: uid(), name, email, phone, created: Date.now() };
    state.users.push(user);
    state.session = { id: user.id };
    const moved = wasGuest ? adoptGuestData(user.id) : 0;
    save();
    f.reset();
    notify({ type: 'welcome', title: `Welcome to Pet Care, ${name.split(' ')[0]}!`, body: 'Pick a service and book your first appointment.', userId: user.id });
    goRoot('home');
    toast(moved ? 'Account created. Your guest appointments were added.' : 'Account created');
    return;
  }

  if (f.id === 'form-login') {
    const email = fld(f, 'email').value.trim().toLowerCase(), phone = digits(fld(f, 'phone').value);
    const err = $('#err-login');
    if (!emailOk(email) || phone.length < 7) { err.textContent = 'Enter the e-mail and phone you signed up with.'; return; }
    const user = state.users.find(u => u.email === email && digits(u.phone) === phone);
    if (!user) { err.textContent = "We couldn't find an account with those details."; return; }
    err.textContent = '';
    const wasGuest = state.session && state.session.guest;
    state.session = { id: user.id };
    const moved = wasGuest ? adoptGuestData(user.id) : 0;
    save();
    f.reset();
    goRoot('home');
    toast(moved ? 'Welcome back! Your guest appointments were added.' : `Welcome back, ${user.name.split(' ')[0]}!`);
    checkReminders();
    return;
  }

  if (f.id === 'form-pet') {
    const err = $('#err-pet');
    const pet = { name: fld(f, 'name').value.trim(), species: fld(f, 'species').value, breed: fld(f, 'breed').value.trim(), age: fld(f, 'age').value, notes: fld(f, 'notes').value.trim() };
    if (!pet.name) { err.textContent = "Please enter your pet's name."; return; }
    if (!pet.age) { err.textContent = "Please select your pet's age."; return; }
    err.textContent = '';
    draft.pet = pet;
    go('datetime');
    return;
  }

  if (f.id === 'form-profile') {
    const name = fld(f, 'name').value.trim(), phone = fld(f, 'phone').value.trim();
    const err = $('#err-profile');
    if (name.length < 2) { err.textContent = 'Please enter your full name.'; return; }
    if (digits(phone).length < 7 || digits(phone).length > 15) { err.textContent = 'Please enter a valid phone number.'; return; }
    const u = me(); u.name = name; u.phone = phone; save();
    render.profile();
    toast('Profile updated');
  }
});

$('#dt-continue').addEventListener('click', bookNow);

document.addEventListener('pointerdown', e => {
  if (reduced()) return;
  const t = e.target.closest('.btn, .svc-card, .tabbar button, .chip, .notif, .appt, .slot, .day, .next-card');
  if (!t || t.disabled) return;
  const r = t.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2;
  const s = document.createElement('span');
  s.className = 'ripple';
  s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  t.appendChild(s);
  setTimeout(() => s.remove(), 650);
});

let swipeX = null;
document.addEventListener('pointerdown', e => { swipeX = (e.target.closest('#carousel') && !e.target.closest('.car-btn')) ? e.clientX : null; });
document.addEventListener('pointerup', e => {
  if (swipeX === null) return;
  const dx = e.clientX - swipeX; swipeX = null;
  if (Math.abs(dx) > 40) carGo(carIdx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeSheet(); closeDrawer(); }
});

/* ---------------------------------------------------------- Lava Lamp (WebGL con Three.js) */
class LavaWebGL {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.uniforms = {
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2(container.clientWidth, container.clientHeight) }
    };

    const vertexShader = `void main() { gl_Position = vec4(position, 1.0); }`;
    const fragmentShader = `
      uniform float u_time;
      uniform vec2 u_resolution;
      vec2 random2(vec2 st){ st = vec2( dot(st,vec2(127.1,311.7)), dot(st,vec2(269.5,183.3)) ); return -1.0 + 2.0*fract(sin(st)*43758.5453123); }
      float noise(vec2 st) {
          vec2 i = floor(st); vec2 f = fract(st); vec2 u = f*f*(3.0-2.0*f);
          return mix( mix( dot( random2(i + vec2(0.0,0.0) ), f - vec2(0.0,0.0) ), dot( random2(i + vec2(1.0,0.0) ), f - vec2(1.0,0.0) ), u.x),
                      mix( dot( random2(i + vec2(0.0,1.0) ), f - vec2(0.0,1.0) ), dot( random2(i + vec2(1.0,1.0) ), f - vec2(1.0,1.0) ), u.x), u.y);
      }
      void main() {
        vec2 st = gl_FragCoord.xy / u_resolution.xy;
        st.x *= u_resolution.x / u_resolution.y;
        float t = u_time * 0.15;
        float d = 0.0;
        vec2 p1 = vec2(0.5 + sin(t * 1.1) * 0.3, 0.5 + cos(t * 0.9) * 0.3); d += 0.08 / distance(st, p1);
        vec2 p2 = vec2(0.5 + cos(t * 0.7) * 0.4, 0.5 + sin(t * 1.2) * 0.2); d += 0.07 / distance(st, p2);
        vec2 p3 = vec2(0.5 + sin(t * 0.5 + 2.0) * 0.2, 0.5 + cos(t * 0.8 + 1.0) * 0.4); d += 0.09 / distance(st, p3);
        vec2 p4 = vec2(0.5 + cos(t * 1.3 + 4.0) * 0.35, 0.5 + sin(t * 0.6 + 3.0) * 0.35); d += 0.06 / distance(st, p4);
        vec2 p5 = vec2(0.5 + sin(t * 1.5 + 5.0) * 0.15, 0.5 + cos(t * 1.1 + 5.0) * 0.15); d += 0.04 / distance(st, p5);
        vec2 p6 = vec2(0.5 + cos(t * 0.9 + 1.0) * 0.25, 0.5 + sin(t * 1.4 + 2.0) * 0.25); d += 0.05 / distance(st, p6);
        d += noise(st * 3.0 + u_time * 0.2) * 0.015;
        vec3 colorA = vec3(0.93, 0.96, 1.00);
        vec3 colorB = vec3(0.66, 0.82, 1.00);
        vec3 color = mix(colorA, colorB, st.y);
        float alpha = smoothstep(1.00, 1.05, d);
        gl_FragColor = vec4(color, alpha);
      }
    `;

    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    this.animate();

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.uniforms.u_resolution.value.set(w, h);
  }

  animate() {
    requestAnimationFrame(this.animate);
    this.uniforms.u_time.value = this.clock.getElapsedTime();
    this.renderer.render(this.scene, this.camera);
  }
}

const lavaContainers = ['lava-bg-global'];
lavaContainers.forEach(id => {
  const el = document.getElementById(id);
  if (el) new LavaWebGL(el);
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').then(r => { swReg = r; }).catch(() => {});
}

setInterval(checkReminders, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkReminders(); if (current === 'inbox') render.inbox(); } });
window.addEventListener('focus', checkReminders);

if (me()) { goRoot('home'); checkReminders(); } else { state.session = null; goRoot('welcome'); }
})();