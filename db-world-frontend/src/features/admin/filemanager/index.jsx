import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { Capacitor } from '@capacitor/core';
import { useT } from '@shared/theme';

import { useFileManagerStore } from './store/useFileManagerStore';
import { useLocations } from './hooks/useLocations';
import { useDirectory } from './hooks/useDirectory';
import { useInvalidateFm } from './hooks/useInvalidateFm';
import { useUploadManager } from './upload/useUploadManager';
import * as fmApi from './api/fileManagerApi';

import LocationsRail from './components/LocationsRail';
import Breadcrumb from './components/Breadcrumb';
import Toolbar from './components/Toolbar';
import FileGrid from './components/FileGrid';
import FileList from './components/FileList';
import FileMobileList from './components/FileMobileList';
import ContextMenu from './components/ContextMenu';
import InfoDrawer from './components/InfoDrawer';
import NewFolderDialog from './components/NewFolderDialog';
import RenameDialog from './components/RenameDialog';
import MoveCopyDialog from './components/MoveCopyDialog';
import LocationManagerDialog from './components/LocationManagerDialog';
import ConfirmDialog from './components/ConfirmDialog';
import UploadTray from './components/UploadTray';
import PreviewPanel from './components/PreviewPanel';

/* ─── Client-side type filter (Toolbar's Filter menu) ───────────────────── */

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico']);
const AUDIO_EXT = new Set(['mp3', 'flac', 'aac', 'wav', 'ogg', 'm4a']);
const VIDEO_EXT = new Set(['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv']);
const TEXT_EXT = new Set([
  'txt', 'md', 'log', 'json', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'go', 'rs',
  'c', 'cpp', 'h', 'cs', 'rb', 'php', 'sh', 'yml', 'yaml', 'xml', 'html', 'css', 'sql',
]);
const ZIP_EXT = new Set(['zip', 'tar', 'gz', 'rar', '7z']);

function matchesFilter(item, filter) {
  if (filter === 'all') return true;
  if (filter === 'folder') return item.directory;
  if (filter === 'file') return !item.directory;
  if (item.directory) return false;
  const mime = item.mimeType || '';
  const ext = (item.extension || '').toLowerCase();
  switch (filter) {
    case 'image': return mime.startsWith('image/') || IMAGE_EXT.has(ext);
    case 'audio': return mime.startsWith('audio/') || AUDIO_EXT.has(ext);
    case 'video': return mime.startsWith('video/') || VIDEO_EXT.has(ext);
    case 'pdf': return mime === 'application/pdf' || ext === 'pdf';
    case 'text': return mime.startsWith('text/') || TEXT_EXT.has(ext);
    case 'zip': return ZIP_EXT.has(ext);
    default: return true;
  }
}

/**
 * Admin File Manager — composes the rail/tree, breadcrumb, toolbar, grid/list/
 * mobile views, context menu, info drawer, upload tray, preview panel, and the
 * four action dialogs (new folder / rename / move-copy / manage locations)
 * into one page, and owns every handler that isn't a dialog's own mutation.
 *
 * Action-resolution contract: most handlers accept an optional `arg` that can
 * be (a) a single `FileItemDto` (row action / context-menu single-item), (b)
 * an array of path strings (context-menu bulk action, from
 * `Array.from(selection)`), or (c) nothing at all — the Toolbar's bulk-action
 * buttons invoke handlers with the raw click event, which is *not* a
 * FileItemDto, so it's treated the same as "no arg". `resolveItems` below
 * normalizes all three into an array of item objects drawn from the current
 * (unfiltered) listing, always falling back to the live `selection` set.
 *
 * Copy/Move/Cut split: `Move` and `Copy` (Toolbar bulk bar + ContextMenu) both
 * open the shared `MoveCopyDialog` folder-tree picker (mode 'move'/'copy') for
 * an immediate, explicit-destination operation — that's what the dialog
 * component exists for. `Cut` (mouse) and the `Ctrl/Cmd+C` keyboard shortcut
 * instead populate the store's clipboard for a later `Ctrl/Cmd+V` paste into
 * whatever folder you've navigated to — there is no mouse "paste" affordance
 * in this build (Toolbar/ContextMenu expose no such action), so clipboard
 * paste is keyboard-only by design.
 */
