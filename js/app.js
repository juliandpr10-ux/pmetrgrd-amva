// ── MODO LECTURA (parámetro URL o dispositivo móvil) ──────────────
const _urlParams = new URLSearchParams(window.location.search);
const _isMobile  = (navigator.userAgentData?.mobile === true) || (window.innerWidth < 768);
const READ_ONLY  = _urlParams.get('modo') === 'lectura' || _isMobile;

// Si es móvil y no tiene el parámetro, redirigir automáticamente
if (_isMobile && _urlParams.get('modo') !== 'lectura') {
  const _dest = new URL(window.location.href);
  _dest.searchParams.set('modo', 'lectura');
  window.location.replace(_dest.toString());
}

if (READ_ONLY) {
  document.body.classList.add('modo-lectura');

  // Etiquetas cortas en la barra de navegación (actualiza solo el span de texto, no el SVG)
  document.querySelectorAll('.nav-btn[data-short]').forEach(btn => {
    const lbl = btn.querySelector('.nav-lbl');
    if (lbl) lbl.textContent = btn.dataset.short;
  });

  // Bloquear modales en fase de CAPTURA (antes que cualquier listener existente)
  // .act-row = actividades en árbol, .k-card = tarjetas kanban
  document.addEventListener('click', function(e) {
    if (e.target.closest('.act-row') || e.target.closest('.k-card')) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, true); // true = capture phase, se dispara ANTES que todos los demás listeners
}
// ─────────────────────────────────────────────────────────────────

let S = JSON.parse(JSON.stringify(RAW));
let editRef = null;
const exp = {};

// ── Helper: actividad activa (no removida) ────────────────────────
function actividadActiva(a) { return !a.removido; }

// ── Mapa Valle de Aburrá — datos DANE 2023 (proyecciones) ────────
const MUN_DATA = {
  barbosa:    { name: 'Barbosa',     area: 209, pop: 58372 },
  girardota:  { name: 'Girardota',   area: 81,  pop: 65816 },
  copacabana: { name: 'Copacabana',  area: 70,  pop: 91848 },
  bello:      { name: 'Bello',       area: 142, pop: 544764 },
  medellin:   { name: 'Medellín',    area: 382, pop: 2769551 },
  envigado:   { name: 'Envigado',    area: 78,  pop: 261849 },
  itagui:     { name: 'Itagüí',      area: 21,  pop: 302987 },
  sabaneta:   { name: 'Sabaneta',    area: 15,  pop: 115889 },
  laestrella: { name: 'La Estrella', area: 35,  pop: 85779 },
  caldas:     { name: 'Caldas',      area: 196, pop: 92817 }
};
function showMunInfo(id) {
  const d = MUN_DATA[id]; if (!d) return;
  const dens = Math.round(d.pop / d.area).toLocaleString('es-CO');
  const nEl = document.getElementById('mapa-info-mun');
  const dEl = document.getElementById('mapa-info-data');
  if (nEl) nEl.textContent = d.name;
  if (dEl) dEl.textContent =
    d.area.toLocaleString('es-CO') + ' km²  ·  ' +
    d.pop.toLocaleString('es-CO') + ' hab.  ·  ' +
    dens + ' hab/km²  ·  Proy. DANE 2023';
}
function clearMunInfo() {
  const nEl = document.getElementById('mapa-info-mun');
  const dEl = document.getElementById('mapa-info-data');
  if (nEl) nEl.textContent = 'Valle de Aburrá';
  if (dEl) dEl.textContent = 'Pasa el cursor sobre un municipio';
}
function highlightMun(id) {
  document.querySelectorAll('.mun-poly').forEach(p => p.classList.remove('mun-active'));
  document.querySelectorAll('.mdt-row').forEach(r => r.classList.remove('mdt-active'));
  const poly = document.getElementById('mp-' + id);
  if (poly) poly.classList.add('mun-active');
  const row = document.getElementById('mdt-' + id);
  if (row) { row.classList.add('mdt-active'); row.scrollIntoView({block: 'nearest', behavior: 'smooth'}); }
  showMunInfo(id);
}
function clearHighlight() {
  document.querySelectorAll('.mun-poly').forEach(p => p.classList.remove('mun-active'));
  document.querySelectorAll('.mdt-row').forEach(r => r.classList.remove('mdt-active'));
  clearMunInfo();
}

const LS_KEY = 'pmetrgrd_v2';
function saveToLocalStorage() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch(e) {}
}
// Sobrescribe títulos de proyectos y actividades en S con los de RAW (fuente de verdad)
function syncTitlesFromRaw() {
  const titles = {};
  RAW.forEach(o => o.estrategias.forEach(e => e.programas.forEach(p =>
    p.proyectos.forEach(pr => {
      titles[pr.id] = pr.title;
      pr.actividades.forEach(a => { titles[a.id] = a.title; });
    })
  )));
  S.forEach(o => o.estrategias.forEach(e => e.programas.forEach(p =>
    p.proyectos.forEach(pr => {
      if (titles[pr.id]) pr.title = titles[pr.id];
      pr.actividades.forEach(a => { if (titles[a.id]) a.title = titles[a.id]; });
    })
  )));
}

function toggleKMore(btn, count) {
  const cards = btn.previousElementSibling;
  const expanded = cards.style.display !== 'none';
  cards.style.display = expanded ? 'none' : 'block';
  btn.textContent = expanded ? '\u25BC Ver ' + count + ' resultados m\u00e1s' : '\u25B2 Ocultar resultados';
}

