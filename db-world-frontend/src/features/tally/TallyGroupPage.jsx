import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Button, IconButton, Menu, MenuItem, ListItemIcon, Fab,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import DriveFileRenameOutlineRoundedIcon from '@mui/icons-material/DriveFileRenameOutlineRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import UnarchiveRoundedIcon from '@mui/icons-material/UnarchiveRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useConfirm } from 'material-ui-confirm';
import Constants from '@shared/constants';
import { useT } from '@shared/theme';
import {
  useGroup, useExpenses, useSettleUpPlan, useCreateExpense, useVoidExpense, useReplaceExpense,
  useAddMembers, useRemoveMember, useUpdateMember, useClaimMember, useUpdateGroup,
  useActivity, useRestoreExpense,
  useRecordSettlement,
} from './hooks/useTally';
import { groupExpensesByDate, formatMoney } from './utils/tallyFormat';
import BalanceStrip from './components/BalanceStrip';
import ExpenseRow from './components/ExpenseRow';
import ExpenseRowSkeleton from './components/ExpenseRowSkeleton';
import AddExpenseDialog from './components/AddExpenseDialog';
import AddMemberDialog from './components/AddMemberDialog';
import MembersSheet from './components/MembersSheet';
import SettleUpSheet from './components/SettleUpSheet';
import RecordPaymentDialog from './components/RecordPaymentDialog';
import EditGroupDialog from './components/EditGroupDialog';
import HistorySheet from './components/HistorySheet';
import { groupIcon } from './utils/tallyFormat';

/**
 * Page chrome: the app bar offset, the side gutters and the reading-width cap.
 *
 * Declared at module scope rather than inside the page. A component defined during render is a
 * new type on every render, so React unmounts and remounts its entire subtree — which here
 * would close any open dialog and drop input focus on every keystroke.
 */
function Shell({ children }) {
  const T = useT();
  return (
    <Box sx={{
      minHeight: '100dvh', bgcolor: T.bg,
      pt: { xs: 'calc(56px + 16px)', md: 'calc(64px + 24px)' },
      px: { xs: 2, sm: 3, md: 4 },
      pb: { xs: 'calc(96px + env(safe-area-inset-bottom))', sm: 6 },
    }}>
      <Box sx={{ maxWidth: 760, mx: 'auto', width: '100%' }}>{children}</Box>
    </Box>
  );
}

/**
 * One group: where everyone stands, and everything that has been spent.
 *
 * The page is deliberately flat — no tabs. Balances and history are the same question asked
 * two ways, and putting them behind tabs means the number you came to check is always on the
 * other one.
 */
