import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, IconButton } from '@mui/material';
import { motion } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BookmarkAddedOutlinedIcon from '@mui/icons-material/BookmarkAddedOutlined';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import { useMyApplications } from '../hooks/useIpo';
import MyIpoCard from '../components/MyIpoCard';
import MyIpoCardSkeleton from '../components/MyIpoCardSkeleton';

const SKELETON_COUNT = 6;

const GRID_TEMPLATE_COLUMNS = {
  xs: 'minmax(0, 1fr)',
  sm: 'repeat(2, minmax(0, 1fr))',
  lg: 'repeat(3, minmax(0, 1fr))',
};

/**
 * "My IPOs" — every IPO the caller has saved an application for (see `useMyApplications`),
 * each with a one-tap guided allotment check. Login-gated same as the rest of `/db-world`.
 */
export default function MyIposPage() {
  const T = useT();
  const navigate = useNavigate();
  const backToList = () => navigate(Constants.DB_IPO_ROUTE);

  const { data, isLoading, isError, refetch, isFetching } = useMyApplications();
  const rows = data ?? [];

  return (
    <Box sx={{ pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 24px)' }, px: { xs: 2, sm: 3 }, pb: 4, color: T.textPrimary }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 2 }}>
        <IconButton
          onClick={backToList}
          aria-label="Back to IPO Tracker"
          sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, mt: 0.25, flexShrink: 0 }}
        >
          <ArrowBackIcon sx={{ fontSize: 20 }} />
        </IconButton>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 800 }}>My IPOs</Typography>
          <Typography sx={{ fontSize: 13, color: T.textMuted, mt: 0.25 }}>
            Your saved applications, with a one-tap guided allotment check for each.
          </Typography>
        </Box>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'grid', gap: { xs: 1.5, sm: 2 }, gridTemplateColumns: GRID_TEMPLATE_COLUMNS }}>
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <MyIpoCardSkeleton key={i} />
          ))}
        </Box>
      ) : isError ? (
        // Distinct from the true-empty state below — a failed fetch (`data` undefined) must
        // never be silently read as "you have no saved IPOs", or the applicant might assume
        // nothing was ever saved and never retry.
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
          <Box sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', gap: 1.5, py: 8,
          }}>
            <ErrorOutlineRoundedIcon sx={{ fontSize: 56, color: T.error }} />
            <Typography sx={{ fontSize: 17, fontWeight: 700, color: T.textPrimary }}>
              Couldn&rsquo;t load your IPOs
            </Typography>
            <Typography sx={{ fontSize: 13, color: T.textMuted, maxWidth: 360 }}>
              Something went wrong fetching your saved applications. Check your connection and try again.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<ReplayRoundedIcon />}
              onClick={() => refetch()}
              disabled={isFetching}
              sx={{ mt: 1, borderColor: T.teal, color: T.teal, '&:hover': { borderColor: T.tealHover, bgcolor: T.tealBg } }}
            >
              {isFetching ? 'Retrying…' : 'Retry'}
            </Button>
          </Box>
        </motion.div>
      ) : rows.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
          <Box sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', gap: 1.5, py: 8,
          }}>
            <BookmarkAddedOutlinedIcon sx={{ fontSize: 56, color: T.textFaint }} />
            <Typography sx={{ fontSize: 17, fontWeight: 700, color: T.textPrimary }}>
              You haven&rsquo;t saved any IPO applications yet
            </Typography>
            <Typography sx={{ fontSize: 13, color: T.textMuted, maxWidth: 360 }}>
              Open an IPO&rsquo;s Allotment tab and save your application details there — it&rsquo;ll show up here.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={backToList}
              sx={{ mt: 1, borderColor: T.teal, color: T.teal, '&:hover': { borderColor: T.tealHover, bgcolor: T.tealBg } }}
            >
              Browse IPOs
            </Button>
          </Box>
        </motion.div>
      ) : (
        <Box sx={{ display: 'grid', gap: { xs: 1.5, sm: 2 }, gridTemplateColumns: GRID_TEMPLATE_COLUMNS }}>
          {rows.map((row, i) => (
            <MyIpoCard key={row.ipo.id} row={row} index={i} />
          ))}
        </Box>
      )}
    </Box>
  );
}
