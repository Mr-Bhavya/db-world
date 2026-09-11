import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  CircularProgress,
  Dialog,
  InputBase,
  Typography,
} from '@mui/material';
import {
  MovieFilter as TitleIcon,
  Search as SearchIcon,
  ShowChart as IpoIcon,
} from '@mui/icons-material';

import { autocomplete, tmdbImg } from '@features/cinema/api/cinemaApi';
import { useIpos } from '@features/ipo/hooks/useIpo';
import { ipoDetailPath } from '@shared/constants';
import { useT } from '@shared/theme';
import { clampTextSx } from '@shared/components/layout/home/homeStyles';
import { recordRoute } from '@shared/components/layout/home/dashboard/recordRoute';

const MIN_QUERY = 2;
const MAX_PER_GROUP = 5;

/** Debounce a value so a fast typist does not fire a request per keystroke. */
function useDebounced(value, delay = 220) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

const matches = (haystack, needle) => (haystack ?? '').toLowerCase().includes(needle);

/**
 * One search across the whole hub: apps, cinema titles and IPOs.
 *
 * This is the piece that makes "one hub" mean something — until now search existed only inside
 * cinema, so finding an IPO meant opening the app first and finding an app meant knowing the menu.
 *
 * Both remote sources are public endpoints, so the palette works signed out. Apps are matched
 * locally and always rank first: they are the cheapest, most likely intent, and they are the only
 * group guaranteed to have an answer.
 */
