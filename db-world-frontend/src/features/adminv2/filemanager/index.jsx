import { useMemo, useCallback } from 'react';
import { Box, Typography, Button, useMediaQuery, useTheme } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';
import { listDirectory, deleteItem, moveItem, copyItem } from './fileManagerApi';
import FileBreadcrumb from './FileBreadcrumb';
import FileToolbar from './FileToolbar';
import FileList from './FileList';
import FileGrid from './FileGrid';
import FileMobileList from './FileMobileList';
import FileInfoDrawer from './FileInfoDrawer';
import UploadDialog from './UploadDialog';
import FileOperationDialog from './FileOperationDialog';
import SearchDialog from './SearchDialog';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export default function FileManager() {
  const T = useT();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const {
    currentPath, navigate, navigateUp,
    viewMode, sortBy, sortOrder, filterType,
    clipboard, clearClipboard, clearSelection,
    selectedItems,
  } = useFileManagerStore();

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['file-manager', currentPath, sortBy, sortOrder],
    queryFn:  () => listDirectory({ path: currentPath, sortBy, order: sortOrder }),
    staleTime: 30_000,
  });

  // ── Client-side filter (type) ─────────────────────────────────────────────

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    if (filterType === 'ALL')    return items;
    if (filterType === 'FOLDER') return items.filter(i => i.directory);
    if (filterType === 'FILE')   return items.filter(i => !i.directory);
    return items.filter(i => !i.directory && i.extension?.toLowerCase() === filterType.toLowerCase());
  }, [data?.items, filterType]);

  // ── Delete ────────────────────────────────────────────────────────────────

  const { mutate: doDelete } = useMutation({
    mutationFn: (item) => deleteItem(item.path),
    onSuccess: (_, item) => {
      qc.invalidateQueries({ queryKey: ['file-manager', currentPath] });
      enqueueSnackbar(`Deleted "${item.name}"`, { variant: 'success' });
      clearSelection();
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Delete failed', { variant: 'error' }),
  });

  const handleDelete = useCallback((item) => {
    if (window.confirm(`Delete "${item.name}"${item.directory ? ' and all its contents' : ''}?`)) {
      doDelete(item);
    }
  }, [doDelete]);

  // Bulk delete
  const handleDeleteSelected = useCallback(() => {
    const paths = Array.from(selectedItems);
    if (paths.length === 0) return;
    if (!window.confirm(`Delete ${paths.length} item(s)?`)) return;
    const items = (data?.items ?? []).filter(i => paths.includes(i.path));
    items.forEach(item => doDelete(item));
  }, [selectedItems, data?.items, doDelete]);

  // ── Paste ─────────────────────────────────────────────────────────────────

  const handlePaste = useCallback(async () => {
    if (!clipboard) return;
    const fn = clipboard.operation === 'cut' ? moveItem : copyItem;
    try {
      await Promise.all(clipboard.items.map(item => fn(item.path, currentPath)));
      qc.invalidateQueries({ queryKey: ['file-manager', currentPath] });
      enqueueSnackbar(`${clipboard.operation === 'cut' ? 'Moved' : 'Copied'} ${clipboard.items.length} item(s)`, { variant: 'success' });
      clearClipboard();
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.message ?? 'Paste failed', { variant: 'error' });
    }
  }, [clipboard, currentPath, qc, enqueueSnackbar, clearClipboard]);

  // ── Navigate ──────────────────────────────────────────────────────────────

  const handleNavigate = useCallback((path) => navigate(path), [navigate]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: T.adminBg, color: T.textPrimary, minHeight: 0 }}>

      {/* Page header */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 }, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: { xs: 18, md: 22 }, color: T.textPrimary }}>
            File Manager
          </Typography>
          <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.25 }}>
            {data ? `${data.totalItems} items${data.totalSize > 0 ? ` · ${formatBytes(data.totalSize)}` : ''}` : 'Browse server files'}
          </Typography>
        </Box>
        {data?.parentPath != null && (
          <Button
            startIcon={<ArrowUpwardIcon />}
            size="small"
            onClick={() => navigateUp(data.parentPath)}
            sx={{ color: T.textMuted, fontSize: 12, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}
          >
            Up
          </Button>
        )}
      </Box>

      {/* Breadcrumb */}
      <Box sx={{ px: { xs: 1, md: 2 }, flexShrink: 0 }}>
        <FileBreadcrumb />
      </Box>

      {/* Toolbar */}
      <FileToolbar
        allItems={data?.items ?? []}
        onPaste={handlePaste}
        onDeleteSelected={handleDeleteSelected}
      />

      {/* Error */}
      {error && (
        <Box sx={{ p: 2 }}>
          <Box sx={{ bgcolor: T.errorBg ?? '#ef444414', border: `1px solid ${T.error ?? '#ef4444'}44`, borderRadius: 2, p: 2,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ color: T.error ?? '#ef4444', fontSize: 13 }}>
              Failed to load directory — {error?.response?.data?.message ?? error.message}
            </Typography>
            <Button size="small" onClick={refetch} sx={{ color: T.error ?? '#ef4444' }}>Retry</Button>
          </Box>
        </Box>
      )}

      {/* Main content */}
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {isMobile ? (
          <FileMobileList items={filtered} loading={isLoading} onDelete={handleDelete} onNavigate={handleNavigate} />
        ) : viewMode === 'grid' ? (
          <FileGrid items={filtered} loading={isLoading} onDelete={handleDelete} onNavigate={handleNavigate} />
        ) : (
          <FileList items={filtered} loading={isLoading} onDelete={handleDelete} onNavigate={handleNavigate} />
        )}
      </Box>

      {/* Drawers & Dialogs */}
      <FileInfoDrawer onDelete={handleDelete} />
      <UploadDialog />
      <FileOperationDialog />
      <SearchDialog />
    </Box>
  );
}
