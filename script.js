/* 課題関連図（流れ図）作成ツール
 * index.html / style.css / script.js の3ファイルで動作（外部ライブラリ不要・オフライン可）
 */
'use strict';

/* =========================================================
 * 定数
 * ======================================================= */
const STORAGE_KEY = 'kadai-kanrenzu-v1';

const CATEGORIES = [
  { id: 'health',    name: '健康',             hint: '体調・服薬・睡眠・発作など' },
  { id: 'body',      name: '身体の保持',       hint: '姿勢・運動・動作・移動など' },
  { id: 'meal',      name: '食事',             hint: '摂食・嚥下・食形態・偏食など' },
  { id: 'adl',       name: '日常生活動作',     hint: '排泄・着脱・整容・身辺処理など' },
  { id: 'cognition', name: '認知発達',         hint: '見る・聞く・数・文字・概念など' },
  { id: 'comm',      name: 'コミュニケーション', hint: '表出・理解・AAC・やりとりなど' },
  { id: 'interest',  name: '興味関心',         hint: '好きなこと・得意なこと・意欲など' },
  { id: 'mind',      name: '心理状態',         hint: '情緒・こだわり・変化への対応など' },
];

/* 特別支援学校学習指導要領 自立活動の内容 6区分27項目 */
const JIRITSU = [
  { id: 'k1', name: '健康の保持', items: [
    '生活のリズムや生活習慣の形成に関すること',
    '病気の状態の理解と生活管理に関すること',
    '身体各部の状態の理解と養護に関すること',
    '障害の特性の理解と生活環境の調整に関すること',
    '健康状態の維持・改善に関すること',
  ] },
  { id: 'k2', name: '心理的な安定', items: [
    '情緒の安定に関すること',
    '状況の理解と変化への対応に関すること',
    '障害による学習上又は生活上の困難を改善・克服する意欲に関すること',
  ] },
  { id: 'k3', name: '人間関係の形成', items: [
    '他者とのかかわりの基礎に関すること',
    '他者の意図や感情の理解に関すること',
    '自己の理解と行動の調整に関すること',
    '集団への参加の基礎に関すること',
  ] },
  { id: 'k4', name: '環境の把握', items: [
    '保有する感覚の活用に関すること',
    '感覚や認知の特性についての理解と対応に関すること',
    '感覚の補助及び代行手段の活用に関すること',
    '感覚を総合的に活用した周囲の状況についての把握と状況に応じた行動に関すること',
    '認知や行動の手掛かりとなる概念の形成に関すること',
  ] },
  { id: 'k5', name: '身体の動き', items: [
    '姿勢と運動・動作の基本的技能に関すること',
    '姿勢保持と運動・動作の補助的手段の活用に関すること',
    '日常生活に必要な基本動作に関すること',
    '身体の移動能力に関すること',
    '作業に必要な動作と円滑な遂行に関すること',
  ] },
  { id: 'k6', name: 'コミュニケーション', items: [
    'コミュニケーションの基礎的能力に関すること',
    '言語の受容と表出に関すること',
    '言語の形成と活用に関すること',
    'コミュニケーション手段の選択と活用に関すること',
    '状況に応じたコミュニケーションに関すること',
  ] },
];

const ALL_ITEMS = {};
JIRITSU.forEach((g, gi) => g.items.forEach((t, i) => {
  ALL_ITEMS[`${g.id}-${i + 1}`] = { gi, group: g, no: i + 1, text: t };
}));

const DEFAULT_SUBJECTS = [
  '国語', '算数・数学', '音楽', '図画工作・美術', '体育・保健体育', '生活', '職業・家庭', '外国語',
  '生活単元学習', '作業学習', '日常生活の指導', '遊びの指導', '自立活動の時間',
  '総合的な学習（探究）の時間', '特別活動',
];

const ISSUE_COLORS = ['#e8590c', '#1971c2', '#2f9e44', '#9c36b5', '#c2255c', '#0c8599', '#b08800', '#5f3dc4', '#5c940d', '#495057'];
const NOTE_COLORS = { yellow: '#fff3a8', pink: '#ffd6e0', blue: '#d0ebff', green: '#d3f9d8', orange: '#ffe0c2', purple: '#e5dbff' };
const LINK_GRAY = '#7a8594';

/* =========================================================
 * 状態
 * ======================================================= */
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function emptyState() {
  return {
    version: 1,
    student: { name: '', grade: '', date: today(), author: '', disability: '', wishSelf: '', wishParent: '', memo: '' },
    notes: [],      // {id, cat, text, color}
    issues: [],     // {id, text, color, sources[], items[], subjects[], goal}
    issueLinks: [], // [[issueIdA, issueIdB]]
    goal: { text: '', reason: '' },
    subjects: DEFAULT_SUBJECTS.map((n, i) => ({ id: 's' + (i + 1), name: n })),
    collapsed: {},
    colorSeq: 0,
  };
}

function normalize(o) {
  const s = emptyState();
  if (!o || typeof o !== 'object') return s;
  Object.assign(s.student, o.student || {});
  Object.assign(s.goal, o.goal || {});
  if (Array.isArray(o.notes)) s.notes = o.notes.filter(n => n && n.id).map(n => ({ id: n.id, cat: n.cat, text: String(n.text || ''), color: NOTE_COLORS[n.color] ? n.color : 'yellow' }));
  if (Array.isArray(o.subjects)) s.subjects = o.subjects.filter(x => x && x.id).map(x => ({ id: x.id, name: String(x.name || '') }));
  const noteIds = new Set(s.notes.map(n => n.id));
  const subjIds = new Set(s.subjects.map(x => x.id));
  if (Array.isArray(o.issues)) s.issues = o.issues.filter(x => x && x.id).map((x, i) => ({
    id: x.id, text: String(x.text || ''),
    color: Number.isInteger(x.color) ? x.color : i,
    sources: (x.sources || []).filter(id => noteIds.has(id)),
    items: (x.items || []).filter(id => ALL_ITEMS[id]),
    subjects: (x.subjects || []).filter(id => subjIds.has(id)),
    goal: !!x.goal,
  }));
  const issueIds = new Set(s.issues.map(x => x.id));
  if (Array.isArray(o.issueLinks)) s.issueLinks = o.issueLinks.filter(p => Array.isArray(p) && issueIds.has(p[0]) && issueIds.has(p[1]) && p[0] !== p[1]);
  s.collapsed = (o.collapsed && typeof o.collapsed === 'object') ? o.collapsed : {};
  s.colorSeq = Number.isInteger(o.colorSeq) ? o.colorSeq : s.issues.length;
  return s;
}

