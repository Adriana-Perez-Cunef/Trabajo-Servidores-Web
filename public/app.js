'use strict';

/* =========================================================================
   HIVE · frontend (SPA en JavaScript puro)
   Toda la interfaz se construye con el DOM (textContent), nunca con innerHTML
   sobre datos de usuario, para evitar XSS.
   ========================================================================= */

const root = document.getElementById('app');
const state = { token: null, user: null };

/* ---------- Utilidades de DOM ---------- */

function h(tag, props, ...children) {
  const node = document.createElement(tag);
  Object.entries(props || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) return;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  });
  children.flat().forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return node;
}

// Los iconos son marcado SVG estático (nunca contienen datos de usuario)
const ICONS = {
  home: '<path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z"/>',
  pin: '<path d="M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14c3 .2 5 2 5 5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
  camera: '<path d="M4 8h4l2-3h4l2 3h4v12H4z"/><circle cx="12" cy="14" r="3.5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 118 0v3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
};

function icon(name, size = 24) {
  const wrap = document.createElement('span');
  wrap.className = 'icon';
  wrap.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  return wrap;
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/* Lee los campos de un formulario (name -> value) */
function readForm(form) {
  const data = {};
  Array.from(form.elements).forEach((el) => {
    if (el.name) data[el.name] = el.value;
  });
  return data;
}

/* ---------- Sesión y API ---------- */

function loadSession() {
  try {
    state.token = localStorage.getItem('hive_token');
    state.user = JSON.parse(localStorage.getItem('hive_user') || 'null');
  } catch (e) {
    state.token = null;
    state.user = null;
  }
}

function saveSession() {
  try {
    if (state.token) {
      localStorage.setItem('hive_token', state.token);
      localStorage.setItem('hive_user', JSON.stringify(state.user));
    } else {
      localStorage.removeItem('hive_token');
      localStorage.removeItem('hive_user');
    }
  } catch (e) { /* almacenamiento no disponible */ }
}

let toastTimer;
function toast(message, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && state.token) {
    logout();
    throw new Error('Tu sesión ha caducado, vuelve a entrar');
  }
  if (!res.ok) {
    const detail = data.details && data.details[0] ? `: ${data.details[0].message}` : '';
    throw new Error((data.error || 'Error inesperado') + detail);
  }
  return data;
}

function go(path) {
  const target = `#/${path}`;
  if (location.hash === target) route();
  else location.hash = target;
}

function startSession(data) {
  state.token = data.token;
  state.user = data.user;
  saveSession();
  go('home');
}

function logout() {
  state.token = null;
  state.user = null;
  saveSession();
  go('login');
}

