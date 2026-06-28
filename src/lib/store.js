/* ============================================================
   WYRM — единый слой данных (store)

   Один интерфейс для авторизации и всей социальной механики
   (посты, лайки, репосты, комментарии, сообщества, членство).

   • Если задан VITE_PB_URL — работает на твоём сервере PocketBase
     (данные общие для всех, настоящая регистрация). PocketBase можно
     поднять на РФ-VPS, поэтому решение совместимо с 152-ФЗ.
   • Иначе — прозрачный фолбэк на localStorage этого браузера,
     чтобы приложение работало как демо без бэкенда.

   Все методы асинхронные (возвращают Promise) — интерфейс одинаков
   в обоих режимах. Смена бэкенда не затрагивает остальной код.
   ============================================================ */

// guard: под Vite import.meta.env — объект; под голым node (юнит-тесты) — undefined.
const PB_URL = (import.meta.env ? import.meta.env.VITE_PB_URL : '') || '';
export const enabled = !!PB_URL;

let _pb = null;
async function pbClient() {
  if (!enabled) return null;
  if (!_pb) {
    const { default: PocketBase } = await import('pocketbase');
    _pb = new PocketBase(PB_URL);
  }
  return _pb;
}
// id текущего пользователя (SDK 0.21 → model, 0.22+ → record)
const authRecord = (pb) => pb.authStore.record || pb.authStore.model || null;

