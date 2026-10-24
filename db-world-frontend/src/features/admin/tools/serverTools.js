/**
 * Server tools: the web apps that run on the Pi beside db-world (CloudBeaver, the Pironman
 * dashboard, AriaNg), and the Cloudflare dashboard that decides who may open them. Each Pi
 * tool is published through the Cloudflare Tunnel behind Cloudflare Access (db-world-config,
 * server_config/ACCESS.md), so its link asks for Cloudflare's sign-in first.
 *
 * They form the "Tools" section of the admin sidebar (adminModules.jsx), open in a new tab,
 * and carry a status dot from the `dbworldctl doctor` report.
 *
 * No React here, so the status rules are tested on their own.
 */
import { normalizeStatus } from '../system-info/hostHealthUtils';

/**
 * `service` is the systemd unit the doctor checks as `svc.<service>`. `tunnel` marks a tool
 * that only opens while the Cloudflare Tunnel runs.
 */
export const SERVER_TOOLS = [
  {
    id: 'tool-database',
    label: 'Database',
    title: 'CloudBeaver: MySQL in the browser',
    url: 'https://db.db-world.in',
    service: 'cloudbeaver',
    tunnel: true,
  },
  {
    id: 'tool-pironman',
    label: 'Pironman',
    title: 'The case: fan, temperatures, OLED screen and lights',
    url: 'https://pironman.db-world.in',
    service: 'pironman5',
    tunnel: true,
  },
  {
    id: 'tool-ariang',
    label: 'AriaNg',
    title: 'aria2’s download queue, by hand',
    url: 'https://ariang.db-world.in',
    service: 'aria2',
    tunnel: true,
  },
  {
    id: 'tool-access',
    label: 'Cloudflare Access',
    title: 'Who may sign in to the tools above',
    url: 'https://one.dash.cloudflare.com/',
    service: null,
    tunnel: false,
  },
];

/** The Cloudflare Tunnel's unit; every Pi tool goes through it. */
export const TUNNEL_SERVICE = 'cloudflared';

export const SERVICE_LABEL = { ok: 'Running', warn: 'Starting', fail: 'Stopped', unknown: 'Status unknown' };

const serviceCheck = (report, service) =>
  (report?.checks ?? []).find((c) => c?.id === `svc.${service}`) ?? null;

/**
 * True when the doctor checked this unit at all. It skips units that are not installed,
 * which is how "the tunnel is not set up yet" shows up.
 */
export const isServiceChecked = (report, service) =>
  Boolean(report?.available && service && serviceCheck(report, service));

/**
 * ok | warn | fail | unknown, from the doctor report. Unknown with no report, a stale report
 * (that is the last known state, not the current one), or a unit it did not check.
 */
export function serviceStatus(report, service) {
  if (!report?.available || report.stale || !service) return 'unknown';
  const check = serviceCheck(report, service);
  return check ? normalizeStatus(check.status) : 'unknown';
}

/**
 * The status dot for one tool: what the doctor last saw of the unit behind it, and of the
 * tunnel it goes through. A stopped tunnel wins: then the link will not open, whatever the
 * tool itself is doing. Null for a tool with nothing on the Pi to watch.
 *
 * @returns {{status: 'ok'|'warn'|'fail'|'unknown', text: string} | null}
 */
export function toolIndicator(report, tool) {
  if (!tool?.service) return null;
  if (!report?.available || report.stale) return { status: 'unknown', text: SERVICE_LABEL.unknown };
  if (tool.tunnel && isServiceChecked(report, TUNNEL_SERVICE)
      && serviceStatus(report, TUNNEL_SERVICE) === 'fail') {
    return { status: 'fail', text: 'Tunnel down: the link will not open' };
  }
  const status = serviceStatus(report, tool.service);
  return { status, text: SERVICE_LABEL[status] };
}