/* ---------- Formato ---------- */

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const fmtDay = (iso) => new Date(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtLong = (iso) => capitalize(new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
const price = (tier) => '$'.repeat(tier);

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function monthKey(date) {
  return dayKey(date).slice(0, 7);
}
function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}
function shortDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/* ---------- Componentes ---------- */

function logo(small = false) {
  return h('div', { class: `logo${small ? ' small' : ''}` },
    h('span', { class: 'logo-main' }, 'HIVE'),
    h('span', { class: 'logo-sub' }, 'MADRID', h('em', null, 'clubs')));
}

function avatar(user, size = 44) {
  const box = h('div', { class: 'avatar', 'aria-hidden': 'true' });
  box.style.width = `${size}px`;
  box.style.height = `${size}px`;
  box.style.fontSize = `${Math.round(size * 0.42)}px`;
  box.textContent = (user.username || '?').charAt(0).toUpperCase();
  return box;
}

const GRADIENTS = [
  'linear-gradient(135deg,#7a0d0d,#e0301e 55%,#ff8a3d)',
  'linear-gradient(135deg,#2b0a4a,#7b2cbf 55%,#ff4d8d)',
  'linear-gradient(135deg,#0a1f44,#1f6feb 55%,#7ee0ff)',
  'linear-gradient(135deg,#3a0f0f,#b3261e 50%,#1a1a1a)',
  'linear-gradient(135deg,#1a1a1a,#d62f2f 60%,#ff7a59)',
];

function setMedia(el, event) {
  const shade = 'linear-gradient(rgba(0,0,0,0) 35%, rgba(0,0,0,0.85))';
  el.style.backgroundImage = `${shade}, ${GRADIENTS[event.id % GRADIENTS.length]}`;
}

function eventCard(e, variant = 'small') {
  const media = h('div', { class: 'ev-media' });
  setMedia(media, e);
  const crowd = e.friendsGoing > 0
    ? `A ${e.friendsGoing} ${e.friendsGoing === 1 ? 'amigo' : 'amigos'} les interesa`
    : `${e.attendees} ${e.attendees === 1 ? 'persona va' : 'personas van'}`;
  media.append(
    h('div', { class: 'ev-info' },
      h('strong', { class: 'ev-name' }, e.title),
      h('span', { class: 'ev-sub' }, `${fmtDay(e.startsAt)} · ${fmtTime(e.startsAt)} · ${e.venue}`),
      variant === 'wide' ? h('span', { class: 'ev-sub' }, `${e.address ? `${e.address}, ` : ''}${e.city} · ${price(e.priceTier)}`) : null,
      h('span', { class: 'ev-sub' }, crowd)),
    h('span', { class: 'btn small' }, 'VER MÁS'));
  return h('a', { class: `ev-card ${variant}`, href: `#/event/${e.id}` }, media);
}

function topbar({ back = false, title = '', right = null, overlay = false } = {}) {
  return h('header', { class: `topbar${overlay ? ' overlay' : ''}` },
    back
      ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Volver', onclick: () => history.back() }, icon('back'))
      : h('span', { class: 'topbar-spacer' }),
    title ? h('h1', { class: 'topbar-title' }, title) : h('span'),
    right || h('span', { class: 'topbar-spacer' }));
}

const TABS = [
  ['home', 'home', 'Inicio'],
  ['search', 'pin', 'Buscar'],
  ['create', 'plus', 'Crear evento'],
  ['friends', 'users', 'Amigos'],
  ['me', 'user', 'Mi perfil'],
];

function tabbar(active) {
  return h('nav', { class: 'tabbar', 'aria-label': 'Navegación principal' },
    TABS.map(([key, ico, label]) =>
      h('a', { class: `tab${active === key ? ' on' : ''}`, href: `#/${key}`, 'aria-label': label, 'aria-current': active === key ? 'page' : null }, icon(ico, 26))));
}

function mount(content, { tab = null, nav = true } = {}) {
  const screen = h('div', { class: 'screen' }, content);
  root.replaceChildren(...(nav && state.user ? [screen, tabbar(tab)] : [screen]));
  window.scrollTo(0, 0);
}

const loading = () => h('div', { class: 'loading' }, 'Cargando…');
const section = (title, content) => h('section', { class: 'section' }, h('h2', null, title), content);

function followButton(user, onChange) {
  const btn = h('button', { class: 'btn small', type: 'button' });
  const paint = () => {
    btn.textContent = user.relation === 'accepted' ? 'SIGUIENDO' : user.relation === 'pending' ? 'PENDIENTE' : 'SEGUIR';
    btn.classList.toggle('ghost', user.relation !== 'none');
  };
  btn.addEventListener('click', async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    btn.disabled = true;
    try {
      if (user.relation === 'none') {
        const result = await api(`/users/${user.id}/follow`, { method: 'POST' });
        user.relation = result.status;
      } else {
        await api(`/users/${user.id}/follow`, { method: 'DELETE' });
        user.relation = 'none';
      }
      paint();
      if (onChange) onChange();
    } catch (err) {
      toast(err.message, true);
    }
    btn.disabled = false;
  });
  paint();
  return btn;
}

function personRow(user, extra) {
  return h('a', { class: 'person', href: `#/user/${user.id}` },
    avatar(user, 46),
    h('div', { class: 'person-info' },
      h('strong', null, user.username),
      h('span', { class: 'muted tiny' }, user.fullName || '')),
    extra);
}

/* =========================================================================
   Páginas
   ========================================================================= */

/* ---------- Bienvenida, login y registro ---------- */

function pageWelcome() {
  mount(h('div', { class: 'welcome' },
    logo(),
    h('div', { class: 'stack' },
      h('a', { class: 'btn block', href: '#/login' }, 'INICIAR SESIÓN'),
      h('a', { class: 'btn block', href: '#/register' }, 'REGISTRARSE')),
    h('div', { class: 'disco' })), { nav: false });
}

