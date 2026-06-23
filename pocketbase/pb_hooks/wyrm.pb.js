/// <reference path="../pb_data/types.d.ts" />
//
// WYRM server-side hooks for PocketBase v0.22.x (tested API surface: v0.22.21).
//
// IMPORTANT — API generation:
//   This file targets the *pre-0.23* JSVM API. In v0.22 the request hooks are
//   `onRecordAfterCreateRequest((e) => {...}, "collection")`, the DB layer is
//   reached via `$app.dao()`, records are saved with `$app.dao().saveRecord(r)`,
//   and handlers DO NOT call `e.next()` (that was introduced in v0.23).
//   If you ever bump PocketBase to >= 0.23 this whole file must be rewritten
//   (hooks become `onRecordAfterCreateSuccess`, DAO methods move onto `$app`
//   directly, and every handler must end with `e.next()`).
//
// What it does:
//   1. Recompute a node's `votes`/`score` and the `canon` flag among siblings
//      whenever a vote record is created or deleted.
//   2. Sanitize `html` and derive `words`/`excerpt` before a node is saved.
//   3. Best-effort: bump the author's `reputation` when a node becomes canon.
//
// Assumed collections / fields:
//   votes : { node (relation->nodes), story (relation->stories, optional), user }
//   nodes : { parent (relation->nodes, empty=root), story (relation->stories),
//             author (relation->users), title, html (editor/text),
//             votes (number), score (number), canon (bool),
//             words (number), excerpt (text) }
//   users : { reputation (number) }
//
// The vote->node link field is auto-detected (tries "node", then "target",
// then "branch") so it is resilient to minor schema naming differences.

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------

const VOTE_NODE_FIELDS = ["node", "target", "branch"]; // first present wins
const REPUTATION_REWARD = 5;

function log() {
  // $app.logger() exists in v0.22; fall back to console if not.
  try {
    return $app.logger();
  } catch (_) {
    return null;
  }
}

function logErr(where, err) {
  const l = log();
  const msg = (err && err.message) ? err.message : String(err);
  if (l) {
    l.error("[wyrm.pb.js] " + where, "error", msg);
  } else {
    console.log("[wyrm.pb.js] " + where + ": " + msg);
  }
}

// True when the request is made by a superuser/admin (Admin UI or admin API).
// Such callers are allowed to set otherwise server-managed fields; ordinary
// authenticated users are not. Used to field-protect role/reputation/canon/…
// (PocketBase access rules are row-level and cannot protect individual fields).
function isAdminRequest(e) {
  try {
    const info = $apis.requestInfo(e.httpContext);
    return !!(info && info.admin);
  } catch (_) {
    return false;
  }
}

// Id of the authenticated user making the request ("" if none / on error).
function requesterId(e) {
  try {
    const info = $apis.requestInfo(e.httpContext);
    return info && info.authRecord ? info.authRecord.id : "";
  } catch (_) {
    return "";
  }
}

// Force the owner relation (and display handle) on a content record to the
// REQUESTER, so a logged-in user can't publish a node/post/story/comment under
// someone else's id (which would also farm reputation onto a foreign account
// when the node hits canon). Admin/seed requests are exempt.
function forceAuthor(e, dao, field) {
  if (isAdminRequest(e)) return;
  const uid = requesterId(e);
  if (!uid) return;
  e.record.set(field || "author", uid);
  try {
    const u = dao.findRecordById("users", uid);
    if (u) e.record.set("author_handle", u.getString("handle") || u.getString("name") || "");
  } catch (_) {}
}

// Hard ceiling for a single vote's weight regardless of reputation.
const HARD_WEIGHT_CAP = 1000;

// Clamp a vote's weight to [1, min(HARD_CAP, max(1, voter reputation))].
// A plain vote is always weight 1; a stake can never exceed the recognition
// points the voter has actually earned — closing the weight-injection bypass
// (client could otherwise POST weight=9999 and win canon single-handedly).
function clampVoteWeight(dao, voteRecord) {
  let w = voteRecord.getInt("weight");
  if (!w || w < 1) w = 1;
  let budget = 1;
  try {
    const uid = voteRecord.getString("user");
    if (uid) {
      const u = dao.findRecordById("users", uid);
      if (u) budget = Math.max(1, u.getInt("reputation"));
    }
  } catch (_) {}
  const cap = Math.min(HARD_WEIGHT_CAP, budget);
  if (w > cap) w = cap;
  voteRecord.set("weight", w);
}

// Resolve which field on a vote record points at the node.
function voteNodeField(voteRecord) {
  for (let i = 0; i < VOTE_NODE_FIELDS.length; i++) {
    const f = VOTE_NODE_FIELDS[i];
    const v = voteRecord.get(f);
    if (v !== undefined && v !== null && v !== "") return f;
  }
  return null;
}

