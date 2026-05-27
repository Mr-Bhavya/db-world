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
        width: { xs: 130, sm: 150, md: 170 },
        cursor: 'pointer',
        position: 'relative',
        '&:hover .related-meta': { opacity: 1 },
      }}
    >
      <Box sx={{
        width: '100%', aspectRatio: '2/3',
        borderRadius: 1.5, overflow: 'hidden',
        bgcolor: alpha(T.text, 0.06),
        boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
        position: 'relative',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: '0 12px 32px rgba(0,0,0,0.6)' },
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
            bgcolor: alpha('#000', 0.72), backdropFilter: 'blur(4px)',
            borderRadius: 0.75, px: 0.6, py: 0.15,
          }}>
            <StarIcon sx={{ fontSize: 10, color: '#46d369' }} />
            <Typography sx={{ color: '#46d369', fontSize: '0.65rem', fontWeight: 700 }}>
              {Number(record.voteAverage).toFixed(1)}
            </Typography>
          </Box>
        )}
      </Box>

      <Tooltip title={record.title ?? ''}>
        <Typography sx={{
          color: T.text, fontWeight: 600, fontSize: '0.78rem', mt: 0.75, lineHeight: 1.25,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {record.title}
        </Typography>
      </Tooltip>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
        {year && (
          <Typography sx={{ color: T.textFaint, fontSize: '0.68rem' }}>{year}</Typography>
        )}
        <Chip
          label={isMovie ? 'Movie' : 'TV'}
          size="small"
          sx={{
            height: 16, fontSize: '0.55rem', fontWeight: 700,
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
              <Box key={i} sx={{ flexShrink: 0, width: { xs: 130, sm: 150, md: 170 } }}>
                <Skeleton variant="rounded" sx={{ width: '100%', aspectRatio: '2/3', bgcolor: alpha(T.text, 0.06) }} />
                <Skeleton variant="text" width="80%" sx={{ mt: 0.75, bgcolor: alpha(T.text, 0.06) }} />
                <Skeleton variant="text" width="40%" sx={{ bgcolor: alpha(T.text, 0.06) }} />
              </Box>
            ))
          : similar.map((r) => <RelatedCard key={r.id} record={r} isMobile={isMobile} />)}
      </Box>
    </Box>
  );
}