function pageLogin() {
  const form = h('form', {
    class: 'form', method: 'post', action: '#/login',
    onsubmit: async (e) => {
      e.preventDefault();
      const data = readForm(form);
      try {
        startSession(await api('/auth/login', { method: 'POST', body: data }));
      } catch (err) {
        toast(err.message, true);
      }
    },
  },
    h('input', { class: 'field', name: 'email', type: 'email', placeholder: 'Correo electrónico', required: true, autocomplete: 'email', 'aria-label': 'Correo electrónico' }),
    h('input', { class: 'field', name: 'password', type: 'password', placeholder: 'Contraseña', required: true, autocomplete: 'current-password', 'aria-label': 'Contraseña' }),
    h('button', { class: 'btn block', type: 'submit' }, 'INICIAR SESIÓN'));
  mount(h('div', { class: 'auth' },
    logo(),
    form,
    h('p', { class: 'hint' }, '¿No tienes cuenta? ', h('a', { href: '#/register' }, 'Regístrate')),
    h('div', { class: 'disco' })), { nav: false });
}

function pageRegister() {
  const form = h('form', {
    class: 'form', method: 'post', action: '#/register',
    onsubmit: async (e) => {
      e.preventDefault();
      const data = readForm(form);
      try {
        startSession(await api('/auth/register', { method: 'POST', body: data }));
      } catch (err) {
        toast(err.message, true);
      }
    },
  },
    h('input', { class: 'field', name: 'username', placeholder: 'Nombre de usuario', required: true, minlength: '3', maxlength: '30', pattern: '[A-Za-z0-9_]+', autocomplete: 'username', 'aria-label': 'Nombre de usuario' }),
    h('input', { class: 'field', name: 'email', type: 'email', placeholder: 'Correo electrónico', required: true, autocomplete: 'email', 'aria-label': 'Correo electrónico' }),
    h('input', { class: 'field', name: 'password', type: 'password', placeholder: 'Contraseña (mín. 8)', required: true, minlength: '8', maxlength: '72', autocomplete: 'new-password', 'aria-label': 'Contraseña' }),
    h('input', { class: 'field', name: 'confirmPassword', type: 'password', placeholder: 'Confirmar contraseña', required: true, autocomplete: 'new-password', 'aria-label': 'Confirmar contraseña' }),
    h('button', { class: 'btn block', type: 'submit' }, 'REGISTRARSE'));
  mount(h('div', { class: 'auth' },
    logo(),
    form,
    h('p', { class: 'hint' }, '¿Ya tienes cuenta? ', h('a', { href: '#/login' }, 'Inicia sesión')),
    h('div', { class: 'disco' })), { nav: false });
}

/* ---------- Inicio ---------- */

