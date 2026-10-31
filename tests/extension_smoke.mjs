// Extension smoke test — zero-dependency DOM stub exercising popup.js
// end to end: file chosen -> click -> POST to the local API -> outline
// rendered; and the API-down path rendering its start instructions.
// Run: node tests/extension_smoke.mjs   (also wired into CI)
//
// Honest scope: this exercises the popup's own logic in a stub DOM.
// It is NOT a real-browser unpacked load; that leg is recorded
// separately in the gate record.

import { readFileSync } from "node:fs";
import vm from "node:vm";

const popupJs = readFileSync(new URL("../extension/popup.js", import.meta.url), "utf8");

function makeWorld(fetchImpl) {
  const elements = {
    file: { files: [{ name: "book.pdf" }] },
    go: { listeners: {}, addEventListener(ev, fn) { this.listeners[ev] = fn; } },
    out: { textContent: "" },
  };
  const sandbox = {
    document: { getElementById: (id) => elements[id] },
    fetch: fetchImpl,
    FormData: class { append() {} },
    // popup.js uses a fetch timeout (adversarial-review fix, 2026-10-30)
    AbortController,
    setTimeout,
    clearTimeout,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(popupJs, sandbox);
  return elements;
}

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}`);
  if (!cond) failures++;
}

// 1. Happy path: API returns a tree, popup renders titles + page ranges.
{
  let seenUrl = null, seenMethod = null;
  const els = makeWorld(async (url, opts) => {
    seenUrl = url; seenMethod = opts.method;
    return {
      ok: true,
      json: async () => ({
        outline: [
          { title: "Chapter 1 Foundations", page_start: 1, page_end: 4,
            children: [{ title: "1.1 Scope", page_start: 2, page_end: 4, children: [] }] },
        ],
      }),
    };
  });
  await els.go.listeners.click();
  check("posts to local /outline", seenUrl === "http://127.0.0.1:8766/outline" && seenMethod === "POST");
  check("renders chapter", els.out.textContent.includes("Chapter 1 Foundations (p. 1-4)"));
  check("renders nested child indented", els.out.textContent.includes("  1.1 Scope (p. 2-4)"));
}

// 2. API down: popup tells the user how to start it, no silent failure.
{
  const els = makeWorld(async () => { throw new Error("connection refused"); });
  await els.go.listeners.click();
  check("api-down message names the start command", els.out.textContent.includes("pdfstruct-api"));
}

// 3. No file chosen: clear prompt, no fetch attempted.
{
  let fetched = false;
  const els = makeWorld(async () => { fetched = true; throw new Error("unused"); });
  els.file.files = [];
  await els.go.listeners.click();
  check("no-file prompt", els.out.textContent.includes("Choose a PDF first."));
  check("no-file makes no request", fetched === false);
}

process.exit(failures ? 1 : 0);
