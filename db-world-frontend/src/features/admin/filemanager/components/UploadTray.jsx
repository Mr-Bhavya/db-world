import { useState } from 'react';
import { Box, Typography, IconButton, LinearProgress, Tooltip, Chip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReplayIcon from '@mui/icons-material/Replay';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { AnimatePresence, motion } from 'framer-motion';
import { useT } from '@shared/theme';
import { useUploadStore } from '../store/useUploadStore';

function formatBytes(n) {
  if (!n || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatEta(sec) {
  if (sec == null || !Number.isFinite(sec)) return '';
  if (sec < 60) return `${Math.ceil(sec)}s left`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s left`;
}

function UploadRow({ id, upload, onPause, onResume, onCancel, onRetry }) {
  const T = useT();
  const { name, total, sent, status, speed, etaSec, error } = upload;
  const pct = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
  const barColor = status === 'error' ? T.error : status === 'done' ? T.success : T.teal;

  return (
    <Box sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${T.border}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography sx={{
          fontSize: 12.5, color: T.textPrimary, flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {name}
        </Typography>
        {status === 'done' && <CheckCircleIcon sx={{ fontSize: 16, color: T.success }} />}
        {status === 'error' && <ErrorIcon sx={{ fontSize: 16, color: T.error }} />}
        {status === 'uploading' && (
          <Tooltip title="Pause">
            <IconButton size="small" onClick={() => onPause?.(id)} sx={{ color: T.textFaint, p: 0.25 }}>
              <PauseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
        {status === 'paused' && (
          <Tooltip title="Resume">
            <IconButton size="small" onClick={() => onResume?.(id)} sx={{ color: T.textFaint, p: 0.25 }}>
              <PlayArrowIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
        {status === 'error' && (
          <Tooltip title="Retry">
            <IconButton size="small" onClick={() => onRetry?.(id)} sx={{ color: T.teal, p: 0.25 }}>
              <ReplayIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
        {status !== 'done' && (
          <Tooltip title="Cancel">
            <IconButton size="small" onClick={() => onCancel?.(id)} sx={{ color: T.textFaint, p: 0.25 }}>
              <CloseIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <LinearProgress
        variant="determinate"
        value={status === 'error' ? 100 : pct}
        sx={{
          mt: 0.75, height: 5, borderRadius: 3, bgcolor: T.glassHover,
          '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 3 },
        }}
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, gap: 1 }}>
        <Typography sx={{
          fontSize: 10.5, color: status === 'error' ? T.error : T.textFaint,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {status === 'error'
            ? (error || 'Upload failed')
            : status === 'done'
              ? `${formatBytes(total)} — done`
              : `${formatBytes(sent)} / ${formatBytes(total)}`}
        </Typography>
        {status === 'uploading' && (
          <Typography sx={{ fontSize: 10.5, color: T.textFaint, flexShrink: 0 }}>
            {speed ? `${formatBytes(speed)}/s ` : ''}{formatEta(etaSec)}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/**
 * Bottom-right floating tray for in-flight uploads. Purely presentational —
 * all lifecycle actions (pause/resume/cancel/retry) are supplied by the
 * caller (`index.jsx`, wrapping `upload/useUploadManager.js`); this component
 * only renders `useUploadStore` state and forwards clicks. `trayOpen` is
 * flipped to `true` automatically by `useUploadStore.addUpload` on the first
 * queued upload; the header close button hides the tray without touching
 * any in-flight transfers.
 */
export default function UploadTray({ onPause, onResume, onCancel, onRetry, onClose }) {
  const T = useT();
  const uploads = useUploadStore((s) => s.uploads);
  const trayOpen = useUploadStore((s) => s.trayOpen);
  const setTrayOpen = useUploadStore((s) => s.setTrayOpen);
  const [collapsed, setCollapsed] = useState(false);

  const ids = Object.keys(uploads);
  const activeCount = ids.filter((id) => uploads[id].status === 'uploading' || uploads[id].status === 'paused').length;
  const visible = trayOpen && ids.length > 0;

  const handleTrayClose = () => {
    setTrayOpen(false);
    onClose?.();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="upload-tray"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          style={{
            position: 'fixed', right: 20, bottom: 20, zIndex: 1300,
            width: 320, maxWidth: 'calc(100vw - 40px)',
          }}
        >
          <Box sx={{
            borderRadius: 2, overflow: 'hidden',
            bgcolor: T.glass, backdropFilter: 'blur(16px)',
            border: `1px solid ${T.glassBorder}`, boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
          }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1,
              borderBottom: collapsed ? 'none' : `1px solid ${T.border}`,
            }}>
              <UploadFileIcon sx={{ fontSize: 16, color: T.teal }} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: T.textPrimary, flex: 1 }}>
                Uploads
              </Typography>
              {activeCount > 0 && (
                <Chip
                  label={activeCount} size="small"
                  sx={{ height: 18, fontSize: 10.5, bgcolor: T.tealBg, color: T.teal }}
                />
              )}
              <IconButton size="small" onClick={() => setCollapsed((v) => !v)} sx={{ color: T.textFaint, p: 0.25 }}>
                {collapsed ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
              </IconButton>
              <IconButton size="small" onClick={handleTrayClose} sx={{ color: T.textFaint, p: 0.25 }}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>

            {!collapsed && (
              <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
                {ids.map((id) => (
                  <UploadRow
                    key={id}
                    id={id}
                    upload={uploads[id]}
                    onPause={onPause}
                    onResume={onResume}
                    onCancel={onCancel}
                    onRetry={onRetry}
                  />
                ))}
              </Box>
            )}
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