async function pageHome() {
  mount(loading(), { tab: 'home' });
  const data = await api('/events/home');
  const weekday = new Date().toLocaleDateString('es-ES', { weekday: 'long' });
  const recommended = data.recommended.filter((e) => !data.today || e.id !== data.today.id);

  const blocks = [];
  if (data.today) blocks.push(section('Evento del día', eventCard(data.today, 'big')));
  if (recommended.length) {
    blocks.push(section('Recomendados', h('div', { class: 'hscroll' }, recommended.map((e) => eventCard(e)))));
  }
  if (data.friends.length) {
    blocks.push(section('Planes de tus amigos', h('div', { class: 'hscroll' }, data.friends.map((e) => eventCard(e)))));
  }
  if (!blocks.length) {
    blocks.push(h('p', { class: 'empty' }, 'Todavía no hay eventos. Crea el primero con el botón +.'));
  }

  mount(h('div', { class: 'page' },
    h('header', { class: 'home-head' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Ajustes', onclick: () => go('settings') }, icon('menu')),
      logo(true),
      h('span', { class: 'topbar-spacer' })),
    h('p', { class: 'greeting' }, `Hoy es ${weekday}… ¿Listo para salir?`),
    blocks), { tab: 'home' });
}

/* ---------- Buscador con filtros y calendario ---------- */

const S = { q: '', date: null, price: null, city: '', panel: null, calMonth: null };

async function pageSearch() {
  if (!S.calMonth) S.calMonth = monthKey(new Date());
  let seq = 0;

  const results = h('div', { class: 'results' });
  const panel = h('div', { class: 'panel' });
  const chips = h('div', { class: 'chips' });
  const input = h('input', { class: 'search-input', type: 'search', placeholder: 'Buscar discotecas, fiestas, DJs…', value: S.q, 'aria-label': 'Buscar' });
  input.addEventListener('input', debounce(() => { S.q = input.value.trim(); loadResults(); }, 300));

  function chip(label, value, key) {
    const on = S.panel === key || Boolean(value);
    return h('button', {
      type: 'button', class: `chip${on ? ' on' : ''}`,
      onclick: () => { S.panel = S.panel === key ? null : key; renderChips(); renderPanel(); },
    }, value ? `${label}: ${value}` : label);
  }

  function renderChips() {
    chips.replaceChildren(
      chip('FECHA', S.date ? shortDate(S.date) : '', 'date'),
      chip('PRECIO', S.price ? price(S.price) : '', 'price'),
      chip('CIUDAD', S.city, 'city'));
  }

  async function renderPanel() {
    panel.replaceChildren();
    if (S.panel === 'price') {
      const options = [null, 1, 2, 3].map((tier) =>
        h('button', {
          type: 'button', class: `chip${S.price === tier ? ' on' : ''}`,
          onclick: () => { S.price = tier; renderChips(); renderPanel(); loadResults(); },
        }, tier ? price(tier) : 'TODOS'));
      panel.append(h('div', { class: 'panel-box price-row' }, options));
    } else if (S.panel === 'city') {
      const cityInput = h('input', { class: 'field', placeholder: 'Ciudad (ej. Madrid)', value: S.city, 'aria-label': 'Ciudad' });
      cityInput.addEventListener('input', debounce(() => { S.city = cityInput.value.trim(); renderChips(); loadResults(); }, 300));
      panel.append(h('div', { class: 'panel-box' }, cityInput));
    } else if (S.panel === 'date') {
      await renderCalendar();
    }
  }

  async function renderCalendar() {
    const [y, m] = S.calMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const next = new Date(y, m, 1);
    let events = [];
    try {
      ({ events } = await api(`/events?from=${encodeURIComponent(first.toISOString())}&to=${encodeURIComponent(next.toISOString())}&limit=200`));
    } catch (err) {
      toast(err.message, true);
    }
    const byDay = {};
    events.forEach((e) => {
      const key = dayKey(new Date(e.startsAt));
      (byDay[key] = byDay[key] || []).push(e);
    });

    const grid = h('div', { class: 'cal-grid' }, ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => h('div', { class: 'cal-wd' }, d)));
    for (let i = 0; i < (first.getDay() + 6) % 7; i += 1) grid.append(h('div'));
    const daysInMonth = new Date(y, m, 0).getDate();
    for (let n = 1; n <= daysInMonth; n += 1) {
      const key = `${S.calMonth}-${String(n).padStart(2, '0')}`;
      const list = byDay[key] || [];
      const classes = ['cal-day', list.length ? 'has' : '', list.some((e) => e.going) ? 'mine' : '', S.date === key ? 'sel' : ''];
      grid.append(h('button', {
        type: 'button',
        class: classes.filter(Boolean).join(' '),
        'aria-label': `${n}: ${list.length} ${list.length === 1 ? 'evento' : 'eventos'}`,
        onclick: () => { S.date = S.date === key ? null : key; renderChips(); renderPanel(); loadResults(); },
      }, String(n), list.length ? h('span', { class: 'cal-dot' }) : null));
    }

    const title = capitalize(first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));
    panel.replaceChildren(h('div', { class: 'panel-box' },
      h('div', { class: 'cal-head' },
        h('button', { class: 'cal-nav', type: 'button', 'aria-label': 'Mes anterior', onclick: () => { S.calMonth = shiftMonth(S.calMonth, -1); renderPanel(); } }, '‹'),
        h('strong', null, title),
        h('button', { class: 'cal-nav', type: 'button', 'aria-label': 'Mes siguiente', onclick: () => { S.calMonth = shiftMonth(S.calMonth, 1); renderPanel(); } }, '›')),
      grid,
      h('div', { class: 'cal-legend' }, h('span', null, '● hay eventos'), h('span', null, '◯ voy a ir'))));
  }

  async function loadResults() {
    const current = ++seq;
    const params = new URLSearchParams({ limit: '100' });
    if (S.q) params.set('q', S.q);
    if (S.date) {
      const [y, m, d] = S.date.split('-').map(Number);
      params.set('from', new Date(y, m - 1, d).toISOString());
      params.set('to', new Date(y, m - 1, d + 1).toISOString());
    }
    if (S.price) params.set('price', S.price);
    if (S.city) params.set('city', S.city);

    try {
      const { events } = await api(`/events?${params}`);
      const people = S.q.length >= 2 ? (await api(`/users/search?q=${encodeURIComponent(S.q)}`)).users : [];
      if (current !== seq) return;

      results.replaceChildren();
      if (events.length) results.append(...events.map((e) => eventCard(e, 'wide')));
      if (!events.length && !people.length) {
        results.append(h('p', { class: 'empty' }, 'No hay eventos con esos filtros.'));
      }
      if (people.length) {
        results.append(h('h3', null, 'Personas'), ...people.map((u) => personRow(u, followButton(u))));
      }
    } catch (err) {
      if (current === seq) toast(err.message, true);
    }
  }

  mount(h('div', { class: 'page' },
    h('div', { class: 'search-head' }, h('span', { class: 'search-ico' }, icon('search', 18)), input),
    chips, panel, results), { tab: 'search' });
  renderChips();
  renderPanel();
  loadResults();
}

