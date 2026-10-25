import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@shared/services/CommonServices', () => ({ default: { handleCopy: vi.fn(async () => ({ success: true })) } }));
vi.mock('./useVault', () => ({ readSecret: vi.fn() }));

const { default: CommonServices } = await import('@shared/services/CommonServices');
const { copySecret } = await import('./useSecret');

describe('copySecret', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('hands the copy a promise of the value at once, so the clipboard write stays inside the tap', async () => {
    let arrive;
    const reveal = vi.fn(() => new Promise((r) => { arrive = r; }));

    const copying = copySecret(null, reveal);
    // Called synchronously, before the value has arrived.
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(CommonServices.handleCopy).toHaveBeenCalledTimes(1);
    const [pending, options] = CommonServices.handleCopy.mock.calls[0];
    expect(typeof pending.then).toBe('function');
    expect(options).toEqual({ sensitive: true });

    arrive(1234);   // a PIN may come back as a number
    await expect(pending).resolves.toBe('1234');
    await copying;
  });

  it('copies a value already held directly, without fetching it again', async () => {
    const reveal = vi.fn();
    await copySecret('pw-1', reveal);
    expect(reveal).not.toHaveBeenCalled();
    expect(CommonServices.handleCopy).toHaveBeenCalledWith('pw-1', { sensitive: true });
  });
});