export default function CommandPalette({ open, onClose, apps, onNavigate }) {
  const T = useT();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef(null);

  const debouncedQuery = useDebounced(query.trim());
  const searchable = debouncedQuery.length >= MIN_QUERY;
  const needle = debouncedQuery.toLowerCase();

  // Reset on every open so the palette never reopens showing the last search.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  const { data: titles, isFetching: titlesLoading } = useQuery({
    queryKey: ['command-palette', 'titles', debouncedQuery],
    queryFn: () => autocomplete(debouncedQuery),
    enabled: open && searchable,
    staleTime: 60_000,
    retry: 0,
  });

  // The IPO list is small and already cached by the hub, so it is filtered client-side rather than
  // adding a search endpoint for it.
  const { data: ipoData } = useIpos();

  const results = useMemo(() => {
    if (!searchable) return [];

    const appHits = apps
      .filter((app) => matches(app.label, needle) || matches(app.tagline, needle) || matches(app.description, needle))
      .slice(0, MAX_PER_GROUP)
      .map((app) => ({
        key: `app-${app.id}`,
        group: 'Apps',
        label: app.label,
        detail: app.tagline,
        accent: app.accent,
        Icon: app.Icon,
        route: app.route,
      }));

    const titleHits = (titles ?? []).slice(0, MAX_PER_GROUP).map((title) => ({
      key: `title-${title.id}`,
      group: 'Cinema',
      label: title.name,
      detail: title.type === 'TV_SERIES' ? 'Series' : 'Movie',
      poster: tmdbImg(title.posterPath, 'w92'),
      accent: '#ef4444',
      Icon: TitleIcon,
      route: recordRoute(title.type, title.name, title.id),
    }));

    const ipoHits = (ipoData?.ipos ?? [])
      .filter((ipo) => matches(ipo.companyName, needle))
      .slice(0, MAX_PER_GROUP)
      .map((ipo) => ({
        key: `ipo-${ipo.id}`,
        group: 'IPO',
        label: ipo.companyName,
        detail: ipo.status ? ipo.status[0].toUpperCase() + ipo.status.slice(1) : null,
        accent: '#10b981',
        Icon: IpoIcon,
        route: ipoDetailPath(ipo.id),
      }));

    return [...appHits, ...titleHits, ...ipoHits];
  }, [searchable, apps, needle, titles, ipoData]);

  useEffect(() => {
    setActiveIndex(0);
  }, [results.length]);

  const select = useCallback(
    (result) => {
      if (!result?.route) return;
      onClose();
      onNavigate(result.route);
    },
    [onClose, onNavigate]
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (results.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % results.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + results.length) % results.length);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        select(results[activeIndex]);
      }
    },
    [results, activeIndex, select]
  );

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  let previousGroup = null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          sx: {
            position: 'fixed',
            top: { xs: 16, sm: '10vh' },
            m: { xs: 1.5, sm: 2 },
            width: 'calc(100% - 24px)',
            borderRadius: 3,
            bgcolor: T.sidebar ?? T.bg,
            backgroundImage: 'none',
            border: `1px solid ${T.glassBorder}`,
            boxShadow: '0 30px 80px rgba(0,0,0,0.42)',
            overflow: 'hidden',
          },
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.5 }}>
        <SearchIcon sx={{ color: T.textFaint, fontSize: 21, flexShrink: 0 }} />
        <InputBase
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search apps, movies, series and IPOs…"
          inputProps={{ 'aria-label': 'Search DB World' }}
          sx={{ flex: 1, color: T.text, fontSize: '1rem', fontWeight: 600 }}
        />
        {titlesLoading && <CircularProgress size={16} sx={{ color: T.textFaint }} />}
      </Box>

      <Box sx={{ height: '1px', bgcolor: T.border }} />

      <Box ref={listRef} sx={{ maxHeight: { xs: '60vh', sm: 400 }, overflowY: 'auto', py: 0.5 }}>
        {!searchable && (
          <Typography sx={{ color: T.textFaint, fontSize: '0.82rem', px: 2, py: 2.5, textAlign: 'center' }}>
            Type at least {MIN_QUERY} characters.
          </Typography>
        )}

        {searchable && results.length === 0 && !titlesLoading && (
          <Typography sx={{ color: T.textFaint, fontSize: '0.82rem', px: 2, py: 2.5, textAlign: 'center' }}>
            Nothing matched “{debouncedQuery}”.
          </Typography>
        )}

        {results.map((result, index) => {
          const showGroup = result.group !== previousGroup;
          previousGroup = result.group;
          const active = index === activeIndex;
          const ResultIcon = result.Icon;

          return (
            <React.Fragment key={result.key}>
              {showGroup && (
                <Typography
                  sx={{
                    color: T.textFaint,
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    px: 2,
                    pt: 1.25,
                    pb: 0.5,
                  }}
                >
                  {result.group}
                </Typography>
              )}

              <Box
                data-index={index}
                component="button"
                type="button"
                onClick={() => select(result)}
                onMouseEnter={() => setActiveIndex(index)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  width: '100%',
                  px: 2,
                  py: 1,
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  minWidth: 0,
                  bgcolor: active ? T.tealBg : 'transparent',
                  borderLeft: `3px solid ${active ? result.accent : 'transparent'}`,
                }}
              >
                {result.poster ? (
                  <Box
                    component="img"
                    src={result.poster}
                    alt=""
                    loading="lazy"
                    sx={{ width: 26, height: 38, objectFit: 'cover', borderRadius: 0.75, flexShrink: 0 }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: 1.2,
                      bgcolor: `${result.accent}22`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {ResultIcon && <ResultIcon sx={{ fontSize: 15, color: result.accent }} />}
                  </Box>
                )}

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{ color: T.text, fontSize: '0.88rem', fontWeight: 700, ...clampTextSx(1) }}
                  >
                    {result.label}
                  </Typography>
                  {result.detail && (
                    <Typography sx={{ color: T.textFaint, fontSize: '0.72rem', ...clampTextSx(1) }}>
                      {result.detail}
                    </Typography>
                  )}
                </Box>
              </Box>
            </React.Fragment>
          );
        })}
      </Box>

      <Box sx={{ height: '1px', bgcolor: T.border }} />

      <Box sx={{ display: 'flex', gap: 1.5, px: 2, py: 1, flexWrap: 'wrap' }}>
        {[
          ['↑ ↓', 'navigate'],
          ['↵', 'open'],
          ['esc', 'close'],
        ].map(([key, action]) => (
          <Typography key={key} sx={{ color: T.textFaint, fontSize: '0.68rem', fontWeight: 600 }}>
            <Box
              component="span"
              sx={{
                px: 0.6,
                py: 0.15,
                mr: 0.5,
                borderRadius: 0.8,
                border: `1px solid ${T.border}`,
                fontWeight: 800,
              }}
            >
              {key}
            </Box>
            {action}
          </Typography>
        ))}
      </Box>
    </Dialog>
  );
}
