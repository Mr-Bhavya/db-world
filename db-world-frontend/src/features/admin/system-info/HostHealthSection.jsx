import React, { useState } from 'react';
import { Box, Typography, Chip, Collapse, IconButton, Tooltip } from '@mui/material';
import {
  HealthAndSafetyRounded, CheckCircle, Warning, Error as ErrorIcon, HelpOutline,
  ContentCopyRounded, ExpandMoreRounded, CloudOffRounded, ScheduleRounded,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { SectionCard, ErrorState, LoadingState, adminSurface } from '@features/admin/adminUi';
import { getHostHealth } from '../api/adminApi';
import {
  HOST_HEALTH_QUERY_KEY, STATUS_LABEL, formatAge, formatInterval, groupChecks, normalizeStatus,
} from './hostHealthUtils';

/**
 * Host health — the checks `dbworldctl doctor` runs as root on the Pi every 15 minutes
 * (disks, SMART, services, backups, certificates, updates), read back from the report file
 * it leaves behind. The same report drives the admin phone alerts, which deep-link here.
 */
export default function HostHealthSection() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: HOST_HEALTH_QUERY_KEY,
    queryFn: getHostHealth,
    // The report itself only changes every 15 minutes; a minute keeps "updated N min ago"
    // honest and notices a fresh report soon after it lands.
    refetchInterval: 60_000,
  });

  return (
    <SectionCard
      title="Host health"
      icon={HealthAndSafetyRounded}
      action={data?.available ? <StatusChip status={data.overall} stale={data.stale} /> : null}
      sx={{ mb: 3 }}
    >
      {isLoading && <LoadingState label="Reading the health report…" height={120} />}
      {!isLoading && isError && !data && (
        <ErrorState message="Couldn’t load host health" onRetry={() => refetch()} />
      )}
      {data && !data.available && <Unavailable reason={data.reason} />}
      {data?.available && <Report report={data} />}
    </SectionCard>
  );
}

/* ── Status presentation ─────────────────────────────────────── */

/** Colour + icon for a status, from the CURRENT theme tokens (pass `T` from useT()). */
function statusMeta(T, status) {
  switch (normalizeStatus(status)) {
    case 'ok':   return { color: T.success,   bg: T.successBg, Icon: CheckCircle };
    case 'warn': return { color: T.warning,   bg: T.warningBg, Icon: Warning };
    case 'fail': return { color: T.error,     bg: T.errorBg,   Icon: ErrorIcon };
    default:     return { color: T.textFaint, bg: T.hoverBg,   Icon: HelpOutline };
  }
}

function StatusChip({ status, stale }) {
  const T = useT();
  const meta = statusMeta(T, status);
  const label = STATUS_LABEL[normalizeStatus(status)];
  return (
    <Chip
      size="small"
      icon={<meta.Icon />}
      label={stale ? `${label} · stale` : label}
      sx={{
        height: 22, fontSize: '0.62rem', fontWeight: 700, bgcolor: meta.bg, color: meta.color,
        '& .MuiChip-icon': { color: meta.color, fontSize: 13, ml: 0.5 },
      }}
    />
  );
}

/* ── States ──────────────────────────────────────────────────── */

