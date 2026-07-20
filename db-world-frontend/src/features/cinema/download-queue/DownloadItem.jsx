import React from 'react';
import {
  Box, Typography, LinearProgress, IconButton, Tooltip,
} from '@mui/material';
import PauseIcon        from '@mui/icons-material/Pause';
import PlayArrowIcon    from '@mui/icons-material/PlayArrow';
import CancelIcon       from '@mui/icons-material/Close';
import DeleteIcon       from '@mui/icons-material/Delete';
import ReplayIcon       from '@mui/icons-material/Replay';
import { useT }         from '@shared/theme/ThemeContext';

export const STATUS_COLOR = {
  pending:   '#ff9800',
  running:   '#2196f3',
  paused:    '#9c27b0',
  success:   '#4caf50',
  failed:    '#f44336',
  cancelled: '#757575',
  unknown:   '#757575',
};

export function fmtBytes(b) {
  if (!b || b <= 0) return '—';
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)} GB`;
  if (b >= 1_048_576)     return `${(b / 1_048_576).toFixed(1)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
}

export function fmtSpeed(bps) {
  if (!bps || bps <= 0) return '';
  if (bps >= 1_048_576) return `${(bps / 1_048_576).toFixed(1)} MB/s`;
  if (bps >= 1024)      return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${bps} B/s`;
}

export function fmtEta(secs) {
  if (!secs || secs <= 0) return '';
  if (secs < 60)   return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function Avatar({ title, thumbnailUrl }) {
  const [imgError, setImgError] = React.useState(false);
  const ch  = (title || '?').charAt(0).toUpperCase();
  const hue = (ch.charCodeAt(0) * 47) % 360;

  if (thumbnailUrl && !imgError) {
    return (
      <Box sx={{ width: 52, height: 52, flexShrink: 0, borderRadius: 2, overflow: 'hidden', mr: 1.5 }}>
        <img
          src={thumbnailUrl}
          alt=""
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </Box>
    );
  }
  return (
    <Box sx={{
      width: 52, height: 52, flexShrink: 0,
      borderRadius: 2,
      bgcolor: `hsl(${hue},35%,26%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      mr: 1.5,
    }}>
      <Typography sx={{ color: '#fff', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
        {ch}
      </Typography>
    </Box>
  );
}

export default function DownloadItem({ item, onPlay, onSelect, selected, actions }) {
  const T          = useT();
  const isActive   = item.status === 'running' || item.status === 'pending';
  const isPaused   = item.status === 'paused';
  // Transient: tapped resume, transfer not yet flowing. Shown so resume feels instant.
  const isResuming = Boolean(item._resuming) && item.status !== 'paused' && !(item.speedBytesPerSec > 0);
  const canPlay    = item.status === 'success' && item.canPlay && item.playableUri;
  const canRetry   = item.status === 'failed' || item.status === 'cancelled';
  const color      = isResuming ? STATUS_COLOR.running : (STATUS_COLOR[item.status] ?? STATUS_COLOR.unknown);
  const speed      = fmtSpeed(item.speedBytesPerSec);
  const eta        = fmtEta(item.etaSeconds);
  const statusLabel = isResuming ? 'resuming' : item.status;

  return (
    <Box
      onClick={() => onSelect?.(item)}
      sx={{
        display: 'flex', alignItems: 'flex-start',
        p: 1.5, mb: 1,
        borderRadius: 2.5,
        bgcolor: selected ? `${color}18` : T.glass,
        border: `1px solid ${selected ? color : T.glassBorder}`,
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'all .15s',
        '&:hover': onSelect ? { bgcolor: `${color}12`, borderColor: `${color}66` } : {},
      }}
    >
      <Avatar title={item.title} thumbnailUrl={item.thumbnailUrl} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{
          color: T.text, fontWeight: 600, lineHeight: 1.3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {item.title}
        </Typography>

        {/* Status dot + size + (active) speed·eta on a single tidy line */}
        <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
            <Typography variant="caption" sx={{ color, fontWeight: 700, fontSize: '0.65rem', textTransform: 'capitalize' }}>
              {statusLabel}
            </Typography>
          </Box>
          {item.bytesTotal > 0 && (
            <Typography variant="caption" sx={{ color: T.textFaint, fontSize: '0.67rem' }}>
              · {fmtBytes(item.bytesDownloaded)} / {fmtBytes(item.bytesTotal)}
            </Typography>
          )}
          {!isResuming && speed && (
            <Typography variant="caption" sx={{ color: T.textFaint, fontSize: '0.67rem' }}>
              · {speed}{eta ? ` · ETA ${eta}` : ''}
            </Typography>
          )}
          {isResuming && (
            <Typography variant="caption" sx={{ color, fontSize: '0.67rem', fontWeight: 600 }}>
              · Resuming…
            </Typography>
          )}
        </Box>

        {(isActive || isPaused) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
            <LinearProgress
              variant={isResuming || item.bytesTotal <= 0 ? 'indeterminate' : 'determinate'}
              value={item.progress || 0}
              sx={{
                flex: 1, borderRadius: 1, height: 5,
                bgcolor: `${STATUS_COLOR.running}22`,
                '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 1 },
              }}
            />
            {!isResuming && item.bytesTotal > 0 && (
              <Typography variant="caption" sx={{ color, fontSize: '0.65rem', fontWeight: 700, minWidth: 30, textAlign: 'right' }}>
                {item.progress || 0}%
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 0, ml: 0.5, flexShrink: 0 }}>
        {canPlay && (
          <Tooltip title="Play">
            <IconButton size="small" onClick={e => { e.stopPropagation(); onPlay(item); }}
              sx={{ color: '#4caf50' }}>
              <PlayArrowIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
        {item.status === 'running' && (
          <Tooltip title="Pause">
            <IconButton size="small"
              onClick={e => { e.stopPropagation(); actions.pause(item.downloadId); }}>
              <PauseIcon sx={{ fontSize: 17, color: T.textMuted }} />
            </IconButton>
          </Tooltip>
        )}
        {item.status === 'paused' && (
          <Tooltip title="Resume">
            <IconButton size="small"
              onClick={e => { e.stopPropagation(); actions.resume(item.downloadId); }}>
              <PlayArrowIcon sx={{ fontSize: 17, color: T.textMuted }} />
            </IconButton>
          </Tooltip>
        )}
        {(item.status === 'running' || item.status === 'paused') && (
          <Tooltip title="Cancel">
            <IconButton size="small"
              onClick={e => { e.stopPropagation(); actions.cancel(item.downloadId); }}>
              <CancelIcon sx={{ fontSize: 17, color: T.textMuted }} />
            </IconButton>
          </Tooltip>
        )}
        {canRetry && (
          <Tooltip title="Redownload">
            <IconButton size="small"
              onClick={e => { e.stopPropagation(); actions.retry(item.downloadId); }}>
              <ReplayIcon sx={{ fontSize: 17, color: '#2196f3' }} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Delete">
          <IconButton size="small"
            onClick={e => { e.stopPropagation(); actions.remove(item.downloadId); }}>
            <DeleteIcon sx={{ fontSize: 17, color: T.textMuted }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
