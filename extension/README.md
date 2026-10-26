# PDFStruct browser extension

Copyright © 2026 2351485 ALBERTA INC. — Apache-2.0 (see ../LICENSE).

Load this folder unpacked (Chrome/Edge → Extensions → Developer mode →
Load unpacked). The extension does nothing on its own: it sends a PDF
you choose to **your own local PDFStruct API** and shows the outline
tree it returns.

Start the API first:

```bash
pip install -e ".[api]"   # from the repository root
pdfstruct-api             # http://127.0.0.1:8766
```

No data leaves your machine; the manifest's host permissions cover
only `127.0.0.1:8766` / `localhost:8766`.
