// PDFStruct extension: sends the chosen PDF to the user's own local API
// and renders the returned outline tree. Nothing leaves the machine.
const API = "http://127.0.0.1:8766";

function renderOutline(nodes, depth, lines) {
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
  try {
    const resp = await fetch(`${API}/outline`, { method: "POST", body: form });
    if (!resp.ok) throw new Error(`local API returned ${resp.status}`);
    const data = await resp.json();
    const lines = renderOutline(data.outline, 0, []);
    out.textContent =
      lines.length > 0
        ? lines.join("\n")
        : "No outline found (no bookmarks, no detectable headings).";
  } catch (err) {
    out.textContent =
      "Could not reach the local PDFStruct API at " + API +
      ". Start it with: pdfstruct-api";
  }
});
