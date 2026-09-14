import { Box, Typography } from '@mui/material';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded';
import { motion, useReducedMotion } from 'framer-motion';
import { useT } from '@shared/theme';
import { groupIcon } from '../utils/tallyFormat';

/**
 * Your own spending, pinned above everything else.
 *
 * <p>Deliberately a different shape from a {@link GroupCard} rather than one more card in the
 * grid. It answers a different question — "what have I spent", not "where do I stand with
 * these people" — and it has no balance to show, because a ledger with one member in it is
 * always at zero. Dropping it into the grid would invite the reader to compare a number that
 * does not exist against ones that do.
 *
 * <p>Before it exists this is the invitation to start one; the two states are the same
 * component so the thing does not move on the page the moment you tap it.
 */
export default function PersonalCard({ ledger, onOpen, busy }) {
  const T = useT();
  const reduce = useReducedMotion();
  const started = Boolean(ledger);

  return (
    <Box
      component={motion.div}
      initial={reduce ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduce ? undefined : { y: -2 }}
      whileTap={{ scale: 0.995 }}
      onClick={busy ? undefined : onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (!busy && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen?.(); }
      }}
      aria-label={started ? 'Open your own spending' : 'Start tracking your own spending'}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 2, py: 1.75, mb: 2.5, borderRadius: 3.5,
        cursor: busy ? 'default' : 'pointer',
        opacity: busy ? 0.6 : 1,
        bgcolor: started ? T.tealBg : T.glass,
        border: `1px ${started ? 'solid' : 'dashed'} ${started ? T.glassBorderHover : T.glassBorder}`,
        transition: 'border-color .18s ease, background-color .18s ease',
        '&:hover': { borderColor: T.glassBorderHover },
        '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
      }}
    >
      <Box sx={{
        width: 40, height: 40, borderRadius: 2.5, flexShrink: 0,
        display: 'grid', placeItems: 'center', fontSize: 20,
        bgcolor: T.glass, border: `1px solid ${T.border}`,
      }}>
        {started ? groupIcon(ledger) : <SavingsRoundedIcon sx={{ fontSize: 20, color: T.teal }} />}
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography noWrap sx={{
          fontSize: 15.5, fontWeight: 800, color: T.textPrimary, letterSpacing: -0.2,
        }}>
          {started ? ledger.name : 'Track your own spending'}
        </Typography>
        <Typography noWrap sx={{ fontSize: 12.5, color: T.textMuted, mt: 0.2 }}>
          {started
            ? 'Just for you — nothing shared, nobody to settle with'
            : 'Keep your own expenses here alongside the shared ones'}
        </Typography>
      </Box>

      <ChevronRightRoundedIcon sx={{ fontSize: 20, color: T.textMuted, flexShrink: 0 }} />
    </Box>
  );
}
