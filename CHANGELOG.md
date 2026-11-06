# Changelog

Copyright © 2026 2351485 ALBERTA INC.

## [Extension 0.2.0] — 2026-11-05

The extension is now self-contained: the decomposition engine runs
entirely in your browser (no companion app to install or start),
large documents open in a full-tab workspace — outline tree on the
left, section text on the right — with page-by-page progress and
no time limit, and .json/.md/.txt downloads are produced in the
browser.

### Added

- In-browser decomposition engine (pdf.js, vendored into the
  extension): the PDF's bookmarks/TOC become the outline tree with
  page ranges, word counts and each section's own text; the
  heading-detection fallback carries the same phantom-heading
  guards as the Python engine.
- Workspace tab in feedreader format — searchable outline tree on
  the left, section reader on the right — with `.json` / `.md` /
  `.txt` downloads. Documents over 25 pages route here
  automatically; any document can be sent explicitly.
- Page-by-page progress in the popup and the workspace.
- Knowledgebank in the workspace: the outline tree is a filing
  tool — file any section (or all) into user-created containers
  (name + colour) with tags; full management (save, save-as,
  edit title/tags/containers/notes/working text, move, real
  delete; container delete with move-out or delete-with
  choice); outputs (`.json` / `.md` / `.txt` / `.docx`)
  regenerate from the item's current text at download;
  per-item, per-container and whole-bank export. Local
  IndexedDB only.
- Talk to the page: retrieval over the document's own sections
  (the outline is the retrieval structure), indexed at filing
  time, answers with clickable citations that open the passage
  in the reader; a bundled on-device model
  (Qwen2.5-0.5B-Instruct, Apache-2.0, via vendored
  Transformers.js) phrases answers from the retrieved passages,
  with a downloadable 7B-class model catalogue (models only
  ever travel; documents never leave). Free talk is metered at
  15 minutes of use in total and then pauses; Pro (one-time,
  lifetime, no subscription) removes the meter. No feature is
  size-gated.
- About / Settings area: the only commercial surface — tip jar
  (gratitude, whenever and as often as you wish), Pro purchase,
  and the licence-key field live there and nowhere else.

### Removed

- The companion local API dependency: the extension makes no
  loopback calls, and the manifest drops its loopback
  `host_permissions` and declares no API permissions at all (its
  one host permission covers only aimlds.org — licence
  validation and model downloads). The Python package's CLI,
  local API and MCP surfaces are unchanged and remain available
  for power users.
- The fixed 20-second popup timeout. It killed a
  several-hundred-page textbook in the owner's own use on
  2026-11-05; the fix is structural (workspace tab + progressive
  page-by-page processing), not a larger timeout value.

## Unreleased

- Independent multi-tester certification (2026-10-30): Lane A
  (fresh-eyes) SATISFACTORY WITH FINDINGS — F1–F4 fixed (phantom
  prose headings, CLI traceback on corrupt PDFs, TOC/heading text
  consistency). Lane B (adversarial) NOT SATISFACTORY — B-1–B-4 and
  three extension defects fixed the same day:
  - B-1 (HIGH): API upload filename traversal allowed arbitrary-file
    overwrite; only the base name is used now.
  - B-2: decompression-bomb PDFs are refused by an inflation
    pre-flight cap (256 MB) before any engine runs.
  - B-3: the MCP server answers non-object JSON and batch arrays
    with JSON-RPC errors instead of dying.
  - B-4: unreadable deep bookmarks now surface a `warnings` entry
    instead of silent outline loss.
  - Extension: unused `activeTab` permission removed; API 400s are
    reported as file rejections (not "API unreachable"); the popup
    fetch has a 20 s timeout.
- Hostile-fixture tests: malformed / empty / truncated PDFs fail
  cleanly on every surface; the API returns 400 without internals;
  the MCP server survives a bad call and keeps answering.
- Extension smoke test (`tests/extension_smoke.mjs`, zero-dependency
  DOM stub) wired into CI: popup posts to the local `/outline`
  endpoint, renders nested nodes, and names the start command when
  the API is down.

## 0.1.0 — 2026-10-26

First build, as a release candidate (not yet a public release).

- Decomposition core: per-page extraction (pdfminer.six / PyPDF2),
  bookmark/TOC outline in preference to detected headings, heading
  detection for Chapter / Appendix / Part / Section and numbered
  headings, nested outline tree with page ranges, word counts, and
  section body text; decoded metadata; configurable term/concept index.
- Surfaces: CLI (`pdfstruct`), local API (`pdfstruct-api`), MCP server
  (`pdfstruct-mcp`), MV3 browser extension scaffold.
- Outputs: `.json`, `.md`, `.txt` into a per-source output directory.
- Licence: Apache-2.0 + commercial services layer (see LICENSING.md).
