"use strict";
/*
 * PDFStruct workspace — the full-tab surface.
 *
 * Two views over one local store:
 * - Document: the feedreader for the current decomposition —
 *   outline tree (left, with search and a File button per section)
 *   and the section reader (right), downloads, and talk-to-the-page
 *   per section.
 * - Knowledgebank: containers/tags (navigation) · filed sections
 *   (list) · section text with its stored artifacts (reading pane),
 *   search and container/tag filters, .json/.md bundle export.
 *
 * Everything is local: decomposition by the vendored pdf.js engine,
 * storage in IndexedDB. The only network call this page can make is
 * licence validation (key + product id only) — never document
 * content. (The extension declares exactly one host permission,
 * for that endpoint.)
 */
const lib = globalThis.pdfjsLib;
if (lib && typeof chrome !== "undefined" && chrome.runtime) {
  lib.GlobalWorkerOptions.workerSrc =
    chrome.runtime.getURL("vendor/pdf.worker.min.js");
}

const $ = (id) => document.getElementById(id);
const store = PdfStructStorage;
const ops = PdfStructBank.createOps(store.bank);

let currentDoc = null;
let currentNode = null;
let containers = [];
let items = [];
let bankFilter = { containerId: null, tag: null, query: "" };
let selectedItem = null;
let pendingFilings = [];
let licence = null;
let selectedEl = null;

// ------------------------------------------------------------ helpers

