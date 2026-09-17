import { Box, Typography } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import { useT } from '@shared/theme';
import { avatarColor, formatMoneyCompact, initialsOf } from '../utils/tallyFormat';
import { useChartPalette } from '../utils/chartPalette';

/**
 * Who carried the group, and who used it — two bars per person on one shared scale.
 *
 * <h2>Why two bars and not one</h2>
 * This used to print both figures as text and draw only <em>used</em>. The gap between fronting
 * the money and consuming it is the entire story of a shared ledger, and a gap between two
 * numbers written a centimetre apart is something the reader has to compute; a gap between two
 * bars is something they see. So both are drawn.
 *
 * <p>Both bars, for every member, are measured against <b>one</b> maximum — the largest of either
 * figure anywhere in the list. Scaling each row to its own longest bar would make somebody who
 * paid ₹200 and used ₹100 look exactly like somebody who paid ₹20,000 and used ₹10,000, which is
 * the one comparison this panel exists to make.
 *
 * <p>No net column, deliberately. Paid minus used over one month is not what anybody owes — it
 * ignores settlements and every period before this one — and a number that looks like a balance
 * but is not would be read as one. The real balance is in the panel beside this page.
 */
export default function GroupMemberSpending({ rows = [] }) {
  const T = useT();
  const palette = useChartPalette();
  const reduce = useReducedMotion();

  const usedColor = palette.at(0);
  const paidColor = palette.at(1);

  if (rows.length === 0) {
    return (
      <Typography sx={{ fontSize: 13.5, color: T.textMuted }}>
        Nobody spent anything in this period
      </Typography>
    );
  }

  const largest = rows.reduce(
    (max, r) => Math.max(max, Number(r.paid ?? 0), Number(r.consumed ?? 0)),
    0,
  );

  return (
    <Box>
      {/* Two series means a legend, always. The amounts on each row name them again, but the
          bars are read before the text is. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
        <Key color={paidColor} label="paid at the till" />
        <Key color={usedColor} label="actually used" />
      </Box>

      {rows.map((row, index) => {
        const paid = Number(row.paid ?? 0);
        const consumed = Number(row.consumed ?? 0);
        const delay = reduce ? 0 : Math.min(index * 0.04, 0.3);

        return (
          <Box
            key={row.memberId}
            component={motion.div}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay, ease: [0.22, 1, 0.36, 1] }}
            sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1 }}
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
              {/* The name takes a whole line of its own on a phone. Sharing one with both
                  amounts left it about 90px wide, which turned "Jaykishan Dudhrejiya" into
                  "Jaykis…" — and a row about who paid what is no use once you cannot tell who.
                  The amounts wrap underneath instead, where they have the width to stay whole. */}
              <Box sx={{
                display: 'flex', alignItems: 'baseline', flexWrap: 'wrap',
                columnGap: 1, rowGap: 0.25, mb: 0.75,
              }}>
                <Typography noWrap sx={{
                  fontSize: 14, fontWeight: 700, color: T.textPrimary, minWidth: 0,
                  flex: { xs: '1 1 100%', sm: '1 1 auto' },
                }}>
                  {row.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, ml: { sm: 'auto' } }}>
                  <Typography sx={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap' }}>
                    paid{' '}
                    <Box component="span" sx={{ fontWeight: 700, color: T.textPrimary }}>
                      {formatMoneyCompact(paid)}
                    </Box>
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap' }}>
                    used{' '}
                    <Box component="span" sx={{ fontWeight: 800, color: T.textPrimary }}>
                      {formatMoneyCompact(consumed)}
                    </Box>
                  </Typography>
                </Box>
              </Box>

              <Bar value={paid} largest={largest} color={paidColor} delay={delay} T={T} />
              <Box sx={{ height: 2 }} />
              <Bar value={consumed} largest={largest} color={usedColor} delay={delay} T={T} />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function Key({ color, label }) {
  const T = useT();
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}>
      <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: color, flexShrink: 0 }} />
      <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: T.textMuted }}>
        {label}
      </Typography>
    </Box>
  );
}

/**
 * One bar.
 *
 * <p>A minimum width once the value is non-zero: a member who paid ₹20 beside one who paid
 * ₹20,000 would otherwise draw as nothing at all, which reads as "did not pay" rather than
 * "paid a little".
 */
function Bar({ value, largest, color, delay, T }) {
  const width = largest > 0 && value > 0 ? Math.max((value / largest) * 100, 1.5) : 0;
  const reduce = useReducedMotion();

  return (
    <Box sx={{ height: 6, borderRadius: 99, bgcolor: T.glass, overflow: 'hidden' }}>
      <Box
        component={motion.div}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${width}%` }}
        transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
        sx={{ height: '100%', borderRadius: 99, bgcolor: color }}
      />
    </Box>
  );
}
