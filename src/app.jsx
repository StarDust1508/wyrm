import React from 'react'
import ReactDOM from 'react-dom/client'
import DOMPurify from 'dompurify'
import * as store from './lib/store.js'
import * as diff from './lib/diff.js'
import * as consistency from './lib/consistency.js'
import * as realtime from './lib/realtime.js'
import { t } from './lib/i18n.js'

// Strict allowlist sanitizer for chapter HTML (editor + imported .docx).
// Kills <script>, event handlers, javascript: URLs, styles — anything that
// could become stored XSS once a chapter is shown to other readers.
const SAFE_TAGS = ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'h3', 'blockquote', 'ul', 'ol', 'li'];
function cleanHtml(html) {
  return DOMPurify.sanitize(html || '', { ALLOWED_TAGS: SAFE_TAGS, ALLOWED_ATTR: [] });
}

// React/ReactDOM are referenced by name throughout the modules below.
window.React = React; window.ReactDOM = ReactDOM;


/* ╔══ 01 · mock data ══╗ */
/* ============================================================
   WYRM — mock data
   Exposes window.WYRM (read by every view).
   ============================================================ */
(function () {
  // ---- tag taxonomy (mood-coded) ----
  const TAGS = {
    'dark-fantasy': { label: 'Тёмное фэнтези', hue: 28 },
    'tragedy':      { label: 'Трагедия',       hue: 300 },
    'redemption':   { label: 'Искупление',     hue: 168 },
    'romance':      { label: 'Романтика',      hue: 4 },
    'war':          { label: 'Война',          hue: 50 },
    'horror':       { label: 'Ужасы',          hue: 18 },
    'comedy':       { label: 'Комедия',        hue: 86 },
    'happy-end':    { label: 'Светлый финал',  hue: 150 },
    'slow-burn':    { label: 'Медленное пламя', hue: 330 },
    'politics':     { label: 'Политика',       hue: 240 },
  };

  // ---- characters (states vary per branch node) ----
  const CHARACTERS = {
    keira: { name: 'Кейра Веран', role: 'Наездница пепла', glyph: 'К' },
    vale:  { name: 'Вэйл',        role: 'Брат, дезертир',  glyph: 'В' },
    archon:{ name: 'Архонт Сольм', role: 'Владыка Цитадели', glyph: 'А' },
    wyrm:  { name: 'Старый Вирм',  role: 'Дракон-прародитель', glyph: '𐂃' },
  };

  // ---- THE STORY TREE for the flagship work ----
  // status: 'alive' | 'dead' | 'missing' | 'changed'
  const NODES = [
    {
      id: 'root', parent: null, title: 'Пробуждение', author: 'eira_noct',
      canon: true, score: 1.0, votes: 4821, words: 2140,
      tags: ['dark-fantasy', 'war'],
      excerpt: 'Пепел шёл третий день. Кейра стояла на разбитом парапете и смотрела, как небо над Аркадией дрожит от крыльев. Старый Вирм пробудился — и вместе с ним пробудилось всё, что люди так старательно похоронили.',
      chars: { keira: 'alive', vale: 'alive', archon: 'alive', wyrm: 'alive' },
    },
    {
      id: 'A', parent: 'root', title: 'Клятва пепла', author: 'eira_noct',
      canon: true, score: 0.94, votes: 3902, words: 1880,
      tags: ['dark-fantasy', 'redemption'],
      excerpt: 'Она преклонила колено не перед Архонтом, а перед зверем. «Я не дам тебе сжечь их», — сказала Кейра. Вирм наклонил голову размером с дом и, кажется, согласился.',
      chars: { keira: 'alive', vale: 'alive', archon: 'alive', wyrm: 'alive' },
    },
    {
      id: 'B', parent: 'root', title: 'Кровь за кровь', author: 'grimwarden',
      canon: false, score: 0.71, votes: 1644, words: 2010,
      tags: ['horror', 'tragedy'],
      excerpt: 'Но что, если Кейра не простила? В этой версии она вскочила в седло не ради спасения — ради мести. Аркадия заслужила огонь, и она дала его городу полной мерой.',
      chars: { keira: 'changed', vale: 'alive', archon: 'alive', wyrm: 'alive' },
    },
    {
      id: 'A1', parent: 'A', title: 'Северный тракт', author: 'mara.q',
      canon: true, score: 0.88, votes: 2750, words: 1640,
      tags: ['war', 'slow-burn'],
      excerpt: 'Дорога на север пахла гарью и хвоей. Вэйл шёл рядом, впервые за десять лет, и молчание между ними было тяжелее любых слов.',
      chars: { keira: 'alive', vale: 'alive', archon: 'alive', wyrm: 'alive' },
    },
    {
      id: 'A2', parent: 'A', title: 'Дезертир', author: 'sol_inkwell',
      canon: false, score: 0.52, votes: 980, words: 1490,
      tags: ['tragedy', 'politics'],
      excerpt: 'Вэйл не пошёл с ней. Он остался — и к утру его имя было прибито к воротам Цитадели вместе с приговором.',
      chars: { keira: 'alive', vale: 'missing', archon: 'alive', wyrm: 'alive' },
    },
    {
      id: 'A1a', parent: 'A1', title: 'Цитадель молчания', author: 'mara.q',
      canon: true, score: 0.83, votes: 2210, words: 1720,
      tags: ['redemption', 'politics'],
      excerpt: 'Архонт ждал их в зале без окон. «Ты привела ко мне бога на поводке, девочка. Назови цену». Кейра назвала. Цена была — он сам.',
      chars: { keira: 'alive', vale: 'alive', archon: 'changed', wyrm: 'alive' },
    },
    {
      id: 'A1b', parent: 'A1', title: 'Сделка с тенью', author: 'nyx___',
      canon: false, score: 0.61, votes: 1320, words: 1580,
      tags: ['dark-fantasy', 'romance'],
      excerpt: 'А что, если на тракте их встретил не враг, а та, кого Кейра похоронила пять зим назад? Тень предложила сделку, и у сделки были знакомые глаза.',
      chars: { keira: 'alive', vale: 'alive', archon: 'alive', wyrm: 'alive' },
    },
    {
      id: 'B1', parent: 'B', title: 'Корона из костей', author: 'grimwarden',
      canon: true, score: 0.69, votes: 1402, words: 1910,
      tags: ['horror', 'politics'],
      excerpt: 'На пепелище Аркадии Кейра выстроила трон. Вирм лёг у его подножия, как пёс. Так начиналось царство, которому суждено было гореть тысячу лет.',
      chars: { keira: 'changed', vale: 'dead', archon: 'dead', wyrm: 'alive' },
    },
    {
      id: 'B2', parent: 'B', title: 'Последний полёт', author: 'ashpoet',
      canon: false, score: 0.44, votes: 760, words: 1330,
      tags: ['tragedy', 'happy-end'],
      excerpt: 'Месть выжгла её изнутри раньше, чем город. В этой ветке Кейра разворачивает Вирма к морю — и они улетают, оставив Аркадию её собственным грехам.',
      chars: { keira: 'alive', vale: 'alive', archon: 'alive', wyrm: 'alive' },
    },
  ];

  const FLAGSHIP = {
    id: 'ashes',
    title: 'Пепел Аркадии',
    author: 'eira_noct',
    started: 'Основано 14 марта',
    synopsis: 'Когда последний дракон пробуждается под мёртвым городом, наездница Кейра должна выбрать: спасти Аркадию или сжечь её дотла. История, которую дописывает сообщество — глава за главой, развилка за развилкой.',
    contributors: 47,
    branches: NODES.length,
    chapters: NODES.length,
    canonReaders: '12.4k',
    tags: ['dark-fantasy', 'war', 'redemption'],
  };

  // ---- catalog (feed) ----
  const STORIES = [
    FLAGSHIP,
    { id:'glass', title:'Стеклянный сад', author:'lune_v', synopsis:'Девочка, выращивающая воспоминания в теплице из стекла. Каждый цветок — чужая жизнь.', contributors:23, branches:14, tags:['slow-burn','romance','tragedy'], hot:true },
    { id:'gears', title:'Шестерни Вавилона', author:'cogsmith', synopsis:'Город-машина, где боги — это инженеры, а молитвы измеряются в киловаттах.', contributors:31, branches:22, tags:['politics','war'] },
    { id:'salt', title:'Соль и пророчество', author:'tide.witch', synopsis:'Рыбацкая деревня вытаскивает из сетей не рыбу, а спящее божество.', contributors:18, branches:9, tags:['horror','dark-fantasy'] },
    { id:'comedy', title:'Гильдия неудачников', author:'jest_r', synopsis:'Худшая команда авантюристов в королевстве случайно спасает мир. Дважды.', contributors:62, branches:38, tags:['comedy','happy-end'], hot:true },
    { id:'crown', title:'Тысяча малых корон', author:'archivar', synopsis:'Империя распадается на тысячу княжеств. Каждый соавтор пишет за своего наследника.', contributors:104, branches:71, tags:['politics','war','tragedy'], hot:true },
  ];

  // ---- seed trees for the non-flagship stories (so every catalog story
  //      opens its OWN living tree, not the flagship's) ----
  const seed = (id, parent, title, author, canon, score, votes, tags, excerpt) =>
    ({ id, parent, title, author, canon, score, votes, words: excerpt.split(/\s+/).length * 6, tags, excerpt, chars: {} });
  const STORY_TREES = {
    glass: [
      seed('glass-root', null, 'Теплица', 'lune_v', true, 0.9, 1840, ['slow-burn'], 'Бабушкина теплица из стекла росла внутрь — и каждый цветок помнил чью-то жизнь.'),
      seed('glass-a', 'glass-root', 'Первый цветок', 'lune_v', true, 0.84, 1320, ['romance'], 'Девочка коснулась бутона и вспомнила чужую первую любовь — так ясно, будто свою.'),
      seed('glass-b', 'glass-root', 'Трещина в стекле', 'mara.q', false, 0.55, 610, ['tragedy'], 'Но стекло дало трещину, и одно воспоминание вытекло наружу, отравив сад.'),
      seed('glass-a1', 'glass-a', 'Чужая жизнь', 'lune_v', true, 0.78, 980, ['slow-burn', 'tragedy'], 'Чтобы спасти цветок, ей пришлось прожить чужую смерть до конца.'),
    ],
    gears: [
      seed('gears-root', null, 'Город-машина', 'cogsmith', true, 0.88, 1620, ['politics'], 'В Вавилоне молитвы измеряли в киловаттах, а боги носили комбинезоны инженеров.'),
      seed('gears-a', 'gears-root', 'Молитва в киловаттах', 'cogsmith', true, 0.8, 1210, ['politics'], 'Когда подача упала, верующие впервые усомнились: а слышит ли их вообще турбина небес?'),
      seed('gears-b', 'gears-root', 'Сбой бога', 'grimwarden', false, 0.5, 540, ['war'], 'Главный реактор-божество дал сбой — и город узнал, каково это, остаться без чуда.'),
      seed('gears-a1', 'gears-a', 'Забастовка ангелов', 'cogsmith', false, 0.62, 720, ['politics', 'war'], 'Обслуживающие ангелы сложили инструменты. Небеса встали на профилактику.'),
    ],
    salt: [
      seed('salt-root', null, 'Сети', 'tide.witch', true, 0.85, 1100, ['horror'], 'В то утро деревня вытащила из сетей не рыбу, а спящее, солёное от моря божество.'),
      seed('salt-a', 'salt-root', 'Спящее божество', 'tide.witch', true, 0.79, 870, ['dark-fantasy'], 'Старейшины решили не будить его. Но дети уже слышали, как оно дышит под полом.'),
      seed('salt-b', 'salt-root', 'Шёпот прилива', 'nyx___', false, 0.48, 410, ['horror'], 'Каждый прилив шептал новое имя. Тех, кого назвали, наутро не находили.'),
      seed('salt-a1', 'salt-a', 'Пробуждение', 'tide.witch', false, 0.6, 690, ['horror', 'dark-fantasy'], 'Когда оно открыло глаза, море отступило на милю — и больше не вернулось.'),
    ],
    comedy: [
      seed('comedy-root', null, 'Худшая команда', 'jest_r', true, 0.92, 2100, ['comedy'], 'Их выгнали из всех гильдий королевства. Поэтому они основали свою — для отверженных.'),
      seed('comedy-a', 'comedy-root', 'Случайное спасение', 'jest_r', true, 0.87, 1540, ['happy-end'], 'Пытаясь украсть обед, они случайно сорвали ритуал конца света. Никто так и не понял как.'),
      seed('comedy-b', 'comedy-root', 'Дважды герои', 'ashpoet', false, 0.54, 480, ['comedy'], 'Спасли мир второй раз — и снова не заметили. Зато потеряли осла.'),
      seed('comedy-a1', 'comedy-a', 'Орден позора', 'jest_r', false, 0.66, 900, ['comedy', 'happy-end'], 'Король наградил их орденом и попросил, пожалуйста, больше ничего не спасать.'),
    ],
    crown: [
      seed('crown-root', null, 'Распад империи', 'archivar', true, 0.86, 1980, ['politics'], 'Когда умер последний император, тысяча наследников подняли тысячу малых корон.'),
      seed('crown-a', 'crown-root', 'Первый наследник', 'archivar', true, 0.81, 1460, ['politics', 'tragedy'], 'Юный князь предложил союз — и получил в ответ голову своего посла в подарочной коробке.'),
      seed('crown-b', 'crown-root', 'Война кузенов', 'grimwarden', false, 0.57, 640, ['war'], 'Шесть кузенов, шесть армий, одна зима. К весне осталась половина.'),
      seed('crown-a1', 'crown-a', 'Корона из пепла', 'archivar', false, 0.63, 810, ['war', 'tragedy'], 'Победитель сел на трон из переплавленных корон побеждённых. Он правил три дня.'),
    ],
  };

  // Книги, созданные пользователем в прошлых сессиях, тоже попадают в каталог.
  try {
    const us = JSON.parse(localStorage.getItem('wyrm.stories'));
    if (Array.isArray(us)) { const have = new Set(STORIES.map(s => s.id)); us.forEach(s => { if (s && s.id && !have.has(s.id)) STORIES.push(s); }); }
  } catch (e) {}

  // nodesFor(storyId): seed tree + branches this reader published (per story).
  function nodesFor(storyId) {
    const base = storyId === 'ashes' ? NODES : (STORY_TREES[storyId] || []);
    let extra = [];
    try { const e = JSON.parse(localStorage.getItem('wyrm.nodes')); if (Array.isArray(e)) extra = e.filter(n => (n.story || 'ashes') === storyId); } catch (e) {}
    const have = new Set(base.map(n => n.id));
    return [...base, ...extra.filter(n => n && n.id && !have.has(n.id))];
  }

  // Fold the flagship's persisted branches back into NODES (for flagship-only
  // screens like Reader's Cut that read NODES directly).
  try {
    const extra = JSON.parse(localStorage.getItem('wyrm.nodes'));
    if (Array.isArray(extra)) {
      const have = new Set(NODES.map(n => n.id));
      extra.filter(n => (n.story || 'ashes') === 'ashes').forEach(n => { if (n && n.id && !have.has(n.id)) NODES.push(n); });
    }
  } catch (e) {}

  window.WYRM = { TAGS, CHARACTERS, NODES, FLAGSHIP, STORIES, STORY_TREES, nodesFor };
})();



/* ╔══ 02 · shared UI ══╗ */
/* ============================================================
   WYRM — shared components  (window-exported)
   ============================================================ */
const { useState, useEffect, useRef, useCallback } = React;

/* scroll reveal */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const targets = [];
    if (el.classList.contains('reveal')) targets.push(el);
    el.querySelectorAll('.reveal').forEach(n => targets.push(n));
    const showIfNear = (n) => {
      const r = n.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.92) { n.classList.add('in'); return true; }
      return false;
    };
    // reveal anything already in view right away
    targets.forEach(showIfNear);
    let io = null;
    try {
      io = new IntersectionObserver((es) => {
        es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });
      targets.forEach(n => { if (!n.classList.contains('in')) io.observe(n); });
    } catch (e) { /* IO unsupported */ }
    // also reveal on scroll, and a hard fallback so content is never stuck hidden
    const onScroll = () => targets.forEach(n => { if (!n.classList.contains('in')) showIfNear(n); });
    window.addEventListener('scroll', onScroll, { passive: true });
    const fb = setTimeout(() => targets.forEach(n => n.classList.add('in')), 700);
    return () => { if (io) io.disconnect(); window.removeEventListener('scroll', onScroll); clearTimeout(fb); };
  }, []);
  return ref;
}

/* minimal UI icons (simple shapes only) */
function Icon({ name, size = 18, stroke = 1.6 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    fork:    <g><circle cx="6" cy="5" r="2.4"/><circle cx="18" cy="5" r="2.4"/><circle cx="12" cy="19" r="2.4"/><path d="M6 7.4v3c0 2 2 3 4 3.4M18 7.4v3c0 2-2 3-4 3.4M12 14.2v2.4"/></g>,
    arrow:   <g><path d="M5 12h14M13 6l6 6-6 6"/></g>,
    arrowL:  <g><path d="M19 12H5M11 6l-6 6 6 6"/></g>,
    star:    <path d="M12 3.5l2.4 5.3 5.6.6-4.2 3.8 1.2 5.6L12 16.9 6.8 19.8 8 14.2 3.8 10.4l5.6-.6z"/>,
    flame:   <path d="M12 3c1 3-2 4-2 7a2 2 0 1 0 4 0c0 2 2 3 2 5a4 4 0 1 1-8 0c0-4 4-5 4-12z"/>,
    crown:   <path d="M4 8l3 4 5-7 5 7 3-4v9H4z"/>,
    eye:     <g><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.2"/></g>,
    users:   <g><circle cx="9" cy="8" r="3"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5M16 6a3 3 0 0 1 0 6M21 19c0-2-1.5-3.5-4-4.3"/></g>,
    branch:  <g><circle cx="6" cy="18" r="2.2"/><circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M6 8.2v7.6M8.2 6H14a4 4 0 0 1 4 4v.4"/></g>,
    plus:    <path d="M12 5v14M5 12h14"/>,
    sun:     <g><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/></g>,
    moon:    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z"/>,
    sliders: <g><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4"/><circle cx="15" cy="6" r="2"/><circle cx="7" cy="12" r="2"/><circle cx="13" cy="18" r="2"/></g>,
    check:   <path d="M5 12.5l4.5 4.5L19 6"/>,
    quill:   <path d="M3 21c2-6 6-12 14-16-2 6-4 10-8 12-2 1-4 2-6 4zM7 17l3 .5"/>,
    x:       <path d="M6 6l12 12M18 6L6 18"/>,
    blocks:  <g><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><path d="M13 5h6a2 2 0 0 1 2 2v4M11 13H5a2 2 0 0 0-2 2v4"/></g>,
    bolt:    <path d="M13 2L4 14h7l-1 8 9-12h-7z"/>,
    menu:    <path d="M4 7h16M4 12h16M4 17h16"/>,
    bell:    <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6M9.5 20a2.5 2.5 0 0 0 5 0"/>,
  };
  return <svg {...p} aria-hidden="true">{paths[name]}</svg>;
}

/* mood tag */
function Tag({ id, active, onClick, asButton }) {
  const t = (window.WYRM.TAGS[id]) || { label: id, hue: 200 };
  const cls = 'tag' + (asButton ? ' tag-btn' : '');
  const dot = <span className="dot" style={{ background: `oklch(0.7 0.16 ${t.hue})` }} />;
  if (asButton) return <button className={cls} data-active={!!active} onClick={onClick}>{dot}{t.label}</button>;
  return <span className={cls} data-active={!!active}>{dot}{t.label}</span>;
}

/* author monogram */
function Avatar({ name, size = 30 }) {
  const ch = (name || '?').replace(/[^a-zа-я0-9]/i, '').slice(0, 1).toUpperCase();
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center',
      fontFamily: 'var(--mono)', fontSize: size * 0.4, color: 'var(--ink-2)',
      border: '1px solid var(--line)', background: 'var(--bg-3)', flex: '0 0 auto'
    }}>{ch}</span>
  );
}

/* canonical score meter */
function CanonMeter({ score, gold }) {
  const pct = Math.round(score * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 4, background: 'var(--line-soft)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', borderRadius: 4,
          background: gold ? 'var(--gold)' : 'var(--accent)', transition: 'width 1s var(--ease)' }} />
      </div>
      <span className="mono" style={{ fontSize: '.66rem', color: gold ? 'var(--gold)' : 'var(--ink-2)' }}>{pct}</span>
    </div>
  );
}

/* striped image placeholder (per guidelines — never hand-draw art) */
function CoverSlot({ label, ratio = '3 / 4', hue = 200, src }) {
  return (
    <div style={{
      aspectRatio: ratio, width: '100%', borderRadius: 6, overflow: 'hidden',
      border: '1px solid var(--line-soft)', position: 'relative',
      background: src ? 'var(--bg-2)' : `repeating-linear-gradient(135deg, var(--bg-2) 0 11px, var(--bg-3) 11px 22px)`,
      display: 'grid', placeItems: 'center'
    }}>
      {src
        ? <img src={src} alt={label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <React.Fragment>
            <span style={{ position: 'absolute', inset: 0, background: `radial-gradient(80% 60% at 50% 0%, oklch(0.7 0.14 ${hue} / .14), transparent 70%)` }} />
            <span className="mono" style={{ color: 'var(--ink-3)', fontSize: '.6rem', padding: '0 1em', textAlign: 'center', zIndex: 1 }}>{label}</span>
          </React.Fragment>}
    </div>
  );
}

/* status pill for character states */
const CHAR_STATUS = {
  alive:   { label: 'Жив',    hue: 150 },
  dead:    { label: 'Мёртв',  hue: 25 },
  missing: { label: 'Пропал', hue: 50 },
  changed: { label: 'Изменён', hue: 300 },
};
function StatusPill({ status }) {
  const s = CHAR_STATUS[status] || CHAR_STATUS.alive;
  return (
    <span className="mono" style={{
      fontSize: '.56rem', padding: '.2em .5em', borderRadius: 2,
      color: `oklch(0.78 0.12 ${s.hue})`,
      border: `1px solid oklch(0.7 0.12 ${s.hue} / .4)`,
      background: `oklch(0.7 0.12 ${s.hue} / .08)`
    }}>{s.label}</span>
  );
}

Object.assign(window, { useReveal, Icon, Tag, Avatar, CanonMeter, CoverSlot, StatusPill, CHAR_STATUS });



/* ╔══ 03 · StoryTree ══╗ */
/* ============================================================
   WYRM — The Story Tree (interactive branching map)
   ============================================================ */
const { useState: useStateT, useMemo, useRef: useRefT, useEffect: useEffectT } = React;

/* tidy layout: leaves placed in order, parents centered over children */
function layoutTree(nodes, orientation) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const kids = {}; nodes.forEach(n => { (kids[n.parent] = kids[n.parent] || []).push(n.id); });
  const root = nodes.find(n => n.parent === null);
  const depth = {}; const order = []; let leafX = 0;
  const xGap = 248, yGap = 184;
  const pos = {};
  (function dfs(id, d) {
    depth[id] = d;
    const ch = kids[id] || [];
    if (!ch.length) { pos[id] = { x: leafX++ * xGap, d }; return; }
    ch.forEach(c => dfs(c, d + 1));
    const xs = ch.map(c => pos[c].x);
    pos[id] = { x: (Math.min(...xs) + Math.max(...xs)) / 2, d };
  })(root.id, 0);

  const ids = Object.keys(pos);
  let coords = {};
  if (orientation === 'radial') {
    const maxX = Math.max(...ids.map(i => pos[i].x)) || 1;
    const maxD = Math.max(...ids.map(i => pos[i].d)) || 1;
    const cx = 0, cy = 0, rGap = 168;
    ids.forEach(i => {
      if (i === root.id) { coords[i] = { x: cx, y: cy, d: pos[i].d }; return; }
      const a = (pos[i].x / (maxX + xGap)) * Math.PI * 1.55 - Math.PI * 0.775 - Math.PI / 2;
      const r = pos[i].d * rGap;
      coords[i] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r + maxD * 30, d: pos[i].d };
    });
  } else {
    ids.forEach(i => { coords[i] = { x: pos[i].x, y: pos[i].d * yGap, d: pos[i].d }; });
  }
  // normalize to >=0 with padding
  const padX = 150, padY = 60;
  const minX = Math.min(...ids.map(i => coords[i].x));
  const minY = Math.min(...ids.map(i => coords[i].y));
  ids.forEach(i => { coords[i].x += -minX + padX; coords[i].y += -minY + padY; });
  const W = Math.max(...ids.map(i => coords[i].x)) + padX;
  const H = Math.max(...ids.map(i => coords[i].y)) + padY + 90;
  const edges = nodes.filter(n => n.parent).map(n => ({ from: n.parent, to: n.id,
    canon: byId[n.id].canon && byId[n.parent].canon }));
  return { coords, edges, W, H, byId, root: root.id, kids };
}

function ancestorsOf(id, byId) {
  const set = new Set(); let cur = id;
  while (cur) { set.add(cur); cur = byId[cur] ? byId[cur].parent : null; }
  return set;
}

