/* ============================================================
   WYRM — idempotent PocketBase seed script
   ------------------------------------------------------------
   Populates a PocketBase instance ONCE with:
     • the flagship story "ashes" ("Пепел Аркадии") + its node tree
     • the seed communities (COMMUNITIES_SEED)
     • the sample feed posts (FEED_SEED)

   Re-running is safe: every record is looked up by its natural
   key (slug / handle / known marker in `ref`) and skipped if it
   already exists.

   USAGE:
     PB_URL=http://127.0.0.1:8090 \
     PB_ADMIN_EMAIL=admin@example.com \
     PB_ADMIN_PASSWORD=your-password \
     node scripts/seed.mjs

   Requirements:
     • Node 18+ (ESM, top-level await, global fetch)
     • The `pocketbase` JS SDK (already a project dependency)
     • Target server PocketBase v0.22.x with the WYRM collections
       (stories, nodes, communities, posts, users …) already created.

   How the seed data is obtained (assumption / note):
     The real app data lives in source files that are NOT clean
     importable modules from plain Node:
       - `src/app.jsx` is JSX (the flagship NODES live inside a
         "mock data" IIFE).
       - `src/lib/store.js` exports COMMUNITIES_SEED / FEED_SEED but
         references `import.meta.env.VITE_PB_URL` at top level, which
         throws under a plain `node` runtime.
     So instead of importing, this script READS both files and
     extracts the three array literals (NODES, COMMUNITIES_SEED,
     FEED_SEED) by brace-matching, then evaluates each literal in
     isolation. They are pure object/array literals with no external
     references, so they evaluate cleanly and the seed always tracks
     whatever is committed in the repo — no hand-copied duplication.
   ============================================================ */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import PocketBase from 'pocketbase';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const APP_JSX = resolve(REPO_ROOT, 'src/app.jsx');
const STORE_JS = resolve(REPO_ROOT, 'src/lib/store.js');

/* ---------- small logging helpers ---------- */
const log = (...a) => console.log(...a);
const step = (s) => console.log(`\n— ${s}`);
const ok = (s) => console.log(`  ✓ ${s}`);
const skip = (s) => console.log(`  · ${s} (exists — skip)`);
const warn = (s) => console.warn(`  ! ${s}`);

const stats = {
  storiesCreated: 0, storiesSkipped: 0,
  nodesCreated: 0, nodesSkipped: 0,
  communitiesCreated: 0, communitiesSkipped: 0,
  postsCreated: 0, postsSkipped: 0,
};

/* ============================================================
   1. CONFIG
   ============================================================ */
const PB_URL = process.env.PB_URL;
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;

if (!PB_URL || !PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
  console.error('Missing config. Set PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD.');
  console.error('  PB_URL=http://127.0.0.1:8090 PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=secret node scripts/seed.mjs');
  process.exit(1);
}

/* ============================================================
   2. EXTRACT SEED DATA FROM REPO SOURCE
   ------------------------------------------------------------
   Brace-match the array literal that follows `marker`, then eval
   it in isolation. (0, eval) forces indirect/global eval so the
   literal cannot reach this module's scope; the literals contain
   no identifiers anyway.
   ============================================================ */
function extractArrayLiteral(src, marker, label) {
  const at = src.indexOf(marker);
  if (at < 0) throw new Error(`Could not find "${marker}" while extracting ${label}`);
  const open = src.indexOf('[', at);
  if (open < 0) throw new Error(`No "[" after "${marker}" while extracting ${label}`);
  let depth = 0;
  let i = open;
  let inStr = null;        // current string-quote char, or null
  let prev = '';
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === inStr && prev !== '\\') inStr = null;
    } else if (c === '"' || c === "'" || c === '`') {
      inStr = c;
    } else if (c === '[') {
      depth++;
    } else if (c === ']') {
      depth--;
      if (depth === 0) { i++; break; }
    }
    prev = c === '\\' && prev === '\\' ? '' : c; // collapse escaped backslashes
  }
  if (depth !== 0) throw new Error(`Unbalanced brackets while extracting ${label}`);
  const literal = src.slice(open, i);
  // eslint-disable-next-line no-eval
  const value = (0, eval)('(' + literal + ')');
  if (!Array.isArray(value)) throw new Error(`${label} did not evaluate to an array`);
  return value;
}

function loadSeedData() {
  const appSrc = readFileSync(APP_JSX, 'utf8');
  const storeSrc = readFileSync(STORE_JS, 'utf8');
  const NODES = extractArrayLiteral(appSrc, 'const NODES = ', 'NODES');
  const COMMUNITIES_SEED = extractArrayLiteral(storeSrc, 'export const COMMUNITIES_SEED = ', 'COMMUNITIES_SEED');
  const FEED_SEED = extractArrayLiteral(storeSrc, 'export const FEED_SEED = ', 'FEED_SEED');
  return { NODES, COMMUNITIES_SEED, FEED_SEED };
}

