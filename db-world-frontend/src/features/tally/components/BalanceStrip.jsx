import { Box, Typography } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { useT } from '@shared/theme';
import { formatMoney, balanceColor } from '../utils/tallyFormat';
import { MemberAvatar } from './tallyFormUi';

/**
 * Where everybody stands, as a row of cards.
 *
 * Scrolls sideways rather than wrapping or truncating: a group of eight has eight balances and
 * all of them matter, but only two or three fit across a phone. A horizontal rail keeps every
 * card the same size and readable, where a wrapping grid would push the expense feed — the
 * thing people actually came to read — below the fold.
 *
 * Sorted by how far from zero somebody is, so the person who most needs paying is first and
 * nobody has to scroll to find the outlier.
 */
export default function BalanceStrip({ members = [], myMemberId, onSelect }) {
  const T = useT();
  const reduce = useReducedMotion();

  const active = members
    .filter((m) => m.status === 'ACTIVE' && Number(m.balance ?? 0) !== 0)
    .sort((a, b) => Math.abs(Number(b.balance)) - Math.abs(Number(a.balance)));

  if (!active.length) {
    return (
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.25,
        px: 2, py: 1.75, borderRadius: 3,
        bgcolor: T.tealBg, border: `1px solid ${T.glassBorderHover}`,
      }}>
        <CheckCircleRoundedIcon sx={{ fontSize: 20, color: T.teal }} />
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: T.textPrimary }}>
            Everyone is settled up
          </Typography>
          <Typography sx={{ fontSize: 12, color: T.textMuted }}>
            Nobody owes anybody anything right now.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex', gap: 1.25, overflowX: 'auto', pb: 0.5,
        // Edge-to-edge on a phone so the rail visibly continues past the screen, which is what
        // tells somebody it scrolls. Negative margin plus matching padding, not a wider box.
        mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 },
        scrollSnapType: 'x proximity',
        scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      {active.map((member, i) => {
        const balance = Number(member.balance);
        const color = balanceColor(balance, T);
        const isMe = member.id === myMemberId;
        return (
          <Box
            key={member.id}
            component={motion.div}
            initial={reduce ? false : { opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.26, delay: reduce ? 0 : Math.min(i * 0.05, 0.3) }}
            whileTap={onSelect ? { scale: 0.97 } : undefined}
            onClick={() => onSelect?.(member)}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onKeyDown={onSelect ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(member); }
            } : undefined}
            sx={{
              flexShrink: 0, minWidth: 148, scrollSnapAlign: 'start',
              px: 1.5, py: 1.25, borderRadius: 3,
              cursor: onSelect ? 'pointer' : 'default',
              bgcolor: isMe ? T.tealBg : T.glass,
              border: `1px solid ${isMe ? T.glassBorderHover : T.border}`,
              '&:hover': onSelect ? { borderColor: T.borderHover } : undefined,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.9 }}>
              <MemberAvatar member={member} size={26} />
              <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 700, color: T.textPrimary }}>
                {isMe ? 'You' : member.displayName}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: T.textMuted, letterSpacing: 0.2 }}>
              {balance > 0 ? (isMe ? 'YOU ARE OWED' : 'IS OWED') : (isMe ? 'YOU OWE' : 'OWES')}
            </Typography>
            <Typography sx={{ fontSize: 17, fontWeight: 800, color, letterSpacing: -0.4 }}>
              {formatMoney(Math.abs(balance))}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
