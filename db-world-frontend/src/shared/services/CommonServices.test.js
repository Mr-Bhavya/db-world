import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CommonServices from './CommonServices';

// A clipboard that holds one string. readable = false stands in for a WebView that refuses readText();
// readState is what navigator.permissions reports for clipboard-read.
function stubClipboard({ readable = true, readState = readable ? 'granted' : 'denied' } = {}) {
  const board = { text: '' };
  board.writeText = vi.fn(async (t) => { board.text = t; });
  board.readText = readable
    ? vi.fn(async () => board.text)
    : vi.fn(async () => { throw new DOMException('Read permission denied', 'NotAllowedError'); });
  const permissions = { query: vi.fn(async () => ({ state: readState })) };
  vi.stubGlobal('navigator', { clipboard: board, permissions, userAgent: 'test' });
  return board;
}

describe('handleCopy clipboard auto-clear', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(async () => {
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('clearsASensitiveCopyAfterThirtySeconds', async () => {
    const board = stubClipboard();
    const res = await CommonServices.handleCopy('s3cret', { sensitive: true });
    expect(res).toEqual({ success: true, message: 'Copied to clipboard', method: 'clipboard-api' });

    await vi.advanceTimersByTimeAsync(29999);
    expect(board.text).toBe('s3cret');
    await vi.advanceTimersByTimeAsync(1);
    expect(board.text).toBe('');
  });

  it('leavesAnOrdinaryCopyAlone', async () => {
    const board = stubClipboard();
    await CommonServices.handleCopy('hello');

    await vi.advanceTimersByTimeAsync(120000);
    expect(board.text).toBe('hello');
    expect(board.writeText).toHaveBeenCalledTimes(1);
  });

  it('doesNotClearIfTheClipboardChanged', async () => {
    const board = stubClipboard();
    await CommonServices.handleCopy('s3cret', { sensitive: true });
    board.text = 'copied in another app';

    await vi.advanceTimersByTimeAsync(30000);
    expect(board.text).toBe('copied in another app');
  });

  it('clears unconditionally when the clipboard cannot be read', async () => {
    const board = stubClipboard({ readable: false });
    await CommonServices.handleCopy('s3cret', { sensitive: true });

    await vi.advanceTimersByTimeAsync(30000);
    expect(board.text).toBe('');
  });

  it('clears unconditionally when reading would throw despite the grant', async () => {
    const board = stubClipboard({ readable: false, readState: 'granted' });
    await CommonServices.handleCopy('s3cret', { sensitive: true });

    await vi.advanceTimersByTimeAsync(30000);
    expect(board.readText).toHaveBeenCalled();
    expect(board.text).toBe('');
  });

  it('never asks to read the clipboard: without the grant it clears without reading', async () => {
    const board = stubClipboard({ readState: 'prompt' });
    await CommonServices.handleCopy('s3cret', { sensitive: true });

    await vi.advanceTimersByTimeAsync(30000);
    expect(board.readText).not.toHaveBeenCalled();
    expect(board.text).toBe('');
  });

  it('honours clearAfterMs', async () => {
    const board = stubClipboard();
    await CommonServices.handleCopy('s3cret', { sensitive: true, clearAfterMs: 5000 });

    await vi.advanceTimersByTimeAsync(5000);
    expect(board.text).toBe('');
  });

  it('does not wipe a second sensitive copy early when the clipboard cannot be read', async () => {
    const board = stubClipboard({ readable: false });
    await CommonServices.handleCopy('first', { sensitive: true });
    await vi.advanceTimersByTimeAsync(20000);
    await CommonServices.handleCopy('second', { sensitive: true });

    await vi.advanceTimersByTimeAsync(10000); // the first copy's 30 s are up
    expect(board.text).toBe('second');
    await vi.advanceTimersByTimeAsync(20000); // the second copy's 30 s are up
    expect(board.text).toBe('');
  });

  it('does not wipe an ordinary copy made after a sensitive one when the clipboard cannot be read', async () => {
    const board = stubClipboard({ readable: false });
    await CommonServices.handleCopy('s3cret', { sensitive: true });
    await vi.advanceTimersByTimeAsync(10000);
    await CommonServices.handleCopy('username');

    await vi.advanceTimersByTimeAsync(60000);
    expect(board.text).toBe('username');
  });

  it('swallows a failed clear', async () => {
    const board = stubClipboard({ readable: false });
    await CommonServices.handleCopy('s3cret', { sensitive: true });
    board.writeText.mockRejectedValueOnce(new Error('denied'));

    // A rejection escaping the timer would surface as an unhandled rejection and fail the run.
    await vi.advanceTimersByTimeAsync(30000);
    expect(board.writeText).toHaveBeenLastCalledWith('');
    expect(board.text).toBe('s3cret');
  });
});
