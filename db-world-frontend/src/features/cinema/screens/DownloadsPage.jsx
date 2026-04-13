import React, { useState, useEffect, useCallback, useRef } from 'react';
import { registerPlugin } from '@capacitor/core';
import {
  Box, Typography, LinearProgress, IconButton, Chip, Tooltip,
  CircularProgress, Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useT } from '@shared/theme/ThemeContext';

const DbWorldDownload = registerPlugin('DbWorldDownload');

const STATUS_COLORS = {
  pending: '#ff9800',
  running: '#2196f3',
  paused:  '#9c27b0',
  success: '#4caf50',
  failed:  '#f44336',
  unknown: '#757575',
};

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '—';
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function DownloadItem({ item, onRemove }) {
  const T = useT();
  const isActive = item.status === 'running' || item.status === 'pending';

  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        p: 1.5, mb: 1,
        borderRadius: 2,
        bgcolor: T.glass,
        border: `1px solid ${T.glassBorder}`,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{ color: T.text, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {item.title || 'Download'}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
          <Chip
            label={item.status}
            size="small"
            sx={{
              bgcolor: `${STATUS_COLORS[item.status] ?? STATUS_COLORS.unknown}22`,
              color: STATUS_COLORS[item.status] ?? STATUS_COLORS.unknown,
              fontWeight: 700, fontSize: '0.6rem', height: 18,
            }}
          />
          {item.bytesTotal > 0 && (
            <Typography variant="caption" sx={{ color: T.textFaint }}>
              {formatBytes(item.bytesDownloaded)} / {formatBytes(item.bytesTotal)}
            </Typography>
          )}
        </Box>

        {isActive && item.bytesTotal > 0 && (
          <LinearProgress
            variant="determinate"
            value={item.progress}
            sx={{
              mt: 0.75, borderRadius: 1, height: 4,
              bgcolor: `${STATUS_COLORS.running}22`,
              '& .MuiLinearProgress-bar': { bgcolor: STATUS_COLORS.running },
            }}
          />
        )}
        {isActive && item.bytesTotal <= 0 && (
          <LinearProgress sx={{ mt: 0.75, borderRadius: 1, height: 4 }} />
        )}
      </Box>

      {/* Show remove/cancel button for every status */}
      <Tooltip title={isActive ? 'Cancel' : 'Remove'}>
        <IconButton size="small" onClick={() => onRemove(item.downloadId)} sx={{ color: T.textFaint }}>
          <DeleteIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export default function DownloadsPage() {
  const T = useT();
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const fetchDownloads = useCallback(async () => {
    try {
      const result = await DbWorldDownload.listDownloads();
      const list = result.downloads ?? [];
      const order = { running: 0, pending: 1, paused: 2, success: 3, failed: 4, unknown: 5 };
      list.sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5));
      setDownloads(list);
    } catch (e) {
      console.error('Failed to list downloads', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDownloads();
    pollRef.current = setInterval(fetchDownloads, 1500);
    return () => clearInterval(pollRef.current);
  }, [fetchDownloads]);

  const handleRemove = useCallback(async (downloadId) => {
    try {
      await DbWorldDownload.cancelDownload({ downloadId });
      await fetchDownloads();
    } catch (e) {
      console.error('Remove failed', e);
    }
  }, [fetchDownloads]);

  const activeCount = downloads.filter(d => d.status === 'running' || d.status === 'pending').length;

  return (
    <Box sx={{ bgcolor: T.bg, minHeight: '100vh', color: T.text }}>
      <Box sx={{ px: { xs: 2, md: 4 }, py: 3, maxWidth: 700, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: T.text }}>
            Downloads
          </Typography>
          {activeCount > 0 && (
            <Chip
              label={`${activeCount} active`}
              size="small"
              sx={{ bgcolor: `${STATUS_COLORS.running}22`, color: STATUS_COLORS.running, fontWeight: 700 }}
            />
          )}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
            <CircularProgress size={36} />
          </Box>
        ) : downloads.length === 0 ? (
          <Alert severity="info" sx={{ bgcolor: T.glass, color: T.text, border: `1px solid ${T.glassBorder}` }}>
            No downloads yet. Use the Download button on any media file to start.
          </Alert>
        ) : (
          downloads.map(item => (
            <DownloadItem key={item.downloadId} item={item} onRemove={handleRemove} />
          ))
        )}
      </Box>
    </Box>
  );
}