function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (!saved) return false;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length !== RAW.length) return false;
    S = parsed;
    syncTitlesFromRaw();
    return true;
  } catch(e) { return false; }
}
function allActs() {
  const r = [];
  S.forEach(o => o.estrategias.forEach(e => e.programas.forEach(p =>
    p.proyectos.forEach(pr =>
      pr.actividades.filter(actividadActiva).forEach(a => r.push({a,pr,p,e,o}))))));
  return r;
}
function avgPct(arr) { return arr.length ? Math.round(arr.reduce((s,x) => s + Math.min(x,100), 0) / arr.length) : 0; }
function sc(p) {
  if (p <= 0) return '#c0392b';
  if (p >= 100) return '#2e7d32';
  return '#e6a817';
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function setNavContext(context) {
  // context: 'landing' | 'plan' | 'prog'
  const planBtns = document.querySelectorAll('.plan-only');
  const progBtns = document.querySelectorAll('.prog-only');
  const inicioBtns = document.querySelectorAll('#btn-inicio');
  if (context === 'landing') {
    planBtns.forEach(b => b.style.display = 'none');
    progBtns.forEach(b => b.style.display = 'none');
    inicioBtns.forEach(b => b.style.display = 'none');
  } else if (context === 'plan') {
    planBtns.forEach(b => b.style.display = '');
    progBtns.forEach(b => b.style.display = 'none');
    inicioBtns.forEach(b => b.style.display = '');
  } else { // prog
    planBtns.forEach(b => b.style.display = 'none');
    progBtns.forEach(b => b.style.display = '');
    inicioBtns.forEach(b => b.style.display = '');
  }
}

function goView(viewName) {
  document.body.classList.remove('landing-active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const target = document.getElementById('view-' + viewName);
  if (target) target.classList.add('active');
  const btn = document.querySelector('.nav-btn[data-view="' + viewName + '"]');
  if (btn) btn.classList.add('active');
  if (viewName === 'plan') setNavContext('plan');
  else setNavContext('prog');
  if (viewName === 'arbol') renderArbol();
  if (viewName === 'kanban') renderKanban();
}

function showRiesgo(id) {
  const d = RIESGOS[id];
  if (!d) return;
  document.getElementById('riesgo-modal-icon').textContent = d.icon;
  document.getElementById('riesgo-modal-title').textContent = d.title;
  document.getElementById('riesgo-modal-body').innerHTML = d.body;
  document.getElementById('riesgo-modal').classList.add('open');
}
function closeRiesgo(e) {
  if (e.target === document.getElementById('riesgo-modal')) {
    document.getElementById('riesgo-modal').classList.remove('open');
  }
}

// Init: show landing
(function initLanding() {
  document.body.classList.add('landing-active');
  // Copy logo from topbar to landing
  const topbarLogo = document.querySelector('.topbar img');
  const landingLogo = document.getElementById('landing-logo');
  if (topbarLogo && landingLogo) landingLogo.src = topbarLogo.src;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-landing').classList.add('active');
  setNavContext('landing');
})();

document.getElementById('main-nav').addEventListener('click', e => {
  const btn = e.target.closest('.nav-btn');
  if (!btn) return;
  const viewName = btn.dataset.view;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  btn.classList.add('active');
  if (viewName === 'landing') {
    document.body.classList.add('landing-active');
    document.getElementById('view-landing').classList.add('active');
    setNavContext('landing');
  } else {
    document.body.classList.remove('landing-active');
    document.getElementById('view-' + viewName).classList.add('active');
    if (viewName === 'plan') setNavContext('plan');
    else setNavContext('prog');
    if (viewName === 'arbol') renderArbol();
    if (viewName === 'kanban') renderKanban();
  }
});

document.getElementById('dash-tabs').addEventListener('click', e => {
  const btn = e.target.closest('.subtab');
  if (!btn) return;
  document.querySelectorAll('#dash-tabs .subtab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const sub = btn.dataset.sub;
  document.getElementById('sub-visual').style.display = sub === 'visual' ? 'block' : 'none';
  document.getElementById('sub-obj').style.display = sub === 'obj' ? 'block' : 'none';
  document.getElementById('sub-proc').style.display = sub === 'proc' ? 'block' : 'none';
});

// ============================================
//  DASHBOARD
// ============================================

function renderDashboard() {
  const all = allActs();
  const tot = all.length;
  const con = all.filter(x => x.a.pct > 0).length;
  const cum = all.filter(x => x.a.pct >= 100).length;
  const sin = all.filter(x => x.a.pct <= 0).length;
  const globalAvg = Math.round(all.reduce((s,x) => s + Math.min(x.a.pct,100), 0) / tot);

  // KPI strip (white text on dark green)
  const setKpi = (id, val, sId, sPct) => {
    const el = document.getElementById(id);
    if (el) { el.textContent = val; el.style.color = 'white'; }
    const sl = document.getElementById(sId);
    if (sl) sl.textContent = Math.round(sPct) + '% del total';
  };
  setKpi('m-avance', con, 'm-avance-s', con/tot*100);
  setKpi('m-cum', cum, 'm-cum-s', cum/tot*100);
  setKpi('m-sin', sin, 'm-sin-s', sin/tot*100);
  const gEl = document.getElementById('m-global');
  if (gEl) { gEl.textContent = globalAvg + '%'; gEl.style.color = 'white'; }

  renderDonut(all);
  renderObjBars(all);
  renderProcChart(all);
  renderHeatmap(all);
  renderObjCards(all);
  renderProcCards(all);
  populateFilters(all);
  // Chart.js dark defaults
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#CCCCCC';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.08)';
  }
  // Visualizaciones
  renderTreemap(all);
  renderGantt(all);
  renderSunburst(all);
  updateLandingCounter();
}

// ── Animated Donut Chart ──────────────────────────────────────────
let donutAnimFrame = null;
function renderDonut(all) {
  const canvas = document.getElementById('donut-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const OBJ_COLORS = ['#339B33','#66CC33','#e6a817','#2e7d32'];
  const OBJ_NAMES  = ['Conocimiento','Reducción','Respuesta','Gobernanza'];

  const segments = S.map((obj, i) => {
    const acts = all.filter(x => x.o.id === obj.id);
    const avg = acts.length ? Math.round(acts.reduce((s,x) => s + Math.min(x.a.pct,100), 0) / acts.length) : 0;
    return { label: OBJ_NAMES[i], pct: avg, color: OBJ_COLORS[i], count: acts.length };
  });

  const globalAvg = Math.round(all.reduce((s,x) => s + Math.min(x.a.pct,100), 0) / all.length);
  const pctEl = document.getElementById('donut-pct');

  // Animate
  let progress = 0;
  if (donutAnimFrame) cancelAnimationFrame(donutAnimFrame);
  const animate = () => {
    progress = Math.min(progress + 0.03, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    drawDonut(ctx, canvas, segments, eased);
    if (pctEl) pctEl.textContent = Math.round(globalAvg * eased) + '%';
    if (progress < 1) donutAnimFrame = requestAnimationFrame(animate);
  };
  animate();

  // Legend
  const leg = document.getElementById('donut-legend');
  if (leg) {
    leg.innerHTML = segments.map(s => {
      const bc = s.pct >= 70 ? '#2e7d32' : s.pct >= 30 ? '#e6a817' : '#c0392b';
      return `<div class="legend-item">
        <div class="legend-dot" style="background:${s.color}"></div>
        <span>${s.label}</span>
        <span class="legend-val" style="color:${bc}">${s.pct}%</span>
      </div>`;
    }).join('');
  }
}

function drawDonut(ctx, canvas, segments, progress) {
  const W = canvas.width, H = canvas.height;
  const cx = W/2, cy = H/2, outerR = W/2 - 12, innerR = outerR * 0.62;
  ctx.clearRect(0, 0, W, H);

  const total = segments.reduce((s, x) => s + x.count, 0);
  let startAngle = -Math.PI / 2;
  const gap = 0.025;

  segments.forEach((seg, i) => {
    const slice = (seg.count / total) * Math.PI * 2 * progress;
    const endAngle = startAngle + slice - gap;

    // Main arc
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(startAngle + gap/2) * innerR, cy + Math.sin(startAngle + gap/2) * innerR);
    ctx.arc(cx, cy, outerR, startAngle + gap/2, endAngle, false);
    ctx.arc(cx, cy, innerR, endAngle, startAngle + gap/2, true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.globalAlpha = 0.9;
    ctx.fill();

    // Progress overlay (darker = not done)
    const doneFraction = Math.min(seg.pct / 100, 1);
    const doneEnd = startAngle + gap/2 + (endAngle - startAngle - gap/2 + gap/2) * doneFraction;

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(doneEnd) * innerR, cy + Math.sin(doneEnd) * innerR);
    ctx.arc(cx, cy, outerR, doneEnd, endAngle, false);
    ctx.arc(cx, cy, innerR, endAngle, doneEnd, true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.globalAlpha = 0.22;
    ctx.fill();

    ctx.globalAlpha = 1;
    startAngle += slice;
  });

  // Center circle — dark to match panel background
  ctx.beginPath();
  ctx.arc(cx, cy, innerR - 2, 0, Math.PI * 2);
  ctx.fillStyle = '#161b22';
  ctx.fill();
}

// ── Objective Bar Chart ───────────────────────────────────────────
function renderObjBars(all) {
  const con = document.getElementById('obj-bars-container');
  if (!con) return;
  const OBJ_COLORS = {OBJ1:'#339B33',OBJ2:'#66CC33',OBJ3:'#e6a817',OBJ4:'#2e7d32'};
  con.innerHTML = S.map((obj, i) => {
    const acts = all.filter(x => x.o.id === obj.id);
    const avg = acts.length ? Math.round(acts.reduce((s,x) => s + Math.min(x.a.pct,100),0) / acts.length) : 0;
    const cum = acts.filter(x => x.a.pct >= 100).length;
    const sin = acts.filter(x => x.a.pct <= 0).length;
    const enp = acts.length - cum - sin;
    const c = OBJ_COLORS[obj.id];
    const bc = avg >= 70 ? '#2e7d32' : avg >= 30 ? '#e6a817' : '#c0392b';
    const shortTitle = obj.title.replace('Incrementar la ','').replace('Fortalecer la Capacidad de ','').replace('Mejorar el ','').replace('Reducir los ','');
    return `<div class="obj-bar-row" data-obj="${obj.id}" title="Ver detalle de ${obj.title}">
      <div class="obj-bar-header">
        <div class="obj-bar-num" style="background:${c}20;color:${c}">0${i+1}</div>
        <div class="obj-bar-title">${shortTitle}</div>
        <div class="obj-bar-pct" style="color:${bc}">${avg}%</div>
      </div>
      <div class="obj-bar-track">
        <div class="obj-bar-fill" style="width:0%;background:${bc}" data-target="${avg}"></div>
      </div>
      <div class="obj-bar-sub">
        <span style="color:#2e7d32">✓ ${cum} cumplidas</span>
        <span style="color:#e6a817">~ ${enp} en proceso</span>
        <span style="color:#c0392b">✕ ${sin} sin iniciar</span>
        <span style="margin-left:auto">${acts.length} actividades</span>
      </div>
    </div>`;
  }).join('');

  // Animate bars
  requestAnimationFrame(() => {
    con.querySelectorAll('.obj-bar-fill[data-target]').forEach(el => {
      const t = el.dataset.target;
      setTimeout(() => { el.style.width = t + '%'; }, 100);
    });
  });
}

// ── Process GRD Chart ─────────────────────────────────────────────
let activeProc = null;
function renderProcChart(all) {
  const con = document.getElementById('proc-chart-container');
  if (!con) return;

  const procesos = [
    { key:'Conocimiento', label:'Conocimiento del riesgo', color:'#339B33', icon:'🔍' },
    { key:'Reducción',    label:'Reducción del riesgo',    color:'#66CC33', icon:'⬇' },
    { key:'Manejo',       label:'Manejo de desastres',     color:'#e6a817', icon:'🛡' },
    { key:'Gobernanza',   label:'Gobernanza y apropiación',color:'#2e7d32', icon:'🤝' },
  ];

  con.innerHTML = procesos.map(p => {
    const acts = all.filter(x => x.o.proceso === p.key);
    const avg = acts.length ? Math.round(acts.reduce((s,x) => s + Math.min(x.a.pct,100),0)/acts.length) : 0;
    const cum = acts.filter(x => x.a.pct >= 100).length;
    const sin = acts.filter(x => x.a.pct <= 0).length;
    const enp = acts.length - cum - sin;
    const bc = avg >= 70 ? '#2e7d32' : avg >= 30 ? '#c8920a' : '#c0392b';
    return `<div class="proc-chart-row" data-proc="${p.key}">
      <div class="proc-icon-sm" style="background:${p.color}20">
        <span style="font-size:16px">${p.icon}</span>
      </div>
      <div class="proc-chart-name" style="color:${p.color}">${p.label}</div>
      <div class="proc-chart-bar-wrap">
        <div class="proc-chart-track">
          <div class="proc-chart-fill" style="width:0%;background:${p.color}" data-target="${avg}">
            <span class="proc-chart-fill-label">${avg}%</span>
          </div>
        </div>
      </div>
      <div class="proc-chart-stats">
        <span style="color:#2e7d32;font-weight:600">${cum} ✓</span>
        <span style="color:#e6a817">${enp} ~</span>
        <span style="color:#c0392b">${sin} ✕</span>
        <span style="color:#9e9c96">${acts.length} total</span>
      </div>
    </div>`;
  }).join('');

  // Animate
  requestAnimationFrame(() => {
    con.querySelectorAll('.proc-chart-fill[data-target]').forEach(el => {
      const t = el.dataset.target;
      setTimeout(() => { el.style.width = t + '%'; }, 150);
    });
  });

  // Click to expand detail
  con.querySelectorAll('.proc-chart-row').forEach(row => {
    row.addEventListener('click', () => {
      const proc = row.dataset.proc;
      const detail = document.getElementById('proc-detail');
      if (activeProc === proc) {
        activeProc = null;
        detail.style.display = 'none';
        row.classList.remove('active');
        return;
      }
      activeProc = proc;
      con.querySelectorAll('.proc-chart-row').forEach(r => r.classList.remove('active'));
      row.classList.add('active');
      renderProcDetail(all, proc, detail);
      detail.style.display = 'block';
    });
  });
}

function renderProcDetail(all, proc, container) {
  const obj = S.find(o => o.proceso === proc);
  if (!obj) return;
  const progs = obj.estrategias.flatMap(e => e.programas);
  const procConf = {
    Conocimiento:{color:'#339B33'}, Reducción:{color:'#66CC33'},
    Manejo:{color:'#e6a817'}, Gobernanza:{color:'#2e7d32'}
  };
  const c = (procConf[proc] || {color:'#339B33'}).color;
  const items = progs.map(p => {
    const acts = all.filter(x => x.p.id === p.id);
    const avg = acts.length ? Math.round(acts.reduce((s,x) => s + Math.min(x.a.pct,100),0)/acts.length) : 0;
    const bc = avg >= 70 ? '#2e7d32' : avg >= 30 ? '#e6a817' : '#c0392b';
    const sn = p.title.replace(/PROG \d+[\.\d-]*\. /,'');
    return `<div class="proc-detail-item">
      <div class="proc-detail-name" style="white-space:normal;line-height:1.35">${sn}</div>
      <div class="proc-detail-bar"><div class="proc-detail-fill" style="width:${avg}%;background:${bc}"></div></div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="proc-detail-pct" style="color:${bc}">${avg}%</div>
        <div style="font-size:10px;color:#9e9c96">${acts.length} act.</div>
      </div>
    </div>`;
  }).join('');
  container.innerHTML = `<div style="font-size:12px;font-weight:700;color:${c};margin-bottom:10px">Programas del proceso: ${proc} del riesgo</div>
    <div class="proc-detail-grid">${items}</div>`;
}

// ── Heatmap de responsables ───────────────────────────────────────
function renderHeatmap(all) {
  const con = document.getElementById('heatmap-container');
  if (!con) return;

  // Get top responsables by total activities
  const respMap = {};
  all.forEach(({a, o}) => {
    const r = a.responsable || 'Sin asignar';
    if (!respMap[r]) respMap[r] = { name: r, total: 0, sin: 0, enp: 0, cum: 0 };
    respMap[r].total++;
    if (a.pct <= 0) respMap[r].sin++;
    else if (a.pct >= 100) respMap[r].cum++;
    else respMap[r].enp++;
  });

  // Sort by total, take top 15
  const resps = Object.values(respMap).sort((a,b) => b.total - a.total).slice(0, 15);

  // Color cell based on pct
  function cellColor(val, total) {
    if (!val || !total) return 'hm-zero';
    const p = val/total;
    if (p >= 0.8) return 'hm-full';
    if (p >= 0.4) return 'hm-high';
    if (p >= 0.2) return 'hm-mid';
    return 'hm-low';
  }

  let html = `<table class="heatmap-table">
    <thead><tr>
      <th>Responsable</th>
      <th style="background:#c0392b15;color:#c0392b">Sin iniciar</th>
      <th style="background:#e6a81715;color:#b05f00">En proceso</th>
      <th style="background:#2e7d3215;color:#2e7d32">Cumplidas</th>
      <th>Total</th>
      <th>Avance</th>
    </tr></thead><tbody>`;

  resps.forEach(r => {
    const avg = r.total ? Math.round(r.cum/r.total*100) : 0;
    const bc = avg >= 70 ? '#2e7d32' : avg >= 30 ? '#e6a817' : '#c0392b';
    const sinCls = r.sin > 0 ? (r.sin/r.total > 0.5 ? 'hm-low' : 'hm-mid') : 'hm-zero';
    const enpCls = r.enp > 0 ? (r.enp/r.total > 0.4 ? 'hm-high' : 'hm-mid') : 'hm-zero';
    const cumCls = r.cum > 0 ? (r.cum/r.total > 0.6 ? 'hm-full' : 'hm-high') : 'hm-zero';
    const shortName = r.name.length > 30 ? r.name.substring(0,28)+'...' : r.name;
    html += `<tr data-resp="${r.name}">
      <td title="${r.name}">${shortName}</td>
      <td><div class="hm-cell ${sinCls}">${r.sin||'–'}</div></td>
      <td><div class="hm-cell ${enpCls}">${r.enp||'–'}</div></td>
      <td><div class="hm-cell ${cumCls}">${r.cum||'–'}</div></td>
      <td><strong>${r.total}</strong></td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:6px;background:#edf2e8;border-radius:3px;overflow:hidden;min-width:50px">
            <div style="height:100%;width:${avg}%;background:${bc};border-radius:3px"></div>
          </div>
          <span style="font-size:11px;font-weight:700;color:${bc};min-width:28px">${avg}%</span>
        </div>
      </td>
    </tr>`;
  });

  // Totals row
  const tSin = resps.reduce((s,r)=>s+r.sin,0);
  const tEnp = resps.reduce((s,r)=>s+r.enp,0);
  const tCum = resps.reduce((s,r)=>s+r.cum,0);
  const tTot = resps.reduce((s,r)=>s+r.total,0);
  const tAvg = tTot ? Math.round(tCum/tTot*100) : 0;
  html += `<tr class="heatmap-total-row">
    <td>TOTAL (top 15)</td>
    <td><div class="hm-cell hm-low">${tSin}</div></td>
    <td><div class="hm-cell hm-mid">${tEnp}</div></td>
    <td><div class="hm-cell hm-full">${tCum}</div></td>
    <td><strong>${tTot}</strong></td>
    <td><strong style="color:#339B33">${tAvg}%</strong></td>
  </tr></tbody></table>`;

  con.innerHTML = html;

      // Click row to filter tree and navigate
      con.querySelectorAll('tr[data-resp]').forEach(row => {
        row.addEventListener('click', () => {
          const resp = row.dataset.resp;
          // Switch to tree view and filter
          const arbolBtn = document.querySelector('.nav-btn[data-view="arbol"]');
          if (arbolBtn) arbolBtn.click();
          setTimeout(() => {
            // Check that responsable in multiselect
            const wrap = document.getElementById('f-resp');
            if (wrap) {
              wrap.querySelectorAll('input[type=checkbox]').forEach(cb => {
                cb.checked = cb.value === resp;
              });
              updateRespLabel('f-resp');
              renderArbol();
            }
          }, 50);
        });
      });
}

function renderObjCards(all) {
  document.getElementById('obj-cards').innerHTML = S.map((o, i) => {
    const oa = all.filter(x => x.o.id === o.id);
    const ap = avgPct(oa.map(x => x.a.pct));
    const cum = oa.filter(x => x.a.pct >= 100).length;
    const sin = oa.filter(x => x.a.pct <= 0).length;
    const c = OBJ_COL[o.id];
    const bc = ap >= 70 ? 'var(--green)' : ap >= 30 ? 'var(--amber)' : 'var(--red)';
    const progs = o.estrategias.flatMap(e => e.programas).map(p => {
      const pa = all.filter(x => x.p.id === p.id);
      const pp = avgPct(pa.map(x => x.a.pct));
      const sn = p.title.replace(/PROG \d+[\.\d]*\. /,'');
      return `<div class="prog-row-item">
        <div class="prog-row-name" style="white-space:normal;line-height:1.35">${sn}</div>
        <div class="prog-bar-wrap"><div class="prog-bar-inner" style="width:${pp}%;background:${bc}"></div></div>
        <div class="prog-pct" style="color:${bc}">${pp}%</div>
      </div>`;
    }).join('');
    return `<div class="obj-card">
      <div class="obj-header">
        <div class="obj-num" style="background:${c}18;color:${c}">0${i+1}</div>
        <div>
          <div class="obj-title">${o.title}</div>
          <div class="obj-meta">${oa.length} actividades · ${o.estrategias.length} estrategias</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
        <span style="color:var(--text2)">Avance promedio</span>
        <span style="font-weight:600;color:${bc};font-family:'DM Mono',monospace">${ap}%</span>
      </div>
      <div class="prog-bar-track" style="margin-bottom:10px"><div class="prog-bar-fill" style="width:${ap}%;background:${bc}"></div></div>
      <div class="stat-row">
        <span class="stat-item"><span class="dot" style="background:var(--green)"></span>${cum} cumplidas</span>
        <span class="stat-item"><span class="dot" style="background:var(--blue)"></span>${oa.length-cum-sin} en proceso</span>
        <span class="stat-item"><span class="dot" style="background:var(--red)"></span>${sin} sin iniciar</span>
      </div>
      <div class="prog-rows">${progs}</div>
    </div>`;
  }).join('');
}

function renderProcCards(all) {
  const procList = ['Conocimiento','Reducción','Manejo'];
  document.getElementById('proc-cards').innerHTML = procList.map(p => {
    const c = PROC_COL[p];
    const pa = all.filter(x => x.o.proceso === p);
    const ap = avgPct(pa.map(x => x.a.pct));
    const cum = pa.filter(x => x.a.pct >= 100).length;
    const sin = pa.filter(x => x.a.pct <= 0).length;
    const enp = pa.length - cum - sin;
    const bc = ap >= 70 ? 'var(--green)' : ap >= 30 ? 'var(--amber)' : 'var(--red)';
    const obj = S.find(o => o.proceso === p);
    const ests = (obj?.estrategias || []).map(e => {
      const ea = all.filter(x => x.e.id === e.id && x.o.proceso === p);
      const ep = avgPct(ea.map(x => x.a.pct));
      const sn = e.title.replace(/ESTRATEGIA \d+[: ]*/i,'').replace(/Estrategia \d+[.: ]*/i,'');
      return `<div class="prog-row-item">
        <div class="prog-row-name" style="white-space:normal;line-height:1.35">${sn}</div>
        <div class="prog-bar-wrap"><div class="prog-bar-inner" style="width:${ep}%;background:${bc}"></div></div>
        <div class="prog-pct" style="color:${bc}">${ep}%</div>
      </div>`;
    }).join('');
    return `<div class="proc-card">
      <div class="proc-icon" style="background:${c}18">
        <svg viewBox="0 0 20 20" fill="none" stroke="${c}" stroke-width="1.8"><circle cx="10" cy="10" r="7"/><line x1="10" y1="7" x2="10" y2="10" stroke-linecap="round"/><circle cx="10" cy="13" r="1" fill="${c}" stroke="none"/></svg>
      </div>
      <div class="proc-name" style="color:${c}">${p} del riesgo</div>
      <div class="proc-sub">Art. 6 Ley 1523 · ${pa.length} actividades</div>
      <div class="proc-pct" style="color:${bc}">${ap}%</div>
      <div class="proc-bar"><div class="proc-bar-fill" style="width:${ap}%;background:${bc}"></div></div>
      <div class="proc-stats-mini">
        <div class="pstat"><div class="pstat-val" style="color:var(--green)">${cum}</div><div class="pstat-lbl">Cumplidas</div></div>
        <div class="pstat"><div class="pstat-val" style="color:var(--blue)">${enp}</div><div class="pstat-lbl">En proceso</div></div>
        <div class="pstat"><div class="pstat-val" style="color:var(--red)">${sin}</div><div class="pstat-lbl">Sin iniciar</div></div>
      </div>
      <div class="proc-est-rows">${ests}</div>
    </div>`;
  }).join('');

  // Gobernanza
  const gc = PROC_COL['Gobernanza'];
  const ga = all.filter(x => x.o.proceso === 'Gobernanza');
  const gap2 = avgPct(ga.map(x => x.a.pct));
  const gcum = ga.filter(x => x.a.pct >= 100).length;
  const gsin = ga.filter(x => x.a.pct <= 0).length;
  const genp = ga.length - gcum - gsin;
  const gbc = gap2 >= 70 ? 'var(--green)' : gap2 >= 30 ? 'var(--amber)' : 'var(--red)';
  const gobj = S.find(o => o.proceso === 'Gobernanza');
  const gprogs = (gobj?.estrategias || []).flatMap(e => e.programas).map(pp => {
    const ppa = all.filter(x => x.p.id === pp.id);
    const ppp = avgPct(ppa.map(x => x.a.pct));
    const sn = pp.title.replace(/PROG \d+[\.\d]*\. /,'');
    return `<div class="prog-row-item">
      <div class="prog-row-name" style="width:230px;white-space:normal;line-height:1.35">${sn}</div>
      <div class="prog-bar-wrap"><div class="prog-bar-inner" style="width:${ppp}%;background:${gbc}"></div></div>
      <div class="prog-pct" style="color:${gbc}">${ppp}%</div>
    </div>`;
  }).join('');
  document.getElementById('gov-card-wrap').innerHTML = `<div class="gov-card-full">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="proc-icon" style="background:${gc}18">
          <svg viewBox="0 0 20 20" fill="none" stroke="${gc}" stroke-width="1.8"><circle cx="10" cy="7" r="3"/><path d="M4 17c0-4 12-4 12 0" stroke-linecap="round"/></svg>
        </div>
        <div>
          <div style="font-size:14px;font-weight:600;color:${gc}">Gobernanza y Apropiación Social <span style="font-weight:400;font-size:12px;color:var(--text3)">(transversal)</span></div>
          <div style="font-size:11px;color:var(--text3)">${ga.length} actividades · avance promedio: <strong style="color:${gbc};font-family:'DM Mono',monospace">${gap2}%</strong></div>
        </div>
      </div>
      <div style="display:flex;gap:14px;font-size:12px;color:var(--text2)">
        <span><span class="dot" style="background:var(--green);display:inline-block;vertical-align:middle;margin-right:4px"></span>${gcum} cumplidas</span>
        <span><span class="dot" style="background:var(--blue);display:inline-block;vertical-align:middle;margin-right:4px"></span>${genp} en proceso</span>
        <span><span class="dot" style="background:var(--red);display:inline-block;vertical-align:middle;margin-right:4px"></span>${gsin} sin iniciar</span>
      </div>
    </div>
    <div class="proc-bar" style="margin:14px 0 6px"><div class="proc-bar-fill" style="width:${gap2}%;background:${gbc}"></div></div>
    <div class="gov-inner">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="pstat"><div class="pstat-val" style="color:var(--green)">${gcum}</div><div class="pstat-lbl">Cumplidas</div></div>
        <div class="pstat"><div class="pstat-val" style="color:var(--blue)">${genp}</div><div class="pstat-lbl">En proceso</div></div>
        <div class="pstat"><div class="pstat-val" style="color:var(--red)">${gsin}</div><div class="pstat-lbl">Sin iniciar</div></div>
        <div class="pstat"><div class="pstat-val" style="color:${gbc};font-family:'DM Mono',monospace">${gap2}%</div><div class="pstat-lbl">Avance gral.</div></div>
      </div>
      <div><div style="font-size:12px;font-weight:500;color:var(--text3);margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em">Avance por programa</div>${gprogs}</div>
    </div>
  </div>`;
}

function populateFilters(all) {
  // Save current selections before rebuilding
  const savedResps = {
    'f-resp': getSelectedResps('f-resp'),
    'k-resp': getSelectedResps('k-resp')
  };
  const savedObjs = {
    'f-obj': document.getElementById('f-obj')?.value || '',
    'k-obj': document.getElementById('k-obj')?.value || ''
  };
  const resps = [...new Set(all.map(x => x.a.responsable).filter(r => r && r.length > 1))].sort();
  ['f-resp','k-resp'].forEach(id => {
    const wrap = document.getElementById(id);
    if (!wrap) return;
    const saved = savedResps[id] || [];
    wrap.innerHTML = resps.map(r => {
      const safe = r.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
      const chk = saved.includes(r) ? ' checked' : '';
      return `<label class="resp-opt"><input type="checkbox" value="${safe}"${chk}><span>${r}</span></label>`;
    }).join('');
    updateRespLabel(id);
  });
  ['f-obj','k-obj'].forEach(id => {
    const s = document.getElementById(id);
    if (!s) return;
    const saved = savedObjs[id];
    s.innerHTML = '<option value="">Todos los objetivos</option>' + S.map(o => `<option value="${o.id}">${o.title}</option>`).join('');
    if (saved) s.value = saved;
  });
}

function getSelectedResps(containerId) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return [];
  return [...wrap.querySelectorAll('input[type=checkbox]:checked')].map(cb => cb.value);
}

// ============================================
//  ÁRBOL
// ============================================
function getFiltered() {
  const q = document.getElementById('s-tree').value.toLowerCase();
  const oid = document.getElementById('f-obj').value;
  const rids = getSelectedResps('f-resp');
  const est = document.getElementById('f-est').value;
  return allActs().filter(({a, o}) => {
    if (q && !a.title.toLowerCase().includes(q) && !a.responsable.toLowerCase().includes(q)) return false;
    if (oid && o.id !== oid) return false;
    if (rids.length > 0 && !rids.includes(a.responsable)) return false;
    if (est === 'si' && a.pct > 0) return false;
    if (est === 'ep' && (a.pct <= 0 || a.pct >= 100)) return false;
    if (est === 'cu' && a.pct < 100) return false;
    return true;
  });
}

function toggle(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const hidden = el.classList.contains('hidden');
  exp[id] = hidden;
  el.classList.toggle('hidden', !hidden);
  const btn = document.querySelector(`[data-toggle="${id}"]`);
  if (btn) { const ch = btn.querySelector('.chev'); if (ch) ch.classList.toggle('open', hidden); }
}

function renderArbol() {
  const filtered = getFiltered();
  let h = '<div class="tree-wrap">';
  S.forEach(o => {
    const oa = filtered.filter(x => x.o.id === o.id);
    if (!oa.length) return;
    const nid = 'n_' + o.id;
    const op = exp[nid] !== false;
    const c = OBJ_COL[o.id];
    h += `<div style="margin-bottom:8px">
      <button class="tree-obj-btn" style="background:${c}" data-toggle="${nid}">
        <span>${o.title} <span style="font-weight:300;opacity:.8;font-size:11px">(${oa.length} actividades)</span></span>
        <span class="chev ${op?'open':''}">▶</span>
      </button>
      <div id="${nid}" class="tree-children ${op?'':'hidden'}">`;
    o.estrategias.forEach(e => {
      const ea = oa.filter(x => x.e.id === e.id);
      if (!ea.length) return;
      const eid = 'n_' + o.id + '_' + e.id;
      const ep2 = exp[eid] !== false;
      h += `<button class="tree-est-btn" data-toggle="${eid}">
        <span>${e.title}</span>
        <span class="chev ${ep2?'open':''}">▶</span>
      </button>
      <div id="${eid}" class="tree-children ${ep2?'':'hidden'}">`;
      e.programas.forEach(p => {
        const pa = ea.filter(x => x.p.id === p.id);
        if (!pa.length) return;
        const pav = avgPct(pa.map(x => x.a.pct));
        const pid = 'n_' + o.id + '_' + e.id + '_' + p.id;
        const pp2 = exp[pid] !== false;
        h += `<button class="tree-prog-btn" data-toggle="${pid}">
          <span>${p.title} <span style="color:var(--text3);font-size:11px;font-family:'DM Mono',monospace">${pav}%</span></span>
          <span class="chev ${pp2?'open':''}">▶</span>
        </button>
        <div id="${pid}" class="tree-children ${pp2?'':'hidden'}">`;
        p.proyectos.forEach(pr => {
          const pra = pa.filter(x => x.pr.id === pr.id);
          if (!pra.length) return;
          const prid = 'n_' + o.id + '_' + e.id + '_' + p.id + '_' + pr.id;
          const prp = exp[prid] !== false;
          h += `<div class="tree-proy-row">
            <button class="tree-proy-btn" data-toggle="${prid}" style="flex:1">
              <span><strong style="font-weight:600">${pr.id}</strong> — ${pr.title}</span>
              <span class="chev ${prp?'open':''}">▶</span>
            </button>
          </div>
          <div id="${prid}" class="tree-children ${prp?'':'hidden'}">
            <div class="act-table-wrap"><table class="act-table">
              <thead><tr>
                <th>Actividad</th>
                <th style="width:70px">Meta</th>
                <th style="width:70px">Ejec.</th>
                <th style="width:110px">Avance</th>
                <th style="width:130px">Responsable</th>
              </tr></thead><tbody>`;
          pra.forEach(({a, o:ao, e:ae, p:ap2, pr:apr}) => {
            const pct = Math.min(a.pct, 200);
            const color = sc(pct);
            const nuevaBadge = a.esNueva ? '<span class="badge-nuevo">Nueva</span> ' : '';
            h += `<tr class="act-row" data-act="${a.id}" data-o="${ao.id}" data-e="${ae.id}" data-p="${ap2.id}" data-pr="${apr.id}">
              <td style="max-width:320px;white-space:normal;line-height:1.4">${nuevaBadge}${a.title}</td>
              <td style="font-family:'DM Mono',monospace;font-size:11px">${a.meta || '—'}</td>
              <td style="font-family:'DM Mono',monospace;font-size:11px">${a.ejecutado || 0}</td>
              <td>
                <div style="display:flex;align-items:center;gap:6px">
                  <span style="font-size:11px;font-weight:600;color:${color};min-width:36px;font-family:'DM Mono',monospace">${pct.toFixed(0)}%</span>
                  <div class="mini-bar" style="flex:1"><div class="mini-bar-fill" style="width:${Math.min(pct,100)}%;background:${color}"></div></div>
                </div>
              </td>
              <td style="font-size:11px;color:var(--text3)">${a.responsable || '—'}</td>
            </tr>`;
          });
          h += `</tbody></table></div>`;
          // Botón agregar actividad (solo modo editable)
          if (!READ_ONLY) {
            h += `<button class="btn-agregar-actividad" data-prid="${pr.id}" data-pid="${p.id}" data-eid="${e.id}" data-oid="${o.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              Agregar actividad
            </button>`;
          }
          h += `</div>`;
        });
        h += `</div>`;
      });
      h += `</div>`;
    });
    h += `</div></div>`;
  });
  h += '</div>';
  const root = document.getElementById('tree-root');
  root.innerHTML = h;
  renderActividadesRemovidas();
}

document.getElementById('tree-root').addEventListener('click', e => {
  const btn = e.target.closest('[data-toggle]');
  if (btn) { toggle(btn.dataset.toggle); return; }
  const addActBtn = e.target.closest('.btn-agregar-actividad');
  if (addActBtn) { openAddActivityModal(addActBtn.dataset.prid, addActBtn.dataset.pid, addActBtn.dataset.eid, addActBtn.dataset.oid); return; }
  const row = e.target.closest('.act-row');
  if (row) openModal(row.dataset.act, row.dataset.o, row.dataset.e, row.dataset.p, row.dataset.pr);
});

['s-tree','f-obj','f-est'].forEach(id =>
  document.getElementById(id).addEventListener('input', renderArbol));
const frespWrap = document.getElementById('f-resp');
if (frespWrap) frespWrap.addEventListener('change', renderArbol);

// ============================================
//  KANBAN
// ============================================
function renderKanban() {
  const q = document.getElementById('s-kan').value.toLowerCase();
  const oid = document.getElementById('k-obj').value;
  const krids = getSelectedResps('k-resp');
  const all = allActs().filter(({a, o}) => {
    if (q && !a.title.toLowerCase().includes(q) && !a.responsable.toLowerCase().includes(q)) return false;
    if (oid && o.id !== oid) return false;
    if (krids.length > 0 && !krids.includes(a.responsable)) return false;
    return true;
  });
  const cols = [
    {label:'Sin iniciar', color:'var(--red)', items:[]},
    {label:'En proceso (1–49%)', color:'var(--blue)', items:[]},
    {label:'En proceso (50–99%)', color:'var(--amber)', items:[]},
    {label:'Cumplido / Superado', color:'var(--green)', items:[]}
  ];
  all.forEach(f => {
    const p = f.a.pct;
    if (p <= 0) cols[0].items.push(f);
    else if (p < 50) cols[1].items.push(f);
    else if (p < 100) cols[2].items.push(f);
    else cols[3].items.push(f);
  });
  const mkCard = (col) => ({a, o, e, p, pr}) =>
    `<div class="k-card" data-act="${a.id}" data-o="${o.id}" data-e="${e.id}" data-p="${p.id}" data-pr="${pr.id}">
      <div class="k-card-title">${a.esNueva ? '<span class="badge-nuevo">Nueva</span> ' : ''}${a.title}</div>
      <div class="k-card-foot">
        <span class="k-tag" style="background:${OBJ_COL[o.id]}18;color:${OBJ_COL[o.id]}">${o.proceso}</span>
        <span style="font-size:10px;color:var(--text3)">${a.responsable || '—'}</span>
        <span class="k-pct" style="color:${col.color}">${a.pct.toFixed(0)}%</span>
        <button class="k-expand-btn" title="Expandir/colapsar" onclick="event.stopPropagation();const c=this.closest('.k-card');c.classList.toggle('k-card-expanded');this.textContent=c.classList.contains('k-card-expanded')?'▲':'▼'">▼</button>
      </div>
    </div>`;
  document.getElementById('kanban-root').innerHTML = cols.map(col => {
    const cardFn = mkCard(col);
    const visible = col.items.slice(0, 35).map(cardFn).join('');
    const hiddenItems = col.items.slice(35);
    const more = hiddenItems.length > 0
      ? `<div class="k-more-wrap">
          <div class="k-more-cards" style="display:none">${hiddenItems.map(cardFn).join('')}</div>
          <button class="k-more-btn" onclick="toggleKMore(this,${hiddenItems.length})">▼ Ver ${hiddenItems.length} resultados más</button>
        </div>` : '';
    return `<div class="k-col">
      <div class="k-col-head">
        <div class="k-col-title" style="color:${col.color}">${col.label}</div>
        <div class="k-count">${col.items.length}</div>
      </div>
      ${visible}${more}
    </div>`;
  }).join('');
}

document.getElementById('kanban-root').addEventListener('click', e => {
  const card = e.target.closest('.k-card');
  if (card) openModal(card.dataset.act, card.dataset.o, card.dataset.e, card.dataset.p, card.dataset.pr);
});
['s-kan','k-obj'].forEach(id =>
  document.getElementById(id).addEventListener('input', renderKanban));
const krespWrap = document.getElementById('k-resp');
if (krespWrap) krespWrap.addEventListener('change', renderKanban);

// ============================================
//  MODAL
// ============================================
function findAct(aid, oid, eid, pid, prid) {
  const o = S.find(x => x.id === oid);
  const e = o?.estrategias.find(x => x.id === eid);
  const p = e?.programas.find(x => x.id === pid);
  const pr = p?.proyectos.find(x => x.id === prid);
  return pr?.actividades.find(x => x.id === aid);
}

function openModal(aid, oid, eid, pid, prid) {
  const READ_ONLY = new URLSearchParams(window.location.search).get('modo') === 'lectura' || window.innerWidth < 768;
  if (READ_ONLY) return;
  const a = findAct(aid, oid, eid, pid, prid);
  if (!a) return;
  editRef = {aid, oid, eid, pid, prid};
  document.getElementById('m-title').textContent = a.title;
  document.getElementById('m-ind').textContent = a.indicador || '—';
  document.getElementById('m-meta').value = a.meta || 0;
  document.getElementById('m-ejec').value = a.ejecutado || 0;
  document.getElementById('m-desc').value = a.descripcion || '';
  const respArray = a.responsables || (a.responsable && a.responsable.trim() ? [a.responsable.trim()] : []);
  renderChips('m-resp-chips', respArray, false);
  document.getElementById('m-resp-input').value = '';
  document.getElementById('m-plazo').value = a.plazo || 'ND';
  document.getElementById('m-notas').value = a.notas || '';
  updatePctPreview();
  document.getElementById('modal-overlay').classList.add('open');
}

function updatePctPreview() {
  const meta = parseFloat(document.getElementById('m-meta').value) || 0;
  const ejec = parseFloat(document.getElementById('m-ejec').value) || 0;
  const pct = meta > 0 ? Math.round(ejec / meta * 1000) / 10 : (ejec > 0 ? 100 : 0);
  const el = document.getElementById('m-pct-preview');
  el.textContent = pct.toFixed(1) + '%';
  el.style.color = sc(pct);
}

['m-meta','m-ejec'].forEach(id =>
  document.getElementById(id).addEventListener('input', updatePctPreview));

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});
document.getElementById('btn-cancel').addEventListener('click', closeModal);

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  editRef = null;
}

