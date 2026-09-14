import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import * as api from '../api/tallyApi';

/**
 * Server messages are surfaced verbatim wherever there is one.
 *
 * The backend's refusals are the useful half of this module — "Amma is still owed ₹50.00.
 * Settle up before they leave.", "This group still has ₹4,000 outstanding between 3 people." —
 * and every one of them names the amount or the person. Replacing that with a generic
 * "Something went wrong" would throw away the only thing the user can act on.
 */
const errMsg = (e, fallback) => e?.response?.data?.message || fallback;

const keys = {
  all: ['tally'],
  groups: ['tally', 'groups'],
  group: (id) => ['tally', 'group', id],
  expenses: (id) => ['tally', 'expenses', id],
  settlements: (id) => ['tally', 'settlements', id],
  settleUp: (id) => ['tally', 'settle-up', id],
};

/**
 * Everything a write to one group can change.
 *
 * Invalidated together, always. An expense moves balances, which moves the settle-up plan and
 * the group's card in the list — and a screen showing a fresh expense next to a stale balance
 * is worse than one that is briefly loading, because it looks correct.
 */
function invalidateGroup(qc, groupId) {
  qc.invalidateQueries({ queryKey: keys.groups });
  if (!groupId) return;
  qc.invalidateQueries({ queryKey: keys.group(groupId) });
  qc.invalidateQueries({ queryKey: keys.expenses(groupId) });
  qc.invalidateQueries({ queryKey: keys.settlements(groupId) });
  qc.invalidateQueries({ queryKey: keys.settleUp(groupId) });
}

/* ============================== reads ============================== */

export function useGroups() {
  return useQuery({ queryKey: keys.groups, queryFn: api.fetchGroups });
}

export function useGroup(groupId) {
  return useQuery({
    queryKey: keys.group(groupId),
    queryFn: () => api.fetchGroup(groupId),
    enabled: Boolean(groupId),
  });
}

export function useExpenses(groupId) {
  return useQuery({
    queryKey: keys.expenses(groupId),
    queryFn: () => api.fetchExpenses(groupId),
    enabled: Boolean(groupId),
  });
}

export function useSettlements(groupId) {
  return useQuery({
    queryKey: keys.settlements(groupId),
    queryFn: () => api.fetchSettlements(groupId),
    enabled: Boolean(groupId),
  });
}

/**
 * The suggested transfers.
 *
 * `enabled` is opt-in because this is only ever shown inside the settle-up sheet — fetching a
 * plan nobody has asked to see would be a query per group view for advice that is usually
 * "everyone is square".
 */
export function useSettleUpPlan(groupId, enabled = false) {
  return useQuery({
    queryKey: keys.settleUp(groupId),
    queryFn: () => api.fetchSettleUpPlan(groupId),
    enabled: Boolean(groupId) && enabled,
  });
}

/* ============================== groups ============================== */

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createGroup,
    onSuccess: (group) => {
      qc.invalidateQueries({ queryKey: keys.groups });
      notify.success(`${group?.name ?? 'Group'} created`);
    },
    onError: (e) => notify.error(errMsg(e, 'Could not create that group')),
  });
}

export function useUpdateGroup(groupId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.updateGroup(groupId, body),
    onSuccess: (group) => {
      invalidateGroup(qc, groupId);
      notify.success(group?.archived ? 'Group archived' : 'Group updated');
    },
    onError: (e) => notify.error(errMsg(e, 'Could not update that group')),
  });
}

/* ============================== members ============================== */

export function useAddMember(groupId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.addMember(groupId, body),
    onSuccess: (member) => {
      invalidateGroup(qc, groupId);
      notify.success(`${member?.displayName ?? 'They'} joined the group`);
    },
    onError: (e) => notify.error(errMsg(e, 'Could not add them')),
  });
}

export function useUpdateMember(groupId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, body }) => api.updateMember(groupId, memberId, body),
    onSuccess: () => invalidateGroup(qc, groupId),
    onError: (e) => notify.error(errMsg(e, 'Could not save that change')),
  });
}

export function useRemoveMember(groupId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId) => api.removeMember(groupId, memberId),
    onSuccess: (member) => {
      invalidateGroup(qc, groupId);
      notify.success(`${member?.displayName ?? 'They'} left the group`);
    },
    // The 409 here is the module's most important rule -- "still owed ₹50.00, settle up first"
    // -- so the server's wording goes straight through.
    onError: (e) => notify.error(errMsg(e, 'Could not remove them')),
  });
}

export function useClaimMember(groupId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId) => api.claimMember(groupId, memberId),
    onSuccess: () => {
      invalidateGroup(qc, groupId);
      notify.success('That history is yours now');
    },
    onError: (e) => notify.error(errMsg(e, 'Could not claim that person')),
  });
}

/* ============================== expenses ============================== */

export function useCreateExpense(groupId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.createExpense(groupId, body),
    onSuccess: () => {
      invalidateGroup(qc, groupId);
      notify.success('Expense added');
    },
    onError: (e) => notify.error(errMsg(e, 'Could not save that expense')),
  });
}

export function useReplaceExpense(groupId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, body }) => api.replaceExpense(expenseId, body),
    onSuccess: () => {
      invalidateGroup(qc, groupId);
      notify.success('Expense corrected');
    },
    onError: (e) => notify.error(errMsg(e, 'Could not correct that expense')),
  });
}

export function useVoidExpense(groupId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (expenseId) => api.voidExpense(expenseId),
    onSuccess: () => {
      invalidateGroup(qc, groupId);
      notify.success('Expense removed');
    },
    onError: (e) => notify.error(errMsg(e, 'Could not remove that expense')),
  });
}

/* ============================== settlements ============================== */

export function useRecordSettlement(groupId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.recordSettlement(groupId, body),
    onSuccess: () => {
      invalidateGroup(qc, groupId);
      notify.success('Payment recorded');
    },
    onError: (e) => notify.error(errMsg(e, 'Could not record that payment')),
  });
}

export function useReverseSettlement(groupId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settlementId) => api.reverseSettlement(settlementId),
    onSuccess: () => {
      invalidateGroup(qc, groupId);
      notify.success('Payment reversed');
    },
    onError: (e) => notify.error(errMsg(e, 'Could not reverse that payment')),
  });
}
