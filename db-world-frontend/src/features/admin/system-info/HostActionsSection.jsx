import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Button, Chip, CircularProgress, Collapse, DialogActions, DialogContent, DialogTitle, ListItemIcon,
  ListItemText, Menu, MenuItem, Typography,
} from '@mui/material';
import {
  DnsRounded, HealthAndSafetyRounded, BackupRounded, FactCheckRounded, CleaningServicesRounded,
  RestartAltRounded, PowerSettingsNewRounded, ArrowDropDownRounded, ExpandMoreRounded, CloudOffRounded,
  HourglassEmptyRounded, AutorenewRounded, CheckCircle, Error as ErrorIcon, BlockRounded, HelpOutline,
  AlarmRounded, WarningAmberRounded,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import SheetDialog from '@shared/components/SheetDialog';
import { SectionCard, ErrorState, LoadingState, AdminActionButton, adminSurface } from '@features/admin/adminUi';
import { getHostAction, getHostActions, getHostPower, submitHostAction } from '../api/adminApi';
import { HOST_HEALTH_QUERY_KEY, formatAge } from './hostHealthUtils';
import {
  FAST_POLL_MS, HOST_ACTIONS_QUERY_KEY, HOST_POWER_QUERY_KEY, SERVICES, STATUS_LABEL, activeActions, actionLabel,
  describeAction, errorMessage, finishedToast, formatHostTime, hostActionQueryKey, isActive, isFinished,
  normalizeActionStatus, pollInterval, powerBanner, secondsSince,
} from './hostActionsUtils';
import HostPowerDialog from './HostPowerDialog';
import HostCleanupDialog from './HostCleanupDialog';

/** Rows shown before "Show all". */
const RECENT_ROWS = 8;

/**
 * Server actions — health check, backup, cleanup, service restarts and power, run as root by
 * the host's action broker (`dbworldctl`). The app only drops a request in the broker's queue;
 * the host checks it against its own allowlist, runs it and leaves a result this list reads.
 *
 * A server without the broker (every dev box) gets a quiet note instead of buttons.
 */
export default function HostActionsSection() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: HOST_ACTIONS_QUERY_KEY,
    queryFn: getHostActions,
    // Fast while the host is working so the status and the finish toast keep up; slow otherwise.
    refetchInterval: (q) => pollInterval(q.state.data?.items),
  });
  const available = Boolean(data?.available);
  const items = data?.items ?? [];
  const offsetSec = data?.utcOffsetSeconds ?? 0;

  const { data: power } = useQuery({
    queryKey: HOST_POWER_QUERY_KEY,
    queryFn: getHostPower,
    enabled: available,
    refetchInterval: 30_000,
  });

  /* ── Finished actions: toast the ones started here, refresh what they changed ── */

  const mine = useRef(new Set());
  const lastStatus = useRef(new Map());
  useEffect(() => {
    for (const item of data?.items ?? []) {
      const before = lastStatus.current.get(item.id);
      lastStatus.current.set(item.id, item.status);
      // Finished since the last poll: it was seen in flight, or it is one of ours that went from
      // submitted to finished between two polls. Old results on first load are neither.
      const justFinished = isFinished(item.status)
        && (isActive(before) || (before === undefined && mine.current.has(item.id)));
      if (!justFinished) continue;

      if (item.action === 'doctor') queryClient.invalidateQueries({ queryKey: HOST_HEALTH_QUERY_KEY });
      if (item.action?.startsWith('power-')) queryClient.invalidateQueries({ queryKey: HOST_POWER_QUERY_KEY });
      if (mine.current.delete(item.id)) {
        const toast = finishedToast(item);
        if (toast) notify[toast.variant](toast.message);
      }
    }
  }, [data, queryClient]);

  /* ── Submitting ── */

  const { mutateAsync } = useMutation({ mutationFn: submitHostAction });

  /**
   * Queues one action. Resolves to `{id}`; rejects after toasting the server's reason, so a
   * dialog can stay open. `quiet` is for the cleanup preview, whose dialog shows its own progress.
   */
  const submit = useCallback(async (request, { quiet = false } = {}) => {
    try {
      const res = await mutateAsync(request);
      if (!quiet) {
        mine.current.add(res.id);
        notify.success(`${describeAction(request)} requested`);
      }
      queryClient.invalidateQueries({ queryKey: HOST_ACTIONS_QUERY_KEY });
      return res;
    } catch (e) {
      if (!quiet) notify.error(errorMessage(e, `Could not request ${actionLabel(request.action).toLowerCase()}`));
      throw e;
    }
  }, [mutateAsync, queryClient]);

  const run = (action, args = {}) => submit({ action, args }).catch(() => {});

  /* ── Menus and dialogs ── */

  const [serviceMenu, setServiceMenu] = useState(null);
  const [powerMenu, setPowerMenu] = useState(null);
  // One dialog at a time. `key` changes per opening so each starts from its defaults, while
  // `open` going false (key unchanged) lets the close animation play.
  const [dialog, setDialog] = useState({ kind: null, open: false, key: 0, service: null });
  const openDialog = (kind, extra = {}) => setDialog((d) => ({ kind, open: true, key: d.key + 1, service: null, ...extra }));
  const closeDialog = useCallback(() => setDialog((d) => ({ ...d, open: false })), []);

  const busy = activeActions(items);
  const inFlight = items.filter((i) => isActive(i.status)).length;

  return (
    <SectionCard
      title="Server actions"
      icon={DnsRounded}
      action={inFlight ? <InFlightChip n={inFlight} /> : null}
      sx={{ mb: 3 }}
    >
      {isLoading && <LoadingState label="Checking the action broker…" height={100} />}
      {!isLoading && isError && !data && (
        <ErrorState message="Couldn’t load server actions" onRetry={() => refetch()} />
      )}
      {data && !available && <Unavailable reason={data.reason} />}

      {available && (
        <>
          <PowerBanner
            power={power}
            offsetSec={offsetSec}
            cancelling={busy.has('power-cancel')}
            onCancel={() => run('power-cancel')}
          />

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2.5 }}>
            <AdminActionButton variant="secondary" icon={HealthAndSafetyRounded} loading={busy.has('doctor')} onClick={() => run('doctor')}>
              Run health check
            </AdminActionButton>
            <AdminActionButton variant="secondary" icon={BackupRounded} loading={busy.has('backup-start')} onClick={() => run('backup-start')}>
              Back up system now
            </AdminActionButton>
            <AdminActionButton variant="secondary" icon={FactCheckRounded} loading={busy.has('backup-verify')} onClick={() => run('backup-verify')}>
              Verify backup
            </AdminActionButton>
            <AdminActionButton variant="secondary" icon={CleaningServicesRounded} loading={busy.has('cleanup-apply')} onClick={() => openDialog('cleanup')}>
              Cleanup…
            </AdminActionButton>
            <AdminActionButton
              variant="secondary" icon={RestartAltRounded} loading={busy.has('service-restart')}
              endIcon={<ArrowDropDownRounded />} aria-haspopup="menu" onClick={(e) => setServiceMenu(e.currentTarget)}
            >
              Restart service
            </AdminActionButton>
            <AdminActionButton
              variant="danger" icon={PowerSettingsNewRounded} endIcon={<ArrowDropDownRounded />} aria-haspopup="menu"
              onClick={(e) => setPowerMenu(e.currentTarget)}
            >
              Power
            </AdminActionButton>
          </Box>

          <Menu anchorEl={serviceMenu} open={Boolean(serviceMenu)} onClose={() => setServiceMenu(null)}>
            {SERVICES.map((s) => (
              <MenuItem key={s.id} onClick={() => { setServiceMenu(null); openDialog('service', { service: s }); }}>
                <ListItemText primary={s.label} secondary={s.id !== s.label.toLowerCase() ? s.id : null} />
              </MenuItem>
            ))}
          </Menu>
          <Menu anchorEl={powerMenu} open={Boolean(powerMenu)} onClose={() => setPowerMenu(null)}>
            <MenuItem onClick={() => { setPowerMenu(null); openDialog('reboot'); }}>
              <ListItemIcon><RestartAltRounded fontSize="small" /></ListItemIcon>
              <ListItemText primary="Reboot…" />
            </MenuItem>
            <MenuItem onClick={() => { setPowerMenu(null); openDialog('shutdown'); }}>
              <ListItemIcon><PowerSettingsNewRounded fontSize="small" /></ListItemIcon>
              <ListItemText primary="Shut down and wake…" />
            </MenuItem>
          </Menu>

          <RecentActions items={items} offsetSec={offsetSec} />
        </>
      )}

      {(dialog.kind === 'reboot' || dialog.kind === 'shutdown') && (
        <HostPowerDialog
          key={dialog.key}
          mode={dialog.kind}
          open={dialog.open}
          onClose={closeDialog}
          host={data?.host}
          offsetSec={offsetSec}
          onSubmit={submit}
        />
      )}
      {dialog.kind === 'cleanup' && (
        <HostCleanupDialog key={dialog.key} open={dialog.open} onClose={closeDialog} onSubmit={submit} />
      )}
      {dialog.kind === 'service' && (
        <RestartServiceDialog key={dialog.key} open={dialog.open} service={dialog.service} onClose={closeDialog} onSubmit={submit} />
      )}
    </SectionCard>
  );
}

