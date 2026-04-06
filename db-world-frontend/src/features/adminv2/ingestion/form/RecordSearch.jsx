import React, { useState, useCallback } from 'react';
import { Autocomplete, TextField, Chip, CircularProgress } from '@mui/material';
import { useSnackbar } from 'notistack';
import { searchRecords } from '../services/ingestionApi';

/**
 * Async record search autocomplete.
 * value: { id, name, type, tmdbId, posterPath } | null  (matches RecordAutocompleteDto)
 * onChange(record | null)
 */
export default function RecordSearch({ value, onChange, error, helperText }) {
  const [options, setOptions]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [inputValue, setInputValue] = useState('');
  const { enqueueSnackbar }       = useSnackbar();
  const timerRef                  = React.useRef(null);

  const fetchOptions = useCallback(async (q) => {
    if (!q || q.length < 2) { setOptions([]); return; }
    setLoading(true);
    try {
      const res = await searchRecords(q);
      setOptions(res.data ?? []);
    } catch {
      enqueueSnackbar('Record search failed', { variant: 'warning' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  const handleInputChange = useCallback((_, newInput) => {
    setInputValue(newInput);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchOptions(newInput), 300);
  }, [fetchOptions]);

  return (
    <Autocomplete
      value={value}
      onChange={(_, val) => onChange(val)}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      options={options}
      loading={loading}
      getOptionLabel={(o) => o ? `${o.id} – ${o.name}` : ''}
      isOptionEqualToValue={(a, b) => a?.id === b?.id}
      filterOptions={(x) => x}  // server-side filtering
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <span style={{ flex: 1 }}>{option.id} – {option.name}</span>
          <Chip label={option.type} size="small" sx={{ ml: 1, fontSize: '0.65rem' }} />
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Link to Record (optional)"
          placeholder="Search by name or ID…"
          error={error}
          helperText={helperText}
          size="small"
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading && <CircularProgress size={16} />}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
