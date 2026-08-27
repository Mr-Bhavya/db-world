import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useT } from '@shared/theme';
import { useIpos } from '../hooks/useIpo';
import { formatIstTime } from '../utils/format';
import IpoHero from '../components/IpoHero';
import IpoFilterBar from '../components/IpoFilterBar';
import IpoCard from '../components/IpoCard';
import IpoCardSkeleton from '../components/IpoCardSkeleton';
import WhyUseThis from '../components/WhyUseThis';
import IpoLearn from '../components/IpoLearn';
import AdSlot from '@shared/ads/AdSlot';
import { consumeListScrollRestore } from '../utils/listScrollRestore';

const SKELETON_COUNT = 8;

const DEFAULT_TYPE = 'mainboard';
const DEFAULT_SORT = 'date';

export default function IpoListPage() {
  const T = useT();

  // Filter/sort live in the URL query string (not local state) so that leaving for an IPO's
  // detail page and coming back — via the detail page's history "back" — lands on the SAME
  // filtered/sorted list, instead of resetting to defaults on remount. Also makes a filtered
  // view shareable/bookmarkable and survive a refresh. Absent params fall back to the defaults.
  const [searchParams, setSearchParams] = useSearchParams();
  const type = searchParams.get('type') || DEFAULT_TYPE;
  const status = searchParams.get('status') || '';
  const sort = searchParams.get('sort') || DEFAULT_SORT;

  const { data, isLoading } = useIpos({ status, type, sort });
  const ipos = data?.ipos ?? [];
  const lastUpdated = formatIstTime(data?.lastUpdated);
  const hasActiveFilter = !!status || type !== 'all';

  // Bonus (nice-to-have): remember where the user was scrolled to on the list so a genuine
  // in-app "back" from an IPO's detail page restores it, instead of always dropping back to
  // the top of a long list. The save side of this lives in `IpoCard` (on the card-click
  // navigation into a detail) and the flag side in `IpoDetailPage` (on its back action) —
  // see `listScrollRestore.js`. Deliberately *not* saved/restored here on generic
  // mount/unmount: that would replay a stale position for any other way of reaching this
  // page (header nav, `MyIposPage`'s own back button, a fresh load, a browser refresh),
  // none of which should ever land anywhere but the top.
  //
  // Runs once the list has actually rendered (there's nothing to scroll to before then) —
  // `scrollRestored` guards against re-running on later filter/sort changes, which reuse
  // this same isLoading/ipos state but shouldn't re-trigger a scroll jump.
  const scrollRestored = useRef(false);
  useEffect(() => {
    if (isLoading || ipos.length === 0 || scrollRestored.current) return;
    scrollRestored.current = true;
    const y = consumeListScrollRestore();
    const t = setTimeout(() => window.scrollTo({ top: y, behavior: 'instant' }), 80);
    return () => clearTimeout(t);
  }, [isLoading, ipos.length]);

  // Column count follows the available width instead of four guessed breakpoints: `auto-fill`
  // fits as many ~300px tracks as there's room for, so 360px gets 1, a tablet gets 2, and the
  // capped 1500px container tops out at 4 of roughly 348px each. The old fixed `xl: repeat(4)`
  // had no container cap behind it, so an ultrawide window stretched four cards across the
  // entire viewport and every one of them read as a dense wall.
  //
  // `min(100%, 300px)` rather than a bare `300px` is what keeps it safe at the small end: a
  // grid track's automatic minimum is the min-content size of its contents, so a long
  // unbreakable string in a card could otherwise force the track — and the page — wider than a
  // 360px viewport. Clamping the minimum to the container width can never overflow it.
  const gridTemplateColumns = 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))';

  // Only non-default values are written to the URL, so it stays clean (no `?type=mainboard&status=`
  // noise) at the default view. `replace: true` — a filter tweak shouldn't push a history entry you
  // then have to "back" through.
  const handleFilterChange = ({ status: nextStatus, type: nextType, sort: nextSort }) => {
    const next = {};
    if (nextType && nextType !== DEFAULT_TYPE) next.type = nextType;
    if (nextStatus) next.status = nextStatus;
    if (nextSort && nextSort !== DEFAULT_SORT) next.sort = nextSort;
    setSearchParams(next, { replace: true });
  };

  return (
    <Box sx={{
      // maxWidth + auto margins: without a cap the grid ran the full width of an ultrawide
      // window, which is both a wall of cards and a line length well past what's comfortable
      // to scan. 1500px keeps the grid at four columns at the top end and leaves the hero,
      // toolbar and ad slot aligned to the same measure.
      pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 24px)' },
      px: { xs: 2, sm: 3 },
      pb: 3,
      maxWidth: 1500,
      mx: 'auto',
      color: T.textPrimary,
    }}>
      <IpoHero lastUpdated={lastUpdated} />

      <IpoFilterBar
        type={type}
        status={status}
        sort={sort}
        onChange={handleFilterChange}
        count={isLoading ? null : ipos.length}
      />

      {isLoading ? (
        <Box sx={{ display: 'grid', gap: { xs: 1.5, sm: 2 }, gridTemplateColumns }}>
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <IpoCardSkeleton key={i} />
          ))}
        </Box>
      ) : ipos.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <Box sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', gap: 1.5, py: { xs: 6, sm: 9 },
            borderRadius: 4, border: `1px dashed ${T.border}`, bgcolor: T.glass,
          }}>
            <Box sx={{
              width: 60, height: 60, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', bgcolor: T.glassHover,
            }}>
              <TrendingUpIcon sx={{ fontSize: 30, color: T.textMuted }} />
            </Box>
            <Typography sx={{ fontSize: 17, fontWeight: 800, color: T.textPrimary }}>No IPOs found</Typography>
            <Typography sx={{ fontSize: 13.5, color: T.textMuted, maxWidth: 340, lineHeight: 1.6 }}>
              {hasActiveFilter
                ? 'No IPOs match these filters right now.'
                : 'Nothing to show yet — check back soon.'}
            </Typography>
            {hasActiveFilter && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => setSearchParams({}, { replace: true })}
                sx={{
                  mt: 0.5, textTransform: 'none', fontWeight: 700, fontSize: 12.5,
                  borderColor: T.border, color: T.textPrimary, bgcolor: T.glass,
                  '&:hover': { borderColor: T.teal, bgcolor: T.tealBg, color: T.teal },
                }}
              >
                Clear filters
              </Button>
            )}
          </Box>
        </motion.div>
      ) : (
        <Box sx={{ display: 'grid', gap: { xs: 1.5, sm: 2 }, gridTemplateColumns }}>
          {ipos.map((ipo, i) => (
            <IpoCard key={ipo.id} ipo={ipo} index={i} />
          ))}
        </Box>
      )}

      {/* Below the grid, above the explainer blocks — in view only after the visitor
          has actually read the list, which is where AdSense wants a display unit. */}
      <AdSlot slot="ipoList" minHeight={120} />

      <WhyUseThis />
      <IpoLearn />
    </Box>
  );
}
