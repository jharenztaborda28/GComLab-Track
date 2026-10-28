/* GComLab Track - function.js
   Works with index.html + style.css. Data is saved in the browser (localStorage). */
(() => {
  'use strict';

  /* ---------- Settings ---------- */
  const STORAGE_KEY = 'gcomlabtrack.v1';
  const THEME_KEY = 'gcomlabtrack.theme';

  
  const HERO_IMAGES = ['Pic1.jpg', 'Pic2.jpg', 'Pic3.jpg', 'Pic4.jpg', 'Pic5.jpg', 'Pic6.jpg'];
  const HERO_INTERVAL_MS = 5000;

  const STATUSES = ['Pending', 'In Progress', 'Fixed'];
  const STATUS_CLASS = { 'Pending': 'pending', 'In Progress': 'progress', 'Fixed': 'fixed' };
  const DEFAULT_EQUIPMENT = ['CPU', 'Monitor', 'Keyboard', 'Mouse'];

  const VIEWS = {
    dashboard: { crumb: 'Dashboard', title: 'Computer Lab Overview' },
    inventory: { crumb: 'Inventory', title: 'Equipment Inventory' },
    reports:   { crumb: 'Repair Reports', title: 'Repair Log' }
  };

  /* ---------- Helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  function todayISO() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  // "2026-10-20" -> "Oct 20, 2026" (parsed by hand so timezones can't shift the day)
  function fmtDate(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    if (!y || !m || !d) return iso || '';
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  /* ---------- Data ---------- */
  function seed() {
    return {
      currentLabId: 'lab-1',
      labs: [{
        id: 'lab-1',
        name: 'Comlab 1',
        updated: todayISO(),
        inventory: [
          { id: uid(), name: 'CPU', count: 26 },
          { id: uid(), name: 'Monitor', count: 28 },
          { id: uid(), name: 'Keyboard', count: 26 },
          { id: uid(), name: 'Mouse', count: 26 }
        ],
        reports: [
          { id: uid(), equip: 'Monitor', sticker: 'Sticker #6', problem: 'No display', date: todayISO(), status: 'Pending' },
          { id: uid(), equip: 'Keyboard', sticker: 'Sticker #6', problem: 'Broken keys', date: todayISO(), status: 'Fixed' },
          { id: uid(), equip: 'CPU', sticker: 'Sticker #6', problem: 'Not functioning', date: todayISO(), status: 'Pending' }
        ]
      }]
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.labs) && data.labs.length) return data;
      }
    } catch (e) { /* ignore, fall back to seed */ }
    return seed();
  }

  let state = load();

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { toast('Could not save. Browser storage may be full or blocked.'); }
  }

  function getLab() {
    return state.labs.find((l) => l.id === state.currentLabId) || state.labs[0];
  }

  /* ---------- Elements ---------- */
  const el = {
    nav: $('nav'),
    openCount: $('openCount'),
    crumb: $('crumb'),
    pageTitle: $('pageTitle'),
    themeToggle: $('themeToggle'),
    themeIcon: $('themeIcon'),
    labSelect: $('labSelect'),
    newReportBtn: $('newReportBtn'),

    recentBody: $('recentBody'),
    invDate: $('invDate'),
    invList: $('invList'),

    invLabName: $('invLabName'),
    invDate2: $('invDate2'),
    invListFull: $('invListFull'),
    addEquipForm: $('addEquipForm'),
    newEquipName: $('newEquipName'),
    newEquipCount: $('newEquipCount'),
    deleteLabBtn: $('deleteLabBtn'),

    repCount: $('repCount'),
    chips: $('chips'),
    search: $('search'),
    statusFilter: $('statusFilter'),
    dateSort: $('dateSort'),
    allBody: $('allBody'),

    reportOverlay: $('reportOverlay'),
    reportForm: $('reportForm'),
    reportModalTitle: $('reportModalTitle'),
    fEquip: $('fEquip'),
    equipList: $('equipList'),
    fSticker: $('fSticker'),
    fProblem: $('fProblem'),
    fDate: $('fDate'),
    fStatus: $('fStatus'),
    cancelReportBtn: $('cancelReportBtn'),
    reportSubmit: $('reportSubmit'),
    // The id in your HTML is "deletereportbtn"; "deleteReportBtn" also works.
    deleteReportBtn: document.querySelector('#deleteReportBtn, #deletereportbtn'),

    labOverlay: $('labOverlay'),
    labForm: $('labForm'),
    fLabName: $('fLabName'),

    toast: $('toast')
  };

  const filter = { status: 'all', q: '', sort: 'desc' };
  let editingId = null;

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    if (!el.toast) return;
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2600);
  }

  /* ---------- Views / navigation ---------- */
  function setView(name) {
    if (!VIEWS[name]) name = 'dashboard';
    document.querySelectorAll('.view').forEach((v) => {
      v.classList.toggle('active', v.id === 'view-' + name);
    });
    el.nav.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.view === name);
    });
    el.crumb.textContent = VIEWS[name].crumb;
    el.pageTitle.textContent = VIEWS[name].title;
  }

  function go(name) {
    if (location.hash.slice(1) === name) setView(name);
    else location.hash = name;
  }

  window.addEventListener('hashchange', () => setView(location.hash.slice(1)));

  el.nav.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-view]');
    if (btn) go(btn.dataset.view);
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-goto]');
    if (link) go(link.dataset.goto);
  });

  /* ---------- Theme ---------- */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const toLight = theme === 'dark';
    const label = toLight ? 'Switch to light mode' : 'Switch to dark mode';
    el.themeToggle.setAttribute('aria-label', label);
    el.themeToggle.title = label;
    // dark mode shows the sun (click for light); light mode shows moon.png if you have one
    el.themeIcon.src = toLight ? 'sun.png' : 'moon.png';
  }
  el.themeIcon.addEventListener('error', () => {
    if (!el.themeIcon.src.endsWith('sun.png')) el.themeIcon.src = 'sun.png';
  });

  el.themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
  });

  /* ---------- Lab select ---------- */
  function renderLabSelect() {
    const current = getLab().id;
    el.labSelect.innerHTML =
      state.labs.map((l) => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('') +
      '<option value="__new">+ Add a lab...</option>';
    el.labSelect.value = current;
  }

  el.labSelect.addEventListener('change', () => {
    if (el.labSelect.value === '__new') {
      el.labSelect.value = getLab().id;
      openModal(el.labOverlay, el.fLabName);
      return;
    }
    state.currentLabId = el.labSelect.value;
    save();
    renderAll();
  });

  /* ---------- Dashboard ---------- */
  function sortedReports(reports, dir) {
    return [...reports].sort((a, b) =>
      dir === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
  }

  function statusPill(status) {
    return `<span class="status ${STATUS_CLASS[status] || 'pending'}">${esc(status)}</span>`;
  }

  function renderDashboard() {
    const lab = getLab();
    const recent = sortedReports(lab.reports, 'desc').slice(0, 3);

    el.recentBody.innerHTML = recent.length
      ? recent.map((r) => `
        <tr>
          <td>${esc(r.equip)}<small>${esc(r.sticker)}</small></td>
          <td>${esc(r.problem)}</td>
          <td>${esc(fmtDate(r.date))}</td>
          <td>${statusPill(r.status)}</td>
        </tr>`).join('')
      : '<tr><td colspan="4" class="meta">No repair reports yet.</td></tr>';

    el.invDate.textContent = fmtDate(lab.updated);
    el.invList.innerHTML = lab.inventory.length
      ? lab.inventory.map((i) => `
        <div><span class="name">${esc(i.name)}</span><span class="qty">${i.count}</span></div>`).join('')
      : '<div><span class="name meta">No equipment yet.</span></div>';
  }

  /* ---------- Inventory ---------- */
  function renderInventory() {
    const lab = getLab();
    el.invLabName.textContent = lab.name;
    el.invDate2.textContent = fmtDate(lab.updated);

    el.invListFull.innerHTML = lab.inventory.length
      ? lab.inventory.map((i) => `
        <div class="inv-row" data-id="${esc(i.id)}">
          <span class="name">${esc(i.name)}</span>
          <div class="controls">
            <button type="button" data-act="dec" aria-label="Decrease ${esc(i.name)}">&minus;</button>
            <input type="number" min="0" value="${i.count}" data-act="set" aria-label="${esc(i.name)} quantity">
            <button type="button" data-act="inc" aria-label="Increase ${esc(i.name)}">+</button>
            <button type="button" data-act="remove" aria-label="Remove ${esc(i.name)}" title="Remove">&times;</button>
          </div>
        </div>`).join('')
      : '<div class="inv-row"><span class="name meta">No equipment yet. Add one below.</span></div>';

    el.equipList.innerHTML = lab.inventory
      .map((i) => `<option value="${esc(i.name)}"></option>`).join('');
  }

  function touchInventory(lab) {
    lab.updated = todayISO();
    save();
    renderDashboard();
    el.invDate2.textContent = fmtDate(lab.updated);
  }

  el.invListFull.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const lab = getLab();
    const row = btn.closest('.inv-row');
    const item = lab.inventory.find((i) => i.id === row.dataset.id);
    if (!item) return;

    if (btn.dataset.act === 'inc') item.count += 1;
    else if (btn.dataset.act === 'dec') item.count = Math.max(0, item.count - 1);
    else if (btn.dataset.act === 'remove') {
      if (!confirm(`Remove "${item.name}" from ${lab.name}?`)) return;
      lab.inventory = lab.inventory.filter((i) => i.id !== item.id);
      toast('Equipment removed');
    }
    touchInventory(lab);
    renderInventory();
  });

  el.invListFull.addEventListener('change', (e) => {
    if (e.target.dataset.act !== 'set') return;
    const lab = getLab();
    const item = lab.inventory.find((i) => i.id === e.target.closest('.inv-row').dataset.id);
    if (!item) return;
    item.count = Math.max(0, parseInt(e.target.value, 10) || 0);
    e.target.value = item.count;
    touchInventory(lab);
  });

  el.addEquipForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const lab = getLab();
    const name = el.newEquipName.value.trim();
    const count = Math.max(0, parseInt(el.newEquipCount.value, 10) || 0);
    if (!name) return;
    if (lab.inventory.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
      toast(`${name} is already in the list`);
      return;
    }
    lab.inventory.push({ id: uid(), name, count });
    touchInventory(lab);
    renderInventory();
    el.addEquipForm.reset();
    el.newEquipCount.value = 0;
    toast('Equipment added');
  });

  el.deleteLabBtn.addEventListener('click', () => {
    if (state.labs.length <= 1) {
      toast('You need at least one lab');
      return;
    }
    const lab = getLab();
    if (!confirm(`Delete "${lab.name}" with all its inventory and reports? This cannot be undone.`)) return;
    state.labs = state.labs.filter((l) => l.id !== lab.id);
    state.currentLabId = state.labs[0].id;
    save();
    renderAll();
    toast('Lab deleted');
  });

  /* ---------- Repair reports ---------- */
  function renderChips() {
    el.chips.innerHTML = STATUSES.map((s) => `
      <button type="button" class="chip" data-status="${esc(s)}">
        <span class="dot"></span>${esc(s)}
      </button>`).join('');
    syncChips();
  }

  function syncChips() {
    el.chips.querySelectorAll('.chip').forEach((c) => {
      c.classList.toggle('active', c.dataset.status === filter.status);
    });
    el.statusFilter.value = filter.status;
  }

  function renderReports() {
    const lab = getLab();
    const q = filter.q.trim().toLowerCase();

    const list = sortedReports(lab.reports, filter.sort).filter((r) => {
      if (filter.status !== 'all' && r.status !== filter.status) return false;
      if (!q) return true;
      return [r.equip, r.problem, r.sticker].some((v) => v.toLowerCase().includes(q));
    });

    el.repCount.textContent = `${list.length} of ${lab.reports.length} \u00b7 ${lab.name}`;
    el.dateSort.classList.toggle('asc', filter.sort === 'asc');
    el.dateSort.classList.toggle('desc', filter.sort === 'desc');

    el.allBody.innerHTML = list.length
      ? list.map((r) => `
        <tr data-id="${esc(r.id)}">
          <td>${esc(r.equip)}<small>${esc(r.sticker)}</small></td>
          <td>${esc(r.problem)}</td>
          <td>${esc(fmtDate(r.date))}</td>
          <td>${statusPill(r.status)}</td>
          <td>
            <div class="row-actions">
              <button type="button" class="edit-btn" data-act="edit">Edit</button>
              <button type="button" class="delete-btn" data-act="delete">Delete</button>
            </div>
          </td>
        </tr>`).join('')
      : `<tr><td colspan="5" class="meta">${lab.reports.length ? 'No reports match your search.' : 'No repair reports yet. Use + New Report to add one.'}</td></tr>`;
  }

  function renderOpenCount() {
    const open = getLab().reports.filter((r) => r.status !== 'Fixed').length;
    el.openCount.textContent = open;
    el.openCount.classList.toggle('zero', open === 0);
  }

  el.chips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    // clicking the active chip clears the filter
    filter.status = filter.status === chip.dataset.status ? 'all' : chip.dataset.status;
    syncChips();
    renderReports();
  });

  el.statusFilter.addEventListener('change', () => {
    filter.status = el.statusFilter.value;
    syncChips();
    renderReports();
  });

  el.search.addEventListener('input', () => {
    filter.q = el.search.value;
    renderReports();
  });

  el.dateSort.addEventListener('click', () => {
    filter.sort = filter.sort === 'desc' ? 'asc' : 'desc';
    renderReports();
  });

  el.allBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    if (btn.dataset.act === 'edit') openReportModal(id);
    else if (btn.dataset.act === 'delete') deleteReport(id);
  });

  function deleteReport(id) {
    const lab = getLab();
    const r = lab.reports.find((x) => x.id === id);
    if (!r) return;
    if (!confirm(`Delete the report for ${r.equip} (${r.sticker})?`)) return;
    lab.reports = lab.reports.filter((x) => x.id !== id);
    save();
    renderDashboard();
    renderReports();
    renderOpenCount();
    toast('Report deleted');
  }

  /* ---------- Modals ---------- */
  function openModal(overlay, focusEl) {
    overlay.classList.add('open');
    if (focusEl) setTimeout(() => focusEl.focus(), 30);
  }

  function closeModal(overlay) {
    overlay.classList.remove('open');
  }

  function openReportModal(id) {
    const lab = getLab();
    editingId = id || null;
    const r = id ? lab.reports.find((x) => x.id === id) : null;

    el.reportModalTitle.textContent = r ? 'Edit Repair Report' : 'New Repair Report';
    el.reportSubmit.textContent = r ? 'Save changes' : 'Submit';
    if (el.deleteReportBtn) el.deleteReportBtn.hidden = !r;

    el.fEquip.value = r ? r.equip : '';
    el.fSticker.value = r ? r.sticker : '';
    el.fProblem.value = r ? r.problem : '';
    el.fDate.value = r ? r.date : todayISO();
    el.fStatus.value = r ? r.status : 'Pending';
    openModal(el.reportOverlay, el.fEquip);
  }

  el.newReportBtn.addEventListener('click', () => openReportModal(null));
  el.cancelReportBtn.addEventListener('click', () => closeModal(el.reportOverlay));

  if (el.deleteReportBtn) {
    el.deleteReportBtn.addEventListener('click', () => {
      if (!editingId) return;
      closeModal(el.reportOverlay);
      deleteReport(editingId);
    });
  }

  el.reportForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const lab = getLab();
    const data = {
      equip: el.fEquip.value.trim(),
      sticker: el.fSticker.value.trim(),
      problem: el.fProblem.value.trim(),
      date: el.fDate.value,
      status: el.fStatus.value
    };
    if (!data.equip || !data.sticker || !data.problem || !data.date) return;

    if (editingId) {
      const r = lab.reports.find((x) => x.id === editingId);
      if (r) Object.assign(r, data);
      toast('Report updated');
    } else {
      lab.reports.push({ id: uid(), ...data });
      toast('Report submitted');
    }
    save();
    closeModal(el.reportOverlay);
    renderDashboard();
    renderReports();
    renderOpenCount();
  });

  /* ---- Add-lab modal ---- */
  el.labOverlay.querySelectorAll('[data-close]').forEach((b) => {
    b.addEventListener('click', () => closeModal(el.labOverlay));
  });

  el.labForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = el.fLabName.value.trim();
    if (!name) return;
    if (state.labs.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
      toast(`${name} already exists`);
      return;
    }
    const lab = {
      id: 'lab-' + uid(),
      name,
      updated: todayISO(),
      inventory: DEFAULT_EQUIPMENT.map((n) => ({ id: uid(), name: n, count: 0 })),
      reports: []
    };
    state.labs.push(lab);
    state.currentLabId = lab.id;
    save();
    closeModal(el.labOverlay);
    el.labForm.reset();
    renderAll();
    go('inventory'); // so you can set the starting counts
    toast(`${name} added`);
  });

  // Click the dark backdrop or press Escape to close any modal
  [el.reportOverlay, el.labOverlay].forEach((ov) => {
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) closeModal(ov); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') [el.reportOverlay, el.labOverlay].forEach(closeModal);
  });

  /* ---------- Hero slideshow ---------- */
  function initHero() {
    const slides = $('heroSlides');
    const dots = $('heroDots');
    const prev = $('heroPrev');
    const next = $('heroNext');
    if (!slides || !HERO_IMAGES.length) return; // keep the single hero.png

    slides.innerHTML = HERO_IMAGES
      .map((src, i) => `<img class="slide${i === 0 ? ' active' : ''}" src="${esc(src)}" alt="Computer laboratory photo ${i + 1}">`)
      .join('');
    if (HERO_IMAGES.length < 2) return;

    dots.innerHTML = HERO_IMAGES
      .map((_, i) => `<button type="button" class="dot${i === 0 ? ' active' : ''}" aria-label="Go to photo ${i + 1}"></button>`)
      .join('');
    prev.hidden = false;
    next.hidden = false;

    let index = 0;
    let timer;
    const slideEls = slides.querySelectorAll('.slide');
    const dotEls = dots.querySelectorAll('.dot');

    function show(n) {
      index = (n + HERO_IMAGES.length) % HERO_IMAGES.length;
      slideEls.forEach((s, i) => s.classList.toggle('active', i === index));
      dotEls.forEach((d, i) => d.classList.toggle('active', i === index));
    }
    function restart() {
      clearInterval(timer);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        timer = setInterval(() => show(index + 1), HERO_INTERVAL_MS);
      }
    }

    prev.addEventListener('click', () => { show(index - 1); restart(); });
    next.addEventListener('click', () => { show(index + 1); restart(); });
    dots.addEventListener('click', (e) => {
      const i = [...dotEls].indexOf(e.target.closest('.dot'));
      if (i >= 0) { show(i); restart(); }
    });
    restart();
  }

  /* ---------- Start ---------- */
  function renderAll() {
    renderLabSelect();
    renderDashboard();
    renderInventory();
    renderReports();
    renderOpenCount();
  }

  function init() {
    let theme = 'dark';
    try { theme = localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) { /* ignore */ }
    applyTheme(theme);

    renderChips();
    renderAll();
    setView(location.hash.slice(1));
    initHero();
  }

  init();
})();