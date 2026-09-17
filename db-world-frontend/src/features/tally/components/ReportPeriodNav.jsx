import { useState } from 'react';
import { Box, IconButton, ListItemIcon, Menu, MenuItem, Typography } from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DateRangeRoundedIcon from '@mui/icons-material/DateRangeRounded';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useT } from '@shared/theme';
import { formatReportWindow } from '../utils/tallyFormat';
import { canStep, customWindow, isCustom, periodWindow, steppedWindow } from '../utils/reportWindow';
import CustomRangeDialog from './CustomRangeDialog';

const PERIODS = [
  { value: 'WEEK', label: 'This week' },
  { value: 'MONTH', label: 'This month' },
  { value: 'YEAR', label: 'This year' },
];

/**
 * Which stretch of time the report is showing, and how to move it.
 *
 * <h2>One row, not two</h2>
 * This was a Week/Month/Year toggle group on one line and a prev/label/next bar on another, in a
 * different visual language from the pill switches the report itself uses. The size of the window
 * and which window it is are the same question asked twice, so they are one control now: the
 * label in the middle says what you are looking at and opens the list of what else you could be
 * looking at, and the arrows either side move it.
 *
 * <h2>Stepping</h2>
 * A named period steps by handing back an anchor the <em>server</em> computed, because only the
 * server should be deciding that the month before 31 March is February rather than "thirty days
 * earlier" — that is the kind of off-by-one that is invisible until a report double-counts the
 * 1st. A range the reader picked steps by its own length, which is pure arithmetic and needs
 * nobody's opinion.
 *
 * <p>Both arrows are disabled while a fetch is in flight. The anchors come from the report on
 * screen, and during a load that is still the previous one — so a second tap would re-send the
 * anchor already being fetched and be silently dropped. Better to look unavailable for the moment
 * it actually is than to ignore a press.
 */
export default function ReportPeriodNav({ window, onChange, report, busy }) {
  const T = useT();
  const reduce = useReducedMotion();
  const [menuAt, setMenuAt] = useState(null);
  const [picking, setPicking] = useState(false);

  const custom = isCustom(window);
  // A custom range is its own dates; a named period is whatever window the server resolved.
  const label = formatReportWindow(custom
    ? { period: null, from: window.from, to: window.to }
    : report);

  const canBack = canStep(window, report, -1) && !busy;
  const canForward = canStep(window, report, 1) && !busy;
  const step = (direction) => onChange(steppedWindow(window, report, direction));

  const stepSx = (enabled) => ({
    color: enabled ? T.textPrimary : T.textFaint,
    bgcolor: T.glass,
    border: `1px solid ${T.border}`,
    borderRadius: 2,
    width: 34,
    height: 34,
    flexShrink: 0,
    '&:hover': { bgcolor: T.glassHover },
    '&.Mui-disabled': { color: T.textFaint, opacity: 0.4 },
  });

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <IconButton
          onClick={() => step(-1)}
          disabled={!canBack}
          aria-label="Previous period"
          sx={stepSx(canBack)}
        >
          <ChevronLeftRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>

        {/* The label IS the control. A separate dropdown beside it would be a second thing
            saying the same word, and the label is already the biggest target in the row. */}
        <Box
          component={motion.button}
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={(e) => setMenuAt(e.currentTarget)}
          aria-label="Change the period"
          sx={{
            flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 0.5,
            px: 1.5, height: 34, borderRadius: 2, cursor: 'pointer',
            fontFamily: 'inherit', bgcolor: T.glass, border: `1px solid ${T.border}`,
            transition: 'background-color .18s ease',
            '&:hover': { bgcolor: T.glassHover },
            '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
          }}
        >
          {/* Keyed on the window so the label cross-fades as you step, which makes the direction
              of travel obvious without moving the buttons under the thumb. */}
          <AnimatePresence mode="wait" initial={false}>
            <Typography
              key={label}
              component={motion.div}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              noWrap
              sx={{ fontSize: 14.5, fontWeight: 800, color: T.textPrimary, letterSpacing: -0.2 }}
            >
              {label}
            </Typography>
          </AnimatePresence>
          <ExpandMoreRoundedIcon sx={{ fontSize: 17, color: T.textMuted, flexShrink: 0 }} />
        </Box>

        <IconButton
          onClick={() => step(1)}
          disabled={!canForward}
          aria-label="Next period"
          sx={stepSx(canForward)}
        >
          <ChevronRightRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      <Menu
        anchorEl={menuAt}
        open={Boolean(menuAt)}
        onClose={() => setMenuAt(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: T.bg, backgroundImage: 'none', borderRadius: 2.5,
              border: `1px solid ${T.glassBorder}`, minWidth: 196, mt: 0.5,
            },
          },
        }}
      >
        {PERIODS.map((option) => {
          const selected = !custom && window.period === option.value;
          return (
            <MenuItem
              key={option.value}
              selected={selected}
              onClick={() => { setMenuAt(null); onChange(periodWindow(option.value)); }}
              sx={{ fontSize: 14, color: T.textPrimary, '&.Mui-selected': { bgcolor: T.tealBg } }}
            >
              <ListItemIcon sx={{ minWidth: 30 }}>
                {selected && <CheckRoundedIcon sx={{ fontSize: 17, color: T.teal }} />}
              </ListItemIcon>
              {option.label}
            </MenuItem>
          );
        })}

        <MenuItem
          selected={custom}
          onClick={() => { setMenuAt(null); setPicking(true); }}
          sx={{
            fontSize: 14, color: T.textPrimary, borderTop: `1px solid ${T.border}`, mt: 0.5,
            '&.Mui-selected': { bgcolor: T.tealBg },
          }}
        >
          <ListItemIcon sx={{ minWidth: 30 }}>
            <DateRangeRoundedIcon sx={{ fontSize: 17, color: custom ? T.teal : T.textMuted }} />
          </ListItemIcon>
          {custom ? 'Change the range…' : 'Custom range…'}
        </MenuItem>
      </Menu>

      <CustomRangeDialog
        open={picking}
        from={window.from}
        to={window.to}
        onClose={() => setPicking(false)}
        onApply={(from, to) => { setPicking(false); onChange(customWindow(from, to)); }}
      />
    </>
  );
}
