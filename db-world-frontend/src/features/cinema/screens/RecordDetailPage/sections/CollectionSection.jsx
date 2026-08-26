import React, { useCallback, useMemo, useState } from 'react';
import { Box, Skeleton, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';

import { useT } from '@shared/theme/ThemeContext';
import { notify } from '@shared/notify';
import Constants from '@shared/constants';
import {
  fetchCollection, fetchMyCatalogRequests, toggleCatalogIngestVote, tmdbImg,
} from '../../../api/cinemaApi';

const CARD_W = { xs: 118, sm: 138, md: 152, xl: 178 };

/* Televisions sit past MUI's xl breakpoint, so the step up to a sofa-legible
   card needs its own query rather than another entry in CARD_W. */
const CARD_W_TV = { '@media (min-width:1920px)': { width: 214 } };

/* ═══════════════════════════════════════════════════════════
   PART CARD

   Three states, and the whole point of the section is that they
   read differently at a glance:
     • the title you're on  → ringed, "You are here"
     • in the library       → full colour, play affordance
     • not in the library   → desaturated, request affordance
═══════════════════════════════════════════════════════════ */

function PartCard({ part, index, isCurrent, isMobile, requested, onRequest, busy }) {
  const T = useT();
  const navigate = useNavigate();
  const location = useLocation();

  const available = !!part.recordId;
  const year = part.releaseDate?.slice(0, 4);
  const poster = tmdbImg(part.posterPath, 'w342');

  const open = useCallback(() => {
    if (!available) return;
    const path = Constants.DB_MOVIE_DETIALS_ROUTE.replace(':title', part.recordSlug ?? String(part.recordId));

    if (isMobile) {
      navigate(path);
      return;
    }
    // Preserve the ORIGINAL background so closing the next modal returns to the
    // page behind it rather than stranding the user on a full page.
    navigate(path, { state: { background: location.state?.background || location } });
  }, [available, part.recordSlug, part.recordId, isMobile, navigate, location]);

  const handleClick = available ? open : () => onRequest(part);

  const label = isCurrent
    ? 'You are here'
    : available
      ? `${year ?? ''} · In library`
      : requested
        ? `${year ?? ''} · Requested`
        : `${year ?? ''} · Not in library`;

  return (
    <Box
      component={motion.div}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.18 }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
      aria-label={available ? `Open ${part.title}` : `Request ${part.title}`}
      sx={{
        flexShrink: 0, width: CARD_W, ...CARD_W_TV, cursor: 'pointer',
        '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 3, borderRadius: 1.5 },
        '&:hover .part-hover': { opacity: 1 },
      }}
    >
      <Box sx={{
        position: 'relative', width: '100%', aspectRatio: '2/3',
        borderRadius: 1.5, overflow: 'hidden',
        bgcolor: alpha(T.text, 0.06),
        border: isCurrent ? `2px solid ${T.teal}` : `1px solid ${alpha(T.text, 0.09)}`,
        boxShadow: isCurrent
          ? `0 0 0 3px ${alpha(T.teal, 0.28)}, 0 10px 26px rgba(0,0,0,0.5)`
          : '0 6px 18px rgba(0,0,0,0.4)',
      }}>
        {poster && (
          <Box
            component="img"
            src={poster}
            alt=""
            loading="lazy"
            draggable={false}
            sx={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              // Missing titles are visibly "not yours" without needing a label.
              filter: available ? 'none' : 'grayscale(0.85) brightness(0.5)',
            }}
          />
        )}

        {/* Release-order number — a collection only makes sense in sequence. */}
        <Box sx={{
          position: 'absolute', top: 5, left: 5, zIndex: 3,
          minWidth: 20, height: 20, px: 0.5, borderRadius: 1,
          bgcolor: alpha('#000', 0.66), backdropFilter: 'blur(6px)',
          border: `1px solid ${alpha('#fff', 0.2)}`,
          display: 'grid', placeItems: 'center',
          fontSize: '0.66rem', fontWeight: 800, color: '#fff',
        }}>
          {index + 1}
        </Box>

        {isCurrent && (
          <Box sx={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 3,
            bgcolor: T.teal, color: '#fff', textAlign: 'center',
            fontSize: '0.56rem', fontWeight: 800, letterSpacing: 0.9,
            textTransform: 'uppercase', py: 0.4,
          }}>
            You are here
          </Box>
        )}

        {!isCurrent && available && (
          <Box className="part-hover" sx={{
            position: 'absolute', inset: 0, zIndex: 2,
            display: 'grid', placeItems: 'center',
            background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.72) 100%)',
            opacity: 0, transition: 'opacity 0.2s',
          }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: '50%',
              bgcolor: alpha('#fff', 0.94), display: 'grid', placeItems: 'center',
              boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
            }}>
              <PlayArrowIcon sx={{ fontSize: 22, color: '#111', ml: 0.2 }} />
            </Box>
          </Box>
        )}

        {!available && (
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 4, display: 'grid', placeItems: 'center' }}>
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.4,
              px: 1.1, py: 0.6, borderRadius: 999,
              bgcolor: requested ? alpha(T.teal, 0.9) : alpha('#fff', 0.14),
              border: `1px solid ${requested ? T.teal : alpha('#fff', 0.3)}`,
              backdropFilter: 'blur(8px)',
              color: '#fff', fontSize: '0.62rem', fontWeight: 800, letterSpacing: 0.4,
              opacity: busy ? 0.6 : 1,
              transition: 'background 0.2s, border-color 0.2s',
            }}>
              {requested
                ? <><CheckIcon sx={{ fontSize: 13 }} />Requested</>
                : <><AddIcon sx={{ fontSize: 13 }} />Request</>}
            </Box>
          </Box>
        )}
      </Box>

      <Tooltip title={part.title ?? ''} placement="bottom">
        <Typography sx={{
          mt: 0.9, fontSize: '0.74rem', fontWeight: 700, lineHeight: 1.32,
          color: available ? T.text : alpha(T.text, 0.45),
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {part.title}
        </Typography>
      </Tooltip>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
        <Box sx={{
          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
          bgcolor: available ? T.teal : alpha(T.text, 0.28),
        }} />
        <Typography sx={{ fontSize: '0.64rem', fontWeight: 600, color: alpha(T.text, 0.45) }}>
          {label}
        </Typography>
      </Box>
    </Box>
  );
}

