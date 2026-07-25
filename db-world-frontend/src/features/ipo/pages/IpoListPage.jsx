import { useState, useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
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
import IpoFaq from '../components/IpoFaq';
import IpoGlossary from '../components/IpoGlossary';
import { consumeListScrollRestore } from '../utils/listScrollRestore';

const SKELETON_COUNT = 8;

export default function IpoListPage() {
  const T = useT();
  const [type, setType] = useState('mainboard');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('date');

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

  // `minmax(0, 1fr)` (not bare `1fr`) — a CSS Grid track's automatic minimum size
  // otherwise defaults to the *content* min-content size of whatever's inside, so a
  // long/unbreakable string anywhere in a card (e.g. a lengthy company name) can force
  // the whole track — and every card sharing it — wider than the viewport at 360px.
  // `minmax(0, 1fr)` pins the floor to 0 so the track (and the card) can always shrink
  // down to the available width instead of overflowing it.
  const gridTemplateColumns = {
    xs: 'minmax(0, 1fr)',
    sm: 'repeat(2, minmax(0, 1fr))',
    md: 'repeat(3, minmax(0, 1fr))',
    xl: 'repeat(4, minmax(0, 1fr))',
  };

  const handleFilterChange = ({ status: nextStatus, type: nextType, sort: nextSort }) => {
    setStatus(nextStatus);
    setType(nextType);
    setSort(nextSort);
  };

  return (
    <Box sx={{ pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 24px)' }, px: { xs: 2, sm: 3 }, pb: 3, color: T.textPrimary }}>
      <IpoHero lastUpdated={lastUpdated} />

      <IpoFilterBar type={type} status={status} sort={sort} onChange={handleFilterChange} />

      {isLoading ? (
        <Box sx={{ display: 'grid', gap: { xs: 1.5, sm: 2 }, gridTemplateColumns }}>
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <IpoCardSkeleton key={i} />
          ))}
        </Box>
      ) : ipos.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
          <Box sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', gap: 1.5, py: 8,
          }}>
            <TrendingUpIcon sx={{ fontSize: 56, color: T.textFaint }} />
            <Typography sx={{ fontSize: 17, fontWeight: 700, color: T.textPrimary }}>No IPOs found</Typography>
            <Typography sx={{ fontSize: 13, color: T.textMuted, maxWidth: 320 }}>
              {hasActiveFilter
                ? 'No IPOs match these filters right now. Try a different type, status or sort.'
                : 'Nothing to show yet — check back soon.'}
            </Typography>
          </Box>
        </motion.div>
      ) : (
        <Box sx={{ display: 'grid', gap: { xs: 1.5, sm: 2 }, gridTemplateColumns }}>
          {ipos.map((ipo, i) => (
            <IpoCard key={ipo.id} ipo={ipo} index={i} />
          ))}
        </Box>
      )}

      <WhyUseThis />
      <IpoFaq />
      <IpoGlossary />
    </Box>
  );
}
