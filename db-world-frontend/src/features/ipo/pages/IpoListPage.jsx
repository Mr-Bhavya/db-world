import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useT } from '@shared/theme';
import { useIpos } from '../hooks/useIpo';
import { formatIstTime, groupIposByStage, matchesIpoQuery } from '../utils/format';
import IpoHero from '../components/IpoHero';
import IpoFilterBar from '../components/IpoFilterBar';
import IpoCard from '../components/IpoCard';
import IpoCardSkeleton from '../components/IpoCardSkeleton';
import WhyUseThis from '../components/WhyUseThis';
import IpoLearn from '../components/IpoLearn';
import AdSlot from '@shared/ads/AdSlot';
import { consumeListScrollRestore } from '../utils/listScrollRestore';

const SKELETON_COUNT = 8;

/**
 * Sticky heading for one grouped section. Sticks to just under the fixed app bar so you always know
 * which stage the cards under your cursor belong to while scrolling a long list — the whole point of
 * grouping is lost if the label scrolls away from the cards it describes.
 */
function SectionHeading({ label, count }) {
  const T = useT();
  return (
    <Box sx={{
      position: 'sticky',
      top: { xs: 56, md: 64 },
      zIndex: 2,
      display: 'flex', alignItems: 'center', gap: 1,
      py: 1, mb: 1.25,
      // Matches the page background rather than using a transparent blur: cards scrolling under a
      // translucent heading on AMOLED black turn it into mud.
      bgcolor: T.bg,
    }}>
      <Typography sx={{
        fontSize: { xs: 13, sm: 14 }, fontWeight: 800, color: T.textPrimary, letterSpacing: -0.1,
      }}>
        {label}
      </Typography>
      <Typography sx={{
        fontSize: 11, fontWeight: 800, color: T.textMuted,
        px: 0.75, py: 0.15, borderRadius: 999, bgcolor: T.glassHover,
      }}>
        {count}
      </Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: T.border }} />
    </Box>
  );
}

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
  const lastUpdated = formatIstTime(data?.lastUpdated);

  // Search is local state, not a URL param: it's a transient "find this one" gesture rather than a
  // view worth sharing or restoring, and every keystroke in the query string would bury the back
  // button under history entries.
  const [query, setQuery] = useState('');
  // The `?? []` lives INSIDE the memo: as a separate `const` it minted a fresh array reference on
  // every render whenever the query was still in flight, which defeats the memo entirely.
  const ipos = useMemo(
    () => (data?.ipos ?? []).filter((ipo) => matchesIpoQuery(ipo, query)),
    [data?.ipos, query],
  );

  // Group into urgency-ordered sections ONLY when no explicit status filter is applied. With a
  // status chosen the user has already said what they want to look at, so a single "Open now"
  // heading over the whole grid would be noise; without one, the sections are what turn a flat
  // wall of cards into something scannable.
  const sections = useMemo(() => (status ? null : groupIposByStage(ipos)), [status, ipos]);

  const hasActiveFilter = !!status || type !== 'all' || !!query;

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
        query={query}
        onQueryChange={setQuery}
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
                onClick={() => { setQuery(''); setSearchParams({}, { replace: true }); }}
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
      ) : sections ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 3, sm: 3.5 } }}>
          {sections.map((section) => (
            <Box key={section.key}>
              <SectionHeading label={section.label} count={section.ipos.length} />
              <Box sx={{ display: 'grid', gap: { xs: 1.5, sm: 2 }, gridTemplateColumns }}>
                {section.ipos.map((ipo, i) => (
                  <IpoCard key={ipo.id} ipo={ipo} index={i} />
                ))}
              </Box>
            </Box>
          ))}
        </Box>
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