function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text != null) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function downloadBytes(name, bytes, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function fillColorSelect(sel) {
  sel.innerHTML = "";
  for (const c of PdfStructBank.PALETTE) {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = "■";
    o.style.color = c;
    sel.appendChild(o);
  }
  sel.value = PdfStructBank.PALETTE[4];
}

// ------------------------------------------------------------- licence

async function loadLicence() {
  licence = await store.settings.get("licence");
}

function renderLicenceState() {
  $("licence-state").textContent = licence
    ? `Licence ••••${licence.tail} — status: ${licence.status}.`
    : "No licence on file.";
}

$("licence-validate").onclick = async () => {
  const key = $("licence-key").value.trim();
  const status = $("licence-status");
  if (!key) { status.textContent = "Enter a licence key first."; return; }
  status.textContent = "Validating…";
  try {
    const ok = await PdfStructTalk.validateLicence(key);
    licence = {
      status: ok ? "valid" : "invalid",
      tail: key.slice(-4),
      checkedAt: Date.now(),
    };
    await store.settings.put("licence", licence);
    status.textContent = ok
      ? "Licence valid — the talk meter is removed for good."
      : "That key was not accepted.";
  } catch (e) {
    licence = { status: "pending", tail: key.slice(-4), checkedAt: Date.now() };
    await store.settings.put("licence", licence);
    status.textContent =
      "The licence validation service is not live yet, so this key " +
      "could not be checked. Talk stays metered until it is.";
  }
  renderLicenceState();
};

// ---------------------------------------------------------------- talk

let talkMeter = { usedSeconds: 0 };

async function askTalk(itemLike, qEl, aEl, readerEl) {
  const q = qEl.value.trim();
  if (!q) return;
  const gate = PdfStructTalk.meterAllows(talkMeter, licence);
  if (!gate.allowed) {
    // One plain line, only here, only when the meter is spent.
    aEl.textContent =
      "Your free talk time (15 minutes in total) is used up — talk " +
      "is paused, not removed. Pro removes the meter for good: " +
      "About / Settings.";
    return;
  }
  const t0 = performance.now();
  aEl.textContent = "Searching the text…";
  const layer = await PdfStructModel.readyLayer().catch(() => null);
  const res = await PdfStructTalk.answerWithModel(itemLike, q, layer);
  talkMeter = PdfStructTalk.chargeSeconds(
    talkMeter, (performance.now() - t0) / 1000);
  await store.settings.put("talkmeter", talkMeter);
  aEl.innerHTML = "";
  aEl.appendChild(el("p", res.text));
  if (res.found) {
    const cites = el("p", null, "cites");
    cites.appendChild(document.createTextNode("From: "));
    res.hits.forEach((h, i) => {
      if (i) cites.appendChild(document.createTextNode(" · "));
      const b = el("button", h.citation, "citebtn");
      b.title = "Open this passage in the reader";
      b.onclick = () => highlightPassage(readerEl, h.text);
      cites.appendChild(b);
    });
    cites.appendChild(document.createTextNode(res.model
      ? ` · phrased on-device by ${res.model} from these passages`
      : " · retrieved passages, shown verbatim"));
    aEl.appendChild(cites);
  }
  const where = el("p", PdfStructModel.describe(), "wherelabel");
  aEl.appendChild(where);
}

// Citation discipline: a citation opens its exact passage in the
// local reader, highlighted (the field study's Emergency-Box bar).
function highlightPassage(pre, passageText) {
  if (!pre || !passageText) return;
  const full = pre.textContent;
  const anchor = passageText.trim().slice(0, 120);
  const idx = full.indexOf(anchor);
  if (idx === -1) return;
  const end = Math.min(full.length, idx + passageText.trim().length);
  pre.innerHTML = "";
  pre.appendChild(document.createTextNode(full.slice(0, idx)));
  const mark = document.createElement("mark");
  mark.textContent = full.slice(idx, end);
  pre.appendChild(mark);
  pre.appendChild(document.createTextNode(full.slice(end)));
  mark.scrollIntoView({ block: "center" });
}

// ---------------------------------------------------- model catalogue

async function renderModels() {
  const sel = PdfStructModel.getSelected();
  const used = talkMeter.usedSeconds || 0;
  $("model-state").textContent =
    `Selected: ${PdfStructModel.entryById(sel).name}. ` +
    PdfStructModel.describe() +
    (licence && licence.status === "valid"
      ? " Talk meter: removed (Pro)."
      : ` Free talk used: ${Math.floor(used / 60)}m ${used % 60}s ` +
        "of 15m in total.");
  const wrap = $("model-catalogue");
  wrap.innerHTML = "";
  wrap.appendChild(el("p",
    "Downloads bring MODELS to your machine — your documents never " +
    "leave it. Downloaded models live in this browser and work " +
    "offline afterwards.", "note"));
  for (const entry of [PdfStructModel.BUNDLED, ...PdfStructModel.CATALOG]) {
    const row = el("div", null, "modelrow");
    row.appendChild(el("span",
      `${entry.name} — ${entry.detail}`, "modelname"));
    if (sel === entry.id) {
      row.appendChild(el("span", "Selected", "note"));
    } else {
      const b = el("button", "Select");
      b.onclick = async () => {
        PdfStructModel.setSelected(entry.id);
        await store.settings.put("talkModel", entry.id);
        renderModels();
      };
      row.appendChild(b);
    }
    if (!entry.bundled) {
      const status = el("span", "", "note");
      const dl = el("button", "Download");
      dl.onclick = async () => {
        status.textContent = "Downloading…";
        try {
          await PdfStructModel.downloadModel(entry.id, (p) => {
            if (p && p.status === "progress" && p.progress != null) {
              status.textContent =
                `Downloading… ${Math.round(p.progress)}%`;
            }
          });
          status.textContent = "Downloaded and cached on this device.";
        } catch (e) {
          status.textContent =
            "The model catalogue host is not live yet — downloads " +
            "start when it is. The bundled model keeps working.";
        }
      };
      row.appendChild(dl);
      row.appendChild(status);
    }
    wrap.appendChild(row);
  }
  const clear = el("button", "Clear downloaded models");
  clear.onclick = async () => {
    await PdfStructModel.clearDownloads();
    renderModels();
  };
  wrap.appendChild(clear);
}

// ------------------------------------------------------- document view

function setProgress(page, total) {
  if (!total) {
    $("progresswrap").style.display = "none";
    return;
  }
  $("progresswrap").style.display = "block";
  $("bar").max = total;
  $("bar").value = page;
  $("progtext").textContent = `Reading… page ${page} of ${total}`;
}

function showNode(node) {
  currentNode = node;
  $("nodetitle").textContent = node.title;
  $("nodemeta").textContent =
    `Pages ${node.page_start}–${node.page_end} · ` +
    `${node.word_count} words` +
    (node.kind ? ` · ${node.kind}` : "");
  $("nodetext").textContent = node.text || "(no text in this range)";
  $("talk-doc").style.display = "block";
}

function nodeMatches(node, q) {
  if (!q) return true;
  if (node.title.toLowerCase().includes(q)) return true;
  return (node.children || []).some((c) => nodeMatches(c, q));
}

function buildTree(nodes, q, depth) {
  const ul = document.createElement("ul");
  if (depth > 0) ul.className = "nested";
  for (const node of nodes) {
    if (!nodeMatches(node, q)) continue;
    const li = document.createElement("li");
    const row = el("span", null, "noderow");
    const btn = el("button",
      `${node.title} · p. ${node.page_start}–${node.page_end}`, "node");
    btn.onclick = () => {
      if (selectedEl) selectedEl.classList.remove("selected");
      selectedEl = btn;
      btn.classList.add("selected");
      showNode(node);
    };
    const fb = el("button", "File", "filebtn");
    fb.title = "File this section into the knowledgebank";
    fb.onclick = () => openFilePanel(
      [{ atom: PdfStructBank.sectionAtom(currentDoc, node), node }],
      `File section — ${node.title}`);
    row.appendChild(btn);
    row.appendChild(fb);
    li.appendChild(row);
    if (node.children && node.children.length) {
      li.appendChild(buildTree(node.children, q, depth + 1));
    }
    ul.appendChild(li);
  }
  return ul;
}

function renderTree() {
  const q = $("search").value.trim().toLowerCase();
  const wrap = $("tree");
  wrap.innerHTML = "";
  if (!currentDoc) {
    wrap.appendChild(el("p", "No document yet.", "note"));
    return;
  }
  const full = {
    title: "Full document text",
    page_start: 1,
    page_end: currentDoc.metadata.pages,
    word_count: currentDoc.text
      ? currentDoc.text.split(/\s+/).filter(Boolean).length
      : 0,
    text: currentDoc.text,
    kind: "document",
    children: [],
  };
  const root = document.createElement("ul");
  const li = document.createElement("li");
  const btn = el("button", "Full document text", "node");
  btn.onclick = () => {
    if (selectedEl) selectedEl.classList.remove("selected");
    selectedEl = btn;
    btn.classList.add("selected");
    showNode(full);
  };
  li.appendChild(btn);
  root.appendChild(li);
  wrap.appendChild(root);
  if (currentDoc.outline && currentDoc.outline.length) {
    wrap.appendChild(buildTree(currentDoc.outline, q, 0));
  } else {
    wrap.appendChild(el("p",
      "No outline found (no bookmarks, no detectable headings).",
      "note"));
  }
}

function renderDoc(doc) {
  const m = doc.metadata || {};
  $("doctitle").textContent =
    m.title || PdfStructEngine.stemOf(doc.source);
  $("docmeta").textContent =
    [m.author && `Author: ${m.author}`, `${m.pages} pages`,
     `outline from ${doc.outline_source}`].filter(Boolean).join(" · ");
  renderTree();
  $("downloads").style.display = "block";
  $("forget").style.display = "inline-block";
  setProgress(0, 0);
  const first = doc.outline && doc.outline[0];
  if (first) showNode(first);
}

async function extractBlob(blob, name) {
  setProgress(0, 1);
  $("progtext").textContent = "Loading…";
  try {
    const buf = await blob.arrayBuffer();
    const doc = await PdfStructEngine.extractDocument(
      lib, new Uint8Array(buf), name, setProgress);
    currentDoc = doc;
    renderDoc(doc);
  } catch (e) {
    setProgress(0, 0);
    $("nodetext").textContent =
      `Could not read that PDF: ${e.message || e}`;
  }
}

for (const btn of document.querySelectorAll("#downloads [data-fmt]")) {
  btn.onclick = () => {
    if (!currentDoc) return;
    const fmt = btn.dataset.fmt;
    const doc = currentDoc;
    const stem = PdfStructEngine.stemOf(doc.source);
    if (fmt === "docx") {
      downloadBytes(`${stem}.docx`, PdfStructEngine.docxBytes(doc),
        "application/vnd.openxmlformats-officedocument" +
          ".wordprocessingml.document");
    } else {
      const content = fmt === "json" ? PdfStructEngine.toJson(doc)
        : fmt === "md" ? PdfStructEngine.toMarkdown(doc)
        : PdfStructEngine.toText(doc);
      downloadBytes(`${stem}.${fmt}`, content, "text/plain");
    }
  };
}

$("file-all").onclick = () => {
  if (!currentDoc) return;
  const entries = PdfStructBank.flattenNodes(currentDoc.outline)
    .map((node) => ({
      atom: PdfStructBank.sectionAtom(currentDoc, node), node,
    }));
  if (!entries.length) return;
  openFilePanel(entries,
    `File all ${entries.length} sections`);
};

$("talk-doc-ask").onclick = () => {
  if (!currentNode || !currentDoc) return;
  const atom = PdfStructBank.sectionAtom(currentDoc, currentNode);
  askTalk(
    { title: atom.title, text: atom.text, passages: atom.passages },
    $("talk-doc-q"), $("talk-doc-a"), $("nodetext"));
};

$("search").addEventListener("input", renderTree);

// -------------------------------------------------------------- filing

function openFilePanel(entries, title) {
  pendingFilings = entries;
  $("fp-title").textContent = title;
  const wrap = $("fp-containers");
  wrap.innerHTML = "";
  if (!containers.length) {
    wrap.appendChild(el("p",
      "No containers yet — name one below and it is created as you file.",
      "note"));
  }
  for (const c of containers) {
    const label = el("label", null, "fp-cont");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = c.id;
    const dot = el("span", "■ ");
    dot.style.color = c.color;
    label.appendChild(cb);
    label.appendChild(dot);
    label.appendChild(document.createTextNode(c.name));
    wrap.appendChild(label);
  }
  const dl = $("taglist");
  dl.innerHTML = "";
  for (const t of PdfStructBank.allTags(items)) {
    const o = document.createElement("option");
    o.value = t;
    dl.appendChild(o);
  }
  $("fp-tags").value = "";
  $("fp-nc-name").value = "";
  $("fp-status").textContent = "";
  $("filepanel").style.display = "block";
}

$("fp-cancel").onclick = () => {
  pendingFilings = [];
  $("filepanel").style.display = "none";
};

$("fp-save").onclick = async () => {
  if (!pendingFilings.length) return;
  let ids = [...document.querySelectorAll("#fp-containers input:checked")]
    .map((cb) => cb.value);
  const newName = $("fp-nc-name").value.trim();
  if (newName) {
    const c = PdfStructBank.makeContainer(newName, $("fp-nc-color").value);
    await store.bank.putContainer(c);
    containers.push(c);
    ids.push(c.id);
  }
  const tags = $("fp-tags").value.split(",")
    .map((t) => t.trim()).filter(Boolean);
  for (const { atom } of pendingFilings) {
    atom.containerIds = ids;
    atom.tags = tags;
    await ops.file(atom);
    items.push(atom);
  }
  $("fp-status").textContent =
    `Filed ${pendingFilings.length} section(s).`;
  pendingFilings = [];
  renderBankNav();
  renderBankList();
  setTimeout(() => { $("filepanel").style.display = "none"; }, 900);
};

// ---------------------------------------------------------- bank view

function switchView(name) {
  $("docview").style.display = name === "doc" ? "block" : "none";
  $("bankview").style.display = name === "bank" ? "block" : "none";
  $("settingsview").style.display =
    name === "settings" ? "block" : "none";
  $("view-doc").classList.toggle("selected", name === "doc");
  $("view-bank").classList.toggle("selected", name === "bank");
  $("view-settings").classList.toggle("selected", name === "settings");
  if (name === "bank") { renderBankNav(); renderBankList(); }
  if (name === "settings") { renderLicenceState(); renderModels(); }
}
$("view-doc").onclick = () => switchView("doc");
$("view-bank").onclick = () => switchView("bank");
$("view-settings").onclick = () => switchView("settings");

function renderBankNav() {
  const nav = $("bank-containers");
  nav.innerHTML = "";
  const mkRow = (label, id, color, container) => {
    const b = el("button", null, "banknav" +
      (bankFilter.containerId === id ? " selected" : ""));
    if (color) {
      const dot = el("span", "■ ");
      dot.style.color = color;
      b.appendChild(dot);
    }
    b.appendChild(document.createTextNode(label));
    b.onclick = () => {
      bankFilter.containerId = id;
      bankFilter.tag = null;
      renderBankNav();
      renderBankList();
    };
    nav.appendChild(b);
    if (container) {
      const del = el("button", "✕ delete", "condel-btn");
      del.onclick = () => askDeleteContainer(container);
      nav.appendChild(del);
    }
  };
  mkRow(`All items (${items.length})`, null, null);
  for (const c of containers) {
    const n = items.filter(
      (i) => (i.containerIds || []).includes(c.id)).length;
    mkRow(`${c.name} (${n})`, c.id, c.color, c);
  }
  const unfiled = items.filter(
    (i) => !(i.containerIds || []).length).length;
  if (unfiled) mkRow(`Unfiled (${unfiled})`, "__none__", null);

  const tags = $("bank-tags");
  tags.innerHTML = "";
  for (const t of PdfStructBank.allTags(items)) {
    const b = el("button", `#${t}`, "banknav tag" +
      (bankFilter.tag === t ? " selected" : ""));
    b.onclick = () => {
      bankFilter.tag = bankFilter.tag === t ? null : t;
      renderBankNav();
      renderBankList();
    };
    tags.appendChild(b);
  }
}

function visibleItems() {
  let list = items;
  if (bankFilter.containerId === "__none__") {
    list = list.filter((i) => !(i.containerIds || []).length);
  } else if (bankFilter.containerId) {
    list = list.filter(
      (i) => (i.containerIds || []).includes(bankFilter.containerId));
  }
  return PdfStructBank.filterItems(list, {
    tag: bankFilter.tag, query: bankFilter.query,
  });
}

function renderBankList() {
  const wrap = $("bank-items");
  wrap.innerHTML = "";
  const list = visibleItems();
  if (!list.length) {
    wrap.appendChild(el("p", "Nothing filed here yet.", "note"));
    return;
  }
  for (const item of list) {
    const b = el("button", null, "bankitem" +
      (selectedItem && selectedItem.id === item.id ? " selected" : ""));
    b.appendChild(el("span", item.title, "bi-t"));
    b.appendChild(el("span",
      `${item.docTitle} · p. ${item.pageStart}–${item.pageEnd} · ` +
      `${item.wordCount} words`, "bi-m"));
    b.onclick = () => selectItem(item);
    wrap.appendChild(b);
  }
}

function selectItem(item) {
  selectedItem = item;
  renderBankList();
  $("bi-title").textContent = item.title;
  const names = (item.containerIds || [])
    .map((id) => containers.find((c) => c.id === id))
    .filter(Boolean).map((c) => c.name);
  $("bi-meta").textContent =
    `From ${item.docTitle} (${item.sourceName}) · pages ` +
    `${item.pageStart}–${item.pageEnd} · ${item.wordCount} words` +
    (names.length ? ` · in: ${names.join(", ")}` : " · unfiled") +
    ((item.tags || []).length ? ` · tags: ${item.tags.join(", ")}` : "");
  $("bi-text").textContent = item.text;
  $("bi-notes").textContent = item.notes ? `Notes: ${item.notes}` : "";
  $("bi-artifacts").style.display = "block";
  $("bi-editor").style.display = "none";
  $("talk-bank").style.display = "block";
}

for (const btn of document.querySelectorAll("#bi-artifacts [data-art]")) {
  btn.onclick = () => {
    if (!selectedItem) return;
    const fmt = btn.dataset.art;
    // Artifacts regenerate from the item's current text on every
    // download — edits are never out of sync with outputs.
    const data = PdfStructBank.artifactsForItem(
      PdfStructEngine, selectedItem)[fmt];
    const stem = PdfStructEngine.stemOf(selectedItem.sourceName) +
      `-p${selectedItem.pageStart}-${selectedItem.pageEnd}`;
    if (fmt === "docx") {
      downloadBytes(`${stem}.docx`, data,
        "application/vnd.openxmlformats-officedocument" +
          ".wordprocessingml.document");
    } else {
      downloadBytes(`${stem}.${fmt}`, data, "text/plain");
    }
  };
}

$("bi-delete").onclick = async () => {
  if (!selectedItem) return;
  await ops.remove(selectedItem);
  items = items.filter((i) => i.id !== selectedItem.id);
  selectedItem = null;
  $("bi-title").textContent = "Knowledgebank";
  $("bi-text").textContent = "";
  $("bi-notes").textContent = "";
  $("bi-artifacts").style.display = "none";
  $("bi-editor").style.display = "none";
  $("talk-bank").style.display = "none";
  renderBankNav();
  renderBankList();
};

// ------------------------------------------------------- item editing

function openEditor() {
  if (!selectedItem) return;
  const item = selectedItem;
  $("ed-title").value = item.title;
  $("ed-tags").value = (item.tags || []).join(", ");
  $("ed-notes").value = item.notes || "";
  $("ed-text").value = item.text;
  const wrap = $("ed-containers");
  wrap.innerHTML = "";
  for (const c of containers) {
    const label = el("label", null, "fp-cont");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = c.id;
    cb.checked = (item.containerIds || []).includes(c.id);
    const dot = el("span", "■ ");
    dot.style.color = c.color;
    label.appendChild(cb);
    label.appendChild(dot);
    label.appendChild(document.createTextNode(c.name));
    wrap.appendChild(label);
  }
  $("bi-editor").style.display = "block";
}
$("bi-edit").onclick = openEditor;
$("ed-cancel").onclick = () => {
  $("bi-editor").style.display = "none";
};

function readEditor(item) {
  const textChanged = $("ed-text").value !== item.text;
  item.title = $("ed-title").value.trim() || item.title;
  item.tags = $("ed-tags").value.split(",")
    .map((t) => t.trim()).filter(Boolean);
  item.notes = $("ed-notes").value;
  item.containerIds =
    [...document.querySelectorAll("#ed-containers input:checked")]
      .map((cb) => cb.value);
  if (textChanged) {
    item.text = $("ed-text").value;
    PdfStructBank.resegment(item);
  }
  return item;
}

$("ed-save").onclick = async () => {
  if (!selectedItem) return;
  readEditor(selectedItem);
  await ops.save(selectedItem);
  $("bi-editor").style.display = "none";
  selectItem(selectedItem);
  renderBankNav();
};

$("ed-saveas").onclick = async () => {
  if (!selectedItem) return;
  const draft = { ...selectedItem };
  readEditor(draft);
  const copy = await ops.saveAs(draft, draft.title);
  items.push(copy);
  $("bi-editor").style.display = "none";
  renderBankNav();
  selectItem(copy);
};

// ------------------------------------------------- container deletion

let pendingDeleteContainer = null;
function askDeleteContainer(c) {
  pendingDeleteContainer = c;
  const n = items.filter(
    (i) => (i.containerIds || []).includes(c.id)).length;
  $("condel-text").textContent =
    `Delete container “${c.name}”? It holds ${n} filed item(s). ` +
    "Deleting is real — the records leave this browser's storage.";
  $("condel").style.display = "block";
}
$("condel-cancel").onclick = () => {
  pendingDeleteContainer = null;
  $("condel").style.display = "none";
};
async function doDeleteContainer(mode) {
  if (!pendingDeleteContainer) return;
  const c = pendingDeleteContainer;
  await ops.deleteContainer(c, mode);
  containers = containers.filter((x) => x.id !== c.id);
  items = await store.bank.listItems();
  if (selectedItem &&
      !items.some((i) => i.id === selectedItem.id)) {
    selectedItem = null;
    $("bi-text").textContent = "";
    $("bi-artifacts").style.display = "none";
  }
  pendingDeleteContainer = null;
  $("condel").style.display = "none";
  if (bankFilter.containerId === c.id) bankFilter.containerId = null;
  renderBankNav();
  renderBankList();
}
$("condel-out").onclick = () => doDeleteContainer("out");
$("condel-with").onclick = () => doDeleteContainer("with");

$("talk-bank-ask").onclick = () => {
  if (selectedItem) {
    askTalk(selectedItem, $("talk-bank-q"), $("talk-bank-a"),
      $("bi-text"));
  }
};

$("bank-search").addEventListener("input", () => {
  bankFilter.query = $("bank-search").value;
  renderBankList();
});

$("nc-add").onclick = async () => {
  const name = $("nc-name").value.trim();
  if (!name) return;
  const c = PdfStructBank.makeContainer(name, $("nc-color").value);
  await store.bank.putContainer(c);
  containers.push(c);
  $("nc-name").value = "";
  renderBankNav();
};

function exportSelection(containerOnly, fmt) {
  let cs = containers;
  let list = items;
  if (containerOnly) {
    const id = bankFilter.containerId;
    if (!id || id === "__none__") {
      $("bi-meta").textContent =
        "Pick a container first to export just that container.";
      return;
    }
    cs = containers.filter((c) => c.id === id);
    list = items.filter((i) => (i.containerIds || []).includes(id));
  }
  const content = fmt === "json"
    ? PdfStructBank.exportJson("PDFStruct", cs, list)
    : PdfStructBank.exportMd("PDFStruct", cs, list);
  downloadBytes(
    containerOnly ? "knowledgebank-container." + fmt
      : "knowledgebank." + fmt,
    content, "text/plain");
}
$("exp-bank-json").onclick = () => exportSelection(false, "json");
$("exp-bank-md").onclick = () => exportSelection(false, "md");
$("exp-cont-json").onclick = () => exportSelection(true, "json");
$("exp-cont-md").onclick = () => exportSelection(true, "md");

// -------------------------------------------------------------- inputs

$("file").addEventListener("change", async () => {
  const f = $("file").files[0];
  if (f) {
    await PdfStructDocStore.put(f, f.name);
    extractBlob(f, f.name);
  }
});

document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", async (e) => {
  e.preventDefault();
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) {
    await PdfStructDocStore.put(f, f.name);
    extractBlob(f, f.name);
  }
});

$("forget").onclick = async () => {
  await PdfStructDocStore.forget();
  location.reload();
};

// ---------------------------------------------------------------- init

fillColorSelect($("nc-color"));
fillColorSelect($("fp-nc-color"));

(async () => {
  await loadLicence();
  talkMeter = (await store.settings.get("talkmeter")) ||
    { usedSeconds: 0 };
  PdfStructModel.setSelected(
    (await store.settings.get("talkModel")) || undefined);
  containers = await store.bank.listContainers();
  items = await store.bank.listItems();
  const rec = await PdfStructDocStore.get();
  if (rec && rec.blob) extractBlob(rec.blob, rec.name);
})();
