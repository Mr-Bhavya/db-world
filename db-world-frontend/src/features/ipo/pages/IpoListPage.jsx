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

const SKELETON_COUNT = 8;

// Bonus (nice-to-have): remember where the user was scrolled to on the list so going back
// from an IPO's detail page restores it, instead of always dropping back to the top of a
// long list. Session-scoped (not persisted across browser restarts) and cleared as soon as
// it's consumed, so a genuinely fresh visit — as opposed to a "return from detail" — always
// starts at the top.
const LIST_SCROLL_KEY = 'ipo_list_scroll';

export default function IpoListPage() {
  const T = useT();
  const [type, setType] = useState('mainboard');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('date');

  const { data, isLoading } = useIpos({ status, type, sort });
  const ipos = data?.ipos ?? [];
  const lastUpdated = formatIstTime(data?.lastUpdated);
  const hasActiveFilter = !!status || type !== 'all';

  // Save the scroll position whenever this page unmounts (e.g. navigating into an IPO's
  // detail page) so a subsequent "back" restores it below.
  useEffect(() => () => {
    sessionStorage.setItem(LIST_SCROLL_KEY, String(window.scrollY));
  }, []);

  // Restore it once, but only after the list has actually rendered (there's nothing to
  // scroll to before then) — then immediately clear the saved value so it's only ever
  // consumed once. `scrollRestored` guards against re-running on later filter/sort changes,
  // which reuse this same isLoading/ipos state but shouldn't re-trigger a scroll jump.
  const scrollRestored = useRef(false);
  useEffect(() => {
    if (isLoading || ipos.length === 0 || scrollRestored.current) return;
    scrollRestored.current = true;
    const saved = sessionStorage.getItem(LIST_SCROLL_KEY);
    sessionStorage.removeItem(LIST_SCROLL_KEY);
    const y = saved != null ? parseInt(saved, 10) : 0;
    if (y > 0) {
      const t = setTimeout(() => window.scrollTo({ top: y, behavior: 'instant' }), 80);
      return () => clearTimeout(t);
    }
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
