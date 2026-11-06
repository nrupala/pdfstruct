# PDFStruct extension — store submission checklists (STAGING ONLY)

Prepared 2026-10-30. Nothing here has been submitted anywhere. No
accounts were created, no fees paid, no listings filed. The owner's
taps (identified per store below) are the only steps Wright cannot do.

## Packages in this folder

| File | Store(s) | Contents |
|---|---|---|
| `pdfstruct-chrome-edge.zip` | Chrome Web Store, Microsoft Edge Add-ons | `manifest.json`, `popup.html`, `popup.js`, `popup.css` — manifest at ZIP **root**, no wrapper folder |
| `pdfstruct-firefox.zip` | Firefox AMO | Same four files; manifest additionally carries the Gecko block below |
| `firefox/` | — | The unzipped Firefox staging tree the zip was built from (source `extension/` was NOT modified) |
| `listing.md` | all | Listing copy, permission justifications, privacy statement |

Firefox manifest delta (the only code difference between the zips):

```json
"browser_specific_settings": {
  "gecko": { "id": "pdfstruct@aimlds.org", "strict_min_version": "109.0" }
}
```

MV3 is supported in Firefox 109+, hence `strict_min_version: 109.0`.

SHA-256 (2026-10-30 build):
- `pdfstruct-chrome-edge.zip` — `a66003567cdbbf24a3d9c853e45b19601648677ee7ccefa53d2e58803b7ce036`
- `pdfstruct-firefox.zip` — `c911ba5fc3204c4d1e6cb65915773a17d02624b883dad32a8f75f1cb523a5e1c`

## Validation performed on these packages (2026-10-30)

- ZIP integrity + listing verified for both zips; `manifest.json`
  confirmed at the root of each; no wrapper folder.
- Both packaged manifests parse as valid JSON; MV3 confirmed; the
  Firefox manifest's Gecko block confirmed present, the Chrome/Edge
  manifest confirmed free of it; the source `extension/manifest.json`
  confirmed untouched.
- Smoke test (`tests/extension_smoke.mjs`, DOM-stub, 6 checks) run
  against the **unzipped package contents** of each zip (not just the
  source tree): **6/6 PASS on both variants** — posts to
  `http://127.0.0.1:8766/outline`, renders nested outline + page
  ranges, API-down message names `pdfstruct-api`, no-file prompt, no
  request without a file. Packaged `popup.js` is byte-identical to the
  source file (md5 `7fd1955cb4cff2d0a246ab7fe417ba70` in all three).
- **NOT RUN:** `web-ext lint` — web-ext is not installed on this
  machine and nothing was installed to stage these packages. Run it
  (or rely on AMO's upload-time validator, which performs the same
  checks) before the Firefox submission is called final.
- **NOT RUN:** real-browser unpacked load of either package — the
  browser automation available to Wright cannot open
  `chrome://extensions` or loopback pages (recorded in the release
  gate record). The smoke test above is a stub-DOM exercise of the
  popup logic, not a browser load. Grade accordingly.

## Firefox behaviour note (popup.js under Firefox)

`popup.js` POSTs the chosen file via `fetch` to
`http://127.0.0.1:8766/outline`. The manifest's `host_permissions`
(`http://127.0.0.1:8766/*`, `http://localhost:8766/*`) cover that
target exactly, in both variants — no manifest change was needed for
the fetch itself, and `popup.js` is unmodified (it uses no `chrome.*`
APIs, only DOM + fetch + FormData, which Firefox supports).

One real difference to know: **Firefox MV3 does not grant
`host_permissions` automatically at install time** — they are treated
as optional, user-granted permissions. A Firefox user may need to
grant PDFStruct access to `127.0.0.1` (extension panel → PDFStruct →
Permissions) before the first fetch succeeds; until granted, the
popup shows its "could not reach the local API" message even when the
API is running. Chrome/Edge grant the loopback host permission at
install. This is a listing-copy/support note, not a code change.

