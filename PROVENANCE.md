# Provenance

Copyright © 2026 2351485 ALBERTA INC.

PDFStruct was commissioned on 2026-10-26 as an independent product built
from the book-era PDF tooling inside the owner's `nrupala/ocs-software`
repository (private). Both source components were read in full from
GitHub before any code was written; the first report
(`FIRST-REPORT-2026-10-26`, held in the product work folder) records the
verified read, including blob SHAs.

## Carried over from the source

- The two engines: PyPDF2 (page-marked extraction in
  `pdfextractor_tool/__init__.py`) and pdfminer.six (plain extraction in
  `pdfextractor_tool/extract_text.py`). **Deliberate substitution:** the
  product runs the PyPDF2 lineage through `pypdf`, its maintained
  successor — PyPDF2 3.0.1 carries CVE-2023-36464 (an infinite loop on
  a crafted PDF, found by pip-audit during this product's first release
  gate, 2026-10-26) and its own advisory directs users to migrate to
  pypdf. The engine name `pypdf2` is kept as a legacy alias.
- The heading idea: a regex over `Chapter` / `Appendix` / `Section`
  lines, from `src/ocs/subagents/pdf_extractor.py`.
- The term-index method: stopword-filtered token counts and top terms,
  from the same file.
- The OCS concept list (15 terms) — preserved as the named preset
  `--concepts-preset ocs`, not as a silent default.
- The workshop output discipline: a per-source output directory
  (`extracted_<stem>/`), from `extract_text.py`.
- The agent method names (`extract`, `parse_structure`, `index`,
  `extract_metadata`) as a compatibility face in `agent.py`.

## New in PDFStruct (not in the source)

- Per-page extraction, so structure can be attributed to pages.
- The hierarchical outline **tree**: nesting by level, page start/end,
  word counts, and each section's own body text.
- Outline extraction from the PDF's own bookmarks/TOC, used in
  preference to detected headings when present.
- Heading detection beyond the source's three keywords: `Part` and
  numbered headings (`1`, `1.1`, `1.1.1` …) with level inference.
- Decoded metadata (the source could return raw UTF-16 bytes).
- Structured outputs (`.json` tree, `.md` nested outline) — the source
  wrote plain `.txt` only.
- CLI flag `-o/--output-dir` that is actually honoured (the source's
  `extract_text.py` parsed `-o` and ignored it — a named regression
  test covers this).
- The CLI / local API / MCP server / browser-extension surfaces, the
  test suite, and this licence set.

## Relation to pdfx

pdfx (`nrupala/pdf-extractor`, public, MIT) was built earlier on
2026-10-26 from the same OCS source components and remains the free
text-extraction product. PDFStruct shares no code files with pdfx; it
was written independently against the OCS source. Nothing in this
repository changes pdfx's licence or any copy of pdfx already obtained
under MIT.
