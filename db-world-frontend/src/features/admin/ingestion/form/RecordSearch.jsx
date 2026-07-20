import React, { useState, useCallback } from 'react';
import {
  Autocomplete,
  TextField,
  Chip,
  CircularProgress,
  Avatar,
  Box,
  Typography
} from '@mui/material';
import { notify } from '@shared/notify';
import { searchRecords } from '../services/ingestionApi';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w92';

export default function RecordSearch({ value, onChange, error, helperText }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const timerRef = React.useRef(null);

  const fetchOptions = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setOptions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await searchRecords(q);
      setOptions(res.data ?? []);
    } catch {
      notify.warning('Record search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = useCallback((_, newInput) => {
    setInputValue(newInput);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchOptions(newInput), 300);
  }, [fetchOptions]);

  const getPoster = (path) =>
    path ? `${TMDB_IMG}${path}` : '/fallback-poster.png';

  return (
    <Autocomplete
      value={value}
      onChange={(_, val) => onChange(val)}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      options={options}
      loading={loading}
      getOptionLabel={(o) => (o ? `${o.id} – ${o.name}` : '')}
      isOptionEqualToValue={(a, b) => a?.id === b?.id}
      filterOptions={(x) => x}

      // ✅ Dropdown option with poster
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <Box display="flex" alignItems="center" width="100%" gap={1}>
            <Avatar
              variant="rounded"
              src={getPoster(option.posterPath)}
              sx={{ width: 40, height: 60 }}
            />
            <Box flex={1} overflow="hidden">
              <Typography variant="body2" noWrap>
                {option.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ID: {option.id}
              </Typography>
            </Box>
            <Chip
              label={option.type}
              size="small"
              sx={{ fontSize: '0.65rem' }}
            />
          </Box>
        </li>
      )}
      renderTags={(value, getTagProps) =>
        value
          ? [
              <Chip
                {...getTagProps({ index: 0 })}
                key={value.id}
                avatar={
                  <Avatar
                    src={getPoster(value.posterPath)}
                    variant="rounded"
                  />
                }
                label={value.name}
              />,
            ]
          : []
      }

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