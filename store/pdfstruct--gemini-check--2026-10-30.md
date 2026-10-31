# PDFStruct extension — Gemini pre-store check (2026-10-30)

**Outcome: BLOCK** (per Gemini — see its blocking reason at the end.)

Reviewer: Gemini, via the fleet's Gemini connector lane
(`~/workspace/custom-connectors/custom.gemini/bin/gemini.py`, default
model `gemini-3.8-flash`, one compact call; lane proven live with
`--list-models` immediately before the call). Material put to Gemini:
the final extension manifest, popup.js, popup.html, the store listing
copy, and the verified package facts (both zips contain exactly
manifest.json, popup.html, popup.js, popup.css, icons/ ×4; no
`permissions` array; host_permissions loopback only; only network
destination http://127.0.0.1:8766).

This file records Gemini's verdict in Gemini's own framing. It is an
input to the gate, not Wright's edit of it.

---

## Gemini's findings

**1. Permissions vs function**
* **Over-declared:** `http://localhost:8766/*` is declared in
  `host_permissions`, but `popup.js` strictly hardcodes
  `http://127.0.0.1:8766`. Requesting both loopback aliases when only
  one is called violates CWS Least Privilege.
* **Under-declared:** None. Standard `<input type="file">` does not
  require manifest permissions, and extension pages are permitted to
  fetch endpoints declared in `host_permissions`. No background or
  storage permissions are needed.

**2. Privacy truthfulness**
* **Accurate.** The claims match the implementation. The extension
  communicates solely with `http://127.0.0.1:8766`, uses no analytics
  or remote tracking, and only processes files explicitly selected by
  the user. There are no privacy overclaims.

**3. Store-review risk**
* **Stale Justification (High Risk):** Submitting justification text
  for `activeTab` when `activeTab` is omitted from the manifest
  triggers immediate review rejection for metadata discrepancy and
  inaccurate permission justification.
* **Minimum Functionality / Broken Extension Flag (High Risk):**
  Reviewers test submissions in isolated environments without
  external native binaries. When clicking "Show outline", the fetch
  will fail and render an error. Reviewers will reject under the
  *Minimum Functionality / Broken Functionality* policy unless
  explicit instructions and setup binaries/mock endpoints are
  provided in the CWS Reviewer Notes.

**4. Security**
* **DOM Injection:** Secure. All data (`data.error`, `node.title`,
  page numbers) is written exclusively using `textContent`. There is
  no `innerHTML` or dynamic script evaluation.
* **Local API Trust:** The recursive `renderOutline` lacks a depth or
  cycle check. A circular or deeply nested response from the local
  API will trigger an uncaught call stack overflow, but this results
  only in a client-side crash, not code execution.
* **Network & Errors:** Properly guarded via `AbortController`
  (20-second timeout) and adequate `fetch` status checks.

**Gemini's verdict line:** BLOCK: Justification metadata discrepancy
(justifying undeclared `activeTab` while overdeclaring unused
`localhost:8766` host permission).

---

Filed 2026-10-30 by Wright (registrar for the check; no finding
softened, none fixed in this step — remediation belongs to the
submission lane acting on this record).
