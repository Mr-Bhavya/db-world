import React, { useCallback } from 'react';
import { Box, Chip, Skeleton, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import StarIcon from '@mui/icons-material/Star';
import { useT } from '@shared/theme/ThemeContext';
import Constants from '@shared/constants';
import { fetchSimilarRecords, tmdbImg } from '../../../api/cinemaApi';
import SectionHeading from '../shared/SectionHeading';

// ─── Related card (compact poster + meta) ────────────────────────────────────
function RelatedCard({ record, isMobile }) {
  const T = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const isMovie  = record.type === 'MOVIE';
  const year = (record.releaseDate ?? '').slice(0, 4);
  const poster = tmdbImg(record.posterPath, 'w342');

  const onClick = useCallback(() => {
    const base = isMovie ? Constants.DB_MOVIE_DETIALS_ROUTE : Constants.DB_SERIES_DETIALS_ROUTE;
    const path = base.replace(':title', `${record.id}-${(record.title ?? '').replace(/\s+/g, '-').toLowerCase()}`);

    if (isMobile) {
      // Mobile always navigates full page — modal UX is bad on small screens.
      navigate(path);
      return;
    }

    // Desktop: preserve the ORIGINAL background if we're already inside a
    // modal. Without this, clicking a related card inside modal A would set
    // A's URL as the new background, so closing the new modal would strand
    // the user on a full-page A instead of returning to the original page
    // (e.g. cinema browse).
    //
    // From a full-page detail (no existing background), use the current
    // location as the background so the new record still opens as a modal
    // overlay — closing it returns to the current page.
    const existingBackground = location.state?.background;
    navigate(path, { state: { background: existingBackground || location } });
  }, [isMovie, isMobile, navigate, record.id, record.title, location]);

  return (
    <Box
      component={motion.div}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      sx={{
        flexShrink: 0,
        // Steps up through the breakpoints so a rail of posters stays legible
        // from a phone at arm's length to a TV across a room.
        width: { xs: 130, sm: 150, md: 170, xl: 200 },
        '@media (min-width:1920px)': { width: 240 },
        cursor: 'pointer',
        position: 'relative',
        '&:hover .related-meta': { opacity: 1 },
      }}
    >
      <Box sx={{
        width: '100%', aspectRatio: '2/3',
        borderRadius: 2, overflow: 'hidden',
        bgcolor: alpha(T.text, 0.06),
        border: `1px solid ${alpha(T.text, 0.08)}`,
        boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
        position: 'relative',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        '&:hover': { boxShadow: '0 12px 32px rgba(0,0,0,0.6)', borderColor: alpha(T.teal, 0.5) },
      }}>
        {poster ? (
          <Box
            component="img"
            src={poster}
            alt={record.title}
            loading="lazy"
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="caption" sx={{ color: T.textFaint }}>No image</Typography>
          </Box>
        )}

        {record.voteAverage > 0 && (
          <Box sx={{
            position: 'absolute', top: 6, right: 6,
            display: 'flex', alignItems: 'center', gap: 0.3,
            bgcolor: alpha('#000', 0.66), backdropFilter: 'blur(8px)',
            border: `1px solid ${alpha('#fff', 0.15)}`,
            borderRadius: 1, px: 0.65, py: 0.25,
          }}>
            <StarIcon sx={{ fontSize: { xs: 11, xl: 13 }, color: '#fbbf24' }} />
            <Typography sx={{
              color: '#fde68a', fontWeight: 800,
              fontSize: { xs: '0.65rem', xl: '0.75rem' },
            }}>
              {Number(record.voteAverage).toFixed(1)}
            </Typography>
          </Box>
        )}
      </Box>

      <Tooltip title={record.title ?? ''}>
        <Typography sx={{
          color: T.text, fontWeight: 700, mt: 0.9, lineHeight: 1.3,
          fontSize: { xs: '0.78rem', xl: '0.88rem' },
          '@media (min-width:1920px)': { fontSize: '1rem' },
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {record.title}
        </Typography>
      </Tooltip>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.35 }}>
        {year && (
          <Typography sx={{
            color: T.textFaint, fontWeight: 600,
            fontSize: { xs: '0.68rem', xl: '0.76rem' },
          }}>
            {year}
          </Typography>
        )}
        <Chip
          label={isMovie ? 'Movie' : 'TV'}
          size="small"
          sx={{
            height: { xs: 16, xl: 19 },
            fontSize: { xs: '0.55rem', xl: '0.62rem' },
            fontWeight: 700,
            bgcolor: alpha(T.teal, 0.15), color: T.teal,
            '& .MuiChip-label': { px: 0.6 },
          }}
        />
      </Box>
    </Box>
  );
}

// ─── RelatedSection ─────────────────────────────────────────────────────────
export default function RelatedSection({ recordId, isMobile }) {
  const T = useT();

  const { data: similar = [], isLoading } = useQuery({
    queryKey: ['cinema-similar', recordId],
    queryFn: () => fetchSimilarRecords(recordId, 12),
    enabled: !!recordId,
    staleTime: 5 * 60 * 1000,
  });

  // Hide entire section when there's nothing to show — no empty header.
  if (!isLoading && (!similar || similar.length === 0)) return null;

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.05 }}
      transition={{ duration: 0.4 }}
      sx={{ py: 3 }}
    >
      <SectionHeading>More Like This</SectionHeading>

      <Box sx={{
        display: 'flex', gap: { xs: 1.25, sm: 1.5 },
        overflowX: 'auto', overflowY: 'hidden',
        pb: 1, mx: { xs: -1, sm: 0 }, px: { xs: 1, sm: 0 },
        scrollbarWidth: 'thin', scrollbarColor: `${alpha(T.text, 0.2)} transparent`,
        '&::-webkit-scrollbar': { height: 5 },
        '&::-webkit-scrollbar-thumb': { background: alpha(T.text, 0.2), borderRadius: 3 },
      }}>
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Box key={i} sx={{
                flexShrink: 0,
                width: { xs: 130, sm: 150, md: 170, xl: 200 },
                '@media (min-width:1920px)': { width: 240 },
              }}>
                {/* height:auto, or MUI's height:1.2em root style defeats aspect-ratio — see
                    CollectionSection for the same trap. */}
                <Skeleton variant="rounded" sx={{ width: '100%', height: 'auto', aspectRatio: '2/3', bgcolor: alpha(T.text, 0.06), borderRadius: 2 }} />
                <Skeleton variant="text" width="80%" sx={{ mt: 0.75, bgcolor: alpha(T.text, 0.06) }} />
                <Skeleton variant="text" width="40%" sx={{ bgcolor: alpha(T.text, 0.06) }} />
              </Box>
            ))
          : similar.map((r) => <RelatedCard key={r.id} record={r} isMobile={isMobile} />)}
      </Box>
    </Box>
  );
}
