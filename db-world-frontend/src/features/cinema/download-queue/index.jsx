import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Chip, CircularProgress, IconButton, Tabs, Tab, Divider, Button,
  Switch, useMediaQuery, useTheme,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Menu, MenuItem, ListItemIcon, ListItemText
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RefreshIcon         from '@mui/icons-material/Refresh';
import PlayArrowIcon       from '@mui/icons-material/PlayArrow';
import DeleteIcon          from '@mui/icons-material/Delete';
import CancelIcon          from '@mui/icons-material/Close';
import ReplayIcon          from '@mui/icons-material/Replay';
import WifiIcon            from '@mui/icons-material/Wifi';
import PauseIcon           from '@mui/icons-material/Pause';
import DownloadDoneIcon    from '@mui/icons-material/DownloadDone';
import DownloadingIcon     from '@mui/icons-material/Downloading';
import ErrorOutlineIcon    from '@mui/icons-material/ErrorOutline';
import FolderOpenIcon      from '@mui/icons-material/FolderOpen';
import BatteryAlertIcon    from '@mui/icons-material/BatteryAlert';
import { useT }            from '@shared/theme/ThemeContext';
import Constants            from '@shared/constants';
import DbWorldDownload      from '@platform/android/DbWorldDownload';
import DownloadItem, { STATUS_COLOR, fmtBytes, fmtSpeed, fmtEta } from './DownloadItem';
import { useDownloads }    from './useDownloads';

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ tab }) {
  const T = useT();
  const msgs = {
    all:       { icon: <FolderOpenIcon sx={{ fontSize: 48, opacity: 0.3 }} />, text: 'No downloads yet.' },
    active:    { icon: <DownloadingIcon  sx={{ fontSize: 48, opacity: 0.3 }} />, text: 'No active downloads.' },
    completed: { icon: <DownloadDoneIcon sx={{ fontSize: 48, opacity: 0.3 }} />, text: 'No completed downloads.' },
    failed:    { icon: <ErrorOutlineIcon sx={{ fontSize: 48, opacity: 0.3 }} />, text: 'No failed or cancelled downloads.' },
  };
  const { icon, text } = msgs[tab] ?? msgs.all;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 8, gap: 1.5, color: T.textFaint }}>
      {icon}
      <Typography variant="body2" sx={{ color: T.textFaint }}>{text}</Typography>
    </Box>
  );
}

