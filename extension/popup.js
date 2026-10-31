// PDFStruct extension: sends the chosen PDF to the user's own local API
// and renders the returned outline tree. Nothing leaves the machine.
const API = "http://127.0.0.1:8766";

function renderOutline(nodes, depth, lines) {
  // Gemini pre-store check (2026-10-30): cap recursion so a malformed
  // or deeply nested API response cannot overflow the popup.
  if (depth > 50) return lines;
  for (const node of nodes || []) {
    lines.push(
      "  ".repeat(depth) +
        `${node.title} (p. ${node.page_start}-${node.page_end})`
    );
    renderOutline(node.children, depth + 1, lines);
  }
  return lines;
}

document.getElementById("go").addEventListener("click", async () => {
  const out = document.getElementById("out");
  const file = document.getElementById("file").files[0];
  if (!file) {
    out.textContent = "Choose a PDF first.";
    return;
  }
  const form = new FormData();
  form.append("file", file);
  out.textContent = "Working…";
  // Adversarial code review (2026-10-30): the old catch-all reported
  // every failure as "could not reach the API" — including the API
  // rejecting the file (400) — and the fetch had no timeout. The three
  // cases are now reported as what they are.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const resp = await fetch(`${API}/outline`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (resp.status === 400) {
      const data = await resp.json().catch(() => ({}));
      out.textContent =
        "The local API could not read that PDF" +
        (data.error ? `: ${data.error}` : ".");
      return;
    }
    if (!resp.ok) throw new Error(`local API returned ${resp.status}`);
    const data = await resp.json();
    const lines = renderOutline(data.outline, 0, []);
    out.textContent =
      lines.length > 0
        ? lines.join("\n")
        : "No outline found (no bookmarks, no detectable headings).";
  } catch (err) {
    out.textContent =
      err && err.name === "AbortError"
        ? "The local API took too long to answer (20s timeout)."
        : "Could not reach the local PDFStruct API at " + API +
          ". Start it with: pdfstruct-api";
  } finally {
    clearTimeout(timer);
  }
});
