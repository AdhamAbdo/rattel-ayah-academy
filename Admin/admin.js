// ================================================================
// Rattel Ayah Academy — Admin dashboard logic (Supabase-backed)
// ================================================================

const sb = window.supabaseClient;

let currentUser = null;
let cache = {
  courses: [], teachers: [], faqs: [], statistics: [], testimonials: [],
  hero: {}, contact: {}, footer: {}, general: {}
};

// ---------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------
function toast(message, type = 'info') {
  const bar = document.getElementById('status-bar');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  bar.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

// ---------------------------------------------------------------
// Auth
// ---------------------------------------------------------------
function showLoginGate(errorMsg) {
  document.getElementById('login-gate').style.display = 'flex';
  document.getElementById('admin-shell').style.display = 'none';
  const err = document.getElementById('login-error');
  if (errorMsg) { err.textContent = errorMsg; err.style.display = 'block'; }
  else { err.style.display = 'none'; }
  refreshIcons();
}

function showAdminShell() {
  document.getElementById('login-gate').style.display = 'none';
  document.getElementById('admin-shell').style.display = 'flex';
  document.getElementById('admin-username').textContent = currentUser?.email || '—';
  refreshIcons();
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-submit');
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  btn.disabled = false;
  btn.textContent = 'Sign In';
  if (error) {
    showLoginGate(error.message);
    return;
  }
  currentUser = data.user;
  const ok = await verifyIsAdmin();
  if (!ok) {
    await sb.auth.signOut();
    showLoginGate('This account is not authorized as an admin. Ask an existing admin to add your user id to the "admins" table.');
    return;
  }
  showAdminShell();
  await loadAllData();
  renderAll();
}

async function verifyIsAdmin() {
  // Any authenticated query that only admins can perform under RLS.
  // We attempt a harmless read of the admins-gated write policy by
  // trying a no-op select against a table using is_admin(); simplest
  // reliable check: try updating site_content with the same value.
  const { error } = await sb.from('site_content').select('key').eq('key', 'hero').limit(1);
  // A failed select here would mean something else is wrong (network etc).
  // The real gate is enforced by RLS on writes — attempt a benign upsert.
  const probe = await sb.from('site_content').upsert({ key: '__admin_probe__', value: {} }, { onConflict: 'key' });
  if (probe.error) return false;
  return true;
}

async function handleLogout() {
  await sb.auth.signOut();
  currentUser = null;
  location.reload();
}

document.getElementById('logout-btn').addEventListener('click', handleLogout);

// ---------------------------------------------------------------
// Data loading (Supabase)
// ---------------------------------------------------------------
async function loadAllData() {
  const [coursesRes, teachersRes, faqsRes, statsRes, testiRes, contentRes] = await Promise.all([
    sb.from('courses').select('*').order('display_order', { ascending: true }),
    sb.from('teachers').select('*').order('display_order', { ascending: true }),
    sb.from('faqs').select('*').order('display_order', { ascending: true }),
    sb.from('statistics').select('*').order('display_order', { ascending: true }),
    sb.from('testimonials').select('*').order('display_order', { ascending: true }),
    sb.from('site_content').select('key, value'),
  ]);

  cache.courses = coursesRes.data || [];
  cache.teachers = teachersRes.data || [];
  cache.faqs = faqsRes.data || [];
  cache.statistics = statsRes.data || [];
  cache.testimonials = testiRes.data || [];

  const byKey = {};
  (contentRes.data || []).forEach(row => byKey[row.key] = row.value || {});
  cache.hero = byKey.hero || {};
  cache.contact = byKey.contact || {};
  cache.footer = byKey.footer || {};
  cache.general = byKey.general || {};
}

async function saveSiteContent(key, value) {
  const { error } = await sb.from('site_content').upsert({ key, value }, { onConflict: 'key' });
  if (error) throw error;
}

// ---------------------------------------------------------------
// Navigation between panels
// ---------------------------------------------------------------
const PANEL_META = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of your website content.' },
  hero: { title: 'Hero Section', subtitle: 'The main banner visitors see first.' },
  courses: { title: 'Courses', subtitle: 'Manage the programs shown on the website.' },
  teachers: { title: 'Teachers', subtitle: 'Manage teacher profiles and the homepage carousel.' },
  faqs: { title: 'FAQ', subtitle: 'Manage frequently asked questions.' },
  statistics: { title: 'Statistics', subtitle: 'The numbers shown on the stats band.' },
  testimonials: { title: 'Testimonials', subtitle: 'Manage student and parent reviews.' },
  contact: { title: 'Contact Information', subtitle: 'Phone, WhatsApp, and email used sitewide.' },
  general: { title: 'General Content', subtitle: 'Navigation, section headings, and about text.' },
  footer: { title: 'Footer', subtitle: 'Footer tagline and legal text.' }
};

