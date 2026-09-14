import { useMemo, useState } from 'react';
import {
  Box, Typography, Menu, MenuItem, ListSubheader, TextField, InputAdornment,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import { CATEGORY_GROUPS, COMMON_CATEGORIES, EXPENSE_CATEGORIES } from '../utils/tallyFormat';

/**
 * Eight chips and a way to reach the other twenty-odd.
 *
 * The full list laid out as chips would wrap to five rows on a phone and become the biggest
 * thing in the dialog, pushing the split section below the fold. So the common ones sit in the
 * open and the rest live behind "More", which opens a grouped, searchable menu — grouped
 * because that is how people look for these: you know you want a travel thing before you know
 * whether it is Train or Taxi.
 *
 * A category chosen from the menu is rendered as its own chip next to the common ones, so a
 * selection is never hidden behind a button that just says "More".
 */
export default function CategoryPicker({ value, onChange }) {
  const T = useT();
  const [menuAt, setMenuAt] = useState(null);
  const [term, setTerm] = useState('');

  const isCommon = COMMON_CATEGORIES.some((c) => c?.value === value);
  const selectedOutlier = value && !isCommon
    ? EXPENSE_CATEGORIES.find((c) => c.value === value)
    : null;

  const groups = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return CATEGORY_GROUPS;
    return CATEGORY_GROUPS
      .map((g) => ({ ...g, items: g.items.filter((i) => i.value.toLowerCase().includes(needle)) }))
      .filter((g) => g.items.length);
  }, [term]);

  const close = () => { setMenuAt(null); setTerm(''); };

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
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: T.textMuted, mb: 1 }}>
        Category <Box component="span" sx={{ fontWeight: 500 }}>(optional)</Box>
      </Typography>

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
          onClick={(e) => setMenuAt(e.currentTarget)}
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

      <Menu
        anchorEl={menuAt}
        open={Boolean(menuAt)}
        onClose={close}
        slotProps={{
          paper: {
            sx: {
              bgcolor: T.bg, backgroundImage: 'none', borderRadius: 3,
              border: `1px solid ${T.glassBorder}`, minWidth: 248, maxHeight: 380,
            },
          },
        }}
      >
        {/* Searching beats scrolling once the list is this long, and it keeps the menu usable
            on a phone where only a few rows are visible at a time. */}
        <Box sx={{ px: 1.25, pb: 1, pt: 0.5, position: 'sticky', top: 0, bgcolor: T.bg, zIndex: 1 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search categories"
            onKeyDown={(e) => e.stopPropagation()}   // stop the Menu stealing type-ahead keys
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ fontSize: 17, color: T.textMuted }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              '& .MuiInputBase-root': { bgcolor: T.glass, borderRadius: 2, fontSize: 13.5 },
              '& .MuiInputBase-input': { color: T.textPrimary },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
            }}
          />
        </Box>

        {groups.length === 0 && (
          <Typography sx={{ px: 2, py: 1.5, fontSize: 13, color: T.textMuted }}>
            Nothing matches “{term}”.
          </Typography>
        )}

        {groups.flatMap((group) => [
          <ListSubheader
            key={`h-${group.label}`}
            sx={{
              bgcolor: T.bg, color: T.textMuted, fontSize: 11,
              fontWeight: 800, lineHeight: '26px', letterSpacing: 0.3,
            }}
          >
            {group.label.toUpperCase()}
          </ListSubheader>,
          ...group.items.map((item) => (
            <MenuItem
              key={item.value}
              selected={value === item.value}
              onClick={() => { onChange(item.value); close(); }}
              sx={{
                fontSize: 14, gap: 1.25, color: T.textPrimary,
                '&.Mui-selected': { bgcolor: T.tealBg },
              }}
            >
              <span aria-hidden style={{ fontSize: 16 }}>{item.emoji}</span>
              {item.value}
            </MenuItem>
          )),
        ])}
      </Menu>
    </Box>
  );
}
