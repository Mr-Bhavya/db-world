import React, { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Box, Chip, TextField, Typography } from '@mui/material';
import { getRecordDetail } from '../services/ingestionApi';

/* ═══════════════════════════════════════════════════════════
   SEASON / EPISODE PICKERS

   Free-number entry meant knowing the episode number by heart
   and typing it correctly, with nothing to catch a mistake.
   These offer TMDB's actual seasons and episodes instead.

   Both are `freeSolo` on purpose: TMDB lags real broadcasts,
   and a just-aired episode — or a whole season — often isn't
   listed yet. Anything typed is accepted exactly as before, so
   the picker only ever adds a shortcut, never a restriction.
═══════════════════════════════════════════════════════════ */

/**
 * Lets the dropdown be wider than the input it hangs off.
 *
 * MUI sizes an Autocomplete's popper to its anchor, and these anchors are narrow
 * numeric fields sitting two-to-a-row, so anything past a short episode title was
 * clipped to an ellipsis with no way to read it. The anchor stays narrow — it only
 * ever holds a number — while the list gets the room the titles actually need.
 *
 * `!important` is not decoration here: MUI writes the anchor width as an INLINE
 * style, and a stylesheet declaration only beats an inline one when it carries it.
 */
const WIDE_POPPER = {
  popper: {
    placement: 'bottom-start',
    // Only releases the width MUI pins to the anchor. `!important` is not decoration:
    // MUI writes that width as an INLINE style, and a stylesheet declaration beats an
    // inline one only when it carries it.
    sx: { width: 'auto !important' },
  },
  // The size limit belongs on the PAPER, not the popper. Bounding the popper alone
  // did nothing — the paper shrink-wraps its content and simply grew past it, which
  // is how an episode list ended up ~830px wide and lying across the Source URL
  // field and the Start Job button.
  paper: {
    sx: {
      minWidth: { xs: 'min(92vw, 300px)', sm: 360 },
      maxWidth: { xs: '92vw', sm: 460 },
    },
  },
  // Bounded height too, so a 24-episode season does not run off the bottom of the
  // page on a laptop.
  listbox: {
    sx: { maxHeight: { xs: '42vh', sm: 300 } },
  },
};