/* ---------- Detalle de evento ---------- */

async function pageEvent(id) {
  mount(loading(), { tab: 'search' });
  const { event: e, friendsGoingUsers } = await api(`/events/${id}`);
  const canDelete = e.creatorId === state.user.id || state.user.role === 'admin';

  const hero = h('div', { class: 'hero' });
  setMedia(hero, e);
  hero.append(topbar({ back: true, overlay: true }));

  const goBtn = h('button', { class: `btn block${e.going ? ' ghost' : ''}`, type: 'button' }, e.going ? 'VOY ✓ · CANCELAR' : 'ASISTIRÉ');
  goBtn.addEventListener('click', async () => {
    goBtn.disabled = true;
    try {
      await api(`/events/${e.id}/attend`, { method: e.going ? 'DELETE' : 'POST' });
      await pageEvent(id);
    } catch (err) {
      toast(err.message, true);
      goBtn.disabled = false;
    }
  });

  const info = (label, value) => h('div', { class: 'info-row' }, h('span', null, label), h('span', null, value));
  const content = h('div', { class: 'content' },
    h('h2', { class: 'ev-title' }, e.title),
    h('p', { class: 'muted tiny' }, `${e.attendees} ${e.attendees === 1 ? 'persona asistirá' : 'personas asistirán'}`),
    h('div', { class: 'info-list' },
      info('Fecha', `${fmtLong(e.startsAt)} · ${fmtTime(e.startsAt)}`),
      info('Lugar', `${e.venue}${e.address ? `, ${e.address}` : ''}, ${e.city}`),
      info('Precio', price(e.priceTier)),
      e.genre ? info('Género', e.genre) : null),
    e.description ? h('p', { class: 'desc' }, e.description) : null,
    friendsGoingUsers.length
      ? h('div', null,
        h('p', { class: 'muted tiny' }, 'Tus amigos que van'),
        h('div', { class: 'friends-going' }, friendsGoingUsers.map((u) =>
          h('a', { class: 'friend-chip', href: `#/user/${u.id}` }, avatar(u, 28), `@${u.username}`))))
      : null,
    goBtn,
    h('p', { class: 'muted tiny center', style: 'margin-top:14px' }, 'Publicado por ', h('a', { class: 'accent', href: `#/user/${e.creatorId}` }, `@${e.creatorUsername}`)),
    canDelete
      ? h('button', {
        class: 'btn small ghost', type: 'button', style: 'margin:14px auto 0;display:flex',
        onclick: async () => {
          if (!window.confirm('¿Seguro que quieres borrar este evento?')) return;
          try {
            await api(`/events/${e.id}`, { method: 'DELETE' });
            toast('Evento borrado');
            go('search');
          } catch (err) {
            toast(err.message, true);
          }
        },
      }, 'BORRAR EVENTO')
      : null);

  mount(h('div', null, hero, content), { tab: 'search' });
}

/* ---------- Crear evento ---------- */