/* =========================================================
 * アプリ本体（ブラウザのみ）
 * ======================================================= */
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initApp);
}

function initApp() {
  const $ = s => document.querySelector(s);
  const board = $('#board');
  const svg = $('#lines');

  let state = loadState() || emptyState();
  let selected = null; // 選択中の課題ID

  /* ---------- 保存 ---------- */
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalize(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        const d = new Date();
        $('#saveStatus').textContent = `自動保存 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      } catch (e) {
        $('#saveStatus').textContent = '自動保存できません（データ保存を使用してください）';
      }
    }, 300);
  }

  /* ---------- ユーティリティ ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const colorOf = is => ISSUE_COLORS[(is.color || 0) % ISSUE_COLORS.length];
  const issueById = id => state.issues.find(x => x.id === id);
  const issueNo = id => state.issues.findIndex(x => x.id === id) + 1;
  const selIssue = () => (selected ? issueById(selected) : null);
  const linkIdx = (a, b) => state.issueLinks.findIndex(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));
  function toggle(arr, v) { const i = arr.indexOf(v); if (i >= 0) { arr.splice(i, 1); return false; } arr.push(v); return true; }

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  /* ---------- 描画 ---------- */
  function renderAll() {
    document.body.classList.toggle('selecting', !!selected);
    renderCats();
    renderIssues();
    renderGoal();
    renderItems();
    renderSubjects();
    renderHint();
    requestAnimationFrame(drawLines);
  }

  function renderStudentFields() {
    document.querySelectorAll('[data-field]').forEach(el => { el.value = state.student[el.dataset.field] || ''; });
    document.querySelectorAll('[data-goal]').forEach(el => { el.value = state.goal[el.dataset.goal] || ''; });
  }

  function renderCats() {
    const sel = selIssue();
    $('#catList').innerHTML = CATEGORIES.map(c => {
      const notes = state.notes.filter(n => n.cat === c.id);
      return `<div class="cat">
        <div class="cat-head">
          <span class="cat-title">${c.name}</span>
          <span class="cat-hint">${c.hint}</span>
          <button type="button" class="mini" data-act="addNote" data-id="${c.id}">＋付箋</button>
        </div>
        <div class="notes">${notes.length ? notes.map(n => noteHtml(n, sel)).join('') : '<div class="empty">「＋付箋」で実態を貼りましょう</div>'}</div>
      </div>`;
    }).join('');
  }

  function noteHtml(n, sel) {
    const related = state.issues.filter(is => is.sources.includes(n.id));
    const linked = sel && sel.sources.includes(n.id);
    const style = linked ? ` style="--hl:${colorOf(sel)}"` : '';
    return `<div class="note c-${n.color}${related.length ? ' is-kadai' : ''}${linked ? ' linked' : ''}" data-node="note:${n.id}"${style}>
      <div class="note-text">${esc(n.text)}</div>
      <div class="note-foot">
        ${related.map(is => `<span class="tag" style="background:${colorOf(is)}">課題${issueNo(is.id)}</span>`).join('')}
        <span class="sp"></span>
        <button type="button" class="ic star" data-act="extract" data-id="${n.id}" title="課題として取り出す">★</button>
        <button type="button" class="ic" data-act="editNote" data-id="${n.id}" title="編集">✎</button>
      </div>
    </div>`;
  }

  function renderIssues() {
    const sel = selIssue();
    const html = state.issues.map((is, i) => {
      const isSel = selected === is.id;
      const rel = sel && !isSel && linkIdx(sel.id, is.id) >= 0;
      const cats = [...new Set(is.sources.map(id => {
        const n = state.notes.find(x => x.id === id);
        return n ? (CATEGORIES.find(c => c.id === n.cat) || {}).name : null;
      }).filter(Boolean))];
      const relNos = state.issueLinks.filter(p => p.includes(is.id)).map(p => issueNo(p[0] === is.id ? p[1] : p[0])).sort((a, b) => a - b);
      return `<div class="issue${isSel ? ' selected' : ''}${rel ? ' linked' : ''}${sel && !isSel && !rel ? ' dim' : ''}" data-node="issue:${is.id}" style="--ic:${colorOf(is)}">
        <div class="issue-head">
          <span class="num">課題${i + 1}</span>
          ${is.goal ? '<span class="goal-badge">◎最重点目標</span>' : ''}
          <span class="sp"></span>
          <button type="button" class="ic" data-act="up" data-id="${is.id}" title="上へ">↑</button>
          <button type="button" class="ic" data-act="down" data-id="${is.id}" title="下へ">↓</button>
          <button type="button" class="ic" data-act="editIssue" data-id="${is.id}" title="編集">✎</button>
        </div>
        <div class="issue-text">${is.text ? esc(is.text) : '<span style="color:#aaa">（内容未入力）</span>'}</div>
        <div class="issue-meta">実態：${cats.length ? cats.join('・') : '—'}　／　自立活動 ${is.items.length}項目・教科等 ${is.subjects.length}${relNos.length ? `　／　関連：課題${relNos.join('・')}` : ''}</div>
        ${sel && !isSel ? `<button type="button" class="link-btn" data-act="issueLink" data-id="${is.id}">${rel ? '✂ この課題との関連を外す' : '🔗 選択中の課題と関連づける'}</button>` : ''}
      </div>`;
    }).join('');
    $('#issueList').innerHTML = html || '<div class="empty" style="margin-bottom:10px">実態の付箋の「★」を押すと、ここに課題として取り出されます。</div>';
  }

  function renderGoal() {
    const sel = selIssue();
    const box = $('#goalBox');
    box.classList.toggle('linked', !!(sel && sel.goal));
    $('#goalLinkArea').innerHTML = sel
      ? `<button type="button" class="mini" data-act="goalLink">${sel.goal ? '✂ 課題' + issueNo(sel.id) + 'を外す' : '🔗 課題' + issueNo(sel.id) + 'をつなぐ'}</button>`
      : '';
    const linked = state.issues.filter(is => is.goal);
    $('#goalLinked').innerHTML = linked.length
      ? 'つながっている課題：' + linked.map(is => `<span class="tag" style="background:${colorOf(is)}">課題${issueNo(is.id)}</span>`).join('')
      : '<span style="color:#999">課題を選択して「つなぐ」を押すと、最重点目標と関連づけられます。</span>';
  }

  function renderItems() {
    const sel = selIssue();
    $('#itemList').innerHTML = JIRITSU.map((g, gi) => {
      const collapsed = !!state.collapsed[g.id];
      const cnt = state.issues.reduce((a, is) => a + is.items.filter(id => id.startsWith(g.id + '-')).length, 0);
      const items = collapsed ? '' : `<div class="grp-items">${g.items.map((t, i) => {
        const id = `${g.id}-${i + 1}`;
        const dots = state.issues.filter(is => is.items.includes(id)).map(is => `<i style="background:${colorOf(is)}" title="課題${issueNo(is.id)}"></i>`).join('');
        const linked = sel && sel.items.includes(id);
        return `<div class="item${linked ? ' linked' : ''}" data-node="item:${id}"${linked ? ` style="--hl:${colorOf(sel)}"` : ''}>
          <span class="ino">(${i + 1})</span><span class="itx">${t}</span><span class="dots">${dots}</span></div>`;
      }).join('')}</div>`;
      return `<div class="grp g${gi + 1}">
        <div class="grp-head" data-node="group:${g.id}" data-act="toggleGroup" data-id="${g.id}">
          <span class="caret">${collapsed ? '▶' : '▼'}</span>${gi + 1}　${g.name}<span class="sp"></span>${cnt ? `<span class="cnt">${cnt}</span>` : ''}
        </div>${items}</div>`;
    }).join('');
  }

  function renderSubjects() {
    const sel = selIssue();
    $('#subjList').innerHTML = state.subjects.map(s => {
      const dots = state.issues.filter(is => is.subjects.includes(s.id)).map(is => `<i style="background:${colorOf(is)}" title="課題${issueNo(is.id)}"></i>`).join('');
      const linked = sel && sel.subjects.includes(s.id);
      return `<div class="subj${linked ? ' linked' : ''}" data-node="subj:${s.id}"${linked ? ` style="--hl:${colorOf(sel)}"` : ''}>
        <span class="stx">${esc(s.name)}</span><span class="dots">${dots}</span>
        <button type="button" class="ic x" data-act="delSubj" data-id="${s.id}" title="削除">×</button></div>`;
    }).join('');
  }

  function renderHint() {
    const sel = selIssue();
    const h = $('#hintbar');
    if (!sel) { h.classList.remove('show'); h.innerHTML = ''; return; }
    h.innerHTML = `<span class="chip" style="background:${colorOf(sel)}">課題${issueNo(sel.id)} を選択中</span>
      <span>実態の付箋・自立活動の項目・教科等をタップすると線でつながります（もう一度タップで外れます）。</span>
      <span class="sp"></span><button type="button" class="mini" data-act="deselect">選択解除</button>`;
    h.classList.add('show');
  }

  /* ---------- 線の描画 ---------- */
  function drawLines() {
    const br = board.getBoundingClientRect();
    svg.setAttribute('width', board.scrollWidth);
    svg.setAttribute('height', board.scrollHeight);
    const cache = {};
    const rect = key => {
      if (key in cache) return cache[key];
      const el = board.querySelector(`[data-node="${key}"]`);
      let r = null;
      if (el) {
        const b = el.getBoundingClientRect();
        if (b.width) r = { l: b.left - br.left, r: b.right - br.left, t: b.top - br.top, b: b.bottom - br.top, cy: (b.top + b.bottom) / 2 - br.top };
      }
      return (cache[key] = r);
    };
    const across = (a, b) => {
      const x1 = a.r, y1 = a.cy, x2 = b.l, y2 = b.cy, dx = Math.max(30, (x2 - x1) / 2);
      return { d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, p: [[x1, y1], [x2, y2]] };
    };
    const side = (a, b, dir) => {
      const x1 = dir > 0 ? a.r : a.l, x2 = dir > 0 ? b.r : b.l, y1 = a.cy, y2 = b.cy;
      const bow = dir * Math.min(62, 22 + Math.abs(y2 - y1) * 0.12);
      return { d: `M${x1},${y1} C${x1 + bow},${y1} ${x2 + bow},${y2} ${x2},${y2}`, p: [[x1, y1], [x2, y2]] };
    };

    const out = [];
    const add = (geo, color, active, dashed) => {
      if (!geo) return;
      const op = active ? 0.85 : 0.12;
      out.push(`<path d="${geo.d}" stroke="${color}" stroke-width="${active && selected ? 3.2 : 2.2}" opacity="${op}"${dashed ? ' stroke-dasharray="6 5"' : ''}/>`);
      geo.p.forEach(([x, y]) => out.push(`<circle cx="${x}" cy="${y}" r="3.5" fill="${color}" opacity="${op}"/>`));
    };

    state.issues.forEach(is => {
      const ir = rect('issue:' + is.id);
      if (!ir) return;
      const c = colorOf(is);
      const active = !selected || selected === is.id;
      is.sources.forEach(nid => { const nr = rect('note:' + nid); if (nr) add(across(nr, ir), c, active); });
      is.items.forEach(iid => {
        const r = rect('item:' + iid) || rect('group:' + iid.split('-')[0]);
        if (r) add(across(ir, r), c, active);
      });
      is.subjects.forEach(sid => { const r = rect('subj:' + sid); if (r) add(across(ir, r), c, active); });
      if (is.goal) { const gr = rect('goal'); if (gr) add(side(ir, gr, 1), c, active, true); }
    });
    state.issueLinks.forEach(([a, b]) => {
      const ra = rect('issue:' + a), rb = rect('issue:' + b);
      if (ra && rb) add(side(ra, rb, -1), LINK_GRAY, !selected || selected === a || selected === b, true);
    });
    svg.innerHTML = out.join('');
  }

  /* ---------- 編集ダイアログ ---------- */
  const dlg = $('#editDlg');
  let dlgOpts = null, dlgColor = null;
  function openEditor(opts) {
    dlgOpts = opts;
    dlgColor = opts.color || null;
    $('#dlgTitle').textContent = opts.title;
    $('#dlgText').value = opts.text || '';
    $('#dlgText').placeholder = opts.placeholder || '';
    $('#dlgDelete').style.display = opts.onDelete ? '' : 'none';
    const cw = $('#dlgColors');
    if (opts.color) {
      cw.style.display = '';
      cw.innerHTML = Object.entries(NOTE_COLORS).map(([k, v]) => `<button type="button" data-color="${k}" class="${k === dlgColor ? 'on' : ''}" style="background:${v}" title="${k}"></button>`).join('');
    } else { cw.style.display = 'none'; cw.innerHTML = ''; }
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    setTimeout(() => $('#dlgText').focus(), 50);
  }
  function closeEditor() { if (dlg.open) dlg.close(); dlgOpts = null; }
  $('#dlgColors').addEventListener('click', e => {
    const b = e.target.closest('[data-color]');
    if (!b) return;
    dlgColor = b.dataset.color;
    $('#dlgColors').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  });
  $('#editForm').addEventListener('submit', e => {
    e.preventDefault();
    const text = $('#dlgText').value.trim();
    if (dlgOpts && dlgOpts.onSave) dlgOpts.onSave(text, dlgColor);
    closeEditor();
  });
  $('#dlgCancel').addEventListener('click', closeEditor);
  $('#dlgDelete').addEventListener('click', () => {
    if (!dlgOpts || !dlgOpts.onDelete) return;
    if (!confirm('削除しますか？（関連づけた線も消えます）')) return;
    dlgOpts.onDelete();
    closeEditor();
  });
  $('#dlgText').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#editForm').requestSubmit();
  });

  /* ---------- 操作 ---------- */
  function commit() { save(); renderAll(); }

  function addNote(cat) {
    const c = CATEGORIES.find(x => x.id === cat);
    openEditor({
      title: `実態を追加：${c.name}`, text: '', color: 'yellow', placeholder: c.hint,
      onSave: (text, color) => {
        if (!text) return;
        state.notes.push({ id: uid('n'), cat, text, color: color || 'yellow' });
        commit();
      },
    });
  }

  function editNote(id) {
    const n = state.notes.find(x => x.id === id);
    if (!n) return;
    openEditor({
      title: `実態を編集：${(CATEGORIES.find(c => c.id === n.cat) || {}).name}`, text: n.text, color: n.color,
      onSave: (text, color) => { if (text) n.text = text; n.color = color || n.color; commit(); },
      onDelete: () => {
        state.notes = state.notes.filter(x => x.id !== id);
        state.issues.forEach(is => { is.sources = is.sources.filter(s => s !== id); });
        commit();
      },
    });
  }

  function newIssue(text, sources) {
    const is = { id: uid('i'), text, color: state.colorSeq++ % ISSUE_COLORS.length, sources: sources || [], items: [], subjects: [], goal: false };
    state.issues.push(is);
    selected = is.id;
    commit();
    return is;
  }

  function extract(noteId) {
    const n = state.notes.find(x => x.id === noteId);
    if (!n) return;
    const sel = selIssue();
    if (sel) { linkNote(noteId); return; }
    const exist = state.issues.find(is => is.sources.includes(noteId));
    if (exist) {
      selected = exist.id;
      renderAll();
      toast(`この実態は課題${issueNo(exist.id)}につながっています。`);
      return;
    }
    newIssue(n.text, [noteId]);
    toast('課題として取り出しました。課題の文言は✎で整えられます。');
  }

  function addIssueDirect() {
    openEditor({
      title: '課題を追加', text: '', placeholder: '例）姿勢を安定させ、上肢を操作しやすい状態をつくる',
      onSave: text => { if (text) { newIssue(text, []); toast('課題を追加しました。根拠となる実態の付箋をタップしてつなぎましょう。'); } },
    });
  }

  function editIssue(id) {
    const is = issueById(id);
    if (!is) return;
    openEditor({
      title: `課題${issueNo(id)}を編集`, text: is.text,
      onSave: text => { is.text = text; commit(); },
      onDelete: () => {
        state.issues = state.issues.filter(x => x.id !== id);
        state.issueLinks = state.issueLinks.filter(p => !p.includes(id));
        if (selected === id) selected = null;
        commit();
      },
    });
  }

  function moveIssue(id, d) {
    const i = state.issues.findIndex(x => x.id === id), j = i + d;
    if (i < 0 || j < 0 || j >= state.issues.length) return;
    [state.issues[i], state.issues[j]] = [state.issues[j], state.issues[i]];
    commit();
  }

  function linkNote(noteId) {
    const sel = selIssue();
    const on = toggle(sel.sources, noteId);
    toast(on ? `実態を課題${issueNo(sel.id)}につなぎました` : '線を外しました');
    commit();
  }

  function addSubject() {
    openEditor({
      title: '教科・領域・活動を追加', text: '', placeholder: '例）朝の会・帰りの会',
      onSave: text => { if (text) { state.subjects.push({ id: uid('s'), name: text }); commit(); } },
    });
  }

  function delSubject(id) {
    const s = state.subjects.find(x => x.id === id);
    if (!s || !confirm(`「${s.name}」を一覧から削除しますか？`)) return;
    state.subjects = state.subjects.filter(x => x.id !== id);
    state.issues.forEach(is => { is.subjects = is.subjects.filter(x => x !== id); });
    commit();
  }

  function deselect() { selected = null; renderAll(); }

  function handleAct(act, id) {
    const sel = selIssue();
    switch (act) {
      case 'addNote': addNote(id); break;
      case 'editNote': editNote(id); break;
      case 'extract': extract(id); break;
      case 'addIssue': addIssueDirect(); break;
      case 'editIssue': editIssue(id); break;
      case 'up': moveIssue(id, -1); break;
      case 'down': moveIssue(id, 1); break;
      case 'issueLink': {
        if (!sel) break;
        const k = linkIdx(sel.id, id);
        if (k >= 0) state.issueLinks.splice(k, 1); else state.issueLinks.push([sel.id, id]);
        toast(k >= 0 ? '課題同士の関連を外しました' : `課題${issueNo(sel.id)}と課題${issueNo(id)}を関連づけました`);
        commit();
        break;
      }
      case 'goalLink':
        if (!sel) break;
        sel.goal = !sel.goal;
        commit();
        break;
      case 'toggleGroup':
        state.collapsed[id] = !state.collapsed[id];
        commit();
        break;
      case 'addSubj': addSubject(); break;
      case 'delSubj': delSubject(id); break;
      case 'deselect': deselect(); break;
    }
  }

  document.addEventListener('click', e => {
    if (dlg.contains(e.target)) return;
    const actEl = e.target.closest('[data-act]');
    if (actEl && (board.contains(actEl) || $('#hintbar').contains(actEl))) {
      handleAct(actEl.dataset.act, actEl.dataset.id);
      return;
    }
    if (!board.contains(e.target)) return;
    if (e.target.closest('textarea, input')) return;
    const node = e.target.closest('[data-node]');
    if (!node) { if (selected) deselect(); return; }
    const key = node.dataset.node;
    const i = key.indexOf(':');
    const type = i < 0 ? key : key.slice(0, i), id = i < 0 ? '' : key.slice(i + 1);
    const sel = selIssue();

    if (type === 'issue') { selected = selected === id ? null : id; renderAll(); return; }
    if (type === 'goal') return;
    if (!sel) {
      if (type === 'note') editNote(id);
      else toast('先に②の課題をタップして選択してください');
      return;
    }
    if (type === 'note') { linkNote(id); return; }
    if (type === 'item') {
      const on = toggle(sel.items, id);
      const it = ALL_ITEMS[id];
      toast(on ? `「${it.group.name}(${it.no})」とつなぎました` : '線を外しました');
      commit();
      return;
    }
    if (type === 'subj') {
      const on = toggle(sel.subjects, id);
      toast(on ? `「${(state.subjects.find(s => s.id === id) || {}).name}」とつなぎました` : '線を外しました');
      commit();
    }
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape' && selected && !dlg.open) deselect(); });

  document.querySelectorAll('[data-field]').forEach(el => el.addEventListener('input', () => { state.student[el.dataset.field] = el.value; save(); }));
  document.querySelectorAll('[data-goal]').forEach(el => el.addEventListener('input', () => { state.goal[el.dataset.goal] = el.value; save(); }));

  /* ---------- ツールバー ---------- */
  function fileBase() {
    const name = (state.student.name || '未記入').replace(/[\\/:*?"<>|\s]/g, '');
    return `課題関連図_${name}_${(state.student.date || today()).replace(/-/g, '')}`;
  }
  function download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  $('#btnNew').addEventListener('click', () => {
    if (!confirm('現在の内容を消去して新規作成しますか？\n（残しておく場合は先に「データ保存」をしてください）')) return;
    state = emptyState(); selected = null;
    renderStudentFields(); commit();
  });
  $('#btnSample').addEventListener('click', () => {
    if ((state.notes.length || state.issues.length) && !confirm('現在の内容をサンプルに置き換えますか？')) return;
    state = sampleState(); selected = null;
    renderStudentFields(); commit();
    toast('サンプルを読み込みました');
  });
  $('#btnSaveJson').addEventListener('click', () => {
    download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), fileBase() + '.json');
  });
  $('#fileJson').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const o = JSON.parse(rd.result);
        if (!o || !Array.isArray(o.notes)) throw new Error('format');
        state = normalize(o); selected = null;
        renderStudentFields(); commit();
        toast('データを読み込みました');
      } catch (err) { alert('このファイルは読み込めませんでした。本ツールで保存したJSONファイルを選んでください。'); }
      e.target.value = '';
    };
    rd.readAsText(f);
  });
  $('#btnPrint').addEventListener('click', () => { selected = null; renderAll(); setTimeout(() => window.print(), 120); });
  window.addEventListener('beforeprint', () => { document.body.classList.add('printing'); drawLines(); });
  window.addEventListener('afterprint', () => { document.body.classList.remove('printing'); drawLines(); });

  $('#btnExcel').addEventListener('click', () => {
    try {
      const bytes = buildWorkbook(state);
      download(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileBase() + '.xlsx');
      toast('Excelファイルを出力しました');
    } catch (err) {
      console.error(err);
      alert('Excel出力でエラーが発生しました：' + err.message);
    }
  });

  /* ---------- 初期化 ---------- */
  function fitHint() { $('#hintbar').style.top = document.querySelector('.app-header').offsetHeight + 'px'; }
  window.addEventListener('resize', () => { fitHint(); drawLines(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => drawLines()).observe(board);
  document.querySelector('.student').addEventListener('toggle', () => drawLines());

  fitHint();
  renderStudentFields();
  renderAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawLines);
}

/* =========================================================
 * サンプルデータ
 * ======================================================= */
function sampleState() {
  const s = emptyState();
  Object.assign(s.student, {
    name: '山梨 花子（サンプル）', grade: '中学部2年④組', author: '',
    disability: '脳性まひ（痙直型四肢まひ）。車椅子使用。てんかん発作あり（服薬中）。',
    wishSelf: '好きな音楽を自分で選んで聴きたい。',
    wishParent: '自分の気持ちを周りの人に伝えられるようになってほしい。',
    memo: '水分補給は1時間ごと。姿勢変換は休み時間ごとに行う。',
  });
  const N = (cat, text, color) => { const n = { id: uid('n'), cat, text, color: color || 'yellow' }; s.notes.push(n); return n.id; };
  const h1 = N('health', '季節の変わり目に体調を崩しやすい');
  const h2 = N('health', '水分摂取量が少なく、便秘傾向がある');
  const b1 = N('body', '座位保持いすの上で姿勢が崩れやすく、右側に傾く', 'blue');
  const b2 = N('body', '上肢に緊張が入りやすく、手首の背屈が難しい', 'blue');
  const m1 = N('meal', '刻み食。取り込みに時間がかかり、むせることがある', 'orange');
  N('meal', 'スプーンを口元に近づけると口を開けて待てる', 'orange');
  N('adl', '着替えは全介助だが、袖に腕を通すときに協力動作がある', 'green');
  N('adl', '排泄のタイミングを表情や発声で伝えることがある', 'green');
  const c1 = N('cognition', '写真カードを2枚提示すると、視線で選ぶことができる', 'purple');
  N('cognition', '物の永続性は理解している。数は3まで対応できる', 'purple');
  N('comm', '発声と表情で快・不快を伝える', 'pink');
  const co2 = N('comm', 'スイッチでVOCAを鳴らして「はい」を伝えられる', 'pink');
  N('interest', '音楽が好きで、好きな曲が流れると笑顔になる');
  const i2 = N('interest', 'iPadの動画に強い関心を示す');
  const p1 = N('mind', '初めての場所や大きな音で緊張し、泣くことがある', 'pink');
  const p2 = N('mind', '見通しがもてると落ち着いて活動に参加できる', 'pink');
  const sid = name => (s.subjects.find(x => x.name === name) || {}).id;
  const I = (text, sources, items, subjects, goal) => {
    const is = { id: uid('i'), text, color: s.colorSeq++, sources, items, subjects: subjects.map(sid).filter(Boolean), goal: !!goal };
    s.issues.push(is); return is.id;
  };
  const k1 = I('姿勢を安定させ、上肢を操作しやすい状態をつくる', [b1, b2], ['k5-1', 'k5-2'], ['自立活動の時間', '体育・保健体育']);
  const k2 = I('スイッチやVOCAを使って自分の意思を伝える', [co2, c1, i2], ['k6-1', 'k6-4', 'k4-3'], ['国語', '日常生活の指導', '自立活動の時間'], true);
  const k3 = I('見通しをもって落ち着いて活動に参加する', [p1, p2], ['k2-1', 'k2-2', 'k3-4'], ['生活単元学習', '音楽']);
  I('生活リズムを整え、体調を維持する', [h1, h2, m1], ['k1-1', 'k1-5'], ['日常生活の指導']);
  s.issueLinks = [[k1, k2], [k2, k3]];
  s.goal = {
    text: '姿勢を安定させた状態で、スイッチやVOCAを使って自分の思いや選択を相手に伝えることができる。',
    reason: '課題1（姿勢・上肢操作）が課題2（意思の表出）の基盤となり、課題2ができることで課題3（見通し・情緒の安定）にもつながるため。',
  };
  return s;
}

/* =========================================================
 * Excel(.xlsx) 生成（外部ライブラリ不要）
 * ======================================================= */
const XS = { title: 1, section: 2, header: 3, label: 4, text: 5, input: 6, center: 7, goal: 8, labelC: 9, mark: 10, small: 11 };

function colName(c) { let s = ''; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }
function xmlEsc(s) {
  return String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function textUnits(str) { let u = 0; for (const ch of str) u += ch.charCodeAt(0) > 0x2E7F ? 2 : 1.1; return u; }

class XSheet {
  constructor(name, widths) {
    this.name = name; this.widths = widths;
    this.cells = new Map(); this.merges = []; this.minH = {}; this.fixH = {};
  }
  set(r, c, v, s) { this.cells.set(r + ',' + c, { r, c, v: v == null ? '' : String(v), s: s || 0 }); }
  box(r1, c1, r2, c2, v, s) {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) this.set(r, c, r === r1 && c === c1 ? v : '', s);
    if (r1 !== r2 || c1 !== c2) this.merges.push([r1, c1, r2, c2]);
  }
  height(r, h) { this.minH[r] = Math.max(this.minH[r] || 0, h); }
  toXml() {
    const span = {};
    this.merges.forEach(([r1, c1, r2, c2]) => { span[r1 + ',' + c1] = [r2 - r1 + 1, c2 - c1 + 1]; });
    const heights = { ...this.minH };
    this.cells.forEach(cell => {
      if (!cell.v) return;
      const sp = span[cell.r + ',' + cell.c] || [1, 1];
      let w = 0; for (let k = 0; k < sp[1]; k++) w += this.widths[cell.c - 1 + k] || 9;
      const cap = Math.max(4, w * 0.92 - 1.5);
      const lines = cell.v.split('\n').reduce((a, p) => a + Math.max(1, Math.ceil(textUnits(p) / cap)), 0);
      const sz = cell.s === XS.title ? 26 : 17;
      const need = (lines * sz + 6) / sp[0];
      heights[cell.r] = Math.max(heights[cell.r] || 0, need);
    });
    const byRow = {};
    this.cells.forEach(cell => { (byRow[cell.r] = byRow[cell.r] || []).push(cell); });
    const rows = Object.keys(byRow).map(Number).sort((a, b) => a - b).map(r => {
      const cs = byRow[r].sort((a, b) => a.c - b.c).map(cell => {
        const ref = colName(cell.c) + cell.r;
        return cell.v
          ? `<c r="${ref}" s="${cell.s}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(cell.v)}</t></is></c>`
          : `<c r="${ref}" s="${cell.s}"/>`;
      }).join('');
      const h = this.fixH[r] || (heights[r] ? Math.max(20, Math.round(heights[r])) : 0);
      return `<row r="${r}"${h ? ` ht="${h}" customHeight="1"` : ''}>${cs}</row>`;
    }).join('');
    const cols = this.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
    const merges = this.merges.length
      ? `<mergeCells count="${this.merges.length}">${this.merges.map(([r1, c1, r2, c2]) => `<mergeCell ref="${colName(c1)}${r1}:${colName(c2)}${r2}"/>`).join('')}</mergeCells>`
      : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
      + `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`
      + `<sheetViews><sheetView workbookViewId="0" zoomScale="100"/></sheetViews>`
      + `<sheetFormatPr defaultRowHeight="18.75"/>`
      + `<cols>${cols}</cols><sheetData>${rows}</sheetData>${merges}`
      + `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>`
      + `<pageSetup paperSize="9" orientation="${this.portrait ? 'portrait' : 'landscape'}" fitToWidth="1" fitToHeight="0"/>`
      + `</worksheet>`;
  }
}