export default function TallyGroupPage() {
  const T = useT();
  const { groupId } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const reduce = useReducedMotion();

  const { data: group, isLoading, isError } = useGroup(groupId);
  const { data: page, isLoading: loadingExpenses } = useExpenses(groupId);

  const [addingExpense, setAddingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showMembers, setShowMembers] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [settling, setSettling] = useState(false);
  const [payment, setPayment] = useState(null);     // null | {} | prefill
  const [editingGroup, setEditingGroup] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [menuAt, setMenuAt] = useState(null);

  const { data: plan = [], isFetching: loadingPlan } = useSettleUpPlan(groupId, settling);
  const { data: history, isFetching: loadingHistory } = useActivity(groupId, showHistory);

  const createExpense = useCreateExpense(groupId);
  const replaceExpense = useReplaceExpense(groupId);
  const voidExpense = useVoidExpense(groupId);
  const addMembers = useAddMembers(groupId);
  const removeMember = useRemoveMember(groupId);
  const updateMember = useUpdateMember(groupId);
  const claimMember = useClaimMember(groupId);
  const updateGroup = useUpdateGroup(groupId);
  const recordSettlement = useRecordSettlement(groupId);
  const restoreExpense = useRestoreExpense(groupId);

  const members = group?.members ?? [];
  const myMemberId = group?.myMemberId ?? null;
  const isOwner = members.find((m) => m.id === myMemberId)?.role === 'OWNER';
  // Balances, members and settling up all presuppose somebody on the other side.
  const personal = group?.kind === 'PERSONAL';
  const nameOf = (id) => members.find((m) => m.id === id)?.displayName ?? 'Someone';

  // `page?.items ?? []` produces a new array on every render while the feed is still loading,
  // which would make the grouping below recompute each time for no reason.
  const expenses = useMemo(() => page?.items ?? [], [page]);
  const days = useMemo(() => groupExpensesByDate(expenses), [expenses]);

  const myBalance = Number(members.find((m) => m.id === myMemberId)?.balance ?? 0);

  /* ============================== actions ============================== */

  const submitExpense = (body) => {
    // Closed on success, not on submit. If the server refuses -- an EXACT split that does not
    // add up, a member who has since left -- the form stays open with everything still typed
    // into it, and the toast says which of those it was.
    const done = {
      onSuccess: () => { setAddingExpense(false); setEditingExpense(null); },
    };
    if (editingExpense) replaceExpense.mutate({ expenseId: editingExpense.id, body }, done);
    else createExpense.mutate(body, done);
  };

  const askVoid = (expense) => {
    confirm({
      title: 'Remove this expense?',
      description: `"${expense.description}" (${formatMoney(expense.totalAmount)}) will stop `
        + 'counting towards anybody\'s balance. It stays in the history, marked removed.',
      confirmationText: 'Remove',
      cancellationText: 'Keep it',
    }).then(() => voidExpense.mutate(expense.id)).catch(() => {});
  };

  const askRemoveMember = (member) => {
    const leaving = member.id === myMemberId;
    confirm({
      title: leaving ? 'Leave this group?' : `Remove ${member.displayName}?`,
      // The zero-balance rule is the server's to enforce, and its refusal names the amount.
      // Saying so up front means the refusal reads as expected rather than as a failure.
      description: leaving
        ? 'You can only leave once your balance is exactly zero. Your name stays on the expenses you were part of.'
        : `${member.displayName} can only be removed once their balance is exactly zero. `
          + 'Their name stays on the expenses they were part of.',
      confirmationText: leaving ? 'Leave' : 'Remove',
    }).then(() => {
      removeMember.mutate(member.id, {
        onSuccess: () => { if (leaving) navigate(Constants.DB_TALLY_ROUTE); },
      });
    }).catch(() => {});
  };

  const askArchive = () => {
    const outstanding = members.some((m) => Number(m.balance ?? 0) !== 0);
    confirm({
      title: 'Archive this group?',
      description: outstanding
        ? 'Some people are still up or down. Archiving hides the group from everyone — you can '
          + 'reopen it later, but nobody will be chasing those balances in the meantime.'
        : 'It will move to the archived list. You can reopen it any time.',
      confirmationText: 'Archive',
    })
      .then(() => updateGroup.mutate({ archived: true, settleOutstandingLater: outstanding }))
      .catch(() => {});
  };

  /* ============================== render ============================== */

  if (isLoading && !group) {
    return (
      <Shell>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {Array.from({ length: 5 }, (_, i) => <ExpenseRowSkeleton key={i} />)}
        </Box>
      </Shell>
    );
  }

  if (isError) {
    return (
      <Shell>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography sx={{ fontSize: 17, fontWeight: 800, color: T.textPrimary }}>
            This group is not here
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: T.textMuted, mt: 0.5, mb: 2 }}>
            It may have been removed, or it was never yours to see.
          </Typography>
          <Button
            onClick={() => navigate(Constants.DB_TALLY_ROUTE)}
            sx={{ textTransform: 'none', fontWeight: 700, color: T.teal }}
          >
            Back to your groups
          </Button>
        </Box>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <Box
        component={motion.div}
        initial={reduce ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}
      >
        <IconButton
          onClick={() => navigate(Constants.DB_TALLY_ROUTE)}
          aria-label="Back to your groups"
          sx={{ color: T.textMuted, ml: -1 }}
        >
          <ArrowBackRoundedIcon />
        </IconButton>

        {group && (
          <Box sx={{
            width: 34, height: 34, borderRadius: 2, flexShrink: 0,
            display: 'grid', placeItems: 'center', fontSize: 18,
            bgcolor: T.glass, border: `1px solid ${T.border}`,
          }}>
            {groupIcon(group)}
          </Box>
        )}

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography noWrap component="h1" sx={{
            fontSize: { xs: 19, sm: 24 }, fontWeight: 800,
            color: T.textPrimary, letterSpacing: -0.5,
          }}>
            {group?.name ?? 'Loading…'}
          </Typography>
          {group && (
            <Typography noWrap sx={{ fontSize: 12.5, color: T.textMuted }}>
              {personal ? 'Only you — nothing shared'
                : myBalance === 0 ? 'You are settled up'
                  : myBalance > 0 ? `You are owed ${formatMoney(myBalance)} here`
                    : `You owe ${formatMoney(-myBalance)} here`}
              {group.archived && ' · Archived'}
            </Typography>
          )}
        </Box>

        {!personal && (
          <IconButton
            onClick={() => setShowMembers(true)}
            aria-label="Who's in this group"
            sx={{ color: T.textMuted }}
          >
            <GroupsRoundedIcon />
          </IconButton>
        )}
        <IconButton
          onClick={(e) => setMenuAt(e.currentTarget)}
          aria-label="Group options"
          sx={{ color: T.textMuted, mr: -1 }}
        >
          <MoreVertRoundedIcon />
        </IconButton>
      </Box>

      {/* ── Balances ─────────────────────────────────────────────────────── */}
      {group && !personal && (
        <Box sx={{ mb: 2 }}>
          <BalanceStrip members={members} myMemberId={myMemberId} />
        </Box>
      )}

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      {group && !group.archived && (
        <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
          <Button
            onClick={() => { setEditingExpense(null); setAddingExpense(true); }}
            startIcon={<AddRoundedIcon />}
            variant="contained"
            disableElevation
            sx={{
              display: { xs: 'none', sm: 'inline-flex' },
              textTransform: 'none', fontWeight: 700, fontSize: 14,
              borderRadius: 2.5, px: 2.25, bgcolor: T.teal, color: '#fff',
              '&:hover': { bgcolor: T.tealHover },
            }}
          >
            Add expense
          </Button>
          {!personal && (
          <Button
            onClick={() => setSettling(true)}
            startIcon={<HandshakeRoundedIcon />}
            sx={{
              textTransform: 'none', fontWeight: 700, fontSize: 14, borderRadius: 2.5,
              px: 2, color: T.textPrimary, bgcolor: T.glass,
              border: `1px solid ${T.border}`,
              '&:hover': { bgcolor: T.glassHover },
            }}
          >
            Settle up
          </Button>
          )}
        </Box>
      )}

      {/* ── Expenses ─────────────────────────────────────────────────────── */}
      {loadingExpenses && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {Array.from({ length: 4 }, (_, i) => <ExpenseRowSkeleton key={i} />)}
        </Box>
      )}

      {!loadingExpenses && expenses.length === 0 && (
        <Box sx={{
          textAlign: 'center', py: { xs: 5, sm: 7 }, px: 2,
          borderRadius: 4, bgcolor: T.glass, border: `1px dashed ${T.glassBorder}`,
        }}>
          <ReceiptLongRoundedIcon sx={{ fontSize: 32, color: T.textMuted, mb: 1 }} />
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: T.textPrimary }}>
            Nothing spent yet
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: T.textMuted, mt: 0.5, maxWidth: 320, mx: 'auto' }}>
            Add the first expense and everyone&apos;s balance will work itself out.
          </Typography>
        </Box>
      )}

      <AnimatePresence initial={false}>
        {days.map((day) => (
          <Box key={day.label} sx={{ mb: 2.5 }}>
            <Typography sx={{
              position: 'sticky', top: { xs: 56, md: 64 }, zIndex: 2,
              fontSize: 12, fontWeight: 800, color: T.textMuted,
              bgcolor: T.bg, py: 0.75, letterSpacing: 0.2,
            }}>
              {day.label}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {day.items.map((expense, i) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  index={i}
                  myMemberId={myMemberId}
                  nameOf={nameOf}
                  onEdit={(e) => { setEditingExpense(e); setAddingExpense(true); }}
                  onVoid={askVoid}
                />
              ))}
            </Box>
          </Box>
        ))}
      </AnimatePresence>

      {page?.hasMore && (
        <Typography sx={{ fontSize: 12, color: T.textMuted, textAlign: 'center', mt: 1 }}>
          Showing the most recent {expenses.length}. Older ones are still counted in the balances.
        </Typography>
      )}

      {/* ── Chrome ───────────────────────────────────────────────────────── */}
      {group && !group.archived && (
        <Fab
          onClick={() => { setEditingExpense(null); setAddingExpense(true); }}
          aria-label="Add expense"
          sx={{
            display: { xs: 'flex', sm: 'none' },
            position: 'fixed', right: 18,
            bottom: 'calc(18px + env(safe-area-inset-bottom))',
            bgcolor: T.teal, color: '#fff', '&:hover': { bgcolor: T.tealHover },
          }}
        >
          <AddRoundedIcon />
        </Fab>
      )}

      <Menu
        anchorEl={menuAt}
        open={Boolean(menuAt)}
        onClose={() => setMenuAt(null)}
        slotProps={{
          paper: {
            sx: {
              bgcolor: T.bg, backgroundImage: 'none', borderRadius: 2.5,
              border: `1px solid ${T.glassBorder}`, minWidth: 200,
            },
          },
        }}
      >
        <MenuItem
          onClick={() => { setMenuAt(null); setEditingGroup(true); }}
          sx={{ fontSize: 14, color: T.textPrimary }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <DriveFileRenameOutlineRoundedIcon sx={{ fontSize: 18, color: T.textMuted }} />
          </ListItemIcon>
          {group?.kind === 'DIRECT' ? 'Change icon' : 'Edit name, type and icon'}
        </MenuItem>
        <MenuItem
          onClick={() => { setMenuAt(null); navigate(Constants.tallyGroupReportPath(groupId)); }}
          sx={{ fontSize: 14, color: T.textPrimary }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <InsightsRoundedIcon sx={{ fontSize: 18, color: T.textMuted }} />
          </ListItemIcon>
          Spending report
        </MenuItem>
        <MenuItem
          onClick={() => { setMenuAt(null); setShowHistory(true); }}
          sx={{ fontSize: 14, color: T.textPrimary }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <HistoryRoundedIcon sx={{ fontSize: 18, color: T.textMuted }} />
          </ListItemIcon>
          History
        </MenuItem>

        {isOwner && (
          group?.archived ? (
            <MenuItem
              onClick={() => { setMenuAt(null); updateGroup.mutate({ archived: false }); }}
              sx={{ fontSize: 14, color: T.textPrimary }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                <UnarchiveRoundedIcon sx={{ fontSize: 18, color: T.textMuted }} />
              </ListItemIcon>
              Reopen group
            </MenuItem>
          ) : (
            <MenuItem
              onClick={() => { setMenuAt(null); askArchive(); }}
              sx={{ fontSize: 14, color: T.textPrimary }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                <Inventory2OutlinedIcon sx={{ fontSize: 18, color: T.textMuted }} />
              </ListItemIcon>
              Archive group
            </MenuItem>
          )
        )}
      </Menu>

      <AddExpenseDialog
        open={addingExpense}
        onClose={() => { setAddingExpense(false); setEditingExpense(null); }}
        onSubmit={submitExpense}
        busy={createExpense.isPending || replaceExpense.isPending}
        members={members}
        myMemberId={myMemberId}
        editing={editingExpense}
      />

      <MembersSheet
        open={showMembers}
        onClose={() => setShowMembers(false)}
        members={members}
        myMemberId={myMemberId}
        isOwner={isOwner}
        onAdd={() => { setShowMembers(false); setAddingMember(true); }}
        onRemove={askRemoveMember}
        onClaim={(m) => claimMember.mutate(m.id)}
        onSetDelegation={(m, payerId) => updateMember.mutate({
          memberId: m.id, body: { paidForByMemberId: payerId },
        })}
        onClearDelegation={(m) => updateMember.mutate({
          memberId: m.id, body: { clearDelegation: true },
        })}
        onSetRole={(m, role) => updateMember.mutate({ memberId: m.id, body: { role } })}
      />

      <AddMemberDialog
        open={addingMember}
        onClose={() => setAddingMember(false)}
        busy={addMembers.isPending}
        existingUserIds={members.map((m) => m.userId).filter(Boolean)}
        onAdd={(bodies) => addMembers.mutate(bodies, { onSuccess: () => setAddingMember(false) })}
      />

      <SettleUpSheet
        open={settling}
        onClose={() => setSettling(false)}
        plan={plan}
        loading={loadingPlan}
        myMemberId={myMemberId}
        onRecord={(transfer) => { setSettling(false); setPayment(transfer); }}
        onRecordCustom={() => { setSettling(false); setPayment({}); }}
      />

      <RecordPaymentDialog
        open={Boolean(payment)}
        onClose={() => setPayment(null)}
        busy={recordSettlement.isPending}
        members={members}
        myMemberId={myMemberId}
        prefill={payment}
        onRecord={(body) => recordSettlement.mutate(body, { onSuccess: () => setPayment(null) })}
      />

      <HistorySheet
        open={showHistory}
        onClose={() => setShowHistory(false)}
        entries={history?.items ?? []}
        loading={loadingHistory}
        restoring={restoreExpense.isPending}
        onRestore={(entry) => restoreExpense.mutate(entry.subjectId)}
      />

      <EditGroupDialog
        open={editingGroup}
        group={group}
        busy={updateGroup.isPending}
        onClose={() => setEditingGroup(false)}
        onSave={(body) => updateGroup.mutate(body, { onSuccess: () => setEditingGroup(false) })}
      />
    </Shell>
  );

}
