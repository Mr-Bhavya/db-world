import { describe, it, expect } from 'vitest';
import { scorePassword, analyzeVault, summarizeVault } from './passwordUtils';

// The server scores passwords now (PasswordStrength.java) and must agree with this scale. The same
// table is in PasswordStrengthTest.java: change one, change both.
const PARITY = [
  ['', 0],
  ['a', 1],
  ['abc', 1],
  ['aaaaaaaa', 2],                       // a repeat: -8
  ['password', 2],
  ['Password1', 3],
  ['12345678', 1],                       // a sequence: -8
  ['abcdefgh', 2],
  ['ABCDqwer', 2],                       // both penalties are one each, case-insensitive
  ['!@#$%^&', 2],                        // 7 symbols = 35 bits
  ['!@#$%^&*', 3],                       // 8 symbols = exactly 40 bits: the edge belongs to the band above
  ['!!!@#$%^', 2],                       // 40 - 8
  ['!@#$%^&*()-_', 4],                   // exactly 60 bits
  ['!@#$%^&*()-_=+[]{}', 5],             // exactly 90 bits
  ['!@#$%^&*()-_=+[]{', 4],              // 85 bits
  ['Tr0ub4dor&3', 4],
  ['correct horse battery staple', 5],
  ['Zx9!Zx9!Zx9!Zx9!', 5],
  ['xK#9mQ2$vL7@nB4&wP8!', 5],
  ['ñandú', 2],
  ['qwerty123', 2],
  ['Qwerty!2024', 4],
  ['aaa\naaa', 2],                       // 41 bits - 8 for "aaa"
  ['a\n\n\nb', 2],                       // "." skips line breaks: no repeat
  ['😀😀😀', 2], // six UTF-16 units, 30 bits, alternating halves are no repeat
];

describe('scorePassword', () => {
  it.each(PARITY)('scores %j as level %i, the same as the server', (pw, level) => {
    expect(scorePassword(pw).level).toBe(level);
  });
});

describe('analyzeVault', () => {
  it('counts weak and reused from the strength and reused the server sends', () => {
    const vault = [
      { id: 'pm1', host: 'a.io', credentials: [
        { id: 'c1', strength: 1, reused: true },
        { id: 'c2', strength: 4, reused: true },
      ] },
      { id: 'pm2', host: 'b.io', credentials: [
        { id: 'c3', strength: 0, reused: false },   // no password: neither weak nor reused
        { id: 'c4', strength: 5, reused: false },
      ] },
    ];
    const { flags, weak, reused, total, health } = analyzeVault(vault);
    expect(total).toBe(4);
    expect(weak).toBe(1);
    expect(reused).toBe(2);
    expect(flags.c1).toEqual({ level: 1, weak: true, reused: true });
    expect(flags.c3).toEqual({ level: 0, weak: false, reused: false });
    expect(health).toBe(Math.round(100 - ((1 + 2 * 0.7) / 4) * 100));
  });

  it('is healthy and empty for no vault', () => {
    expect(analyzeVault()).toMatchObject({ weak: 0, reused: 0, total: 0, health: 100 });
  });
});

describe('summarizeVault', () => {
  // The offline copy holds the full old-style payload: the list is rebuilt from it on the device.
  const SNAPSHOT = [
    { id: 'pm1', host: 'netflix.com', credentials: [
      { id: 'c1', name: 'Netflix', type: 'LOGIN', url: 'https://netflix.com', username: 'me',
        password: 'Tr0ub4dor&3', pin: '1234', notes: 'n', deletedAt: null,
        customFields: [
          { id: 'f1', fieldKey: 'Recovery', fieldValue: 'secret', fieldType: 'HIDDEN' },
          { id: 'f2', fieldKey: 'Account', fieldValue: '12-34', fieldType: 'TEXT' },
          { id: 'f3', fieldKey: 'Console', fieldValue: 'https://x.io', fieldType: 'URL' },
          { id: 'f4', fieldKey: 'Key', fieldValue: 'k\ney', fieldType: 'MULTILINE' },
          { id: 'f5', fieldKey: 'Old', fieldValue: 'untyped' },
        ] },
      { id: 'c2', name: 'Netflix Kids', username: 'kids', password: ' Tr0ub4dor&3 ', pin: '0', notes: '  ' },
    ] },
    { id: 'pm2', host: 'box', credentials: [{ id: 'c3', name: 'box', username: 'root', password: '' }] },
  ];

  it('drops every secret and keeps what the list shows', () => {
    const out = summarizeVault(SNAPSHOT);
    const json = JSON.stringify(out);
    for (const secret of ['Tr0ub4dor', '1234', '"n"', 'secret', 'k\\ney', 'untyped']) {
      expect(json).not.toContain(secret);
    }
    expect(out[0]).toMatchObject({ id: 'pm1', host: 'netflix.com' });
    const [c1, c2] = out[0].credentials;
    expect(c1).toMatchObject({
      id: 'c1', name: 'Netflix', type: 'LOGIN', url: 'https://netflix.com', username: 'me',
      hasPassword: true, hasPin: true, hasNotes: true, strength: 4, reused: true, breached: false,
    });
    expect(c1.customFields).toEqual([
      { id: 'f1', fieldKey: 'Recovery', fieldType: 'HIDDEN', fieldValue: null, hasValue: true },
      { id: 'f2', fieldKey: 'Account', fieldType: 'TEXT', fieldValue: '12-34', hasValue: true },
      { id: 'f3', fieldKey: 'Console', fieldType: 'URL', fieldValue: 'https://x.io', hasValue: true },
      { id: 'f4', fieldKey: 'Key', fieldType: 'MULTILINE', fieldValue: null, hasValue: true },
      { id: 'f5', fieldKey: 'Old', fieldType: 'HIDDEN', fieldValue: null, hasValue: true },
    ]);
    expect(c2).toMatchObject({ hasPassword: true, hasPin: false, hasNotes: false, strength: 4, reused: true });
    expect(out[1].credentials[0]).toMatchObject({ hasPassword: false, strength: 0, reused: false });
  });

  it('says when a hidden field has nothing in it, so it is not shown as a masked row', () => {
    const out = summarizeVault([{ id: 'pm1', host: 'x', credentials: [{ id: 'c1', customFields: [
      { id: 'f1', fieldKey: 'Empty', fieldValue: '', fieldType: 'HIDDEN' },
      { id: 'f2', fieldKey: 'Blank', fieldValue: '  ', fieldType: 'MULTILINE' },
      { id: 'f3', fieldKey: 'Missing', fieldType: 'HIDDEN' },
    ] }] }]);
    expect(out[0].credentials[0].customFields.map((f) => f.hasValue)).toEqual([false, false, false]);
  });
});
