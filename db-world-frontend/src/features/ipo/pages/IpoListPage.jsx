import { useState } from 'react';
import { Box, Typography, Chip, Skeleton } from '@mui/material';
import { motion } from 'framer-motion';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useT } from '@shared/theme';
import { useIpos } from '../hooks/useIpo';
import { formatIstTime } from '../utils/format';
import IpoCard from '../components/IpoCard';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'listed', label: 'Listed' },
];

export default function IpoListPage() {
  const T = useT();
  const [status, setStatus] = useState('');
  const { data, isLoading } = useIpos(status);
  const ipos = data?.ipos ?? [];
  const lastUpdated = formatIstTime(data?.lastUpdated);

  const gridTemplateColumns = { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(3,1fr)', xl: 'repeat(4,1fr)' };

  return (
    <Box sx={{ pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 24px)' }, px: { xs: 2, sm: 3 }, pb: 3, color: T.textPrimary }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 800 }}>IPO Tracker</Typography>
          <Typography sx={{ fontSize: 13, color: T.textMuted, mt: 0.25 }}>
            Mainboard &amp; SME IPOs — dates, GMP and subscription at a glance.
          </Typography>
        </Box>
        {lastUpdated && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.6,
            borderRadius: 999, bgcolor: T.glass, border: `1px solid ${T.border}`,
          }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: T.success, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 11.5, color: T.textMuted, whiteSpace: 'nowrap' }}>
              Last updated {lastUpdated} IST
            </Typography>
          </Box>
        )}
      </Box>

      <Box sx={{
        display: 'flex', gap: 1, mb: 2.5, overflowX: 'auto', pb: 0.5,
        '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none',
      }}>
        {FILTERS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            onClick={() => setStatus(f.value)}
            color={status === f.value ? 'primary' : 'default'}
            sx={{ transition: 'all 0.15s', flexShrink: 0, fontWeight: 600 }}
          />
        ))}
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'grid', gap: { xs: 1.5, sm: 2 }, gridTemplateColumns }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={168} sx={{ bgcolor: T.glass }} />
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
              {status ? 'No IPOs match this filter right now. Try a different status.' : 'Nothing to show yet — check back soon.'}
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
    </Box>
  );
}