/** Read `n` back out of whatever the Autocomplete hands us (option or string). */
function toNumber(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'object' ? v.value : Number(String(v).trim());
  return Number.isFinite(n) && Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * Loads the full record (seasons + episodes) once a TV record is picked.
 * Returns `[]` for movies, no record, or a failed fetch — every caller then
 * degrades to plain numeric entry.
 */
export function useTmdbSeasons(record) {
  const [seasons, setSeasons] = useState([]);

  const recordId = record?.id ?? null;
  const isTv = !!record && record.type !== 'MOVIE';

  useEffect(() => {
    if (!recordId || !isTv) { setSeasons([]); return undefined; }
    let cancelled = false;
    getRecordDetail(recordId)
      .then((full) => { if (!cancelled) setSeasons(full?.tmdb?.seasons ?? []); })
      // A picker that fails to load is an inconvenience, not an error worth
      // interrupting the admin over — the text field still works.
      .catch(() => { if (!cancelled) setSeasons([]); });
    return () => { cancelled = true; };
  }, [recordId, isTv]);

  return seasons;
}

export function SeasonPicker({ seasons, value, onChange, error, helperText, size = 'small', sx }) {
  const options = useMemo(
    () => [...(seasons ?? [])]
      .map((s) => ({
        value: Number(s.seasonNumber),
        label: Number(s.seasonNumber) === 0 ? 'Specials' : `Season ${s.seasonNumber}`,
        count: s.episodes?.length ?? s.episodeCount ?? 0,
        year: s.airDate ? String(s.airDate).slice(0, 4) : null,
      }))
      .sort((a, b) => a.value - b.value),
    [seasons],
  );

  const current = options.find((o) => o.value === value) ?? (value != null ? String(value) : null);

  return (
    <Autocomplete
      freeSolo
      size={size}
      options={options}
      value={current}
      onChange={(_, v) => onChange(toNumber(v))}
      onInputChange={(_, text, reason) => { if (reason === 'input') onChange(toNumber(text)); }}
      getOptionLabel={(o) => (typeof o === 'object' ? o.label : String(o ?? ''))}
      isOptionEqualToValue={(o, v) => o.value === (typeof v === 'object' ? v.value : Number(v))}
      slotProps={WIDE_POPPER}
      renderOption={(props, o) => {
        const { key, ...rest } = props;
        return (
          <Box component="li" key={key} {...rest} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography sx={{ flex: 1, fontWeight: 600, fontSize: '0.85rem' }}>{o.label}</Typography>
            {o.year && <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{o.year}</Typography>}
            <Chip size="small" label={`${o.count} ep`} sx={{ height: 19, fontSize: '0.62rem' }} />
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Season"
          placeholder="e.g. 1"
          error={error}
          helperText={helperText}
          inputProps={{ ...params.inputProps, inputMode: 'numeric' }}
        />
      )}
      sx={sx}
    />
  );
}

export function EpisodePicker({
  seasons, seasonNumber, value, onChange, error, helperText,
  size = 'small', label = 'Episode', sx,
}) {
  const options = useMemo(() => {
    const s = (seasons ?? []).find((x) => Number(x.seasonNumber) === Number(seasonNumber));
    return [...(s?.episodes ?? [])]
      .map((e) => ({
        value: Number(e.episodeNumber),
        label: `E${String(e.episodeNumber).padStart(2, '0')}`,
        name: e.name ?? '',
        air: e.airDate ? String(e.airDate).slice(0, 10) : null,
        // All three were already on EpisodeDto and simply never read. Runtime is
        // the one that settles "is this the 22-minute recap or the real episode?"
        // when two files look alike.
        runtime: e.runtime > 0 ? e.runtime : null,
        rating: e.voteAverage > 0 ? Number(e.voteAverage).toFixed(1) : null,
        overview: e.overview ?? '',
      }))
      // TMDB's episode array has no guaranteed order (no @OrderBy on the
      // backing query), so sort rather than trusting arrival order.
      .sort((a, b) => a.value - b.value);
  }, [seasons, seasonNumber]);

  const current = options.find((o) => o.value === value) ?? (value != null ? String(value) : null);

  return (
    <Autocomplete
      freeSolo
      size={size}
      options={options}
      value={current}
      onChange={(_, v) => onChange(toNumber(v))}
      onInputChange={(_, text, reason) => { if (reason === 'input') onChange(toNumber(text)); }}
      getOptionLabel={(o) => (typeof o === 'object' ? o.label : String(o ?? ''))}
      isOptionEqualToValue={(o, v) => o.value === (typeof v === 'object' ? v.value : Number(v))}
      slotProps={WIDE_POPPER}
      renderOption={(props, o) => {
        const { key, ...rest } = props;
        return (
          <Box
            component="li"
            key={key}
            {...rest}
            // The overview lives here rather than on two more lines of every row. It
            // is worth having, but not at the cost of a list tall enough to bury the
            // rest of the form underneath it.
            title={o.overview || undefined}
            // Column, not row: MUI's option is display:flex, and fighting that with
            // `display: block` is how you end up with a rule that silently loses.
            sx={{ display: 'flex !important', flexDirection: 'column', alignItems: 'stretch', gap: 0.1, py: 0.7 }}
          >
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', width: '100%' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.78rem', minWidth: 34, flexShrink: 0 }}>
                {o.label}
              </Typography>
              {/* Wraps to two lines rather than truncating at one: a title you cannot
                  read is the whole reason this picker was unhelpful. */}
              <Typography sx={{
                flex: 1, minWidth: 0, fontSize: '0.84rem', fontWeight: 600, lineHeight: 1.35,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {o.name || 'Untitled'}
              </Typography>
              <Box sx={{
                display: 'flex', gap: 0.75, flexShrink: 0,
                justifyContent: 'flex-end', minWidth: 62,
              }}>
                {o.runtime && (
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
                    {o.runtime}m
                  </Typography>
                )}
                {o.rating && (
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
                    ★ {o.rating}
                  </Typography>
                )}
              </Box>
            </Box>

            {o.air && (
              <Typography sx={{
                fontSize: '0.67rem', color: 'text.secondary',
                pl: { xs: 0, sm: '42px' },
              }}>
                {o.air}
              </Typography>
            )}
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder="e.g. 1"
          error={error}
          helperText={helperText}
          inputProps={{ ...params.inputProps, inputMode: 'numeric' }}
        />
      )}
      sx={sx}
    />
  );
}
