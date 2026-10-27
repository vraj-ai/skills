// The Verdicts section of a ship record: one row per PR.
//
// The tool writes these rows; the model writes the prose sections. Readers get
// the reviewer, the commit it reviewed, the base it was reviewed against, and
// the patch-id of that review, so currency is a comparison instead of a story.
const HEADER = '| PR | By | At | Base | Patch-id |';
const RULE = '|---|---|---|---|---|';

export function parseVerdicts(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Verdicts\s*$/.test(line.trim()));
  if (start === -1) return [];
  const rows = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith('## ')) break;
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 5) continue;
    if (cells[0] === 'PR' || /^-+$/.test(cells[0])) continue;
    const pr = Number(cells[0]);
    if (!Number.isInteger(pr) || pr <= 0) continue;
    rows.push({
      pr,
      by: cells[1],
      at: cells[2],
      base: cells[3],
      patchId: cells[4],
    });
  }
  return rows;
}

export function findVerdict(text, pr) {
  return parseVerdicts(text).find((row) => row.pr === Number(pr)) || null;
}

// Replace the row for this PR, or add the section. Rewriting only this section
// keeps every model-authored byte outside it intact.
export function upsertVerdict(text, verdict) {
  const row = `| ${verdict.pr} | ${verdict.by} | ${verdict.at} | ${verdict.base} | ${verdict.patchId} |`;
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Verdicts\s*$/.test(line.trim()));

  if (start === -1) {
    const trimmed = text.replace(/\s*$/, '');
    return `${trimmed}\n\n## Verdicts\n${HEADER}\n${RULE}\n${row}\n`;
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].trim().startsWith('## ')) { end = i; break; }
  }
  const section = lines.slice(start + 1, end).filter((line) => line.trim().startsWith('|'));
  const dataRows = section.filter((line) => {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 5) return false;
    if (cells[0] === 'PR' || /^-+$/.test(cells[0])) return false;
    return Number(cells[0]) !== Number(verdict.pr);
  });
  const body = [HEADER, RULE, ...dataRows, row];
  const rebuilt = [...lines.slice(0, start + 1), ...body, ...lines.slice(end)];
  return `${rebuilt.join('\n').replace(/\s*$/, '')}\n`;
}
