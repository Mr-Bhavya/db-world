import { useNavigate } from 'react-router-dom';
import { Box, Typography, Chip } from '@mui/material';
import { motion } from 'framer-motion';
import CalendarTodayIcon from '@mui/icons-material/CalendarTodayOutlined';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import {
  formatShortDate, formatPriceBand, formatPct, statusMeta, ipoTypeMeta, daysLeftLabel,
  subscriptionLabel, subscriptionMeta,
} from '../utils/format';
import CompanyLogo from './CompanyLogo';

function StatusBadge({ status }) {
  const T = useT();
  const meta = statusMeta(status, T);
  return (
    <Box sx={{
      flexShrink: 0, maxWidth: '45%', px: 1, py: 0.25, borderRadius: 999,
      bgcolor: meta.bg, border: `1px solid ${meta.color}55`,
    }}>
      <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: meta.color, letterSpacing: 0.3, lineHeight: 1.6 }} noWrap>
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
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, minWidth: 0 }}>
      <Icon sx={{ fontSize: 15, color, flexShrink: 0 }} />
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
 * Status-aware "time left" pill for the footer, next to the absolute date range —
 * upcoming/open get a clock (still counting down to a date), closed/listed get a
 * calendar-check (past the subscription window, event-based from here). Hidden
 * entirely when `daysLeftLabel` can't derive anything (missing/unparseable dates).
 */
function DaysLeftPill({ ipo }) {
  const T = useT();
  const label = daysLeftLabel(ipo);
  if (!label) return null;
  const Icon = ipo.status === 'upcoming' || ipo.status === 'open' ? AccessTimeRoundedIcon : EventAvailableRoundedIcon;
  const meta = statusMeta(ipo.status, T);
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 0.3, flexShrink: 0,
      px: 0.75, py: 0.15, borderRadius: 999, bgcolor: meta.bg,
    }}>
      <Icon sx={{ fontSize: 11, color: meta.color }} />
      <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: meta.color, whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
    </Box>
  );
}

/**
 * Slim subscription progress bar — open/closed IPOs only, and only once `subTotal` is
 * known. Fill is capped at 100% (past 1× the bar just stays full; the multiple itself
 * is what carries "oversubscribed" — no ever-growing bar past full), color-tiered via
 * `subscriptionMeta` so a 15× "hot" issue reads as unmistakably different from a 1.2×
 * scrape-by. Hidden for upcoming/listed via the caller's condition, not in here, so the
 * "no bar at all" case never even mounts this.
 */
function SubscriptionBar({ subTotal }) {
  const T = useT();
  const meta = subscriptionMeta(subTotal, T);
  if (!meta) return null;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.4 }}>
        <Typography sx={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>
          Subscription
        </Typography>
        <Typography sx={{ fontSize: 11, fontWeight: 800, color: meta.color }} noWrap>
          {subscriptionLabel(subTotal)}
        </Typography>
      </Box>
      <Box sx={{ height: 5, borderRadius: 999, bgcolor: T.glassHover, overflow: 'hidden' }}>
        <Box sx={{
          height: '100%', width: `${meta.fillPct}%`, borderRadius: 999, bgcolor: meta.color,
          boxShadow: meta.hot ? `0 0 6px ${meta.color}` : 'none',
          transition: 'width 0.3s ease',
        }} />
      </Box>
    </Box>
  );
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
  const typeMeta = ipoTypeMeta(ipo.ipoType, T);
  const positiveGain = ipo.listingGainPct != null && ipo.listingGainPct > 0;
  const negativeGain = ipo.listingGainPct != null && ipo.listingGainPct < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 10) * 0.04 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      style={{ height: '100%', width: '100%', minWidth: 0 }}
    >
      <Box
        onClick={() => navigate(Constants.ipoDetailPath(ipo.id))}
        role="button"
        tabIndex={0}
        aria-label={`View ${ipo.companyName} details`}
        onKeyDown={(e) => {
          // Only react to keydowns that land directly on the card surface itself —
          // there's no nested interactive element on this card today, but guarding on
          // `e.target === e.currentTarget` keeps this safe if one's ever added (a
          // bubbled Enter/Space from a descendant shouldn't double-navigate).
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate(Constants.ipoDetailPath(ipo.id));
          }
        }}
        sx={{
          bgcolor: T.glass,
          border: `1px solid ${T.border}`,
          borderLeft: `3px solid ${meta.color}`,
          borderRadius: 3,
          cursor: 'pointer',
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          p: 1.75,
          overflow: 'hidden',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          '&:hover': { borderColor: T.teal, boxShadow: `0 8px 24px ${T.tealGlow}` },
          '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
            <CompanyLogo logoUrl={ipo.logoUrl} companyName={ipo.companyName} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: T.textPrimary, lineHeight: 1.3 }} noWrap>
                {ipo.companyName}
              </Typography>
              {typeMeta && (
                <Chip
                  label={typeMeta.label}
                  size="small"
                  sx={{
                    height: 19, fontSize: 10.5, fontWeight: 700, mt: 0.5,
                    bgcolor: typeMeta.bg, color: typeMeta.color,
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              )}
            </Box>
          </Box>
          <StatusBadge status={ipo.status} />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 1 }}>
          <Stat label="Price band">
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }} noWrap>
              {formatPriceBand(ipo.priceMin, ipo.priceMax) ?? '—'}
              {ipo.lotSize != null && (
                <Box component="span" sx={{ fontWeight: 600, color: T.textMuted, fontSize: 11.5 }}>
                  {' '}&middot; Lot {ipo.lotSize}
                </Box>
              )}
            </Typography>
          </Stat>
          <Stat label="GMP">
            <GmpValue gmp={ipo.gmp} gmpPct={ipo.gmpPct} />
          </Stat>
        </Box>

        {(ipo.status === 'open' || ipo.status === 'closed') && ipo.subTotal != null && (
          <SubscriptionBar subTotal={ipo.subTotal} />
        )}

        <Box sx={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 0.75,
          mt: 'auto', pt: 1, borderTop: `1px solid ${T.border}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: '1 1 auto' }}>
            <CalendarTodayIcon sx={{ fontSize: 12.5, color: T.textFaint, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 11.5, color: T.textFaint }} noWrap>
              {keyDateLabel(ipo)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <DaysLeftPill ipo={ipo} />
            {ipo.status === 'listed' && ipo.listingGainPct != null && (
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.2, flexShrink: 0,
                px: 0.75, py: 0.15, borderRadius: 999,
                bgcolor: positiveGain ? T.successBg : negativeGain ? T.errorBg : T.glassHover,
              }}>
                {positiveGain
                  ? <TrendingUpIcon sx={{ fontSize: 11, color: T.success }} />
                  : negativeGain
                    ? <TrendingDownIcon sx={{ fontSize: 11, color: T.error }} />
                    : <TrendingFlatIcon sx={{ fontSize: 11, color: T.textMuted }} />}
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
      </Box>
    </motion.div>
  );
}
