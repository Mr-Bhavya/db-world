import React, { useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, CircularProgress, LinearProgress, Tab, Tabs, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Divider
} from '@mui/material';
import {
  Monitor, Refresh, Memory, Storage, Speed,
  DeveloperBoard, CheckCircle, Warning, Error as ErrorIcon,
  FiberManualRecord, ArrowDownward, ArrowUpward, Thermostat
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import {
  getServerInfo,
  getServerInfoQuick,
  getServerHealth,
  refreshServerInfoCache,
} from '../api/adminApi';

/* ── Health metadata ─────────────────────────────────────────── */

const HEALTH_META = {
  EXCELLENT: { color: '#10b981', icon: <CheckCircle sx={{ fontSize: 14 }} /> },
  GOOD:      { color: '#22c55e', icon: <CheckCircle sx={{ fontSize: 14 }} /> },
  FAIR:      { color: '#f59e0b', icon: <Warning     sx={{ fontSize: 14 }} /> },
  POOR:      { color: '#f97316', icon: <Warning     sx={{ fontSize: 14 }} /> },
  CRITICAL:  { color: '#ef4444', icon: <ErrorIcon   sx={{ fontSize: 14 }} /> },
};

/* ── Helpers ─────────────────────────────────────────────────── */

const loadColor = (pct) => {
  if (pct < 50) return '#10b981';
  if (pct < 70) return '#f59e0b';
  if (pct < 85) return '#f97316';
  return '#ef4444';
};

const _pct = (val) => (val != null ? `${Number(val).toFixed(1)}%` : '—');
const bytes = (n) => {
  if (!n) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
};

/* ── Sub-components ──────────────────────────────────────────── */

function MiniStatCard({ label, value, pctValue, color, icon }) {
  const T = useT();
  return (
    <Card sx={{ border: `1px solid ${color}22`, borderRadius: 2, bgcolor: T.glass }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Box sx={{ color, display: 'flex' }}>{icon}</Box>
          <Typography sx={{ fontSize: '0.68rem', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {label}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: String(value ?? '').length > 10 ? '0.95rem' : '1.4rem', fontWeight: 800, color: T.text, lineHeight: 1, mb: 0.75 }}>
          {value}
        </Typography>
        {pctValue != null && (
          <LinearProgress
            variant="determinate"
            value={Math.min(pctValue, 100)}
            sx={{ height: 3, borderRadius: 2, bgcolor: `${color}22`,
              '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 2 } }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }) {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', py: 0.75, borderBottom: `1px solid ${T.border}` }}>
      <Typography sx={{ width: 160, fontSize: '0.75rem', color: T.textMuted, flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.75rem', color: T.text, fontFamily: typeof value === 'string' && value.match(/^[\d.:/]+$/) ? 'monospace' : 'inherit', flex: 1, wordBreak: 'break-all' }}>
        {value ?? '—'}
      </Typography>
    </Box>
  );
}

function SectionTitle({ children }) {
  const T = useT();
  return (
    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: T.textMuted, textTransform: 'uppercase',
      letterSpacing: '0.1em', mb: 1.5 }}>
      {children}
    </Typography>
  );
}

function UsageBar({ label, used, total, usedPct, formattedUsed, formattedTotal }) {
  const T = useT();
  const numPct = parseFloat(usedPct) || 0;
  const color  = loadColor(numPct);
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.78rem', color: T.text }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.72rem', color: T.textMuted, fontFamily: 'monospace' }}>
          {formattedUsed ?? bytes(used)} / {formattedTotal ?? bytes(total)} ({numPct.toFixed(1)}%)
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.min(numPct, 100)}
        sx={{ height: 6, borderRadius: 3, bgcolor: `${color}22`,
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 } }}
      />
    </Box>
  );
}

/* ── Tab panels ──────────────────────────────────────────────── */