function StoryTree({ orientation = 'vertical', selected, onSelect, onFork, activeTag, nodes: nodesProp }) {
  const nodes = nodesProp || window.WYRM.NODES;
  const L = useMemo(() => layoutTree(nodes, orientation), [orientation, nodes.length, nodes]);
  const [hover, setHover] = useStateT(null);
  const scrollRef = useRefT(null);
  const NODE_W = 196;

  // center the root horizontally on mount / orientation change
  useEffectT(() => {
    const el = scrollRef.current; if (!el) return;
    const rx = L.coords[L.root].x;
    el.scrollLeft = rx - el.clientWidth / 2 + NODE_W / 2;
  }, [orientation]);

  // drag to pan
  useEffectT(() => {
    const el = scrollRef.current; if (!el) return;
    let down = false, sx = 0, sy = 0, l = 0, t = 0, moved = false;
    const md = e => { if (e.target.closest('.tnode')) return; down = true; moved = false;
      sx = e.clientX; sy = e.clientY; l = el.scrollLeft; t = el.scrollTop; el.style.cursor = 'grabbing'; };
    const mm = e => { if (!down) return; const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      el.scrollLeft = l - dx; el.scrollTop = t - dy; };
    const mu = () => { down = false; el.style.cursor = 'grab'; };
    el.addEventListener('pointerdown', md); window.addEventListener('pointermove', mm); window.addEventListener('pointerup', mu);
    return () => { el.removeEventListener('pointerdown', md); window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', mu); };
  }, []);

  const hoverPath = hover ? ancestorsOf(hover, L.byId) : null;
  const selPath = selected ? ancestorsOf(selected, L.byId) : null;

  const edgePath = (e) => {
    const a = L.coords[e.from], b = L.coords[e.to];
    const ax = a.x + NODE_W / 2, bx = b.x + NODE_W / 2;
    const ay = a.y + 96, by = b.y + 8;
    const my = (ay + by) / 2;
    return `M ${ax} ${ay} C ${ax} ${my}, ${bx} ${my}, ${bx} ${by}`;
  };

  return (
    <div ref={scrollRef} className="tree-scroll" style={{
      position: 'relative', overflow: 'auto', cursor: 'grab',
      height: 'clamp(440px, 62vh, 720px)', borderRadius: 6,
      border: '1px solid var(--line-soft)', background:
        'radial-gradient(60% 50% at 50% 0%, var(--bg-2), var(--bg))',
    }}>
      {/* subtle grid */}
      <div style={{ position: 'absolute', inset: 0, width: L.W, height: L.H, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(var(--line-soft) 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: .5 }} />
      <div style={{ position: 'relative', width: L.W, height: L.H }}>
        <svg width={L.W} height={L.H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {L.edges.map((e, i) => {
            const onHover = hoverPath && hoverPath.has(e.from) && hoverPath.has(e.to);
            const onSel = selPath && selPath.has(e.from) && selPath.has(e.to);
            return (
              <path key={i} d={edgePath(e)} fill="none"
                stroke={e.canon ? 'var(--gold)' : (onHover || onSel ? 'var(--accent)' : 'var(--line)')}
                strokeWidth={e.canon ? 2.4 : (onHover || onSel ? 2 : 1.4)}
                strokeDasharray={e.canon ? 'none' : '1 0'}
                opacity={e.canon ? 0.95 : (onHover || onSel ? 0.9 : 0.5)}
                style={{ transition: 'stroke .25s, opacity .25s' }} />
            );
          })}
        </svg>

        {nodes.map(n => {
          const c = L.coords[n.id];
          const dim = activeTag && !n.tags.includes(activeTag);
          const isSel = selected === n.id;
          const onPath = hoverPath && hoverPath.has(n.id);
          return (
            <button key={n.id} className="tnode"
              onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
              onClick={() => onSelect && onSelect(n.id)}
              style={{
                position: 'absolute', left: c.x, top: c.y, width: NODE_W, textAlign: 'left',
                padding: '11px 12px 12px', borderRadius: 5, cursor: 'pointer',
                background: 'var(--panel)', backdropFilter: 'blur(6px)',
                border: '1px solid ' + (n.canon ? 'var(--gold)' : isSel ? 'var(--accent)' : 'var(--line)'),
                boxShadow: n.canon ? 'var(--canon-glow)' : (isSel || onPath ? '0 0 0 1px var(--accent)' : 'var(--node-glow)'),
                opacity: dim ? 0.26 : 1,
                transform: isSel ? 'translateY(-2px) scale(1.015)' : 'none',
                transition: 'transform .3s var(--ease), box-shadow .3s, opacity .35s, border-color .25s',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)' }}>гл · {n.id.toUpperCase()}</span>
                {n.canon
                  ? <span style={{ color: 'var(--gold)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="star" size={12} /><span className="mono" style={{ fontSize: '.5rem' }}>КАНОН</span></span>
                  : <span style={{ color: 'var(--ink-3)' }}><Icon name="branch" size={12} /></span>}
              </div>
              <div className="display" style={{ fontSize: '1.02rem', fontWeight: 600, marginBottom: 7, lineHeight: 1.05 }}>{n.title}</div>
              <CanonMeter score={n.score} gold={n.canon} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Avatar name={n.author} size={20} />
                  <span className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)' }}>{n.votes.toLocaleString('ru')}</span>
                </span>
                <span onClick={(ev) => { ev.stopPropagation(); onFork && onFork(n.id); }}
                  className="mono fork-mini" title="Развилка: а что, если…"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '.52rem',
                    color: 'var(--ink-2)', padding: '3px 6px', borderRadius: 2, border: '1px solid var(--line-soft)' }}>
                  <Icon name="fork" size={11} />Ветвь
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { StoryTree, layoutTree, ancestorsOf });



/* ╔══ 04 · Landing + Catalog ══╗ */
/* ============================================================
   WYRM — Landing + Catalog views
   ============================================================ */

/* ---------------- LANDING ---------------- */
function Landing({ go }) {
  const ref = useReveal();
  const { FLAGSHIP } = window.WYRM;
  const features = [
    { n: '01', icon: 'branch', t: 'Древо Истории', d: 'Не список глав, а живая карта. Корень — завязка, ветви — альтернативные судьбы. Читать здесь — значит исследовать.' },
    { n: '02', icon: 'star',   t: 'Голосование за канон', d: 'Сообщество решает, какая ветка — главная. Самая сильная линия загорается золотом и становится каноном.' },
    { n: '03', icon: 'fork',   t: 'Развилка в один клик', d: '«А что, если…» — под любой главой. Мгновенно создай свою копию точки и пиши продолжение, не ломая чужой текст.' },
    { n: '04', icon: 'users',  t: 'Карточки героев', d: 'Боковая панель ведёт судьбу персонажа для каждой ветки. Здесь он мёртв — а в соседней линии всё ещё жив.' },
  ];
  return (
    <div className="view" ref={ref}>
      {/* HERO */}
      <section className="wrap" style={{ padding: 'clamp(56px,12vh,140px) 0 clamp(48px,7vh,80px)' }}>
        <h1 className="reveal display" style={{ fontSize: 'clamp(3.4rem, 12vw, 11rem)', maxWidth: '14ch', lineHeight: .94 }}>
          Истории, которые пишет <span style={{ color: 'var(--accent)' }}>сообщество</span>.
        </h1>
        <div className="reveal" style={{ display: 'flex', flexWrap: 'wrap', gap: 38, alignItems: 'flex-end', marginTop: 'clamp(36px,6vh,64px)' }}>
          <p className="serif-italic" style={{ fontSize: 'clamp(1.15rem,2.2vw,1.6rem)', color: 'var(--ink-2)', maxWidth: '38ch', lineHeight: 1.5 }}>
            Множество авторов добавляют главы в одно произведение. Каждая развилка — новая судьба героев. Читатель выбирает путь — и сам становится соавтором.
          </p>
          <div style={{ display: 'flex', gap: 12, marginLeft: 'auto' }}>
            <button className="btn btn-primary" onClick={() => go('reader', { story: 'ashes', node: null })}><Icon name="branch" size={16} />Открыть древо</button>
            <button className="btn btn-ghost" onClick={() => go('catalog')}>Каталог историй</button>
          </div>
        </div>
      </section>

      {/* FLAGSHIP STRIP */}
      <section className="wrap reveal" style={{ paddingBottom: 80 }}>
        <div className="card framed" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 0, overflow: 'hidden' }}>
          <div style={{ padding: 'clamp(28px,4vw,48px)' }}>
            <div className="eyebrow" style={{ marginBottom: 16 }}>Главное произведение недели</div>
            <h2 className="display" style={{ fontSize: 'clamp(2rem,4vw,3.4rem)', marginBottom: 18 }}>{FLAGSHIP.title}</h2>
            <p style={{ color: 'var(--ink-2)', maxWidth: '46ch', marginBottom: 24 }}>{FLAGSHIP.synopsis}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 26 }}>
              {FLAGSHIP.tags.map(t => <Tag key={t} id={t} />)}
            </div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 28 }}>
              {[['Соавторов', FLAGSHIP.contributors], ['Ветвей', FLAGSHIP.branches], ['Читают канон', FLAGSHIP.canonReaders]].map(([k, v]) => (
                <div key={k}>
                  <div className="display" style={{ fontSize: '1.9rem' }}>{v}</div>
                  <div className="mono" style={{ fontSize: '.6rem', color: 'var(--ink-3)' }}>{k}</div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={() => go('reader', { story: 'ashes', node: null })}>Читать и ветвить<Icon name="arrow" size={16} /></button>
          </div>
          <div style={{ position: 'relative', borderLeft: 'var(--rule-style)', minHeight: 320 }}>
            <MiniTree onOpen={() => go('reader', { story: 'ashes', node: null })} />
          </div>
        </div>
      </section>

      {/* FEATURES — editorial numbered */}
      <section className="wrap" style={{ paddingBottom: 90 }}>
        <div className="reveal" style={{ borderTop: 'var(--rule-style)', paddingTop: 22, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="display" style={{ fontSize: 'clamp(1.6rem,3vw,2.4rem)' }}>Как это работает</h2>
          <span className="mono" style={{ color: 'var(--ink-3)' }}>04 механики</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 1, background: 'var(--line-soft)', border: 'var(--rule-style)' }}>
          {features.map(f => (
            <div key={f.n} className="reveal feature-cell" style={{ background: 'var(--bg)', padding: 'clamp(24px,3vw,38px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'clamp(40px,8vw,90px)' }}>
                <span className="mono" style={{ color: 'var(--accent)', fontSize: '.8rem' }}>{f.n}</span>
                <span style={{ color: 'var(--ink-3)' }}><Icon name={f.icon} size={22} /></span>
              </div>
              <h3 className="display" style={{ fontSize: '1.35rem', marginBottom: 10 }}>{f.t}</h3>
              <p style={{ color: 'var(--ink-2)', fontSize: '.96rem' }}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="wrap reveal" style={{ padding: '20px 0 110px', textAlign: 'center' }}>
        <div style={{ color: 'var(--ink-3)' }}><Icon name="flame" size={26} /></div>
        <h2 className="display" style={{ fontSize: 'clamp(2.2rem,6vw,4.6rem)', margin: '14px auto 22px', maxWidth: '18ch' }}>
          У каждой истории — тысяча возможных концов.
        </h2>
        <p className="serif-italic" style={{ color: 'var(--ink-2)', maxWidth: '44ch', margin: '0 auto 32px', fontSize: '1.15rem' }}>
          Напиши свой. Или проголосуй за чужой. WYRM хранит их все.
        </p>
        <button className="btn btn-primary" onClick={() => go('compose')}><Icon name="quill" size={16} />Начать ветку</button>
      </section>
    </div>
  );
}

/* small live tree teaser inside flagship strip */
function MiniTree({ onOpen }) {
  const dots = [
    { x: 50, y: 14, c: true }, { x: 28, y: 42, c: true }, { x: 72, y: 42 },
    { x: 18, y: 72, c: true }, { x: 40, y: 72 }, { x: 64, y: 72 }, { x: 84, y: 72 },
  ];
  const edges = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]];
  return (
    <button onClick={onOpen} title="Открыть древо" style={{ position: 'absolute', inset: 0, width: '100%', cursor: 'pointer',
      background: 'radial-gradient(70% 60% at 60% 10%, var(--bg-2), var(--bg))' }}>
      <svg viewBox="0 0 100 90" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%' }}>
        {edges.map(([a, b], i) => {
          const A = dots[a], B = dots[b], canon = A.c && B.c;
          return <path key={i} d={`M${A.x} ${A.y} C ${A.x} ${(A.y + B.y) / 2}, ${B.x} ${(A.y + B.y) / 2}, ${B.x} ${B.y}`}
            fill="none" stroke={canon ? 'var(--gold)' : 'var(--line)'} strokeWidth={canon ? 1.1 : 0.7} />;
        })}
        {dots.map((d, i) => (
          <g key={i}>
            {d.c && <circle cx={d.x} cy={d.y} r="3.6" fill="none" stroke="var(--gold)" strokeWidth="0.5" opacity=".5" />}
            <circle cx={d.x} cy={d.y} r="2" fill={d.c ? 'var(--gold)' : 'var(--accent)'} />
          </g>
        ))}
      </svg>
      <span className="mono" style={{ position: 'absolute', left: 16, bottom: 14, fontSize: '.56rem', color: 'var(--ink-3)' }}>живое древо · нажми</span>
    </button>
  );
}

/* ---------------- CATALOG ---------------- */
function Catalog({ go }) {
  const ref = useReveal();
  const { TAGS } = window.WYRM;
  const [STORIES, setStories] = useState(() => (window.WYRM.STORIES || []).slice());
  useEffect(() => { let on = true; store.listStories().then(s => { if (on && s && s.length) setStories(s); }); return () => { on = false; }; }, []);
  const [active, setActive] = useState(null);
  const [sort, setSort] = useState('hot');
  const allTags = Object.keys(TAGS);

  let list = STORIES.filter(s => !active || (s.tags || []).includes(active));
  list = [...list].sort((a, b) =>
    sort === 'hot' ? ((b.hot ? 1 : 0) - (a.hot ? 1 : 0)) || (b.contributors - a.contributors)
      : (b.branches || 0) - (a.branches || 0));

  return (
    <div className="view wrap" ref={ref} style={{ padding: 'clamp(34px,6vh,64px) 0 100px' }}>
      <div className="reveal" style={{ marginBottom: 30 }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>Все живые истории · {STORIES.length}</div>
        <h1 className="display" style={{ fontSize: 'clamp(2.4rem,6vw,4.4rem)' }}>Каталог</h1>
      </div>

      {/* filter bar */}
      <div className="reveal" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', borderTop: 'var(--rule-style)', borderBottom: 'var(--rule-style)', padding: '14px 0', marginBottom: 34 }}>
        <span className="mono" style={{ color: 'var(--ink-3)' }}>Жанр</span>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', flex: 1 }}>
          <button className="tag tag-btn" data-active={!active} onClick={() => setActive(null)}>Все</button>
          {allTags.map(t => <Tag key={t} id={t} asButton active={active === t} onClick={() => setActive(active === t ? null : t)} />)}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['hot', 'Популярные'], ['branches', 'Ветвистые']].map(([k, l]) => (
            <button key={k} className="nav-link" data-active={sort === k} onClick={() => setSort(k)} style={{ fontSize: '.82rem' }}>{l}</button>
          ))}
        </div>
      </div>

      {/* grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 26 }}>
        {list.map((s, i) => (
          <button key={s.id} className="reveal story-card" onClick={() => go('reader', { story: s.id })} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <CoverSlot label={`обложка · ${s.title}`} hue={(TAGS[s.tags[0]] || {}).hue || 200} src={s.cover} />
              {s.hot && <span className="mono" style={{ position: 'absolute', top: 10, left: 10, fontSize: '.54rem', padding: '.3em .55em', background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="flame" size={11} />В огне</span>}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <h3 className="display" style={{ fontSize: '1.3rem' }}>{s.title}</h3>
                <span className="code" style={{ flex: '0 0 auto' }}>WY_{String(i + 1).padStart(2, '0')} ©26</span>
              </div>
              <div className="mono" style={{ fontSize: '.58rem', color: 'var(--ink-3)', margin: '4px 0 9px' }}>@{s.author}</div>
              <p style={{ color: 'var(--ink-2)', fontSize: '.9rem', marginBottom: 12 }}>{s.synopsis}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>{s.tags.map(t => <Tag key={t} id={t} />)}</div>
              <div style={{ display: 'flex', gap: 16, color: 'var(--ink-3)', borderTop: 'var(--rule-style)', paddingTop: 11 }}>
                <span className="mono" style={{ fontSize: '.58rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="users" size={13} />{s.contributors}</span>
                <span className="mono" style={{ fontSize: '.58rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="branch" size={13} />{s.branches} ветвей</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Landing, Catalog });



/* ╔══ 05 · Reader + Compose ══╗ */
/* ============================================================
   WYRM — Reader (Story Tree + detail + character tracking) + Compose
   ============================================================ */

/* Загрузка древа истории через store (PocketBase или localStorage),
   канон вычисляется динамически («лидер среди сиблингов»), голосование toggle. */
function useStoryNodes(storyId) {
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let on = true; setLoading(true);
    store.listNodes(storyId).then(n => { if (on) { setRaw(n); setLoading(false); } });
    return () => { on = false; };
  }, [storyId, tick]);
  const nodes = useMemo(() => store.markCanon(raw, store.voteOverlay()), [raw, tick]);
  const myVotes = store.voteOverlay();
  const vote = async (id) => {
    // клиентский пред-чек self-vote (сервер тоже блокирует) — без unhandled rejection
    const me = wyrmLoad('wyrm.user', null);
    const n = nodes.find(x => x.id === id);
    if (n && me && n.author && n.author === (me.handle || me.name)) { wyrmErr(null, 'Нельзя голосовать за собственную главу.'); return; }
    try { await store.voteNode(id); } catch (e) { wyrmErr(e, 'Не удалось проголосовать.'); }
    setTick(t => t + 1);
  };
  const reload = () => setTick(t => t + 1);
  return { nodes, vote, reload, myVotes, loading };
}

/* Режим Чтения: книжная колонка с комфортной типографикой, ясным каноном
   и понятным выбором на каждой развилке (канон vs ветви «а что, если…»). */
function ReadingColumn({ nodes, byId, curId, setSel, vote, myVotes, goFork, fontScale, setFontScale }) {
  const node = byId[curId];
  if (!node) return null;
  const path = [...ancestorsOf(curId, byId)].reverse();
  const children = nodes.filter(n => n.parent === curId);
  const canonChild = children.find(c => c.canon);
  const alts = children.filter(c => !c.canon);
  const setScale = (d) => setFontScale(s => { const v = Math.max(0.85, Math.min(1.6, +(s + d).toFixed(2))); wyrmSave('wyrm.readScale', v); return v; });

  return (
    <div style={{ position: 'relative' }}>
      {/* панель чтения: путь + размер шрифта */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', color: 'var(--ink-3)' }}>
          <span className="mono" style={{ fontSize: '.54rem' }}>путь канона:</span>
          {path.map((id, i) => (
            <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <button className="mono path-crumb" onClick={() => setSel(id)} style={{ fontSize: '.56rem', color: id === curId ? 'var(--accent)' : (byId[id].canon ? 'var(--gold)' : 'var(--ink-2)') }}>{byId[id].title}</button>
              {i < path.length - 1 && <span style={{ opacity: .5 }}>›</span>}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button className="icon-btn" title="Меньше" onClick={() => setScale(-0.1)} style={{ width: 30, height: 30, fontFamily: 'var(--display)', fontSize: 12 }}>А−</button>
          <button className="icon-btn" title="Больше" onClick={() => setScale(0.1)} style={{ width: 30, height: 30, fontFamily: 'var(--display)', fontSize: 15 }}>А+</button>
        </div>
      </div>

      <article style={{ maxWidth: '40rem', margin: '0 auto', fontSize: fontScale + 'em' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <span className="mono" style={{ fontSize: '.56rem', color: 'var(--ink-3)' }}>глава {path.length} · {node.id.toUpperCase()}</span>
          {node.canon
            ? <span className="mono" style={{ fontSize: '.56rem', color: 'var(--gold)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="star" size={12} />каноничная линия</span>
            : <span className="mono" style={{ fontSize: '.56rem', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="branch" size={12} />ветвь · вне канона</span>}
        </div>
        <h2 className="display" style={{ fontSize: '2.1em', lineHeight: 1.05, marginBottom: 14 }}>{node.title}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <Avatar name={node.author} size={26} />
          <span className="mono" style={{ fontSize: '.6rem', color: 'var(--ink-3)' }}>@{node.author} · {node.words || 0} слов</span>
        </div>

        {node.html
          ? <div className="serif rich-read" style={{ fontSize: '1.12em', lineHeight: 1.85, color: 'var(--ink)' }} dangerouslySetInnerHTML={{ __html: cleanHtml(node.html) }} />
          : <p className="serif" style={{ fontSize: '1.12em', lineHeight: 1.85, color: 'var(--ink)' }}>{node.excerpt}</p>}

        {node.tags && node.tags.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '20px 0' }}>{node.tags.map(t => <Tag key={t} id={t} />)}</div>}

        <div style={{ display: 'flex', gap: 8, margin: '20px 0 32px', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => vote(curId)} style={{ borderColor: myVotes[curId] ? 'var(--gold)' : 'var(--line)', color: myVotes[curId] ? 'var(--gold)' : 'var(--ink)' }}>
            <Icon name={myVotes[curId] ? 'check' : 'star'} size={14} />{myVotes[curId] ? 'Голос учтён' : 'За канон'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => goFork(curId)}><Icon name="fork" size={14} />А что, если…</button>
          {path.length > 1 && <button className="btn btn-ghost btn-sm" onClick={() => setSel(node.parent)}><Icon name="arrowL" size={14} />Назад</button>}
        </div>

        {/* продолжение: ясный выбор канон vs ветви */}
        <div style={{ borderTop: 'var(--rule-style)', paddingTop: 22 }}>
          {children.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <p className="serif-italic" style={{ color: 'var(--ink-2)', marginBottom: 14 }}>Здесь история обрывается. Дальше ещё никто не написал.</p>
              <button className="btn btn-primary" onClick={() => goFork(curId)}><Icon name="quill" size={15} />Написать продолжение</button>
            </div>
          ) : (
            <React.Fragment>
              <div className="mono" style={{ fontSize: '.56rem', color: 'var(--ink-3)', marginBottom: 12 }}>Что дальше</div>
              {canonChild && (
                <button onClick={() => setSel(canonChild.id)} className="card" style={{ width: '100%', textAlign: 'left', padding: '16px 18px', marginBottom: 10, borderColor: 'var(--gold)', boxShadow: 'var(--canon-glow)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <span style={{ color: 'var(--gold)' }}><Icon name="star" size={18} /></span>
                  <span style={{ flex: 1 }}>
                    <span className="mono" style={{ fontSize: '.5rem', color: 'var(--gold)', display: 'block' }}>ДАЛЬШЕ ПО КАНОНУ</span>
                    <span className="display" style={{ fontSize: '1.1rem' }}>{canonChild.title}</span>
                    <span className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)', display: 'block' }}>@{canonChild.author}</span>
                  </span>
                  <Icon name="arrow" size={18} />
                </button>
              )}
              {alts.length > 0 && (
                <React.Fragment>
                  <div className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)', margin: '12px 0 8px' }}>развилки · а что, если… ({alts.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {alts.map(a => (
                      <button key={a.id} onClick={() => setSel(a.id)} className="story-card card" style={{ textAlign: 'left', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                        <span style={{ color: 'var(--accent)' }}><Icon name="fork" size={15} /></span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, display: 'block' }}>{a.title}</span>
                          <span className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)' }}>@{a.author} · {a.votes || 0} голосов</span>
                        </span>
                        <span style={{ width: 90 }}><CanonMeter score={a.score} /></span>
                      </button>
                    ))}
                  </div>
                </React.Fragment>
              )}
            </React.Fragment>
          )}
        </div>
      </article>
    </div>
  );
}

function Reader({ go, ctx, setCtx }) {
  const { FLAGSHIP, CHARACTERS, STORIES } = window.WYRM;
  const story = STORIES.find(s => s.id === ctx.story) || FLAGSHIP;
  const { nodes: NODES, vote, myVotes, loading } = useStoryNodes(story.id);
  const [sel, setSel] = useState(ctx.node || null);
  const [orient, setOrient] = useState('vertical');
  const [filter, setFilter] = useState(null);
  const [readMode, setReadMode] = useState(ctx.view !== 'map'); // читатель по умолчанию — режим Чтения
  const [fontScale, setFontScale] = useState(() => wyrmLoad('wyrm.readScale', 1));
  // reset selection when the story changes (but not on first mount, so feed deep-links keep their node)
  const prevStory = useRef(story.id);
  useEffect(() => { if (prevStory.current !== story.id) { prevStory.current = story.id; setSel(null); } }, [story.id]);

  const byId = Object.fromEntries(NODES.map(n => [n.id, n]));
  const rootId = NODES.length ? (NODES.find(n => !n.parent) || NODES[0]).id : null;
  // чтение стартует с корня (с начала книги), карта — с канон-узла A1a (если есть)
  const defId = (!readMode && byId['A1a']) ? 'A1a' : rootId;
  const node = byId[sel] || byId[defId] || null;
  const curId = node ? node.id : null;
  const castVote = (id) => vote(id);

  if (!node) {
    return (
      <div className="view wrap" style={{ padding: 'clamp(40px,8vh,90px) 0 80px' }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Древо истории</div>
        <h1 className="display" style={{ fontSize: 'clamp(2rem,5vw,3.6rem)' }}>{story.title}</h1>
        <p className="mono" style={{ color: 'var(--ink-3)', marginTop: 16 }}>{loading ? 'Загрузка древа…' : 'У этой истории пока нет глав.'}</p>
      </div>
    );
  }

  const path = [...ancestorsOf(curId, byId)].reverse(); // root → sel
  const allTags = [...new Set(NODES.flatMap(n => n.tags || []))];

  const goFork = (id) => { setCtx({ ...ctx, forkFrom: id, story: story.id }); go('compose'); };

  return (
    <div className="view wrap" style={{ padding: 'clamp(26px,4vh,44px) 0 80px' }}>
      {/* story header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 18, borderBottom: 'var(--rule-style)', paddingBottom: 22, marginBottom: 22 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontSize: '.56rem', color: 'var(--ink-3)', letterSpacing: '.14em' }}>КНИГА</span>
            <select value={story.id} onChange={e => go('reader', { story: e.target.value, node: null })}
              className="mono" style={{ background: 'var(--bg-3)', color: 'var(--ink)', border: 'var(--rule-style)', borderRadius: 3, padding: '5px 8px', fontSize: '.72rem', maxWidth: '75vw', cursor: 'pointer' }}>
              {STORIES.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            <button className="mono path-crumb" onClick={() => go('compose', { newBook: true, forkFrom: null })} style={{ fontSize: '.58rem', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="plus" size={12} />новая книга
            </button>
          </div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Древо истории · @{story.author}</div>
          <h1 className="display" style={{ fontSize: 'clamp(2rem,5vw,3.6rem)', marginBottom: 10 }}>{story.title}</h1>
          <p style={{ color: 'var(--ink-2)', maxWidth: '60ch' }}>{story.synopsis}</p>
        </div>
        <div style={{ display: 'flex', gap: 22 }}>
          {[['Соавторов', story.contributors], ['Ветвей', NODES.length]].map(([k, v]) => (
            <div key={k} style={{ textAlign: 'right' }}>
              <div className="display" style={{ fontSize: '1.7rem' }}>{v}</div>
              <div className="mono" style={{ fontSize: '.56rem', color: 'var(--ink-3)' }}>{k}</div>
            </div>
          ))}
        </div>
      </div>

      {/* режим: чтение / карта ветвей */}
      <div style={{ display: 'flex', gap: 4, border: '1px solid var(--line)', borderRadius: 8, padding: 3, width: 'fit-content', marginBottom: 16 }}>
        {[['read', 'Чтение', 'eye'], ['map', 'Карта ветвей', 'branch']].map(([k, l, ic]) => {
          const on = readMode === (k === 'read');
          return <button key={k} className="btn btn-sm" onClick={() => setReadMode(k === 'read')} style={{ background: on ? 'var(--accent)' : 'transparent', color: on ? 'var(--accent-ink)' : 'var(--ink-2)' }}><Icon name={ic} size={14} />{l}</button>;
        })}
      </div>

      {readMode && <ReadingColumn nodes={NODES} byId={byId} curId={curId} setSel={setSel} vote={vote} myVotes={myVotes} goFork={goFork} fontScale={fontScale} setFontScale={setFontScale} />}

      {!readMode && (<React.Fragment>
      {/* toolbar */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <span className="mono" style={{ color: 'var(--ink-3)' }}><Icon name="branch" size={13} style={{ verticalAlign: -2 }} /> карта</span>
        <div style={{ display: 'flex', gap: 4, border: '1px solid var(--line)', borderRadius: 3, padding: 3 }}>
          {[['vertical', 'Дерево'], ['radial', 'Радиально']].map(([k, l]) => (
            <button key={k} className="btn btn-sm" onClick={() => setOrient(k)} style={{ background: orient === k ? 'var(--bg-3)' : 'transparent', color: orient === k ? 'var(--ink)' : 'var(--ink-3)' }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          <span className="mono" style={{ color: 'var(--ink-3)' }}>фильтр настроения</span>
          <button className="tag tag-btn" data-active={!filter} onClick={() => setFilter(null)}>Все</button>
          {allTags.map(t => <Tag key={t} id={t} asButton active={filter === t} onClick={() => setFilter(filter === t ? null : t)} />)}
        </div>
      </div>

      {/* main split */}
      <div className="reader-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 366px', gap: 20, alignItems: 'start' }}>
        <div>
          <StoryTree orientation={orient} selected={curId} activeTag={filter}
            onSelect={setSel} onFork={goFork} nodes={NODES} />
          {/* breadcrumb path */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 14, color: 'var(--ink-3)' }}>
            <span className="mono" style={{ fontSize: '.56rem' }}>путь:</span>
            {path.map((id, i) => (
              <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <button className="mono path-crumb" onClick={() => setSel(id)} style={{ fontSize: '.58rem', color: curId === id ? 'var(--accent)' : 'var(--ink-2)' }}>{byId[id].title}</button>
                {i < path.length - 1 && <span style={{ opacity: .5 }}>›</span>}
              </span>
            ))}
          </div>
        </div>

        {/* SIDEBAR: node detail + characters */}
        <aside style={{ position: 'sticky', top: 84, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* node detail */}
          <div className="card framed" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span className="mono" style={{ fontSize: '.56rem', color: 'var(--ink-3)' }}>глава · {node.id.toUpperCase()}</span>
              {node.canon
                ? <span className="mono" style={{ color: 'var(--gold)', fontSize: '.56rem', display: 'inline-flex', gap: 4, alignItems: 'center' }}><Icon name="star" size={12} />Канон</span>
                : <span className="mono" style={{ color: 'var(--ink-3)', fontSize: '.56rem' }}>альт. ветвь</span>}
            </div>
            <h2 className="display" style={{ fontSize: '1.6rem', marginBottom: 4 }}>{node.title}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Avatar name={node.author} size={22} />
              <span className="mono" style={{ fontSize: '.58rem', color: 'var(--ink-3)' }}>@{node.author} · {node.words} слов</span>
            </div>
            {node.html
              ? <div className="serif rich-read" style={{ color: 'var(--ink)', fontSize: '1.02rem', lineHeight: 1.6, marginBottom: 16, maxHeight: 320, overflowY: 'auto' }} dangerouslySetInnerHTML={{ __html: cleanHtml(node.html) }} />
              : <p className="serif-italic" style={{ color: 'var(--ink)', fontSize: '1.02rem', lineHeight: 1.6, marginBottom: 16 }}>{node.excerpt}</p>}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>{node.tags.map(t => <Tag key={t} id={t} />)}</div>

            <div className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)', marginBottom: 6 }}>Канонический рейтинг</div>
            <CanonMeter score={node.score} gold={node.canon} />

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => castVote(curId)}
                style={{ flex: 1, justifyContent: 'center', borderColor: myVotes[curId] ? 'var(--gold)' : 'var(--line)', color: myVotes[curId] ? 'var(--gold)' : 'var(--ink)' }}>
                <Icon name={myVotes[curId] ? 'check' : 'star'} size={15} />{myVotes[curId] ? 'Голос учтён' : 'За канон'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => goFork(curId)} style={{ flex: 1, justifyContent: 'center' }}>
                <Icon name="fork" size={15} />А что, если…
              </button>
            </div>
          </div>

          {/* CHARACTER TRACKING */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 className="display" style={{ fontSize: '1.05rem' }}>Герои в этой ветке</h3>
              <Icon name="users" size={16} />
            </div>
            <p className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)', marginBottom: 14 }}>статусы пересчитаны для линии «{node.title}»</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(node.chars).map(([cid, st]) => {
                const c = CHARACTERS[cid];
                if (!c) return null;
                const canonBase = byId['A1a'] || byId[rootId];
                const canonSt = canonBase && canonBase.chars ? canonBase.chars[cid] : st;
                const diverged = st !== canonSt;
                return (
                  <div key={cid} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderTop: 'var(--rule-style)' }}>
                    <span style={{ width: 34, height: 34, borderRadius: 3, border: '1px solid var(--line)', display: 'grid', placeItems: 'center', fontFamily: 'var(--display)', flex: '0 0 auto', background: 'var(--bg-3)' }}>{c.glyph}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '.92rem' }}>{c.name}</div>
                      <div className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)' }}>{c.role}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      <StatusPill status={st} />
                      {diverged && <span className="mono" style={{ fontSize: '.46rem', color: 'var(--accent)' }}>≠ канон</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
      </React.Fragment>)}
    </div>
  );
}

/* ---------------- COMPOSE / FORK ---------------- */
// дефолтные пресеты раскладки верстка «из коробки»
const DESK_PRESETS = [
  { name: 'Черновик',  cfg: { left: false, right: true,  bottom: true,  focus: false, goal: 500 } },
  { name: 'Редактура', cfg: { left: true,  right: true,  bottom: false, focus: false, goal: 0 } },
  { name: 'Фокус',     cfg: { left: false, right: false, bottom: false, focus: true,  goal: 1000 } },
];
function Compose({ go, ctx, setCtx }) {
  const { CHARACTERS, TAGS } = window.WYRM;
  const storyId = ctx.story || 'ashes';
  // узлы читаем через store (PB в бою, иначе сид/localStorage), а не из
  // window.WYRM напрямую — в PB-режиме родитель развилки и навигатор глав
  // должны приходить из БД. Стартуем с сида, чтобы первый рендер был не пустым.
  const [NODES, setNODES] = useState(() => window.WYRM.nodesFor(storyId));
  useEffect(() => { let on = true; store.listNodes(storyId).then(n => { if (on && n && n.length) setNODES(n); }); return () => { on = false; }; }, [storyId]);
  const byId = Object.fromEntries(NODES.map(n => [n.id, n]));
  // safe-фолбэк: NODES может быть [] для PB-only/только что созданной истории,
  // пока listNodes не подгрузился — без этого useState(parent.tags) уронит экран (M3).
  const parent = byId[ctx.forkFrom] || byId['A1a'] || NODES.find(n => !n.parent) || NODES[0]
    || { id: '', title: '', excerpt: '', tags: [], chars: {} };
  // оффлайн-черновик: восстанавливаем title/body/synopsis из localStorage
  const [title, setTitle] = useState(() => wyrmLoad('wyrm.draft', {}).title || '');
  const [body, setBody] = useState(() => wyrmLoad('wyrm.draft', {}).body || '');
  const [tags, setTags] = useState(parent.tags.slice(0, 2));
  const [chars, setChars] = useState({ ...parent.chars });
  const [done, setDone] = useState(false);
  const [newId, setNewId] = useState(null);
  const [mode, setMode] = useState(ctx.forkFrom ? 'fork' : 'newbook'); // 'newbook' | 'fork'
  const [synopsis, setSynopsis] = useState(() => wyrmLoad('wyrm.draft', {}).synopsis || '');
  const [bookId, setBookId] = useState(null);
  const [community, setCommunity] = useState(ctx.community || '');
  const [cover, setCover] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const pickCover = async (file) => { if (!file) return; setCoverFile(file); try { setCover(await store.fileToDataURL(file)); } catch (e) {} };
  const [communities, setCommunities] = useState([]);
  useEffect(() => { let on = true; store.listCommunities().then(r => { if (on) setCommunities(r.communities || []); }); return () => { on = false; }; }, []);
  const plain = htmlToText(body);
  const words = plain ? plain.split(/\s+/).length : 0;
  const allTags = Object.keys(TAGS);

  const toggleTag = t => setTags(s => s.includes(t) ? s.filter(x => x !== t) : (s.length < 4 ? [...s, t] : s));
  // ---- верстак писателя: доки, заметки, пресеты, цель по словам ----
  const [desk, setDesk] = useState(() => store.getWorkspaceCfg());
  const [notes, setNotes] = useState(() => wyrmLoad('wyrm.draftNotes', ''));
  const [presets, setPresets] = useState(DESK_PRESETS);
  useEffect(() => { store.listWorkspacePresets().then(p => setPresets(p && p.length ? [...DESK_PRESETS, ...p] : DESK_PRESETS)); }, []);
  // синхр. активной раскладки из аккаунта (между устройствами, N5)
  useEffect(() => { store.loadWorkspaceCfgRemote().then(c => { if (c) setDesk(d => ({ ...d, ...c })); }); }, []);
  const setDeskCfg = (patch) => setDesk(d => { const n = { ...d, ...patch }; store.saveWorkspaceCfg(n); return n; });
  const togglePanel = (k) => setDeskCfg({ [k]: !desk[k] });
  const savePreset = async () => { const name = (typeof prompt !== 'undefined') && prompt('Название раскладки'); if (!name) return; await store.saveWorkspacePreset(name, desk); setPresets(p => [...p.filter(x => x.name !== name), { name, cfg: { ...desk } }]); };
  const saveNotes = (v) => { setNotes(v); wyrmSave('wyrm.draftNotes', v); };
  const goalPct = desk.goal ? Math.min(100, Math.round(words / desk.goal * 100)) : 0;
  // автосейв черновика главы (тело больше не теряется при перезагрузке — T4)
  useEffect(() => { wyrmSave('wyrm.draft', { title, body, synopsis }); }, [title, body, synopsis]);
  const clearDraft = () => wyrmSave('wyrm.draft', {});
  const slug = (s) => (s || '').toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'kniga';
  const resetForm = () => { clearDraft(); setDone(false); setTitle(''); setBody(''); setSynopsis(''); setNewId(null); setBookId(null); };

  // Start a brand-new book: create the story + its root chapter through the store.
  const publishBook = async () => {
    const text = htmlToText(body);
    if (!title.trim() || !text) return;
    const me = wyrmLoad('wyrm.user', null);
    const author = (me && (me.handle || me.name)) || 'аноним';
    const id = slug(title) + '-' + Date.now().toString(36).slice(-4);
    const story = { id, slug: id, title: title.trim(), author, synopsis: synopsis.trim() || (text.length > 140 ? text.slice(0, 140) + '…' : text),
      contributors: 1, branches: 1, tags: tags.length ? tags : ['dark-fantasy'], hot: false, community: community || null, cover: cover || null, coverFile };
    const root = { id: id + '-root', parent: null, story: id, title: 'Глава 1', author,
      canon: true, score: 0.5, votes: 0, words, tags: story.tags,
      excerpt: text.length > 320 ? text.slice(0, 317) + '…' : text, html: cleanHtml(body), chars: {} };
    try {
      await store.createStory(story, root);
      clearDraft(); setBookId(id); setNewId(root.id); setDone(true);
    } catch (e) { wyrmErr(e, 'Не удалось опубликовать книгу.'); }
  };

  const ModeToggle = () => (
    <div style={{ display: 'flex', gap: 4, padding: 3, border: '1px solid var(--line)', borderRadius: 4, marginBottom: 22, width: 'fit-content' }}>
      {[['newbook', 'Новая книга'], ['fork', 'Дописать существующую']].map(([k, l]) => (
        <button key={k} className="btn btn-sm" onClick={() => setMode(k)}
          style={{ background: mode === k ? 'var(--accent)' : 'transparent', color: mode === k ? 'var(--accent-ink)' : 'var(--ink-2)' }}>{l}</button>
      ))}
    </div>
  );

  // Publish a branch node through the store (PocketBase or localStorage).
  const publish = async () => {
    const text = htmlToText(body);
    if (!text) return;
    const me = wyrmLoad('wyrm.user', null);
    const node = {
      id: parent.id + 'x' + Date.now().toString(36).slice(-4),
      parent: parent.id,
      title: title.trim() || 'Безымянная ветвь',
      author: (me && (me.handle || me.name)) || 'аноним',
      canon: false, score: 0.3, votes: 0, words,
      tags: tags.length ? tags : parent.tags.slice(0, 2),
      excerpt: text.length > 320 ? text.slice(0, 317) + '…' : text,
      html: cleanHtml(body),
      chars: { ...chars },
      story: storyId,
    };
    try {
      await store.addNode(node);
      clearDraft(); setNewId(node.id);
      setDone(true);
    } catch (e) { wyrmErr(e, 'Не удалось опубликовать ветвь.'); }
  };

  if (done) return (
    <div className="view wrap" style={{ padding: '12vh 0', textAlign: 'center', maxWidth: 620, margin: '0 auto' }}>
      <div style={{ color: 'var(--gold)' }}><Icon name={bookId ? 'crown' : 'branch'} size={34} /></div>
      <h1 className="display" style={{ fontSize: 'clamp(2rem,5vw,3rem)', margin: '16px 0 14px' }}>{bookId ? 'Книга создана' : 'Ветка опубликована'}</h1>
      <p className="serif-italic" style={{ color: 'var(--ink-2)', fontSize: '1.15rem', marginBottom: 8 }}>
        {bookId
          ? `«${title || 'Без названия'}» опубликована. Первая глава положила начало древу — сообщество может ветвить дальше.`
          : `«${title || 'Без названия'}» теперь растёт от главы «${parent.title}».`}
      </p>
      {!bookId && <p style={{ color: 'var(--ink-3)', marginBottom: 30 }}>Сообщество начнёт голосовать за неё. Наберёт больше всех — станет каноном.</p>}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: bookId ? 30 : 0 }}>
        <button className="btn btn-primary" onClick={() => go('reader', { story: bookId || storyId, node: newId || (parent && parent.id) })}>{bookId ? 'Открыть книгу' : 'К древу'}<Icon name="arrow" size={15} /></button>
        <button className="btn btn-ghost" onClick={resetForm}>{bookId ? 'Ещё книгу' : 'Ещё ветку'}</button>
      </div>
    </div>
  );

  // ---- режим: своя книга с нуля ----
  if (mode === 'newbook') return (
    <div className="view wrap" style={{ padding: 'clamp(26px,4vh,48px) 0 90px' }}>
      <ModeToggle />
      <div className="compose-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 28, alignItems: 'start' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 12, color: 'var(--accent)' }}>Своя книга</div>
          <h1 className="display" style={{ fontSize: 'clamp(1.9rem,4vw,3rem)', marginBottom: 18 }}>Начни свою историю</h1>

          <input className="compose-input display" value={title} onChange={e => setTitle(e.target.value)} placeholder="Название книги"
            style={{ width: '100%', fontSize: '1.6rem', background: 'transparent', border: 'none', borderBottom: 'var(--rule-style)', padding: '8px 2px 12px', marginBottom: 16, color: 'var(--ink)', outline: 'none' }} />
          <textarea className="compose-input" value={synopsis} onChange={e => setSynopsis(e.target.value)} rows={2}
            placeholder="Краткое описание — о чём книга (необязательно)"
            style={{ width: '100%', resize: 'vertical', marginBottom: 18 }} />

          <div className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)', marginBottom: 8 }}>Первая глава</div>
          <RichEditor initialHtml={body} onChange={setBody}
            placeholder="С чего начинается твоя история? Пиши, форматируй или импортируй готовый документ (.docx / .txt)…" />
          <div className="mono" style={{ fontSize: '.56rem', color: 'var(--ink-3)', marginTop: 8 }}>{words} слов · это станет корнем твоего древа</div>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 84 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)', marginBottom: 10 }}>Круг жанров книги</div>
            <GenreWheel selected={tags} onToggle={toggleTag} multi size={236} />
            {tags.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>{tags.map(t => <Tag key={t} id={t} />)}</div>}
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)', marginBottom: 10 }}>Обложка (необязательно)</div>
            {cover && <img src={cover} alt="обложка" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 6, marginBottom: 10 }} />}
            <label className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="eye" size={14} />{cover ? 'Заменить' : 'Загрузить обложку'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => pickCover(e.target.files[0])} />
            </label>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)', marginBottom: 10 }}>Сообщество (необязательно)</div>
            <select value={community} onChange={e => setCommunity(e.target.value)}
              className="mono" style={{ width: '100%', background: 'var(--bg-3)', color: 'var(--ink)', border: 'var(--rule-style)', borderRadius: 4, padding: '8px 10px', fontSize: '.72rem' }}>
              <option value="">— без сообщества —</option>
              {communities.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={publishBook} disabled={!title.trim() || !plain}
            style={{ justifyContent: 'center', opacity: title.trim() && plain ? 1 : .5 }}>
            <Icon name="crown" size={16} />Опубликовать книгу
          </button>
          <p className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)', textAlign: 'center' }}>Книга появится в Каталоге, другие смогут писать в ней ветви</p>
        </aside>
      </div>
    </div>
  );

  const storyNodes = NODES;
  const storyTitle = ((window.WYRM.STORIES || []).find(s => s.id === storyId) || {}).title || parent.title || 'Древо';
  const deskCols = [desk.left && !desk.focus ? '230px' : null, 'minmax(0,1fr)', desk.right && !desk.focus ? '320px' : null].filter(Boolean).join(' ');
  const TOGGLES = [['left', 'Навигатор', 'branch'], ['right', 'Свойства', 'sliders'], ['bottom', 'Заметки', 'quill'], ['focus', 'Фокус', 'eye']];

  return (
    <div className="view wrap" style={{ padding: 'clamp(14px,2.5vh,26px) 0 90px' }}>
      <ModeToggle />

      {/* ── панель верстка: доки · пресеты · цель · публикация ── */}
      <div className="desk-bar">
        <button className="icon-btn" title="К древу" onClick={() => go('reader', { story: storyId })}><Icon name="arrowL" size={16} /></button>
        <span className="desk-sep" />
        {TOGGLES.map(([k, l, ic]) => (
          <button key={k} className="btn btn-sm desk-toggle" data-on={!!desk[k]} onClick={() => togglePanel(k)} title={l}>
            <Icon name={ic} size={13} /><span className="desk-toggle-l">{l}</span>
          </button>
        ))}
        <span className="desk-sep" />
        <select className="mono" value="" onChange={e => { const p = presets.find(x => x.name === e.target.value); if (p) setDeskCfg(p.cfg); }}
          style={{ background: 'var(--bg-3)', color: 'var(--ink)', border: 'var(--rule-style)', borderRadius: 4, padding: '5px 8px', fontSize: '.62rem' }}>
          <option value="">пресет раскладки…</option>
          {presets.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
        <button className="mono path-crumb" onClick={savePreset} style={{ fontSize: '.56rem', color: 'var(--accent)' }}>＋ сохранить</button>
        <span style={{ flex: 1 }} />
        {desk.goal > 0 && (
          <span title="Цель по словам" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
            <span className="mono" style={{ fontSize: '.54rem', color: goalPct >= 100 ? 'var(--gold)' : 'var(--ink-3)' }}>{words}/{desk.goal}</span>
            <span style={{ flex: 1, height: 4, background: 'var(--line-soft)', borderRadius: 4, overflow: 'hidden', minWidth: 60 }}>
              <span style={{ display: 'block', width: goalPct + '%', height: '100%', background: goalPct >= 100 ? 'var(--gold)' : 'var(--accent)' }} />
            </span>
          </span>
        )}
        <button className="btn btn-primary btn-sm" onClick={publish} disabled={!plain} style={{ opacity: plain ? 1 : .5 }}>
          <Icon name="branch" size={14} />Опубликовать
        </button>
      </div>

      {/* ── dock-раскладка ── */}
      <div className="desk" style={{ display: 'grid', gridTemplateColumns: deskCols, gap: 18, alignItems: 'start' }}>
        {/* ЛЕВЫЙ ДОК — навигатор глав */}
        {desk.left && !desk.focus && (
          <aside className="desk-dock" style={{ position: 'sticky', top: 84 }}>
            <div className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)', marginBottom: 10 }}>Навигатор · {storyTitle}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '62vh', overflowY: 'auto' }}>
              {storyNodes.map(n => (
                <button key={n.id} onClick={() => setCtx({ ...ctx, forkFrom: n.id, story: storyId })}
                  className="desk-navitem" data-on={n.id === parent.id} title="ветвиться от этой главы"
                  style={{ paddingLeft: 8 + (([...ancestorsOf(n.id, byId)].length - 1) * 10) }}>
                  <Icon name={n.canon ? 'star' : 'branch'} size={11} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* ЦЕНТР — полотно письма */}
        <main style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 12, color: 'var(--accent)' }}>Развилка · а что, если…</div>
          <div className="card" style={{ padding: '12px 14px', marginBottom: 16, borderLeft: '2px solid var(--accent)' }}>
            <div className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)', marginBottom: 6 }}>ветвишься от · глава {parent.id.toUpperCase()} «{parent.title}»</div>
            <p className="serif-italic" style={{ color: 'var(--ink-2)', fontSize: '.92rem' }}>…{(parent.excerpt || '').slice(-150)}</p>
          </div>
          <input className="compose-input display" value={title} onChange={e => setTitle(e.target.value)} placeholder="Название твоей главы"
            style={{ width: '100%', fontSize: '1.5rem', background: 'transparent', border: 'none', borderBottom: 'var(--rule-style)', padding: '8px 2px 12px', marginBottom: 16, color: 'var(--ink)', outline: 'none' }} />
          <RichEditor initialHtml={body} onChange={setBody}
            placeholder="Здесь развилка расходится. Кейра делает другой выбор — и история сворачивает в твою сторону. Пиши, форматируй или импортируй готовый документ…"
            minHeight={desk.focus ? 460 : 340} />
          <div className="mono" style={{ fontSize: '.56rem', color: 'var(--ink-3)', marginTop: 8 }}>{words} слов{desk.goal > 0 ? ` · цель ${desk.goal}` : ''} · можно импортировать .docx / .txt</div>

          {/* НИЖНИЙ ДОК — заметки + цель */}
          {desk.bottom && !desk.focus && (
            <div className="card" style={{ padding: 16, marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)' }}>Заметки к черновику (не публикуются)</span>
                <label className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  цель по словам <input type="number" min="0" step="100" value={desk.goal} onChange={e => setDeskCfg({ goal: Math.max(0, +e.target.value || 0) })}
                    style={{ width: 70, background: 'var(--bg-3)', color: 'var(--ink)', border: 'var(--rule-style)', borderRadius: 3, padding: '3px 6px', fontSize: '.6rem' }} />
                </label>
              </div>
              <textarea className="compose-input" value={notes} onChange={e => saveNotes(e.target.value)} rows={4}
                placeholder="Идеи, зацепки, что не забыть…" style={{ width: '100%', resize: 'vertical' }} />
            </div>
          )}
        </main>

        {/* ПРАВЫЙ ДОК — свойства: жанры + судьбы героев */}
        {desk.right && !desk.focus && (
          <aside className="desk-dock" style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 84 }}>
            <div className="card" style={{ padding: 18 }}>
              <div className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)', marginBottom: 10 }}>Круг жанров — настроение ветки</div>
              <GenreWheel selected={tags} onToggle={toggleTag} multi size={224} />
              {tags.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>{tags.map(t => <Tag key={t} id={t} />)}</div>}
            </div>
            {Object.keys(chars).length > 0 && (
              <div className="card" style={{ padding: 18 }}>
                <div className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)', marginBottom: 12 }}>Судьба героев в твоей ветке</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.keys(chars).map(cid => (
                    <div key={cid} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ flex: 1, fontSize: '.86rem', fontWeight: 600 }}>{(CHARACTERS[cid] || {}).name || cid}</span>
                      <select value={chars[cid]} onChange={e => setChars(s => ({ ...s, [cid]: e.target.value }))}
                        className="mono" style={{ background: 'var(--bg-3)', color: 'var(--ink)', border: 'var(--rule-style)', borderRadius: 3, padding: '5px 7px', fontSize: '.56rem' }}>
                        {Object.entries(CHAR_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)', textAlign: 'center' }}>Чужой текст не меняется — создаётся параллельная линия</p>
          </aside>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { Reader, Compose });



/* ╔══ 06 · Merge ══╗ */
/* ============================================================
   WYRM · #1 Narrative Merge — «git для прозы»
   Построчное ревью предложенной правки + слияние ветки в канон.
   ============================================================ */

function MergeHunk({ h, decision, onDecide }) {
  const palette = {
    add: { hue: 150, sign: '+', label: 'добавлено' },
    del: { hue: 25, sign: '−', label: 'удалено' },
  };
  if (h.type === 'ctx') return (
    <div style={{ display: 'flex', gap: 12, padding: '7px 14px', color: 'var(--ink-3)' }}>
      <span className="mono" style={{ fontSize: '.6rem', width: 16, flex: '0 0 auto', opacity: .6 }}> </span>
      <span className="serif-italic" style={{ fontSize: '.98rem' }}>{h.text}</span>
    </div>
  );
  if (h.type === 'conflict') return (
    <div style={{ border: '1px solid oklch(0.7 0.12 50 / .5)', borderRadius: 5, margin: '8px 0', overflow: 'hidden' }}>
      <div className="mono" style={{ fontSize: '.54rem', padding: '6px 12px', background: 'oklch(0.7 0.12 50 / .12)', color: 'oklch(0.78 0.12 50)', display: 'flex', justifyContent: 'space-between' }}>
        <span>⚠ конфликт · выбери линию</span><span>hunk #{h.id}</span>
      </div>
      {[['base', h.text, 'текущий канон'], ['them', h.them, '@grimwarden']].map(([k, txt, who]) => (
        <button key={k} onClick={() => onDecide(h.id, k)} style={{
          width: '100%', textAlign: 'left', display: 'flex', gap: 12, padding: '10px 14px',
          borderTop: '1px solid var(--line-soft)',
          background: decision === k ? 'oklch(0.7 0.13 168 / .12)' : 'transparent',
        }}>
          <span style={{ width: 16, flex: '0 0 auto', color: decision === k ? 'var(--accent)' : 'var(--ink-3)' }}>
            <Icon name={decision === k ? 'check' : 'fork'} size={13} />
          </span>
          <span style={{ flex: 1 }}>
            <span style={{ fontSize: '.98rem' }}>{txt}</span>
            <span className="mono" style={{ display: 'block', fontSize: '.5rem', color: 'var(--ink-3)', marginTop: 3 }}>{who}</span>
          </span>
        </button>
      ))}
    </div>
  );
  const p = palette[h.type];
  const on = decision !== 'reject';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '7px 14px',
      background: `oklch(0.7 0.12 ${p.hue} / ${on ? .1 : .03})`, opacity: on ? 1 : .45,
      borderLeft: `2px solid oklch(0.7 0.12 ${p.hue} / ${on ? .8 : .25})` }}>
      <span className="mono" style={{ fontSize: '.72rem', width: 16, flex: '0 0 auto', color: `oklch(0.78 0.13 ${p.hue})` }}>{p.sign}</span>
      <span style={{ flex: 1, fontSize: '.98rem', textDecoration: !on && h.type === 'add' ? 'line-through' : 'none' }}>{h.text}</span>
      <button onClick={() => onDecide(h.id, on ? 'reject' : 'accept')} className="mono"
        title={on ? 'отклонить' : 'принять'} style={{ fontSize: '.5rem', padding: '3px 7px', borderRadius: 2, border: '1px solid var(--line-soft)', color: 'var(--ink-2)', flex: '0 0 auto' }}>
        {on ? 'отклонить' : 'вернуть'}
      </button>
    </div>
  );
}

function Merge({ go }) {
  const ref = useReveal();
  const { STORIES } = window.WYRM;
  const [storyId, setStoryId] = useState('ashes');
  const { nodes } = useStoryNodes(storyId);
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const [targetId, setTargetId] = useState(null);
  const [sourceId, setSourceId] = useState(null);
  const [dec, setDec] = useState({});
  const [merged, setMerged] = useState(false);
  const [mergedTitle, setMergedTitle] = useState('');

  // дефолт: родитель с ≥2 ветвями → target = канон, source = другая ветвь
  useEffect(() => {
    if (!nodes.length) return;
    const kids = {}; nodes.forEach(n => { if (n.parent) (kids[n.parent] = kids[n.parent] || []).push(n); });
    const pair = Object.values(kids).find(a => a.length >= 2);
    let t, s;
    if (pair) { t = (pair.find(x => x.canon) || pair[0]); s = (pair.find(x => x !== t) || pair[1]); }
    else { t = nodes[0]; s = nodes[1] || nodes[0]; }
    setTargetId(t && t.id); setSourceId(s && s.id); setDec({}); setMerged(false);
  }, [storyId, nodes.length]);

  const target = byId[targetId], source = byId[sourceId];
  const plain = (n) => (n ? (htmlToText(n.html || '') || n.excerpt || '') : '');
  const hunks = useMemo(() => (target && source) ? diff.diffSentences(plain(target), plain(source)).map((h, i) => ({ ...h, id: i })) : [], [targetId, sourceId, nodes.length]);
  const onDecide = (id, v) => setDec(d => ({ ...d, [id]: v }));
  const changes = hunks.filter(h => h.type !== 'ctx');
  // «применено»: add/del — если не отклонено; conflict — только если выбрана
  // линия ветви (выбор канона = ветвь не вливается). Конфликт без решения молча
  // оставляет канон и НЕ считается применённым (T7).
  const applied = changes.filter(h => h.type === 'conflict' ? dec[h.id] === 'them' : dec[h.id] !== 'reject').length;

  const REVIEWERS = ['eira_noct', 'mara.q', 'nyx___'];
  const [approvals, setApprovals] = useState({});
  const approvedCount = Object.values(approvals).filter(Boolean).length;
  const toggleApprove = (a) => setApprovals(s => ({ ...s, [a]: !s[a] }));

  const checks = [
    { ok: !!source && !!target && source.id !== target.id, label: source && target && source.id !== target.id ? 'Выбраны две разные главы' : 'Выбери источник и цель' },
    { ok: applied >= 1, label: applied >= 1 ? applied + ' правок к применению' : 'Нет принятых правок' },
    { ok: approvedCount >= 2, label: approvedCount + ' / 2 ревьюера одобрили' },
  ];
  const ready = checks.every(c => c.ok);

  const doMerge = async () => {
    if (!ready || !target) return;
    const mergedText = diff.applyMerge(hunks, dec);
    const me = wyrmLoad('wyrm.user', null);
    const title = (target.title || 'Глава') + ' · слияние';
    const node = {
      id: target.id + 'm' + Date.now().toString(36).slice(-4), parent: target.id, story: storyId,
      title, author: (me && (me.handle || me.name)) || 'аноним', canon: false, score: 0.3, votes: 0,
      words: mergedText.split(/\s+/).filter(Boolean).length, tags: target.tags || [],
      excerpt: mergedText.length > 320 ? mergedText.slice(0, 317) + '…' : mergedText,
      html: cleanHtml('<p>' + mergedText.replace(/</g, '&lt;') + '</p>'), chars: { ...(target.chars || {}) },
    };
    try {
      await store.addNode(node);
      setMergedTitle(title); setMerged(true);
    } catch (e) { wyrmErr(e, 'Не удалось слить ветви.'); }
  };

  const nodeOpts = nodes.map(n => <option key={n.id} value={n.id}>{(n.canon ? '★ ' : '') + (n.title || n.id)}</option>);

  return (
    <div className="view wrap" ref={ref} style={{ padding: 'clamp(26px,4vh,44px) 0 90px' }}>
      <div className="reveal" style={{ marginBottom: 8 }}>
        <button className="mono path-crumb" onClick={() => go('reader', { story: storyId })} style={{ color: 'var(--ink-3)', display: 'inline-flex', gap: 6, alignItems: 'center', marginBottom: 18 }}><Icon name="arrowL" size={13} />древо</button>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Механика 01 · Narrative Merge — git для прозы</div>
      </div>

      {/* PR header + выбор глав */}
      <div className="reveal card framed" style={{ padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span className="mono" style={{ fontSize: '.56rem', padding: '.3em .6em', borderRadius: 2, background: ready ? 'oklch(0.7 0.13 168 / .15)' : 'oklch(0.7 0.12 50 / .15)', color: ready ? 'oklch(0.78 0.13 168)' : 'oklch(0.78 0.12 50)' }}>{ready ? '● готово к слиянию' : '● нужно ревью'}</span>
              <select value={storyId} onChange={e => setStoryId(e.target.value)} className="mono" style={{ background: 'var(--bg-3)', color: 'var(--ink)', border: 'var(--rule-style)', borderRadius: 3, padding: '4px 7px', fontSize: '.6rem' }}>
                {STORIES.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
            <h1 className="display" style={{ fontSize: 'clamp(1.6rem,3.4vw,2.4rem)' }}>Слияние ветви в канон</h1>
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <label className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)', display: 'flex', flexDirection: 'column', gap: 4 }}>источник (что вливаем)
                <select value={sourceId || ''} onChange={e => { setSourceId(e.target.value); setDec({}); setMerged(false); }} style={{ background: 'var(--bg-3)', color: 'var(--ink)', border: 'var(--rule-style)', borderRadius: 3, padding: '5px 7px', fontSize: '.7rem' }}>{nodeOpts}</select>
              </label>
              <label className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)', display: 'flex', flexDirection: 'column', gap: 4 }}>цель (канон)
                <select value={targetId || ''} onChange={e => { setTargetId(e.target.value); setDec({}); setMerged(false); }} style={{ background: 'var(--bg-3)', color: 'var(--ink)', border: 'var(--rule-style)', borderRadius: 3, padding: '5px 7px', fontSize: '.7rem' }}>{nodeOpts}</select>
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 18, textAlign: 'right' }}>
            <div><div className="display" style={{ fontSize: '1.6rem', color: 'oklch(0.78 0.13 150)' }}>{applied}</div><div className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)' }}>правок</div></div>
            <div><div className="display" style={{ fontSize: '1.6rem', color: 'var(--ink-3)' }}>{changes.length}</div><div className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)' }}>отличий</div></div>
          </div>
        </div>
      </div>

      <div className="reader-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 20, alignItems: 'start' }}>
        {/* diff */}
        <div className="reveal card" style={{ overflow: 'hidden' }}>
          <div className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)', padding: '12px 14px', borderBottom: 'var(--rule-style)', display: 'flex', justifyContent: 'space-between' }}>
            <span>нарративный дифф · «{target ? target.title : '—'}» ← «{source ? source.title : '—'}»</span><span>{changes.length} отличий</span>
          </div>
          <div style={{ padding: '8px 0' }}>
            {hunks.length === 0
              ? <div className="mono" style={{ fontSize: '.6rem', color: 'var(--ink-3)', padding: '20px 14px' }}>Главы идентичны или не выбраны.</div>
              : hunks.map(h => <MergeHunk key={h.id} h={h} decision={dec[h.id]} onDecide={onDecide} />)}
          </div>
        </div>

        {/* review rail */}
        <aside style={{ position: 'sticky', top: 84, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)', marginBottom: 12 }}>Проверки слияния</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {checks.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', display: 'grid', placeItems: 'center', flex: '0 0 auto',
                    background: c.ok ? 'oklch(0.7 0.13 150 / .18)' : 'oklch(0.7 0.12 50 / .18)', color: c.ok ? 'oklch(0.78 0.13 150)' : 'oklch(0.78 0.12 50)' }}>
                    <Icon name={c.ok ? 'check' : 'flame'} size={11} />
                  </span>
                  <span style={{ fontSize: '.84rem', color: c.ok ? 'var(--ink-2)' : 'var(--ink)' }}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)', marginBottom: 10 }}>Ревьюеры · нажми, чтобы одобрить</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {REVIEWERS.map(a => {
                const ok = !!approvals[a];
                return (
                  <button key={a} onClick={() => toggleApprove(a)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 4, border: '1px solid ' + (ok ? 'oklch(0.7 0.13 150 / .5)' : 'var(--line-soft)'), background: ok ? 'oklch(0.7 0.13 150 / .1)' : 'transparent', textAlign: 'left' }}>
                    <Avatar name={a} size={26} />
                    <span style={{ flex: 1, fontSize: '.82rem' }}>@{a}</span>
                    <span style={{ color: ok ? 'oklch(0.78 0.13 150)' : 'var(--ink-3)' }}><Icon name={ok ? 'check' : 'plus'} size={14} /></span>
                  </button>
                );
              })}
            </div>
          </div>

          {merged ? (
            <div className="card" style={{ padding: 18, textAlign: 'center', borderColor: 'var(--gold)' }}>
              <span style={{ color: 'var(--gold)' }}><Icon name="branch" size={22} /></span>
              <div className="display" style={{ fontSize: '1.1rem', margin: '8px 0 4px' }}>Слияние записано</div>
              <p className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)' }}>Создана глава «{mergedTitle}» с {applied} применёнными правками</p>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => go('reader', { story: storyId, node: targetId })}>К древу<Icon name="arrow" size={14} /></button>
            </div>
          ) : (
            <button className="btn btn-primary" disabled={!ready} onClick={doMerge}
              style={{ justifyContent: 'center', opacity: ready ? 1 : .5 }}>
              <Icon name="branch" size={16} />{ready ? 'Слить в канон' : 'Заверши ревью'}
            </button>
          )}
          <p className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)', textAlign: 'center' }}>Чужой текст не меняется — результат сохраняется новой главой</p>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { Merge });



