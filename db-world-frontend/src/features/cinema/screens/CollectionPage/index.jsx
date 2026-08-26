import React, { useEffect } from 'react';
import { Alert, Box, Button, Container, IconButton, Skeleton, Typography, useMediaQuery } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';

import { useT } from '@shared/theme/ThemeContext';
import Constants from '@shared/constants';
import { fetchCollection, tmdbImg } from '../../api/cinemaApi';
import CollectionSection from '../RecordDetailPage/sections/CollectionSection';

/**
 * A collection as a real, linkable destination rather than a label on a movie.
 * Reuses the detail page's CollectionSection for the rail so the two can never
 * drift apart; this page adds the hero and the collection's own synopsis.
 */
export default function CollectionPage() {
  const { collectionId } = useParams();
  const navigate = useNavigate();
  const T = useT();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const surface = T.bg === '#000000' ? '#141414' : T.bg;

  const { data: collection, isLoading, isError } = useQuery({
    queryKey: ['cinema-collection', collectionId],
    queryFn: () => fetchCollection(collectionId),
    enabled: !!collectionId,
    staleTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (!collection?.name) return undefined;
    const prev = document.title;
    document.title = `${collection.name} — DB Cinema`;
    return () => { document.title = prev; };
  }, [collection]);

  const backdrop = tmdbImg(collection?.backdropPath, 'w1280') ?? tmdbImg(collection?.posterPath, 'w780');

  if (isError) {
    return (
      <Box sx={{ bgcolor: surface, minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => navigate(Constants.DB_CINEMA_BROWSE_ROUTE)}>
              Browse
            </Button>
          }
        >
          Collection not found or unavailable.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: surface, minHeight: '100vh' }}>
      <Box
        component="header"
        sx={{
          position: 'relative', width: '100%',
          minHeight: { xs: 260, sm: 320, md: 380 },
          overflow: 'hidden', bgcolor: '#050505',
          display: 'flex', alignItems: 'flex-end',
        }}
      >
        {backdrop && (
          <Box
            component={motion.img}
            src={backdrop}
            alt=""
            draggable={false}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 0.6, scale: 1 }}
            transition={{ opacity: { duration: 0.6 }, scale: { duration: 1.4, ease: 'easeOut' } }}
            sx={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center 25%',
            }}
          />
        )}
        {isLoading && !backdrop && (
          <Skeleton variant="rectangular" sx={{ position: 'absolute', inset: 0, bgcolor: alpha('#fff', 0.05) }} />
        )}

        <Box sx={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `linear-gradient(to top, ${surface} 0%, ${alpha(surface, 0.72)} 30%, ${alpha(surface, 0.1)} 70%, transparent 90%),
                       linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 30%)`,
        }} />

        <IconButton
          size="small"
          aria-label="Go back"
          onClick={() => navigate(-1)}
          sx={{
            position: 'absolute', top: 16, left: { xs: 12, md: 24 }, zIndex: 3,
            bgcolor: alpha('#000', 0.5), color: '#fff',
            backdropFilter: 'blur(10px)',
            border: `1px solid ${alpha('#fff', 0.14)}`,
            '&:hover': { bgcolor: alpha('#000', 0.72) },
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 20 }} />
        </IconButton>

        <Container
          maxWidth="lg"
          component={motion.div}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          sx={{ position: 'relative', zIndex: 2, px: { xs: 2, md: 3 }, pb: { xs: 3, md: 4 } }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mb: 0.7 }}>
            <CollectionsBookmarkIcon sx={{ fontSize: 16, color: T.teal }} />
            <Typography sx={{
              fontSize: '0.66rem', fontWeight: 800, letterSpacing: 1.5,
              textTransform: 'uppercase', color: T.teal,
            }}>
              Collection
            </Typography>
          </Box>

          {isLoading ? (
            <Skeleton variant="text" width={280} height={48} sx={{ bgcolor: alpha('#fff', 0.08) }} />
          ) : (
            <Typography variant="h1" sx={{
              color: '#fff', fontWeight: 800, lineHeight: 1.08,
              fontSize: { xs: '1.7rem', sm: '2.2rem', md: '2.8rem' },
              letterSpacing: -0.6,
              textShadow: '0 2px 18px rgba(0,0,0,0.85)',
            }}>
              {collection?.name}
            </Typography>
          )}

          {collection && (
            <Typography sx={{ mt: 1, fontSize: '0.85rem', fontWeight: 600, color: alpha('#fff', 0.66) }}>
              <Box component="span" sx={{ color: T.teal, fontWeight: 800 }}>
                {collection.ownedCount} of {collection.parts?.length ?? 0}
              </Box>
              {' '}films in your library
            </Typography>
          )}
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 3 }, pb: 6 }}>
        {collection?.overview && (
          <Typography sx={{
            mt: 3, fontSize: '0.9rem', lineHeight: 1.7,
            color: alpha(T.text, 0.72), maxWidth: 760,
          }}>
            {collection.overview}
          </Typography>
        )}

        <CollectionSection collectionId={collectionId} isMobile={isMobile} />
      </Container>
    </Box>
  );
}
