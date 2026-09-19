import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Chip, Container, IconButton, InputAdornment, Skeleton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  ChevronLeftRounded, ChevronRightRounded, ClearRounded, HistoryRounded,
  LiveTvRounded, PlayArrowRounded, SearchRounded,
  SignalWifiStatusbarConnectedNoInternet4Rounded,
} from '@mui/icons-material';
import { motion, useReducedMotion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

import usePageMeta from '@shared/hooks/usePageMeta';
import { HEADER_HEIGHT } from '@shared/components/layout/Header';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import { useLiveChannels } from './liveApi';
import { readRecent } from './liveRecent';
import {
  ActiveFilterChips, buildFacets, EMPTY_FILTERS, FilterButton, FiltersDrawer,
  activeFilterCount, matchesFilters,
} from './LiveFilters';

const ALL = 'All';

/**
 * How many tiles are mounted before the sentinel loads more.
 *
 * <p>A real playlist is thousands of channels. Mounting them all is seconds of blocked
 * main thread and hundreds of image requests for tiles nobody scrolled to, so the grid
 * grows as it is read instead.
 */
const PAGE = 60;

/** Public live-TV grid: search, category filter, recently watched, infinite scroll. */
export default function LiveTvPage() {
  const T        = useT();
  const reduce   = useReducedMotion();
  const navigate = useNavigate();
  // Positional args, and the hook appends " — DB World" itself.
  usePageMeta('Live TV', { description: 'Watch live television channels on DB World.' });

  const { data: channels = [], isLoading, isError } = useLiveChannels();
  const [category, setCategory] = useState(ALL);
  const [query, setQuery]       = useState('');
  const [shown, setShown]       = useState(PAGE);
  const [filters, setFilters]   = useState(EMPTY_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);

  // Read once on mount: the list only changes when playback starts, which leaves the page.
  const [recentIds] = useState(readRecent);

  const open = useCallback(
    (channel) => navigate(Constants.liveWatchPath(channel.id)),
    [navigate],
  );

  // Categories derived from the channels in hand rather than a second request, so the
  // chips and the grid can never disagree. A channel belongs to SEVERAL, so this
  // flattens rather than taking one label each.
  const categories = useMemo(() => {
    const counts = new Map();
    channels.forEach((c) => (c.categories || []).forEach(
      (cat) => counts.set(cat, (counts.get(cat) ?? 0) + 1),
    ));
    return [
      { name: ALL, count: channels.length },
      ...[...counts.entries()]
        // Biggest first: with ~30 categories the useful ones should not be an A-to-Z scroll away.
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, count]) => ({ name, count })),
    ];
  }, [channels]);

  const facets = useMemo(() => buildFacets(channels), [channels]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return channels.filter((c) => {
      const cats = c.categories || [];
      if (category !== ALL && !cats.includes(category)) return false;
      if (!matchesFilters(c, filters)) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q)
        || cats.some((cat) => cat.toLowerCase().includes(q))
        || (c.brand || '').toLowerCase().includes(q)
        || (c.countryName || '').toLowerCase().includes(q);
    });
  }, [channels, category, query, filters]);

  const toggleFilter = useCallback((dimension, value) => {
    setFilters((prev) => {
      const chosen = prev[dimension] ?? [];
      return {
        ...prev,
        [dimension]: chosen.includes(value)
          ? chosen.filter((v) => v !== value)
          : [...chosen, value],
      };
    });
  }, []);

  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const recent = useMemo(() => {
    if (!recentIds.length || !channels.length) return [];
    const byId = new Map(channels.map((c) => [c.id, c]));
    // Channels disappear when a playlist is removed, so drop ids that no longer resolve.
    return recentIds.map((id) => byId.get(id)).filter(Boolean);
  }, [recentIds, channels]);

  // Any change to the filters starts the list again — otherwise switching category while
  // scrolled deep would mount thousands of tiles at once.
  useEffect(() => { setShown(PAGE); }, [category, query, filters]);

  const { ref: sentinelRef, inView } = useInView({ rootMargin: '600px' });
  useEffect(() => {
    if (inView && shown < visible.length) setShown((n) => n + PAGE);
  }, [inView, shown, visible.length]);

  const activeCount = activeFilterCount(filters);
  const filtered = category !== ALL || query.trim() !== '' || activeCount > 0;

  return (
    <Container
      maxWidth="xl"
      sx={{
        // The app bar is `position: fixed` and transparent until scrolled, so without
        // this the page title renders underneath it.
        pt: { xs: `calc(${HEADER_HEIGHT.xs}px + 16px)`,
              md: `calc(${HEADER_HEIGHT.md}px + 24px)`,
              xl: `calc(${HEADER_HEIGHT.xl}px + 24px)` },
        pb: { xs: 2, md: 3 },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
        <LiveTvRounded sx={{ color: T.teal, fontSize: 30 }} />
        <Typography component="h1" sx={{ fontWeight: 800, fontSize: { xs: 24, md: 30 }, color: T.text }}>
          Live TV
        </Typography>
      </Stack>
      <Typography sx={{ color: T.textMuted, mb: 2, fontSize: 14 }}>
        {isLoading
          ? 'Loading channels…'
          : `${channels.length.toLocaleString()} channels · ${Math.max(0, categories.length - 1)} categories`}
      </Typography>

      {/* Filters stay reachable at any scroll depth. With thousands of tiles, having to
          scroll back to the top to change category is the single thing that makes a grid
          this size unusable. */}
      <Box sx={{
        position: 'sticky',
        // Pins just under the fixed app bar. `top: 0` puts it behind the bar, which is
        // what made the two overlap.
        top: HEADER_HEIGHT,
        // Below the app bar's 1200 so it can never cover the nav, above the tiles.
        zIndex: 3,
        bgcolor: T.bg, pt: 1, pb: 1.5, mb: 2,
        borderBottom: `1px solid ${T.border}`,
      }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
        <TextField
          fullWidth
          size="small"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search channels"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start"><SearchRounded sx={{ color: T.textFaint }} /></InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setQuery('')} sx={{ color: T.textFaint }} aria-label="Clear search">
                    <ClearRounded sx={{ fontSize: 17 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
          sx={{
            maxWidth: 440,
            '& .MuiOutlinedInput-root': { bgcolor: T.inputBg, color: T.text, borderRadius: 2 },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: T.glassBorder },
          }}
        />
          <FilterButton count={activeCount} onClick={() => setPanelOpen(true)} />
        </Stack>
        {categories.length > 1 && (
          <CategoryRail categories={categories} active={category} onPick={setCategory} />
        )}
        <ActiveFilterChips filters={filters} onToggle={toggleFilter} onClear={clearFilters} />
      </Box>

      <FiltersDrawer
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        facets={facets}
        filters={filters}
        onToggle={toggleFilter}
        onClear={clearFilters}
        resultCount={visible.length}
      />

      {isLoading && <ChannelGridSkeleton />}

      {isError && !isLoading && (
        <EmptyLive title="Couldn't load channels" message="The channel list is unavailable right now." />
      )}

      {!isLoading && !isError && recent.length > 0 && !filtered && (
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <HistoryRounded sx={{ fontSize: 19, color: T.textMuted }} />
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: T.text }}>Recently watched</Typography>
          </Stack>
          <ChannelGrid channels={recent} onOpen={open} reduce={reduce} />
        </Box>
      )}

      {!isLoading && !isError && (
        <>
          <Stack direction="row" alignItems="baseline" spacing={1.5} sx={{ mb: 1.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: T.text }}>
              {category === ALL ? 'All channels' : category}
            </Typography>
            <Typography sx={{ fontSize: 13, color: T.textFaint }}>
              {visible.length.toLocaleString()}
            </Typography>
            {filtered && (
              <Chip
                size="small"
                label="Clear filters"
                onClick={() => { setCategory(ALL); setQuery(''); clearFilters(); }}
                sx={{ bgcolor: T.glass, color: T.textMuted, border: `1px solid ${T.glassBorder}` }}
              />
            )}
          </Stack>

          {visible.length === 0 ? (
            <EmptyLive
              title={channels.length === 0 ? 'No channels yet' : 'Nothing matches that'}
              message={channels.length === 0
                ? 'An admin needs to add an M3U playlist under Admin → Live TV.'
                : 'Try a different search or category.'}
            />
          ) : (
            <>
              <ChannelGrid channels={visible.slice(0, shown)} onOpen={open} reduce={reduce} />
              {shown < visible.length && (
                <Box ref={sentinelRef} sx={{ py: 4, display: 'grid', placeItems: 'center' }}>
                  <Typography sx={{ fontSize: 13, color: T.textFaint }}>
                    Loading more… ({shown.toLocaleString()} of {visible.length.toLocaleString()})
                  </Typography>
                </Box>
              )}
            </>
          )}
        </>
      )}
    </Container>
  );
}

