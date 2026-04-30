import React from 'react';
import {
  Box, Typography, LinearProgress, IconButton, Chip, Tooltip,
} from '@mui/material';
import PauseIcon        from '@mui/icons-material/Pause';
import PlayArrowIcon    from '@mui/icons-material/PlayArrow';
import CancelIcon       from '@mui/icons-material/Close';
import DeleteIcon       from '@mui/icons-material/Delete';
import CheckCircleIcon  from '@mui/icons-material/CheckCircle';
import ErrorIcon        from '@mui/icons-material/Error';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
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

const STATUS_ICON = {
  success:  <CheckCircleIcon  sx={{ fontSize: 13 }} />,
  failed:   <ErrorIcon        sx={{ fontSize: 13 }} />,
  pending:  <HourglassTopIcon sx={{ fontSize: 13 }} />,
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

function Avatar({ title }) {
  const ch  = (title || '?').charAt(0).toUpperCase();
  const hue = (ch.charCodeAt(0) * 47) % 360;
  return (
    <Box sx={{
      width: 44, height: 44, flexShrink: 0,
      borderRadius: 1.5,
      bgcolor: `hsl(${hue},35%,26%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      mr: 1.5,
    }}>
      <Typography sx={{ color: '#fff', fontSize: 17, fontWeight: 700, lineHeight: 1 }}>
        {ch}
      </Typography>
    </Box>
  );
}

export default function DownloadItem({ item, onPlay, onSelect, selected, actions }) {
  const T        = useT();
  const isActive = item.status === 'running' || item.status === 'pending';
  const isPaused = item.status === 'paused';
  const canPlay  = item.status === 'success' && item.canPlay && item.playableUri;
  const color    = STATUS_COLOR[item.status] ?? STATUS_COLOR.unknown;
  const speed    = fmtSpeed(item.speedBytesPerSec);
  const eta      = fmtEta(item.etaSeconds);

  return (
    <Box
      onClick={() => onSelect?.(item)}
      sx={{
        display: 'flex', alignItems: 'flex-start',
        p: 1.25, mb: 0.75,
        borderRadius: 2,
        bgcolor: selected ? `${color}18` : T.glass,
        border: `1px solid ${selected ? color : T.glassBorder}`,
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'all .15s',
        '&:hover': onSelect ? { bgcolor: `${color}12`, borderColor: `${color}66` } : {},
      }}
    >
      <Avatar title={item.title} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{
          color: T.text, fontWeight: 600, lineHeight: 1.3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {item.title}
        </Typography>

        <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip
            icon={STATUS_ICON[item.status]}
            label={item.status}
            size="small"
            sx={{
              bgcolor: `${color}22`, color,
              fontWeight: 700, fontSize: '0.6rem', height: 18,
              '& .MuiChip-icon': { color },
            }}
          />
          {item.bytesTotal > 0 && (
            <Typography variant="caption" sx={{ color: T.textFaint, fontSize: '0.67rem' }}>
              {fmtBytes(item.bytesDownloaded)} / {fmtBytes(item.bytesTotal)}
            </Typography>
          )}
        </Box>

        {(isActive || isPaused) && (
          <>
            {speed && (
              <Typography variant="caption" sx={{ color: T.textFaint, fontSize: '0.65rem', mt: 0.25, display: 'block' }}>
                {speed}{eta ? ` · ETA ${eta}` : ''}
              </Typography>
            )}
            <LinearProgress
              variant={item.bytesTotal > 0 ? 'determinate' : 'indeterminate'}
              value={item.progress || 0}
              sx={{
                mt: 0.5, borderRadius: 1, height: 3,
                bgcolor: `${STATUS_COLOR.running}22`,
                '& .MuiLinearProgress-bar': { bgcolor: color },
              }}
            />
          </>
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
