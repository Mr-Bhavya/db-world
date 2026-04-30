import React, { useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Box, Typography, Chip, CircularProgress, Alert,
  IconButton, Tooltip, Tabs, Tab, Divider, Button,
  useMediaQuery, useTheme,
} from '@mui/material';
import RefreshIcon         from '@mui/icons-material/Refresh';
import PlayArrowIcon       from '@mui/icons-material/PlayArrow';
import DeleteIcon          from '@mui/icons-material/Delete';
import CancelIcon          from '@mui/icons-material/Close';
import PauseIcon           from '@mui/icons-material/Pause';
import DownloadDoneIcon    from '@mui/icons-material/DownloadDone';
import DownloadingIcon     from '@mui/icons-material/Downloading';
import ErrorOutlineIcon    from '@mui/icons-material/ErrorOutline';
import FolderOpenIcon      from '@mui/icons-material/FolderOpen';
import { useT }            from '@shared/theme/ThemeContext';
import AndroidPlugins      from '@platform/android/AndroidPlugins';
import CinemaPlayer        from '@features/cinema/player/CinemaPlayer';
import DownloadItem, { STATUS_COLOR, fmtBytes } from './DownloadItem';
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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DownloadsPage() {
  const T       = useT();
  const theme   = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const { downloads, loading, refresh, actions } = useDownloads();
  const [tab,      setTab]      = useState('all');
  const [selected, setSelected] = useState(null);

  // Web player state
  const [playerOpen,  setPlayerOpen]  = useState(false);
  const [playerMedia, setPlayerMedia] = useState(null);

  const { active, completed, failed } = useMemo(() => ({
    active:    downloads.filter(d => ['running', 'pending', 'paused'].includes(d.status)),
    completed: downloads.filter(d => d.status === 'success'),
    failed:    downloads.filter(d => ['failed', 'cancelled'].includes(d.status)),
  }), [downloads]);

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

  const handlePlay = async (item) => {
    const url = item.playableUri || item.localUri;
    if (!url) return;
    if (Capacitor.getPlatform() === 'android' && item.canPlay) {
      await AndroidPlugins.launchNativePlayer({
        url,
        title:    item.title || item.fileName || 'Download',
        fileName: item.fileName || item.title  || 'download',
        fileId:   item.downloadId,
        preferredAudio: 'Hindi',
        preferredSub:   null,
      });
    } else {
      setPlayerMedia({
        streamUrl: url,
        general:   { fileName: item.title || item.fileName || 'Download' },
      });
      setPlayerOpen(true);
    }
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

        {/* ── Header ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, flex: 1 }}>
            Downloads
          </Typography>
          {active.length > 0 && (
            <Chip
              icon={<DownloadingIcon sx={{ fontSize: 14 }} />}
              label={`${active.length} active`}
              size="small"
              sx={{ bgcolor: '#2196f322', color: '#2196f3', fontWeight: 700, mr: 1 }}
            />
          )}
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={refresh} sx={{ color: T.textFaint }}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
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
                    actions={actions}
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
                actions={actions}
                onPlay={handlePlay}
              />
            )}
          </Box>
        )}
      </Box>

      {/* Web / browser player */}
      <CinemaPlayer
        open={playerOpen}
        onClose={() => setPlayerOpen(false)}
        mediaInfo={playerMedia}
      />
    </Box>
  );
}