document.getElementById('admin-nav').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-panel]');
  if (!btn) return;
  document.querySelectorAll('#admin-nav button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panelId = 'panel-' + btn.dataset.panel;
  document.getElementById(panelId).classList.add('active');
  const meta = PANEL_META[btn.dataset.panel];
  document.getElementById('panel-title').textContent = meta.title;
  document.getElementById('panel-subtitle').textContent = meta.subtitle;
  renderPanel(btn.dataset.panel);
});

document.getElementById('reload-btn').addEventListener('click', async () => {
  try {
    await loadAllData();
    toast('Reloaded latest content from the database.', 'success');
    renderAll();
  } catch (e) {
    toast('Could not reload content.', 'error');
  }
});

// ---------------------------------------------------------------
// Simple key/value form panels: Hero, Contact, General, Footer
// ---------------------------------------------------------------
function getByPath(obj, path) { return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj); }
function setByPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) { if (!cur[keys[i]]) cur[keys[i]] = {}; cur = cur[keys[i]]; }
  cur[keys[keys.length - 1]] = value;
}

function renderFormPanel(containerId, dataObj, fields) {
  const container = document.getElementById(containerId);
  container.innerHTML = `<div class="form-grid">` + fields.map(f => `
    <div style="grid-column:${f.full ? '1 / -1' : 'auto'}">
      <label>${f.label}</label>
      ${f.type === 'textarea'
        ? `<textarea data-path="${f.path}">${esc(getByPath(dataObj, f.path) || '')}</textarea>`
        : `<input type="text" data-path="${f.path}" value="${esc(getByPath(dataObj, f.path) || '')}">`}
    </div>`).join('') + `</div>`;
}

function collectFormPanel(containerId, dataObj) {
  document.getElementById(containerId).querySelectorAll('[data-path]').forEach(el => {
    setByPath(dataObj, el.dataset.path, el.value);
  });
}

function renderHeroPanel() {
  renderFormPanel('hero-form', cache.hero, [
    { label: 'Badge text', path: 'badge' },
    { label: 'Title (before highlight)', path: 'titleBefore', full: true },
    { label: 'Title (highlighted phrase)', path: 'titleHighlight' },
    { label: 'Title (after highlight)', path: 'titleAfter', full: true },
    { label: 'Description', path: 'description', type: 'textarea', full: true },
    { label: 'Primary button text', path: 'primaryButtonText' },
    { label: 'Primary button link', path: 'primaryButtonLink' },
    { label: 'Secondary button text', path: 'secondaryButtonText' },
    { label: 'Secondary button link', path: 'secondaryButtonLink' },
    { label: 'Hero image URL', path: 'heroImage', full: true },
    { label: 'Float card 1 title', path: 'floatCard1Title' },
    { label: 'Float card 1 subtitle', path: 'floatCard1Sub' },
    { label: 'Float card 2 title', path: 'floatCard2Title' },
    { label: 'Float card 2 subtitle', path: 'floatCard2Sub' },
    { label: 'Float card 3 title', path: 'floatCard3Title' },
    { label: 'Float card 3 subtitle', path: 'floatCard3Sub' },
  ]);
}

function renderContactPanel() {
  renderFormPanel('contact-form', cache.contact, [
    { label: 'Phone (display)', path: 'phone' },
    { label: 'WhatsApp number (digits only, with country code)', path: 'whatsapp' },
    { label: 'Email', path: 'email' },
  ]);
}

function renderGeneralPanel() {
  renderFormPanel('general-form', cache.general, [
    { label: 'About / How It Works heading', path: 'aboutHeading', full: true },
    { label: 'About / How It Works description', path: 'aboutDescription', type: 'textarea', full: true },
    { label: 'CTA heading', path: 'ctaHeading', full: true },
    { label: 'CTA description', path: 'ctaDescription', type: 'textarea', full: true },
  ]);
}

function renderFooterPanel() {
  renderFormPanel('footer-form', cache.footer, [
    { label: 'Footer tagline', path: 'tagline', type: 'textarea', full: true },
    { label: 'Logo image URL', path: 'logo', full: true },
  ]);
}

async function saveFormPanel(panelKey, containerId, dataObj) {
  collectFormPanel(containerId, dataObj);
  try {
    await saveSiteContent(panelKey, dataObj);
    toast('Changes saved.', 'success');
  } catch (e) {
    console.error(e);
    toast('Could not save — ' + (e.message || 'unknown error'), 'error');
  }
}