## Known findings before submission (minor, none blocking staging)

1. **Unused `activeTab` permission.** `manifest.json` declares
   `permissions: ["activeTab"]`, but no code in the extension touches
   tabs or scripting. Chrome's review in particular asks why each
   permission is needed. Recommendation: drop `activeTab` from the
   manifest and rebuild both zips before submitting. Left as-is in
   these staged packages because staging was scoped to packaging, not
   source changes.
2. **No icon asset yet.** The package ships no icons and the manifest
   declares none. Chrome Web Store requires a 128×128 store icon
   (uploaded in the console, separate from the zip); Edge and AMO
   listings likewise need icon/screenshot assets. A 128×128 PNG (and
   ideally 48/32/16 for the manifest) must be produced before the
   listings can be completed.

## Chrome Web Store checklist

- [ ] **Owner's tap:** one-time US$5 developer enrolment, paid inside
      the owner's own Google account (his card never passes through
      Wright). This is the fleet-level enrolment — it covers Verdict,
      DogEar, PDFStruct and every later extension.
- [ ] Decide the enrolment identity (personal name vs AIMLDS /
      info@aimlds.org) — board question dispatched 2026-10-30.
- [ ] Upload `pdfstruct-chrome-edge.zip` in the Developer Dashboard.
- [ ] Paste listing copy from `listing.md`; upload 128×128 icon +
      screenshots (asset gap — see findings).
- [ ] Privacy tab: single-purpose statement + permission
      justifications from `listing.md`; declare **no data collected**.
- [ ] Distribution: public, free.
- [ ] Submit for review; respond to any reviewer query with the
      localhost-only architecture note (the extension is inert without
      the user's own local API, by design).

## Microsoft Edge Add-ons checklist

- [ ] Partner Center registration for Edge Add-ons — **free** (owner's
      Microsoft account sign-in; no enrolment fee).
- [ ] Upload the **same** `pdfstruct-chrome-edge.zip` (Edge is
      Chromium-based; no separate build).
- [ ] Listing copy from `listing.md`; icon/screenshot assets as above.
- [ ] Privacy + permission notes from `listing.md` (loopback only, no
      data collection).
- [ ] Submit for certification; Edge review is a separate queue from
      Chrome's — passing one store says nothing about the other.

## Firefox AMO checklist

- [ ] Sign in at addons.mozilla.org with the owner's existing Mozilla
      account (personal account is fine — AMO developer accounts are
      individual; the listing shows the AMO **display name**, which is
      set on the AMO profile and does not sync from the Mozilla
      account, so set it deliberately, e.g. AIMLDS).
- [ ] Ensure **two-factor authentication is enabled** on the Mozilla
      account — Mozilla requires 2FA for add-on developer accounts.
- [ ] Accept the AMO Developer Agreement when prompted.
- [ ] Developer Hub → Submit a New Add-on → **On this site** (listed
      distribution) → upload `pdfstruct-firefox.zip`.
- [ ] AMO's automated validator runs at upload (equivalent coverage to
      `web-ext lint`, which is NOT RUN locally — see Validation).
- [ ] Listing: copy from `listing.md`; set licence Apache-2.0;
      support email info@aimlds.org; support site https://aimlds.org.
      Note the "requires additional software" fact honestly: the
      add-on needs the free local PDFStruct API running (see listing
      copy).
- [ ] Reviewer notes: localhost-only architecture; source is plain,
      unminified JS (no source-upload obligation expected); the Gecko
      ID is `pdfstruct@aimlds.org`.
- [ ] **Mozilla signs every build** — the listed version goes live
      only after Mozilla's review + signing; unlisted/self-distributed
      builds are also signed but were not chosen here.
- [ ] Ownership can be transferred or co-owners added later via
      Developer Hub → Manage Authors & License, so starting on the
      personal account does not lock the add-on to it.

---

## Rebuild 2026-11-05 — extension 0.2.0 (self-contained)

