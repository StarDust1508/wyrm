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

// On UPDATE, author is immutable: restore author/author_handle to the stored
// values for non-admin callers. Without this, the row-level updateRule
// (@request.auth.id = author.id) passes against the OLD author, then the body
// could reassign author to a foreign id — re-opening the spoof/reputation-farm
// that forceAuthor closes on create. (Moderators edit prose, not authorship.)
function restoreAuthor(e, dao, collection) {
  if (isAdminRequest(e)) return;
  try {
    const orig = dao.findRecordById(collection, e.record.getId());
    if (orig) {
      e.record.set("author", orig.getString("author"));
      e.record.set("author_handle", orig.getString("author_handle"));
    }
  } catch (_) {}
}

// Per-user create rate limits (anti-spam). max records / windowSec per author.
const RATE = {
  posts:    { max: 8,  windowSec: 60, authorField: "author" },
  comments: { max: 20, windowSec: 60, authorField: "author" },
};
function rateLimit(e, dao, collection) {
  if (isAdminRequest(e)) return;
  const cfg = RATE[collection];
  if (!cfg) return;
  const uid = requesterId(e);
  if (!uid) return;
  const sinceIso = new Date(Date.now() - cfg.windowSec * 1000).toISOString().replace("T", " ");
  try {
    const rows = dao.findRecordsByFilter(
      collection,
      cfg.authorField + " = {:u} && created >= {:t}",
      "", 0, 0, { u: uid, t: sinceIso }
    );
    if (rows && rows.length >= cfg.max) {
      throw new BadRequestError("Слишком часто. Подожди немного и попробуй снова.");
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err; // propagate the limit
    // any query error → don't block (fail open on the limiter itself)
  }
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
// HTML sanitation (server-side defense-in-depth; DOMPurify unavailable here)
// ----------------------------------------------------------------------------
//
// ALLOWLIST scrub (strictly stronger than a blocklist): drop any tag not in
// ALLOWED_TAGS, and strip ALL attributes except a vetted href on <a>. This
// removes on*-handlers, style, srcset, unknown elements, etc. without having
// to enumerate every dangerous vector. The client still renders through
// DOMPurify, which remains the authoritative guard.

var ALLOWED_TAGS = {
  p: 1, br: 1, b: 1, strong: 1, i: 1, em: 1, u: 1, s: 1, blockquote: 1,
  ul: 1, ol: 1, li: 1, h1: 1, h2: 1, h3: 1, h4: 1, a: 1, code: 1, pre: 1, hr: 1,
};

function safeHref(attrs) {
  var m = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!m) return "";
  var url = (m[2] || m[3] || m[4] || "").trim();
  if (/^\s*(javascript|vbscript|data)\s*:/i.test(url)) return "";   // dangerous schemes
  if (!/^(https?:\/\/|\/|#|mailto:)/i.test(url)) return "";          // allow only safe forms
  return url.replace(/"/g, "&quot;");
}

function sanitizeHtml(html) {
  if (!html || typeof html !== "string") return "";
  var out = html;

  // 1) remove whole dangerous element blocks WITH their content.
  var blockTags = ["script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "math"];
  for (var i = 0; i < blockTags.length; i++) {
    out = out.replace(new RegExp("<" + blockTags[i] + "\\b[\\s\\S]*?<\\/" + blockTags[i] + "\\s*>", "gi"), "");
  }

  // 2) allowlist pass: keep only ALLOWED_TAGS; strip every attribute except a
  //    vetted href on <a>. Unknown tags are removed (their text content stays).
  out = out.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, function (m, slash, name, attrs) {
    var tag = name.toLowerCase();
    if (!ALLOWED_TAGS[tag]) return "";
    if (slash) return "</" + tag + ">";
    if (tag === "a") {
      var href = safeHref(attrs);
      return href ? '<a href="' + href + '" rel="noopener nofollow" target="_blank">' : "<a>";
    }
    return "<" + tag + ">";
  });

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

// Create a notification record for a recipient. notifications.createRule is
// null (clients can't create), so this programmatic write is the ONLY source.
function createNotification(dao, userId, kind, ref) {
  if (!userId) return;
  try {
    const col = dao.findCollectionByNameOrId("notifications");
    const rec = new Record(col, { user: userId, kind: kind, ref: ref || {}, read: false });
    dao.saveRecord(rec);
  } catch (e) {
    logErr("createNotification(" + kind + ")", e);
  }
}

// Dedup canon notifications: a node that flaps in/out of canon must not spam a
// fresh "→ canon" row each time it re-enters. True if the author already has a
// canon notification for this node.
function hasCanonNotif(dao, userId, nodeId) {
  if (!userId || !nodeId) return false;
  try {
    const rows = dao.findRecordsByFilter("notifications", "user={:u} && kind='canon'", "-created", 100, 0, { u: userId });
    for (let i = 0; i < rows.length; i++) {
      let ref = rows[i].get("ref");
      if (typeof ref === "string") { try { ref = JSON.parse(ref); } catch (_) { ref = {}; } }
      if (ref && ref.node === nodeId) return true;
    }
  } catch (_) {}
  return false;
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
    if (shouldBe && !hasCanonNotif(dao, n.getString("author"), n.getId())) {
      createNotification(dao, n.getString("author"), "canon", { text: "Твоя глава вошла в канон ✦", node: n.getId() });
    }
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
    // canon/score/votes are SERVER-DERIVED — never trust a regular client on
    // create. A node starts with no votes; canon is true only for a root, every
    // branch starts non-canon until votes elect it. Admin/service writes (seed,
    // realtime persist) are TRUSTED to set canon explicitly — e.g. the realtime
    // service sends canon:false for relay turns and must not be force-canoned.
    if (!isAdminRequest(e)) {
      const isRoot = e.record.getString("parent") === "";
      e.record.set("votes", 0);
      e.record.set("score", 0.3);
      e.record.set("canon", isRoot);
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
    restoreAuthor(e, $app.dao(), "nodes"); // author immutable on update
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
  rateLimit(e, $app.dao(), "posts"); // throws BadRequestError if over the limit
  try { forceAuthor(e, $app.dao()); } catch (err) { logErr("onRecordBeforeCreateRequest(posts)", err); }
}, "posts");

onRecordBeforeCreateRequest((e) => {
  try { forceAuthor(e, $app.dao()); } catch (err) { logErr("onRecordBeforeCreateRequest(stories)", err); }
}, "stories");

onRecordBeforeCreateRequest((e) => {
  rateLimit(e, $app.dao(), "comments"); // throws BadRequestError if over the limit
  try { forceAuthor(e, $app.dao()); } catch (err) { logErr("onRecordBeforeCreateRequest(comments)", err); }
}, "comments");

// UPDATE: author is immutable on all content collections (nodes handled above).
onRecordBeforeUpdateRequest((e) => {
  try { restoreAuthor(e, $app.dao(), "posts"); } catch (err) { logErr("onRecordBeforeUpdateRequest(posts)", err); }
}, "posts");

onRecordBeforeUpdateRequest((e) => {
  try { restoreAuthor(e, $app.dao(), "stories"); } catch (err) { logErr("onRecordBeforeUpdateRequest(stories)", err); }
}, "stories");

onRecordBeforeUpdateRequest((e) => {
  try { restoreAuthor(e, $app.dao(), "comments"); } catch (err) { logErr("onRecordBeforeUpdateRequest(comments)", err); }
}, "comments");

// ----------------------------------------------------------------------------
// Hooks: social events -> notifications (server is the only creator)
// ----------------------------------------------------------------------------

onRecordAfterCreateRequest((e) => {
  try {
    // bookmark (kind=save) is private — only a real like notifies the author.
    if (e.record.getString("kind") === "save") return;
    const dao = $app.dao();
    const post = dao.findRecordById("posts", e.record.getString("post"));
    if (!post) return;
    const recipient = post.getString("author");
    const actor = e.record.getString("user");
    if (recipient && recipient !== actor) {
      createNotification(dao, recipient, "like", { text: "твою запись отметили", post: post.getId() });
    }
  } catch (err) { logErr("notify(likes)", err); }
}, "likes");

onRecordAfterCreateRequest((e) => {
  try {
    const dao = $app.dao();
    const post = dao.findRecordById("posts", e.record.getString("post"));
    if (!post) return;
    const recipient = post.getString("author");
    const actor = e.record.getString("author");
    if (recipient && recipient !== actor) {
      createNotification(dao, recipient, "comment", { text: "новый комментарий к твоей записи", post: post.getId() });
    }
  } catch (err) { logErr("notify(comments)", err); }
}, "comments");

onRecordAfterCreateRequest((e) => {
  try {
    const repostOf = e.record.getString("repost_of");
    if (!repostOf) return;
    const dao = $app.dao();
    const orig = dao.findRecordById("posts", repostOf);
    if (!orig) return;
    const recipient = orig.getString("author");
    const actor = e.record.getString("author");
    if (recipient && recipient !== actor) {
      createNotification(dao, recipient, "repost", { text: "твою запись репостнули", post: orig.getId() });
    }
  } catch (err) { logErr("notify(repost)", err); }
}, "posts");
