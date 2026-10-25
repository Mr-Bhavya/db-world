import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@shared/services/CommonServices', () => ({ default: { handleCopy: vi.fn(async () => ({ success: true })) } }));
vi.mock('./useVault', () => ({ readSecret: vi.fn() }));

const { default: CommonServices } = await import('@shared/services/CommonServices');
const { createSecretHold, copySecret, SECRET_HOLD_MS } = await import('./useSecret');

describe('createSecretHold', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('fetches on the first reveal, then answers from what it holds', async () => {
    const read = vi.fn(async () => 'pw-1');
    const hold = createSecretHold(read, () => {});

    await expect(hold.reveal()).resolves.toBe('pw-1');
    await expect(hold.reveal()).resolves.toBe('pw-1');
    expect(read).toHaveBeenCalledTimes(1);
    expect(hold.value).toBe('pw-1');
  });

  it('drops the value after thirty seconds, so the next reveal fetches again', async () => {
    const changes = [];
    const read = vi.fn(async () => 'pw-1');
    const hold = createSecretHold(read, (v) => changes.push(v));
    await hold.reveal();

    vi.advanceTimersByTime(SECRET_HOLD_MS - 1);
    expect(hold.value).toBe('pw-1');
    vi.advanceTimersByTime(1);
    expect(hold.value).toBeNull();
    expect(changes).toEqual(['pw-1', null]);

    await hold.reveal();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('hide() drops it at once and cancels the pending drop', async () => {
    const changes = [];
    const hold = createSecretHold(async () => 'pw-1', (v) => changes.push(v));
    await hold.reveal();

    hold.hide();
    vi.advanceTimersByTime(SECRET_HOLD_MS);
    expect(hold.value).toBeNull();
    expect(changes).toEqual(['pw-1', null]);
  });

  it('after dispose (the card moved to another entry) a read still in flight holds nothing', async () => {
    const changes = [];
    let arrive;
    const hold = createSecretHold(() => new Promise((r) => { arrive = r; }), (v) => changes.push(v));
    const pending = hold.reveal();

    hold.dispose();
    arrive('old-entrys-password');
    await pending;

    expect(hold.value).toBeNull();
    expect(changes).toEqual([]);
  });

  it('a failed read holds nothing and rejects', async () => {
    const hold = createSecretHold(async () => { throw new Error('429'); }, () => {});
    await expect(hold.reveal()).rejects.toThrow('429');
    expect(hold.value).toBeNull();
  });
});

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
