import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Skeleton } from '@mui/material';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import BookmarkAddedOutlinedIcon from '@mui/icons-material/BookmarkAddedOutlined';
import RadioButtonCheckedRoundedIcon from '@mui/icons-material/RadioButtonCheckedRounded';
import UpcomingRoundedIcon from '@mui/icons-material/UpcomingRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingFlatRoundedIcon from '@mui/icons-material/TrendingFlatRounded';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import { useIpos } from '../hooks/useIpo';
import { computeQuickStats, formatPct } from '../utils/format';

/** One quick-stat pill — icon-in-a-tinted-circle + value/label, matching the
 * icon-badge motif used across the feature (`OverviewTab`'s FactTile, `StrengthsRisks`). */
function StatChip({ icon, color, value, valueColor, label, caption }) {
  const T = useT();
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: { xs: '1 1 auto', sm: '0 1 auto' },
      px: { xs: 1.1, sm: 1.4 }, py: { xs: 0.7, sm: 0.85 }, borderRadius: 2.5,
      bgcolor: T.glass, border: `1px solid ${T.border}`,
      transition: 'border-color 0.2s ease',
      '&:hover': { borderColor: T.borderHover },
    }}>
      <Box sx={{
        width: { xs: 28, sm: 32 }, height: { xs: 28, sm: 32 }, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}1f`,
      }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{
          fontSize: { xs: 16, sm: 18 }, fontWeight: 800, color: valueColor ?? T.textPrimary,
          lineHeight: 1.15, fontVariantNumeric: 'tabular-nums',
        }} noWrap>
          {value}
        </Typography>
        <Typography sx={{
          fontSize: 10, color: T.textMuted, textTransform: 'uppercase',
          letterSpacing: 0.5, fontWeight: 700, lineHeight: 1.4,
        }} noWrap>
          {label}
        </Typography>
        {/* The company behind a "Top GMP" figure goes on its own line in sentence case. Crammed
            into the uppercase label it pushed a chip past half the row's width and still clipped. */}
        {caption && (
          <Typography sx={{ fontSize: 11, color: T.textFaint, lineHeight: 1.35, maxWidth: 190 }} noWrap>
            {caption}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/** Loading placeholder for the quick-stats row, matching `StatChip`'s footprint 1:1 so
 * nothing jumps once the list resolves. */
function QuickStatsSkeleton() {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} variant="rounded" width={156} height={56} sx={{ borderRadius: 2.5, bgcolor: T.glassHover }} />
      ))}
    </Box>
  );
}

/**
 * List-page hero — headline + tagline + a quick-stats row, plus the "Last updated" stamp
 * and the "My IPOs" shortcut that used to live in the plain title block this replaces.
 * Tasteful, not a giant banner: same glass/border language as the rest of the feature,
 * just with a slightly larger headline.
 *
 * The quick stats deliberately run their OWN `useIpos({ type: 'all', status: '' })` query
 * rather than reading the page's filtered list — that list defaults to `type: 'mainboard'`
 * and changes with every toolbar tweak, which (a) hides every SME IPO from the stats on
 * first paint, directly under a tagline promising "every Indian IPO", and (b) makes the
 * numbers shift when the user changes filters (e.g. Status=Open showing "Upcoming: 0"),
 * reading as a broken counter. Sourcing from a separate unfiltered query keeps the stats
 * a fixed, global summary independent of whatever the card grid below is showing. React
 * Query dedupes/caches this against any other `['ipo','list',{type:'all',status:''}]`
 * caller, so this doesn't cost an extra network round-trip beyond the first mount.
 *
 * Loading/empty are both handled gracefully — a loading list shows stat-chip skeletons,
 * and a genuinely empty (non-loading) list hides the stats row entirely rather than
 * showing "0 Open now / 0 Upcoming", which would read as a broken counter rather than
 * "nothing to report yet".
 */
export default function IpoHero({ lastUpdated }) {
  const T = useT();
  const navigate = useNavigate();
  const { data: statsData, isLoading } = useIpos({ type: 'all', status: '' });
  const statsIpos = statsData?.ipos ?? [];
  const stats = computeQuickStats(statsIpos);
  const hasStats = !isLoading && statsIpos.length > 0;

  const gmpPositive = stats.topGmp != null && stats.topGmp.gmpPct > 0;
  const gmpNegative = stats.topGmp != null && stats.topGmp.gmpPct < 0;
  const gmpColor = gmpPositive ? T.success : gmpNegative ? T.error : T.textMuted;
  const GmpIcon = gmpPositive ? TrendingUpRoundedIcon : gmpNegative ? TrendingDownRoundedIcon : TrendingFlatRoundedIcon;

  return (
    <Box sx={{ mb: { xs: 1.75, sm: 2.5 } }}>
      <Box sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: { xs: 1, sm: 1.5 }, flexWrap: 'wrap', mb: { xs: 1, sm: 1.5 },
      }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9 }}>
            <RocketLaunchRoundedIcon sx={{ fontSize: { xs: 21, sm: 26 }, color: T.teal }} />
            <Typography sx={{ fontSize: { xs: 18, sm: 25 }, fontWeight: 800, letterSpacing: -0.3 }}>
              IPO Radar
            </Typography>
          </Box>
          <Typography sx={{ fontSize: { xs: 12, sm: 13 }, color: T.textMuted, mt: 0.25, maxWidth: 480, lineHeight: 1.5 }}>
            Track every Indian IPO — latest GMP, subscription &amp; allotment, all in one place.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1 }, flexWrap: 'wrap', flexShrink: 0 }}>
          {lastUpdated && (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.6, px: { xs: 1, sm: 1.25 }, py: { xs: 0.4, sm: 0.6 },
              borderRadius: 999, bgcolor: T.glass, border: `1px solid ${T.border}`,
            }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: T.success, flexShrink: 0 }} />
              <Typography sx={{ fontSize: { xs: 10.5, sm: 11.5 }, color: T.textMuted, whiteSpace: 'nowrap' }}>
                Last updated {lastUpdated} IST
              </Typography>
            </Box>
          )}
          <Button
            variant="outlined"
            size="small"
            startIcon={<BookmarkAddedOutlinedIcon sx={{ fontSize: 16 }} />}
            onClick={() => navigate(Constants.DB_IPO_MY_ROUTE)}
            sx={{
              borderColor: T.border, color: T.textPrimary, fontSize: 12.5, fontWeight: 700,
              whiteSpace: 'nowrap', bgcolor: T.glass, py: { xs: 0.4, sm: 0.5 }, px: { xs: 1.25, sm: 1.75 },
              '&:hover': { borderColor: T.teal, bgcolor: T.tealBg, color: T.teal },
            }}
          >
            My IPOs
          </Button>
        </Box>
      </Box>

      {isLoading ? (
        <QuickStatsSkeleton />
      ) : hasStats && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <StatChip
            icon={<RadioButtonCheckedRoundedIcon sx={{ fontSize: 16, color: T.success }} />}
            color={T.success}
            value={stats.openCount}
            label="Open now"
          />
          <StatChip
            icon={<UpcomingRoundedIcon sx={{ fontSize: 16, color: T.info }} />}
            color={T.info}
            value={stats.upcomingCount}
            label="Upcoming"
          />
          {stats.topGmp && (
            <StatChip
              icon={<GmpIcon sx={{ fontSize: 16, color: gmpColor }} />}
              color={gmpColor}
              value={formatPct(stats.topGmp.gmpPct)}
              valueColor={gmpColor}
              label="Top GMP"
              caption={stats.topGmp.companyName}
            />
          )}
        </Box>
      )}
    </Box>
  );
}
