/* Fonctions partagées entre la page de connexion et l'application. */
const Session = {
  KEY: 'plania_session',
  get() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || null; } catch { return null; }
  },
  set(data) {
    try { localStorage.setItem(this.KEY, JSON.stringify(data)); } catch { /* stockage indisponible */ }
  },
  clear() {
    try { localStorage.removeItem(this.KEY); } catch { /* rien */ }
  },
};

async function api(url, { method = 'GET', body } = {}) {
  const headers = {};
  const session = Session.get();
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Serveur injoignable. Vérifiez que l’application est démarrée.');
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && session?.token && !url.startsWith('/api/auth/')) {
    Session.clear();
    window.location.replace('/');
  }
  if (!response.ok) throw new Error(data.error || 'La requête a échoué.');
  return data;
}

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);

function toast(message, type = 'success') {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 3200);
  setTimeout(() => el.remove(), 3600);
}

const AVATAR_COLORS = ['#ef5b3c', '#e08a00', '#16a34a', '#0ea5e9', '#6366f1', '#d946ef', '#0f766e', '#be123c'];
function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || '?';
}
function avatarColor(seed = '') {
  let hash = 0;
  for (const char of String(seed)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
function avatar(user, size = '') {
  if (!user) return '';
  return `<span class="avatar ${size}" style="background:${avatarColor(user.name + user.email)}" title="${esc(user.name)}">${esc(initials(user.name))}</span>`;
}

function formatDate(value, options = { day: 'numeric', month: 'short' }) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('fr-FR', options);
}
function toInputDate(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}
function isOverdue(value) {
  if (!value) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(value) < today;
}

function formToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function setBusy(button, busy, label) {
  if (!button) return;
  if (busy) { button.dataset.label = button.textContent; button.textContent = label || 'Patientez…'; }
  else if (button.dataset.label) button.textContent = button.dataset.label;
  button.disabled = busy;
}