/* ============================================================
   3. AUTH (superuser / admin)
   ------------------------------------------------------------
   Version boundary (don't "fix" this the wrong way):
     • Server v0.22.x + SDK 0.21.x (this project's pinned pair):
       admins are a dedicated API, exposed as `pb.admins.authWithPassword`.
       There is NO `_superusers` collection on a v0.22 server.
     • Server v0.23.0+ + SDK 0.22.0+: admins became the
       `_superusers` auth collection; `pb.admins` is soft-deprecated
       and aliased to `pb.collection('_superusers')`.
   So we try `pb.admins` first (correct for the v0.22 target) and
   fall back to the `_superusers` collection, keeping the script
   working across both server/SDK generations.
   ============================================================ */
async function authenticate(pb) {
  if (pb.admins && typeof pb.admins.authWithPassword === 'function') {
    try {
      await pb.admins.authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
      ok(`authenticated as admin via pb.admins (${PB_ADMIN_EMAIL})`);
      return;
    } catch (e) {
      warn(`pb.admins.authWithPassword failed (${e.message}); trying _superusers collection`);
    }
  }
  await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  ok(`authenticated as superuser via _superusers collection (${PB_ADMIN_EMAIL})`);
}

/* ============================================================
   4. HELPERS
   ============================================================ */

// Find one record matching a PB filter; null if none / on error.
async function findOne(pb, collection, filter, params) {
  try {
    return await pb.collection(collection).getFirstListItem(pb.filter(filter, params || {}));
  } catch (e) {
    if (e && (e.status === 404 || e.status === 400)) return null; // 404 = none found
    if (/no rows|not found|404/i.test(e.message || '')) return null;
    throw e;
  }
}

// Ensure a users record exists for a given handle so relations
// (author) can be satisfied. Creates a placeholder author account
// with a derived deterministic email so re-runs find the same one.
async function ensureAuthor(pb, handle) {
  const h = String(handle || 'author').toLowerCase();
  const existing = await findOne(pb, 'users', 'handle = {:h}', { h });
  if (existing) return existing;
  // Build a VALID email local-part: collapse non-alnum runs to a single dot,
  // then trim leading/trailing dots (a handle like "nyx___" would otherwise
  // yield "nyx.@…", which PocketBase rejects as an invalid address).
  const local = h.replace(/[^a-z0-9]+/g, '.').replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '') || 'author';
  const email = `${local}@seed.wyrm.local`;
  // Placeholder author accounts exist only to satisfy `author` relations —
  // nobody logs into them. Use a RANDOM, unknowable password so the seed can
  // never create a guessable account in production. Override with
  // SEED_AUTHOR_PASSWORD only if you deliberately need to sign in as a seed author.
  // PocketBase caps passwords at 72 chars; two UUIDs (78) overflow it, so trim.
  const password = process.env.SEED_AUTHOR_PASSWORD || `Wyrm-${randomUUID()}-${randomUUID()}`.slice(0, 70);
  try {
    const rec = await pb.collection('users').create({
      email,
      emailVisibility: false,
      password,
      passwordConfirm: password,
      verified: true,
      handle: h,
      name: handle,
      role: 'user',
      reputation: 0,
    });
    ok(`created author @${h}`);
    return rec;
  } catch (e) {
    // Race / pre-existing email: re-query by handle.
    const again = await findOne(pb, 'users', 'handle = {:h}', { h });
    if (again) return again;
    throw new Error(`could not ensure author @${h}: ${e.message}`);
  }
}

const wordCount = (s) => (String(s || '').trim().match(/\S+/g) || []).length;
const excerptToHtml = (excerpt) => `<p>${String(excerpt || '').trim()}</p>`;

/* ============================================================
   5. SEED: flagship story "ashes" + node tree
   ============================================================ */
