import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { notify } from '@shared/notify';
import {
  Box, Dialog, DialogContent, DialogTitle, IconButton, TextField,
  Tab, Tabs, Typography, CircularProgress, Button,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import CheckIcon from '@mui/icons-material/Check';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { useT } from '@shared/theme/ThemeContext';
import {
  searchTmdbForRequest, toggleCatalogIngestVote,
  fetchMyCatalogRequests, tmdbImg,
} from '../../api/cinemaApi';

const MIN_QUERY_LEN = 2;
const DEBOUNCE_MS   = 350;

// TmdbSearchItemDto serialises poster_path / release_date / first_air_date via
// @JsonProperty (matches TMDB's own field names). We tolerate the camelCase form
// too so future DTO cleanups don't break this component.
const posterFrom = (item) => item?.poster_path ?? item?.posterPath ?? null;

const yearFrom = (item, mediaType) => {
  const raw = mediaType === 'MOVIE'
    ? (item.release_date ?? item.releaseDate)
    : (item.first_air_date ?? item.firstAirDate);
  if (!raw || raw.length < 4) return null;
  return raw.slice(0, 4);
};

const titleFrom = (item, mediaType) =>
  (mediaType === 'MOVIE' ? item.title : item.name) ?? item.title ?? item.name ?? '';

// ─── Result row ──────────────────────────────────────────────────────────────
function ResultRow({ item, mediaType, requested, submitting, onToggle }) {
  const T = useT();
  const title = titleFrom(item, mediaType);
  const year = yearFrom(item, mediaType);
  const poster = tmdbImg(posterFrom(item), 'w185');

  return (
    <Box sx={{
      display: 'flex', gap: 1.5,
      p: 1.5,
      borderRadius: 1.5,
      border: `1px solid ${alpha(T.text, 0.06)}`,
      bgcolor: requested ? alpha(T.teal, 0.06) : 'transparent',
      transition: 'background-color .15s',
      '&:hover': { bgcolor: alpha(T.teal, 0.04) },
    }}>
      <Box sx={{
        width: 56, height: 84, flexShrink: 0,
        borderRadius: 1, overflow: 'hidden',
        bgcolor: alpha(T.text, 0.06),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {poster
          ? <Box component="img" src={poster} alt={title} loading="lazy"
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Typography variant="caption" sx={{ color: T.textFaint }}>—</Typography>
        }
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: T.text, lineHeight: 1.3 }}>
          {title}{year ? ` (${year})` : ''}
        </Typography>
        {item.overview && (
          <Typography variant="caption" sx={{
            color: T.textFaint, lineHeight: 1.4, display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {item.overview}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Button
          size="small"
          variant={requested ? 'outlined' : 'contained'}
          color="primary"
          disableElevation
          disabled={submitting}
          startIcon={requested ? <CheckIcon sx={{ fontSize: 16 }} /> : <NotificationsActiveIcon sx={{ fontSize: 16 }} />}
          onClick={onToggle}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
        >
          {requested ? 'Requested' : 'Request'}
        </Button>
      </Box>
    </Box>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────
export default function CatalogRequestModal({ open, onClose, initialQuery = '' }) {
  const T = useT();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));

  const [mediaType, setMediaType] = useState('MOVIE');
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);
  const [requestedKeys, setRequestedKeys] = useState(() => new Set()); // `${tmdbId}:${mediaType}`

  useEffect(() => { if (open) setQuery(initialQuery); }, [open, initialQuery]);

  // Load the user's existing pending catalog requests so we can mark already-voted entries.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchMyCatalogRequests()
      .then(rows => {
        if (!alive || !Array.isArray(rows)) return;
        setRequestedKeys(new Set(rows.map(r => `${r.tmdbId}:${r.mediaType}`)));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [open]);

  // Debounce the search query so we don't hammer TMDB on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    if (debouncedQuery.length < MIN_QUERY_LEN) { setResults([]); return; }
    let alive = true;
    setLoading(true);
    searchTmdbForRequest(mediaType, debouncedQuery)
      .then(rows => { if (alive) setResults(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (alive) setResults([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [debouncedQuery, mediaType, open]);

  const onToggle = useCallback(async (item) => {
    const tmdbId = item.id;
    const key = `${tmdbId}:${mediaType}`;
    setSubmittingId(tmdbId);
    try {
      const res = await toggleCatalogIngestVote({
        tmdbId,
        mediaType,
        title: titleFrom(item, mediaType),
        posterPath: posterFrom(item),
        releaseYear: yearFrom(item, mediaType),
        note: null,
      });
      setRequestedKeys(prev => {
        const next = new Set(prev);
        if (res?.hasMyVote) next.add(key);
        else next.delete(key);
        return next;
      });
      notify[res?.hasMyVote ? 'success' : 'info'](
        res?.hasMyVote
          ? `Request sent — we'll notify you when "${titleFrom(item, mediaType)}" is added.`
          : 'Request withdrawn.'
      );
    } catch (e) {
      const msg = e?.response?.data?.message
        || e?.response?.data?.error
        || 'Could not save request. Please try again.';
      notify.error(msg);
    } finally {
      setSubmittingId(null);
    }
  }, [mediaType]);

  const minLenHint = useMemo(() => `Type at least ${MIN_QUERY_LEN} characters to search`, []);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isXs}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { bgcolor: T.bg, backgroundImage: 'none', borderRadius: isXs ? 0 : 2, color: T.text },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, flex: 1 }}>Request a title</Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: T.text }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 1 }}>
          <Typography variant="body2" sx={{ color: T.textMuted, mb: 1.5 }}>
            Search TMDB for the title you want added. We&apos;ll notify you when admins ingest it.
          </Typography>

          <Tabs
            value={mediaType}
            onChange={(_, v) => setMediaType(v)}
            sx={{ minHeight: 36, mb: 1.5, '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontWeight: 700 } }}
          >
            <Tab value="MOVIE" label="Movies" icon={<MovieIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
            <Tab value="TV_SERIES" label="TV Series" icon={<TvIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
          </Tabs>

          <TextField
            fullWidth
            autoFocus
            size="small"
            placeholder={mediaType === 'MOVIE' ? 'e.g. Inception' : 'e.g. Breaking Bad'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ fontSize: 18, color: T.textMuted, mr: 1 }} />,
            }}
          />
        </Box>

        <Box sx={{ px: { xs: 2, sm: 3 }, pb: 3, minHeight: 280 }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          )}
          {!loading && debouncedQuery.length < MIN_QUERY_LEN && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 1 }}>
              <SearchIcon sx={{ fontSize: 40, color: T.textFaint, opacity: 0.4 }} />
              <Typography variant="body2" sx={{ color: T.textFaint }}>{minLenHint}</Typography>
            </Box>
          )}
          {!loading && debouncedQuery.length >= MIN_QUERY_LEN && results.length === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 1 }}>
              <Typography variant="body2" sx={{ color: T.textFaint }}>
                No TMDB matches for &ldquo;{debouncedQuery}&rdquo;.
              </Typography>
              <Typography variant="caption" sx={{ color: T.textFaint }}>
                Try a different spelling, or switch tabs between Movies and TV Series.
              </Typography>
            </Box>
          )}
          {!loading && results.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {results.map((item) => {
                const key = `${item.id}:${mediaType}`;
                return (
                  <ResultRow
                    key={key}
                    item={item}
                    mediaType={mediaType}
                    requested={requestedKeys.has(key)}
                    submitting={submittingId === item.id}
                    onToggle={() => onToggle(item)}
                  />
                );
              })}
            </Box>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
