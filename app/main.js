// ===== main: header, mode switching, theme, buttons =====
const levelsNav = document.getElementById('levels');
function renderLevels() {
  const prog = progress();
  levelsNav.innerHTML = LEVELS.map(l => {
    const open = unlocked(l.n), done = !!prog.passed[l.n], cur = state.mode === 'learn' && L.n === l.n;
    return `<button class="lv${cur ? ' cur' : ''}${done ? ' done' : ''}" data-lv="${l.n}" ${open ? '' : 'disabled'} aria-current="${cur}" title="${esc(l.en)}">
      <span class="lvn">${open ? (done ? '✓' : toFa(l.n)) : '🔒'}</span><span class="lvt">${l.fa}</span></button>`;
  }).join('') + `<button class="lv" disabled title="Routing — coming in Phase 4"><span class="lvn">🔒</span><span class="lvt">مسیریابی</span></button>` +
    `<button class="lv${state.mode === 'explore' ? ' cur' : ''}" data-explore aria-current="${state.mode === 'explore'}"><span class="lvn">🧭</span><span class="lvt">کاوش آزاد</span></button>`;
  const cur = levelsNav.querySelector('.cur'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
}
function setMode(mode) {
  state.mode = mode;
  document.body.dataset.mode = mode;
  const rb = document.getElementById('realbtn');
  // the real-shape view is for Level 2 and up, and for free exploring (as in the brief)
  rb.hidden = !(mode === 'explore' || (mode === 'learn' && L.n >= 2));
  renderLevels();
}
function goExplore(sel) {
  setReal(false);
  setMode('explore');
  enterExplore(sel);
  renderLevels();
}
function goLevel(n) {
  startLevel(n);
  setMode('learn');
}

levelsNav.addEventListener('click', e => {
  const lv = e.target.closest('[data-lv]'); if (lv) return goLevel(+lv.dataset.lv);
  if (e.target.closest('[data-explore]')) goExplore();
});
document.addEventListener('levelchange', renderLevels);
document.addEventListener('quit', () => goExplore());

// the map and the panel send their clicks to whichever mode is active
svg.addEventListener('click', e => (state.mode === 'explore' ? exploreClick(e) : lessonClick(e)));
panel.addEventListener('click', e => (state.mode === 'explore' ? explorePanelClick(e) : panelClickLearn(e)));
panel.addEventListener('keydown', e => {
  const go = e.target.closest && e.target.closest('tr[data-go]');
  if (go && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go.click(); }
});
svg.querySelectorAll('.hw-label,.landmark,.hit-node').forEach(el => {
  const type = el.dataset.highway ? 'highway' : el.dataset.landmark ? 'landmark' : 'node';
  const id = el.dataset.highway || el.dataset.landmark || el.dataset.node, row = TABLE[type].get(id);
  el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button'); el.setAttribute('aria-label', `${row.name_fa || row.name_en || id} (${row.name_en || id})`);
  el.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (state.mode === 'explore') exploreSelect(type, id); else el.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.mode === 'explore' && E.sel) exploreSelect(null, null); });

// ---------- map buttons ----------
document.getElementById('zin').addEventListener('click', () => zoomBy(1.4));
document.getElementById('zout').addEventListener('click', () => zoomBy(1 / 1.4));
document.getElementById('zall').addEventListener('click', focusAll);
document.getElementById('realbtn').addEventListener('click', () => {
  setReal(!state.real);
  if (state.mode === 'explore') { E.sel = null; applyExploreView(); }
  if (!state.real && state.mode === 'learn' && L.phase === 'quiz' && L.q && !L.answered) L.q.setup();
});
document.getElementById('devbtn').addEventListener('click', e => {
  state.dev = !state.dev; store.set('dev', state.dev);
  e.currentTarget.setAttribute('aria-pressed', String(state.dev)); syncDev();
});
document.getElementById('openall').addEventListener('click', () => { store.set('openAll', true); renderLevels(); document.getElementById('openall').hidden = true; });

// ---------- theme ----------
const root = document.documentElement;
{ const t = store.get('theme', null); if (t) root.dataset.theme = t; }
document.getElementById('theme').addEventListener('click', () => {
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark'; store.set('theme', root.dataset.theme);
});

// ---------- start ----------
state.dev = store.get('dev', false);
document.getElementById('devbtn').setAttribute('aria-pressed', String(state.dev));
document.body.classList.toggle('dev-on', state.dev);
document.getElementById('openall').hidden = LEVELS.every(l => unlocked(l.n));
{
  const m = /^#(highway|node|segment|landmark)=(.+)$/.exec(location.hash);
  if (m) goExplore({ type: m[1], id: decodeURIComponent(m[2]) });
  else { const prog = progress(); goLevel(Math.max(0, LEVELS.findIndex(l => !prog.passed[l.n]) === -1 ? 0 : LEVELS.findIndex(l => !prog.passed[l.n]))); }
}
window.addEventListener('hashchange', () => {
  const m = /^#(highway|node|segment|landmark)=(.+)$/.exec(location.hash);
  if (m && !(state.mode === 'explore' && E.sel && E.sel.type === m[1] && E.sel.id === decodeURIComponent(m[2]))) goExplore({ type: m[1], id: decodeURIComponent(m[2]) });
});
// small hook so the browser test can play the quiz without guessing
window.__tehran = { L, GEN, LEVELS, state, buildQuiz, hwUpTo, answerRight: () => { const q = L.q; if (!q) return false; if (q.choices) answerChoice(q.correct); else if (q.tap === 'node') lessonClick({ target: svg.querySelector(`.hit-node[data-node="${D.nodes.find(n => n.type === 'interchange' && q.ok(n.id)).id}"]`) }); else if (q.tap === 'highway') lessonClick({ target: svg.querySelector(`.hw-label[data-highway="${D.highways.find(h => q.ok(h.id)).id}"]`) }); return true; } };
