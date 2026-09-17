import { useState } from 'react';
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
 *
 * <p>A row may carry its own {@code color}, in which case the bar and the ring around its icon
 * take it. That is how this list doubles as the legend for the donut beside it — the ring names
 * the slice, and the label and amount are the visible labels the two lightest hues in the
 * palette are only allowed on screen with. Rows without a colour stay the accent, which is what
 * the personal report — where there is no donut to tie to — passes.
 */
export default function SpendingBreakdown({ title, rows = [], total, emptyText, max }) {
  const T = useT();
  const reduce = useReducedMotion();
  const [showAll, setShowAll] = useState(false);

  const sum = Number(total ?? 0);
  // Against the full list, not the visible slice: collapsing the tail must not make the seventh
  // row suddenly the longest bar in the chart.
  const largest = rows.reduce((max_, r) => Math.max(max_, Number(r.amount ?? 0)), 0);

  const capped = Boolean(max) && rows.length > max && !showAll;
  const visible = capped ? rows.slice(0, max) : rows;
  const hidden = rows.length - visible.length;

  return (
    // No title means the caller has already put one on the card this sits in, and the spacing
    // below the list belongs to that card rather than to the list.
    <Box sx={{ mb: title ? 3 : 0 }}>
      {title && (
        <Typography sx={{
          fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase',
          color: T.textFaint, mb: 1.25,
        }}>
          {title}
        </Typography>
      )}

      {rows.length === 0 ? (
        <Typography sx={{ fontSize: 13.5, color: T.textMuted }}>{emptyText}</Typography>
      ) : visible.map((row, index) => {
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
              bgcolor: row.color ? `${row.color}1f` : T.glass,
              border: `${row.color ? 2 : 1}px solid ${row.color ?? T.border}`,
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
                  sx={{ height: '100%', borderRadius: 99, bgcolor: row.color ?? T.teal }}
                />
              </Box>
            </Box>
          </Box>
        );
      })}

      {/* The long tail is real spending, so it is never dropped — only folded. Nine categories
          beside a donut made the card twice the height of the ring it was explaining, and the
          rows past the seventh are the ones the ring has already folded into its grey slice, so
          collapsing exactly those keeps the two halves of the card saying the same thing. */}
      {(capped || showAll) && (
        <Box
          component="button"
          type="button"
          onClick={() => setShowAll((open) => !open)}
          sx={{
            display: 'block', mt: 0.75, px: 0, py: 0.5, border: 'none', bgcolor: 'transparent',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
            color: T.teal,
            '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
          }}
        >
          {capped ? `Show ${hidden} more` : 'Show fewer'}
        </Box>
      )}
    </Box>
  );
}
