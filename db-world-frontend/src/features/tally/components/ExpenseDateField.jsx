import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';

const iso = (date) => {
  // Local calendar date, not UTC. toISOString() would shift an evening expense in IST back to
  // the previous day, which is exactly the kind of off-by-one nobody notices until the totals
  // for a month are wrong.
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const shift = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return iso(d);
};

/**
 * When the money was spent.
 *
 * Two chips and a calendar, in that order of prominence, because almost every expense is
 * entered the same day or the morning after — and the native date input made that common case
 * a three-tap operation through a control that looked nothing like the rest of the app.
 *
 * The calendar is MUI X's, restyled. `LocalizationProvider` is already mounted app-wide in
 * main.jsx, so this costs no new dependency and no setup; hand-rolling one would mean
 * re-implementing keyboard navigation and locale handling that this already gets right.
 */
export default function ExpenseDateField({ value, onChange }) {
  const T = useT();
  const [open, setOpen] = useState(false);

  const today = shift(0);
  const yesterday = shift(-1);
  const isCustom = value !== today && value !== yesterday;

  const chip = (label, selected, onClick, icon) => (
    <Box
      component={motion.button}
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.5,
        px: 1.4, py: 0.7, borderRadius: 999, cursor: 'pointer',
        fontSize: 13, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap',
        bgcolor: selected ? T.tealBg : T.glass,
        color: selected ? T.teal : T.textMuted,
        border: `1px solid ${selected ? T.glassBorderHover : T.border}`,
        transition: 'all .15s ease',
      }}
    >
      {icon}
      {label}
    </Box>
  );

  const prettyCustom = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
    : 'Pick a date';

  return (
    <Box>
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: T.textMuted, mb: 1 }}>
        When
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {chip('Today', value === today, () => onChange(today))}
        {chip('Yesterday', value === yesterday, () => onChange(yesterday))}
        {chip(
          isCustom ? prettyCustom : 'Pick a date',
          isCustom,
          () => setOpen(true),
          <CalendarMonthRoundedIcon sx={{ fontSize: 15 }} />,
        )}
      </Box>

      <DatePicker
        open={open}
        onClose={() => setOpen(false)}
        value={value ? new Date(`${value}T00:00:00`) : null}
        onChange={(date) => { if (date && !Number.isNaN(date.getTime())) onChange(iso(date)); }}
        // Nobody splits a bill that has not happened yet, and a stray future date silently
        // parks the expense at the top of the feed forever.
        disableFuture
        slotProps={{
          // The field is only ever opened by the chip above; rendering it would put a second,
          // unstyled date control on screen saying the same thing.
          textField: { sx: { display: 'none' } },
          popper: {
            sx: {
              '& .MuiPaper-root': {
                bgcolor: T.bg,
                backgroundImage: 'none',
                border: `1px solid ${T.glassBorder}`,
                borderRadius: 3,
              },
              '& .MuiPickersCalendarHeader-label, & .MuiDayCalendar-weekDayLabel': {
                color: T.textMuted,
              },
              '& .MuiPickersDay-root': { color: T.textPrimary, fontWeight: 600 },
              '& .MuiPickersDay-root:hover': { bgcolor: T.glassHover },
              '& .MuiPickersDay-root.Mui-selected': {
                bgcolor: T.teal, color: '#fff',
                '&:hover': { bgcolor: T.tealHover },
              },
              '& .MuiPickersDay-today': { borderColor: T.teal },
              '& .MuiPickersArrowSwitcher-button, & .MuiPickersCalendarHeader-switchViewButton': {
                color: T.textMuted,
              },
              '& .MuiPickersYear-yearButton.Mui-selected': { bgcolor: T.teal, color: '#fff' },
            },
          },
        }}
      />
    </Box>
  );
}
