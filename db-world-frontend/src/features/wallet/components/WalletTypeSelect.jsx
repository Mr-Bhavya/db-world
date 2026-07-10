import { Controller } from 'react-hook-form';
import { TextField, MenuItem } from '@mui/material';
import { getSelectMenuProps } from '@shared/theme';
import { useDocumentTypes } from '../hooks/useWallet';

export default function WalletTypeSelect({ control, errors, T, name = 'typeId', onTypeChange }) {
  const { data: types = [] } = useDocumentTypes();
  return (
    <Controller name={name} control={control} render={({ field }) => (
      <TextField
        {...field}
        select fullWidth size="small" label="Document type"
        value={field.value ?? ''}
        onChange={(e) => { field.onChange(e); onTypeChange?.(types.find(t => t.id === e.target.value)); }}
        error={!!errors[name]} helperText={errors[name]?.message}
        SelectProps={{ MenuProps: getSelectMenuProps(T) }}
      >
        {types.map((t) => (
          <MenuItem key={t.id} value={t.id} sx={{ color: T.textPrimary }}>{t.displayName}</MenuItem>
        ))}
      </TextField>
    )} />
  );
}