/**
 * Horizontally scrolling category chips, with arrow affordances on pointer devices.
 *
 * <p>A real playlist has ~30 categories. Wrapped, that is eight rows of chips before a
 * single channel appears; this keeps it to one line.
 */
function CategoryRail({ categories, active, onPick }) {
  const T = useT();
  const railRef = useRef(null);

  const nudge = (dir) => railRef.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });

  return (
    <Box sx={{ position: 'relative' }}>
      <Stack
        ref={railRef}
        direction="row"
        spacing={1}
        sx={{
          overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          // Room for the arrows so they never cover the first or last chip.
          px: { xs: 0, md: 4 },
        }}
      >
        {categories.map((c) => (
          <Chip
            key={c.name}
            label={`${c.name} ${c.count.toLocaleString()}`}
            onClick={() => onPick(c.name)}
            sx={{
              flexShrink: 0,
              bgcolor: c.name === active ? T.tealBg : T.glass,
              color:   c.name === active ? T.teal   : T.textMuted,
              border:  `1px solid ${c.name === active ? T.teal : T.glassBorder}`,
              fontWeight: c.name === active ? 700 : 500,
              '& .MuiChip-label': { px: 1.25 },
              '&:hover': { bgcolor: c.name === active ? T.tealBgHover : T.glassHover },
            }}
          />
        ))}
      </Stack>

      {[-1, 1].map((dir) => (
        <IconButton
          key={dir}
          size="small"
          onClick={() => nudge(dir)}
          // Touch scrolls by swipe and has no hover, so the arrows are desktop-only.
          sx={{
            display: { xs: 'none', md: 'grid' },
            position: 'absolute', top: '50%', transform: 'translateY(-50%)',
            ...(dir === -1 ? { left: -6 } : { right: -6 }),
            bgcolor: T.bg, color: T.textMuted,
            '&:hover': { bgcolor: T.glassHover, color: T.teal },
          }}
          aria-label={dir === -1 ? 'Scroll categories left' : 'Scroll categories right'}
        >
          {dir === -1 ? <ChevronLeftRounded fontSize="small" /> : <ChevronRightRounded fontSize="small" />}
        </IconButton>
      ))}
    </Box>
  );
}

