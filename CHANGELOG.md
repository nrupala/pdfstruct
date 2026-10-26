# Changelog

Copyright © 2026 2351485 ALBERTA INC.

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
