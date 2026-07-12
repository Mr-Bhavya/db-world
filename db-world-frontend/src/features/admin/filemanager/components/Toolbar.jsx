import { useEffect, useRef, useState } from 'react';
import {
  Box, IconButton, Tooltip, Menu, MenuItem, ToggleButton, ToggleButtonGroup,
  TextField, InputAdornment, Chip, Divider,
} from '@mui/material';
import UploadIcon from '@mui/icons-material/UploadFile';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import ViewListIcon from '@mui/icons-material/ViewList';
import GridViewIcon from '@mui/icons-material/GridView';
import SortIcon from '@mui/icons-material/Sort';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@shared/theme';
import { useFileManagerStore } from '../store/useFileManagerStore';

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Size' },
  { value: 'modified', label: 'Modified' },
  { value: 'type', label: 'Type' },
];

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'folder', label: 'Folders' },
  { value: 'file', label: 'Files' },
  { value: 'image', label: 'Image' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
  { value: 'text', label: 'Text' },
  { value: 'pdf', label: 'PDF' },
  { value: 'zip', label: 'Archive' },
];

const SEARCH_DEBOUNCE_MS = 350;

/**
 * Top action bar: upload / new folder / search / filter / sort / view toggle,
 * plus a bulk-action bar that slides in once something is selected. Page-level
 * side effects (actually uploading, creating a folder, running a search, or
 * acting on the selection) are all owned by the caller via props — this
 * component only reads/writes view state (viewMode/sort/filter) directly on
 * the store.
 */
export default function Toolbar({
  onUpload, onNewFolder, onSearch,
  onDownload, onCopy, onCut, onMove, onDelete, onInfo,
}) {
  const T = useT();
  const viewMode = useFileManagerStore((s) => s.viewMode);
  const setViewMode = useFileManagerStore((s) => s.setViewMode);
  const sortBy = useFileManagerStore((s) => s.sortBy);
  const setSortBy = useFileManagerStore((s) => s.setSortBy);
  const sortOrder = useFileManagerStore((s) => s.sortOrder);
  const setSortOrder = useFileManagerStore((s) => s.setSortOrder);
  const filter = useFileManagerStore((s) => s.filter);
  const setFilter = useFileManagerStore((s) => s.setFilter);
  const selection = useFileManagerStore((s) => s.selection);
  const clearSelection = useFileManagerStore((s) => s.clearSelection);

  const fileInputRef = useRef(null);
  const [sortAnchor, setSortAnchor] = useState(null);
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [query, setQuery] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const handleQueryChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearch?.(v), SEARCH_DEBOUNCE_MS);
  };

  const clearQuery = () => {
    setQuery('');
    clearTimeout(debounceRef.current);
    onSearch?.('');
  };

  const hasSelection = selection.size > 0;

  const iconBtn = (title, Icon, onClick, color = T.textMuted) => (
    <Tooltip title={title} key={title}>
      <IconButton
        size="small"
        onClick={onClick}
        sx={{ color, '&:hover': { bgcolor: T.hoverBg, color: T.teal } }}
      >
        <Icon sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  );

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column',
      borderBottom: `1px solid ${T.border}`, bgcolor: T.adminBg,
    }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap',
        px: { xs: 1.5, md: 2 }, py: 1,
      }}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) onUpload?.(e.target.files);
            e.target.value = '';
          }}
        />
        {iconBtn('Upload', UploadIcon, () => fileInputRef.current?.click())}
        {iconBtn('New Folder', CreateNewFolderIcon, () => onNewFolder?.())}

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: T.border }} />

        <TextField
          size="small"
          placeholder="Search this location…"
          value={query}
          onChange={handleQueryChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 16, color: T.textFaint }} />
              </InputAdornment>
            ),
            endAdornment: query ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={clearQuery} sx={{ color: T.textFaint }}>
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
            sx: { fontSize: 13, height: 32, bgcolor: T.inputBg ?? T.adminBg },
          }}
          sx={{ minWidth: { xs: 140, sm: 220 }, flex: { xs: 1, md: 'none' } }}
        />

        <Box sx={{ flex: 1 }} />

        {/* Filter */}
        {iconBtn('Filter', FilterListIcon, (e) => setFilterAnchor(e.currentTarget), filter !== 'all' ? T.teal : T.textMuted)}
        <Menu
          anchorEl={filterAnchor} open={Boolean(filterAnchor)} onClose={() => setFilterAnchor(null)}
          PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.border}` } }}
        >
          {FILTER_OPTIONS.map((o) => (
            <MenuItem
              key={o.value} selected={filter === o.value}
              onClick={() => { setFilter(o.value); setFilterAnchor(null); }}
              sx={{ fontSize: 13, color: T.textPrimary, '&.Mui-selected': { bgcolor: T.tealBg, color: T.teal } }}
            >
              {o.label}
            </MenuItem>
          ))}
        </Menu>

        {/* Sort */}
        {iconBtn('Sort', SortIcon, (e) => setSortAnchor(e.currentTarget))}
        <Menu
          anchorEl={sortAnchor} open={Boolean(sortAnchor)} onClose={() => setSortAnchor(null)}
          PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.border}` } }}
        >
          {SORT_OPTIONS.map((o) => (
            <MenuItem
              key={o.value} selected={sortBy === o.value}
              onClick={() => { setSortBy(o.value); setSortAnchor(null); }}
              sx={{ fontSize: 13, color: T.textPrimary, '&.Mui-selected': { bgcolor: T.tealBg, color: T.teal } }}
            >
              {o.label}
            </MenuItem>
          ))}
          <Divider sx={{ borderColor: T.border, my: 0.5 }} />
          <MenuItem
            onClick={() => { setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); setSortAnchor(null); }}
            sx={{ fontSize: 13, color: T.textPrimary }}
          >
            {sortOrder === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
          </MenuItem>
        </Menu>

        {/* View toggle */}
        <ToggleButtonGroup
          value={viewMode} exclusive size="small"
          onChange={(_, v) => v && setViewMode(v)}
          sx={{
            '& .MuiToggleButton-root': {
              py: 0.25, px: 0.75, color: T.textMuted, borderColor: T.border,
              '&.Mui-selected': { color: T.teal, bgcolor: T.tealBg },
            },
          }}
        >
          <ToggleButton value="list"><ViewListIcon sx={{ fontSize: 16 }} /></ToggleButton>
          <ToggleButton value="grid"><GridViewIcon sx={{ fontSize: 16 }} /></ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <AnimatePresence>
        {hasSelection && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap',
              px: { xs: 1.5, md: 2 }, py: 0.75,
              borderTop: `1px solid ${T.border}`, bgcolor: T.tealBg,
            }}>
              <Chip
                label={`${selection.size} selected`} size="small" onDelete={clearSelection}
                sx={{
                  fontSize: 11, height: 22, bgcolor: T.tealBgHover, color: T.teal,
                  '& .MuiChip-deleteIcon': { color: T.teal, fontSize: 14 },
                }}
              />
              <Box sx={{ flex: 1 }} />
              {iconBtn('Download', DownloadIcon, onDownload)}
              {iconBtn('Copy', ContentCopyIcon, onCopy)}
              {iconBtn('Cut', ContentCutIcon, onCut)}
              {iconBtn('Move', DriveFileMoveIcon, onMove)}
              {iconBtn('Info', InfoOutlinedIcon, onInfo)}
              {iconBtn('Delete', DeleteIcon, onDelete, T.error)}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}