/* ╔══ 07 · LoreGraph ══╗ */
/* ============================================================
   WYRM · #2 Lore Graph — живой кодекс + проверка непротиворечивости
   ============================================================ */

// Кураторские подписи связей для флагмана (ключ — отсортированная пара id).
// Для остальных пар берётся «вместе · N гл.» из числа общих глав.
const LORE_RELATIONS = {
  'archon|keira': 'торг',
  'archon|vale': 'враги',
  'archon|wyrm': 'охотится',
  'keira|vale': 'брат и сестра',
  'keira|wyrm': 'наездница',
  'vale|wyrm': 'свидетель',
};
const KIND_LABEL = { revival: 'Воскрешение', soft: 'Неувязка' };

function LoreGraph({ go }) {
  const ref = useReveal();
  const { CHARACTERS } = window.WYRM;
  const [storyId, setStoryId] = useState('ashes');
  const [stories, setStories] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [sel, setSel] = useState(null);
  const [ignored, setIgnored] = useState(() => store.getLoreIgnored());
  const [showHidden, setShowHidden] = useState(false);

  // истории и узлы читаем через store (PocketBase в бою, иначе демо-данные),
  // а НЕ из window.WYRM напрямую — иначе в PB-режиме граф анализировал бы
  // встроенный сид вместо реального сервера.
  useEffect(() => { let on = true; store.listStories().then(s => { if (on) setStories(s || []); }); return () => { on = false; }; }, []);
  useEffect(() => { let on = true; store.listNodes(storyId).then(n => { if (on) setNodes(n || []); }); return () => { on = false; }; }, [storyId]);
  const storyList = stories;

  const overlay = store.voteOverlay();
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const charIds = consistency.charactersIn(nodes);
  const latest = consistency.latestStatuses(nodes, overlay);
  const edges = consistency.coAppearEdges(nodes);
  const cur = charIds.includes(sel) ? sel : charIds[0];

  // круговая раскладка персонажей
  const W = 640, H = 440, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 78;
  const layout = {};
  charIds.forEach((id, i) => {
    if (charIds.length === 1) { layout[id] = { x: cx, y: cy }; return; }
    const a = -Math.PI / 2 + i * 2 * Math.PI / charIds.length;
    layout[id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const neighbors = new Set(edges.filter(e => e.a === cur || e.b === cur).flatMap(e => [e.a, e.b]));
  const hueFor = (id) => (CHAR_STATUS[latest[id]] || CHAR_STATUS.alive).hue;
  const nameFor = (id) => (CHARACTERS[id] && CHARACTERS[id].name) || id;
  const edgeLabel = (e) => { const k = [e.a, e.b].sort().join('|'); return LORE_RELATIONS[k] || `вместе · ${e.n} гл.`; };

  const allIssues = consistency.findContradictions(nodes, overlay, CHARACTERS);
  const issues = allIssues.filter(x => !ignored.includes(x.id));
  const hiddenCount = allIssues.length - issues.length;
  const appearances = cur ? consistency.appearancesOf(cur, nodes, overlay) : [];

  const doIgnore = (id) => { store.ignoreLoreIssue(id); setIgnored(store.getLoreIgnored()); };
  const doUnignore = (id) => { store.unignoreLoreIssue(id); setIgnored(store.getLoreIgnored()); };
  const goFix = (iss) => go('reader', { story: storyId, node: iss.toId });
  const curStory = stories.find(s => s.id === storyId) || {};

  return (
    <div className="view wrap" ref={ref} style={{ padding: 'clamp(26px,4vh,44px) 0 90px' }}>
      <div className="reveal" style={{ marginBottom: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Механика 02 · Lore Graph — кодекс мира</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14 }}>
          <h1 className="display" style={{ fontSize: 'clamp(1.9rem,4.4vw,3rem)' }}>Кодекс «{curStory.title || 'Древо'}»</h1>
          <div style={{ display: 'flex', gap: 4, border: '1px solid var(--line)', borderRadius: 3, padding: 3, flexWrap: 'wrap' }}>
            {storyList.map(s => (
              <button key={s.id} className="btn btn-sm" onClick={() => { setStoryId(s.id); setSel(null); }}
                style={{ background: storyId === s.id ? 'var(--bg-3)' : 'transparent', color: storyId === s.id ? 'var(--ink)' : 'var(--ink-3)' }}>{s.title}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="reader-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 20, alignItems: 'start' }}>
        {/* граф персонажей */}
        <div>
          <div className="reveal tree-scroll" style={{ position: 'relative', overflow: 'auto', height: 'clamp(420px,56vh,560px)', borderRadius: 6, border: '1px solid var(--line-soft)', background: 'radial-gradient(60% 50% at 50% 35%, var(--bg-2), var(--bg))' }}>
            {charIds.length === 0 ? (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 30 }}>
                <div>
                  <Icon name="eye" size={26} />
                  <p className="serif-italic" style={{ color: 'var(--ink-2)', marginTop: 12, fontSize: '1.05rem' }}>В этой истории ещё не отмечены судьбы героев.</p>
                  <p className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)', marginTop: 6 }}>Авторы задают статусы персонажей в редакторе главы — тогда здесь появятся граф и проверка канона.</p>
                </div>
              </div>
            ) : (
              <div style={{ position: 'relative', width: W, height: H, margin: '0 auto' }}>
                <svg width={W} height={H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  {edges.map((e, i) => {
                    const a = layout[e.a], b = layout[e.b];
                    if (!a || !b) return null;
                    const on = cur === e.a || cur === e.b;
                    return (
                      <g key={i}>
                        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={on ? 'var(--accent)' : 'var(--line)'} strokeWidth={on ? 1.8 : 1} opacity={on ? .9 : .4} />
                        {on && <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} fill="var(--ink-3)" fontSize="9" fontFamily="var(--mono)" textAnchor="middle">{edgeLabel(e)}</text>}
                      </g>
                    );
                  })}
                </svg>
                {charIds.map(id => {
                  const p = layout[id]; const hue = hueFor(id);
                  const active = cur === id, near = neighbors.has(id);
                  return (
                    <button key={id} onClick={() => setSel(id)} style={{
                      position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%,-50%)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                      opacity: active || near || !neighbors.size ? 1 : .45, transition: '.25s var(--ease)',
                    }}>
                      <span style={{ width: active ? 54 : 46, height: active ? 54 : 46, borderRadius: '50%', display: 'grid', placeItems: 'center',
                        background: `oklch(0.7 0.12 ${hue} / .14)`, border: `1.5px solid oklch(0.7 0.13 ${hue} / ${active ? 1 : .6})`,
                        boxShadow: active ? `0 0 22px -4px oklch(0.7 0.13 ${hue} / .7)` : 'none', transition: '.25s var(--ease)',
                        fontFamily: 'var(--display)', fontWeight: 700, color: `oklch(0.82 0.12 ${hue})`, fontSize: active ? '1.1rem' : '.95rem' }}>
                        {(CHARACTERS[id] && CHARACTERS[id].glyph) || nameFor(id)[0]}
                      </span>
                      <span className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{nameFor(id)}</span>
                      {latest[id] && <StatusPill status={latest[id]} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="reveal" style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
            {Object.entries(CHAR_STATUS).map(([k, v]) => (
              <span key={k} className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span className="dot" style={{ background: `oklch(0.7 0.13 ${v.hue})` }} />{v.label}
              </span>
            ))}
            <span className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)', marginLeft: 'auto' }}>цвет узла = статус на верхушке канона</span>
          </div>
        </div>

        {/* кодекс героя + проверка непротиворечивости */}
        <aside style={{ position: 'sticky', top: 84, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {cur && (
            <div className="card framed" style={{ padding: 20 }}>
              <div className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)', marginBottom: 8 }}>{(CHARACTERS[cur] && CHARACTERS[cur].role) || 'персонаж'} · авто-кодекс</div>
              <h2 className="display" style={{ fontSize: '1.5rem', marginBottom: 6 }}>{nameFor(cur)}</h2>
              {latest[cur] && <div style={{ marginBottom: 12 }}><StatusPill status={latest[cur]} /></div>}
              <div className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)', margin: '12px 0 8px' }}>Появления ({appearances.length} глав · ✦ канон)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {appearances.map(ap => (
                  <button key={ap.id} onClick={() => go('reader', { story: storyId, node: ap.id })}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', padding: '5px 7px', borderRadius: 4, border: '1px solid var(--line-soft)', background: ap.canon ? 'oklch(0.8 0.1 90 / .06)' : 'transparent' }}>
                    {ap.canon && <span style={{ color: 'var(--gold)', fontSize: '.7rem' }}>✦</span>}
                    <span style={{ flex: 1, fontSize: '.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ap.title}</span>
                    <StatusPill status={ap.status} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 className="display" style={{ fontSize: '1.05rem' }}>Проверка канона</h3>
              <span className="mono" style={{ fontSize: '.5rem', padding: '.25em .55em', borderRadius: 2,
                background: issues.length ? 'oklch(0.7 0.12 35 / .15)' : 'oklch(0.7 0.13 150 / .15)',
                color: issues.length ? 'oklch(0.78 0.13 35)' : 'oklch(0.78 0.13 150)' }}>
                {issues.length ? `${issues.length} замеч.` : 'чисто'}
              </span>
            </div>
            <p className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)', marginBottom: 14 }}>сканируем канон-цепочку на противоречия в судьбах героев</p>
            {issues.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'oklch(0.78 0.13 150)' }}>
                <Icon name="check" size={16} /><span style={{ fontSize: '.86rem' }}>{charIds.length ? 'Противоречий не найдено' : 'Нечего проверять'}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {issues.map(iss => {
                  const hue = iss.sev === 'high' ? 25 : iss.sev === 'mid' ? 50 : 86;
                  return (
                    <div key={iss.id} style={{ borderLeft: `2px solid oklch(0.7 0.14 ${hue})`, paddingLeft: 11 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: '.88rem' }}>{KIND_LABEL[iss.kind] || 'Неувязка'} · {iss.charName}</span>
                        <span className="mono" style={{ fontSize: '.46rem', color: `oklch(0.78 0.13 ${hue})`, textTransform: 'uppercase' }}>{iss.sev}</span>
                      </div>
                      <p style={{ fontSize: '.82rem', color: 'var(--ink-2)', marginBottom: 8 }}>{iss.text}</p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-primary" style={{ fontSize: '.62rem' }} onClick={() => goFix(iss)} title="Открыть спорную главу в чтении, чтобы развести линии">Развести линии</button>
                        <button className="btn btn-sm btn-ghost" style={{ fontSize: '.62rem' }} onClick={() => doIgnore(iss.id)}>Игнор</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {hiddenCount > 0 && (
              <div style={{ marginTop: 14, borderTop: 'var(--rule-style)', paddingTop: 10 }}>
                <button className="mono path-crumb" onClick={() => setShowHidden(v => !v)} style={{ fontSize: '.54rem', color: 'var(--ink-3)' }}>
                  {showHidden ? 'скрыть' : `показать скрытые (${hiddenCount})`}
                </button>
                {showHidden && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {allIssues.filter(x => ignored.includes(x.id)).map(iss => (
                      <div key={iss.id} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: .7 }}>
                        <span style={{ flex: 1, fontSize: '.74rem', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{iss.charName} · {KIND_LABEL[iss.kind] || 'неувязка'}</span>
                        <button className="mono path-crumb" onClick={() => doUnignore(iss.id)} style={{ fontSize: '.52rem', color: 'var(--accent)' }}>вернуть</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { LoreGraph });



/* ╔══ 08 · Stakes ══╗ */
/* ============================================================
   WYRM · #3 Canon Stakes — экономика влияния + роялти
   ============================================================ */

const STAKE_CANDIDATES = [
  { id: 'A1a', title: 'Цитадель молчания', author: 'mara.q', pool: 2210, backers: 184, tags: ['redemption', 'politics'] },
  { id: 'A1b', title: 'Сделка с тенью', author: 'nyx___', pool: 1320, backers: 96, tags: ['dark-fantasy', 'romance'] },
];
const ROYALTY = {
  pool: 1240,
  splits: [
    { author: 'eira_noct', role: 'основатель + корень', weight: 34 },
    { author: 'mara.q', role: 'канон A1·A1a', weight: 28 },
    { author: 'grimwarden', role: 'тёмная ветвь', weight: 18 },
    { author: 'sol_inkwell', role: 'правки и лор', weight: 12 },
    { author: 'nyx___', role: 'альт-линии', weight: 8 },
  ],
  ledger: [
    { who: 'mara.q', what: 'гл. A1a принята в канон', w: '+9.2%', t: '2 дн' },
    { who: 'sol_inkwell', what: '14 правок слиты (merge #38)', w: '+3.1%', t: '4 дн' },
    { who: 'grimwarden', what: 'ветвь B1 набрала 1.4k голосов', w: '+5.0%', t: '6 дн' },
  ],
};

function Stakes({ go }) {
  const ref = useReveal();
  const me = wyrmLoad('wyrm.user', null);
  const BUDGET = (me && me.reputation) || 200;        // бюджет = очки репутации автора
  const [alloc, setAlloc] = useState({ A1a: 0, A1b: 0 });
  const [committed, setCommitted] = useState(false);
  const spent = alloc.A1a + alloc.A1b;
  const left = BUDGET - spent;
  const set = (id, v) => setAlloc(a => {
    const other = id === 'A1a' ? a.A1b : a.A1a;
    const max = BUDGET - other;
    return { ...a, [id]: Math.max(0, Math.min(max, v)) };
  });
  const liveOf = (c) => c.pool + (committed ? alloc[c.id] : 0);
  const leadId = liveOf(STAKE_CANDIDATES[0]) >= liveOf(STAKE_CANDIDATES[1]) ? STAKE_CANDIDATES[0].id : STAKE_CANDIDATES[1].id;
  // ставка = усиленный голос: пишем очки в store (влияет на канон в Древе)
  const commit = async () => {
    try {
      for (const c of STAKE_CANDIDATES) if (alloc[c.id] > 0) await store.stakeNode(c.id, alloc[c.id]);
      setCommitted(true);
    } catch (e) { wyrmErr(e, 'Не удалось поставить очки.'); }
  };

  return (
    <div className="view wrap" ref={ref} style={{ padding: 'clamp(26px,4vh,44px) 0 90px' }}>
      <div className="reveal" style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Механика 03 · Canon Stakes — ставка на канон</div>
        <h1 className="display" style={{ fontSize: 'clamp(1.9rem,4.4vw,3rem)', maxWidth: '20ch' }}>Сообщество выбирает канон — и делит признание</h1>
      </div>

      <div className="reader-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* election */}
          <div className="reveal card framed" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
              <h2 className="display" style={{ fontSize: '1.4rem' }}>Развилка после «Северного тракта»</h2>
              <span className="mono" style={{ fontSize: '.54rem', color: 'oklch(0.78 0.13 50)' }}>⧗ закрытие через 2 дня</span>
            </div>
            <p className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)', marginBottom: 18 }}>распредели очки признания · ставка усиливает ветвь, набравшая больше станет золотым каноном</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {STAKE_CANDIDATES.map(c => {
                const live = liveOf(c);
                const totalLive = STAKE_CANDIDATES.reduce((s, x) => s + x.pool, 0) + (committed ? spent : 0);
                const pct = Math.round(live / totalLive * 100);
                const leading = c.id === leadId;
                return (
                  <div key={c.id} style={{ border: '1px solid ' + (leading ? 'var(--gold)' : 'var(--line)'), borderRadius: 5, padding: 16, boxShadow: leading ? 'var(--canon-glow)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <h3 className="display" style={{ fontSize: '1.15rem' }}>{c.title}</h3>
                          {leading && <span className="mono" style={{ fontSize: '.46rem', color: 'var(--gold)', display: 'inline-flex', gap: 3, alignItems: 'center' }}><Icon name="star" size={10} />ЛИДЕР</span>}
                        </div>
                        <div className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)', marginTop: 3 }}>@{c.author} · {c.backers} сторонников</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="display" style={{ fontSize: '1.5rem', color: leading ? 'var(--gold)' : 'var(--ink)' }}>{pct}%</div>
                        <div className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)' }}>{live.toLocaleString('ru')} очк.</div>
                      </div>
                    </div>
                    <div style={{ height: 6, background: 'var(--line-soft)', borderRadius: 6, overflow: 'hidden', margin: '12px 0' }}>
                      <div style={{ width: pct + '%', height: '100%', background: leading ? 'var(--gold)' : 'var(--accent)', transition: 'width .6s var(--ease)' }} />
                    </div>
                    {!committed && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input type="range" className="range" min="0" max={BUDGET} step="10" value={alloc[c.id]} onChange={e => set(c.id, +e.target.value)} style={{ flex: 1 }} />
                        <span className="mono" style={{ fontSize: '.6rem', width: 70, textAlign: 'right', color: alloc[c.id] ? 'var(--accent)' : 'var(--ink-3)' }}>+{alloc[c.id]} очк.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* royalty split */}
          <div className="reveal card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
              <h2 className="display" style={{ fontSize: '1.4rem' }}>Сплит авторства</h2>
              <span className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)' }}>пул месяца · {ROYALTY.pool.toLocaleString('ru')} очк.</span>
            </div>
            <p className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)', marginBottom: 16 }}>вклад в канон считается прозрачно — провенанс каждой главы</p>
            {/* stacked bar */}
            <div style={{ display: 'flex', height: 30, borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
              {ROYALTY.splits.map((s, i) => (
                <div key={s.author} title={`@${s.author} · ${s.weight}%`} style={{ width: s.weight + '%', background: `oklch(${0.5 + i * 0.08} 0.12 ${168 - i * 34})`, display: 'grid', placeItems: 'center' }}>
                  <span className="mono" style={{ fontSize: '.5rem', color: 'var(--accent-ink)' }}>{s.weight}%</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ROYALTY.splits.map((s, i) => (
                <div key={s.author} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8, borderBottom: i < ROYALTY.splits.length - 1 ? 'var(--rule-style)' : 'none' }}>
                  <span className="dot" style={{ background: `oklch(${0.5 + i * 0.08} 0.12 ${168 - i * 34})`, width: 9, height: 9 }} />
                  <Avatar name={s.author} size={24} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.88rem', fontWeight: 600 }}>@{s.author}</div>
                    <div className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)' }}>{s.role}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: '.72rem' }}>{Math.round(ROYALTY.pool * s.weight / 100).toLocaleString('ru')} очк.</div>
                    <div className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)' }}>{s.weight}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* rail */}
        <aside style={{ position: 'sticky', top: 84, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)', marginBottom: 8 }}>Очки признания</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="display" style={{ fontSize: '2.2rem', color: left < 50 ? 'oklch(0.78 0.13 50)' : 'var(--accent)' }}>{left}</span>
              <span className="mono" style={{ fontSize: '.56rem', color: 'var(--ink-3)' }}>/ {BUDGET} очков свободно</span>
            </div>
            <div style={{ height: 4, background: 'var(--line-soft)', borderRadius: 4, overflow: 'hidden', margin: '10px 0 6px' }}>
              <div style={{ width: (spent / BUDGET * 100) + '%', height: '100%', background: 'var(--accent)' }} />
            </div>
            <p className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)' }}>очки признания начисляются за принятые правки и победившие ветки (не деньги)</p>

            {committed ? (
              <div style={{ marginTop: 14, padding: 12, border: '1px solid var(--gold)', borderRadius: 4, textAlign: 'center' }}>
                <span style={{ color: 'var(--gold)' }}><Icon name="check" size={18} /></span>
                <div className="mono" style={{ fontSize: '.54rem', marginTop: 4 }}>Ставка сделана · {spent} очков · ветвь усилена</div>
                <button className="mono path-crumb" onClick={() => { setCommitted(false); setAlloc({ A1a: 0, A1b: 0 }); }} style={{ fontSize: '.5rem', color: 'var(--ink-3)', marginTop: 6 }}>ещё</button>
              </div>
            ) : (
              <button className="btn btn-primary" disabled={spent === 0} onClick={commit} style={{ width: '100%', justifyContent: 'center', marginTop: 14, opacity: spent ? 1 : .5 }}>
                <Icon name="star" size={15} />Поставить {spent} очков
              </button>
            )}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)', marginBottom: 12 }}>Леджер вклада</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {ROYALTY.ledger.map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 9 }}>
                  <Avatar name={l.who} size={22} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.78rem' }}>{l.what}</div>
                    <div className="mono" style={{ fontSize: '.48rem', color: 'var(--ink-3)' }}>@{l.who} · {l.t} назад</div>
                  </div>
                  <span className="mono" style={{ fontSize: '.58rem', color: 'oklch(0.78 0.13 150)' }}>{l.w}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { Stakes });



/* ╔══ 09 · WritersRoom ══╗ */
/* ============================================================
   WYRM · #4 Writers' Room — живая эстафета (relay)
   ============================================================ */

function WritersRoom({ go }) {
  const ref = useReveal();
  const me = wyrmLoad('wyrm.user', null);
  const myId = me ? (me.handle || me.name) : 'ты';
  const [st, setSt] = useState(null);          // нормализованный снапшот комнаты
  const [draft, setDraft] = useState('');       // мой текст, когда перо у меня
  const [voted, setVoted] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [newDir, setNewDir] = useState('');
  const clientRef = useRef(null);

  // подключение к realtime (боевой ws или демо-симулятор) + тик для таймера
  useEffect(() => {
    let alive = true; let client = null;
    (async () => {
      const token = await store.getAuthToken();
      if (!alive) return;
      client = realtime.connectRoom('ashes', { token, me: myId, onState: (s) => { if (alive) setSt(s); } });
      clientRef.current = client;
    })();
    const tid = setInterval(() => setNow(Date.now()), 500);
    return () => { alive = false; clearInterval(tid); const cl = client || clientRef.current; if (cl) cl.close(); };
  }, []);

  const cl = () => clientRef.current;
  const iHold = !!(st && st.turnHolder === myId);
  // получив перо, подхватываем текущий буфер сервера один раз
  useEffect(() => { if (iHold) setDraft((st && st.buffer) || ''); /* eslint-disable-next-line */ }, [iHold]);

  const history = st ? st.history : [];
  const buffer = st ? st.buffer : '';
  const queue = st ? st.queue : [];
  const dirs = st ? st.directions : [];
  const reacts = st ? st.reacts : { flame: 0, star: 0 };
  const live = !!(st && st.live);
  const inQueue = queue.includes(myId);
  const holder = st ? st.turnHolder : null;
  const secs = st && st.turnDeadline ? Math.max(0, Math.round((st.turnDeadline - now) / 1000)) : 0;
  const total = dirs.reduce((s, d) => s + d.votes, 0);
  const lead = dirs.reduce((a, b) => (a && a.votes >= b.votes ? a : b), null);
  const authors = new Set(history.map(h => h.who)).size;
  const nick = (id) => (id === myId ? 'ты' : id);

  const onType = (v) => { setDraft(v); cl() && cl().type(v); };
  const commit = () => { if (!draft.trim()) return; cl() && cl().commit(draft); setDraft(''); };
  const vote = (id) => { if (voted) return; setVoted(id); cl() && cl().vote(id); };
  const react = (k) => cl() && cl().react(k);
  const toggleQueue = () => { const c = cl(); if (!c) return; inQueue ? c.dequeue() : c.enqueue(); };
  const addDir = () => { const t = newDir.trim(); if (!t) return; cl() && cl().addDirection(t); setNewDir(''); };

  if (!st) return (
    <div className="view wrap" style={{ padding: '16vh 0', textAlign: 'center' }}>
      <p className="mono" style={{ color: 'var(--ink-3)' }}>подключение к комнате…</p>
    </div>
  );

  return (
    <div className="view wrap" ref={ref} style={{ padding: 'clamp(26px,4vh,44px) 0 90px' }}>
      <div className="reveal" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Механика 04 · Writers' Room — живая эстафета</div>
          <h1 className="display" style={{ fontSize: 'clamp(1.9rem,4.4vw,3rem)' }}>Сеанс: «Пепел Аркадии»</h1>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {live ? (
            <span className="mono live-badge" style={{ fontSize: '.6rem', color: 'oklch(0.7 0.2 25)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'oklch(0.7 0.2 25)' }} />В ЭФИРЕ
            </span>
          ) : (
            <span className="mono" style={{ fontSize: '.6rem', color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 6 }} title="Сервер realtime не подключён — локальная симуляция эстафеты">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink-3)' }} />демо-режим
            </span>
          )}
          <span className="mono" style={{ fontSize: '.6rem', color: 'var(--ink-3)', display: 'inline-flex', gap: 5, alignItems: 'center' }}><Icon name="users" size={14} />{queue.length} в эстафете</span>
        </div>
      </div>

      <div className="reader-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* живой манускрипт */}
          <div className="reveal card framed" style={{ padding: 24, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)' }}>живой манускрипт · абзац {history.length + 1}</span>
              <span className="mono" style={{ fontSize: '.56rem', color: secs < 10 ? 'oklch(0.7 0.2 25)' : 'var(--ink-2)' }}>
                {holder ? (iHold ? `твой ход · 0:${String(secs).padStart(2, '0')}` : `ход @${nick(holder)} · 0:${String(secs).padStart(2, '0')}`) : 'перо свободно'}
              </span>
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '1.12rem', lineHeight: 1.75, color: 'var(--ink)' }}>
              {history.map((p, i) => (
                <p key={i} style={{ marginBottom: 14, color: 'var(--ink-2)' }}>
                  {p.text}<span className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)', marginLeft: 6 }}>— @{nick(p.who)}</span>
                </p>
              ))}
              {iHold ? (
                <div>
                  <textarea className="compose-input" value={draft} onChange={e => onType(e.target.value)} rows={3}
                    placeholder="Твой ход — продолжай эстафету…" style={{ width: '100%', resize: 'vertical', fontFamily: 'var(--serif)', fontSize: '1.05rem' }} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={commit} disabled={!draft.trim()} style={{ opacity: draft.trim() ? 1 : .5 }}>
                      <Icon name="quill" size={14} />Передать перо
                    </button>
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--ink)' }}>
                  {buffer}<span className="caret" style={{ borderRight: '2px solid var(--accent)', marginLeft: 1 }}>&nbsp;</span>
                </p>
              )}
            </div>
            {/* реакции */}
            <div style={{ display: 'flex', gap: 10, marginTop: 18, borderTop: 'var(--rule-style)', paddingTop: 14 }}>
              {[['flame', 'уголёк'], ['star', 'канон']].map(([k, l]) => (
                <button key={k} onClick={() => react(k)} className="btn btn-ghost btn-sm" style={{ fontSize: '.7rem' }}>
                  <Icon name={k} size={14} />{reacts[k] || 0}
                </button>
              ))}
              <span className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)', marginLeft: 'auto', alignSelf: 'center' }}>реакции зрителей влияют на канон-рейтинг</span>
            </div>
          </div>

          {/* куда вести историю */}
          <div className="reveal card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 className="display" style={{ fontSize: '1.25rem' }}>Куда вести историю?</h2>
              <span className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)' }}>{total.toLocaleString('ru')} голосов</span>
            </div>
            <p className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)', marginBottom: 16 }}>зрители подсказывают следующий поворот — лидер уходит автору хода</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dirs.map(d => {
                const pct = total ? Math.round(d.votes / total * 100) : 0;
                const isLead = lead && d.id === lead.id, mine = voted === d.id;
                return (
                  <button key={d.id} onClick={() => vote(d.id)} disabled={!!voted} style={{
                    position: 'relative', textAlign: 'left', padding: '12px 14px', borderRadius: 5, overflow: 'hidden',
                    border: '1px solid ' + (isLead ? 'var(--accent)' : 'var(--line)'), cursor: voted ? 'default' : 'pointer',
                  }}>
                    <div style={{ position: 'absolute', inset: 0, width: pct + '%', background: isLead ? 'oklch(0.7 0.13 168 / .14)' : 'var(--bg-3)', transition: 'width .5s var(--ease)' }} />
                    <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: '.92rem' }}>{d.text}{mine && <span className="mono" style={{ fontSize: '.46rem', color: 'var(--accent)', marginLeft: 6 }}>твой голос</span>}</span>
                      <span className="mono" style={{ fontSize: '.7rem', color: isLead ? 'var(--accent)' : 'var(--ink-2)', flex: '0 0 auto' }}>{pct}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input className="compose-input" value={newDir} onChange={e => setNewDir(e.target.value)} placeholder="Предложить свой поворот…"
                onKeyDown={e => { if (e.key === 'Enter') addDir(); }} style={{ flex: 1, fontSize: '.82rem' }} />
              <button className="btn btn-ghost btn-sm" onClick={addDir} disabled={!newDir.trim()} style={{ opacity: newDir.trim() ? 1 : .5 }}><Icon name="plus" size={14} />Добавить</button>
            </div>
          </div>
        </div>

        {/* рейл: очередь эстафеты */}
        <aside style={{ position: 'sticky', top: 84, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)', marginBottom: 12 }}>Эстафета · передача пера</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {queue.length === 0 && <p className="mono" style={{ fontSize: '.56rem', color: 'var(--ink-3)' }}>очередь пуста — встань первым</p>}
              {queue.map((id, i) => {
                const isHolder = id === holder;
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderTop: i ? 'var(--rule-style)' : 'none' }}>
                    <span style={{ position: 'relative' }}>
                      <Avatar name={id} size={30} />
                      {isHolder && <span style={{ position: 'absolute', right: -1, bottom: -1, width: 9, height: 9, borderRadius: '50%', background: 'oklch(0.7 0.2 25)', border: '2px solid var(--bg-2)' }} />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '.86rem', fontWeight: 600 }}>@{nick(id)}</div>
                      <div className="mono" style={{ fontSize: '.48rem', color: isHolder ? 'oklch(0.7 0.2 25)' : 'var(--ink-3)' }}>{isHolder ? 'пишет сейчас' : (i === 0 ? 'следующий' : 'в очереди')}</div>
                    </div>
                    {isHolder && <Icon name="quill" size={15} />}
                  </div>
                );
              })}
            </div>
            <button className="btn btn-primary" onClick={toggleQueue} style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}>
              <Icon name={inQueue ? 'check' : 'plus'} size={15} />{inQueue ? 'Ты в эстафете · выйти' : 'Встать в эстафету'}
            </button>
          </div>

          <div className="card" style={{ padding: 18, display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            {[[String(queue.length), 'в эстафете'], [String(history.length), 'абзацев'], [String(authors), 'авторов']].map(([v, k]) => (
              <div key={k}><div className="display" style={{ fontSize: '1.5rem' }}>{v}</div><div className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)' }}>{k}</div></div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { WritersRoom });



/* ╔══ 10 · ReadersCut ══╗ */
/* ============================================================
   WYRM · #5 Reader's Cut — читатель собирает свой канон
   ============================================================ */

const CUT_PRESETS = [
  { id: 'canon',   label: 'Канон',         sel: { root: 'A', A: 'A1', A1: 'A1a' } },
  { id: 'horror',  label: 'Хоррор',        sel: { root: 'B', B: 'B1' } },
  { id: 'romance', label: 'Романтика',     sel: { root: 'A', A: 'A1', A1: 'A1b' } },
  { id: 'rebel',   label: 'Светлый побег', sel: { root: 'B', B: 'B2' } },
];
const CANON_LINE = ['root', 'A', 'A1', 'A1a'];

function ReadersCut({ go }) {
  const ref = useReveal();
  const { NODES } = window.WYRM;
  const byId = Object.fromEntries(NODES.map(n => [n.id, n]));
  const kids = {}; NODES.forEach(n => { if (n.parent) (kids[n.parent] = kids[n.parent] || []).push(n.id); });
  const [sel, setSel] = useState(CUT_PRESETS[0].sel);
  const [preset, setPreset] = useState('canon');
  const [exported, setExported] = useState(false);

  const path = (() => {
    const p = []; let cur = 'root';
    while (cur) { p.push(cur); const ch = kids[cur] || []; if (!ch.length) break;
      let nx = sel[cur]; if (!nx || !ch.includes(nx)) nx = ch.find(c => byId[c].canon) || ch[0]; cur = nx; }
    return p;
  })();

  const choose = (parent, child) => { setSel(s => ({ ...s, [parent]: child })); setPreset(null); setExported(false); };
  const applyPreset = (p) => { setSel(p.sel); setPreset(p.id); setExported(false); };

  const words = path.reduce((s, id) => s + byId[id].words, 0);
  const diverged = path.filter(id => !CANON_LINE.includes(id)).length;
  const divPct = Math.round(diverged / path.length * 100);

  // Assemble the chosen path into a plain-text book and download it.
  const downloadCut = () => {
    const lines = ['ПЕПЕЛ АРКАДИИ — версия читателя', '='.repeat(40), ''];
    path.forEach((id, i) => {
      const n = byId[id];
      lines.push(`Глава ${i + 1}. ${n.title}  (@${n.author})`, '', n.excerpt, '', '— · —', '');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'wyrm-cut-' + path.join('-') + '.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
  };
  // Copy a shareable link encoding the chosen path to the clipboard.
  const shareCut = () => {
    const link = location.origin + location.pathname + '#cut=' + path.join('-');
    if (navigator.clipboard) navigator.clipboard.writeText(link).catch(() => {});
    setExported(true);
  };

  return (
    <div className="view wrap" ref={ref} style={{ padding: 'clamp(26px,4vh,44px) 0 90px' }}>
      <div className="reveal" style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Механика 05 · Reader's Cut — твоя версия книги</div>
        <h1 className="display" style={{ fontSize: 'clamp(1.9rem,4.4vw,3rem)', maxWidth: '22ch' }}>Пройди развилки — собери свой канон</h1>
        <p className="serif-italic" style={{ color: 'var(--ink-2)', fontSize: '1.1rem', marginTop: 12, maxWidth: '52ch' }}>
          Выбирай на каждой развилке, и история соберётся в личную книгу — её можно скачать и подарить ссылкой.
        </p>
      </div>

      {/* mood presets */}
      <div className="reveal" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
        <span className="mono" style={{ color: 'var(--ink-3)' }}>собрать как</span>
        {CUT_PRESETS.map(p => (
          <button key={p.id} className="tag tag-btn" data-active={preset === p.id} onClick={() => applyPreset(p)}>{p.label}</button>
        ))}
      </div>

      <div className="reader-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 24, alignItems: 'start' }}>
        {/* the spine */}
        <div className="reveal" style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 19, top: 20, bottom: 40, width: 2, background: 'linear-gradient(var(--gold), var(--accent))', opacity: .5 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {path.map((id, idx) => {
              const n = byId[id];
              const ch = kids[id] || [];
              const isFork = ch.length > 1;
              const chosen = path[idx + 1];
              return (
                <div key={id}>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <span style={{ width: 40, flex: '0 0 auto', display: 'flex', justifyContent: 'center' }}>
                      <span style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', zIndex: 1,
                        background: 'var(--bg-2)', border: '1.5px solid ' + (CANON_LINE.includes(id) ? 'var(--gold)' : 'var(--accent)'),
                        fontFamily: 'var(--mono)', fontSize: '.62rem', color: CANON_LINE.includes(id) ? 'var(--gold)' : 'var(--accent)' }}>
                        {idx + 1}
                      </span>
                    </span>
                    <div className="card" style={{ flex: 1, padding: '14px 18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <h3 className="display" style={{ fontSize: '1.15rem' }}>{n.title}</h3>
                        {n.canon
                          ? <span className="mono" style={{ fontSize: '.46rem', color: 'var(--gold)', display: 'inline-flex', gap: 3, alignItems: 'center' }}><Icon name="star" size={10} />канон</span>
                          : <span className="mono" style={{ fontSize: '.46rem', color: 'var(--accent)' }}>альт</span>}
                      </div>
                      <div className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)', margin: '3px 0 8px' }}>@{n.author} · {n.words} слов</div>
                      <p className="serif-italic" style={{ fontSize: '.92rem', color: 'var(--ink-2)' }}>{n.excerpt.slice(0, 120)}…</p>
                    </div>
                  </div>

                  {isFork && (
                    <div style={{ display: 'flex', gap: 8, margin: '12px 0 0 56px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)' }}><Icon name="fork" size={11} style={{ verticalAlign: -2 }} /> развилка:</span>
                      {ch.map(cid => (
                        <button key={cid} onClick={() => choose(id, cid)} className="tag tag-btn" data-active={chosen === cid}
                          style={{ textTransform: 'none', letterSpacing: 0 }}>
                          {byId[cid].canon && <Icon name="star" size={9} />}{byId[cid].title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 4 }}>
              <span style={{ width: 40, display: 'flex', justifyContent: 'center' }}><span style={{ color: 'var(--accent)' }}><Icon name="flame" size={18} /></span></span>
              <span className="serif-italic" style={{ color: 'var(--ink-3)' }}>Конец твоей версии.</span>
            </div>
          </div>
        </div>

        {/* rail */}
        <aside style={{ position: 'sticky', top: 84, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card framed" style={{ padding: 20 }}>
            <div className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)', marginBottom: 14 }}>Твоя версия</div>
            <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
              <div><div className="display" style={{ fontSize: '1.9rem' }}>{path.length}</div><div className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)' }}>глав</div></div>
              <div><div className="display" style={{ fontSize: '1.9rem' }}>{(words / 1000).toFixed(1)}k</div><div className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)' }}>слов</div></div>
            </div>
            <div className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)', marginBottom: 6 }}>Отклонение от канона</div>
            <div style={{ height: 6, background: 'var(--line-soft)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: divPct + '%', height: '100%', background: divPct > 50 ? 'oklch(0.7 0.16 25)' : 'var(--accent)', transition: 'width .5s var(--ease)' }} />
            </div>
            <div className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-2)', marginTop: 6 }}>{divPct}% твоей книги — вне золотой линии</div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            {exported ? (
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <span style={{ color: 'var(--gold)' }}><Icon name="check" size={20} /></span>
                <div className="display" style={{ fontSize: '1.05rem', margin: '6px 0 4px' }}>Версия собрана</div>
                <p className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)' }}>wyrm.co/cut/aR7x · ссылка скопирована</p>
                <button className="mono path-crumb" onClick={() => setExported(false)} style={{ fontSize: '.5rem', color: 'var(--ink-3)', marginTop: 8 }}>назад</button>
              </div>
            ) : (
              <React.Fragment>
                <button className="btn btn-primary" onClick={downloadCut} style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}>
                  <Icon name="arrow" size={15} />Скачать эл. книгой
                </button>
                <button className="btn btn-ghost" onClick={shareCut} style={{ width: '100%', justifyContent: 'center' }}>
                  <Icon name="users" size={15} />Поделиться версией
                </button>
                <p className="mono" style={{ fontSize: '.48rem', color: 'var(--ink-3)', textAlign: 'center', marginTop: 10 }}>каждый собранный путь — новый вход на платформу</p>
              </React.Fragment>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { ReadersCut });



/* ╔══ 11 · Plugins ══╗ */
/* ============================================================
   WYRM — Community Plugins
   Реестр + рабочие виджеты + магазин + конструктор «создай своё».
   Включённый плагин реально меняет интерфейс (PluginHost).
   ============================================================ */

const PLUGIN_CATS = {
  atmos:  { label: 'Атмосфера', hue: 300 },
  read:   { label: 'Чтение',    hue: 168 },
  write:  { label: 'Письмо',    hue: 86 },
  game:   { label: 'Геймификация', hue: 35 },
  social: { label: 'Соц.',      hue: 240 },
  a11y:   { label: 'Доступность', hue: 200 },
};

/* built-in plugins ship with a working renderer (see PluginHost) */
const PLUGIN_REGISTRY = [
  { id: 'embers',   name: 'Угли',            author: 'wyrm.core', cat: 'atmos', slot: 'bg',     glyph: '✦', installs: '48.1k', rating: 4.8, desc: 'Тлеющие угольки дрейфуют по фону — атмосфера логова дракона.' },
  { id: 'progress', name: 'Прогресс чтения', author: 'lune_v',    cat: 'read',  slot: 'topbar', glyph: '▬', installs: '31.7k', rating: 4.9, desc: 'Тонкая полоса сверху показывает, сколько главы прочитано.' },
  { id: 'dice',     name: 'Кубик развилки',  author: 'jest_r',    cat: 'game',  slot: 'fab-r',  glyph: '⚄', installs: '22.0k', rating: 4.7, desc: 'Плавающая кнопка бросает тебя в случайную ветку древа.' },
  { id: 'wordhud',  name: 'Счётчик мира',    author: 'archivar',  cat: 'read',  slot: 'fab-l',  glyph: '∑', installs: '12.4k', rating: 4.6, desc: 'HUD с объёмом канона: сколько слов и глав уже написано.' },
  { id: 'zen',      name: 'Дзен-чтение',     author: 'reframed',  cat: 'a11y',  slot: 'class',  glyph: '◐', installs: '18.9k', rating: 4.9, desc: 'Приглушает интерфейс и расширяет колонку текста.' },
  /* community catalog — рендерятся как «значки» (chip) */
  { id: 'voice',    name: 'Озвучка канона',  author: 'tide.witch', cat: 'a11y', slot: 'chip', glyph: '♪', installs: '9.3k',  rating: 4.5, desc: 'Синтез речи читает золотую линию вслух.' },
  { id: 'translate',name: 'Переводчик веток',author: 'cogsmith',  cat: 'social', slot: 'chip', glyph: '⇄', installs: '7.1k', rating: 4.4, desc: 'Авто-перевод любой ветки на язык читателя.' },
  { id: 'tarot',    name: 'Таро героев',     author: 'nyx___',    cat: 'game',  slot: 'chip', glyph: '☾', installs: '5.6k',  rating: 4.3, desc: 'Вытягивает карту-предсказание судьбы для персонажа ветки.' },
  { id: 'metronome',name: 'Метроном письма', author: 'ashpoet',   cat: 'write', slot: 'chip', glyph: '◷', installs: '4.2k',  rating: 4.6, desc: 'Ритм-таймер для эстафеты в Комнате авторов.' },
];

/* ---------- working widgets ---------- */
function Embers() {
  const bits = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    l: Math.random() * 100, d: 6 + Math.random() * 10, delay: -Math.random() * 12, s: 6 + Math.random() * 8,
  })), []);
  return (
    <div className="plug-embers" aria-hidden="true">
      {bits.map((b, i) => <span key={i} className="ember" style={{ left: b.l + '%', fontSize: b.s, animationDuration: b.d + 's', animationDelay: b.delay + 's' }}>✦</span>)}
    </div>
  );
}
function ReadingProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => { const h = document.documentElement; const max = h.scrollHeight - h.clientHeight; setP(max > 0 ? h.scrollTop / max : 0); };
    on(); window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  }, []);
  return <div className="plug-progress"><div style={{ width: (p * 100) + '%' }} /></div>;
}
function DiceFab({ go }) {
  const [spin, setSpin] = useState(false);
  const roll = () => {
    const ids = window.WYRM.NODES.map(n => n.id);
    const pick = ids[Math.floor(Math.random() * ids.length)];
    setSpin(true); setTimeout(() => setSpin(false), 500);
    go('reader', { node: pick });
  };
  return (
    <button className="plug-fab" style={{ right: 22 }} onClick={roll} title="Бросок развилки">
      <span style={{ display: 'inline-block', transform: spin ? 'rotate(360deg)' : 'none', transition: 'transform .5s var(--ease)', fontSize: 20 }}>⚄</span>
    </button>
  );
}
function WordHud() {
  const { NODES } = window.WYRM;
  const words = NODES.reduce((s, n) => s + n.words, 0);
  return (
    <div className="plug-hud" style={{ left: 22 }}>
      <span className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)' }}>мир написан на</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="display" style={{ fontSize: '1.3rem' }}>{(words / 1000).toFixed(1)}k</span>
        <span className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)' }}>слов · {NODES.length} глав</span>
      </div>
    </div>
  );
}
function ChipTray({ plugins }) {
  if (!plugins.length) return null;
  return (
    <div className="plug-tray">
      {plugins.map(p => (
        <span key={p.id} className="plug-chip" title={p.name} style={p.color ? { borderColor: p.color, color: p.color } : null}>
          <span style={{ fontSize: 13 }}>{p.glyph}</span>
          <span className="mono" style={{ fontSize: '.5rem' }}>{p.name}</span>
        </span>
      ))}
    </div>
  );
}

/* mounts every enabled plugin's surface, globally */
function PluginHost({ state, customs, go }) {
  useEffect(() => { document.body.classList.toggle('zen', !!state.zen); }, [state.zen]);
  const all = [...PLUGIN_REGISTRY, ...customs];
  const chips = all.filter(p => state[p.id] && p.slot === 'chip');
  const bars = customs.filter(p => state[p.id] && p.slot === 'topbar');
  return (
    <React.Fragment>
      {state.embers && <Embers />}
      {state.progress && <ReadingProgress />}
      {bars.map(b => <div key={b.id} className="plug-custombar" style={{ background: b.color || 'var(--accent)' }} />)}
      {state.dice && <DiceFab go={go} />}
      {state.wordhud && <WordHud />}
      {customs.filter(p => state[p.id] && p.slot === 'fab-r').map((p, i) => (
        <button key={p.id} className="plug-fab" style={{ right: 22, bottom: 86 + i * 64, fontSize: 20, color: p.color || 'var(--accent)' }} title={p.name}>{p.glyph}</button>
      ))}
      <ChipTray plugins={chips} />
    </React.Fragment>
  );
}

/* ---------- marketplace + builder screen ---------- */
const PLUGIN_SLOTS = [
  { id: 'chip',   label: 'Значок',          glyph: '◆' },
  { id: 'topbar', label: 'Полоса сверху',   glyph: '▬' },
  { id: 'fab-r',  label: 'Плавающая кнопка', glyph: '●' },
];
const PLUGIN_COLORS = ['oklch(0.74 0.13 168)', 'oklch(0.64 0.19 35)', 'oklch(0.62 0.15 272)', 'oklch(0.78 0.13 86)'];

function PluginsScreen({ state, toggle, customs, addCustom, go }) {
  const ref = useReveal();
  const [tab, setTab] = useState('store');
  const [cat, setCat] = useState(null);
  const all = [...PLUGIN_REGISTRY, ...customs];
  const enabledCount = all.filter(p => state[p.id]).length;

  // builder state
  const [bName, setBName] = useState('');
  const [bCat, setBCat] = useState('atmos');
  const [bSlot, setBSlot] = useState('chip');
  const [bGlyph, setBGlyph] = useState('✦');
  const [bColor, setBColor] = useState(PLUGIN_COLORS[0]);

  const publish = () => {
    const id = 'cm_' + Date.now().toString(36);
    addCustom({ id, name: bName || 'Моё расширение', author: 'ты', cat: bCat, slot: bSlot, glyph: bGlyph || '✦', color: bColor, installs: 'новое', rating: 5.0, desc: 'Создано тобой в конструкторе WYRM.', custom: true });
    setTab('installed'); setBName('');
  };

  const list = (tab === 'installed' ? all.filter(p => state[p.id]) : all).filter(p => !cat || p.cat === cat);

  return (
    <div className="view wrap" ref={ref} style={{ padding: 'clamp(26px,4vh,44px) 0 90px' }}>
      <div className="reveal" style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Платформа · расширения сообщества</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14 }}>
          <h1 className="display" style={{ fontSize: 'clamp(1.9rem,4.4vw,3rem)', maxWidth: '20ch' }}>Магазин расширений</h1>
          <p className="serif-italic" style={{ color: 'var(--ink-2)', maxWidth: '38ch' }}>
            Сообщество расширяет WYRM как хочет — атмосфера, инструменты письма, геймификация. Включай по желанию или собери своё.
          </p>
        </div>
      </div>

      {/* tabs */}
      <div className="reveal" style={{ display: 'flex', gap: 4, borderBottom: 'var(--rule-style)', marginBottom: 22 }}>
        {[['store', 'Магазин', all.length], ['installed', 'Включённые', enabledCount], ['build', 'Создать своё', null]].map(([k, l, n]) => (
          <button key={k} className="plug-tab" data-active={tab === k} onClick={() => setTab(k)}>
            {l}{n != null && <span className="mono" style={{ fontSize: '.5rem', opacity: .7, marginLeft: 6 }}>{n}</span>}
          </button>
        ))}
      </div>

      {tab === 'build' ? (
        <div className="reveal compose-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 28, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Field label="Название">
              <input className="compose-input display" value={bName} onChange={e => setBName(e.target.value)} placeholder="Напр. «Шёпот леса»"
                style={{ width: '100%', fontSize: '1.3rem', background: 'transparent', border: 'none', borderBottom: 'var(--rule-style)', padding: '6px 2px 10px', color: 'var(--ink)', outline: 'none' }} />
            </Field>
            <Field label="Категория">
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {Object.entries(PLUGIN_CATS).map(([k, v]) => (
                  <button key={k} className="tag tag-btn" data-active={bCat === k} onClick={() => setBCat(k)} style={{ textTransform: 'none' }}>
                    <span className="dot" style={{ background: `oklch(0.7 0.14 ${v.hue})` }} />{v.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Где живёт расширение" hint="слот в интерфейсе">
              <div style={{ display: 'flex', gap: 8 }}>
                {PLUGIN_SLOTS.map(s => (
                  <button key={s.id} className="swatch-tile" data-active={bSlot === s.id} onClick={() => setBSlot(s.id)} style={{ flex: 1 }}>
                    <span style={{ fontSize: '1.2rem' }}>{s.glyph}</span>
                    <span className="mono" style={{ fontSize: '.46rem', color: 'var(--ink-3)', marginTop: 5 }}>{s.label}</span>
                  </button>
                ))}
              </div>
            </Field>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <Field label="Символ">
                <div style={{ display: 'flex', gap: 6 }}>
                  {['✦', '☾', '♪', '⚑', '◈', '✶', '⚄', '❡'].map(g => (
                    <button key={g} onClick={() => setBGlyph(g)} className="swatch-tile" data-active={bGlyph === g} style={{ width: 42, padding: '8px 0', fontSize: '1.1rem' }}>{g}</button>
                  ))}
                </div>
              </Field>
              <Field label="Цвет">
                <div style={{ display: 'flex', gap: 9 }}>
                  {PLUGIN_COLORS.map(c => (
                    <button key={c} onClick={() => setBColor(c)} style={{ width: 30, height: 30, borderRadius: '50%', background: c, boxShadow: bColor === c ? '0 0 0 2px var(--bg), 0 0 0 4px var(--ink)' : '0 0 0 1px var(--line)' }} />
                  ))}
                </div>
              </Field>
            </div>
          </div>

          {/* live preview */}
          <aside style={{ position: 'sticky', top: 84, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card framed" style={{ padding: 20 }}>
              <div className="mono" style={{ fontSize: '.52rem', color: 'var(--ink-3)', marginBottom: 14 }}>Предпросмотр</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ width: 46, height: 46, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--bg-3)', border: `1.5px solid ${bColor}`, color: bColor, fontSize: 22 }}>{bGlyph}</span>
                <div>
                  <div className="display" style={{ fontSize: '1.1rem' }}>{bName || 'Моё расширение'}</div>
                  <div className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)' }}>@ты · {PLUGIN_CATS[bCat].label} · {PLUGIN_SLOTS.find(s => s.id === bSlot).label}</div>
                </div>
              </div>
              {/* slot demo */}
              <div style={{ position: 'relative', height: 64, borderRadius: 6, border: 'var(--rule-style)', background: 'var(--bg)', overflow: 'hidden' }}>
                {bSlot === 'topbar' && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: bColor }} />}
                {bSlot === 'chip' && <span className="plug-chip" style={{ position: 'absolute', top: 10, right: 10, borderColor: bColor, color: bColor }}><span>{bGlyph}</span><span className="mono" style={{ fontSize: '.5rem' }}>{bName || 'плагин'}</span></span>}
                {bSlot === 'fab-r' && <span style={{ position: 'absolute', bottom: 10, right: 10, width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-2)', border: `1px solid ${bColor}`, color: bColor, display: 'grid', placeItems: 'center' }}>{bGlyph}</span>}
                <span className="mono" style={{ position: 'absolute', left: 10, bottom: 8, fontSize: '.46rem', color: 'var(--ink-3)' }}>так это видят читатели</span>
              </div>
            </div>
            <button className="btn btn-primary" onClick={publish} style={{ justifyContent: 'center' }}><Icon name="bolt" size={15} />Опубликовать и включить</button>
            <p className="mono" style={{ fontSize: '.48rem', color: 'var(--ink-3)', textAlign: 'center' }}>появится у тебя во «Включённых» и в магазине сообщества</p>
          </aside>
        </div>
      ) : (
        <React.Fragment>
          {/* category filter */}
          <div className="reveal" style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 22 }}>
            <button className="tag tag-btn" data-active={!cat} onClick={() => setCat(null)}>Все</button>
            {Object.entries(PLUGIN_CATS).map(([k, v]) => (
              <button key={k} className="tag tag-btn" data-active={cat === k} onClick={() => setCat(cat === k ? null : k)} style={{ textTransform: 'none' }}>
                <span className="dot" style={{ background: `oklch(0.7 0.14 ${v.hue})` }} />{v.label}
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <p className="serif-italic" style={{ color: 'var(--ink-3)', padding: '40px 0' }}>Пока ничего не включено. Загляни в магазин →</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 18 }}>
              {list.map(p => {
                const v = PLUGIN_CATS[p.cat]; const on = !!state[p.id];
                return (
                  <div key={p.id} className="reveal card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, borderColor: on ? 'var(--accent)' : undefined }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <span style={{ width: 44, height: 44, borderRadius: 10, flex: '0 0 auto', display: 'grid', placeItems: 'center', background: 'var(--bg-3)', border: `1.5px solid ${p.color || `oklch(0.7 0.13 ${v.hue})`}`, color: p.color || `oklch(0.78 0.13 ${v.hue})`, fontSize: 20 }}>{p.glyph}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <h3 className="display" style={{ fontSize: '1.1rem' }}>{p.name}</h3>
                          {p.custom && <span className="mono" style={{ fontSize: '.44rem', color: 'var(--accent)', border: '1px solid var(--line)', borderRadius: 2, padding: '1px 4px' }}>ТВОЁ</span>}
                        </div>
                        <div className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)' }}>@{p.author} · {v.label}</div>
                      </div>
                    </div>
                    <p style={{ fontSize: '.86rem', color: 'var(--ink-2)' }}>{p.desc}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8 }}>
                      <span className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)' }}>★ {p.rating} · {p.installs}</span>
                      <button onClick={() => toggle(p.id)} className="toggle" data-on={on} style={{ padding: '5px 11px 5px 5px' }}>
                        <span className="toggle-knob" />
                        <span className="mono" style={{ fontSize: '.52rem', color: on ? 'var(--ink)' : 'var(--ink-2)' }}>{on ? 'Вкл' : 'Выкл'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </React.Fragment>
      )}
    </div>
  );
}

Object.assign(window, { PLUGIN_REGISTRY, PluginHost, PluginsScreen });



/* ╔══ 12 · Auth ══╗ */
/* ============================================================
   WYRM — Авторизация (вход / регистрация)
   Прототип: пользователь хранится в localStorage('wyrm.user').
   ============================================================ */

function AuthModal({ open, mode, setMode, onClose, onAuth }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const reg = mode === 'register';
  const valid = email.includes('@') && pass.length >= 4 && (!reg || name.trim());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const cardRef = useRef(null);
  // a11y: Escape закрывает, фокус ловится внутри модалки (Tab циклится)
  useEffect(() => {
    if (!open) return;
    const focusables = () => cardRef.current
      ? [...cardRef.current.querySelectorAll('button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled && el.offsetParent !== null)
      : [];
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const f = focusables(); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => { const el = cardRef.current && cardRef.current.querySelector('input'); if (el) el.focus(); }, 40);
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(t); };
  }, [open]);

  const submit = async (e) => {
    e && e.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setErr('');
    try {
      const u = reg ? await store.signUp(email, pass, name.trim()) : await store.signIn(email, pass);
      onAuth(u);
    } catch (ex) { setErr(ex.message || 'Не удалось войти'); }
    setBusy(false);
  };
  const social = async (prov) => {
    if (busy) return;
    if (!store.enabled) { // демо: без сервера — гостевой вход
      onAuth({ name: prov === 'vk' ? 'Гость ВК' : 'Автор', email: prov + '@wyrm', handle: prov + '_user' });
      return;
    }
    setBusy(true); setErr('');
    try { onAuth(await store.signInOAuth(prov)); }
    catch (ex) { setErr(ex.message || 'Соцвход не удался'); }
    setBusy(false);
  };
  const forgot = async () => {
    if (busy) return;
    if (!email.includes('@')) { setErr('Введите почту, чтобы восстановить пароль'); return; }
    setBusy(true); setErr('');
    try { await store.requestPasswordReset(email); setErr('Письмо для сброса пароля отправлено на ' + email); }
    catch (ex) { setErr(ex.message || 'Не удалось отправить письмо'); }
    setBusy(false);
  };

  return (
    <div className="auth-overlay" data-open={open} onClick={onClose}>
      <div className="auth-card card framed" ref={cardRef} role="dialog" aria-modal="true" aria-label={reg ? 'Регистрация' : 'Вход'} onClick={e => e.stopPropagation()}>
        <button className="icon-btn" aria-label="Закрыть" onClick={onClose} style={{ position: 'absolute', top: 16, right: 16 }}><Icon name="x" size={16} /></button>

        <div style={{ marginBottom: 22 }}>
          <div className="brand" style={{ marginBottom: 18 }}>
            <span className="logo" style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: '1.4rem' }}><span style={{ color: 'var(--accent)' }}>W</span>YRM</span>
          </div>
          <h2 className="display" style={{ fontSize: '1.7rem', marginBottom: 6 }}>{reg ? 'Стань соавтором' : 'С возвращением'}</h2>
          <p className="serif-italic" style={{ color: 'var(--ink-2)' }}>{reg ? 'Создай аккаунт и впиши свою главу в общую историю.' : 'Войди, чтобы продолжить ветвить истории.'}</p>
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', gap: 4, padding: 3, border: '1px solid var(--line)', borderRadius: 4, marginBottom: 20 }}>
          {[['login', 'Вход'], ['register', 'Регистрация']].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className="btn btn-sm" style={{ flex: 1, justifyContent: 'center', background: mode === k ? 'var(--accent)' : 'transparent', color: mode === k ? 'var(--accent-ink)' : 'var(--ink-2)' }}>{l}</button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reg && (
            <label className="auth-field">
              <span className="mono">Имя автора</span>
              <input className="auth-input" value={name} onChange={e => setName(e.target.value)} placeholder="Эйра Нокт" />
            </label>
          )}
          <label className="auth-field">
            <span className="mono">Почта</span>
            <input className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@wyrm.co" />
          </label>
          <label className="auth-field">
            <span className="mono">Пароль</span>
            <input className="auth-input" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" />
          </label>
          <button type="submit" className="btn btn-primary" disabled={!valid || busy} style={{ justifyContent: 'center', marginTop: 6, opacity: valid && !busy ? 1 : .5 }}>
            {busy ? 'Минуту…' : (reg ? 'Создать аккаунт' : 'Войти')}<Icon name="arrow" size={15} />
          </button>
          {err && <p className="mono" style={{ fontSize: '.56rem', color: 'oklch(0.65 0.18 25)', textAlign: 'center' }}>{err}</p>}
          {!reg && (
            <button type="button" onClick={forgot} disabled={busy} className="mono path-crumb" style={{ alignSelf: 'center', fontSize: '.56rem', color: 'var(--ink-3)' }}>
              Забыли пароль?
            </button>
          )}
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
          <span style={{ flex: 1, height: 1, background: 'var(--line-soft)' }} />
          <span className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)' }}>или</span>
          <span style={{ flex: 1, height: 1, background: 'var(--line-soft)' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['vk', 'VK'], ['yandex', 'Yandex'], ['google', 'Google'], ['apple', 'Apple']].map(([k, l]) => (
            <button key={k} className="btn btn-ghost btn-sm" disabled={busy} onClick={() => social(k)} aria-label={'Войти через ' + l} style={{ flex: '1 0 40%', justifyContent: 'center' }}>{l}</button>
          ))}
        </div>

        <button onClick={onClose} className="mono path-crumb" style={{ display: 'block', margin: '20px auto 0', fontSize: '.58rem', color: 'var(--ink-3)' }}>
          Продолжить как гость →
        </button>
      </div>
    </div>
  );
}

/* account chip + menu in the nav */
/* колокольчик уведомлений */
function NotificationsMenu({ user }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const ref = useRef(null);
  const load = () => store.listNotifications().then(setItems);
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', h);
    return () => document.removeEventListener('pointerdown', h);
  }, []);
  if (!user) return null;
  const unread = items.filter(n => !n.read).length;
  const readAll = async () => { await store.markAllNotificationsRead(); load(); };
  const kindIcon = { like: 'flame', comment: 'users', repost: 'fork', canon: 'star', room_turn: 'quill' };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" title="Уведомления" onClick={() => { setOpen(o => !o); }} style={{ position: 'relative' }}>
        <Icon name="bell" size={17} />
        {unread > 0 && <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 9, background: 'var(--accent)', color: 'var(--accent-ink)', fontSize: 9, fontFamily: 'var(--mono)', display: 'grid', placeItems: 'center' }}>{unread}</span>}
      </button>
      <div className="studio-pop" data-open={open} style={{ width: 300, right: 0, left: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px 8px' }}>
          <span className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)' }}>Уведомления</span>
          {unread > 0 && <button className="mono path-crumb" onClick={readAll} style={{ fontSize: '.5rem', color: 'var(--accent)' }}>прочитать всё</button>}
        </div>
        {items.length === 0
          ? <div className="mono" style={{ fontSize: '.56rem', color: 'var(--ink-3)', padding: '6px 12px 10px' }}>Пока пусто.</div>
          : items.slice(0, 12).map(n => (
              <div key={n.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '9px 12px', borderTop: 'var(--rule-style)', opacity: n.read ? .55 : 1 }}>
                <span style={{ color: 'var(--accent)', marginTop: 2 }}><Icon name={kindIcon[n.kind] || 'bolt'} size={13} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '.8rem', lineHeight: 1.35 }}>{n.text}</div>
                  <div className="mono" style={{ fontSize: '.46rem', color: 'var(--ink-3)' }}>{timeAgo(n.ts)}</div>
                </div>
                {!n.read && <span style={{ width: 6, height: 6, borderRadius: 9, background: 'var(--accent)', flex: '0 0 auto', marginTop: 6 }} />}
              </div>
            ))}
      </div>
    </div>
  );
}

function AccountMenu({ user, onLogout, go }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', h);
    return () => document.removeEventListener('pointerdown', h);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 999, border: '1px solid var(--line)' }}>
        <Avatar name={user.name} size={26} />
        <span style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: '.86rem', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
      </button>
      <div className="studio-pop" data-open={open} style={{ width: 200 }}>
        <div style={{ padding: '6px 12px 10px', borderBottom: 'var(--rule-style)', marginBottom: 6 }}>
          <div style={{ fontWeight: 600, fontSize: '.86rem' }}>{user.name}</div>
          <div className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)' }}>@{user.handle}</div>
        </div>
        <button className="studio-item" onClick={() => { go('profile'); setOpen(false); }}><Icon name="users" size={15} /><span>Профиль</span></button>
        <button className="studio-item" onClick={() => { go('compose'); setOpen(false); }}><Icon name="quill" size={15} /><span>Мои ветки</span></button>
        <button className="studio-item" onClick={() => { go('cut'); setOpen(false); }}><Icon name="fork" size={15} /><span>Моя версия</span></button>
        <button className="studio-item" onClick={() => { onLogout(); setOpen(false); }}><Icon name="arrowL" size={15} /><span>Выйти</span></button>
      </div>
    </div>
  );
}

Object.assign(window, { AuthModal, AccountMenu });



/* ╔══ 13 · IntroFilm ══╗ */
/* ============================================================
   WYRM — Кинематографичная заставка (≤12с, пропускаемая)
   Древо растёт снизу вверх, ветви прорисовываются, узлы загораются.
   ============================================================ */

/* стабильный псевдослучайный генератор (сид) — форма дерева не «прыгает» */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function buildTree() {
  const rng = mulberry32(7);
  const segs = [], leaves = [];
  const W = 600, H = 600, baseX = 300, baseY = 600, trunkTop = 430;
  // тапер ствола→ветви: ширина у основания каждого сегмента
  const widthOf = (gen) => Math.max(1.3, 34 * Math.pow(0.62, gen));
  segs.push({ x: baseX, y: baseY, cx: baseX, cy: (baseY + trunkTop) / 2, x2: baseX, y2: trunkTop, gen: 0, len: baseY - trunkTop, w: widthOf(0), w2: widthOf(1) });
  function grow(x, y, ang, len, gen) {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    const mx = (x + x2) / 2, my = (y + y2) / 2;
    const nx = -(y2 - y), ny = (x2 - x), nl = Math.hypot(nx, ny) || 1;
    const curve = (rng() - 0.5) * len * 0.55;
    const cx = mx + nx / nl * curve, cy = my + ny / nl * curve;
    const chord = Math.hypot(x2 - x, y2 - y);
    const plen = chord + Math.abs(curve) * 0.9;
    segs.push({ x, y, cx, cy, x2, y2, gen, len: plen, w: widthOf(gen), w2: widthOf(gen + 1) });
    if (gen >= 5) { // крона: кластер листьев у кончика (немного — ради производительности)
      const n = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) leaves.push({ x: x2 + (rng() - 0.5) * 34, y: y2 + (rng() - 0.5) * 34, r: 7 + rng() * 12, gold: rng() > 0.8 });
      return;
    }
    const base = (26 - gen * 1.8) * Math.PI / 180;
    const jit = () => (rng() - 0.5) * 18 * Math.PI / 180;
    grow(x2, y2, ang - base + jit(), len * 0.76, gen + 1);
    grow(x2, y2, ang + base + jit(), len * 0.76, gen + 1);
    if (gen <= 2 && rng() > 0.45) grow(x2, y2, ang + jit() * 0.5, len * 0.66, gen + 1); // редкая средняя ветвь
  }
  grow(baseX, trunkTop, -Math.PI / 2, 120, 1);
  return { segs, leaves, W, H };
}

/* ~10-секундная кинематографичная заставка (всё на CSS-анимациях):
   камера отъезжает и поворачивается по часовой, дерево разрастается на весь
   экран, появляются слоганы, падают листья, опускаются полупрозрачные панели
   со статистикой и отзывами; в центре остаётся «W». */
function IntroFilm({ onDone, onAuth }) {
  const T = useMemo(buildTree, []);
  const [finale, setFinale] = useState(false);
  useEffect(() => { const t = setTimeout(() => setFinale(true), 8600); return () => clearTimeout(t); }, []);

  const SLOGANS = ['Истории, которые пишут вместе.', 'Твоя глава — в общей легенде.', 'Один мир — сотни авторов.'];

  const leaves = useMemo(() => {
    const r = mulberry32(42);
    return Array.from({ length: 12 }, () => ({
      x: r() * 100, s: 7 + r() * 9, delay: 4.6 + r() * 5.5, dur: 6 + r() * 4.5,
      drift: (r() - 0.5) * 180, gold: r() > 0.72,
    }));
  }, []);

  const panels = [
    { top: '15%', left: '7%', r: -4, delay: 6.0, k: 'соавторов', v: '2 480' },
    { top: '21%', left: '70%', r: 3, delay: 6.4, k: 'живых историй', v: '320' },
    { top: '60%', left: '11%', r: 4, delay: 6.8, k: 'ветвей в день', v: '1 200' },
    { top: '57%', left: '68%', r: -3, delay: 7.2, c: 'Дописал чужую главу — затянуло до утра', who: 'mara.q' },
    { top: '11%', left: '40%', r: 2, delay: 7.6, c: 'Моя ветвь стала каноном', who: 'grimwarden' },
  ];

  return (
    <div className="intro cine" role="dialog" aria-label="Заставка WYRM">
      <div className="cine-veil" aria-hidden="true" />

      {/* камера-стейдж с деревом (рост — один transform на группе, дёшево для GPU) */}
      <div className="cine-stage" aria-hidden="true">
        <div className="cine-canopy-glow" />
        <svg className="cine-tree" viewBox={`0 0 ${T.W} ${T.H}`} preserveAspectRatio="xMidYMax meet">
          <g className="cine-grow">
            {T.leaves.map((n, i) => (
              <circle key={'l' + i} className="cine-leafnode" cx={n.x} cy={n.y} r={n.r.toFixed(1)}
                fill={n.gold ? 'var(--gold)' : 'var(--accent)'} />
            ))}
            {T.segs.map((s, i) => (
              <path key={'s' + i} className="twig"
                d={`M ${s.x} ${s.y} Q ${s.cx.toFixed(1)} ${s.cy.toFixed(1)} ${s.x2.toFixed(1)} ${s.y2.toFixed(1)}`}
                strokeWidth={s.w.toFixed(1)} />
            ))}
          </g>
        </svg>
      </div>

      {/* падающие листья */}
      <div className="cine-leaves" aria-hidden="true">
        {leaves.map((l, i) => (
          <span key={i} className="cine-leaf" style={{
            left: l.x + '%', width: l.s, height: l.s,
            background: l.gold ? 'var(--gold)' : 'var(--accent)',
            '--drift': l.drift + 'px', animationDuration: l.dur + 's', animationDelay: l.delay + 's',
          }} />
        ))}
      </div>

      {/* полупрозрачные панели со статистикой и отзывами */}
      <div className="cine-panels" aria-hidden="true">
        {panels.map((p, i) => (
          <div key={i} className="cine-panel" style={{ top: p.top, left: p.left, '--r': p.r + 'deg', animationDelay: p.delay + 's' }}>
            {p.v
              ? <React.Fragment><span className="display cine-panel-v">{p.v}</span><span className="mono cine-panel-k">{p.k}</span></React.Fragment>
              : <React.Fragment><span className="serif-italic cine-panel-c">«{p.c}»</span><span className="mono cine-panel-k">@{p.who}</span></React.Fragment>}
          </div>
        ))}
      </div>

      {/* центр: W + слоганы + финал */}
      <div className="cine-center">
        <div className="cine-w">W</div>
        <div className="cine-slogans">
          {SLOGANS.map((s, i) => (
            <div key={i} className="cine-slogan display" style={{ animationDelay: (1.6 + i * 2.2) + 's' }}>{s}</div>
          ))}
        </div>
        <div className={'cine-finale' + (finale ? ' in' : '')}>
          <div className="mono" style={{ color: 'var(--ink-3)', letterSpacing: '.26em', marginBottom: 18 }}>WYRM · сотвори историю вместе</div>
          <div className="intro-cta">
            <button className="btn btn-primary" onClick={() => onAuth()}><Icon name="quill" size={16} />Войти и начать</button>
            <button className="btn btn-ghost" onClick={onDone}>Продолжить как гость</button>
          </div>
        </div>
      </div>

      <button className="intro-skip mono" onClick={onDone}>Пропустить <Icon name="arrow" size={13} /></button>
      <div className="intro-progress"><div className="cine-bar" /></div>
    </div>
  );
}

Object.assign(window, { IntroFilm });



/* ╔══ 15 · Лента и Сообщества — данные, хранилище, экраны ══╗ */

/* ---- крошечное хранилище поверх localStorage ---- */
function wyrmLoad(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
  catch (e) { return fallback; }
}
function wyrmSave(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
// Единая точка обратной связи об ошибке write-операции (PB может отклонить —
// напр. голос за свой узел): показываем сообщение, чтобы UI не зависал молча.
function wyrmErr(e, fallback) {
  const msg = (e && e.message) ? e.message : (fallback || 'Что-то пошло не так. Попробуй ещё раз.');
  try { if (typeof window !== 'undefined' && window.alert) window.alert(msg); else console.error('[WYRM]', msg); }
  catch (_) { console.error('[WYRM]', msg); }
}

/* относительное время */
function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'только что';
  const m = Math.floor(s / 60); if (m < 60) return m + ' мин назад';
  const h = Math.floor(m / 60); if (h < 24) return h + ' ч назад';
  const d = Math.floor(h / 24); if (d < 30) return d + ' дн назад';
  return new Date(ts).toLocaleDateString('ru');
}

/* типы постов ленты (иконка + подпись) */
const FEED_KINDS = {
  branch:  { icon: 'fork',  label: 'новая ветвь' },
  vote:    { icon: 'star',  label: 'голос за канон' },
  discuss: { icon: 'users', label: 'обсуждение' },
  post:    { icon: 'quill', label: 'запись' },
};

/* ---- общий стейт ленты через единый слой данных (store) ----
   filter: { kind?, community?, authorHandle?, authors[] } — фильтрация и
   пагинация идут на СЕРВЕРЕ (store.listPosts); смена фильтра рефетчит c 1-й
   страницы. authors:[] = пустая вкладка (никого). */
function useFeed(filter = {}) {
  const key = JSON.stringify(filter || {});
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    let on = true; setLoading(true);
    store.listPosts({ ...JSON.parse(key), page: 1 })
      .then(r => { if (on) { setPosts(r.items); setHasMore(r.hasMore); setPage(1); setLoading(false); } })
      .catch(e => { if (on) { setLoading(false); wyrmErr(e, 'Не удалось загрузить ленту.'); } });
    return () => { on = false; };
  }, [key]);
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try { const r = await store.listPosts({ ...JSON.parse(key), page: page + 1 }); setPosts(l => [...l, ...r.items]); setPage(p => p + 1); setHasMore(r.hasMore); }
    catch (e) { wyrmErr(e, 'Не удалось загрузить ещё.'); }
    setLoadingMore(false);
  };

  // показываем новый пост оптимистично ТОЛЬКО если он подходит активному фильтру
  // (иначе на вкладке «Голоса»/«Ветви»/«Подписки» он мелькнул бы и исчез)
  const matchesFilter = (np) => {
    const f = JSON.parse(key);
    if (f.kind && np.kind !== f.kind) return false;
    if (f.community && np.community !== f.community) return false;
    if (f.authorHandle && np.author !== f.authorHandle) return false;
    if (f.authors && !f.authors.includes(np.author)) return false;
    return true;
  };
  const addPost = async (p) => { const np = await store.addPost(p); if (matchesFilter(np)) setPosts(l => [np, ...l]); return np; };
  const repostPost = async (post, author) => { const np = await store.repost(post, author); if (matchesFilter(np)) setPosts(l => [np, ...l]); return np; };
  const removePost = async (id) => { setPosts(l => l.filter(p => p.id !== id)); try { await store.deletePost(id); } catch (e) {} };

  // optimistic like/save toggle
  const flip = (p, kind) => kind === 'save'
    ? { ...p, savedByMe: !p.savedByMe, saveCount: p.saveCount + (p.savedByMe ? -1 : 1) }
    : { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) };
  const toggleReact = async (id, kind) => {
    setPosts(l => l.map(p => p.id === id ? flip(p, kind) : p));
    try { await store.toggleReact(id, kind); }
    catch (e) { setPosts(l => l.map(p => p.id === id ? flip(p, kind) : p)); } // revert
  };
  return { posts, loading, hasMore, loadMore, loadingMore, addPost, repostPost, toggleReact, removePost };
}

