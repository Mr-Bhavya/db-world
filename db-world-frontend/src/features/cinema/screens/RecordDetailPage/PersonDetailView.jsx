import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar, Box, Chip, CircularProgress, IconButton, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CakeIcon from '@mui/icons-material/Cake';
import PlaceIcon from '@mui/icons-material/Place';
import StarIcon from '@mui/icons-material/Star';
import { useT } from '@shared/theme/ThemeContext';
import Constants from '@shared/constants';
import { fetchPersonDetail, tmdbImg } from '../../api/cinemaApi';

/* ═══════════════════════════════════════════════════════════
   HELPERS — defined outside component, zero re-creation
═══════════════════════════════════════════════════════════ */

const formatDate = (iso) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return iso; }
};

const yearsBetween = (start, end) => {
  if (!start) return null;
  const a = new Date(start);
  const b = end ? new Date(end) : new Date();
  if (Number.isNaN(a.getTime())) return null;
  return Math.floor((b - a) / (365.25 * 24 * 3600 * 1000));
};

const getInitials = (name) =>
  (name ?? '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

// How many filmography cards to reveal per infinite-scroll batch.
const FILMO_BATCH = 24;

/* ═══════════════════════════════════════════════════════════
   FILMO CARD — memoized, receives stable onClick via id
═══════════════════════════════════════════════════════════ */

const FilmoCard = memo(function FilmoCard({ item, onClickRecord, subtitle: subtitleProp }) {
  const T = useT();
  // FIX #3: w154 is plenty for 104-124px display width
  const poster = tmdbImg(item.posterPath, 'w154');
  const initials = (item.title ?? '?').slice(0, 2).toUpperCase();
  const subtitle = subtitleProp ?? (item.creditType === 'CAST' ? item.character : item.job);
  const hasLink = Boolean(item.recordId);

  // FIX #2: Single stable handler — calls parent with item
  const handleClick = useCallback(() => {
    if (hasLink) onClickRecord(item);
  }, [hasLink, onClickRecord, item]);

  return (
    <Box
      component={motion.div}
      whileHover={hasLink ? { y: -3 } : undefined}
      transition={{ duration: 0.15 }}
      onClick={hasLink ? handleClick : undefined}
      role={hasLink ? 'button' : undefined}
      tabIndex={hasLink ? 0 : undefined}
      onKeyDown={hasLink ? (e) => { if (e.key === 'Enter') handleClick(); } : undefined}
      sx={{
        flexShrink: 0,
        width: { xs: 104, sm: 124 },
        cursor: hasLink ? 'pointer' : 'default',
        opacity: hasLink ? 1 : 0.55,
      }}
    >
      <Box sx={{
        width: '100%', aspectRatio: '2/3', borderRadius: 1.5, overflow: 'hidden',
        bgcolor: alpha(T.text, 0.06),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${alpha(T.text, 0.08)}`,
      }}>
        {poster ? (
          <Box
            component="img"
            src={poster}
            alt={item.title}
            loading="lazy"
            draggable={false}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Typography variant="h6" sx={{ color: T.textFaint, fontWeight: 800 }}>
            {initials}
          </Typography>
        )}
      </Box>
      <Typography variant="caption" sx={{
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', mt: 0.75, fontWeight: 700, color: T.text, lineHeight: 1.25,
      }}>
        {item.title}
      </Typography>
      {subtitle && (
        <Typography variant="caption" sx={{
          display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', color: T.textFaint, fontSize: '0.7rem',
        }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
});

/* ═══════════════════════════════════════════════════════════
   PERSON HEADER — extracted from IIFE for readability
═══════════════════════════════════════════════════════════ */

function PersonHeader({ data, photoUrl, blurUrl, age, aliases, surface }) {
  const T = useT();
  const initials = getInitials(data.name);
  const hasMeta = data.birthday || data.deathday || data.placeOfBirth;
  const bg = surface ?? T.bg;

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden' }}>
      {/* Blurred photo backdrop */}
      {blurUrl ? (
        <Box
          component="img"
          src={blurUrl}
          alt=""
          aria-hidden="true"
          draggable={false}
          sx={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            filter: 'blur(34px) brightness(0.5)',
            transform: 'scale(1.3)',
          }}
        />
      ) : (
        <Box sx={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(120% 100% at 50% 0%, ${alpha(T.teal, 0.35)} 0%, transparent 62%)`,
        }} />
      )}

      {/* Gradient overlay */}
      <Box sx={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(to bottom, ${alpha('#000', 0.35)} 0%, ${alpha(bg, 0.55)} 55%, ${bg} 100%)`,
      }} />

      {/* Content */}
      <Box sx={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', px: 2, pt: { xs: 3, sm: 4 }, pb: 3, gap: 1,
      }}>
        <Avatar
          src={photoUrl ?? undefined}
          alt={data.name}
          sx={{
            width: { xs: 118, sm: 138 }, height: { xs: 118, sm: 138 },
            bgcolor: alpha(T.teal, 0.4), fontSize: '2rem', fontWeight: 800,
            border: `3px solid ${alpha('#fff', 0.16)}`,
            boxShadow: '0 14px 40px rgba(0,0,0,0.5)',
          }}
        >
          {initials}
        </Avatar>

        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.01em', mt: 0.5 }}>
          {data.name}
        </Typography>

        {data.knownForDepartment && (
          <Typography sx={{
            color: T.teal, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: 1.2, fontSize: '0.74rem',
          }}>
            {data.knownForDepartment}
          </Typography>
        )}

        {hasMeta && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', mt: 0.5 }}>
            {data.birthday && (
              <Chip
                size="small"
                icon={<CakeIcon sx={{ fontSize: 16 }} />}
                label={`${formatDate(data.birthday)}${age != null && !data.deathday ? ` · ${age} yrs` : ''}`}
                sx={{ bgcolor: alpha(T.text, 0.1), color: T.textMuted, fontWeight: 600 }}
              />
            )}
            {data.deathday && (
              <Chip
                size="small"
                label={`† ${formatDate(data.deathday)}`}
                sx={{ bgcolor: alpha(T.text, 0.1), color: T.textMuted, fontWeight: 600 }}
              />
            )}
            {data.placeOfBirth && (
              <Chip
                size="small"
                icon={<PlaceIcon sx={{ fontSize: 16 }} />}
                label={data.placeOfBirth}
                sx={{ bgcolor: alpha(T.text, 0.1), color: T.textMuted, fontWeight: 600, maxWidth: 320 }}
              />
            )}
          </Box>
        )}

        {aliases.length > 0 && (
          <Typography variant="caption" sx={{ color: T.textFaint, mt: 0.25 }}>
            Also known as: {aliases.slice(0, 3).join(' · ')}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/* ═══════════════════════════════════════════════════════════
   PERSON DETAIL VIEW — main export
═══════════════════════════════════════════════════════════ */

export default function PersonDetailView({ personId, onBack, surface }) {
  const T = useT();
  const navigate = useNavigate();
  const location = useLocation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['person-detail', personId],
    queryFn: () => fetchPersonDetail(personId),
    enabled: Boolean(personId),
    staleTime: 5 * 60 * 1000,
  });

  // FIX #5: Precise dependencies instead of entire `data` object
  const age = useMemo(
    () => yearsBetween(data?.birthday, data?.deathday),
    [data?.birthday, data?.deathday],
  );

  // FIX #4: Memoize derived data
  const photoUrl = useMemo(() => tmdbImg(data?.profilePath, 'w342'), [data?.profilePath]);
  // FIX #9: Smaller image for blur backdrop — decodes faster
  const blurUrl = useMemo(() => tmdbImg(data?.profilePath, 'w185'), [data?.profilePath]);

  const aliases = useMemo(
    () => (data?.alsoKnownAs ?? '').split('|').map((s) => s.trim()).filter(Boolean),
    [data?.alsoKnownAs],
  );

  // Cast credits first, keeping the backend's popularity order within each group.
  const filmographySorted = useMemo(() => {
    const film = data?.filmography ?? [];
    return [...film].sort((a, b) => (a.creditType === 'CAST' ? 0 : 1) - (b.creditType === 'CAST' ? 0 : 1));
  }, [data?.filmography]);

  const knownFor = useMemo(() => filmographySorted.slice(0, 12), [filmographySorted]);

  // Full, DEDUPED filmography for the browsable section — a person can appear on a
  // title as both cast and crew (e.g. actor + producer); merge those into one card
  // with combined roles, adopting a recordId if any of the credits has one.
  const filmographyAll = useMemo(() => {
    const map = new Map();
    for (const it of filmographySorted) {
      const key = it.tmdbId ?? it.recordId ?? it.title;
      const role = it.creditType === 'CAST' ? it.character : it.job;
      const cur = map.get(key);
      if (!cur) {
        map.set(key, { ...it, roles: role ? [role] : [] });
      } else {
        if (!cur.recordId && it.recordId) { cur.recordId = it.recordId; cur.mediaType = it.mediaType; }
        if (role && !cur.roles.includes(role)) cur.roles.push(role);
      }
    }
    return [...map.values()];
  }, [filmographySorted]);

  const filmoCounts = useMemo(() => ({
    all: filmographyAll.length,
    MOVIE: filmographyAll.filter((i) => i.mediaType === 'MOVIE').length,
    TV_SERIES: filmographyAll.filter((i) => i.mediaType === 'TV_SERIES').length,
  }), [filmographyAll]);

  const [filmoTab, setFilmoTab] = useState('all');
  const [visibleCount, setVisibleCount] = useState(FILMO_BATCH);

  const filmoFiltered = useMemo(() => (
    filmoTab === 'all' ? filmographyAll : filmographyAll.filter((i) => i.mediaType === filmoTab)
  ), [filmographyAll, filmoTab]);

  const visibleFilmo = useMemo(() => filmoFiltered.slice(0, visibleCount), [filmoFiltered, visibleCount]);
  const hasMoreFilmo = visibleCount < filmoFiltered.length;

  const changeFilmoTab = useCallback((t) => { setFilmoTab(t); setVisibleCount(FILMO_BATCH); }, []);

  // Client-side infinite scroll: the full list is already loaded, so just reveal it
  // in batches as a sentinel scrolls into view. root:null observes the viewport and
  // still clips correctly inside the modal/sheet scroller.
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!hasMoreFilmo) return undefined;
    const el = sentinelRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setVisibleCount((c) => c + FILMO_BATCH);
    }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMoreFilmo, visibleCount, filmoTab]);

  // FIX #2: Stable callback — no inline arrow per item
  const openRecord = useCallback((item) => {
    if (!item?.recordId) return;
    const isMovie = item.mediaType === 'MOVIE';
    const base = isMovie ? Constants.DB_MOVIE_DETIALS_ROUTE : Constants.DB_SERIES_DETIALS_ROUTE;
    const slug = (item.title ?? '').replace(/\s+/g, '-').toLowerCase();
    const path = base.replace(':title', `${item.recordId}-${slug}`);
    // Drop `person` so navigating to a record doesn't re-open the person view.
    const { person: _person, ...restState } = location.state ?? {};
    navigate(path, { state: { ...restState, background: restState.background || location } });
  }, [navigate, location]);

  const bg = surface ?? T.bg;
  const hasContent = Boolean(data?.biography) || filmographyAll.length > 0;

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      sx={{ bgcolor: bg, minHeight: '100%', flex: 1 }}
    >
      {/* Sticky top bar */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 5,
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: { xs: 1.5, sm: 2.5 }, py: 1.25,
        bgcolor: alpha(bg, 0.88),
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${alpha(T.text, 0.08)}`,
      }}>
        <IconButton
          onClick={onBack}
          size="small"
          aria-label="Back to record"
          sx={{
            color: T.text,
            bgcolor: alpha(T.text, 0.08),
            '&:hover': { bgcolor: alpha(T.text, 0.16) },
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 20 }} />
        </IconButton>
        <Typography sx={{
          fontWeight: 700, color: T.text, fontSize: '1rem',
          minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {data?.name ?? 'Person'}
        </Typography>
      </Box>

      {/* Loading */}
      {isLoading && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <Box sx={{ p: 4 }}>
          <Typography variant="body1" sx={{ color: T.textMuted }}>
            Could not load person details.
          </Typography>
        </Box>
      )}

      {/* Content */}
      {!isLoading && !isError && data && (
        <Box>
          {/* Header */}
          <PersonHeader
            data={data}
            photoUrl={photoUrl}
            blurUrl={blurUrl}
            age={age}
            aliases={aliases}
            surface={surface}
          />

          {/* Biography */}
          {data.biography && (
            <Box sx={{ px: { xs: 2.5, sm: 3 }, py: 2.5, borderTop: `1px solid ${alpha(T.text, 0.06)}` }}>
              <Typography variant="overline" sx={{ color: T.textFaint, fontWeight: 700, letterSpacing: 1 }}>
                Biography
              </Typography>
              <Typography variant="body2" sx={{ color: T.textMuted, mt: 1, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {data.biography}
              </Typography>
            </Box>
          )}

          {/* Known For */}
          {knownFor.length > 0 && (
            <Box sx={{ px: { xs: 2.5, sm: 3 }, py: 2.5, borderTop: `1px solid ${alpha(T.text, 0.06)}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <StarIcon sx={{ fontSize: 18, color: T.teal }} />
                <Typography variant="overline" sx={{ color: T.textFaint, fontWeight: 700, letterSpacing: 1 }}>
                  Known For
                </Typography>
              </Box>
              <Box sx={{
                display: 'flex', gap: 2, overflowX: 'auto', pb: 1.5,
                scrollbarWidth: 'thin',
                '&::-webkit-scrollbar': { height: 5 },
                '&::-webkit-scrollbar-thumb': { background: alpha(T.text, 0.2), borderRadius: 3 },
              }}>
                {knownFor.map((item, i) => (
                  <FilmoCard
                    key={`${item.tmdbId}-${item.creditId ?? i}`}
                    item={item}
                    onClickRecord={openRecord}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Filmography — every title, filterable by type, revealed on scroll */}
          {filmographyAll.length > 0 && (
            <Box sx={{ px: { xs: 2.5, sm: 3 }, py: 2.5, borderTop: `1px solid ${alpha(T.text, 0.06)}` }}>
              <Typography variant="overline" sx={{
                color: T.textFaint, fontWeight: 700, letterSpacing: 1, display: 'block', mb: 1.5,
              }}>
                Filmography
              </Typography>

              {/* Type filter tabs (hidden when a type has no titles) */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                {[['all', 'All'], ['MOVIE', 'Movies'], ['TV_SERIES', 'TV']].map(([key, label]) => (
                  filmoCounts[key] > 0 ? (
                    <Chip
                      key={key}
                      label={`${label} · ${filmoCounts[key]}`}
                      onClick={() => changeFilmoTab(key)}
                      variant={filmoTab === key ? 'filled' : 'outlined'}
                      sx={{
                        fontWeight: 700,
                        color: filmoTab === key ? '#fff' : T.textMuted,
                        bgcolor: filmoTab === key ? T.teal : 'transparent',
                        borderColor: alpha(T.text, 0.18),
                        '&:hover': { bgcolor: filmoTab === key ? T.teal : alpha(T.text, 0.08) },
                      }}
                    />
                  ) : null
                ))}
              </Box>

              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(6, 1fr)' },
                gap: 1.5,
              }}>
                {visibleFilmo.map((item, i) => (
                  <FilmoCard
                    key={`${item.tmdbId ?? item.recordId ?? item.title}-${i}`}
                    item={item}
                    subtitle={item.roles?.slice(0, 2).join(', ')}
                    onClickRecord={openRecord}
                  />
                ))}
              </Box>

              {/* Infinite-scroll sentinel */}
              {hasMoreFilmo && (
                <Box ref={sentinelRef} sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={22} sx={{ color: T.teal }} />
                </Box>
              )}
            </Box>
          )}

          {/* Empty state */}
          {!hasContent && (
            <Box sx={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', textAlign: 'center',
              gap: 1, px: 3, py: 8, minHeight: 220,
            }}>
              <StarIcon sx={{ fontSize: 30, color: alpha(T.text, 0.18) }} />
              <Typography variant="body2" sx={{ color: T.textMuted, fontWeight: 600 }}>
                Limited information available
              </Typography>
              <Typography variant="caption" sx={{ color: T.textFaint, maxWidth: 320 }}>
                We don&apos;t have a biography or filmography for {data.name} yet.
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}