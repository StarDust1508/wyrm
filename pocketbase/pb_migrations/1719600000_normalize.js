/// <reference path="../pb_data/types.d.ts" />
//
// Galathilion — normalization & bugfix migration (PocketBase v0.22).
// Safe on the current EMPTY database (no rows to migrate).
//
// Fixes:
//  1. reader_cuts.story and merge_requests.story were `relation→stories`, but the
//     whole app addresses stories by SLUG (ctx.story = 'ashes'), so create/filter
//     with a slug 400'd and silently lost data (Сборка читателя / Слияние). The
//     app's convention is slug → make these TEXT fields. (DB empty ⇒ no data move.)
//  2. Missing indexes on hot server-filtered paths (feed/comments/likes/…).
//
// NOTE (intentionally omitted): cascadeDelete tweaks. Mutating a relation field's
// wrapped Go options in JSVM (Object.assign of f.options) injects a bound method
// that fails schema JSON marshaling ("unsupported type: func() bool") and aborts
// the whole migration. cascadeDelete will be added separately with a safe API.

migrate(
  (db) => {
    const dao = new Dao(db);
    const col = (n) => dao.findCollectionByNameOrId(n);
    const text = (name, required = false) =>
      new SchemaField({ name, type: "text", required, options: { min: null, max: null, pattern: "" } });

    // ---- 1) relation→text for the slug-addressed story fields ----------------
    const toTextStory = (collectionName) => {
      const c = col(collectionName);
      const f = c.schema.getFieldByName("story");
      if (f && f.type === "relation") {
        c.schema.removeField(f.id);
        c.schema.addField(text("story"));
        dao.saveCollection(c);
      }
    };
    toTextStory("reader_cuts");
    toTextStory("merge_requests");

    // ---- 2) indexes on hot filter paths (idempotent by index name) -----------
    const addIndex = (collectionName, sql) => {
      const c = col(collectionName);
      const idx = c.indexes || [];
      const name = (sql.match(/INDEX\s+`([^`]+)`/) || [])[1];
      if (name && idx.some((s) => s.indexOf("`" + name + "`") !== -1)) return;
      idx.push(sql);
      c.indexes = idx;
      dao.saveCollection(c);
    };
    addIndex("posts", "CREATE INDEX `idx_posts_author_handle` ON `posts` (`author_handle`)");
    addIndex("posts", "CREATE INDEX `idx_posts_community` ON `posts` (`community`)");
    addIndex("posts", "CREATE INDEX `idx_posts_kind` ON `posts` (`kind`)");
    addIndex("comments", "CREATE INDEX `idx_comments_post` ON `comments` (`post`)");
    addIndex("likes", "CREATE INDEX `idx_likes_user` ON `likes` (`user`)");
    addIndex("memberships", "CREATE INDEX `idx_memberships_user` ON `memberships` (`user`)");
    addIndex("notifications", "CREATE INDEX `idx_notifications_user` ON `notifications` (`user`)");
    addIndex("reader_cuts", "CREATE INDEX `idx_reader_cuts_owner` ON `reader_cuts` (`owner`)");
    addIndex("merge_requests", "CREATE INDEX `idx_merge_requests_story` ON `merge_requests` (`story`)");
  },

  // ---- DOWN: revert the story fields back to relations ---------------------
  (db) => {
    const dao = new Dao(db);
    const col = (n) => dao.findCollectionByNameOrId(n);
    const relation = (name, targetName) =>
      new SchemaField({
        name, type: "relation", required: false,
        options: { collectionId: (() => { try { return col(targetName).id; } catch (_) { return ""; } })(), cascadeDelete: false, minSelect: null, maxSelect: 1, displayFields: null },
      });
    const backToRelation = (collectionName) => {
      try {
        const c = col(collectionName);
        const f = c.schema.getFieldByName("story");
        if (f && f.type === "text") { c.schema.removeField(f.id); c.schema.addField(relation("story", "stories")); dao.saveCollection(c); }
      } catch (_) {}
    };
    backToRelation("reader_cuts");
    backToRelation("merge_requests");
  }
);
