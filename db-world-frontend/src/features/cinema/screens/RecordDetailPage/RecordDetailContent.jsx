import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Container, Skeleton, useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';

import {
  addLike, addLove, addWatched, addWatchlist,
  fetchInteraction, fetchRecord, fetchSimilarRecords, getContinueWatching,
  removeLike, removeLove, removeWatched, removeWatchlist,
  fetchRecordMediaRequests, toggleMediaRequestVote,
} from '../../api/cinemaApi';
import { loadStreamFileInfoByRecordId, getRecordProgress } from '@shared/services/ApiServices';
import CommonServices from '@shared/services/CommonServices';
import Constants from '@shared/constants';
import { useT } from '@shared/theme/ThemeContext';
import { useRequireAuth } from '@features/auth/useRequireAuth';

import Hero from './Hero';
import PillNav from './PillNav';
import VideoDialog from './shared/VideoDialog';
import OverviewSection from './sections/OverviewSection';
import CastCrewSection from './sections/CastCrewSection';
import CollectionSection from './sections/CollectionSection';
import GallerySection from './sections/GallerySection';
import SeasonsSection from './sections/SeasonsSection';
import { progressByFile } from '../../utils/watchProgress';
import ReviewsSection from './sections/ReviewsSection';
import RelatedSection from './sections/RelatedSection';
import PersonDetailView from './PersonDetailView';
import StickyWatchBar from './StickyWatchBar';
import AdSlot from '@shared/ads/AdSlot';
import DownloadSheet from './DownloadSheet';
import { getUserId } from './helpers';
import { resolveAndBuildMedia, variantFilesFor } from '../../media/playerLaunch';
import { buildHybridEpisodes, episodeRefOf } from '../../utils/episodeUtils';
import {
  DEFAULT_KIND, applyVote, indexRequests, requestScopeKey, scopeSuffix,
} from '../../utils/requestScope';

const SECTION_IDS = {
  overview: 'rd-overview',
  seasons: 'rd-seasons',
  collection: 'rd-collection',
  cast: 'rd-cast',
  gallery: 'rd-gallery',
  reviews: 'rd-reviews',
  related: 'rd-related',
};

