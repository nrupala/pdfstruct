# Security policy

Copyright © 2026 2351485 ALBERTA INC.

PDFStruct is a local-first tool: it reads PDFs on your own machine and
writes results next to them. It makes no network calls of its own; the
local API binds `127.0.0.1` by default, and the browser extension can
reach only that local API.

## Reporting a vulnerability

Email **info@aimlds.org** with the details. Please do not open a public
issue for a security report. We will acknowledge receipt and work the
fix through the release gate before publishing it.

## Notes for operators

- Treat untrusted PDFs as untrusted input: PDFStruct parses them with
  pypdf / pdfminer.six. Run it in an environment you control.
- If you rebind the API (`PDFSTRUCT_HOST` / `PDFSTRUCT_PORT`), you are
  responsible for who can reach it — it has no authentication, by design,
  because it is a localhost tool.