// ─── Detail panel (desktop right column) ─────────────────────────────────────
function DetailPanel({ item, actions, onPlay }) {
  const T     = useT();
  const color = STATUS_COLOR[item.status] ?? STATUS_COLOR.unknown;

  const canPlay  = item.status === 'success' && item.canPlay && item.playableUri;
  const isActive = item.status === 'running' || item.status === 'pending';
  const canRetry = item.status === 'failed' || item.status === 'cancelled';

  return (
    <Box sx={{
      flex: 1, display: 'flex', flexDirection: 'column',
      bgcolor: T.glass, border: `1px solid ${T.glassBorder}`,
      borderRadius: 2, p: 3, ml: 0,
      minWidth: 0,
    }}>
      {/* Title */}
      <Typography variant="h6" sx={{ fontWeight: 700, color: T.text, mb: 0.5, lineHeight: 1.3 }}>
        {item.title}
      </Typography>
      <Typography variant="caption" sx={{ color: T.textFaint, mb: 2, display: 'block', wordBreak: 'break-all' }}>
        {item.fileName}
      </Typography>

      <Divider sx={{ borderColor: T.border, mb: 2 }} />

      {/* Stats grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2.5 }}>
        {[
          { label: 'Status',     value: item.status,                  color },
          { label: 'Progress',   value: `${item.progress ?? 0}%`,     color: isActive ? '#2196f3' : undefined },
          { label: 'Downloaded', value: fmtBytes(item.bytesDownloaded) },
          { label: 'Total Size', value: fmtBytes(item.bytesTotal) },
          ...(isActive && item.speedBytesPerSec > 0 ? [
            { label: 'Speed', value: fmtSpeed(item.speedBytesPerSec), color: '#2196f3' },
            { label: 'ETA',   value: fmtEta(item.etaSeconds) || '—' },
          ] : []),
        ].map(({ label, value, color: c }) => (
          <Box key={label} sx={{ bgcolor: `${T.glassBorder}55`, borderRadius: 1.5, p: 1.25 }}>
            <Typography variant="caption" sx={{ color: T.textFaint, display: 'block', mb: 0.25, fontSize: '0.65rem' }}>
              {label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: c ?? T.text, fontSize: '0.8rem' }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Action buttons */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 'auto' }}>
        {canPlay && (
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={() => onPlay(item)}
            sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#43a047' }, fontWeight: 700 }}
          >
            Play
          </Button>
        )}
        {item.status === 'running' && (
          <Button
            variant="outlined"
            startIcon={<PauseIcon />}
            onClick={() => actions.pause(item.downloadId)}
            sx={{ borderColor: T.textMuted, color: T.textMuted }}
          >
            Pause
          </Button>
        )}
        {item.status === 'paused' && (
          <Button
            variant="outlined"
            startIcon={<PlayArrowIcon />}
            onClick={() => actions.resume(item.downloadId)}
            sx={{ borderColor: T.textMuted, color: T.textMuted }}
          >
            Resume
          </Button>
        )}
        {(item.status === 'running' || item.status === 'paused') && (
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={() => actions.cancel(item.downloadId)}
            sx={{ borderColor: '#f4433655', color: '#f44336' }}
          >
            Cancel
          </Button>
        )}
        {canRetry && (
          <Button
            variant="outlined"
            startIcon={<ReplayIcon />}
            onClick={() => actions.retry(item.downloadId)}
            sx={{ borderColor: '#2196f355', color: '#2196f3' }}
          >
            Redownload
          </Button>
        )}
        <Button
          variant="outlined"
          startIcon={<DeleteIcon />}
          onClick={() => actions.remove(item.downloadId)}
          sx={{ borderColor: '#f4433655', color: '#f44336' }}
        >
          Delete
        </Button>
      </Box>
    </Box>
  );
}

