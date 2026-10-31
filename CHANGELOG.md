# Changelog

Copyright © 2026 2351485 ALBERTA INC.

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