/* поле ввода нового поста */
function FeedComposer({ user, onPost, placeholder, defaultKind, go }) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState(defaultKind || 'post');
  const [tags, setTags] = useState([]);
  const [showTags, setShowTags] = useState(false);
  const allTags = Object.keys(window.WYRM.TAGS);
  const toggleTag = (t) => setTags(s => s.includes(t) ? s.filter(x => x !== t) : (s.length < 3 ? [...s, t] : s));
  if (!user) {
    return (
      <div className="card" style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 26 }}>
        <span style={{ color: 'var(--ink-2)' }}>Войди, чтобы делиться ветвями, голосами и спорами.</span>
        <button className="btn btn-primary btn-sm" onClick={() => go && go('landing')}>Войти и писать</button>
      </div>
    );
  }
  const submit = () => {
    const t = text.trim(); if (!t) return;
    onPost({ author: user.handle || user.name, kind, text: t, tags, ref: null });
    setText(''); setTags([]); setShowTags(false);
  };
  return (
    <div className="card" style={{ padding: '18px 20px', marginBottom: 26 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <Avatar name={user.handle || user.name} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder={placeholder || 'Что нового в твоих историях?'}
            className="compose-input" rows={3} style={{ width: '100%', resize: 'vertical', minHeight: 64 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {Object.entries(FEED_KINDS).map(([k, v]) => (
              <button key={k} className="tag tag-btn" data-active={kind === k} onClick={() => setKind(k)}>
                <Icon name={v.icon} size={11} />{v.label}
              </button>
            ))}
            <button className="tag tag-btn" data-active={showTags || tags.length > 0} onClick={() => setShowTags(s => !s)}>
              <Icon name="star" size={11} />Жанры{tags.length ? ' · ' + tags.length : ''}
            </button>
            <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={submit} disabled={!text.trim()}>
              <Icon name="quill" size={14} />Опубликовать
            </button>
          </div>
          {showTags && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: 'var(--rule-style)' }}>
              {allTags.map(t => <Tag key={t} id={t} asButton active={tags.includes(t)} onClick={() => toggleTag(t)} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* карточка поста ленты — лайк / репост / комментарии / сохранить (единая модель) */
function PostCard({ post, user, onReact, onRepost, onDelete, go, communityName, following, onFollow }) {
  const k = FEED_KINDS[post.kind] || FEED_KINDS.post;
  const myHandle = user && (user.handle || user.name);
  const canFollow = user && onFollow && post.author && post.author !== myHandle;
  const isFollowing = following && following.includes(post.author);
  const [openC, setOpenC] = useState(false);
  const [comments, setComments] = useState(null);
  const [ctext, setCtext] = useState('');
  const [reposted, setReposted] = useState(false);
  const canModerate = user && onDelete && (user.role === 'moderator' || post.author === (user.handle || user.name));

  const toggleComments = async () => {
    const next = !openC; setOpenC(next);
    if (next && comments == null) setComments(await store.listComments(post.id));
  };
  const submitComment = async () => {
    const t = ctext.trim(); if (!t || !user) return;
    try {
      const cm = await store.addComment(post.id, t, user.handle || user.name);
      setComments(c => [...(c || []), cm]); setCtext('');
    } catch (e) { wyrmErr(e, 'Не удалось отправить комментарий.'); }
  };
  const doRepost = async () => {
    if (!user || reposted) return;
    await onRepost(post); setReposted(true);
  };
  const cCount = comments ? comments.length : post.commentCount;

  return (
    <article className="card reveal" style={{ padding: '18px 20px' }}>
      {post.repostOf && <div className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)', marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="fork" size={10} />репост</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Avatar name={post.author} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>@{post.author}</span>
            <span className="mono" style={{ fontSize: '.54rem', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name={k.icon} size={11} />{k.label}
            </span>
            {canFollow && (
              <button className="mono" onClick={() => onFollow(post.author)}
                style={{ fontSize: '.5rem', color: isFollowing ? 'var(--ink-3)' : 'var(--accent)', border: '1px solid var(--line-soft)', borderRadius: 999, padding: '1px 7px' }}>
                {isFollowing ? '✓ вы подписаны' : '+ подписаться'}
              </button>
            )}
          </div>
          <span className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)' }}>{timeAgo(post.ts)}</span>
        </div>
        {post.community && communityName && (
          <button onClick={() => go && go('community', { communityId: post.community })}
            className="tag tag-btn" style={{ fontSize: '.5rem', flex: '0 0 auto' }} title="Перейти в сообщество">
            <Icon name="users" size={10} />{communityName}
          </button>
        )}
        {canModerate && (
          <button className="icon-btn" style={{ flex: '0 0 auto', width: 28, height: 28 }} title={user.role === 'moderator' && post.author !== (user.handle || user.name) ? 'Удалить (модератор)' : 'Удалить'}
            onClick={() => { if (confirm('Удалить пост?')) onDelete(post.id); }}>
            <Icon name="x" size={14} />
          </button>
        )}
      </div>

      <p style={{ color: 'var(--ink)', lineHeight: 1.6, marginBottom: post.ref || (post.tags && post.tags.length) ? 14 : 4 }}>{post.text}</p>

      {post.ref && (
        <button className="path-crumb" onClick={() => go && go('reader', { story: post.ref.story || 'ashes', node: post.ref.node || null })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 3, border: 'var(--rule-style)', background: 'var(--bg-2)', marginBottom: 14, cursor: 'pointer', maxWidth: '100%' }}>
          <Icon name="branch" size={13} />
          <span className="mono" style={{ fontSize: '.6rem', color: 'var(--ink-2)' }}>{post.ref.storyTitle}{post.ref.node ? ' · гл. ' + post.ref.node.toUpperCase() : ''}</span>
          <Icon name="arrow" size={13} />
        </button>
      )}

      {post.tags && post.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>{post.tags.map(t => <Tag key={t} id={t} />)}</div>
      )}

      <div style={{ display: 'flex', gap: 6, borderTop: 'var(--rule-style)', paddingTop: 12, flexWrap: 'wrap' }}>
        <button className="tag tag-btn" data-active={post.likedByMe} onClick={() => onReact(post.id, 'like')} title="Нравится">
          <Icon name="flame" size={12} />{post.likeCount}
        </button>
        <button className="tag tag-btn" data-active={openC} onClick={toggleComments} title="Комментарии">
          <Icon name="users" size={12} />{cCount}
        </button>
        <button className="tag tag-btn" data-active={reposted} onClick={doRepost} title="Репост">
          <Icon name="fork" size={12} />{post.repostCount + (reposted ? 1 : 0)}
        </button>
        <button className="tag tag-btn" data-active={post.savedByMe} onClick={() => onReact(post.id, 'save')} title="В закладки" style={{ marginLeft: 'auto' }}>
          <Icon name="star" size={12} />{post.saveCount}
        </button>
      </div>

      {openC && (
        <div style={{ marginTop: 14, borderTop: 'var(--rule-style)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(comments || []).map(cm => (
            <div key={cm.id} style={{ display: 'flex', gap: 9 }}>
              <Avatar name={cm.author} size={26} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600, fontSize: '.84rem' }}>@{cm.author}</span>
                  <span className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)' }}>{timeAgo(cm.ts)}</span>
                </div>
                <p style={{ color: 'var(--ink-2)', fontSize: '.9rem', lineHeight: 1.5 }}>{cm.text}</p>
              </div>
            </div>
          ))}
          {comments && comments.length === 0 && <p className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)' }}>Комментариев пока нет.</p>}
          {user
            ? <div style={{ display: 'flex', gap: 8 }}>
                <input className="compose-input" value={ctext} onChange={e => setCtext(e.target.value)} placeholder="Написать комментарий…"
                  onKeyDown={e => { if (e.key === 'Enter') submitComment(); }} style={{ flex: 1, padding: '8px 12px' }} />
                <button className="btn btn-primary btn-sm" onClick={submitComment} disabled={!ctext.trim()}>Ответить</button>
              </div>
            : <p className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)' }}>Войди, чтобы комментировать.</p>}
        </div>
      )}
    </article>
  );
}

/* ---- HTML → плоский текст (для excerpt/счётчика слов) ---- */
function htmlToText(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return (d.textContent || '').replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/* ---- редактор главы: форматирование + импорт .txt/.md/.docx ---- */
function RichEditor({ initialHtml, onChange, placeholder, minHeight = 320 }) {
  const ref = useRef(null);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState('');
  const emit = () => { if (ref.current) onChange(ref.current.innerHTML); };
  const exec = (cmd, val) => { document.execCommand(cmd, false, val); if (ref.current) ref.current.focus(); emit(); };
  // Push external content (e.g. an import) into the editable DOM without
  // clobbering the caret while the user is typing.
  useEffect(() => {
    if (ref.current && initialHtml != null && ref.current.innerHTML !== initialHtml) ref.current.innerHTML = initialHtml;
  }, [initialHtml]);

  const importFile = async (file) => {
    if (!file) return;
    setBusy('Импортирую «' + file.name + '»…');
    try {
      let html = '';
      if (/\.docx$/i.test(file.name)) {
        const mammoth = await import('mammoth/mammoth.browser.js');
        const ab = await file.arrayBuffer();
        const res = await (mammoth.convertToHtml ? mammoth.convertToHtml({ arrayBuffer: ab }) : mammoth.default.convertToHtml({ arrayBuffer: ab }));
        html = res.value || '';
      } else {
        const text = await file.text();
        html = text.split(/\n{2,}/).map(p => '<p>' + p.replace(/\n/g, '<br>').replace(/[<>]/g, s => ({ '<': '&lt;', '>': '&gt;' }[s])) + '</p>').join('');
      }
      if (ref.current) { ref.current.innerHTML = cleanHtml(html); emit(); }
    } catch (e) {
      setBusy('Не удалось прочитать файл: ' + e.message);
      return;
    }
    setBusy('');
  };

  const tools = [
    ['Ж', 'bold', null, { fontWeight: 800 }],
    ['К', 'italic', null, { fontStyle: 'italic', fontFamily: 'var(--serif)' }],
    ['H', 'formatBlock', 'H3', { fontWeight: 700 }],
    ['❝', 'formatBlock', 'BLOCKQUOTE', {}],
    ['• —', 'insertUnorderedList', null, {}],
    ['⌫', 'removeFormat', null, {}],
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 10, paddingBottom: 10, borderBottom: 'var(--rule-style)' }}>
        {tools.map(([label, cmd, val, st]) => (
          <button key={label} type="button" className="edit-tool" title={cmd}
            onMouseDown={e => e.preventDefault()} onClick={() => exec(cmd, val)} style={st}>{label}</button>
        ))}
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current && fileRef.current.click()}>
          <Icon name="arrow" size={13} />Импорт .txt / .docx
        </button>
        <input ref={fileRef} type="file" accept=".txt,.md,.markdown,.docx" style={{ display: 'none' }}
          onChange={e => { importFile(e.target.files[0]); e.target.value = ''; }} />
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning className="compose-input serif rich-edit"
        onInput={emit} data-placeholder={placeholder}
        style={{ width: '100%', minHeight, background: 'var(--bg-2)', border: 'var(--rule-style)', borderRadius: 5, padding: 18, fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--ink)', outline: 'none', fontFamily: 'var(--serif)', overflowY: 'auto' }} />
      {busy && <div className="mono" style={{ fontSize: '.56rem', color: 'var(--accent)', marginTop: 8 }}>{busy}</div>}
    </div>
  );
}

