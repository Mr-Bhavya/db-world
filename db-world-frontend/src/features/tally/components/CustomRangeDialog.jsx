import { useEffect, useState } from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useT } from '@shared/theme';
import { spanDays } from '../utils/reportWindow';
import {
  TallyFormDialog, TallySubmitButton, TallyCancelButton, tallyCalendarSx, tallyPickerSx,
} from './tallyFormUi';

/** Local calendar date, not UTC — see ExpenseDateField for the off-by-one this avoids. */
const iso = (date) => {
  if (!date || Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const parse = (value) => {
  if (!value) return null;
  const [y, m, d] = String(value).split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Two dates, for a report over any stretch of time.
 *
 * <p>Two single pickers rather than one range widget, because MUI X's range picker is a paid
 * component and this app is on the free package — hand-rolling a two-calendar range that gets
 * keyboard navigation and locale right would cost far more than it returns for a control
 * somebody opens a few times a year.
 *
 * <p>It validates before it submits, rather than letting the server refuse. The two refusals the
 * server has — an end before its start, and a span past ten years — are both things the reader
 * can see they have done, and a form that says so while they are still in it beats a toast after
 * a round trip.
 */
export default function CustomRangeDialog({ open, from, to, onClose, onApply }) {
  const T = useT();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);

  // Seeded each time it opens, so reopening after a cancel shows the range actually on screen
  // rather than whatever was half-typed last time.
  useEffect(() => {
    if (!open) return;
    setStart(parse(from));
    setEnd(parse(to));
  }, [open, from, to]);

  const startIso = iso(start);
  const endIso = iso(end);
  const span = startIso && endIso ? spanDays(startIso, endIso) : 0;

  const problem = (() => {
    if (!startIso || !endIso) return 'Pick both a start and an end';
    if (span <= 0) return 'The end is before the start';
    if (span > 3653) return 'That is more than ten years — pick a shorter range';
    return null;
  })();

  const pickerSx = { ...tallyPickerSx(T), width: '100%' };
  const slots = {
    textField: { size: 'small', fullWidth: true, sx: pickerSx },
    popper: { sx: tallyCalendarSx(T) },
    desktopPaper: { sx: tallyCalendarSx(T) },
    mobilePaper: { sx: tallyCalendarSx(T) },
    dialog: { sx: tallyCalendarSx(T) },
  };

  return (
    <TallyFormDialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      title="Pick a range"
      subtitle="Any two dates — a fortnight, a quarter, a whole trip"
      actions={(
        <>
          <TallyCancelButton onClick={onClose} />
          <TallySubmitButton
            disabled={Boolean(problem)}
            onClick={() => onApply(startIso, endIso)}
          >
            Show it
          </TallySubmitButton>
        </>
      )}
    >
      <Box sx={{
        display: 'grid', gap: 2,
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
      }}>
        <Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: T.textMuted, mb: 1 }}>
            From
          </Typography>
          <DatePicker
            value={start}
            onChange={setStart}
            maxDate={end ?? undefined}
            format="dd MMM yyyy"
            slotProps={slots}
          />
        </Box>

        <Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: T.textMuted, mb: 1 }}>
            To
          </Typography>
          <DatePicker
            value={end}
            onChange={setEnd}
            minDate={start ?? undefined}
            format="dd MMM yyyy"
            slotProps={slots}
          />
        </Box>
      </Box>

      <Typography sx={{
        fontSize: 12.5, mt: 2,
        color: problem ? T.error : T.textMuted,
      }}>
        {problem ?? `${span} ${span === 1 ? 'day' : 'days'}, and the ${span} before it to compare against`}
      </Typography>
    </TallyFormDialog>
  );
}
