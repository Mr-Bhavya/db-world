import { useState } from 'react';
import { Box, Collapse, Typography } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { motion, useReducedMotion } from 'framer-motion';
import { useT } from '@shared/theme';
import { joinNames } from '../utils/tallyFormat';
import LedgerRow from './LedgerRow';

/**
 * Ledgers with nothing outstanding, folded behind one line.
 *
 * <p>Four of five ledgers reading "All settled up" is the normal state of a working expense app,
 * and it used to fill the screen — the one ledger that needed attention was a tile among tiles.
 * Settled ledgers are still <em>reachable</em>, because a finished trip is exactly the thing you
 * go back to look at, but they are not competing for the same space as an open debt.
 *
 * <p>Collapsed, not hidden: the header names the first few, so this reads as "those four are
 * fine" rather than as something missing. Hiding them outright would leave the reader wondering
 * where a group went, which is worse than a row they have to tap.
 *
 * <p>Open state is local and resets on navigation, deliberately. Remembering it would mean
 * somebody who expanded once is back to a wall of settled ledgers every visit, which is the
 * thing this exists to prevent.
 */
export default function CollapsedLedgers({ ledgers, label, icon, onOpen, tone = 'settled' }) {
  const T = useT();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);

  if (!ledgers?.length) return null;

  const names = joinNames(ledgers.slice(0, 3).map((l) => l.name));

  return (
    <Box sx={{ mb: 2.5 }}>
      <Box
        component={motion.button}
        type="button"
        whileTap={{ scale: 0.995 }}
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.25, width: '100%',
          px: 1.75, py: 1.25, borderRadius: 3, cursor: 'pointer',
          textAlign: 'left', fontFamily: 'inherit',
          bgcolor: 'transparent', border: `1px solid ${T.border}`,
          transition: 'background-color .18s ease, border-color .18s ease',
          '&:hover': { bgcolor: T.glass, borderColor: T.borderHover },
          '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
        }}
      >
        <Box sx={{
          display: 'grid', placeItems: 'center', flexShrink: 0,
          color: tone === 'settled' ? T.success : T.textFaint,
        }}>
          {icon}
        </Box>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>
            {ledgers.length} {label}
          </Typography>
          {!open && (
            <Typography noWrap sx={{ fontSize: 12.5, color: T.textFaint, mt: 0.1 }}>
              {names}
            </Typography>
          )}
        </Box>

        <Box
          component={motion.div}
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
          sx={{ display: 'grid', placeItems: 'center', flexShrink: 0 }}
        >
          <ExpandMoreRoundedIcon sx={{ fontSize: 20, color: T.textMuted }} />
        </Box>
      </Box>

      <Collapse in={open} timeout={reduce ? 0 : 240}>
        <Box sx={{
          mt: 0.75, borderRadius: 3, overflow: 'hidden',
          border: `1px solid ${T.border}`,
          '& > *:not(:last-child)': { borderBottom: `1px solid ${T.border}` },
        }}>
          {ledgers.map((ledger, i) => (
            <LedgerRow
              key={ledger.id}
              ledger={ledger}
              index={i}
              variant="compact"
              onOpen={() => onOpen(ledger)}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}
