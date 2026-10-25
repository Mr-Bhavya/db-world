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
    CommonServices._cancelPendingClear();
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

// A page that can be hidden and unfocused, with the events a browser fires when the user comes back.
function stubPage() {
  const doc = Object.assign(new EventTarget(), { hidden: false, visibilityState: 'visible' });
  const win = new EventTarget();
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', win);
  const setHidden = (hidden) => {
    doc.hidden = hidden;
    doc.visibilityState = hidden ? 'hidden' : 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
  };
  const focus = () => win.dispatchEvent(new Event('focus'));
  return { setHidden, focus };
}

// A browser refuses a clipboard write from a page that is hidden or unfocused.
function refuseWhileAway(board) {
  const state = { away: false };
  const write = board.writeText.getMockImplementation();
  board.writeText.mockImplementation(async (t) => {
    if (state.away) throw new DOMException('Document is not focused.', 'NotAllowedError');
    return write(t);
  });
  return state;
}

describe('handleCopy clear after the page comes back', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(async () => {
    await vi.runOnlyPendingTimersAsync();
    CommonServices._cancelPendingClear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('clears when the page is visible again if the time ran out while it was hidden', async () => {
    const board = stubClipboard({ readable: false });
    const page = stubPage();
    const away = refuseWhileAway(board);
    await CommonServices.handleCopy('s3cret', { sensitive: true });
    away.away = true;
    page.setHidden(true);   // switched to another app to paste

    await vi.advanceTimersByTimeAsync(30000);
    expect(board.text).toBe('s3cret');
    expect(board.writeText).toHaveBeenCalledTimes(1);   // no doomed attempt while hidden

    away.away = false;
    page.setHidden(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(board.text).toBe('');
  });

  it('retries a refused clear once the window has focus again', async () => {
    const board = stubClipboard({ readable: false });
    const page = stubPage();
    const away = refuseWhileAway(board);
    await CommonServices.handleCopy('s3cret', { sensitive: true });
    away.away = true;   // another window: still visible, but unfocused

    await vi.advanceTimersByTimeAsync(30000);
    expect(board.writeText).toHaveBeenLastCalledWith('');
    expect(board.text).toBe('s3cret');

    away.away = false;
    page.focus();
    await vi.advanceTimersByTimeAsync(0);
    expect(board.text).toBe('');
  });

  it('retries only once, then stops listening', async () => {
    const board = stubClipboard({ readable: false });
    const page = stubPage();
    await CommonServices.handleCopy('s3cret', { sensitive: true });
    board.writeText.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));

    await vi.advanceTimersByTimeAsync(30000);   // refused
    page.focus();
    await vi.advanceTimersByTimeAsync(0);       // refused again: given up
    expect(board.writeText).toHaveBeenCalledTimes(3);
    expect(CommonServices._pendingClear).toBeNull();

    page.focus();
    page.setHidden(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(board.writeText).toHaveBeenCalledTimes(3);
  });

  it('does not count a change to hidden as a return', async () => {
    const board = stubClipboard({ readable: false });
    const page = stubPage();
    const away = refuseWhileAway(board);
    await CommonServices.handleCopy('s3cret', { sensitive: true });
    away.away = true;
    await vi.advanceTimersByTimeAsync(30000);   // refused: waiting
    expect(board.writeText).toHaveBeenCalledTimes(2);

    page.setHidden(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(board.writeText).toHaveBeenCalledTimes(2);
  });

  it('on return, still leaves alone a clipboard that now holds something else', async () => {
    const board = stubClipboard();   // readable, granted
    const page = stubPage();
    await CommonServices.handleCopy('s3cret', { sensitive: true });
    page.setHidden(true);
    await vi.advanceTimersByTimeAsync(30000);
    board.text = 'copied in another app';

    page.setHidden(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(board.text).toBe('copied in another app');
  });

  it('a later successful copy cancels the waiting clear and its listeners', async () => {
    const board = stubClipboard({ readable: false });
    const page = stubPage();
    await CommonServices.handleCopy('s3cret', { sensitive: true });
    board.writeText.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    await vi.advanceTimersByTimeAsync(30000);   // refused: waiting for the page to come back

    await CommonServices.handleCopy('username');
    expect(CommonServices._pendingClear).toBeNull();
    page.focus();
    page.setHidden(false);
    await vi.advanceTimersByTimeAsync(60000);
    expect(board.text).toBe('username');
  });
});

describe('handleCopy of a sensitive value never uses the share sheet', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('skips Web Share for a secret, but not for an ordinary copy', async () => {
    const share = vi.fn(async () => {});
    // No Clipboard API, a phone, and no DOM for the textarea fallback.
    vi.stubGlobal('navigator', { share, userAgent: 'Mozilla/5.0 (Linux; Android 14)' });

    const secret = await CommonServices.handleCopy('s3cret', { sensitive: true });
    expect(share).not.toHaveBeenCalled();
    expect(secret.success).toBe(false);

    const ordinary = await CommonServices.handleCopy('hello');
    expect(share).toHaveBeenCalledWith({ title: 'Shared Content', text: 'hello' });
    expect(ordinary.method).toBe('web-share');
  });

  it('skips it even when the caller asks for sharing', async () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal('navigator', { share, userAgent: 'iPhone' });
    await CommonServices.handleCopy('s3cret', { sensitive: true, enableShare: true });
    expect(share).not.toHaveBeenCalled();
  });
});

// navigator.clipboard.write with a ClipboardItem whose value is a promise, as Safari takes it.
function stubClipboardItem(board) {
  vi.stubGlobal('ClipboardItem', class ClipboardItem {
    constructor(items) { this.items = items; }
  });
  board.write = vi.fn(async ([item]) => {
    const blob = await item.items['text/plain'];
    board.text = await blob.text();
  });
}

describe('handleCopy of a value still being fetched', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(async () => {
    await vi.runOnlyPendingTimersAsync();
    CommonServices._cancelPendingClear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('with ClipboardItem, writes inside the tap and fills in the value when it arrives', async () => {
    const board = stubClipboard();
    stubClipboardItem(board);
    let arrive;
    const value = new Promise((r) => { arrive = r; });

    const copying = CommonServices.handleCopy(value, { sensitive: true });
    expect(board.write).toHaveBeenCalledTimes(1);   // synchronously, before the value is here
    arrive('s3cret');
    await expect(copying).resolves.toEqual({ success: true, message: 'Copied to clipboard', method: 'clipboard-item' });
    expect(board.text).toBe('s3cret');
    expect(board.writeText).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30000);   // a sensitive copy: emptied 30 s later
    expect(board.text).toBe('');
  });

  it('without ClipboardItem, waits for the value and writes it the ordinary way, clear included', async () => {
    const board = stubClipboard();
    const res = await CommonServices.handleCopy(Promise.resolve('s3cret'), { sensitive: true });
    expect(res.method).toBe('clipboard-api');
    expect(board.writeText).toHaveBeenCalledWith('s3cret');

    await vi.advanceTimersByTimeAsync(30000);
    expect(board.text).toBe('');
  });

  it('falls back to writeText when the ClipboardItem write is refused', async () => {
    const board = stubClipboard();
    stubClipboardItem(board);
    board.write.mockRejectedValue(new DOMException('not allowed', 'NotAllowedError'));
    const res = await CommonServices.handleCopy(Promise.resolve('s3cret'), { sensitive: true });
    expect(res.method).toBe('clipboard-api');
    expect(board.text).toBe('s3cret');
  });

  for (const withItem of [true, false]) {
    it('reports a failed fetch as a failed copy and schedules no clear' + (withItem ? ' (ClipboardItem)' : ' (no ClipboardItem)'), async () => {
      const board = stubClipboard({ readable: false });
      if (withItem) stubClipboardItem(board);
      board.text = 'something the user copied earlier';

      const res = await CommonServices.handleCopy(Promise.reject(new Error('429')), { sensitive: true });
      expect(res).toEqual({ success: false, message: 'Copy failed: 429', method: 'error' });
      expect(board.writeText).not.toHaveBeenCalled();
      expect(CommonServices._pendingClear).toBeNull();

      await vi.advanceTimersByTimeAsync(60000);
      expect(board.text).toBe('something the user copied earlier');
    });
  }

  it('treats an empty value as a failed copy', async () => {
    const board = stubClipboard();
    stubClipboardItem(board);
    const res = await CommonServices.handleCopy(Promise.resolve(''), { sensitive: true });
    expect(res.success).toBe(false);
    expect(board.writeText).not.toHaveBeenCalled();
  });
});
