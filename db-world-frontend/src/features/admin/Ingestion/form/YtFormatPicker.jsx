import React, { useState } from 'react';
import {
  Box, Typography, ToggleButtonGroup, ToggleButton,
  Table, TableBody, TableCell, TableHead, TableRow,
  Alert, CircularProgress, Chip, Paper, useTheme, alpha,
} from '@mui/material';
import { Videocam, Audiotrack } from '@mui/icons-material';

function fmtBitrate(kbps) {
  if (!kbps) return '—';
  return kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${Math.round(kbps)} kbps`;
}
function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3)   return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/**
 * Shows parsed yt-dlp formats and lets the user pick:
 *   - one video format (or none if audioOnly)
 *   - one audio format
 *
 * Props:
 *   formatsData  — YtFormatsResponse from backend
 *   loading      — bool
 *   audioOnly    — bool (from form field)
 *   selectedVideo  — formatId string | null
 *   selectedAudio  — formatId string | null
 *   onSelectVideo  — (id) => void
 *   onSelectAudio  — (id) => void
 */
export default function YtFormatPicker({
  formatsData, loading, audioOnly,
  selectedVideo, selectedAudio,
  onSelectVideo, onSelectAudio,
}) {
  const theme = useTheme();
  const [tab, setTab] = useState(audioOnly ? 'audio' : 'video');

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">Fetching formats…</Typography>
      </Box>
    );
  }

  if (!formatsData) return null;

  const { videoFormats = [], audioFormats = [], title } = formatsData;

  const activeRows  = tab === 'video' ? videoFormats : audioFormats;
  const selectedId  = tab === 'video' ? selectedVideo : selectedAudio;
  const onSelect    = tab === 'video' ? onSelectVideo : onSelectAudio;

  return (
    <Box>
      {title && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          {title}
        </Typography>
      )}

      {!audioOnly && (
        <ToggleButtonGroup
          size="small"
          value={tab}
          exclusive
          onChange={(_, v) => v && setTab(v)}
          sx={{ mb: 1.5 }}
        >
          <ToggleButton value="video">
            <Videocam sx={{ mr: 0.5, fontSize: 16 }} />
            Video ({videoFormats.length})
          </ToggleButton>
          <ToggleButton value="audio">
            <Audiotrack sx={{ mr: 0.5, fontSize: 16 }} />
            Audio ({audioFormats.length})
          </ToggleButton>
        </ToggleButtonGroup>
      )}

      {activeRows.length === 0 ? (
        <Alert severity="info" sx={{ mt: 1 }}>No {tab} formats found.</Alert>
      ) : (
        <Paper variant="outlined" sx={{ maxHeight: 280, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>ID</TableCell>
                <TableCell>{tab === 'video' ? 'Resolution' : 'Codec'}</TableCell>
                <TableCell>Bitrate</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Note</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activeRows.map((fmt) => {
                const selected = fmt.formatId === selectedId;
                return (
                  <TableRow
                    key={fmt.formatId}
                    hover
                    selected={selected}
                    onClick={() => onSelect(fmt.formatId)}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: selected
                        ? alpha(theme.palette.primary.main, 0.08)
                        : undefined,
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Box
                        sx={{
                          width: 14, height: 14, borderRadius: '50%',
                          border: `2px solid`,
                          borderColor: selected ? 'primary.main' : 'divider',
                          bgcolor: selected ? 'primary.main' : 'transparent',
                          mx: 'auto',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={fmt.formatId} size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: selected ? 600 : 400 }}>
                      {tab === 'video'
                        ? (fmt.resolution !== 'audio only' ? fmt.resolution : `${fmt.height}p`)
                        : (fmt.acodec || fmt.ext)}
                    </TableCell>
                    <TableCell>{fmtBitrate(tab === 'video' ? fmt.vbr || fmt.tbr : fmt.abr || fmt.tbr)}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{fmtSize(fmt.filesize)}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>{fmt.formatNote}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
