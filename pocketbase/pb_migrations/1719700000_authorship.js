/// <reference path="../pb_data/types.d.ts" />
//
// Galathilion — авторский жизненный цикл контента (P5).
// Target: PocketBase v0.22.x (classic Dao/SchemaField API). ADDITIVE ONLY,
// idempotent. Даёт узлам/историям статус для «сделать свободной» и «скрыть»,
// не трогая правила (они уже разрешают автору update/delete). Существующие
// строки читаются как status='' === 'live'.

migrate(
  (db) => {
    const dao = new Dao(db);
    const select = (name, values) =>
      new SchemaField({ name, type: "select", required: false, options: { maxSelect: 1, values } });
    const text = (name) =>
      new SchemaField({ name, type: "text", required: false, options: { min: null, max: null, pattern: "" } });

    // nodes: status (live | abandoned | tombstoned) + note (сообщение ветвящимся)
    const nodes = dao.findCollectionByNameOrId("nodes");
    if (!nodes.schema.getFieldByName("status")) nodes.schema.addField(select("status", ["live", "abandoned", "tombstoned"]));
    if (!nodes.schema.getFieldByName("note")) nodes.schema.addField(text("note"));
    dao.saveCollection(nodes);

    // stories: status
    const stories = dao.findCollectionByNameOrId("stories");
    if (!stories.schema.getFieldByName("status")) stories.schema.addField(select("status", ["live", "abandoned", "tombstoned"]));
    dao.saveCollection(stories);
  },
  (db) => {
    const dao = new Dao(db);
    const nodes = dao.findCollectionByNameOrId("nodes");
    ["status", "note"].forEach((n) => { const f = nodes.schema.getFieldByName(n); if (f) nodes.schema.removeField(f.id); });
    dao.saveCollection(nodes);
    const stories = dao.findCollectionByNameOrId("stories");
    const f = stories.schema.getFieldByName("status"); if (f) stories.schema.removeField(f.id);
    dao.saveCollection(stories);
  }
);