document.body.addEventListener('click', async (e) => {
  const saveBtn = e.target.closest('button[data-save]');
  if (!saveBtn) return;
  const key = saveBtn.dataset.save;
  saveBtn.disabled = true;
  try {
    if (key === 'hero') await saveFormPanel('hero', 'hero-form', cache.hero);
    else if (key === 'contact') await saveFormPanel('contact', 'contact-form', cache.contact);
    else if (key === 'general') await saveFormPanel('general', 'general-form', cache.general);
    else if (key === 'footer') await saveFormPanel('footer', 'footer-form', cache.footer);
    else if (LIST_SCHEMAS[key]) toast('List items save individually — use Add/Edit on each item.', 'info');
  } finally {
    saveBtn.disabled = false;
  }
});

// ---------------------------------------------------------------
// List panels: Courses, Teachers, FAQs, Statistics, Testimonials
// ---------------------------------------------------------------
const LIST_SCHEMAS = {
  courses: {
    table: 'courses', label: 'Course',
    itemLabel: (i) => i.title, itemSub: (i) => `${i.category || ''} · ${i.level || ''}`,
    itemImg: (i) => i.image_url,
    fields: [
      field('Title', 'title'), field('Arabic title', 'arabic_title'),
      field('Description', 'description', 'textarea', true),
      field('Image URL', 'image_url', 'text', true),
      field('Category', 'category'), field('Level', 'level'), field('Class type (1-on-1 / Group)', 'class_type'),
      field('Price ($/mo)', 'price'), field('Old price ($/mo)', 'old_price'),
      field('Duration', 'duration'), field('Frequency', 'frequency'),
      field('Featured? (true/false)', 'is_featured'),
    ],
    newItem: () => ({ title: 'New Course', description: '', is_active: true, display_order: (cache.courses.length + 1) })
  },
  teachers: {
    table: 'teachers', label: 'Teacher',
    itemLabel: (i) => i.name, itemSub: (i) => i.title || '',
    itemImg: (i) => i.image_url,
    fields: [
      field('Name', 'name'), field('Title / role', 'title'),
      field('Bio', 'bio', 'textarea', true),
      field('Image URL', 'image_url', 'text', true),
      field('Specialization (comma separated)', 'specialization', 'text', true),
    ],
    newItem: () => ({ name: 'New Teacher', is_active: true, display_order: (cache.teachers.length + 1) })
  },
  faqs: {
    table: 'faqs', label: 'FAQ',
    itemLabel: (i) => i.question, itemSub: () => '',
    itemImg: () => null,
    fields: [
      field('Question', 'question', 'text', true),
      field('Answer', 'answer', 'textarea', true),
    ],
    newItem: () => ({ question: 'New question?', answer: '', is_active: true, display_order: (cache.faqs.length + 1) })
  },
  statistics: {
    table: 'statistics', label: 'Statistic',
    itemLabel: (i) => i.value, itemSub: (i) => i.label,
    itemImg: () => null,
    fields: [ field('Value (e.g. 1000+)', 'value'), field('Label (e.g. Students)', 'label') ],
    newItem: () => ({ value: '0', label: 'New Stat', is_active: true, display_order: (cache.statistics.length + 1) })
  },
  testimonials: {
    table: 'testimonials', label: 'Testimonial',
    itemLabel: (i) => i.author_name, itemSub: (i) => i.author_role || '',
    itemImg: () => null,
    fields: [
      field('Author name', 'author_name'), field('Author role', 'author_role'),
      field('Quote', 'quote', 'textarea', true), field('Rating (1-5)', 'rating'),
    ],
    newItem: () => ({ author_name: 'New Reviewer', quote: '', rating: 5, is_active: true, display_order: (cache.testimonials.length + 1) })
  }
};

function field(label, path, type = 'text', full = false) { return { label, path, type, full }; }