/* ── Status presentation ─────────────────────────────────────── */

/** Colour + icon for an action status, from the CURRENT theme tokens (pass `T` from useT()). */
function statusMeta(T, status) {
  switch (normalizeActionStatus(status)) {
    case 'queued':   return { color: T.info,      bg: T.infoBg,    Icon: HourglassEmptyRounded };
    case 'running':  return { color: T.teal,      bg: T.tealBg,    Icon: AutorenewRounded, spin: true };
    case 'done':     return { color: T.success,   bg: T.successBg, Icon: CheckCircle };
    case 'failed':   return { color: T.error,     bg: T.errorBg,   Icon: ErrorIcon };
    case 'rejected': return { color: T.warning,   bg: T.warningBg, Icon: BlockRounded };
    default:         return { color: T.textFaint, bg: T.hoverBg,   Icon: HelpOutline };
  }
}

function StatusChip({ status }) {
  const T = useT();
  const meta = statusMeta(T, status);
  return (
    <Chip
      size="small"
      icon={<meta.Icon />}
      label={STATUS_LABEL[normalizeActionStatus(status)]}
      sx={{
        height: 20, fontSize: '0.6rem', fontWeight: 700, bgcolor: meta.bg, color: meta.color, flexShrink: 0,
        '& .MuiChip-icon': {
          color: meta.color, fontSize: 12, ml: 0.5,
          ...(meta.spin && { animation: 'hostActionSpin 1.2s linear infinite', '@keyframes hostActionSpin': { to: { transform: 'rotate(360deg)' } } }),
        },
      }}
    />
  );
}

