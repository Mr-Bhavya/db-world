import { createContext, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, IconButton, Menu, MenuItem, ListItemIcon, Fab, Skeleton,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import DriveFileRenameOutlineRoundedIcon from '@mui/icons-material/DriveFileRenameOutlineRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import UnarchiveRoundedIcon from '@mui/icons-material/UnarchiveRounded';
import { motion, useReducedMotion } from 'framer-motion';
import { useConfirm } from 'material-ui-confirm';
import Constants from '@shared/constants';
import usePageMeta from '@shared/hooks/usePageMeta';
import { useT } from '@shared/theme';
import {
  useGroup, useSettleUpPlan, useCreateExpense, useReplaceExpense,
  useAddMembers, useRemoveMember, useUpdateMember, useClaimMember, useUpdateGroup,
  useRecordSettlement,
  useCreateLoan,
} from '../hooks/useTally';
import GroupBalanceHero, { GROUP_BALANCE_HERO_MIN_H } from './GroupBalanceHero';
import GroupTabs from './GroupTabs';
import WhoPaysWhom from './WhoPaysWhom';
import MemberAvatarRow from './MemberAvatarRow';
import LedgerAvatar from './LedgerAvatar';
import ExpenseRowSkeleton from './ExpenseRowSkeleton';
import GroupStickyBar, { GROUP_STICKY_TOP, useHeaderFade } from './GroupStickyBar';
import AddExpenseDialog from './AddExpenseDialog';
import AddMemberDialog from './AddMemberDialog';
import MembersSheet from './MembersSheet';
import SettleUpSheet from './SettleUpSheet';
import RecordPaymentDialog from './RecordPaymentDialog';
import LendBorrowDialog from './LendBorrowDialog';
import EditGroupDialog from './EditGroupDialog';

/**
 * Everything about a group that is <em>not</em> the view you picked.
 *
 * <h2>Why this exists</h2>
 * The three tabs are three routes, and each used to build its own chrome. None of it matched: the
 * expenses page was 1080px wide and the other two 760, the balance card existed only on expenses,
 * the title was three different sizes, and the member avatars and the overflow menu simply
 * vanished on report and history — so Edit and Archive were unreachable from two of the three
 * tabs. The result was a tab bar that jumped roughly 150px vertically and 220px sideways every
 * time you used it, which is why it never read as a set of tabs.
 *
 * <p>So the chrome lives here and the pages supply only their content. Header, balance, tab bar
 * and the balances column are rendered identically on all three routes, which means switching
 * tabs moves exactly one thing: the column under the bar.
 *
 * <p>It owns the group-level actions too — settling up, members, editing, archiving, and adding
 * an expense — because chrome that is on every tab has to work on every tab. Pages reach the
 * parts they need (the members, who I am, "open the expense editor") through
 * {@link useGroupChrome} rather than through a dozen props.
 */
const GroupChromeCtx = createContext(null);

/** The group, its members and the expense editor, for whichever view is inside the layout. */
export function useGroupChrome() {
  return useContext(GroupChromeCtx);
}

export default function GroupLayout({ groupId, active, children }) {
  const T = useT();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const reduce = useReducedMotion();

  const { data: group, isLoading, isError } = useGroup(groupId);

  // Named after the ledger once it has loaded. Called here rather than in any of the three tab
  // components: this layout is mounted once and survives a tab switch, so the tab title does not
  // flicker back to a default between views. Above the early returns, because it is a hook.
  usePageMeta(group?.name ?? 'Tally', {
    description: 'Shared expenses, balances and settle-up for one Tally ledger.',
  });

  const members = group?.members ?? [];
  const myMemberId = group?.myMemberId ?? null;
  const myBalance = Number(members.find((m) => m.id === myMemberId)?.balance ?? 0);

  const [addingExpense, setAddingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showMembers, setShowMembers] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [settling, setSettling] = useState(false);
  const [lending, setLending] = useState(false);
  const [payment, setPayment] = useState(null);     // null | {} | prefill
  const [editingGroup, setEditingGroup] = useState(false);
  const [menuAt, setMenuAt] = useState(null);

  // Fetched when the sheet is open OR when the reader has a balance, so the plan can be shown
  // inline. The hook is opt-in because a plan for a square group is a request whose answer is
  // always "nothing to do" -- that reasoning still holds, which is why this is a condition and
  // not simply `true`.
  const owesOrIsOwed = myBalance !== 0;
  const { data: plan = [], isFetching: loadingPlan } =
    useSettleUpPlan(groupId, settling || owesOrIsOwed);

  const createExpense = useCreateExpense(groupId);
  const replaceExpense = useReplaceExpense(groupId);
  const addMembers = useAddMembers(groupId);
  const removeMember = useRemoveMember(groupId);
  const updateMember = useUpdateMember(groupId);
  const claimMember = useClaimMember(groupId);
  const updateGroup = useUpdateGroup(groupId);
  const recordSettlement = useRecordSettlement(groupId);
  const createLoan = useCreateLoan(groupId);

  // Drives the other half of the handover to the pinned bar. Applied to a wrapper rather than
  // to the header itself, which has an entry animation on the same two properties.
  const headerFade = useHeaderFade();

  const isOwner = members.find((m) => m.id === myMemberId)?.role === 'OWNER';
  // Balances, members and settling up all presuppose somebody on the other side.
  const personal = group?.kind === 'PERSONAL';
  const direct = group?.kind === 'DIRECT';
  const activeCount = members.filter((m) => m.status === 'ACTIVE').length;
  // Only a real group earns the second column. Your own spending has no balances at all, and a
  // one-to-one ledger's are already the hero.
  const sidebar = Boolean(group) && !personal && !direct;
  const writable = Boolean(group) && !group.archived;
  // Your own spending has no report worth a tab and no history anybody else could have written.
  const showTabs = Boolean(group) && !personal;
  const nameOf = (id) => members.find((m) => m.id === id)?.displayName ?? 'Someone';

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

  const openExpense = (expense = null) => {
    setEditingExpense(expense);
    setAddingExpense(true);
  };

  const openLoan = () => setLending(true);

  /**
   * Repaying a loan, which is the payment dialog with the loan already named.
   *
   * <p>The direction is derived, not asked. On a loan you made, the money comes back FROM the
   * other person; on one you took, it goes TO them. Leaving that to the reader is asking them to
   * re-derive the thing they already told us when they recorded the loan -- and getting it
   * backwards would drive the balance further from zero instead of towards it.
   */
  const openRepay = (loan) => {
    const lent = loan.direction === 'LENT';
    setPayment({
      fromMemberId: lent ? loan.counterpartyMemberId : myMemberId,
      toMemberId: lent ? myMemberId : loan.counterpartyMemberId,
      amount: loan.outstanding,
      settlesExpenseId: loan.id,
      loanLabel: `${loan.counterpartyName} · ${loan.note || (lent ? 'money you lent' : 'money you borrowed')}`,
    });
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

  // The page gutters and the reading-width cap. The cap no longer depends on which tab you are
  // on -- that was the sideways jump.
  const shell = {
    minHeight: '100dvh', bgcolor: T.bg,
    pt: { xs: 'calc(56px + 16px)', md: 'calc(64px + 24px)' },
    px: { xs: 2, sm: 3, md: 4 },
    // Room for the floating button, which is now the only way to add an expense on a phone.
    pb: { xs: `calc(${writable ? 96 : 32}px + env(safe-area-inset-bottom))`, sm: 6 },
  };
  const column = { maxWidth: { xs: 760, md: sidebar ? 1080 : 760 }, mx: 'auto', width: '100%' };

  if (isLoading && !group) {
    const bar = { bgcolor: T.glass };
    return (
      <Box sx={shell}>
        <Box sx={column}>
          {/*
            The page's own chrome, at the page's own sizes.

            This used to be five expense rows and nothing else, so the header, the balance card
            and the tab bar all appeared together the moment the group landed and drove the feed
            about 250px down the page -- under the reader's thumb, on the row they were reading.
            The hero's height comes from the hero rather than from a number typed here.
          */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Skeleton variant="circular" width={40} height={40} sx={{ ...bar, ml: -1, flexShrink: 0 }} />
            <Skeleton variant="rounded" width={40} height={40} sx={{ ...bar, borderRadius: 2.5, flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: { xs: 19, sm: 24 }, fontWeight: 800 }}>
                <Skeleton variant="text" width="60%" sx={bar} />
              </Typography>
              <Typography sx={{ fontSize: 12.5 }}>
                <Skeleton variant="text" width="35%" sx={bar} />
              </Typography>
            </Box>
          </Box>

          <Skeleton variant="rounded"
            sx={{ ...bar, height: GROUP_BALANCE_HERO_MIN_H, borderRadius: 3.5, mb: 2.5 }} />

          {/* The tabs-and-action row. */}
          <Skeleton variant="rounded" width={240} height={42}
            sx={{ ...bar, borderRadius: 2.5, mb: 2.5 }} />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {Array.from({ length: 5 }, (_, i) => <ExpenseRowSkeleton key={i} />)}
          </Box>
        </Box>
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={shell}>
        <Box sx={{ ...column, textAlign: 'center', py: 8 }}>
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
      </Box>
    );
  }

  return (
    <Box sx={shell}>
      {/* ── The header, once the real one has gone ─────────────────────────── */}
      {/* Only where there are tabs to pin. Your own spending has none, so the bar would be a
          name and a back arrow duplicating a header a hundred pixels above it. */}
      {showTabs && (
        <GroupStickyBar
          group={group}
          groupId={groupId}
          active={active}
          onBack={() => navigate(Constants.DB_TALLY_ROUTE)}
          onMenu={(e) => setMenuAt(e.currentTarget)}
        />
      )}

      <Box sx={column}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        {/* One header for all three tabs, down to the size of the type in it. The subtitle says
            what the ledger IS rather than which tab you are on -- the tab bar below already
            says that, and a subtitle that changes with the view is a second thing moving. */}
        <Box component={motion.div} style={showTabs ? headerFade : undefined}>
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

          {/* Initials for a one-to-one ledger, the stored emoji for a group, a wallet for your
              own spending -- the same rule as the list you came from. */}
          {group && <LedgerAvatar ledger={group} size="md" />}

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography noWrap component="h1" sx={{
              fontSize: { xs: 19, sm: 24 }, fontWeight: 800,
              color: T.textPrimary, letterSpacing: -0.5,
            }}>
              {group?.name ?? 'Loading…'}
            </Typography>
            {/* No balance here any more -- it is the hero below. This says what the ledger IS,
                which is what a title needs and what the balance was crowding out. */}
            {group && (
              <Typography noWrap sx={{ fontSize: 12.5, color: T.textMuted }}>
                {[
                  personal ? 'Only you' : direct ? 'One to one' : `${activeCount} people`,
                  group.category,
                  group.archived && 'Archived',
                ].filter(Boolean).join(' · ')}
              </Typography>
            )}
          </Box>

          {/* Who is in here, answered by looking rather than by opening a sheet -- though the
              row is still the way in. A one-to-one ledger is named after the other person, so a
              row of two avatars would only repeat the title. */}
          {!personal && !direct && (
            <MemberAvatarRow members={members} onOpen={() => setShowMembers(true)} />
          )}
          {direct && (
            <IconButton
              onClick={() => setShowMembers(true)}
              aria-label="Who's in this ledger"
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
        </Box>

        {/* ── Where you stand ────────────────────────────────────────────── */}
        {/* On every tab, not just the expenses one. It is the number you opened the group to
            check, it is still worth knowing while you read the report, and holding it above the
            bar is what stops the bar moving when you switch. */}
        {group && !personal && (
          <GroupBalanceHero
            balance={myBalance}
            plan={plan}
            myMemberId={myMemberId}
            archived={group.archived}
            onSettleUp={() => setSettling(true)}
          />
        )}

        {/* ── Views, and the one thing to do ─────────────────────────────── */}
        {/* One row, not two. The tab bar caps at 380px and the button at 190, so stacked they
            left roughly 700px of empty page beside each of them and read as two half-finished
            rows. Tabs are where you are, the button is what you do — opposite ends of the same
            toolbar.

            The button is gone below sm: the floating one does the same job, and having both
            meant the same action twice with 60px of the first screen spent on saying so.
            Settling up is not here either — it lives on the balance card it clears. */}
        {(showTabs || writable) && (
          <Box sx={{
            // Without tabs -- your own spending -- the row is only the button, and on a phone
            // the button is the floating one, so there would be nothing here to leave a gap for.
            display: showTabs ? 'flex' : { xs: 'none', sm: 'flex' },
            alignItems: 'center', gap: 2, justifyContent: 'space-between', mb: 2.5,
          }}>
            {showTabs && <GroupTabs groupId={groupId} active={active} />}

            {writable && (
              <Button
                onClick={() => openExpense(null)}
                startIcon={<AddRoundedIcon />}
                variant="contained"
                disableElevation
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  flexShrink: 0, textTransform: 'none', fontWeight: 700, fontSize: 14,
                  borderRadius: 2.5, py: 1.1, px: 2.25, bgcolor: T.teal, color: '#fff',
                  '&:hover': { bgcolor: T.tealHover },
                }}
              >
                Add expense
              </Button>
            )}
          </Box>
        )}

        {/* ── The view, and who stands where ─────────────────────────────── */}
        {/* One column on a phone, two from md: what you scroll on the left, what you glance at
            on the right. The balances column is on all three tabs, so the page skeleton is the
            same whichever one you are on and only the left column changes.

            DOM order is the mobile order. On the expenses tab the balances come FIRST, because
            otherwise reaching "who do I pay" on a phone means scrolling past every expense; on
            the other two tabs there is no phone column at all, since burying the panel under a
            whole history is the same as not rendering it. `order` moves it right from md up. */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: sidebar ? 'minmax(0, 1.5fr) minmax(0, 1fr)' : '1fr',
          },
          gap: { xs: 0, md: 3 },
          alignItems: 'start',
        }}>
          {sidebar && (
            <Box sx={{
              minWidth: 0, mb: 3, order: { xs: 1, md: 2 },
              display: { xs: active === 'expenses' ? 'block' : 'none', md: 'block' },
              // From md it travels with the reader. A three-person group's balances are about
              // 200px against a feed that scrolls for screens, so left in normal flow the column
              // is mostly empty space and "who do I pay" is only answered at the very top of the
              // page. Sticky costs nothing when the panel is short and is the whole point when
              // the thing beside it is long.
              //
              // The cap and the overflow are for the other end: a fifteen-person group is taller
              // than the viewport, and a sticky element taller than its top offset allows simply
              // hangs off the bottom of the screen where the last few rows can never be reached.
              // Needs the grid's `alignItems: start` above to have any room to move in.
              // Clears the pinned bar, not just the app bar -- otherwise the panel parks itself
              // underneath it the moment the bar comes up.
              position: { md: 'sticky' },
              top: { md: GROUP_STICKY_TOP.md + 16 },
              maxHeight: { md: `calc(100dvh - ${GROUP_STICKY_TOP.md + 40}px)` },
              overflowY: { md: 'auto' },
              overscrollBehavior: 'contain',
              '&::-webkit-scrollbar': { width: 6 },
              '&::-webkit-scrollbar-thumb': { bgcolor: T.glassBorder, borderRadius: 99 },
            }}>
              <WhoPaysWhom
                members={members}
                plan={plan}
                myMemberId={myMemberId}
                loading={loadingPlan && plan.length === 0}
              />
            </Box>
          )}

          <Box sx={{ minWidth: 0, order: { xs: 2, md: 1 } }}>
            <GroupChromeCtx.Provider
              value={{ group, members, myMemberId, isOwner, nameOf, openExpense, openLoan, openRepay }}
            >
              {children}
            </GroupChromeCtx.Provider>
          </Box>
        </Box>
      </Box>

      {/* ── Chrome ───────────────────────────────────────────────────────── */}
      {writable && (
        <Fab
          onClick={() => openExpense(null)}
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
              border: `1px solid ${T.glassBorder}`, minWidth: 168,
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
          {direct ? 'Change icon' : 'Edit group'}
        </MenuItem>
        {writable && !personal && (
          <MenuItem
            onClick={() => { setMenuAt(null); openLoan(); }}
            sx={{ fontSize: 14, color: T.textPrimary }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <HandshakeOutlinedIcon sx={{ fontSize: 18, color: T.textMuted }} />
            </ListItemIcon>
            Lend or borrow
          </MenuItem>
        )}
        {/* The report and the history used to be here. They are tabs now -- they are things
            you look at, and nobody finds a view hidden behind three dots next to Archive. What
            is left are the two actions, which is what a menu is for. */}

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

      <LendBorrowDialog
        open={lending}
        onClose={() => setLending(false)}
        busy={createLoan.isPending}
        members={members}
        myMemberId={myMemberId}
        onSubmit={(body) => createLoan.mutate(body, { onSuccess: () => setLending(false) })}
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

      <EditGroupDialog
        open={editingGroup}
        group={group}
        busy={updateGroup.isPending}
        onClose={() => setEditingGroup(false)}
        onSave={(body) => updateGroup.mutate(body, { onSuccess: () => setEditingGroup(false) })}
      />
    </Box>
  );
}