const GRID_SX = {
  display: 'grid',
  gap: { xs: 1.25, md: 1.75 },
  gridTemplateColumns: 'repeat(auto-fill, minmax(144px, 1fr))',
};

function ChannelGrid({ channels, onOpen, reduce }) {
  return (
    <Box sx={GRID_SX}>
      {channels.map((channel, i) => (
        <ChannelCard key={channel.id} channel={channel} index={i} reduce={reduce} onClick={() => onOpen(channel)} />
      ))}
    </Box>
  );
}

function ChannelCard({ channel, index, reduce, onClick }) {
  const T = useT();
  const [logoFailed, setLogoFailed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const showLogo = channel.logoUrl && !logoFailed;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // Stagger only the first screenful: past that the delay outlasts the scroll and
      // tiles would still be fading in below the fold.
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: reduce ? 0 : Math.min(index, 12) * 0.015 }}
      whileHover={reduce ? undefined : { y: -3 }}
      style={{
        display: 'flex', flexDirection: 'column', gap: 8, padding: 10,
        cursor: 'pointer', textAlign: 'left', font: 'inherit', color: T.text,
        background: T.glass, borderRadius: 14,
        border: `1px solid ${hovered ? T.teal : T.glassBorder}`,
        transition: 'border-color 0.18s ease',
      }}
    >
      <Box sx={{
        position: 'relative', width: '100%', aspectRatio: '16 / 10',
        display: 'grid', placeItems: 'center',
        borderRadius: 2, bgcolor: T.inputBg, overflow: 'hidden',
      }}>
        {showLogo ? (
          <Box
            component="img"
            src={channel.logoUrl}
            alt=""
            loading="lazy"
            // Logos are hotlinked from wherever the playlist points; a dead one must fall
            // back to the icon rather than leave a broken-image glyph in the tile.
            onError={() => setLogoFailed(true)}
            sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 1 }}
          />
        ) : (
          <LiveTvRounded sx={{ fontSize: 30, color: T.textFaint }} />
        )}

        {hovered && !reduce && (
          <Box sx={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            bgcolor: 'rgba(0,0,0,0.45)',
          }}>
            <PlayArrowRounded sx={{ fontSize: 34, color: T.teal }} />
          </Box>
        )}
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Tooltip title={channel.name} enterDelay={600}>
          <Typography sx={{
            fontWeight: 600, fontSize: 13.5, color: T.text, lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {channel.name}
          </Typography>
        </Tooltip>
        {channel.categories?.length > 0 && (
          <Typography sx={{
            fontSize: 11.5, color: T.textFaint, mt: 0.25,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {channel.categories.join(' · ')}
          </Typography>
        )}
      </Box>
    </motion.button>
  );
}

function ChannelGridSkeleton() {
  const T = useT();
  return (
    <Box sx={GRID_SX}>
      {Array.from({ length: 18 }, (_, i) => (
        <Box key={i} sx={{ p: 1.25, borderRadius: 3.5, border: `1px solid ${T.glassBorder}`, bgcolor: T.glass }}>
          <Skeleton variant="rounded" sx={{ width: '100%', aspectRatio: '16 / 10', bgcolor: T.inputBg }} />
          <Skeleton width="75%" height={16} sx={{ mt: 1, bgcolor: T.inputBg }} />
          <Skeleton width="45%" height={12} sx={{ bgcolor: T.inputBg }} />
        </Box>
      ))}
    </Box>
  );
}

function EmptyLive({ title, message }) {
  const T = useT();
  return (
    <Box sx={{
      display: 'grid', placeItems: 'center', gap: 1, minHeight: 240,
      color: T.textMuted, textAlign: 'center',
    }}>
      <SignalWifiStatusbarConnectedNoInternet4Rounded sx={{ fontSize: 44, color: T.textFaint }} />
      <Typography sx={{ fontWeight: 700, color: T.text }}>{title}</Typography>
      <Typography sx={{ fontSize: 14 }}>{message}</Typography>
    </Box>
  );
}