function voteNodeId(voteRecord) {
  const f = voteNodeField(voteRecord);
  return f ? voteRecord.getString(f) : "";
}

function clamp01(x) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

// Sum the WEIGHT of vote records that reference a given node id, trying each
// candidate link field. A plain vote is weight 1; a stake of recognition
// points (stakeNode) is weight = points (TZ: «ставка = усиленный голос»).
// Missing/zero weight falls back to 1 so a normal vote always counts.
// Uses $dbx placeholder binding (NOT string concat) to avoid injection and
// to satisfy the v0.22 filter API.
function sumVoteWeightForNode(dao, nodeId) {
  for (let i = 0; i < VOTE_NODE_FIELDS.length; i++) {
    const field = VOTE_NODE_FIELDS[i];
    try {
      const rows = dao.findRecordsByFilter(
        "votes",
        field + " = {:nid}",
        "",            // sort (irrelevant for a sum)
        0,             // limit 0 == no limit in v0.22
        0,             // offset
        { nid: nodeId }
      );
      // If the collection has this field, this query succeeds; a non-empty
      // result, or a zero result on a valid field, is authoritative.
      if (Array.isArray(rows)) {
        let sum = 0;
        for (let j = 0; j < rows.length; j++) {
          const w = rows[j].getInt("weight");
          sum += (w && w > 0) ? w : 1;
        }
        return sum;
      }
    } catch (e) {
      // field probably doesn't exist on the votes collection — try the next.
    }
  }
  return 0;
}

// ----------------------------------------------------------------------------
// HTML sanitation (best-effort, server-side; DOMPurify is unavailable here)
// ----------------------------------------------------------------------------
//
// This is a blocklist scrub, not a true parser. It removes the high-risk
// vectors: <script>/<style>/<iframe>/<object>/<embed> blocks, on* event
// handler attributes, and javascript:/vbscript:/data:text-html URLs.
// The client still renders through DOMPurify, so this is defense-in-depth.

function sanitizeHtml(html) {
  if (!html || typeof html !== "string") return "";
  let out = html;

  // Remove whole dangerous element blocks (open tag .. close tag), case-insensitive.
  const blockTags = ["script", "style", "iframe", "object", "embed", "noscript"];
  for (let i = 0; i < blockTags.length; i++) {
    const t = blockTags[i];
    // <tag ...> ... </tag>
    out = out.replace(new RegExp("<" + t + "\\b[\\s\\S]*?<\\/" + t + "\\s*>", "gi"), "");
    // stray/self-closing/orphan open or close tags of the same kind
    out = out.replace(new RegExp("<\\/?" + t + "\\b[^>]*>", "gi"), "");
  }

  // Drop inline event-handler attributes: on*="..." | on*='...' | on*=bare
  out = out.replace(/\son[a-z0-9_-]+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son[a-z0-9_-]+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/\son[a-z0-9_-]+\s*=\s*[^\s>]+/gi, "");

  // Neutralize dangerous URL schemes inside href/src/srcset/style etc.
  // (handles optional whitespace and HTML entities between the scheme chars)
  const schemeRe = /(=\s*["']?\s*)(?:javascript|vbscript|data\s*:\s*text\/html|data\s*:\s*image\/svg\+xml)\s*:/gi;
  out = out.replace(schemeRe, "$1#");

  // Catch entity-encoded "javascript:" forms (e.g. java&#115;cript:)
  out = out.replace(/j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/gi, "");

  return out;
}

// Strip tags + collapse whitespace to get plain text for words/excerpt.
function htmlToText(html) {
  if (!html) return "";
  let t = String(html);
  // block-level tags become spaces so words don't merge across them
  t = t.replace(/<\/(p|div|br|li|h[1-6]|blockquote|tr|td|th)>/gi, " ");
  t = t.replace(/<br\s*\/?>/gi, " ");
  t = t.replace(/<[^>]+>/g, "");
  // decode the few entities that affect word counting / excerpt readability
  t = t.replace(/&nbsp;/gi, " ")
       .replace(/&amp;/gi, "&")
       .replace(/&lt;/gi, "<")
       .replace(/&gt;/gi, ">")
       .replace(/&quot;/gi, '"')
       .replace(/&#39;/gi, "'");
  return t.replace(/\s+/g, " ").trim();
}

function countWords(text) {
  if (!text) return 0;
  const parts = text.split(/\s+/).filter(function (w) { return w.length > 0; });
  return parts.length;
}

function makeExcerpt(text, max) {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max);
}

// ----------------------------------------------------------------------------
// Canon recompute (the core logic, shared by create/delete vote hooks)
// ----------------------------------------------------------------------------

// Symmetric reputation delta for an author (clamped at 0). Best-effort.
function adjustRep(dao, authorId, delta) {
  if (!authorId || !delta) return;
  try {
    const author = dao.findRecordById("users", authorId);
    if (!author) return;
    let next = author.getInt("reputation") + delta;
    if (next < 0) next = 0;
    author.set("reputation", next);
    dao.saveRecord(author);
  } catch (e) {
    logErr("adjustRep " + authorId, e);
  }
}

// Recompute the WHOLE canon path of a story ("лидер среди сиблингов", greedy
// from the leader root down) and apply canon flips + symmetric reputation.
// This is the authoritative mirror of the client's store.canonPath, and unlike
// a one-level sibling election it correctly RE-PARENTS the golden line: when a
// mid-tree node loses canon, its whole subtree drops out of canon too (no
// orphaned canon=true descendants).
function recomputeStoryCanon(dao, storyId) {
  if (!storyId) return;
  const nodes = dao.findRecordsByFilter("nodes", "story = {:sid}", "created", 0, 0, { sid: storyId });
  if (!nodes || nodes.length === 0) return;

  const kids = {}; // parentId|"__root" -> [records], in created order
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const p = n.getString("parent") || "__root";
    (kids[p] = kids[p] || []).push(n);
  }
  const eff = (n) => n.getInt("votes");
  const leader = (sibs) => {
    let best = sibs[0];
    for (let i = 1; i < sibs.length; i++) {
      const s = sibs[i];
      if (eff(s) > eff(best) || (eff(s) === eff(best) && s.getFloat("score") > best.getFloat("score"))) best = s;
    }
    return best;
  };

  // Greedy walk: single leader root -> its leading child -> ... (cycle-guarded).
  const canonIds = {};
  let cur = (kids["__root"] && kids["__root"].length) ? leader(kids["__root"]) : null;
  const guard = {};
  while (cur && !guard[cur.getId()]) {
    guard[cur.getId()] = true;
    canonIds[cur.getId()] = true;
    const ch = kids[cur.getId()];
    cur = (ch && ch.length) ? leader(ch) : null;
  }

  // Apply: flip only changed nodes; adjust reputation on each transition.
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const shouldBe = !!canonIds[n.getId()];
    const was = n.getBool("canon");
    if (was === shouldBe) continue;
    n.set("canon", shouldBe);
    dao.saveRecord(n);
    adjustRep(dao, n.getString("author"), shouldBe ? REPUTATION_REWARD : -REPUTATION_REWARD);
  }
}