document.getElementById('btn-save').addEventListener('click', () => {
  const READ_ONLY = new URLSearchParams(window.location.search).get('modo') === 'lectura' || window.innerWidth < 768;
  if (READ_ONLY) return;
  if (!editRef) return;
  const a = findAct(editRef.aid, editRef.oid, editRef.eid, editRef.pid, editRef.prid);
  if (!a) return;
  const meta = parseFloat(document.getElementById('m-meta').value) || 0;
  const ejec = parseFloat(document.getElementById('m-ejec').value) || 0;
  a.meta = meta;
  a.ejecutado = ejec;
  a.pct = meta > 0 ? Math.round(ejec / meta * 1000) / 10 : (ejec > 0 ? 100 : 0);
  a.descripcion = document.getElementById('m-desc').value;
  const responsables = [...(_chipsData['m-resp-chips'] || [])];
  a.responsables = responsables;
  a.responsable = responsables.join(', ') || '';
  a.plazo = document.getElementById('m-plazo').value;
  a.notas = document.getElementById('m-notas').value;
  closeModal();
  const currentView = document.querySelector('.nav-btn.active')?.dataset.view;
  renderDashboard();
  if (currentView === 'arbol') renderArbol();
  if (currentView === 'kanban') renderKanban();
  saveToLocalStorage();
  pushToFirebase();
  showToast('✓ Guardado y sincronizado con el equipo');
});

