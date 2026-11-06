# PDFStruct

Decompose a PDF into its structure — a hierarchical outline tree with
page ranges and each section's own text — free, fully local.

Plain extractors give you a wall of text. PDFStruct gives you the
document's skeleton and the meat on each bone: chapters, appendices,
parts, sections, and numbered headings, nested in order, each node
carrying its level, page start/end, word count, and body text, plus
decoded metadata and a term index. Output as `.json` (the full tree),
`.md` (a nested, sectioned document), or `.txt` (plain text).

**Privacy: fully local.** No cloud, no account, no upload. The CLI, the
local API, the MCP server, and the browser extension all run on your
machine. There is no server copy of anything: deleting your data means
deleting the output files it wrote, and exporting your data is reading
them. See [PRIVACY.md](PRIVACY.md).

## How the outline is built

1. **The PDF's own bookmarks/TOC first** — when a document carries an
   outline, that is the authoritative hierarchy (`outline_source: "toc"`).
2. **Heading detection second** — `Chapter` / `Appendix` / `Part` /
   `Section` lines (the pattern from the OCS book tooling this product
   descends from) plus numbered headings (`1`, `1.1`, `1.1.1` …) with
   level inference (`outline_source: "headings"`).

## Quickstart

```bash
pip install -e .
pdfstruct mybook.pdf                 # writes extracted_mybook/ with .json, .md, .txt
pdfstruct mybook.pdf --info          # decoded metadata incl. page count
pdfstruct mybook.pdf -o out/ --format json
pdfstruct mybook.pdf --engine pypdf   # pypdf engine instead of pdfminer
pdfstruct mybook.pdf --concepts-preset ocs   # index for the OCS concept list
```

### Local API

```bash
pip install -e ".[api]"
pdfstruct-api                        # http://127.0.0.1:8766 (localhost by default)
curl http://127.0.0.1:8766/health
curl -F file=@mybook.pdf http://127.0.0.1:8766/extract
curl -F file=@mybook.pdf http://127.0.0.1:8766/outline
```

### MCP server (stdio)

```bash
pdfstruct-mcp
```

Tools: `pdf_outline`, `pdf_structure`, `pdf_metadata`. Point your MCP
client at the `pdfstruct-mcp` command.

### Browser extension

Load `extension/` unpacked (Developer mode in Chrome/Edge). Since 0.2.0
the extension is self-contained — the decomposition engine (pdf.js)
ships inside it; no local API needs to be running. Documents over 25
pages open in a full-tab workspace (outline tree + section reader),
with a knowledgebank (file outline sections into containers with
tags; edit, move, delete, export — all local in IndexedDB) and
talk-to-the-page (retrieval over the document's own sections with
citations, phrased by a bundled on-device model; free talk metered at
15 minutes of use, Pro is a one-time lifetime unlock — no
subscription). Downloads `.json` / `.md` / `.txt` / `.docx`.
See `extension/README.md`.

(The bundled model weights are not in git — GitHub's file limit;
`tools/fetch-model.sh` restores them, SHA-256 pinned. The store
packages are built complete.)

## Sample JSON (abridged)

```json
{
  "metadata": {"title": "…", "author": "…", "pages": 12},
  "outline_source": "headings",
  "outline": [
    {"title": "Chapter 1 Foundations", "level": 1, "page_start": 1,
     "page_end": 4, "word_count": 812, "text": "…",
     "children": [
       {"title": "1.1 Scope", "level": 2, "page_start": 2,
        "page_end": 4, "word_count": 305, "text": "…", "children": []}
     ]}
  ]
}
```

## Lineage

PDFStruct descends from the PDF tooling built for the Outcome
Convergence System book (PyPDF2 + pdfminer extractors and a
heading-parsing knowledge-ingestion utility). [PROVENANCE.md](PROVENANCE.md)
records exactly what is carried over and what is new — the tree,
page attribution, TOC support, and structured outputs are new here.
Its sibling pdfx is the free text-extraction product; PDFStruct is the
structure product.

## Support

Tips are welcome and buy nothing extra:

- Buy Me a Coffee: https://buymeacoffee.com/nrupalakolt
- PayPal: https://paypal.me/nrupalakolkar

## Licence

Apache License, Version 2.0, plus a commercial services layer — see
[LICENSE](LICENSE), [LICENSING.md](LICENSING.md), and
[COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).

Copyright © 2026 2351485 ALBERTA INC.
