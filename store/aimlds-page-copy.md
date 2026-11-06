# aimlds.org page copy — /products/pdfstruct (PREPARED 2026-11-05, NOT DEPLOYED)

Status: release-prep deliverable for the extension 0.2.0 rebuild.
Wright deploys through the gated site route; nothing here is live
until he does. Copy is written for the public page (product voice).

---

## Hero

**PDFStruct**

See inside the book. PDFStruct decomposes a PDF into its outline
tree — chapters, sections, page ranges, word counts, and the text
of every section — entirely in your browser. Install it, pick a
file, and it works: nothing to download separately, nothing to
start, nothing uploaded.

[Get it for Chrome / Edge / Firefox] · Free — Pro is a one-time
payment, never a subscription.

## What changed in 0.2.0

The extension used to need a companion local API running on your
machine — and large books died against its 20-second timeout.
Both are gone. The decomposition engine (pdf.js) now ships inside
the extension, decomposition proceeds page by page with visible
progress and no time limit, and books over 25 pages open in a
full-tab workspace built for them.

## What it does

- **Decompose** — the hierarchical tree from the PDF's own
  bookmarks (or heading detection when there are none): levels,
  page ranges, word counts, section text, decoded metadata.
- **Download** — `.json` (the full tree), `.md`, `.txt`, or a
  Word `.docx`, generated in the browser — whole document or per
  section.
- **A workspace in feedreader format** — the outline is the list
  pane; the section you're reading is the reading pane. Search
  the tree, jump by section, read in place.
- **A knowledgebank, not just an outline** — the tree is a filing
  tool: file any section, or all of them, into containers you
  create (name + colour) with your own tags. Items are fully
  manageable — save, edit, move, delete, export — and their
  outputs regenerate from the current text, so exports never go
  stale. Everything lives in your browser's local storage only.
- **Talk to the page** — ask questions of the section you're
  reading. Retrieval runs over the document's own sections — the
  outline is the retrieval structure — and answers come back as
  the bearing passages with citations you can click to open in
  the reader. A small AI model bundled in the extension phrases
  answers on your device; larger models are downloadable from an
  in-workspace catalogue. Only models ever travel — your
  documents never leave your machine.

## Pricing, plainly

No subscription — subscriptions are a money drain, and we have
moved away from that model. Every feature works fully for
everyone; free use includes 15 minutes of talk-to-the-page in
total, after which talk pauses. Pro is a **one-time payment** that
removes the meter for life — it buys the feature unlock and
nothing else. And if the tool saved you time, you can tip out of
gratitude — when you wish, and how many times you wish.

## Privacy

Your PDF is decomposed in your browser and nowhere else.
Documents, filed sections, and settings live in your browser's
local storage (IndexedDB) on your device. The only data that ever
leaves is a licence key you type (validation) and the model files
you choose to download. No accounts, no analytics, no document
uploads — ever.

## Prefer a command line?

The free Python package (CLI / local API / MCP server) remains
available for automation and power users:
`pip install pdfstruct`.