document.getElementById('btn-remove-act').addEventListener('click', () => {
  if (!editRef) return;
  const a = findAct(editRef.aid, editRef.oid, editRef.eid, editRef.pid, editRef.prid);
  if (!a) return;
  document.getElementById('modal-confirmar-act-msg').textContent =
    `¿Remover la actividad "${a.title}" del plan activo?`;
  closeModal();
  document.getElementById('modal-confirmar-remover-act').classList.add('open');
  // guardar ref para cuando se confirme
  document.getElementById('modal-confirmar-remover-act').dataset.aid  = editRef.aid;
  document.getElementById('modal-confirmar-remover-act').dataset.oid  = editRef.oid;
  document.getElementById('modal-confirmar-remover-act').dataset.eid  = editRef.eid;
  document.getElementById('modal-confirmar-remover-act').dataset.pid  = editRef.pid;
  document.getElementById('modal-confirmar-remover-act').dataset.prid = editRef.prid;
});

// ============================================
//  DOWNLOAD — inject updated data and save
// ============================================
document.getElementById('btn-download').addEventListener('click', () => {
  saveToLocalStorage();
  pushToFirebase();
  showToast('Cambios publicados para todo el equipo');
});

// ============================================
//  EXPORTAR A EXCEL  (reescrito — XLSX válido)
// ============================================
document.getElementById('btn-excel').addEventListener('click', exportToExcel);

