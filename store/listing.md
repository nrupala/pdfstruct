# PDFStruct — store listing copy (Chrome Web Store / Edge Add-ons / Firefox AMO)

Prepared 2026-10-30. One copy set, usable on all three stores; per-store
field-length notes are inline. Copyright © 2026 2351485 ALBERTA INC.
Licence: Apache-2.0 (code); commercial terms for hosted/managed
offerings are separate and do not apply to this free extension.

## Name

PDFStruct

## One-line summary

Decompose a PDF into its structure — a hierarchical outline tree with
page ranges and each section's own text — free, fully local.
(130 characters; within Chrome's 132-char summary limit. This is the
canonical one-liner from CANONICAL-SHEET.md — do not paraphrase it.)

## Full description

PDFStruct shows you the skeleton of a PDF before you read a page of it.

Pick a PDF in the popup and PDFStruct returns its outline tree —
chapters, appendices, parts and sections, nested in order, each with
its page range — decomposed by the PDFStruct engine running locally on
your computer. Bookmarks/TOC are used when the PDF carries them;
otherwise the structure is detected from the document's headings.

**Fully local, by design.** The extension does nothing on its own. It
sends the PDF you choose to the free PDFStruct API running on your own
machine (`pdfstruct-api`, 127.0.0.1:8766) and displays the outline it
returns. No PDF, outline, or usage data is sent anywhere else — there
is no server, no account, no analytics, and no tracking.

**What you need:** the free, open-source (Apache-2.0) PDFStruct
package installed on the same computer, with its local API running:

- Project: https://aimlds.org
- Start the API with one command: `pdfstruct-api`

If the API is not running, the popup tells you exactly that and how to
start it — it never fails silently.

**Who it's for:** anyone who works with long PDFs — books, standards,
manuals, reports, theses — and wants the map before the territory.

## Category suggestion

- Chrome Web Store: **Productivity** (alternative: Developer Tools)
- Edge Add-ons: **Productivity**
- Firefox AMO: **Other** → or "Tabs & Bookmarks"-adjacent is wrong;
  use **Productivity / Other** as offered at submission time (AMO's
  category list is short; pick the closest productivity entry).

## Permission justifications (for reviewers)

- **host_permissions — `http://127.0.0.1:8766/*` only.** The
  extension's single function is to POST a user-chosen PDF to the
  PDFStruct API that the user runs on their own machine, and to read
  the outline it returns. That is a loopback address on one fixed
  port. There are **no remote hosts** in the manifest and no network
  access to any other destination exists in the code.
- **No API permissions are declared at all** — no `activeTab`, no
  storage, history, tabs, or browsing-data access. The extension
  reads only the one file the user picks in the popup's file
  chooser, at the moment they pick it.
  (Remediation note, 2026-10-30: an earlier draft of this section
  justified an `activeTab` permission and a second loopback alias
  that the shipped manifest does not declare. Gemini's pre-store
  check (store/pdfstruct--gemini-check--2026-10-30.md) blocked on exactly that
  discrepancy; the manifest and this listing now agree, verified
  from the packaged zips.)

## Privacy statement (store privacy fields + listing)

PDFStruct collects **no data at all**.

- No personal data, browsing data, file contents, or usage data is
  collected, stored, sold, or transmitted by this extension.
- The only network call the extension can make is to a loopback API
  (`http://127.0.0.1:8766`) that the user themselves installed and
  runs on the same machine. A PDF the user explicitly selects is sent
  to that local API for decomposition and nowhere else; it never
  leaves the user's device.
- No analytics, telemetry, crash reporting, advertising, or
  third-party code of any kind.
- The companion local API likewise processes PDFs locally and keeps
  nothing after responding.

Single-purpose statement (Chrome): PDFStruct's single purpose is to
display the structural outline of a user-selected PDF, computed by the
user's own local PDFStruct API.

## Support

- Support email: info@aimlds.org
- Support site: https://aimlds.org
