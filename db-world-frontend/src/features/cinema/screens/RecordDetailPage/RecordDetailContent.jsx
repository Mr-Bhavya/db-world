import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Container, Skeleton, Typography, useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';

import {
  addLike, addLove, addWatched, addWatchlist,
  fetchInteraction, fetchRecord, tmdbImg,
  removeLike, removeLove, removeWatched, removeWatchlist,
} from '../../api/cinemaApi';
import Constants from '@shared/constants';
import { useT } from '@shared/theme/ThemeContext';

import Hero from './Hero';
import PillNav from './PillNav';
import VideoDialog from './shared/VideoDialog';
import OverviewSection from './sections/OverviewSection';
import CastCrewSection from './sections/CastCrewSection';
import GallerySection from './sections/GallerySection';
import SeasonsSection from './sections/SeasonsSection';
import ReviewsSection from './sections/ReviewsSection';
import WatchSection from './sections/WatchSection';
import RelatedSection from './sections/RelatedSection';
import PersonDetailView from './PersonDetailView';
import { getUserId } from './helpers';

const SECTION_IDS = {
  overview: 'rd-overview',
  watch:    'rd-watch',
  seasons:  'rd-seasons',
  cast:     'rd-cast',
  gallery:  'rd-gallery',
  reviews:  'rd-reviews',
  related:  'rd-related',
};

const actionMap = {
  watchlisted: { add: addWatchlist, remove: removeWatchlist },
  liked:       { add: addLike,      remove: removeLike      },
  loved:       { add: addLove,      remove: removeLove      },
  watched:     { add: addWatched,   remove: removeWatched   },
};

/**
 * Shared content. Rendered both as a full page (via index.jsx) and inside a
 * Dialog (via RecordDetailModal). The `scrollRoot` prop scopes the scrollspy
 * to the dialog's scroll container when inside a modal; otherwise the
 * observer falls back to the viewport.
 */