function exportToExcel() {
  showToast('Generando Excel...');
  setTimeout(() => {
    try {
      // Collect flat rows per objective
      const sheetDefs = [];
      S.forEach(obj => {
        const rows = [];
        rows.push([obj.id + ': ' + obj.title, '', '', '', '', '', '', '', '', '']);
        rows.push(['', '', '', '', '', '', '', '', '', '']);
        obj.estrategias.forEach(est => {
          rows.push([est.title, '', '', '', '', '', '', '', '', '']);
          est.programas.forEach(prog => {
            rows.push([prog.title, '', '', '', '', '', '', '', '', '']);
            rows.push(['Nro', 'PROYECTO', 'ACTIVIDAD', 'INDICADOR', 'META', 'EJECUTADO', '% EJECUCION', 'DESCRIPCION', 'RESPONSABLE', 'NOTAS']);
            prog.proyectos.forEach(proy => {
              const actsActivas = proy.actividades.filter(actividadActiva);
              actsActivas.forEach((act, idx) => {
                rows.push([
                  idx === 0 ? proy.id : '',
                  idx === 0 ? proy.title : '',
                  act.title,
                  act.indicador || '',
                  act.meta != null ? act.meta : 0,
                  act.ejecutado != null ? act.ejecutado : 0,
                  act.pct != null ? act.pct : 0,
                  act.descripcion || '',
                  act.responsables ? act.responsables.join(', ') : (act.responsable || ''),
                  act.notas || ''
                ]);
              });
            });
            rows.push(['', '', '', '', '', '', '', '', '', '']);
          });
        });
        sheetDefs.push({ name: obj.id, rows });
      });

      const xlsxBytes = buildXLSX(sheetDefs);
      const blob = new Blob([xlsxBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'PMetrGRD_Seguimiento_' + new Date().toISOString().slice(0, 10) + '.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('✓ Excel descargado correctamente');
    } catch (e) {
      console.error('Excel error:', e);
      showToast('Error al generar Excel: ' + e.message);
    }
  }, 120);
}

// ── Core XLSX builder ─────────────────────────────────────────────
function buildXLSX(sheetDefs) {
  function xe(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function colLetter(n) { // 0-based
    let s = '';
    for (let c = n + 1; c > 0;) { c--; s = String.fromCharCode(65 + (c % 26)) + s; c = Math.floor(c / 26); }
    return s;
  }

  // ── Shared strings ──
  const strArr = [];
  const strIdx = Object.create(null);
  function ss(v) {
    const k = String(v == null ? '' : v);
    if (strIdx[k] === undefined) { strIdx[k] = strArr.length; strArr.push(k); }
    return strIdx[k];
  }
  // Pre-register all strings
  sheetDefs.forEach(sd => sd.rows.forEach(row => row.forEach(cell => {
    if (typeof cell === 'string') ss(cell);
  })));

  // ── Worksheet XMLs ──
  const colWidths = [8, 35, 55, 45, 12, 12, 14, 50, 25, 40];
  const wsXmls = sheetDefs.map(sd => {
    let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    x += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    // cols MUST come before sheetData per OOXML spec
    x += '<cols>';
    colWidths.forEach((w, i) => {
      x += `<col min="${i+1}" max="${i+1}" width="${w}" bestFit="1" customWidth="1"/>`;
    });
    x += '</cols>';
    x += '<sheetData>';
    sd.rows.forEach((row, ri) => {
      const hasData = row.some(c => c !== '' && c != null);
      if (!hasData) return;
      x += `<row r="${ri + 1}">`;
      row.forEach((cell, ci) => {
        if (cell === '' || cell == null) return;
        const addr = colLetter(ci) + (ri + 1);
        if (typeof cell === 'number') {
          // col index 6 = % — store as plain number (already 0-200 scale)
          x += `<c r="${addr}"><v>${cell}</v></c>`;
        } else {
          x += `<c r="${addr}" t="s"><v>${ss(cell)}</v></c>`;
        }
      });
      x += '</row>';
    });
    x += '</sheetData></worksheet>';
    return x;
  });

  // ── Shared strings XML ──
  let ssXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  ssXml += `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strArr.length}" uniqueCount="${strArr.length}">`;
  strArr.forEach(s => { ssXml += `<si><t xml:space="preserve">${xe(s)}</t></si>`; });
  ssXml += '</sst>';

  // ── Minimal styles ──
  const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
    '</styleSheet>';

  // ── Workbook XML ──
  let wbXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  wbXml += '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
           ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
  wbXml += '<sheets>';
  sheetDefs.forEach((sd, i) => {
    wbXml += `<sheet name="${xe(sd.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`;
  });
  wbXml += '</sheets></workbook>';

  // ── Relationships ──
  let wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  wbRels += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  sheetDefs.forEach((_, i) => {
    wbRels += `<Relationship Id="rId${i + 1}" ` +
      `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ` +
      `Target="worksheets/sheet${i + 1}.xml"/>`;
  });
  const ssRid = sheetDefs.length + 1;
  const stRid = sheetDefs.length + 2;
  wbRels += `<Relationship Id="rId${ssRid}" ` +
    `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" ` +
    `Target="sharedStrings.xml"/>`;
  wbRels += `<Relationship Id="rId${stRid}" ` +
    `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" ` +
    `Target="styles.xml"/>`;
  wbRels += '</Relationships>';

  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" ' +
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" ' +
    'Target="xl/workbook.xml"/></Relationships>';

  // ── Content Types ──
  let ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  ct += '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">';
  ct += '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>';
  ct += '<Default Extension="xml" ContentType="application/xml"/>';
  ct += '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>';
  sheetDefs.forEach((_, i) => {
    ct += `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ` +
      `ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  });
  ct += '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>';
  ct += '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
  ct += '</Types>';

  // ── Assemble file map and build ZIP ──
  const files = {};
  files['[Content_Types].xml'] = ct;
  files['_rels/.rels'] = rootRels;
  files['xl/workbook.xml'] = wbXml;
  files['xl/_rels/workbook.xml.rels'] = wbRels;
  files['xl/sharedStrings.xml'] = ssXml;
  files['xl/styles.xml'] = stylesXml;
  sheetDefs.forEach((_, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = wsXmls[i];
  });

  return zipFiles(files);
}

// ── ZIP builder (stored, no compression) ─────────────────────────
function zipFiles(fileMap) {
  const enc = new TextEncoder();
  const entries = [];
  let dataOffset = 0;

  for (const [name, content] of Object.entries(fileMap)) {
    const nameBuf = enc.encode(name);
    const dataBuf = enc.encode(content);
    const crc = computeCRC32(dataBuf);
    const localHeader = makeLocalFileHeader(nameBuf, dataBuf.length, crc);
    entries.push({ nameBuf, dataBuf, crc, localHeader, offset: dataOffset });
    dataOffset += localHeader.length + dataBuf.length;
  }

  // Central directory records
  const cdRecords = entries.map(e => makeCentralDirRecord(e));
  const cdSize = cdRecords.reduce((s, r) => s + r.length, 0);
  const cdOffset = dataOffset;
  const eocd = makeEOCD(entries.length, cdSize, cdOffset);

  const totalSize = dataOffset + cdSize + eocd.length;
  const out = new Uint8Array(totalSize);
  let pos = 0;
  for (const e of entries) {
    out.set(e.localHeader, pos); pos += e.localHeader.length;
    out.set(e.dataBuf, pos);    pos += e.dataBuf.length;
  }
  for (const r of cdRecords) { out.set(r, pos); pos += r.length; }
  out.set(eocd, pos);
  return out;
}

function makeLocalFileHeader(nameBuf, dataLen, crc) {
  const buf = new Uint8Array(30 + nameBuf.length);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, 0x04034b50, true); // sig
  dv.setUint16(4, 20, true);          // version needed
  dv.setUint16(6, 0x0800, true);      // flags: UTF-8
  dv.setUint16(8, 0, true);           // compression: stored
  dv.setUint16(10, 0, true);          // mod time
  dv.setUint16(12, 0, true);          // mod date
  dv.setUint32(14, crc, true);
  dv.setUint32(18, dataLen, true);    // compressed size
  dv.setUint32(22, dataLen, true);    // uncompressed size
  dv.setUint16(26, nameBuf.length, true);
  dv.setUint16(28, 0, true);          // extra length
  buf.set(nameBuf, 30);
  return buf;
}

function makeCentralDirRecord(e) {
  const buf = new Uint8Array(46 + e.nameBuf.length);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, 0x02014b50, true);
  dv.setUint16(4, 20, true);
  dv.setUint16(6, 20, true);
  dv.setUint16(8, 0x0800, true);
  dv.setUint16(10, 0, true);
  dv.setUint16(12, 0, true);
  dv.setUint16(14, 0, true);
  dv.setUint32(16, e.crc, true);
  dv.setUint32(20, e.dataBuf.length, true);
  dv.setUint32(24, e.dataBuf.length, true);
  dv.setUint16(28, e.nameBuf.length, true);
  dv.setUint16(30, 0, true);
  dv.setUint16(32, 0, true);
  dv.setUint16(34, 0, true);
  dv.setUint16(36, 0, true);
  dv.setUint32(38, 0, true);
  dv.setUint32(42, e.offset, true);
  buf.set(e.nameBuf, 46);
  return buf;
}

function makeEOCD(count, cdSize, cdOffset) {
  const buf = new Uint8Array(22);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, 0x06054b50, true);
  dv.setUint16(4, 0, true);
  dv.setUint16(6, 0, true);
  dv.setUint16(8, count, true);
  dv.setUint16(10, count, true);
  dv.setUint32(12, cdSize, true);
  dv.setUint32(16, cdOffset, true);
  dv.setUint16(20, 0, true);
  return buf;
}

function computeCRC32(data) {
  if (!computeCRC32._table) {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    computeCRC32._table = t;
  }
  const table = computeCRC32._table;
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ============================================
//  INIT
// ============================================
if (READ_ONLY) {
  // Modo lectura: cargar datos sin conectar a Firebase
  initMultiSelects();
  loadFromLocalStorage();
  renderDashboard();
  showSyncStatus('local');
} else {
  initFirebase();
}


// ============================================
//  FIREBASE — carga dinamica
// ============================================
const FIREBASE_CFG = {
  apiKey: "AIzaSyDDgCRCz2YaZuL5vyWO581aYGfppZmNQKw",
  authDomain: "pmetrgrd-amva.firebaseapp.com",
  databaseURL: "https://pmetrgrd-amva-default-rtdb.firebaseio.com",
  projectId: "pmetrgrd-amva",
  storageBucket: "pmetrgrd-amva.firebasestorage.app",
  messagingSenderId: "507075477075",
  appId: "1:507075477075:web:8e6c67589b28bf191290a6"
};

let db = null;
let dbRef = null;
let isSyncing = false;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function initFirebase() {
  initMultiSelects();
  showSyncStatus('connecting');
  let retryCount = 0;
  const maxRetries = 3;

  function tryConnect() {
    Promise.all([
      loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js'),
      loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js')
    ]).then(() => {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(FIREBASE_CFG);
        }
        db = firebase.database();
        dbRef = db.ref('plan/data');

        // Test connection with a short timeout
        const connRef = firebase.database().ref('.info/connected');
        const timeout = setTimeout(() => {
          console.warn('Firebase connection timeout — running in local mode');
          showSyncStatus('local');
          if (loadFromLocalStorage()) { console.info('Datos restaurados desde localStorage'); }
          renderDashboard();
        }, 6000);

        connRef.on('value', (snap) => {
          if (snap.val() === true) {
            clearTimeout(timeout);
            showSyncStatus('connecting');
            dbRef.on('value', (snapshot) => {
              const data = snapshot.val();
              if (data && !isSyncing) {
                // Count activities in Firebase vs local RAW
                function countActs(tree) {
                  let n = 0;
                  tree.forEach(o => o.estrategias.forEach(e => e.programas.forEach(p =>
                    p.proyectos.forEach(pr => { n += pr.actividades.length; }))));
                  return n;
                }
                const firebaseCount = countActs(data);
                const localCount = countActs(RAW);
                if (firebaseCount >= localCount) {
                  // Firebase tiene igual o más actividades — cargar y preservar ediciones
                  S = JSON.parse(JSON.stringify(data));
                  syncTitlesFromRaw();
                } else {
                  // Local tiene más actividades (nueva versión desplegada) — subir a Firebase
                  console.log(`Actualizando Firebase: local=${localCount} > firebase=${firebaseCount}`);
                  S = JSON.parse(JSON.stringify(RAW));
                  pushToFirebase();
                }
                const currentView = document.querySelector('.nav-btn.active')?.dataset.view;
                renderDashboard();
                if (currentView === 'arbol') renderArbol();
                if (currentView === 'kanban') renderKanban();
                showSyncStatus('connected');
              } else if (!data) {
                pushToFirebase();
              }
            }, (error) => {
              console.error('Firebase listener error:', error);
              showSyncStatus('error');
              renderDashboard();
            });
          }
        });

      } catch(e) {
        console.error('Firebase setup error:', e);
        showSyncStatus('local');
        renderDashboard();
      }
    }).catch((e) => {
      retryCount++;
      if (retryCount < maxRetries) {
        console.warn(`Firebase scripts blocked, retry ${retryCount}/${maxRetries}...`);
        setTimeout(tryConnect, 3000);
      } else {
        console.warn('Firebase not available — running in local mode:', e.message);
        showSyncStatus('local');
        renderDashboard();
      }
    });
  }

  tryConnect();
}

function pushToFirebase() {
  if (!dbRef) {
    showToast('Modo local — Firebase no disponible en preview');
    renderDashboard();
    return;
  }
  isSyncing = true;
  showSyncStatus('saving');
  dbRef.set(S).then(() => {
    isSyncing = false;
    showSyncStatus('saved');
    setTimeout(() => showSyncStatus('connected'), 2500);
  }).catch((err) => {
    isSyncing = false;
    console.error('Push error:', err);
    showSyncStatus('error');
  });
}

function showSyncStatus(state) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const states = {
    connecting: { text: 'Conectando...', color: '#b05f00', dot: '#EF9F27' },
    connected:  { text: 'Sincronizado',  color: '#2d7a3a', dot: '#66CC33' },
    saving:     { text: 'Publicando...', color: '#185FA5', dot: '#185FA5' },
    saved:      { text: 'Publicado',     color: '#2d7a3a', dot: '#66CC33' },
    local:      { text: 'Modo local',    color: 'rgba(255,255,255,.7)', dot: '#aaa' },
    error:      { text: 'Sin conexión',  color: '#ffcc80', dot: '#ff8a65' },
  };
  const s = states[state] || states.local;
  // In local mode show a tooltip hint
  const title = state === 'local'
    ? 'Los datos se guardan localmente. Los cambios no se sincronizan con el equipo hasta recuperar conexión.'
    : '';
  el.title = title;
  el.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${s.dot};display:inline-block;margin-right:6px;flex-shrink:0${state==='connecting'?';animation:pulse 1.2s infinite':''}"></span><span style="color:${s.color};font-size:12px;white-space:nowrap">${s.text}</span>`;
}



// ============================================
//  MULTI-SELECT RESPONSABLES
// ============================================
function initMultiSelects() {
  ['f-resp','k-resp'].forEach(id => {
    const btn = document.getElementById(id + '-btn');
    const drop = document.getElementById(id + '-dropdown');
    const search = document.getElementById(id + '-search');
    if (!btn || !drop) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = drop.classList.contains('open');
      // Close all other dropdowns
      document.querySelectorAll('.resp-dropdown.open').forEach(d => {
        d.classList.remove('open');
        d.previousElementSibling?.classList.remove('open');
      });
      if (!isOpen) {
        drop.classList.add('open');
        btn.classList.add('open');
        if (search) search.focus();
      }
    });

    if (search) {
      search.addEventListener('input', () => {
        const q = search.value.toLowerCase();
        drop.querySelectorAll('.resp-opt').forEach(opt => {
          const txt = opt.querySelector('span').textContent.toLowerCase();
          opt.style.display = txt.includes(q) ? '' : 'none';
        });
      });
    }

    drop.addEventListener('change', () => {
      updateRespLabel(id);
      if (id === 'f-resp') renderArbol();
      if (id === 'k-resp') renderKanban();
    });
    drop.addEventListener('click', e => e.stopPropagation());
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.resp-dropdown.open').forEach(d => {
      d.classList.remove('open');
      d.previousElementSibling?.classList.remove('open');
    });
  });
}

function updateRespLabel(id) {
  const wrap = document.getElementById(id);
  const label = document.getElementById(id + '-label');
  if (!wrap || !label) return;
  const checked = [...wrap.querySelectorAll('input:checked')];
  if (checked.length === 0) {
    label.textContent = 'Todos los responsables';
  } else if (checked.length === 1) {
    label.textContent = checked[0].value;
  } else {
    label.innerHTML = `${checked.length} responsables seleccionados <span class="resp-badge">${checked.length}</span>`;
  }
}

function selectAllResps(id) {
  const wrap = document.getElementById(id);
  if (!wrap) return;
  wrap.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = true);
  updateRespLabel(id);
  if (id === 'f-resp') renderArbol();
  if (id === 'k-resp') renderKanban();
}

