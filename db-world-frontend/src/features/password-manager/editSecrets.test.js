import { describe, it, expect, vi } from 'vitest';
import fetchEditSecrets from './editSecrets';

const CRED = {
  id: 'c1', hasPassword: true, hasPin: true, hasNotes: false,
  customFields: [
    { id: 'f1', fieldKey: 'Recovery', fieldType: 'HIDDEN', fieldValue: null },
    { id: 'f2', fieldKey: 'Account no', fieldType: 'TEXT', fieldValue: '12-34' },
    { id: 'f3', fieldKey: 'Spare', fieldType: 'HIDDEN', fieldValue: null },
  ],
};

describe('fetchEditSecrets', () => {
  it('reads the whole entry once and fills in every hidden value', async () => {
    const readAll = vi.fn(async () => ({
      password: 'pw-1', pin: '4321', notes: null, customFields: { f1: 'code', f2: '12-34', f3: null },
    }));

    const secrets = await fetchEditSecrets(CRED, readAll);

    expect(readAll).toHaveBeenCalledTimes(1);
    expect(readAll).toHaveBeenCalledWith('c1');
    expect(secrets).toEqual({
      password: 'pw-1', pin: '4321', notes: '',
      customFields: [
        { ...CRED.customFields[0], fieldValue: 'code' },
        CRED.customFields[1],
        { ...CRED.customFields[2], fieldValue: '' },   // an empty hidden field stays empty
      ],
    });
  });

  it('fails instead of opening with a blank when a hidden field cannot be read', async () => {
    const readAll = async () => ({ password: 'pw-1', pin: '4321', customFields: { f1: 'code' } });   // no f3

    await expect(fetchEditSecrets(CRED, readAll)).rejects.toThrow('Spare');
  });

  it('fails when the read fails: the dialog then shows no form', async () => {
    await expect(fetchEditSecrets(CRED, async () => { throw new Error('429'); })).rejects.toThrow('429');
  });
});