async function seedFlagship(pb, NODES) {
  step('Flagship story "ashes" (Пепел Аркадии)');

  const SLUG = 'ashes';
  const ROOT_AUTHOR = 'eira_noct';
  const FLAGSHIP = {
    slug: SLUG,
    title: 'Пепел Аркадии',
    author_handle: ROOT_AUTHOR,
    synopsis:
      'Когда последний дракон пробуждается под мёртвым городом, наездница Кейра должна выбрать: спасти Аркадию или сжечь её дотла. История, которую дописывает сообщество — глава за главой, развилка за развилкой.',
    tags: ['dark-fantasy', 'war', 'redemption'],
    contributors: 47,
    branches: NODES.length,
    hot: true,
  };

  // The community the flagship belongs to (created in seedCommunities;
  // we link it here if present).
  const ashesCommunity = await findOne(pb, 'communities', 'name = {:n}', { n: 'Гильдия Пепла' });

  let story = await findOne(pb, 'stories', 'slug = {:s}', { s: SLUG });
  if (story) {
    skip(`story "${SLUG}"`);
    stats.storiesSkipped++;
  } else {
    const author = await ensureAuthor(pb, ROOT_AUTHOR);
    story = await pb.collection('stories').create({
      slug: FLAGSHIP.slug,
      title: FLAGSHIP.title,
      author: author.id,
      author_handle: FLAGSHIP.author_handle,
      synopsis: FLAGSHIP.synopsis,
      tags: FLAGSHIP.tags,
      community: ashesCommunity ? ashesCommunity.id : '',
      contributors: FLAGSHIP.contributors,
      branches: FLAGSHIP.branches,
      hot: FLAGSHIP.hot,
    });
    ok(`created story "${SLUG}" (${story.id})`);
    stats.storiesCreated++;
  }

  // ---- nodes ----
  // Map old string ids (root, A, B, A1, …) → created record ids so
  // parent relations resolve. We iterate in array order; the source
  // already lists parents before children, but we also guard with a
  // resolve pass in case ordering ever changes.
  const idMap = {};      // oldId -> recordId
  const byOldId = Object.fromEntries(NODES.map((n) => [n.id, n]));

  // Pre-load any nodes already present for this story, keyed by title,
  // so we can detect existing ones idempotently (nodes have no natural
  // unique slug; title within a story is unique in the seed set).
  const existingNodes = await pb
    .collection('nodes')
    .getFullList({ filter: pb.filter('story = {:s}', { s: story.id }) })
    .catch(() => []);
  const existingByTitle = new Map(existingNodes.map((n) => [n.title, n]));

  // Resolve creation order: a node can be created once its parent
  // (if any) is already mapped. Loop until all are placed.
  const pending = [...NODES];
  let guard = NODES.length * NODES.length + 1;
  while (pending.length && guard-- > 0) {
    const n = pending.shift();
    const parentOld = n.parent;
    if (parentOld && !idMap[parentOld]) {
      // parent not yet created — requeue (defensive; source is ordered)
      if (!byOldId[parentOld]) {
        warn(`node "${n.id}" references unknown parent "${parentOld}" — creating without parent`);
      } else {
        pending.push(n);
        continue;
      }
    }

    const existing = existingByTitle.get(n.title);
    if (existing) {
      idMap[n.id] = existing.id;
      skip(`node "${n.id}" — ${n.title}`);
      stats.nodesSkipped++;
      continue;
    }

    const author = await ensureAuthor(pb, n.author);
    const html = excerptToHtml(n.excerpt);
    const rec = await pb.collection('nodes').create({
      story: story.id,
      parent: parentOld && idMap[parentOld] ? idMap[parentOld] : '',
      title: n.title,
      author: author.id,
      author_handle: n.author,
      canon: !!n.canon,
      score: typeof n.score === 'number' ? n.score : 0.3,
      votes: typeof n.votes === 'number' ? n.votes : 0,
      words: typeof n.words === 'number' ? n.words : wordCount(n.excerpt),
      tags: n.tags || [],
      excerpt: n.excerpt || '',
      html,
      chars: n.chars || {},
    });
    idMap[n.id] = rec.id;
    ok(`node "${n.id}" → ${rec.id} (${n.title})`);
    stats.nodesCreated++;
  }
  if (pending.length) {
    warn(`${pending.length} node(s) could not be placed (cyclic/broken parents): ${pending.map((p) => p.id).join(', ')}`);
  }

  return { story, idMap };
}

/* ============================================================
   6. SEED: communities
   ============================================================ */
async function seedCommunities(pb, COMMUNITIES_SEED) {
  step('Communities');
  const map = {}; // seed handle/id -> record
  for (const c of COMMUNITIES_SEED) {
    const existing = await findOne(pb, 'communities', 'name = {:n}', { n: c.name });
    if (existing) {
      map[c.id] = existing;
      skip(`community "${c.name}"`);
      stats.communitiesSkipped++;
      continue;
    }
    const ownerUser = c.owner ? await ensureAuthor(pb, c.owner) : null;
    const rec = await pb.collection('communities').create({
      name: c.name,
      blurb: c.blurb || '',
      tags: c.tags || [],
      hue: typeof c.hue === 'number' ? c.hue : 0,
      owner: c.owner || '',
      owner_id: ownerUser ? ownerUser.id : '',
      stories: c.stories || [],
      member_count: typeof c.members === 'number' ? c.members : 1,
    });
    map[c.id] = rec;
    ok(`created community "${c.name}" (${rec.id})`);
    stats.communitiesCreated++;
  }
  return map;
}

