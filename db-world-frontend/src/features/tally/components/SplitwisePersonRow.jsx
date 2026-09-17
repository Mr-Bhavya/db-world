import { useEffect, useState } from 'react';
import {
  Autocomplete, Box, CircularProgress, TextField, Typography,
} from '@mui/material';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@shared/theme';
import { searchUsers } from '../api/tallyApi';
import { tallyFieldSx } from './tallyFormUi';

/**
 * One column of the export, and who it is.
 *
 * <p>Free text with account suggestions rather than a plain account picker. Most of the people
 * in an old Splitwise group do not have a db-world login and never will, and forcing an account
 * on each of them would make importing a two-year-old trip impossible. Typing a name and
 * leaving it is the common case; picking an account is the exception that matters, because only
 * then can that person see the group.
 *
 * <p>The name is pre-filled from the file, so a row nobody touches is still a valid answer —
 * but it is not treated as <em>chosen</em> until it is confirmed, because silently accepting the
 * default for a column somebody skipped would put a stranger in a group holding real debts. The
 * dialog will not submit while any row is unconfirmed.
 */
export default function SplitwisePersonRow({ person, value, onChange }) {
  const T = useT();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');

  // Debounced, so typing a name is not one request per keystroke -- same as AddMemberDialog.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 280);
    return () => clearTimeout(id);
  }, [term]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['tally', 'user-search', debounced],
    queryFn: () => searchUsers(debounced),
    enabled: debounced.length >= 2,
  });

  const chosen = Boolean(value);
  const asAccount = chosen && value.userId != null;

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.25, py: 0.75,
    }}>
      <Box sx={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        display: 'grid', placeItems: 'center',
        bgcolor: chosen ? T.tealBg : T.glass,
        border: `1px solid ${chosen ? T.glassBorderHover : T.border}`,
      }}>
        {chosen
          ? <CheckCircleRoundedIcon sx={{ fontSize: 17, color: T.teal }} />
          : <PersonRoundedIcon sx={{ fontSize: 16, color: T.textFaint }} />}
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography noWrap sx={{ fontSize: 12, color: T.textFaint, mb: 0.25 }}>
          {person.name}
        </Typography>

        <Autocomplete
          freeSolo
          size="small"
          options={results}
          filterOptions={(o) => o}
          getOptionLabel={(option) => (typeof option === 'string'
            ? option
            : option.fullName || option.email || '')}
          loading={isFetching}
          // Pre-filled from the file, so the common answer is already typed.
          inputValue={value?.displayName ?? person.name}
          onInputChange={(_, next, reason) => {
            setTerm(next);
            // Typing replaces an account choice with a plain name: the two cannot both be true,
            // and silently keeping a stale userId is how the wrong person ends up in the group.
            if (reason === 'input') {
              onChange({ userId: null, displayName: next });
            }
          }}
          onChange={(_, picked) => {
            if (picked && typeof picked !== 'string') {
              onChange({ userId: picked.userId, displayName: picked.fullName || person.name });
            } else if (typeof picked === 'string') {
              onChange({ userId: null, displayName: picked });
            }
          }}
          onBlur={() => {
            // Confirms the pre-filled name for a row that was only looked at. Blur rather than
            // mount, so "untouched" and "kept as it was" stay distinguishable.
            if (!chosen) onChange({ userId: null, displayName: person.name });
          }}
          renderOption={(props, option) => (
            <Box component="li" {...props} key={option.userId}>
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 13.5, color: T.textPrimary }}>
                  {option.fullName}
                </Typography>
                <Typography noWrap sx={{ fontSize: 11.5, color: T.textMuted }}>
                  {option.email}
                </Typography>
              </Box>
            </Box>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Name, or search for an account"
              sx={tallyFieldSx(T)}
              slotProps={{
                input: {
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {isFetching && <CircularProgress size={14} sx={{ color: T.teal }} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                },
              }}
            />
          )}
        />
      </Box>

      <Typography sx={{
        fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
        color: asAccount ? T.teal : T.textFaint,
      }}>
        {asAccount ? 'account' : 'no account'}
      </Typography>
    </Box>
  );
}
