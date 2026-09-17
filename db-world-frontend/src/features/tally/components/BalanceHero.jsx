import { Box, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { motion, useReducedMotion } from 'framer-motion';
import { useT } from '@shared/theme';
import { balanceColor, balanceTone, formatMoney } from '../utils/tallyFormat';

/**
 * The hero's resting height, for the home page's loading skeleton.
 *
 * <p>A FLOOR, not the height: a ledger with one outstanding balance also gets a "Settle up"
 * button, which on a phone stacks under the figure and makes the card taller. The floor covers
 * the shape every visit starts with, which is the one the skeleton is standing in for.
 */
export const BALANCE_HERO_MIN_H = { xs: 111, sm: 126 };

/**
 * Where you stand overall, as the subject of the page rather than a line of its subtitle.
 *
 * <p>This number used to be a sentence above a grid of five equal cards — "Overall, you owe
 * ₹65,000.00" — while the one ledger responsible for it sat below looking like the four that
 * were square. It is the only thing on this screen that asks anything of the reader, so it gets
 * the largest type on it and, when there is exactly one ledger behind it, a way straight there.
 *
 * <p>Being square is its own state, not a zero. "You are all square" with a tick reads as the
 * good outcome it is; "₹0.00" in amber-or-green type reads like a number you should do something
 * about.
 */
export default function BalanceHero({ net, ledgerCount, only, onOpenOnly }) {
  const T = useT();
  const reduce = useReducedMotion();

  const tone = balanceTone(net, { self: true });
  const color = balanceColor(net, T);
  const square = tone.kind === 'settled';

  return (
    <Box
      component={motion.div}
      initial={reduce ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      sx={{
        display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' },
        gap: 2, p: { xs: 2, sm: 2.5 }, mb: 3, borderRadius: 3.5,
        minHeight: BALANCE_HERO_MIN_H, boxSizing: 'border-box',
        // Tinted by what the number means, so the page has a temperature before it is read.
        bgcolor: square ? T.glass : `${color}14`,
        border: `1px solid ${square ? T.glassBorder : `${color}3d`}`,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{
          fontSize: 11.5, fontWeight: 800, letterSpacing: 0.6,
          textTransform: 'uppercase', color: T.textFaint,
        }}>
          {square ? 'Nothing outstanding' : `${tone.label}, overall`}
        </Typography>

        {square ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
            <CheckCircleRoundedIcon sx={{ fontSize: 26, color: T.success }} />
            <Typography sx={{
              fontSize: { xs: 22, sm: 26 }, fontWeight: 800,
              color: T.textPrimary, letterSpacing: -0.6,
            }}>
              You are all square
            </Typography>
          </Box>
        ) : (
          <Typography sx={{
            fontSize: { xs: 30, sm: 36 }, fontWeight: 800, color,
            letterSpacing: -1.2, lineHeight: 1.15, mt: 0.25,
          }}>
            {formatMoney(Math.abs(net))}
          </Typography>
        )}

        <Typography sx={{ fontSize: 13, color: T.textMuted, mt: 0.4 }}>
          {square
            ? ledgerCount === 0
              ? 'Split an expense with anyone — account or not'
              : `Across ${ledgerCount} ${ledgerCount === 1 ? 'ledger' : 'ledgers'}`
            : only
              ? `in ${only.name}`
              : `across ${ledgerCount} ${ledgerCount === 1 ? 'ledger' : 'ledgers'}`}
        </Typography>
      </Box>

      {/* Offered only when there is one place to go. A button that has to ask "which one?" is
          the list below it, so with several outstanding this is deliberately absent. */}
      {only && (
        <Box
          component={motion.button}
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={onOpenOnly}
          sx={{
            // Full width on a phone, where the card is a column and an inline pill is left
            // orphaned in the bottom-left corner. Inline from sm, where it sits beside the
            // figure. Matches GroupBalanceHero.
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            gap: 0.75, flexShrink: 0,
            width: { xs: '100%', sm: 'auto' },
            px: 2, py: { xs: 1.25, sm: 1 }, borderRadius: 2.5, cursor: 'pointer',
            fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
            color, bgcolor: 'transparent', border: `1px solid ${color}66`,
            transition: 'background-color .18s ease',
            '&:hover': { bgcolor: `${color}1f` },
            '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
          }}
        >
          Settle up
          <ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />
        </Box>
      )}
    </Box>
  );
}
