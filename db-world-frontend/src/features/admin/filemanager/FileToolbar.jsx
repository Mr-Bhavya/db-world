import {
  Box, Tooltip, IconButton, Select, MenuItem,
  ToggleButton, ToggleButtonGroup, Typography, Chip,
} from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import SearchIcon from '@mui/icons-material/Search';
import ViewListIcon from '@mui/icons-material/ViewList';
import GridViewIcon from '@mui/icons-material/GridView';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import DeleteIcon from '@mui/icons-material/Delete';
import SortIcon from '@mui/icons-material/Sort';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';

const SORT_OPTIONS = [
  { value: 'name',     label: 'Name' },
  { value: 'size',     label: 'Size' },
  { value: 'modified', label: 'Modified' },
  { value: 'type',     label: 'Type' },
];

const FILTER_OPTIONS = [
  { value: 'ALL',    label: 'All' },
  { value: 'FOLDER', label: 'Folders' },
  { value: 'FILE',   label: 'Files' },
  { value: 'video',  label: 'Video' },
  { value: 'audio',  label: 'Audio' },
  { value: 'image',  label: 'Image' },
  { value: 'text',   label: 'Text' },
  { value: 'pdf',    label: 'PDF' },
  { value: 'zip',    label: 'Archive' },
];

export default function FileToolbar({ onPaste, onDeleteSelected, allItems = [] }) {
  const T = useT();
  const {
    viewMode, setViewMode,
    sortBy, setSortBy, sortOrder, setSortOrder,
    filterType, setFilterType,
    selectedItems, selectAll, clearSelection,
    clipboard,
    setClipboard,
    setUploadOpen, setSearchOpen, openOperation,
  } = useFileManagerStore();

  const hasSelection = selectedItems.size > 0;

  const iconBtn = (title, Icon, onClick, color = T.textMuted) => (
    <Tooltip title={title} key={title}>
      <IconButton size="small" onClick={onClick}
        sx={{ color, '&:hover': { bgcolor: T.hoverBg, color: T.teal } }}>
        <Icon sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  );

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
      px: { xs: 1.5, md: 2 }, py: 1,
      borderBottom: `1px solid ${T.border}`,
      bgcolor: T.adminBg,
    }}>
      {/* Primary actions */}
      {iconBtn('Upload Files', UploadIcon, () => setUploadOpen(true))}
      {iconBtn('New Folder', CreateNewFolderIcon, () => openOperation('mkdir'))}
      {iconBtn('Search', SearchIcon, () => setSearchOpen(true))}

      <Box sx={{ width: 1, bgcolor: T.border, height: 18, mx: 0.5 }} />

      {/* Clipboard actions */}
      {hasSelection && iconBtn('Cut', ContentCutIcon, () => {
        const items = allItems.filter(i => selectedItems.has(i.path));
        setClipboard(items, 'cut');
      })}
      {hasSelection && iconBtn('Copy', ContentCopyIcon, () => {
        const items = allItems.filter(i => selectedItems.has(i.path));
        setClipboard(items, 'copy');
      })}
      {clipboard && iconBtn('Paste', ContentPasteIcon, onPaste, T.teal)}
      {hasSelection && iconBtn('Delete Selected', DeleteIcon, onDeleteSelected, T.error ?? '#ef4444')}

      {hasSelection && (
        <Chip
          label={`${selectedItems.size} selected`}
          size="small"
          onDelete={clearSelection}
          sx={{ fontSize: 11, height: 22, bgcolor: T.tealBg, color: T.teal,
            '& .MuiChip-deleteIcon': { color: T.teal, fontSize: 14 } }}
        />
      )}

      <Box sx={{ flex: 1 }} />

      {/* Filter */}
      <Select
        size="small"
        value={filterType}
        onChange={e => setFilterType(e.target.value)}
        sx={{
          fontSize: 12, height: 30, minWidth: 90,
          color: T.textMuted, '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
          '& .MuiSvgIcon-root': { color: T.textMuted },
          bgcolor: T.inputBg ?? T.adminBg,
        }}
      >
        {FILTER_OPTIONS.map(o => (
          <MenuItem key={o.value} value={o.value} sx={{ fontSize: 12 }}>{o.label}</MenuItem>
        ))}
      </Select>

      {/* Sort */}
      <Select
        size="small"
        value={sortBy}
        onChange={e => setSortBy(e.target.value)}
        startAdornment={<SortIcon sx={{ fontSize: 14, mr: 0.5, color: T.textFaint }} />}
        sx={{
          fontSize: 12, height: 30, minWidth: 110,
          color: T.textMuted, '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
          '& .MuiSvgIcon-root': { color: T.textMuted },
          bgcolor: T.inputBg ?? T.adminBg,
        }}
      >
        {SORT_OPTIONS.map(o => (
          <MenuItem key={o.value} value={o.value} sx={{ fontSize: 12 }}>{o.label}</MenuItem>
        ))}
      </Select>

      {/* Sort order toggle */}
      <Tooltip title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}>
        <IconButton size="small" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          sx={{ color: T.textMuted, '&:hover': { color: T.teal } }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>
            {sortOrder === 'asc' ? 'A↑' : 'Z↓'}
          </Typography>
        </IconButton>
      </Tooltip>

      {/* View toggle */}
      <ToggleButtonGroup
        value={viewMode}
        exclusive
        onChange={(_, v) => v && setViewMode(v)}
        size="small"
        sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 0.75, color: T.textMuted, borderColor: T.border } }}
      >
        <ToggleButton value="list"><ViewListIcon sx={{ fontSize: 16 }} /></ToggleButton>
        <ToggleButton value="grid"><GridViewIcon sx={{ fontSize: 16 }} /></ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
