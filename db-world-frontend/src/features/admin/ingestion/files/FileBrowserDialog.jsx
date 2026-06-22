import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  alpha,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  CheckCircle,
  CreateNewFolder,
  Folder as FolderIcon,
  FolderOpen,
  Home,
  InsertDriveFile,
  NavigateNext,
  Storage,
} from '@mui/icons-material';

import { useT } from '@shared/theme';
import { useFileBrowser } from '../hooks/useFileBrowser';

function fmtSize(bytes) {
  if (!bytes || !Number.isFinite(Number(bytes))) return null;
  const value = Number(bytes);
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

function extLabel(item) {
  return item?.extension ? item.extension.toUpperCase() : null;
}

function DialogSection({ title, subtitle, right, children }) {
  return (
    <Stack spacing={1}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="subtitle2" fontWeight={800}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {right ? <Box flexShrink={0}>{right}</Box> : null}
      </Stack>
      {children}
    </Stack>
  );
}

export default function FileBrowserDialog({
  open,
  onClose,
  onSelect,
  title = 'Browse Server Files',
  folderMode = false,
}) {
  const T = useT();
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'));

  const [root, setRoot] = useState('temp');
  const [subPath, setSubPath] = useState('');
  const [selected, setSelected] = useState(null);

  const { data: items = [], isLoading, error } = useFileBrowser(open ? root : null, subPath);

  const crumbs = useMemo(() => (subPath ? subPath.split('/').filter(Boolean) : []), [subPath]);
  const directories = useMemo(() => items.filter((item) => item.directory), [items]);
  const files = useMemo(() => items.filter((item) => !item.directory), [items]);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setSubPath('');
      setRoot('temp');
    }
  }, [open]);

  const navigate = (dirName) => {
    setSubPath((prev) => (prev ? `${prev}/${dirName}` : dirName));
    setSelected(null);
  };

  const goToIndex = (idx) => {
    setSubPath(crumbs.slice(0, idx + 1).join('/'));
    setSelected(null);
  };

  const goHome = () => {
    setSubPath('');
    setSelected(null);
  };

  const handleRootChange = (_, value) => {
    if (!value || value === root) return;
    setRoot(value);
    setSubPath('');
    setSelected(null);
  };

  const handleConfirmFile = () => {
    if (!selected) return;
    onSelect({
      ...selected,
      root,
      subPath: subPath.replace(/\/[^/]+$/, ''),
    });
    onClose();
  };

  const handleSelectFolder = () => {
    const folderName = crumbs.length > 0 ? crumbs[crumbs.length - 1] : root;
    onSelect({
      path: folderName,
      name: folderName,
      directory: true,
      root,
      subPath,
    });
    onClose();
  };

  const fileCount = files.length;
  const directoryCount = directories.length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={isSmDown}
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: 4 },
          overflow: 'hidden',
          minHeight: { xs: '100dvh', sm: 620 },
          background:
            theme.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)'
              : 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,250,252,0.97) 100%)',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1.25, pt: { xs: 1.5, sm: 2 }, px: { xs: 1.25, sm: 2 } }}>
        <Stack spacing={1.25}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.25}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1.1} alignItems="center" minWidth={0}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 2.25,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                  color: 'primary.main',
                  flexShrink: 0,
                }}
              >
                {folderMode ? <FolderIcon sx={{ fontSize: 20 }} /> : <Storage sx={{ fontSize: 20 }} />}
              </Box>
              <Box minWidth={0}>
                <Typography variant="h6" fontWeight={900} lineHeight={1.15}>
                  {title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {folderMode
                    ? 'Browse server folders and select a folder or file path for batch processing.'
                    : 'Browse server storage and select one file to process.'}
                </Typography>
              </Box>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
              {folderMode ? (
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  startIcon={<CreateNewFolder sx={{ fontSize: 16 }} />}
                  onClick={handleSelectFolder}
                  sx={{ borderRadius: 999, whiteSpace: 'nowrap' }}
                >
                  Select this folder
                </Button>
              ) : null}

              <ToggleButtonGroup
                size="small"
                value={root}
                exclusive
                onChange={handleRootChange}
                sx={{
                  '& .MuiToggleButton-root': {
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: '999px !important',
                    px: 1.4,
                  },
                }}
              >
                <ToggleButton value="temp">Temp</ToggleButton>
                <ToggleButton value="stream">Stream</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>

          <Paper
            variant="outlined"
            sx={{
              px: 1.25,
              py: 1,
              borderRadius: 3,
              bgcolor: alpha(theme.palette.primary.main, 0.03),
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
              <Stack direction="row" spacing={1} alignItems="center" minWidth={0} sx={{ flex: 1 }}>
                <Tooltip title="Go to root">
                  <IconButton size="small" onClick={goHome}>
                    <Home fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Breadcrumbs separator={<NavigateNext fontSize="small" />} sx={{ flex: 1, minWidth: 0 }}>
                  <Link
                    component="button"
                    variant="caption"
                    underline="hover"
                    onClick={goHome}
                    sx={{ fontWeight: 700 }}
                  >
                    {root}
                  </Link>
                  {crumbs.map((crumb, index) => {
                    const isLast = index === crumbs.length - 1;
                    return isLast ? (
                      <Typography key={`${crumb}-${index}`} variant="caption" fontWeight={700} color="text.primary">
                        {crumb}
                      </Typography>
                    ) : (
                      <Link
                        key={`${crumb}-${index}`}
                        component="button"
                        variant="caption"
                        underline="hover"
                        onClick={() => goToIndex(index)}
                      >
                        {crumb}
                      </Link>
                    );
                  })}
                </Breadcrumbs>
              </Stack>

              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                <Chip size="small" variant="outlined" label={`${directoryCount} folder${directoryCount !== 1 ? 's' : ''}`} sx={{ fontWeight: 700 }} />
                <Chip size="small" variant="outlined" label={`${fileCount} file${fileCount !== 1 ? 's' : ''}`} sx={{ fontWeight: 700 }} />
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: { xs: 1.25, sm: 2 }, pb: { xs: 1.25, sm: 2 }, pt: 0 }}>
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.4fr) minmax(300px, 0.8fr)' },
            alignItems: 'start',
          }}
        >
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{ minHeight: { xs: 360, sm: 420 }, maxHeight: { xs: 'calc(100dvh - 260px)', sm: 520 }, overflow: 'auto' }}>
              {isLoading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ py: 7 }}>
                  <CircularProgress size={28} />
                </Stack>
              ) : null}

              {error ? (
                <Alert severity="error" sx={{ m: 2, borderRadius: 2.5 }}>
                  {error?.response?.data?.message ?? 'Failed to list files'}
                </Alert>
              ) : null}

              {!isLoading && !error ? (
                <>
                  {items.length === 0 ? (
                    <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ py: 7, px: 2 }}>
                      <FolderOpen sx={{ fontSize: 34, color: 'warning.main' }} />
                      <Typography variant="body2" fontWeight={700}>
                        Empty directory
                      </Typography>
                      <Typography variant="caption" color="text.secondary" textAlign="center">
                        There are no files or folders in this location.
                      </Typography>
                    </Stack>
                  ) : (
                    <List dense disablePadding>
                      {items.map((item) => {
                        const isSelected = selected?.path === item.path;
                        const itemExt = extLabel(item);

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
                              borderBottom: `1px solid ${alpha(T.border, 0.42)}`,
                              bgcolor: isSelected ? alpha(T.teal, 0.08) : undefined,
                              py: 1.1,
                              alignItems: 'flex-start',
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 38, pt: 0.15 }}>
                              {item.directory ? (
                                <FolderOpen sx={{ color: 'warning.main', fontSize: 21 }} />
                              ) : (
                                <InsertDriveFile sx={{ color: 'text.secondary', fontSize: 20 }} />
                              )}
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Typography variant="body2" fontWeight={isSelected ? 700 : 500} sx={{ wordBreak: 'break-word' }}>
                                  {item.name}
                                  {isSelected ? (
                                    <CheckCircle sx={{ fontSize: 14, ml: 0.75, color: 'primary.main', verticalAlign: 'middle' }} />
                                  ) : null}
                                </Typography>
                              }
                              secondary={
                                !item.directory ? (
                                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                                    {itemExt ? (
                                      <Chip
                                        label={itemExt}
                                        size="small"
                                        variant="outlined"
                                        sx={{ fontSize: '0.66rem', height: 20, fontWeight: 700 }}
                                      />
                                    ) : null}
                                    {item.size ? (
                                      <Chip
                                        label={fmtSize(item.size)}
                                        size="small"
                                        variant="outlined"
                                        sx={{ fontSize: '0.66rem', height: 20 }}
                                      />
                                    ) : null}
                                  </Stack>
                                ) : (
                                  <Typography variant="caption" color="text.secondary">
                                    Open folder
                                  </Typography>
                                )
                              }
                            />
                          </ListItemButton>
                        );
                      })}
                    </List>
                  )}
                </>
              ) : null}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ borderRadius: 3, p: 1.25 }}>
            <Stack spacing={1.25}>
              <DialogSection
                title="Selection summary"
                subtitle={folderMode ? 'Use file selection or choose the current folder' : 'Choose one server file'}
              >
                <Stack spacing={0.9}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      Root
                    </Typography>
                    <Chip size="small" variant="outlined" label={root} sx={{ fontWeight: 700 }} />
                  </Stack>

                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      Current path
                    </Typography>
                    <Typography variant="body2" fontWeight={700} textAlign="right" sx={{ wordBreak: 'break-word' }}>
                      {subPath || '/'}
                    </Typography>
                  </Stack>

                  <Divider />

                  <Typography variant="caption" color="text.secondary">
                    Selected item
                  </Typography>

                  {selected ? (
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1,
                        borderRadius: 2.5,
                        bgcolor: alpha(theme.palette.primary.main, 0.03),
                      }}
                    >
                      <Stack spacing={0.8}>
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <InsertDriveFile sx={{ fontSize: 18, color: 'primary.main', mt: 0.15 }} />
                          <Box minWidth={0}>
                            <Typography variant="body2" fontWeight={700} sx={{ wordBreak: 'break-word' }}>
                              {selected.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                              {selected.path}
                            </Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                          {selected.extension ? (
                            <Chip size="small" variant="outlined" label={selected.extension.toUpperCase()} sx={{ fontSize: '0.66rem', height: 20, fontWeight: 700 }} />
                          ) : null}
                          {selected.size ? (
                            <Chip size="small" variant="outlined" label={fmtSize(selected.size)} sx={{ fontSize: '0.66rem', height: 20 }} />
                          ) : null}
                          <Chip size="small" color="primary" variant="outlined" label="Ready" sx={{ fontSize: '0.66rem', height: 20, fontWeight: 700 }} />
                        </Stack>
                      </Stack>
                    </Paper>
                  ) : (
                    <Alert severity="info" sx={{ borderRadius: 2.5 }}>
                      {folderMode
                        ? 'You can select a file or use “Select this folder” for the current folder.'
                        : 'Select one file from the list to enable confirmation.'}
                    </Alert>
                  )}
                </Stack>
              </DialogSection>

              <Divider />

              <DialogSection
                title="How selection works"
                subtitle={folderMode ? 'Batch flow details' : 'Single-file flow details'}
              >
                <Stack direction="row" flexWrap="wrap" gap={0.75}>
                  <Chip size="small" variant="outlined" label={folderMode ? 'Folder mode' : 'File mode'} sx={{ fontWeight: 700 }} />
                  <Chip size="small" variant="outlined" label={`${directoryCount} folders`} />
                  <Chip size="small" variant="outlined" label={`${fileCount} files`} />
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                  Click a folder to navigate into it. Click a file to select it. Breadcrumbs let you jump back up the path.
                </Typography>
              </DialogSection>
            </Stack>
          </Paper>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: { xs: 1.25, sm: 2 }, py: { xs: 1.15, sm: 1.5 }, borderTop: `1px solid ${alpha(theme.palette.divider, 0.78)}` }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          sx={{ width: '100%' }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0, wordBreak: 'break-word' }}>
            {selected ? `Selected: ${selected.name}` : folderMode ? 'No file selected — current folder can still be chosen.' : 'No file selected'}
          </Typography>

          <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Button onClick={onClose} sx={{ borderRadius: 999, flex: { xs: 1, sm: 'none' } }}>
              Cancel
            </Button>
            {!folderMode ? (
              <Button
                variant="contained"
                disabled={!selected}
                onClick={handleConfirmFile}
                sx={{ borderRadius: 999, flex: { xs: 1, sm: 'none' }, boxShadow: 'none', minWidth: 110 }}
              >
                Select
              </Button>
            ) : (
              <Button
                variant="contained"
                disabled={!!selected && selected.directory}
                onClick={selected ? handleConfirmFile : handleSelectFolder}
                sx={{ borderRadius: 999, flex: { xs: 1, sm: 'none' }, boxShadow: 'none', minWidth: 140 }}
              >
                {selected ? 'Select file' : 'Use current folder'}
              </Button>
            )}
          </Stack>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