function toggleMarco(header) {
  const body = header.nextElementSibling;
  const chev = header.querySelector('.chev');
  body.classList.toggle('open');
  chev.style.transform = body.classList.contains('open') ? 'rotate(90deg)' : '';
}


function clearAllResps(id) {
  const wrap = document.getElementById(id);
  if (!wrap) return;
  wrap.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
  updateRespLabel(id);
  if (id === 'f-resp') renderArbol();
  if (id === 'k-resp') renderKanban();
}

// ============================================
//  CHIPS — UTILIDADES GENÉRICAS
// ============================================
let _chipsData = {};
function renderChips(containerId, chips, readOnly) {
  _chipsData[containerId] = [...chips];
  const cont = document.getElementById(containerId);
  if (!cont) return;
  cont.innerHTML = _chipsData[containerId].map((c, i) => `
    <span class="chip-tag">
      ${escapeHtml(c)}
      ${readOnly ? '' : `<button class="chip-remove" data-container="${containerId}" data-idx="${i}" title="Eliminar">×</button>`}
    </span>`).join('');
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function addChip(containerId, value) {
  const v = value.trim();
  if (!v) return false;
  if (!_chipsData[containerId]) _chipsData[containerId] = [];
  if (_chipsData[containerId].includes(v)) return false;
  _chipsData[containerId].push(v);
  renderChips(containerId, _chipsData[containerId], false);
  return true;
}

// Event delegation para remover chips
document.addEventListener('click', e => {
  const btn = e.target.closest('.chip-remove');
  if (!btn) return;
  const cont = btn.dataset.container;
  const idx = parseInt(btn.dataset.idx);
  if (!cont || isNaN(idx)) return;
  _chipsData[cont].splice(idx, 1);
  renderChips(cont, _chipsData[cont], false);
});

// Chips del modal de actividad
document.getElementById('m-resp-add').addEventListener('click', () => {
  const inp = document.getElementById('m-resp-input');
  if (addChip('m-resp-chips', inp.value)) inp.value = '';
  inp.focus();
});
document.getElementById('m-resp-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('m-resp-add').click(); }
});

