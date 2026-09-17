import { Box, Typography } from '@mui/material';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { motion, useReducedMotion } from 'framer-motion';
import { useT } from '@shared/theme';
import { balanceColor, balanceTone, lastActivity } from '../utils/tallyFormat';
import LedgerAvatar from './LedgerAvatar';

/**
 * A prominent row's resting height, for the list's loading skeleton to match. Name (15.5/1.5)
 * over the meta line (12/1.5, mt 0.25), plus py 1.75 and the border — the avatar and the amount
 * column are both shorter than that, so the name column sets it.
 */
export const LEDGER_ROW_MIN_H = 74;

/**
 * One ledger, as a full-width row.
 *
 * <p>Rows rather than the grid of cards this replaces. A grid gives every ledger the same weight,
 * which is exactly wrong when one of five needs you and the other four are square — the one that
 * matters became a tile among tiles. A row lets the amount sit right-aligned in its own column,
 * so a list is scanned down one edge instead of read tile by tile. It also stops a single card
 * leaving two holes in a three-column grid.
 *
 * <p>Two densities. {@code prominent} is for a ledger with a balance: an accent edge, the amount
 * in large type. {@code compact} is for settled and archived ones, where there is no number worth
 * the height — a name, who is in it, and when it last moved.
 */
export default function LedgerRow({ ledger, onOpen, index = 0, variant = 'prominent' }) {
  const T = useT();
  const reduce = useReducedMotion();

  const tone = balanceTone(ledger.myBalance, { self: true });
  const color = balanceColor(ledger.myBalance, T);
  const compact = variant === 'compact';
  const direct = ledger.kind === 'DIRECT';

  return (
    <Box
      component={motion.div}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.26,
        delay: reduce ? 0 : Math.min(index * 0.035, 0.28),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileTap={{ scale: 0.995 }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(); }
      }}
      aria-label={`${ledger.name}. ${tone.label}${tone.amount ? ` ${tone.amount}` : ''}`}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
        px: compact ? 1.75 : 2, py: compact ? 1.25 : 1.75,
        minHeight: compact ? undefined : LEDGER_ROW_MIN_H, boxSizing: 'border-box',
        bgcolor: compact ? 'transparent' : T.glass,
        // An accent edge only where there is something to accent. Square corners on that side,
        // because a radius on one border reads as a rendering fault rather than a decision.
        borderLeft: compact ? 'none' : `3px solid ${color}`,
        borderRadius: compact ? 0 : '0 14px 14px 0',
        border: compact ? 'none' : `1px solid ${T.glassBorder}`,
        borderLeftColor: compact ? undefined : color,
        borderLeftWidth: compact ? undefined : 3,
        opacity: ledger.archived ? 0.68 : 1,
        transition: 'background-color .18s ease, border-color .18s ease',
        '&:hover': {
          bgcolor: compact ? T.glass : T.glassHover,
          borderColor: compact ? undefined : T.glassBorderHover,
          borderLeftColor: compact ? undefined : color,
        },
        '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: -2 },
      }}
    >
      <LedgerAvatar ledger={ledger} size={compact ? 'sm' : 'md'} />

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography noWrap sx={{
          fontSize: compact ? 14 : 15.5,
          fontWeight: compact ? 600 : 800,
          color: compact ? T.textMuted : T.textPrimary,
          letterSpacing: -0.2,
        }}>
          {ledger.name}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mt: 0.25, minWidth: 0 }}>
          {!compact && (direct
            ? <PersonRoundedIcon sx={{ fontSize: 13, color: T.textFaint }} />
            : <GroupsRoundedIcon sx={{ fontSize: 13, color: T.textFaint }} />)}
          <Typography noWrap sx={{ fontSize: 12, color: T.textFaint }}>
            {[
              direct ? 'one to one' : `${ledger.memberCount} people`,
              !compact && ledger.category,
              lastActivity(ledger.updatedAt),
            ].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
      </Box>

      {!compact && tone.amount && (
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography sx={{
            fontSize: 11, fontWeight: 700, color: T.textFaint, letterSpacing: 0.3,
          }}>
            {tone.label.toUpperCase()}
          </Typography>
          <Typography sx={{
            fontSize: 19, fontWeight: 800, color, letterSpacing: -0.5, lineHeight: 1.2,
          }}>
            {tone.amount}
          </Typography>
        </Box>
      )}

      {ledger.archived && (
        <Inventory2OutlinedIcon sx={{ fontSize: 15, color: T.textFaint, flexShrink: 0 }} />
      )}

      <ChevronRightRoundedIcon sx={{
        fontSize: compact ? 17 : 19, color: T.textFaint, flexShrink: 0,
      }} />
    </Box>
  );
}
