import React, { memo, useEffect, useMemo, useState, useCallback } from 'react';
import {
  Alert,
  alpha,
  Box,
  ButtonBase,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useT } from '@shared/theme';
import {
  Audiotrack,
  CheckCircleRounded,
  GraphicEq,
  Hd,
  PlayCircleOutline,
  Storage,
  VideoSettings,
  Videocam,
} from '@mui/icons-material';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtBitrate(kbps) {
  if (!kbps) return '—';
  return kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${Math.round(kbps)} kbps`;
}

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function getVideoResolution(fmt) {
  if (fmt?.resolution && fmt.resolution !== 'audio only') return fmt.resolution;
  if (fmt?.height) return `${fmt.height}p`;
  return '—';
}

function getAudioCodec(fmt) {
  return fmt?.acodec || fmt?.ext || '—';
}

function getFormatPrimaryLabel(tab, fmt) {
  return tab === 'video' ? getVideoResolution(fmt) : getAudioCodec(fmt);
}

function getFormatBitrate(tab, fmt) {
  return fmtBitrate(
    tab === 'video'
      ? (fmt?.vbr || fmt?.tbr)
      : (fmt?.abr || fmt?.tbr)
  );
}

function getFormatSize(fmt) {
  return fmtSize(fmt?.filesize);
}

// ─────────────────────────────────────────────────────────────────────────────
// Small reusable bits
// ─────────────────────────────────────────────────────────────────────────────

function StatChip({ icon, label, color = 'default' }) {
  return (
    <Chip
      size="small"
      icon={icon}
      label={label}
      color={color}
      variant="outlined"
      sx={{
        borderRadius: 999,
        fontWeight: 600,
      }}
    />
  );
}

function SelectedDot({ selected }) {
  return (
    <Box
      sx={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        border: '2px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'primary.main' : 'transparent',
        position: 'relative',
        transition: 'all 0.2s ease',
        '&::after': selected
          ? {
              content: '""',
              position: 'absolute',
              inset: 3,
              borderRadius: '50%',
              bgcolor: '#fff',
            }
          : undefined,
      }}
    />
  );
}

function PickerHeaderCard({ title, subtitle, leftIcon, children }) {
  const theme = useTheme();

  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{
        borderRadius: 3,
        p: { xs: 1.5, sm: 2 },
        borderColor: alpha(theme.palette.divider, 0.7),
        background:
          theme.palette.mode === 'dark'
            ? 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%)',
      }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.25}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1.1} alignItems="center" minWidth={0}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2.25,
                display: 'grid',
                placeItems: 'center',
                bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                color: 'primary.main',
                flexShrink: 0,
              }}
            >
              {leftIcon}
            </Box>

            <Box minWidth={0}>
              <Typography variant="subtitle1" fontWeight={800} lineHeight={1.2}>
                {title}
              </Typography>
              {subtitle ? (
                <Typography variant="caption" color="text.secondary">
                  {subtitle}
                </Typography>
              ) : null}
            </Box>
          </Stack>

          {children ? <Box>{children}</Box> : null}
        </Stack>
      </Stack>
    </Paper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile cards view
// ─────────────────────────────────────────────────────────────────────────────

const FormatCardList = memo(function FormatCardList({
  rows,
  tab,
  selectedId,
  onSelect,
}) {
  const theme = useTheme();

  if (!rows.length) {
    return (
      <Alert severity="info" sx={{ borderRadius: 3 }}>
        No {tab} formats found.
      </Alert>
    );
  }

  return (
    <Stack spacing={1}>
      {rows.map((fmt) => {
        const selected = fmt.formatId === selectedId;
        const primary = getFormatPrimaryLabel(tab, fmt);
        const bitrate = getFormatBitrate(tab, fmt);
        const size = getFormatSize(fmt);

        return (
          <ButtonBase
            key={fmt.formatId}
            onClick={() => onSelect(fmt.formatId)}
            sx={{
              width: '100%',
              textAlign: 'left',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <Paper
              elevation={0}
              variant="outlined"
              sx={{
                width: '100%',
                p: 1.25,
                borderRadius: 3,
                borderColor: selected
                  ? alpha(theme.palette.primary.main, 0.35)
                  : alpha(theme.palette.divider, 0.8),
                bgcolor: selected
                  ? alpha(theme.palette.primary.main, 0.06)
                  : 'background.paper',
                transition: 'all 0.18s ease',
              }}
            >
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <SelectedDot selected={selected} />

                  <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Chip
                        size="small"
                        label={fmt.formatId}
                        variant="outlined"
                        sx={{
                          fontSize: '0.68rem',
                          height: 24,
                          fontWeight: 700,
                          maxWidth: 90,
                        }}
                      />

                      {selected ? (
                        <Chip
                          size="small"
                          color="primary"
                          icon={<CheckCircleRounded sx={{ fontSize: 14 }} />}
                          label="Selected"
                          sx={{ height: 24, fontSize: '0.68rem', fontWeight: 700 }}
                        />
                      ) : null}
                    </Stack>

                    <Typography variant="body2" fontWeight={700}>
                      {tab === 'video' ? primary : `Audio • ${primary}`}
                    </Typography>

                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                      <StatChip
                        icon={tab === 'video' ? <Hd sx={{ fontSize: 14 }} /> : <GraphicEq sx={{ fontSize: 14 }} />}
                        label={primary}
                      />
                      <StatChip
                        icon={<PlayCircleOutline sx={{ fontSize: 14 }} />}
                        label={bitrate}
                      />
                      <StatChip
                        icon={<Storage sx={{ fontSize: 14 }} />}
                        label={size}
                      />
                    </Stack>

                    {fmt?.formatNote ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {fmt.formatNote}
                      </Typography>
                    ) : null}
                  </Stack>
                </Stack>
              </Stack>
            </Paper>
          </ButtonBase>
        );
      })}
    </Stack>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Desktop table view
// ─────────────────────────────────────────────────────────────────────────────

const FormatTable = memo(function FormatTable({
  rows,
  tab,
  selectedId,
  onSelect,
}) {
  const T = useT();

  if (!rows.length) {
    return (
      <Alert severity="info" sx={{ borderRadius: 3 }}>
        No {tab} formats found.
      </Alert>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ maxHeight: 360, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" sx={{ bgcolor: 'background.paper' }} />
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700 }}>ID</TableCell>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700 }}>
                {tab === 'video' ? 'Resolution' : 'Codec'}
              </TableCell>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700 }}>Bitrate</TableCell>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700 }}>Size</TableCell>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700 }}>Note</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((fmt) => {
              const selected = fmt.formatId === selectedId;

              return (
                <TableRow
                  key={fmt.formatId}
                  hover
                  selected={selected}
                  onClick={() => onSelect(fmt.formatId)}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: selected ? alpha(T.teal, 0.08) : undefined,
                    '& .MuiTableCell-root': {
                      py: 1.1,
                    },
                  }}
                >
                  <TableCell padding="checkbox">
                    <Box sx={{ display: 'grid', placeItems: 'center' }}>
                      <SelectedDot selected={selected} />
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={fmt.formatId}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        height: 24,
                      }}
                    />
                  </TableCell>

                  <TableCell sx={{ fontWeight: selected ? 700 : 500 }}>
                    {getFormatPrimaryLabel(tab, fmt)}
                  </TableCell>

                  <TableCell>{getFormatBitrate(tab, fmt)}</TableCell>

                  <TableCell sx={{ color: 'text.secondary' }}>
                    {getFormatSize(fmt)}
                  </TableCell>

                  <TableCell
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.76rem',
                      maxWidth: 240,
                    }}
                  >
                    <Box
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {fmt?.formatNote || '—'}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shows parsed yt-dlp formats and lets the user pick:
 *   - one video format (or none if audioOnly)
 *   - one audio format
 *
 * Props:
 *   formatsData    — YtFormatsResponse from backend
 *   loading        — bool
 *   audioOnly      — bool
 *   selectedVideo  — formatId string | null
 *   selectedAudio  — formatId string | null
 *   onSelectVideo  — (id) => void
 *   onSelectAudio  — (id) => void
 */
export default function YtFormatPicker({
  formatsData,
  loading,
  audioOnly,
  selectedVideo,
  selectedAudio,
  onSelectVideo,
  onSelectAudio,
}) {
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'));
  const [tab, setTab] = useState(audioOnly ? 'audio' : 'video');

  // Keep tab in sync with audioOnly state
  useEffect(() => {
    if (audioOnly) {
      setTab('audio');
    } else if (tab !== 'video' && tab !== 'audio') {
      setTab('video');
    }
  }, [audioOnly, tab]);

  const { videoFormats = [], audioFormats = [], title } = formatsData || {};

  const activeRows = useMemo(
    () => (tab === 'video' ? videoFormats : audioFormats),
    [tab, videoFormats, audioFormats]
  );

  const selectedId = useMemo(
    () => (tab === 'video' ? selectedVideo : selectedAudio),
    [tab, selectedVideo, selectedAudio]
  );

  const handleSelect = useCallback(
    (id) => {
      if (tab === 'video') {
        onSelectVideo?.(id);
      } else {
        onSelectAudio?.(id);
      }
    },
    [tab, onSelectVideo, onSelectAudio]
  );

  const videoCount = videoFormats.length;
  const audioCount = audioFormats.length;

  if (loading) {
    return (
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 3,
          p: 2,
        }}
      >
        <Stack direction="row" spacing={1.2} alignItems="center">
          <CircularProgress size={20} />
          <Box>
            <Typography variant="body2" fontWeight={700}>
              Fetching formats…
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Parsing available streams from the source.
            </Typography>
          </Box>
        </Stack>
      </Paper>
    );
  }

  if (!formatsData) return null;

  return (
    <Stack spacing={1.5}>
      <PickerHeaderCard
        title="Format picker"
        subtitle={
          title
            ? title
            : 'Choose the best stream before starting the ingestion job'
        }
        leftIcon={<VideoSettings sx={{ fontSize: 20 }} />}
      >
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <StatChip
            icon={<Videocam sx={{ fontSize: 14 }} />}
            label={`Video ${videoCount}`}
            color={tab === 'video' ? 'primary' : 'default'}
          />
          <StatChip
            icon={<Audiotrack sx={{ fontSize: 14 }} />}
            label={`Audio ${audioCount}`}
            color={tab === 'audio' ? 'primary' : 'default'}
          />
        </Stack>
      </PickerHeaderCard>

      {!audioOnly ? (
        <ToggleButtonGroup
          size="small"
          value={tab}
          exclusive
          onChange={(_, value) => value && setTab(value)}
          sx={{
            alignSelf: 'flex-start',
            '& .MuiToggleButton-root': {
              px: 1.4,
              py: 0.75,
              borderRadius: '999px !important',
              textTransform: 'none',
              fontWeight: 700,
            },
          }}
        >
          <ToggleButton value="video">
            <Videocam sx={{ mr: 0.75, fontSize: 17 }} />
            Video ({videoCount})
          </ToggleButton>
          <ToggleButton value="audio">
            <Audiotrack sx={{ mr: 0.75, fontSize: 17 }} />
            Audio ({audioCount})
          </ToggleButton>
        </ToggleButtonGroup>
      ) : (
        <Alert severity="info" sx={{ borderRadius: 3 }}>
          Audio only mode is enabled — video selection is hidden.
        </Alert>
      )}

      {activeRows.length > 0 ? (
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Chip
            size="small"
            variant="outlined"
            label={`Showing ${tab} formats`}
            sx={{ fontWeight: 700 }}
          />
          {selectedId ? (
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={`Selected: ${selectedId}`}
              sx={{ fontWeight: 700 }}
            />
          ) : (
            <Chip
              size="small"
              variant="outlined"
              label={`No ${tab} format selected`}
              sx={{ fontWeight: 700 }}
            />
          )}
        </Stack>
      ) : null}

      {isSmDown ? (
        <FormatCardList
          rows={activeRows}
          tab={tab}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      ) : (
        <FormatTable
          rows={activeRows}
          tab={tab}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      )}
    </Stack>
  );
}