function pageCreate() {
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  const form = h('form', {
    class: 'form', method: 'post', action: '#/create',
    onsubmit: async (e) => {
      e.preventDefault();
      const data = readForm(form);
      const body = {
        title: data.title,
        venue: data.venue,
        address: data.address,
        city: data.city,
        startsAt: new Date(`${data.date}T${data.time}`).toISOString(),
        priceTier: data.priceTier,
        genre: data.genre,
        description: data.description,
      };
      submit.disabled = true;
      try {
        const { event } = await api('/events', { method: 'POST', body });
        toast('Evento publicado');
        go(`event/${event.id}`);
      } catch (err) {
        toast(err.message, true);
        submit.disabled = false;
      }
    },
  },
    h('input', { class: 'field', name: 'title', placeholder: 'Nombre del evento', required: true, minlength: '3', maxlength: '80', 'aria-label': 'Nombre del evento' }),
    h('input', { class: 'field', name: 'venue', placeholder: 'Sala o discoteca', required: true, maxlength: '80', 'aria-label': 'Sala o discoteca' }),
    h('input', { class: 'field', name: 'address', placeholder: 'Dirección', maxlength: '120', 'aria-label': 'Dirección' }),
    h('input', { class: 'field', name: 'city', placeholder: 'Ciudad', value: 'Madrid', required: true, maxlength: '60', 'aria-label': 'Ciudad' }),
    h('label', null, 'Fecha',
      h('input', { class: 'field', name: 'date', type: 'date', required: true, min: today })),
    h('label', null, 'Hora',
      h('input', { class: 'field', name: 'time', type: 'time', required: true, value: '23:00' })),
    h('label', null, 'Precio',
      h('select', { class: 'field', name: 'priceTier' },
        h('option', { value: '1' }, '$ · Económico'),
        h('option', { value: '2', selected: true }, '$$ · Medio'),
        h('option', { value: '3' }, '$$$ · Premium'))),
    h('input', { class: 'field', name: 'genre', placeholder: 'Género (Techno, House, Pop…)', maxlength: '40', 'aria-label': 'Género' }),
    h('textarea', { class: 'field', name: 'description', placeholder: 'Descripción', maxlength: '600', 'aria-label': 'Descripción' }));
  const submit = h('button', { class: 'btn block', type: 'submit' }, 'SUBIR');
  form.append(submit);

  mount(h('div', { class: 'page' }, topbar({ title: 'Crear evento' }), form), { tab: 'create' });
}

/* ---------- Amigos y solicitudes ---------- */

async function pageFriends() {
  mount(loading(), { tab: 'friends' });
  const { friends, pendingRequests } = await api('/users/me/friends');

  const inbox = h('button', { class: 'icon-btn badge-wrap', type: 'button', 'aria-label': 'Solicitudes de seguimiento', onclick: () => go('requests') },
    icon('inbox', 26), pendingRequests > 0 ? h('span', { class: 'badge' }, String(pendingRequests)) : null);

  const rows = friends.length
    ? friends.map((f) => h('a', { class: 'person', href: `#/user/${f.id}` },
      avatar(f, 50),
      h('div', { class: 'person-info' },
        h('strong', null, f.fullName || f.username),
        f.nextEvent ? h('span', { class: 'accent tiny' }, `Asistirá a ${f.nextEvent}`) : h('span', { class: 'muted tiny' }, `@${f.username}`)),
      h('span', { class: 'btn small' }, 'VER PERFIL')))
    : [h('div', { class: 'empty' }, 'Aún no sigues a nadie.', h('br'), h('a', { class: 'accent', href: '#/search' }, 'Busca personas en el buscador'))];

  mount(h('div', { class: 'page' },
    h('div', { class: 'title-row' }, h('h1', null, 'Mis amigos'), inbox),
    rows), { tab: 'friends' });
}

async function pageRequests() {
  mount(loading(), { tab: 'friends' });
  const { requests } = await api('/users/me/requests');
  const list = h('div', null);

  function row(u) {
    const el = h('div', { class: 'person' },
      avatar(u, 46),
      h('div', { class: 'person-info' }, h('strong', null, u.username), h('span', { class: 'muted tiny' }, u.fullName || '')),
      h('div', { class: 'actions-row' },
        h('button', {
          class: 'btn small', type: 'button',
          onclick: async () => {
            try { await api(`/users/me/requests/${u.id}/accept`, { method: 'POST' }); el.remove(); toast('Solicitud aceptada'); } catch (err) { toast(err.message, true); }
          },
        }, 'CONFIRMAR'),
        h('button', {
          class: 'btn small ghost', type: 'button',
          onclick: async () => {
            try { await api(`/users/me/requests/${u.id}`, { method: 'DELETE' }); el.remove(); } catch (err) { toast(err.message, true); }
          },
        }, 'ELIMINAR')));
    return el;
  }

  list.append(...(requests.length ? requests.map(row) : [h('p', { class: 'empty' }, 'No tienes solicitudes pendientes.')]));
  mount(h('div', { class: 'page' }, topbar({ back: true, title: 'Solicitudes de seguimiento' }), list), { tab: 'friends' });
}

