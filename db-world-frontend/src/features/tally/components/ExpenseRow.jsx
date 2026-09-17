import { useState } from 'react';
import { Box, Typography, IconButton, Menu, MenuItem, ListItemIcon } from '@mui/material';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { motion, useReducedMotion } from 'framer-motion';
import { useT } from '@shared/theme';
import {
  formatMoney, categoryEmoji, paidByLabel, expenseImpact, impactLabel, balanceColor,
} from '../utils/tallyFormat';

/**
 * One expense in the feed.
 *
 * Three pieces of information, in the order people look for them: what it was, who paid, and
 * what it means for *you*. The last one is the reason this is a custom row rather than a list
 * item — "₹1,200 groceries" tells you nothing you can act on, and "You owe ₹400" does.
 */
export default function ExpenseRow({ expense, myMemberId, nameOf, onEdit, onVoid, index = 0 }) {
  const T = useT();
  const reduce = useReducedMotion();
  const [menuAt, setMenuAt] = useState(null);

  const impact = expenseImpact(expense, myMemberId);
  const label = impactLabel(impact);
  const tint = label.kind === 'settled' ? T.textMuted : balanceColor(impact.net, T);

  return (
    <Box
      component={motion.div}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: reduce ? 0 : Math.min(index * 0.025, 0.2) }}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: { xs: 1.25, sm: 1.75 }, py: 1.5, borderRadius: 3,
        bgcolor: T.glass, border: `1px solid ${T.border}`,
        transition: 'border-color .15s ease, background-color .15s ease',
        '&:hover': { bgcolor: T.glassHover, borderColor: T.borderHover },
      }}
    >
      <Box sx={{
        width: 38, height: 38, borderRadius: 2.5, flexShrink: 0,
        display: 'grid', placeItems: 'center', fontSize: 18,
        bgcolor: T.glassHover, border: `1px solid ${T.border}`,
      }}>
        {categoryEmoji(expense.category)}
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography noWrap sx={{ fontSize: 14.5, fontWeight: 700, color: T.textPrimary }}>
          {expense.description}
        </Typography>
        <Typography noWrap sx={{ fontSize: 12, color: T.textMuted, mt: 0.15 }}>
          {paidByLabel(expense, nameOf)} {formatMoney(expense.totalAmount)}
        </Typography>
      </Box>

      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography sx={{
          fontSize: 13.5, fontWeight: 800, color: tint, whiteSpace: 'nowrap', lineHeight: 1.3,
        }}>
          {label.kind === 'settled' ? label.text : formatMoney(Math.abs(impact.net))}
        </Typography>
        {label.kind !== 'settled' && (
          <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: T.textMuted, letterSpacing: 0.2 }}>
            {impact.net > 0 ? 'YOU GET BACK' : 'YOU OWE'}
          </Typography>
        )}
      </Box>

      <IconButton
        size="small"
        aria-label={`Options for ${expense.description}`}
        onClick={(e) => setMenuAt(e.currentTarget)}
        sx={{ color: T.textMuted, flexShrink: 0, ml: -0.5 }}
      >
        <MoreVertRoundedIcon sx={{ fontSize: 19 }} />
      </IconButton>

      <Menu
        anchorEl={menuAt}
        open={Boolean(menuAt)}
        onClose={() => setMenuAt(null)}
        slotProps={{
          paper: {
            sx: {
              bgcolor: T.bg, backgroundImage: 'none', borderRadius: 2.5,
              border: `1px solid ${T.glassBorder}`, minWidth: 168,
            },
          },
        }}
      >
        <MenuItem
          onClick={() => { setMenuAt(null); onEdit?.(expense); }}
          sx={{ fontSize: 14, color: T.textPrimary, gap: 0 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <EditRoundedIcon sx={{ fontSize: 17, color: T.textMuted }} />
          </ListItemIcon>
          Correct this
        </MenuItem>
        <MenuItem
          onClick={() => { setMenuAt(null); onVoid?.(expense); }}
          sx={{ fontSize: 14, color: '#ef4444', gap: 0 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <DeleteOutlineRoundedIcon sx={{ fontSize: 17, color: '#ef4444' }} />
          </ListItemIcon>
          Remove
        </MenuItem>
      </Menu>
    </Box>
  );
}