// ─── Confirmation dialog (cancel vs delete) ─────────────────────────────────────
// Two distinct destructive actions, each with copy that makes the difference clear:
//   • cancel — stop the transfer but KEEP the entry so it can be redownloaded.
//   • delete — remove the entry entirely; for a finished file also erase it from the phone.
function ConfirmDialog({ state, onClose, onConfirm }) {
  const T    = useT();
  const open = Boolean(state);
  const kind = state?.kind;
  const item = state?.item;
  const isCompleted = item?.status === 'success';

  const copy = kind === 'cancel'
    ? {
        title: 'Cancel download?',
        body: 'This stops the transfer and discards the progress so far. The download stays in your list under “Failed” so you can redownload it anytime.',
        confirm: 'Cancel download',
        keep: 'Keep downloading',
        color: '#ff9800',
      }
    : {
        title: isCompleted ? 'Delete file?' : 'Remove download?',
        body: isCompleted
          ? 'This permanently deletes the downloaded file from your phone and removes it from this list. This cannot be undone.'
          : 'This removes the download from your list. Any partial data is discarded.',
        confirm: isCompleted ? 'Delete file' : 'Remove',
        keep: 'Keep',
        color: '#f44336',
      };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { bgcolor: T.surface || T.bg, color: T.text, borderRadius: 2, border: `1px solid ${T.glassBorder}`, maxWidth: 380 } }}
    >
      <DialogTitle sx={{ fontWeight: 700, color: T.text, pb: 1 }}>{copy.title}</DialogTitle>
      <DialogContent>
        {item && (
          <Typography variant="body2" sx={{ color: T.text, fontWeight: 600, mb: 1, wordBreak: 'break-word' }}>
            {item.title}
          </Typography>
        )}
        <DialogContentText sx={{ color: T.textFaint, fontSize: '0.85rem' }}>
          {copy.body}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: T.textMuted, textTransform: 'none' }}>
          {copy.keep}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          sx={{ bgcolor: copy.color, '&:hover': { bgcolor: copy.color, filter: 'brightness(0.9)' }, fontWeight: 700, textTransform: 'none' }}
        >
          {copy.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DownloadsPage() {
  const T       = useT();
  const theme   = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const navigate = useNavigate();
  const {
    downloads, loading, refresh, actions, wifiOnly, toggleWifiOnly,
    concurrency, maxConcurrency, setConcurrency,
  } = useDownloads();
  const [tab,      setTab]      = useState('all');
  const [selected, setSelected] = useState(null);
  const [confirm,  setConfirm]  = useState(null); // { kind: 'cancel' | 'delete', item }
  // Whether the OS still battery-optimizes us (background downloads may be throttled).
  const [batteryOptimized, setBatteryOptimized] = useState(false);

  const checkBattery = useCallback(async () => {
    try {
      const { optimized } = await DbWorldDownload.isBatteryOptimized();
      setBatteryOptimized(Boolean(optimized));
    } catch { /* web stub / older native — ignore */ }
  }, []);
  React.useEffect(() => { checkBattery(); }, [checkBattery]);

  const requestBattery = useCallback(async () => {
    try { await DbWorldDownload.requestBatteryExemption(); } catch { /* ignore */ }
    // Re-check after the user returns from the system dialog.
    setTimeout(checkBattery, 800);
  }, [checkBattery]);

  // Route the two destructive actions through a confirmation dialog; everything
  // else (play/pause/resume/retry) acts immediately.
  const askConfirm = useCallback((kind, id) => {
    const item = downloads.find(d => d.downloadId === id);
    if (item) setConfirm({ kind, item });
  }, [downloads]);

  const guardedActions = useMemo(() => ({
    ...actions,
    cancel: (id) => askConfirm('cancel', id),
    remove: (id) => askConfirm('delete', id),
  }), [actions, askConfirm]);

  const handleConfirm = useCallback(() => {
    if (!confirm) return;
    const { kind, item } = confirm;
    if (kind === 'cancel') actions.cancel(item.downloadId);
    else                   actions.remove(item.downloadId);
    setConfirm(null);
  }, [confirm, actions]);

  const { active, completed, failed } = useMemo(() => ({
    active:    downloads.filter(d => ['running', 'pending', 'paused'].includes(d.status)),
    completed: downloads.filter(d => d.status === 'success'),
    failed:    downloads.filter(d => ['failed', 'cancelled'].includes(d.status)),
  }), [downloads]);

  const pausableCount  = useMemo(() => downloads.filter(d => d.status === 'running' || d.status === 'pending').length, [downloads]);
  const resumableCount = useMemo(() => downloads.filter(d => d.status === 'paused').length, [downloads]);
  const activeSpeed    = useMemo(() => downloads.reduce((s, d) => d.status === 'running' ? s + (d.speedBytesPerSec || 0) : s, 0), [downloads]);

  const [menuAnchor, setMenuAnchor] = useState(null);
  const closeMenu = () => setMenuAnchor(null);
  const runAndClose = (fn) => () => { closeMenu(); fn(); };

  const visible = useMemo(() => {
    if (tab === 'active')    return active;
    if (tab === 'completed') return completed;
    if (tab === 'failed')    return failed;
    return downloads;
  }, [tab, downloads, active, completed, failed]);

  // Deselect if item removed
  React.useEffect(() => {
    if (selected && !downloads.find(d => d.downloadId === selected.downloadId)) {
      setSelected(null);
    }
    // keep selected in sync
    if (selected) {
      const fresh = downloads.find(d => d.downloadId === selected.downloadId);
      if (fresh) setSelected(fresh);
    }
  }, [downloads]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlay = (item) => {
    const url = item.playableUri || item.localUri;
    if (!url) return;
    navigate(Constants.DB_PLAYER_ROUTE, {
      state: {
        media: {
          url,
          fileId:   String(item.downloadId || ''),
          title:    item.title || item.fileName || 'Download',
          fileName: item.fileName || item.title || 'download',
        },
      },
    });
  };

  const handleSelect = (item) => {
    if (!isDesktop) return;
    setSelected(prev => prev?.downloadId === item.downloadId ? null : item);
  };

  const TAB_OPTS = [
    { value: 'all',       label: 'All',       count: downloads.length  },
    { value: 'active',    label: 'Active',    count: active.length,    color: '#2196f3' },
    { value: 'completed', label: 'Completed', count: completed.length, color: '#4caf50' },
    { value: 'failed',    label: 'Failed',    count: failed.length,    color: '#f44336' },
  ];

  return (
    <Box sx={{ bgcolor: T.bg, minHeight: '100vh', color: T.text }}>
      <Box sx={{ px: { xs: 2, sm: 3, md: 4 }, py: 3, maxWidth: 1280, mx: 'auto' }}>

        {/* ── Header: title + live summary on the left, one overflow menu on the right ── */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
              Downloads
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, minHeight: 20 }}>
              {active.length > 0 ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#2196f3' }}>
                    <DownloadingIcon sx={{ fontSize: 15 }} />
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {active.length} active
                    </Typography>
                  </Box>
                  {activeSpeed > 0 && (
                    <Typography variant="caption" sx={{ color: T.textFaint }}>
                      · {fmtSpeed(activeSpeed)}
                    </Typography>
                  )}
                  {wifiOnly && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: T.textFaint }}>
                      <WifiIcon sx={{ fontSize: 13 }} />
                      <Typography variant="caption">Wi-Fi only</Typography>
                    </Box>
                  )}
                </>
              ) : (
                <Typography variant="caption" sx={{ color: T.textFaint }}>
                  {downloads.length} {downloads.length === 1 ? 'item' : 'items'}
                </Typography>
              )}
            </Box>
          </Box>

          <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ color: T.textMuted }}>
            <MoreVertIcon />
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={closeMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{ sx: { bgcolor: T.surface || T.bg, color: T.text, border: `1px solid ${T.glassBorder}`, minWidth: 200 } }}
          >
            {pausableCount > 0 && (
              <MenuItem onClick={runAndClose(actions.pauseAll)}>
                <ListItemIcon sx={{ color: T.textMuted }}><PauseIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Pause all ({pausableCount})</ListItemText>
              </MenuItem>
            )}
            {resumableCount > 0 && (
              <MenuItem onClick={runAndClose(actions.resumeAll)}>
                <ListItemIcon sx={{ color: '#4caf50' }}><PlayArrowIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Resume all ({resumableCount})</ListItemText>
              </MenuItem>
            )}
            {(pausableCount > 0 || resumableCount > 0) && <Divider sx={{ borderColor: T.border }} />}
            <MenuItem onClick={() => toggleWifiOnly(!wifiOnly)}>
              <ListItemIcon sx={{ color: wifiOnly ? '#2196f3' : T.textMuted }}><WifiIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Wi-Fi only</ListItemText>
              <Switch
                edge="end"
                size="small"
                checked={wifiOnly}
                onChange={(_, v) => toggleWifiOnly(v)}
                onClick={(e) => e.stopPropagation()}
              />
            </MenuItem>
            {/* Only shown while the OS still battery-optimizes us — the fix for
                downloads dying under Doze / power-saving when backgrounded. */}
            {batteryOptimized && (
              <MenuItem onClick={runAndClose(requestBattery)}>
                <ListItemIcon sx={{ color: '#ff9800' }}><BatteryAlertIcon fontSize="small" /></ListItemIcon>
                <ListItemText
                  primary="Allow background downloads"
                  secondary="Stop the system pausing downloads"
                  secondaryTypographyProps={{ sx: { color: T.textFaint, fontSize: '0.6rem' } }}
                />
              </MenuItem>
            )}
            <MenuItem onClick={runAndClose(refresh)}>
              <ListItemIcon sx={{ color: T.textMuted }}><RefreshIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Refresh</ListItemText>
            </MenuItem>
            <Divider sx={{ borderColor: T.border }} />
            {/* Parallel downloads — default 1, up to maxConcurrency. Extras queue. */}
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="caption" sx={{ color: T.textFaint, fontWeight: 700, display: 'block', mb: 0.75 }}>
                Parallel downloads
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.75 }}>
                {Array.from({ length: maxConcurrency }, (_, i) => i + 1).map(n => {
                  const selected = n === concurrency;
                  return (
                    <Box
                      key={n}
                      onClick={() => setConcurrency(n)}
                      sx={{
                        flex: 1, textAlign: 'center', cursor: 'pointer', userSelect: 'none',
                        py: 0.5, borderRadius: 1.5, fontWeight: 700, fontSize: '0.85rem',
                        color: selected ? '#fff' : T.textMuted,
                        bgcolor: selected ? '#2196f3' : `${T.glassBorder}55`,
                        border: `1px solid ${selected ? '#2196f3' : T.glassBorder}`,
                        transition: 'all .15s',
                        '&:hover': { borderColor: '#2196f3' },
                      }}
                    >
                      {n}
                    </Box>
                  );
                })}
              </Box>
              <Typography variant="caption" sx={{ color: T.textFaint, fontSize: '0.6rem', display: 'block', mt: 0.5 }}>
                {concurrency === 1 ? 'One at a time · rest queue' : `Up to ${concurrency} at once · rest queue`}
              </Typography>
            </Box>
          </Menu>
        </Box>

        {/* ── Tabs ── */}
        <Tabs
          value={tab}
          onChange={(_, v) => { setTab(v); setSelected(null); }}
          sx={{
            mb: 2,
            '& .MuiTabs-indicator': { bgcolor: '#2196f3' },
            '& .MuiTab-root': { color: T.textMuted, textTransform: 'none', fontWeight: 600, minWidth: 80, px: 1.5 },
            '& .Mui-selected': { color: '#2196f3 !important' },
          }}
        >
          {TAB_OPTS.map(({ value, label, count, color }) => (
            <Tab
              key={value}
              value={value}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {label}
                  {count > 0 && (
                    <Chip
                      label={count}
                      size="small"
                      sx={{
                        height: 18, fontSize: '0.6rem', fontWeight: 700,
                        bgcolor: color ? `${color}22` : `${T.glassBorder}88`,
                        color: color ?? T.textFaint,
                      }}
                    />
                  )}
                </Box>
              }
            />
          ))}
        </Tabs>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}>
            <CircularProgress size={36} />
          </Box>
        ) : (
          /* ── Two-column layout on desktop ── */
          <Box sx={{
            display: 'flex',
            gap: { md: 2.5 },
            alignItems: 'flex-start',
          }}>
            {/* Left: list */}
            <Box sx={{
              width: { xs: '100%', md: selected ? 380 : '100%' },
              flexShrink: 0,
              transition: 'width .2s',
            }}>
              {visible.length === 0 ? (
                <EmptyState tab={tab} />
              ) : (
                visible.map(item => (
                  <DownloadItem
                    key={item.downloadId}
                    item={item}
                    onPlay={handlePlay}
                    actions={guardedActions}
                    onSelect={isDesktop ? handleSelect : undefined}
                    selected={selected?.downloadId === item.downloadId}
                  />
                ))
              )}
            </Box>

            {/* Right: detail panel (desktop only, when item selected) */}
            {isDesktop && selected && (
              <DetailPanel
                item={selected}
                actions={guardedActions}
                onPlay={handlePlay}
              />
            )}
          </Box>
        )}
      </Box>

      {/* Cancel / Delete confirmation */}
      <ConfirmDialog
        state={confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
      />
    </Box>
  );
}
