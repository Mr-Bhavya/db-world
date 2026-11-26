// Injects a theme-aware stylesheet into a job's HTML log report (rendered in an iframe).

export function injectLogTheme(html, { isDark, T, padding = 8 }) {
  const bg = isDark ? '#0b1220' : '#f8fafc';
  const surface = isDark ? '#111b2e' : '#ffffff';
  const surfaceHover = isDark ? '#152238' : '#f1f5f9';
  const fg = isDark ? '#dbe7f5' : '#172033';
  const muted = isDark ? '#8ea0b8' : '#64748b';
  const border = isDark ? '#26344a' : '#dbe3ee';
  const css = `
    :root { color-scheme: ${isDark ? 'dark' : 'light'}; }
    * { box-sizing: border-box; }
    html, body {
      background: ${bg} !important;
      color: ${fg} !important;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      line-height: 1.55;
      margin: 0;
      min-height: 100%;
      padding: 0;
    }
    body { padding: ${padding}px; }
    pre, code {
      font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    a { color: ${T.info} !important; }
    .log-report { max-width: 100%; }
    .report-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: ${padding + 2}px;
      padding: 2px 4px;
    }
    .report-header h2 {
      margin: 0;
      color: ${fg};
      font-size: 14px;
      font-weight: 800;
      letter-spacing: .01em;
    }
    .report-summary, .empty-state { margin: 0; color: ${muted}; font-size: 11px; }
    .log-list { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
    .log-entry {
      display: grid;
      grid-template-columns: 48px minmax(0, 170px) minmax(120px, .55fr) minmax(0, 1.45fr);
      gap: 10px;
      align-items: start;
      padding: 9px 11px;
      border: 1px solid ${border};
      border-left: 3px solid ${T.info};
      border-radius: 9px;
      background: ${surface};
      overflow-wrap: anywhere;
    }
    .log-entry:hover { background: ${surfaceHover}; }
    .log-entry.error { border-left-color: ${T.error}; }
    .log-entry.error { color: ${fg} !important; }
    .log-level {
      color: ${T.info};
      font: 700 10px/1.6 "Cascadia Code", Consolas, monospace;
      letter-spacing: .06em;
    }
    .log-entry.error .log-level { color: ${T.error}; }
    .log-time {
      color: ${muted};
      font: 11px/1.6 "Cascadia Code", Consolas, monospace;
    }
    .log-step { color: ${fg}; font-size: 12px; font-weight: 700; }
    .log-message { margin: 0; color: ${muted}; font-size: 12px; }
    h2, h3 { color: ${fg}; }
    ul, ol { margin-top: 8px; padding-left: 22px; }
    li { margin: 4px 0; }
    *[style*="color:red"], *[style*="color:#"], .error, .fail, .FAIL, .FAILED {
      color: ${T.error} !important;
    }
    .success, .ok, .SUCCESS { color: ${T.success} !important; }
    .warn, .warning, .WARN { color: ${T.warning} !important; }
    table {
      border-collapse: separate;
      border-spacing: 0;
      width: 100%;
      background: ${surface};
      border: 1px solid ${border};
      border-radius: 8px;
      overflow: hidden;
    }
    td, th {
      padding: ${padding <= 8 ? '4px 7px' : '6px 9px'};
      border-bottom: 1px solid ${border};
      text-align: left;
    }
    tr:last-child td { border-bottom: 0; }
    th { color: ${muted}; background: ${surfaceHover}; font-size: 11px; }
    ::selection { background: ${T.teal}; color: #fff; }
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-thumb { background: ${border}; border: 3px solid ${bg}; border-radius: 999px; }
    @media (max-width: 640px) {
      body { padding: ${Math.max(4, padding - 2)}px; }
      .report-header { align-items: flex-start; flex-direction: column; gap: 2px; }
      .log-entry {
        grid-template-columns: 48px minmax(0, 1fr);
        gap: 3px 9px;
        padding: 9px 10px;
      }
      .log-step, .log-message { grid-column: 1 / -1; }
      .log-message { padding-top: 2px; }
    }
  `;
  const styleTag = `<style>${css}</style>`;
  if (html.includes('</head>')) return html.replace('</head>', `${styleTag}</head>`);
  if (html.includes('<head>')) return html.replace('<head>', `<head>${styleTag}`);
  return `<html><head>${styleTag}</head><body>${html}</body></html>`;
}
