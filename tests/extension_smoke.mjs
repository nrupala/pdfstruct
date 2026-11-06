// Extension smoke test — exercises the self-contained (0.2.0+)
// in-browser engine end to end in Node: the vendored pdf.js build
// decomposes the fixture PDFs through extension/engine.js with the
// same expectations the Python suite asserts, the popup's own logic
// runs in a stub DOM with a stub engine (including the >25-page
// workspace routing), and static checks prove the companion-API
// design is gone (no loopback reference, no host permissions, no
// fixed timeout).
// Run: node tests/extension_smoke.mjs   (also wired into CI)
//
// Honest scope: this is Node + a stub DOM, NOT a real-browser
// unpacked load; that leg is recorded separately in the gate record.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const pdfjsLib = require("../extension/vendor/pdf.min.js");
pdfjsLib.GlobalWorkerOptions.workerSrc =
  require.resolve("../extension/vendor/pdf.worker.min.js");
const engine = require("../extension/engine.js");
const bank = require("../extension/bank.js");
const talk = require("../extension/talk.js");

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}`);
  if (!cond) failures++;
}

const fixture = (name) =>
  new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

// ---------------------------------------------- engine: bookmarked book
{
  const doc = await engine.extractDocument(
    pdfjsLib, fixture("sample_book.pdf"), "sample_book.pdf", null);
  check("toc: outline source", doc.outline_source === "toc");
  check("toc: two chapters", doc.outline.length === 2);
  const [c1, c2] = doc.outline;
  // Page ranges follow the Python engine exactly (verified against
  // extract_document on this fixture): a node ends the page before
  // the next bookmark — its own first child included.
  check("toc: chapter 1 range",
    c1.title === "Chapter 1 Foundations" &&
    c1.page_start === 1 && c1.page_end === 1);
  check("toc: section nested with own range",
    c1.children.length === 1 &&
    c1.children[0].title === "1.1 Scope and Limits" &&
    c1.children[0].level === 2 &&
    c1.children[0].page_start === 2 && c1.children[0].page_end === 2);
  check("toc: chapter 2 runs to book end",
    c2.title === "Chapter 2 Mechanisms" &&
    c2.page_start === 3 && c2.page_end === 4);
  check("toc: word counts computed", c1.word_count > 0);
  check("metadata", doc.metadata.title === "Sample Book" &&
    doc.metadata.author === "A. Author" && doc.metadata.pages === 4);
  const md = engine.toMarkdown(doc);
  check("md mirrors the Python writer",
    md.startsWith("# Sample Book") &&
    md.includes("- Outline source: toc") &&
    md.includes("## Chapter 1 Foundations (p. 1–1)"));
  check("txt is the full text", engine.toText(doc) === doc.text);
}

// ------------------------------------------------- engine: heading mode
{
  const doc = await engine.extractDocument(
    pdfjsLib, fixture("sample_book_notoc.pdf"), "sample_book_notoc.pdf", null);
  check("headings: outline source", doc.outline_source === "headings");
  const titles = doc.outline.map((n) => n.title);
  check("headings: chapters + appendix",
    titles.includes("Chapter 1 Foundations") &&
    titles.includes("Chapter 2 Mechanisms") &&
    titles.includes("Appendix A Tables"));
  check("headings: structure buckets",
    doc.structure.chapters.length === 2 &&
    doc.structure.appendices.length === 1);
  check("headings: page spans",
    doc.outline[0].page_start === 1 &&
    doc.outline[doc.outline.length - 1].page_start === 4);
}
{
  const doc = await engine.extractDocument(
    pdfjsLib, fixture("plain_book.pdf"), "plain_book.pdf", null);
  check("headings: section nests under chapter",
    doc.outline.length === 1 &&
    doc.outline[0].title === "Chapter 1 Alpha" &&
    doc.outline[0].children.length === 1 &&
    doc.outline[0].children[0].title === "Section 1 Background" &&
    doc.outline[0].children[0].level === 2);
}

// ------------------------------------------ heading guards (F1/F2/F4)
check("guard: money line rejected",
  engine.headingFromLine("$1,250.50 was credited to the account") === null);
check("guard: sentence-like numbered line rejected",
  engine.headingFromLine(
    "3. The parties agree to the terms set out below") === null);
{
  const h = engine.headingFromLine("Chapter 4 Results");
  check("guard: real chapter passes", !!h && h.kind === "chapter");
  const n = engine.headingFromLine("1.2 Methods And Materials");
  check("guard: numbered heading passes at level 2",
    !!n && n.kind === "numbered" && n.level === 2);
}

// ------------------------------------------- owner's-book shape (240 pp)
// The 2026-11-05 acceptance case (old design): a several-hundred-
// page textbook died at the popup's fixed 20 s timeout. Here the
// 240-page fixture must simply complete, with per-page progress —
// there is no timeout in the code (asserted statically below).
{
  const seen = [];
  const t0 = Date.now();
  const doc = await engine.extractDocument(
    pdfjsLib, fixture("big_book.pdf"), "big_book.pdf",
    (p, t) => seen.push([p, t]));
  check("big book: all 240 pages read", doc.metadata.pages === 240);
  check("big book: outline from bookmarks", doc.outline_source === "toc");
  check("big book: 12 chapters", doc.outline.length === 12);
  check("big book: chapter 6 range (Python parity)",
    doc.outline[5].page_start === 101 && doc.outline[5].page_end === 105);
  check("big book: sections nested", doc.outline.every(
    (c) => c.children.length === 2));
  check("big book: progress reported per page",
    seen.length === 240 && seen[239][0] === 240);
  console.log(`INFO big book decomposition took ${Date.now() - t0} ms in Node`);
}

// ------------------------------------------- knowledgebank round-trip
// File a section → persist (structured clone stands in for the
// IndexedDB round-trip) → reload → item present → export contains
// it → artifacts ride with the item → talk answers with the
// section citation.
{
  const doc = await engine.extractDocument(
    pdfjsLib, fixture("sample_book.pdf"), "sample_book.pdf", null);
  const nodes = bank.flattenNodes(doc.outline);
  check("bank: tree flattens to 3 sections", nodes.length === 3);
  const section = nodes.find((n) => n.title === "1.1 Scope and Limits");
  const atom = bank.sectionAtom(doc, section);
  const container = bank.makeContainer("Protection", "#16a34a");
  atom.containerIds = [container.id];
  atom.tags = ["scope"];

  const reloaded = structuredClone({ containers: [container], items: [atom] });
  const item = reloaded.items[0];
  check("bank: section survives the persistence round-trip",
    item.kind === "section" && item.pageStart === 2 &&
    item.pageEnd === 2 &&
    item.text.includes("defines the scope of the system"));
  const arts = bank.artifactsForItem(engine, item);
  check("bank: artifacts regenerate from the item (derived, not stored)",
    arts.json.includes("1.1 Scope and Limits") &&
    arts.md.includes("#### 1.1 Scope and Limits (p. 2–2)") &&
    arts.txt === item.text &&
    arts.docx[0] === 0x50 && arts.docx[1] === 0x4b &&
    new TextDecoder("latin1").decode(arts.docx)
      .includes("defines the scope of the system"));
  check("bank: passages carry the filing-time index",
    item.passages.length > 0 &&
    item.passages.every((p) => p.terms && typeof p.terms === "object") &&
    item.passages.some((p) => (p.terms.lineage || 0) > 0));
  check("bank: filters work",
    bank.filterItems(reloaded.items, { containerId: container.id })
      .length === 1 &&
    bank.filterItems(reloaded.items, { query: "lineage" }).length === 1 &&
    bank.filterItems(reloaded.items, { tag: "absent" }).length === 0);
  const expM = bank.exportMd("PDFStruct", reloaded.containers,
    reloaded.items);
  check("bank: md export contains the section under its container",
    expM.includes("## Protection") &&
    expM.includes("### 1.1 Scope and Limits") &&
    expM.includes("defines the scope of the system"));
  const expJ = JSON.parse(bank.exportJson(
    "PDFStruct", reloaded.containers, reloaded.items));
  check("bank: json export contains the section",
    expJ.items.length === 1 && expJ.items[0].kind === "section");

  const ans = talk.answer(item, "What does the scope body cover?");
  check("talk: grounded answer carries the section citation",
    ans.found && ans.hits.length > 0 &&
    ans.hits.every((h) =>
      h.citation === "1.1 Scope and Limits (p. 2–2)"));
  const miss = talk.answer(item, "What is the capital of France?");
  check("talk: unanswerable question says so", !miss.found);
  // The meter (owner's line): features are never size-gated; free
  // talk is 15 minutes of use in total, then it pauses.
  check("talk: meter allows under the allowance",
    talk.meterAllows({ usedSeconds: 0 }, null).allowed &&
    talk.meterAllows({ usedSeconds: 899 }, null).allowed);
  check("talk: meter pauses at the allowance",
    !talk.meterAllows({ usedSeconds: 900 }, null).allowed);
  check("talk: Pro (valid licence) removes the meter",
    talk.meterAllows({ usedSeconds: 99999 }, { status: "valid" }).allowed);
  check("talk: charging accumulates, min 1s per question",
    talk.chargeSeconds({ usedSeconds: 10 }, 0.2).usedSeconds === 11 &&
    talk.chargeSeconds({ usedSeconds: 10 }, 3.4).usedSeconds === 14);

  // Whole-decomposition docx (workspace download) is a real zip.
  const docx = engine.docxBytes(doc);
  check("engine: decomposition docx carries section text",
    docx[0] === 0x50 && docx[1] === 0x4b &&
    new TextDecoder("latin1").decode(docx)
      .includes("A mechanism transforms the current state"));
}

// ------------------------------------- bank management lifecycle (#6)
// save → edit → move → export reflects the edit → save-as → delete
// → gone after reload; container delete with both choices.
{
  const mkAdapter = () => {
    const containers = new Map(), items = new Map();
    return {
      listContainers: async () => [...containers.values()],
      putContainer: async (c) => { containers.set(c.id, c); },
      deleteContainer: async (id) => { containers.delete(id); },
      listItems: async () => [...items.values()],
      putItem: async (i) => { items.set(i.id, structuredClone(i)); },
      deleteItem: async (id) => { items.delete(id); },
    };
  };
  const adapter = mkAdapter();
  const ops = bank.createOps(adapter);
  const c1 = bank.makeContainer("Standards", "#0284c7");
  const c2 = bank.makeContainer("Archive", "#525252");
  await adapter.putContainer(c1);
  await adapter.putContainer(c2);
  const doc = await engine.extractDocument(
    pdfjsLib, fixture("sample_book.pdf"), "sample_book.pdf", null);
  const node = bank.flattenNodes(doc.outline)
    .find((n) => n.title === "Chapter 2 Mechanisms");
  const item = bank.sectionAtom(doc, node);
  item.containerIds = [c1.id];
  await ops.file(item);
  check("mgmt: filed section persists",
    (await adapter.listItems()).length === 1);

  item.title = "Chapter 2 Mechanisms — corrected";
  item.text = "A mechanism transforms the current state. Corrected.";
  item.notes = "errata applied";
  bank.resegment(item);
  await ops.save(item);
  let back = (await adapter.listItems())[0];
  check("mgmt: edit persists (title, text, notes)",
    back.title.includes("corrected") &&
    back.text.includes("Corrected.") &&
    back.notes === "errata applied");
  const arts = bank.artifactsForItem(engine, back);
  check("mgmt: artifacts follow the edited text",
    arts.txt.includes("Corrected.") &&
    arts.md.includes("Mechanisms — corrected"));

  await ops.move(back, [c2.id]);
  const expM = bank.exportMd("PDFStruct",
    await adapter.listContainers(), await adapter.listItems());
  check("mgmt: export reflects the edit and the move",
    expM.includes("## Archive") && expM.includes("Corrected."));

  const copy = await ops.saveAs(back, "Mechanisms — archive copy");
  check("mgmt: save-as makes a distinct copy",
    copy.id !== back.id && (await adapter.listItems()).length === 2);
  await ops.remove(back);
  check("mgmt: delete removes the record",
    (await adapter.listItems()).length === 1);
  await ops.deleteContainer(c2, "out");
  back = (await adapter.listItems())[0];
  check("mgmt: container delete (out) unfiles but keeps items",
    back.containerIds.length === 0);
  await ops.move(back, [c1.id]);
  await ops.deleteContainer(c1, "with");
  check("mgmt: container delete (with) deletes its items",
    (await adapter.listItems()).length === 0 &&
    (await adapter.listContainers()).length === 0);
}

// ------------------------------------------------------- popup behaviour
function makePopupWorld(pageCount) {
  const els = {};
  const mk = (id) => (els[id] = {
    files: [], style: {}, textContent: "", listeners: {},
    addEventListener(ev, fn) { this.listeners[ev] = fn; },
  });
  ["file", "go", "workspace", "prog", "out", "downloads",
   "dl-json", "dl-md", "dl-txt"].forEach(mk);
  els.file.files = [{
    name: "book.pdf", arrayBuffer: async () => new ArrayBuffer(8),
  }];
  const calls = { extracted: 0, put: 0, tabsCreated: [] };
  const docFixture = {
    source: "book.pdf", outline_source: "toc",
    outline: [{ title: "Chapter 1 Foundations", page_start: 1,
      page_end: 2, children: [] }],
    text: "x", metadata: { pages: 4 },
  };
  const sandbox = {
    document: {
      getElementById: (id) => els[id],
      createElement: () => ({ click() {}, style: {} }),
    },
    pdfjsLib: { GlobalWorkerOptions: {} },
    PdfStructEngine: {
      countPages: async () => pageCount,
      extractDocument: async () => { calls.extracted++; return docFixture; },
      toJson: () => "{}", toMarkdown: () => "#", toText: () => "x",
      stemOf: () => "book",
    },
    PdfStructDocStore: {
      put: async () => { calls.put++; },
      get: async () => null, forget: async () => {},
    },
    chrome: {
      runtime: { getURL: (p) => "chrome-extension://x/" + p },
      tabs: { create: (o) => { calls.tabsCreated.push(o.url); } },
    },
    URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => {} },
    Blob, setTimeout, console,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(
    readFileSync(new URL("../extension/popup.js", import.meta.url), "utf8"),
    sandbox);
  return { els, calls };
}

{
  const { els, calls } = makePopupWorld(4);
  await els.go.listeners.click();
  check("popup: small book decomposes in the popup", calls.extracted === 1);
  check("popup: outline rendered",
    els.out.textContent.includes("Chapter 1 Foundations (p. 1-2)"));
  check("popup: downloads offered", els.downloads.style.display === "block");
}
{
  const { els, calls } = makePopupWorld(240);
  await els.go.listeners.click();
  check("popup: 240-page book routed to the workspace",
    calls.extracted === 0 && calls.put === 1 &&
    calls.tabsCreated.some((u) => u.endsWith("workspace.html")));
  check("popup: routing explained to the user",
    els.out.textContent.includes("workspace"));
}

// ------------------------------------------------------------ static law
{
  const ext = (p) =>
    readFileSync(new URL(`../extension/${p}`, import.meta.url), "utf8");
  const manifest = JSON.parse(ext("manifest.json"));
  check("manifest: no API permissions",
    !("permissions" in manifest) || manifest.permissions.length === 0);
  check("manifest: exactly one host permission (licence validation)",
    JSON.stringify(manifest.host_permissions) ===
      JSON.stringify(["https://aimlds.org/*"]));
  check("manifest: version 0.2.0", manifest.version === "0.2.0");
  const code = ["popup.js", "workspace.js", "engine.js", "docstore.js"]
    .map(ext).join("\n");
  check("no loopback reference in extension code",
    !code.includes("127.0.0.1") && !code.includes("localhost"));
  check("no companion start instructions in extension code",
    !code.includes("pdfstruct-api") && !/start the api/i.test(code));
  check("no fixed timeout (the 20 s failure shape)",
    !code.includes("AbortController"));
  check("popup routes large documents to the workspace",
    ext("popup.js").includes("WORKSPACE_PAGE_LIMIT = 25") &&
    ext("popup.js").includes("PdfStructDocStore.put"));
  check("manifest: WASM allowed for the on-device model runtime",
    (manifest.content_security_policy?.extension_pages || "")
      .includes("wasm-unsafe-eval"));
  const fs = require("node:fs");
  const vendored = (p) => fs.existsSync(new URL(`../extension/${p}`, import.meta.url));
  check("vendored: pdf.js + transformers runtime + model config",
    vendored("vendor/pdf.min.js") &&
    vendored("vendor/transformers/transformers.min.mjs") &&
    vendored("vendor/transformers/ort-wasm-simd-threaded.jsep.wasm") &&
    vendored("vendor/models/qwen2.5-0.5b-instruct/config.json") &&
    vendored("vendor/models/qwen2.5-0.5b-instruct/tokenizer.json") &&
    vendored("vendor/models/qwen2.5-0.5b-instruct/LICENSE"));
  console.log("INFO model weights present in this tree: " +
    vendored("vendor/models/qwen2.5-0.5b-instruct/onnx/model_q4f16.onnx"));
}

process.exit(failures ? 1 : 0);