// ============================================
//  REMOVER ACTIVIDAD — CONFIRMACIÓN
// ============================================
document.getElementById('modal-act-confirmar-cancelar').addEventListener('click', () => {
  document.getElementById('modal-confirmar-remover-act').classList.remove('open');
});
document.getElementById('modal-confirmar-remover-act').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-confirmar-remover-act'))
    document.getElementById('modal-confirmar-remover-act').classList.remove('open');
});

document.getElementById('modal-act-confirmar-ok').addEventListener('click', () => {
  const modal = document.getElementById('modal-confirmar-remover-act');
  const {aid, oid, eid, pid, prid} = modal.dataset;
  const a = findAct(aid, oid, eid, pid, prid);
  if (!a) return;
  a.removido = true;
  a.fechaRemocion = new Date().toISOString();
  modal.classList.remove('open');
  const currentView = document.querySelector('.nav-btn.active')?.dataset.view;
  renderDashboard();
  if (currentView === 'arbol') renderArbol();
  if (currentView === 'kanban') renderKanban();
  pushToFirebase();
  showToast('Actividad removida del plan activo');
});

function restoreActivity(aid, oid, eid, pid, prid) {
  const a = findAct(aid, oid, eid, pid, prid);
  if (!a) return;
  a.removido = false;
  delete a.fechaRemocion;
  const currentView = document.querySelector('.nav-btn.active')?.dataset.view;
  renderDashboard();
  if (currentView === 'arbol') renderArbol();
  if (currentView === 'kanban') renderKanban();
  pushToFirebase();
  showToast('✓ Actividad restaurada al plan activo');
}

// ============================================
//  ACTIVIDADES REMOVIDAS — PANEL
// ============================================
function renderActividadesRemovidas() {
  const wrap = document.getElementById('proyectos-removidos-wrap');
  if (!wrap) return;
  const removidas = [];
  S.forEach(o => o.estrategias.forEach(e => e.programas.forEach(p =>
    p.proyectos.forEach(pr =>
      pr.actividades.filter(a => a.removido).forEach(a =>
        removidas.push({a, pr, p, e, o}))))));

  if (removidas.length === 0) { wrap.innerHTML = ''; return; }

  const fechaFormato = iso => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const items = removidas.map(({a, pr, p, e, o}) => {
    const progN = p.title.replace(/PROG \d+[\.\d-]*\. /, '');
    const restoreBtn = READ_ONLY ? '' : `
      <button class="btn-restaurar-act" data-aid="${a.id}" data-oid="${o.id}" data-eid="${e.id}" data-pid="${p.id}" data-prid="${pr.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
        Restaurar
      </button>`;
    return `<div class="act-removida-item">
      <div>
        <div class="act-removida-title">${escapeHtml(a.title)}</div>
        <div class="act-removida-meta">${escapeHtml(pr.title)} · ${escapeHtml(progN)} · Removida: ${fechaFormato(a.fechaRemocion)}</div>
      </div>
      ${restoreBtn}
    </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="act-removidas-panel">
      <div class="act-removidas-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="10" y2="17"/><line x1="14" y1="12" x2="14" y2="17"/></svg>
        Actividades removidas (${removidas.length})
      </div>
      ${items}
    </div>`;

  wrap.querySelectorAll('.btn-restaurar-act').forEach(btn => {
    btn.addEventListener('click', () => {
      restoreActivity(btn.dataset.aid, btn.dataset.oid, btn.dataset.eid, btn.dataset.pid, btn.dataset.prid);
    });
  });
}

// ============================================
//  AGREGAR ACTIVIDAD — MODAL
// ============================================
let _addActContext = null;

function openAddActivityModal(prid, pid, eid, oid) {
  const o = S.find(x => x.id === oid);
  const e = o?.estrategias.find(x => x.id === eid);
  const p = e?.programas.find(x => x.id === pid);
  const pr = p?.proyectos.find(x => x.id === prid);
  if (!pr) return;
  _addActContext = { prid, pid, eid, oid };

  const infoEl = document.getElementById('aa-proyecto-info');
  if (infoEl) infoEl.textContent = `Proyecto: ${pr.id} — ${pr.title}`;

  ['aa-titulo','aa-indicador','aa-resp-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('aa-plazo').value = 'ND';
  renderChips('aa-resp-chips', [], false);
  document.getElementById('aa-error').style.display = 'none';
  document.getElementById('modal-agregar-actividad').classList.add('open');
}

document.getElementById('aa-resp-add').addEventListener('click', () => {
  const inp = document.getElementById('aa-resp-input');
  if (addChip('aa-resp-chips', inp.value)) inp.value = '';
  inp.focus();
});
document.getElementById('aa-resp-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('aa-resp-add').click(); }
});

document.getElementById('aa-btn-cancelar').addEventListener('click', () => {
  document.getElementById('modal-agregar-actividad').classList.remove('open');
  _addActContext = null;
});
document.getElementById('modal-agregar-actividad').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-agregar-actividad')) {
    document.getElementById('modal-agregar-actividad').classList.remove('open');
    _addActContext = null;
  }
});

document.getElementById('aa-btn-guardar').addEventListener('click', () => {
  const errEl = document.getElementById('aa-error');
  errEl.style.display = 'none';
  if (!_addActContext) return;
  const titulo = document.getElementById('aa-titulo').value.trim();
  if (!titulo) {
    errEl.textContent = 'El título de la actividad es obligatorio.';
    errEl.style.display = '';
    return;
  }
  const {prid, pid, eid, oid} = _addActContext;
  const o = S.find(x => x.id === oid);
  const e = o?.estrategias.find(x => x.id === eid);
  const p = e?.programas.find(x => x.id === pid);
  const pr = p?.proyectos.find(x => x.id === prid);
  if (!pr) { errEl.textContent = 'Error: proyecto no encontrado.'; errEl.style.display=''; return; }

  const responsables = [...(_chipsData['aa-resp-chips'] || [])];
  const newAct = {
    id: 'ACT-' + Date.now(),
    title: titulo,
    indicador: document.getElementById('aa-indicador').value.trim(),
    meta: 0,
    ejecutado: 0,
    pct: 0,
    descripcion: '',
    responsable: responsables.join(', ') || '',
    responsables,
    plazo: document.getElementById('aa-plazo').value,
    notas: '',
    esNueva: true,
    fechaCreacion: new Date().toISOString()
  };
  pr.actividades.push(newAct);

  document.getElementById('modal-agregar-actividad').classList.remove('open');
  _addActContext = null;

  const currentView = document.querySelector('.nav-btn.active')?.dataset.view;
  renderDashboard();
  if (currentView === 'arbol') renderArbol();
  if (currentView === 'kanban') renderKanban();
  pushToFirebase();
  showToast('✓ Actividad agregada al plan');
});

// ============================================
//  CONTADOR DINÁMICO DE ACTIVIDADES
// ============================================
function updateLandingCounter() {
  const total = allActs().length;
  const el1 = document.getElementById('landing-act-count');
  const el2 = document.getElementById('landing-stat-act-n');
  if (el1) el1.textContent = total;
  if (el2) el2.textContent = total;
}

