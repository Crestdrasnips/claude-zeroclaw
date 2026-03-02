/**
 * Shared utilities for the JS layer.
 */

export function printBanner() {
  const lines = [
    '╔═══════════════════════════════════════════╗',
    '║       Claude ZeroClaw Gateway v0.1        ║',
    '║  OpenAI-compatible endpoint for Claude    ║',
    '╚═══════════════════════════════════════════╝',
  ];
  lines.forEach(l => console.log(l));
  console.log('');
}

export function getGatewayBase() {
  const host = process.env.CZG_HOST ?? 'localhost';
  const port = process.env.CZG_PORT ?? '8080';
  return `http://${host}:${port}`;
}

export function formatTable(headers, rows) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length))
  );
  const sep = widths.map(w => '─'.repeat(w + 2)).join('┼');
  const fmt = row => widths.map((w, i) => String(row[i] ?? '').padEnd(w)).join(' │ ');

  console.log(' ' + fmt(headers));
  console.log('─' + sep + '─');
  rows.forEach(r => console.log(' ' + fmt(r)));
}
