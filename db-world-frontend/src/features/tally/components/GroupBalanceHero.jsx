import { Box, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { motion, useReducedMotion } from 'framer-motion';
import { useT } from '@shared/theme';
import { balanceColor, balanceTone, joinNames } from '../utils/tallyFormat';

/**
 * The card's resting height, so the group page's loading skeleton can reserve it. Label (11/1.5)
 * + amount (27|32 at 1.15, mt 0.2) + caption (12.5/1.5, mt 0.35) + padding + border.
 *
 * <p>A floor: the settle-up button stacks underneath on a phone and makes it taller.
 */
export const GROUP_BALANCE_HERO_MIN_H = { xs: 105, sm: 115 };

/**
 * Where you stand in this group, and the one thing to do about it.
 *
 * <p>This used to be a 12.5px line of subtitle text under the group's name — "You owe ₹65,000.00
 * here" — while a side-scrolling rail of everybody's balance cards sat underneath it with far
 * more visual weight. The number you opened the page to check was the smallest type on it.
 *
 * <p>Where the settle-up plan is known, the caption says who to pay rather than restating the
 * balance. "You owe ₹65,000" tells you the problem; "one payment clears it: pay Jaykishan" tells
 * you what to do, and that is the whole reason the plan is computed.
 */
export default function GroupBalanceHero({ balance, plan = [], myMemberId, onSettleUp, archived }) {
  const T = useT();
  const reduce = useReducedMotion();

  const tone = balanceTone(balance, { self: true });
  const color = balanceColor(balance, T);
  const square = tone.kind === 'settled';

  // Only the legs that involve me. The plan clears the whole group, and somebody else's
  // transfer to a third person is not an instruction to me.
  const mine = plan.filter((t) => t.fromMemberId === myMemberId || t.toMemberId === myMemberId);
  const paying = mine.filter((t) => t.fromMemberId === myMemberId);
  const collecting = mine.filter((t) => t.toMemberId === myMemberId);

  const caption = () => {
    if (square) return 'Nobody owes anybody anything here';
    if (paying.length === 1) return `One payment clears it: pay ${paying[0].toMemberName}`;
    if (paying.length > 1) return `Clears with ${paying.length} payments, to ${joinNames(paying.map((t) => t.toMemberName))}`;
    if (collecting.length === 1) return `${collecting[0].fromMemberName} owes you this`;
    if (collecting.length > 1) return `Owed by ${joinNames(collecting.map((t) => t.fromMemberName))}`;
    // The plan has not arrived, or this balance nets out through somebody else.
    return tone.kind === 'owes' ? 'Settle up to clear it' : 'Waiting to be paid back';
  };

  return (
    <Box
      component={motion.div}
      initial={reduce ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      sx={{
        display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' },
        gap: 2, p: { xs: 2, sm: 2.25 }, mb: 2.5, borderRadius: 3.5,
        minHeight: GROUP_BALANCE_HERO_MIN_H, boxSizing: 'border-box',
        bgcolor: square ? T.glass : `${color}14`,
        border: `1px solid ${square ? T.glassBorder : `${color}3d`}`,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{
          fontSize: 11, fontWeight: 800, letterSpacing: 0.55,
          textTransform: 'uppercase', color: T.textFaint,
        }}>
          {square ? 'All square here' : `${tone.label}, in this group`}
        </Typography>

        {square ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.6 }}>
            <CheckCircleRoundedIcon sx={{ fontSize: 23, color: T.success }} />
            <Typography sx={{
              fontSize: { xs: 19, sm: 22 }, fontWeight: 800,
              color: T.textPrimary, letterSpacing: -0.5,
            }}>
              Everyone is settled up
            </Typography>
          </Box>
        ) : (
          <Typography sx={{
            fontSize: { xs: 27, sm: 32 }, fontWeight: 800, color,
            letterSpacing: -1, lineHeight: 1.15, mt: 0.2,
          }}>
            {tone.amount}
          </Typography>
        )}

        <Typography sx={{ fontSize: 12.5, color: T.textMuted, mt: 0.35 }}>
          {caption()}
        </Typography>
      </Box>

      {/* Archived groups are readable but closed to writes, so there is nothing to offer. */}
      {!square && !archived && (
        <Box
          component={motion.button}
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={onSettleUp}
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.75, flexShrink: 0,
            px: 2, py: 1, borderRadius: 2.5, cursor: 'pointer',
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