function renderListPanel(key) {
  const schema = LIST_SCHEMAS[key];
  const container = document.getElementById(key + '-list');
  const items = [...cache[key]].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  if (!items.length) {
    container.innerHTML = `<div class="empty-state">No ${schema.label}s yet. Click "+ Add ${schema.label}" to create one.</div>`;
    return;
  }
  container.innerHTML = items.map(item => `
    <div class="item-row" draggable="true" data-id="${esc(item.id)}" data-key="${key}">
      <div class="item-main">
        <span class="drag-handle">⠿</span>
        ${schema.itemImg(item) ? `<img src="${esc(schema.itemImg(item))}" alt="">` : ''}
        <div>
          <div class="item-title">${esc(schema.itemLabel(item))}</div>
          <div class="item-sub">${esc(schema.itemSub(item))}</div>
        </div>
      </div>
      <div class="item-actions">
        <span class="badge ${item.is_active !== false ? 'on' : 'off'}">${item.is_active !== false ? 'Enabled' : 'Disabled'}</span>
        <button class="btn btn-outline btn-sm" data-action="toggle"><i data-lucide="${item.is_active !== false ? 'eye-off' : 'eye'}"></i> ${item.is_active !== false ? 'Disable' : 'Enable'}</button>
        <button class="btn btn-outline btn-sm" data-action="edit"><i data-lucide="pencil"></i> Edit</button>
        <button class="btn btn-danger btn-sm" data-action="delete"><i data-lucide="trash-2"></i> Delete</button>
      </div>
    </div>
  `).join('');

  attachListEvents(key, container);
  attachDragReorder(key, container);
  refreshIcons();
}

function attachListEvents(key, container) {
  const schema = LIST_SCHEMAS[key];
  container.querySelectorAll('.item-row').forEach(row => {
    const id = row.dataset.id;
    row.querySelector('[data-action="toggle"]').addEventListener('click', async () => {
      const item = cache[key].find(i => i.id === id);
      const newVal = item.is_active === false ? true : false;
      const { error } = await sb.from(schema.table).update({ is_active: newVal }).eq('id', id);
      if (error) { toast('Could not update — ' + error.message, 'error'); return; }
      item.is_active = newVal;
      renderListPanel(key);
      toast('Updated.', 'success');
    });
    row.querySelector('[data-action="delete"]').addEventListener('click', () => {
      confirmDelete(schema.itemLabel(cache[key].find(i => i.id === id)), async () => {
        const { error } = await sb.from(schema.table).delete().eq('id', id);
        if (error) { toast('Could not delete — ' + error.message, 'error'); return; }
        cache[key] = cache[key].filter(i => i.id !== id);
        renderListPanel(key);
        toast('Deleted.', 'success');
      });
    });
    row.querySelector('[data-action="edit"]').addEventListener('click', () => {
      openEditModal(key, id);
    });
  });
}

function attachDragReorder(key, container) {
  const schema = LIST_SCHEMAS[key];
  let dragEl = null;
  container.querySelectorAll('.item-row').forEach(row => {
    row.addEventListener('dragstart', () => { dragEl = row; row.classList.add('dragging'); });
    row.addEventListener('dragend', async () => {
      row.classList.remove('dragging');
      const ids = [...container.querySelectorAll('.item-row')].map(r => r.dataset.id);
      const updates = ids.map((id, idx) => {
        const item = cache[key].find(i => i.id === id);
        if (item) item.display_order = idx + 1;
        return sb.from(schema.table).update({ display_order: idx + 1 }).eq('id', id);
      });
      try {
        await Promise.all(updates);
        toast('Order saved.', 'success');
      } catch (e) {
        toast('Could not save new order.', 'error');
      }
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      const after = getDragAfterElement(container, e.clientY);
      if (!dragEl) return;
      if (after == null) container.appendChild(dragEl);
      else container.insertBefore(dragEl, after);
    });
  });
}

function getDragAfterElement(container, y) {
  const els = [...container.querySelectorAll('.item-row:not(.dragging)')];
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: -Infinity }).element;
}

function confirmDelete(label, onConfirm) {
  const modal = document.getElementById('confirm-modal');
  document.getElementById('confirm-modal-text').textContent = `Are you sure you want to delete "${label}"? This cannot be undone.`;
  modal.classList.add('open');
  const okBtn = document.getElementById('confirm-modal-ok');
  const cancelBtn = document.getElementById('confirm-modal-cancel');
  const cleanup = () => { modal.classList.remove('open'); okBtn.onclick = null; cancelBtn.onclick = null; };
  okBtn.onclick = () => { onConfirm(); cleanup(); };
  cancelBtn.onclick = cleanup;
}

