import { describe, expect, it } from 'vitest';
import { injectLogTheme } from './logTheme';

const T = {
  info: '#38bdf8',
  error: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
  teal: '#14b8a6',
};

describe('injectLogTheme', () => {
  it('injects responsive log-card styling into a full document', () => {
    const result = injectLogTheme(
      '<html><head><title>Report</title></head><body><main class="log-report"></main></body></html>',
      { isDark: true, T, padding: 10 },
    );

    expect(result).toContain('.log-entry');
    expect(result).toContain('grid-template-columns: 48px');
    expect(result).toContain('@media (max-width: 640px)');
    expect(result.indexOf('<style>')).toBeLessThan(result.indexOf('</head>'));
  });

  it('wraps a partial report and applies the light surface', () => {
    const result = injectLogTheme('<p>log</p>', { isDark: false, T });

    expect(result).toMatch(/^<html><head>/);
    expect(result).toContain('background: #f8fafc');
    expect(result).toContain('<body><p>log</p></body></html>');
  });
});
