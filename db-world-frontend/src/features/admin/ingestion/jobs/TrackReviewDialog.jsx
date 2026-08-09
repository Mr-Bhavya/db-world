import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  alpha, Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControlLabel, IconButton, Radio, Stack, Tooltip,
  Typography,
} from '@mui/material';
import {
  Close, GraphicEqRounded as GraphicEq, SaveRounded as Save, SubtitlesRounded as Subtitles,
  TimerRounded as Timer, MovieRounded as Movie,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { notify } from '@shared/notify';

import { getJobTracks, submitJobTracks } from '../services/ingestionApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCountdown(ms) {
  if (ms == null || ms <= 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function channelLabel(ch) {
  switch (Number(ch)) {
    case 1: return '1.0';
    case 2: return '2.0';
    case 6: return '5.1';
    case 8: return '7.1';
    default: return ch ? `${ch}ch` : null;
  }
}

// Group a flat track list into ordered { lang, label, tracks[] } entries (one row per language).
function groupByLang(list) {
  const map = new Map();
  for (const t of list) {
    const key = t.lang || '';
    if (!map.has(key)) map.set(key, { lang: key, label: t.langLabel || 'Undetermined', tracks: [] });
    map.get(key).tracks.push(t);
  }
  return [...map.values()];
}

function trackDetail(t) {
  return [t.codec ? t.codec.toUpperCase() : null, channelLabel(t.channels), t.forced ? 'forced' : null]
    .filter(Boolean)
    .join(' · ');
}

// ── Row ─────────────────────────────────────────────────────────────────────

function LangRow({ group, checked, onToggle, isDefault, onMakeDefault, showDefault }) {
  return (
    <Box
      sx={{
        px: 1, py: 0.85, borderRadius: 2,
        border: (t) => `1px solid ${alpha(t.palette.divider, checked ? 0.9 : 0.5)}`,
        bgcolor: (t) => (checked ? alpha(t.palette.primary.main, 0.05) : 'transparent'),
        transition: 'background-color .15s ease, border-color .15s ease',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <FormControlLabel
          sx={{ flex: 1, minWidth: 0, mr: 0 }}
          control={<Checkbox size="small" checked={checked} onChange={onToggle} />}
          label={
            <Stack minWidth={0}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {group.label}
                {group.tracks.length > 1 ? (
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                    ×{group.tracks.length}
                  </Typography>
                ) : null}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {group.tracks.map(trackDetail).filter(Boolean).join('  •  ') || '—'}
              </Typography>
            </Stack>
          }
        />
        {showDefault && checked ? (
          <Tooltip title="Set as default audio">
            <FormControlLabel
              sx={{ mr: 0 }}
              control={<Radio size="small" checked={isDefault} onChange={onMakeDefault} />}
              label={<Typography variant="caption" color="text.secondary">Default</Typography>}
            />
          </Tooltip>
        ) : null}
      </Stack>
    </Box>
  );
}

// ── Dialog ────────────────────────────────────────────────────────────────────

/**
 * Interactive audio/subtitle picker for a job parked in AWAITING_INPUT. Selection is language-based
 * so it applies to every episode of a season pack. Seeds from the server's smart-default suggestion
 * and shows a live countdown to the auto-default.
 */
export default function TrackReviewDialog({ jobId, open, onClose, onSubmitted }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['ingestion-tracks', jobId],
    queryFn: () => getJobTracks(jobId),
    enabled: !!open && !!jobId,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const options = data?.data ?? null;

  const audioGroups = useMemo(() => groupByLang(options?.audio ?? []), [options]);
  const subGroups = useMemo(() => groupByLang(options?.subtitles ?? []), [options]);

  const [keepAudio, setKeepAudio] = useState(() => new Set());
  const [keepSubs, setKeepSubs] = useState(() => new Set());
  const [defaultAudio, setDefaultAudio] = useState('');
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const seededRef = useRef(false);

  // Seed selections from the smart default once, when options arrive.
  useEffect(() => {
    if (!options || seededRef.current) return;
    const sd = options.smartDefault ?? {};
    setKeepAudio(new Set(sd.keepAudioLanguages ?? (options.audio ?? []).map((t) => t.lang || '')));
    setKeepSubs(new Set(sd.keepSubtitleLanguages ?? (options.subtitles ?? []).map((t) => t.lang || '')));
    setDefaultAudio(
      sd.defaultAudioLanguage
        ?? sd.keepAudioLanguages?.[0]
        ?? (options.audio?.[0]?.lang || '')
    );
    seededRef.current = true;
  }, [options]);

  // Live countdown to the auto-default deadline.
  useEffect(() => {
    if (!open) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  // Keep the default-audio choice valid when languages are unticked.
  useEffect(() => {
    if (defaultAudio && !keepAudio.has(defaultAudio)) {
      setDefaultAudio([...keepAudio][0] ?? '');
    }
  }, [keepAudio, defaultAudio]);

  const remaining = options?.deadlineEpochMs ? options.deadlineEpochMs - now : null;
  const expired = remaining != null && remaining <= 0;
  const noAudio = keepAudio.size === 0;

  const toggle = (setter) => (lang) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(lang)) next.delete(lang);
      else next.add(lang);
      return next;
    });
  const toggleAudio = toggle(setKeepAudio);
  const toggleSub = toggle(setKeepSubs);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const selection = {
        keepAudioLanguages: [...keepAudio],
        keepSubtitleLanguages: [...keepSubs],
        defaultAudioLanguage: defaultAudio || null,
        removeAllSubtitles: keepSubs.size === 0,
        noDefaultSubtitle: true,
      };
      const res = await submitJobTracks(jobId, selection);
      if (res?.httpStatusCode >= 400) {
        notify.warning(res?.message || 'Could not apply selection');
      } else {
        notify.success('Tracks selected — processing will continue');
        onSubmitted?.();
        onClose?.();
      }
    } catch (e) {
      notify.error(e?.response?.data?.message ?? 'Failed to submit selection');
    } finally {
      setSaving(false);
    }
  };

  const labelSx = {
    fontSize: 12, fontWeight: 700, color: 'text.secondary',
    textTransform: 'uppercase', letterSpacing: 0.5,
  };

  return (
    <Dialog open={!!open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box sx={{
            width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center',
            bgcolor: (t) => alpha(t.palette.primary.main, 0.1), color: 'primary.main', flexShrink: 0,
          }}>
            <Subtitles fontSize="small" />
          </Box>
          <Box minWidth={0} flex={1}>
            <Typography variant="subtitle1" fontWeight={800} lineHeight={1.15}>Select tracks</Typography>
            <Typography variant="caption" color="text.secondary">
              Choose which audio &amp; subtitle languages to keep — applied in one pass.
            </Typography>
          </Box>
          {remaining != null ? (
            <Chip
              size="small"
              icon={<Timer sx={{ fontSize: '15px !important' }} />}
              color={expired ? 'default' : remaining < 60_000 ? 'warning' : 'primary'}
              variant="outlined"
              label={expired ? 'Applying…' : fmtCountdown(remaining)}
              sx={{ fontWeight: 700, flexShrink: 0 }}
            />
          ) : null}
        </Stack>
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', top: 12, right: 12 }}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {isLoading ? (
          <Stack alignItems="center" sx={{ py: 4 }} spacing={1.5}>
            <CircularProgress size={26} />
            <Typography variant="body2" color="text.secondary">Detecting tracks…</Typography>
          </Stack>
        ) : isError || !options ? (
          <Alert severity="warning" sx={{ borderRadius: 2.5 }}>
            This job is no longer awaiting a track selection — it may have resumed, timed out, or been
            cancelled.
          </Alert>
        ) : (
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {options.video ? (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
                <Movie sx={{ fontSize: 18 }} />
                <Typography variant="caption" fontWeight={600}>
                  {[
                    options.video.codec ? options.video.codec.toUpperCase() : null,
                    options.video.height ? `${options.video.height}p` : null,
                    options.video.bitDepth ? `${options.video.bitDepth}-bit` : null,
                    options.video.dolbyVision ? 'Dolby Vision' : null,
                  ].filter(Boolean).join('  •  ') || 'Video'}
                </Typography>
              </Stack>
            ) : null}

            {expired ? (
              <Alert severity="info" sx={{ borderRadius: 2.5 }}>
                Time&apos;s up — the smart default is being applied. You can close this.
              </Alert>
            ) : null}

            {/* Audio */}
            <Stack spacing={1}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <GraphicEq sx={{ fontSize: 15, color: 'text.secondary' }} />
                <Typography sx={labelSx}>Audio</Typography>
              </Stack>
              {audioGroups.length === 0 ? (
                <Typography variant="caption" color="text.secondary">No audio tracks detected.</Typography>
              ) : (
                audioGroups.map((g) => (
                  <LangRow
                    key={`a-${g.lang}`}
                    group={g}
                    checked={keepAudio.has(g.lang)}
                    onToggle={() => toggleAudio(g.lang)}
                    showDefault
                    isDefault={defaultAudio === g.lang}
                    onMakeDefault={() => setDefaultAudio(g.lang)}
                  />
                ))
              )}
              {noAudio ? (
                <Typography variant="caption" color="error">Keep at least one audio track.</Typography>
              ) : null}
            </Stack>

            <Divider />

            {/* Subtitles */}
            <Stack spacing={1}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Subtitles sx={{ fontSize: 15, color: 'text.secondary' }} />
                <Typography sx={labelSx}>Subtitles</Typography>
                {keepSubs.size === 0 && subGroups.length > 0 ? (
                  <Chip size="small" label="All removed" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                ) : null}
              </Stack>
              {subGroups.length === 0 ? (
                <Typography variant="caption" color="text.secondary">No subtitle tracks detected.</Typography>
              ) : (
                subGroups.map((g) => (
                  <LangRow
                    key={`s-${g.lang}`}
                    group={g}
                    checked={keepSubs.has(g.lang)}
                    onToggle={() => toggleSub(g.lang)}
                  />
                ))
              )}
            </Stack>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose} disabled={saving} sx={{ borderRadius: 999 }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving || isLoading || isError || !options || noAudio || expired}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          sx={{ borderRadius: 999, fontWeight: 700 }}
        >
          Apply &amp; continue
        </Button>
      </DialogActions>
    </Dialog>
  );
}
