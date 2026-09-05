// Minimal, dependency-free terminal styling. Colors auto-disable when stdout
// isn't a TTY (piped, redirected, or under test) or when NO_COLOR is set —
// standard CLI convention, and it keeps piped/test output plain.
const colorEnabled = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

function wrap(code) {
  return (s) => (colorEnabled ? `\x1b[${code}m${s}\x1b[0m` : String(s));
}

export const color = {
  green: wrap(32),
  yellow: wrap(33),
  red: wrap(31),
  cyan: wrap(36),
  gray: wrap(90),
  bold: wrap(1),
  dim: wrap(2),
};

const STATUS_STYLE = {
  installed: { symbol: '✓', paint: color.green },
  'up-to-date': { symbol: '✓', paint: color.green },
  adopted: { symbol: '✓', paint: color.green },
  updated: { symbol: '↑', paint: color.cyan },
  drifted: { symbol: '~', paint: color.yellow },
  skipped: { symbol: '−', paint: color.yellow },
  missing: { symbol: '!', paint: color.red },
  'not-installed': { symbol: '○', paint: color.gray },
};

function styleFor(status) {
  return STATUS_STYLE[status] ?? { symbol: '?', paint: (s) => s };
}

export function banner(title) {
  const rule = color.dim('─'.repeat(Math.max(10, Math.min(60, title.length))));
  return `\n${color.bold(color.cyan(title))}\n${rule}`;
}

export function installLine(status, name) {
  const { symbol, paint } = styleFor(status);
  return `  ${paint(`${symbol} ${status}`.padEnd(13))} ${name}`;
}

export function listLine(status, name, description, tier) {
  const { symbol, paint } = styleFor(status);
  const label = paint(`${symbol} ${status}`.padEnd(13));
  const tierTag = tier === 'recommended' ? `${color.cyan('[recommended]')} ` : tier === 'opt-in' ? `${color.dim('[opt-in]')} ` : '';
  const desc = description ? color.dim(`— ${description}`) : '';
  return `  ${label} ${color.bold(name)} ${tierTag}${desc}`;
}

export function summarize(items) {
  const counts = {};
  for (const item of items) counts[item.status] = (counts[item.status] ?? 0) + 1;
  const entries = Object.entries(counts);
  if (entries.length === 0) return color.dim('nothing to do');
  return entries
    .map(([status, n]) => styleFor(status).paint(`${n} ${status}`))
    .join(color.dim(' · '));
}

export function warningLine(message) {
  return color.yellow(`  ! ${message}`);
}
