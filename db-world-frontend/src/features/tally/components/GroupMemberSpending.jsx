import { Box, Typography } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import { useT } from '@shared/theme';
import { avatarColor, formatMoney, initialsOf } from '../utils/tallyFormat';

/**
 * Who carried the group, and who used it — one row per member, biggest user first.
 *
 * <p>Both numbers, side by side and labelled. Paid alone rewards whoever happens to hold the
 * card; used alone hides the fact that they are out of pocket for it. The interesting thing is
 * the distance between the two, and the only way to show that is to print both.
 *
 * <p>The bar measures <em>used</em> against the largest user, for the same reason
 * {@link SpendingBreakdown}'s does: against the group total, a party of six draws as six
 * indistinguishable slivers.
 *
 * <p>No net column, deliberately. Paid minus used over one month is not what anybody owes — it
 * ignores settlements and every period before this one — and a number that looks like a balance
 * but is not would be read as one. The real balance is on the group page.
 */
export default function GroupMemberSpending({ rows = [] }) {
  const T = useT();
  const reduce = useReducedMotion();

  const largest = rows.reduce((max, r) => Math.max(max, Number(r.consumed ?? 0)), 0);

  return (
    <Box sx={{ mb: 3 }}>
      <Typography sx={{
        fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase',
        color: T.textFaint, mb: 1.25,
      }}>
        Who paid, who used
      </Typography>

      {rows.length === 0 ? (
        <Typography sx={{ fontSize: 13.5, color: T.textMuted }}>
          Nobody spent anything in this period
        </Typography>
      ) : rows.map((row, index) => {
        const consumed = Number(row.consumed ?? 0);
        const width = largest > 0 ? (consumed / largest) * 100 : 0;

        return (
          <Box
            key={row.memberId}
            component={motion.div}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: reduce ? 0 : Math.min(index * 0.04, 0.3),
              ease: [0.22, 1, 0.36, 1] }}
            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}
          >
            <Box sx={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              display: 'grid', placeItems: 'center',
              fontSize: 12.5, fontWeight: 800, color: '#fff',
              bgcolor: avatarColor(row.memberId),
            }}>
              {initialsOf(row.name)}
            </Box>

            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
                <Typography noWrap sx={{
                  fontSize: 14, fontWeight: 700, color: T.textPrimary, flex: 1, minWidth: 0,
                }}>
                  {row.name}
                </Typography>
                <Typography sx={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap' }}>
                  paid{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: T.textPrimary }}>
                    {formatMoney(row.paid)}
                  </Box>
                </Typography>
                <Typography sx={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap' }}>
                  used{' '}
                  <Box component="span" sx={{ fontWeight: 800, color: T.teal }}>
                    {formatMoney(consumed)}
                  </Box>
                </Typography>
              </Box>

              <Box sx={{ height: 5, borderRadius: 99, bgcolor: T.glass, overflow: 'hidden' }}>
                <Box
                  component={motion.div}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${width}%` }}
                  transition={{ duration: 0.5, delay: reduce ? 0 : Math.min(index * 0.04, 0.3),
                    ease: [0.22, 1, 0.36, 1] }}
                  sx={{ height: '100%', borderRadius: 99, bgcolor: T.teal }}
                />
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
