# PDFStruct — store listing copy (Chrome Web Store / Edge Add-ons / Firefox AMO)

Rewritten 2026-11-05 for the self-contained extension (0.2.0). One
copy set, usable on all three stores; per-store field-length notes
are inline. Copyright © 2026 2351485 ALBERTA INC. Licence:
Apache-2.0 (code); commercial terms for hosted/managed offerings are
separate and do not apply to this free extension.

## Name

PDFStruct

## One-line summary

Decompose a PDF into its outline tree with page ranges and section text — entirely in your browser.
(99 characters; within Chrome's 132-char summary limit. Same text as
the extension manifest description. It replaces the 0.1.0 one-liner
under the owner's copy-truth rule: since 0.2.0 the decomposition
engine ships inside the extension, so "in your browser" is the exact
claim; CANONICAL-SHEET.md §1 records the change.)

## Full description

PDFStruct shows you the skeleton of a PDF before you read a page of it.

Pick a PDF and PDFStruct returns its outline tree — chapters,
appendices, parts and sections, nested in order, each with its page
range, word count, and its own text — decomposed by the engine that
ships inside the extension. Bookmarks/TOC are used when the PDF
carries them; otherwise the structure is detected from the
document's headings. Download the result as `.json` (the full tree),
`.md`, `.txt`, or `.docx` (Word, generated in the browser).

**Self-contained: install it and it works.** The decomposition
engine (pdf.js) ships inside the extension. There is nothing else
to download, install, or start — no companion app, no local server,
no account. The decomposition runs entirely in your browser; no
PDF, outline, or usage data is sent anywhere — there is no server,
no analytics, and no tracking.

**Big books get a room, not a popup.** Documents over 25 pages open
in the workspace — a full browser tab in feedreader format: the
outline tree on the left (with search), the selected section's text
on the right. Decomposition there proceeds page by page with a
progress bar and no time limit, so a several-hundred-page textbook
completes instead of dying against a popup. You can also send any
document to the workspace explicitly from the popup.

**A knowledgebank, not just an outline.** The tree is a filing
tool: file any section — or all of them — into containers you
create (name + colour) with your own tags. Filed sections are
fully manageable — save, edit (title, tags, containers, notes, and
the working text itself), move between containers, delete for
real — and their `.json` / `.md` / `.txt` / `.docx` outputs
regenerate from the current text at download time, so outputs are
never out of sync with your edits. Everything lives only in your
browser's local storage (IndexedDB): searchable, filterable by
container and tag, readable in the three-pane bank view, and
exportable per item, per container, or as a whole-bank bundle.

**Talk to the page.** Ask questions of the section you are
reading. Answers are grounded in the text itself: retrieval runs
over the document's own sections — the outline is the retrieval
structure — and returns the bearing passages with their citations
(click one to open it, highlighted, in the reader). A small AI
model ships inside the extension (Qwen2.5-0.5B, Apache-2.0) and
runs on your device to phrase answers from those passages; larger
7B-class models are available from an in-workspace catalogue,
downloaded to your machine on your click. Only models ever
travel — no document content leaves your machine for this
feature, ever. Every feature is fully available to everyone, on
documents of any size; free use includes 15 minutes of talk in
total, after which talk pauses (it never degrades). Pro — a
one-time payment, no subscription — removes the meter for life.
Decomposition, filing, and export are never metered.

**Who it's for:** anyone who works with long PDFs — books,
standards, manuals, reports, theses — and wants the map before the
territory.

**For power users:** the same engine is also a free, open-source
(Apache-2.0) Python package — CLI, local API and MCP server — for
scripts and pipelines: https://github.com/nrupala/pdfstruct. The
extension does not need it; it is there if you want it.

## What's new (0.2.1)

Two fixes, both found by testing 0.2.0 in a real browser:
downloads work again (every download button produced no file),
and the popup's small-file decomposition is fixed (its
page-count probe spent the buffer the extraction needed). This
text copies the CHANGELOG entry for Extension 0.2.1 verbatim,
per the update-chain rule.

## Category suggestion

- Chrome Web Store: **Productivity** (alternative: Developer Tools)
- Edge Add-ons: **Productivity**
- Firefox AMO: **Other** → or "Tabs & Bookmarks"-adjacent is wrong;
  use **Productivity / Other** as offered at submission time (AMO's
  category list is short; pick the closest productivity entry).

## Permission justifications (for reviewers)

- **No API permissions are declared** — no `activeTab`, no
  storage, history, tabs, or browsing-data access. The extension
  reads only the file the user picks in its own file chooser (or
  drops on its workspace page), at the moment they pick it, and
  processes it with the vendored pdf.js engine inside the browser.
- **host_permissions — `https://aimlds.org/*` only.** Used by
  exactly two user-initiated features, both in the workspace:
  talk-to-the-page licence validation (sends the licence key the
  user typed and the product id — never document content) and
  model catalogue downloads (the browser fetches model files from
  our host to the user's machine; only models travel). No other
  hosts are declared, and the extension makes no other network
  requests.
- **Local storage (IndexedDB):** when a document is routed to the
  workspace tab, the popup stores that one document in the
  browser's own IndexedDB (on this device only) so the workspace
  tab can read it; it is replaced by the next routed document and
  removable at any time with the workspace's "Forget document"
  button. Knowledgebank containers, filed sections, and the
  licence and talk-meter records likewise live only in IndexedDB
  on this device. Nothing is synced or transmitted.

## Privacy statement (store privacy fields + listing)

PDFStruct collects **no data at all**.

- No personal data, browsing data, file contents, or usage data is
  collected, stored, sold, or transmitted by this extension.
- A PDF the user explicitly selects is decomposed inside the
  user's own browser and nowhere else; it never leaves the user's
  device. The only network requests the extension can make are
  the two aimlds.org calls described above (licence key + product
  id; model downloads) — documents are never among them.
- A document routed to the workspace, and everything filed into
  the knowledgebank, is held in the browser's local IndexedDB on
  the device only.
- No analytics, telemetry, crash reporting, advertising, or
  third-party code of any kind. (The pdf.js engine is vendored into
  the package — Apache-2.0, Mozilla — and runs locally.)

Single-purpose statement (Chrome): PDFStruct's single purpose is to
display the structural outline of a user-selected PDF, computed
entirely inside the user's browser.

## Support

- Support email: info@aimlds.org
- Support site: https://aimlds.org
