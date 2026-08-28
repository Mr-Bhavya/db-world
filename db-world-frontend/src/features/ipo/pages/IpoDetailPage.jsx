import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Box, Typography, Button, Tabs, Tab } from '@mui/material';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import { useIpo, useGmpHistory, useSubscriptionHistory } from '../hooks/useIpo';
import { detailTabsFor } from '../utils/format';
import { markListRestoreOnBack } from '../utils/listScrollRestore';
import IpoDetailSkeleton from '../components/IpoDetailSkeleton';
import IpoDetailHero from '../components/IpoDetailHero';
import OverviewTab from '../components/OverviewTab';
import GmpTab from '../components/GmpTab';
import SubscriptionTab from '../components/SubscriptionTab';
import AllotmentTab from '../components/AllotmentTab';
import AdSlot from '@shared/ads/AdSlot';

const PAGE_SX = { pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 24px)' }, px: { xs: 2, sm: 3 }, pb: 4 };

/** Every tab this page can render, keyed the same way as `detailTabsFor`'s output — which of
 * them an individual IPO actually gets is that helper's call, not this map's. */
const TAB_META = {
  overview: { label: 'Overview', Icon: DashboardOutlinedIcon },
  gmp: { label: 'GMP', Icon: ShowChartIcon },
  subscription: { label: 'Subscription', Icon: PeopleAltOutlinedIcon },
  allotment: { label: 'Allotment', Icon: FactCheckOutlinedIcon },
};

// Swipe-gesture tuning. This is touch-only behavior by construction — `onTouchStart`/
// `onTouchEnd` only ever fire from real touch input, so a mouse/trackpad drag on desktop
// never reaches these handlers at all, regardless of these thresholds.
const SWIPE_MIN_DISTANCE = 56; // px — shorter than this reads as a tap or jitter, not a swipe
const SWIPE_MAX_VERTICAL_RATIO = 0.55; // vertical drift allowed, relative to horizontal distance
// A swipe that *starts* inside one of the tabs' own horizontally-scrollable data tables
// (`ScrollableTable`, marked with `data-swipe-ignore`) or an interactive chart's SVG surface
// must drive that element's own gesture, not switch tabs — so gestures originating there are
// ignored outright, before any distance/direction check.
const SWIPE_IGNORE_SELECTOR = '.MuiChartsSurface-root, [data-swipe-ignore]';

/** Slide+fade variants for the swiped/tapped tab-panel transition — `direction` (the
 * `custom` prop, +1/-1) makes the panel always slide "toward" whichever tab you just
 * landed on: entering from the right and exiting to the left when moving to a later tab,
 * mirrored when moving to an earlier one. Small offsets + a short transition (set at the
 * call site) keep it snappy rather than a showy full-width slide. */
const panelVariants = {
  enter: (direction) => ({ x: direction >= 0 ? 24 : -24, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction >= 0 ? -24 : 24, opacity: 0 }),
};

/** Reduced-motion counterpart: the panel still changes, it just cross-fades in place. Matches
 * how the list cards and `adminUi` already behave — this page used to animate unconditionally. */
const fadeVariants = { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } };

