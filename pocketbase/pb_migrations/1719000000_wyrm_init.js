/// <reference path="../pb_data/types.d.ts" />
//
// WYRM — initial schema migration (TZ Appendix A).
// Target server: PocketBase v0.22.x (classic JSVM Dao/SchemaField API).
//
// API notes for this PB version:
//   - migrate((db) => up, (db) => down), where `db` is a dbx.Builder.
//   - new Dao(db) gives a transactional DAO scoped to the migration tx.
//   - Collections use `schema: [new SchemaField({...})]` (NOT the v0.23+ `fields`).
//   - Relations point at a target collection by `options.collectionId`; we resolve
//     ids at runtime via dao.findCollectionByNameOrId(name).id (ids are unknown at author time).
//   - Relation/select/file: maxSelect <= 1 (or 1) => single value; >1 => multiple (array).
//   - FileOptions REQUIRE a non-zero maxSize (PB validates maxSize >= 1), so every
//     file field sets maxSize explicitly (10 MB here).
//   - Indexes are raw SQL strings; PB auto-creates the system id/created/updated columns.
//
// Idempotency: creation is wrapped in a helper that skips a collection if it already
// exists, so re-running the up-migration on a partially-migrated DB is safe. The down
// migration deletes the collections in reverse dependency order.

migrate(
  (db) => {
    const dao = new Dao(db);

    // ---- helpers -----------------------------------------------------------

    // Return an existing collection's id by name, or "" if not found.
    const idOf = (name) => {
      try {
        return dao.findCollectionByNameOrId(name).id;
      } catch (_) {
        return "";
      }
    };

    // Create a base collection idempotently. `build` returns a Collection.
    const ensureCollection = (name, build) => {
      if (idOf(name)) {
        return; // already exists — skip (idempotent)
      }
      const collection = build();
      dao.saveCollection(collection);
    };

    // Field factory shorthands -------------------------------------------------

    const text = (name, required = false, extra = {}) =>
      new SchemaField({
        name,
        type: "text",
        required,
        options: Object.assign({ min: null, max: null, pattern: "" }, extra),
      });

    const number = (name, def = null) =>
      new SchemaField({
        name,
        type: "number",
        required: false,
        options: { min: null, max: null, noDecimal: false },
        // NOTE: PB has no schema-level "default value" for numbers; defaults like
        // `score=0.3` / `votes=0` are applied by app/server hooks on create.
        // `def` is kept only as documentation of the intended default.
      });

    const bool = (name) =>
      new SchemaField({
        name,
        type: "bool",
        required: false,
        options: {},
      });

    const json = (name) =>
      new SchemaField({
        name,
        type: "json",
        required: false,
        options: { maxSize: 2000000 }, // 2 MB
      });

    const fileImage = (name, multiple = false) =>
      new SchemaField({
        name,
        type: "file",
        required: false,
        options: {
          maxSelect: multiple ? 99 : 1,
          maxSize: 10485760, // 10 MB — required by PB (maxSize must be >= 1)
          mimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"],
          thumbs: [],
          protected: false,
        },
      });

    // single relation (maxSelect: 1); collectionId resolved at runtime by name.
    const relation = (name, targetName, required = false, opts = {}) =>
      new SchemaField({
        name,
        type: "relation",
        required,
        options: Object.assign(
          {
            collectionId: idOf(targetName),
            cascadeDelete: false,
            minSelect: null,
            maxSelect: 1, // single
            displayFields: null,
          },
          opts
        ),
      });

    const select = (name, values, required = false, single = true) =>
      new SchemaField({
        name,
        type: "select",
        required,
        options: {
          maxSelect: single ? 1 : values.length,
          values,
        },
      });

    // =======================================================================
    // 1) users (auth) — already exists. ADD missing fields rather than recreate.
    // =======================================================================
    {
      const users = dao.findCollectionByNameOrId("users");
      const has = (n) => users.schema.getFieldByName(n) != null;

      if (!has("handle")) {
        // unique + lowercase enforced via a unique index on lower(handle) below.
        users.schema.addField(text("handle", true));
      }
      if (!has("name")) {
        users.schema.addField(text("name", true));
      }
      if (!has("avatar")) {
        users.schema.addField(fileImage("avatar", false));
      }
      if (!has("role")) {
        users.schema.addField(select("role", ["user", "moderator"], true, true));
      }
      if (!has("reputation")) {
        users.schema.addField(number("reputation", 0));
      }

      // UNIQUE + case-insensitive handle. (PB's `lowercase` is not a schema flag in
      // v0.22; we approximate it with a unique index over lower(handle).)
      const idx = users.indexes || [];
      const hasHandleIdx = idx.some((s) => s.indexOf("idx_users_handle") !== -1);
      if (!hasHandleIdx) {
        idx.push("CREATE UNIQUE INDEX `idx_users_handle` ON `users` (LOWER(`handle`))");
        users.indexes = idx;
      }

      dao.saveCollection(users);
    }

    // =======================================================================
    // 2) communities  (referenced by stories.community and by owner_id->users)
    // =======================================================================
    ensureCollection("communities", () =>
      new Collection({
        name: "communities",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id != ''",
        // owner via free-text `owner` AND relation `owner_id`; ownership = owner_id.
        updateRule: "@request.auth.id = owner_id.id || @request.auth.role = 'moderator'",
        deleteRule: "@request.auth.id = owner_id.id || @request.auth.role = 'moderator'",
        schema: [
          text("name", true),
          text("blurb"),
          json("tags"),
          number("hue"),
          text("owner"),
          relation("owner_id", "users", false),
          json("stories"),
          number("member_count", 1),
        ],
      })
    );

    // =======================================================================
    // 3) stories  (relation -> users, optional relation -> communities)
    // =======================================================================
    ensureCollection("stories", () =>
      new Collection({
        name: "stories",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id = author.id || @request.auth.role = 'moderator'",
        deleteRule: "@request.auth.id = author.id || @request.auth.role = 'moderator'",
        schema: [
          text("slug", true),
          text("title", true),
          relation("author", "users", true),
          text("author_handle", true),
          text("synopsis"),
          json("tags"),
          relation("community", "communities", false),
          fileImage("cover", false),
          number("contributors", 1),
          number("branches", 1),
          bool("hot"),
        ],
        indexes: ["CREATE UNIQUE INDEX `idx_stories_slug` ON `stories` (`slug`)"],
      })
    );

    // =======================================================================
    // 4) nodes  (self-relation via parent; relation -> stories, users)
    // =======================================================================
    ensureCollection("nodes", () => {
      // For the self-relation `parent`, the nodes collection doesn't exist yet at
      // build time, so collectionId is resolved AFTER first save below.
      const col = new Collection({
        name: "nodes",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id != ''",
        // canon/score/votes are intended to be set by server hooks, not clients.
        updateRule: "@request.auth.id = author.id || @request.auth.role = 'moderator'",
        deleteRule: "@request.auth.id = author.id || @request.auth.role = 'moderator'",
        schema: [
          relation("story", "stories", true),
          // placeholder parent relation; collectionId patched after first save
          new SchemaField({
            name: "parent",
            type: "relation",
            required: false,
            options: {
              collectionId: "",
              cascadeDelete: false,
              minSelect: null,
              maxSelect: 1,
              displayFields: null,
            },
          }),
          text("title"),
          relation("author", "users", true),
          text("author_handle"),
          bool("canon"),
          number("score", 0.3),
          number("votes", 0),
          number("words", 0),
          json("tags"),
          text("excerpt"),
          text("html", true),
          json("chars"),
        ],
        indexes: [
          "CREATE INDEX `idx_nodes_story` ON `nodes` (`story`)",
          "CREATE INDEX `idx_nodes_parent` ON `nodes` (`parent`)",
        ],
      });
      return col;
    });

    // Patch the self-referential `parent.collectionId` now that nodes exists.
    {
      const nodes = dao.findCollectionByNameOrId("nodes");
      const parent = nodes.schema.getFieldByName("parent");
      if (parent && (!parent.options || !parent.options.collectionId)) {
        parent.options = {
          collectionId: nodes.id,
          cascadeDelete: false,
          minSelect: null,
          maxSelect: 1,
          displayFields: null,
        };
        dao.saveCollection(nodes);
      }
    }

    // =======================================================================
    // 5) votes  (relation -> nodes, users)  UNIQUE (node,user)
    // =======================================================================
    ensureCollection("votes", () =>
      new Collection({
        name: "votes",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id = user.id",
        updateRule: null,
        deleteRule: "@request.auth.id = user.id",
        schema: [
          relation("node", "nodes", true, { cascadeDelete: true }),
          relation("user", "users", true),
          number("weight", 1),
        ],
        indexes: ["CREATE UNIQUE INDEX `idx_votes_node_user` ON `votes` (`node`, `user`)"],
      })
    );

    // =======================================================================
    // 6) posts  (optional author -> users; self-relation repost_of -> posts)
    // =======================================================================
    ensureCollection("posts", () => {
      const col = new Collection({
        name: "posts",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id = author.id || @request.auth.role = 'moderator'",
        deleteRule: "@request.auth.id = author.id || @request.auth.role = 'moderator'",
        schema: [
          relation("author", "users", false),
          text("author_handle", true),
          text("kind"),
          text("text", true),
          json("tags"),
          json("ref"),
          text("community"),
          // placeholder self-relation; collectionId patched after first save
          new SchemaField({
            name: "repost_of",
            type: "relation",
            required: false,
            options: {
              collectionId: "",
              cascadeDelete: false,
              minSelect: null,
              maxSelect: 1,
              displayFields: null,
            },
          }),
          number("like_count", 0),
          number("save_count", 0),
          number("comment_count", 0),
          number("repost_count", 0),
          fileImage("media", true),
        ],
      });
      return col;
    });

    // Patch posts.repost_of self-relation collectionId.
    {
      const posts = dao.findCollectionByNameOrId("posts");
      const rp = posts.schema.getFieldByName("repost_of");
      if (rp && (!rp.options || !rp.options.collectionId)) {
        rp.options = {
          collectionId: posts.id,
          cascadeDelete: false,
          minSelect: null,
          maxSelect: 1,
          displayFields: null,
        };
        dao.saveCollection(posts);
      }
    }

    // =======================================================================
    // 7) likes  (relation -> posts, users)  UNIQUE (post,user,kind)
    // =======================================================================
    ensureCollection("likes", () =>
      new Collection({
        name: "likes",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id = user.id",
        updateRule: null,
        deleteRule: "@request.auth.id = user.id",
        schema: [
          relation("post", "posts", false, { cascadeDelete: true }),
          relation("user", "users", false),
          text("kind"),
        ],
        indexes: [
          "CREATE UNIQUE INDEX `idx_likes_post_user_kind` ON `likes` (`post`, `user`, `kind`)",
        ],
      })
    );

    // =======================================================================
    // 8) comments  (relation -> posts, optional users)
    // =======================================================================
    ensureCollection("comments", () =>
      new Collection({
        name: "comments",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id != ''",
        updateRule: null,
        deleteRule: "@request.auth.id = author.id || @request.auth.role = 'moderator'",
        schema: [
          relation("post", "posts", false, { cascadeDelete: true }),
          relation("author", "users", false),
          text("author_handle"),
          text("text", true),
        ],
      })
    );

    // =======================================================================
    // 9) memberships  (relation -> users; community as free text)  UNIQUE (community,user)
    // =======================================================================
    ensureCollection("memberships", () =>
      new Collection({
        name: "memberships",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id = user.id",
        updateRule: null,
        deleteRule: "@request.auth.id = user.id",
        schema: [text("community"), relation("user", "users", false)],
        indexes: [
          "CREATE UNIQUE INDEX `idx_memberships_community_user` ON `memberships` (`community`, `user`)",
        ],
      })
    );

    // =======================================================================
    // 10) merge_requests  (relation -> stories, nodes(source/target), users)
    // =======================================================================
    ensureCollection("merge_requests", () =>
      new Collection({
        name: "merge_requests",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id != ''",
        // update allowed for target node's author, the community owner, or a moderator.
        updateRule:
          "@request.auth.id = target.author.id || @request.auth.id = story.community.owner_id.id || @request.auth.role = 'moderator'",
        deleteRule:
          "@request.auth.id = target.author.id || @request.auth.id = story.community.owner_id.id || @request.auth.role = 'moderator'",
        schema: [
          relation("story", "stories", false),
          relation("source", "nodes", false),
          relation("target", "nodes", false),
          select("status", ["open", "approved", "merged", "rejected"], false, true),
          json("hunks"),
          relation("author", "users", false),
          json("approvals"),
        ],
      })
    );

    // =======================================================================
    // 11) reader_cuts  (relation -> stories, optional users)
    // =======================================================================
    ensureCollection("reader_cuts", () =>
      new Collection({
        name: "reader_cuts",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id = owner.id",
        deleteRule: "@request.auth.id = owner.id",
        schema: [
          relation("story", "stories", false),
          json("path"),
          relation("owner", "users", false),
          text("title"),
        ],
      })
    );

    // =======================================================================
    // 12) workspace_presets  (relation -> users, required)  index on user
    // =======================================================================
    ensureCollection("workspace_presets", () =>
      new Collection({
        name: "workspace_presets",
        type: "base",
        // owner-only across the board
        listRule: "@request.auth.id = user.id",
        viewRule: "@request.auth.id = user.id",
        createRule: "@request.auth.id = user.id",
        updateRule: "@request.auth.id = user.id",
        deleteRule: "@request.auth.id = user.id",
        schema: [relation("user", "users", true), text("name"), json("cfg")],
        indexes: ["CREATE INDEX `idx_workspace_presets_user` ON `workspace_presets` (`user`)"],
      })
    );

    // =======================================================================
    // 13) notifications  (relation -> users, required)
    // =======================================================================
    ensureCollection("notifications", () =>
      new Collection({
        name: "notifications",
        type: "base",
        // owner-only list/view/update; create left to server hooks (no createRule).
        listRule: "@request.auth.id = user.id",
        viewRule: "@request.auth.id = user.id",
        createRule: null,
        updateRule: "@request.auth.id = user.id",
        deleteRule: "@request.auth.id = user.id",
        schema: [
          relation("user", "users", true),
          select("kind", ["like", "comment", "repost", "canon", "room_turn"], false, true),
          json("ref"),
          bool("read"),
        ],
      })
    );
  },

  // ---- DOWN migration: delete in reverse dependency order ------------------
  (db) => {
    const dao = new Dao(db);

    const drop = (name) => {
      try {
        const col = dao.findCollectionByNameOrId(name);
        dao.deleteCollection(col);
      } catch (_) {
        // already gone — ignore
      }
    };

    // reverse of creation order (children before parents)
    drop("notifications");
    drop("workspace_presets");
    drop("reader_cuts");
    drop("merge_requests");
    drop("memberships");
    drop("comments");
    drop("likes");
    drop("posts");
    drop("votes");
    drop("nodes");
    drop("stories");
    drop("communities");

    // Revert the additive changes on the existing `users` auth collection.
    try {
      const users = dao.findCollectionByNameOrId("users");

      const removeField = (n) => {
        const f = users.schema.getFieldByName(n);
        if (f) {
          users.schema.removeField(f.id);
        }
      };
      removeField("handle");
      removeField("name");
      removeField("avatar");
      removeField("role");
      removeField("reputation");

      users.indexes = (users.indexes || []).filter(
        (s) => s.indexOf("idx_users_handle") === -1
      );

      dao.saveCollection(users);
    } catch (_) {
      // users not found — nothing to revert
    }
  }
);
