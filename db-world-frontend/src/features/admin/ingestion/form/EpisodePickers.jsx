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
      renderOption={(props, o) => {
        const { key, ...rest } = props;
        return (
          <Box component="li" key={key} {...rest} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 800, fontSize: '0.78rem', minWidth: 34 }}>{o.label}</Typography>
            <Typography sx={{
              flex: 1, fontSize: '0.82rem',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {o.name}
            </Typography>
            {o.air && <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{o.air}</Typography>}
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
