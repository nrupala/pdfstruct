"use strict";
/*
 * Local storage for PDFStruct — IndexedDB, this browser
 * only. Nothing here is synced or transmitted; it is the user's own
 * on-device store.
 *
 * Stores (database "pdfstruct-workspace", version 2):
 * - "docs"      single-slot hand-off: the document the popup routed
 *               to the workspace tab (key "current").
 * - "containers" knowledgebank containers {id, name, color, createdAt}.
 * - "items"      knowledgebank filed items (atoms) with their text
 *               and generated artifacts (see bank.js for the model).
 * - "settings"  small key/value records (e.g. the licence record —
 *               the key itself is never re-displayed after entry).
 */
(function (root) {
  const DB_NAME = "pdfstruct-workspace";
  const STORES = ["docs", "containers", "items", "settings"];

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name);
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function request(mode, store, fn) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }

  const store = {
    put: (name, key, value) =>
      request("readwrite", name, (s) => s.put(value, key)),
    get: (name, key) =>
      request("readonly", name, (s) => s.get(key))
        .then((v) => v || null).catch(() => null),
    all: (name) =>
      request("readonly", name, (s) => s.getAll())
        .then((v) => v || []).catch(() => []),
    del: (name, key) =>
      request("readwrite", name, (s) => s.delete(key)),
  };

  const docStore = {
    put: (blob, name) =>
      store.put("docs", "current", { name, blob, savedAt: Date.now() }),
    get: () => store.get("docs", "current"),
    forget: () => store.del("docs", "current"),
  };

  const bank = {
    listContainers: () => store.all("containers"),
    putContainer: (c) => store.put("containers", c.id, c),
    deleteContainer: (id) => store.del("containers", id),
    listItems: () => store.all("items"),
    putItem: (item) => store.put("items", item.id, item),
    deleteItem: (id) => store.del("items", id),
  };

  const settings = {
    get: (key) => store.get("settings", key),
    put: (key, value) => store.put("settings", key, value),
  };

  const api = { store, docStore, bank, settings };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PdfStructDocStore = docStore;
  root.PdfStructStorage = api;
})(typeof self !== "undefined" ? self : globalThis);