function stylesXml() {
  const font = (b, sz, color) => `<font>${b ? '<b/>' : ''}<sz val="${sz}"/>${color ? `<color rgb="${color}"/>` : ''}<name val="游ゴシック"/><family val="3"/><charset val="128"/></font>`;
  const fill = rgb => `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
  const xf = (font, fill, border, align) => `<xf numFmtId="0" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment ${align}/></xf>`;
  const bd = '<left style="thin"><color rgb="FF8C8C8C"/></left><right style="thin"><color rgb="FF8C8C8C"/></right><top style="thin"><color rgb="FF8C8C8C"/></top><bottom style="thin"><color rgb="FF8C8C8C"/></bottom><diagonal/>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + `<fonts count="5">${font(false, 11)}${font(true, 11)}${font(true, 16)}${font(true, 11, 'FFFFFFFF')}${font(false, 9, 'FF595959')}</fonts>`
    + `<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>`
    + `${fill('FFDDEBF7')}${fill('FFFFF9DB')}${fill('FFF2F2F2')}${fill('FF2F5597')}${fill('FFFCE4D6')}</fills>`
    + `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>${bd}</border></borders>`
    + `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`
    + `<cellXfs count="12">`
    + `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`
    + xf(2, 0, 0, 'vertical="center"')                                  // 1 title
    + xf(3, 5, 1, 'vertical="center"')                                  // 2 section
    + xf(1, 2, 1, 'horizontal="center" vertical="center" wrapText="1"') // 3 header
    + xf(1, 4, 1, 'vertical="center" wrapText="1"')                     // 4 label
    + xf(0, 0, 1, 'vertical="top" wrapText="1"')                        // 5 text
    + xf(0, 3, 1, 'vertical="top" wrapText="1"')                        // 6 input
    + xf(0, 0, 1, 'horizontal="center" vertical="center" wrapText="1"') // 7 center
    + xf(1, 6, 1, 'vertical="center" wrapText="1"')                     // 8 goal
    + xf(1, 4, 1, 'horizontal="center" vertical="center" wrapText="1"') // 9 labelC
    + xf(1, 0, 1, 'horizontal="center" vertical="center"')              // 10 mark
    + xf(4, 0, 0, 'vertical="center" wrapText="1"')                     // 11 small
    + `</cellXfs><cellStyles count="1"><cellStyle name="標準" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

function buildSheets(st) {
  const issues = st.issues;
  const no = id => issues.findIndex(x => x.id === id) + 1;
  const catName = id => (CATEGORIES.find(c => c.id === id) || {}).name || '';
  const subjName = id => (st.subjects.find(x => x.id === id) || {}).name || '';
  const stu = st.student;
  const dateJa = stu.date ? stu.date.replace(/^(\d+)-(\d+)-(\d+)$/, (m, y, mo, d) => `${y}年${+mo}月${+d}日`) : '';
  const relNos = is => st.issueLinks.filter(p => p.includes(is.id)).map(p => no(p[0] === is.id ? p[1] : p[0])).sort((a, b) => a - b);
  const itemLabel = id => { const it = ALL_ITEMS[id]; return `【${it.gi + 1} ${it.group.name}】(${it.no})${it.text}`; };
  const sortedItems = is => [...is.items].sort((a, b) => Object.keys(ALL_ITEMS).indexOf(a) - Object.keys(ALL_ITEMS).indexOf(b));

  /* --- シート1：流れ図 --- */
  const s1 = new XSheet('流れ図', [20, 58, 14, 30]);
  s1.portrait = true;
  let r = 1;
  s1.box(r, 1, r, 4, '課題関連図（流れ図）', XS.title); s1.fixH[r] = 30; r++;
  s1.box(r, 1, r, 4, '黄色の欄は直接記入・修正できます。', XS.small); r++;
  s1.box(r, 1, r, 4, '児童生徒の情報', XS.section); r++;
  s1.set(r, 1, '氏名', XS.label); s1.set(r, 2, stu.name, XS.input); s1.set(r, 3, '学部・学年・組', XS.label); s1.set(r, 4, stu.grade, XS.input); s1.height(r, 24); r++;
  s1.set(r, 1, '作成日', XS.label); s1.set(r, 2, dateJa, XS.input); s1.set(r, 3, '作成者', XS.label); s1.set(r, 4, stu.author, XS.input); s1.height(r, 24); r++;
  [['障害の状態・診断名等', 'disability'], ['本人の願い', 'wishSelf'], ['保護者の願い', 'wishParent'], ['配慮事項・備考', 'memo']].forEach(([l, k]) => {
    s1.set(r, 1, l, XS.label); s1.box(r, 2, r, 4, stu[k], XS.input); s1.height(r, 40); r++;
  });
  r++;
  s1.box(r, 1, r, 4, '① 実態把握', XS.section); r++;
  ['観点', '実態', '課題として抽出', '関連する課題'].forEach((h, i) => s1.set(r, i + 1, h, XS.header)); r++;
  CATEGORIES.forEach(c => {
    const ns = st.notes.filter(n => n.cat === c.id);
    const start = r;
    if (!ns.length) { s1.set(r, 2, '', XS.input); s1.set(r, 3, '', XS.mark); s1.set(r, 4, '', XS.text); s1.height(r, 36); r++; }
    ns.forEach(n => {
      const ks = issues.filter(is => is.sources.includes(n.id)).map(is => '課題' + no(is.id));
      s1.set(r, 2, n.text, XS.input); s1.set(r, 3, ks.length ? '★' : '', XS.mark); s1.set(r, 4, ks.join('、'), XS.text); s1.height(r, 24); r++;
    });
    s1.box(start, 1, r - 1, 1, c.name, XS.labelC);
  });
  r++;
  s1.box(r, 1, r, 4, '② 課題（実態から抽出した課題）', XS.section); r++;
  ['No', '課題', '最重点目標', '根拠となる実態'].forEach((h, i) => s1.set(r, i + 1, h, XS.header)); r++;
  if (!issues.length) { s1.set(r, 1, '', XS.center); s1.set(r, 2, '', XS.input); s1.set(r, 3, '', XS.mark); s1.set(r, 4, '', XS.text); s1.height(r, 36); r++; }
  issues.forEach((is, i) => {
    const src = is.sources.map(id => st.notes.find(n => n.id === id)).filter(Boolean).map(n => `【${catName(n.cat)}】${n.text}`).join('\n');
    s1.set(r, 1, '課題' + (i + 1), XS.labelC); s1.set(r, 2, is.text, XS.input); s1.set(r, 3, is.goal ? '◎' : '', XS.mark); s1.set(r, 4, src, XS.text); s1.height(r, 30); r++;
  });
  r++;
  s1.box(r, 1, r, 4, '③ 最重点目標', XS.section); r++;
  s1.set(r, 1, '最重点目標', XS.label); s1.box(r, 2, r, 4, st.goal.text, XS.goal); s1.height(r, 48); r++;
  const goalIssues = issues.filter(is => is.goal).map(is => '課題' + no(is.id)).join('、');
  s1.set(r, 1, '関連する課題', XS.label); s1.box(r, 2, r, 4, goalIssues, XS.text); s1.height(r, 24); r++;
  s1.set(r, 1, '設定の理由', XS.label); s1.box(r, 2, r, 4, st.goal.reason, XS.input); s1.height(r, 48); r++;

  /* --- シート2：課題と指導内容 --- */
  const s2 = new XSheet('課題と指導内容', [8, 32, 44, 22, 11, 10, 36, 24]);
  r = 1;
  s2.box(r, 1, r, 8, '課題と指導内容の関連', XS.title); s2.fixH[r] = 30; r++;
  s2.box(r, 1, r, 8, `氏名：${stu.name || '　　　　'}　　${stu.grade || ''}　　作成日：${dateJa}　　※「具体的な指導内容・手立て」「評価」欄に記入できます。`, XS.small); r++;
  ['No', '課題', '自立活動の区分・項目', '教科・領域・活動', '関連する課題', '最重点目標', '具体的な指導内容・手立て', '評価'].forEach((h, i) => s2.set(r, i + 1, h, XS.header));
  s2.fixH[r] = 24; r++;
  const rowsN = Math.max(issues.length, 1);
  for (let i = 0; i < rowsN; i++) {
    const is = issues[i];
    if (is) {
      s2.set(r, 1, '課題' + (i + 1), XS.labelC);
      s2.set(r, 2, is.text, XS.text);
      s2.set(r, 3, sortedItems(is).map(itemLabel).join('\n'), XS.text);
      s2.set(r, 4, is.subjects.map(subjName).join('\n'), XS.text);
      s2.set(r, 5, relNos(is).map(n => '課題' + n).join('\n'), XS.center);
      s2.set(r, 6, is.goal ? '◎' : '', XS.mark);
    } else {
      [1, 2, 3, 4, 5, 6].forEach(c => s2.set(r, c, '', c === 6 ? XS.mark : XS.text));
    }
    s2.set(r, 7, '', XS.input); s2.set(r, 8, '', XS.input); s2.height(r, 60); r++;
  }
  r++;
  s2.set(r, 1, '最重点目標', XS.label); s2.box(r, 2, r, 8, st.goal.text, XS.goal); s2.height(r, 36); r++;

  /* --- シート3：関連マトリクス --- */
  const n = issues.length;
  const s3 = new XSheet('関連マトリクス', [16, 50, ...issues.map(() => 8), 7]);
  r = 1;
  const lastC = 2 + n + 1;
  s3.box(r, 1, r, lastC, '自立活動6区分27項目・教科等と課題の関連マトリクス', XS.title); s3.fixH[r] = 30; r++;
  s3.box(r, 1, r, lastC, `氏名：${stu.name || '　　　　'}　　● 関連あり`, XS.small); r++;
  s3.set(r, 1, '区分', XS.header); s3.set(r, 2, '項目', XS.header);
  issues.forEach((is, i) => s3.set(r, 3 + i, '課題' + (i + 1) + (is.goal ? '\n◎' : ''), XS.header));
  s3.set(r, lastC, '計', XS.header); s3.fixH[r] = n && issues.some(x => x.goal) ? 34 : 22; r++;
  JIRITSU.forEach((g, gi) => {
    const start = r;
    g.items.forEach((t, i) => {
      const id = `${g.id}-${i + 1}`;
      s3.set(r, 2, `(${i + 1}) ${t}`, XS.text);
      let cnt = 0;
      issues.forEach((is, k) => { const on = is.items.includes(id); if (on) cnt++; s3.set(r, 3 + k, on ? '●' : '', XS.mark); });
      s3.set(r, lastC, cnt || '', XS.mark); r++;
    });
    s3.box(start, 1, r - 1, 1, `${gi + 1}\n${g.name}`, XS.labelC);
  });
  const ss = st.subjects;
  if (ss.length) {
    const start = r;
    ss.forEach(sj => {
      s3.set(r, 2, sj.name, XS.text);
      let cnt = 0;
      issues.forEach((is, k) => { const on = is.subjects.includes(sj.id); if (on) cnt++; s3.set(r, 3 + k, on ? '●' : '', XS.mark); });
      s3.set(r, lastC, cnt || '', XS.mark); r++;
    });
    s3.box(start, 1, r - 1, 1, '教科・領域\n・活動', XS.labelC);
  }
  r++;
  issues.forEach((is, i) => { s3.set(r, 1, '課題' + (i + 1), XS.label); s3.box(r, 2, r, lastC, is.text + (is.goal ? '　◎最重点目標と関連' : ''), XS.text); r++; });

  return [s1, s2, s3];
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

function zipStore(files) {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const chunks = [], central = [];
  let offset = 0;
  files.forEach(f => {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    chunks.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  });
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let p = 0; all.forEach(b => { out.set(b, p); p += b.length; });
  return out;
}

function buildWorkbook(st) {
  const sheets = buildSheets(st);
  const files = [];
  files.push({ name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` });
  files.push({ name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` });
  files.push({ name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` });
  files.push({ name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` });
  files.push({ name: 'xl/styles.xml', data: stylesXml() });
  sheets.forEach((s, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: s.toXml() }));
  return zipStore(files);
}

/* Node.js でのテスト用（ブラウザでは無視されます） */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildWorkbook, sampleState, emptyState, normalize };
}
