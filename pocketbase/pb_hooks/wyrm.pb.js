/// <reference path="../pb_data/types.d.ts" />
//
// WYRM server-side hooks for PocketBase v0.22.x (tested API surface: v0.22.21).
//
// IMPORTANT — handler isolation (v0.22 JSVM):
//   PocketBase executes every hook handler in an ISOLATED goja runtime, so
//   functions/consts declared at the top level of a *.pb.js file are NOT in
//   scope inside the handlers (a top-level call throws `X is not defined`).
//   All shared logic therefore lives in ./wyrm_lib.js (a plain CommonJS module,
//   intentionally NOT named *.pb.js so PocketBase does not auto-load it) and is
//   reached with `const L = require(`${__hooks}/wyrm_lib.js`)` at the top of
//   each handler. `require()` results are cached per runtime, so this is cheap.
//
// IMPORTANT — API generation:
//   This targets the *pre-0.23* JSVM API: request hooks are
//   `onRecordAfterCreateRequest((e) => {...}, "collection")`, the DB layer is
//   reached via `$app.dao()`, records are saved with `$app.dao().saveRecord(r)`,
//   and handlers DO NOT call `e.next()` (introduced in v0.23). If PocketBase is
//   ever bumped to >= 0.23 this whole file must be rewritten.
//
// What it does:
//   1. Recompute a node's `votes`/`score` and the `canon` flag among siblings
//      whenever a vote record is created or deleted.
//   2. Sanitize `html` and derive `words`/`excerpt` before a node is saved.
//   3. Force author = requester on content (anti author-spoofing) + rate limits.
//   4. Field-protect role/reputation/canon/score/votes for non-admin callers.
//   5. Best-effort: bump the author's `reputation` and emit notifications.

// ----------------------------------------------------------------------------
// Hook: votes created  -> block self-vote, clamp weight, recompute target node
// ----------------------------------------------------------------------------

onRecordBeforeCreateRequest((e) => {
  const L = require(`${__hooks}/wyrm_lib.js`);
  if (L.isAdminRequest(e)) return;
  const nodeId = L.voteNodeId(e.record);
  if (!nodeId) return;
  let node = null;
  try { node = $app.dao().findRecordById("nodes", nodeId); } catch (_) { node = null; }
  const voter = e.record.getString("user");
  if (node && voter && node.getString("author") === voter) {
    throw new BadRequestError("Нельзя голосовать за собственный узел.");
  }
  // anti weight-injection: bound the stake to the voter's earned reputation.
  L.clampVoteWeight($app.dao(), e.record);
}, "votes");

onRecordAfterCreateRequest((e) => {
  const L = require(`${__hooks}/wyrm_lib.js`);
  try {
    L.recomputeForNode($app.dao(), L.voteNodeId(e.record));
  } catch (err) {
    L.logErr("onRecordAfterCreateRequest(votes)", err);
    // swallow: never fail the request because of a derived-stat hook
  }
}, "votes");

// AfterDelete still receives the (now-deleted) record via e.record, so we can
// read which node it pointed at; the row is gone, so the recompute excludes it.
onRecordAfterDeleteRequest((e) => {
  const L = require(`${__hooks}/wyrm_lib.js`);
  try {
    L.recomputeForNode($app.dao(), L.voteNodeId(e.record));
  } catch (err) {
    L.logErr("onRecordAfterDeleteRequest(votes)", err);
  }
}, "votes");

// ----------------------------------------------------------------------------
// Hook: node create/update  -> force author, sanitize html, derive words/excerpt
// ----------------------------------------------------------------------------

