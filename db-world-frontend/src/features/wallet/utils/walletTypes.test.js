import { describe, it, expect } from 'vitest';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { typeIcon, categoryLabel, groupTypesByCategory, holderOptions } from './walletTypes';

const type = (id, category, iconKey) => ({ id, category, iconKey, displayName: id });

describe('typeIcon', () => {
  it('resolves a known semantic key', () => {
    expect(typeIcon('passport')).toBeTypeOf('object');
    expect(typeIcon('passport')).not.toBe(DescriptionOutlinedIcon);
  });

  it('falls back to a generic document icon rather than rendering nothing', () => {
    // An admin can create a type with any icon key they like; a missing icon must not leave a hole.
    expect(typeIcon('something-an-admin-invented')).toBe(DescriptionOutlinedIcon);
    expect(typeIcon(null)).toBe(DescriptionOutlinedIcon);
    expect(typeIcon(undefined)).toBe(DescriptionOutlinedIcon);
  });
});

describe('categoryLabel', () => {
  it('names known categories and files anything else under Other', () => {
    expect(categoryLabel('IDENTITY')).toBe('Identity');
    expect(categoryLabel('FINANCIAL')).toBe('Financial');
    expect(categoryLabel('SOMETHING_ELSE')).toBe('Other');
    expect(categoryLabel(null)).toBe('Other');
  });
});

describe('groupTypesByCategory', () => {
  it('groups in the picker’s declared order, not the input order', () => {
    const groups = groupTypesByCategory([
      type('bank', 'FINANCIAL'),
      type('aadhaar', 'IDENTITY'),
      type('rc', 'VEHICLE'),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['IDENTITY', 'VEHICLE', 'FINANCIAL']);
  });

  it('preserves the server’s ordering within a group', () => {
    const groups = groupTypesByCategory([
      type('a', 'IDENTITY'), type('b', 'IDENTITY'), type('c', 'IDENTITY'),
    ]);
    expect(groups[0].types.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('files an unknown or missing category under Other instead of dropping the type', () => {
    // An admin-created type must never vanish from the picker just because its category is new.
    const groups = groupTypesByCategory([type('custom', 'PETS'), type('none', null)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('OTHER');
    expect(groups[0].types.map((t) => t.id)).toEqual(['custom', 'none']);
  });

  it('drops empty groups and is null-safe', () => {
    expect(groupTypesByCategory([type('a', 'IDENTITY')]).map((g) => g.key)).toEqual(['IDENTITY']);
    expect(groupTypesByCategory([])).toEqual([]);
    expect(groupTypesByCategory(null)).toEqual([]);
  });
});

describe('holderOptions', () => {
  it('de-duplicates case-insensitively, keeping the first spelling seen', () => {
    // The whole point: free text alone lets "Dad", "dad" and "DAD" become three people.
    const docs = [
      { holderName: 'Dad' }, { holderName: 'dad' }, { holderName: 'DAD' }, { holderName: 'Spouse' },
    ];
    expect(holderOptions(docs)).toEqual(['Dad', 'Spouse']);
  });

  it('trims, and ignores blanks and missing names', () => {
    const docs = [{ holderName: '  Self  ' }, { holderName: '   ' }, { holderName: null }, {}];
    expect(holderOptions(docs)).toEqual(['Self']);
  });

  it('sorts alphabetically and is null-safe', () => {
    expect(holderOptions([{ holderName: 'Zara' }, { holderName: 'Amit' }])).toEqual(['Amit', 'Zara']);
    expect(holderOptions(null)).toEqual([]);
    expect(holderOptions([])).toEqual([]);
  });
});
