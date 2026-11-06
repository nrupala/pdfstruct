"use strict";
/*
 * PDFStruct — on-device model layer for talk-to-the-page.
 *
 * Strategy (owner, 2026-11-05): the extension SHIPS with a small
 * model inside the package — Qwen2.5-0.5B-Instruct (Apache-2.0),
 * ONNX q4f16 — running locally via the vendored Transformers.js
 * runtime (Apache-2.0; ONNX Runtime Web, MIT), WebGPU first, WASM
 * fallback. It works offline, out of the box. The bundled model
 * only PHRASES answers over retrieved passages (retrieval carries
 * the truth); Mozilla's field evidence puts the grounded-QA
 * quality floor at 7B-class, and those models live in the
 * downloadable catalogue below — never bundled.
 *
 * Catalogue: models download from our host (aimlds.org, HF-resolve
 * layout) on the user's click, cache in the browser, and become
 * selectable. ONLY models travel — documents never leave the
 * machine; the catalogue says so next to itself. AIMLDS/Factory
 * models list first when available; today the catalogue carries
 * vetted Apache-2.0 open models. The host is pending (see the
 * gate record): downloads report that plainly until it is live.
 */
(function (root) {

const BUNDLED = {
  id: "qwen2.5-0.5b-instruct",
  name: "Qwen2.5-0.5B-Instruct",
  detail: "Bundled in the package · 0.5B · ONNX q4f16 · Apache-2.0",
  dtype: "q4f16",
  bundled: true,
};

const CATALOG_HOST = "https://aimlds.org/models/";
const CATALOG = [
  {
    id: "qwen2.5-7b-instruct",
    name: "Qwen2.5-7B-Instruct",
    detail: "7B-class — the grounded-QA quality tier · ONNX q4 · Apache-2.0 · ≈4.7 GB download",
    dtype: "q4",
    bundled: false,
  },
  {
    id: "mistral-7b-instruct-v0.3",
    name: "Mistral-7B-Instruct v0.3",
    detail: "7B-class · ONNX q4 · Apache-2.0 · ≈4.4 GB download",
    dtype: "q4",
    bundled: false,
  },
];

let mod = null;
const pipes = new Map();
let selectedId = BUNDLED.id;
let lastError = null;

function entryById(id) {
  if (id === BUNDLED.id) return BUNDLED;
  return CATALOG.find((c) => c.id === id) || BUNDLED;
}

async function loadRuntime() {
  if (mod) return mod;
  mod = await import(
    chrome.runtime.getURL("vendor/transformers/transformers.min.mjs"));
  const env = mod.env;
  env.allowLocalModels = true;
  env.localModelPath = chrome.runtime.getURL("vendor/models/");
  env.backends.onnx.wasm.wasmPaths =
    chrome.runtime.getURL("vendor/transformers/");
  env.backends.onnx.wasm.numThreads = 1;
  return mod;
}

async function getPipe(entry, onProgress) {
  if (pipes.has(entry.id)) return pipes.get(entry.id);
  const m = await loadRuntime();
  const opts = { dtype: entry.dtype, progress_callback: onProgress };
  if (!entry.bundled) {
    // Catalogue models resolve from our host in HF layout and are
    // cached by the runtime in the browser's Cache Storage.
    m.env.allowRemoteModels = true;
    m.env.remoteHost = CATALOG_HOST;
  } else {
    m.env.allowRemoteModels = false;
  }
  let pipe;
  try {
    pipe = await m.pipeline("text-generation", entry.id,
      { ...opts, device: "webgpu" });
  } catch (e) {
    pipe = await m.pipeline("text-generation", entry.id,
      { ...opts, device: "wasm" });
  }
  pipes.set(entry.id, pipe);
  return pipe;
}

// The layer talk.js consumes. Returns null when no model can run —
// talk then answers from retrieval alone, silently.
async function readyLayer(onProgress) {
  const entry = entryById(selectedId);
  try {
    await getPipe(entry, onProgress);
    lastError = null;
    return {
      name: entry.name,
      generate: async (system, user) => {
        const pipe = await getPipe(entry);
        const messages = [
          { role: "system", content: system },
          { role: "user", content: user },
        ];
        const out = await pipe(messages, {
          max_new_tokens: 220, do_sample: false,
        });
        const gen = out[0].generated_text;
        if (Array.isArray(gen)) {
          const last = gen[gen.length - 1];
          return typeof last === "string" ? last : last.content || "";
        }
        return String(gen || "");
      },
    };
  } catch (e) {
    lastError = e;
    return null;
  }
}

// Warm a catalogue model's cache (the download), reporting
// progress. Resolves true when the model is cached and loadable.
async function downloadModel(id, onProgress) {
  const entry = entryById(id);
  if (entry.bundled) return true;
  await getPipe(entry, onProgress);
  return true;
}

async function clearDownloads() {
  try {
    const keys = await caches.keys();
    for (const k of keys) {
      if (k.includes("transformers")) await caches.delete(k);
    }
  } catch (e) { /* cache API unavailable — nothing to clear */ }
  for (const id of [...pipes.keys()]) {
    if (id !== BUNDLED.id) pipes.delete(id);
  }
}

function describe() {
  const entry = entryById(selectedId);
  const modelBit = lastError
    ? "on-device model unavailable here — retrieval only"
    : `${entry.name} on-device (phrasing)`;
  return `What runs where: retrieval runs on this device; ` +
    `${modelBit}. No question or document leaves this machine.`;
}

const api = {
  BUNDLED, CATALOG, CATALOG_HOST,
  readyLayer, downloadModel, clearDownloads, describe,
  setSelected(id) { selectedId = id || BUNDLED.id; },
  getSelected() { return selectedId; },
  entryById,
  get lastError() { return lastError; },
};
if (typeof module !== "undefined" && module.exports) module.exports = api;
root.PdfStructModel = api;

})(typeof self !== "undefined" ? self : globalThis);
