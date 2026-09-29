/**
 * The controls for asking for something the library does not hold.
 *
 * Shared because an episode can now be reached from two places: its row, and the sheet
 * that row opens. Two copies of a vote-aware pill would drift, and the state it shows —
 * whether YOU asked, and how many others are waiting — has to read the same in both.
 */
import React from 'react';
import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import AddRoundedIcon from '@mui/icons-material/Add';
import { useT } from '@shared/theme/ThemeContext';

export function RequestPill({ label, requestedLabel, request, onClick, size = 'sm' }) {
  const T = useT();
  const mine = !!request?.hasMyVote;
  const count = request?.voteCount ?? 0;
  // Your own vote is already in the count, so it only tells you something once
  // somebody else is waiting too.
  const others = mine ? count - 1 : count;

  return (
    <Box
      component={motion.button}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      aria-pressed={mine}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.6,
        borderRadius: 999, cursor: 'pointer', flexShrink: 0,
        bgcolor: mine ? alpha(T.teal, 0.16) : 'transparent',
        color: mine ? T.teal : T.textFaint,
        border: `1px solid ${mine ? alpha(T.teal, 0.42) : alpha(T.text, 0.14)}`,
        px: size === 'md' ? 1.75 : 1.5,
        py: size === 'md' ? 0.65 : 0.55,
        fontWeight: 700,
        fontSize: size === 'md' ? '0.75rem' : '0.72rem',
        '&:hover': {
          color: mine ? T.teal : T.text,
          borderColor: mine ? alpha(T.teal, 0.6) : alpha(T.text, 0.28),
          bgcolor: mine ? alpha(T.teal, 0.24) : alpha(T.text, 0.06),
        },
      }}
    >
      {mine ? <CheckRoundedIcon sx={{ fontSize: 15 }} /> : <AddRoundedIcon sx={{ fontSize: 15 }} />}
      {mine ? (requestedLabel ?? 'Requested') : label}
      {others > 0 && (
        <Box component="span" sx={{ color: mine ? T.teal : T.textMuted, fontWeight: 600, opacity: 0.85 }}>
          · {others} {mine ? 'more' : 'waiting'}
        </Box>
      )}
    </Box>
  );
}

/** Non-interactive marker for something a wider request of yours already asks for. */
export function CoveredNote({ request }) {
  const T = useT();
  const label = request?.scopeLabel === 'All'
    ? 'In your request for this show'
    : `In your ${request?.scopeLabel} request`;
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      color: alpha(T.teal, 0.85), fontWeight: 700, fontSize: '0.72rem',
    }}>
      <CheckRoundedIcon sx={{ fontSize: 14 }} /> {label}
    </Box>
  );
}
