# PDFStruct — notes for store reviewers

This extension is a client for a local program the user installs and
runs on their own machine. It has no function without that program,
by design — the same pattern as other local-companion extensions.

To exercise the full flow:

1. Install the local API (Apache-2.0, open source). The review
   build `pdfstruct-0.1.0-py3-none-any.whl` is available from the
   publisher on request (info@aimlds.org) while the public release
   completes; install it with
   `pip install pdfstruct-0.1.0-py3-none-any.whl`, or run the API
   from its source tree.
2. Start it: `pdfstruct-api` (listens on http://127.0.0.1:8766).
3. Open the extension popup, choose any PDF, click "Show outline".
   The popup POSTs the file to the local API and renders the
   returned outline tree.

Expected behaviour WITHOUT the local program running: the popup
reports "Could not reach the local PDFStruct API at
http://127.0.0.1:8766. Start it with: pdfstruct-api". That message
is the designed no-backend state, not a broken extension: the
extension itself loads, renders, accepts a file, and handles the
unreachable-backend case with a named instruction.

Data practices: the extension collects nothing and can reach
nothing except 127.0.0.1:8766 (its only host permission). The file
the user picks goes to their own machine's API and nowhere else.
