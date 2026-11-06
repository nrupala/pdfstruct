"use strict";
/*
 * PDFStruct — in-browser decomposition engine.
 *
 * Everything runs inside the extension with the vendored pdf.js
 * build (vendor/pdf.min.js, Apache-2.0, Mozilla). No companion app,
 * no local API, no network. The document object mirrors the shape
 * the Python engine (src/pdfstruct/core.py) returns — {source,
 * engine, text, text_length, metadata, outline_source, outline,
 * structure, index} — and the outline builders below are ports of
 * core.py's toc_outline / build_outline, including the testers'
 * phantom-heading guards (F1/F2/F4), so the extension and the
 * CLI/API/MCP agree on the same document. The .md/.txt writers are
 * ports of src/pdfstruct/outputs.py.
 *
 * Copyright © 2026 2351485 ALBERTA INC. — Apache-2.0 (see ../LICENSE).
 */
(function (root) {

// ---------------------------------------------------------------- text

function pageText(items) {
  const lines = [];
  let line = "";
  for (const item of items) {
    if (line && !line.endsWith(" ") && !item.str.startsWith(" ")) line += " ";
    line += item.str;
    if (item.hasEOL) { lines.push(line); line = ""; }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

function yieldToUi() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// -------------------------------------------------------- heading rules
// Ports of core.py _looks_like_title / _heading_from_line.

const KEYWORD_RE =
  /^\s*(Chapter|Appendix|Part|Section)\s+([\wIVXLCDM]+)\s*[:.\-]?\s*(.*)$/i;
const NUMBERED_RE = /^\s*(\d+(?:\.\d+)*)\.?\s+([A-Z][^\n]{2,100})$/;

function isUpperFirst(w) {
  const c = [...w][0];
  return !!c && c === c.toUpperCase() && c !== c.toLowerCase();
}

function looksLikeTitle(rest) {
  const words = rest.replace(/\./g, " ").split(/\s+/)
    .filter((w) => /[A-Za-z]/.test(w));
  if (words.length >= 3) {
    const capitalised = words.filter(isUpperFirst).length;
    if (capitalised / words.length < 0.5) return false;
  }
  return true;
}

function headingFromLine(line) {
  const stripped = line.trim();
  if (stripped.endsWith(".")) return null;
  let m = KEYWORD_RE.exec(line);
  if (m) {
    const kind = m[1].toLowerCase();
    const rest = m[3];
    if (rest && !looksLikeTitle(rest)) return null;
    return {
      kind,
      level: kind === "section" ? 2 : 1,
      number: m[2],
      title: stripped,
    };
  }
  m = NUMBERED_RE.exec(line);
  if (m) {
    const number = m[1];
    const rest = m[2].trim();
    if (rest.length > 100 || rest.endsWith(",")) return null;
    const alpha = [...rest].filter((ch) => /[A-Za-z]/.test(ch)).length;
    if (alpha < 3) return null;
    if (!number.includes(".") && parseInt(number, 10) >= 1000) return null;
    if (!looksLikeTitle(rest)) return null;
    return {
      kind: "numbered",
      level: Math.min(number.split(".").length, 6),
      number,
      title: stripped,
    };
  }
  return null;
}

// ------------------------------------------------------------ outline

function nest(nodes) {
  const roots = [];
  const stack = [];
  for (const node of nodes) {
    while (stack.length && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }
    if (stack.length) stack[stack.length - 1].children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  return roots;
}

function wordCount(body) {
  return body ? body.split(/\s+/).filter(Boolean).length : 0;
}

// Port of core.py toc_outline: page-granular slices from bookmarks.
function tocOutline(flat, pages) {
  const total = pages.length;
  const nodes = [];
  for (let i = 0; i < flat.length; i++) {
    const entry = flat[i];
    const pageStart = entry.page || 1;
    let nextPage = null;
    for (let j = i + 1; j < flat.length; j++) {
      if (flat[j].page) { nextPage = flat[j].page; break; }
    }
    let pageEnd = nextPage ? nextPage - 1 : total;
    if (pageEnd < pageStart) pageEnd = pageStart;
    let body = pages.slice(pageStart - 1, pageEnd).join("\n").trim();
    if (body) {
      const nl = body.indexOf("\n");
      const first = nl === -1 ? body : body.slice(0, nl);
      if (first.trim() === entry.title.trim()) {
        body = (nl === -1 ? "" : body.slice(nl + 1)).trim();
      }
    }
    nodes.push({
      title: entry.title,
      kind: "toc",
      number: null,
      level: entry.level || 1,
      page_start: pageStart,
      page_end: pageEnd,
      word_count: wordCount(body),
      text: body,
      children: [],
    });
  }
  return nest(nodes);
}

function pageForOffset(spans, offset) {
  for (let idx = 0; idx < spans.length; idx++) {
    const [start, end] = spans[idx];
    if ((start <= offset && offset < end) ||
        (idx === spans.length - 1 && offset >= start)) return idx + 1;
  }
  return spans.length || 1;
}

// Port of core.py build_outline (heading-detection fallback).
function buildOutlineFromHeadings(pages) {
  const joined = pages.join("\n");
  const spans = [];
  let cursor = 0;
  for (const t of pages) {
    spans.push([cursor, cursor + t.length + 1]);
    cursor += t.length + 1;
  }
  const flat = [];
  let offset = 0;
  pages.forEach((pageStr, pageIndex) => {
    let lineOffset = offset;
    for (const line of pageStr.split("\n")) {
      const found = headingFromLine(line);
      if (found) {
        flat.push({ ...found, page_start: pageIndex + 1, offset: lineOffset });
      }
      lineOffset += line.length + 1;
    }
    offset += pageStr.length + 1;
  });
  const nodes = [];
  for (let i = 0; i < flat.length; i++) {
    const hit = flat[i];
    const segStart = hit.offset + hit.title.length + 1;
    const segEnd = i + 1 < flat.length ? flat[i + 1].offset : joined.length;
    const body = joined.slice(segStart, segEnd).trim();
    const pageEnd = segEnd > segStart
      ? pageForOffset(spans, Math.max(segStart, segEnd - 1))
      : hit.page_start;
    nodes.push({
      title: hit.title,
      kind: hit.kind,
      number: hit.number,
      level: hit.level,
      page_start: hit.page_start,
      page_end: Math.max(pageEnd, hit.page_start),
      word_count: wordCount(body),
      text: body,
      children: [],
    });
  }
  return nest(nodes);
}

function parseStructure(text) {
  const buckets = { chapters: [], appendices: [], sections: [] };
  for (const line of text.split("\n")) {
    const found = headingFromLine(line);
    if (!found) continue;
    if (found.kind === "chapter") buckets.chapters.push(found.title);
    else if (found.kind === "appendix") buckets.appendices.push(found.title);
    else if (found.kind === "section") buckets.sections.push(found.title);
  }
  return buckets;
}

const STOPWORDS = new Set(["a", "an", "and", "are", "as", "at", "be", "by",
  "for", "from", "in", "is", "it", "of", "on", "or", "that", "the", "this",
  "to", "with"]);

function buildIndex(text) {
  const tokens = text.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const lowered = tokens.map((t) => t.toLowerCase())
    .filter((t) => !STOPWORDS.has(t));
  const counts = new Map();
  for (const t of lowered) counts.set(t, (counts.get(t) || 0) + 1);
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([t]) => t);
  return { concepts: [], term_count: lowered.length, top_terms: top };
}

// ------------------------------------------------------------ extraction

async function loadPdf(pdfjsLib, data) {
  const task = pdfjsLib.getDocument({ data, isEvalSupported: false });
  return task.promise;
}

async function countPages(pdfjsLib, data) {
  const pdf = await loadPdf(pdfjsLib, data);
  const n = pdf.numPages;
  await pdf.destroy();
  return n;
}

async function resolveOutline(pdf) {
  let raw = null;
  try { raw = await pdf.getOutline(); } catch (e) { raw = null; }
  if (!raw || !raw.length) return { flat: [], warnings: [] };
  const flat = [];
  const warnings = [];
  async function walk(items, level) {
    for (const item of items) {
      let page = null;
      try {
        let dest = item.dest;
        if (typeof dest === "string") dest = await pdf.getDestination(dest);
        if (Array.isArray(dest) && dest.length) {
          const ref = dest[0];
          if (typeof ref === "number") page = ref + 1;
          else if (ref) page = (await pdf.getPageIndex(ref)) + 1;
        }
      } catch (e) { /* unresolved — recorded below, never silent */ }
      if (page == null) {
        // Mirrors the Python B-4 discipline: an unreadable bookmark
        // surfaces as a warning instead of silent outline loss.
        warnings.push(`Could not resolve bookmark: ${item.title}`);
      } else {
        flat.push({ title: item.title, level, page });
      }
      if (item.items && item.items.length) await walk(item.items, level + 1);
    }
  }
  await walk(raw, 1);
  return { flat, warnings };
}

async function extractDocument(pdfjsLib, data, sourceName, onProgress) {
  const pdf = await loadPdf(pdfjsLib, data);
  try {
    const numPages = pdf.numPages;
    let info = {};
    try {
      const meta = await pdf.getMetadata();
      if (meta && meta.info) {
        for (const [k, v] of Object.entries(meta.info)) {
          if (typeof v === "string") info[k.toLowerCase()] = v;
        }
      }
    } catch (e) { /* best-effort, as in the Python engine */ }
    const metadata = {
      title: info.title || null,
      author: info.author || null,
      creator: info.creator || null,
      producer: info.producer || null,
      subject: info.subject || null,
      pages: numPages,
      metadata: info,
    };
    const pages = [];
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      pages.push(pageText(tc.items));
      page.cleanup();
      if (onProgress) onProgress(i, numPages);
      if (i % 8 === 0) await yieldToUi();
    }
    const text = pages.join("\n");
    const { flat, warnings } = await resolveOutline(pdf);
    let outline, outlineSource;
    if (flat.length) {
      outline = tocOutline(flat, pages);
      outlineSource = "toc";
    } else {
      outline = buildOutlineFromHeadings(pages);
      outlineSource = "headings";
    }
    const doc = {
      source: sourceName,
      engine: "pdf.js",
      text,
      text_length: text.length,
      metadata,
      outline_source: outlineSource,
      outline,
      structure: parseStructure(text),
      index: buildIndex(text),
    };
    if (warnings.length) doc.warnings = warnings;
    return doc;
  } finally {
    await pdf.destroy();
  }
}

// --------------------------------------------------------------- outputs

function stemOf(sourceName) {
  const base = (sourceName || "document").split(/[\\/]/).pop();
  return base.replace(/\.pdf$/i, "") || "document";
}

function toText(doc) { return doc.text; }

function toJson(doc) { return JSON.stringify(doc, null, 2); }

function renderNodeMd(lines, node) {
  const hashes = "#".repeat(Math.min(2 + (node.level || 1), 6));
  lines.push(`${hashes} ${node.title} (p. ${node.page_start}–${node.page_end})`);
  lines.push("");
  if (node.text) { lines.push(node.text); lines.push(""); }
  for (const child of node.children || []) renderNodeMd(lines, child);
}

// Port of src/pdfstruct/outputs.py write_md.
function toMarkdown(doc) {
  const meta = doc.metadata || {};
  const lines = [`# ${meta.title || stemOf(doc.source)}`, ""];
  if (meta.author) lines.push(`- Author: ${meta.author}`);
  lines.push(`- Pages: ${meta.pages}`);
  lines.push(`- Outline source: ${doc.outline_source}`);
  lines.push("");
  if (doc.outline && doc.outline.length) {
    for (const node of doc.outline) renderNodeMd(lines, node);
  } else {
    lines.push("## Text", "", doc.text || "");
  }
  return lines.join("\n");
}

// ------------------------------------------- minimal OOXML (.docx) writer
// A .docx is a ZIP of XML parts; this writer emits a store-only
// (uncompressed) ZIP with the parts Word needs. Used for the
// knowledgebank's stored artifacts: the whole decomposition, or a
// single section, as a Word document.

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function zipStore(entries) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const u16 = (v) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff]);
  const u32 = (v) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff,
    (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
  const push = (arr) => { chunks.push(arr); offset += arr.length; };
  for (const e of entries) {
    const name = enc.encode(e.name);
    const crc = crc32(e.data);
    const localOffset = offset;
    push(u32(0x04034b50)); push(u16(20)); push(u16(0x0800)); push(u16(0));
    push(u16(0)); push(u16(0x0021));
    push(u32(crc)); push(u32(e.data.length)); push(u32(e.data.length));
    push(u16(name.length)); push(u16(0)); push(name); push(e.data);
    central.push({ name, crc, size: e.data.length, localOffset });
  }
  const cdStart = offset;
  for (const c of central) {
    push(u32(0x02014b50)); push(u16(20)); push(u16(20)); push(u16(0x0800));
    push(u16(0)); push(u16(0)); push(u16(0x0021));
    push(u32(c.crc)); push(u32(c.size)); push(u32(c.size));
    push(u16(c.name.length)); push(u16(0)); push(u16(0)); push(u16(0));
    push(u16(0)); push(u32(0)); push(u32(c.localOffset)); push(c.name);
  }
  push(u32(0x06054b50)); push(u16(0)); push(u16(0));
  push(u16(central.length)); push(u16(central.length));
  push(u32(offset - cdStart)); push(u32(cdStart)); push(u16(0));
  const out = new Uint8Array(offset);
  let pos = 0;
  for (const ch of chunks) { out.set(ch, pos); pos += ch.length; }
  return out;
}

function xmlEscape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function docxFromParas(title, paras) {
  const enc = new TextEncoder();
  const body = paras.map(([text, style]) =>
    `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>` +
    `<w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`
  ).join("");
  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${body}` +
    `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body></w:document>`;
  const stylesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>` +
    `</w:styles>`;
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `</Types>`;
  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
    `</Relationships>`;
  const core =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    `xmlns:dc="http://purl.org/dc/elements/1.1/">` +
    `<dc:title>${xmlEscape(title)}</dc:title></cp:coreProperties>`;
  return zipStore([
    { name: "[Content_Types].xml", data: enc.encode(contentTypes) },
    { name: "_rels/.rels", data: enc.encode(rels) },
    { name: "word/document.xml", data: enc.encode(documentXml) },
    { name: "word/styles.xml", data: enc.encode(stylesXml) },
    { name: "docProps/core.xml", data: enc.encode(core) },
  ]);
}

function nodeParas(paras, node) {
  paras.push([
    `${node.title} (p. ${node.page_start}–${node.page_end})`,
    node.level && node.level > 1 ? "Heading2" : "Heading1",
  ]);
  if (node.text) {
    for (const block of node.text.split("\n\n")) {
      if (block.trim()) paras.push([block.trim(), "Normal"]);
    }
  }
  for (const child of node.children || []) nodeParas(paras, child);
}

function docxBytes(doc) {
  const m = doc.metadata || {};
  const title = m.title || stemOf(doc.source);
  const paras = [[title, "Title"],
    [`Pages: ${m.pages} · outline from ${doc.outline_source}`, "Normal"]];
  if (doc.outline && doc.outline.length) {
    for (const node of doc.outline) nodeParas(paras, node);
  } else if (doc.text) {
    paras.push([doc.text, "Normal"]);
  }
  return docxFromParas(title, paras);
}

function docxBytesForNode(node, docTitle) {
  const paras = [[docTitle || "PDFStruct", "Title"]];
  nodeParas(paras, { ...node, children: [] });
  return docxFromParas(node.title, paras);
}

const api = {
  extractDocument, countPages, headingFromLine, tocOutline,
  buildOutlineFromHeadings, parseStructure, buildIndex,
  toText, toMarkdown, toJson, stemOf, pageText,
  docxBytes, docxBytesForNode,
};
if (typeof module !== "undefined" && module.exports) module.exports = api;
root.PdfStructEngine = api;

})(typeof self !== "undefined" ? self : globalThis);
