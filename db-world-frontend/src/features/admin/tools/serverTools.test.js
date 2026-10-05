import { describe, it, expect } from 'vitest';
import {
  SERVER_TOOLS, TUNNEL_SERVICE, isServiceChecked, serviceStatus, toolIndicator,
} from './serverTools';

const report = (checks, extra = {}) => ({ available: true, stale: false, checks, ...extra });
const tool = (id) => SERVER_TOOLS.find((t) => t.id === id);

describe('SERVER_TOOLS', () => {
  it('links only over https', () => {
    for (const t of SERVER_TOOLS) expect(new URL(t.url).protocol).toBe('https:');
  });

  it('has unique ids, and a unit name the doctor can check where there is one', () => {
    const ids = SERVER_TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of SERVER_TOOLS) {
      if (t.service !== null) expect(t.service).toMatch(/^[a-z0-9_-]+$/);
    }
  });

  it('covers CloudBeaver, Pironman and AriaNg', () => {
    expect(SERVER_TOOLS.map((t) => t.service)).toEqual(
      expect.arrayContaining(['cloudbeaver', 'pironman5', 'aria2']),
    );
  });
});

describe('serviceStatus', () => {
  it('reads the doctor check for the unit', () => {
    const r = report([{ id: 'svc.aria2', status: 'ok' }, { id: 'svc.pironman5', status: 'fail' }]);
    expect(serviceStatus(r, 'aria2')).toBe('ok');
    expect(serviceStatus(r, 'pironman5')).toBe('fail');
  });

  it('is unknown without a report, with a stale one, or for a unit it did not check', () => {
    expect(serviceStatus(undefined, 'aria2')).toBe('unknown');
    expect(serviceStatus({ available: false }, 'aria2')).toBe('unknown');
    expect(serviceStatus(report([{ id: 'svc.aria2', status: 'ok' }], { stale: true }), 'aria2')).toBe('unknown');
    expect(serviceStatus(report([{ id: 'svc.aria2', status: 'ok' }]), 'cloudbeaver')).toBe('unknown');
  });

  it('does not match a check whose id merely contains the unit name', () => {
    expect(serviceStatus(report([{ id: 'svc.aria2-extra', status: 'ok' }]), 'aria2')).toBe('unknown');
  });

  it('survives a report with holes in it', () => {
    expect(serviceStatus(report([null, { status: 'ok' }]), 'aria2')).toBe('unknown');
    expect(serviceStatus({ available: true }, 'aria2')).toBe('unknown');
  });
});

describe('isServiceChecked', () => {
  it('tells "not installed" (no check) apart from "checked"', () => {
    const r = report([{ id: 'svc.aria2', status: 'fail' }]);
    expect(isServiceChecked(r, 'aria2')).toBe(true);
    expect(isServiceChecked(r, TUNNEL_SERVICE)).toBe(false);
    expect(isServiceChecked(undefined, 'aria2')).toBe(false);
  });
});

describe('toolIndicator', () => {
  const healthy = [
    { id: 'svc.cloudflared', status: 'ok' },
    { id: 'svc.cloudbeaver', status: 'ok' },
    { id: 'svc.aria2', status: 'fail' },
  ];

  it('says what the tool is doing', () => {
    expect(toolIndicator(report(healthy), tool('tool-database'))).toEqual({ status: 'ok', text: 'Running' });
    expect(toolIndicator(report(healthy), tool('tool-ariang'))).toEqual({ status: 'fail', text: 'Stopped' });
  });

  it('puts a stopped tunnel first: the link will not open, whatever the tool does', () => {
    const r = report([{ id: 'svc.cloudflared', status: 'fail' }, { id: 'svc.cloudbeaver', status: 'ok' }]);
    expect(toolIndicator(r, tool('tool-database'))).toEqual({ status: 'fail', text: 'Tunnel down: the link will not open' });
  });

  it('ignores a tunnel the doctor does not check (not installed)', () => {
    const r = report([{ id: 'svc.cloudbeaver', status: 'ok' }]);
    expect(toolIndicator(r, tool('tool-database'))).toEqual({ status: 'ok', text: 'Running' });
  });

  it('is unknown without a current report', () => {
    expect(toolIndicator(undefined, tool('tool-pironman'))).toEqual({ status: 'unknown', text: 'Status unknown' });
    expect(toolIndicator(report(healthy, { stale: true }), tool('tool-pironman'))).toEqual({ status: 'unknown', text: 'Status unknown' });
  });

  it('is null for a tool with nothing on the Pi to watch', () => {
    expect(toolIndicator(report(healthy), tool('tool-access'))).toBeNull();
    expect(toolIndicator(report(healthy), undefined)).toBeNull();
  });
});