/** "1h 45m" / "12m" — the hero's time-remaining subline. */
const formatRemaining = (ms) => {
  if (!ms || ms <= 0) return null;
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const actionMap = {
  watchlisted: { add: addWatchlist, remove: removeWatchlist },
  liked: { add: addLike, remove: removeLike },
  loved: { add: addLove, remove: removeLove },
  watched: { add: addWatched, remove: removeWatched },
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
  // Browsing this page is open to everyone; acting on it is not. Each handler below
  // is wrapped so a signed-out visitor gets the sign-in prompt instead of a dead
  // click or a 401 toast.
  const { requireAuth } = useRequireAuth();
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

  // Preview record shaped like the full record, so the SAME layout renders at once
  // from the rail/hover summary and then FILLS IN when the full record arrives —
  // no loading-branch swap, no fade-from-blank, no double flash. The preview
  // already carries title/backdrop/poster/rating/year; everything else skeletons.
  const previewRecord = useMemo(() => {
    if (!preview) return null;
    return {
      id,
      type: preview.type ?? null,
      tmdb: {
        title: preview.title ?? null,
        posterPath: preview.posterPath ?? null,
        backdropPath: preview.backdropPath ?? null,
        voteAverage: preview.voteAverage ?? null,
        releaseDate: preview.releaseDate ?? null,
        firstAirDate: preview.releaseDate ?? null,
      },
    };
  }, [preview, id]);

  const displayRecord = record ?? previewRecord;
  const fullLoaded = !!record;

  // ── Media files ────────────────────────────────────────────────────────
  // Owned here rather than inside the Watch section so the hero can advertise
  // the best available quality/HDR/audio, and so both consumers share one fetch.
  const { data: mediaFiles = [] } = useQuery({
    queryKey: ['record-media-files', id],
    queryFn: async () => {
      const res = await loadStreamFileInfoByRecordId(id);
      return res?.httpStatusCode === 200
        ? CommonServices.convertMediaInfoToCustomFormat(null, res.data)
        : [];
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  // ── Watch progress ─────────────────────────────────────────────────────
  // Same query key as the Continue Watching rail, so arriving from the cinema
  // page costs nothing.
  const { data: continueItems = [] } = useQuery({
    queryKey: ['continue-watching'],
    queryFn: getContinueWatching,
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  // This record's Continue Watching entry: how far along the hero bar draws, and which
  // file the Watch button should open. Completed titles are filtered out server-side,
  // so a finished series simply has no entry and starts over.
  const continueItem = useMemo(
    () => continueItems.find((c) => String(c?.recordId) === String(id)) ?? null,
    [continueItems, id],
  );

  const progress = useMemo(() => {
    const dur = continueItem?.durationMs ?? 0;
    const pos = continueItem?.positionMs ?? 0;
    if (!continueItem || dur <= 0 || pos <= 0) return null;
    return {
      percent: Math.min(100, Math.max(2, (pos / dur) * 100)),
      remainingLabel: formatRemaining(dur - pos),
    };
  }, [continueItem]);

  // ── Similar titles ─────────────────────────────────────────────────────
  // Same key and params as RelatedSection's own query, so TanStack dedupes it
  // to a single request. Read here only to decide whether the section (and its
  // nav pill) should exist at all.
  // Per-episode watched bars. Same one-request-per-record call the player uses, so the
  // bar on an episode row here and in the player's episode list agree.
  const { data: watchProgress = {} } = useQuery({
    queryKey: ['record-progress', id, userId],
    queryFn: () => getRecordProgress(id).then(progressByFile),
    enabled: !!id && !!userId,
    staleTime: 30_000,
  });

  const { data: similarRecords = [] } = useQuery({
    queryKey: ['cinema-similar', id],
    queryFn: () => fetchSimilarRecords(id, 12),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
  const hasRelated = similarRecords.length > 0;

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
    } else notify.error('Failed to load record.');
  }, [recordError, recordErrorObj, navigate, location, inModal, onClose]);

  const toggleMutation = useMutation({
    mutationFn: async ({ key: _key, active, add, remove }) => active ? remove(id) : add(id),
    onMutate: ({ key, active }) => setInteractionState((prev) => ({ ...prev, [key]: !active })),
    onSuccess: () => qc.invalidateQueries(['cinema-interaction', userId, id]),
    onError: (err, { key, active }) => {
      setInteractionState((prev) => ({ ...prev, [key]: active }));
      if (err?.response?.status === 401) navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
      else notify.error('Action failed. Please try again.');
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
    return videos.find((v) => {
      const type = v.type?.toUpperCase();
      const site = v.site?.toUpperCase();
      return (type === 'TRAILER' || type === 'TEASER') && site === 'YOUTUBE';
    }) ?? null;
  }, [record])


  // ── Playback & downloads ───────────────────────────────────────────────
  // The old Watch section made everyone choose a file before they could press
  // play. Play now resolves the best file for this device and connection and
  // goes straight to the player; the file list survives as an on-demand sheet.

  const [downloadFiles, setDownloadFiles] = useState(null);   // null = closed
  const [downloadLabel, setDownloadLabel] = useState(null);

  const hasFiles = mediaFiles.length > 0;

  // ── Requests ───────────────────────────────────────────────────────────
  // Every PENDING request on this record, at whatever scope: the whole title, a
  // season, a single episode. One call feeds the hero button AND every episode row,
  // and it carries the vote counts, so "3 waiting" is the server's number and not
  // an optimistic guess.
  //
  // It also replaces a local boolean that started false on every mount, so a
  // returning voter was shown "Request this" and their click silently WITHDREW
  // the request they had already made.
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['cinema-media-requests', id],
    queryFn: () => fetchRecordMediaRequests(id),
    enabled: !!userId && !!id,
    staleTime: 60 * 1000,
  });
  const requestIndex = useMemo(() => indexRequests(pendingRequests), [pendingRequests]);
  const recordRequest = requestIndex.get(requestScopeKey({ kind: DEFAULT_KIND }));

  const requestMutation = useMutation({
    mutationFn: ({ season, episode }) => toggleMediaRequestVote(id, DEFAULT_KIND, { season, episode }),
    onSuccess: (res) => {
      // Fold the authoritative row back in rather than refetching: the response
      // already carries the new count for exactly the scope that was pressed.
      qc.setQueryData(['cinema-media-requests', id], (prev) => applyVote(prev, res));
      const what = scopeSuffix(res?.scopeLabel);
      notify[res?.hasMyVote ? 'success' : 'info'](res?.hasMyVote
        ? `Requested${what} — you'll be notified when it lands.`
        : `Request${what} withdrawn.`);
    },
    onError: (err) => {
      if (err?.response?.status === 401) navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
      else notify.error('Could not send the request.');
    },
  });

  /**
   * Toggle a request. No argument asks for the whole title (a movie, or a series with
   * nothing in the library at all); `{ season }` asks for one season and
   * `{ season, episode }` for one episode.
   */
  const requestScoped = useCallback((scope = {}) => {
    requestMutation.mutate({ season: scope.season ?? null, episode: scope.episode ?? null });
  }, [requestMutation]);

  const handleRequest = useMemo(
    () => requireAuth(requestScoped, 'Sign in to request this title'),
    [requireAuth, requestScoped],
  );

  /** Launch the player on `files`, letting resolveAndBuildMedia auto-pick. */
  const launch = useCallback(async (candidateFiles, epRef = null) => {
    const pool = (candidateFiles ?? []).filter(Boolean);
    if (!pool.length) { notify.warning('No playable file for this title yet.'); return; }

    try {
      const seed = pool[0];
      const episodes = buildHybridEpisodes(mediaFiles, seed, record?.tmdb?.seasons);
      const media = await resolveAndBuildMedia({
        current: seed,
        // For an episode the pool IS the variant set; for a movie every file of the
        // record is a variant of the same picture. Hard-coding that second case as
        // "not a series" put EVERY episode of a show in the player's quality menu
        // whenever playback started from the hero button rather than an episode row.
        variantFiles: epRef ? pool : variantFilesFor(mediaFiles, seed, episodes.length > 0),
        episodes,
        record,
        title: record?.tmdb?.title ?? record?.name ?? '',
        autoPick: true,
      });
      navigate(Constants.playerPath(media.mediaFileId || media.fileId), { state: { media } });
    } catch {
      notify.error('Failed to prepare the stream.');
    }
  }, [mediaFiles, record, navigate]);

  /**
   * The hero's Watch/Resume button.
   *
   * Continue Watching already resolves where to pick up — a part-watched episode, or
   * the next one after a finished episode — so the button reads `resumeFileId` instead
   * of re-deriving it, and therefore can't disagree with the Home rail. Without this it
   * always opened mediaFiles[0]: episode 1 of a show you were ten episodes into, and
   * for a movie the wrong master, which lost the saved position too.
   */
  const playResume = useCallback(() => {
    const resumeFile = continueItem?.resumeFileId
      ? mediaFiles.find((f) => String(f.mediaFileId ?? f.id) === String(continueItem.resumeFileId))
      : null;
    if (!resumeFile) { launch(mediaFiles); return; }

    const ref = episodeRefOf(resumeFile);
    // Seed the pool with the file being resumed: `launch` takes pool[0] as the file
    // whose saved position and progress key are used.
    const siblings = variantFilesFor(mediaFiles, resumeFile, !!ref);
    const pool = [resumeFile, ...siblings.filter((f) => f !== resumeFile)];
    launch(pool, ref ? { season: ref.season, episode: ref.episode } : null);
  }, [launch, mediaFiles, continueItem]);

  const openDownloads = useCallback(() => {
    setDownloadFiles(mediaFiles);
    setDownloadLabel(null);
  }, [mediaFiles]);

  const playEpisode = useCallback((ep) => {
    launch(ep?.files, { season: ep?.seasonNumber, episode: ep?.episodeNumber });
  }, [launch]);

  const downloadEpisode = useCallback((ep) => {
    setDownloadFiles(ep?.files ?? []);
    setDownloadLabel(
      ep?.seasonNumber != null && ep?.episodeNumber != null
        ? `S${String(ep.seasonNumber).padStart(2, '0')}E${String(ep.episodeNumber).padStart(2, '0')}`
        : null,
    );
  }, []);

  // Streaming and downloading are the two hard gates — the routes behind them
  // (/player, the media-files page) are PrivateRoute'd anyway, so prompting here
  // just replaces a jarring bounce-to-login with an explicit ask.
  const handlePlay = useMemo(
    () => requireAuth(playResume, 'Sign in to watch'),
    [requireAuth, playResume],
  );
  const handleOpenDownloads = useMemo(
    () => requireAuth(openDownloads, 'Sign in to download'),
    [requireAuth, openDownloads],
  );
  const handlePlayEpisode = useMemo(
    () => requireAuth(playEpisode, 'Sign in to watch'),
    [requireAuth, playEpisode],
  );
  const handleDownloadEpisode = useMemo(
    () => requireAuth(downloadEpisode, 'Sign in to download'),
    [requireAuth, downloadEpisode],
  );

  // ── Page meta ──
  useEffect(() => {
    if (!record) return;
    const prev = document.title;
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

    if (!inModal) {
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
    }

    return () => { document.title = prev; };
  }, [record, inModal]);

  // ── Compose section list (Seasons only for TV) ─────────────────────────
  // Watch sits right after Overview — users come here primarily to watch, so
  // surface the files near the top instead of burying them at the bottom.
  const isTv = displayRecord?.type === 'TV_SERIES';
  // Movies only — TMDB models collections as a movie-side relation.
  const collectionId = record?.tmdb?.belongsToCollection?.id ?? null;

  // Obscure titles arrive with no credits, no artwork and no videos. Listing
  // those sections anyway gives the user a pill that scrolls to a blank strip,
  // so the nav is built from what this record actually has.
  const hasCast    = (record?.tmdb?.credits?.length ?? 0) > 0;
  const hasGallery = (record?.tmdb?.videos?.length ?? 0) > 0
                  || (record?.tmdb?.images?.length ?? 0) > 0;
  const hasSeasons = isTv && (record?.tmdb?.seasons?.length ?? 0) > 0;

  const sectionList = useMemo(() => [
    { id: SECTION_IDS.overview, label: 'Overview' },
    ...(hasSeasons ? [{ id: SECTION_IDS.seasons, label: 'Episodes' }] : []),
    ...(collectionId ? [{ id: SECTION_IDS.collection, label: 'Collection' }] : []),
    ...(hasCast ? [{ id: SECTION_IDS.cast, label: 'Cast & Crew' }] : []),
    ...(hasGallery ? [{ id: SECTION_IDS.gallery, label: 'Gallery' }] : []),
    // Reviews always shows: even with nothing to read, the user can write one.
    { id: SECTION_IDS.reviews, label: 'Reviews' },
    // Related is fetched by its own section and hides itself when empty, so the
    // pill is only meaningful once we know there's something behind it.
    ...(hasRelated ? [{ id: SECTION_IDS.related, label: 'More Like This' }] : []),
  ], [hasSeasons, collectionId, hasCast, hasGallery, hasRelated]);

  // Use native scrollIntoView so the browser picks the nearest scrolling
  // ancestor automatically — works for both modal and page modes without
  // us having to identify which node actually scrolls. Each section has
  // scroll-margin-top set so the landing position accounts for the sticky
  // pill nav.
  const scrollToSection = useCallback((sectionId) => {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // ── Arrived via a Play affordance elsewhere (recordNav's `play` flag) ────
  // There's no Watch section to jump to any more. A series still needs the
  // episode picker — you can't play "a series" — but a movie can just go, which
  // is what the caller was asking for in the first place.
  const didAutoJump = useRef(false);
  useEffect(() => {
    if (location.state?.defaultTab !== 'Watch' || !record || didAutoJump.current) return;
    didAutoJump.current = true;
    if (hasSeasons) {
      setTimeout(() => scrollToSection(SECTION_IDS.seasons), 80);
    } else if (mediaFiles.length) {
      handlePlay();
    }
  }, [record, location.state, scrollToSection, hasSeasons, mediaFiles, handlePlay]);

  // ── Error / empty states ───────────────────────────────────────────────
  // Only fall back to a bare skeleton when there's NO preview to render from
  // (e.g. opened via a direct URL). With a preview, we go straight to the real
  // layout below and let it fill in.
  if (!displayRecord && recordLoading) {
    return (
      <Box sx={{ bgcolor: surface, minHeight: inModal ? 'auto' : '100vh' }}>
        <Box sx={{ position: 'relative', width: '100%', height: { xs: 360, sm: 440, md: 500 }, bgcolor: '#050505', overflow: 'hidden' }}>
          <Skeleton variant="rectangular" width="100%" height="100%" sx={{ bgcolor: alpha(T.text, 0.07) }} />
        </Box>
        <Container maxWidth={false} sx={{
          py: 4, px: { xs: 2, md: 3, xl: 5 },
          maxWidth: { xs: '100%', lg: 1200, xl: 1560 },
          '@media (min-width:1920px)': { maxWidth: 1840, px: 8 },
          mx: 'auto',
        }}>
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

  if (recordError || !displayRecord) {
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

  if (personId) {
    return (
      // Fill the surface (100% of the sheet/modal scroller, 100vh on the full
      // page) so a person with little data doesn't leave a black bar below.
      <Box ref={contentRef} sx={{ bgcolor: surface, minHeight: inModal ? '100%' : '100vh', display: 'flex', flexDirection: 'column' }}>
        <PersonDetailView personId={personId} onBack={closePerson} surface={surface} />
      </Box>
    );
  }

  return (
    <Box ref={contentRef} sx={{ bgcolor: surface }}>
      <Hero
        record={displayRecord}
        loading={!fullLoaded}
        interaction={currentInteraction}
        onToggle={handleToggle}
        onPlayTrailer={firstTrailer ? () => setTrailerVideo(firstTrailer) : null}
        onWatchClick={hasFiles ? handlePlay : null}
        onDownloadClick={hasFiles ? handleOpenDownloads : null}
        onRequestClick={fullLoaded && !hasFiles ? () => handleRequest() : null}
        requested={!!recordRequest?.hasMyVote}
        onBack={inModal ? onClose : undefined}
        inModal={inModal}
        preview={preview}
        files={mediaFiles}
        progress={progress}
        trailerKey={firstTrailer?.site === 'YOUTUBE' ? firstTrailer.key : null}
      />

      {/* onDismiss surfaces a back control inside the bar once it sticks, so the
          hero's own close can scroll away instead of sitting on top of the tabs. */}
      <PillNav
        sections={sectionList}
        scrollRoot={scrollRoot}
        stickyOffset={stickyOffset}
        onDismiss={inModal ? onClose : () => window.history.back()}
        title={displayRecord?.tmdb?.title ?? displayRecord?.name ?? null}
      />

      {fullLoaded ? (
        <Container maxWidth={false} sx={{
          px: { xs: 2, md: 3, xl: 5 },
          // A fixed lg cap wasted half a 27" monitor and most of a TV, but an
          // uncapped column runs unreadably long lines — so the ceiling rises
          // with the viewport instead of being fixed or absent.
          maxWidth: { xs: '100%', lg: 1200, xl: 1560 },
          '@media (min-width:1920px)': { maxWidth: 1840, px: 8 },
          mx: 'auto',
          // StickyWatchBar is position:fixed and mobile-only, so it sits OVER
          // the last section unless the page reserves its height (bar + the
          // iOS home indicator it clears).
          pb: { xs: 'calc(84px + env(safe-area-inset-bottom))', md: 4 },
          // Several sections are horizontal rails. Any one of them that fails to
          // shrink hands the whole PAGE a horizontal scrollbar, which is a
          // miserable thing to hit on a phone.
          //
          // `clip`, deliberately not `hidden`: an ancestor with overflow:hidden
          // silently kills position:sticky for everything inside it, and the
          // pill nav depends on that.
          overflowX: 'clip',
        }}>
          <Box id={SECTION_IDS.overview} sx={{ scrollMarginTop: stickyOffset + 80 }}>
            <OverviewSection record={record} />
          </Box>
          {hasSeasons && (
            <Box id={SECTION_IDS.seasons} sx={{ scrollMarginTop: stickyOffset + 80 }}>
              <SeasonsSection
                record={record}
                files={mediaFiles}
                onPlayEpisode={handlePlayEpisode}
                onDownloadEpisode={handleDownloadEpisode}
                onRequest={handleRequest}
                requests={requestIndex}
                progress={watchProgress}
              />
            </Box>
          )}
          {collectionId && (
            <Box id={SECTION_IDS.collection} sx={{ scrollMarginTop: stickyOffset + 80 }}>
              <CollectionSection
                collectionId={collectionId}
                currentTmdbId={record?.tmdbId ?? record?.tmdb?.id}
                isMobile={isMobile}
              />
            </Box>
          )}
          {hasCast && (
            <Box id={SECTION_IDS.cast} sx={{ scrollMarginTop: stickyOffset + 80 }}>
              <CastCrewSection record={record} onPersonClick={openPerson} />
            </Box>
          )}
          {hasGallery && (
            <Box id={SECTION_IDS.gallery} sx={{ scrollMarginTop: stickyOffset + 80 }}>
              <GallerySection record={record} />
            </Box>
          )}
          <Box id={SECTION_IDS.reviews} sx={{ scrollMarginTop: stickyOffset + 80 }}>
            <ReviewsSection record={record} recordId={id} />
          </Box>
          {hasRelated && (
            <Box id={SECTION_IDS.related} sx={{ scrollMarginTop: stickyOffset + 80 }}>
              <RelatedSection recordId={id} isMobile={isMobile} />
            </Box>
          )}

          {/* Last thing on the page, below every real section. Kept out of the hero
              and away from the action row so a mis-tap can never land on an ad. */}
          <AdSlot slot="cinemaDetail" minHeight={120} />
        </Container>
      ) : (
        // Same-layout skeletons for the below-the-fold sections; they fill in when
        // the full record arrives (no subtree swap → no flash).
        <Container maxWidth={false} sx={{
          px: { xs: 2, md: 3, xl: 5 }, py: 3,
          maxWidth: { xs: '100%', lg: 1200, xl: 1560 },
          '@media (min-width:1920px)': { maxWidth: 1840, px: 8 },
          mx: 'auto',
        }}>
          <Skeleton variant="text" width={160} height={32} sx={{ bgcolor: alpha(T.text, 0.08), mb: 1.5 }} />
          <Skeleton variant="text" width="94%" height={18} sx={{ bgcolor: alpha(T.text, 0.06) }} />
          <Skeleton variant="text" width="88%" height={18} sx={{ bgcolor: alpha(T.text, 0.06) }} />
          <Skeleton variant="text" width="70%" height={18} sx={{ bgcolor: alpha(T.text, 0.06), mb: 3 }} />
          <Skeleton variant="text" width={140} height={28} sx={{ bgcolor: alpha(T.text, 0.08), mb: 1.5 }} />
          <Box sx={{ display: 'flex', gap: 2, overflow: 'hidden' }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Box key={i} sx={{ flexShrink: 0 }}>
                <Skeleton variant="rounded" width={120} height={72} sx={{ bgcolor: alpha(T.text, 0.06), mb: 1, borderRadius: 1.5 }} />
                <Skeleton variant="text" width={90} height={14} sx={{ bgcolor: alpha(T.text, 0.05) }} />
              </Box>
            ))}
          </Box>
        </Container>
      )}

      {fullLoaded && hasFiles && (
        <StickyWatchBar
          record={record}
          progress={progress}
          onWatchClick={handlePlay}
          scrollRoot={scrollRoot}
        />
      )}

      <DownloadSheet
        open={downloadFiles !== null}
        onClose={() => setDownloadFiles(null)}
        files={downloadFiles ?? []}
        record={record}
        subheading={downloadLabel}
      />

      {trailerVideo && <VideoDialog video={trailerVideo} onClose={() => setTrailerVideo(null)} />}
    </Box>
  );
}