/* ============================================================
   7. SEED: sample feed posts
   ------------------------------------------------------------
   FEED posts have no natural unique key in the schema. We make
   them idempotent by stashing the seed id inside `ref.seedId` and
   matching on it. (ref is a json field the app already uses.)
   ============================================================ */
async function seedPosts(pb, FEED_SEED, communityMap) {
  step('Feed posts');

  // Map community-handle (e.g. "ashes-guild") used in FEED_SEED to the
  // created community record id where possible; the schema stores
  // `community` as plain text, so we keep the handle as a sensible
  // fallback if no record matched.
  const communityHandleToId = (handle) => {
    if (!handle) return '';
    const rec = communityMap[handle];
    return rec ? rec.id : handle;
  };

  // Pull existing seeded posts once (those carrying ref.seedId).
  const existingPosts = await pb
    .collection('posts')
    .getFullList({ sort: '-created' })
    .catch(() => []);
  const existingSeedIds = new Set(
    existingPosts
      .map((p) => (p.ref && typeof p.ref === 'object' ? p.ref.seedId : null))
      .filter(Boolean)
  );

  for (const f of FEED_SEED) {
    if (existingSeedIds.has(f.id)) {
      skip(`post "${f.id}" (@${f.author})`);
      stats.postsSkipped++;
      continue;
    }
    const author = await ensureAuthor(pb, f.author);
    // Preserve the app's ref shape, add seedId marker for idempotency.
    const ref = { ...(f.ref || {}), seedId: f.id };
    const reacts = f.reacts || {};
    const rec = await pb.collection('posts').create({
      author: author.id,
      author_handle: f.author,
      kind: f.kind || 'post',
      text: f.text,
      tags: f.tags || [],
      ref,
      community: communityHandleToId(f.community),
      like_count: typeof reacts.flame === 'number' ? reacts.flame : 0,
      save_count: typeof reacts.star === 'number' ? reacts.star : 0,
      comment_count: 0,
      repost_count: 0,
    });
    ok(`created post "${f.id}" → ${rec.id} (@${f.author})`);
    stats.postsCreated++;
  }
}

/* ============================================================
   8. MAIN
   ============================================================ */
async function main() {
  log('WYRM seed — target:', PB_URL);

  let NODES, COMMUNITIES_SEED, FEED_SEED;
  try {
    ({ NODES, COMMUNITIES_SEED, FEED_SEED } = loadSeedData());
    ok(`loaded seed data: ${NODES.length} nodes, ${COMMUNITIES_SEED.length} communities, ${FEED_SEED.length} posts`);
  } catch (e) {
    console.error('Failed to load seed data from repo source:', e.message);
    process.exit(1);
  }

  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false); // sequential awaits; avoid auto-cancel of "duplicate" reads

  step('Authentication');
  try {
    await authenticate(pb);
  } catch (e) {
    console.error('Authentication failed:', e.message);
    process.exit(1);
  }

  try {
    // Communities first so the flagship can link its community.
    const communityMap = await seedCommunities(pb, COMMUNITIES_SEED);
    await seedFlagship(pb, NODES);
    await seedPosts(pb, FEED_SEED, communityMap);
  } catch (e) {
    console.error('\nSeeding aborted with an error:', e.message);
    if (e.response && e.response.data) {
      console.error('Field errors:', JSON.stringify(e.response.data, null, 2));
    }
    process.exit(1);
  }

  /* ---------- summary ---------- */
  step('Summary');
  log(`  stories      : ${stats.storiesCreated} created, ${stats.storiesSkipped} existing`);
  log(`  nodes        : ${stats.nodesCreated} created, ${stats.nodesSkipped} existing`);
  log(`  communities  : ${stats.communitiesCreated} created, ${stats.communitiesSkipped} existing`);
  log(`  posts        : ${stats.postsCreated} created, ${stats.postsSkipped} existing`);
  const created =
    stats.storiesCreated + stats.nodesCreated + stats.communitiesCreated + stats.postsCreated;
  log(`\nDone. ${created === 0 ? 'Nothing new — instance already seeded (idempotent).' : `${created} record(s) created.`}`);
}

main().catch((e) => {
  console.error('Unexpected failure:', e);
  process.exit(1);
});
