import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  CleaningServicesRounded as ClearIcon,
  CloudOffRounded as CloudOff,
  DownloadingRounded as Downloading,
  HourglassTopRounded as Hourglass,
  MoreVertRounded as MoreVert,
  PauseRounded as Pause,
  PlayArrowRounded as Play,
  ReplayRounded as Replay,
  SpeedRounded as Speed,
  StorageRounded as Storage,
  CallSplitRounded as Parallel,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';

import { useT } from '@shared/theme';
import { notify } from '@shared/notify';
import { adminSurface } from '@features/admin/adminUi';
import ConfirmDialog from '@features/admin/filemanager/components/ConfirmDialog';
import { runBulkAction } from '../services/ingestionApi';
import { BULK_ACTIONS } from './queueStatus';
import { formatBytes, formatSpeed } from '../utils/format';

const BULK_ICONS = {
  'pause-all': Pause,
  'resume-all': Play,
  'retry-failed': Replay,
  'clear-finished': ClearIcon,
};

const Stat = memo(function Stat({ icon, label, tooltip, color = 'default', variant = 'outlined' }) {
  return (
    <Tooltip title={tooltip} arrow>
      <Chip
        size="small"
        icon={icon}
        label={label}
        color={color}
        variant={variant}
        sx={{ fontWeight: 700, borderRadius: 999, flexShrink: 0, '& .MuiChip-icon': { fontSize: 16 } }}
      />
    </Tooltip>
  );
});

/**
 * Live queue strip shown above the job list: download-slot occupancy, FIFO depth, parallel ("Run now")
 * jobs, aria2 throughput/health and free disk — plus bulk actions over the live list.
 */
function QueueBarComponent({ queue, isLoading, bulkCounts, isMobile }) {
  const T = useT();
  const S = adminSurface(T);
  const queryClient = useQueryClient();
  const [anchor, setAnchor] = useState(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  const pendingAction = useMemo(() => BULK_ACTIONS.find((a) => a.key === pending) ?? null, [pending]);

  const runPending = useCallback(async () => {
    if (!pendingAction || busy) return;
    setBusy(true);
    try {
      const res = await runBulkAction(pendingAction.key);
      const failures = res?.data?.failures ?? [];
      if (res?.success === false) notify.error(res?.message || 'Bulk action failed');
      else if (failures.length) notify.warning(`${res.message}. ${failures.length} skipped.`);
      else notify.success(res?.message || 'Done');
      queryClient.invalidateQueries({ queryKey: ['ingestion-queue'] });
      queryClient.invalidateQueries({ queryKey: ['ingestion-history'] });
    } catch (e) {
      notify.error(e?.response?.data?.message || e?.message || 'Bulk action failed');
    } finally {
      setBusy(false);
      setPending(null);
    }
  }, [pendingAction, busy, queryClient]);

  const anyBulk = Object.values(bulkCounts ?? {}).some((n) => n > 0);

  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 3, px: isMobile ? 0.9 : 1.25, py: isMobile ? 0.75 : 0.9,
        borderColor: S.border, bgcolor: S.inset }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Box
          sx={{ flex: 1, minWidth: 0, display: 'flex', gap: 0.75, overflowX: 'auto',
            scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
          aria-live="polite"
          aria-busy={isLoading ? 'true' : 'false'}
        >
          {isLoading || !queue ? (
            [88, 72, 96, 110].map((w) => (
              <Skeleton key={w} variant="rounded" width={w} height={24} sx={{ borderRadius: 999, flexShrink: 0 }} />
            ))
          ) : (
            <>
              <Stat
                icon={<Downloading />}
                label={queue.slotJobId ? 'Slot busy' : 'Slot free'}
                color={queue.slotJobId ? 'primary' : 'default'}
                tooltip="HTTP downloads run one at a time; magnets and released jobs bypass the slot"
              />
              <Stat
                icon={<Hourglass />}
                label={`${queue.waitingCount} waiting`}
                color={queue.waitingCount > 0 ? 'warning' : 'default'}
                tooltip="Jobs waiting for the download slot (FIFO)"
              />
              {queue.parallelCount > 0 ? (
                <Stat icon={<Parallel />} label={`${queue.parallelCount} parallel`}
                  tooltip="Jobs released with “Run now” downloading alongside the slot" />
              ) : null}
              {queue.aria2Online ? (
                <Stat
                  icon={<Speed />}
                  label={formatSpeed(queue.downloadSpeed) ?? 'Idle'}
                  color={queue.downloadSpeed > 0 ? 'primary' : 'default'}
                  variant={queue.downloadSpeed > 0 ? 'filled' : 'outlined'}
                  tooltip={`aria2: ${queue.aria2Active} active · ${queue.aria2Waiting} waiting`}
                />
              ) : (
                <Stat icon={<CloudOff />} label="aria2 offline" color="error"
                  tooltip="aria2 RPC is not reachable — HTTP and torrent downloads cannot start" />
              )}
              {queue.disks.map((d) => (
                <Stat
                  key={d.label}
                  icon={<Storage />}
                  label={`${d.label} ${formatBytes(d.freeBytes)} free`}
                  color={d.low ? 'error' : 'default'}
                  tooltip={`${formatBytes(d.freeBytes)} free of ${formatBytes(d.totalBytes)}`}
                />
              ))}
            </>
          )}
        </Box>

        <Tooltip title="Bulk actions">
          <span>
            <IconButton
              aria-label="Bulk actions"
              aria-haspopup="menu"
              onClick={(e) => setAnchor(e.currentTarget)}
              disabled={busy || !anyBulk}
              sx={{ width: isMobile ? 40 : 36, height: isMobile ? 40 : 36 }}
            >
              {busy ? <CircularProgress size={18} /> : <MoreVert />}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {queue?.lowDisks?.length ? (
        <Alert severity="warning" sx={{ mt: 0.8, py: 0, borderRadius: 2 }}>
          Low disk space on {queue.lowDisks.map((d) => d.label).join(' and ')} — new downloads may fail.
        </Alert>
      ) : null}

      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {BULK_ACTIONS.map((a) => {
          const Icon = BULK_ICONS[a.key];
          const count = bulkCounts?.[a.key] ?? 0;
          return (
            <MenuItem
              key={a.key}
              disabled={count === 0}
              onClick={() => { setAnchor(null); setPending(a.key); }}
              sx={{ minHeight: 44 }}
            >
              <ListItemIcon><Icon fontSize="small" /></ListItemIcon>
              <ListItemText primary={a.label} secondary={`${count} job${count === 1 ? '' : 's'}`} />
            </MenuItem>
          );
        })}
      </Menu>

      <ConfirmDialog
        open={!!pendingAction}
        title={pendingAction?.label ?? ''}
        message={pendingAction?.confirm ?? ''}
        confirmLabel={busy ? 'Working…' : 'Continue'}
        danger={pendingAction?.key === 'clear-finished'}
        onConfirm={runPending}
        onClose={() => { if (!busy) setPending(null); }}
      />
    </Paper>
  );
}

const QueueBar = memo(QueueBarComponent);
export default QueueBar;
