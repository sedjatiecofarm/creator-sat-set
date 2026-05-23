export function escapeHtml(value: unknown): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatInline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

export function renderAIText(text: unknown): string {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const html: string[] = [];
  let listOpen = false;
  const closeList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }

    let heading = line.match(/^\*\*(.+?)\*\*:?$/);
    if (!heading) heading = line.match(/^([A-Z][A-Z0-9 /&()_-]{3,}):?$/);
    if (heading) {
      closeList();
      html.push(`<h3>${formatInline(heading[1])}</h3>`);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)/);
    if (bullet) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${formatInline(bullet[1])}</li>`);
      continue;
    }

    const numbered = line.match(/^(\d+)\.\s+(.+)/);
    if (numbered) {
      closeList();
      html.push(`<p class="numbered"><strong>${numbered[1]}.</strong> ${formatInline(numbered[2])}</p>`);
      continue;
    }

    closeList();
    html.push(`<p>${formatInline(line)}</p>`);
  }

  closeList();
  return html.join("");
}

export function splitAIOptions(text: unknown): string[] {
  const cleaned = String(text || "")
    .trim()
    .replace(/\r/g, "")
    .replace(/^```(?:\w+)?|```$/gm, "")
    .replace(/^\s*---+\s*$/gm, "\n");

  const matches = [...cleaned.matchAll(/(?:^|\n)\s*(?:\*\*)?\s*(?:OPSI|OPTION)\s*\d+\s*[:.\-]?\s*(?:\*\*)?[\s\S]*?(?=\n\s*(?:\*\*)?\s*(?:OPSI|OPTION)\s*\d+\s*[:.\-]?\s*(?:\*\*)?|\s*$)/gi)];
  if (matches.length > 1) return matches.map((match) => normalizeOptionText(match[0])).filter(Boolean);

  const numbered = [...cleaned.matchAll(/(?:^|\n)\s*\d+\.\s+[\s\S]*?(?=\n\s*\d+\.\s+|\s*$)/g)];
  if (numbered.length > 1) return numbered.map((match) => normalizeOptionText(match[0])).filter(Boolean);

  return [normalizeOptionText(cleaned)];
}

export function normalizeOptionText(text: unknown): string {
  return String(text || "")
    .replace(/^\s*---+\s*/g, "")
    .replace(/\*\*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function scriptLine(text: unknown): string {
  const value = String(text || "");
  const match = value.match(/NASKAH:\s*"([^"]+)"/s);
  if (match) return match[1].trim();
  const bodyMatch = value.match(/NASKAH:\s*([\s\S]*?)(?:\n\nVALUE:|\n\nNILAI:|$)/);
  if (bodyMatch) return bodyMatch[1].replace(/^"|"$/g, "").trim();
  const ctaMatch = value.match(/CTA:\s*"([^"]+)"/s);
  if (ctaMatch) return ctaMatch[1].trim();
  return value;
}
