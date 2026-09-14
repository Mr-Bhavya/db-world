import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Fab } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import Constants from '@shared/constants';
import { useT } from '@shared/theme';
import { useGroups, useCreateGroup, useCreateDirect } from './hooks/useTally';
import { formatMoney, balanceColor } from './utils/tallyFormat';
import GroupCard from './components/GroupCard';
import GroupCardSkeleton from './components/GroupCardSkeleton';
import CreateGroupDialog from './components/CreateGroupDialog';
import StartDirectDialog from './components/StartDirectDialog';

const SKELETON_COUNT = 4;

// Tracks follow the available width rather than four guessed breakpoints: a phone gets one, a
// tablet two, the capped container tops out at three. `min(100%, 320px)` rather than a bare
// `320px` keeps it safe at the small end — a track's automatic minimum is its content's
// min-content width, so a long unbroken group name could otherwise push the page wider than
// the viewport and produce a horizontal scrollbar on a phone.
const GRID_COLUMNS = 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))';

/**
 * The landing screen: every group you are in, and where you stand in each.
 *
 * Sorted by the server on recent activity, and split into live and archived rather than
 * filtered by a control — an archived group is still readable, just finished, and hiding it
 * behind a toggle nobody finds is how people lose track of one.
 */
export default function TallyPage() {
  const T = useT();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const { data: groups = [], isLoading } = useGroups();
  const createGroup = useCreateGroup();
  const createDirect = useCreateDirect();
  const [creating, setCreating] = useState(false);
  const [startingDirect, setStartingDirect] = useState(false);

  /* People and groups are listed apart because they answer different questions: "what do I owe
     Amma" and "how is the Goa trip going" are not items on one list. Archived falls out of both
     into its own section rather than vanishing -- a finished ledger is still readable. */
  const { people, live, archived } = useMemo(() => ({
    people: groups.filter((g) => !g.archived && g.kind === 'DIRECT'),
    live: groups.filter((g) => !g.archived && g.kind !== 'DIRECT'),
    archived: groups.filter((g) => g.archived),
  }), [groups]);

  /**
   * What the app owes you, net, across every live group.
   *
   * One number rather than a per-group list, because the first question on opening the app is
   * "am I up or down overall" and the grid below answers "in which group" anyway.
   */
  const net = useMemo(
    () => live.reduce((sum, g) => sum + Number(g.myBalance ?? 0), 0),
    [live],
  );

  const handleCreate = (body) => {
    createGroup.mutate(body, {
      onSuccess: (group) => {
        setCreating(false);
        // Straight into the new group: it is empty, and the next thing anybody wants is to add
        // the people who are in it.
        if (group?.id) navigate(Constants.tallyGroupPath(group.id));
      },
    });
  };

  const showEmpty = !isLoading && groups.length === 0;

  return (
    <Box sx={{
      minHeight: '100dvh', bgcolor: T.bg,
      px: { xs: 2, sm: 3, md: 4 },
      // Clears the fixed app bar, which is 56px on a phone and 64px from md up.
      pt: { xs: 'calc(56px + 16px)', md: 'calc(64px + 24px)' },
      pb: { xs: 'calc(96px + env(safe-area-inset-bottom))', sm: 6 },
    }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <Box
          component={motion.div}
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          sx={{
            display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' },
            gap: 2, mb: { xs: 2.5, sm: 3.5 },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ReceiptLongRoundedIcon sx={{ fontSize: 22, color: T.teal }} />
              <Typography component="h1" sx={{
                fontSize: { xs: 24, sm: 30 }, fontWeight: 800,
                color: T.textPrimary, letterSpacing: -0.8,
              }}>
                Tally
              </Typography>
            </Box>

            {isLoading ? (
              <Typography sx={{ fontSize: 14, color: T.textMuted, mt: 0.5 }}>
                Adding things up…
              </Typography>
            ) : (
              <Typography sx={{ fontSize: { xs: 14, sm: 15 }, color: T.textMuted, mt: 0.5 }}>
                {groups.length === 0 ? 'Split expenses with anyone — account or not' : (
                  net === 0 ? 'You are all square everywhere' : (
                    <>
                      Overall, you
                      {' '}
                      <Box component="span" sx={{ color: balanceColor(net, T), fontWeight: 800 }}>
                        {net > 0 ? `are owed ${formatMoney(net)}` : `owe ${formatMoney(Math.abs(net))}`}
                      </Box>
                    </>
                  )
                )}
              </Typography>
            )}
          </Box>

          {/* Desktop gets both actions; phones get the FABs below, where a thumb already is.
              Splitting with one person comes first because it is the lighter of the two --
              no name to invent and nothing to set up. */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1, flexShrink: 0 }}>
            <Button
              onClick={() => setStartingDirect(true)}
              startIcon={<PersonRoundedIcon />}
              variant="contained"
              disableElevation
              sx={{
                textTransform: 'none', fontWeight: 700, fontSize: 14,
                borderRadius: 2.5, px: 2.25, py: 1,
                bgcolor: T.teal, color: '#fff', '&:hover': { bgcolor: T.tealHover },
              }}
            >
              Split with someone
            </Button>
            <Button
              onClick={() => setCreating(true)}
              startIcon={<GroupsRoundedIcon />}
              sx={{
                textTransform: 'none', fontWeight: 700, fontSize: 14,
                borderRadius: 2.5, px: 2, py: 1,
                color: T.textPrimary, bgcolor: T.glass, border: `1px solid ${T.border}`,
                '&:hover': { bgcolor: T.glassHover },
              }}
            >
              New group
            </Button>
          </Box>
        </Box>

        {/* ── Groups ───────────────────────────────────────────────────────── */}
        {isLoading && (
          <Box sx={{ display: 'grid', gridTemplateColumns: GRID_COLUMNS, gap: 2 }}>
            {Array.from({ length: SKELETON_COUNT }, (_, i) => <GroupCardSkeleton key={i} />)}
          </Box>
        )}

        {showEmpty && <EmptyState onCreate={() => setCreating(true)} />}

        {!isLoading && people.length > 0 && (
          <Box sx={{ mb: live.length ? 4 : 0 }}>
            <SectionHeading icon={<PersonRoundedIcon sx={{ fontSize: 16 }} />} label="People" />
            <Box sx={{ display: 'grid', gridTemplateColumns: GRID_COLUMNS, gap: 2 }}>
              {people.map((group, i) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  index={i}
                  onOpen={() => navigate(Constants.tallyGroupPath(group.id))}
                />
              ))}
            </Box>
          </Box>
        )}

        {!isLoading && live.length > 0 && (
          <Box>
            {people.length > 0 && (
              <SectionHeading icon={<GroupsRoundedIcon sx={{ fontSize: 16 }} />} label="Groups" />
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: GRID_COLUMNS, gap: 2 }}>
            <AnimatePresence initial={false}>
              {live.map((group, i) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  index={i}
                  onOpen={() => navigate(Constants.tallyGroupPath(group.id))}
                />
              ))}
            </AnimatePresence>
            </Box>
          </Box>
        )}

        {!isLoading && archived.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <SectionHeading
              icon={<Inventory2OutlinedIcon sx={{ fontSize: 16 }} />}
              label="Archived"
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: GRID_COLUMNS, gap: 2 }}>
              {archived.map((group, i) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  index={i}
                  onOpen={() => navigate(Constants.tallyGroupPath(group.id))}
                />
              ))}
            </Box>
          </Box>
        )}
      </Box>

      {/* Thumb-reachable on a phone, and clear of the home indicator. */}
      <Box sx={{
        display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 1.25,
        position: 'fixed', right: 18, bottom: 'calc(18px + env(safe-area-inset-bottom))',
        alignItems: 'flex-end',
      }}>
        <Fab
          size="small"
          onClick={() => setCreating(true)}
          aria-label="New group"
          sx={{
            bgcolor: T.glass, color: T.textPrimary, border: `1px solid ${T.border}`,
            '&:hover': { bgcolor: T.glassHover },
          }}
        >
          <GroupsRoundedIcon sx={{ fontSize: 19 }} />
        </Fab>
        <Fab
          onClick={() => setStartingDirect(true)}
          aria-label="Split with someone"
          sx={{ bgcolor: T.teal, color: '#fff', '&:hover': { bgcolor: T.tealHover } }}
        >
          <AddIcon />
        </Fab>
      </Box>

      <CreateGroupDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={handleCreate}
        busy={createGroup.isPending}
      />

      <StartDirectDialog
        open={startingDirect}
        onClose={() => setStartingDirect(false)}
        busy={createDirect.isPending}
        onStart={(body) => createDirect.mutate(body, {
          onSuccess: (ledger) => {
            setStartingDirect(false);
            if (ledger?.id) navigate(Constants.tallyGroupPath(ledger.id));
          },
        })}
      />
    </Box>
  );
}

