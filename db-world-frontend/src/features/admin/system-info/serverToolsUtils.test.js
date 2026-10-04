import { describe, it, expect } from 'vitest';
import {
  SERVER_TOOLS, TUNNEL_SERVICE, isServiceChecked, serviceStatus, toolHost,
} from './serverToolsUtils';

const report = (checks, extra = {}) => ({ available: true, stale: false, checks, ...extra });

describe('SERVER_TOOLS', () => {
  it('links only over https, each to a unit the doctor can check', () => {
    for (const tool of SERVER_TOOLS) {
      expect(new URL(tool.url).protocol).toBe('https:');
      expect(tool.service).toMatch(/^[a-z0-9_-]+$/);
    }
  });

  it('has unique ids', () => {
    const ids = SERVER_TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('serviceStatus', () => {
  it('reads the doctor check for the unit', () => {
    const r = report([
      { id: 'svc.aria2', status: 'ok' },
      { id: 'svc.pironman5', status: 'fail' },
    ]);
    expect(serviceStatus(r, 'aria2')).toBe('ok');
    expect(serviceStatus(r, 'pironman5')).toBe('fail');
  });

  it('is unknown without a report, or when the host has none', () => {
    expect(serviceStatus(undefined, 'aria2')).toBe('unknown');
    expect(serviceStatus({ available: false, reason: 'no file' }, 'aria2')).toBe('unknown');
  });

  it('is unknown when the report is stale: that is the last known state, not now', () => {
    expect(serviceStatus(report([{ id: 'svc.aria2', status: 'ok' }], { stale: true }), 'aria2')).toBe('unknown');
  });

  it('is unknown for a unit the doctor did not check', () => {
    expect(serviceStatus(report([{ id: 'svc.aria2', status: 'ok' }]), 'cloudflared')).toBe('unknown');
  });

  it('does not match a check whose id merely contains the unit name', () => {
    expect(serviceStatus(report([{ id: 'svc.aria2-extra', status: 'ok' }]), 'aria2')).toBe('unknown');
  });

  it('treats a status it does not know as unknown', () => {
    expect(serviceStatus(report([{ id: 'svc.aria2', status: 'weird' }]), 'aria2')).toBe('unknown');
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
    expect(isServiceChecked({ available: false }, 'aria2')).toBe(false);
  });
});

describe('toolHost', () => {
  it('shows the host of a link', () => {
    expect(toolHost('https://pironman.db-world.in')).toBe('pironman.db-world.in');
    expect(toolHost('https://ariang.db-world.in/#!/downloading')).toBe('ariang.db-world.in');
  });

  it('falls back to the text when it is not a URL', () => {
    expect(toolHost('not a url')).toBe('not a url');
  });
});