function recomputeForNode(dao, nodeId) {
  if (!nodeId) return;
  const node = dao.findRecordById("nodes", nodeId);
  if (!node) return;

  // 1) refresh the just-voted node's votes/score (votes = summed vote weight).
  const votes = sumVoteWeightForNode(dao, nodeId);
  node.set("votes", votes);
  node.set("score", clamp01(0.3 + votes * 0.05));
  dao.saveRecord(node);

  // 2) recompute the entire canon path for the story (handles re-parenting).
  recomputeStoryCanon(dao, node.getString("story"));
}

// ----------------------------------------------------------------------------
// Hook: votes created  -> recompute target node
// ----------------------------------------------------------------------------

// Block voting/staking on your OWN node (anti-self-promotion). The vote's
// `user` is forced to the requester by the createRule (@request.auth.id =
// user.id), so comparing it to the node's author is sufficient.
onRecordBeforeCreateRequest((e) => {
  if (isAdminRequest(e)) return;
  const nodeId = voteNodeId(e.record);
  if (!nodeId) return;
  let node = null;
  try { node = $app.dao().findRecordById("nodes", nodeId); } catch (_) { node = null; }
  const voter = e.record.getString("user");
  if (node && voter && node.getString("author") === voter) {
    throw new BadRequestError("Нельзя голосовать за собственный узел.");
  }
  // anti weight-injection: bound the stake to the voter's earned reputation.
  clampVoteWeight($app.dao(), e.record);
}, "votes");

onRecordAfterCreateRequest((e) => {
  try {
    const nodeId = voteNodeId(e.record);
    recomputeForNode($app.dao(), nodeId);
  } catch (err) {
    logErr("onRecordAfterCreateRequest(votes)", err);
    // swallow: never fail the request because of a derived-stat hook
  }
}, "votes");

// ----------------------------------------------------------------------------
// Hook: votes deleted  -> recompute target node
// ----------------------------------------------------------------------------
//
// NOTE: in v0.22 the AfterDelete hook still receives the (now-deleted) record
// via e.record, so we can read which node it pointed at. The vote row is gone
// from the table by this point, so countVotesForNode() correctly excludes it.

