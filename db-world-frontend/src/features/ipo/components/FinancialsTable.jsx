import { Box, Typography, Skeleton } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import { useT } from '@shared/theme';
import { useFinancials } from '../hooks/useIpo';
import { shortFinancialLabel } from '../utils/format';
import SectionCard from './SectionCard';
import FinancialsChart from './FinancialsChart';
import ScrollableTable, { stickyColumnSx } from './ScrollableTable';

// Per-column floor widths (px) — generous enough that "1,23,456.78"-style rupee-crore
// figures never wrap-crush on a narrow screen; `ScrollableTable` scrolls past this.
const COL_WIDTHS = [76, 104, 104, 120];
const GAP_PX = 8; // matches the `gap: 1` used on every grid row below
const GRID_COLS = COL_WIDTHS.map((w, i) => `minmax(${w}px, ${i === 0 ? 0.85 : 1}fr)`).join(' ');
const TABLE_MIN_WIDTH = COL_WIDTHS.reduce((sum, w) => sum + w, 0) + GAP_PX * (COL_WIDTHS.length - 1);

const formatCr = (n) => (n == null ? '—'
  : Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/** Small up/down/flat badge on revenue vs. the prior fiscal year — omitted for the first
 * row (no prior year) or when either value is missing. */
function YoyBadge({ current, previous }) {
  const T = useT();
  if (current == null || previous == null || previous === 0) return null;
  const deltaPct = ((current - previous) / Math.abs(previous)) * 100;
  const up = deltaPct > 0.05;
  const down = deltaPct < -0.05;
  const color = up ? T.success : down ? T.error : T.textFaint;
  const Icon = up ? TrendingUpIcon : down ? TrendingDownIcon : TrendingFlatIcon;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.15, ml: 0.6 }}>
      <Icon sx={{ fontSize: 13, color }} />
      <Typography component="span" sx={{ fontSize: 10.5, fontWeight: 700, color }}>
        {Math.abs(deltaPct).toFixed(0)}%
      </Typography>
    </Box>
  );
}

function HeaderRow() {
  const T = useT();
  const labelSx = { fontSize: 10.5, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 };
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: GRID_COLS, gap: 1, pb: 0.75, mb: 0.25, borderBottom: `1px solid ${T.border}` }}>
      <Typography sx={{ ...labelSx, ...stickyColumnSx(T, GAP_PX) }}>Period</Typography>
      <Typography sx={{ ...labelSx, textAlign: 'right' }}>Revenue (₹ Cr)</Typography>
      <Typography sx={{ ...labelSx, textAlign: 'right' }}>PAT (₹ Cr)</Typography>
      <Typography sx={{ ...labelSx, textAlign: 'right' }}>Total Assets (₹ Cr)</Typography>
    </Box>
  );
}

function FinancialRow({ row, prevRevenue, isLast }) {
  const T = useT();
  const revenue = row.revenue != null ? Number(row.revenue) : null;
  const pat = row.pat != null ? Number(row.pat) : null;
  const totalAssets = row.totalAssets != null ? Number(row.totalAssets) : null;
  const patNegative = pat != null && pat < 0;
  return (
    <Box sx={{
      display: 'grid', gridTemplateColumns: GRID_COLS, gap: 1, py: 0.85,
      borderBottom: isLast ? 'none' : `1px solid ${T.border}`,
    }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, ...stickyColumnSx(T, GAP_PX) }}>
        {shortFinancialLabel(row.fiscalYear) ?? '—'}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>{formatCr(revenue)}</Typography>
        <YoyBadge current={revenue} previous={prevRevenue} />
      </Box>
      <Typography sx={{ fontSize: 13, fontWeight: 700, textAlign: 'right', color: patNegative ? T.error : T.textPrimary }}>
        {formatCr(pat)}
      </Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 700, textAlign: 'right', color: T.textPrimary }}>
        {formatCr(totalAssets)}
      </Typography>
    </Box>
  );
}

function FinancialsSkeleton() {
  const T = useT();
  return (
    <Box>
      <Skeleton variant="rounded" height={240} sx={{ bgcolor: T.glassHover, mb: 2 }} />
      <ScrollableTable minWidth={TABLE_MIN_WIDTH}>
        {[0, 1, 2].map((i) => (
          <Box key={i} sx={{ display: 'grid', gridTemplateColumns: GRID_COLS, gap: 1, py: 0.85 }}>
            <Skeleton variant="text" width={48} height={16} sx={{ ...stickyColumnSx(T, GAP_PX), bgcolor: T.glassHover }} />
            <Skeleton variant="text" width={64} height={16} sx={{ bgcolor: T.glassHover, ml: 'auto' }} />
            <Skeleton variant="text" width={64} height={16} sx={{ bgcolor: T.glassHover, ml: 'auto' }} />
            <Skeleton variant="text" width={64} height={16} sx={{ bgcolor: T.glassHover, ml: 'auto' }} />
          </Box>
        ))}
      </ScrollableTable>
    </Box>
  );
}

/**
 * On-demand P&L (profit & loss) table for the detail page. Fetches via its own
 * `useFinancials(id)` query — separate from `useIpo(id)` — so the rest of the detail page
 * (and the card/list) never waits on it. Ascending by fiscal year, with a subtle YoY badge
 * on revenue and losses (negative PAT) picked out in red.
 */
export default function FinancialsTable({ id }) {
  const T = useT();
  const { data: rows = [], isLoading, isError } = useFinancials(id);

  return (
    <SectionCard title="Financials (P&L)" icon={<BarChartOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
      {isLoading ? (
        <FinancialsSkeleton />
      ) : isError || rows.length === 0 ? (
        <Box sx={{ py: 1.5, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 12.5, color: T.textFaint }}>
            {isError ? 'Unable to load financials right now.' : 'Financials not available.'}
          </Typography>
        </Box>
      ) : (
        <Box>
          <FinancialsChart rows={rows} />
          <ScrollableTable minWidth={TABLE_MIN_WIDTH}>
            <HeaderRow />
            {rows.map((row, i) => (
              <FinancialRow
                key={row.fiscalYear ?? i}
                row={row}
                prevRevenue={i > 0 && rows[i - 1].revenue != null ? Number(rows[i - 1].revenue) : null}
                isLast={i === rows.length - 1}
              />
            ))}
          </ScrollableTable>
        </Box>
      )}
    </SectionCard>
  );
}
