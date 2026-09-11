import { Box, TextField, MenuItem, InputAdornment, Typography } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SortRoundedIcon from '@mui/icons-material/SortRounded';
import { useT, getSelectMenuProps } from '@shared/theme';
import { DOC_SORTS } from '../utils/walletFormat';

/** A filter chip. Local rather than MUI's `Chip` so its selected state uses the app's own teal
 * tokens instead of the MUI palette's `primary`, which is what made the old chips read as a
 * different design system from everything around them. */
function FilterChip({ label, count, selected, onClick }) {
  const T = useT();
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      sx={{
        flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 0.6,
        px: 1.25, py: 0.6, borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
        border: `1px solid ${selected ? T.teal : T.border}`,
        bgcolor: selected ? T.tealBg : T.glass,
        color: selected ? T.teal : T.textMuted,
        fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
        transition: 'border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease',
        '&:hover': { borderColor: T.teal, color: T.teal },
        '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
      }}
    >
      {label}
      {count != null && (
        <Box component="span" sx={{
          fontSize: 11, fontWeight: 800, px: 0.5, borderRadius: 999,
          bgcolor: selected ? 'transparent' : T.glassHover,
          color: selected ? T.teal : T.textMuted,
        }}>
          {count}
        </Box>
      )}
    </Box>
  );
}

/**
 * Search, sort and the type filter.
 *
 * Two deliberate groups rather than one freely-wrapping row: on a phone, letting search, sort and
 * every type chip wrap independently put four or five rows of controls above the first document.
 * Search and sort lead on their own line, the type strip scrolls horizontally beneath them as one
 * unit, and both sit side by side from `md` up — the same arrangement the IPO list settled on for
 * the same reason.
 *
 * Type counts come from the FULL document set, not the filtered one, so the numbers don't change
 * as you narrow — a chip that says "Passport 2" has to still say 2 once you've clicked it.
 */
export default function WalletToolbar({
  q, onQueryChange, sort, onSortChange, typeId, onTypeChange, types, typeCounts,
  holders, holder, onHolderChange, holderCounts, total, showing,
}) {
  const T = useT();

  const fieldSx = {
    '& .MuiInputBase-input': { color: T.textPrimary, fontSize: 13.5 },
    '& .MuiInputLabel-root': { color: T.textMuted, fontSize: 13 },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.borderHover },
    '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: T.teal },
  };

  // Only offer a type once something is filed under it — an empty chip is a dead end, and the
  // admin-managed type list is longer than most wallets use.
  const usedTypes = types.filter((t) => (typeCounts[t.id] ?? 0) > 0);

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{
        display: 'flex', flexDirection: { xs: 'column', md: 'row' },
        alignItems: { md: 'center' }, gap: 1.25,
      }}>
        <Box sx={{ display: 'flex', gap: 1, minWidth: 0, flexShrink: 0 }}>
          <TextField
            size="small"
            placeholder="Search documents"
            value={q}
            onChange={(e) => onQueryChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ fontSize: 18, color: T.textMuted }} />
                </InputAdornment>
              ),
            }}
            sx={{ ...fieldSx, flex: { xs: 1, md: '0 0 240px' }, minWidth: 0 }}
          />
          <TextField
            select
            size="small"
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
            aria-label="Sort documents"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SortRoundedIcon sx={{ fontSize: 18, color: T.textMuted }} />
                </InputAdornment>
              ),
            }}
            SelectProps={{ MenuProps: getSelectMenuProps(T) }}
            // 152px clipped the longest option to "Recently a..." once the sort icon and the
            // field's own padding were accounted for.
            sx={{ ...fieldSx, flex: { xs: '0 0 168px', md: '0 0 176px' } }}
          >
            {DOC_SORTS.map((s) => (
              <MenuItem key={s.value} value={s.value} sx={{ fontSize: 13 }}>{s.label}</MenuItem>
            ))}
          </TextField>
        </Box>

        {/* Holders come first when there is more than one person in the wallet: filing a family's
            documents is the wallet's main use, and "whose is this" narrows harder than "what is
            this". A single-holder wallet gets no strip at all rather than one chip. */}
        {holders.length > 1 && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0,
            overflowX: 'auto', pb: 0.5, mb: -0.5,
            scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
          }}>
            <Typography sx={{
              flexShrink: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5,
              textTransform: 'uppercase', color: T.textMuted, mr: 0.25,
            }}>
              Whose
            </Typography>
            <FilterChip label="Everyone" count={total} selected={!holder} onClick={() => onHolderChange('')} />
            {holders.map((name) => (
              <FilterChip
                key={name}
                label={name}
                count={holderCounts[name]}
                selected={holder === name}
                onClick={() => onHolderChange(holder === name ? '' : name)}
              />
            ))}
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1.25, mt: holders.length > 1 ? 1.25 : 0 }}>
        {usedTypes.length > 0 && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flex: 1,
            overflowX: 'auto', pb: 0.5, mb: -0.5,
            // The strip scrolls rather than wraps, so the toolbar stays one row tall however many
            // document types a wallet accumulates.
            scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
          }}>
            <FilterChip label="All" count={total} selected={!typeId} onClick={() => onTypeChange('')} />
            {usedTypes.map((t) => (
              <FilterChip
                key={t.id}
                label={t.displayName}
                count={typeCounts[t.id]}
                selected={typeId === t.id}
                onClick={() => onTypeChange(typeId === t.id ? '' : t.id)}
              />
            ))}
          </Box>
        )}
      </Box>

      {showing != null && showing !== total && (
        <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 1.25 }}>
          Showing {showing} of {total}
        </Typography>
      )}
    </Box>
  );
}