function OverviewTab({ info }) {
  const _T = useT();
  const si = info?.serverInfo;
  const perf = info?.performance;
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <SectionTitle>System</SectionTitle>
        <InfoRow label="Hostname"       value={si?.hostname} />
        <InfoRow label="OS"             value={si?.osName} />
        <InfoRow label="Version"        value={si?.osVersion} />
        <InfoRow label="Architecture"   value={si?.osArchitecture} />
        <InfoRow label="Kernel"         value={si?.kernelVersion} />
        <InfoRow label="Distribution"   value={si?.distribution ? `${si.distribution} ${si.distributionVersion ?? ''}`.trim() : null} />
        <InfoRow label="Manufacturer"   value={si?.manufacturer} />
        <InfoRow label="Model"          value={si?.model} />
        <InfoRow label="Uptime"         value={si?.uptime} />
        <InfoRow label="Boot Time"      value={si?.bootTime} />
      </Grid>
      <Grid item xs={12} md={6}>
        <SectionTitle>Performance</SectionTitle>
        <InfoRow label="CPU Usage"      value={perf?.cpuUsagePercent != null ? `${perf.cpuUsagePercent.toFixed(1)}%` : null} />
        <InfoRow label="CPU Load (1m)"  value={perf?.cpuLoad1Min   != null ? `${perf.cpuLoad1Min.toFixed(2)}` : null} />
        <InfoRow label="CPU Load (5m)"  value={perf?.cpuLoad5Min   != null ? `${perf.cpuLoad5Min.toFixed(2)}` : null} />
        <InfoRow label="CPU Load (15m)" value={perf?.cpuLoad15Min  != null ? `${perf.cpuLoad15Min.toFixed(2)}` : null} />
        <InfoRow label="Net Download"   value={perf?.networkRxFormatted} />
        <InfoRow label="Net Upload"     value={perf?.networkTxFormatted} />
        <InfoRow label="Processes"      value={perf?.processCount} />
        <InfoRow label="Running"        value={perf?.runningProcessCount} />
        <InfoRow label="Memory Load"    value={perf?.memoryLoadPercent != null ? `${perf.memoryLoadPercent.toFixed(1)}%` : null} />
        <InfoRow label="Uptime"         value={perf?.uptime} />
        {si?.ipAddresses?.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <SectionTitle>IP Addresses</SectionTitle>
            {si.ipAddresses.map((ip) => (
              <Typography key={ip} sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#10b981', mb: 0.25 }}>
                {ip}
              </Typography>
            ))}
          </Box>
        )}
      </Grid>
    </Grid>
  );
}

