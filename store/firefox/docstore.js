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

  // ---------------------------------------------------------- downloads
  // The one download path for every page of this extension. This
  // file is the only non-vendor script loaded by BOTH the popup and
  // the workspace, so the helper lives here and nowhere else.
  //
  // Why the ceremony: Chrome extension pages ignore clicks on
  // DETACHED anchors (an <a> created but never appended). The 0.2.0
  // build clicked a detached anchor and every download button in
  // the product silently produced no file — proven in the owner's
  // real browser (browser proof 2026-11-05, defect F1). The anchor
  // is therefore attached, clicked, then removed.
  //
  // Gate 12 (loud failure): if a download cannot start, the helper
  // says so visibly in the page (and on the console) and returns
  // false — it never fails in silence.
  function noteDownloadFailure(name, err) {
    const msg = `Download of ${name} could not start — nothing was ` +
      `saved. (${(err && err.message) || err})`;
    try { console.error(msg); } catch (e) { /* console unavailable */ }
    try {
      let n = document.getElementById("dl-notice");
      if (!n) {
        n = document.createElement("div");
        n.id = "dl-notice";
        n.setAttribute("role", "alert");
        n.style.cssText = "position:sticky;bottom:0;z-index:999;" +
          "padding:8px 10px;margin-top:8px;background:#7f1d1d;" +
          "color:#fff;font-weight:600;";
        document.body.appendChild(n);
      }
      n.textContent = msg;
      n.style.display = "block";
    } catch (e) { /* no page to tell — the console line stands */ }
  }

  function downloadBytes(name, bytes, type) {
    let url = null;
    try {
      url = URL.createObjectURL(new Blob([bytes], { type }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      if (!a.isConnected) {
        throw new Error("the download link did not attach to the page");
      }
      a.click();
      a.remove();
      return true;
    } catch (e) {
      noteDownloadFailure(name, e);
      return false;
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  }

  const api = { store, docStore, bank, settings, downloadBytes };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PdfStructDocStore = docStore;
  root.PdfStructStorage = api;
  root.downloadBytes = downloadBytes;
})(typeof self !== "undefined" ? self : globalThis);
