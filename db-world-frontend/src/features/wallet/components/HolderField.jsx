import { Controller } from 'react-hook-form';
import { Autocomplete, TextField } from '@mui/material';
import { useT } from '@shared/theme';
import { useDocuments } from '../hooks/useWallet';
import { holderSuggestions } from '../utils/walletTypes';

/**
 * "Belongs to" — a free-text field that offers back the holders already used in this wallet.
 *
 * `freeSolo` on purpose: a new person must be typeable without ceremony, so this suggests rather
 * than constrains. That suggestion is the whole point. Filing a family's documents is the wallet's
 * main use, and with a plain text box "Dad", "Father" and "father" quietly become three different
 * people — which then fragments the holder filter and the label defaults built on top of it. No new
 * table is involved: the options are the distinct values already sitting in the user's own rows.
 */
export default function HolderField({ control, name = 'holderName', sx }) {
  const T = useT();
  // The unfiltered list — the same query the page already holds, so this costs no extra request.
  const { data: docs = [] } = useDocuments({});
  const options = holderSuggestions(docs);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Autocomplete
          freeSolo
          options={options}
          value={field.value ?? ''}
          onChange={(_e, v) => field.onChange(v ?? '')}
          onInputChange={(_e, v) => field.onChange(v ?? '')}
          slotProps={{ paper: { sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}` } } }}
          renderInput={(params) => (
            <TextField
              {...params}
              fullWidth
              size="small"
              label="Belongs to"
              placeholder="Self, Spouse, Father…"
              helperText="Reuse a name so this person&rsquo;s documents group together."
              sx={{
                ...sx,
                '& .MuiFormHelperText-root': { fontSize: 10.5, mx: 0, color: T.textMuted },
              }}
            />
          )}
        />
      )}
    />
  );
}
