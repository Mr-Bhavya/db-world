import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@shared/theme', () => ({ useT: () => ({}) }));
vi.mock('@shared/components/SheetDialog', () => ({ default: () => null }));

import { TallySubmitButton } from './tallyFormUi';

describe('TallySubmitButton', () => {
  it('cannot be re-enabled by form validity while a save is pending', () => {
    const html = renderToStaticMarkup(
      <TallySubmitButton busy disabled={false}>Add expense</TallySubmitButton>,
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('Saving');
  });

  it('keeps an invalid form disabled and a valid idle form enabled', () => {
    const invalid = renderToStaticMarkup(<TallySubmitButton disabled>Save</TallySubmitButton>);
    const ready = renderToStaticMarkup(<TallySubmitButton disabled={false}>Save</TallySubmitButton>);
    expect(invalid).toContain('disabled=""');
    expect(ready).not.toContain('disabled=""');
    expect(ready).toContain('aria-busy="false"');
    expect(ready).not.toContain('role="progressbar"');
  });
});