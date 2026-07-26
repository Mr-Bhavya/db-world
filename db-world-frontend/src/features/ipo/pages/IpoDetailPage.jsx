import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Chip, Button, IconButton, Tabs, Tab } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import { useIpo, useGmpHistory, useSubscriptionHistory } from '../hooks/useIpo';
import { IPO_TYPE_LABEL, statusMeta, formatExchange } from '../utils/format';
import { markListRestoreOnBack } from '../utils/listScrollRestore';
import CompanyLogo from '../components/CompanyLogo';
import IpoDetailSkeleton from '../components/IpoDetailSkeleton';
import OverviewTab from '../components/OverviewTab';
import GmpTab from '../components/GmpTab';
import SubscriptionTab from '../components/SubscriptionTab';
import AllotmentTab from '../components/AllotmentTab';

const PAGE_SX = { pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 24px)' }, px: { xs: 2, sm: 3 }, pb: 4 };

const TABS = [
  { value: 'overview', label: 'Overview', Icon: DashboardOutlinedIcon },
  { value: 'gmp', label: 'GMP', Icon: ShowChartIcon },
  { value: 'subscription', label: 'Subscription', Icon: PeopleAltOutlinedIcon },
  { value: 'allotment', label: 'Allotment', Icon: FactCheckOutlinedIcon },
];
const TAB_VALUES = TABS.map((t) => t.value);

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

export default function IpoDetailPage() {
  const T = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  // Flag this as a genuine in-app "back to the list" so `IpoListPage` restores its saved
  // scroll position instead of resetting to the top (see `listScrollRestore.js`).
  const backToList = () => {
    markListRestoreOnBack();
    navigate(Constants.DB_IPO_ROUTE);
  };
  // `tab` + `direction` travel together: `direction` (+1/-1, or 0 for "no change") records
  // which way the *last* switch moved so the AnimatePresence slide below always animates
  // toward the newly-selected tab, whether that switch came from tapping the tab bar or
  // swiping the panel.
  const [[tab, direction], setTabState] = useState(['overview', 0]);

  const goToTabIndex = useCallback((nextIndex) => {
    setTabState(([currentTab]) => {
      const currentIndex = TAB_VALUES.indexOf(currentTab);
      const clampedIndex = Math.max(0, Math.min(TAB_VALUES.length - 1, nextIndex));
      if (clampedIndex === currentIndex) return [currentTab, 0];
      return [TAB_VALUES[clampedIndex], clampedIndex > currentIndex ? 1 : -1];
    });
  }, []);

  const handleTabsChange = (_e, v) => goToTabIndex(TAB_VALUES.indexOf(v));

  // Touch-swipe to move to the prev/next tab. Deliberately *not* driven by touchmove +
  // preventDefault — that would fight the browser's own scrolling. Instead this only
  // ever inspects the finished gesture (touchend) against where it started (touchstart):
  // native vertical page scroll and the tabs' inner horizontal table/chart scrolling are
  // both left completely alone the entire time, and a swipe is only ever recognized once,
  // after the fact, as "a big enough, horizontal-dominant, non-ignored-origin drag".
  const touchRef = useRef({ tracking: false, ignored: false, startX: 0, startY: 0 });

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
    const currentIndex = TAB_VALUES.indexOf(tab);
    goToTabIndex(currentIndex + (dx < 0 ? 1 : -1)); // swipe left → next tab, right → prev
  };

  const { data: ipo, isLoading, isError } = useIpo(id);
  const { data: gmpPoints = [], isLoading: gmpLoading } = useGmpHistory(id);
  const { data: subPoints = [], isLoading: subLoading } = useSubscriptionHistory(id);

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

  const meta = statusMeta(ipo.status, T);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Box sx={{ ...PAGE_SX, color: T.textPrimary, maxWidth: 1100, mx: 'auto' }}>

        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: { xs: 1.5, sm: 2 } }}>
          <IconButton
            onClick={backToList}
            aria-label="Back to IPO Tracker"
            sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, mt: 0.25, flexShrink: 0, p: { xs: 0.75, sm: 1 } }}
          >
            <ArrowBackIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
          </IconButton>
          <CompanyLogo
            logoUrl={ipo.logoUrl}
            logoDomain={ipo.logoDomain}
            companyName={ipo.companyName}
            size={{ xs: 36, sm: 44 }}
          />
          {/* Name-block + chip-group live in ONE flex row that only wraps BETWEEN the two
              of them (`flexWrap: 'wrap'` here) — the chip-group itself is `flexWrap: 'nowrap'`
              so the status badge, ticker and type chip always stay on the same line as each
              other, never each dropping to their own row. A long company name clamps to 2
              lines (`-webkit-line-clamp`) instead of forcing the chips down further. */}
          <Box sx={{
            minWidth: 0, flex: 1, display: 'flex', flexWrap: 'wrap',
            alignItems: 'center', rowGap: 0.5, columnGap: 1,
          }}>
            <Typography sx={{
              flex: '1 1 180px', minWidth: 0,
              fontSize: { xs: 16, sm: 21 }, fontWeight: 800, lineHeight: 1.25,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden', wordBreak: 'break-word',
            }}>
              {ipo.companyName}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0, flexWrap: 'nowrap' }}>
              <Box sx={{ px: 1, py: 0.25, borderRadius: 999, bgcolor: meta.bg, border: `1px solid ${meta.color}55`, flexShrink: 0 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: meta.color, whiteSpace: 'nowrap' }}>{meta.label}</Typography>
              </Box>
              {ipo.tickerSymbol && (
                <Box sx={{ px: 1, py: 0.25, borderRadius: 999, bgcolor: T.tealBg, border: `1px solid ${T.teal}55`, flexShrink: 0 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 800, color: T.teal, whiteSpace: 'nowrap' }}>
                    {formatExchange(ipo.listingExchange)}: {ipo.tickerSymbol}
                  </Typography>
                </Box>
              )}
              <Chip
                label={IPO_TYPE_LABEL[ipo.ipoType] ?? ipo.ipoType ?? 'IPO'}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: 11, borderColor: T.border, color: T.textMuted, flexShrink: 0 }}
              />
            </Box>
          </Box>
        </Box>

        <Tabs
          value={tab}
          onChange={handleTabsChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="IPO detail sections"
          sx={{
            mb: 2, minHeight: 40, borderBottom: `1px solid ${T.border}`,
            '& .MuiTab-root': {
              minHeight: 44, fontSize: 12.5, fontWeight: 700, textTransform: 'none',
              color: T.textMuted, minWidth: 0, px: 1.5, gap: 0.5,
            },
            '& .Mui-selected': { color: `${T.teal} !important` },
            '& .MuiTabs-indicator': { bgcolor: T.teal, height: 2.5, borderRadius: 999 },
            '& .MuiTabs-scrollButtons.Mui-disabled': { opacity: 0.3 },
          }}
        >
          {TABS.map(({ value, label, Icon }) => (
            <Tab key={value} value={value} label={label} icon={<Icon sx={{ fontSize: 17 }} />} iconPosition="start" />
          ))}
        </Tabs>

        <Box
          onTouchStart={handlePanelTouchStart}
          onTouchEnd={handlePanelTouchEnd}
          sx={{ overflowX: 'hidden' }}
        >
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={tab}
              custom={direction}
              variants={panelVariants}
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
        </Box>
      </Box>
    </motion.div>
  );
}
