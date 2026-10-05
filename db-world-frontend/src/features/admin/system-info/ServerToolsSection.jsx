import React from 'react';
import { Box, Typography, Chip, Button, Link } from '@mui/material';
import { HandymanRounded, OpenInNewRounded, LockRounded } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@shared/theme';
import { SectionCard, adminSurface } from '@features/admin/adminUi';
import { getHostHealth } from '../api/adminApi';
import { HOST_HEALTH_QUERY_KEY } from './hostHealthUtils';
import {
  SERVER_TOOLS, TUNNEL_SERVICE, ACCESS_DASHBOARD_URL, SERVICE_LABEL,
  isServiceChecked, serviceStatus, toolHost,
} from './serverToolsUtils';

/**
 * Server tools: the dashboards that run on the Pi beside the app (the Pironman case,
 * AriaNg, CloudBeaver), one click away. Each sits behind Cloudflare Access, so the link signs you in
 * at Cloudflare first. Their up/down state comes from the same doctor report as Host
 * health; this reuses that query, so it costs no extra request.
 */
export default function ServerToolsSection() {
  const T = useT();
  const S = adminSurface(T);
  const { data: report } = useQuery({
    queryKey: HOST_HEALTH_QUERY_KEY,
    queryFn: getHostHealth,
    refetchInterval: 60_000,
  });

  return (
    <SectionCard title="Server tools" icon={HandymanRounded} action={<TunnelChip report={report} />} sx={{ mb: 3 }}>
      {/* auto-fit, not auto-fill: the tiles stretch across the card instead of leaving
          empty columns on the right */}
      <Box sx={{
        display: 'grid', gap: 1.5,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fit, minmax(260px, 1fr))' },
      }}>
        {SERVER_TOOLS.map((tool) => (
          <ToolTile key={tool.id} tool={tool} status={serviceStatus(report, tool.service)} />
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mt: 2, p: 1.25, borderRadius: 2, bgcolor: S.inset, border: `1px solid ${S.border}` }}>
        <LockRounded sx={{ fontSize: 16, color: T.textFaint, mt: 0.15 }} />
        <Typography sx={{ fontSize: '0.75rem', color: T.textMuted }}>
          Behind Cloudflare Access: the first visit asks you to sign in (a code sent to your email).
          Who may sign in is set in{' '}
          <Link href={ACCESS_DASHBOARD_URL} target="_blank" rel="noopener noreferrer" sx={{ color: T.teal }}>
            Cloudflare Zero Trust
          </Link>.
        </Typography>
      </Box>
    </SectionCard>
  );
}

/** Colours for a doctor status, from the CURRENT theme tokens. */
function statusColors(T, status) {
  switch (status) {
    case 'ok':   return { color: T.success,   bg: T.successBg };
    case 'warn': return { color: T.warning,   bg: T.warningBg };
    case 'fail': return { color: T.error,     bg: T.errorBg };
    default:     return { color: T.textFaint, bg: T.hoverBg };
  }
}

function StatusDot({ status, label }) {
  const T = useT();
  const c = statusColors(T, status);
  return (
    <Chip
      size="small"
      label={label}
      icon={<Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: c.color, display: 'inline-block' }} />}
      sx={{ height: 20, fontSize: '0.62rem', fontWeight: 700, bgcolor: c.bg, color: c.color, '& .MuiChip-icon': { ml: 0.75, mr: -0.25 } }}
    />
  );
}

/**
 * The tunnel carries every link on this card, so its state goes in the header: when it
 * is down, nothing here opens, whatever the tiles say.
 */
function TunnelChip({ report }) {
  if (!report?.available) return null;
  if (!isServiceChecked(report, TUNNEL_SERVICE)) {
    return <StatusDot status="unknown" label="Tunnel not set up" />;
  }
  const status = serviceStatus(report, TUNNEL_SERVICE);
  const label = { ok: 'Tunnel up', warn: 'Tunnel starting', fail: 'Tunnel down' }[status] ?? 'Tunnel unknown';
  return <StatusDot status={status} label={label} />;
}

function ToolTile({ tool, status }) {
  const T = useT();
  const S = adminSurface(T);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, p: 1.5, borderRadius: 2, bgcolor: S.inset, border: `1px solid ${S.border}`, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: T.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tool.name}
        </Typography>
        <Box sx={{ ml: 'auto', flexShrink: 0 }}>
          <StatusDot status={status} label={SERVICE_LABEL[status]} />
        </Box>
      </Box>
      <Typography sx={{ fontSize: '0.75rem', color: T.textMuted, flex: 1 }}>
        {tool.description}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
        <Typography sx={{ fontSize: '0.68rem', fontFamily: 'monospace', color: T.textFaint, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {toolHost(tool.url)}
        </Typography>
        <Button
          component="a"
          href={tool.url}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          endIcon={<OpenInNewRounded sx={{ fontSize: '14px !important' }} />}
          aria-label={`Open ${tool.name} in a new tab`}
          sx={{ ml: 'auto', flexShrink: 0, textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', color: T.teal, bgcolor: T.tealBg, px: 1.25, py: 0.25, '&:hover': { bgcolor: T.tealBg, filter: 'brightness(1.08)' } }}
        >
          Open
        </Button>
      </Box>
    </Box>
  );
}
