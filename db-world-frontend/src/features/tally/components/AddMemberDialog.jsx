import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, TextField, CircularProgress, InputAdornment, useMediaQuery, useTheme,
} from '@mui/material';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@shared/theme';
import { searchUsers } from '../api/tallyApi';
import { initialsOf, avatarColor } from '../utils/tallyFormat';
import { TallyFormDialog, TallySubmitButton, TallyCancelButton, tallyFieldSx } from './tallyFormUi';

/**
 * Adding people to a group — several at once, with or without db-world accounts.
 *
 * One at a time was the original, and it made setting up a household a sequence of identical
 * round trips through the same dialog. Both kinds of person are collected in one basket here
 * and added on a single tap.
 *
 * Accounts and ghosts sit in the same dialog at the same level, which is the point of the
 * module: somebody who will never sign up owes, pays and settles exactly like everyone else,
 * and hiding them behind an "advanced" link would imply otherwise.
 */
export default function AddMemberDialog({ open, onClose, onAdd, busy, existingUserIds = [] }) {
  const T = useT();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [pickedUsers, setPickedUsers] = useState([]);   // {userId, fullName, email}[]
  const [ghostDraft, setGhostDraft] = useState('');
  const [ghostNames, setGhostNames] = useState([]);

  useEffect(() => {
    if (!open) return;
    setTerm(''); setDebounced(''); setPickedUsers([]); setGhostDraft(''); setGhostNames([]);
  }, [open]);

  // Debounced, so typing a name is not one request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 280);
    return () => clearTimeout(id);
  }, [term]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['tally', 'user-search', debounced],
    queryFn: () => searchUsers(debounced),
    enabled: open && debounced.length >= 2,
  });

  // Somebody already in the group is shown but not selectable. Hiding them would look like
  // the search was broken; "already in this group" is the useful answer.
  const rows = useMemo(
    () => results.map((u) => ({ ...u, already: existingUserIds.includes(u.userId) })),
    [results, existingUserIds],
  );

  const toggleUser = (user) => setPickedUsers((prev) => (
    prev.some((p) => p.userId === user.userId)
      ? prev.filter((p) => p.userId !== user.userId)
      : [...prev, user]
  ));

  const commitGhost = () => {
    const name = ghostDraft.trim();
    if (!name) return;
    // Same name twice in one batch is a slip, not an intention.
    if (!ghostNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
      setGhostNames((prev) => [...prev, name]);
    }
    setGhostDraft('');
  };

  const total = pickedUsers.length + ghostNames.length;

  const submit = () => {
    if (!total) return;
    onAdd([
      ...pickedUsers.map((u) => ({ userId: u.userId, displayName: null, email: null })),
      ...ghostNames.map((name) => ({ userId: null, displayName: name, email: null })),
    ]);
  };

  return (
    <TallyFormDialog
      open={open}
      onClose={onClose}
      busy={busy}
      fullScreen={fullScreen}
      title="Add people"
      subtitle="Pick as many as you like — they do not all need an account"
      actions={(
        <>
          <TallyCancelButton onClick={onClose} disabled={busy} />
          <TallySubmitButton busy={busy} disabled={!total} onClick={submit}>
            {total > 1 ? `Add ${total} people` : 'Add to group'}
          </TallySubmitButton>
        </>
      )}
    >
      {/* ── Accounts ─────────────────────────────────────────────────────── */}
      <Box>
        <SectionLabel icon={<PersonSearchRoundedIcon sx={{ fontSize: 16 }} />}>
          Has a db-world account
        </SectionLabel>
        <TextField
          autoFocus
          fullWidth
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by name or email"
          sx={tallyFieldSx(T)}
          slotProps={{
            input: {
              endAdornment: isFetching
                ? <CircularProgress size={16} sx={{ color: T.textMuted }} />
                : null,
            },
          }}
        />

        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {debounced.length >= 2 && !isFetching && rows.length === 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.25, px: 0.5 }}>
              <SearchOffRoundedIcon sx={{ fontSize: 18, color: T.textMuted }} />
              <Typography sx={{ fontSize: 13, color: T.textMuted }}>
                Nobody by that name — add them below without an account instead.
              </Typography>
            </Box>
          )}

          {rows.map((user) => {
            const selected = pickedUsers.some((p) => p.userId === user.userId);
            const tint = avatarColor(String(user.userId));
            return (
              <Box
                key={user.userId}
                component={motion.div}
                whileTap={user.already ? undefined : { scale: 0.99 }}
                onClick={() => !user.already && toggleUser(user)}
                role={user.already ? undefined : 'button'}
                tabIndex={user.already ? undefined : 0}
                aria-pressed={selected}
                onKeyDown={(e) => {
                  if (!user.already && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault(); toggleUser(user);
                  }
                }}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25,
                  px: 1.25, py: 1, borderRadius: 2.5,
                  cursor: user.already ? 'default' : 'pointer',
                  opacity: user.already ? 0.45 : 1,
                  bgcolor: selected ? T.tealBg : 'transparent',
                  border: `1px solid ${selected ? T.glassBorderHover : 'transparent'}`,
                  '&:hover': user.already ? undefined : { bgcolor: selected ? T.tealBgHover : T.glassHover },
                }}
              >
                {user.already ? (
                  <Box sx={{ width: 20 }} />
                ) : selected ? (
                  <CheckCircleRoundedIcon sx={{ fontSize: 20, color: T.teal, flexShrink: 0 }} />
                ) : (
                  <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 20, color: T.textMuted, flexShrink: 0 }} />
                )}
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
                  <Typography noWrap sx={{ fontSize: 11.5, color: T.textMuted }}>
                    {user.already ? 'Already in this group' : user.email}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* ── Ghosts ───────────────────────────────────────────────────────── */}
      <Box>
        <SectionLabel icon={<PersonAddAlt1RoundedIcon sx={{ fontSize: 16 }} />}>
          No account
        </SectionLabel>
        <TextField
          fullWidth
          value={ghostDraft}
          onChange={(e) => setGhostDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitGhost(); }
          }}
          onBlur={commitGhost}
          placeholder="Type a name and press Enter"
          sx={tallyFieldSx(T)}
          slotProps={{
            input: {
              endAdornment: ghostDraft.trim() ? (
                <InputAdornment position="end">
                  <Typography
                    role="button"
                    tabIndex={0}
                    onClick={commitGhost}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitGhost(); }}
                    sx={{ fontSize: 12, fontWeight: 800, color: T.teal, cursor: 'pointer' }}
                  >
                    ADD
                  </Typography>
                </InputAdornment>
              ) : null,
            },
          }}
        />

        <AnimatePresence initial={false}>
          {ghostNames.length > 0 && (
            <Box
              component={motion.div}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              sx={{ overflow: 'hidden' }}
            >
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                {ghostNames.map((name) => (
                  <Box
                    key={name}
                    component={motion.div}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.5,
                      pl: 1.25, pr: 0.6, py: 0.5, borderRadius: 999,
                      fontSize: 12.5, fontWeight: 600,
                      bgcolor: T.tealBg, color: T.textPrimary,
                      border: `1px solid ${T.glassBorderHover}`,
                    }}
                  >
                    {name}
                    <CloseRoundedIcon
                      role="button"
                      tabIndex={0}
                      aria-label={`Remove ${name}`}
                      onClick={() => setGhostNames((prev) => prev.filter((n) => n !== name))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setGhostNames((prev) => prev.filter((n) => n !== name));
                        }
                      }}
                      sx={{ fontSize: 15, color: T.textMuted, cursor: 'pointer' }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </AnimatePresence>

        <Typography sx={{ fontSize: 11.5, color: T.textMuted, mt: 1, lineHeight: 1.55 }}>
          They can pay, owe and be settled with straight away. If they sign up later they can
          take over this history themselves, and nothing moves.
        </Typography>
      </Box>
    </TallyFormDialog>
  );
}

function SectionLabel({ icon, children }) {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 1, color: T.textMuted }}>
      {icon}
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: T.textMuted }}>{children}</Typography>
    </Box>
  );
}
