import {
  Dialog, DialogTitle, DialogContent, Box, TextField,
  Typography, IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  FormControlLabel, Switch,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';
import { searchFiles } from './fileManagerApi';
import { getFileColor } from './fileIcons';

// Inline debounce hook
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function SearchDialog() {
  const T = useT();
  const { searchOpen, setSearchOpen, currentPath, navigate } = useFileManagerStore();
  const [query,     setQuery]     = useState('');
  const [recursive, setRecursive] = useState(true);

  const debouncedQuery = useDebounce(query, 350);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['file-manager-search', debouncedQuery, currentPath, recursive],
    queryFn:  () => searchFiles({ q: debouncedQuery, path: currentPath, recursive }),
    enabled:  debouncedQuery.trim().length >= 2,
  });

  const handleSelect = (item) => {
    if (item.directory) {
      navigate(item.path);
    } else {
      const parent = item.path.substring(0, item.path.lastIndexOf('/')) || '/';
      navigate(parent);
    }
    setSearchOpen(false);
    setQuery('');
  };

  const handleClose = () => { setSearchOpen(false); setQuery(''); };

  return (
    <Dialog open={searchOpen} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.border}` } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: T.textPrimary }}>Search Files</Typography>
          <IconButton size="small" onClick={handleClose} sx={{ color: T.textFaint }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        {/* Search input */}
        <TextField
          autoFocus fullWidth size="small"
          placeholder="Type to search… (min 2 chars)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ fontSize: 18, color: T.textFaint, mr: 1 }} />,
            sx: { fontSize: 13 },
          }}
          sx={{ mb: 1 }}
        />

        {/* Options */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <FormControlLabel
            control={
              <Switch checked={recursive} onChange={e => setRecursive(e.target.checked)} size="small"
                sx={{ '& .MuiSwitch-thumb': { bgcolor: recursive ? T.teal : T.textFaint },
                  '& .Mui-checked + .MuiSwitch-track': { bgcolor: T.tealBg } }} />
            }
            label={<Typography sx={{ fontSize: 12, color: T.textMuted }}>Recursive</Typography>}
          />
          <Typography sx={{ fontSize: 12, color: T.textFaint }}>
            Search in: <strong style={{ color: T.textMuted }}>{currentPath}</strong>
          </Typography>
        </Box>

        {/* Results */}
        <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
          {isFetching && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${T.glassBorder}`,
                borderTopColor: T.teal, animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </Box>
          )}
          {!isFetching && debouncedQuery.length >= 2 && results.length === 0 && (
            <Typography sx={{ textAlign: 'center', py: 3, fontSize: 13, color: T.textMuted }}>
              No results for "{debouncedQuery}"
            </Typography>
          )}
          <List dense disablePadding>
            {results.map((item) => {
              const color = getFileColor(item);
              return (
                <ListItemButton key={item.path} onClick={() => handleSelect(item)}
                  sx={{ borderRadius: 1, mb: 0.25, '&:hover': { bgcolor: T.hoverBg } }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {item.directory
                      ? <FolderIcon sx={{ fontSize: 18, color }} />
                      : <InsertDriveFileIcon sx={{ fontSize: 18, color }} />}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.name}
                    secondary={item.path}
                    primaryTypographyProps={{ fontSize: 13, color: T.textPrimary }}
                    secondaryTypographyProps={{ fontSize: 11, color: T.textFaint, noWrap: true }}
                  />
                  <Typography sx={{ fontSize: 11, color: T.textFaint, ml: 1 }}>
                    {item.directory ? `${item.childCount} items` : item.formattedSize}
                  </Typography>
                </ListItemButton>
              );
            })}
          </List>
          {results.length === 200 && (
            <Typography sx={{ textAlign: 'center', py: 1, fontSize: 11, color: T.textFaint }}>
              Showing first 200 results — refine your search
            </Typography>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
