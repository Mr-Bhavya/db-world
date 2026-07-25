import { Box, ToggleButtonGroup, ToggleButton, Select, MenuItem } from '@mui/material';
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
 * Compact filter/sort toolbar for the IPO list — replaces the old many-chip filter row.
 * Controlled: receives the current `{ type, status, sort }` and calls `onChange` with the
 * next full triple whenever any control changes. Two rows so it stays usable down to 360px:
 * type + sort share the top row (wraps if tight), status is a horizontally-scrollable
 * segmented control on its own row.
 */
export default function IpoFilterBar({ type, status, sort, onChange }) {
  const T = useT();

  const segmentedSx = {
    '& .MuiToggleButton-root': {
      fontSize: 11.5,
      fontWeight: 700,
      color: T.textMuted,
      border: `1px solid ${T.border}`,
      px: 1.1,
      py: 0.45,
      textTransform: 'none',
      whiteSpace: 'nowrap',
      lineHeight: 1,
      '&.Mui-selected': { color: T.teal, bgcolor: T.tealBg, borderColor: T.teal },
      '&.Mui-selected:hover': { bgcolor: T.tealBgHover },
      '&:hover': { bgcolor: T.hoverBg },
    },
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        mb: 2.5,
        p: 1.25,
        borderRadius: 3,
        bgcolor: T.glass,
        border: `1px solid ${T.border}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
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

        <Select
          value={sort}
          onChange={(e) => onChange({ status, type, sort: e.target.value })}
          size="small"
          startAdornment={<SwapVertRoundedIcon sx={{ fontSize: 16, color: T.textFaint, mr: 0.5 }} />}
          MenuProps={getSelectMenuProps(T)}
          aria-label="Sort IPOs"
          sx={{
            fontSize: 12.5,
            fontWeight: 700,
            color: T.textPrimary,
            minWidth: 132,
            bgcolor: T.inputBg,
            borderRadius: 1.5,
            '& .MuiSelect-select': { display: 'flex', alignItems: 'center', py: 0.55 },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.borderHover },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: T.teal },
            '& .MuiSvgIcon-root': { color: T.textFaint },
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 13 }}>{opt.label}</MenuItem>
          ))}
        </Select>
      </Box>

      <Box sx={{ overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}>
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
    </Box>
  );
}