onRecordBeforeCreateRequest((e) => {
  const L = require(`${__hooks}/wyrm_lib.js`);
  try {
    L.forceAuthor(e, $app.dao()); // owner = requester (anti author-spoofing)
    L.sanitizeNodeRecord(e.record);
    // canon/score/votes are SERVER-DERIVED — never trust a regular client on
    // create. A node starts with no votes; canon is true only for a root. Admin/
    // service writes (seed, realtime persist) are TRUSTED to set canon explicitly.
    if (!L.isAdminRequest(e)) {
      const isRoot = e.record.getString("parent") === "";
      e.record.set("votes", 0);
      e.record.set("score", 0.3);
      e.record.set("canon", isRoot);
    }
  } catch (err) {
    L.logErr("onRecordBeforeCreateRequest(nodes)", err);
    // do not block creation on a sanitation failure; the client also sanitizes
  }
}, "nodes");

onRecordBeforeUpdateRequest((e) => {
  const L = require(`${__hooks}/wyrm_lib.js`);
  try {
    L.sanitizeNodeRecord(e.record);
    // Field-protect canon/score/votes: an author may edit prose but CANNOT
    // self-promote to canon or fake vote counts. Reset to stored values for
    // non-admin callers; only vote hooks (programmatic) and admins may change them.
    if (!L.isAdminRequest(e)) {
      const orig = $app.dao().findRecordById("nodes", e.record.getId());
      if (orig) {
        e.record.set("canon", orig.getBool("canon"));
        e.record.set("score", orig.getFloat("score"));
        e.record.set("votes", orig.getInt("votes"));
      }
    }
    L.restoreAuthor(e, $app.dao(), "nodes"); // author immutable on update
  } catch (err) {
    L.logErr("onRecordBeforeUpdateRequest(nodes)", err);
  }
}, "nodes");

// ----------------------------------------------------------------------------
// Hook: users create/update  -> field-protect role + reputation
// ----------------------------------------------------------------------------
//
// The default auth-collection update rule lets a user edit THEIR OWN record,
// which would let anyone PATCH role:"moderator" or inflate reputation. Force
// role/reputation to safe values for non-admin callers. Server-side reputation
// bumps go through dao.saveRecord() (programmatic, not a *Request hook), so they
// are unaffected. Superusers (Admin UI/API/seed) may still set anything.

onRecordBeforeCreateRequest((e) => {
  const L = require(`${__hooks}/wyrm_lib.js`);
  try {
    if (L.isAdminRequest(e)) return;
    e.record.set("role", "user");   // никто не регистрируется сразу модератором
    e.record.set("reputation", 0);
  } catch (err) {
    L.logErr("onRecordBeforeCreateRequest(users)", err);
  }
}, "users");

onRecordBeforeUpdateRequest((e) => {
  const L = require(`${__hooks}/wyrm_lib.js`);
  try {
    if (L.isAdminRequest(e)) return;
    const orig = $app.dao().findRecordById("users", e.record.getId());
    if (orig) {
      e.record.set("role", orig.getString("role") || "user");
      e.record.set("reputation", orig.getInt("reputation"));
    }
  } catch (err) {
    L.logErr("onRecordBeforeUpdateRequest(users)", err);
  }
}, "users");

// OAuth signup (Яндекс ID) creates a users record INTERNALLY — it does NOT go
// through onRecordBeforeCreateRequest, so our required `handle`/`role` stay
// empty and validation fails ("Missing required value"). onModelBeforeCreate
// fires on EVERY users create (incl. the OAuth internal save) BEFORE validation,
// so we fill them here. Guards are idempotent: a normal signup already has its
// handle/role set (by the request hook), so this is a no-op for it.
onModelBeforeCreate((e) => {
  const L = require(`${__hooks}/wyrm_lib.js`);
  try {
    const m = e.model;
    if (!m || typeof m.getString !== "function") return;
    if (!m.getString("role")) m.set("role", "user");
    L.ensureHandle(m, $app.dao());
  } catch (err) {
    L.logErr("onModelBeforeCreate(users)", err);
  }
}, "users");

// ----------------------------------------------------------------------------
// Hook: content collections create/update  -> force author, rate-limit
// ----------------------------------------------------------------------------
//
// posts/stories/comments accept a client-supplied `author` relation and only
// gate create with "@request.auth.id != ''"; without this a logged-in user
// could publish under someone else's id. (nodes handled in its own hook above.)

