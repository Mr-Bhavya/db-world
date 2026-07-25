import { useNavigate } from 'react-router-dom';
import { Box, Typography, Chip } from '@mui/material';
import { motion } from 'framer-motion';
import CalendarTodayIcon from '@mui/icons-material/CalendarTodayOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import { formatShortDate, formatPriceBand, formatPct, IPO_TYPE_LABEL, statusMeta } from '../utils/format';
import CompanyLogo from './CompanyLogo';

function StatusBadge({ status }) {
  const T = useT();
  const meta = statusMeta(status, T);
  return (
    <Box sx={{
      flexShrink: 0, px: 1, py: 0.25, borderRadius: 999,
      bgcolor: meta.bg, border: `1px solid ${meta.color}55`,
    }}>
      <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: meta.color, letterSpacing: 0.3, lineHeight: 1.6 }}>
        {meta.label}
      </Typography>
    </Box>
  );
}

function Stat({ label, children }) {
  const T = useT();
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>
        {label}
      </Typography>
      <Box sx={{ mt: 0.25 }}>{children}</Box>
    </Box>
  );
}

function GmpValue({ gmp, gmpPct }) {
  const T = useT();
  if (gmp == null && gmpPct == null) {
    return <Typography sx={{ fontSize: 13, color: T.textFaint }}>—</Typography>;
  }
  const positive = (gmp ?? gmpPct) > 0;
  const negative = (gmp ?? gmpPct) < 0;
  const color = positive ? T.success : negative ? T.error : T.textMuted;
  const Icon = positive ? TrendingUpIcon : negative ? TrendingDownIcon : TrendingFlatIcon;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
      <Icon sx={{ fontSize: 15, color }} />
      <Typography sx={{ fontSize: 13, fontWeight: 800, color }} noWrap>
        {gmp != null ? `₹${gmp}` : '—'}
        {gmpPct != null && <Box component="span" sx={{ fontWeight: 600, opacity: 0.85 }}> ({formatPct(gmpPct)})</Box>}
      </Typography>
    </Box>
  );
}

function keyDateLabel(ipo) {
  if (ipo.status === 'listed' && ipo.listingDate) return `Listed ${formatShortDate(ipo.listingDate)}`;
  if (ipo.openDate && ipo.closeDate) return `${formatShortDate(ipo.openDate)} – ${formatShortDate(ipo.closeDate)}`;
  if (ipo.openDate) return `Opens ${formatShortDate(ipo.openDate)}`;
  if (ipo.closeDate) return `Closes ${formatShortDate(ipo.closeDate)}`;
  return '—';
}

/**
 * Minimal IPO card: logo + name + type chip, status badge, price band, GMP, and one key
 * date — heavier detail lives on the detail page. A left accent strip (via `statusMeta`)
 * gives an at-a-glance read on where the IPO is in its lifecycle.
 */
export default function IpoCard({ ipo, index = 0 }) {
  const T = useT();
  const navigate = useNavigate();
  const meta = statusMeta(ipo.status, T);
  const positiveGain = ipo.listingGainPct != null && ipo.listingGainPct > 0;
  const negativeGain = ipo.listingGainPct != null && ipo.listingGainPct < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 10) * 0.04 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      style={{ height: '100%' }}
    >
      <Box
        onClick={() => navigate(Constants.ipoDetailPath(ipo.id))}
        sx={{
          bgcolor: T.glass,
          border: `1px solid ${T.border}`,
          borderLeft: `3px solid ${meta.color}`,
          borderRadius: 3,
          cursor: 'pointer',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          p: 1.75,
          transition: 'border-color 0.2s, box-shadow 0.2s',
          '&:hover': { borderColor: T.teal, boxShadow: `0 8px 24px ${T.tealGlow}` },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
            <CompanyLogo logoUrl={ipo.logoUrl} companyName={ipo.companyName} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: T.textPrimary, lineHeight: 1.3 }} noWrap>
                {ipo.companyName}
              </Typography>
              <Chip
                label={IPO_TYPE_LABEL[ipo.ipoType] ?? ipo.ipoType ?? 'IPO'}
                size="small"
                variant="outlined"
                sx={{ height: 19, fontSize: 10.5, mt: 0.5, borderColor: T.border, color: T.textMuted, '& .MuiChip-label': { px: 0.75 } }}
              />
            </Box>
          </Box>
          <StatusBadge status={ipo.status} />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          <Stat label="Price band">
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>
              {formatPriceBand(ipo.priceMin, ipo.priceMax) ?? '—'}
            </Typography>
          </Stat>
          <Stat label="GMP">
            <GmpValue gmp={ipo.gmp} gmpPct={ipo.gmpPct} />
          </Stat>
        </Box>

        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
          mt: 'auto', pt: 1, borderTop: `1px solid ${T.border}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            <CalendarTodayIcon sx={{ fontSize: 12.5, color: T.textFaint }} />
            <Typography sx={{ fontSize: 11.5, color: T.textFaint }} noWrap>
              {keyDateLabel(ipo)}
            </Typography>
          </Box>
          {ipo.status === 'listed' && ipo.listingGainPct != null && (
            <Box sx={{
              flexShrink: 0, px: 0.75, py: 0.15, borderRadius: 999,
              bgcolor: positiveGain ? T.successBg : negativeGain ? T.errorBg : T.glassHover,
            }}>
              <Typography sx={{
                fontSize: 10.5, fontWeight: 800,
                color: positiveGain ? T.success : negativeGain ? T.error : T.textMuted,
              }}>
                {formatPct(ipo.listingGainPct)}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </motion.div>
  );
}
