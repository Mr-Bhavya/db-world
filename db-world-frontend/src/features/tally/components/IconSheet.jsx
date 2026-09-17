import { useMemo } from 'react';
import { GROUP_ICON_GROUPS } from '../utils/tallyFormat';
import PickerSheet from './PickerSheet';

/**
 * The icon a ledger wears.
 *
 * <p>Not clearable: every ledger shows an icon somewhere — the list, the header, the pinned bar —
 * so "none" is not a state the rest of the app can render. The server picks one from the group's
 * name when you do not, and this sheet is for disagreeing with it.
 */
export default function IconSheet({ open, value, onClose, onPick }) {
  const groups = useMemo(() => GROUP_ICON_GROUPS.map((group) => ({
    label: group.label,
    items: group.items.map((item) => ({
      key: item.emoji, emoji: item.emoji, label: item.name,
    })),
  })), []);

  return (
    <PickerSheet
      open={open}
      title="Pick an icon"
      subtitle="Search by what it is — “temple”, “train”, “cricket”"
      groups={groups}
      value={value}
      clearable={false}
      onClose={onClose}
      onPick={onPick}
    />
  );
}