function CpuTab({ info, quick }) {
  const T = useT();
  const cpu = quick?.cpu ?? info?.cpu;
  const load = quick?.performance?.cpuUsagePercent ?? info?.performance?.cpuUsagePercent ?? cpu?.loadPercentage ?? 0;
  const color = loadColor(load);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <SectionTitle>Processor</SectionTitle>
        <InfoRow label="Name"         value={cpu?.name} />
        <InfoRow label="Vendor"       value={cpu?.vendor} />
        <InfoRow label="Architecture" value={cpu?.architecture} />
        <InfoRow label="Cores"        value={cpu?.cores} />
        <InfoRow label="Threads"      value={cpu?.threads} />
        <InfoRow label="Processors"   value={cpu?.availableProcessors} />
        <InfoRow label="Max Freq"     value={cpu?.maxFrequency ? `${(cpu.maxFrequency / 1e6).toFixed(0)} MHz` : null} />
        <InfoRow label="Curr Freq"    value={cpu?.currentFrequency ? `${(cpu.currentFrequency / 1e6).toFixed(0)} MHz` : null} />
        <InfoRow label="Clock"        value={cpu?.clockSpeedMhz ? `${cpu.clockSpeedMhz.toFixed(0)} MHz` : null} />
        <InfoRow label="Cache"        value={cpu?.cacheSize} />
      </Grid>
      <Grid item xs={12} md={6}>
        <SectionTitle>Load</SectionTitle>
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography sx={{ fontSize: '0.78rem', color: T.text }}>Overall CPU Usage</Typography>
            <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color, fontFamily: 'monospace' }}>
              {`${Number(load).toFixed(1)}%`}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(load, 100)}
            sx={{ height: 10, borderRadius: 5, bgcolor: `${color}22`,
              '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 5 } }}
          />
        </Box>

        {cpu?.coreDetails?.length > 0 && (
          <>
            <SectionTitle>Per Core</SectionTitle>
            <Grid container spacing={0.75}>
              {cpu.coreDetails.map((core, i) => {
                const c = loadColor(core.loadPercent ?? 0);
                return (
                  <Grid item xs={6} sm={4} key={i}>
                    <Box sx={{ p: 1, border: `1px solid ${T.border}`, borderRadius: 1 }}>
                      <Typography sx={{ fontSize: '0.65rem', color: T.textMuted, mb: 0.25 }}>Core {i}</Typography>
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: c, fontFamily: 'monospace' }}>
                        {(core.loadPercent ?? 0).toFixed(1)}%
                      </Typography>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          </>
        )}
      </Grid>
    </Grid>
  );
}

function MemoryTab({ info, quick }) {
  const T = useT();
  const mem = quick?.memory ?? info?.memory;
  if (!mem) return <Typography sx={{ color: T.textMuted, py: 4, textAlign: 'center' }}>No memory data</Typography>;

  const usedPct = mem.usedPercent ? parseFloat(mem.usedPercent) : (mem.usedBytes && mem.totalBytes ? (mem.usedBytes / mem.totalBytes) * 100 : 0);
  const swapPct = mem.swapUsedPercent ? parseFloat(mem.swapUsedPercent) : 0;

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <SectionTitle>Physical RAM</SectionTitle>
        <UsageBar label="Used" usedPct={usedPct} formattedUsed={mem.usedFormatted} formattedTotal={mem.totalFormatted} />
        <InfoRow label="Total"     value={mem.totalFormatted} />
        <InfoRow label="Used"      value={mem.usedFormatted} />
        <InfoRow label="Free"      value={mem.freeFormatted} />
        <InfoRow label="Available" value={mem.availableFormatted} />
        <InfoRow label="Buffers"   value={mem.buffersFormatted} />
        <InfoRow label="Cached"    value={mem.cachedFormatted} />

        {mem.swapTotalBytes > 0 && (
          <>
            <Divider sx={{ borderColor: T.border, my: 2 }} />
            <SectionTitle>Swap</SectionTitle>
            <UsageBar label="Swap Used" usedPct={swapPct} formattedUsed={mem.swapUsedFormatted} formattedTotal={mem.swapTotalFormatted} />
            <InfoRow label="Total" value={mem.swapTotalFormatted} />
            <InfoRow label="Used"  value={mem.swapUsedFormatted} />
            <InfoRow label="Free"  value={mem.swapFreeFormatted} />
          </>
        )}
      </Grid>
      <Grid item xs={12} md={6}>
        {mem.javaTotalMemory > 0 && (
          <>
            <SectionTitle>JVM Heap</SectionTitle>
            <InfoRow label="Max"   value={mem.javaMaxFormatted} />
            <InfoRow label="Total" value={mem.javaTotalFormatted} />
            <InfoRow label="Free"  value={mem.javaFreeFormatted} />
            <InfoRow label="Used"  value={bytes(mem.javaTotalMemory - mem.javaFreeMemory)} />
          </>
        )}
      </Grid>
    </Grid>
  );
}

function StorageTab({ info }) {
  const T = useT();
  const disk = info?.disk;
  if (!disk?.drives?.length) return <Typography sx={{ color: T.textMuted, py: 4, textAlign: 'center' }}>No disk data</Typography>;

  return (
    <>
      <Box sx={{ display: 'flex', gap: 3, mb: 2.5 }}>
        <Typography sx={{ fontSize: '0.82rem', color: T.textMuted }}>
          {disk.driveCount} drive{disk.driveCount !== 1 ? 's' : ''} ·{' '}
          <span style={{ color: T.text }}>{disk.totalSpaceFormatted}</span> total ·{' '}
          <span style={{ color: '#ef4444' }}>{disk.usedSpaceFormatted}</span> used ·{' '}
          <span style={{ color: '#10b981' }}>{disk.freeSpaceFormatted}</span> free
        </Typography>
      </Box>
      {disk.drives.map((d, i) => {
        const usedPct = parseFloat(d.usedPercent) || 0;
        return (
          <Card key={i} sx={{ mb: 1.5, border: `1px solid ${T.border}`, bgcolor: T.glass, borderRadius: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Storage sx={{ fontSize: 16, color: T.teal }} />
                <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: T.text }}>{d.device}</Typography>
                {d.label && <Chip label={d.label} size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: T.tealBg, color: T.teal }} />}
                {d.removable && <Chip label="Removable" size="small" sx={{ height: 16, fontSize: '0.6rem' }} />}
                {d.readOnly && <Chip label="Read-Only" size="small" color="warning" sx={{ height: 16, fontSize: '0.6rem' }} />}
              </Box>
              <Grid container spacing={1} sx={{ mb: 1 }}>
                {[
                  { label: 'Mount',  value: d.mountPoint },
                  { label: 'FS',     value: d.fileSystem },
                  { label: 'Type',   value: d.type },
                  { label: 'Total',  value: d.totalFormatted },
                  { label: 'Used',   value: d.usedFormatted },
                  { label: 'Free',   value: d.freeFormatted },
                ].filter(x => x.value).map(({ label, value }) => (
                  <Grid item key={label}>
                    <Typography sx={{ fontSize: '0.65rem', color: T.textMuted }}>{label}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: T.text, fontFamily: 'monospace' }}>{value}</Typography>
                  </Grid>
                ))}
              </Grid>
              <UsageBar label={`${d.volumeName || d.mountPoint || d.device}`} usedPct={usedPct}
                formattedUsed={d.usedFormatted} formattedTotal={d.totalFormatted} />
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}

function NetworkTab({ info }) {
  const T = useT();
  const net = info?.network;
  if (!net) return <Typography sx={{ color: T.textMuted, py: 4, textAlign: 'center' }}>No network data</Typography>;

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} md={4}>
          <InfoRow label="Hostname"    value={net.hostname} />
          <InfoRow label="Domain"      value={net.domain} />
          <InfoRow label="Gateway"     value={net.defaultGateway} />
          <InfoRow label="Connections" value={net.activeConnections} />
        </Grid>
        <Grid item xs={12} md={4}>
          <SectionTitle>DNS Servers</SectionTitle>
          {net.dnsServers?.map((d) => (
            <Typography key={d} sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: T.text, mb: 0.25 }}>{d}</Typography>
          ))}
        </Grid>
      </Grid>

      <SectionTitle>Adapters ({net.adapterCount})</SectionTitle>
      {net.adapters?.map((a, i) => (
        <Card key={i} sx={{ mb: 1.5, border: `1px solid ${T.border}`, bgcolor: T.glass, borderRadius: 2 }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <FiberManualRecord sx={{ fontSize: 10, color: a.status === 'Up' ? '#10b981' : '#6b7280' }} />
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: T.text }}>{a.name}</Typography>
              <Chip label={a.status ?? 'Unknown'} size="small"
                sx={{ height: 16, fontSize: '0.6rem', bgcolor: a.status === 'Up' ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.12)',
                  color: a.status === 'Up' ? '#10b981' : '#6b7280' }} />
              {a.description && <Typography sx={{ fontSize: '0.7rem', color: T.textFaint }}>{a.description}</Typography>}
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <InfoRow label="IP"      value={a.ipAddress} />
                <InfoRow label="MAC"     value={a.macAddress} />
                <InfoRow label="Subnet"  value={a.subnetMask} />
                <InfoRow label="Speed"   value={a.speed ? `${(a.speed / 1e6).toFixed(0)} Mbps` : null} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <InfoRow label="Rx Total" value={bytes(a.bytesReceived)} />
                <InfoRow label="Tx Total" value={bytes(a.bytesSent)} />
                {a.rxBytesPerSecFormatted && <InfoRow label="Rx/s" value={a.rxBytesPerSecFormatted} />}
                {a.txBytesPerSecFormatted && <InfoRow label="Tx/s" value={a.txBytesPerSecFormatted} />}
                <InfoRow label="Rx Errors" value={a.rxErrors} />
                <InfoRow label="Tx Errors" value={a.txErrors} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

function ProcessesTab({ info }) {
  const T = useT();
  const procs = info?.processes;
  if (!procs?.length) return <Typography sx={{ color: T.textMuted, py: 4, textAlign: 'center' }}>No process data</Typography>;

  const sorted = [...procs].sort((a, b) => (b.cpuUsage ?? 0) - (a.cpuUsage ?? 0)).slice(0, 30);

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ '& th': { bgcolor: T.adminBg, color: T.textMuted, fontSize: '0.68rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.07em', borderColor: T.border, py: 1 } }}>
            <TableCell>PID</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>User</TableCell>
            <TableCell>CPU %</TableCell>
            <TableCell>Memory</TableCell>
            <TableCell>Mem %</TableCell>
            <TableCell>State</TableCell>
            <TableCell>Threads</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((p) => {
            const cpuColor = loadColor(p.cpuUsage ?? 0);
            return (
              <TableRow key={p.pid} sx={{ '& td': { borderColor: T.border, py: 0.75 }, '&:hover': { bgcolor: T.glassHover } }}>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: T.textFaint }}>{p.pid}</TableCell>
                <TableCell sx={{ fontSize: '0.78rem', color: T.text, maxWidth: 180 }}>
                  <Typography sx={{ fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                    {p.name}
                  </Typography>
                </TableCell>
                <TableCell sx={{ fontSize: '0.72rem', color: T.textFaint }}>{p.user ?? '—'}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600, color: cpuColor }}>
                  {p.cpuUsage != null ? `${p.cpuUsage.toFixed(1)}%` : '—'}
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: T.textFaint }}>{p.memoryFormatted ?? bytes(p.memoryBytes)}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: T.textFaint }}>
                  {p.memoryPercent != null ? `${p.memoryPercent.toFixed(1)}%` : '—'}
                </TableCell>
                <TableCell>
                  <Chip label={p.state ?? '?'} size="small" sx={{ height: 16, fontSize: '0.6rem',
                    bgcolor: p.state === 'Running' ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.12)',
                    color: p.state === 'Running' ? '#10b981' : '#6b7280' }} />
                </TableCell>
                <TableCell sx={{ fontSize: '0.72rem', color: T.textFaint }}>{p.threads ?? '—'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function HealthTab({ health }) {
  const T = useT();
  if (!health) return <Typography sx={{ color: T.textMuted, py: 4, textAlign: 'center' }}>No health data</Typography>;

  const meta   = HEALTH_META[health.level] ?? HEALTH_META.FAIR;
  const score  = health.score ?? 0;

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Card sx={{ border: `1px solid ${meta.color}33`, borderRadius: 2, bgcolor: T.glass, textAlign: 'center', p: 3 }}>
          <Typography sx={{ fontSize: '4rem', fontWeight: 900, color: meta.color, lineHeight: 1 }}>{score}</Typography>
          <Typography sx={{ fontSize: '0.7rem', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>Health Score</Typography>
          <Chip
            label={health.level ?? 'UNKNOWN'}
            icon={meta.icon}
            sx={{ bgcolor: `${meta.color}18`, color: meta.color, fontWeight: 700,
              '& .MuiChip-icon': { color: meta.color } }}
          />
          <LinearProgress
            variant="determinate"
            value={Math.min(score, 100)}
            sx={{ mt: 2, height: 8, borderRadius: 4, bgcolor: `${meta.color}22`,
              '& .MuiLinearProgress-bar': { bgcolor: meta.color, borderRadius: 4 } }}
          />
        </Card>
      </Grid>
      <Grid item xs={12} md={8}>
        {[
          { label: 'Warnings',        items: health.warnings,       color: '#f59e0b' },
          { label: 'Issues',          items: health.issues,         color: '#ef4444' },
          { label: 'Recommendations', items: health.recommendations, color: '#3b82f6' },
        ].map(({ label, items, color }) => items?.length > 0 && (
          <Box key={label} sx={{ mb: 2 }}>
            <SectionTitle>{label}</SectionTitle>
            {items.map((item, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75,
                p: 1, borderRadius: 1, bgcolor: `${color}0d`, border: `1px solid ${color}22` }}>
                <FiberManualRecord sx={{ fontSize: 8, color, mt: 0.75, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.78rem', color: T.text }}>{item}</Typography>
              </Box>
            ))}
          </Box>
        ))}
        {!health.warnings?.length && !health.issues?.length && !health.recommendations?.length && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, bgcolor: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.2)', borderRadius: 2 }}>
            <CheckCircle sx={{ color: '#10b981' }} />
            <Typography sx={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>All systems healthy</Typography>
          </Box>
        )}
      </Grid>
    </Grid>
  );
}

/* ── Main page ───────────────────────────────────────────────── */

const TABS = ['Overview', 'CPU', 'Memory', 'Storage', 'Network', 'Processes', 'Health'];

export default function SystemInfoPage() {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);

  /* ── Queries ── */

  const { data: info, isFetching: infoLoading } = useQuery({
    queryKey: ['server-info'],
    queryFn: getServerInfo,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 min
  });

  const { data: quick } = useQuery({
    queryKey: ['server-info-quick'],
    queryFn: getServerInfoQuick,
    refetchInterval: 5_000,
  });

  const { data: health } = useQuery({
    queryKey: ['server-health'],
    queryFn: getServerHealth,
    refetchInterval: 15_000,
  });

  /* ── Cache refresh mutation ── */

  const refreshMutation = useMutation({
    mutationFn: refreshServerInfoCache,
    onSuccess: () => {
      enqueueSnackbar('Cache refreshed', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['server-info'] });
      queryClient.invalidateQueries({ queryKey: ['server-info-quick'] });
      queryClient.invalidateQueries({ queryKey: ['server-health'] });
    },
    onError: () => enqueueSnackbar('Refresh failed', { variant: 'error' }),
  });

  /* ── Derived stats ── */

  const liveInfo = quick ?? info;
  const cpuPct   = liveInfo?.performance?.cpuUsagePercent ?? liveInfo?.cpu?.loadPercentage ?? 0;
  const memPct   = liveInfo?.memory?.usedPercent
    ? parseFloat(liveInfo.memory.usedPercent)
    : (liveInfo?.memory?.usedBytes && liveInfo?.memory?.totalBytes
      ? (liveInfo.memory.usedBytes / liveInfo.memory.totalBytes) * 100
      : 0);
  const diskPct  = info?.disk?.drives?.length
    ? info.disk.drives.reduce((s, d) => s + parseFloat(d.usedPercent || 0), 0) / info.disk.drives.length
    : 0;

  const netRx   = liveInfo?.performance?.networkRxFormatted ?? null;
  const netTx   = liveInfo?.performance?.networkTxFormatted ?? null;
  const tempC   = info?.temperature?.maxTemperatureCelsius ?? info?.temperature?.highestTemperatureCelsius;
  const tempColor = tempC == null ? '#6b7280' : tempC < 60 ? '#10b981' : tempC < 75 ? '#f59e0b' : '#ef4444';
  const memValue = liveInfo?.memory?.usedFormatted && liveInfo?.memory?.totalFormatted
    ? `${liveInfo.memory.usedFormatted} / ${liveInfo.memory.totalFormatted}`
    : `${memPct.toFixed(0)}%`;

  const si = info?.serverInfo;
  const osLabel = info?.windows ? 'Windows' : info?.raspberryPi ? 'Raspberry Pi' : info?.linux ? 'Linux' : info?.mac ? 'macOS' : 'Unknown';
  const healthMeta = HEALTH_META[health?.level] ?? HEALTH_META.FAIR;

  const isBusy = infoLoading || refreshMutation.isPending;

  /* ── Render ── */

  return (
    <Box sx={{ p: 3 }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Monitor sx={{ color: T.teal, fontSize: 28 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '1.15rem', fontWeight: 700, color: T.text }}>
              System Information
            </Typography>
            {osLabel !== 'Unknown' && (
              <Chip label={osLabel} size="small"
                sx={{ height: 18, fontSize: '0.62rem', bgcolor: T.tealBg, color: T.teal }} />
            )}
            {health?.level && (
              <Chip
                label={health.level}
                icon={healthMeta.icon}
                size="small"
                sx={{ height: 18, fontSize: '0.62rem', bgcolor: `${healthMeta.color}18`, color: healthMeta.color,
                  '& .MuiChip-icon': { color: healthMeta.color, fontSize: 11, ml: 0.5 } }}
              />
            )}
          </Box>
          <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>
            {si?.hostname ?? 'Loading...'} · {si?.osName ?? ''}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={isBusy ? <CircularProgress size={12} /> : <Refresh />}
          disabled={isBusy}
          onClick={() => refreshMutation.mutate()}
          sx={{ borderColor: T.border, color: T.textMuted, '&:hover': { borderColor: T.teal, color: T.teal } }}
        >
          Refresh Cache
        </Button>
      </Box>

      {/* Live stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'CPU',        value: `${Number(cpuPct).toFixed(1)}%`,                       pctValue: cpuPct,  color: loadColor(cpuPct),  icon: <Speed /> },
          { label: 'Memory',     value: memValue,                                              pctValue: memPct, color: loadColor(memPct), icon: <Memory /> },
          { label: 'Disk',       value: info?.disk?.usedSpaceFormatted ?? `${diskPct.toFixed(0)}%`, pctValue: diskPct, color: loadColor(diskPct), icon: <Storage /> },
          { label: 'Net ↓',      value: netRx ?? '—',                                          pctValue: null, color: '#3b82f6', icon: <ArrowDownward /> },
          { label: 'Net ↑',      value: netTx ?? '—',                                          pctValue: null, color: '#6366f1', icon: <ArrowUpward /> },
          { label: 'Temperature', value: tempC != null ? `${tempC.toFixed(1)}°C` : '—',        pctValue: tempC != null ? Math.min(tempC, 100) : null, color: tempColor, icon: <Thermostat /> },
          { label: 'Uptime',     value: liveInfo?.performance?.uptime ?? si?.uptime ?? '—',    pctValue: null, color: '#8b5cf6', icon: <Monitor /> },
        ].map((s) => (
          <Grid item xs={6} sm={4} md={3} lg={12/7} key={s.label}>
            <MiniStatCard {...s} />
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: `1px solid ${T.border}`, borderRadius: 2, bgcolor: T.glass, overflow: 'hidden' }}>
        {infoLoading && (
          <LinearProgress sx={{ bgcolor: `${T.teal}22`, '& .MuiLinearProgress-bar': { bgcolor: T.teal } }} />
        )}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: `1px solid ${T.border}`,
            '& .MuiTab-root': { fontSize: '0.75rem', color: T.textMuted, minHeight: 44, textTransform: 'none', py: 1 },
            '& .Mui-selected': { color: T.teal },
            '& .MuiTabs-indicator': { bgcolor: T.teal },
          }}
        >
          {TABS.map((t) => <Tab key={t} label={t} />)}
        </Tabs>

        <Box sx={{ p: 2.5 }}>
          {tab === 0 && <OverviewTab info={info} />}
          {tab === 1 && <CpuTab info={info} quick={quick} />}
          {tab === 2 && <MemoryTab info={info} quick={quick} />}
          {tab === 3 && <StorageTab info={info} />}
          {tab === 4 && <NetworkTab info={info} />}
          {tab === 5 && <ProcessesTab info={info} />}
          {tab === 6 && <HealthTab health={health} />}
        </Box>
      </Paper>
    </Box>
  );
}
