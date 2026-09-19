import React, { useMemo, useState } from 'react';
import {
  Badge, Box, Button, Checkbox, Chip, Divider, Drawer, IconButton, InputAdornment,
  Stack, TextField, Typography,
} from '@mui/material';
import {
  CloseRounded, FilterListRounded, SearchRounded,
} from '@mui/icons-material';

import { useT } from '@shared/theme';

/**
 * The filter dimensions, in the order they appear in the panel.
 *
 * <p>`key` is the property on a channel; `many` marks the ones that are arrays, so one
 * channel can match several values (a channel has several languages, but one country).
 */
export const FILTER_DIMENSIONS = [
  { id: 'countryName', label: 'Country',  many: false },
  { id: 'brand',       label: 'Network',  many: false },
  { id: 'qualities',   label: 'Quality',  many: true  },
  { id: 'languages',   label: 'Language', many: true  },
];

export const EMPTY_FILTERS = Object.fromEntries(FILTER_DIMENSIONS.map((d) => [d.id, []]));

/** How many values a channel must share a dimension with before it is worth listing. */
const MIN_FACET_SIZE = { countryName: 1, brand: 2, qualities: 1, languages: 1 };

/** Does this channel satisfy every active dimension? Within a dimension, ANY value matches. */
export function matchesFilters(channel, filters) {
  return FILTER_DIMENSIONS.every(({ id, many }) => {
    const chosen = filters[id];
    if (!chosen?.length) return true;
    const value = channel[id];
    return many
      ? (value || []).some((v) => chosen.includes(v))
      : chosen.includes(value);
  });
}

export const activeFilterCount = (filters) =>
  FILTER_DIMENSIONS.reduce((n, { id }) => n + (filters[id]?.length ?? 0), 0);

/**
 * Value counts per dimension, from the channels in hand.
 *
 * <p>Counted over ALL channels rather than the currently-filtered set: a count that
 * changed every time you ticked a box would make it impossible to tell whether a value
 * disappeared because of your filter or because it was never there.
 */
export function buildFacets(channels) {
  const facets = Object.fromEntries(FILTER_DIMENSIONS.map((d) => [d.id, new Map()]));

  channels.forEach((channel) => {
    FILTER_DIMENSIONS.forEach(({ id, many }) => {
      const values = many ? (channel[id] || []) : [channel[id]];
      values.forEach((value) => {
        if (!value) return;
        const counts = facets[id];
        counts.set(value, (counts.get(value) ?? 0) + 1);
      });
    });
  });

  return Object.fromEntries(FILTER_DIMENSIONS.map(({ id }) => [
    id,
    [...facets[id].entries()]
      .filter(([, count]) => count >= (MIN_FACET_SIZE[id] ?? 1))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count })),
  ]));
}

/** The button that opens the panel, badged with how many filters are on. */
export function FilterButton({ count, onClick }) {
  const T = useT();
  return (
    <Badge badgeContent={count} color="primary" overlap="circular"
      sx={{ '& .MuiBadge-badge': { bgcolor: T.teal, color: '#fff', fontWeight: 700 } }}>
      <Button
        onClick={onClick}
        startIcon={<FilterListRounded />}
        sx={{
          textTransform: 'none', fontWeight: 600, borderRadius: 2,
          color: count ? T.teal : T.textMuted,
          border: `1px solid ${count ? T.teal : T.glassBorder}`,
          bgcolor: count ? T.tealBg : T.glass,
          '&:hover': { bgcolor: count ? T.tealBgHover : T.glassHover },
        }}
      >
        Filters
      </Button>
    </Badge>
  );
}

/** The active selections, each removable. Renders nothing when no filter is on. */
export function ActiveFilterChips({ filters, onToggle, onClear }) {
  const T = useT();
  const chips = FILTER_DIMENSIONS.flatMap(({ id, label }) =>
    (filters[id] ?? []).map((value) => ({ id, label, value })));

  if (!chips.length) return null;

  return (
    <Stack direction="row" spacing={1} sx={{ mt: 1.25, flexWrap: 'wrap', gap: 1, rowGap: 1 }}>
      {chips.map(({ id, label, value }) => (
        <Chip
          key={`${id}:${value}`}
          size="small"
          label={`${label}: ${value}`}
          onDelete={() => onToggle(id, value)}
          sx={{
            bgcolor: T.tealBg, color: T.teal, border: `1px solid ${T.teal}`,
            '& .MuiChip-deleteIcon': { color: T.teal },
          }}
        />
      ))}
      <Chip size="small" label="Clear all" onClick={onClear}
        sx={{ bgcolor: T.glass, color: T.textMuted, border: `1px solid ${T.glassBorder}` }} />
    </Stack>
  );
}

