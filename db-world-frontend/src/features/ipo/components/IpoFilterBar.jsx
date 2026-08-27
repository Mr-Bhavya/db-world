import { Box, Typography, ToggleButtonGroup, ToggleButton, Select, MenuItem } from '@mui/material';
import SwapVertRoundedIcon from '@mui/icons-material/SwapVertRounded';
import { useT, getSelectMenuProps } from '@shared/theme';

const TYPE_OPTIONS = [
  { value: 'mainboard', label: 'Mainboard' },
  { value: 'sme', label: 'SME' },
  { value: 'all', label: 'All' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'listed', label: 'Listed' },
];

const SORT_OPTIONS = [
  { value: 'date', label: 'Date' },
  { value: 'gmp', label: 'GMP' },
  { value: 'subscription', label: 'Subscription' },
];

/**
 * Filter/sort toolbar for the IPO list.
 *
 * Everything sits on ONE flex row that wraps, rather than the previous fixed two-row block: three
 * small controls stacked into two rows plus panel padding took a surprising amount of vertical space
 * above the fold, and the segmented groups are narrow enough to share a line on anything wider than
 * a phone. On a phone they wrap naturally and the status group stays horizontally scrollable, so
 * nothing is ever cut off at 360px.
 *
 * The result count is here rather than in the hero because it describes THIS list — the hero's quick
 * stats deliberately summarise every IPO regardless of filters, so putting a filtered count up there
 * would read as a contradiction.
 *
 * Controlled: receives the current `{ type, status, sort }` and calls `onChange` with the next full
 * triple whenever any control changes.
 */
export default function IpoFilterBar({ type, status, sort, onChange, count }) {
  const T = useT();

  const segmentedSx = {
    // 30px tall targets are below the 44px touch guideline, but these are dense secondary filters in
    // a scrollable row — the generous card targets below are the primary interaction. Bumped to 32px
    // minimum with wider padding so they're comfortable without dominating the page.
    '& .MuiToggleButton-root': {
      fontSize: { xs: 11.5, sm: 12 },
      fontWeight: 700,
      color: T.textMuted,
      border: `1px solid ${T.border}`,
      minHeight: 32,
      px: { xs: 1, sm: 1.35 },
      py: { xs: 0.45, sm: 0.5 },
      textTransform: 'none',
      whiteSpace: 'nowrap',
      lineHeight: 1,
      transition: 'color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease',
      '&.Mui-selected': { color: T.teal, bgcolor: T.tealBg, borderColor: T.teal },
      '&.Mui-selected:hover': { bgcolor: T.tealBgHover },
      '&:hover': { bgcolor: T.hoverBg },
    },
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: { xs: 0.75, sm: 1.25 },
        mb: { xs: 2, sm: 2.5 },
        p: { xs: 1, sm: 1.25 },
        borderRadius: 3,
        bgcolor: T.glass,
        border: `1px solid ${T.border}`,
      }}
    >
      <ToggleButtonGroup
        value={type}
        exclusive
        size="small"
        onChange={(_e, v) => v != null && onChange({ status, type: v, sort })}
        sx={segmentedSx}
        aria-label="IPO type filter"
      >
        {TYPE_OPTIONS.map((opt) => (
          <ToggleButton key={opt.value} value={opt.value}>{opt.label}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* Hairline divider, desktop only — on a wrapped mobile layout it would sit orphaned at the
          end of a row rather than between two groups. */}
      <Box sx={{ display: { xs: 'none', md: 'block' }, width: '1px', alignSelf: 'stretch', bgcolor: T.border }} />

      <Box sx={{
        overflowX: 'auto', flexShrink: 1, minWidth: 0,
        '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none',
      }}>
        <ToggleButtonGroup
          value={status}
          exclusive
          size="small"
          onChange={(_e, v) => v != null && onChange({ status: v, type, sort })}
          sx={{ ...segmentedSx, flexWrap: 'nowrap', width: 'max-content' }}
          aria-label="IPO status filter"
        >
          {STATUS_OPTIONS.map((opt) => (
            <ToggleButton key={opt.value || 'all'} value={opt.value}>{opt.label}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Pushes the sort control to the far end on a single row, and collapses harmlessly once the
          toolbar wraps. */}
      <Box sx={{ flex: 1, minWidth: 0, display: { xs: 'none', md: 'block' } }} />

      {count != null && (
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: T.textMuted, whiteSpace: 'nowrap' }}>
          {count} {count === 1 ? 'IPO' : 'IPOs'}
        </Typography>
      )}

      <Select
        value={sort}
        onChange={(e) => onChange({ status, type, sort: e.target.value })}
        size="small"
        startAdornment={<SwapVertRoundedIcon sx={{ fontSize: 16, color: T.textMuted, mr: 0.5 }} />}
        MenuProps={getSelectMenuProps(T)}
        aria-label="Sort IPOs"
        sx={{
          fontSize: 12.5,
          fontWeight: 700,
          color: T.textPrimary,
          minWidth: { xs: 112, sm: 136 },
          bgcolor: T.inputBg,
          borderRadius: 1.5,
          '& .MuiSelect-select': { display: 'flex', alignItems: 'center', py: { xs: 0.5, sm: 0.6 } },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.borderHover },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: T.teal },
          '& .MuiSvgIcon-root': { color: T.textMuted },
        }}
      >
        {SORT_OPTIONS.map((opt) => (
          <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 13 }}>{opt.label}</MenuItem>
        ))}
      </Select>
    </Box>
  );
}
