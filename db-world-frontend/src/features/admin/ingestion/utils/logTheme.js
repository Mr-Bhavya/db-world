// Injects a theme-aware stylesheet into a job's HTML log report (rendered in an iframe).

export function injectLogTheme(html, { isDark, T, padding = 8 }) {
  const bg = isDark ? '#111827' : '#ffffff';
  const fg = isDark ? '#d1d5db' : '#111827';
  const css = `
    html, body {
      background: ${bg} !important;
      color: ${fg} !important;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 12px;
      margin: 0;
      padding: ${padding}px;
      word-break: break-word;
    }
    pre, code { white-space: pre-wrap; }
    a { color: ${T.info} !important; }
    *[style*="color:red"], *[style*="color:#"], .error, .fail, .FAIL, .FAILED {
      color: ${T.error} !important;
    }
    .success, .ok, .SUCCESS { color: ${T.success} !important; }
    .warn, .warning, .WARN { color: ${T.warning} !important; }
    table { border-collapse: collapse; width: 100%; }
    td, th {
      padding: ${padding <= 8 ? '2px 6px' : '4px 7px'};
      border: 1px solid ${isDark ? '#374151' : '#d1d5db'};
    }
  `;
  const styleTag = `<style>${css}</style>`;
  if (html.includes('</head>')) return html.replace('</head>', `${styleTag}</head>`);
  if (html.includes('<head>')) return html.replace('<head>', `<head>${styleTag}`);
  return `<html><head>${styleTag}</head><body>${html}</body></html>`;
}
