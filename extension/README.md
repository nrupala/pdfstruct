# PDFStruct browser extension

Copyright © 2026 2351485 ALBERTA INC. — Apache-2.0 (see ../LICENSE).

Load this folder unpacked (Chrome/Edge → Extensions → Developer mode →
Load unpacked).

Self-contained since 0.2.0: the decomposition engine (pdf.js,
vendored in `vendor/`, Apache-2.0) runs inside the extension. There
is no companion app to install and no local API to start, and the
manifest declares no permissions at all. Pick a PDF in the popup and
read its outline tree; download the decomposition as `.json`, `.md`,
or `.txt`. No data leaves your machine — the extension makes no
network calls.

Documents over 25 pages open in the workspace tab (`workspace.html`)
in feedreader format — the outline tree with search on the left, the
selected section's text on the right — and decompose page by page
with a progress bar and no time limit. Any document can be sent
there explicitly with "Open in workspace". A document routed to the
workspace is held in the browser's own IndexedDB (this device only)
until you forget it or route another.

The free Python package in this repository (CLI, local API
`pdfstruct-api`, MCP server) remains available for scripts and
pipelines. The extension does not need it.

The workspace also carries the knowledgebank (file outline
sections into containers with tags; edit, move, delete, export —
all local in IndexedDB), talk-to-the-page (retrieval over the
document's own sections with citations, phrased by the bundled
on-device Qwen2.5-0.5B model in `vendor/`; 7B-class models
downloadable from the in-workspace catalogue), and the
About / Settings area — the only commercial surface (tip jar,
one-time Pro, licence key). Talk is metered at 15 minutes of free
use in total; Pro removes the meter. Nothing about your documents
ever leaves the machine.

Note: the bundled model weights (`vendor/models/*/onnx/*.onnx`,
483 MB) are not stored in git (GitHub's file limit) — the store
packages are built from a tree that has them (see
`tools/fetch-model.sh`, SHA-256 pinned), and a package without
them still decomposes, files, and answers from retrieval; only
the model phrasing layer stays off.