/* ---------- localStorage helpers (демо-режим) ---------- */
const load = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? f : v; } catch (e) { return f; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const uid = (p) => p + Date.now().toString(36) + Math.floor(performance.now() % 1000).toString(36);

/* ---------- seed data (демо + первый запуск) ---------- */
export const FEED_SEED = [
  { id: 'f1', author: 'grimwarden', kind: 'branch', ago: 22, community: 'ashes-guild',
    text: 'Открыл ветвь «Корона из костей»: а что, если Кейра не простит Аркадию? Город заслужил огонь — и я дал его городу полной мерой.',
    ref: { story: 'ashes', storyTitle: 'Пепел Аркадии', node: 'B1' }, tags: ['horror', 'politics'], reacts: { flame: 34, star: 11 } },
  { id: 'f2', author: 'mara.q', kind: 'vote', ago: 64, community: 'ashes-guild',
    text: 'Голосую за «Цитадель молчания» в канон. Сцена, где Архонт называет цену — лучшее, что случилось с этим древом.',
    ref: { story: 'ashes', storyTitle: 'Пепел Аркадии', node: 'A1a' }, tags: ['redemption'], reacts: { flame: 51, star: 28 } },
  { id: 'f3', author: 'lune_v', kind: 'post', ago: 140, community: 'soft-endings',
    text: 'В «Стеклянном саду» добавила оранжерею воспоминаний бабушки. Каждый цветок — чужая жизнь, и один из них наконец зацвёл.',
    ref: { story: 'glass', storyTitle: 'Стеклянный сад', node: null }, tags: ['slow-burn', 'tragedy'], reacts: { flame: 19, star: 7 } },
  { id: 'f4', author: 'cogsmith', kind: 'discuss', ago: 300, community: 'machine-gods',
    text: 'Спор недели: если боги — инженеры, то молитва это запрос на обслуживание? Накидайте аргументов, готовлю главу-диспут.',
    ref: { story: 'gears', storyTitle: 'Шестерни Вавилона', node: null }, tags: ['politics'], reacts: { flame: 42, star: 9 } },
  { id: 'f5', author: 'jest_r', kind: 'branch', ago: 600, community: null,
    text: 'Гильдия неудачников снова спасла мир. Случайно. Ветвь, где они даже не заметили, что это сделали — самая смешная из всех.',
    ref: { story: 'comedy', storyTitle: 'Гильдия неудачников', node: null }, tags: ['comedy', 'happy-end'], reacts: { flame: 88, star: 40 } },
  { id: 'f6', author: 'tide.witch', kind: 'post', ago: 1440, community: 'salt-circle',
    text: 'Деревня вытащила из сетей не рыбу, а спящее божество. Кто хочет писать пробуждение — оставляю развилку открытой.',
    ref: { story: 'salt', storyTitle: 'Соль и пророчество', node: null }, tags: ['horror', 'dark-fantasy'], reacts: { flame: 27, star: 15 } },
];

export const COMMUNITIES_SEED = [
  { id: 'ashes-guild', name: 'Гильдия Пепла', blurb: 'Канон и ереси «Пепла Аркадии». Спорим о судьбе Кейры до хрипоты и плетём ветви до рассвета.', tags: ['dark-fantasy', 'war'], members: 312, stories: ['ashes'], hue: 28, owner: 'eira_noct' },
  { id: 'soft-endings', name: 'Тихие финалы', blurb: 'Для тех, кто верит в счастливый конец даже для драконов. Медленно, тепло, без лишней крови.', tags: ['happy-end', 'romance', 'slow-burn'], members: 148, stories: ['glass', 'comedy'], hue: 150, owner: 'lune_v' },
  { id: 'machine-gods', name: 'Боги-инженеры', blurb: 'Стимпанк, политика и теология машин. Вселенные «Шестерней Вавилона» и «Тысячи корон».', tags: ['politics', 'war'], members: 97, stories: ['gears', 'crown'], hue: 240, owner: 'cogsmith' },
  { id: 'salt-circle', name: 'Соляной круг', blurb: 'Морской хоррор и пробуждённые божества. Не читать в одиночестве после полуночи.', tags: ['horror', 'dark-fantasy'], members: 64, stories: ['salt'], hue: 200, owner: 'tide.witch' },
];

/* маппинг записи PocketBase → форма приложения */
const mapPost = (p, liked, saved) => ({
  id: p.id, author: p.author_handle, kind: p.kind, text: p.text, tags: p.tags || [],
  ref: p.ref || null, community: p.community || null, ts: Date.parse(p.created) || Date.now(),
  repostOf: p.repost_of || null,
  likeCount: p.like_count || 0, saveCount: p.save_count || 0,
  commentCount: p.comment_count || 0, repostCount: p.repost_count || 0,
  likedByMe: liked ? liked.has(p.id) : false, savedByMe: saved ? saved.has(p.id) : false,
});

/* ============================================================
   AUTH
   ============================================================ */
export async function currentUser() {
  if (enabled) {
    const pb = await pbClient();
    if (!pb.authStore.isValid) return null;
    const r = authRecord(pb); if (!r) return null;
    const handle = r.handle || (r.email || 'автор').split('@')[0];
    const avatar = r.avatar ? `${PB_URL}/api/files/users/${r.id}/${r.avatar}` : null;
    return { id: r.id, email: r.email, name: r.name || handle, handle, role: r.role || 'user', reputation: r.reputation || 0, verified: !!r.verified, avatar };
  }
  const u = load('wyrm.user', null);
  return u ? { role: 'user', reputation: 0, ...u } : null;
}
export async function signUp(email, password, name) {
  const handle = (name || email.split('@')[0]).toLowerCase().replace(/[^a-zа-я0-9]+/gi, '_');
  if (enabled) {
    const pb = await pbClient();
    await pb.collection('users').create({ email, password, passwordConfirm: password, name: name || handle, handle });
    await pb.collection('users').authWithPassword(email, password);
    return (await currentUser()) || { name: name || handle, email, handle };
  }
  const u = { name: name || handle, email, handle, role: demoRole(email), reputation: 0 }; save('wyrm.user', u); return u;
}
export async function signIn(email, password) {
  if (enabled) {
    const pb = await pbClient();
    await pb.collection('users').authWithPassword(email, password);
    return await currentUser();
  }
  const handle = email.split('@')[0].toLowerCase().replace(/[^a-zа-я0-9]+/gi, '_');
  const u = { name: handle, email, handle, role: demoRole(email), reputation: 0 }; save('wyrm.user', u); return u;
}
// OAuth — ТОЛЬКО разрешённые в РФ провайдеры (149-ФЗ): Яндекс ID, VK ID и
// OIDC-слоты под банковские ID (Сбер / Тинькофф / ВТБ / Альфа). Иностранные
// (Google / Apple / Facebook / GitHub / Microsoft / …) запрещены и не
// допускаются ни в список, ни в сам вход — даже если кто-то по ошибке включит
// такого провайдера в админке PocketBase, клиент его не покажет и не вызовет.
export const ALLOWED_OAUTH = new Set(['yandex', 'vk', 'oidc', 'oidc2', 'oidc3']);
export const OAUTH_LABEL = { yandex: 'Яндекс ID', vk: 'VK ID', oidc: 'Войти', oidc2: 'Войти', oidc3: 'Войти' };

// Провайдеры, реально включённые на сервере, отфильтрованные по allow-list.
export async function listOAuthProviders() {
  if (!enabled) return [];
  try {
    const pb = await pbClient();
    const m = await pb.collection('users').listAuthMethods();
    const provs = (m && (m.authProviders || (m.oauth2 && m.oauth2.providers))) || [];
    return provs.map(p => p.name).filter(n => ALLOWED_OAUTH.has(n));
  } catch (_) { return []; }
}

export async function signInOAuth(provider) {
  if (!enabled) throw new Error('Соцвход доступен только с подключённым сервером.');
  if (!ALLOWED_OAUTH.has(provider)) throw new Error('Этот способ входа недоступен.');
  const pb = await pbClient();
  // OAuth-провайдер не отдаёт наши обязательные поля (handle/role). PocketBase
  // мёржит createData в новую запись ДО валидации — поэтому передаём их здесь
  // (handle — временный уникальный; ниже пробуем заменить на красивый из почты).
  const rand = Math.random().toString(36).slice(2, 8);
  const createData = { role: 'user', handle: 'author_' + rand, reputation: 0 };
  await pb.collection('users').authWithOAuth2({ provider, createData });
  // best-effort: если завели нового OAuth-юзера с временным @handle — выводим
  // аккуратный из локальной части почты (если он свободен; иначе оставляем).
  try {
    const r = authRecord(pb);
    if (r && /^author_[a-z0-9]{6}$/.test(r.handle || '')) {
      const base = ((r.email || '').split('@')[0] || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
      if (base && base !== r.handle) await pb.collection('users').update(r.id, { handle: base });
    }
  } catch (_) { /* handle занят или нет прав — оставляем временный */ }
  return await currentUser();
}

// Восстановление пароля / повторное письмо верификации (нужен SMTP на сервере).
export async function requestPasswordReset(email) {
  if (!enabled) throw new Error('Восстановление пароля доступно только с подключённым сервером (SMTP).');
  const pb = await pbClient();
  await pb.collection('users').requestPasswordReset(email);
  return true;
}
export async function requestVerification(email) {
  if (!enabled) throw new Error('Подтверждение почты доступно только с подключённым сервером (SMTP).');
  const pb = await pbClient();
  await pb.collection('users').requestVerification(email);
  return true;
}

// демо: чтобы можно было протестировать модерацию — почта вида mod@… делает модератором
function demoRole(email) { return /^mod(erator)?@/i.test(email || '') ? 'moderator' : 'user'; }
export async function signOut() {
  if (enabled) { const pb = await pbClient(); pb.authStore.clear(); }
  localStorage.removeItem('wyrm.user');
}

/* ============================================================
   FEED — посты, лайки, репосты, комментарии
   ============================================================ */
function localPosts() {
  const seeded = FEED_SEED.map(p => ({ ...p, ts: Date.now() - p.ago * 60000 }));
  return [...load('wyrm.feed', []), ...seeded];
}
function decorate(list, likes, comments) {
  return list.map(p => ({
    ...p,
    likeCount: (p.reacts ? p.reacts.flame || 0 : 0) + (likes[p.id] ? 1 : 0),
    saveCount: (p.reacts ? p.reacts.star || 0 : 0) + (likes['s_' + p.id] ? 1 : 0),
    likedByMe: !!likes[p.id], savedByMe: !!likes['s_' + p.id],
    commentCount: (comments[p.id] || []).length, repostCount: p.repostBase || 0,
  }));
}

// мои лайки/закладки ТОЛЬКО для постов текущей страницы → {liked:Set, saved:Set}
// (не тянем всю таблицу лайков на каждую страницу ленты)
async function likedSaved(pb, postIds) {
  const me = authRecord(pb); const liked = new Set(), saved = new Set();
  if (me && postIds && postIds.length) {
    const parts = postIds.map((_, i) => `post={:p${i}}`).join('||');
    const params = { u: me.id }; postIds.forEach((id, i) => { params['p' + i] = id; });
    const ls = await pb.collection('likes').getFullList({ filter: pb.filter(`user={:u} && (${parts})`, params) });
    ls.forEach(l => (l.kind === 'save' ? saved : liked).add(l.post));
  }
  return { liked, saved };
}

// Единый постраничный + СЕРВЕРНО-фильтруемый список ленты.
// opts: { page, perPage, kind, community, authorHandle, authors[] }
//   authors=[] трактуется как «никто» (пустая вкладка «Подписки», не вся лента).
// Возвращает { items, hasMore }.
export async function listPosts(opts = {}) {
  const { page = 1, perPage = 20, kind, community, authorHandle, authors } = opts;
  if (authors && authors.length === 0) return { items: [], hasMore: false };
  if (enabled) {
    const pb = await pbClient();
    const parts = [], params = {};
    if (kind) { parts.push('kind={:k}'); params.k = kind; }
    if (community) { parts.push('community={:c}'); params.c = community; }
    if (authorHandle) { parts.push('author_handle={:a}'); params.a = authorHandle; }
    if (authors && authors.length) {
      parts.push('(' + authors.map((_, i) => `author_handle={:au${i}}`).join('||') + ')');
      authors.forEach((h, i) => { params['au' + i] = h; });
    }
    const filter = parts.length ? pb.filter(parts.join('&&'), params) : '';
    const res = await pb.collection('posts').getList(page, perPage, { sort: '-created', ...(filter ? { filter } : {}) });
    const { liked, saved } = await likedSaved(pb, res.items.map(p => p.id));
    return { items: res.items.map(p => mapPost(p, liked, saved)), hasMore: res.page < res.totalPages };
  }
  const hidden = new Set(load('wyrm.hiddenPosts', []));
  let all = localPosts().filter(p => !hidden.has(p.id));
  if (kind) all = all.filter(p => p.kind === kind);
  if (community) all = all.filter(p => p.community === community);
  if (authorHandle) all = all.filter(p => p.author === authorHandle);
  if (authors) all = all.filter(p => authors.includes(p.author));
  all = decorate(all, load('wyrm.likes', {}), load('wyrm.comments', {}));
  const start = (page - 1) * perPage;
  return { items: all.slice(start, start + perPage), hasMore: start + perPage < all.length };
}

// удалить пост (модератор или автор). В демо — скрываем (сид нельзя удалить физически).
export async function deletePost(id) {
  if (enabled) { const pb = await pbClient(); await pb.collection('posts').delete(id); return true; }
  const mine = load('wyrm.feed', []);
  save('wyrm.feed', mine.filter(p => p.id !== id));
  const hidden = load('wyrm.hiddenPosts', []);
  if (!hidden.includes(id)) save('wyrm.hiddenPosts', [...hidden, id]);
  return true;
}

export async function addPost(p) {
  if (enabled) {
    const pb = await pbClient();
    const me = authRecord(pb);
    const created = await pb.collection('posts').create({
      author: me ? me.id : null, author_handle: p.author, kind: p.kind || 'post',
      text: p.text, tags: p.tags || [], ref: p.ref || null, community: p.community || null,
      repost_of: p.repostOf || null, like_count: 0, save_count: 0, comment_count: 0, repost_count: 0,
    });
    if (p.repostOf) { try { await pb.collection('posts').update(p.repostOf, { 'repost_count+': 1 }); } catch (e) {} }
    return mapPost(created);
  }
  const post = { id: uid('u'), ts: Date.now(), reacts: { flame: 0, star: 0 },
    author: p.author, kind: p.kind || 'post', text: p.text, tags: p.tags || [], ref: p.ref || null,
    media: p.media || null, community: p.community || null, repostOf: p.repostOf || null };
  save('wyrm.feed', [post, ...load('wyrm.feed', [])]);
  return { ...post, likeCount: 0, saveCount: 0, commentCount: 0, repostCount: 0, likedByMe: false, savedByMe: false };
}

// kind: 'like' (flame) | 'save' (star)
export async function toggleReact(postId, kind = 'like') {
  if (enabled) {
    const pb = await pbClient();
    const me = authRecord(pb);
    if (!me) throw new Error('Нужно войти');
    const field = kind === 'save' ? 'save_count' : 'like_count';
    const ex = await pb.collection('likes').getFullList({ filter: pb.filter('post={:p}&&user={:u}&&kind={:k}', { p: postId, u: me.id, k: kind }) });
    if (ex.length) {
      await pb.collection('likes').delete(ex[0].id);
      // атомарный декремент (без read-modify-write — иначе теряются гонки)
      await pb.collection('posts').update(postId, { [field + '-']: 1 });
      return false;
    }
    await pb.collection('likes').create({ post: postId, user: me.id, kind });
    await pb.collection('posts').update(postId, { [field + '+']: 1 });
    return true;
  }
  const likes = load('wyrm.likes', {});
  const key = kind === 'save' ? 's_' + postId : postId;
  likes[key] = !likes[key];
  save('wyrm.likes', likes);
  return likes[key];
}

export async function repost(post, author) {
  return addPost({ author, kind: 'post', text: post.text, tags: post.tags || [], ref: post.ref || null,
    community: post.community || null, repostOf: post.id });
}

// закладки текущего пользователя (реакции kind='save') → Profile «Закладки»
export async function listBookmarks() {
  if (enabled) {
    const pb = await pbClient(); const me = authRecord(pb); if (!me) return [];
    try {
      const ls = await pb.collection('likes').getFullList({ filter: pb.filter('user={:u}&&kind={:k}', { u: me.id, k: 'save' }), sort: '-created' });
      const ids = ls.map(l => l.post); if (!ids.length) return [];
      const posts = await Promise.all(ids.map(id => pb.collection('posts').getOne(id).catch(() => null)));
      const { liked, saved } = await likedSaved(pb, ids);
      return posts.filter(Boolean).map(p => mapPost(p, liked, saved));
    } catch (e) { return []; }
  }
  const likes = load('wyrm.likes', {});
  const ids = Object.keys(likes).filter(k => k.startsWith('s_') && likes[k]).map(k => k.slice(2));
  const all = decorate(localPosts(), likes, load('wyrm.comments', {}));
  return ids.map(id => all.find(p => p.id === id)).filter(Boolean);
}

export async function listComments(postId) {
  if (enabled) {
    const pb = await pbClient();
    const rows = await pb.collection('comments').getFullList({ filter: pb.filter('post={:p}', { p: postId }), sort: 'created' });
    return rows.map(x => ({ id: x.id, author: x.author_handle, text: x.text, ts: Date.parse(x.created) || Date.now() }));
  }
  return (load('wyrm.comments', {})[postId] || []);
}

export async function addComment(postId, text, author) {
  if (enabled) {
    const pb = await pbClient();
    const me = authRecord(pb);
    const created = await pb.collection('comments').create({ post: postId, author: me ? me.id : null, author_handle: author, text });
    try { await pb.collection('posts').update(postId, { 'comment_count+': 1 }); } catch (e) {}
    return { id: created.id, author: created.author_handle, text: created.text, ts: Date.parse(created.created) || Date.now() };
  }
  const all = load('wyrm.comments', {});
  const cm = { id: uid('c'), author, text, ts: Date.now() };
  all[postId] = [...(all[postId] || []), cm];
  save('wyrm.comments', all);
  return cm;
}

/* ============================================================
   COMMUNITIES
   ============================================================ */
const mapCommunity = (c) => ({ id: c.id, name: c.name, blurb: c.blurb, tags: c.tags || [], hue: c.hue, owner: c.owner, stories: c.stories || [], members: c.member_count || 1 });

export async function listCommunities() {
  if (enabled) {
    const pb = await pbClient();
    const rows = await pb.collection('communities').getFullList({ sort: '-created' });
    let joined = [];
    const me = authRecord(pb);
    if (me) { const m = await pb.collection('memberships').getFullList({ filter: pb.filter('user={:u}', { u: me.id }) }); joined = m.map(x => x.community); }
    return { communities: rows.map(mapCommunity), joined };
  }
  const hidden = new Set(load('wyrm.hiddenCommunities', []));
  const all = [...load('wyrm.communities', []), ...COMMUNITIES_SEED].filter(c => !hidden.has(c.id));
  return { communities: all, joined: load('wyrm.memberships', []) };
}

export async function createCommunity(cm, owner) {
  if (enabled) {
    const pb = await pbClient();
    const me = authRecord(pb);
    const created = await pb.collection('communities').create({
      name: cm.name, blurb: cm.blurb, tags: cm.tags || [], hue: cm.hue, owner,
      owner_id: me ? me.id : null, stories: [], member_count: 1,
    });
    if (me) await pb.collection('memberships').create({ community: created.id, user: me.id });
    return mapCommunity(created);
  }
  const community = { id: uid('c'), members: 1, stories: [], owner, ...cm };
  save('wyrm.communities', [community, ...load('wyrm.communities', [])]);
  save('wyrm.memberships', [...load('wyrm.memberships', []), community.id]);
  return community;
}

export async function toggleJoin(id) {
  if (enabled) {
    const pb = await pbClient();
    const me = authRecord(pb);
    if (!me) throw new Error('Нужно войти');
    const ex = await pb.collection('memberships').getFullList({ filter: pb.filter('community={:c}&&user={:u}', { c: id, u: me.id }) });
    if (ex.length) {
      await pb.collection('memberships').delete(ex[0].id);
      try { await pb.collection('communities').update(id, { 'member_count-': 1 }); } catch (e) {}
      return false;
    }
    await pb.collection('memberships').create({ community: id, user: me.id });
    try { await pb.collection('communities').update(id, { 'member_count+': 1 }); } catch (e) {}
    return true;
  }
  const j = load('wyrm.memberships', []);
  const next = j.includes(id) ? j.filter(x => x !== id) : [...j, id];
  save('wyrm.memberships', next);
  return next.includes(id);
}

// удалить сообщество (владелец или модератор). В демо — скрываем сид / удаляем своё.
export async function deleteCommunity(id) {
  if (enabled) { const pb = await pbClient(); await pb.collection('communities').delete(id); return true; }
  const mine = load('wyrm.communities', []);
  save('wyrm.communities', mine.filter(c => c.id !== id));
  const hidden = load('wyrm.hiddenCommunities', []);
  if (!hidden.includes(id)) save('wyrm.hiddenCommunities', [...hidden, id]);
  return true;
}

/* ============================================================
   STORIES / TREE / VOTES
   В демо-режиме источник — window.WYRM (сид-деревья) + localStorage
   (wyrm.stories / wyrm.nodes / wyrm.votes); в боевом — PocketBase.
   ============================================================ */

const WY = () => (typeof window !== 'undefined' && window.WYRM) || {};
const mapStory = (s) => ({
  id: s.slug || s.id, slug: s.slug || s.id, title: s.title, author: s.author_handle || s.author,
  synopsis: s.synopsis, tags: s.tags || [], community: s.community || null,
  // PB хранит обложку как имя файла → собираем публичный URL; демо хранит data-URL.
  cover: s.cover ? (enabled ? `${PB_URL}/api/files/stories/${s.id}/${s.cover}` : s.cover) : null,
  contributors: s.contributors || 1, branches: s.branches || 1, hot: !!s.hot,
});
const mapNode = (n) => ({
  id: n.id, story: n.story, parent: n.parent || null, title: n.title, author: n.author_handle || n.author,
  canon: !!n.canon, score: n.score || 0, votes: n.votes || 0, words: n.words || 0,
  tags: n.tags || [], excerpt: n.excerpt || '', html: n.html || '', chars: n.chars || {},
});

/* ---- голоса и ставки (демо хранит в браузере) ---- */
export function getVotes() { return load('wyrm.votes', {}); }
export function getStakes() { return load('wyrm.stakes', {}); }

/* ---- канон «лидер среди сиблингов» (чистые функции, общий дисплей) ----
   overlay — числовая прибавка к голосам узла (голос = +1, ставка = +очки). */
export function canonPath(nodes, overlay = {}) {
  const eff = (n) => (n.votes || 0) + (Number(overlay[n.id]) || 0);
  const kids = {};
  nodes.forEach(n => { const p = n.parent || '__root'; (kids[p] = kids[p] || []).push(n); });
  const leader = (sibs) => sibs.reduce((b, s) =>
    (eff(s) > eff(b) || (eff(s) === eff(b) && (s.score || 0) > (b.score || 0))) ? s : b, sibs[0]);
  const path = [];
  let cur = (kids['__root'] && kids['__root'].length) ? leader(kids['__root']) : null;
  const guard = new Set();
  while (cur && !guard.has(cur.id)) { guard.add(cur.id); path.push(cur.id); const ch = kids[cur.id]; cur = (ch && ch.length) ? leader(ch) : null; }
  return path;
}
export function markCanon(nodes, overlay = {}) {
  const cp = new Set(canonPath(nodes, overlay));
  return nodes.map(n => ({ ...n, canon: cp.has(n.id) }));
}
// overlay применяется только в демо (в PB голоса/ставки уже в node.votes):
// голос = +1, ставка = +очки признания.
export const voteOverlay = () => {
  if (enabled) return {};
  const v = getVotes(), st = getStakes(), o = {};
  Object.keys(v).forEach(k => { if (v[k]) o[k] = (o[k] || 0) + 1; });
  Object.keys(st).forEach(k => { o[k] = (o[k] || 0) + (st[k] || 0); });
  return o;
};
// ставка очков признания на ветвь = усиленный голос
export async function stakeNode(nodeId, points) {
  if (enabled) {
    const pb = await pbClient(); const me = authRecord(pb);
    if (!me) throw new Error('Нужно войти');
    // не глотаем ошибку: сервер может отклонить (напр. ставка за свой узел) —
    // вызывающий должен узнать о провале, а не получить ложный успех.
    await pb.collection('votes').create({ node: nodeId, user: me.id, weight: points });
    return points;
  }
  const st = getStakes(); st[nodeId] = (st[nodeId] || 0) + points; save('wyrm.stakes', st);
  return st[nodeId];
}

/* ---- stories ---- */
export async function listStories() {
  if (enabled) {
    const pb = await pbClient();
    const rows = await pb.collection('stories').getFullList({ sort: '-created' });
    return rows.map(mapStory);
  }
  return (WY().STORIES || load('wyrm.stories', [])).slice();
}
export async function getStory(idOrSlug) {
  if (enabled) {
    const pb = await pbClient();
    const r = await pb.collection('stories').getFirstListItem(pb.filter('slug={:s}', { s: idOrSlug })).catch(() => null);
    return r ? mapStory(r) : null;
  }
  return (WY().STORIES || []).find(s => s.id === idOrSlug) || null;
}
export async function createStory(s, rootNode) {
  if (enabled) {
    const pb = await pbClient();
    const me = authRecord(pb);
    const slug = (s.slug || s.id || (s.title || 'kniga').toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-')).slice(0, 48);
    const data = {
      slug, title: s.title, author: me ? me.id : null, author_handle: s.author,
      synopsis: s.synopsis || '', tags: s.tags || [], community: s.community || null,
      contributors: 1, branches: 1, hot: false,
    };
    // обложка: File → SDK сам соберёт multipart/form-data в file-поле cover.
    if (s.coverFile) data.cover = s.coverFile;
    const story = await pb.collection('stories').create(data);
    if (rootNode) await addNode({ ...rootNode, story: story.id });
    return mapStory(story);
  }
  // демо: пишем в localStorage + window.WYRM (coverFile — File, не сериализуем)
  const { coverFile, ...sClean } = s;
  const story = { contributors: 1, branches: 1, hot: false, ...sClean };
  save('wyrm.stories', [story, ...load('wyrm.stories', [])]);
  if (WY().STORIES) WY().STORIES.push(story);
  if (rootNode) await addNode(rootNode);
  return story;
}

/* ---- nodes ---- */
export async function listNodes(storyId) {
  if (enabled) {
    const pb = await pbClient();
    const story = await pb.collection('stories').getFirstListItem(pb.filter('slug={:s}', { s: storyId })).catch(() => null);
    if (!story) return [];
    const rows = await pb.collection('nodes').getFullList({ filter: pb.filter('story={:id}', { id: story.id }), sort: 'created' });
    return rows.map(mapNode);
  }
  return (WY().nodesFor ? WY().nodesFor(storyId) : load('wyrm.nodes', []).filter(n => (n.story || 'ashes') === storyId)).slice();
}
export async function addNode(node) {
  if (enabled) {
    const pb = await pbClient();
    const me = authRecord(pb);
    let storyId = node.story;
    if (storyId) { // всегда пробуем как slug → если нашли, берём record id; иначе это уже id
      const st = await pb.collection('stories').getFirstListItem(pb.filter('slug={:s}', { s: storyId })).catch(() => null);
      if (st) storyId = st.id;
    }
    const created = await pb.collection('nodes').create({
      story: storyId, parent: node.parent || null, title: node.title, author: me ? me.id : null,
      author_handle: node.author, score: node.score || 0.3, votes: 0, words: node.words || 0,
      tags: node.tags || [], excerpt: node.excerpt || '', html: node.html || '', chars: node.chars || {},
    });
    return mapNode(created);
  }
  // демо: persist + поддержать window.WYRM
  const stored = load('wyrm.nodes', []);
  save('wyrm.nodes', [...stored, node]);
  if ((node.story || 'ashes') === 'ashes' && WY().NODES) WY().NODES.push(node);
  return node;
}

/* ---- голосование за узел (toggle) ---- */
export async function voteNode(nodeId) {
  if (enabled) {
    const pb = await pbClient();
    const me = authRecord(pb);
    if (!me) throw new Error('Нужно войти');
    const ex = await pb.collection('votes').getFullList({ filter: pb.filter('node={:n}&&user={:u}', { n: nodeId, u: me.id }) });
    if (ex.length) { await pb.collection('votes').delete(ex[0].id); return false; } // сервер пересчитает canon/score
    await pb.collection('votes').create({ node: nodeId, user: me.id, weight: 1 });
    return true;
  }
  const v = getVotes();
  v[nodeId] = !v[nodeId];
  save('wyrm.votes', v);
  return !!v[nodeId];
}

/* ============================================================
   MEDIA / FOLLOWS / NOTIFICATIONS (Фаза 1, хвост)
   ============================================================ */

/* медиа: файл → data URL (демо хранит обложку прямо в записи) */
export function fileToDataURL(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}

/* аватар: PB — multipart в file-поле users.avatar; демо — data-URL в wyrm.user.
   Возвращает публичный URL (или data-URL в демо) обновлённого аватара. */
export async function updateAvatar(file) {
  if (enabled) {
    const pb = await pbClient(); const me = authRecord(pb);
    if (!me) throw new Error('Нужно войти');
    const rec = await pb.collection('users').update(me.id, { avatar: file });
    return rec.avatar ? `${PB_URL}/api/files/users/${rec.id}/${rec.avatar}` : null;
  }
  const u = load('wyrm.user', null) || {};
  const dataUrl = await fileToDataURL(file);
  save('wyrm.user', { ...u, avatar: dataUrl });
  return dataUrl;
}

/* подписки на авторов */
export async function listFollowing() {
  if (enabled) {
    const pb = await pbClient(); const me = authRecord(pb); if (!me) return [];
    try { const r = await pb.collection('follows').getFullList({ filter: pb.filter('follower={:u}', { u: me.id }) }); return r.map(x => x.target_handle); } catch (e) { return []; }
  }
  return load('wyrm.following', []);
}
export async function toggleFollow(handle) {
  if (enabled) {
    const pb = await pbClient(); const me = authRecord(pb); if (!me) throw new Error('Нужно войти');
    try {
      const ex = await pb.collection('follows').getFullList({ filter: pb.filter('follower={:u}&&target_handle={:h}', { u: me.id, h: handle }) });
      if (ex.length) { await pb.collection('follows').delete(ex[0].id); return false; }
      await pb.collection('follows').create({ follower: me.id, target_handle: handle }); return true;
    } catch (e) { return false; }
  }
  const f = load('wyrm.following', []);
  const next = f.includes(handle) ? f.filter(x => x !== handle) : [...f, handle];
  save('wyrm.following', next);
  return next.includes(handle);
}

/* уведомления */
const NOTI_SEED = [
  { id: 'n1', kind: 'comment', text: '@mara.q ответила на твой пост', ago: 28 },
  { id: 'n2', kind: 'like', text: '@grimwarden и ещё 4 оценили твою ветвь', ago: 140 },
  { id: 'n3', kind: 'canon', text: 'Твоя глава вырвалась в канон ✦', ago: 360 },
];
export async function listNotifications() {
  if (enabled) {
    const pb = await pbClient(); const me = authRecord(pb); if (!me) return [];
    try {
      const r = await pb.collection('notifications').getFullList({ filter: pb.filter('user={:u}', { u: me.id }), sort: '-created' });
      return r.map(x => ({ id: x.id, kind: x.kind, text: (x.ref && x.ref.text) || x.kind, ts: Date.parse(x.created) || Date.now(), read: !!x.read }));
    } catch (e) { return []; }
  }
  const readMap = load('wyrm.notiRead', {});
  const seeded = NOTI_SEED.map(n => ({ ...n, ts: Date.now() - n.ago * 60000 }));
  return [...load('wyrm.notifications', []), ...seeded].map(n => ({ ...n, read: !!readMap[n.id] }));
}
export async function markAllNotificationsRead() {
  if (enabled) {
    const pb = await pbClient(); const me = authRecord(pb);
    if (me) { try { const r = await pb.collection('notifications').getFullList({ filter: pb.filter('user={:u}', { u: me.id }) }); await Promise.all(r.map(x => pb.collection('notifications').update(x.id, { read: true }))); } catch (e) {} }
    return;
  }
  const all = await listNotifications(); const map = {}; all.forEach(n => { map[n.id] = true; }); save('wyrm.notiRead', map);
}

/* ============================================================
   ВЕРСТАК ПИСАТЕЛЯ — раскладка доков и пресеты (TZ §9)
   cfg = { left, right, bottom, focus, goal } (видимость доков + цель по словам)
   ============================================================ */
const DEFAULT_DESK = { left: true, right: true, bottom: false, focus: false, goal: 500 };
const ACTIVE_DESK = '__active__'; // зарезервированное имя пресета активной раскладки
export function getWorkspaceCfg() { return { ...DEFAULT_DESK, ...load('wyrm.workspace', {}) }; }
export function saveWorkspaceCfg(cfg) {
  save('wyrm.workspace', cfg);            // мгновенно — локально
  if (enabled) syncActiveDesk(cfg);        // и best-effort синк в аккаунт
}
// upsert активной раскладки в аккаунт (между устройствами).
// Сериализуем вызовы в цепочку: иначе два быстрых тогла прочитают «пусто»
// одновременно и создадут два дубля __active__ (read→create гонка).
let _deskSync = Promise.resolve();
function syncActiveDesk(cfg) {
  _deskSync = _deskSync.then(async () => {
    try {
      const pb = await pbClient(); const me = authRecord(pb); if (!me) return;
      const ex = await pb.collection('workspace_presets').getFullList({ filter: pb.filter("user={:u} && name={:n}", { u: me.id, n: ACTIVE_DESK }) });
      if (ex.length) await pb.collection('workspace_presets').update(ex[0].id, { cfg });
      else await pb.collection('workspace_presets').create({ user: me.id, name: ACTIVE_DESK, cfg });
    } catch (e) {}
  });
  return _deskSync;
}
// загрузить активную раскладку из аккаунта (PB), иначе null
export async function loadWorkspaceCfgRemote() {
  if (!enabled) return null;
  try {
    const pb = await pbClient(); const me = authRecord(pb); if (!me) return null;
    const ex = await pb.collection('workspace_presets').getFullList({ filter: pb.filter("user={:u} && name={:n}", { u: me.id, n: ACTIVE_DESK }) });
    return ex.length ? ex[0].cfg : null;
  } catch (e) { return null; }
}

export async function listWorkspacePresets() {
  if (enabled) {
    const pb = await pbClient(); const me = authRecord(pb); if (!me) return [];
    try { const r = await pb.collection('workspace_presets').getFullList({ filter: pb.filter('user={:u}', { u: me.id }) }); return r.filter(x => x.name !== ACTIVE_DESK).map(x => ({ id: x.id, name: x.name, cfg: x.cfg })); } catch (e) { return []; }
  }
  return load('wyrm.wsPresets', []);
}
export async function saveWorkspacePreset(name, cfg) {
  if (enabled) {
    const pb = await pbClient(); const me = authRecord(pb);
    if (me) { try { await pb.collection('workspace_presets').create({ user: me.id, name, cfg }); } catch (e) {} }
    return;
  }
  const list = load('wyrm.wsPresets', []);
  save('wyrm.wsPresets', [...list.filter(p => p.name !== name), { id: uid('w'), name, cfg }]);
}

/* ============================================================
   REALTIME — токен для «Комнаты авторов» (ws-сервис realtime/)
   В боевом режиме отдаём PocketBase JWT; в демо — null (клиент
   уходит в локальную симуляцию, см. lib/realtime.js).
   ============================================================ */
export async function getAuthToken() {
  if (enabled) {
    const pb = await pbClient();
    return pb && pb.authStore.isValid ? pb.authStore.token : null;
  }
  return null;
}

/* ============================================================
   MERGE REQUESTS — Tier-3 PR-воркфлоу для Narrative Merge.
   PB-коллекция merge_requests (story/source/target/status/hunks/approvals),
   иначе wyrm.mrs. payload (готовая нода + мета) хранится в hunks(json).
   ============================================================ */
export async function listMergeRequests(story) {
  if (enabled) {
    const pb = await pbClient();
    try {
      const filter = story ? pb.filter('story={:s}', { s: story }) : '';
      const r = await pb.collection('merge_requests').getFullList({ sort: '-created', ...(filter ? { filter } : {}) });
      return r.map(x => ({ id: x.id, story: x.story, source: x.source, target: x.target, status: x.status, approvals: x.approvals || [], ...(x.hunks || {}), ts: Date.parse(x.created) || Date.now() }));
    } catch (e) { return []; }
  }
  const all = load('wyrm.mrs', []);
  return story ? all.filter(m => m.story === story) : all;
}
export async function createMergeRequest(mr) {
  if (enabled) {
    const pb = await pbClient(); const me = authRecord(pb);
    try {
      const payload = { title: mr.title, applied: mr.applied, sourceTitle: mr.sourceTitle, targetTitle: mr.targetTitle, node: mr.node, author: me ? me.id : null };
      const r = await pb.collection('merge_requests').create({ story: mr.story, source: mr.source, target: mr.target, status: 'open', hunks: payload, approvals: [] });
      return { id: r.id, story: mr.story, source: mr.source, target: mr.target, status: 'open', approvals: [], ...payload, ts: Date.now() };
    } catch (e) { return null; }
  }
  const me = load('wyrm.user', null);
  const rec = { id: uid('mr'), story: mr.story, source: mr.source, target: mr.target, status: 'open', approvals: [],
    title: mr.title, applied: mr.applied, sourceTitle: mr.sourceTitle, targetTitle: mr.targetTitle, node: mr.node,
    author: (me && (me.handle || me.name)) || 'аноним', ts: Date.now() };
  save('wyrm.mrs', [rec, ...load('wyrm.mrs', [])]);
  return rec;
}
export async function approveMergeRequest(id, approver) {
  if (enabled) {
    const pb = await pbClient();
    try {
      const r = await pb.collection('merge_requests').getOne(id);
      const ap = (r.approvals || []).includes(approver) ? r.approvals.filter(a => a !== approver) : [...(r.approvals || []), approver];
      const status = r.status === 'merged' ? 'merged' : (ap.length >= 2 ? 'approved' : 'open');
      await pb.collection('merge_requests').update(id, { approvals: ap, status });
      return { id, approvals: ap, status };
    } catch (e) { return null; }
  }
  const next = load('wyrm.mrs', []).map(m => {
    if (m.id !== id) return m;
    const ap = m.approvals.includes(approver) ? m.approvals.filter(a => a !== approver) : [...m.approvals, approver];
    return { ...m, approvals: ap, status: m.status === 'merged' ? 'merged' : (ap.length >= 2 ? 'approved' : 'open') };
  });
  save('wyrm.mrs', next);
  return next.find(m => m.id === id);
}
export async function mergeMergeRequest(id) {
  const list = enabled ? await listMergeRequests() : load('wyrm.mrs', []);
  const mr = list.find(m => m.id === id);
  if (!mr || !mr.node) return null;
  await addNode(mr.node);
  if (enabled) { const pb = await pbClient(); try { await pb.collection('merge_requests').update(id, { status: 'merged' }); } catch (e) {} }
  else { save('wyrm.mrs', load('wyrm.mrs', []).map(m => m.id === id ? { ...m, status: 'merged' } : m)); }
  return mr;
}

/* ============================================================
   READER CUTS — «Мои версии»: сохранённые пути сборки читателя.
   PB-коллекция reader_cuts (есть в миграциях), иначе wyrm.cuts.
   ============================================================ */
export async function saveCut(story, path, title) {
  if (enabled) {
    const pb = await pbClient(); const me = authRecord(pb); if (!me) throw new Error('Нужно войти');
    try { const r = await pb.collection('reader_cuts').create({ owner: me.id, story, path, title: title || 'Без названия' }); return { id: r.id, story, path, title: title || 'Без названия', ts: Date.now() }; } catch (e) { return null; }
  }
  const cut = { id: uid('c'), story, path, title: title || 'Без названия', ts: Date.now() };
  save('wyrm.cuts', [cut, ...load('wyrm.cuts', [])]);
  return cut;
}
export async function listCuts() {
  if (enabled) {
    const pb = await pbClient(); const me = authRecord(pb); if (!me) return [];
    try { const r = await pb.collection('reader_cuts').getFullList({ filter: pb.filter('owner={:u}', { u: me.id }), sort: '-created' }); return r.map(x => ({ id: x.id, story: x.story, path: x.path, title: x.title, ts: Date.parse(x.created) || Date.now() })); } catch (e) { return []; }
  }
  return load('wyrm.cuts', []);
}
export async function deleteCut(id) {
  if (enabled) { const pb = await pbClient(); try { await pb.collection('reader_cuts').delete(id); } catch (e) {} return; }
  save('wyrm.cuts', load('wyrm.cuts', []).filter(c => c.id !== id));
}

/* ============================================================
   КОДЕКС МИРА — список «заигноренных» неувязок (LoreGraph).
   Локальная мета пользователя (PB-коллекции под это нет), хранится
   в wyrm.loreIgnored как массив id неувязок.
   ============================================================ */
export function getLoreIgnored() { return load('wyrm.loreIgnored', []); }
export function ignoreLoreIssue(id) {
  const list = load('wyrm.loreIgnored', []);
  if (!list.includes(id)) save('wyrm.loreIgnored', [...list, id]);
}
export function unignoreLoreIssue(id) {
  save('wyrm.loreIgnored', load('wyrm.loreIgnored', []).filter(x => x !== id));
}