The packages above were rebuilt for 0.2.0: the extension is now
self-contained (vendored pdf.js engine, workspace tab, knowledgebank,
talk-to-the-page with a bundled on-device model). Package contents
are now the full extension tree (34 entries: manifest, popup,
workspace, engine/docstore/bank/talk/model scripts, icons, vendor/
including the PDF.js engine, the Transformers.js runtime, and the
Qwen2.5-0.5B model). The `firefox/` staging tree was re-synced from
the same build.

SHA-256 (2026-11-05 build):
- `pdfstruct-chrome-edge.zip` — `6e8471384db7b59a7a196482b46bb33d2ee6774fcbc022a0658c223cbbd66bff` (404,003,292 bytes)
- `pdfstruct-firefox.zip` — `fde694b8cc33258cb062e05014c584080d5d3cf8ca9775dd9f2fb28bc2193046` (404,003,349 bytes)

Validation on these packages (2026-11-05): both zips opened and
manifest read back from inside the zip (version 0.2.0; Firefox
carries the gecko block); the bundled model file inside each zip
measures 483,003,582 bytes. NOT RUN: real-browser unpacked load and
`web-ext lint` (no browser/linter in the build environment) —
Wright's pre-submission legs. Store package-size caps (notably
AMO's) must be re-checked at submission time against the ~404 MB
package size.

Store-size verification (2026-11-05, primary sources): Chrome Web
Store maximum package = 2 GB (compliant). Firefox AMO maximum =
200 MB — the full Firefox package exceeds it. Fallback variant
built for the AMO path: `pdfstruct-firefox-nomodel.zip` — SHA-256
`6d161a17e1208e7bd853a8758a0aa253e904e06f04dd5a77f847903ac0a72799`
(9,829,770 bytes) — identical except the bundled model weights are
omitted (the model is then the catalogue's first download). If the
fallback is what ships to AMO, the Firefox listing's bundled-model
wording must be scoped accordingly at submission.

---

## Fix rebuild 2026-11-05 — extension 0.2.1 (defects F1 + F2 class)

Rebuilt after Wright's real-browser proof of the 0.2.0 packages
(browser proof 2026-11-05): F1 — every download silently
produced no file (detached-anchor click, in the workspace AND
the popup's own copy); plus the F2-class buffer defect in the
popup (page-count probe spent the buffer extraction needed —
latent because pre-release popup testing only used a 240-page
file, which routes to the workspace first). Fixes are in
`extension/docstore.js` (shared attached-anchor download
helper), `extension/popup.js` (shared helper + fresh bytes per
pdf.js call) and `extension/workspace.js` (private helper copy
removed); the Firefox staging tree was re-synced from the same
build.

SHA-256 (2026-11-05 fix build):
- `pdfstruct-chrome-edge.zip` — `a89e7e72bd9ab80965bed6e2a8f1c25e823ae8b6ef5734193516d94e12bc9b87` (403,365,335 bytes, 34 entries)
- `pdfstruct-firefox.zip` — `b39c81792b1593bffdd1cd9a86c0225694753f5b8ebf26e89e939f3143ac0ca9` (403,365,390 bytes, 34 entries)
- `pdfstruct-firefox-nomodel.zip` — `f6910ae6b424e6a4fe763badcff340a3390561fcf90f891e74cb0ca750514e6f` (9,843,106 bytes, 33 entries)

Validation on these packages: manifest read back from inside
each zip (version 0.2.1; gecko block in the Firefox variants
only); the changed files (docstore.js, workspace.js, popup.js,
manifest.json) are byte-identical to the source tree inside
every zip; the bundled model file inside each full zip measures
483,003,582 bytes. Extension smoke 73 PASS / 0 FAIL (was 60 —
the F1/F2 regression sections are the delta, and they fail
against the shipped 0.2.0 popup.js). NOT RUN here: the
real-browser re-proof — Wright's leg before submission.
