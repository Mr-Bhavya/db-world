import { useMemo } from 'react';
import { CATEGORY_GROUPS } from '../utils/tallyFormat';
import PickerSheet from './PickerSheet';

/**
 * All thirty-one expense categories, as a grid you can look at.
 *
 * <p>The sheet itself is {@link PickerSheet}; this only says what goes in it. A category is
 * stored as its own name, so the key and the label are the same string.
 */
export default function CategorySheet({ open, value, onClose, onPick }) {
  const groups = useMemo(() => CATEGORY_GROUPS.map((group) => ({
    label: group.label,
    items: group.items.map((item) => ({
      key: item.value, emoji: item.emoji, label: item.value,
    })),
  })), []);

  return (
    <PickerSheet
      open={open}
      title="Pick a category"
      subtitle="Or clear it — a category is optional"
      groups={groups}
      value={value}
      onClose={onClose}
      onPick={onPick}
    />
  );
}
