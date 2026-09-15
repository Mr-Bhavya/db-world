import { Box, Typography } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import { useT } from '@shared/theme';
import { formatMoney } from '../utils/tallyFormat';

/**
 * A ranked "where it went" list: biggest first, each with a bar showing its share of the total.
 *
 * The bar is measured against the <em>largest row</em>, not against the total. Against the total
 * a typical month — where nothing is more than a fifth of the spend — draws as five barely
 * visible slivers and the ranking becomes impossible to read at a glance, which is the one job
 * this list has. The percentage beside each row carries the share of the total instead, where a
 * number is exact and a bar would only be approximate.
 */
export default function SpendingBreakdown({ title, rows = [], total, emptyText }) {
  const T = useT();
  const reduce = useReducedMotion();

  const sum = Number(total ?? 0);
  const largest = rows.reduce((max, r) => Math.max(max, Number(r.amount ?? 0)), 0);

  return (
    <Box sx={{ mb: 3 }}>
      <Typography sx={{
        fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase',
        color: T.textFaint, mb: 1.25,
      }}>
        {title}
      </Typography>

      {rows.length === 0 ? (
        <Typography sx={{ fontSize: 13.5, color: T.textMuted }}>{emptyText}</Typography>
      ) : rows.map((row, index) => {
        const amount = Number(row.amount ?? 0);
        const share = sum > 0 ? Math.round((amount / sum) * 100) : 0;
        const width = largest > 0 ? (amount / largest) * 100 : 0;

        return (
          <Box
            key={row.key}
            component={motion.div}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: reduce ? 0 : Math.min(index * 0.04, 0.3),
              ease: [0.22, 1, 0.36, 1] }}
            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.9 }}
          >
            <Box sx={{
              width: 34, height: 34, borderRadius: 2, flexShrink: 0,
              display: 'grid', placeItems: 'center', fontSize: 17,
              bgcolor: T.glass, border: `1px solid ${T.border}`,
            }}>
              {row.emoji}
            </Box>

            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
                <Typography noWrap sx={{
                  fontSize: 14, fontWeight: 700, color: T.textPrimary, flex: 1, minWidth: 0,
                }}>
                  {row.label}
                </Typography>
                <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: T.textPrimary }}>
                  {formatMoney(amount)}
                </Typography>
                <Typography sx={{
                  fontSize: 11.5, color: T.textFaint, fontWeight: 700,
                  minWidth: 34, textAlign: 'right',
                }}>
                  {share}%
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
