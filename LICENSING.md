# Licensing map — PDFStruct

Copyright © 2026 2351485 ALBERTA INC.

This file is the map. The licence text itself is [LICENSE](LICENSE)
(Apache License, Version 2.0). The commercial layer is described in
[COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).

## What is under Apache-2.0

Everything in this repository:

- the decomposition core (`src/pdfstruct/core.py`) — per-page extraction,
  bookmark/TOC outline, heading detection, tree building, term index;
- the compatibility agent face (`src/pdfstruct/agent.py`);
- the CLI (`pdfstruct`), the local API (`pdfstruct-api`), and the MCP
  server (`pdfstruct-mcp`);
- the browser extension in `extension/`;
- the tests and documentation in this repository.

No use of this code requires a commercial licence.

## What the commercial layer is

2351485 ALBERTA INC. sells services and separately licensed additions
around PDFStruct — hosted/managed decomposition, support, custom
heading/TOC models for a customer's document families, and integration
work (see [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)). Those are
engagements under separate written terms; they do not change the
Apache-2.0 terms of the code in this repository.

Tips (see `.github/FUNDING.yml`) are voluntary support. They buy nothing
extra and are not a licence.

## Provenance and other products

PDFStruct is new code built from the owner's own OCS book tooling; its
lineage is recorded in [PROVENANCE.md](PROVENANCE.md). Its sibling
product pdfx (`nrupala/pdf-extractor`) is distributed under the MIT
License; copies of pdfx obtained under MIT keep their MIT terms, and
nothing in this repository relicenses pdfx or any other product.