/* ---- интерактивный круг жанров (кольцо с секторами) ---- */
function GenreWheel({ selected, onToggle, multi = true, size = 260, max }) {
  const { TAGS } = window.WYRM;
  const ids = Object.keys(TAGS);
  const [hover, setHover] = useState(null);
  const sel = Array.isArray(selected) ? selected : (selected ? [selected] : []);
  const cx = size / 2, cy = size / 2;
  const R = size / 2 - 8, r = size * 0.26;
  const n = ids.length, step = 360 / n, gap = 1.6;
  const pol = (ang, rad) => { const a = (ang - 90) * Math.PI / 180; return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]; };
  const sector = (i, ro, ri) => {
    const a0 = i * step + gap, a1 = (i + 1) * step - gap;
    const [x0, y0] = pol(a0, ro), [x1, y1] = pol(a1, ro);
    const [x2, y2] = pol(a1, ri), [x3, y3] = pol(a0, ri);
    const large = (a1 - a0) > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${ro} ${ro} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${ri} ${ri} 0 ${large} 0 ${x3} ${y3} Z`;
  };
  const active = hover != null ? hover : (sel.length ? ids.indexOf(sel[sel.length - 1]) : null);
  const atMax = multi && max && sel.length >= max;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
        {ids.map((id, i) => {
          const t = TAGS[id]; const on = sel.includes(id); const ro = on ? R + 5 : R;
          const blocked = atMax && !on;
          return (
            <path key={id} d={sector(i, ro, r)}
              fill={`oklch(0.7 0.15 ${t.hue} / ${on ? 0.95 : (hover === i ? 0.55 : 0.22)})`}
              stroke={on ? `oklch(0.82 0.14 ${t.hue})` : 'var(--line-soft)'} strokeWidth={on ? 1.5 : 0.8}
              style={{ cursor: blocked ? 'not-allowed' : 'pointer', transition: 'all .22s var(--ease)' }}
              onClick={() => { if (!blocked) onToggle(id); }}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <title>{t.label}</title>
            </path>
          );
        })}
        <text x={cx} y={cy - 3} textAnchor="middle" style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15, fill: 'var(--ink)' }}>
          {active != null ? TAGS[ids[active]].label : (multi ? 'Жанры' : 'Жанр')}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 8.5, fill: 'var(--ink-3)', letterSpacing: '.1em' }}>
          {multi ? (sel.length + (max ? ' / ' + max : '') + ' выбрано') : (sel.length ? 'выбран' : 'выбери сектор')}
        </text>
      </svg>
    </div>
  );
}

/* ---------------- ЛЕНТА ---------------- */
function Feed({ go, user }) {
  const ref = useReveal();
  const { communities } = useCommunities();
  const comName = (id) => (communities.find(c => c.id === id) || {}).name;
  const [filter, setFilter] = useState('all');
  const [following, setFollowing] = useState([]);
  useEffect(() => { let on = true; store.listFollowing().then(f => { if (on) setFollowing(f || []); }); return () => { on = false; }; }, []);
  // фильтрация и пагинация — на сервере (см. useFeed/listPosts)
  const feedFilter = filter === 'all' ? {} : filter === 'following' ? { authors: following } : { kind: filter };
  const { posts, addPost, repostPost, toggleReact, removePost, hasMore, loadMore, loadingMore, loading } = useFeed(feedFilter);
  const onFollow = async (h) => { const r = await store.toggleFollow(h); setFollowing(f => r ? [...new Set([...f, h])] : f.filter(x => x !== h)); };
  const doRepost = (post) => repostPost(post, user && (user.handle || user.name));
  const kinds = [['all', 'Всё'], ['following', 'Подписки'], ['branch', 'Ветви'], ['vote', 'Голоса'], ['discuss', 'Споры'], ['post', 'Записи']];

  return (
    <div className="view wrap" ref={ref} style={{ padding: 'clamp(34px,6vh,64px) 0 100px', maxWidth: 'min(100% - 48px, 760px)' }}>
      <div className="reveal" style={{ marginBottom: 26 }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>Что пишет сообщество прямо сейчас</div>
        <h1 className="display" style={{ fontSize: 'clamp(2.4rem,6vw,4.4rem)' }}>Лента</h1>
      </div>

      <FeedComposer user={user} onPost={addPost} go={go} />

      <div className="reveal" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderTop: 'var(--rule-style)', borderBottom: 'var(--rule-style)', padding: '12px 0', marginBottom: 26 }}>
        {kinds.map(([k, l]) => (
          <button key={k} className="nav-link" data-active={filter === k} onClick={() => setFilter(k)} style={{ fontSize: '.84rem' }}>{l}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {loading
          ? <p className="mono" style={{ color: 'var(--ink-3)', textAlign: 'center', padding: '40px 0' }}>Загрузка…</p>
          : posts.length === 0
            ? <p className="mono" style={{ color: 'var(--ink-3)', textAlign: 'center', padding: '40px 0' }}>{filter === 'following' ? 'Тут появятся посты тех, на кого ты подписан.' : 'Пока тут тихо. Напиши первым.'}</p>
            : posts.map(p => <PostCard key={p.id} post={p} user={user} onReact={toggleReact} onRepost={doRepost} onDelete={removePost} go={go} communityName={comName(p.community)} following={following} onFollow={onFollow} />)}
      </div>
      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button className="btn btn-ghost" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? t('common.loadingMore') : t('common.more')}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---- членство в сообществах через store ---- */
function useCommunities() {
  const [communities, setCommunities] = useState([]);
  const [joined, setJoined] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let on = true;
    store.listCommunities().then(({ communities, joined }) => { if (on) { setCommunities(communities); setJoined(joined); setLoading(false); } });
    return () => { on = false; };
  }, []);

  const create = async (c, owner) => {
    const community = await store.createCommunity(c, owner);
    setCommunities(list => [community, ...list]);
    setJoined(j => [...j, community.id]);
    return community;
  };
  const toggleJoin = async (id) => {
    const isIn = joined.includes(id);
    setJoined(j => isIn ? j.filter(x => x !== id) : [...j, id]); // optimistic
    try { await store.toggleJoin(id); } catch (e) { setJoined(j => isIn ? [...j, id] : j.filter(x => x !== id)); }
  };
  return { communities, joined, loading, create, toggleJoin };
}

/* карточка сообщества в сетке */
function CommunityCard({ c, joined, onToggle, onOpen }) {
  return (
    <div className="reveal story-card card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', textAlign: 'left' }}>
      <button onClick={onOpen} style={{ position: 'relative', height: 96, cursor: 'pointer', textAlign: 'left',
        background: `linear-gradient(135deg, oklch(0.6 0.13 ${c.hue} / .35), oklch(0.5 0.1 ${(c.hue + 40) % 360} / .15))`,
        borderBottom: 'var(--rule-style)' }}>
        <span style={{ position: 'absolute', inset: 0, background: `radial-gradient(60% 80% at 20% 0%, oklch(0.7 0.14 ${c.hue} / .25), transparent 70%)` }} />
        <span className="display" style={{ position: 'absolute', left: 16, bottom: 12, fontSize: '1.5rem' }}>{c.name}</span>
      </button>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        <p style={{ color: 'var(--ink-2)', fontSize: '.9rem', flex: 1 }}>{c.blurb}</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(c.tags || []).map(t => <Tag key={t} id={t} />)}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: 'var(--rule-style)', paddingTop: 12 }}>
          <span className="mono" style={{ fontSize: '.58rem', color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Icon name="users" size={13} />{(c.members + (joined ? 1 : 0)).toLocaleString('ru')}
          </span>
          <button className={'btn btn-sm ' + (joined ? 'btn-ghost' : 'btn-primary')} onClick={onToggle}>
            {joined ? <React.Fragment><Icon name="check" size={13} />Вступил</React.Fragment> : 'Вступить'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- СООБЩЕСТВА (сетка + создание) ---------------- */
function Communities({ go, user }) {
  const ref = useReveal();
  const { communities, joined, create, toggleJoin } = useCommunities();
  const [creating, setCreating] = useState(false);

  return (
    <div className="view wrap" ref={ref} style={{ padding: 'clamp(34px,6vh,64px) 0 100px' }}>
      <div className="reveal" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: 30 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Кружки авторов · {communities.length}</div>
          <h1 className="display" style={{ fontSize: 'clamp(2.4rem,6vw,4.4rem)' }}>Сообщества</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} />Создать сообщество</button>
      </div>

      {creating && <CommunityCreate user={user} onClose={() => setCreating(false)}
        onCreate={async (c) => { try { const made = await create(c, c.owner); setCreating(false); go('community', { communityId: made.id }); } catch (e) { wyrmErr(e, 'Не удалось создать сообщество.'); } }} go={go} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 24 }}>
        {communities.map(c => (
          <CommunityCard key={c.id} c={c} joined={joined.includes(c.id)}
            onToggle={() => toggleJoin(c.id)} onOpen={() => go('community', { communityId: c.id })} />
        ))}
      </div>
    </div>
  );
}

/* форма создания сообщества */
function CommunityCreate({ user, onClose, onCreate, go }) {
  const { TAGS } = window.WYRM;
  const [name, setName] = useState('');
  const [blurb, setBlurb] = useState('');
  const [tags, setTags] = useState([]);
  const [hue, setHue] = useState(28);
  const allTags = Object.keys(TAGS);
  const toggleTag = (t) => setTags(ts => ts.includes(t) ? ts.filter(x => x !== t) : (ts.length < 3 ? [...ts, t] : ts));

  if (!user) {
    return (
      <div className="card" style={{ padding: '22px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 30 }}>
        <span style={{ color: 'var(--ink-2)' }}>Чтобы основать сообщество, нужно войти.</span>
        <button className="btn btn-primary btn-sm" onClick={() => go('landing')}>Войти</button>
      </div>
    );
  }
  return (
    <div className="card framed" style={{ padding: 'clamp(22px,3vw,34px)', marginBottom: 34 }}>
      <div className="eyebrow" style={{ marginBottom: 18 }}>Новое сообщество</div>
      <div className="compose-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label className="mono" style={{ fontSize: '.58rem', color: 'var(--ink-2)', display: 'block', marginBottom: 8, letterSpacing: '.1em' }}>НАЗВАНИЕ</label>
            <input className="compose-input" value={name} onChange={e => setName(e.target.value)} placeholder="Гильдия Пепла" style={{ width: '100%', fontSize: '1.2rem' }} />
          </div>
          <div>
            <label className="mono" style={{ fontSize: '.58rem', color: 'var(--ink-2)', display: 'block', marginBottom: 8, letterSpacing: '.1em' }}>О ЧЁМ</label>
            <textarea className="compose-input" value={blurb} onChange={e => setBlurb(e.target.value)} rows={3} placeholder="Истории, темы, дух сообщества…" style={{ width: '100%', resize: 'vertical' }} />
          </div>
          <div>
            <label className="mono" style={{ fontSize: '.58rem', color: 'var(--ink-2)', display: 'block', marginBottom: 8, letterSpacing: '.1em' }}>КРУГ ЖАНРОВ · до 3</label>
            <GenreWheel selected={tags} onToggle={toggleTag} multi max={3} size={228} />
          </div>
          <div>
            <label className="mono" style={{ fontSize: '.58rem', color: 'var(--ink-2)', display: 'block', marginBottom: 8, letterSpacing: '.1em' }}>ЦВЕТ ОБЛОЖКИ</label>
            <input type="range" min="0" max="340" step="20" value={hue} onChange={e => setHue(+e.target.value)} className="range" style={{ width: '100%' }} />
          </div>
        </div>

        <aside style={{ position: 'sticky', top: 90, alignSelf: 'start' }}>
          <div className="mono" style={{ fontSize: '.54rem', color: 'var(--ink-3)', marginBottom: 10 }}>ПРЕДПРОСМОТР</div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ height: 80, position: 'relative', background: `linear-gradient(135deg, oklch(0.6 0.13 ${hue} / .35), oklch(0.5 0.1 ${(hue + 40) % 360} / .15))`, borderBottom: 'var(--rule-style)' }}>
              <span className="display" style={{ position: 'absolute', left: 14, bottom: 10, fontSize: '1.25rem' }}>{name || 'Без названия'}</span>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <p style={{ color: 'var(--ink-2)', fontSize: '.84rem', minHeight: 40 }}>{blurb || 'Описание появится здесь.'}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>{tags.map(t => <Tag key={t} id={t} />)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Отмена</button>
            <button className="btn btn-primary btn-sm" disabled={!name.trim()} style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => onCreate({ name: name.trim(), blurb: blurb.trim() || 'Новое сообщество авторов.', tags, hue, owner: user.handle || user.name })}>
              Основать
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- СТРАНИЦА СООБЩЕСТВА ---------------- */
function CommunityDetail({ go, ctx, user }) {
  const ref = useReveal();
  const { communities, joined, toggleJoin } = useCommunities();
  // лента сообщества — серверный фильтр по community (масштабируемо)
  const { posts, addPost, repostPost, toggleReact, removePost, hasMore, loadMore, loadingMore, loading: feedLoading } = useFeed({ community: ctx.communityId });
  const doRepost = (post) => repostPost(post, user && (user.handle || user.name));
  const [allStories, setAllStories] = useState(() => (window.WYRM.STORIES || []).slice());
  useEffect(() => { let on = true; store.listStories().then(s => { if (on && s && s.length) setAllStories(s); }); return () => { on = false; }; }, []);
  // без подмены на communities[0]: иначе фильтр ленты (по ctx.communityId) и
  // постинг (по c.id) разойдутся, и юзер запостит не туда
  const c = communities.find(x => x.id === ctx.communityId);
  if (!c) return communities.length ? (
    <div className="view wrap" style={{ padding: '14vh 0', textAlign: 'center' }}>
      <p className="serif-italic" style={{ color: 'var(--ink-2)', marginBottom: 16 }}>Сообщество не найдено.</p>
      <button className="btn btn-ghost" onClick={() => go('communities')}>Все сообщества</button>
    </div>
  ) : null;
  const isJoined = joined.includes(c.id);
  // книги сообщества: из сид-списка ИЛИ с явной связью story.community
  const stories = allStories.filter(s => (c.stories || []).includes(s.id) || s.community === c.id);
  const feed = posts; // отфильтровано сервером по сообществу
  const canManage = user && (user.role === 'moderator' || c.owner === (user.handle || user.name));
  const removeCommunity = async () => { if (confirm('Удалить сообщество?')) { try { await store.deleteCommunity(c.id); go('communities'); } catch (e) { wyrmErr(e, 'Не удалось удалить сообщество.'); } } };

  return (
    <div className="view" ref={ref}>
      {/* баннер */}
      <div style={{ height: 'clamp(160px,26vh,260px)', position: 'relative', borderBottom: 'var(--rule-style)', overflow: 'hidden',
        background: `linear-gradient(135deg, oklch(0.55 0.14 ${c.hue} / .4), oklch(0.45 0.1 ${(c.hue + 40) % 360} / .18))` }}>
        <span style={{ position: 'absolute', inset: 0, background: `radial-gradient(50% 90% at 18% 0%, oklch(0.7 0.15 ${c.hue} / .3), transparent 70%)` }} />
      </div>

      <div className="wrap" style={{ paddingBottom: 100, marginTop: -56, position: 'relative' }}>
        <button className="nav-link" onClick={() => go('communities')} style={{ marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="arrowL" size={14} />Все сообщества
        </button>
        <div className="card framed" style={{ padding: 'clamp(22px,3vw,34px)', marginBottom: 34 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <h1 className="display" style={{ fontSize: 'clamp(2rem,5vw,3.4rem)', marginBottom: 12 }}>{c.name}</h1>
              <p style={{ color: 'var(--ink-2)', maxWidth: '52ch', marginBottom: 16 }}>{c.blurb}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>{(c.tags || []).map(t => <Tag key={t} id={t} />)}</div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {[['Участников', (c.members + (isJoined ? 1 : 0)).toLocaleString('ru')], ['Историй', stories.length], ['Основатель', '@' + c.owner]].map(([k, v]) => (
                  <div key={k}><div className="display" style={{ fontSize: '1.5rem' }}>{v}</div><div className="mono" style={{ fontSize: '.56rem', color: 'var(--ink-3)' }}>{k}</div></div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <button className={'btn ' + (isJoined ? 'btn-ghost' : 'btn-primary')} onClick={() => toggleJoin(c.id)}>
                {isJoined ? <React.Fragment><Icon name="check" size={15} />Вы участник</React.Fragment> : <React.Fragment><Icon name="plus" size={15} />Вступить</React.Fragment>}
              </button>
              {canManage && (
                <button className="mono path-crumb" onClick={removeCommunity} style={{ fontSize: '.56rem', color: 'var(--ink-3)' }}>
                  <Icon name="x" size={12} /> удалить сообщество
                </button>
              )}
            </div>
          </div>
        </div>

        {/* истории сообщества */}
        <section style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, borderTop: 'var(--rule-style)', paddingTop: 18, marginBottom: 16 }}>
              <h2 className="display" style={{ fontSize: '1.6rem' }}>Истории сообщества</h2>
              {user && <button className="btn btn-ghost btn-sm" onClick={() => go('compose', { newBook: true, forkFrom: null, community: c.id })}><Icon name="plus" size={14} />Книга в сообществе</button>}
            </div>
            {stories.length === 0 && <p className="mono" style={{ color: 'var(--ink-3)', marginBottom: 8 }}>Пока нет историй. {user ? 'Создай первую.' : ''}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 20 }}>
              {stories.map(s => (
                <button key={s.id} className="story-card card" onClick={() => go('reader', { story: s.id })} style={{ padding: 16, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h3 className="display" style={{ fontSize: '1.2rem' }}>{s.title}</h3>
                  <span className="mono" style={{ fontSize: '.56rem', color: 'var(--ink-3)' }}>@{s.author}</span>
                  <p style={{ color: 'var(--ink-2)', fontSize: '.86rem' }}>{s.synopsis}</p>
                  <span className="mono" style={{ fontSize: '.56rem', color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 'auto' }}><Icon name="branch" size={12} />{s.branches} ветвей</span>
                </button>
              ))}
            </div>
        </section>

        {/* обсуждения сообщества */}
        <section>
          <h2 className="display" style={{ fontSize: '1.6rem', marginBottom: 16, borderTop: 'var(--rule-style)', paddingTop: 18 }}>Обсуждения</h2>
          <FeedComposer user={user} onPost={(p) => addPost({ ...p, community: c.id })} go={go}
            placeholder={'Написать в «' + c.name + '»…'} defaultKind="discuss" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {feedLoading
              ? <p className="mono" style={{ color: 'var(--ink-3)', textAlign: 'center', padding: '30px 0' }}>{t('common.loading')}</p>
              : feed.length === 0
                ? <p className="mono" style={{ color: 'var(--ink-3)', textAlign: 'center', padding: '30px 0' }}>Будь первым, кто начнёт разговор здесь.</p>
                : feed.map(p => <PostCard key={p.id} post={p} user={user} onReact={toggleReact} onRepost={doRepost} onDelete={removePost} go={go} />)}
          </div>
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={loadMore} disabled={loadingMore}>{loadingMore ? t('common.loadingMore') : t('common.more')}</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ---------------- ПРОФИЛЬ ---------------- */
function Profile({ go, user }) {
  const ref = useReveal();
  // мои посты — серверный фильтр по автору (масштабируемо); без логина — пусто
  const myHandle = user ? (user.handle || user.name) : '';
  const { posts, toggleReact, repostPost, removePost, hasMore, loadMore, loadingMore, loading: feedLoading } = useFeed(user ? { authorHandle: myHandle } : { authors: [] });
  const { communities, joined } = useCommunities();
  const [stories, setStories] = useState([]);
  const [tab, setTab] = useState('books');
  const [avatarUrl, setAvatarUrl] = useState((user && user.avatar) || null);
  const onAvatar = async (file) => { if (!file) return; try { const url = await store.updateAvatar(file); setAvatarUrl(url); } catch (e) { wyrmErr(e, 'Не удалось загрузить аватар.'); } };
  useEffect(() => { let on = true; store.listStories().then(s => { if (on) setStories(s || []); }); return () => { on = false; }; }, []);
  if (!user) {
    return (
      <div className="view wrap" style={{ padding: 'clamp(40px,8vh,90px) 0 90px', textAlign: 'center' }}>
        <h1 className="display" style={{ fontSize: 'clamp(2rem,5vw,3rem)', marginBottom: 16 }}>Профиль</h1>
        <p className="serif-italic" style={{ color: 'var(--ink-2)', marginBottom: 24 }}>Войди, чтобы увидеть свои книги, посты и сообщества.</p>
        <button className="btn btn-primary" onClick={() => go('landing')}>На главную</button>
      </div>
    );
  }
  const handle = user.handle || user.name;
  const myStories = stories.filter(s => s.author === handle);
  const myPosts = posts; // отфильтровано сервером по автору
  const myCommunities = communities.filter(c => joined.includes(c.id));
  const doRepost = (post) => repostPost(post, handle);
  const stat = (n, l) => (<div><div className="display" style={{ fontSize: '1.6rem' }}>{n}</div><div className="mono" style={{ fontSize: '.56rem', color: 'var(--ink-3)' }}>{l}</div></div>);
  const tabs = [['books', 'Книги · ' + myStories.length], ['posts', 'Посты · ' + myPosts.length], ['communities', 'Сообщества · ' + myCommunities.length]];

  return (
    <div className="view wrap" ref={ref} style={{ padding: 'clamp(34px,6vh,64px) 0 100px' }}>
      <div className="reveal card framed" style={{ padding: 'clamp(22px,3vw,34px)', marginBottom: 30, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <label title="Сменить аватар" style={{ cursor: 'pointer', position: 'relative', display: 'inline-flex', flex: '0 0 auto' }}>
          {avatarUrl
            ? <img src={avatarUrl} alt="аватар" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
            : <Avatar name={handle} size={72} />}
          <span style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', border: '2px solid var(--bg-2)' }}><Icon name="eye" size={12} /></span>
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => onAvatar(e.target.files[0])} />
        </label>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="display" style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)' }}>{user.name || handle}</h1>
            {user.role === 'moderator' && <span className="tag" data-active="true" style={{ background: 'var(--gold)', color: 'var(--accent-ink)' }}>модератор</span>}
          </div>
          <div className="mono" style={{ fontSize: '.6rem', color: 'var(--ink-3)', marginTop: 4 }}>@{handle}</div>
        </div>
        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
          {stat(user.reputation || 0, 'репутация')}
          {stat(myStories.length, 'книг')}
          {stat(myPosts.length, 'постов')}
        </div>
      </div>

      <div className="reveal" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: 'var(--rule-style)', paddingBottom: 12, marginBottom: 26 }}>
        {tabs.map(([k, l]) => <button key={k} className="nav-link" data-active={tab === k} onClick={() => setTab(k)} style={{ fontSize: '.84rem' }}>{l}</button>)}
      </div>

      {tab === 'books' && (
        myStories.length === 0
          ? <p className="mono" style={{ color: 'var(--ink-3)' }}>Ты ещё не написал ни одной книги. <button className="path-crumb" style={{ color: 'var(--accent)' }} onClick={() => go('compose', { newBook: true, forkFrom: null })}>Начать книгу →</button></p>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 20 }}>
              {myStories.map(s => (
                <button key={s.id} className="story-card card" onClick={() => go('reader', { story: s.id })} style={{ padding: 16, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h3 className="display" style={{ fontSize: '1.2rem' }}>{s.title}</h3>
                  <p style={{ color: 'var(--ink-2)', fontSize: '.86rem' }}>{s.synopsis}</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(s.tags || []).map(t => <Tag key={t} id={t} />)}</div>
                </button>
              ))}
            </div>
      )}
      {tab === 'posts' && (
        feedLoading
          ? <p className="mono" style={{ color: 'var(--ink-3)' }}>{t('common.loading')}</p>
          : myPosts.length === 0
          ? <p className="mono" style={{ color: 'var(--ink-3)' }}>Постов пока нет.</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 720 }}>
              {myPosts.map(p => <PostCard key={p.id} post={p} user={user} onReact={toggleReact} onRepost={doRepost} onDelete={removePost} go={go} />)}
              {hasMore && <div style={{ textAlign: 'center', marginTop: 6 }}><button className="btn btn-ghost" onClick={loadMore} disabled={loadingMore}>{loadingMore ? t('common.loadingMore') : t('common.more')}</button></div>}
            </div>
      )}
      {tab === 'communities' && (
        myCommunities.length === 0
          ? <p className="mono" style={{ color: 'var(--ink-3)' }}>Ты пока не вступил ни в одно сообщество. <button className="path-crumb" style={{ color: 'var(--accent)' }} onClick={() => go('communities')}>Найти →</button></p>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 }}>
              {myCommunities.map(c => (
                <button key={c.id} className="story-card card" onClick={() => go('community', { communityId: c.id })} style={{ padding: 16, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h3 className="display" style={{ fontSize: '1.15rem' }}>{c.name}</h3>
                  <p style={{ color: 'var(--ink-2)', fontSize: '.84rem' }}>{c.blurb}</p>
                </button>
              ))}
            </div>
      )}
    </div>
  );
}

Object.assign(window, { Feed, Communities, CommunityDetail, CommunityCreate, GenreWheel, RichEditor, htmlToText, Profile });

/* ╔══ 14 · App shell ══╗ */
/* ============================================================
   WYRM — App shell: routing, theme-worlds, customization
   ============================================================ */

const ACCENTS = [
  { id: 'theme',  label: 'По теме', dot: 'var(--accent-default)', accent: null, gold: null },
  { id: 'jade',   label: 'Нефрит',  dot: 'oklch(0.74 0.13 168)', accent: 'oklch(0.74 0.13 168)', gold: 'oklch(0.82 0.13 86)' },
  { id: 'ember',  label: 'Уголь',   dot: 'oklch(0.64 0.19 35)',  accent: 'oklch(0.64 0.19 35)',  gold: 'oklch(0.80 0.13 70)' },
  { id: 'indigo', label: 'Индиго',  dot: 'oklch(0.60 0.16 270)', accent: 'oklch(0.62 0.15 272)', gold: 'oklch(0.78 0.12 300)' },
  { id: 'gold',   label: 'Золото',  dot: 'oklch(0.78 0.13 86)',  accent: 'oklch(0.76 0.13 86)',  gold: 'oklch(0.82 0.10 60)' },
];
const FONTS = [
  { id: 'onest',    label: 'Onest',    stack: "'Onest', sans-serif" },
  { id: 'lora',     label: 'Lora',     stack: "'Lora', Georgia, serif" },
  { id: 'jetbrains', label: 'JetBrains', stack: "'JetBrains Mono', monospace" },
];

function loadCfg() {
  try { return JSON.parse(localStorage.getItem('wyrm.cfg')) || {}; } catch (e) { return {}; }
}
function loadUser() {
  try { return JSON.parse(localStorage.getItem('wyrm.user')) || null; } catch (e) { return null; }
}

function App() {
  const [route, setRoute] = useState('landing');
  const [ctx, setCtx] = useState({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const saved = useRef(loadCfg()).current;
  const [theme, setTheme] = useState(saved.theme || 'manuscript');
  const [accent, setAccent] = useState(saved.accent || 'theme');
  const [font, setFont] = useState(saved.font || 'onest');
  const [scale, setScale] = useState(saved.scale || 100);
  const [atmos, setAtmos] = useState(saved.atmos !== false);
  const [plugins, setPlugins] = useState(saved.plugins || { embers: true, progress: true, wordhud: false, dice: false, zen: false });
  const [customs, setCustoms] = useState(saved.customs || []);
  const togglePlugin = (id) => setPlugins(p => ({ ...p, [id]: !p[id] }));
  const addCustom = (mf) => { setCustoms(c => [...c, mf]); setPlugins(p => ({ ...p, [mf.id]: true })); };

  // ---- auth + intro ----
  const savedUser = useRef(loadUser()).current;
  const [user, setUser] = useState(savedUser);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [showIntro, setShowIntro] = useState(() => {
    try { return !localStorage.getItem('wyrm.introSeen') && !savedUser; } catch (e) { return false; }
  });
  useEffect(() => {
    if (user) localStorage.setItem('wyrm.user', JSON.stringify(user));
    else localStorage.removeItem('wyrm.user');
  }, [user]);
  // Restore an existing session (real Supabase session, or the cached user).
  useEffect(() => { store.currentUser().then(u => { if (u) setUser(u); }); }, []);
  const finishIntro = () => { try { localStorage.setItem('wyrm.introSeen', '1'); } catch (e) {} setShowIntro(false); };
  const doAuth = (u) => { setUser(u); setAuthOpen(false); };
  const openAuth = (mode) => { setAuthMode(mode || 'login'); setAuthOpen(true); };

  // apply + persist
  useEffect(() => {
    const r = document.documentElement;
    r.dataset.theme = theme;
    const a = ACCENTS.find(x => x.id === accent) || ACCENTS[0];
    if (a.accent) { r.style.setProperty('--accent', a.accent); r.style.setProperty('--gold', a.gold); }
    else { r.style.removeProperty('--accent'); r.style.removeProperty('--gold'); }
    r.style.setProperty('--display', (FONTS.find(f => f.id === font) || FONTS[0]).stack);
    r.style.fontSize = (16 * scale / 100) + 'px';
    localStorage.setItem('wyrm.cfg', JSON.stringify({ theme, accent, font, scale, atmos, plugins, customs }));
  }, [theme, accent, font, scale, atmos, plugins, customs]);

  const go = (r, payload) => { if (payload) setCtx(c => ({ ...c, ...payload })); setRoute(r); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const NAV = [['landing', 'Главная'], ['feed', 'Лента'], ['catalog', 'Каталог'], ['communities', 'Сообщества'], ['reader', 'Древо']];
  const STUDIO = [
    ['merge', '01 · Слияние', 'branch'],
    ['lore', '02 · Кодекс мира', 'eye'],
    ['stakes', '03 · Канон-ставки', 'star'],
    ['room', '04 · Комната авторов', 'users'],
    ['cut', '05 · Сборка читателя', 'fork'],
  ];
  const studioRoutes = STUDIO.map(s => s[0]);
  const enabledPlugins = Object.values(plugins).filter(Boolean).length;

  return (
    <React.Fragment>
      <div className="atmos" style={{ opacity: atmos ? 1 : 0 }} />

      <header className="nav wrap" style={{ width: 'min(100% - 48px, var(--maxw))' }}>
        <div className="brand" onClick={() => go('landing')}>
          <span className="logo"><span className="w">W</span>YRM</span>
          <span className="tld">сотвори историю вместе</span>
        </div>
        <button className="icon-btn nav-burger" title="Меню" aria-label="Меню" onClick={() => setMenuOpen(o => !o)}>
          <Icon name={menuOpen ? 'x' : 'menu'} size={20} />
        </button>
        <nav className="nav-links">
          {NAV.map(([r, l]) => <button key={r} className="nav-link" data-active={route === r} onClick={() => go(r, r === 'reader' ? { story: 'ashes', node: null } : undefined)}>{l}</button>)}
          <StudioMenu items={STUDIO} route={route} go={go} active={studioRoutes.includes(route)} />
          <button className="nav-link" data-active={route === 'compose'} onClick={() => go('compose')}>Писать</button>
          <span style={{ width: 1, height: 22, background: 'var(--line)', margin: '0 6px' }} />
          <button className="icon-btn" title="Расширения" onClick={() => go('plugins')} style={{ position: 'relative' }}>
            <Icon name="blocks" size={17} />
            {enabledPlugins > 0 && <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 9, background: 'var(--accent)', color: 'var(--accent-ink)', fontSize: 9, fontFamily: 'var(--mono)', display: 'grid', placeItems: 'center' }}>{enabledPlugins}</span>}
          </button>
          <button className="icon-btn" title="Сменить мир" onClick={() => setTheme(t => t === 'night' ? 'manuscript' : 'night')}>
            <Icon name={theme === 'night' ? 'moon' : 'sun'} size={17} />
          </button>
          <button className="icon-btn" title="Настройки" onClick={() => setSettingsOpen(true)}><Icon name="sliders" size={17} /></button>
          {user && <NotificationsMenu user={user} />}
          {user
            ? <AccountMenu user={user} onLogout={async () => { await store.signOut(); setUser(null); }} go={go} />
            : <button className="btn btn-primary btn-sm" onClick={() => openAuth('login')}>Войти</button>}
        </nav>
      </header>

      {/* мобильное меню */}
      <div className="mobile-menu" data-open={menuOpen} onClick={() => setMenuOpen(false)}>
        <div className="mobile-menu-panel" onClick={e => e.stopPropagation()}>
          {[...NAV, ['compose', 'Писать']].map(([r, l]) => (
            <button key={r} className="mobile-link" data-active={route === r}
              onClick={() => { go(r, r === 'reader' ? { story: 'ashes', node: null } : undefined); setMenuOpen(false); }}>{l}</button>
          ))}
          <div className="mobile-menu-label">Студия</div>
          {STUDIO.map(([r, l, ic]) => (
            <button key={r} className="mobile-link" data-active={route === r} onClick={() => { go(r); setMenuOpen(false); }}>
              <Icon name={ic} size={15} />{l}
            </button>
          ))}
          <div className="mobile-menu-label">Ещё</div>
          <button className="mobile-link" onClick={() => { go('plugins'); setMenuOpen(false); }}><Icon name="blocks" size={15} />Расширения{enabledPlugins > 0 ? ' · ' + enabledPlugins : ''}</button>
          <button className="mobile-link" onClick={() => { setTheme(t => t === 'night' ? 'manuscript' : 'night'); }}><Icon name={theme === 'night' ? 'moon' : 'sun'} size={15} />Сменить мир</button>
          <button className="mobile-link" onClick={() => { setSettingsOpen(true); setMenuOpen(false); }}><Icon name="sliders" size={15} />Настройки</button>
          {user
            ? <React.Fragment>
                <div className="mobile-menu-label">@{user.handle}</div>
                <button className="mobile-link" onClick={() => { go('profile'); setMenuOpen(false); }}><Icon name="users" size={15} />Профиль</button>
                <button className="mobile-link" onClick={() => { go('compose'); setMenuOpen(false); }}><Icon name="quill" size={15} />Мои ветки</button>
                <button className="mobile-link" onClick={async () => { await store.signOut(); setUser(null); setMenuOpen(false); }}><Icon name="arrowL" size={15} />Выйти</button>
              </React.Fragment>
            : <button className="btn btn-primary" style={{ margin: '12px 0 4px', justifyContent: 'center' }} onClick={() => { openAuth('login'); setMenuOpen(false); }}>Войти</button>}
        </div>
      </div>

      {showIntro && <IntroFilm onDone={finishIntro} onAuth={() => { finishIntro(); openAuth('register'); }} />}
      <AuthModal open={authOpen} mode={authMode} setMode={setAuthMode} onClose={() => setAuthOpen(false)} onAuth={doAuth} />

      <PluginHost state={plugins} customs={customs} go={go} />

      <main>
        {route === 'landing' && <Landing go={go} />}
        {route === 'catalog' && <Catalog go={go} />}
        {route === 'reader' && <Reader go={go} ctx={ctx} setCtx={setCtx} />}
        {route === 'compose' && <Compose go={go} ctx={ctx} setCtx={setCtx} />}
        {route === 'merge' && <Merge go={go} />}
        {route === 'lore' && <LoreGraph go={go} />}
        {route === 'stakes' && <Stakes go={go} />}
        {route === 'room' && <WritersRoom go={go} />}
        {route === 'cut' && <ReadersCut go={go} />}
        {route === 'plugins' && <PluginsScreen state={plugins} toggle={togglePlugin} customs={customs} addCustom={addCustom} go={go} />}
        {route === 'feed' && <Feed go={go} user={user} />}
        {route === 'communities' && <Communities go={go} user={user} />}
        {route === 'community' && <CommunityDetail go={go} ctx={ctx} user={user} />}
        {route === 'profile' && <Profile go={go} user={user} />}
      </main>

      <footer className="wrap" style={{ borderTop: 'var(--rule-style)', padding: '40px 0 56px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 18, position: 'relative', zIndex: 1 }}>
        <div className="brand"><span className="logo" style={{ fontSize: '1.2rem' }}><span className="w">W</span>YRM</span></div>
        <p className="mono" style={{ fontSize: '.56rem', color: 'var(--ink-3)', maxWidth: '36ch' }}>Площадка коллективного повествования. Каждая история живёт, пока её пишут.</p>
        <div className="mono" style={{ fontSize: '.56rem', color: 'var(--ink-3)' }}>{theme === 'night' ? 'мир · Ночь' : 'мир · Манускрипт'}</div>
      </footer>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)}
        {...{ theme, setTheme, accent, setAccent, font, setFont, scale, setScale, atmos, setAtmos }}
        plugins={plugins} togglePlugin={togglePlugin} enabledPlugins={enabledPlugins}
        openStore={() => { setSettingsOpen(false); go('plugins'); }}
        replayIntro={() => { setSettingsOpen(false); setShowIntro(true); }} />
    </React.Fragment>
  );
}

/* ---------------- SETTINGS DRAWER (full customization) ---------------- */
function SettingsDrawer({ open, onClose, theme, setTheme, accent, setAccent, font, setFont, scale, setScale, atmos, setAtmos, plugins, togglePlugin, enabledPlugins, openStore, replayIntro }) {
  const quick = ['embers', 'progress', 'wordhud', 'dice', 'zen'];
  const byId = Object.fromEntries(PLUGIN_REGISTRY.map(p => [p.id, p]));
  return (
    <React.Fragment>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / .5)', backdropFilter: 'blur(2px)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity .4s', zIndex: 60 }} />
      <aside style={{
        position: 'fixed', top: 0, right: 0, height: '100%', width: 'min(380px, 92vw)', zIndex: 61,
        background: 'var(--bg-2)', borderLeft: 'var(--rule-style)', boxShadow: 'var(--shadow-card)',
        transform: open ? 'none' : 'translateX(102%)', transition: 'transform .45s var(--ease)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 24px', borderBottom: 'var(--rule-style)', position: 'sticky', top: 0, background: 'var(--bg-2)', zIndex: 1 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Кастомизация</div>
            <h2 className="display" style={{ fontSize: '1.5rem' }}>Настройки мира</h2>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* theme world */}
          <Field label="Мир оформления" hint="Две темы — два разных характера, не просто цвет">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[['night', 'Ночь', 'moon', 'Обсидиан · свечение углей'], ['manuscript', 'Манускрипт', 'sun', 'Пергамент · чернила']].map(([k, l, ic, d]) => (
                <button key={k} onClick={() => setTheme(k)} className="swatch-tile" data-active={theme === k}>
                  <Icon name={ic} size={18} />
                  <span className="display" style={{ fontSize: '.95rem', marginTop: 8 }}>{l}</span>
                  <span className="mono" style={{ fontSize: '.46rem', color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.3 }}>{d}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Акцентный цвет">
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              {ACCENTS.map(a => (
                <button key={a.id} onClick={() => setAccent(a.id)} title={a.label}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 30, height: 30, borderRadius: '50%', background: a.dot, boxShadow: accent === a.id ? '0 0 0 2px var(--bg-2), 0 0 0 4px var(--ink)' : '0 0 0 1px var(--line)', transition: '.2s' }} />
                  <span className="mono" style={{ fontSize: '.46rem', color: accent === a.id ? 'var(--ink)' : 'var(--ink-3)' }}>{a.label}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Шрифт заголовков">
            <div style={{ display: 'flex', gap: 8 }}>
              {FONTS.map(f => (
                <button key={f.id} onClick={() => setFont(f.id)} className="swatch-tile" data-active={font === f.id} style={{ flex: 1 }}>
                  <span style={{ fontFamily: f.stack, fontSize: '1.3rem', fontWeight: 700 }}>Wy</span>
                  <span className="mono" style={{ fontSize: '.46rem', color: 'var(--ink-3)', marginTop: 4 }}>{f.label}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Масштаб интерфейса" hint={scale + '%'}>
            <input type="range" min="85" max="120" step="5" value={scale} onChange={e => setScale(+e.target.value)} className="range" style={{ width: '100%' }} />
          </Field>

          <Field label="Атмосфера" hint="Зерно и свечение фона">
            <button onClick={() => setAtmos(a => !a)} className="toggle" data-on={atmos}>
              <span className="toggle-knob" />
              <span className="mono" style={{ fontSize: '.56rem', color: 'var(--ink-2)' }}>{atmos ? 'Включена' : 'Выключена'}</span>
            </button>
          </Field>

          <Field label="Расширения сообщества" hint={enabledPlugins + ' вкл.'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 }}>
              {quick.map(id => {
                const p = byId[id]; const on = !!plugins[id];
                return (
                  <button key={id} onClick={() => togglePlugin(id)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderTop: 'var(--rule-style)', textAlign: 'left' }}>
                    <span style={{ width: 30, height: 30, borderRadius: 7, flex: '0 0 auto', display: 'grid', placeItems: 'center', background: 'var(--bg-3)', border: '1px solid var(--line)', color: on ? 'var(--accent)' : 'var(--ink-3)', fontSize: 15 }}>{p.glyph}</span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontSize: '.86rem', fontWeight: 600 }}>{p.name}</span>
                      <span className="mono" style={{ fontSize: '.46rem', color: 'var(--ink-3)' }}>@{p.author}</span>
                    </span>
                    <span className="toggle" data-on={on} style={{ padding: 3, pointerEvents: 'none' }}><span className="toggle-knob" /></span>
                  </button>
                );
              })}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={openStore} style={{ width: '100%', justifyContent: 'center' }}>
              <Icon name="blocks" size={14} />Магазин и конструктор расширений
            </button>
          </Field>

          <Field label="Заставка" hint="кинематографичное интро">
            <button className="btn btn-ghost btn-sm" onClick={replayIntro} style={{ width: '100%', justifyContent: 'center' }}>
              <Icon name="flame" size={14} />Смотреть заставку заново
            </button>
          </Field>

          <p className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)', lineHeight: 1.5, borderTop: 'var(--rule-style)', paddingTop: 16 }}>
            Настройки сохраняются на этом устройстве. Каждый мир несёт свою палитру, текстуру и оформление карточек.
          </p>
        </div>
      </aside>
    </React.Fragment>
  );
}

function StudioMenu({ items, route, go, active }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', h);
    return () => document.removeEventListener('pointerdown', h);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="nav-link" data-active={active} onClick={() => setOpen(o => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        Студия<span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.2s', display: 'inline-flex' }}><Icon name="arrow" size={12} stroke={2} /></span>
      </button>
      <div className="studio-pop" data-open={open}>
        <div className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)', padding: '4px 12px 8px' }}>5 механик, которые берут рынок</div>
        {items.map(([r, l, ic]) => (
          <button key={r} className="studio-item" data-active={route === r} onClick={() => { go(r); setOpen(false); }}>
            <Icon name={ic} size={15} /><span>{l}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <span className="mono" style={{ fontSize: '.58rem', color: 'var(--ink)', letterSpacing: '.1em' }}>{label}</span>
        {hint && <span className="mono" style={{ fontSize: '.5rem', color: 'var(--ink-3)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// Граница ошибок: рендер-исключение в одном экране иначе размонтирует ВСЁ
// дерево (бел. экран) — приложение однокомпонентное. Ловим и показываем фолбэк.
class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { try { console.error('[WYRM] render error:', err, info); } catch (e) {} }
  render() {
    if (this.state.err) {
      return (
        <div className="view wrap" style={{ padding: '14vh 0', textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
          <div style={{ color: 'var(--gold)' }}><Icon name="flame" size={30} /></div>
          <h1 className="display" style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', margin: '14px 0 12px' }}>Что-то сломалось</h1>
          <p className="serif-italic" style={{ color: 'var(--ink-2)', marginBottom: 22 }}>Экран не отрисовался — это сбой интерфейса, твои данные на месте.</p>
          <button className="btn btn-primary" onClick={() => { try { location.reload(); } catch (e) { this.setState({ err: null }); } }}>Перезагрузить</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Cache the root on window so HMR re-runs reuse it instead of calling
// createRoot twice on the same container (dev-only warning otherwise).
const _wyrmRoot = (window.__wyrmRoot ||= ReactDOM.createRoot(document.getElementById('root')));
_wyrmRoot.render(<ErrorBoundary><App /></ErrorBoundary>);