function InFlightChip({ n }) {
  const T = useT();
  return (
    <Chip
      size="small"
      icon={<CircularProgress size={10} sx={{ color: `${T.teal} !important` }} />}
      label={`${n} in progress`}
      sx={{ height: 22, fontSize: '0.62rem', fontWeight: 700, bgcolor: T.tealBg, color: T.teal, '& .MuiChip-icon': { ml: 0.75 } }}
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
          Server actions are carried out by the action broker on the production Pi. A machine without
          it has nothing to run them.
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

/* ── Scheduled power banner ──────────────────────────────────── */

function PowerBanner({ power, offsetSec, onCancel, cancelling }) {
  const T = useT();
  // The power state only changes on a power action, so the query alone would leave
  // "in 2 h 10 min" frozen; this keeps the countdown moving.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const banner = powerBanner(power, now, offsetSec);
  if (!banner) return null;
  const Icon = banner.kind === 'reboot' ? RestartAltRounded : banner.kind === 'shutdown' ? PowerSettingsNewRounded : AlarmRounded;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25, pl: 1.5, mb: 2, borderRadius: 2, bgcolor: T.warningBg, border: `1px solid ${T.warning}55` }}>
      <Icon sx={{ fontSize: 20, color: T.warning, flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: T.text }}>{banner.title}</Typography>
        {banner.detail && (
          <Typography sx={{ fontSize: '0.74rem', color: T.textMuted }}>{banner.detail}</Typography>
        )}
      </Box>
      <Button
        size="small" variant="outlined" onClick={onCancel} disabled={cancelling}
        startIcon={cancelling ? <CircularProgress size={12} color="inherit" /> : null}
        sx={{ textTransform: 'none', fontWeight: 700, color: T.text, borderColor: `${T.warning}88`, flexShrink: 0, '&:hover': { borderColor: T.warning, bgcolor: T.warningBg } }}
      >
        Cancel
      </Button>
    </Box>
  );
}

