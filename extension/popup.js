"use strict";
/*
 * PDFStruct popup — self-contained since 0.2.0.
 *
 * The outline is computed in this browser via the vendored pdf.js
 * engine (engine.js). There is no local API and nothing to install
 * or start: the pre-0.2.0 design POSTed the PDF to a companion API
 * process on the loopback interface and died at a fixed 20-second
 * timeout on a several-hundred-page textbook (owner's book,
 * 2026-11-05). That failure shape is designed out here: there is no
 * timeout anywhere, small documents extract page by page with
 * progress in this popup, and documents over 25 pages are routed to
 * the workspace tab, where a long extraction cannot be killed by
 * the popup closing.
 */
const WORKSPACE_PAGE_LIMIT = 25;

const lib = globalThis.pdfjsLib;
if (lib && typeof chrome !== "undefined" && chrome.runtime) {
  lib.GlobalWorkerOptions.workerSrc =
    chrome.runtime.getURL("vendor/pdf.worker.min.js");
}

let lastDoc = null;
const $ = (id) => document.getElementById(id);

function setProgress(page, total) {
  $("prog").textContent = total
    ? `Reading… page ${page} of ${total}`
    : "";
}

function renderOutline(nodes, depth, lines) {
  // Cap recursion so a deeply nested outline cannot overflow the
  // popup (adversarial-review fix, retained from the API design).
  if (depth > 50) return lines;
  for (const node of nodes || []) {
    lines.push(
      "  ".repeat(depth) +
        `${node.title} (p. ${node.page_start}-${node.page_end})`);
    renderOutline(node.children, depth + 1, lines);
  }
  return lines;
}

function openWorkspace() {
  chrome.tabs.create({ url: chrome.runtime.getURL("workspace.html") });
}

function download(fmt) {
  if (!lastDoc) return;
  const doc = lastDoc;
  const content = fmt === "json"
    ? PdfStructEngine.toJson(doc)
    : fmt === "md"
      ? PdfStructEngine.toMarkdown(doc)
      : PdfStructEngine.toText(doc);
  const type = fmt === "json" ? "application/json" : "text/plain";
  // Shared helper in docstore.js (attached-anchor click; the
  // detached anchor this replaced silently produced no file in a
  // real browser — defect F1, browser proof 2026-11-05).
  downloadBytes(`${PdfStructEngine.stemOf(doc.source)}.${fmt}`,
    content, type);
}

$("go").addEventListener("click", async () => {
  const out = $("out");
  const file = $("file").files[0];
  if (!file) {
    out.textContent = "Choose a PDF first.";
    return;
  }
  try {
    // Buffer discipline (same class as pdfx defect F2, browser
    // proof 2026-11-05): pdf.js TRANSFERS the buffer handed to
    // getDocument to its worker, detaching the caller's copy — a
    // buffer spent on the page-count probe is dead before
    // extraction starts. Read FRESH bytes from the File for every
    // pdf.js call, exactly as the workspace does.
    const pages = await PdfStructEngine.countPages(
      lib, new Uint8Array(await file.arrayBuffer()));
    if (pages > WORKSPACE_PAGE_LIMIT) {
      await PdfStructDocStore.put(file, file.name);
      openWorkspace();
      out.textContent =
        `“${file.name}” has ${pages} pages — opened in the workspace ` +
        "tab, where large books decompose with progress.";
      setProgress(0, 0);
      return;
    }
    lastDoc = await PdfStructEngine.extractDocument(
      lib, new Uint8Array(await file.arrayBuffer()), file.name,
      setProgress);
    setProgress(0, 0);
    const lines = renderOutline(lastDoc.outline, 0, []);
    out.textContent = lines.length > 0
      ? lines.join("\n")
      : "No outline found (no bookmarks, no detectable headings).";
    $("downloads").style.display = "block";
  } catch (err) {
    setProgress(0, 0);
    out.textContent =
      `Could not read that PDF: ${err.message || err}`;
  }
});

$("workspace").addEventListener("click", async () => {
  const file = $("file").files[0];
  if (file) await PdfStructDocStore.put(file, file.name);
  openWorkspace();
});

$("dl-json").addEventListener("click", () => download("json"));
$("dl-md").addEventListener("click", () => download("md"));
$("dl-txt").addEventListener("click", () => download("txt"));
