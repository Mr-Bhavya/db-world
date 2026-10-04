import React, { useEffect, useState } from 'react';
import {
  Box, Button, CircularProgress, DialogActions, DialogContent, DialogTitle, IconButton, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import {
  CloseRounded, RestartAltRounded, PowerSettingsNewRounded, WarningAmberRounded, AlarmRounded,
} from '@mui/icons-material';
import SheetDialog from '@shared/components/SheetDialog';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import {
  REBOOT_DELAY, buildWake, buildWhen, checkShutdownPlan, confirmMatches, formatCountdown, formatHostTime,
  formatOffset, resolveWhen, toHostLocalInput,
} from './hostActionsUtils';

const HOUR = 3_600_000;

/**
 * Reboot, or shut down and wake again — the two actions that take the whole site offline.
 *
 * Both make the admin type the host name before Confirm enables: a reboot sent to the wrong
 * tab, or tapped by accident on a phone, costs everyone a minute of downtime, and a shutdown
 * costs hours if the wake is wrong. A shutdown has no "stay off" option at all: a Pi that is
 * off stays off until someone is on site to power-cycle it, so it must be able to wake itself.
 *
 * Times are the Pi's local time, which is how the host reads them; the dialog says which
 * offset that is so an admin in another zone is not caught out.
 *
 * Mount with a fresh `key` per opening so every opening starts from the defaults.
 */
export default function HostPowerDialog({ mode, open, onClose, host, offsetSec, onSubmit }) {
  const T = useT();
  const S = adminSurface(T);
  const shutdown = mode === 'shutdown';

  // The preview ("in 2 h 10 min") is worth keeping current while the dialog sits open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return undefined;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [open]);

  const [whenMode, setWhenMode] = useState('now');
  const [minutes, setMinutes] = useState('5');
  const [time, setTime] = useState('04:30');
  const [wakeMode, setWakeMode] = useState('in');
  const [hours, setHours] = useState('8');
  const [wakeAt, setWakeAt] = useState(() => toHostLocalInput(Date.now() + 8 * HOUR, offsetSec));
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const whenBuilt = buildWhen(whenMode, minutes, time);
  const wakeBuilt = shutdown ? buildWake(wakeMode, hours, wakeAt) : { wake: null, error: null };
  const plan = shutdown && whenBuilt.when && wakeBuilt.wake
    ? checkShutdownPlan(whenBuilt.when, wakeBuilt.wake, now, offsetSec)
    : null;
  const atMs = whenBuilt.when ? resolveWhen(whenBuilt.when, now, offsetSec) : null;
  const error = whenBuilt.error || wakeBuilt.error || plan?.error || null;
  const confirmed = confirmMatches(typed, host);
  const canSubmit = !error && confirmed && !busy;

  const at = (ms) => (whenBuilt.when === 'now' ? 'now' : `at ${formatHostTime(ms, offsetSec, now)} (in ${formatCountdown(ms - now)})`);
  const summary = error ? null : shutdown
    ? `Shuts down ${at(atMs)}, powers back on at ${formatHostTime(plan?.wakeMs, offsetSec, now)}.`
    : `Reboots ${at(atMs)}.`;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onSubmit({
        action: shutdown ? 'power-shutdown' : 'power-reboot',
        args: shutdown ? { when: whenBuilt.when, wake: wakeBuilt.wake } : { when: whenBuilt.when },
        confirm: typed.trim(),
      });
      onClose();
    } catch {
      // The caller has already said why; the dialog stays open so nothing typed is lost.
    } finally {
      setBusy(false);
    }
  };

  const toggleSx = {
    '& .MuiToggleButton-root': {
      fontSize: '0.75rem', fontWeight: 700, color: T.textMuted, border: `1px solid ${S.border}`,
      px: 1.5, py: 0.5, textTransform: 'none',
      '&.Mui-selected': { color: T.teal, bgcolor: T.tealBg, borderColor: T.teal },
    },
  };
  const piTime = `Pi time, ${formatOffset(offsetSec)}`;
  const Icon = shutdown ? PowerSettingsNewRounded : RestartAltRounded;

  return (
    <SheetDialog
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { bgcolor: S.card, border: `1px solid ${S.border}`, borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6, fontSize: '1rem', fontWeight: 800, color: T.text }}>
        <Icon sx={{ fontSize: 20, color: T.error }} />
        {shutdown ? 'Shut down and wake' : 'Reboot the server'}
        <IconButton onClick={onClose} disabled={busy} size="small" aria-label="Close" sx={{ position: 'absolute', top: 12, right: 12, color: T.textFaint }}>
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '4px !important' }}>
        {/* When */}
        <Box>
          <Label>{shutdown ? 'Shut down' : 'Reboot'}</Label>
          <ToggleButtonGroup exclusive size="small" value={whenMode} onChange={(_, v) => v && setWhenMode(v)} sx={toggleSx}>
            <ToggleButton value="now">Now</ToggleButton>
            <ToggleButton value="in">In N minutes</ToggleButton>
            <ToggleButton value="at">At time</ToggleButton>
          </ToggleButtonGroup>
          {whenMode === 'in' && (
            <TextField
              size="small" type="number" label="Minutes from now" value={minutes} onChange={(e) => setMinutes(e.target.value)}
              slotProps={{ htmlInput: { min: REBOOT_DELAY.min, max: REBOOT_DELAY.max, step: 1, inputMode: 'numeric' } }}
              sx={{ mt: 1.25, width: 180 }}
            />
          )}
          {whenMode === 'at' && (
            <TextField
              size="small" type="time" label={`Time (${piTime})`} value={time} onChange={(e) => setTime(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ mt: 1.25, width: 220 }}
            />
          )}
        </Box>

        {/* Wake — required for a shutdown */}
        {shutdown && (
          <Box>
            <Label>Power back on</Label>
            <ToggleButtonGroup exclusive size="small" value={wakeMode} onChange={(_, v) => v && setWakeMode(v)} sx={toggleSx}>
              <ToggleButton value="in">In N hours</ToggleButton>
              <ToggleButton value="at">At date and time</ToggleButton>
            </ToggleButtonGroup>
            {wakeMode === 'in' && (
              <TextField
                size="small" type="number" label="Hours from now" value={hours} onChange={(e) => setHours(e.target.value)}
                slotProps={{ htmlInput: { min: 0.5, max: 168, step: 0.5, inputMode: 'decimal' } }}
                sx={{ mt: 1.25, width: 180 }}
              />
            )}
            {wakeMode === 'at' && (
              <TextField
                size="small" type="datetime-local" label={`Wake (${piTime})`} value={wakeAt} onChange={(e) => setWakeAt(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: toHostLocalInput(now, offsetSec) } }}
                sx={{ mt: 1.25, width: 260 }}
              />
            )}
            <Typography sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start', fontSize: '0.72rem', color: T.textMuted, mt: 1 }}>
              <AlarmRounded sx={{ fontSize: 14, mt: 0.15, color: T.textFaint }} />
              The Pi powers itself back on from its real-time clock: the wake time is set as an alarm before it shuts down.
            </Typography>
          </Box>
        )}

        {/* What will happen, or why not */}
        <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: S.inset, border: `1px solid ${S.border}` }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: error ? T.error : T.text }}>
            {error || summary}
          </Typography>
        </Box>

        {/* Type the host name */}
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: T.errorBg, border: `1px solid ${T.error}33` }}>
          <Typography sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start', fontSize: '0.78rem', color: T.text, mb: host ? 1.25 : 0 }}>
            <WarningAmberRounded sx={{ fontSize: 16, color: T.error, mt: 0.1 }} />
            {host ? (
              <span>
                The site, streaming and downloads go offline{shutdown ? ' until the Pi wakes' : ' for a minute or two'}.
                {' '}Type <Box component="b" sx={{ fontFamily: 'monospace' }}>{host}</Box> to confirm.
              </span>
            ) : (
              <span>
                The host name is not known yet (no health report or power state), so this cannot be confirmed.
                Run the health check first.
              </span>
            )}
          </Typography>
          {host && (
            <TextField
              size="small" fullWidth value={typed} onChange={(e) => setTyped(e.target.value)}
              placeholder={host} aria-label="Host name"
              autoComplete="off"
              slotProps={{ htmlInput: { autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false } }}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              sx={{ '& input': { fontFamily: 'monospace' }, bgcolor: S.card, borderRadius: 1 }}
            />
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy} sx={{ color: T.textMuted, textTransform: 'none', fontWeight: 600 }}>
          Cancel
        </Button>
        <Button
          variant="contained" color="error" disabled={!canSubmit} onClick={submit}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <Icon sx={{ fontSize: 18 }} />}
          sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
        >
          {shutdown ? 'Shut down' : 'Reboot'}
        </Button>
      </DialogActions>
    </SheetDialog>
  );
}

function Label({ children }) {
  const T = useT();
  return (
    <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75 }}>
      {children}
    </Typography>
  );
}
