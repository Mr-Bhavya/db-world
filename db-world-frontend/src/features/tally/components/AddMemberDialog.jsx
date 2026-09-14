import { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, CircularProgress, useMediaQuery, useTheme,
} from '@mui/material';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@shared/theme';
import { searchUsers } from '../api/tallyApi';
import { initialsOf, avatarColor } from '../utils/tallyFormat';
import { TallyFormDialog, TallySubmitButton, TallyCancelButton, tallyFieldSx } from './tallyFormUi';

const MODES = [
  { value: 'account', label: 'Has an account', Icon: PersonSearchRoundedIcon },
  { value: 'ghost', label: 'No account', Icon: PersonAddAlt1RoundedIcon },
];

/**
 * Adding somebody to a group — with or without a db-world account.
 *
 * Both paths are offered at the same level, which is the point of the module. In Splitwise the
 * person without an account is a second-class placeholder; here they owe, pay and get settled
 * with exactly like anyone else, and the form should not imply otherwise by hiding them behind
 * an "advanced" link.
 */
export default function AddMemberDialog({ open, onClose, onAdd, busy, existingUserIds = [] }) {
  const T = useT();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [mode, setMode] = useState('account');
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState(null);
  const [ghostName, setGhostName] = useState('');
  const [ghostEmail, setGhostEmail] = useState('');

  useEffect(() => {
    if (!open) return;
    setMode('account'); setTerm(''); setDebounced('');
    setPicked(null); setGhostName(''); setGhostEmail('');
  }, [open]);

  // Debounced so typing a name is not one request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 280);
    return () => clearTimeout(id);
  }, [term]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['tally', 'user-search', debounced],
    queryFn: () => searchUsers(debounced),
    enabled: open && mode === 'account' && debounced.length >= 2,
  });

  // Somebody already in the group is shown but not selectable — hiding them would look like
  // the search was broken, and "already in this group" is the useful answer.
  const rows = results.map((u) => ({ ...u, already: existingUserIds.includes(u.userId) }));

  const canSubmit = mode === 'account' ? Boolean(picked) : Boolean(ghostName.trim());

  const submit = () => {
    if (!canSubmit) return;
    onAdd(mode === 'account'
      ? { userId: picked.userId, displayName: null, email: null }
      : { userId: null, displayName: ghostName.trim(), email: ghostEmail.trim() || null });
  };

  return (
    <TallyFormDialog
      open={open}
      onClose={onClose}
      busy={busy}
      fullScreen={fullScreen}
      title="Add somebody"
      subtitle="They do not need a db-world account to be in the group"
      actions={(
        <>
          <TallyCancelButton onClick={onClose} disabled={busy} />
          <TallySubmitButton busy={busy} disabled={!canSubmit} onClick={submit}>
            Add to group
          </TallySubmitButton>
        </>
      )}
    >
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        {MODES.map(({ value, label, Icon }) => {
          const selected = mode === value;
          return (
            <Box
              key={value}
              component={motion.button}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => setMode(value)}
              sx={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
                px: 1.5, py: 1.1, borderRadius: 2.5, cursor: 'pointer',
                fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
                bgcolor: selected ? T.tealBg : T.glass,
                color: selected ? T.teal : T.textMuted,
                border: `1px solid ${selected ? T.glassBorderHover : T.border}`,
                transition: 'all .15s ease',
              }}
            >
              <Icon sx={{ fontSize: 18 }} />
              {label}
            </Box>
          );
        })}
      </Box>

      <AnimatePresence mode="wait">
        {mode === 'account' ? (
          <Box
            key="account"
            component={motion.div}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <TextField
              autoFocus
              fullWidth
              value={term}
              onChange={(e) => { setTerm(e.target.value); setPicked(null); }}
              label="Search by name or email"
              placeholder="Start typing…"
              sx={tallyFieldSx(T)}
              slotProps={{
                input: {
                  endAdornment: isFetching
                    ? <CircularProgress size={16} sx={{ color: T.textMuted }} />
                    : null,
                },
              }}
            />

            <Box sx={{ mt: 1.25, display: 'flex', flexDirection: 'column', gap: 0.4, minHeight: 68 }}>
              {debounced.length >= 2 && !isFetching && rows.length === 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5, px: 0.5 }}>
                  <SearchOffRoundedIcon sx={{ fontSize: 18, color: T.textMuted }} />
                  <Typography sx={{ fontSize: 13, color: T.textMuted }}>
                    Nobody by that name. Add them without an account instead.
                  </Typography>
                </Box>
              )}

              {rows.map((user) => {
                const selected = picked?.userId === user.userId;
                const tint = avatarColor(String(user.userId));
                return (
                  <Box
                    key={user.userId}
                    component={motion.div}
                    whileTap={user.already ? undefined : { scale: 0.99 }}
                    onClick={() => !user.already && setPicked(user)}
                    role={user.already ? undefined : 'button'}
                    tabIndex={user.already ? undefined : 0}
                    onKeyDown={(e) => {
                      if (!user.already && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault(); setPicked(user);
                      }
                    }}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.25,
                      px: 1.25, py: 1, borderRadius: 2.5,
                      cursor: user.already ? 'default' : 'pointer',
                      opacity: user.already ? 0.5 : 1,
                      bgcolor: selected ? T.tealBg : 'transparent',
                      border: `1px solid ${selected ? T.glassBorderHover : 'transparent'}`,
                      '&:hover': user.already ? undefined : { bgcolor: selected ? T.tealBgHover : T.glassHover },
                    }}
                  >
                    <Box sx={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      display: 'grid', placeItems: 'center',
                      fontSize: 12, fontWeight: 800,
                      bgcolor: `${tint}22`, color: tint, border: `1px solid ${tint}55`,
                    }}>
                      {initialsOf(user.fullName)}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography noWrap sx={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                        {user.fullName}
                      </Typography>
                      <Typography noWrap sx={{ fontSize: 11.5, color: T.textMuted }}>
                        {user.already ? 'Already in this group' : user.email}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        ) : (
          <Box
            key="ghost"
            component={motion.div}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <TextField
              autoFocus
              fullWidth
              value={ghostName}
              onChange={(e) => setGhostName(e.target.value)}
              label="Their name"
              placeholder="Amma"
              sx={tallyFieldSx(T)}
            />
            <TextField
              fullWidth
              value={ghostEmail}
              onChange={(e) => setGhostEmail(e.target.value)}
              label="Email (optional)"
              helperText="Only so you can invite them later. Nothing is sent now."
              sx={tallyFieldSx(T)}
            />
            <Typography sx={{ fontSize: 12, color: T.textMuted, lineHeight: 1.55 }}>
              They can pay, owe and be settled with straight away. If they sign up later, they
              can take over this history themselves and nothing moves.
            </Typography>
          </Box>
        )}
      </AnimatePresence>
    </TallyFormDialog>
  );
}
