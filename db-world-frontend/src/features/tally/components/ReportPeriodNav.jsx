import { Box, IconButton, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useT } from '@shared/theme';
import { formatReportWindow } from '../utils/tallyFormat';

const PERIODS = [
  { value: 'WEEK', label: 'Week' },
  { value: 'MONTH', label: 'Month' },
  { value: 'YEAR', label: 'Year' },
];

/**
 * Picks the size of the window, and steps it backwards and forwards.
 *
 * Stepping sends the server's own {@code previousAnchor} / {@code nextAnchor} straight back
 * rather than doing the date arithmetic here. That keeps one definition of "last month" in the
 * system: the client stepping back a calendar month on its own is how you end up with a 31st
 * that skips February, and with two implementations that disagree only in the corner cases.
 *
 * <p>Forward is disabled when the server sends no next anchor, which is its way of saying the
 * following period has not started. A button that is always available and always lands on an
 * empty chart reads as a broken screen rather than as the end of the data.
 *
 * <p>Both steps are disabled while a fetch is in flight. The anchors come from the report on
 * screen, and during a load that is still the previous one — so a second tap would re-send the
 * anchor already being fetched and be silently dropped. Better to look unavailable for the
 * moment it actually is than to ignore a press.
 */
export default function ReportPeriodNav({ period, onPeriodChange, report, onStep, busy }) {
  const T = useT();
  const reduce = useReducedMotion();

  const window = formatReportWindow(report);
  const canGoBack = Boolean(report?.previousAnchor) && !busy;
  const canGoForward = Boolean(report?.nextAnchor) && !busy;

  const stepSx = (enabled) => ({
    color: enabled ? T.textPrimary : T.textFaint,
    bgcolor: T.glass,
    border: `1px solid ${T.border}`,
    borderRadius: 2,
    width: 34,
    height: 34,
    '&:hover': { bgcolor: T.glassHover },
    '&.Mui-disabled': { color: T.textFaint, opacity: 0.4 },
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2.5 }}>
      <ToggleButtonGroup
        size="small"
        exclusive
        fullWidth
        value={period}
        onChange={(_, value) => value && onPeriodChange(value)}
        sx={{
          maxWidth: 280,
          '& .MuiToggleButton-root': {
            py: 0.6, fontSize: 13, fontWeight: 700, textTransform: 'none',
            color: T.textMuted, borderColor: T.border,
          },
          '& .Mui-selected': { color: `${T.teal} !important`, bgcolor: `${T.tealBg} !important` },
        }}
      >
        {PERIODS.map((p) => (
          <ToggleButton key={p.value} value={p.value}>{p.label}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton
          onClick={() => onStep(report?.previousAnchor)}
          disabled={!canGoBack}
          aria-label="Previous period"
          sx={stepSx(canGoBack)}
        >
          <ChevronLeftRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>

        {/* Keyed on the window so the label cross-fades as you step, which makes the direction
            of travel obvious without moving the buttons under the thumb. */}
        <Box sx={{ flex: 1, minWidth: 0, textAlign: 'center', overflow: 'hidden' }}>
          <AnimatePresence mode="wait" initial={false}>
            <Typography
              key={window}
              component={motion.div}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              noWrap
              sx={{ fontSize: 15, fontWeight: 800, color: T.textPrimary, letterSpacing: -0.2 }}
            >
              {window}
            </Typography>
          </AnimatePresence>
        </Box>

        <IconButton
          onClick={() => onStep(report?.nextAnchor)}
          disabled={!canGoForward}
          aria-label="Next period"
          sx={stepSx(canGoForward)}
        >
          <ChevronRightRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>
    </Box>
  );
}
