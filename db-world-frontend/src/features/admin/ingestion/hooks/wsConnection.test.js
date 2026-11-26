import { describe, expect, it } from 'vitest';
import { reconnectDelay, shouldReconnect, withAccessToken } from './wsConnection';

describe('withAccessToken', () => {
  it('appends an encoded token', () => {
    expect(withAccessToken('wss://h/ws/status', 'a.b+c')).toBe('wss://h/ws/status?token=a.b%2Bc');
  });
  it('uses & when the url already has a query', () => {
    expect(withAccessToken('/ws/status?x=1', 't')).toBe('/ws/status?x=1&token=t');
  });
  it('leaves the url alone without a token', () => {
    expect(withAccessToken('/ws/status', null)).toBe('/ws/status');
  });
});

describe('shouldReconnect', () => {
  it('reconnects after a server-side normal close', () => {
    expect(shouldReconnect({ closedByClient: false, unmounted: false })).toBe(true);
  });
  it('does not reconnect after a client close or unmount', () => {
    expect(shouldReconnect({ closedByClient: true, unmounted: false })).toBe(false);
    expect(shouldReconnect({ closedByClient: false, unmounted: true })).toBe(false);
  });
});

describe('reconnectDelay', () => {
  it('backs off exponentially and caps', () => {
    expect(reconnectDelay(0)).toBe(2000);
    expect(reconnectDelay(2)).toBe(8000);
    expect(reconnectDelay(10)).toBe(30000);
  });
});