onRecordAfterDeleteRequest((e) => {
  try {
    const nodeId = voteNodeId(e.record);
    recomputeForNode($app.dao(), nodeId);
  } catch (err) {
    logErr("onRecordAfterDeleteRequest(votes)", err);
  }
}, "votes");

// ----------------------------------------------------------------------------
// Hook: node create/update  -> sanitize html + derive words/excerpt
// ----------------------------------------------------------------------------

function sanitizeNodeRecord(record) {
  const raw = record.getString("html");
  const clean = sanitizeHtml(raw);
  if (clean !== raw) record.set("html", clean);

  const text = htmlToText(clean);
  record.set("words", countWords(text));
  record.set("excerpt", makeExcerpt(text, 320));
}

onRecordBeforeCreateRequest((e) => {
  try {
    forceAuthor(e, $app.dao()); // owner = requester (anti author-spoofing)
    sanitizeNodeRecord(e.record);
    // canon/score/votes are SERVER-DERIVED — never trust the client on create.
    // A node starts with no votes; canon is true only for a root (no parent),
    // every branch starts non-canon until votes elect it. Admins are exempt
    // (e.g. the seed script sets historical values via the admin API).
    if (!isAdminRequest(e)) {
      const isRoot = e.record.getString("parent") === "";
      e.record.set("votes", 0);
      e.record.set("score", 0.3);
      e.record.set("canon", isRoot);
    } else if (e.record.getString("parent") === "") {
      e.record.set("canon", true);
    }
  } catch (err) {
    logErr("onRecordBeforeCreateRequest(nodes)", err);
    // do not block creation on a sanitation failure; the client also sanitizes
  }
}, "nodes");

onRecordBeforeUpdateRequest((e) => {
  try {
    sanitizeNodeRecord(e.record);
    // Field-protect canon/score/votes: a node's author may edit prose, but
    // CANNOT self-promote to canon or fake vote counts. Reset these to the
    // stored values for non-admin callers; only vote hooks (programmatic
    // dao.saveRecord, which bypasses request hooks) and admins may change them.
    if (!isAdminRequest(e)) {
      const orig = $app.dao().findRecordById("nodes", e.record.getId());
      if (orig) {
        e.record.set("canon", orig.getBool("canon"));
        e.record.set("score", orig.getFloat("score"));
        e.record.set("votes", orig.getInt("votes"));
      }
    }
  } catch (err) {
    logErr("onRecordBeforeUpdateRequest(nodes)", err);
  }
}, "nodes");

// ----------------------------------------------------------------------------
// Hook: users create/update  -> field-protect role + reputation
// ----------------------------------------------------------------------------
//
// PocketBase access rules are row-level: the default auth-collection update
// rule lets a user edit THEIR OWN record, which would let anyone PATCH
// role:"moderator" or inflate reputation. These hooks force role/reputation
// to safe values for non-admin callers. The server's own reputation bumps go
// through dao.saveRecord() (programmatic, NOT a *Request hook), so they are
// unaffected. Superusers (Admin UI/API) may still set anything.

onRecordBeforeCreateRequest((e) => {
  try {
    if (isAdminRequest(e)) return;
    e.record.set("role", "user");   // никто не регистрируется сразу модератором
    e.record.set("reputation", 0);
  } catch (err) {
    logErr("onRecordBeforeCreateRequest(users)", err);
  }
}, "users");

onRecordBeforeUpdateRequest((e) => {
  try {
    if (isAdminRequest(e)) return;
    const orig = $app.dao().findRecordById("users", e.record.getId());
    if (orig) {
      e.record.set("role", orig.getString("role") || "user");
      e.record.set("reputation", orig.getInt("reputation"));
    }
  } catch (err) {
    logErr("onRecordBeforeUpdateRequest(users)", err);
  }
}, "users");

// ----------------------------------------------------------------------------
// Hook: content collections create  -> force author = requester
// ----------------------------------------------------------------------------
//
// posts/stories/comments accept a client-supplied `author` relation and only
// gate create with "@request.auth.id != ''", so without this a logged-in user
// could publish under someone else's id. (nodes is handled in its own create
// hook above.) Bind the owner to the requester; admin/seed are exempt.

onRecordBeforeCreateRequest((e) => {
  try { forceAuthor(e, $app.dao()); } catch (err) { logErr("onRecordBeforeCreateRequest(posts)", err); }
}, "posts");

onRecordBeforeCreateRequest((e) => {
  try { forceAuthor(e, $app.dao()); } catch (err) { logErr("onRecordBeforeCreateRequest(stories)", err); }
}, "stories");

onRecordBeforeCreateRequest((e) => {
  try { forceAuthor(e, $app.dao()); } catch (err) { logErr("onRecordBeforeCreateRequest(comments)", err); }
}, "comments");
