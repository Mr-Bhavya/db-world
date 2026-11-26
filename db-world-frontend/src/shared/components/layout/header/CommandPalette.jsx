import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  CircularProgress,
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
import SheetDialog from '@shared/components/SheetDialog';
import { addRecent, clearRecents, loadRecents, saveRecents } from './searchRecents';

const MIN_QUERY = 2;
const MAX_PER_GROUP = 5;

const TITLE_ACCENT = '#ef4444';
const IPO_ACCENT = '#10b981';

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

const appResult = (app, group = 'Apps') => ({
  key: `app-${app.id}`,
  group,
  label: app.label,
  detail: app.tagline,
  accent: app.accent,
  Icon: app.Icon,
  route: app.route,
});

/** Recents are stored without icons; give them back the look of the group they came from. */
function decorateRecent(recent, apps) {
  if (recent.key.startsWith('app-')) {
    const app = apps.find((candidate) => `app-${candidate.id}` === recent.key);
    return app ? appResult(app, 'Recent') : null; // app since hidden (e.g. signed out of admin)
  }
  const isTitle = recent.key.startsWith('title-');
  return {
    ...recent,
    group: 'Recent',
    accent: isTitle ? TITLE_ACCENT : IPO_ACCENT,
    Icon: isTitle ? TitleIcon : IpoIcon,
  };
}

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
  const [recents, setRecents] = useState([]);
  const listRef = useRef(null);

  const debouncedQuery = useDebounced(query.trim());
  // Gate on the live input too: on reopen the debounced value still holds the last search for one
  // debounce tick, which would flash stale hits (and let Enter pick one) over the Recent list.
  const searchable = query.trim().length >= MIN_QUERY && debouncedQuery.length >= MIN_QUERY;
  const needle = debouncedQuery.toLowerCase();

  // Reset on every open so the palette never reopens showing the last search.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setRecents(loadRecents());
    }
  }, [open]);

  const { data: titles, isFetching: titlesLoading } = useQuery({
    queryKey: ['command-palette', 'titles', debouncedQuery],
    queryFn: () => autocomplete(debouncedQuery),
    enabled: open && searchable,
    staleTime: 60_000,
    retry: 0,
  });

  // The IPO list is small and shared with the hub's cache, so it is filtered client-side rather
  // than adding a search endpoint. The header mounts this palette on every page, so the list is
  // only fetched once search is actually opened.
  const { data: ipoData } = useIpos({ enabled: open });

  const results = useMemo(() => {
    // Empty query: what the reader opened last, then every app — search is also the fastest
    // launcher, and an empty panel that says "type something" wastes the open.
    if (!searchable) {
      const recentHits = recents.map((recent) => decorateRecent(recent, apps)).filter(Boolean);
      return [...recentHits, ...apps.map((app) => appResult(app))];
    }

    const appHits = apps
      .filter((app) => matches(app.label, needle) || matches(app.tagline, needle) || matches(app.description, needle))
      .slice(0, MAX_PER_GROUP)
      .map((app) => appResult(app));

    const titleHits = (titles ?? []).slice(0, MAX_PER_GROUP).map((title) => ({
      key: `title-${title.id}`,
      group: 'Cinema',
      label: title.name,
      detail: title.type === 'TV_SERIES' ? 'Series' : 'Movie',
      poster: tmdbImg(title.posterPath, 'w92'),
      accent: TITLE_ACCENT,
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
        accent: IPO_ACCENT,
        Icon: IpoIcon,
        route: ipoDetailPath(ipo.id),
      }));

    return [...appHits, ...titleHits, ...ipoHits];
  }, [searchable, apps, needle, titles, ipoData, recents]);

  useEffect(() => {
    setActiveIndex(0);
  }, [results.length]);

  const select = useCallback(
    (result) => {
      if (!result?.route) return;
      saveRecents(addRecent(loadRecents(), result));
      // Replace, not push: the palette's own history entry becomes the destination, so Back
      // from the result returns to the page search was opened on rather than to a dead overlay.
      onNavigate(result.route, { replace: true });
      onClose();
    },
    [onClose, onNavigate]
  );

  const handleClearRecents = useCallback(() => {
    clearRecents();
    setRecents([]);
  }, []);

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
    <SheetDialog
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
          inputProps={{
            'aria-label': 'Search DB World',
            role: 'combobox',
            'aria-expanded': results.length > 0,
            'aria-controls': 'command-palette-results',
            'aria-activedescendant': results[activeIndex] ? `cp-option-${activeIndex}` : undefined,
            enterKeyHint: 'search',
            autoComplete: 'off',
          }}
          sx={{ flex: 1, color: T.text, fontSize: '1rem', fontWeight: 600 }}
        />
        {titlesLoading && <CircularProgress size={16} sx={{ color: T.textFaint }} />}
        <Box
          component="button"
          type="button"
          onClick={onClose}
          sx={{
            display: { xs: 'inline-flex', sm: 'none' },
            border: 'none',
            bgcolor: 'transparent',
            color: T.teal,
            fontFamily: 'inherit',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            minHeight: 44,
            px: 0.5,
          }}
        >
          Cancel
        </Box>
      </Box>

      <Box sx={{ height: '1px', bgcolor: T.border }} />

      <Box
        ref={listRef}
        id="command-palette-results"
        role="listbox"
        aria-label="Search results"
        sx={{ maxHeight: { xs: '65vh', sm: 420 }, overflowY: 'auto', overscrollBehavior: 'contain', py: 0.5 }}
      >
        {!searchable && query.trim().length > 0 && (
          <Typography sx={{ color: T.textFaint, fontSize: '0.78rem', px: 2, pt: 1.5 }}>
            Keep typing — at least {MIN_QUERY} characters to search titles and IPOs.
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
            <React.Fragment key={`${result.group}-${result.key}`}>
              {showGroup && (
                <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.25, pb: 0.5 }} role="presentation">
                  <Typography
                    sx={{
                      flex: 1,
                      color: T.textFaint,
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                    }}
                  >
                    {result.group === 'Apps' && !searchable ? 'Jump to' : result.group}
                  </Typography>
                  {result.group === 'Recent' && (
                    <Box
                      component="button"
                      type="button"
                      onClick={handleClearRecents}
                      sx={{
                        border: 'none',
                        bgcolor: 'transparent',
                        color: T.textMuted,
                        fontFamily: 'inherit',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        p: 0.5,
                        '&:hover': { color: T.teal },
                      }}
                    >
                      Clear
                    </Box>
                  )}
                </Box>
              )}

              <Box
                data-index={index}
                id={`cp-option-${index}`}
                role="option"
                aria-selected={active}
                component="button"
                type="button"
                tabIndex={-1}
                onClick={() => select(result)}
                onMouseEnter={() => setActiveIndex(index)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  width: '100%',
                  minHeight: 48,
                  px: 2,
                  py: 0.75,
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  minWidth: 0,
                  bgcolor: active ? T.tealBg : 'transparent',
                  borderLeft: `3px solid ${active ? result.accent : 'transparent'}`,
                  transition: 'background-color 120ms ease',
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

      <Box sx={{ height: '1px', bgcolor: T.border, display: { xs: 'none', sm: 'block' } }} />

      <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1.5, px: 2, py: 1, flexWrap: 'wrap' }}>
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
    </SheetDialog>
  );
}