function Unavailable({ reason }) {
  const T = useT();
  const S = adminSurface(T);
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', p: 1.5, borderRadius: 2, bgcolor: S.inset, border: `1px solid ${S.border}` }}>
      <CloudOffRounded sx={{ fontSize: 20, color: T.textFaint, mt: 0.25 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: T.text }}>
          Not available on this server
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: T.textMuted, mt: 0.25 }}>
          Host checks come from the <Box component="span" sx={{ fontFamily: 'monospace' }}>dbworldctl doctor</Box> timer
          on the production Pi. A machine without it has nothing to show here.
        </Typography>
        {reason && (
          <Typography sx={{ fontSize: '0.7rem', color: T.textFaint, mt: 0.75, fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {reason}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function Report({ report }) {
  const T = useT();
  const S = adminSurface(T);
  const groups = groupChecks(report.checks);
  const age = formatAge(report.ageSeconds);
  const every = formatInterval(report.intervalSeconds);
  const counts = report.counts ?? {};

  return (
    <>
      {/* Summary line: where, when, how often, and the tally */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Typography sx={{ fontSize: '0.78rem', color: T.textMuted, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ScheduleRounded sx={{ fontSize: 14 }} />
          {report.host && <><Box component="span" sx={{ color: T.text, fontWeight: 600 }}>{report.host}</Box>{' · '}</>}
          {age ? `updated ${age}` : 'update time unknown'}
          {every && ` · checks every ${every}`}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <CountChip status="fail" n={counts.fail} />
        <CountChip status="warn" n={counts.warn} />
        <CountChip status="unknown" n={counts.unknown} />
        <CountChip status="ok" n={counts.ok} always />
      </Box>

      {report.stale && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', p: 1.25, mb: 2, borderRadius: 2, bgcolor: T.warningBg, border: `1px solid ${T.warning}44` }}>
          <Warning sx={{ fontSize: 18, color: T.warning, mt: 0.1 }} />
          <Typography sx={{ fontSize: '0.78rem', color: T.text }}>
            <b>Stale.</b> The last report is {age ? age.replace(' ago', '') : 'too'} old
            {every ? `, but checks normally run every ${every}` : ''}, so the doctor timer may have
            stopped. These are the last known results, not the current state.
          </Typography>
        </Box>
      )}

      {groups.length === 0 ? (
        <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, py: 2, textAlign: 'center' }}>
          The report has no checks.
        </Typography>
      ) : (
        <Box sx={{
          display: 'grid', gap: 1.5, alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(auto-fill, minmax(360px, 1fr))' },
          opacity: report.stale ? 0.7 : 1,
        }}>
          {groups.map((g) => (
            <Box key={g.group} sx={{ border: `1px solid ${S.border}`, borderRadius: 2, bgcolor: S.inset, overflow: 'hidden' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 1, borderBottom: `1px solid ${S.divider}` }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: statusMeta(T, g.worst).color, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {g.group}
                </Typography>
                <Typography sx={{ fontSize: '0.68rem', color: T.textFaint, ml: 'auto' }}>
                  {g.checks.length} check{g.checks.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
              {g.checks.map((c, i) => (
                <CheckRow key={c.id ?? i} check={c} last={i === g.checks.length - 1} />
              ))}
            </Box>
          ))}
        </Box>
      )}
    </>
  );
}

function CountChip({ status, n, always = false }) {
  const T = useT();
  if (!always && !n) return null;
  const meta = statusMeta(T, status);
  return (
    <Chip
      size="small"
      label={`${n ?? 0} ${status}`}
      sx={{ height: 20, fontSize: '0.62rem', fontWeight: 700, bgcolor: meta.bg, color: meta.color }}
    />
  );
}

/* ── One check ───────────────────────────────────────────────── */

/**
 * Copy, and say so only once it happened — the clipboard API is missing or refused on
 * plain-http LAN addresses, and claiming success there sends someone off to paste nothing.
 */
const copy = (text) => {
  if (!navigator.clipboard?.writeText) { notify.error('Clipboard unavailable here'); return; }
  navigator.clipboard.writeText(String(text)).then(
    () => notify.success('Command copied'),
    () => notify.error('Couldn’t copy the command'),
  );
};

/**
 * A healthy row is one line; a row with a problem opens with its detail and the hint to
 * try, so nothing needs clicking on the way from a phone alert to the fix.
 */
function CheckRow({ check, last }) {
  const T = useT();
  const S = adminSurface(T);
  const status = normalizeStatus(check.status);
  const meta = statusMeta(T, status);
  const hasMore = Boolean(check.detail || check.hint);
  const [open, setOpen] = useState(status !== 'ok');

  return (
    <Box sx={{ borderBottom: last ? 'none' : `1px solid ${S.divider}`, bgcolor: status === 'fail' ? T.errorBg : 'transparent' }}>
      <Box
        component={hasMore ? 'button' : 'div'}
        type={hasMore ? 'button' : undefined}
        onClick={hasMore ? () => setOpen((o) => !o) : undefined}
        aria-expanded={hasMore ? open : undefined}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, width: '100%', textAlign: 'left',
          px: 1.5, py: 1, border: 'none', bgcolor: 'transparent', color: 'inherit', font: 'inherit',
          cursor: hasMore ? 'pointer' : 'default',
          ...(hasMore && { '&:hover': { bgcolor: S.cardHover } }),
        }}
      >
        <meta.Icon sx={{ fontSize: 16, color: meta.color, flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.8rem', fontWeight: status === 'ok' ? 500 : 700, color: T.text, minWidth: 0, flexShrink: 1 }}>
          {check.name}
        </Typography>
        <Typography sx={{
          fontSize: '0.72rem', color: status === 'ok' ? T.textMuted : meta.color, ml: 'auto', textAlign: 'right',
          fontVariantNumeric: 'tabular-nums', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: { xs: '50%', sm: '60%' },
        }}>
          {check.value || STATUS_LABEL[status]}
        </Typography>
        {hasMore && (
          <ExpandMoreRounded sx={{ fontSize: 16, color: T.textFaint, flexShrink: 0, transition: 'transform .18s', transform: open ? 'rotate(180deg)' : 'none' }} />
        )}
      </Box>

      {hasMore && (
        <Collapse in={open} unmountOnExit>
          <Box sx={{ px: 1.5, pb: 1.25, pl: 4.5 }}>
            {check.detail && (
              <Typography sx={{ fontSize: '0.72rem', color: T.textMuted, mb: check.hint ? 0.75 : 0, wordBreak: 'break-word' }}>
                {check.detail}
              </Typography>
            )}
            {check.hint && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 1, pr: 0.25, py: 0.25, borderRadius: 1.5, bgcolor: S.card, border: `1px solid ${S.border}` }}>
                <Typography sx={{ fontSize: '0.72rem', fontFamily: 'monospace', color: T.text, flex: 1, minWidth: 0, wordBreak: 'break-all' }}>
                  {check.hint}
                </Typography>
                <Tooltip title="Copy">
                  <IconButton size="small" aria-label={`Copy hint for ${check.name}`} onClick={() => copy(check.hint)} sx={{ color: T.textFaint, '&:hover': { color: T.teal } }}>
                    <ContentCopyRounded sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
            {check.id && (
              <Typography sx={{ fontSize: '0.62rem', color: T.textFaint, fontFamily: 'monospace', mt: 0.75 }}>
                {check.id}
              </Typography>
            )}
          </Box>
        </Collapse>
      )}
    </Box>
  );
}
