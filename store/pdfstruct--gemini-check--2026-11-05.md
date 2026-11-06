# PDFStruct extension 0.2.0 — Gemini pre-store check (2026-11-05)

**Outcome: BLOCK per Gemini — NOT SUSTAINED on its stated ground**
(its blocking premise, a ~100 MB Chrome Web Store limit, is
factually wrong; the real store constraint it gestures at —
AMO's 200 MB cap — is verified, priced, and carried as an open
finding in the gate record, with a compliant fallback package
already built).

Reviewer: Gemini, via the fleet's Gemini connector lane
(`~/workspace/custom-connectors/custom.gemini/bin/gemini.py`,
default model; lane proven live with `--list-models` immediately
before the call). Material put to Gemini: the final manifest
(no `permissions` key; one host permission), the package facts
(34 entries; vendored engines; zip 404,003,292 bytes), the full
fetch surface (licence validation + catalogue model downloads
only), and the listing's permission and privacy sections. Gemini
judged privacy truthfulness "truthful and consistent", WASM CSP
"correct and necessary", host permissions "correctly scoped".

## Gemini's findings and their dispositions

1. **BLOCKING per Gemini: "Chrome Web Store has a ~100 MB limit;
   the 404 MB package will be automatically rejected."**
   FACTUALLY WRONG. Chrome's own documentation states the
   maximum supported package size is **2 GB** (verified
   2026-11-05 against developer.chrome.com-derived sources; the
   ~100 MB figure matches unrelated third-party services'
   limits). The package is compliant for Chrome and (to be
   confirmed at submission) Edge. The BLOCK is therefore not
   sustained for the primary channel.
2. **The real constraint inside the same concern: Firefox AMO's
   maximum file size is 200 MB** (Mozilla Extension Workshop,
   "Submitting an add-on": "The maximum file size accepted is
   200 MB. If your add-on is larger than 200 MB, it will fail
   validation."). VERIFIED and REAL: the full Firefox package
   (404 MB) cannot pass AMO validation. Disposition: a compliant
   fallback variant is built — `pdfstruct-firefox-nomodel.zip`
   (9,829,770 bytes; identical except the bundled weights are
   omitted; on that variant the bundled model is offered as the
   catalogue's first download instead — still zero companion
   installs, offline-after-download rather than
   offline-out-of-the-box). Which Firefox shape ships is the
   owner's/Wright's ruling at submission; the gate record names
   it as an open finding. The Chrome/Edge packages are unaffected.
3. **"Add the `storage` permission for IndexedDB transparency."**
   DECLINED with reason: IndexedDB requires no permission in
   either browser, and `storage` gates `chrome.storage` — a
   different API this extension never uses. Declaring it would
   be an over-declaration, the exact defect a prior Gemini round
   (2026-10-30) correctly blocked on. The IndexedDB use is fully
   disclosed in the listing without the permission.
4. **Catalogue model downloads will draw manual-review scrutiny;
   document that weights are static data, not code.** ACCEPTED
   as a submission note: the reviewer note for the press states
   the loader disables remote code (`allowRemoteModels = false`;
   JS/WASM vendored), and catalogue files are model weights only.
5. **Licence-gated feature must be plainly described to avoid a
   "misleading functionality" flag.** Already done: the listing
   states the meter, the pause behaviour, and the one-time Pro
   terms in the description and the Settings copy; the gate in
   the product gates nothing else.