/**
 * Side panel holding every filter dimension.
 *
 * <p>A panel rather than more chip rails: four dimensions as rails would fill a phone
 * screen before a single channel appeared, and as dropdowns they make the sticky bar
 * too tall. Behind a button, the selections stay visible as chips instead.
 */
export function FiltersDrawer({ open, onClose, facets, filters, onToggle, onClear, resultCount }) {
  const T = useT();
  const count = activeFilterCount(filters);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 380 }, bgcolor: T.bg, backgroundImage: 'none' } } }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between"
        sx={{ p: 2, borderBottom: `1px solid ${T.border}` }}>
        <Typography sx={{ fontWeight: 800, fontSize: 17, color: T.text }}>Filters</Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          {count > 0 && (
            <Button size="small" onClick={onClear} sx={{ textTransform: 'none', color: T.textMuted }}>
              Clear all
            </Button>
          )}
          <IconButton onClick={onClose} sx={{ color: T.textMuted }} aria-label="Close filters">
            <CloseRounded />
          </IconButton>
        </Stack>
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pb: 2 }}>
        {FILTER_DIMENSIONS.map(({ id, label }) => (
          <FacetSection
            key={id}
            label={label}
            values={facets[id] ?? []}
            chosen={filters[id] ?? []}
            onToggle={(value) => onToggle(id, value)}
          />
        ))}
      </Box>

      <Box sx={{ p: 2, borderTop: `1px solid ${T.border}` }}>
        <Button
          fullWidth
          variant="contained"
          onClick={onClose}
          sx={{ bgcolor: T.teal, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: T.tealHover } }}
        >
          {`Show ${resultCount.toLocaleString()} channel${resultCount === 1 ? '' : 's'}`}
        </Button>
      </Box>
    </Drawer>
  );
}

/**
 * One dimension: a searchable, checkable list.
 *
 * <p>Long lists are capped until "show all" — there are ~200 countries and far more
 * brands, and an uncapped list buries the three dimensions below it.
 */
function FacetSection({ label, values, chosen, onToggle }) {
  const T = useT();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);

  const matching = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? values.filter((v) => v.value.toLowerCase().includes(q)) : values;
  }, [values, search]);

  if (!values.length) return null;

  // Anything already ticked stays visible even when the list is collapsed, so a
  // selection can always be undone from here.
  const shown = expanded ? matching : matching.slice(0, 8);
  const missingChosen = matching.filter((v) => chosen.includes(v.value) && !shown.includes(v));
  const rows = [...shown, ...missingChosen];

  return (
    <Box sx={{ py: 2 }}>
      <Typography sx={{ fontWeight: 700, fontSize: 14, color: T.text, mb: 1 }}>{label}</Typography>

      {values.length > 8 && (
        <TextField
          fullWidth
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${label.toLowerCase()}`}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start"><SearchRounded sx={{ fontSize: 17, color: T.textFaint }} /></InputAdornment>
              ),
            },
          }}
          sx={{ mb: 1, '& .MuiOutlinedInput-root': { bgcolor: T.inputBg, color: T.text, borderRadius: 2 } }}
        />
      )}

      <Stack spacing={0.25}>
        {rows.map(({ value, count }) => (
          <Stack
            key={value}
            direction="row"
            alignItems="center"
            onClick={() => onToggle(value)}
            sx={{ cursor: 'pointer', borderRadius: 1.5, pr: 1, '&:hover': { bgcolor: T.glassHover } }}
          >
            <Checkbox
              size="small"
              checked={chosen.includes(value)}
              sx={{ color: T.textFaint, '&.Mui-checked': { color: T.teal } }}
            />
            <Typography sx={{
              flex: 1, minWidth: 0, fontSize: 13.5, color: T.text,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {value}
            </Typography>
            <Typography sx={{ fontSize: 12, color: T.textFaint }}>{count.toLocaleString()}</Typography>
          </Stack>
        ))}
        {rows.length === 0 && (
          <Typography sx={{ fontSize: 13, color: T.textFaint, px: 1 }}>No matches</Typography>
        )}
      </Stack>

      {!expanded && matching.length > 8 && (
        <Button size="small" onClick={() => setExpanded(true)}
          sx={{ textTransform: 'none', color: T.teal, mt: 0.5 }}>
          {`Show all ${matching.length.toLocaleString()}`}
        </Button>
      )}

      <Divider sx={{ mt: 2, borderColor: T.border }} />
    </Box>
  );
}
