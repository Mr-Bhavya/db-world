/**
 * Module-scope carrier for the items being dragged in a desktop HTML5
 * drag-and-drop gesture. The browser's `DataTransfer` can only reliably carry
 * strings, but drop targets (folder cards/rows, tree nodes) need the actual
 * `FileItemDto` objects being moved — so the drag source stashes them here on
 * `dragstart` and every drop target reads them back on `drop`.
 */
let draggedItems = [];

export function setDragItems(items) {
  draggedItems = Array.isArray(items) ? items : [];
}

export function getDragItems() {
  return draggedItems;
}

export function clearDragItems() {
  draggedItems = [];
}
