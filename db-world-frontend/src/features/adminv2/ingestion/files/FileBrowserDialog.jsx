import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, List, ListItemButton, ListItemIcon, ListItemText,
  CircularProgress, Alert, Breadcrumbs, Link, Typography,
  Stack, Chip, ToggleButton, ToggleButtonGroup, IconButton,
  Tooltip, alpha, Box,
} from '@mui/material';
import { useT } from '@shared/theme';
import {
  Folder, FolderOpen, InsertDriveFile, NavigateNext,
  Home, CheckCircle,
} from '@mui/icons-material';
import { useFileBrowser } from '../hooks/useFileBrowser';

function fmtSize(b) {
  if (!b) return null;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

/**
 * A file-picker dialog that browses the server's stream-path or temp-path.
 *
 * Props:
 *   open       — bool
 *   onClose    — () => void
 *   onSelect   — (item: FileBrowserItem) => void
 *   title      — dialog title
 */
export default function FileBrowserDialog({ open, onClose, onSelect, title = 'Browse Server Files' }) {
  const T = useT();
  const [root, setRoot]       = useState('temp');
  const [subPath, setSubPath] = useState('');
  const [selected, setSelected] = useState(null);

  const { data: items = [], isLoading, error, refetch } = useFileBrowser(open ? root : null, subPath);

  const crumbs = subPath ? subPath.split('/').filter(Boolean) : [];

  const navigate = (dir) => {
    setSubPath((prev) => prev ? `${prev}/${dir}` : dir);
    setSelected(null);
  };

  const goToIndex = (idx) => {
    const parts = crumbs.slice(0, idx + 1);
    setSubPath(parts.join('/'));
    setSelected(null);
  };

  const goHome = () => { setSubPath(''); setSelected(null); };

  const handleConfirm = () => {
    if (selected) onSelect(selected);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Typography variant="h6" fontWeight={600}>{title}</Typography>
          <ToggleButtonGroup
            size="small"
            value={root}
            exclusive
            onChange={(_, v) => { if (v) { setRoot(v); setSubPath(''); setSelected(null); } }}
          >
            <ToggleButton value="temp">Temp</ToggleButton>
            <ToggleButton value="stream">Stream</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Breadcrumbs */}
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.5}
          sx={{ px: 2, py: 1, borderBottom: `1px solid ${T.border}`, bgcolor: alpha(T.bg, 0.5) }}
        >
          <Tooltip title="Root">
            <IconButton size="small" onClick={goHome}>
              <Home fontSize="small" />
            </IconButton>
          </Tooltip>
          <Breadcrumbs separator={<NavigateNext fontSize="small" />} sx={{ flex: 1 }}>
            <Link
              component="button"
              variant="caption"
              onClick={goHome}
              underline="hover"
              sx={{ fontWeight: 600 }}
            >
              {root}
            </Link>
            {crumbs.map((c, i) => (
              i === crumbs.length - 1 ? (
                <Typography key={i} variant="caption" fontWeight={600}>{c}</Typography>
              ) : (
                <Link
                  key={i}
                  component="button"
                  variant="caption"
                  onClick={() => goToIndex(i)}
                  underline="hover"
                >
                  {c}
                </Link>
              )
            ))}
          </Breadcrumbs>
        </Stack>

        {/* File list */}
        <Box sx={{ minHeight: 320, maxHeight: 460, overflow: 'auto' }}>
          {isLoading && (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
              <CircularProgress size={28} />
            </Stack>
          )}
          {error && (
            <Alert severity="error" sx={{ m: 2 }}>
              {error?.response?.data?.message ?? 'Failed to list files'}
            </Alert>
          )}
          {!isLoading && !error && (
            <List dense disablePadding>
              {items.length === 0 && (
                <ListItemText
                  primary={<Typography color="text.secondary" variant="body2" sx={{ p: 2 }}>Empty directory</Typography>}
                />
              )}
              {items.map((item) => {
                const isSelected = selected?.path === item.path;
                return (
                  <ListItemButton
                    key={item.path}
                    selected={isSelected}
                    onClick={() => {
                      if (item.directory) {
                        navigate(item.name);
                      } else {
                        setSelected(item);
                      }
                    }}
                    sx={{
                      borderBottom: `1px solid ${alpha(T.border, 0.5)}`,
                      bgcolor: isSelected ? alpha(T.teal, 0.08) : undefined,
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {item.directory
                        ? <FolderOpen sx={{ color: 'warning.main' }} />
                        : <InsertDriveFile sx={{ color: 'text.secondary', fontSize: 20 }} />
                      }
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" noWrap>
                          {item.name}
                          {isSelected && <CheckCircle sx={{ fontSize: 14, ml: 0.75, color: 'primary.main', verticalAlign: 'middle' }} />}
                        </Typography>
                      }
                      secondary={
                        !item.directory && (
                          <Stack direction="row" spacing={1} component="span">
                            {item.extension && (
                              <Chip label={item.extension.toUpperCase()} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 16 }} />
                            )}
                            {item.size && (
                              <Typography variant="caption" color="text.secondary">{fmtSize(item.size)}</Typography>
                            )}
                          </Stack>
                        )
                      }
                    />
                  </ListItemButton>
                );
              })}
            </List>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        {selected && (
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1, pl: 1 }} noWrap>
            Selected: {selected.name}
          </Typography>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!selected}
          onClick={handleConfirm}
        >
          Select
        </Button>
      </DialogActions>
    </Dialog>
  );
}
