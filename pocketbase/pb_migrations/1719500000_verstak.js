/// <reference path="../pb_data/types.d.ts" />
//
// WYRM / Galathilion — "Верстак 2.0" schema additions.
// Target server: PocketBase v0.22.x (classic JSVM Dao/SchemaField API).
// Additive only: new node fields + new collections (drafts, revisions, codex,
// rep_ledger, plugins, plugin_installs). Safe to re-run (idempotent).

migrate(
  (db) => {
    const dao = new Dao(db);

    const idOf = (name) => {
      try { return dao.findCollectionByNameOrId(name).id; } catch (_) { return ""; }
    };
    const ensureCollection = (name, build) => {
      if (idOf(name)) return;
      dao.saveCollection(build());
    };

    const text = (name, required = false, extra = {}) =>
      new SchemaField({ name, type: "text", required, options: Object.assign({ min: null, max: null, pattern: "" }, extra) });
    const number = (name) =>
      new SchemaField({ name, type: "number", required: false, options: { min: null, max: null, noDecimal: false } });
    const bool = (name) =>
      new SchemaField({ name, type: "bool", required: false, options: {} });
    const json = (name) =>
      new SchemaField({ name, type: "json", required: false, options: { maxSize: 2000000 } });
    const relation = (name, targetName, required = false, opts = {}) =>
      new SchemaField({
        name, type: "relation", required,
        options: Object.assign({ collectionId: idOf(targetName), cascadeDelete: false, minSelect: null, maxSelect: 1, displayFields: null }, opts),
      });
    const select = (name, values, required = false, single = true) =>
      new SchemaField({ name, type: "select", required, options: { maxSelect: single ? 1 : values.length, values } });

    // =======================================================================
    // 1) nodes — add outline/structure fields (synopsis, beats, ord, stub)
    // =======================================================================
    {
      const nodes = dao.findCollectionByNameOrId("nodes");
      const has = (n) => nodes.schema.getFieldByName(n) != null;
      if (!has("synopsis")) nodes.schema.addField(text("synopsis"));
      if (!has("beats")) nodes.schema.addField(json("beats"));
      if (!has("ord")) nodes.schema.addField(number("ord"));        // sibling order index
      if (!has("stub")) nodes.schema.addField(bool("stub"));        // empty scene placeholder
      dao.saveCollection(nodes);
    }

    // =======================================================================
    // 2) drafts — per-author working drafts (autosave). story/parent as text ids
    //    (a new-book draft has no story yet). Owner-scoped across the board.
    // =======================================================================
    ensureCollection("drafts", () =>
      new Collection({
        name: "drafts",
        type: "base",
        listRule: "@request.auth.id = author.id",
        viewRule: "@request.auth.id = author.id",
        createRule: "@request.auth.id = author.id",
        updateRule: "@request.auth.id = author.id",
        deleteRule: "@request.auth.id = author.id",
        schema: [
          relation("author", "users", true),
          select("kind", ["newbook", "fork"], false, true),
          text("story"),          // story id/slug (empty for new book)
          text("parent"),         // parent node id (fork target)
          text("title"),
          text("synopsis"),
          text("html"),
          text("notes"),
          json("tags"),
          json("chars"),
          number("words"),
        ],
        indexes: ["CREATE INDEX `idx_drafts_author` ON `drafts` (`author`)"],
      })
    );

    // =======================================================================
    // 3) revisions — snapshot history of a node's prose. Public read (compare
    //    with canon/previous), author-only create; cascades with the node.
    // =======================================================================
    ensureCollection("revisions", () =>
      new Collection({
        name: "revisions",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id = author.id",
        updateRule: null,
        deleteRule: "@request.auth.id = author.id || @request.auth.role = 'moderator'",
        schema: [
          relation("node", "nodes", true, { cascadeDelete: true }),
          relation("story", "stories", false),
          relation("author", "users", false),
          text("title"),
          text("html", true),
          number("words"),
          text("label"),         // optional human label ("первый драфт", …)
        ],
        indexes: ["CREATE INDEX `idx_revisions_node` ON `revisions` (`node`)"],
      })
    );

    // =======================================================================
    // 4) codex — world bible entities (characters / places / items / lore).
    //    Public read; create by any author; edit/delete by owner or moderator.
    // =======================================================================
    ensureCollection("codex", () =>
      new Collection({
        name: "codex",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id = owner.id || @request.auth.role = 'moderator'",
        deleteRule: "@request.auth.id = owner.id || @request.auth.role = 'moderator'",
        schema: [
          relation("story", "stories", true),
          select("kind", ["character", "place", "item", "lore"], true, true),
          text("name", true),
          text("summary"),
          text("body"),
          json("meta"),          // arbitrary structured fields (status, relations…)
          number("color"),       // hue for the graph
          relation("owner", "users", false),
        ],
        indexes: ["CREATE INDEX `idx_codex_story` ON `codex` (`story`)"],
      })
    );

    // =======================================================================
    // 5) rep_ledger — reputation/royalty transactions. Owner reads own ledger;
    //    writes are programmatic (server hooks) only.
    // =======================================================================
    ensureCollection("rep_ledger", () =>
      new Collection({
        name: "rep_ledger",
        type: "base",
        listRule: "@request.auth.id = user.id",
        viewRule: "@request.auth.id = user.id",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        schema: [
          relation("user", "users", true),
          number("delta"),
          text("reason"),       // e.g. "canon", "stake", "uncanon"
          json("ref"),          // { story, node, … }
        ],
        indexes: ["CREATE INDEX `idx_rep_ledger_user` ON `rep_ledger` (`user`)"],
      })
    );

    // =======================================================================
    // 6) plugins — community extensions registry. Public read; create by any
    //    author; edit/delete by owner or moderator. installs/rating real.
    // =======================================================================
    ensureCollection("plugins", () =>
      new Collection({
        name: "plugins",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id = author.id || @request.auth.role = 'moderator'",
        deleteRule: "@request.auth.id = author.id || @request.auth.role = 'moderator'",
        schema: [
          relation("author", "users", false),
          text("author_handle"),
          text("name", true),
          text("slot"),         // where it mounts (reader|compose|feed…)
          text("glyph"),
          text("color"),
          text("cat"),          // category
          text("blurb"),
          text("code"),         // optional small declarative config/JSON
          number("installs"),
          number("rating"),
        ],
      })
    );

    // =======================================================================
    // 7) plugin_installs — one row per (plugin,user); drives real install count.
    // =======================================================================
    ensureCollection("plugin_installs", () =>
      new Collection({
        name: "plugin_installs",
        type: "base",
        listRule: "@request.auth.id = user.id",
        viewRule: "@request.auth.id = user.id",
        createRule: "@request.auth.id = user.id",
        updateRule: null,
        deleteRule: "@request.auth.id = user.id",
        schema: [
          relation("plugin", "plugins", true, { cascadeDelete: true }),
          relation("user", "users", true),
        ],
        indexes: ["CREATE UNIQUE INDEX `idx_plugin_installs_plugin_user` ON `plugin_installs` (`plugin`, `user`)"],
      })
    );
  },

  // ---- DOWN migration ------------------------------------------------------
  (db) => {
    const dao = new Dao(db);
    const drop = (name) => { try { dao.deleteCollection(dao.findCollectionByNameOrId(name)); } catch (_) {} };

    drop("plugin_installs");
    drop("plugins");
    drop("rep_ledger");
    drop("codex");
    drop("revisions");
    drop("drafts");

    try {
      const nodes = dao.findCollectionByNameOrId("nodes");
      const rm = (n) => { const f = nodes.schema.getFieldByName(n); if (f) nodes.schema.removeField(f.id); };
      rm("synopsis"); rm("beats"); rm("ord"); rm("stub");
      dao.saveCollection(nodes);
    } catch (_) {}
  }
);
