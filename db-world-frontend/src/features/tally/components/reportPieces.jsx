import { Box, Typography } from '@mui/material';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingFlatRoundedIcon from '@mui/icons-material/TrendingFlatRounded';
import { useT } from '@shared/theme';
import { categoryEmoji, formatExpenseDate, formatMoney } from './../utils/tallyFormat';

/**
 * The small parts both spending reports are built from.
 *
 * <p>Shared because they were identical in both pages, and two copies of a money figure is how
 * the same screen ends up formatting the same number two ways. What differs between the reports
 * is which figures they carry, not how a trend chip looks.
 */

/**
 * This period against the last one.
 *
 * <p>Deliberately neutral in colour: only the arrow carries the direction. Spending more is not
 * automatically bad — a month with a holiday in it is supposed to cost more — and painting it
 * red would be the app passing judgement on numbers it does not understand.
 */
export function TrendChip({ trend }) {
  const T = useT();
  const Icon = trend.direction === 'up' ? TrendingUpRoundedIcon
    : trend.direction === 'down' ? TrendingDownRoundedIcon
      : TrendingFlatRoundedIcon;

  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      px: 1, py: 0.35, borderRadius: 99,
      bgcolor: T.glass, border: `1px solid ${T.border}`,
    }}>
      <Icon sx={{ fontSize: 15, color: T.textMuted }} />
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: T.textMuted }}>
        {trend.label}
      </Typography>
    </Box>
  );
}

/**
 * The single largest item in the period.
 *
 * @param label what the amount is — "biggest single share" on the personal report, where it is
 *              the caller's slice, and "biggest expense" on a group's, where it is the whole
 *              bill. The same row would otherwise quietly mean two different things.
 */
export function BiggestExpense({ expense, label }) {
  const T = useT();

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      p: 1.75, borderRadius: 3, mb: 2,
      bgcolor: T.glass, border: `1px solid ${T.border}`,
    }}>
      <Box sx={{
        width: 34, height: 34, borderRadius: 2, flexShrink: 0,
        display: 'grid', placeItems: 'center', fontSize: 17,
        bgcolor: T.tealBg,
      }}>
        {expense.category ? categoryEmoji(expense.category) : '🧾'}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 11.5, color: T.textFaint, fontWeight: 700, letterSpacing: 0.4 }}>
          {label}
        </Typography>
        <Typography noWrap sx={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>
          {expense.description}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: T.textPrimary }}>
          {formatMoney(expense.amount)}
        </Typography>
        <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
          {formatExpenseDate(expense.date)}
        </Typography>
      </Box>
    </Box>
  );
}

/** A period with no spending in it, which is a normal thing rather than an error. */
export function NothingSpent({ period, hint }) {
  const T = useT();
  const unit = { WEEK: 'week', MONTH: 'month', YEAR: 'year' }[period] ?? 'month';

  return (
    <Box sx={{
      textAlign: 'center', py: 6, px: 3, borderRadius: 3.5,
      bgcolor: T.glass, border: `1px dashed ${T.glassBorder}`,
    }}>
      <Box sx={{ fontSize: 34, mb: 1 }}>🧾</Box>
      <Typography sx={{ fontSize: 15.5, fontWeight: 700, color: T.textPrimary, mb: 0.5 }}>
        Nothing in this {unit}
      </Typography>
      <Typography sx={{ fontSize: 13.5, color: T.textMuted }}>{hint}</Typography>
    </Box>
  );
}