export default function FileManager() {
  const T = useT();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { enqueueSnackbar } = useSnackbar();
  const { invalidateDir } = useInvalidateFm();
  const uploadManager = useUploadManager();

  const { data: locations = [], isLoading: locationsLoading } = useLocations();

  const locationId = useFileManagerStore((s) => s.locationId);
  const path = useFileManagerStore((s) => s.path);
  const setLocation = useFileManagerStore((s) => s.setLocation);
  const navigate = useFileManagerStore((s) => s.navigate);

  const viewMode = useFileManagerStore((s) => s.viewMode);
  const sortBy = useFileManagerStore((s) => s.sortBy);
  const sortOrder = useFileManagerStore((s) => s.sortOrder);
  const filter = useFileManagerStore((s) => s.filter);

  const selection = useFileManagerStore((s) => s.selection);
  const selectAll = useFileManagerStore((s) => s.selectAll);
  const clearSelection = useFileManagerStore((s) => s.clearSelection);

  const clipboard = useFileManagerStore((s) => s.clipboard);
  const setClipboard = useFileManagerStore((s) => s.setClipboard);
  const clearClipboard = useFileManagerStore((s) => s.clearClipboard);

  const newFolderOpen = useFileManagerStore((s) => s.newFolderOpen);
  const setNewFolderOpen = useFileManagerStore((s) => s.setNewFolderOpen);
  const renameTarget = useFileManagerStore((s) => s.renameTarget);
  const openRename = useFileManagerStore((s) => s.openRename);
  const closeRename = useFileManagerStore((s) => s.closeRename);
  const moveCopyMode = useFileManagerStore((s) => s.moveCopyMode);
  const openMoveCopy = useFileManagerStore((s) => s.openMoveCopy);
  const closeMoveCopy = useFileManagerStore((s) => s.closeMoveCopy);
  const locationManagerOpen = useFileManagerStore((s) => s.locationManagerOpen);
  const setLocationManagerOpen = useFileManagerStore((s) => s.setLocationManagerOpen);
  const infoItem = useFileManagerStore((s) => s.infoItem);
  const openInfo = useFileManagerStore((s) => s.openInfo);
  const closeInfo = useFileManagerStore((s) => s.closeInfo);
  const previewItem = useFileManagerStore((s) => s.previewItem);
  const openPreview = useFileManagerStore((s) => s.openPreview);
  const closePreview = useFileManagerStore((s) => s.closePreview);

  const [moveCopyItems, setMoveCopyItems] = useState([]);
  const [contextMenu, setContextMenu] = useState(null); // { mouseX, mouseY, item } | null
  const [confirmDelete, setConfirmDelete] = useState({ open: false, items: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Default to the first configured location once locations have loaded.
  useEffect(() => {
    if (!locationsLoading && !locationId && locations.length > 0) {
      setLocation(locations[0].id);
    }
  }, [locationsLoading, locationId, locations, setLocation]);

  /* ─── Directory / search data ────────────────────────────────────────── */

  const {
    data: dirData, isLoading: dirLoading, isError: dirIsError, error: dirError, refetch: refetchDir,
  } = useDirectory(locationId, path, sortBy, sortOrder);

  const searchActive = searchQuery.trim().length > 0;

  const {
    data: searchResults, isLoading: searchLoading, isError: searchIsError, error: searchError,
  } = useQuery({
    queryKey: ['file-manager', 'search', locationId, path, searchQuery],
    queryFn: () => fmApi.searchFiles({ locationId, q: searchQuery, path, recursive: true }),
    enabled: Boolean(locationId && searchActive),
    staleTime: 10_000,
  });

  const rawItems = useMemo(
    () => (searchActive ? (searchResults ?? []) : (dirData?.items ?? [])),
    [searchActive, searchResults, dirData]
  );
  const items = useMemo(() => rawItems.filter((i) => matchesFilter(i, filter)), [rawItems, filter]);
  const isLoadingContent = searchActive ? searchLoading : dirLoading;
  const contentIsError = searchActive ? searchIsError : dirIsError;
  const contentError = searchActive ? searchError : dirError;

  /* ─── Selection/target resolution ───────────────────────────────────── */

  /**
   * Normalizes a handler's `arg` into an array of item objects: a real
   * FileItemDto (has a string `.path`) passes through as `[arg]`; an array is
   * treated as selected path strings (ContextMenu's multi-select target);
   * a string is a single path; anything else (undefined, or the raw
   * MouseEvent the Toolbar's bulk buttons invoke handlers with) falls back to
   * the live selection.
   */
  const resolveItems = useCallback((arg) => {
    if (Array.isArray(arg)) {
      return rawItems.filter((i) => arg.includes(i.path));
    }
    if (typeof arg === 'string') {
      const found = rawItems.find((i) => i.path === arg);
      return found ? [found] : [];
    }
    if (arg && typeof arg.path === 'string') {
      return [arg];
    }
    return rawItems.filter((i) => selection.has(i.path));
  }, [rawItems, selection]);

  /* ─── Open / preview / navigate ──────────────────────────────────────── */

  const handleOpen = useCallback((item) => {
    if (!item) return;
    if (item.directory) navigate(item.path);
    else openPreview(item);
  }, [navigate, openPreview]);

  const handleContextMenu = useCallback((event, item) => {
    setContextMenu({ mouseX: event.clientX - 2, mouseY: event.clientY - 4, item });
  }, []);

  /* ─── Info (Toolbar bulk falls back to the first selected item) ────────── */

  const handleInfo = useCallback((arg) => {
    if (arg && typeof arg.path === 'string') {
      openInfo(arg);
      return;
    }
    const targets = resolveItems(arg);
    if (targets.length > 0) openInfo(targets[0]);
  }, [openInfo, resolveItems]);

  /* ─── Move / Copy (dialog, folder-tree destination picker) ─────────────── */

  const openMoveCopyDialog = useCallback((mode, arg) => {
    const targets = resolveItems(arg);
    if (targets.length === 0) return;
    setMoveCopyItems(targets);
    openMoveCopy(mode);
  }, [resolveItems, openMoveCopy]);

  const handleMove = useCallback((arg) => openMoveCopyDialog('move', arg), [openMoveCopyDialog]);
  const handleCopyDialog = useCallback((arg) => openMoveCopyDialog('copy', arg), [openMoveCopyDialog]);

  /* ─── Cut / Copy (clipboard) + Paste ─────────────────────────────────── */

  const handleCutToClipboard = useCallback((arg) => {
    const targets = resolveItems(arg);
    if (targets.length === 0) return;
    setClipboard('cut', targets);
    enqueueSnackbar(`${targets.length} item${targets.length === 1 ? '' : 's'} cut — paste with Ctrl/Cmd+V`, { variant: 'success' });
  }, [resolveItems, setClipboard, enqueueSnackbar]);

  const handleCopyToClipboard = useCallback((arg) => {
    const targets = resolveItems(arg);
    if (targets.length === 0) return;
    setClipboard('copy', targets);
    enqueueSnackbar(`${targets.length} item${targets.length === 1 ? '' : 's'} copied — paste with Ctrl/Cmd+V`, { variant: 'success' });
  }, [resolveItems, setClipboard, enqueueSnackbar]);

  const handlePaste = useCallback(async () => {
    if (!clipboard || !locationId) return;
    const { mode, items: clipItems } = clipboard;
    const op = mode === 'copy' ? fmApi.copyItem : fmApi.moveItem;
    const results = await Promise.allSettled(
      clipItems.map((item) => op({ locationId: item.locationId, sourcePath: item.path, destinationPath: path }))
    );
    invalidateDir(locationId);
    clearClipboard();
    const failed = results.filter((r) => r.status === 'rejected');
    const verb = mode === 'copy' ? 'Copied' : 'Moved';
    if (failed.length === 0) {
      enqueueSnackbar(`${verb} ${clipItems.length} item${clipItems.length === 1 ? '' : 's'}`, { variant: 'success' });
    } else if (failed.length === clipItems.length) {
      enqueueSnackbar(failed[0].reason?.response?.data?.message ?? `Failed to paste item${clipItems.length === 1 ? '' : 's'}`, { variant: 'error' });
    } else {
      enqueueSnackbar(`${verb} ${clipItems.length - failed.length}/${clipItems.length} — some failed`, { variant: 'warning' });
    }
  }, [clipboard, locationId, path, invalidateDir, clearClipboard, enqueueSnackbar]);

  /* ─── Drag selected items onto a FolderTree node (internal move) ───────── */

  const handleDropOnFolder = useCallback(async (destPath) => {
    const targets = rawItems.filter((i) => selection.has(i.path));
    if (targets.length === 0 || !locationId) return;
    const results = await Promise.allSettled(
      targets.map((item) => fmApi.moveItem({ locationId, sourcePath: item.path, destinationPath: destPath }))
    );
    invalidateDir(locationId);
    clearSelection();
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length === 0) {
      enqueueSnackbar(`Moved ${targets.length} item${targets.length === 1 ? '' : 's'}`, { variant: 'success' });
    } else {
      enqueueSnackbar(
        `Moved ${targets.length - failed.length}/${targets.length} — some failed`,
        { variant: failed.length === targets.length ? 'error' : 'warning' }
      );
    }
  }, [rawItems, selection, locationId, invalidateDir, clearSelection, enqueueSnackbar]);

  /* ─── Delete (routed through the themed ConfirmDialog) ─────────────────── */

  const handleDeleteRequest = useCallback((arg) => {
    const targets = resolveItems(arg);
    if (targets.length === 0) return;
    setConfirmDelete({ open: true, items: targets });
  }, [resolveItems]);

  const handleConfirmDelete = useCallback(async () => {
    const targets = confirmDelete.items;
    setConfirmDelete({ open: false, items: [] });
    const results = await Promise.allSettled(
      targets.map((item) => fmApi.deleteItem({ locationId: item.locationId, path: item.path }))
    );
    invalidateDir(locationId);
    clearSelection();
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length === 0) {
      enqueueSnackbar(`Deleted ${targets.length} item${targets.length === 1 ? '' : 's'}`, { variant: 'success' });
    } else if (failed.length === targets.length) {
      enqueueSnackbar(failed[0].reason?.response?.data?.message ?? 'Delete failed', { variant: 'error' });
    } else {
      enqueueSnackbar(`Deleted ${targets.length - failed.length}/${targets.length} — some failed`, { variant: 'warning' });
    }
  }, [confirmDelete, invalidateDir, locationId, clearSelection, enqueueSnackbar]);

  /* ─── Download (web: anchor to the ticket stream; Android: fetch+native) ── */

  const handleDownload = useCallback(async (arg) => {
    const targets = resolveItems(arg);
    const files = targets.filter((i) => !i.directory);
    if (files.length === 0) {
      if (targets.length > 0) enqueueSnackbar('Cannot download a folder', { variant: 'warning' });
      return;
    }
    const isNative = Capacitor.isNativePlatform();
    for (const item of files) {
      try {
        const url = await fmApi.downloadTicketUrl({ locationId: item.locationId, path: item.path });
        if (isNative) {
          const blob = await fetch(url).then((r) => r.blob());
          const { saveBlobNative } = await import('@platform/android/walletDownload');
          await saveBlobNative(blob, item.name);
          enqueueSnackbar(`${item.name} saved to Documents`, { variant: 'success' });
        } else {
          const a = document.createElement('a');
          a.href = url;
          a.download = item.name;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      } catch (e) {
        enqueueSnackbar(e?.response?.data?.message ?? `Failed to download ${item.name}`, { variant: 'error' });
      }
    }
  }, [resolveItems, enqueueSnackbar]);

  /* ─── Upload (Toolbar button + OS drag-drop over the content area) ─────── */

  const handleUpload = useCallback((fileList) => {
    if (!locationId || !fileList?.length) return;
    uploadManager.startUploads(fileList, { locationId, path });
  }, [uploadManager, locationId, path]);

  /* ─── Esc: close whatever's open, innermost first ───────────────────────── */

  const handleEscape = useCallback(() => {
    if (contextMenu) { setContextMenu(null); return; }
    if (previewItem) { closePreview(); return; }
    if (infoItem) { closeInfo(); return; }
    if (moveCopyMode) { closeMoveCopy(); return; }
    if (renameTarget) { closeRename(); return; }
    if (newFolderOpen) { setNewFolderOpen(false); return; }
    if (locationManagerOpen) { setLocationManagerOpen(false); return; }
    if (confirmDelete.open) { setConfirmDelete({ open: false, items: [] }); return; }
    clearSelection();
  }, [
    contextMenu, previewItem, closePreview, infoItem, closeInfo, moveCopyMode, closeMoveCopy,
    renameTarget, closeRename, newFolderOpen, setNewFolderOpen, locationManagerOpen,
    setLocationManagerOpen, confirmDelete, clearSelection,
  ]);

  /* ─── Keyboard shortcuts (desktop only) ─────────────────────────────────── */

  useEffect(() => {
    if (isMobile) return undefined;

    const handleKeyDown = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;

      const mod = e.ctrlKey || e.metaKey;

      if (e.key === 'F2') {
        e.preventDefault();
        const targets = resolveItems();
        if (targets.length === 1) openRename(targets[0]);
        return;
      }
      if (e.key === 'Delete') {
        e.preventDefault();
        handleDeleteRequest();
        return;
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAll(items);
        return;
      }
      if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopyToClipboard();
        return;
      }
      if (mod && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        handleCutToClipboard();
        return;
      }
      if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePaste();
        return;
      }
      if (e.key === 'Enter') {
        const targets = resolveItems();
        if (targets.length === 1) handleOpen(targets[0]);
        return;
      }
      if (e.key === 'Escape') {
        handleEscape();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isMobile, resolveItems, items, selectAll, openRename, handleDeleteRequest,
    handleCopyToClipboard, handleCutToClipboard, handlePaste, handleOpen, handleEscape,
  ]);

  /* ─── Render ─────────────────────────────────────────────────────────── */

  const dropZoneSx = {
    flex: 1, overflow: 'auto', minHeight: 0, position: 'relative',
    outline: dragActive ? `2px dashed ${T.teal}` : 'none', outlineOffset: -4,
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (locationId) setDragActive(true);
  };
  const handleDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragActive(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (!locationId) return;
    handleUpload(e.dataTransfer?.files);
  };

  let mainColumn;
  if (locationsLoading) {
    mainColumn = (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={28} sx={{ color: T.teal }} />
      </Box>
    );
  } else if (!locationId) {
    mainColumn = (
      <Box sx={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 1.5, p: 4,
      }}>
        <Typography sx={{ fontSize: 14, color: T.textMuted, textAlign: 'center' }}>
          No file locations are configured yet.
        </Typography>
        <Button
          variant="contained"
          onClick={() => setLocationManagerOpen(true)}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}
        >
          Add a Location
        </Button>
      </Box>
    );
  } else {
    mainColumn = (
      <>
        <Breadcrumb />
        <Toolbar
          onUpload={handleUpload}
          onNewFolder={() => setNewFolderOpen(true)}
          onSearch={setSearchQuery}
          onDownload={handleDownload}
          onCopy={handleCopyDialog}
          onCut={handleCutToClipboard}
          onMove={handleMove}
          onDelete={handleDeleteRequest}
          onInfo={handleInfo}
        />

        {contentIsError && (
          <Box sx={{ px: 2, py: 1.5 }}>
            <Box sx={{
              bgcolor: T.errorBg, border: `1px solid ${T.error}44`, borderRadius: 2, p: 1.5,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1,
            }}>
              <Typography sx={{ color: T.error, fontSize: 12.5 }}>
                Failed to load — {contentError?.response?.data?.message ?? contentError?.message ?? 'unknown error'}
              </Typography>
              {!searchActive && (
                <Button size="small" onClick={refetchDir} sx={{ color: T.error, fontSize: 12 }}>Retry</Button>
              )}
            </Box>
          </Box>
        )}

        <Box
          sx={dropZoneSx}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isMobile ? (
            <FileMobileList items={items} isLoading={isLoadingContent} onOpen={handleOpen} onContextMenu={handleContextMenu} />
          ) : viewMode === 'grid' ? (
            <FileGrid items={items} isLoading={isLoadingContent} onOpen={handleOpen} onContextMenu={handleContextMenu} />
          ) : (
            <FileList
              items={items}
              isLoading={isLoadingContent}
              onOpen={handleOpen}
              onContextMenu={handleContextMenu}
              onDownload={handleDownload}
              onRename={openRename}
              onInfo={handleInfo}
              onDelete={handleDeleteRequest}
            />
          )}
        </Box>
      </>
    );
  }

  return (
    <Box sx={{
      height: '100%', display: 'flex', flexDirection: isMobile ? 'column' : 'row',
      bgcolor: T.adminBg, color: T.textPrimary, minHeight: 0, overflow: 'hidden',
    }}>
      <LocationsRail onManageLocations={() => setLocationManagerOpen(true)} onDropItems={handleDropOnFolder} />

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {mainColumn}
      </Box>

      <ContextMenu
        contextState={contextMenu}
        onClose={() => setContextMenu(null)}
        onOpen={handleOpen}
        onDownload={handleDownload}
        onRename={openRename}
        onMove={handleMove}
        onCopy={handleCopyDialog}
        onCut={handleCutToClipboard}
        onInfo={handleInfo}
        onDelete={handleDeleteRequest}
      />

      <InfoDrawer
        open={Boolean(infoItem)}
        item={infoItem}
        onClose={closeInfo}
        onDownload={handleDownload}
        onRename={openRename}
        onDelete={handleDeleteRequest}
      />

      <PreviewPanel
        open={Boolean(previewItem)}
        item={previewItem}
        items={items}
        onClose={closePreview}
        onNavigate={openPreview}
      />

      <NewFolderDialog
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        locationId={locationId}
        path={path}
      />

      <RenameDialog open={Boolean(renameTarget)} onClose={closeRename} item={renameTarget} />

      <MoveCopyDialog
        open={moveCopyMode !== null}
        onClose={closeMoveCopy}
        mode={moveCopyMode}
        items={moveCopyItems}
        locationId={locationId}
      />

      <LocationManagerDialog open={locationManagerOpen} onClose={() => setLocationManagerOpen(false)} />

      <ConfirmDialog
        open={confirmDelete.open}
        title={confirmDelete.items.length > 1 ? `Delete ${confirmDelete.items.length} items` : `Delete "${confirmDelete.items[0]?.name ?? ''}"`}
        message={`This will permanently delete ${confirmDelete.items.length > 1 ? 'these items' : 'this item'}${confirmDelete.items.some((i) => i.directory) ? ' and all their contents' : ''}. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleConfirmDelete}
        onClose={() => setConfirmDelete({ open: false, items: [] })}
      />

      <UploadTray
        onPause={uploadManager.pause}
        onResume={uploadManager.resume}
        onCancel={uploadManager.cancel}
        onRetry={uploadManager.retry}
      />
    </Box>
  );
}
