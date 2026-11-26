import React, { useState } from 'react';
import {
  alpha,
  Box,
  Chip,
  Collapse,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useT } from '@shared/theme';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { encodeTime } from './jobCardConfig';

// One thin sub-step bar (FFmpeg / Info / Storyboard) inside a file row.
function SubStepBar({ label, pct, active, T }) {
  const value = Math.min(100, Math.max(0, Number(pct) || 0));
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.15 }}>
        <Typography sx={{ fontSize: 9.5, fontWeight: active ? 700 : 500, opacity: active ? 1 : 0.6 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: 9.5, opacity: 0.65 }}>{Math.round(value)}%</Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={value}
        sx={{
          height: 3,
          borderRadius: 999,
          bgcolor: alpha(T.text, 0.1),
          '& .MuiLinearProgress-bar': { bgcolor: active ? T.teal : T.success },
        }}
      />
    </Box>
  );
}

const FILE_STATUS_LABEL = { active: 'Processing', done: 'Done', failed: 'Failed' };

function fileStatusColor(T, status) {
  switch (status) {
    case 'active': return T.teal;
    case 'done':   return T.success;
    case 'failed': return T.error;
    default:       return alpha(T.text, 0.55); // pending
  }
}

// The three sub-step bars (FFmpeg / Info / Board) for one file. Wrap to a second line on the
// narrowest screens so labels + percents never get crushed.
function SubStepRow({ f, T }) {
  const active = f.status === 'active';
  return (
    <Stack direction="row" spacing={0.75} sx={{ flexWrap: { xs: 'wrap', sm: 'nowrap' }, gap: { xs: 0.5, sm: 0 } }}>
      <SubStepBar label="FFmpeg" pct={f.ffmpegPercent} active={active && f.subStep === 'ffmpeg'} T={T} />
      <SubStepBar label="Info" pct={f.mediaInfoPercent} active={active && f.subStep === 'media_info'} T={T} />
      <SubStepBar label="Board" pct={f.storyboardPercent} active={active && f.subStep === 'storyboard'} T={T} />
    </Stack>
  );
}

// One file's row: index + name + status chip, and (when active/done) its sub-step bars.
// The active file also shows a guarded "12:03 / 25:40" encode readout (hidden on mobile).
function FileRow({ f, fileTotal, T, showIndex = true }) {
  const color = fileStatusColor(T, f.status);
  const active = f.status === 'active';
  const showBars = active || f.status === 'done';
  const clock = active ? encodeTime(f.ffmpegPositionMs, f.ffmpegDurationMs) : null;
  return (
    <Box
      sx={{
        px: 0.75,
        py: 0.5,
        borderRadius: 1.5,
        bgcolor: alpha(color, active ? 0.09 : 0.04),
        border: `1px solid ${alpha(color, 0.18)}`,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: showBars ? 0.4 : 0 }}>
        {showIndex ? (
          <Typography sx={{ fontSize: 10, fontWeight: 700, opacity: 0.55, minWidth: 30 }}>
            {f.index}/{fileTotal}
          </Typography>
        ) : null}
        <Tooltip title={f.name}>
          <Typography noWrap sx={{ fontSize: 11, flex: 1, minWidth: 0 }}>
            {f.name}
          </Typography>
        </Tooltip>
        {clock ? (
          <Typography
            sx={{
              fontSize: 9.5,
              color: alpha(T.text, 0.7),
              whiteSpace: 'nowrap',
              display: { xs: 'none', sm: 'block' },
            }}
          >
            {clock}
          </Typography>
        ) : null}
        <Chip
          size="small"
          label={FILE_STATUS_LABEL[f.status] ?? 'Queued'}
          sx={{
            height: 16,
            fontSize: 9,
            fontWeight: 700,
            color,
            bgcolor: alpha(color, 0.14),
            '& .MuiChip-label': { px: 0.6 },
          }}
        />
      </Stack>
      {showBars ? <SubStepRow f={f} T={T} /> : null}
    </Box>
  );
}

// Single-file jobs: no "N of M" list — the overall bar already IS this file, so just show its
// three sub-step bars (+ guarded encode time) inline.
export function SingleFileSteps({ file }) {
  const T = useT();
  if (!file) return null;
  const clock = file.status === 'active' ? encodeTime(file.ffmpegPositionMs, file.ffmpegDurationMs) : null;
  return (
    <Box sx={{ mt: 0.75 }}>
      {clock ? (
        <Typography sx={{ fontSize: 10, color: alpha(T.text, 0.7), mb: 0.4 }}>{clock}</Typography>
      ) : null}
      <SubStepRow f={file} T={T} />
    </Box>
  );
}

// Multi-file (season-pack) breakdown: collapsible "Files · N of M" header + a height-capped,
// scrollable list of file rows. Collapsed by default for large packs (> 8 files).
export function FileBreakdown({ files, fileIndex, fileTotal }) {
  const T = useT();
  const [open, setOpen] = useState(fileTotal <= 8);
  if (!files || files.length === 0) return null;

  return (
    <Box sx={{ mt: 0.5 }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={open ? 'Collapse file list' : 'Expand file list'}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); } }}
        sx={{ cursor: 'pointer', userSelect: 'none', minHeight: 32, borderRadius: 1,
          '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 } }}
      >
        <Typography sx={{ fontSize: 11, fontWeight: 700, opacity: 0.75 }}>
          {fileIndex ? `Files · ${fileIndex} of ${fileTotal}` : `Files · ${fileTotal}`}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {open ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
      </Stack>

      <Collapse in={open}>
        <Stack spacing={0.5} sx={{ mt: 0.35, maxHeight: 260, overflowY: 'auto', pr: 0.25 }}>
          {files.map((f) => (
            <FileRow key={f.index} f={f} fileTotal={fileTotal} T={T} />
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}