/* ---------- Perfil ---------- */

async function pageProfile(idArg) {
  const id = idArg ? Number(idArg) : state.user.id;
  const isMe = id === state.user.id;
  mount(loading(), { tab: isMe ? 'me' : 'friends' });
  const data = await api(`/users/${id}`);
  const u = data.user;

  const relation = { id: u.id, relation: data.relation };
  const actions = isMe
    ? h('a', { class: 'btn small', href: '#/settings/edit' }, 'EDITAR PERFIL')
    : (u.acceptsRequests || data.relation !== 'none')
      ? followButton(relation, () => pageProfile(id))
      : h('span', { class: 'muted tiny' }, 'No acepta solicitudes');

  const events = (label, list) => (list.length ? section(label, h('div', { class: 'hscroll' }, list.map((e) => eventCard(e)))) : null);

  let body;
  if (!data.canSee) {
    body = h('div', { class: 'lock' }, icon('lock', 28), h('p', null, 'Esta cuenta es privada. Sigue a este usuario para ver su actividad.'));
  } else if (!data.showActivity) {
    body = h('div', { class: 'lock' }, h('p', null, 'Este usuario no comparte su actividad.'));
  } else {
    body = [
      events(isMe ? 'Mis eventos' : 'Próximos eventos', data.upcoming),
      events('Eventos anteriores', data.past),
      !data.upcoming.length && !data.past.length ? h('p', { class: 'empty' }, 'Todavía no hay actividad.') : null,
    ];
  }

  mount(h('div', { class: 'page' },
    topbar({
      back: !isMe,
      right: isMe ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Ajustes', onclick: () => go('settings') }, icon('settings')) : null,
    }),
    h('div', { class: 'profile-head' },
      avatar(u, 96),
      h('p', { class: 'profile-name' }, u.fullName || u.username),
      h('p', { class: 'muted tiny' }, `@${u.username}`),
      h('div', { class: 'stats' },
        h('div', null, h('strong', null, String(data.followers)), 'Seguidores'),
        h('div', null, h('strong', null, String(data.following)), 'Siguiendo')),
      u.bio ? h('p', { class: 'bio' }, u.bio) : null,
      actions),
    body), { tab: isMe ? 'me' : 'friends' });
}

/* ---------- Ajustes ---------- */

function pageSettings() {
  const item = (label, ico, href, extra = '') => h('a', { class: `menu-item ${extra}`, href }, icon(ico, 22), label);
  mount(h('div', { class: 'page' },
    topbar({ back: true }),
    h('div', { class: 'content center' }, h('h1', null, state.user.fullName || state.user.username)),
    h('div', { class: 'menu-list' },
      item('Editar perfil', 'user', '#/settings/edit'),
      item('Privacidad', 'lock', '#/settings/privacy'),
      state.user.role === 'admin' ? item('Panel de administración', 'shield', '#/admin') : null,
      h('button', { class: 'menu-item danger', type: 'button', onclick: logout }, 'Cerrar sesión'))), { tab: 'me' });
}

function pageEditProfile() {
  const u = state.user;

  const form = h('form', {
    class: 'form', method: 'post', action: '#/settings/edit',
    onsubmit: async (e) => {
      e.preventDefault();
      try {
        const { user } = await api('/users/me', { method: 'PATCH', body: readForm(form) });
        state.user = user;
        saveSession();
        toast('Cambios guardados');
        go('me');
      } catch (err) {
        toast(err.message, true);
      }
    },
  },
    h('div', { class: 'avatar-edit' }, avatar(u, 110)),
    h('label', null, 'Usuario', h('input', { class: 'field', name: 'username', value: u.username, required: true, minlength: '3', maxlength: '30', pattern: '[A-Za-z0-9_]+' })),
    h('label', null, 'Nombre', h('input', { class: 'field', name: 'fullName', value: u.fullName || '', maxlength: '60' })),
    h('label', null, 'Correo', h('input', { class: 'field', value: u.email || '', disabled: true })),
    h('label', null, 'Biografía', h('textarea', { class: 'field', name: 'bio', maxlength: '160', placeholder: 'Biografía opcional aquí…' }, u.bio || '')),
    h('button', { class: 'btn block', type: 'submit' }, 'GUARDAR CAMBIOS'));

  mount(h('div', { class: 'page' }, topbar({ back: true, title: 'Editar perfil' }), form), { tab: 'me' });
}