/* ═══════════════════════════════════════════════════════════
   COLLECTION SECTION
═══════════════════════════════════════════════════════════ */

export default function CollectionSection({ collectionId, currentTmdbId, isMobile }) {
  const T = useT();
  const [busyId, setBusyId] = useState(null);
  const [localRequests, setLocalRequests] = useState(() => new Set());

  const { data: collection, isLoading } = useQuery({
    queryKey: ['cinema-collection', collectionId],
    queryFn: () => fetchCollection(collectionId),
    enabled: !!collectionId,
    staleTime: 30 * 60 * 1000,
  });

  const missingCount = (collection?.parts?.length ?? 0) - (collection?.ownedCount ?? 0);

  // Only worth asking which titles the user already voted for once we know some
  // part is actually missing.
  const { data: myRequests } = useQuery({
    queryKey: ['cinema-my-catalog-requests'],
    queryFn: fetchMyCatalogRequests,
    enabled: missingCount > 0,
    staleTime: 5 * 60 * 1000,
  });

  const requestedIds = useMemo(() => {
    const ids = new Set(localRequests);
    (myRequests ?? []).forEach((r) => { if (r?.tmdbId != null) ids.add(r.tmdbId); });
    return ids;
  }, [myRequests, localRequests]);

  const handleRequest = useCallback(async (part) => {
    if (busyId) return;
    setBusyId(part.tmdbId);
    try {
      const res = await toggleCatalogIngestVote({
        tmdbId: part.tmdbId,
        mediaType: 'MOVIE',
        title: part.title,
        posterPath: part.posterPath,
        releaseYear: part.releaseDate?.slice(0, 4) ?? null,
      });
      setLocalRequests((prev) => {
        const next = new Set(prev);
        if (res?.hasMyVote) next.add(part.tmdbId); else next.delete(part.tmdbId);
        return next;
      });
      notify[res?.hasMyVote ? 'success' : 'info'](
        res?.hasMyVote ? `Requested "${part.title}"` : `Removed request for "${part.title}"`,
      );
    } catch {
      notify.error('Could not save request. Please try again.');
    } finally {
      setBusyId(null);
    }
  }, [busyId]);

  if (isLoading) {
    return (
      <Box sx={{ py: 3 }}>
        <Skeleton variant="rounded" height={110} sx={{ bgcolor: alpha(T.text, 0.06), borderRadius: 2, mb: 1.5 }} />
        <Box sx={{ display: 'flex', gap: 1.25 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Box key={i} sx={{ flexShrink: 0, width: CARD_W, ...CARD_W_TV }}>
              {/* height:auto is load-bearing — MUI's Skeleton root sets height:1.2em, and a
                  definite height makes the browser ignore aspect-ratio entirely, collapsing
                  this poster placeholder to a thin bar. */}
              <Skeleton variant="rounded" sx={{ width: '100%', height: 'auto', aspectRatio: '2/3', bgcolor: alpha(T.text, 0.06) }} />
              <Skeleton variant="text" width="80%" sx={{ mt: 0.75, bgcolor: alpha(T.text, 0.06) }} />
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  // A "collection" of one is just the film you're already looking at.
  if (!collection || (collection.parts?.length ?? 0) < 2) return null;

  const total = collection.parts.length;
  const owned = collection.ownedCount ?? 0;
  const bannerArt = tmdbImg(collection.backdropPath, 'w780') ?? tmdbImg(collection.posterPath, 'w780');

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.05 }}
      transition={{ duration: 0.4 }}
      sx={{ py: 3 }}
    >
      <Box sx={{
        borderRadius: 2, overflow: 'hidden',
        // Without this the rail's intrinsic width (every card laid end to end)
        // sets the card's width instead of the container's, and the overflow
        // escapes upward rather than scrolling inside.
        minWidth: 0, maxWidth: '100%',
        border: `1px solid ${alpha(T.text, 0.09)}`,
        bgcolor: alpha(T.text, 0.02),
      }}>
        {/* Banner */}
        <Box sx={{ position: 'relative', height: { xs: 106, sm: 128 }, overflow: 'hidden' }}>
          {bannerArt && (
            <Box
              component="img"
              src={bannerArt}
              alt=""
              draggable={false}
              sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
          <Box sx={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(90deg, ${alpha(T.bg, 0.95)} 0%, ${alpha(T.bg, 0.72)} 46%, ${alpha(T.bg, 0.5)} 100%),
                         linear-gradient(180deg, transparent 38%, ${alpha(T.bg, 0.96)} 100%)`,
          }} />

          <Box sx={{ position: 'absolute', left: 14, right: 14, bottom: 12, zIndex: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.5 }}>
              <CollectionsBookmarkIcon sx={{ fontSize: 14, color: T.teal }} />
              <Typography sx={{
                fontSize: '0.6rem', fontWeight: 800, letterSpacing: 1.4,
                textTransform: 'uppercase', color: T.teal,
              }}>
                Part of a collection
              </Typography>
            </Box>

            <Typography sx={{
              fontSize: { xs: '1.02rem', sm: '1.2rem' }, fontWeight: 800,
              letterSpacing: -0.3, lineHeight: 1.2, color: T.text,
            }}>
              {collection.name}
            </Typography>

            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: alpha(T.text, 0.6), mt: 0.4 }}>
              <Box component="span" sx={{ color: T.teal, fontWeight: 800 }}>{owned} of {total}</Box>
              {' '}films in your library
            </Typography>

            {/* One segment per film — completion readable without counting cards. */}
            <Box sx={{ display: 'flex', gap: 0.4, mt: 0.8, maxWidth: 240 }}>
              {collection.parts.map((p) => (
                <Box key={p.tmdbId} sx={{
                  height: 3, flex: 1, borderRadius: 999,
                  bgcolor: p.recordId ? T.teal : alpha(T.text, 0.18),
                }} />
              ))}
            </Box>
          </Box>
        </Box>

        {/* Rail */}
        <Box sx={{
          display: 'flex', gap: { xs: 1.1, sm: 1.4 },
          px: { xs: 1.5, sm: 1.75 }, py: 1.75,
          overflowX: 'auto', overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'thin', scrollbarColor: `${alpha(T.text, 0.2)} transparent`,
          '&::-webkit-scrollbar': { height: 5 },
          '&::-webkit-scrollbar-thumb': { background: alpha(T.text, 0.2), borderRadius: 3 },
        }}>
          {collection.parts.map((part, i) => (
            <Box key={part.tmdbId} sx={{ scrollSnapAlign: 'start', display: 'flex' }}>
              <PartCard
                part={part}
                index={i}
                isCurrent={currentTmdbId != null && String(part.tmdbId) === String(currentTmdbId)}
                isMobile={isMobile}
                requested={requestedIds.has(part.tmdbId)}
                busy={busyId === part.tmdbId}
                onRequest={handleRequest}
              />
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
