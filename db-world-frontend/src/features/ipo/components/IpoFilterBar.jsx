import { Box, Typography, ToggleButtonGroup, ToggleButton, Select, MenuItem, InputBase, IconButton } from '@mui/material';
import SwapVertRoundedIcon from '@mui/icons-material/SwapVertRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
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
  // The only actionable sort: the other three describe an IPO, this one answers "what do I have to
  // decide about next". Server-side, like the rest (see IpoQueryService.SORT_CLOSING_ASC).
  { value: 'closing', label: 'Closing soon' },
  { value: 'gmp', label: 'GMP' },
  { value: 'subscription', label: 'Subscription' },
];

/**
 * Filter/sort toolbar for the IPO list — TWO explicit groups, not five controls left to wrap.
 *
 * Letting a single flex row wrap freely was worse on a phone than the two-row block it replaced:
 * five items each found their own line, so the toolbar ate four rows before a single card. It's now
 * two deliberate groups that stack on mobile and sit side by side from `md` up:
 *
 *   mobile   [ search .................... sort ]
 *            [ type | status ......(scrolls)→   ]
 *   desktop  [ type | status ] [ search  n  sort ]
 *
 * Search leads on mobile because finding one company by name is the common phone gesture, while the
 * filter strip below it scrolls horizontally as one unit so neither group is ever clipped at 360px.
 *
 * The result count sits here rather than in the hero because it describes THIS list — the hero's
 * quick stats deliberately summarise every IPO regardless of filters, so a filtered count up there
 * would read as a contradiction.
 *
 * Controlled: receives the current `{ type, status, sort }` and calls `onChange` with the next full
 * triple whenever any control changes.
 */
export default function IpoFilterBar({ type, status, sort, onChange, count, query, onQueryChange }) {
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

  const searchField = (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0,
      px: 1, py: 0.25, borderRadius: 1.5, bgcolor: T.inputBg,
      border: `1px solid ${T.border}`,
      transition: 'border-color 0.2s ease',
      '&:focus-within': { borderColor: T.teal },
    }}>
      <SearchRoundedIcon sx={{ fontSize: 17, color: T.textMuted, flexShrink: 0 }} />
      <InputBase
        value={query ?? ''}
        onChange={(e) => onQueryChange?.(e.target.value)}
        placeholder="Search company"
        inputProps={{ 'aria-label': 'Search IPOs by company name' }}
        sx={{
          flex: 1, minWidth: 0, fontSize: 12.5, color: T.textPrimary,
          '& input': { py: 0.45 },
          '& input::placeholder': { color: T.textFaint, opacity: 1 },
        }}
      />
      {!!query && (
        <IconButton
          size="small"
          onClick={() => onQueryChange?.('')}
          aria-label="Clear search"
          sx={{ p: 0.25, color: T.textMuted, '&:hover': { color: T.textPrimary } }}
        >
          <CloseRoundedIcon sx={{ fontSize: 15 }} />
        </IconButton>
      )}
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'stretch', md: 'center' },
        gap: { xs: 1, md: 1.25 },
        mb: { xs: 2, sm: 2.5 },
        p: { xs: 1, sm: 1.25 },
        borderRadius: 3,
        bgcolor: T.glass,
        border: `1px solid ${T.border}`,
      }}
    >
      {/* Group 1 — the filter strip. One horizontally scrollable unit, so the type and status groups
          can never be split across lines or clipped, however narrow the viewport. */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: { xs: 0.75, md: 1.25 },
        order: { xs: 2, md: 1 },
        overflowX: 'auto', minWidth: 0,
        '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none',
      }}>
        <ToggleButtonGroup
          value={type}
          exclusive
          size="small"
          onChange={(_e, v) => v != null && onChange({ status, type: v, sort })}
          sx={{ ...segmentedSx, flexWrap: 'nowrap' }}
          aria-label="IPO type filter"
        >
          {TYPE_OPTIONS.map((opt) => (
            <ToggleButton key={opt.value} value={opt.value}>{opt.label}</ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Box sx={{ width: '1px', alignSelf: 'stretch', bgcolor: T.border, flexShrink: 0 }} />

        <ToggleButtonGroup
          value={status}
          exclusive
          size="small"
          onChange={(_e, v) => v != null && onChange({ status: v, type, sort })}
          sx={{ ...segmentedSx, flexWrap: 'nowrap' }}
          aria-label="IPO status filter"
        >
          {STATUS_OPTIONS.map((opt) => (
            <ToggleButton key={opt.value || 'all'} value={opt.value}>{opt.label}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Group 2 — search, count and sort. Leads on mobile, trails on desktop. */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, minWidth: 0,
        order: { xs: 1, md: 2 },
        flex: { md: 1 }, justifyContent: { md: 'flex-end' },
      }}>
        <Box sx={{ display: 'flex', flex: 1, minWidth: 0, maxWidth: { md: 260 } }}>{searchField}</Box>

        {count != null && (
          <Typography sx={{
            fontSize: 12, fontWeight: 700, color: T.textMuted, whiteSpace: 'nowrap',
            display: { xs: 'none', sm: 'block' },
          }}>
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
            flexShrink: 0,
            minWidth: { xs: 118, sm: 140 },
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
    </Box>
  );
}