// ============================================
//  GRÁFICA A — TREEMAP (D3.js)
// ============================================
function renderTreemap(allActsData) {
  const container = document.getElementById('chart-treemap');
  if (!container || typeof d3 === 'undefined') return;
  container.innerHTML = '';

  const OBJ_BASE = { OBJ1:'#1B5E20', OBJ2:'#2E7D32', OBJ3:'#388E3C', OBJ4:'#4CAF50' };

  const treeData = {
    name: 'Plan',
    children: S.map(obj => ({
      name: obj.title,
      objId: obj.id,
      children: obj.estrategias.flatMap(e => e.programas).map(prog => {
        const progActs = allActsData.filter(x => x.p.id === prog.id);
        const pct = avgPct(progActs.map(x => x.a.pct));
        return {
          name: prog.title.replace(/PROG \d+[\.\d-]*\. /, ''),
          objId: obj.id,
          value: prog.proyectos.length || 1,
          actCount: progActs.length,
          projCount: prog.proyectos.length,
          pct
        };
      })
    }))
  };

  const W = container.offsetWidth || 800;
  const H = Math.max(300, Math.min(380, W * 0.48));
  container.style.height = H + 'px';

  const root = d3.hierarchy(treeData).sum(d => d.value).sort((a, b) => b.value - a.value);
  d3.treemap().size([W, H]).paddingInner(2).paddingOuter(4).paddingTop(20)(root);

  const svg = d3.select(container).append('svg')
    .attr('width', W).attr('height', H)
    .style('display', 'block');

  // Escala de color por objetivo (claro → oscuro según posición)
  function cellColor(d) {
    const base = OBJ_BASE[d.data.objId] || '#339B33';
    return base;
  }

  const node = svg.selectAll('g').data(root.leaves()).enter().append('g')
    .attr('transform', d => `translate(${d.x0},${d.y0})`);

  node.append('rect')
    .attr('width', d => Math.max(0, d.x1 - d.x0))
    .attr('height', d => Math.max(0, d.y1 - d.y0))
    .attr('fill', d => cellColor(d))
    .attr('fill-opacity', (_, i) => 0.6 + (i % 4) * 0.1)
    .attr('rx', 3)
    .attr('stroke', '#0e1115')
    .attr('stroke-width', 1);

  node.append('text')
    .attr('x', 5).attr('y', 14)
    .attr('fill', 'white')
    .attr('font-size', d => (d.x1 - d.x0) > 100 ? '11px' : '9px')
    .attr('font-family', 'DM Sans, sans-serif')
    .text(d => {
      const w = d.x1 - d.x0;
      const h2 = d.y1 - d.y0;
      if (w < 40 || h2 < 18) return '';
      const maxChars = Math.floor(w / 7);
      return d.data.name.length > maxChars ? d.data.name.substring(0, maxChars - 1) + '…' : d.data.name;
    });

  node.append('text')
    .attr('x', 5).attr('y', 28)
    .attr('fill', 'rgba(255,255,255,0.75)')
    .attr('font-size', '9px')
    .attr('font-family', 'DM Sans, sans-serif')
    .text(d => {
      const w = d.x1 - d.x0;
      const h2 = d.y1 - d.y0;
      if (w < 60 || h2 < 32) return '';
      return `${d.data.projCount} proy · ${d.data.pct}%`;
    });

  node.append('title').text(d =>
    `${d.data.name}\n${d.data.projCount} proyecto(s) · ${d.data.actCount} actividades · ${d.data.pct}% avance`);

  // Etiquetas de objetivo (cabeceras)
  svg.selectAll('.obj-label').data(root.children || []).enter().append('text')
    .attr('class', 'obj-label')
    .attr('x', d => d.x0 + 4)
    .attr('y', d => d.y0 + 14)
    .attr('fill', 'white')
    .attr('font-size', '10px')
    .attr('font-weight', '700')
    .attr('font-family', 'DM Sans, sans-serif')
    .text(d => (d.data.name || '').replace('Mejorar el ','').replace('Fortalecer la Capacidad de ','').replace('Incrementar la ','').substring(0,28));
}

// ============================================
//  GRÁFICA B — GANTT / LÍNEA DE TIEMPO (Chart.js)
// ============================================
let _ganttChart = null;
function renderGantt(allActsData) {
  const canvas = document.getElementById('chart-gantt');
  if (!canvas || typeof Chart === 'undefined') return;

  if (_ganttChart) { _ganttChart.destroy(); _ganttChart = null; }

  const START = new Date('2024-01-01').getTime();
  const END   = new Date('2027-12-31').getTime();
  const today = Date.now();

  const labels = [];
  const data   = [];
  const bgColors = [];

  S.forEach(obj => {
    const acts = allActsData.filter(x => x.o.id === obj.id);
    const pct  = avgPct(acts.map(x => x.a.pct));
    const label = (['Conocimiento','Reducción','Respuesta','Gobernanza'][S.indexOf(obj)] || obj.proceso || obj.id);
    labels.push(label);
    data.push([START, END]);
    const col = pct <= 25 ? 'rgba(180,180,180,0.85)'
              : pct <= 50 ? 'rgba(165,214,167,0.85)'
              : pct <= 75 ? 'rgba(102,187,106,0.85)'
              : 'rgba(46,125,50,0.85)';
    bgColors.push(col);
  });

  const todayPlugin = {
    id: 'todayLine',
    afterDraw(chart) {
      if (today < START || today > END) return;
      const { ctx, chartArea, scales } = chart;
      const x = scales.x.getPixelForValue(today);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.strokeStyle = '#FF5722';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#FF5722';
      ctx.font = 'bold 10px DM Sans, sans-serif';
      ctx.fillText('Hoy', x + 4, chartArea.top + 12);
      ctx.restore();
    }
  };

  _ganttChart = new Chart(canvas, {
    type: 'bar',
    plugins: [todayPlugin],
    data: {
      labels,
      datasets: [{
        label: 'Período',
        data,
        backgroundColor: bgColors,
        borderColor: bgColors.map(c => c.replace('0.85', '1')),
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: {
          label(ctx) {
            const acts = allActsData.filter(x => x.o.id === S[ctx.dataIndex]?.id);
            const pct = avgPct(acts.map(x => x.a.pct));
            return ` Avance: ${pct}% · 2024–2027`;
          }
        }
      }},
      scales: {
        x: {
          type: 'linear',
          min: START,
          max: END,
          ticks: {
            color: 'rgba(255,255,255,0.6)',
            font: { size: 10 },
            callback: v => new Date(v).getFullYear()
          },
          grid: { color: 'rgba(255,255,255,0.07)' }
        },
        y: {
          ticks: { color: 'rgba(255,255,255,0.8)', font: { size: 11 } },
          grid: { display: false }
        }
      }
    }
  });
  canvas.parentElement.style.height = '280px';
}

// ============================================
//  GRÁFICA C — SUNBURST (D3.js)
// ============================================
function renderSunburst(allActsData) {
  const container = document.getElementById('chart-sunburst');
  if (!container || typeof d3 === 'undefined') return;
  container.innerHTML = '';

  const W = container.clientWidth || 380;
  const H = Math.max(300, Math.min(W, 500));
  const radius = Math.min(W, H) / 2 - 4;

  // Construir jerarquía
  const data = {
    name: 'Plan Metropolitano',
    type: 'root',
    children: S.map((obj, i) => {
      const progs = obj.estrategias.flatMap(e => e.programas);
      const objActs = allActsData.filter(x => x.o.id === obj.id);
      const objAvg = avgPct(objActs.map(x => x.a.pct));
      return {
        name: ['Conocimiento','Reducción','Respuesta','Gobernanza'][i] || obj.proceso,
        type: 'obj', objId: obj.id, avg: objAvg,
        children: progs.map(prog => {
          const progActs = allActsData.filter(x => x.p.id === prog.id);
          const progAvg = avgPct(progActs.map(x => x.a.pct));
          const shortN = prog.title.replace(/PROG \d+[\.\d-]*\. /, '').substring(0, 28);
          return {
            name: shortN, type: 'prog', avg: progAvg, count: prog.proyectos.length,
            value: prog.proyectos.length || 1
          };
        })
      };
    })
  };

  const root = d3.hierarchy(data).sum(d => d.value || 0).sort((a, b) => b.value - a.value);
  d3.partition().size([2 * Math.PI, root.height + 1])(root);
  root.each(d => d.current = d);

  const arc = d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
    .padRadius(radius * 1.5)
    .innerRadius(d => d.y0 * radius)
    .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

  // Colores
  const OBJ_SB = ['#339B33','#2E7D32','#e6a817','#1B5E20'];
  function sbColor(d) {
    if (d.depth === 0) return '#1B5E20';
    if (d.depth === 1) { const i = d.parent.children.indexOf(d); return OBJ_SB[i % 4]; }
    if (d.depth === 2) { const i = d.parent.parent.children.indexOf(d.parent); return OBJ_SB[i % 4] + 'CC'; }
    return '#A5D6A7';
  }

  // Back button div
  const backDiv = document.createElement('div');
  backDiv.style.cssText = 'min-height:24px;margin-bottom:4px;text-align:center';
  const backBtn = document.createElement('button');
  backBtn.className = 'sunburst-back-btn';
  backBtn.innerHTML = '← Volver';
  backBtn.style.display = 'none';
  backDiv.appendChild(backBtn);
  container.appendChild(backDiv);

  const svg = d3.select(container).append('svg')
    .attr('viewBox', `${-W/2} ${-H/2} ${W} ${H}`)
    .attr('width', W).attr('height', H)
    .style('display', 'block').style('margin', '0 auto');

  const g = svg.append('g');

  const path = g.append('g').selectAll('path')
    .data(root.descendants().slice(1))
    .join('path')
    .attr('fill', d => sbColor(d))
    .attr('fill-opacity', d => arcVis(d.current) ? (d.children ? 0.85 : 0.5) : 0)
    .attr('pointer-events', d => arcVis(d.current) ? 'auto' : 'none')
    .attr('d', d => arc(d.current))
    .attr('stroke', '#0e1115').attr('stroke-width', 0.5);

  path.filter(d => d.children)
    .style('cursor', 'pointer')
    .on('click', clicked);

  path.append('title').text(d => {
    const parts = d.ancestors().map(x => x.data.name).reverse().join(' › ');
    const info = d.data.avg !== undefined ? `\n${d.data.avg}% avance` : '';
    const cnt  = d.data.count !== undefined ? `\n${d.data.count} proyecto(s)` : '';
    return parts + info + cnt;
  });

  const label = g.append('g').attr('pointer-events','none')
    .attr('text-anchor','middle').style('user-select','none')
    .selectAll('text').data(root.descendants().slice(1)).join('text')
    .attr('dy', '0.35em')
    .attr('fill-opacity', d => +lblVis(d.current))
    .attr('transform', d => lblTransform(d.current))
    .text(d => d.data.name.substring(0, 12))
    .attr('fill', 'white').attr('font-size', '8px')
    .attr('font-family', 'DM Sans, sans-serif');

  // Círculo central — click vuelve a raíz
  const centerCircle = svg.append('circle')
    .datum(root)
    .attr('r', radius * 0.3)
    .attr('fill', '#1B5E20')
    .attr('opacity', 0.9)
    .attr('cursor', 'pointer')
    .on('click', clicked);

  svg.append('text').attr('text-anchor','middle').attr('dy','0.35em')
    .attr('fill','white').attr('font-size','9px').attr('font-family','DM Sans, sans-serif')
    .attr('pointer-events','none').text('Plan');

  let focusStack = [];
  let _inBack = false;

  function clicked(event, p) {
    if (!p || !p.children) return;
    if (!_inBack) focusStack.push(p);
    backBtn.style.display = focusStack.length > 0 ? '' : 'none';
    p.parent && centerCircle.datum(p.parent);

    root.each(d => d.target = {
      x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      y0: Math.max(0, d.y0 - p.depth),
      y1: Math.max(0, d.y1 - p.depth)
    });

    const t = svg.transition().duration(500);
    path.transition(t)
      .tween('data', d => { const i = d3.interpolate(d.current, d.target); return t2 => d.current = i(t2); })
      .attr('fill-opacity', d => arcVis(d.target) ? (d.children ? 0.85 : 0.5) : 0)
      .attr('pointer-events', d => arcVis(d.target) ? 'auto' : 'none')
      .attrTween('d', d => () => arc(d.current));
    label.transition(t)
      .attr('fill-opacity', d => +lblVis(d.target))
      .attrTween('transform', d => () => lblTransform(d.current));
  }

  backBtn.onclick = () => {
    focusStack.pop();
    const prev = focusStack.length > 0 ? focusStack[focusStack.length - 1] : root;
    if (focusStack.length === 0) backBtn.style.display = 'none';
    _inBack = true;
    clicked(null, prev);
    _inBack = false;
  };

  function arcVis(d) { return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0; }
  function lblVis(d) { return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03; }
  function lblTransform(d) {
    const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
    const y = (d.y0 + d.y1) / 2 * radius;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  }
}