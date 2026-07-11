/* ============================================================
   Galathilion — URL <-> {route, ctx} codec.
   Даёт SPA настоящие deep-linkable пути: книга/ветка становятся
   ссылками (шаринг, закладки, «назад»), а og-сервер под /book/:slug
   наконец получает реальные URL для превью в Telegram/VK.
   ============================================================ */

// route -> одиночный сегмент URL (экраны без параметров)
const SEG = {
  home: 'home', catalog: 'catalog', feed: 'feed', communities: 'communities',
  plugins: 'plugins', profile: 'profile', donate: 'donate',
  privacy: 'privacy', cookies: 'cookies', terms: 'terms',
};
const SEG_INV = Object.fromEntries(Object.entries(SEG).map(([r, s]) => [s, r]));
const STUDIO_TOOLS = new Set(['merge', 'lore', 'stakes', 'room', 'cut']);
const dec = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
const enc = (s) => encodeURIComponent(String(s));

// URL-путь -> { route, ctx }
export function pathToState(pathname) {
  const parts = String(pathname || '/').replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  if (!parts.length) return { route: 'landing', ctx: {} };
  const [a, b, c] = parts;
  if (a === 'book' && b) return { route: 'reader', ctx: { story: dec(b), node: c ? dec(c) : null } };
  if (a === 'community' && b) return { route: 'community', ctx: { communityId: dec(b) } };
  if (a === 'studio') {
    if (b && STUDIO_TOOLS.has(b)) return { route: b, ctx: {} };
    return { route: 'compose', ctx: {} };
  }
  if (a === 'profile') return { route: 'profile', ctx: b ? { profileHandle: dec(b) } : {} };
  if (SEG_INV[a]) return { route: SEG_INV[a], ctx: {} };
  return { route: 'landing', ctx: {} };   // неизвестный путь -> ворота
}

// { route, ctx } -> URL-путь
export function stateToPath(route, ctx) {
  ctx = ctx || {};
  switch (route) {
    case 'landing': return '/';
    case 'reader': return ctx.story ? '/book/' + enc(ctx.story) + (ctx.node ? '/' + enc(ctx.node) : '') : '/catalog';
    case 'community': return ctx.communityId ? '/community/' + enc(ctx.communityId) : '/communities';
    case 'compose': return '/studio';
    case 'merge': case 'lore': case 'stakes': case 'room': case 'cut': return '/studio/' + route;
    case 'profile': return ctx.profileHandle ? '/profile/' + enc(ctx.profileHandle) : '/profile';
    default: return SEG[route] ? '/' + SEG[route] : '/';
  }
}
