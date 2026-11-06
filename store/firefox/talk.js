"use strict";
/*
 * Talk to the page — document-grounded answering for PDFStruct.
 *
 * The floor (always available, no model, no network): keyword
 * retrieval over the item's passages, indexed at filing time.
 * Answers are the bearing passages themselves, each with its
 * citation — receipts, never free-floating text. Retrieval runs by
 * the document's own structure: PDFStruct files and retrieves by
 * its outline sections — the tree is the retrieval structure,
 * with paragraph chunking only inside a section.
 *
 * The generative layer (model.js): a small model bundled in the
 * package (Qwen2.5-0.5B-Instruct, Apache-2.0, ONNX q4f16) running
 * locally via Transformers.js, plus larger downloadable models
 * from the catalogue. Whichever model is active phrases its answer
 * FROM the retrieved passages only (full text instead when the
 * item is short — dual mode), citations attached either way. If no
 * model can run, the floor answers alone. Document content never
 * leaves the machine.
 *
 * The meter (owner's line, 2026-11-05): every feature is fully
 * available to everyone — nothing is size-gated. Free use of talk
 * is metered: 15 minutes of talk in total, counted as active
 * answering time (minimum 1 second per question), stored locally.
 * When the allowance is used up, talk PAUSES — it does not degrade
 * — and the talk surface says so in one plain line pointing to
 * About / Settings. Pro (one-time, lifetime) removes the meter.
 * Extraction, filing, bank management and export are never
 * metered. Licence validation is the one network call (key +
 * product id only); its server side is pending — see the gate
 * record — and an unvalidated key never reads as valid.
 */
(function (root) {

const FREE_TALK_SECONDS = 900; // 15 minutes of talk, in total
const FULL_CONTEXT_WORDS = 3000; // dual-mode boundary for the model
const LICENCE_VALIDATE_URL = "https://aimlds.org/api/licence/validate";
const PRODUCT = "pdfstruct";

const STOP = new Set(["a", "an", "and", "are", "as", "at", "be", "by",
  "for", "from", "in", "is", "it", "of", "on", "or", "that", "the",
  "this", "to", "with", "what", "which", "who", "whom", "when",
  "where", "why", "how", "does", "do", "did", "can", "could",
  "should", "would", "explain", "describe", "tell", "me", "about",
  "please", "give", "show"]);

function tokens(text) {
  return (text || "").toLowerCase().split(/[^a-z0-9]+/)
    .filter((t) => t && !STOP.has(t));
}

function wordCount(text) {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

// Passages arrive with their filing-time index (terms) attached by
// bank.js; compute on the fly only for passages that lack one.
function passageTerms(p) {
  if (p.terms) return p.terms;
  const c = {};
  for (const t of tokens(p.text)) c[t] = (c[t] || 0) + 1;
  return c;
}

function retrieve(passages, question, k = 3) {
  const q = [...new Set(tokens(question))];
  if (!q.length || !passages || !passages.length) return [];
  const counts = passages.map(passageTerms);
  const df = new Map();
  for (const c of counts) {
    for (const t of Object.keys(c)) df.set(t, (df.get(t) || 0) + 1);
  }
  const scored = [];
  passages.forEach((p, i) => {
    let score = 0;
    for (const t of q) {
      const tf = counts[i][t] || 0;
      if (tf) score += tf * Math.log(1 + passages.length / (df.get(t) || 1));
    }
    if (score > 0) scored.push({ ...p, score });
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}

function answer(item, question) {
  const hits = retrieve(item.passages || [], question);
  if (!hits.length) {
    return {
      found: false,
      hits: [],
      text: `Nothing in “${item.title}” bears on that question.`,
    };
  }
  return {
    found: true,
    hits,
    text: hits.map((h) => `[${h.citation}] ${h.text}`).join("\n\n"),
  };
}

// Dual mode: short items are given to the model whole; long items
// by retrieved passages. Citations come from retrieval either way.
function buildContext(item, question) {
  const hits = retrieve(item.passages || [], question);
  if (wordCount(item.text) <= FULL_CONTEXT_WORDS) {
    return { mode: "full", context: item.text, hits };
  }
  return {
    mode: "retrieval",
    context: hits.map((h) => `[${h.citation}] ${h.text}`).join("\n\n"),
    hits,
  };
}

// modelLayer: { name, generate(system, user) } from model.js, or
// null. Any failure degrades silently to the retrieval floor.
async function answerWithModel(item, question, modelLayer) {
  const base = answer(item, question);
  if (!base.found || !modelLayer) return base;
  try {
    const { mode, context, hits } = buildContext(item, question);
    const system =
      "Answer the question using ONLY the document text provided. " +
      "If it does not answer the question, say so plainly. Keep the " +
      "answer short and factual.";
    const user = `Document text:\n${context}\n\nQuestion: ${question}`;
    const out = await modelLayer.generate(system, user);
    if (out && out.trim()) {
      return {
        ...base, text: out.trim(), model: modelLayer.name, mode,
        hits,
      };
    }
    return base;
  } catch (e) {
    return base;
  }
}

// -------------------------------------------------------------- meter

function meterAllows(meter, licence) {
  if (licence && licence.status === "valid") {
    return { allowed: true, remaining: Infinity, pro: true };
  }
  const used = meter && meter.usedSeconds ? meter.usedSeconds : 0;
  const remaining = Math.max(0, FREE_TALK_SECONDS - used);
  return { allowed: remaining > 0, remaining, pro: false };
}

function chargeSeconds(meter, seconds) {
  const used = meter && meter.usedSeconds ? meter.usedSeconds : 0;
  return { usedSeconds: used + Math.max(1, Math.ceil(seconds)), updatedAt: Date.now() };
}

// ------------------------------------------------------------ licence

async function validateLicence(key, fetchImpl) {
  const doFetch = fetchImpl || root.fetch;
  const res = await doFetch(LICENCE_VALIDATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product: PRODUCT, key }),
  });
  if (!res.ok) throw new Error(`validation service returned ${res.status}`);
  const j = await res.json();
  return j && j.valid === true;
}

const api = {
  FREE_TALK_SECONDS, FULL_CONTEXT_WORDS, LICENCE_VALIDATE_URL, PRODUCT,
  tokens, retrieve, answer, buildContext, answerWithModel,
  meterAllows, chargeSeconds, validateLicence, wordCount,
};
if (typeof module !== "undefined" && module.exports) module.exports = api;
root.PdfStructTalk = api;

})(typeof self !== "undefined" ? self : globalThis);