function pagePrivacy() {
  const toggle = (key, label) => {
    const input = h('input', { type: 'checkbox', checked: Boolean(state.user[key]), 'aria-label': label });
    input.addEventListener('change', async () => {
      const wanted = input.checked;
      try {
        const { user } = await api('/users/me/settings', { method: 'PATCH', body: { [key]: wanted } });
        state.user = user;
        saveSession();
      } catch (err) {
        input.checked = !wanted;
        toast(err.message, true);
      }
    });
    return h('div', { class: 'switch-row' }, h('span', null, label), h('label', { class: 'switch' }, input, h('span', { class: 'slider' })));
  };

  mount(h('div', { class: 'page' },
    topbar({ back: true, title: 'Privacidad' }),
    h('div', { class: 'content' },
      toggle('isPrivate', 'Cuenta privada'),
      toggle('allowRequests', 'Permitir solicitudes de amistad'),
      toggle('shareActivity', 'Compartir actividad'),
      h('p', { class: 'muted tiny' }, 'Con la cuenta privada, quien quiera seguirte necesita tu aprobación. Si no compartes tu actividad, tus seguidores no verán a qué eventos vas.'))), { tab: 'me' });
}

/* ---------- Administración ---------- */

async function pageAdmin() {
  mount(loading(), { tab: 'me' });
  const { users } = await api('/admin/users');
  const rows = users.map((u) => h('tr', null,
    h('td', null, `@${u.username}`),
    h('td', null, u.role),
    h('td', null, u.id === state.user.id ? '—' : h('button', {
      class: 'btn small ghost', type: 'button',
      onclick: async (ev) => {
        if (!window.confirm(`¿Eliminar a @${u.username} y todo su contenido?`)) return;
        try {
          await api(`/admin/users/${u.id}`, { method: 'DELETE' });
          ev.target.closest('tr').remove();
          toast('Usuario eliminado');
        } catch (err) {
          toast(err.message, true);
        }
      },
    }, 'ELIMINAR'))));

  mount(h('div', { class: 'page' },
    topbar({ back: true, title: 'Administración' }),
    h('div', { class: 'content' },
      h('table', { class: 'table' },
        h('thead', null, h('tr', null, h('th', null, 'Usuario'), h('th', null, 'Rol'), h('th', null, ''))),
        h('tbody', null, rows)),
      h('p', { class: 'muted tiny', style: 'margin-top:12px' }, 'Los eventos se pueden borrar desde su ficha (el administrador puede borrar cualquiera).'))), { tab: 'me' });
}

/* =========================================================================
   Router
   ========================================================================= */

async function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const page = parts[0] || '';
  const arg = parts[1];
  const isPublic = ['', 'login', 'register'].includes(page);

  if (!state.user && !isPublic) return go('');
  if (state.user && isPublic) return go('home');

  try {
    switch (page) {
      case '': return pageWelcome();
      case 'login': return pageLogin();
      case 'register': return pageRegister();
      case 'home': return await pageHome();
      case 'search': return await pageSearch();
      case 'create': return pageCreate();
      case 'friends': return await pageFriends();
      case 'requests': return await pageRequests();
      case 'me': return await pageProfile();
      case 'user': return await pageProfile(arg);
      case 'event': return await pageEvent(arg);
      case 'settings':
        if (arg === 'edit') return pageEditProfile();
        if (arg === 'privacy') return pagePrivacy();
        return pageSettings();
      case 'admin': return await pageAdmin();
      default: return go('home');
    }
  } catch (err) {
    toast(err.message, true);
    return mount(h('div', { class: 'page' },
      h('p', { class: 'empty' }, err.message),
      h('div', { class: 'content' }, h('a', { class: 'btn block', href: '#/home' }, 'VOLVER AL INICIO'))), { tab: null });
  }
}

window.addEventListener('hashchange', route);
loadSession();
route();
