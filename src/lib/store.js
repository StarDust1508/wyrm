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

const PB_URL = import.meta.env.VITE_PB_URL;
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
    return { id: r.id, email: r.email, name: r.name || handle, handle };
  }
  return load('wyrm.user', null);
}
export async function signUp(email, password, name) {
  const handle = (name || email.split('@')[0]).toLowerCase().replace(/[^a-zа-я0-9]+/gi, '_');
  if (enabled) {
    const pb = await pbClient();
    await pb.collection('users').create({ email, password, passwordConfirm: password, name: name || handle, handle });
    await pb.collection('users').authWithPassword(email, password);
    return (await currentUser()) || { name: name || handle, email, handle };
  }
  const u = { name: name || handle, email, handle }; save('wyrm.user', u); return u;
}
export async function signIn(email, password) {
  if (enabled) {
    const pb = await pbClient();
    await pb.collection('users').authWithPassword(email, password);
    return await currentUser();
  }
  const handle = email.split('@')[0].toLowerCase().replace(/[^a-zа-я0-9]+/gi, '_');
  const u = { name: handle, email, handle }; save('wyrm.user', u); return u;
}
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

export async function listPosts() {
  if (enabled) {
    const pb = await pbClient();
    const rows = await pb.collection('posts').getFullList({ sort: '-created' });
    let liked = new Set(), saved = new Set();
    const me = authRecord(pb);
    if (me) {
      const ls = await pb.collection('likes').getFullList({ filter: pb.filter('user={:u}', { u: me.id }) });
      ls.forEach(l => (l.kind === 'save' ? saved : liked).add(l.post));
    }
    return rows.map(p => mapPost(p, liked, saved));
  }
  return decorate(localPosts(), load('wyrm.likes', {}), load('wyrm.comments', {}));
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
    if (p.repostOf) { try { const o = await pb.collection('posts').getOne(p.repostOf); await pb.collection('posts').update(p.repostOf, { repost_count: (o.repost_count || 0) + 1 }); } catch (e) {} }
    return mapPost(created);
  }
  const post = { id: uid('u'), ts: Date.now(), reacts: { flame: 0, star: 0 },
    author: p.author, kind: p.kind || 'post', text: p.text, tags: p.tags || [], ref: p.ref || null,
    community: p.community || null, repostOf: p.repostOf || null };
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
    const post = await pb.collection('posts').getOne(postId);
    const ex = await pb.collection('likes').getFullList({ filter: pb.filter('post={:p}&&user={:u}&&kind={:k}', { p: postId, u: me.id, k: kind }) });
    if (ex.length) {
      await pb.collection('likes').delete(ex[0].id);
      await pb.collection('posts').update(postId, { [field]: Math.max(0, (post[field] || 0) - 1) });
      return false;
    }
    await pb.collection('likes').create({ post: postId, user: me.id, kind });
    await pb.collection('posts').update(postId, { [field]: (post[field] || 0) + 1 });
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
    try { const o = await pb.collection('posts').getOne(postId); await pb.collection('posts').update(postId, { comment_count: (o.comment_count || 0) + 1 }); } catch (e) {}
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
  return { communities: [...load('wyrm.communities', []), ...COMMUNITIES_SEED], joined: load('wyrm.memberships', []) };
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
    const com = await pb.collection('communities').getOne(id).catch(() => null);
    const ex = await pb.collection('memberships').getFullList({ filter: pb.filter('community={:c}&&user={:u}', { c: id, u: me.id }) });
    if (ex.length) {
      await pb.collection('memberships').delete(ex[0].id);
      if (com) await pb.collection('communities').update(id, { member_count: Math.max(0, (com.member_count || 1) - 1) });
      return false;
    }
    await pb.collection('memberships').create({ community: id, user: me.id });
    if (com) await pb.collection('communities').update(id, { member_count: (com.member_count || 0) + 1 });
    return true;
  }
  const j = load('wyrm.memberships', []);
  const next = j.includes(id) ? j.filter(x => x !== id) : [...j, id];
  save('wyrm.memberships', next);
  return next.includes(id);
}
