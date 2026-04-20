import React, { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Box,
  Typography,
  LinearProgress,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material';

import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CancelIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';

import { useT } from '@shared/theme/ThemeContext';
import DbWorldDownload from '@platform/android/DbWorldDownload';
import AndroidPlugins from '@platform/android/AndroidPlugins';

const STATUS_COLORS = {
  pending: '#ff9800',
  running: '#2196f3',
  paused: '#9c27b0',
  success: '#4caf50',
  failed: '#f44336',
  cancelled: '#757575',
  unknown: '#757575',
};

function normalizeDownload(item = {}) {
  return {
    ...item,
    downloadId: item.downloadId,
    title: item.title || item.fileName || 'Download',
    fileName: item.fileName || item.title || 'download',
    status: item.status || 'running',
    progress: Number.isFinite(item.progress) ? item.progress : 0,
    bytesDownloaded: item.bytesDownloaded || 0,
    bytesTotal: item.bytesTotal || 0,
    localUri: item.localUri || item.playableUri || item.path || '',
    playableUri: item.playableUri || item.localUri || item.path || '',
    mimeType: item.mimeType || '',
    canPlay: Boolean(item.canPlay),
  };
}

function upsertDownload(items, incoming) {
  const next = normalizeDownload(incoming);
  const index = items.findIndex((item) => item.downloadId === next.downloadId);
  if (index === -1) {
    return [next, ...items];
  }

  const updated = [...items];
  updated[index] = normalizeDownload({ ...updated[index], ...next });
  return updated;
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '—';
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

// ─────────────────────────────────────────────
// DOWNLOAD ITEM
// ─────────────────────────────────────────────
function DownloadItem({ item, actions }) {
  const T = useT();
  const isActive = item.status === 'running' || item.status === 'pending';
  const canOpenPlayer = item.status === 'success' && item.canPlay && item.playableUri;

  return (
      <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            mb: 1,
            borderRadius: 2,
            bgcolor: T.glass,
            border: `1px solid ${T.glassBorder}`,
          }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
              variant="body2"
              sx={{
                color: T.text,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
          >
            {item.title || 'Download'}
          </Typography>

          {item.fileName && item.fileName !== item.title && (
              <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: T.textFaint,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
              >
                {item.fileName}
              </Typography>
          )}

          <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
            <Chip
                label={item.status}
                size="small"
                sx={{
                  bgcolor: `${STATUS_COLORS[item.status] ?? STATUS_COLORS.unknown}22`,
                  color: STATUS_COLORS[item.status] ?? STATUS_COLORS.unknown,
                  fontWeight: 700,
                  fontSize: '0.6rem',
                  height: 18,
                }}
            />

            {item.bytesTotal > 0 && (
                <Typography variant="caption" sx={{ color: T.textFaint }}>
                  {formatBytes(item.bytesDownloaded)} / {formatBytes(item.bytesTotal)}
                </Typography>
            )}
          </Box>

          {isActive && (
              <LinearProgress
                  variant={item.bytesTotal > 0 ? 'determinate' : 'indeterminate'}
                  value={item.progress || 0}
                  sx={{
                    mt: 0.75,
                    borderRadius: 1,
                    height: 4,
                    bgcolor: `${STATUS_COLORS.running}22`,
                    '& .MuiLinearProgress-bar': {
                      bgcolor: STATUS_COLORS.running,
                    },
                  }}
              />
          )}

          <Typography variant="caption" sx={{ color: T.textFaint }}>
            {item.downloadId}
          </Typography>
        </Box>

        {/* ACTIONS */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {canOpenPlayer && (
              <Tooltip title="Play">
                <IconButton size="small" onClick={() => actions.play(item)}>
                  <PlayArrowIcon fontSize="small" />
                </IconButton>
              </Tooltip>
          )}

          {item.status === 'running' && (
              <Tooltip title="Pause">
                <IconButton size="small" onClick={() => actions.pause(item.downloadId)}>
                  <PauseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
          )}

          {item.status === 'paused' && (
              <Tooltip title="Resume">
                <IconButton size="small" onClick={() => actions.resume(item.downloadId)}>
                  <PlayArrowIcon fontSize="small" />
                </IconButton>
              </Tooltip>
          )}

          {(item.status === 'running' || item.status === 'paused') && (
              <Tooltip title="Cancel">
                <IconButton size="small" onClick={() => actions.cancel(item.downloadId)}>
                  <CancelIcon fontSize="small" />
                </IconButton>
              </Tooltip>
          )}

          <Tooltip title="Delete">
            <IconButton size="small" onClick={() => actions.delete(item.downloadId)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
  );
}

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────
export default function DownloadsPage() {
  const T = useT();

  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);

  // ─────────────────────────────────────────────
  // FETCH INITIAL LIST
  // ─────────────────────────────────────────────
  const fetchDownloads = useCallback(async () => {
    try {
      const res = await DbWorldDownload.listDownloads();
      const list = res.downloads ?? [];
      setDownloads(list.map(normalizeDownload));
    } catch (e) {
      console.error('Fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDownloads();
  }, []);

  // ─────────────────────────────────────────────
  // REAL-TIME EVENTS
  // ─────────────────────────────────────────────
  useEffect(() => {
    let listeners = [];

    const setup = async () => {
      listeners.push(
          await DbWorldDownload.addListener('downloadProgress', (d) => {
            setDownloads(prev => upsertDownload(prev, { ...d, status: d.status || 'running' }));
          })
      );

      listeners.push(
          await DbWorldDownload.addListener('downloadStateChanged', (d) => {
            setDownloads(prev => upsertDownload(prev, d));
          })
      );

      listeners.push(
          await DbWorldDownload.addListener('downloadComplete', (d) => {
            setDownloads(prev => upsertDownload(prev, { ...d, status: 'success', progress: 100 }));
          })
      );

      listeners.push(
          await DbWorldDownload.addListener('downloadError', (d) => {
            setDownloads(prev => upsertDownload(prev, { ...d, status: 'failed' }));
          })
      );
    };

    setup();

    return () => {
      listeners.forEach(l => l.remove());
    };
  }, []);

  // ─────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────
  const actions = {
    play: async (item) => {
      const url = item.playableUri || item.localUri || item.path;
      if (!url) return;

      if (Capacitor.getPlatform() === 'android' && item.canPlay) {
        await AndroidPlugins.launchNativePlayer({
          url,
          title: item.title || item.fileName || 'Download',
          fileName: item.fileName || item.title || 'download',
          fileId: item.downloadId,
          preferredAudio: 'Hindi',
          preferredSub: null,
        });
        return;
      }

      await DbWorldDownload.openDownloadedFile({
        downloadId: item.downloadId,
        localUri: item.localUri,
        mimeType: item.mimeType,
      });
    },

    pause: async (id) => {
      await DbWorldDownload.pauseDownload({ downloadId: id });
      setDownloads(prev =>
          prev.map(d => d.downloadId === id ? { ...d, status: 'paused' } : d)
      );
    },

    resume: async (id) => {
      await DbWorldDownload.resumeDownload({ downloadId: id });
      setDownloads(prev =>
          prev.map(d => d.downloadId === id ? { ...d, status: 'running' } : d)
      );
    },

    cancel: async (id) => {
      await DbWorldDownload.cancelDownload({ downloadId: id });
      setDownloads(prev => prev.filter(d => d.downloadId !== id));
    },

    delete: async (id) => {
      await DbWorldDownload.deleteDownload({ downloadId: id });
      setDownloads(prev => prev.filter(d => d.downloadId !== id));
    }
  };

  const activeCount = downloads.filter(d =>
      d.status === 'running' || d.status === 'pending'
  ).length;

  // ─────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────
  return (
      <Box sx={{ bgcolor: T.bg, minHeight: '100vh', color: T.text }}>
        <Box sx={{ px: { xs: 2, md: 4 }, py: 3, maxWidth: 700, mx: 'auto' }}>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Downloads
            </Typography>

            {activeCount > 0 && (
                <Chip
                    label={`${activeCount} active`}
                    size="small"
                    sx={{
                      bgcolor: `${STATUS_COLORS.running}22`,
                      color: STATUS_COLORS.running,
                      fontWeight: 700
                    }}
                />
            )}
          </Box>

          {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
                <CircularProgress size={36} />
              </Box>
          ) : downloads.length === 0 ? (
              <Alert severity="info">
                No downloads yet.
              </Alert>
          ) : (
              downloads.map(item => (
                  <DownloadItem
                      key={item.downloadId}
                      item={item}
                      actions={actions}
                  />
              ))
          )}
        </Box>
      </Box>
  );
}
