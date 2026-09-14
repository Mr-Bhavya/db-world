import { Box, Typography, Chip } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { useT } from '@shared/theme';
import { balanceTone, balanceColor } from '../utils/tallyFormat';

/**
 * One group in the list.
 *
 * The card answers one question — *where do I stand in this group* — and puts that answer in
 * the biggest type on it. The name is the label; the balance is the content. A grid of groups
 * showing only names would make you open every one of them to find the one that needs you.
 */
export default function GroupCard({ group, onOpen, index = 0 }) {
  const T = useT();
  const reduce = useReducedMotion();

  const tone = balanceTone(group.myBalance, { self: true });
  const color = balanceColor(group.myBalance, T);
  const settled = tone.kind === 'settled';

  return (
    <Box
      component={motion.div}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      // Staggered by position, capped so the twentieth card is not still waiting its turn.
      transition={{ duration: 0.28, delay: reduce ? 0 : Math.min(index * 0.04, 0.32), ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduce ? undefined : { y: -3 }}
      whileTap={{ scale: 0.99 }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(); } }}
      aria-label={`${group.name}. ${tone.label}${tone.amount ? ` ${tone.amount}` : ''}`}
      sx={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        gap: 1.5, p: 2, borderRadius: 3.5, cursor: 'pointer',
        bgcolor: T.glass,
        border: `1px solid ${T.glassBorder}`,
        opacity: group.archived ? 0.62 : 1,
        transition: 'border-color .18s ease, background-color .18s ease',
        '&:hover': { borderColor: T.glassBorderHover, bgcolor: T.glassHover },
        '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
      }}
    >
      {/* A colour bar down the left edge: readable at a glance, and the only thing that has to
          be scanned when the grid is full. */}
      <Box sx={{
        position: 'absolute', left: 0, top: 14, bottom: 14, width: 3,
        borderRadius: 999, bgcolor: settled ? T.border : color,
      }} />

      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, pl: 1 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography noWrap sx={{
            fontSize: 16, fontWeight: 800, color: T.textPrimary, letterSpacing: -0.2,
          }}>
            {group.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.4 }}>
            <GroupsRoundedIcon sx={{ fontSize: 14, color: T.textMuted }} />
            <Typography sx={{ fontSize: 12, color: T.textMuted }}>
              {group.memberCount} {group.memberCount === 1 ? 'person' : 'people'}
            </Typography>
            {group.category && (
              <>
                <Box sx={{ width: 3, height: 3, borderRadius: 999, bgcolor: T.textMuted, opacity: 0.6 }} />
                <Typography noWrap sx={{ fontSize: 12, color: T.textMuted }}>{group.category}</Typography>
              </>
            )}
          </Box>
        </Box>
        <ChevronRightRoundedIcon sx={{ fontSize: 20, color: T.textMuted, flexShrink: 0, mt: 0.25 }} />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1, pl: 1 }}>
        {settled ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <CheckCircleRoundedIcon sx={{ fontSize: 17, color: T.textMuted }} />
            <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: T.textMuted }}>
              All settled up
            </Typography>
          </Box>
        ) : (
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: T.textMuted, letterSpacing: 0.2 }}>
              {tone.label.toUpperCase()}
            </Typography>
            <Typography sx={{
              fontSize: 22, fontWeight: 800, color, letterSpacing: -0.6, lineHeight: 1.15,
            }}>
              {tone.amount}
            </Typography>
          </Box>
        )}

        {group.archived && (
          <Chip
            size="small"
            icon={<Inventory2OutlinedIcon sx={{ fontSize: 13 }} />}
            label="Archived"
            sx={{
              height: 22, fontSize: 10.5, fontWeight: 700,
              bgcolor: T.glass, color: T.textMuted, border: `1px solid ${T.border}`,
              '& .MuiChip-icon': { color: T.textMuted, ml: 0.6 },
            }}
          />
        )}
      </Box>
    </Box>
  );
}