export default function IpoDetailPage() {
  const T = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();

  // Whether this detail page was reached from inside the app, captured ONCE at mount. It can't be
  // read live off `location.key` any more: selecting a tab rewrites the query string (below), and
  // even a `replace` mints a fresh key — so a deep-linked visitor who touched a tab would have
  // looked like an in-app arrival and had "back" pop them out of the site entirely.
  const cameFromInApp = useRef(location.key !== 'default');

  // Flag this as a genuine in-app "back to the list" so `IpoListPage` restores its saved
  // scroll position instead of resetting to the top (see `listScrollRestore.js`). For an
  // in-app arrival, pop history so the list's URL — its filter/sort query string AND scroll —
  // is restored as-is; only fall back to a fresh push to the bare list route for a
  // deep-link/first load where there's no list entry to pop back to.
  const backToList = () => {
    markListRestoreOnBack();
    if (cameFromInApp.current) navigate(-1);
    else navigate(Constants.DB_IPO_ROUTE);
  };

  // Which way the LAST tab switch moved (+1/-1, 0 for none), so the AnimatePresence slide always
  // animates toward the newly-selected tab whether that switch came from the tab bar or a swipe.
  const [direction, setDirection] = useState(0);

  const touchRef = useRef({ tracking: false, ignored: false, startX: 0, startY: 0 });

  const { data: ipo, isLoading, isError } = useIpo(id);
  const { data: gmpPoints = [], isLoading: gmpLoading } = useGmpHistory(id);
  const { data: subPoints = [], isLoading: subLoading } = useSubscriptionHistory(id);

  // Stage-driven tab strip: an upcoming IPO has no bids to show and no application to record, so
  // it doesn't get those tabs at all rather than getting two empty shells. Same rule the list
  // cards follow — never offer a slot whose data doesn't exist. The history lengths are passed in
  // so a series that exists without its summary figure still gets a tab.
  const tabs = useMemo(
    () => detailTabsFor(ipo, { gmp: gmpPoints.length, subscription: subPoints.length }),
    [ipo, gmpPoints.length, subPoints.length],
  );

  // Opening an IPO must land at the top of its detail page, never at wherever the list
  // happened to be scrolled to — the browser otherwise keeps the previous page's scroll
  // position across this in-app navigation. Keyed on `id` (not just mount) so navigating
  // detail-to-detail (e.g. via a "similar IPO" link, should one ever exist) also resets.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [id]);

  if (isLoading) {
    return <IpoDetailSkeleton />;
  }

  if (isError || !ipo) {
    return (
      <Box sx={{
        ...PAGE_SX, color: T.textPrimary,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 1.5, minHeight: '50vh',
      }}>
        <Typography sx={{ fontSize: 17, fontWeight: 700 }}>IPO not found</Typography>
        <Typography sx={{ fontSize: 13, color: T.textMuted }}>
          It may have been removed, or the link is incorrect.
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={backToList}
          sx={{ mt: 1, borderColor: T.teal, color: T.teal, '&:hover': { borderColor: T.tealHover, bgcolor: T.tealBg } }}
        >
          Back to IPO Tracker
        </Button>
      </Box>
    );
  }

  // The selected tab lives in the query string so a link to "this IPO's GMP" is shareable and
  // survives a refresh — the same reasoning that put the list's filters there. Written with
  // `replace`, so switching tabs never buries the list under history entries. Anything that
  // isn't currently available for this IPO (a stale link to a hidden tab) falls back to the first.
  const requested = searchParams.get('tab');
  const tab = tabs.includes(requested) ? requested : tabs[0];

  const goToTabIndex = (nextIndex) => {
    const currentIndex = tabs.indexOf(tab);
    const clamped = Math.max(0, Math.min(tabs.length - 1, nextIndex));
    if (clamped === currentIndex) return;
    setDirection(clamped > currentIndex ? 1 : -1);
    const next = new URLSearchParams(searchParams);
    // The first tab is the default view, so it stays out of the URL entirely.
    if (clamped === 0) next.delete('tab');
    else next.set('tab', tabs[clamped]);
    setSearchParams(next, { replace: true });
  };

  const handleTabsChange = (_e, v) => goToTabIndex(tabs.indexOf(v));

  // Touch-swipe to move to the prev/next tab. Deliberately *not* driven by touchmove +
  // preventDefault — that would fight the browser's own scrolling. Instead this only
  // ever inspects the finished gesture (touchend) against where it started (touchstart):
  // native vertical page scroll and the tabs' inner horizontal table/chart scrolling are
  // both left completely alone the entire time, and a swipe is only ever recognized once,
  // after the fact, as "a big enough, horizontal-dominant, non-ignored-origin drag".
  const handlePanelTouchStart = (e) => {
    if (e.touches.length !== 1) {
      touchRef.current.tracking = false;
      return;
    }
    const touch = e.touches[0];
    const ignored = e.target instanceof Element && !!e.target.closest(SWIPE_IGNORE_SELECTOR);
    touchRef.current = { tracking: true, ignored, startX: touch.clientX, startY: touch.clientY };
  };

  const handlePanelTouchEnd = (e) => {
    const { tracking, ignored, startX, startY } = touchRef.current;
    touchRef.current.tracking = false;
    if (!tracking || ignored) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx < SWIPE_MIN_DISTANCE) return; // too short — a tap or minor jitter
    if (absDy > absDx * SWIPE_MAX_VERTICAL_RATIO) return; // not horizontal-dominant enough
    goToTabIndex(tabs.indexOf(tab) + (dx < 0 ? 1 : -1)); // swipe left → next tab, right → prev
  };

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0.15 : 0.25 }}
    >
      <Box sx={{ ...PAGE_SX, color: T.textPrimary, maxWidth: 1100, width: '100%', mx: 'auto' }}>

        {/* Above the card, not inside it. A card is a piece of content; a back button boxed into
            one reads as though leaving were part of this IPO. As a breadcrumb it says what it
            actually is — the way out, and where to. The negative margin pulls the button's own
            padding back so its icon lines up with the card's left edge below it. */}
        <Button
          onClick={backToList}
          startIcon={<ArrowBackIcon sx={{ fontSize: 18 }} />}
          sx={{
            mb: 1.25, ml: -0.75, px: 0.75, minWidth: 0, alignSelf: 'flex-start',
            textTransform: 'none', fontWeight: 700, fontSize: 13, color: T.textMuted,
            '&:hover': { color: T.teal, bgcolor: T.tealBg },
          }}
        >
          IPO Tracker
        </Button>

        <IpoDetailHero ipo={ipo} />

        {/* Sticky under the app bar, for the same reason the list's section headings are: the
            Overview tab runs several screens long, and a tab strip that scrolls away makes the
            other three sections feel like they aren't there. Opaque page background rather than a
            blur — cards sliding under a translucent strip on AMOLED black turn it to mud. */}
        <Box sx={{ position: 'sticky', top: { xs: 56, md: 64 }, zIndex: 3, bgcolor: T.bg, mb: 2 }}>
          <Tabs
            value={tab}
            onChange={handleTabsChange}
            variant="scrollable"
            scrollButtons="auto"
            // No `allowScrollButtonsMobile`: measured on a 375px phone, the two arrows took 80 of
            // the strip's 343px and cut the visible run to 263px, so the third tab read "Subs…"
            // and the fourth was invisible with no hint it existed. Dropping them on touch (where
            // the strip scrolls by finger anyway, and the panel itself swipes between tabs) leaves
            // the fourth tab partly in view, which is the affordance the arrows were meant to be.
            aria-label="IPO detail sections"
            sx={{
              minHeight: 40, borderBottom: `1px solid ${T.border}`,
              '& .MuiTab-root': {
                minHeight: 44, fontSize: 12.5, fontWeight: 700, textTransform: 'none',
                color: T.textMuted, minWidth: 0, px: 1.5, gap: 0.5,
              },
              '& .Mui-selected': { color: `${T.teal} !important` },
              '& .MuiTabs-indicator': { bgcolor: T.teal, height: 2.5, borderRadius: 999 },
              '& .MuiTabs-scrollButtons.Mui-disabled': { opacity: 0.3 },
            }}
          >
            {tabs.map((value) => {
              const { label, Icon } = TAB_META[value];
              return (
                <Tab
                  key={value}
                  value={value}
                  label={label}
                  icon={<Icon sx={{ fontSize: 17 }} />}
                  iconPosition="start"
                />
              );
            })}
          </Tabs>
        </Box>

        <Box
          onTouchStart={handlePanelTouchStart}
          onTouchEnd={handlePanelTouchEnd}
          sx={{ overflowX: 'hidden' }}
        >
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={tab}
              custom={direction}
              variants={reduce ? fadeVariants : panelVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {tab === 'overview' && <OverviewTab ipo={ipo} id={id} />}
              {tab === 'gmp' && <GmpTab ipo={ipo} points={gmpPoints} loading={gmpLoading} />}
              {tab === 'subscription' && <SubscriptionTab ipo={ipo} points={subPoints} loading={subLoading} />}
              {tab === 'allotment' && <AllotmentTab ipo={ipo} />}
            </motion.div>
          </AnimatePresence>

          {/* Below the tab panel — the unit sits under real content on every tab
              rather than between the header and the data the visitor came for. */}
          <AdSlot slot="ipoDetail" minHeight={120} />
        </Box>
      </Box>
    </motion.div>
  );
}
