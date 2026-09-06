import { Controller } from 'react-hook-form';
import { TextField, MenuItem, ListSubheader, Box, Typography } from '@mui/material';
import { getSelectMenuProps, useT } from '@shared/theme';
import { useDocumentTypes } from '../hooks/useWallet';
import { typeIcon, groupTypesByCategory } from '../utils/walletTypes';

/**
 * Document-type picker, grouped by category with an icon per type.
 *
 * The grouping is not decoration. The seeded set went from six types to thirty-five so the wallet
 * covers what people in India actually file, and as one flat dropdown that would have been
 * materially worse to use than the six it replaced. `ListSubheader` renders each category as a
 * non-selectable heading, which is what keeps a long list scannable.
 *
 * `renderValue` is supplied because a `Select` shows its raw children by default — without it, the
 * closed field would render the chosen item's whole icon-and-label row rather than just its name.
 */
export default function WalletTypeSelect({ control, errors, T, name = 'typeId', onTypeChange }) {
  const theme = useT();
  const tokens = T ?? theme;
  const { data: types = [] } = useDocumentTypes();
  const groups = groupTypesByCategory(types);
  const byId = new Map(types.map((t) => [t.id, t]));

  return (
    <Controller name={name} control={control} render={({ field }) => (
      <TextField
        {...field}
        select fullWidth size="small" label="Document type"
        value={field.value ?? ''}
        onChange={(e) => { field.onChange(e); onTypeChange?.(byId.get(e.target.value)); }}
        error={!!errors[name]} helperText={errors[name]?.message}
        SelectProps={{
          MenuProps: getSelectMenuProps(tokens),
          renderValue: (id) => byId.get(id)?.displayName ?? '',
        }}
      >
        {/* Flattened on purpose: MUI's Select reads its children directly, so a nested
            fragment-per-group would break both keyboard navigation and `renderValue`. */}
        {groups.flatMap((group) => [
          <ListSubheader
            key={`h-${group.key}`}
            sx={{
              bgcolor: 'transparent', lineHeight: 2.2, fontSize: 10.5, fontWeight: 800,
              letterSpacing: 0.6, textTransform: 'uppercase', color: tokens.textMuted,
            }}
          >
            {group.label}
          </ListSubheader>,
          ...group.types.map((t) => {
            const Icon = typeIcon(t.iconKey);
            return (
              <MenuItem key={t.id} value={t.id} sx={{ color: tokens.textPrimary, fontSize: 13.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                  <Icon sx={{ fontSize: 18, color: tokens.teal, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 13.5, color: tokens.textPrimary }} noWrap>
                    {t.displayName}
                  </Typography>
                </Box>
              </MenuItem>
            );
          }),
        ])}
      </TextField>
    )} />
  );
}