function openEditModal(key, id) {
  const schema = LIST_SCHEMAS[key];
  let item = id ? cache[key].find(i => i.id === id) : schema.newItem();
  const isNew = !id;
  const modal = document.getElementById('edit-modal');
  document.getElementById('edit-modal-title').textContent = isNew ? `Add ${schema.label}` : `Edit ${schema.label}`;

  const body = document.getElementById('edit-modal-body');
  body.innerHTML = `<div class="form-grid full">` + schema.fields.map(f => {
    let value = f.path === 'specialization' && Array.isArray(item[f.path]) ? item[f.path].join(', ') : (item[f.path] ?? '');
    return `<div style="grid-column:${f.full ? '1 / -1' : 'auto'}">
      <label>${f.label}</label>
      ${f.type === 'textarea'
        ? `<textarea data-field="${f.path}">${esc(value)}</textarea>`
        : `<input type="text" data-field="${f.path}" value="${esc(value)}">`}
    </div>`;
  }).join('') + `</div>`;

  modal.classList.add('open');

  const saveBtn = document.getElementById('edit-modal-save');
  const cancelBtn = document.getElementById('edit-modal-cancel');
  const cleanup = () => { modal.classList.remove('open'); saveBtn.onclick = null; cancelBtn.onclick = null; };

  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    body.querySelectorAll('[data-field]').forEach(el => {
      let val = el.value;
      if (['price', 'old_price', 'rating'].includes(el.dataset.field) && val !== '') val = Number(val);
      if (el.dataset.field === 'is_featured') val = (val === 'true' || val === true);
      item[el.dataset.field] = val;
    });
    if (isNew) {
      if (item.is_active === undefined) item.is_active = true;
    }
    try {
      const { data, error } = await sb.from(schema.table).upsert(item).select().single();
      if (error) throw error;
      if (isNew) cache[key].push(data);
      else Object.assign(item, data);
      renderListPanel(key);
      toast('Saved.', 'success');
      cleanup();
    } catch (e) {
      console.error(e);
      toast('Could not save — ' + (e.message || 'unknown error'), 'error');
    } finally {
      saveBtn.disabled = false;
    }
  };
  cancelBtn.onclick = cleanup;
}

document.body.addEventListener('click', (e) => {
  const addBtn = e.target.closest('button[data-add]');
  if (addBtn) openEditModal(addBtn.dataset.add, null);
});

// ---------------------------------------------------------------
// Dashboard summary
// ---------------------------------------------------------------
function renderDashboard() {
  const el = document.getElementById('dashboard-stats');
  const stats = [
    { icon: 'book-open', num: cache.courses.length, label: 'Courses', color: 'var(--deep-green)' },
    { icon: 'users', num: cache.teachers.length, label: 'Teachers', color: '#2A7A8C' },
    { icon: 'help-circle', num: cache.faqs.length, label: 'FAQ Entries', color: 'var(--gold)' },
    { icon: 'bar-chart-3', num: cache.statistics.length, label: 'Statistics', color: 'var(--wood)' },
    { icon: 'message-square-quote', num: cache.testimonials.length, label: 'Testimonials', color: 'var(--light-green)' },
  ];
  el.innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-card-ic" style="background:${s.color};"><i data-lucide="${s.icon}"></i></div>
      <div>
        <div class="stat-card-num">${s.num}</div>
        <div class="stat-card-label">${s.label}</div>
      </div>
    </div>
  `).join('') + `
    <div class="stat-card user-card">
      <div class="stat-card-ic" style="background:var(--navy);"><i data-lucide="user-check"></i></div>
      <div>
        <div class="stat-card-num">${esc(currentUser?.email || '—')}</div>
        <div class="stat-card-label">Signed in</div>
      </div>
    </div>
  `;
  refreshIcons();
}

// ---------------------------------------------------------------
// Panel dispatch
// ---------------------------------------------------------------
function renderPanel(name) {
  switch (name) {
    case 'dashboard': renderDashboard(); break;
    case 'hero': renderHeroPanel(); break;
    case 'courses': renderListPanel('courses'); break;
    case 'teachers': renderListPanel('teachers'); break;
    case 'faqs': renderListPanel('faqs'); break;
    case 'statistics': renderListPanel('statistics'); break;
    case 'testimonials': renderListPanel('testimonials'); break;
    case 'contact': renderContactPanel(); break;
    case 'general': renderGeneralPanel(); break;
    case 'footer': renderFooterPanel(); break;
  }
}

function renderAll() {
  const active = document.querySelector('#admin-nav button.active');
  renderPanel(active ? active.dataset.panel : 'dashboard');
}

// ---------------------------------------------------------------
// Initialization — require a real Supabase session before showing
// the dashboard at all.
// ---------------------------------------------------------------
(async function init() {
  document.getElementById('login-form').addEventListener('submit', handleLogin);

  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    showLoginGate();
    return;
  }
  currentUser = session.user;
  const ok = await verifyIsAdmin();
  if (!ok) {
    await sb.auth.signOut();
    showLoginGate('This account is not authorized as an admin.');
    return;
  }
  showAdminShell();
  try {
    await loadAllData();
    renderAll();
  } catch (e) {
    console.error(e);
    toast('Could not load website content.', 'error');
  }
  refreshIcons();
})();