"use strict";
/*
 * PDFStruct — knowledgebank data model.
 *
 * The workspace doubles as a knowledgebank builder: the outline
 * tree is a filing tool. The filing atom is the SECTION — title,
 * page range, and the section's own text — filed into user-created
 * CONTAINERS (name + colour, Firefox-container style) with
 * free-form TAGS. Filing stores the section's text AND its
 * generated outputs (.json/.md/.txt/.docx) alongside it in the
 * browser's local IndexedDB (see docstore.js) — downloadable at
 * any time, exportable as a bundle, never uploaded anywhere.
 *
 * Copyright © 2026 2351485 ALBERTA INC. — Apache-2.0 (see ../LICENSE).
 */
(function (root) {

const PALETTE = ["#e11d48", "#ea580c", "#ca8a04", "#16a34a",
  "#0284c7", "#4f46e5", "#9333ea", "#525252"];

let seq = 0;
function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-` +
    `${(++seq).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function wordCount(text) {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function makeContainer(name, color) {
  return {
    id: newId("c"),
    name: (name || "Untitled").trim() || "Untitled",
    color: PALETTE.includes(color) ? color : PALETTE[4],
    createdAt: Date.now(),
  };
}

// ------------------------------------------------------------- atoms

// The filing-time index: each passage carries its content-token
// counts, built when the item is filed (never at question time),
// so retrieval is a lookup, not a re-scan.
const INDEX_STOP = new Set(["a", "an", "and", "are", "as", "at", "be",
  "by", "for", "from", "in", "is", "it", "of", "on", "or", "that",
  "the", "this", "to", "with", "what", "which", "who", "whom",
  "when", "where", "why", "how", "does", "do", "did", "can",
  "could", "should", "would"]);

function indexTerms(text) {
  const terms = {};
  for (const t of (text || "").toLowerCase().split(/[^a-z0-9]+/)) {
    if (t && !INDEX_STOP.has(t)) terms[t] = (terms[t] || 0) + 1;
  }
  return terms;
}

function segmentText(text, citation) {
  const chunks = [];
  let buf = "";
  const flush = () => {
    const t = buf.trim();
    if (t) chunks.push({ text: t, citation, terms: indexTerms(t) });
    buf = "";
  };
  for (const line of (text || "").split("\n")) {
    if (!line.trim()) { flush(); continue; }
    buf += (buf ? "\n" : "") + line;
    if (buf.length > 700) flush();
  }
  flush();
  return chunks;
}

function sectionAtom(doc, node) {
  const citation =
    `${node.title} (p. ${node.page_start}–${node.page_end})`;
  return {
    id: newId("i"),
    kind: "section",
    title: node.title,
    sourceName: doc.source,
    docTitle: (doc.metadata && doc.metadata.title) || doc.source,
    pageStart: node.page_start,
    pageEnd: node.page_end,
    level: node.level,
    text: node.text || "",
    wordCount: node.word_count != null
      ? node.word_count : wordCount(node.text || ""),
    passages: segmentText(node.text || "", citation),
    containerIds: [],
    tags: [],
    notes: "",
    filedAt: Date.now(),
  };
}

// After a text edit, talk passages re-segment from the current
// text under the section's citation.
function resegment(item) {
  item.passages = segmentText(
    item.text, `${item.title} (p. ${item.pageStart}–${item.pageEnd})`);
  item.wordCount = wordCount(item.text);
  return item;
}

function flattenNodes(nodes, out = []) {
  for (const node of nodes || []) {
    out.push(node);
    flattenNodes(node.children, out);
  }
  return out;
}

// --------------------------------------------------------- artifacts
// The generated outputs for an item (.json/.md/.txt/.docx) are
// DERIVED: regenerated from the item's current state at
// download/export time (owner's management rule, 2026-11-05), so
// an edit to the stored text is never out of sync with the
// outputs. What is stored is the item itself.

function nodeForItem(item) {
  return {
    title: item.title,
    kind: "section",
    number: null,
    level: item.level || 1,
    page_start: item.pageStart,
    page_end: item.pageEnd,
    word_count: item.wordCount,
    text: item.text,
    children: [],
  };
}

function artifactsForItem(engine, item) {
  const node = nodeForItem(item);
  const mdLines = [];
  renderNode(engine, mdLines, node);
  return {
    json: JSON.stringify(node, null, 2),
    md: mdLines.join("\n"),
    txt: item.text,
    docx: engine.docxBytesForNode(node, item.docTitle),
  };
}

// Mirrors outputs.py _render_node for a single node.
function renderNode(engine, lines, node) {
  const hashes = "#".repeat(Math.min(2 + (node.level || 1), 6));
  lines.push(`${hashes} ${node.title} (p. ${node.page_start}–${node.page_end})`);
  lines.push("");
  if (node.text) { lines.push(node.text); lines.push(""); }
}

// ------------------------------------------------------------ bank ops
// The management operations over a storage adapter with the
// docstore bank shape ({listContainers, putContainer,
// deleteContainer, listItems, putItem, deleteItem}). The workspace
// calls these; the smoke tests drive them against an in-memory
// adapter to prove the full lifecycle.

function createOps(store) {
  return {
    async file(item) {
      await store.putItem(item);
      return item;
    },
    async save(item) {
      item.wordCount = wordCount(item.text);
      await store.putItem(item);
      return item;
    },
    async saveAs(item, newTitle) {
      const copy = {
        ...item,
        id: newId("i"),
        title: newTitle || `${item.title} (copy)`,
        filedAt: Date.now(),
      };
      await store.putItem(copy);
      return copy;
    },
    async move(item, containerIds) {
      item.containerIds = [...containerIds];
      await store.putItem(item);
      return item;
    },
    async remove(item) {
      await store.deleteItem(item.id);
    },
    // Deleting a container is explicit: "out" unfiles its items,
    // "with" deletes them with it. Records are really removed.
    async deleteContainer(container, mode) {
      const all = await store.listItems();
      for (const item of all) {
        if (!(item.containerIds || []).includes(container.id)) continue;
        if (mode === "with") {
          await store.deleteItem(item.id);
        } else {
          item.containerIds = item.containerIds
            .filter((id) => id !== container.id);
          await store.putItem(item);
        }
      }
      await store.deleteContainer(container.id);
    },
  };
}

// ------------------------------------------------------ search/export

function allTags(items) {
  return [...new Set(items.flatMap((i) => i.tags || []))].sort();
}

function filterItems(items, { containerId, tag, query } = {}) {
  const q = (query || "").trim().toLowerCase();
  return items.filter((i) => {
    if (containerId && !(i.containerIds || []).includes(containerId)) {
      return false;
    }
    if (tag && !(i.tags || []).includes(tag)) return false;
    if (q && !(i.title.toLowerCase().includes(q) ||
               (i.text || "").toLowerCase().includes(q))) return false;
    return true;
  });
}

function publicItem(item) {
  const { passages, ...rest } = item;
  return { ...rest, artifacts: ["json", "md", "txt", "docx"] };
}

function exportJson(product, containers, items) {
  return JSON.stringify({
    product,
    kind: "knowledgebank-export",
    exported_at: new Date().toISOString(),
    containers,
    items: items.map(publicItem),
  }, null, 2);
}

function exportMd(product, containers, items) {
  const byId = new Map(containers.map((c) => [c.id, c]));
  const groups = new Map();
  for (const item of items) {
    const ids = (item.containerIds || []).filter((id) => byId.has(id));
    const keys = ids.length ? ids : ["__none__"];
    for (const k of keys) {
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(item);
    }
  }
  const lines = [`# Knowledgebank — ${product}`, ""];
  const ordered = [...containers.map((c) => c.id), "__none__"];
  for (const key of ordered) {
    const group = groups.get(key);
    if (!group || !group.length) continue;
    lines.push(`## ${key === "__none__" ? "Unfiled" : byId.get(key).name}`, "");
    for (const item of group) {
      lines.push(`### ${item.title}`, "");
      lines.push(
        `- From: ${item.docTitle} (${item.sourceName})` +
        ` · pages ${item.pageStart}–${item.pageEnd}` +
        ` · ${item.wordCount} words` +
        ((item.tags || []).length ? ` · tags: ${item.tags.join(", ")}` : ""));
      if (item.notes) lines.push(`- Notes: ${item.notes}`);
      lines.push("", item.text || "", "");
    }
  }
  return lines.join("\n");
}

const api = {
  PALETTE, newId, wordCount, makeContainer, segmentText,
  sectionAtom, flattenNodes, nodeForItem, artifactsForItem,
  resegment, createOps, allTags, filterItems, exportJson, exportMd,
};
if (typeof module !== "undefined" && module.exports) module.exports = api;
root.PdfStructBank = api;

})(typeof self !== "undefined" ? self : globalThis);
