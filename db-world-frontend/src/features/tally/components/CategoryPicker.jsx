import { useState } from 'react';
import { Box } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import { COMMON_CATEGORIES, EXPENSE_CATEGORIES } from '../utils/tallyFormat';
import CategorySheet from './CategorySheet';

/**
 * Eight chips and a way to reach the other twenty-three.
 *
 * The full list laid out as chips would wrap to five rows on a phone and become the biggest
 * thing in the dialog, pushing the split section below the fold. So the common ones sit in the
 * open and the rest live behind "More".
 *
 * "More" used to open an anchored popover; it opens {@link CategorySheet} now, for the reasons
 * written up there. This component's own job is unchanged: show the handful people actually
 * use, and never hide the current selection behind a button that just says "More" — a category
 * chosen from the sheet is rendered as its own chip beside the common ones.
 */
export default function CategoryPicker({ value, onChange }) {
  const T = useT();
  const [open, setOpen] = useState(false);

  const isCommon = COMMON_CATEGORIES.some((c) => c?.value === value);
  const selectedOutlier = value && !isCommon
    ? EXPENSE_CATEGORIES.find((c) => c.value === value)
    : null;

  const chip = (item, selected, onClick) => (
    <Box
      key={item.value}
      component={motion.button}
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.6,
        px: 1.25, py: 0.6, borderRadius: 999, cursor: 'pointer',
        fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap',
        bgcolor: selected ? T.tealBg : T.glass,
        color: selected ? T.teal : T.textMuted,
        border: `1px solid ${selected ? T.glassBorderHover : T.border}`,
        transition: 'all .15s ease',
      }}
    >
      <span aria-hidden>{item.emoji}</span>{item.value}
    </Box>
  );

  return (
    <Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {COMMON_CATEGORIES.filter(Boolean).map((item) => chip(
          item,
          value === item.value,
          // Tapping the chosen one again clears it, so "optional" really is optional.
          () => onChange(value === item.value ? '' : item.value),
        ))}

        {selectedOutlier && chip(selectedOutlier, true, () => onChange(''))}

        <Box
          component={motion.button}
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={() => setOpen(true)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.3,
            px: 1.25, py: 0.6, borderRadius: 999, cursor: 'pointer',
            fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
            bgcolor: 'transparent', color: T.teal,
            border: `1px dashed ${T.glassBorderHover}`,
          }}
        >
          More
          <ExpandMoreRoundedIcon sx={{ fontSize: 15 }} />
        </Box>
      </Box>

      <CategorySheet
        open={open}
        value={value}
        onClose={() => setOpen(false)}
        onPick={(category) => { onChange(category); setOpen(false); }}
      />
    </Box>
  );
}
