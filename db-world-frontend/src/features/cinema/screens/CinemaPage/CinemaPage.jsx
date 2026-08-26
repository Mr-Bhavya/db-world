import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { useAuth } from '@features/auth/context/Authentication';
import { useQuery } from '@tanstack/react-query';

import Navbar from '../../navbar';
import HeroBanner from '../../components/HeroBanner/HeroBanner';
import RailRow from '../../components/RailRow/RailRow';
import RailSkeleton from '../../components/RailRow/RailSkeleton';
import ContinueRailRow from '../../components/ContinueRailRow/ContinueRailRow';
import { fetchPageRails, fetchPageCategories } from '../../api/cinemaApi';
import useInteractions from '../../hooks/useInteractions';
import useRailRecords from '../../hooks/useRailRecords';
import { useCategory } from '../../navbar/CategoryContext';
import { genreIdFromSlug, genreNameFromSlug, pagePath } from '../../utils/genreNav';
import { useAnimatedRgbVar } from '../../components/HeroBanner/heroUtils';
import Constants from '@shared/constants';
import usePageMeta from '@shared/hooks/usePageMeta';

const PAGE_MAP = {
  home: 'home',
  browse: 'home',
  movies: 'movies',
  series: 'series',
};

const CinemaPage = ({ pageType = 'home' }) => {
  const apiPage = PAGE_MAP[pageType] ?? 'home';
  // PageType enum the backend expects ('HOME' | 'MOVIES' | 'SERIES'). Sent with
  // each rail-records fetch so a multi-page rail scopes its content to this page.
  const railPageType = apiPage.toUpperCase();
  const section = apiPage === 'movies' ? 'Movies' : apiPage === 'series' ? 'TV Shows' : null;

  // Genre landing page: same section, filtered to one genre, driven entirely by
  // the URL (/db-cinema/movie/genre/28-action) so it survives refresh and Back.
  const { genreSlug } = useParams();
  const category = genreIdFromSlug(genreSlug);

  const { data: categoryData } = useQuery({
    queryKey: ['cinema-categories', apiPage],
    queryFn: () => fetchPageCategories(apiPage),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // The list is already warm whenever the user arrived via the genre menu (same
  // query key), so the de-slugged fallback only shows on a cold direct hit.
  const activeGenre = useMemo(() => {
    if (!category) return null;
    const list = Array.isArray(categoryData) ? categoryData : [];
    return list.find((g) => g.id === category)
      ?? { id: category, name: genreNameFromSlug(genreSlug) };
  }, [category, genreSlug, categoryData]);

  // "Action Movies" / "Comedy" (Home scope) / "TV Shows" / "Browse"
  const pageLabel = section ?? 'Browse';
  const scopeLabel = activeGenre
    ? [activeGenre.name, section].filter(Boolean).join(' ')
    : pageLabel;

  usePageMeta(`${scopeLabel} — DB Cinema`, {
    exact: true,
    description: activeGenre
      ? `Browse ${scopeLabel.toLowerCase()} to stream and download on DB Cinema.`
      : apiPage === 'movies' ? 'Stream and download the latest movies on DB Cinema.'
        : apiPage === 'series' ? 'Binge the latest TV shows and series on DB Cinema.'
          : 'Browse movies and TV shows to stream and download on DB Cinema.',
  });

  const navigate = useNavigate();
  const theme = useTheme();

  // Device buckets
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isMonitor = useMediaQuery('(min-width:1536px)');
  const isTv = useMediaQuery('(min-width:1920px) and (min-height:900px)');
  const isDesktop = !isMobile && !isMonitor && !isTv;
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  // The navbar reads the active genre from context to label its "Categories"
  // entry; the URL is the source of truth, so push it down rather than read it.
  const { selectCategory, clearCategory } = useCategory();
  useEffect(() => {
    if (activeGenre) selectCategory(activeGenre); else clearCategory();
  }, [activeGenre, selectCategory, clearCategory]);

  const [heroColor, setHeroColor] = useState(null);

  const { data: railsData, isLoading: railsLoading } = useQuery({
    queryKey: ['cinema-rails', apiPage, category ?? null],
    queryFn: () => fetchPageRails(apiPage, category),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const rails = useMemo(
    () => (Array.isArray(railsData) ? railsData : []),
    [railsData]
  );

  // Clear the extracted colour ONLY on a real page/genre switch — never on
  // mount. `useHeroColor` fires its callback SYNCHRONOUSLY on a cache hit, and
  // child effects run before parent effects, so on a warm remount (coming back
  // from a record detail, where the colour is already cached) the child set the
  // colour and this effect immediately wiped it back to null — leaving the page
  // with no wash at all. Cold loads escaped it only because the extraction is
  // behind a 220ms debounce.
  const washKeyRef = React.useRef(`${apiPage}|${category ?? ''}`);
  useEffect(() => {
    const key = `${apiPage}|${category ?? ''}`;
    if (washKeyRef.current === key) return;
    washKeyRef.current = key;
    setHeroColor(null);
  }, [apiPage, category]);

  // Genre pages get their own saved scroll position — otherwise picking a genre
  // off a section scrolled halfway down would land you halfway down the new one.
  const scrollKey = `cinema_scroll_${apiPage}${category ? `_g${category}` : ''}`;
  const scrollRestored = React.useRef(false);

  useEffect(() => {
    scrollRestored.current = false;
    return () => {
      sessionStorage.setItem(scrollKey, String(window.scrollY));
    };
  }, [scrollKey]);

  // A never-seen page (picking a genre off a scrolled section) must open at the
  // top — the router keeps the previous scroll offset otherwise. Done before
  // paint, and only when there is nothing to restore, so it can never yank a
  // user who started scrolling while the rails were still loading.
  React.useLayoutEffect(() => {
    if (sessionStorage.getItem(scrollKey) === null) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [scrollKey]);

  useEffect(() => {
    if (railsLoading || rails.length === 0 || scrollRestored.current) return;
    const saved = parseInt(sessionStorage.getItem(scrollKey) || '0', 10);
    if (saved > 0) {
      scrollRestored.current = true;
      const t = setTimeout(() => window.scrollTo({ top: saved, behavior: 'instant' }), 80);
      return () => clearTimeout(t);
    }
  }, [railsLoading, rails.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Continue Watching is rendered by its own component (lower down), so it can't be
  // the hero banner — the hero is the highest-priority rail that isn't it.
  const heroRail = rails.find((r) => r?.rule?.type !== 'continueWatching') ?? null;
  const { records: heroRecords, loading: heroLoading, trigger: heroTrigger } =
    useRailRecords(heroRail?.id, Math.min(heroRail?.limitSize ?? 8, 8), false, category, railPageType);

  // Mobile only: when a hero (or its skeleton) is on the page it reserves the
  // toolbar band itself and runs its artwork under the AppBar, so the navbar
  // must not also emit a spacer. Mirrors HeroBanner's own render condition.
  const heroPresent = railsLoading || heroLoading || heroRecords.length > 0;

  const { auth } = useAuth();
  const user = auth.user;
  const userId = user?.id ?? user?.userId ?? null;

  const {
    interactions,
    loadForRecords,
    toggleWatchlist,
    toggleLike,
    toggleLove,
    toggleWatched,
  } = useInteractions();

  useEffect(() => {
    if (heroRail) heroTrigger();
  }, [heroRail, heroTrigger]);

  useEffect(() => {
    if (userId && heroRecords.length > 0) {
      loadForRecords(userId, heroRecords.map((r) => r.id));
    }
  }, [userId, heroRecords, loadForRecords]);

  const handleWatchlist = useCallback((record) => {
    if (!userId) return;
    toggleWatchlist(userId, record.id, interactions[record.id]?.watchlisted ?? false);
  }, [userId, interactions, toggleWatchlist]);

  const handleLike = useCallback((record) => {
    if (!userId) return;
    toggleLike(userId, record.id, interactions[record.id]?.liked ?? false);
  }, [userId, interactions, toggleLike]);

  const handleLove = useCallback((record) => {
    if (!userId) return;
    toggleLove(userId, record.id, interactions[record.id]?.loved ?? false);
  }, [userId, interactions, toggleLove]);

  const handleWatched = useCallback((record) => {
    if (!userId) return;
    toggleWatched(userId, record.id, interactions[record.id]?.watched ?? false);
  }, [userId, interactions, toggleWatched]);

  const handleExploreAll = useCallback((rail) => {
    const title = rail?.title?.toLowerCase() ?? '';
    if (title.includes('movie') || apiPage === 'movies') {
      navigate(Constants.DB_CINEMA_MOVIES_ROUTE);
    } else if (
      title.includes('series') ||
      title.includes('tv') ||
      title.includes('show') ||
      apiPage === 'series'
    ) {
      navigate(Constants.DB_CINEMA_SERIES_ROUTE);
    } else {
      navigate(Constants.DB_CINEMA_BROWSE_ROUTE);
    }
  }, [apiPage, navigate]);

  // Every rail except the hero, in the backend's priority order. Continue Watching
  // stays in this list (rather than being force-pinned to the top) so its
  // admin-configured priority/position is honoured like any other rail.
  const remainingRails = useMemo(
    () => rails.filter((r) => r !== heroRail),
    [rails, heroRail]
  );

  // ── Billboard shape + heading/breadcrumb per page ──────────────────────────
  // Home = a rounded "spotlight" card; Movies / TV Shows / genre pages = a full-bleed billboard
  // with a page heading and (when a genre is chosen) a "TV Shows › Indian TV Shows" breadcrumb.
  // A genre page always takes the billboard, even under Home, so it reads as a destination.
  const billboardVariant = apiPage === 'home' && !activeGenre ? 'spotlight' : 'billboard';
  // Heading is the GENRE alone, not `scopeLabel`. The billboard renders
  // "{breadcrumb} › {heading}", so passing "Action Movies" next to a "Movies"
  // breadcrumb produced "Movies › Action Movies".
  const billboardHeading = activeGenre ? activeGenre.name : section;
  const billboardBreadcrumb = activeGenre ? pageLabel : null;
  // Makes the section half of the breadcrumb a real way back out.
  const billboardBreadcrumbHref = activeGenre ? pagePath(apiPage) : null;

  // Fixed-px (NOT vh) so whatever sits below the hero rides up onto it by a
  // consistent amount on every screen — a vh overlap grew on big monitors and
  // covered the hero's title and buttons.
  const heroOverlap = billboardVariant === 'spotlight'
    ? { xs: 0, md: '-8px', lg: '-12px' }
    : { xs: 0, md: '-90px', lg: '-110px', xl: '-130px' };

  // Two separate questions, because the badge has to be true.
  //
  //   heroRanked — is this rail ORDERED, so a "#3" means something? (top-10, trending,
  //                popular, rewatch-trending)
  //   heroTop10  — is it actually a TOP TEN? Only then does the red TOP 10 mark, which
  //                is Netflix's device for exactly that row, belong on the card.
  //
  // Everything ordered but not a top ten shows "#3 in <rail name>" instead, which is
  // both honest and more informative than a borrowed badge.
  const heroRanked = useMemo(() => {
    if (!heroRail) return false;
    const t = (heroRail.type ?? '').toLowerCase();
    const title = (heroRail.title ?? '').toLowerCase();
    const ruleType = (heroRail.rule?.type ?? '').toLowerCase();
    return t === 'top10' || ruleType === 'rewatchtrending' || /top\s*10|trending|popular/.test(title);
  }, [heroRail]);

  const heroTop10 = useMemo(() => {
    if (!heroRail) return false;
    const t = (heroRail.type ?? '').toLowerCase();
    return t === 'top10' || /top\s*10/.test((heroRail.title ?? '').toLowerCase());
  }, [heroRail]);

  const safeHeroColor = heroColor || '20,20,20';

  // Drives `--cinema-wash` for both overlays below, tweened frame by frame so
  // the page colour glides between titles instead of cutting.
  const washRef = useAnimatedRgbVar(safeHeroColor, {
    duration: prefersReducedMotion ? 0 : 820,
    varName: '--cinema-wash',
    immediate: prefersReducedMotion,
  });
  // The per-title colour wash is a HOME-only treatment. Movies / TV Shows / genre pages stay
  // neutral (#141414) so the billboard's soft bottom fade doesn't reveal a coloured page beneath it.
  // Gated on the VARIANT only, deliberately not on "has a colour yet".
  //
  // It used to also wait for heroColor, so the overlay faded in (opacity, 700ms)
  // at the same moment its colour was tweening in (rAF, 820ms) — two different
  // curves. The hero's own scrim only does the colour tween, so for a few frames
  // the hero's bottom edge was already tinted while the page underneath was
  // still part-way through fading up, and the seam between hero and rails was
  // visible on every page entry.
  //
  // Now the overlay is simply always on for Home. Until a colour arrives
  // `--cinema-wash` is 20,20,20 — which IS #141414 — so the gradient renders
  // exactly as the page background and is invisible. The colour tween then
  // becomes the only moving part, matching the hero scrim frame for frame
  // (same hook, same duration, same starting value). The opacity transition
  // stays for the real case it serves: switching to Movies / a genre page,
  // where the wash genuinely has to disappear.
  const showWash = billboardVariant === 'spotlight';

  // Device-specific overlay sizing.
  // `solidEnd` is tuned to land just past the hero's bottom edge so the colour
  // wash starts fading exactly where the hero dissolves — the hero and the rails
  // read as one continuous page instead of a hero block sitting on a colour slab.
  const overlayConfig = useMemo(() => {
    if (isTv) {
      return { height: '220vh', solidEnd: 42, fadeMid: 62 };
    }
    if (isMonitor) {
      return { height: '210vh', solidEnd: 42, fadeMid: 62 };
    }
    if (isDesktop) {
      return { height: '200vh', solidEnd: 42, fadeMid: 62 };
    }
    if (isTablet) {
      return { height: '175vh', solidEnd: 44, fadeMid: 64 };
    }
    // mobile xs — the card deck; keep the wash solid around it, fade into the rails
    return { height: '175vh', solidEnd: 52, fadeMid: 68 };
  }, [isDesktop, isMonitor, isTablet, isTv]);

  // Reads `--cinema-wash`, tweened on rAF by useAnimatedRgbVar. A CSS
  // `transition: background` cannot interpolate gradients, so the colour used
  // to snap between titles; keeping the gradient text constant and animating
  // only the variable is what makes it glide.
  const overlayGradient = useMemo(() => {
    const { solidEnd, fadeMid } = overlayConfig;
    const c = 'var(--cinema-wash, 20,20,20)';
    return `
      linear-gradient(
        180deg,
        rgba(${c}, 1) 0%,
        rgba(${c}, 1) ${solidEnd}%,
        rgba(${c}, 0.72) ${fadeMid}%,
        rgba(${c}, 0.34) 82%,
        rgba(${c}, 0.12) 90%,
        #141414 100%
      )
    `;
  }, [overlayConfig]);

  return (
    <Box
      ref={washRef}
      sx={{
        position: 'relative',
        minHeight: '100vh',
        overflowX: 'hidden',
        background: '#141414',
        color: '#fff',
        pb: { xs: '96px', md: 8 },
        '--cinema-bg': '#141414',
      }}
    >
      {/* Device-specific image-color overlay */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: overlayConfig.height,
          pointerEvents: 'none',
          zIndex: 0,
          background: overlayGradient,
          opacity: showWash ? 1 : 0,
          transition: 'opacity 700ms ease',
          willChange: 'opacity',
        }}
      />

      {/* Top ambient glow */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: isTv ? '72vh' : isMonitor ? '68vh' : isTablet ? '58vh' : '52vh',
          pointerEvents: 'none',
          zIndex: 0,
          // Explicit radii, and transparent well before the element's own edge.
          // `ellipse at 50% 0%` sizes itself to the farthest CORNER, which puts the
          // element's bottom edge at roughly 70% along the gradient ray — so a last stop
          // of `transparent 70%` was landing right ON that edge and leaving a faint hard
          // line across the page. `ellipse 130% 100%` pins the vertical radius to the
          // element's height, so 58% is provably 58% of the way down.
          background: `
            radial-gradient(
              ellipse 130% 100% at 50% 0%,
              rgba(var(--cinema-wash, 20,20,20), 0.20) 0%,
              rgba(var(--cinema-wash, 20,20,20), 0.08) 30%,
              transparent 58%,
              transparent 100%
            )
          `,
          opacity: showWash ? 1 : 0,
          transition: 'opacity 700ms ease',
        }}
      />

      {/* Main content */}
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Navbar coverColor={isMobile ? heroColor : null} bleedUnderTop={heroPresent} />

        {/* Hero scrolls away naturally with the page (Netflix-style) — no fade or
            parallax. The rails still ride up over its dissolving bottom edge. */}
        <Box sx={{ position: 'relative', zIndex: 0 }}>
          <HeroBanner
            records={heroRecords}
            interactions={interactions}
            onWatchlist={handleWatchlist}
            loading={railsLoading || heroLoading}
            onColorExtracted={setHeroColor}
            variant={billboardVariant}
            heading={billboardHeading}
            breadcrumb={billboardBreadcrumb}
            breadcrumbHref={billboardBreadcrumbHref}
            ranked={heroRanked}
            top10={heroTop10}
            rankLabel={heroRail?.title ?? null}
          />
        </Box>


        {/* Rails ride up over the hero (desktop) and stay transparent so the
            colour wash shows through. */}
        {/* Fixed-px overlap (NOT vh) so the first rail rides up onto the hero by a
            consistent amount on every screen — a vh overlap grew on big monitors
            and rode up over the hero's title/buttons. */}
        <Box sx={{ position: 'relative', zIndex: 1, background: 'transparent', mt: heroOverlap }}>
          {railsLoading && rails.length === 0 ? (
            <>
              <RailSkeleton />
              <RailSkeleton />
              <RailSkeleton />
            </>
          ) : (
            <>
              {/* Rails render in priority order. The continueWatching rail is swapped
                  for the self-contained ContinueRailRow (progress + resume + remove;
                  hides itself when empty) in place, so it keeps its configured slot. */}
              {remainingRails.map((rail) =>
                rail?.rule?.type === 'continueWatching' ? (
                  <ContinueRailRow key={rail.id} />
                ) : (
                  <RailRow
                    key={rail.id}
                    rail={rail}
                    category={category}
                    pageType={railPageType}
                    interactions={interactions}
                    onWatchlist={handleWatchlist}
                    onLike={handleLike}
                    onLove={handleLove}
                    onWatched={handleWatched}
                    onExplore={handleExploreAll}
                    eager={false}
                  />
                )
              )}
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default CinemaPage;