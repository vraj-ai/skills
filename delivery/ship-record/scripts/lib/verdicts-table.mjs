// The Verdicts section of a ship record: one row per PR.
//
// The tool owns these rows; the model owns everything else in the record,
// including any prose it writes inside this section. Rewriting the section
// therefore keeps every line that is not this PR's row, and only the header,
// the rule, and the row itself are generated.
const HEADER = '| PR | By | At | Base | Patch-id |';
const RULE = '|---|---|---|---|---|';

function cellsOf(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return null;
  return trimmed.split('|').slice(1, -1).map((cell) => cell.trim());
}

function isRule(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isHeader(cells) {
  return cells[0]?.toUpperCase() === 'PR';
}

function rowPr(cells) {
  if (cells.length < 5 || isRule(cells) || isHeader(cells)) return null;
  const pr = Number(cells[0]);
  return Number.isInteger(pr) && pr > 0 ? pr : null;
}

export function parseVerdicts(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Verdicts\s*$/.test(line.trim()));
  if (start === -1) return [];
  const rows = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim().startsWith('## ')) break;
    const cells = cellsOf(line);
    if (!cells) continue;
    const pr = rowPr(cells);
    if (pr === null) continue;
    rows.push({ pr, by: cells[1], at: cells[2], base: cells[3], patchId: cells[4] });
  }
  return rows;
}

export function findVerdict(text, pr) {
  return parseVerdicts(text).find((row) => row.pr === Number(pr)) || null;
}

// Replace the row for this PR, or add the section. Prose anywhere in the
// section survives: an agent may explain what it re-reviewed, and losing that
// would be a silent edit to the record it wrote.
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

  const kept = [];
  let sawHeader = false;
  let sawRule = false;
  let lastTableLine = -1;
  for (const line of lines.slice(start + 1, end)) {
    const cells = cellsOf(line);
    if (cells && isRule(cells)) {
      if (sawRule) continue;
      sawRule = true;
      sawHeader = sawHeader || true;
      kept.push(RULE);
      lastTableLine = kept.length - 1;
      continue;
    }
    if (cells && isHeader(cells)) {
      if (sawHeader && sawRule) continue;
      sawHeader = true;
      kept.push(HEADER);
      lastTableLine = kept.length - 1;
      continue;
    }
    if (cells && rowPr(cells) === Number(verdict.pr)) continue;
    kept.push(line);
    if (cells) lastTableLine = kept.length - 1;
  }

  if (!sawHeader || !sawRule) {
    const lead = kept.findIndex((line) => line.trim() !== '');
    const insertAt = lead === -1 ? 0 : lead;
    kept.splice(insertAt, 0, HEADER, RULE);
    lastTableLine = insertAt + 1;
  }

  const at = lastTableLine === -1 ? 0 : lastTableLine + 1;
  kept.splice(at, 0, row);

  const rebuilt = [...lines.slice(0, start + 1), ...kept, ...lines.slice(end)];
  return `${rebuilt.join('\n').replace(/\s*$/, '')}\n`;
}
