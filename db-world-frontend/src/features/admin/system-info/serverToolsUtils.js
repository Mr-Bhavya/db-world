/**
 * Server tools: the admin web apps that run on the Pi itself, outside db-world. Each one
 * is published through the Cloudflare Tunnel behind Cloudflare Access (db-world-config,
 * server_config/ACCESS.md), so a link here opens Cloudflare's sign-in first, never the
 * tool directly.
 *
 * No React, no MUI, so the status rules stay testable on their own.
 */
import { normalizeStatus } from './hostHealthUtils';

/**
 * `service` is the systemd unit that `dbworldctl doctor` checks as `svc.<service>`, so a
 * tile can say whether the thing behind its link is running before anyone clicks it.
 */
export const SERVER_TOOLS = [
  {
    id: 'pironman',
    name: 'Pironman dashboard',
    description: 'The case: fan, temperatures, OLED screen and lights, with history.',
    url: 'https://pironman.db-world.in',
    service: 'pironman5',
  },
  {
    id: 'ariang',
    name: 'AriaNg',
    description: 'aria2’s download queue: add, pause and inspect downloads by hand.',
    url: 'https://ariang.db-world.in',
    service: 'aria2',
  },
  {
    id: 'cloudbeaver',
    name: 'CloudBeaver',
    description: 'MySQL in the browser: SQL editor, table data, import/export, ER diagrams.',
    url: 'https://db.db-world.in',
    service: 'cloudbeaver',
  },
];

/** The Cloudflare Tunnel that carries every link above. */
export const TUNNEL_SERVICE = 'cloudflared';

/** Where the Access policy (who may sign in) lives. */
export const ACCESS_DASHBOARD_URL = 'https://one.dash.cloudflare.com/';

export const SERVICE_LABEL = { ok: 'Running', warn: 'Starting', fail: 'Stopped', unknown: 'Unknown' };

const serviceCheck = (report, service) =>
  (report?.checks ?? []).find((c) => c?.id === `svc.${service}`) ?? null;

/**
 * True when the doctor checked this unit at all. It skips units that are not installed,
 * which is how "the tunnel is not set up yet" shows up.
 */
export const isServiceChecked = (report, service) =>
  Boolean(report?.available && service && serviceCheck(report, service));

/**
 * ok | warn | fail | unknown, from the doctor report. Unknown with no report, a stale
 * report (that is the last known state, not the current one), or a unit it did not check.
 */
export function serviceStatus(report, service) {
  if (!report?.available || report.stale || !service) return 'unknown';
  const check = serviceCheck(report, service);
  return check ? normalizeStatus(check.status) : 'unknown';
}

/** The host name a link goes to, for showing under the tool's name. */
export const toolHost = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};