/* ── Restart a service ───────────────────────────────────────── */

function RestartServiceDialog({ open, service, onClose, onSubmit }) {
  const T = useT();
  const S = adminSurface(T);
  const [busy, setBusy] = useState(false);
  if (!service) return null;

  const confirm = async () => {
    setBusy(true);
    try {
      await onSubmit({ action: 'service-restart', args: { service: service.id } });
      onClose();
    } catch {
      // Already toasted by the page.
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetDialog
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { bgcolor: S.card, border: `1px solid ${S.border}`, borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1rem', fontWeight: 800, color: T.text }}>
        <WarningAmberRounded sx={{ fontSize: 20, color: T.warning }} />
        Restart {service.label}?
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '0.82rem', color: T.textMuted }}>
          {service.note} The host runs <Box component="span" sx={{ fontFamily: 'monospace', color: T.text }}>systemctl restart {service.id}</Box>.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy} sx={{ color: T.textMuted, textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
        <Button
          variant="contained" onClick={confirm} disabled={busy}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <RestartAltRounded sx={{ fontSize: 18 }} />}
          sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none', bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover, boxShadow: 'none' } }}
        >
          Restart
        </Button>
      </DialogActions>
    </SheetDialog>
  );
}

/* ── Recent actions ──────────────────────────────────────────── */

function RecentActions({ items, offsetSec }) {
  const T = useT();
  const S = adminSurface(T);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? items : items.slice(0, RECENT_ROWS);

  return (
    <Box>
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>
        Recent actions
      </Typography>
      {items.length === 0 ? (
        <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, py: 2, textAlign: 'center', border: `1px dashed ${S.border}`, borderRadius: 2 }}>
          Nothing has been run from here in the last 14 days.
        </Typography>
      ) : (
        <Box sx={{ border: `1px solid ${S.border}`, borderRadius: 2, bgcolor: S.inset, overflow: 'hidden' }}>
          {shown.map((item, i) => (
            <ActionRow key={item.id} item={item} offsetSec={offsetSec} last={i === shown.length - 1} />
          ))}
        </Box>
      )}
      {items.length > RECENT_ROWS && (
        <Button size="small" onClick={() => setShowAll((s) => !s)} sx={{ mt: 1, textTransform: 'none', fontWeight: 700, color: T.teal }}>
          {showAll ? 'Show fewer' : `Show all ${items.length}`}
        </Button>
      )}
    </Box>
  );
}

