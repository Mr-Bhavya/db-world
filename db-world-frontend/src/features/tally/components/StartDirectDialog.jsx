import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, TextField, CircularProgress, useMediaQuery, useTheme,
} from '@mui/material';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import { searchUsers } from '../api/tallyApi';
import { initialsOf, avatarColor } from '../utils/tallyFormat';
import { TallyFormDialog, TallySubmitButton, TallyCancelButton, tallyFieldSx } from './tallyFormUi';

/**
 * Start splitting with one person, without inventing a group for it.
 *
 * Roommates, a sibling, the colleague you keep buying lunch for — each is a running total with
 * one other human, and making somebody name a "group" of two before they can record a shared
 * taxi is the friction that stops the app being used for exactly the case it is best at.
 *
 * There is no name field and no category, because there is nothing to name: the ledger is you
 * and them.
 */
export default function StartDirectDialog({ open, onClose, onStart, busy }) {
  const T = useT();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    if (!open) return;
    setTerm(''); setDebounced(''); setPicked(null);
  }, [open]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 280);
    return () => clearTimeout(id);
  }, [term]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['tally', 'user-search', debounced],
    queryFn: () => searchUsers(debounced),
    enabled: open && debounced.length >= 2,
  });

  const typedName = term.trim();
  const noMatches = debounced.length >= 2 && !isFetching && results.length === 0;

  // Whatever was typed doubles as a name for somebody with no account, so a search that finds
  // nobody is not a dead end -- it is the other way of doing the same thing.
  const canStart = Boolean(picked) || typedName.length >= 2;

  const submit = () => {
    if (picked) onStart({ userId: picked.userId, displayName: null });
    else if (typedName.length >= 2) onStart({ userId: null, displayName: typedName });
  };

  const subtitle = useMemo(
    () => 'Expenses just between the two of you, kept separate from any group',
    [],
  );

  return (
    <TallyFormDialog
      open={open}
      onClose={onClose}
      busy={busy}
      fullScreen={fullScreen}
      maxWidth="xs"
      title="Split with one person"
      subtitle={subtitle}
      actions={(
        <>
          <TallyCancelButton onClick={onClose} disabled={busy} />
          <TallySubmitButton busy={busy} disabled={!canStart} onClick={submit}>
            {picked ? `Start with ${picked.fullName.split(' ')[0]}` : 'Start'}
          </TallySubmitButton>
        </>
      )}
    >
      <TextField
        autoFocus
        fullWidth
        value={term}
        onChange={(e) => { setTerm(e.target.value); setPicked(null); }}
        label="Who?"
        placeholder="Name or email"
        sx={tallyFieldSx(T)}
        slotProps={{
          input: {
            endAdornment: isFetching ? <CircularProgress size={16} sx={{ color: T.textMuted }} /> : null,
          },
        }}
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minHeight: 56 }}>
        {results.map((user) => {
          const selected = picked?.userId === user.userId;
          const tint = avatarColor(String(user.userId));
          return (
            <Box
              key={user.userId}
              component={motion.div}
              whileTap={{ scale: 0.99 }}
              onClick={() => setPicked(user)}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPicked(user); }
              }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.25,
                px: 1.25, py: 1, borderRadius: 2.5, cursor: 'pointer',
                bgcolor: selected ? T.tealBg : 'transparent',
                border: `1px solid ${selected ? T.glassBorderHover : 'transparent'}`,
                '&:hover': { bgcolor: selected ? T.tealBgHover : T.glassHover },
              }}
            >
              <Box sx={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800,
                bgcolor: `${tint}22`, color: tint, border: `1px solid ${tint}55`,
              }}>
                {initialsOf(user.fullName)}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography noWrap sx={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                  {user.fullName}
                </Typography>
                <Typography noWrap sx={{ fontSize: 11.5, color: T.textMuted }}>{user.email}</Typography>
              </Box>
              {selected && <CheckCircleRoundedIcon sx={{ fontSize: 19, color: T.teal }} />}
            </Box>
          );
        })}

        {noMatches && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.25, px: 0.5 }}>
            <SearchOffRoundedIcon sx={{ fontSize: 18, color: T.textMuted }} />
            <Typography sx={{ fontSize: 13, color: T.textMuted }}>
              No account by that name — carry on and “{typedName}” is added without one.
            </Typography>
          </Box>
        )}
      </Box>

      <Typography sx={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.55 }}>
        If you already split with this person, this opens what you have rather than starting a
        second one.
      </Typography>
    </TallyFormDialog>
  );
}
