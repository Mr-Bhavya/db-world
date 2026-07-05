import { TextField, MenuItem } from '@mui/material';
import { Controller } from 'react-hook-form';
import { getSelectMenuProps } from '@shared/theme';
import { getInputSx } from './constants';

// Module-scope field components. Defining these INSIDE a component (as the old
// create modal did) gives them a new identity on every render, so React remounts
// the inputs each keystroke — they lose focus and selects "don't pick". Keeping
// them here makes the form stable.

export function TextInput({ control, errors, T, name, label, type = 'text', ...props }) {
  return (
    <Controller name={name} control={control} render={({ field }) => (
      <TextField
        {...field}
        value={field.value ?? ''}
        label={label}
        type={type}
        size="small"
        fullWidth
        sx={getInputSx(T)}
        error={!!errors[name]}
        helperText={errors[name]?.message}
        {...props}
      />
    )} />
  );
}

export function SelectInput({ control, errors, T, name, label, options = [], children, ...props }) {
  return (
    <Controller name={name} control={control} render={({ field }) => (
      <TextField
        {...field}
        value={field.value ?? ''}
        select
        label={label}
        size="small"
        fullWidth
        sx={getInputSx(T)}
        SelectProps={{ MenuProps: getSelectMenuProps(T) }}
        error={!!errors[name]}
        helperText={errors[name]?.message}
        {...props}
      >
        {children ?? options.map(o => (
          <MenuItem key={o.value ?? o} value={o.value ?? o} sx={{ color: T.textPrimary }}>
            {o.label ?? o}
          </MenuItem>
        ))}
      </TextField>
    )} />
  );
}

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

/** Case-insensitively map any stored gender ("male"/"MALE"/"Male") to a canonical
 *  option so the edit select pre-fills; returns '' when it matches none. */
export function canonicalGender(v) {
  const s = String(v ?? '').trim().toLowerCase();
  return GENDER_OPTIONS.find(g => g.toLowerCase() === s) ?? '';
}
export const ROLE_OPTIONS = [
  { value: 1, label: 'Owner' },
  { value: 2, label: 'Admin' },
  { value: 3, label: 'Viewer' },
];