onRecordBeforeCreateRequest((e) => {
  const L = require(`${__hooks}/wyrm_lib.js`);
  L.rateLimit(e, $app.dao(), "posts"); // throws BadRequestError if over the limit
  try { L.forceAuthor(e, $app.dao()); } catch (err) { L.logErr("onRecordBeforeCreateRequest(posts)", err); }
}, "posts");

onRecordBeforeCreateRequest((e) => {
  const L = require(`${__hooks}/wyrm_lib.js`);
  try { L.forceAuthor(e, $app.dao()); } catch (err) { L.logErr("onRecordBeforeCreateRequest(stories)", err); }
}, "stories");

onRecordBeforeCreateRequest((e) => {
  const L = require(`${__hooks}/wyrm_lib.js`);
  L.rateLimit(e, $app.dao(), "comments"); // throws BadRequestError if over the limit
  try { L.forceAuthor(e, $app.dao()); } catch (err) { L.logErr("onRecordBeforeCreateRequest(comments)", err); }
}, "comments");

// UPDATE: author is immutable on all content collections (nodes handled above).
onRecordBeforeUpdateRequest((e) => {
  const L = require(`${__hooks}/wyrm_lib.js`);
  try { L.restoreAuthor(e, $app.dao(), "posts"); } catch (err) { L.logErr("onRecordBeforeUpdateRequest(posts)", err); }
}, "posts");

onRecordBeforeUpdateRequest((e) => {
  const L = require(`${__hooks}/wyrm_lib.js`);
  try { L.restoreAuthor(e, $app.dao(), "stories"); } catch (err) { L.logErr("onRecordBeforeUpdateRequest(stories)", err); }
}, "stories");

onRecordBeforeUpdateRequest((e) => {
  const L = require(`${__hooks}/wyrm_lib.js`);
  try { L.restoreAuthor(e, $app.dao(), "comments"); } catch (err) { L.logErr("onRecordBeforeUpdateRequest(comments)", err); }
}, "comments");

// ----------------------------------------------------------------------------
// Hooks: social events -> notifications (server is the only creator)
// ----------------------------------------------------------------------------

onRecordAfterCreateRequest((e) => {
  const L = require(`${__hooks}/wyrm_lib.js`);
  try {
    // bookmark (kind=save) is private — only a real like notifies the author.
    if (e.record.getString("kind") === "save") return;
    const dao = $app.dao();
    const post = dao.findRecordById("posts", e.record.getString("post"));
    if (!post) return;
    const recipient = post.getString("author");
    const actor = e.record.getString("user");
    if (recipient && recipient !== actor) {
      L.createNotification(dao, recipient, "like", { text: "твою запись отметили", post: post.getId() });
    }
  } catch (err) { L.logErr("notify(likes)", err); }
}, "likes");

onRecordAfterCreateRequest((e) => {
  const L = require(`${__hooks}/wyrm_lib.js`);
  try {
    const dao = $app.dao();
    const post = dao.findRecordById("posts", e.record.getString("post"));
    if (!post) return;
    const recipient = post.getString("author");
    const actor = e.record.getString("author");
    if (recipient && recipient !== actor) {
      L.createNotification(dao, recipient, "comment", { text: "новый комментарий к твоей записи", post: post.getId() });
    }
  } catch (err) { L.logErr("notify(comments)", err); }
}, "comments");

onRecordAfterCreateRequest((e) => {
  const L = require(`${__hooks}/wyrm_lib.js`);
  try {
    const repostOf = e.record.getString("repost_of");
    if (!repostOf) return;
    const dao = $app.dao();
    const orig = dao.findRecordById("posts", repostOf);
    if (!orig) return;
    const recipient = orig.getString("author");
    const actor = e.record.getString("author");
    if (recipient && recipient !== actor) {
      L.createNotification(dao, recipient, "repost", { text: "твою запись репостнули", post: orig.getId() });
    }
  } catch (err) { L.logErr("notify(repost)", err); }
}, "posts");
