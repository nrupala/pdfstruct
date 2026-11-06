# Gemini pre-store re-check — PDFStruct 0.2.1 fix build (2026-11-05)

Request: Gemini (custom.gemini connector, model gemini-3.1-flash-lite,
connector default; lane proven live with --list-models before the
call) asked for a delta re-check of the 0.2.1 fix build: defect F1
(downloads produced no file — detached-anchor clicks in the
workspace AND the popup's own private copy) and the F2-class
buffer defect in the popup (page-count probe spent the buffer
extraction needed; latent because pre-release popup testing only
used a 240-page file), root causes, fixes, new regression tests
with mutation check, package hashes.

## Verdict: PASS

## Wright-side disposition

- Gemini confirms both fixes address the stated root causes (one
  shared DOM-attached download helper with loud failure; fresh
  File reads per pdf.js call, matching the workspace pattern) and
  finds no new store-policy, privacy or security concern in the
  delta; it also notes the no-"permissions"-key posture and the
  2 GB Chrome limit headroom as positives. Accepted as stated.
- The decisive leg remains Wright's real-browser re-proof of
  these exact packages; it has NOT run yet at the time of this
  check and the release does not proceed without it.

## Raw response (verbatim)

This review covers the delta between version 0.2.0 and 0.2.1 of the "PDFStruct" extension.

### 1. Root Cause Analysis
*   **Defect F1 (Downloads):** The implementation of an centralized, DOM-attached anchor helper in `docstore.js` is the correct technical remedy for Chrome/Edge/Firefox extension environments, which strictly enforce that `click()` events on detached anchors are ignored for security/privacy reasons. The transition from silent failures to explicit UI alerts (`role=alert`) satisfies the requirement for "loud" error handling.
*   **Defect F2 (Buffer Detachment):** The shift from reusing a single `ArrayBuffer` to calling `file.arrayBuffer()` for every `pdf.js` operation correctly mitigates the `Transferable` object pattern inherent in the Web Workers used by `pdf.js`. This prevents the "ArrayBuffer is detached" exception and correctly aligns the popup's lifecycle management with the established, functional workspace pattern.

### 2. Store Policy, Privacy, and Security
*   **Blob-URL Downloads:** Using `document.body.appendChild(a)` for downloads is the standard, secure way to trigger browser-native save dialogs. Since the scope is limited to user-initiated actions and the extension lacks `downloads` permission (relying on `<a>` attributes), this remains compliant with the principle of least privilege.
*   **File Handling:** The increased frequency of `File.arrayBuffer()` calls is a standard browser-side operation. As this extension processes documents entirely on-device (as stated), this does not introduce new privacy concerns; it improves stability without increasing the attack surface.
*   **CSP & Permissions:** The CSP (`script-src 'self' 'wasm-unsafe-eval'`) remains robust for an extension utilizing `pdf.js` and local model inference. The lack of sensitive permissions (`host_permissions` only for validation/downloads) remains a strong positive for privacy reviews.

### 3. Store Reviewer Considerations
*   **Bundle Size:** The inclusion of the full model in the primary packages (~400MB) is well within the 2GB limit. The provision of the "nomodel" variant for Firefox/AMO is a proactive and wise architectural choice to ensure compliance with stricter platform-specific size or review constraints.
*   **Regression Testing:** The provided evidence of a failed mutation test on 0.2.0 and successful passing on 0.2.1 for both the download anchor attachment and the buffer-transfer logic provides high confidence in the fix.
*   **Flagging Risk:** There are no obvious red flags. The code is self-contained, lacks remote execution, and the manifest changes are limited to versioning.

---

### Verdict: PASS

**Reasoning:**
The fix correctly identifies and resolves the two critical functional regressions. The centralization of download logic into `docstore.js` eliminates code duplication and ensures a consistent, failure-aware user experience. The buffer management fix correctly handles the asynchronous nature of `pdf.js` worker communication. The transition from 0.2.0 to 0.2.1 demonstrates a mature handling of browser-specific runtime constraints. No new security or privacy liabilities were introduced.
