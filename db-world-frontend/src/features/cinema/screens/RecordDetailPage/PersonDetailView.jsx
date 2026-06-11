import React, { useMemo, useCallback } from 'react';
import {
  Avatar, Box, Chip, CircularProgress, IconButton, Typography, useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
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

const formatDate = (iso) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return iso; }
};

const yearsBetween = (start, end) => {
  if (!start) return null;
  const a = new Date(start);
  const b = end ? new Date(end) : new Date();
  if (Number.isNaN(a.getTime())) return null;
  return Math.floor((b - a) / (365.25 * 24 * 3600 * 1000));
};

function FilmoCard({ item, onClick }) {
  const T = useT();
  const poster = tmdbImg(item.posterPath, 'w342');
  const initials = (item.title ?? '?').slice(0, 2).toUpperCase();
  const subtitle = item.creditType === 'CAST' ? item.character : item.job;

  return (
    <Box
      component={motion.div}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.15 }}
      onClick={item.recordId ? onClick : undefined}
      sx={{
        flexShrink: 0, width: { xs: 104, sm: 124 },
        cursor: item.recordId ? 'pointer' : 'default',
        opacity: item.recordId ? 1 : 0.55,
      }}
    >
      <Box sx={{
        width: '100%', aspectRatio: '2/3', borderRadius: 1.5, overflow: 'hidden',
        bgcolor: alpha(T.text, 0.06), display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${alpha(T.text, 0.08)}`,
      }}>
        {poster
          ? <Box component="img" src={poster} alt={item.title} loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Typography variant="h6" sx={{ color: T.textFaint, fontWeight: 800 }}>{initials}</Typography>}
      </Box>
      <Typography variant="caption" sx={{
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        mt: 0.75, fontWeight: 700, color: T.text, lineHeight: 1.25,
      }}>
        {item.title}
      </Typography>
      {subtitle && (
        <Typography variant="caption" sx={{
          display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          color: T.textFaint, fontSize: '0.7rem',
        }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}

/**
 * Person detail rendered IN PLACE inside the record detail surface (modal /
 * sheet / page) — a "drill-in", not a separate popup. A Back arrow returns to
 * the record. The parent (RecordDetailContent) drives open/close via router
 * state so the hardware/browser Back button closes this first.
 */
export default function PersonDetailView({ personId, onBack, surface }) {
  const T = useT();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const location = useLocation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['person-detail', personId],
    queryFn: () => fetchPersonDetail(personId),
    enabled: Boolean(personId),
    staleTime: 5 * 60 * 1000,
  });

  const age = useMemo(() => yearsBetween(data?.birthday, data?.deathday), [data]);

  const { knownFor, otherWork } = useMemo(() => {
    const film = data?.filmography ?? [];
    const sorted = [...film].sort((a, b) => {
      const aCast = a.creditType === 'CAST' ? 0 : 1;
      const bCast = b.creditType === 'CAST' ? 0 : 1;
      return aCast - bCast;
    });
    return { knownFor: sorted.slice(0, 12), otherWork: sorted.slice(12) };
  }, [data]);

  const openRecord = useCallback((item) => {
    if (!item?.recordId) return;
    const isMovie = item.mediaType === 'MOVIE';
    const base = isMovie ? Constants.DB_MOVIE_DETIALS_ROUTE : Constants.DB_SERIES_DETIALS_ROUTE;
    const slug = (item.title ?? '').replace(/\s+/g, '-').toLowerCase();
    const path = base.replace(':title', `${item.recordId}-${slug}`);
    // Preserve the existing background so the overlay stays; drop `person`
    // so the new record opens on its record view (not a stale person view).
    const { person, ...restState } = location.state ?? {};
    navigate(path, { state: { ...restState, background: restState.background || location } });
  }, [navigate, location]);

  const photoUrl = tmdbImg(data?.profilePath, 'w342');
  const aliases = (data?.alsoKnownAs ?? '').split('|').map(s => s.trim()).filter(Boolean);

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      sx={{ bgcolor: surface ?? T.bg, minHeight: '100%' }}
    >
      {/* Sticky top bar with Back */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 5,
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: { xs: 1.5, sm: 2.5 }, py: 1.25,
        bgcolor: alpha(surface ?? T.bg, 0.88), backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${alpha(T.text, 0.08)}`,
      }}>
        <IconButton onClick={onBack} size="small" aria-label="Back"
          sx={{ color: T.text, bgcolor: alpha(T.text, 0.08), '&:hover': { bgcolor: alpha(T.text, 0.16) } }}>
          <ArrowBackIcon sx={{ fontSize: 20 }} />
        </IconButton>
        <Typography sx={{ fontWeight: 700, color: T.text, fontSize: '1rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data?.name ?? 'Person'}
        </Typography>
      </Box>

      {isLoading && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      )}

      {isError && !isLoading && (
        <Box sx={{ p: 4 }}>
          <Typography variant="body1" sx={{ color: T.textMuted }}>Could not load person details.</Typography>
        </Box>
      )}

      {!isLoading && !isError && data && (() => {
        const initials = data.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        const hasMeta = data.birthday || data.deathday || data.placeOfBirth;
        const hasContent = Boolean(data.biography) || knownFor.length > 0 || otherWork.length > 0;
        return (
          <Box>
            {/* Header — centered, with a blurred photo backdrop so the layout
                reads as intentional even when there's little data. */}
            <Box sx={{ position: 'relative', overflow: 'hidden' }}>
              {photoUrl ? (
                <Box component="img" src={photoUrl} alt="" aria-hidden
                  sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(34px) brightness(0.5)', transform: 'scale(1.3)' }} />
              ) : (
                <Box sx={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 100% at 50% 0%, ${alpha(T.teal, 0.35)} 0%, transparent 62%)` }} />
              )}
              <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, ${alpha('#000', 0.35)} 0%, ${alpha(surface ?? T.bg, 0.55)} 55%, ${surface ?? T.bg} 100%)` }} />

              <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', px: 2, pt: { xs: 3, sm: 4 }, pb: 3, gap: 1 }}>
                <Avatar src={photoUrl ?? undefined} alt={data.name}
                  sx={{
                    width: { xs: 118, sm: 138 }, height: { xs: 118, sm: 138 },
                    bgcolor: alpha(T.teal, 0.4), fontSize: '2rem', fontWeight: 800,
                    border: `3px solid ${alpha('#fff', 0.16)}`, boxShadow: '0 14px 40px rgba(0,0,0,0.5)',
                  }}>
                  {initials}
                </Avatar>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.01em', mt: 0.5 }}>{data.name}</Typography>
                {data.knownForDepartment && (
                  <Typography sx={{ color: T.teal, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, fontSize: '0.74rem' }}>
                    {data.knownForDepartment}
                  </Typography>
                )}
                {hasMeta && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', mt: 0.5 }}>
                    {data.birthday && (
                      <Chip size="small" icon={<CakeIcon sx={{ fontSize: 16 }} />}
                        label={`${formatDate(data.birthday)}${age != null && !data.deathday ? ` · ${age} yrs` : ''}`}
                        sx={{ bgcolor: alpha(T.text, 0.1), color: T.textMuted, fontWeight: 600 }} />
                    )}
                    {data.deathday && (
                      <Chip size="small" label={`† ${formatDate(data.deathday)}`}
                        sx={{ bgcolor: alpha(T.text, 0.1), color: T.textMuted, fontWeight: 600 }} />
                    )}
                    {data.placeOfBirth && (
                      <Chip size="small" icon={<PlaceIcon sx={{ fontSize: 16 }} />} label={data.placeOfBirth}
                        sx={{ bgcolor: alpha(T.text, 0.1), color: T.textMuted, fontWeight: 600, maxWidth: 320 }} />
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

            {/* Biography */}
            {data.biography && (
              <Box sx={{ px: { xs: 2.5, sm: 3 }, py: 2.5, borderTop: `1px solid ${alpha(T.text, 0.06)}` }}>
                <Typography variant="overline" sx={{ color: T.textFaint, fontWeight: 700, letterSpacing: 1 }}>Biography</Typography>
                <Typography variant="body2" sx={{ color: T.textMuted, mt: 1, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {data.biography}
                </Typography>
              </Box>
            )}

            {/* Known for */}
            {knownFor.length > 0 && (
              <Box sx={{ px: { xs: 2.5, sm: 3 }, py: 2.5, borderTop: `1px solid ${alpha(T.text, 0.06)}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <StarIcon sx={{ fontSize: 18, color: T.teal }} />
                  <Typography variant="overline" sx={{ color: T.textFaint, fontWeight: 700, letterSpacing: 1 }}>Known For</Typography>
                </Box>
                <Box sx={{
                  display: 'flex', gap: 2, overflowX: 'auto', pb: 1.5,
                  scrollbarWidth: 'thin',
                  '&::-webkit-scrollbar': { height: 5 },
                  '&::-webkit-scrollbar-thumb': { background: alpha(T.text, 0.2), borderRadius: 3 },
                }}>
                  {knownFor.map((item, i) => (
                    <FilmoCard key={`${item.tmdbId}-${i}`} item={item} onClick={() => openRecord(item)} />
                  ))}
                </Box>
              </Box>
            )}

            {/* More work */}
            {otherWork.length > 0 && (
              <Box sx={{ px: { xs: 2.5, sm: 3 }, py: 2.5, borderTop: `1px solid ${alpha(T.text, 0.06)}` }}>
                <Typography variant="overline" sx={{ color: T.textFaint, fontWeight: 700, letterSpacing: 1, display: 'block', mb: 1.5 }}>
                  More Work ({otherWork.length})
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(6, 1fr)' }, gap: 1.5 }}>
                  {otherWork.map((item, i) => (
                    <FilmoCard key={`${item.tmdbId}-${i}`} item={item} onClick={() => openRecord(item)} />
                  ))}
                </Box>
              </Box>
            )}

            {/* Graceful empty state — fills the panel instead of leaving a gap */}
            {!hasContent && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 1, px: 3, py: 8, minHeight: 220 }}>
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
        );
      })()}
    </Box>
  );
}