export default function RecordDetailContent({
  scrollRoot = null,
  inModal = false,
  onClose,
  stickyOffset = 0,
  preview = null,
}) {
  const { title } = useParams();
  const id = title?.split('-')[0];
  const navigate = useNavigate();
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const T = useT();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  // In dark mode lift the body off pure AMOLED black to an elevated charcoal
  // (matches CinemaPage) so sections/cards have depth instead of a flat void.
  const surface = T.bg === '#000000' ? '#141414' : T.bg;

  // ── Cast/crew drill-in ────────────────────────────────────────────────────
  // Clicking a person swaps THIS surface to their detail in place (no separate
  // modal/drawer). Driven by router state so the hardware/browser Back button
  // closes the person view first, returning to the record (not all the way out).
  const personId = location.state?.person ?? null;
  const personScrollRef = useRef(0);

  const openPerson = useCallback((id) => {
    if (!id) return;
    personScrollRef.current = scrollRoot ? scrollRoot.scrollTop : window.scrollY;
    navigate(location.pathname + location.search, { state: { ...location.state, person: id } });
  }, [navigate, location, scrollRoot]);

  const closePerson = useCallback(() => { navigate(-1); }, [navigate]);

  // Scroll to top when drilling in; restore the record's scroll when coming back.
  const prevPersonRef = useRef(personId);
  useEffect(() => {
    const was = prevPersonRef.current;
    prevPersonRef.current = personId;
    if (was === personId) return;
    const y = personScrollRef.current;
    requestAnimationFrame(() => {
      if (personId) {
        if (scrollRoot) scrollRoot.scrollTop = 0; else window.scrollTo(0, 0);
      } else {
        if (scrollRoot) scrollRoot.scrollTop = y; else window.scrollTo(0, y);
      }
    });
  }, [personId, scrollRoot]);

  const [interactionState, setInteractionState] = useState(null);
  const [trailerVideo, setTrailerVideo] = useState(null);
  const userId = getUserId();
  const contentRef = useRef(null);

  // ── Record ─────────────────────────────────────────────────────────────
  const {
    data: record, isLoading: recordLoading, isError: recordError, error: recordErrorObj,
  } = useQuery({
    queryKey: ['cinema-record', id],
    queryFn: () => fetchRecord(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    retry: (count, err) => err?.response?.status !== 401 && err?.response?.status !== 404 && count < 2,
  });

  // ── Interaction ────────────────────────────────────────────────────────
  const { data: interaction } = useQuery({
    queryKey: ['cinema-interaction', userId, id],
    queryFn: () => fetchInteraction(userId, id),
    enabled: !!userId && !!id,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => { if (interaction) setInteractionState(interaction); }, [interaction]);

  useEffect(() => {
    if (!recordError) return;
    const status = recordErrorObj?.response?.status;
    if (status === 401) navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
    else if (status === 404) {
      if (inModal && onClose) onClose();
      else navigate(Constants.DB_CINEMA_BROWSE_ROUTE);
    } else enqueueSnackbar('Failed to load record.', { variant: 'error' });
  }, [recordError, recordErrorObj, navigate, location, enqueueSnackbar, inModal, onClose]);

  const toggleMutation = useMutation({
    mutationFn: async ({ key: _key, active, add, remove }) => active ? remove(id) : add(id),
    onMutate: ({ key, active }) => setInteractionState((prev) => ({ ...prev, [key]: !active })),
    onSuccess: () => qc.invalidateQueries(['cinema-interaction', userId, id]),
    onError: (err, { key, active }) => {
      setInteractionState((prev) => ({ ...prev, [key]: active }));
      if (err?.response?.status === 401) navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
      else enqueueSnackbar('Action failed. Please try again.', { variant: 'error' });
    },
  });

  const handleToggle = useCallback((key, active) => {
    if (!userId) { navigate(Constants.LOGIN_ROUTE, { state: { from: location } }); return; }
    const { add, remove } = actionMap[key];
    toggleMutation.mutate({ key, active, add, remove });
  }, [userId, toggleMutation, navigate, location]);

  // ── First trailer ──────────────────────────────────────────────────────
  const firstTrailer = useMemo(() => {
    const videos = record?.tmdb?.videos ?? [];
    return videos.find((v) => (v.type === 'Trailer' || v.type === 'Teaser') && v.site === 'YouTube') ?? null;
  }, [record]);

  // ── Page meta — page mode only, not modal (modal preserves underlying URL meta) ──
  useEffect(() => {
    if (inModal || !record) return;
    const tmdb = record.tmdb ?? {};
    const isMovie = record.type === 'MOVIE';
    const year = isMovie ? tmdb.releaseDate?.slice(0, 4) : tmdb.firstAirDate?.slice(0, 4);
    const titleStr = [tmdb.title, year].filter(Boolean).join(' (') + (year ? ')' : '');
    const description = tmdb.overview || `Watch ${tmdb.title} on DB Cinema`;
    const image = tmdb.backdropPath
      ? `https://image.tmdb.org/t/p/w1280${tmdb.backdropPath}`
      : tmdb.posterPath
        ? `https://image.tmdb.org/t/p/w500${tmdb.posterPath}`
        : '';

    document.title = `${titleStr} — DB Cinema`;

    const setMeta = (attr, value, content) => {
      let el = document.querySelector(`meta[${attr}="${value}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, value); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', titleStr);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:url', window.location.href);
    setMeta('property', 'og:type', isMovie ? 'video.movie' : 'video.tv_show');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', titleStr);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);

    return () => { document.title = 'DB Cinema'; };
  }, [record, inModal]);

  // ── Compose section list (Seasons only for TV) ─────────────────────────
  // Watch sits right after Overview — users come here primarily to watch, so
  // surface the files near the top instead of burying them at the bottom.
  const isTv = record?.type === 'TV_SERIES';
  const sectionList = useMemo(() => [
    { id: SECTION_IDS.overview, label: 'Overview' },
    { id: SECTION_IDS.watch,    label: 'Watch' },
    ...(isTv ? [{ id: SECTION_IDS.seasons, label: 'Seasons' }] : []),
    { id: SECTION_IDS.cast,     label: 'Cast & Crew' },
    { id: SECTION_IDS.gallery,  label: 'Gallery' },
    { id: SECTION_IDS.reviews,  label: 'Reviews' },
    { id: SECTION_IDS.related,  label: 'More Like This' },
  ], [isTv]);

  // Use native scrollIntoView so the browser picks the nearest scrolling
  // ancestor automatically — works for both modal and page modes without
  // us having to identify which node actually scrolls. Each section has
  // scroll-margin-top set so the landing position accounts for the sticky
  // pill nav.
  const scrollToSection = useCallback((sectionId) => {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // ── Deep-link to Watch when navigated via Play button ──────────────────
  const didAutoJump = useRef(false);
  useEffect(() => {
    if (location.state?.defaultTab === 'Watch' && record && !didAutoJump.current) {
      didAutoJump.current = true;
      // Wait one tick so the section is mounted.
      setTimeout(() => scrollToSection(SECTION_IDS.watch), 80);
    }
  }, [record, location.state, scrollToSection]);

  // ── Loading / error states ─────────────────────────────────────────────
  if (recordLoading) {
    // Instant hero: if the caller passed a card summary, paint its poster/
    // backdrop + title immediately so the open has no grey flash — only the
    // below-the-fold sections skeleton while the full record loads.
    const previewImg = preview && tmdbImg(preview.backdropPath ?? preview.posterPath, 'w780');
    return (
      <Box sx={{ bgcolor: surface, minHeight: inModal ? 'auto' : '100vh' }}>
        <Box sx={{ position: 'relative', width: '100%', height: { xs: 360, sm: 440, md: 500 }, bgcolor: '#050505', overflow: 'hidden' }}>
          {previewImg ? (
            <>
              <Box component="img" src={previewImg} alt="" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', opacity: 0.5 }} />
              <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.45) 45%, transparent 75%)' }} />
              {preview?.title && (
                <Typography variant="h4" sx={{ position: 'absolute', left: { xs: 16, md: 40 }, bottom: 28, right: 16, color: '#fff', fontWeight: 800, lineHeight: 1.1, textShadow: '0 2px 16px rgba(0,0,0,0.9)' }}>
                  {preview.title}
                </Typography>
              )}
            </>
          ) : (
            <Skeleton variant="rectangular" width="100%" height="100%" sx={{ bgcolor: alpha(T.text, 0.07) }} />
          )}
        </Box>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} variant="rounded" width={90} height={32} sx={{ bgcolor: alpha(T.text, 0.07) }} />
            ))}
          </Box>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" width="100%" height={80}
              sx={{ bgcolor: alpha(T.text, 0.05), mb: 2, borderRadius: 1.5 }}
            />
          ))}
        </Container>
      </Box>
    );
  }

  if (recordError || !record) {
    return (
      <Box sx={{ bgcolor: T.bg, minHeight: inModal ? 320 : '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small"
              onClick={() => inModal && onClose ? onClose() : navigate(Constants.DB_CINEMA_BROWSE_ROUTE)}
            >
              {inModal ? 'Close' : 'Browse'}
            </Button>
          }
        >
          Record not found or unavailable.
        </Alert>
      </Box>
    );
  }

  const currentInteraction = interactionState ?? interaction;

  const scrollToWatch = () => scrollToSection(SECTION_IDS.watch);

  if (personId) {
    return (
      <Box ref={contentRef} sx={{ bgcolor: surface, minHeight: inModal ? 'auto' : '100vh' }}>
        <PersonDetailView personId={personId} onBack={closePerson} surface={surface} />
      </Box>
    );
  }

  return (
    <Box ref={contentRef} sx={{ bgcolor: surface }}>
      <Hero
        record={record}
        interaction={currentInteraction}
        onToggle={handleToggle}
        interactionLoading={toggleMutation.isPending}
        onPlayTrailer={firstTrailer ? () => setTrailerVideo(firstTrailer) : null}
        onWatchClick={scrollToWatch}
        onBack={inModal ? onClose : undefined}
        inModal={inModal}
      />

      <PillNav sections={sectionList} scrollRoot={scrollRoot} stickyOffset={stickyOffset} />

      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 3 } }}>
        <Box id={SECTION_IDS.overview} sx={{ scrollMarginTop: stickyOffset + 80 }}>
          <OverviewSection record={record} />
        </Box>
        <Box id={SECTION_IDS.watch} sx={{ scrollMarginTop: stickyOffset + 80 }}>
          <WatchSection recordId={id} record={record} />
        </Box>
        {isTv && (
          <Box id={SECTION_IDS.seasons} sx={{ scrollMarginTop: stickyOffset + 80 }}>
            <SeasonsSection record={record} />
          </Box>
        )}
        <Box id={SECTION_IDS.cast} sx={{ scrollMarginTop: stickyOffset + 80 }}>
          <CastCrewSection record={record} onPersonClick={openPerson} />
        </Box>
        <Box id={SECTION_IDS.gallery} sx={{ scrollMarginTop: stickyOffset + 80 }}>
          <GallerySection record={record} />
        </Box>
        <Box id={SECTION_IDS.reviews} sx={{ scrollMarginTop: stickyOffset + 80 }}>
          <ReviewsSection record={record} recordId={id} />
        </Box>
        <Box id={SECTION_IDS.related} sx={{ scrollMarginTop: stickyOffset + 80 }}>
          <RelatedSection recordId={id} isMobile={isMobile} />
        </Box>
      </Container>

      {trailerVideo && <VideoDialog video={trailerVideo} onClose={() => setTrailerVideo(null)} />}
    </Box>
  );
}
