/* ============================================================
   WYRM — единый слой данных (store)

   Один интерфейс для авторизации и всей социальной механики
   (посты, лайки, репосты, комментарии, сообщества, членство).

   • Если заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY —
     работает на реальной базе Supabase (данные общие для всех,
     настоящая регистрация, лайки между пользователями).
   • Иначе — прозрачный фолбэк на localStorage этого браузера,
     чтобы приложение работало как демо без бэкенда.

   Все методы асинхронные (возвращают Promise) — интерфейс одинаков
   в обоих режимах.
   ============================================================ */

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const enabled = !!(URL && KEY);

let _client = null;
async function db() {
  if (!enabled) return null;
  if (!_client) {
    const { createClient } = await import('@supabase/supabase-js');
    _client = createClient(URL, KEY);
  }
  return _client;
}

/* ---------- localStorage helpers ---------- */
const load = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? f : v; } catch (e) { return f; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const uid = (p) => p + Date.now().toString(36) + Math.floor(performance.now() % 1000).toString(36);

/* ---------- seed data (demo + first-run) ---------- */
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

/* ============================================================
   AUTH
   ============================================================ */
export async function currentUser() {
  if (enabled) {
    const c = await db();
    const { data } = await c.auth.getUser();
    if (!data.user) return null;
    const m = data.user.user_metadata || {};
    const handle = m.handle || (data.user.email || 'автор').split('@')[0];
    return { id: data.user.id, email: data.user.email, name: m.name || handle, handle };
  }
  return load('wyrm.user', null);
}
export async function signUp(email, password, name) {
  const handle = (name || email.split('@')[0]).toLowerCase().replace(/[^a-zа-я0-9]+/gi, '_');
  if (enabled) {
    const c = await db();
    const { error } = await c.auth.signUp({ email, password, options: { data: { name: name || handle, handle } } });
    if (error) throw error;
    return (await currentUser()) || { name: name || handle, email, handle };
  }
  const u = { name: name || handle, email, handle }; save('wyrm.user', u); return u;
}
export async function signIn(email, password) {
  if (enabled) {
    const c = await db();
    const { error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return await currentUser();
  }
  const handle = email.split('@')[0].toLowerCase().replace(/[^a-zа-я0-9]+/gi, '_');
  const u = { name: handle, email, handle }; save('wyrm.user', u); return u;
}
export async function signOut() {
  if (enabled) { const c = await db(); await c.auth.signOut(); }
  localStorage.removeItem('wyrm.user');
}

/* ============================================================
   FEED — posts, likes, reposts, comments
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
    likedByMe: !!likes[p.id],
    savedByMe: !!likes['s_' + p.id],
    commentCount: (comments[p.id] || []).length,
    repostCount: (p.repostBase || 0),
  }));
}

export async function listPosts() {
  if (enabled) {
    const c = await db();
    const me = (await c.auth.getUser()).data.user;
    const { data: posts } = await c.from('posts').select('*').order('created_at', { ascending: false });
    const { data: likes } = await c.from('likes').select('post_id,kind').eq('user_id', me ? me.id : '00000000-0000-0000-0000-000000000000');
    const liked = new Set((likes || []).filter(l => l.kind === 'like').map(l => l.post_id));
    const saved = new Set((likes || []).filter(l => l.kind === 'save').map(l => l.post_id));
    return (posts || []).map(p => ({
      id: p.id, author: p.author_handle, kind: p.kind, text: p.text, tags: p.tags || [],
      ref: p.ref, community: p.community_id, ts: new Date(p.created_at).getTime(),
      repostOf: p.repost_of, likeCount: p.like_count || 0, saveCount: p.save_count || 0,
      commentCount: p.comment_count || 0, repostCount: p.repost_count || 0,
      likedByMe: liked.has(p.id), savedByMe: saved.has(p.id),
    }));
  }
  return decorate(localPosts(), load('wyrm.likes', {}), load('wyrm.comments', {}));
}

export async function addPost(p) {
  if (enabled) {
    const c = await db();
    const me = (await c.auth.getUser()).data.user;
    const row = { author_id: me ? me.id : null, author_handle: p.author, kind: p.kind || 'post',
      text: p.text, tags: p.tags || [], ref: p.ref || null, community_id: p.community || null, repost_of: p.repostOf || null };
    const { data, error } = await c.from('posts').insert(row).select().single();
    if (error) throw error;
    return { id: data.id, author: data.author_handle, kind: data.kind, text: data.text, tags: data.tags || [],
      ref: data.ref, community: data.community_id, ts: new Date(data.created_at).getTime(),
      likeCount: 0, saveCount: 0, commentCount: 0, repostCount: 0, likedByMe: false, savedByMe: false };
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
    const c = await db();
    const me = (await c.auth.getUser()).data.user;
    if (!me) throw new Error('Нужно войти');
    const { data: ex } = await c.from('likes').select('post_id').eq('post_id', postId).eq('user_id', me.id).eq('kind', kind).maybeSingle();
    if (ex) await c.from('likes').delete().eq('post_id', postId).eq('user_id', me.id).eq('kind', kind);
    else await c.from('likes').insert({ post_id: postId, user_id: me.id, kind });
    return !ex;
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
    const c = await db();
    const { data } = await c.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
    return (data || []).map(x => ({ id: x.id, author: x.author_handle, text: x.text, ts: new Date(x.created_at).getTime() }));
  }
  return (load('wyrm.comments', {})[postId] || []);
}

export async function addComment(postId, text, author) {
  if (enabled) {
    const c = await db();
    const me = (await c.auth.getUser()).data.user;
    const { data, error } = await c.from('comments').insert({ post_id: postId, author_id: me ? me.id : null, author_handle: author, text }).select().single();
    if (error) throw error;
    return { id: data.id, author: data.author_handle, text: data.text, ts: new Date(data.created_at).getTime() };
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
export async function listCommunities() {
  if (enabled) {
    const c = await db();
    const me = (await c.auth.getUser()).data.user;
    const { data } = await c.from('communities').select('*').order('created_at', { ascending: false });
    let joinedSet = new Set();
    if (me) { const { data: m } = await c.from('memberships').select('community_id').eq('user_id', me.id); joinedSet = new Set((m || []).map(x => x.community_id)); }
    const rows = (data || []).map(x => ({ id: x.id, name: x.name, blurb: x.blurb, tags: x.tags || [], hue: x.hue, owner: x.owner, stories: x.stories || [], members: x.member_count || 1 }));
    const merged = [...rows, ...COMMUNITIES_SEED.filter(s => !rows.find(r => r.id === s.id))];
    return { communities: merged, joined: [...joinedSet] };
  }
  return { communities: [...load('wyrm.communities', []), ...COMMUNITIES_SEED], joined: load('wyrm.memberships', []) };
}

export async function createCommunity(cm, owner) {
  if (enabled) {
    const c = await db();
    const me = (await c.auth.getUser()).data.user;
    const id = (cm.name || 'community').toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').slice(0, 40) + '-' + Date.now().toString(36).slice(-4);
    const row = { id, name: cm.name, blurb: cm.blurb, tags: cm.tags || [], hue: cm.hue, owner, stories: [], owner_id: me ? me.id : null };
    const { data, error } = await c.from('communities').insert(row).select().single();
    if (error) throw error;
    if (me) await c.from('memberships').insert({ community_id: id, user_id: me.id });
    return { id: data.id, name: data.name, blurb: data.blurb, tags: data.tags || [], hue: data.hue, owner: data.owner, stories: [], members: 1 };
  }
  const community = { id: uid('c'), members: 1, stories: [], owner, ...cm };
  save('wyrm.communities', [community, ...load('wyrm.communities', [])]);
  save('wyrm.memberships', [...load('wyrm.memberships', []), community.id]);
  return community;
}

export async function toggleJoin(id) {
  if (enabled) {
    const c = await db();
    const me = (await c.auth.getUser()).data.user;
    if (!me) throw new Error('Нужно войти');
    const { data: ex } = await c.from('memberships').select('community_id').eq('community_id', id).eq('user_id', me.id).maybeSingle();
    if (ex) { await c.from('memberships').delete().eq('community_id', id).eq('user_id', me.id); return false; }
    await c.from('memberships').insert({ community_id: id, user_id: me.id }); return true;
  }
  const j = load('wyrm.memberships', []);
  const next = j.includes(id) ? j.filter(x => x !== id) : [...j, id];
  save('wyrm.memberships', next);
  return next.includes(id);
}