/**
 * The first-run screen.
 *
 * Says what the app is for in one line and offers the single action that gets you moving.
 * Naming the ghost feature here is deliberate: it is the reason to choose this over Splitwise,
 * and it is invisible until you are already inside a group.
 */
function SectionHeading({ icon, label }) {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, color: T.textMuted }}>
      {icon}
      <Typography sx={{ fontSize: 13, fontWeight: 800, color: T.textMuted }}>{label}</Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: T.border }} />
    </Box>
  );
}

function EmptyState({ onCreate }) {
  const T = useT();
  const reduce = useReducedMotion();
  return (
    <Box
      component={motion.div}
      initial={reduce ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      sx={{
        textAlign: 'center', py: { xs: 6, sm: 9 }, px: 2,
        borderRadius: 4, bgcolor: T.glass, border: `1px dashed ${T.glassBorder}`,
      }}
    >
      <Box sx={{
        width: 62, height: 62, borderRadius: '50%', mx: 'auto', mb: 2,
        display: 'grid', placeItems: 'center',
        bgcolor: T.tealBg, border: `1px solid ${T.glassBorderHover}`,
      }}>
        <ReceiptLongRoundedIcon sx={{ fontSize: 28, color: T.teal }} />
      </Box>
      <Typography sx={{ fontSize: 18, fontWeight: 800, color: T.textPrimary, letterSpacing: -0.3 }}>
        No groups yet
      </Typography>
      <Typography sx={{
        fontSize: 14, color: T.textMuted, mt: 0.75, mb: 2.5,
        maxWidth: 380, mx: 'auto', lineHeight: 1.6,
      }}>
        Start one for your household or your next trip. You can add people who will never
        create an account — they still owe and get paid back like everyone else.
      </Typography>
      <Button
        onClick={onCreate}
        startIcon={<AddIcon />}
        variant="contained"
        disableElevation
        sx={{
          textTransform: 'none', fontWeight: 700, fontSize: 14,
          borderRadius: 2.5, px: 2.5, py: 1,
          bgcolor: T.teal, color: '#fff', '&:hover': { bgcolor: T.tealHover },
        }}
      >
        Create your first group
      </Button>
    </Box>
  );
}
