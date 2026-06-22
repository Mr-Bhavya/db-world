import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  alpha,
  Box,
  ButtonBase,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Audiotrack,
  CheckCircleRounded,
  GraphicEq,
  Hd,
  Hearing,
  HighQuality,
  InfoOutlined,
  Language,
  PlayCircleOutline,
  Storage,
  VideoSettings,
  Videocam,
} from '@mui/icons-material';
import { useT } from '@shared/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Generic helpers (provider-agnostic: YouTube, JioHotstar, Zee5, MX Player, etc.)
// ─────────────────────────────────────────────────────────────────────────────

function isNil(value) {
  return value === null || value === undefined || value === '';
}

function safeText(value, fallback = '—') {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

function fmtBitrate(kbps) {
  if (!kbps || !Number.isFinite(Number(kbps))) return '—';
  const value = Number(kbps);
  return value >= 1000 ? `${(value / 1000).toFixed(1)} Mbps` : `${Math.round(value)} kbps`;
}

function fmtSize(bytes) {
  if (!bytes || !Number.isFinite(Number(bytes))) return '—';
  const value = Number(bytes);
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

function fmtDuration(seconds) {
  if (!seconds || !Number.isFinite(Number(seconds))) return '—';
  const total = Math.round(Number(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getVideoResolution(fmt) {
  if (fmt?.resolution && fmt.resolution !== 'audio only') return fmt.resolution.replace(/×/g, 'x');
  if (fmt?.width && fmt?.height) return `${fmt.width}x${fmt.height}`;
  if (fmt?.height) return `${fmt.height}p`;
  return '—';
}

function normalizeCodec(value) {
  const raw = safeText(value, '—');
  if (raw === '—') return raw;
  const lower = raw.toLowerCase();

  if (lower.includes('av01')) return 'AV1';
  if (lower.includes('vp09') || lower === 'vp9') return 'VP9';
  if (lower.includes('hvc1') || lower.includes('hev1') || lower.includes('hevc')) return 'H.265 / HEVC';
  if (lower.includes('avc1') || lower.includes('h264')) return 'H.264 / AVC';
  if (lower.includes('mp4a')) return 'AAC';
  if (lower.includes('opus')) return 'Opus';
  if (lower.includes('ec-3') || lower.includes('eac3')) return 'E-AC-3 / Dolby';
  if (lower.includes('ac-3') || lower.includes('ac3')) return 'AC-3 / Dolby';
  return raw;
}

function getAudioCodec(fmt) {
  return normalizeCodec(fmt?.acodec || fmt?.ext);
}

function getVideoCodec(fmt) {
  return normalizeCodec(fmt?.vcodec || fmt?.ext);
}

function getFormatBitrate(tab, fmt) {
  const value = tab === 'video' ? (fmt?.vbr || fmt?.tbr || 0) : (fmt?.abr || fmt?.tbr || 0);
  return fmtBitrate(value);
}

function getFormatSize(fmt) {
  return fmtSize(fmt?.filesize || fmt?.filesizeApprox);
}

function getFormatExt(fmt) {
  return safeText(fmt?.ext || fmt?.container, '—').toUpperCase();
}

function getFormatProtocol(fmt) {
  return safeText(fmt?.protocol, '—');
}

function getFormatDynamicRange(fmt) {
  return safeText(fmt?.dynamicRange || fmt?.dynamic_range || fmt?.hdr, '—');
}

function getFormatFps(fmt) {
  if (!fmt?.fps || !Number.isFinite(Number(fmt.fps))) return '—';
  return `${Number(fmt.fps)} fps`;
}

function getFormatNote(fmt) {
  return safeText(fmt?.formatNote || fmt?.format || fmt?.note, '—');
}

const LANGUAGE_PATTERNS = [
  { label: 'Hindi', patterns: ['हिन्दी', ' hindi', '_hi_', '-hi_', ' hi ', ' hin', 'hin_'] },
  { label: 'English', patterns: [' english', '_en_', '-en_', ' en ', 'eng', ' english'] },
  { label: 'Tamil', patterns: [' tamil', '_ta_', '-ta_', ' ta ', 'tam'] },
  { label: 'Telugu', patterns: [' telugu', '_te_', '-te_', ' te ', 'tel'] },
  { label: 'Malayalam', patterns: [' malayalam', '_ml_', '-ml_', ' ml ', 'mal'] },
  { label: 'Kannada', patterns: [' kannada', '_kn_', '-kn_', ' kn ', 'kan'] },
  { label: 'Marathi', patterns: [' marathi', '_mr_', '-mr_', ' mr ', 'mar'] },
  { label: 'Bengali', patterns: [' bengali', '_bn_', '-bn_', ' bn ', 'ben'] },
  { label: 'Gujarati', patterns: [' gujarati', '_gu_', '-gu_', ' gu ', 'guj'] },
  { label: 'Punjabi', patterns: [' punjabi', '_pa_', '-pa_', ' pa ', 'pan'] },
  { label: 'Spanish', patterns: [' spanish', '_es_', '-es_', ' es ', 'spa'] },
  { label: 'French', patterns: [' french', '_fr_', '-fr_', ' fr ', 'fre', 'fra'] },
];

function parseLanguageFromFormat(fmt) {
  const explicitLanguage = safeText(fmt?.language || fmt?.audioLanguage || fmt?.lang || '', '');
  if (explicitLanguage) return explicitLanguage;

  const source = [fmt?.formatNote, fmt?.formatId, fmt?.format].filter(Boolean).join(' | ').toLowerCase();
  for (const item of LANGUAGE_PATTERNS) {
    if (item.patterns.some((pattern) => source.includes(pattern))) {
      return item.label;
    }
  }
  return '—';
}

function parseAudioProfile(fmt) {
  const joined = `${safeText(fmt?.formatNote, '')} ${safeText(fmt?.formatId, '')}`.toLowerCase();

  if (joined.includes('audio description')) return 'Audio Description';
  if (joined.includes('dolby51') || joined.includes('5.1')) return 'Dolby 5.1';
  if (joined.includes('stereo')) return 'Stereo';
  if (joined.includes('mono')) return 'Mono';
  if (joined.includes('medium')) return 'Medium';
  if (joined.includes('high')) return 'High';
  if (joined.includes('low')) return 'Low';

  return '—';
}

function parseStreamType(fmt) {
  const explicitType = safeText(fmt?.type, '').toLowerCase();
  if (explicitType === 'combined') return 'Combined';
  if (explicitType === 'video') return 'Video only';
  if (explicitType === 'audio') return 'Audio only';

  const joined = `${safeText(fmt?.formatNote, '')} ${safeText(fmt?.format, '')}`.toLowerCase();
  if (joined.includes('dash')) return 'DASH';
  if (joined.includes('audio')) return 'Audio only';
  if (joined.includes('video')) return 'Video only';

  return 'Standard';
}

function getQualityBadgeLabel(fmt, tab) {
  if (tab === 'video') {
    const h = Number(fmt?.height || 0);
    if (h >= 2160) return '4K';
    if (h >= 1440) return '1440p';
    if (h >= 1080) return '1080p';
    if (h >= 720) return '720p';
    if (h >= 480) return '480p';
    if (h >= 360) return '360p';
    if (h >= 240) return '240p';
    if (h > 0) return `${h}p`;
    return 'Video';
  }

  const abr = Number(fmt?.abr || fmt?.tbr || 0);
  if (abr >= 192) return 'High';
  if (abr >= 120) return 'Medium';
  if (abr > 0) return 'Low';
  return 'Audio';
}

function buildFormatMeta(tab, fmt) {
  const typeLabel = parseStreamType(fmt);
  return {
    id: safeText(fmt?.formatId, '—'),
    resolution: getVideoResolution(fmt),
    videoCodec: getVideoCodec(fmt),
    audioCodec: getAudioCodec(fmt),
    bitrate: getFormatBitrate(tab, fmt),
    size: getFormatSize(fmt),
    ext: getFormatExt(fmt),
    protocol: getFormatProtocol(fmt),
    dynamicRange: getFormatDynamicRange(fmt),
    fps: getFormatFps(fmt),
    note: getFormatNote(fmt),
    language: parseLanguageFromFormat(fmt),
    audioProfile: parseAudioProfile(fmt),
    streamType: typeLabel,
    streamLabel: typeLabel,
    isCombined: typeLabel === 'Combined',
    qualityLabel: getQualityBadgeLabel(fmt, tab),
    tbr: Number(fmt?.tbr || 0),
    abr: Number(fmt?.abr || 0),
    vbr: Number(fmt?.vbr || 0),
    height: Number(fmt?.height || 0),
  };
}

function normalizeVideoRows(rows = []) {
  return [...rows].sort((a, b) => {
    const aType = parseStreamType(a);
    const bType = parseStreamType(b);

    const rank = { 'Video only': 0, Combined: 1, DASH: 2, Standard: 3 };
    const typeDelta = (rank[aType] ?? 9) - (rank[bType] ?? 9);
    if (typeDelta !== 0) return typeDelta;

    const ah = Number(a?.height || 0);
    const bh = Number(b?.height || 0);
    if (bh !== ah) return bh - ah;

    const av = Number(a?.vbr || a?.tbr || 0);
    const bv = Number(b?.vbr || b?.tbr || 0);
    return bv - av;
  });
}

function normalizeAudioRows(rows = []) {
  return [...rows].sort((a, b) => {
    const langA = parseLanguageFromFormat(a);
    const langB = parseLanguageFromFormat(b);
    if (langA !== langB) return langA.localeCompare(langB);

    const profA = parseAudioProfile(a);
    const profB = parseAudioProfile(b);
    if (profA !== profB) return profA.localeCompare(profB);

    const abrA = Number(a?.abr || a?.tbr || 0);
    const abrB = Number(b?.abr || b?.tbr || 0);
    return abrB - abrA;
  });
}

function findById(rows = [], id) {
  return rows.find((row) => safeText(row?.formatId, '') === safeText(id, '')) || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Small UI bits
// ─────────────────────────────────────────────────────────────────────────────

function StatChip({ icon, label, color = 'default', sx = {} }) {
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
        ...sx,
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
        flexShrink: 0,
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
      <Stack spacing={1.25}>
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
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', wordBreak: 'break-word' }}
                >
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

function FullIdBox({ value }) {
  const theme = useTheme();

  return (
    <Tooltip title={safeText(value)} arrow placement="top">
      <Box
        sx={{
          px: 1,
          py: 0.75,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.action.active, 0.04),
          border: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontWeight: 700,
            lineHeight: 1.35,
            display: 'block',
            wordBreak: 'break-word',
            whiteSpace: 'normal',
          }}
        >
          {safeText(value)}
        </Typography>
      </Box>
    </Tooltip>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile cards
// ─────────────────────────────────────────────────────────────────────────────

const FormatCardList = memo(function FormatCardList({ rows, tab, selectedId, onSelect }) {
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
        const selected = safeText(fmt?.formatId, '') === safeText(selectedId, '');
        const meta = buildFormatMeta(tab, fmt);

        return (
          <ButtonBase
            key={meta.id}
            onClick={() => onSelect(meta.id, fmt)}
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
                borderColor: selected ? alpha(theme.palette.primary.main, 0.38) : alpha(theme.palette.divider, 0.8),
                bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : 'background.paper',
                transition: 'all 0.18s ease',
              }}
            >
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <SelectedDot selected={selected} />

                  <Stack spacing={0.9} sx={{ flex: 1, minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Typography variant="body2" fontWeight={800}>
                        {tab === 'video' ? meta.resolution : `Audio • ${meta.language !== '—' ? meta.language : meta.audioCodec}`}
                      </Typography>

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

                    <FullIdBox value={meta.id} />

                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                      <StatChip icon={tab === 'video' ? <Hd sx={{ fontSize: 14 }} /> : <GraphicEq sx={{ fontSize: 14 }} />} label={meta.qualityLabel} />
                      {tab === 'video' ? (
                        <>
                          <StatChip icon={<Videocam sx={{ fontSize: 14 }} />} label={meta.videoCodec} />
                          {meta.dynamicRange !== '—' ? <StatChip icon={<HighQuality sx={{ fontSize: 14 }} />} label={meta.dynamicRange} /> : null}
                          {meta.fps !== '—' ? <StatChip icon={<PlayCircleOutline sx={{ fontSize: 14 }} />} label={meta.fps} /> : null}
                        </>
                      ) : (
                        <>
                          <StatChip icon={<GraphicEq sx={{ fontSize: 14 }} />} label={meta.audioCodec} />
                          {meta.language !== '—' ? <StatChip icon={<Language sx={{ fontSize: 14 }} />} label={meta.language} /> : null}
                          {meta.audioProfile !== '—' ? (
                            <StatChip
                              icon={meta.audioProfile === 'Audio Description' ? <Hearing sx={{ fontSize: 14 }} /> : <Audiotrack sx={{ fontSize: 14 }} />}
                              label={meta.audioProfile}
                            />
                          ) : null}
                        </>
                      )}

                      <StatChip icon={<InfoOutlined sx={{ fontSize: 14 }} />} label={meta.streamLabel} />
                      <StatChip icon={<PlayCircleOutline sx={{ fontSize: 14 }} />} label={meta.bitrate} />
                      {meta.ext !== '—' ? <StatChip icon={<Storage sx={{ fontSize: 14 }} />} label={meta.ext} /> : null}
                    </Stack>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: 0.75,
                      }}
                    >
                      <Paper variant="outlined" sx={{ p: 0.8, borderRadius: 2, bgcolor: 'background.default' }}>
                        <Typography variant="caption" color="text.secondary">
                          Note
                        </Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
                          {meta.note}
                        </Typography>
                      </Paper>

                      <Paper variant="outlined" sx={{ p: 0.8, borderRadius: 2, bgcolor: 'background.default' }}>
                        <Typography variant="caption" color="text.secondary">
                          Size / Protocol
                        </Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
                          {meta.size} / {meta.protocol}
                        </Typography>
                      </Paper>
                    </Box>
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
// Desktop table
// ─────────────────────────────────────────────────────────────────────────────

const FormatTable = memo(function FormatTable({ rows, tab, selectedId, onSelect }) {
  const T = useT();

  if (!rows.length) {
    return (
      <Alert severity="info" sx={{ borderRadius: 3 }}>
        No {tab} formats found.
      </Alert>
    );
  }

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <Box sx={{ maxHeight: 460, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" sx={{ bgcolor: 'background.paper' }} />
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700, minWidth: 260 }}>
                Full ID
              </TableCell>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700 }}>
                Main Info
              </TableCell>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700 }}>
                Codec
              </TableCell>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700 }}>
                Bitrate / Size
              </TableCell>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700 }}>
                Stream
              </TableCell>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700, minWidth: 220 }}>
                Note
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((fmt) => {
              const selected = safeText(fmt?.formatId, '') === safeText(selectedId, '');
              const meta = buildFormatMeta(tab, fmt);

              return (
                <TableRow
                  key={meta.id}
                  hover
                  selected={selected}
                  onClick={() => onSelect(meta.id, fmt)}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: selected ? alpha(T.teal, 0.08) : undefined,
                    '& .MuiTableCell-root': {
                      py: 1.1,
                      verticalAlign: 'top',
                    },
                  }}
                >
                  <TableCell padding="checkbox">
                    <Box sx={{ display: 'grid', placeItems: 'center' }}>
                      <SelectedDot selected={selected} />
                    </Box>
                  </TableCell>

                  <TableCell>
                    <FullIdBox value={meta.id} />
                  </TableCell>

                  <TableCell>
                    {tab === 'video' ? (
                      <Stack spacing={0.35}>
                        <Typography variant="body2" fontWeight={700}>
                          {meta.resolution}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {meta.qualityLabel} • {meta.dynamicRange !== '—' ? `${meta.dynamicRange} • ` : ''}{meta.fps !== '—' ? meta.fps : '—'}
                        </Typography>
                      </Stack>
                    ) : (
                      <Stack spacing={0.35}>
                        <Typography variant="body2" fontWeight={700}>
                          {meta.language !== '—' ? meta.language : meta.audioCodec}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {meta.audioProfile !== '—' ? meta.audioProfile : meta.qualityLabel}
                        </Typography>
                      </Stack>
                    )}
                  </TableCell>

                  <TableCell>
                    <Stack spacing={0.35}>
                      <Typography variant="body2">
                        {tab === 'video' ? meta.videoCodec : meta.audioCodec}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {meta.ext}
                      </Typography>
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Stack spacing={0.35}>
                      <Typography variant="body2">{meta.bitrate}</Typography>
                      <Typography variant="caption" color="text.secondary">{meta.size}</Typography>
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Stack spacing={0.35}>
                      <Typography variant="body2">{meta.streamLabel}</Typography>
                      <Typography variant="caption" color="text.secondary">{meta.protocol}</Typography>
                    </Stack>
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
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        lineHeight: 1.35,
                      }}
                    >
                      {meta.note}
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
 * Provider-agnostic format picker for adaptive and combined streams.
 * Supports payloads from YouTube, JioHotstar, MX Player, Zee5, etc.
 *
 * Props:
 *   formatsData    — API response or payload.data
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

  useEffect(() => {
    if (audioOnly) {
      setTab('audio');
    } else if (tab !== 'video' && tab !== 'audio') {
      setTab('video');
    }
  }, [audioOnly, tab]);

  const payload = useMemo(() => {
    if (!formatsData) return null;
    return formatsData?.data ?? formatsData;
  }, [formatsData]);

  const { videoFormats = [], audioFormats = [], title, uploader, duration } = payload || {};

  const normalizedVideoRows = useMemo(() => normalizeVideoRows(videoFormats), [videoFormats]);
  const normalizedAudioRows = useMemo(() => normalizeAudioRows(audioFormats), [audioFormats]);

  const activeRows = useMemo(
    () => (tab === 'video' ? normalizedVideoRows : normalizedAudioRows),
    [tab, normalizedVideoRows, normalizedAudioRows]
  );

  const selectedVideoRow = useMemo(() => findById(normalizedVideoRows, selectedVideo), [normalizedVideoRows, selectedVideo]);
  const selectedAudioRow = useMemo(() => findById(normalizedAudioRows, selectedAudio), [normalizedAudioRows, selectedAudio]);
  const selectedVideoMeta = useMemo(() => (selectedVideoRow ? buildFormatMeta('video', selectedVideoRow) : null), [selectedVideoRow]);
  const selectedAudioMeta = useMemo(() => (selectedAudioRow ? buildFormatMeta('audio', selectedAudioRow) : null), [selectedAudioRow]);
  const selectedActiveMeta = tab === 'video' ? selectedVideoMeta : selectedAudioMeta;

  const selectedVideoIsCombined = !!selectedVideoMeta?.isCombined;

  const handleSelect = useCallback(
    (id, fmt) => {
      if (tab === 'video') {
        onSelectVideo?.(id);
        const meta = buildFormatMeta('video', fmt || {});
        if (meta.isCombined) {
          onSelectAudio?.(null);
        }
      } else {
        onSelectAudio?.(id);
      }
    },
    [tab, onSelectVideo, onSelectAudio]
  );

  const videoCount = normalizedVideoRows.length;
  const audioCount = normalizedAudioRows.length;

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ borderRadius: 3, p: 2 }}>
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

  if (!payload) return null;

  return (
    <Stack spacing={1.5}>
      <PickerHeaderCard
        title="Format picker"
        subtitle={
          title
            ? uploader
              ? `${title} • ${uploader}`
              : title
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
          {!isNil(duration) ? (
            <StatChip icon={<PlayCircleOutline sx={{ fontSize: 14 }} />} label={fmtDuration(duration)} />
          ) : null}
        </Stack>
      </PickerHeaderCard>

      {selectedVideoIsCombined && !audioOnly ? (
        <Alert severity="info" sx={{ borderRadius: 3 }}>
          The selected video stream already contains audio. Separate audio selection is optional and will be cleared when you choose a combined stream.
        </Alert>
      ) : null}

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
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 3,
            p: 1.25,
            bgcolor: alpha(theme.palette.primary.main, 0.02),
          }}
        >
          <Stack spacing={1}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              justifyContent="space-between"
            >
              <Stack direction="row" flexWrap="wrap" gap={1}>
                <Chip size="small" variant="outlined" label={`Showing ${tab} formats`} sx={{ fontWeight: 700 }} />
                <Chip size="small" variant="outlined" label={`${activeRows.length} rows`} sx={{ fontWeight: 700 }} />
                {selectedActiveMeta ? (
                  <Chip size="small" color="primary" variant="outlined" label={`Selected ${selectedActiveMeta.qualityLabel}`} sx={{ fontWeight: 700 }} />
                ) : (
                  <Chip size="small" variant="outlined" label={`No ${tab} format selected`} sx={{ fontWeight: 700 }} />
                )}
              </Stack>
            </Stack>

            {selectedActiveMeta ? (
              <Stack spacing={0.75}>
                <Typography variant="caption" color="text.secondary">
                  Selected full ID
                </Typography>
                <FullIdBox value={selectedActiveMeta.id} />
              </Stack>
            ) : null}

            <Divider />

            <Typography variant="caption" color="text.secondary">
              Full format ID is always shown because some providers include language, codec, or stream details directly inside the ID.
            </Typography>
          </Stack>
        </Paper>
      ) : null}

      {isSmDown ? (
        <FormatCardList rows={activeRows} tab={tab} selectedId={tab === 'video' ? selectedVideo : selectedAudio} onSelect={handleSelect} />
      ) : (
        <FormatTable rows={activeRows} tab={tab} selectedId={tab === 'video' ? selectedVideo : selectedAudio} onSelect={handleSelect} />
      )}
    </Stack>
  );
}
