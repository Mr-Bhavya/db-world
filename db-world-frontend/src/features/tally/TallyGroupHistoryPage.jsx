import { useParams } from 'react-router-dom';
import { useConfirm } from 'material-ui-confirm';
import { useActivity, useRestoreExpense } from './hooks/useTally';
import GroupHistoryView from './components/GroupHistoryView';

/**
 * A group's change log, as one of its three tabs.
 *
 * <p>This was a dialog opened from the overflow menu. A full audit trail is something you read,
 * and reading a long list inside a modal that sits on a page which also scrolls is the worst of
 * both.
 *
 * <p>Only the log. The header, the balance and the tab bar belong to TallyGroupShell and stay
 * mounted across tab changes, so arriving here swaps the column and nothing else.
 */
export default function TallyGroupHistoryTab() {
  const { groupId } = useParams();
  const confirm = useConfirm();

  // Always enabled here, unlike the sheet it replaces: the history IS the tab, so there is
  // nothing to opt into.
  const { data: history, isFetching } = useActivity(groupId, true);
  const restore = useRestoreExpense(groupId);

  const onRestore = (entry) => {
    const put = () => restore.mutate(entry.subjectId);
    if (!entry.restoreWarning) { put(); return; }
    confirm({
      title: 'Put this back?',
      description: entry.restoreWarning,
      confirmationText: 'Put it back anyway',
      cancellationText: 'Leave it removed',
    }).then(put).catch(() => {});
  };

  return (
    <GroupHistoryView
      entries={history?.items ?? []}
      loading={isFetching && !history}
      restoring={restore.isPending}
      onRestore={onRestore}
    />
  );
}