function ActionRow({ item, offsetSec, last }) {
  const T = useT();
  const S = adminSurface(T);
  const [open, setOpen] = useState(false);
  const status = normalizeActionStatus(item.status);
  const active = isActive(status);
  const now = Date.now();
  const age = formatAge(secondsSince(item.requestedAt, now));
  const requestedAtMs = Date.parse(item.requestedAt ?? '');
  // Problems say why without a click; a finished row keeps its message for when it is opened.
  const inlineMessage = item.message && status !== 'done' && status !== 'running' ? item.message : null;

  return (
    <Box sx={{ borderBottom: last ? 'none' : `1px solid ${S.divider}` }}>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, width: '100%', textAlign: 'left',
          px: 1.5, py: 1, border: 'none', bgcolor: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer',
          '&:hover': { bgcolor: S.cardHover },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {describeAction(item)}
          </Typography>
          <Typography
            title={Number.isNaN(requestedAtMs) ? undefined : `${formatHostTime(requestedAtMs, offsetSec, now)} Pi time`}
            sx={{ fontSize: '0.68rem', color: T.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {item.requestedBy ?? 'unknown'}{age ? ` · ${age}` : ''}
          </Typography>
          {inlineMessage && (
            <Typography sx={{ fontSize: '0.7rem', color: statusMeta(T, status).color, mt: 0.25, wordBreak: 'break-word' }}>
              {inlineMessage}
            </Typography>
          )}
        </Box>
        <StatusChip status={status} />
        <ExpandMoreRounded sx={{ fontSize: 16, color: T.textFaint, flexShrink: 0, transition: 'transform .18s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </Box>

      <Collapse in={open} unmountOnExit>
        <ActionDetail item={item} active={active} offsetSec={offsetSec} />
      </Collapse>
    </Box>
  );
}

/** The output and timings of one action, fetched only once its row is opened. */
function ActionDetail({ item, active, offsetSec }) {
  const T = useT();
  const S = adminSurface(T);
  const { data: full, isLoading, isError } = useQuery({
    // The status is part of the key so a row left open refetches once when its action finishes.
    queryKey: [...hostActionQueryKey(item.id), item.status],
    queryFn: () => getHostAction(item.id),
    refetchInterval: active ? FAST_POLL_MS : false,
    retry: false,
  });
  const now = Date.now();
  const at = (iso) => {
    const ms = Date.parse(iso ?? '');
    return Number.isNaN(ms) ? null : formatHostTime(ms, offsetSec, now);
  };
  const started = at(full?.startedAt ?? item.startedAt);
  const finished = at(full?.finishedAt ?? item.finishedAt);
  const exitCode = full?.exitCode ?? item.exitCode;
  const message = full?.message ?? item.message;

  return (
    <Box sx={{ px: 1.5, pb: 1.5 }}>
      <Typography sx={{ fontSize: '0.68rem', color: T.textFaint, mb: 0.75, fontVariantNumeric: 'tabular-nums' }}>
        {[
          started && `started ${started}`,
          finished && `finished ${finished}`,
          exitCode != null && `exit code ${exitCode}`,
        ].filter(Boolean).join(' · ') || 'Not started yet'}
      </Typography>
      {message && normalizeActionStatus(item.status) === 'done' && (
        <Typography sx={{ fontSize: '0.74rem', color: T.textMuted, mb: 0.75, wordBreak: 'break-word' }}>{message}</Typography>
      )}
      {isLoading && <CircularProgress size={16} sx={{ color: T.teal }} />}
      {isError && !full && (
        <Typography sx={{ fontSize: '0.72rem', color: T.textMuted }}>Couldn’t load the output.</Typography>
      )}
      {full && (full.output ? (
        <Box component="pre" sx={{
          m: 0, p: 1, maxHeight: 320, overflow: 'auto', borderRadius: 1.5, bgcolor: S.card, border: `1px solid ${S.border}`,
          fontFamily: 'monospace', fontSize: '0.68rem', lineHeight: 1.45, color: T.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {full.output}
        </Box>
      ) : (
        <Typography sx={{ fontSize: '0.72rem', color: T.textFaint }}>{active ? 'No output yet.' : 'No output.'}</Typography>
      ))}
    </Box>
  );
}
