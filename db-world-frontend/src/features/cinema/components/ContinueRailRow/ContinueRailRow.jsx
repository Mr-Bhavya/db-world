import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Box, Typography, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import Constants from '@shared/constants';
import { loadStreamFileInfoByRecordId } from '@shared/services/ApiServices';
import CommonServices from '@shared/services/CommonServices';
import { getContinueWatching, removeContinueWatching } from '../../api/cinemaApi';
import { parseEpisode } from '../../utils/episodeUtils';
import { resolveAndBuildMedia, variantFilesFor } from '../../media/playerLaunch';
import ContinueCard from './ContinueCard';

// Build the player's episode list from a record's media files (one entry per
// season/episode), so resuming a series gets the episode picker + Next button.
const pad = (n) => String(n).padStart(2, '0');
function buildEpisodes(files) {
  const byEp = new Map();
  for (const f of files || []) {
    const ep = parseEpisode(f.fileName);
    if (!ep) continue;
    const key = `${ep.season}x${ep.episode}`;
    if (!byEp.has(key)) byEp.set(key, { f, ep });
  }
  return [...byEp.values()]
    .sort((a, b) => (a.ep.season !== b.ep.season ? a.ep.season - b.ep.season : a.ep.episode - b.ep.episode))
    .map(({ f, ep }) => ({
      id: String(f.id), fileId: String(f.id), mediaFileId: f.id,
      season: ep.season, episode: ep.episode,
      label: `S${pad(ep.season)}E${pad(ep.episode)}`, name: '', url: '',
    }));
}

const SCROLL_AMOUNT = 0.75;
const QUERY_KEY = ['continue-watching'];

/**
 * Continue Watching row — self-contained: fetches the enriched resume tiles,
 * renders a progress bar + resume-on-click + remove per card, and hides itself
 * when there's nothing to resume. Completed titles are filtered server-side.
 */
const ContinueRailRow = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const scrollRef = useRef(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);
  const [resuming, setResuming] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getContinueWatching,
    staleTime: 60 * 1000,
  });

  const removeMut = useMutation({
    mutationFn: (recordId) => removeContinueWatching(recordId),
    // Optimistically drop the tile so the row updates instantly.
    onMutate: async (recordId) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData(QUERY_KEY);
      qc.setQueryData(QUERY_KEY, (old) => (old ?? []).filter((i) => i.recordId !== recordId));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEY, ctx.prev);
      enqueueSnackbar('Could not remove.', { variant: 'error' });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const onResume = useCallback(async (item) => {
    if (resuming) return;
    setResuming(true);
    try {
      const isSeries = item.type === 'TV_SERIES';
      const infoResp = await loadStreamFileInfoByRecordId(item.recordId).catch(() => null);
      const rawFiles = infoResp?.data ?? [];
      const episodes = isSeries ? buildEpisodes(rawFiles) : [];

      // Converted through the same helper Record-Details uses, so quality labels match.
      const converted = CommonServices.convertMediaInfoToCustomFormat(null, rawFiles);
      const current = converted.find(f => f.mediaFileId === item.resumeFileId)
                   ?? { mediaFileId: item.resumeFileId, id: item.resumeFileId };

      // The player resumes from the saved progress for this fileId automatically.
      const media = await resolveAndBuildMedia({
        current,
        variantFiles: variantFilesFor(converted, current, isSeries),
        episodes,
        record: { recordId: item.recordId },
        title: item.title,
        fileId: item.resumeFileId,
      });
      navigate(Constants.DB_PLAYER_ROUTE, { state: { media } });
    } catch {
      enqueueSnackbar('Could not resume playback.', { variant: 'error' });
    } finally {
      setResuming(false);
    }
  }, [resuming, navigate, enqueueSnackbar]);

  const updateButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 8);
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateButtons, { passive: true });
    updateButtons();
    return () => el.removeEventListener('scroll', updateButtons);
  }, [updateButtons, items]);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * SCROLL_AMOUNT, behavior: 'smooth' });
  };

  // Hide entirely when there's nothing in progress.
  if (!isLoading && items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <Box sx={{ mb: { xs: 2.5, md: 3.5 } }}>
        <Box sx={{ px: 'clamp(12px, 4vw, 48px)', mb: 1 }}>
          <Typography variant="h6" sx={{
            color: '#e5e5e5', fontWeight: 700,
            fontSize: 'clamp(0.95rem, 1.5vw, 1.4rem)', letterSpacing: 0.2,
          }}>
            Continue Watching
          </Typography>
        </Box>

        <Box sx={{ position: 'relative' }}>
          {showLeft && !isMobile && (
            <IconButton onClick={() => scroll(-1)} sx={{
              position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
              zIndex: 8, bgcolor: 'rgba(20,20,20,.85)', color: '#fff', height: '100%', width: 40,
              borderRadius: 0, '&:hover': { bgcolor: 'rgba(20,20,20,.95)' },
            }}><ChevronLeft /></IconButton>
          )}
          {showRight && !isMobile && (
            <IconButton onClick={() => scroll(1)} sx={{
              position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
              zIndex: 8, bgcolor: 'rgba(20,20,20,.85)', color: '#fff', height: '100%', width: 40,
              borderRadius: 0, '&:hover': { bgcolor: 'rgba(20,20,20,.95)' },
            }}><ChevronRight /></IconButton>
          )}

          <Box
            ref={scrollRef}
            onScroll={updateButtons}
            sx={{
              display: 'flex', gap: { xs: 1, md: 1.5 },
              overflowX: 'auto', overflowY: 'visible',
              px: 'clamp(12px, 4vw, 48px)', py: '16px', my: '-16px',
              scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {items.map((item) => (
              <ContinueCard
                key={item.recordId}
                item={item}
                onResume={onResume}
                onRemove={(it) => removeMut.mutate(it.recordId)}
              />
            ))}
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

export default ContinueRailRow;
